import { expect, mock, test } from 'claude-code/testing'

// Run through run_g2.sh: the plugin copy there has a concrete repository URL in update-check.tsx,
// so the release-check request really happens. Everything else is the shipped code.
const NOW = new Date(2026, 10, 9, 12, 5).getTime()
const HOUR = 3_600_000
const SLOW = { timeoutMs: 30_000 }
const URL = 'https://api.github.com/repos/avraham-tech/toolkitty/releases/latest'
const OWN_FAILURE = /feature update-check failed/

function boot(on: any, store: Record<string, unknown> = {}, manifest: string | null = '{"version":"1.2.3"}') {
  const kv = new Map<string, unknown>(Object.entries({ language: 'en', ...store }))
  on('store.get', (_: any, e: any) => ({ value: kv.get(e.key) }))
  on('store.set', (_: any, e: any) => {
    kv.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    kv.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...kv.keys()] }))
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = { toasts: [] as { text: string; timeoutMs?: number }[], fetches: [] as { url: string; init: any }[] }
  const plan = {
    manifest,
    status: 200,
    ok: true,
    text: '{"tag_name":"v1.3.0","name":"Big one"}',
    throws: false,
    hold: 0,
  }
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    seen.toasts.push({ text: e.text, timeoutMs: e.timeoutMs })
    return { value: undefined }
  })
  on('fs.read', (_: any, e: any) => {
    if (String(e.path).endsWith('plugin.json')) {
      if (plan.manifest === null) throw new Error('ENOENT')
      return { value: plan.manifest }
    }
    return { value: '' }
  })
  on('http.fetch', async (_: any, e: any) => {
    if (!String(e.url).includes('api.github.com')) return { value: { status: 200, ok: true, headers: {}, text: '{}' } }
    seen.fetches.push({ url: e.url, init: e.init })
    if (plan.hold > 0) await clock.sleep(plan.hold)
    if (plan.throws) throw new Error('ECONNREFUSED')
    return { value: { status: plan.status, ok: plan.ok, headers: {}, text: plan.text } }
  })
  on('agent.list', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/tmp/project' }))
  on('session.surfaces', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const updates = () => seen.toasts.filter(t => /is out|Toolkitty .* יצאה/.test(t.text))
  return { clock, seen, plan, kv, updates }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })

test('a newer release: one GET with the GitHub accept header, an alert notice (a toast with the default timeout), and both stamps stored', SLOW, async ($, on) => {
  const { seen, kv, updates } = boot(on)
  await start($)
  expect(seen.fetches).toHaveLength(1)
  expect(seen.fetches[0]!.url).toBe(URL)
  expect(seen.fetches[0]!.init).toEqual({ headers: { accept: 'application/vnd.github+json' } })
  // the feature now posts the release as an 'alert' notice (core.notice), whose toast carries no timeout of its own
  expect(updates()).toEqual([{ text: 'Toolkitty 1.3.0 is out (you have 1.2.3): Big one', timeoutMs: undefined }])
  expect(kv.get('update-check:lastAt')).toBe(NOW)
  expect(kv.get('update-check:latest')).toEqual({ version: '1.3.0', name: 'Big one' })
  // the command now reports it
  const r = await $.command.run({ command: 'toolkitty-version', args: '' })
  expect(r.text).toContain('Newest known release: 1.3.0 (Big one)')
  expect(r.text.endsWith('A newer version is available.')).toBe(true)
})

test('an equal release stores the check but shows no toast', SLOW, async ($, on) => {
  const { plan, kv, updates } = boot(on)
  plan.text = '{"tag_name":"v1.2.3","name":"Same"}'
  await start($)
  expect(updates()).toHaveLength(0)
  expect(kv.get('update-check:latest')).toEqual({ version: '1.2.3', name: 'Same' })
  expect(kv.get('update-check:lastAt')).toBe(NOW)
  const r = await $.command.run({ command: 'toolkitty-version', args: '' })
  expect(r.text.endsWith('You are up to date.')).toBe(true)
})

test('an older release shows no toast', SLOW, async ($, on) => {
  const { plan, updates, kv } = boot(on)
  plan.text = '{"tag_name":"1.1.9","name":"Old"}'
  await start($)
  expect(updates()).toHaveLength(0)
  expect(kv.get('update-check:latest')).toEqual({ version: '1.1.9', name: 'Old' })
})

test('the release name falls back to the tag when it is missing or empty; the leading v is stripped', SLOW, async ($, on) => {
  const { plan, updates } = boot(on)
  plan.text = '{"tag_name":"V2.0.0","name":""}'
  await start($)
  expect(updates().map(u => u.text)).toEqual(['Toolkitty 2.0.0 is out (you have 1.2.3): V2.0.0'])
})

test('a pre-release current version is told about its release', SLOW, async ($, on) => {
  const { plan, updates } = boot(on, {}, '{"version":"1.2.3-beta.1"}')
  plan.text = '{"tag_name":"v1.2.3","name":"GA"}'
  await start($)
  expect(updates().map(u => u.text)).toEqual(['Toolkitty 1.2.3 is out (you have 1.2.3-beta.1): GA'])
})

test('a thrown request is swallowed: no toast, nothing stored, no failure reported', SLOW, async ($, on) => {
  const { plan, kv, updates, seen } = boot(on)
  plan.throws = true
  await start($)
  expect(seen.fetches).toHaveLength(1)
  expect(updates()).toHaveLength(0)
  expect(kv.get('update-check:lastAt')).toBeUndefined()
  expect(kv.get('update-check:latest')).toBeUndefined()
})

for (const [label, patch] of [
  ['an HTTP 403', { status: 403, ok: false, text: '{"message":"rate limited"}' }],
  ['a body that is not JSON', { text: '<html>' }],
  ['a JSON body that is not an object', { text: '"hello"' }],
  ['null', { text: 'null' }],
  ['a body with no tag', { text: '{"name":"x"}' }],
  ['an empty tag', { text: '{"tag_name":""}' }],
  ['a numeric tag', { text: '{"tag_name":7}' }],
] as const) {
  test(`${label} stores no successful check or release and shows no toast`, SLOW, async ($, on) => {
    const { plan, kv, updates } = boot(on)
    Object.assign(plan, patch)
    await start($)
    expect(updates()).toHaveLength(0)
    expect(kv.get('update-check:lastAt')).toBeUndefined()
    expect(kv.get('update-check:latest')).toBeUndefined()
  })
}

test('a slow request is given up after 8 seconds without a toast or a stored check', SLOW, async ($, on) => {
  const { clock, plan, kv, updates } = boot(on)
  plan.hold = 60_000
  const started = start($)
  await clock.advance(7_999)
  await clock.advance(1)
  await started
  expect(updates()).toHaveLength(0)
  expect(kv.get('update-check:lastAt')).toBeUndefined()
})

test('a request that answers in time is not cut off by the 8 second timer', SLOW, async ($, on) => {
  const { clock, plan, updates } = boot(on)
  plan.hold = 7_000
  const started = start($)
  await clock.advance(7_000)
  await started
  expect(updates()).toHaveLength(1)
  // the timeout timer was cancelled: moving past 8 s changes nothing
  await clock.advance(5_000)
  expect(updates()).toHaveLength(1)
})

test('checked less than a day ago: no request; more than a day: a request', SLOW, async ($, on) => {
  const recent = boot(on, { 'update-check:lastAt': NOW - 23 * HOUR })
  await start($)
  expect(recent.seen.fetches).toHaveLength(0)
})

test('checked more than a day ago: a request is made and the stamp is refreshed', SLOW, async ($, on) => {
  const { seen, kv } = boot(on, { 'update-check:lastAt': NOW - 25 * HOUR })
  await start($)
  expect(seen.fetches).toHaveLength(1)
  expect(kv.get('update-check:lastAt')).toBe(NOW)
})

test('exactly a day ago counts as due', SLOW, async ($, on) => {
  const { seen } = boot(on, { 'update-check:lastAt': NOW - 24 * HOUR })
  await start($)
  expect(seen.fetches).toHaveLength(1)
})

test('a second session start the same day does not ask again', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  await start($)
  expect(seen.fetches).toHaveLength(1)
})

for (const [label, patch] of [
  ['HTTP 404', { status: 404, ok: false }],
  ['HTTP 403', { status: 403, ok: false }],
  ['invalid JSON', { text: '<html>' }],
  ['a missing release tag', { text: '{"name":"no tag"}' }],
  ['a connection error', { throws: true }],
] as const) {
  test(`${label}: failed attempts are limited to one per 24 hours across sessions`, SLOW, async ($, on) => {
    const { clock, plan, seen, kv } = boot(on)
    Object.assign(plan, patch)
    await start($)
    expect(seen.fetches).toHaveLength(1)
    expect(kv.get('update-check:lastAttemptAt')).toBe(NOW)
    expect(kv.get('update-check:lastAt')).toBeUndefined()
    await start($)
    expect(seen.fetches).toHaveLength(1)
    // Simulate a persisted attempt just under 24 hours old without ticking every UI timer for a day.
    kv.set('update-check:lastAttemptAt', NOW - 24 * HOUR + 1)
    await start($)
    expect(seen.fetches).toHaveLength(1)
    await clock.advance(1)
    await start($)
    expect(seen.fetches).toHaveLength(2)
    expect(kv.get('update-check:lastAttemptAt')).toBe(NOW + 1)
    expect(kv.get('update-check:lastAt')).toBeUndefined()
  })
}

test('a timed-out request is not retried in a second session that day', SLOW, async ($, on) => {
  const { clock, plan, seen, kv } = boot(on)
  plan.hold = 60_000
  const started = start($)
  await clock.advance(8_000)
  await started
  expect(kv.get('update-check:lastAttemptAt')).toBe(NOW)
  expect(kv.get('update-check:lastAt')).toBeUndefined()
  await start($)
  expect(seen.fetches).toHaveLength(1)
})

test('a failed request keeps the last successful release and check time', SLOW, async ($, on) => {
  const previousAt = NOW - 25 * HOUR
  const previousRelease = { version: '1.3.0', name: 'Already known' }
  const { plan, kv, seen } = boot(on, {
    'update-check:lastAt': previousAt,
    'update-check:latest': previousRelease,
  })
  plan.throws = true
  await start($)
  expect(kv.get('update-check:lastAt')).toBe(previousAt)
  expect(kv.get('update-check:latest')).toEqual(previousRelease)
  await start($)
  expect(seen.fetches).toHaveLength(1)
  expect((await $.command.run({ command: 'toolkitty-version', args: '' })).text).toContain('Newest known release: 1.3.0 (Already known)')
})

test('an unreadable plugin.json skips the request altogether', SLOW, async ($, on) => {
  const { seen, kv } = boot(on, {}, null)
  await start($)
  expect(seen.fetches).toHaveLength(0)
  expect(kv.get('update-check:lastAt')).toBeUndefined()
})

test('off switch: no request even with a concrete URL', SLOW, async ($, on) => {
  const { seen } = boot(on, { enabled: { 'update-check': false } })
  await start($)
  expect(seen.fetches).toHaveLength(0)
})

test('Hebrew toast', SLOW, async ($, on) => {
  const { updates } = boot(on, { language: 'he' })
  await start($)
  expect(updates().map(u => u.text)).toEqual(['Toolkitty 1.3.0 יצאה (יש לך 1.2.3): Big one'])
})
