import { expect, mock, test } from 'claude-code/testing'

const NOW = new Date(2026, 10, 9, 12, 5).getTime()
const DAY = 86_400_000
const SLOW = { timeoutMs: 30_000 }
const OWN_FAILURE = /feature update-check failed/

const pad2 = (n: number) => String(n).padStart(2, '0')
/** The "last check" stamp the command prints, in local time. */
const stamp = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function boot(on: any, store: Record<string, unknown> = {}, manifest: string | null = '{"name":"toolkitty","version":"1.2.3"}') {
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
  const seen = { commands: [] as string[], toasts: [] as { text: string; timeoutMs?: number }[], fetches: [] as string[], reads: [] as string[] }
  const plan = { manifest }
  on('command.register', (_: any, e: any) => {
    seen.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    seen.toasts.push({ text: e.text, timeoutMs: e.timeoutMs })
    return { value: undefined }
  })
  on('fs.read', (_: any, e: any) => {
    seen.reads.push(String(e.path))
    if (String(e.path).endsWith('plugin.json')) {
      if (plan.manifest === null) throw new Error('ENOENT')
      return { value: plan.manifest }
    }
    return { value: '' }
  })
  on('http.fetch', (_: any, e: any) => {
    seen.fetches.push(e.url)
    return { value: { status: 200, ok: true, headers: {}, text: '{}' } }
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
  /** Only the release-check requests (other features may fetch too). */
  const releaseFetches = () => seen.fetches.filter(u => u.includes('api.github.com'))
  return { clock, seen, plan, kv, releaseFetches }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const ver = ($: any) => $.command.run({ command: 'toolkitty-version', args: '' })

test('loads and registers /toolkitty-version', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(seen.commands).toContain('toolkitty-version')
})

test('/toolkitty-version before any check shows the version, "never" and no release', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  const r = await ver($)
  expect(r.text).toBe('Toolkitty version: 1.2.3\nLast check: never\nNewest known release: none yet')
  expect(seen.reads.some(p => p.replace(/\\/g, '/').endsWith('/.claude-plugin/plugin.json'))).toBe(true)
})

test('/toolkitty-version tells when a newer release is known', SLOW, async ($, on) => {
  boot(on, { 'update-check:lastAt': NOW - 2 * DAY, 'update-check:latest': { version: '1.3.0', name: 'Big one' } })
  await start($)
  const r = await ver($)
  expect(r.text).toBe(`Toolkitty version: 1.2.3\nLast check: ${stamp(NOW - 2 * DAY)}\nNewest known release: 1.3.0 (Big one)\nA newer version is available.`)
})

for (const [latest, expected] of [
  ['1.2.3', 'You are up to date.'],
  ['1.2.2', 'You are up to date.'],
  ['0.9.9', 'You are up to date.'],
  ['1.10.0', 'A newer version is available.'],
  ['2.0.0', 'A newer version is available.'],
  ['1.2.4', 'A newer version is available.'],
] as const) {
  test(`/toolkitty-version compares numbers, not text: known ${latest} against 1.2.3`, SLOW, async ($, on) => {
    boot(on, { 'update-check:lastAt': NOW, 'update-check:latest': { version: latest, name: 'n' } })
    await start($)
    const r = await ver($)
    expect(r.text.split(String.fromCharCode(10)).pop()).toBe(expected)
  })
}

test('a pre-release of the same number is older than the release', SLOW, async ($, on) => {
  boot(on, { 'update-check:latest': { version: '1.2.3', name: 'GA' } }, '{"version":"1.2.3-beta.1"}')
  await start($)
  const r = await ver($)
  expect(r.text).toContain('Toolkitty version: 1.2.3-beta.1')
  expect(r.text.split('\n').pop()).toBe('A newer version is available.')
})

for (const manifest of [null, 'not json', '{"name":"x"}', '{"version":""}', '[]']) {
  test(`an unreadable or version-less plugin.json (${manifest === null ? 'missing' : manifest}) shows the version as unknown`, SLOW, async ($, on) => {
    boot(on, { 'update-check:latest': { version: '9.9.9', name: 'N' } }, manifest)
    await start($)
    const r = await ver($)
    expect(r.text).toBe(['Toolkitty version: unknown', 'Last check: never', 'Newest known release: 9.9.9 (N)'].join(String.fromCharCode(10)))
  })
}

test('off switch: the command answers the off text and session start does nothing', SLOW, async ($, on) => {
  const { releaseFetches } = boot(on, { enabled: { 'update-check': false } })
  await start($)
  expect(releaseFetches()).toHaveLength(0)
  expect((await ver($)).text).toBe('The feature is off; turn it on in the /toolkitty pane')
})

test('Hebrew: the command answer is in Hebrew', SLOW, async ($, on) => {
  boot(on, { language: 'he', 'update-check:lastAt': NOW, 'update-check:latest': { version: '2.0.0', name: 'שחרור' } })
  await start($)
  const r = await ver($)
  expect(r.text).toBe(`גרסת Toolkitty: 1.2.3\nבדיקה אחרונה: ${stamp(NOW)}\nהגרסה החדשה ביותר הידועה: 2.0.0 (שחרור)\nקיימת גרסה חדשה יותר.`)
})
