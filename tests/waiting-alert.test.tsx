import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }
const URL_KEY = 'waiting-alert:url'
const NTFY = 'https://ntfy.sh/secret-topic-123'

const OWN_FAILURE = /feature waiting-alert failed/

function boot(on: any, store: Record<string, unknown> = {}) {
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
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = {
    commands: [] as { name: string; argumentHint?: string }[],
    toasts: [] as string[],
    notes: [] as { text: string; title?: string }[],
    fetches: [] as { url: string; init: any }[],
  }
  const verdict = { decision: 'ask' as 'allow' | 'ask' | 'deny' }
  const net = { ok: true, status: 200, throws: false }
  on('command.register', (_: any, e: any) => {
    seen.commands.push({ name: e.name, argumentHint: e.argumentHint })
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.notify', (_: any, e: any) => {
    seen.notes.push({ text: e.text, title: e.title })
    return { value: { isSent: true } }
  })
  on('http.fetch', (_: any, e: any) => {
    seen.fetches.push({ url: e.url, init: e.init })
    if (net.throws) throw new Error('ECONNREFUSED')
    return { value: { status: net.status, ok: net.ok, headers: {}, text: '' } }
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
  on('tool.check', () => ({ decision: verdict.decision }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  /** Only this feature's escalation sentence. */
  const waits = () => seen.notes.filter(n => /still waiting for your approval|עדיין ממתין לאישור/.test(n.text))
  return { clock, seen, verdict, net, waits, kv }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const ask = ($: any, id = 'tu1', tool = 'Bash', extra: Record<string, unknown> = {}) =>
  $.tool.check({ tool, input: { command: 'rm x' }, tool_use_id: id, ...extra })
const begin = ($: any, id = 't1', extra: Record<string, unknown> = {}) => $.turn.start({ text: 'hi', turnId: id, ...extra })
const finish = ($: any, durationMs: number, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs, isAborted: false, turnId: 't1', reason: 'answer', ...extra })
const run = ($: any, args: string) => $.command.run({ command: 'push-url', args })

/** Everything Toolkitty noticed, as the notices pane shows it. */
async function noticeTexts($: any): Promise<string[]> {
  const ui = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'toolkitty-notices',
    props: { title: 'Notices', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const out = (await ui.findAll({ type: 'Text' })).map((f: any) => String(f.text))
  await ui.unmount()
  return out
}

test('loads and registers /push-url with its argument hint', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  const c = seen.commands.find(x => x.name === 'push-url')
  expect(c).toBeDefined()
  expect(c?.argumentHint).toBe('<url> | off | test')
})

test('/push-url with no argument says no URL is set, then names only the host once set', SLOW, async ($, on) => {
  const { kv } = boot(on)
  await start($)
  expect((await run($, '')).text).toBe('No push URL is set. Use /push-url https://ntfy.sh/<your-topic>')
  expect((await run($, '   ')).text).toBe('No push URL is set. Use /push-url https://ntfy.sh/<your-topic>')
  const set = await run($, NTFY)
  expect(set.text).toBe('Push URL saved (ntfy.sh). Use /push-url test to try it.')
  expect(kv.get(URL_KEY)).toBe(NTFY)
  const cur = await run($, '')
  expect(cur.text).toBe('Push goes to ntfy.sh (topic hidden). /push-url off clears it.')
  expect(cur.text).not.toContain('secret-topic')
  expect(set.text).not.toContain('secret-topic')
})

test('/push-url rejects anything that is not an http(s) URL and stores nothing', SLOW, async ($, on) => {
  const { kv } = boot(on)
  await start($)
  for (const bad of ['ntfy.sh/topic', 'ftp://ntfy.sh/topic', 'https://with space', 'javascript:alert(1)', 'hello', 'OFF', 'Test']) {
    const r = await run($, bad)
    expect(r.text).toBe('That is not an http(s) URL. Example: /push-url https://ntfy.sh/my-topic')
  }
  expect(kv.get(URL_KEY)).toBeUndefined()
})

test('/push-url accepts http and an upper-case scheme, trims the argument, and replaces the old URL', SLOW, async ($, on) => {
  const { kv } = boot(on)
  await start($)
  expect((await run($, '  http://example.org:8080/t?x=1  ')).text).toBe('Push URL saved (example.org:8080). Use /push-url test to try it.')
  expect(kv.get(URL_KEY)).toBe('http://example.org:8080/t?x=1')
  expect((await run($, 'HTTPS://NTFY.SH/abc')).text).toContain('(NTFY.SH)')
  expect(kv.get(URL_KEY)).toBe('HTTPS://NTFY.SH/abc')
})

test('/push-url off clears the stored URL and later pushes send nothing', SLOW, async ($, on) => {
  const { seen, kv } = boot(on, { [URL_KEY]: NTFY })
  await start($)
  expect((await run($, 'off')).text).toBe('Push is off; the stored URL was cleared.')
  expect(kv.get(URL_KEY)).toBe('')
  expect((await run($, '')).text).toBe('No push URL is set. Use /push-url https://ntfy.sh/<your-topic>')
  expect((await run($, 'test')).text).toBe('No push URL is set. Use /push-url https://ntfy.sh/<your-topic>')
  expect(seen.fetches).toHaveLength(0)
})

test('/push-url test with no URL sends nothing; with a URL it POSTs the test message', SLOW, async ($, on) => {
  const { seen, net } = boot(on)
  await start($)
  expect((await run($, 'test')).text).toBe('No push URL is set. Use /push-url https://ntfy.sh/<your-topic>')
  expect(seen.fetches).toHaveLength(0)

  await run($, NTFY)
  const ok = await run($, 'test')
  expect(ok.text).toBe('Test message sent.')
  expect(seen.fetches).toHaveLength(1)
  const f = seen.fetches[0]!
  expect(f.url).toBe(NTFY)
  expect(f.init.method).toBe('POST')
  expect(f.init.headers).toEqual({ Title: 'Claude Code', Priority: 'default' })
  expect(f.init.body).toBe('Test message from Claude Code: push notifications work.')

  net.ok = false
  net.status = 500
  expect((await run($, 'test')).text).toBe('Sending failed (check the URL and your network).')
})

test('an approval left waiting escalates after exactly a minute with a notification and a high-priority push', SLOW, async ($, on) => {
  const { clock, waits, seen } = boot(on, { [URL_KEY]: NTFY })
  await start($)
  const v = await ask($, 'tu1', 'Bash')
  expect(v.decision).toBe('ask')
  await clock.advance(59_999)
  expect(waits()).toHaveLength(0)
  expect(seen.fetches).toHaveLength(0)
  await clock.advance(1)
  expect(waits()).toEqual([{ text: 'Claude Code is still waiting for your approval of Bash', title: 'Claude Code' }])
  expect(seen.fetches).toHaveLength(1)
  const f = seen.fetches[0]!
  expect(f.url).toBe(NTFY)
  expect(f.init).toEqual({
    method: 'POST',
    headers: { Title: 'Claude Code', Priority: 'high' },
    body: 'Claude Code is still waiting for your approval of Bash',
  })
  // an escalation is an alert notice: it is listed and it still pops a toast
  expect(await noticeTexts($)).toContain('Claude Code is still waiting for your approval of Bash')
  expect(seen.toasts).toContain('Claude Code is still waiting for your approval of Bash')
  // it fires once only
  await clock.advance(300_000)
  expect(waits()).toHaveLength(1)
  expect(seen.fetches).toHaveLength(1)
})

test('with no push URL set, the escalation notifies locally and sends no value anywhere', SLOW, async ($, on) => {
  const { clock, waits, seen } = boot(on)
  await start($)
  await ask($, 'tu1', 'Edit')
  await clock.advance(60_000)
  expect(waits().map(n => n.text)).toEqual(['Claude Code is still waiting for your approval of Edit'])
  expect(seen.fetches).toHaveLength(0)
})

test('an approval that is answered (tool runs) before a minute never escalates', SLOW, async ($, on) => {
  const { clock, waits, seen } = boot(on, { [URL_KEY]: NTFY })
  await start($)
  await ask($, 'tu1')
  await clock.advance(30_000)
  await $.tool.call({ tool: 'Bash', command: 'rm x', tool_use_id: 'tu1' })
  await clock.advance(120_000)
  expect(waits()).toHaveLength(0)
  expect(seen.fetches).toHaveLength(0)
})

test('a call with another id does not cancel the pending approval', SLOW, async ($, on) => {
  const { clock, waits } = boot(on)
  await start($)
  await ask($, 'tu1')
  await $.tool.call({ tool: 'Bash', command: 'ls', tool_use_id: 'other' })
  await clock.advance(60_000)
  expect(waits()).toHaveLength(1)
})

test('allow and deny verdicts, a missing tool_use_id and subagent checks start no escalation', SLOW, async ($, on) => {
  const { clock, waits, verdict } = boot(on)
  await start($)
  verdict.decision = 'allow'
  expect((await ask($, 'a1')).decision).toBe('allow')
  verdict.decision = 'deny'
  expect((await ask($, 'a2')).decision).toBe('deny')
  verdict.decision = 'ask'
  const probe = await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })
  expect(probe.decision).toBe('ask')
  await ask($, 'a3', 'Bash', { agentId: 'sub1' })
  await clock.advance(120_000)
  expect(waits()).toHaveLength(0)
})

test('asking twice for the same id escalates once; two ids escalate separately', SLOW, async ($, on) => {
  const { clock, waits } = boot(on)
  await start($)
  await ask($, 'tu1', 'Bash')
  await clock.advance(30_000)
  await ask($, 'tu1', 'Bash')
  await ask($, 'tu2', 'Write')
  await clock.advance(30_000)
  // tu1 was re-armed 30 s ago: nothing yet
  expect(waits()).toHaveLength(0)
  await clock.advance(30_000)
  expect(waits().map(n => n.text).sort()).toEqual([
    'Claude Code is still waiting for your approval of Bash',
    'Claude Code is still waiting for your approval of Write',
  ])
})

test('a new turn or a finished turn clears waiting approvals', SLOW, async ($, on) => {
  const { clock, waits } = boot(on)
  await start($)
  await ask($, 'tu1')
  await begin($)
  await clock.advance(120_000)
  expect(waits()).toHaveLength(0)

  await ask($, 'tu2')
  await finish($, 1000)
  await clock.advance(120_000)
  expect(waits()).toHaveLength(0)
})

test('a subagent turn start or finish leaves a waiting approval alone', SLOW, async ($, on) => {
  const { clock, waits } = boot(on)
  await start($)
  await ask($, 'tu1')
  await $.turn.start({ text: 's', turnId: 'sub', agentId: 'a1' })
  await $.turn.complete({ answer: 'x', durationMs: 500_000, isAborted: false, turnId: 'sub', reason: 'answer', agentId: 'a1' })
  await clock.advance(60_000)
  expect(waits()).toHaveLength(1)
})

test('a long turn pushes "done: ..." with the answer collapsed and cut to 100 characters', SLOW, async ($, on) => {
  const { seen } = boot(on, { [URL_KEY]: NTFY })
  await start($)
  const answer = 'line one\n\n   line   two ' + 'x'.repeat(200)
  await finish($, 120_001, { answer })
  expect(seen.fetches).toHaveLength(1)
  const f = seen.fetches[0]!
  expect(f.init.headers).toEqual({ Title: 'Claude Code', Priority: 'default' })
  const expected = answer.replace(/\s+/g, ' ').trim().slice(0, 100)
  expect(f.init.body).toBe('done: ' + expected)
  expect(f.init.body.startsWith('done: line one line two xxx')).toBe(true)
})

test('turns of two minutes or less, aborted turns, subagent turns and no URL push nothing', SLOW, async ($, on) => {
  const { seen } = boot(on, { [URL_KEY]: NTFY })
  await start($)
  await finish($, 120_000)
  await finish($, 500_000, { isAborted: true })
  await finish($, 500_000, { agentId: 'a1' })
  expect(seen.fetches).toHaveLength(0)
  await run($, 'off')
  await finish($, 500_000)
  expect(seen.fetches).toHaveLength(0)
})

test('a failing push does not break the escalation or the turn', SLOW, async ($, on) => {
  const { clock, waits, seen, net } = boot(on, { [URL_KEY]: NTFY })
  net.ok = false
  net.status = 503
  await start($)
  await ask($, 'tu1')
  await clock.advance(60_000)
  expect(waits()).toHaveLength(1)
  expect(seen.fetches).toHaveLength(1)
  await finish($, 130_000)
  expect(seen.fetches).toHaveLength(2)
  expect(seen.toasts.filter(x => /waiting-alert/.test(x))).toEqual([])
  // a push the server refused is an alert the person must see: it toasts for the escalation and again for the done push,
  // and the notices list folds the two into one row with a count
  const failed = 'The push to your phone failed (check /push-url and your network).'
  expect((await noticeTexts($)).filter(x => x.startsWith(failed))).toEqual([`${failed} ×2`])
  expect(seen.toasts.filter(x => x === failed)).toHaveLength(2)
})

test('tool calls are never denied or altered by the alert', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await ask($, 'tu1')
  const r = await $.tool.call({ tool: 'Bash', command: 'ls', tool_use_id: 'tu1' })
  expect(r.deny).toBeUndefined()
  const r2 = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(r2.deny).toBeUndefined()
})

test('off switch: no escalation, no push, the command answers the off text', SLOW, async ($, on) => {
  const { clock, waits, seen, kv } = boot(on, { enabled: { 'waiting-alert': false }, [URL_KEY]: NTFY })
  await start($)
  const v = await ask($, 'tu1')
  expect(v.decision).toBe('ask')
  await clock.advance(120_000)
  expect(waits()).toHaveLength(0)
  await finish($, 500_000)
  await begin($)
  await $.tool.call({ tool: 'Bash', command: 'ls', tool_use_id: 'tu1' })
  expect(seen.fetches).toHaveLength(0)
  for (const args of ['', 'off', 'test', NTFY, 'bad']) {
    expect((await run($, args)).text).toBe('This feature is off; turn it on in the /toolkitty panel')
  }
  // nothing was stored by the refused set
  expect(kv.get(URL_KEY)).toBe(NTFY)
})

test('Hebrew: command answers and the escalation are in Hebrew', SLOW, async ($, on) => {
  const { clock, waits, seen } = boot(on, { language: 'he', [URL_KEY]: NTFY })
  await start($)
  expect((await run($, '')).text).toBe('ההתראות נשלחות ל-ntfy.sh (הנושא מוסתר). ‎/push-url off מנקה.')
  expect((await run($, 'nope')).text).toBe('זו לא כתובת http(s). דוגמה: ‎/push-url https://ntfy.sh/my-topic')
  expect((await run($, 'test')).text).toBe('הודעת הבדיקה נשלחה.')
  expect(seen.fetches[0]!.init.body).toBe('הודעת בדיקה מ-Claude Code: ההתראות פועלות.')
  await ask($, 'tu1', 'Bash')
  await clock.advance(60_000)
  expect(waits().map(n => n.text)).toEqual(['Claude Code עדיין ממתין לאישור שלך עבור Bash'])
  expect((await run($, 'off')).text).toBe('ההתראות לטלפון כבויות; הכתובת השמורה נמחקה.')
})

test('a network error on the push is reported as failed for /push-url test and ignored by the escalation', SLOW, async ($, on) => {
  const { clock, waits, seen, net } = boot(on, { [URL_KEY]: NTFY })
  net.throws = true
  await start($)
  expect((await run($, 'test')).text).toBe('Sending failed (check the URL and your network).')
  await ask($, 'tu1', 'Bash')
  await clock.advance(60_000)
  expect(waits()).toHaveLength(1)
  await finish($, 200_000)
  expect(seen.fetches).toHaveLength(3)
  expect(seen.toasts.filter(x => /waiting-alert/.test(x))).toEqual([])
})
