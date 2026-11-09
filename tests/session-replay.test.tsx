import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SEC = 1000
const SLOW = { timeoutMs: 60_000 }
const SELF = 'sess-self'
const STORE_KEY = `session-replay:${SELF}`
const OWN_FAILURE = /feature session-replay failed/

type Out = Record<string, unknown>

type Rig = {
  kv: Map<string, unknown>
  storeSets: { key: string; value: unknown }[]
  commands: string[]
  opened: string[]
  toasts: string[]
  copied: string[]
  clock: ReturnType<typeof mock.clock>
  verdict: { decision: 'allow' | 'ask' | 'deny' }
  out: (e: any) => Out
}

const OK: Out = { result: {}, text: 'ok' }

function rig(on: any, o: { lang?: string; enabled?: Record<string, boolean>; store?: Record<string, unknown> } = {}): Rig {
  const kv = new Map<string, unknown>(Object.entries({ language: o.lang ?? 'en', ...(o.enabled === undefined ? {} : { enabled: o.enabled }), ...(o.store ?? {}) }))
  const r: Rig = {
    kv,
    storeSets: [],
    commands: [],
    opened: [],
    toasts: [],
    copied: [],
    clock: undefined as never,
    verdict: { decision: 'allow' },
    out: () => OK,
  }
  on('store.get', (_: any, e: any) => ({ value: kv.get(e.key) }))
  on('store.set', (_: any, e: any) => {
    kv.set(e.key, e.value)
    r.storeSets.push({ key: e.key, value: e.value })
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    kv.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...kv.keys()] }))
  r.clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:\\Users\\test', TEMP: 'C:/tmp' })
  mock.session(on)

  on('fs.write', () => ({ value: undefined }))
  on('fs.read', (_: any, e: any) => {
    throw new Error('ENOENT ' + e.path)
  })
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', (_: any, e: any) => {
    throw new Error('ENOENT ' + e.path)
  })
  on('fs.list', () => ({ value: [] }))
  on('command.register', (_: any, e: any) => {
    r.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    r.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.notify', () => ({ value: undefined }))
  on('ui.copy', (_: any, e: any) => {
    r.copied.push(e.text)
    return { value: { isCopied: true } } as never
  })
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    r.toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.id', () => ({ value: SELF }))
  on('session.cwd', () => ({ value: 'C:/work/proj' }))
  on('session.usage', () => ({ value: { startedAt: T0, context: { window: 200000, percent: 10 }, rateLimits: [] } }) as never)
  on('agent.list', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  on('tool.check', () => ({ decision: r.verdict.decision }))
  on('tool.call', (_: any, e: any) => r.out(e) as never)
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return r
}

const PANE = (surface: 'desktop' | 'terminal' = 'desktop') =>
  ({
    plugin: 'toolkitty',
    component: 'Pane',
    requestId: 'session-replay',
    surface,
    props: { title: 'Replay', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

const start = ($: any) => $.session.start({ cwd: 'C:/work/proj', surface: 'desktop', isInteractive: true })
let turns = 0
const turnStart = ($: any, text = 'hi') => $.turn.start({ text, turnId: `t${++turns}` })
const turnDone = ($: any, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs: 65_000, isAborted: false, turnId: `t${turns}`, reason: 'answer', ...extra })

const two = (n: number) => String(n).padStart(2, '0')
const hms = (ms: number) => {
  const d = new Date(ms)
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}
const hm = (ms: number) => hms(ms).slice(0, 5)

const texts = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
const joined = async (ui: any): Promise<string> => (await texts(ui)).join('\n')
const rowsOf = async (ui: any): Promise<{ key: string; text: string }[]> =>
  (await ui.findAll({ type: 'Button' }))
    .filter((b: any) => String(b.key).startsWith('rp-r-'))
    .map((b: any) => ({ key: b.key as string, text: String(b.text).trim() }))
const label = async (ui: any, key: string): Promise<string> => String((await ui.find({ key })).props['label'])
const stored = (r: Rig): Out[] => (r.kv.get(STORE_KEY) as Out[] | undefined) ?? []

const read = (tool: string, file: string) => ({ tool, file_path: file }) as never
const FILTER_KEYS = ['rp-f-turns', 'rp-f-tools', 'rp-f-edits', 'rp-f-errors', 'rp-f-checks', 'rp-f-incidents', 'rp-f-approvals']

test('loads: registers /replay, opens the pane, bad arguments get the usage line', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  expect(r.commands).toContain('replay')
  const cmd = await $.command.run({ command: 'replay', args: '' })
  expect(cmd.text).toBe('The session replay is open.')
  expect(r.opened).toContain('session-replay')
  const bad = await $.command.run({ command: 'replay', args: 'banana' })
  expect(bad.text).toBe('Usage: /replay (open), /replay keep on|off, /replay clear')
  expect((await $.command.run({ command: 'replay', args: 'keep' })).text).toBe('The replay lives in this session only.')
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
})

test('empty pane: a fact, a hint, the footnote, all ten header actions and no status', SLOW, async ($, on) => {
  rig(on)
  await start($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('Replay')
  expect(all).toContain('Nothing has happened in this session yet.')
  expect(all).toContain('appear here as they happen')
  expect(all).toContain('Retention: this session only.')
  expect(all).not.toMatch(/\d+ events/)
  for (const key of [...FILTER_KEYS, 'rp-copy', 'rp-keep', 'rp-clear']) expect(await ui.find({ key })).toBeDefined()
  expect(await label(ui, 'rp-f-turns')).toBe('● Turns')
  expect(await label(ui, 'rp-keep')).toBe('Keep across sessions off')
  await ui.unmount()
})

test('events come from every source, newest first, with a glyph per kind', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { 'claim-check': true } }) // claim-check records the test/build evidence
  r.out = (e: any) => {
    if (e.tool === 'Bash' && e.command === 'npm run build') return { isError: true, result: 'error TS2304: Cannot find name foo', text: 'error TS2304: Cannot find name foo' }
    return OK
  }
  await start($)
  await $.prompt.submit({ text: 'Fix the flaky parser test please' })
  await turnStart($, 'Fix the flaky parser test please') // T0
  await r.clock.advance(1 * SEC)
  await $.tool.call(read('Read', 'C:/work/proj/src/parser.ts')) // T0+1
  await r.clock.advance(1 * SEC)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/work/proj/src/parser.ts', old_string: 'a', new_string: 'b' } as never) // T0+2
  await r.clock.advance(1 * SEC)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never) // T0+3 -> test evidence ok
  await r.clock.advance(1 * SEC)
  await $.tool.call({ tool: 'Bash', command: 'npm run build' } as never) // T0+4 -> error + build evidence failed
  await r.clock.advance(1 * SEC)
  r.verdict.decision = 'ask'
  await $.tool.check({ tool: 'Bash', input: { command: 'git push origin main' }, tool_use_id: 'tuA' }) // T0+5 asked
  r.verdict.decision = 'allow' // the person said yes: the engine now runs the call
  await r.clock.advance(1 * SEC)
  await $.tool.call({ tool: 'Bash', command: 'git push origin main' } as never) // T0+6 approved + tool
  await r.clock.advance(1 * SEC)
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /' } as never) // guarded by dangerous-commands: an incident
  await r.clock.advance(1 * SEC)
  await turnDone($) // T0+8: checks, incident, turn end

  const ui = await $.ui.mount(PANE())
  const rows = (await rowsOf(ui)).map(x => x.text)
  const dump = rows.join('\n')
  // newest first: the turn end on top, the first turn row at the bottom
  expect(rows[0]).toBe(`${hms(T0 + 8 * SEC)} ▶ Turn ended · 1:05`)
  expect(rows[rows.length - 1]).toBe(`${hms(T0)} ▶ Fix the flaky parser test please`)
  expect(dump).toContain(`${hms(T0 + 1 * SEC)} · Read · C:/work/proj/src/parser.ts`)
  expect(dump).toContain(`${hms(T0 + 2 * SEC)} ✎ C:/work/proj/src/parser.ts`)
  expect(dump).toContain(`${hms(T0 + 3 * SEC)} ✓ Tests: npm test · ok`)
  expect(dump).toMatch(/✗ Build: npm run build · failed/)
  expect(dump).toContain(`✗ error TS2304: Cannot find name foo`)
  expect(dump).toContain(`${hms(T0 + 5 * SEC)} 🟡 Approval requested: Bash · git push origin main`)
  expect(dump).toContain(`${hms(T0 + 6 * SEC)} 🟡 Approved: Bash · git push origin main`)
  expect(dump).toContain(`${hms(T0 + 6 * SEC)} · Bash · git push origin main`)
  expect(dump).toMatch(/⛨ /)
  // the status line counts the rows and gives the time range
  expect(await joined(ui)).toContain(`${rows.length} events · ${hm(T0)}–${hm(T0 + 8 * SEC)}`)
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  await ui.unmount()
})

test('an approval the person refuses is logged once, as Denied, not as an error and not as Approved', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await turnStart($, 'push')
  r.verdict.decision = 'ask' // nobody answers the dialog: the engine refuses the call
  await $.tool.call({ tool: 'Bash', command: 'npm install left-pad' } as never)
  const ui = await $.ui.mount(PANE())
  const dump = (await rowsOf(ui)).map(x => x.text).join('\n')
  expect(dump).toContain('🟡 Approval requested: Bash · npm install left-pad')
  expect(dump).toContain('🟡 Denied: Bash · npm install left-pad')
  expect(dump).not.toContain('Approved')
  expect(dump).not.toContain('✗')
  expect(dump).not.toContain('· Bash') // the refused call is not a tool row either
  await ui.unmount()
})

test('a plain tool error that mentions a permission is still an error, and an ask for one tool is not closed by another tool', SLOW, async ($, on) => {
  const r = rig(on)
  r.out = (e: any) => (e.tool === 'Bash' ? { isError: true, result: 'EACCES: permission denied, open /etc/x', text: 'EACCES: permission denied, open /etc/x' } : OK)
  await start($)
  await turnStart($, 'x')
  r.verdict.decision = 'ask'
  await $.tool.check({ tool: 'Bash', input: { command: 'cat /etc/x' }, tool_use_id: 'tuQ' })
  r.verdict.decision = 'allow'
  await $.tool.call(read('Read', 'other.ts')) // another tool: the pending ask stays open
  await $.tool.call({ tool: 'Bash', command: 'cat /etc/x' } as never) // approved, then failed on its own
  const ui = await $.ui.mount(PANE())
  const dump = (await rowsOf(ui)).map(x => x.text).join('\n')
  expect(dump).toContain('🟡 Approved: Bash · cat /etc/x')
  expect(dump).toContain('✗ EACCES: permission denied, open /etc/x')
  expect(dump).not.toContain('Denied')
  await ui.unmount()
})

test('prompt label is the first 60 characters; a slash command never becomes a label; sub-agent turns are not logged', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await $.command.run({ command: 'replay', args: 'keep on' })
  const long = 'Please refactor the whole parser module and then update every caller of it in the repository ' + 'x'.repeat(80)
  await $.prompt.submit({ text: long })
  await turnStart($, long)
  await turnDone($)
  await $.prompt.submit({ text: '/replay' })
  await turnStart($, '/replay')
  await $.turn.start({ text: 'sub', turnId: 'sub1', agentId: 'agent-1' })
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'sub1', agentId: 'agent-1', reason: 'answer' })
  const turnsLogged = stored(r).filter(ev => ev['kind'] === 'turn')
  expect(turnsLogged.length).toBe(3) // start, end, start of the slash turn; the sub-agent logged nothing
  const first = turnsLogged[0]?.['text'] as string
  expect(first).toBe(long.slice(0, 60))
  expect(first.length).toBe(60)
  expect(JSON.stringify(stored(r))).not.toContain('every caller')
  expect(turnsLogged[2]?.['text']).toBe('Turn')
})

test('masking: key-like strings are masked in prompts, errors, edits and checks, in the pane, the copy and the store', SLOW, async ($, on) => {
  const r = rig(on)
  const sk = 'sk-abcdefghijklmnopqrstuvwx1234'
  const ghp = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'
  const aws = 'AKIAIOSFODNN7EXAMPLE'
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
  const longKey = 'Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk0LzXcVbNm'
  r.out = (e: any) =>
    e.tool === 'Bash' && String(e.command).includes('curl')
      ? { isError: true, result: 'curl: (22) 401 for Authorization: Bearer abcdefghijklmnop1234 and api_key=hunter2hunter2 ' + sk, text: 'curl: (22) 401 for Authorization: Bearer abcdefghijklmnop1234 and api_key=hunter2hunter2 ' + sk }
      : OK
  await start($)
  await $.command.run({ command: 'replay', args: 'keep on' })
  await $.prompt.submit({ text: `use ${sk} and password=hunter2hunter2 to log in` })
  await turnStart($, `use ${sk} and password=hunter2hunter2 to log in`)
  await $.tool.call({ tool: 'Bash', command: `curl -H "X-Token: ${ghp}" https://u:s3cretpass@host.example/api?key=${longKey}` } as never)
  await $.tool.call({ tool: 'Edit', file_path: `C:/work/${aws}/notes-${jwt}.txt`, old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Bash', command: `echo ${longKey} && npm test` } as never)
  await turnDone($)

  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'rp-copy' })
  const everywhere = [await joined(ui), (await rowsOf(ui)).map(x => x.text).join('\n'), r.copied.join('\n'), JSON.stringify(stored(r))].join('\n')
  for (const bad of [sk, ghp, aws, jwt, longKey, 'hunter2', 's3cretpass', 'abcdefghijklmnop1234']) expect(everywhere).not.toContain(bad)
  expect(everywhere).toContain('[masked]')
  expect(r.copied[0]).toMatch(/use \[[^\]]+\] and password=\[[^\]]+\]/)
  // the error row keeps its own words
  expect(r.copied[0]).toContain('curl: (22) 401 for Authorization: [masked]')
  await ui.unmount()
})

test('caps: an error text is cut at 100 characters, a prompt at 60, an expanded row shows the whole (capped) text', SLOW, async ($, on) => {
  const r = rig(on)
  const body = 'E'.repeat(10) + ' ' + 'line of a very long failure message '.repeat(30)
  r.out = (e: any) => (e.tool === 'Bash' ? { isError: true, result: body, text: body } : OK)
  await start($)
  await $.command.run({ command: 'replay', args: 'keep on' })
  await turnStart($, 'go')
  await $.tool.call({ tool: 'Bash', command: 'make' } as never)
  const err = stored(r).find(ev => ev['kind'] === 'error')
  expect(err).toBeDefined()
  expect((err?.['text'] as string).length).toBe(100)
  expect(err?.['text']).toBe(body.replace(/\s+/g, ' ').slice(0, 100))
  expect(err?.['ok']).toBe(false)
  expect(err?.['ref']).toBe('Bash · make')

  const ui = await $.ui.mount(PANE())
  const collapsed = (await rowsOf(ui)).find(x => x.text.includes('EEEEEEEEEE'))
  expect(collapsed?.text.endsWith('…')).toBe(true)
  expect(collapsed!.text.length).toBeLessThan(hms(T0).length + 3 + 100)
  await ui.press({ key: collapsed!.key })
  const open = (await rowsOf(ui)).find(x => x.key === collapsed!.key)
  expect(open?.text).toContain(String(err?.['text']))
  expect(open?.text.endsWith('…')).toBe(false)
  await ui.unmount()
})

test('filters toggle each kind, update the count and the label, and an empty result says so', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { 'claim-check': true } })
  r.out = (e: any) => (e.tool === 'Bash' && e.command === 'bad' ? { isError: true, result: 'boom', text: 'boom' } : OK)
  await start($)
  await turnStart($, 'work')
  await $.tool.call(read('Read', 'a.ts'))
  await $.tool.call({ tool: 'Edit', file_path: 'a.ts', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Bash', command: 'bad' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  r.verdict.decision = 'ask'
  await $.tool.check({ tool: 'Bash', input: { command: 'git push' }, tool_use_id: 'tuC' })
  r.verdict.decision = 'allow'
  await turnDone($)

  const ui = await $.ui.mount(PANE())
  const countOf = async () => /(\d+) events/.exec(await joined(ui))?.[1]
  const all = Number(await countOf())
  expect(all).toBeGreaterThanOrEqual(7)
  const kinds: Record<string, RegExp> = {
    'rp-f-turns': /▶/,
    'rp-f-tools': /· Read/,
    'rp-f-edits': /✎/,
    'rp-f-errors': /✗ boom/,
    'rp-f-checks': /Tests:/,
    'rp-f-approvals': /🟡/,
  }
  for (const [key, re] of Object.entries(kinds)) {
    expect((await rowsOf(ui)).some(x => re.test(x.text))).toBe(true)
    await ui.press({ key })
    expect(await label(ui, key)).toMatch(/^○ /)
    expect((await rowsOf(ui)).some(x => re.test(x.text))).toBe(false)
    expect(Number(await countOf())).toBeLessThan(all)
    await ui.press({ key })
    expect(await label(ui, key)).toMatch(/^● /)
    expect(Number(await countOf())).toBe(all)
  }
  // switching everything off: the empty state for filters, the header actions stay
  for (const key of FILTER_KEYS) await ui.press({ key })
  const none = await joined(ui)
  expect(none).toContain('No event matches the filters.')
  expect(none).toContain('Switch a filter back on')
  expect((await rowsOf(ui)).length).toBe(0)
  expect(await ui.find({ key: 'rp-copy' })).toBeDefined()
  await ui.press({ key: 'rp-copy' }) // nothing visible: nothing is copied
  expect(r.copied).toEqual([])
  await ui.press({ key: 'rp-f-tools' })
  expect((await rowsOf(ui)).every(x => / · /.test(x.text))).toBe(true)
  await ui.unmount()
})

test('incident filter: a guarded command shows as an incident and the filter hides it', SLOW, async ($, on) => {
  rig(on)
  await start($)
  await turnStart($, 'cleanup')
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /' } as never)
  await turnDone($)
  const ui = await $.ui.mount(PANE())
  expect((await rowsOf(ui)).filter(x => x.text.includes('⛨')).length).toBe(1)
  await ui.press({ key: 'rp-f-incidents' })
  expect((await rowsOf(ui)).filter(x => x.text.includes('⛨')).length).toBe(0)
  await ui.unmount()
})

test('expand and collapse: one press expands one row (with its ref and turn), a second press collapses, another row switches', SLOW, async ($, on) => {
  const r = rig(on)
  r.out = (e: any) => (e.tool === 'Bash' ? { isError: true, result: 'compile failed in module ' + 'm'.repeat(90), text: 'compile failed in module ' + 'm'.repeat(90) } : OK)
  await start($)
  await turnStart($, 'build it')
  await $.tool.call({ tool: 'Bash', command: 'make all' } as never)
  await $.tool.call({ tool: 'Glob', pattern: '**/*.ts' } as never)
  const ui = await $.ui.mount(PANE())
  const find = async (re: RegExp) => (await rowsOf(ui)).find(x => re.test(x.text))!
  const errRow = await find(/compile failed/)
  expect(errRow.text).toContain('…')
  expect(await joined(ui)).not.toContain('ref: Bash · make all')

  await ui.press({ key: errRow.key })
  const expanded = await find(/compile failed/)
  expect(expanded.text).not.toContain('…')
  expect(expanded.text).toContain('m'.repeat(60))
  const all = await joined(ui)
  expect(all).toContain('ref: Bash · make all')
  expect(all).toContain(`turn: t${turns}`)

  await ui.press({ key: expanded.key })
  expect((await find(/compile failed/)).text).toContain('…')
  expect(await joined(ui)).not.toContain('ref: Bash · make all')

  // only one row is open at a time
  await ui.press({ key: (await find(/compile failed/)).key })
  const globRow = await find(/Glob/)
  await ui.press({ key: globRow.key })
  expect((await find(/compile failed/)).text).toContain('…')
  await ui.unmount()
})

test('Copy puts the filtered view on the clipboard, oldest first, with a title line', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await $.prompt.submit({ text: 'copy me' })
  await turnStart($, 'copy me')
  await r.clock.advance(SEC)
  await $.tool.call(read('Read', 'src/a.ts'))
  await r.clock.advance(SEC)
  await $.tool.call({ tool: 'Edit', file_path: 'src/a.ts', old_string: 'a', new_string: 'b' } as never)
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'rp-copy' })
  expect(r.copied.length).toBe(1)
  expect(r.copied[0]?.split('\n')).toEqual([
    'Session replay · 3 events',
    `${hms(T0)} ▶ copy me`,
    `${hms(T0 + SEC)} · Read · src/a.ts`,
    `${hms(T0 + 2 * SEC)} ✎ src/a.ts [Edit]`,
  ])
  // a filter narrows the export
  await ui.press({ key: 'rp-f-turns' })
  await ui.press({ key: 'rp-f-tools' })
  await ui.press({ key: 'rp-copy' })
  expect(r.copied[1]?.split('\n')).toEqual(['Session replay · 1 events', `${hms(T0 + 2 * SEC)} ✎ src/a.ts [Edit]`])
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  await ui.unmount()
})

test('keep: off by default stores nothing; /replay keep on writes the log and every new event; keep off deletes it', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await turnStart($, 'first')
  await $.tool.call(read('Read', 'a.ts'))
  expect(r.storeSets.filter(s => s.key.startsWith('session-replay'))).toEqual([])
  expect(r.kv.has(STORE_KEY)).toBe(false)

  const on1 = await $.command.run({ command: 'replay', args: 'keep on' })
  expect(on1.text).toBe('The replay will now be kept across sessions.')
  expect(r.kv.get('session-replay:keep')).toBe(true)
  expect(stored(r).map(ev => ev['kind'])).toEqual(['turn', 'tool'])
  expect((await $.command.run({ command: 'replay', args: 'keep' })).text).toBe('The replay is kept across sessions.')
  await $.tool.call(read('Read', 'b.ts'))
  expect(stored(r).length).toBe(3)

  const ui = await $.ui.mount(PANE())
  expect(await label(ui, 'rp-keep')).toBe('Keep across sessions on')
  expect(await joined(ui)).toContain('Retention: kept across sessions on this machine.')
  // the button flips it back
  await ui.press({ key: 'rp-keep' })
  expect(r.kv.get('session-replay:keep')).toBe(false)
  expect(r.kv.has(STORE_KEY)).toBe(false)
  expect(await label(ui, 'rp-keep')).toBe('Keep across sessions off')
  expect(await joined(ui)).toContain('Retention: this session only.')
  await $.tool.call(read('Read', 'c.ts'))
  expect(r.kv.has(STORE_KEY)).toBe(false)
  // ...and the typed command: off again is fine
  expect((await $.command.run({ command: 'replay', args: 'keep off' })).text).toBe('The replay is back to this session only; the saved copy was removed.')
  await ui.press({ key: 'rp-keep' })
  expect(stored(r).length).toBe(4) // the in-memory log was written whole: turn, a, b, c
  await ui.unmount()
})

test('keep on: a new session start loads the stored log of the same session id', SLOW, async ($, on) => {
  const earlier = [
    { at: T0 - 5 * SEC, kind: 'turn', text: 'Yesterday I asked', turnId: 'old1' },
    { at: T0 - 4 * SEC, kind: 'tool', text: 'Read', ok: true, ref: 'old.ts', turnId: 'old1' },
    { at: 'bad', kind: 'tool', text: 'broken' },
    { at: T0 - 3 * SEC, kind: 'banana', text: 'unknown kind' },
  ]
  const r = rig(on, { store: { 'session-replay:keep': true, [STORE_KEY]: earlier } })
  await start($)
  const ui = await $.ui.mount(PANE())
  const rows = (await rowsOf(ui)).map(x => x.text)
  expect(rows).toEqual([`${hms(T0 - 4 * SEC)} · Read · old.ts`, `${hms(T0 - 5 * SEC)} ▶ Yesterday I asked`])
  expect(await joined(ui)).toContain('2 events')
  expect(await label(ui, 'rp-keep')).toBe('Keep across sessions on')
  await turnStart($, 'today')
  expect(stored(r).length).toBe(3)
  await ui.unmount()
})

test('Clear empties the log (and the stored copy when keep is on)', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await $.command.run({ command: 'replay', args: 'keep on' })
  await turnStart($, 'x')
  await $.tool.call(read('Read', 'a.ts'))
  expect(stored(r).length).toBe(2)
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'rp-clear' })
  expect((await rowsOf(ui)).length).toBe(0)
  expect(await joined(ui)).toContain('Nothing has happened in this session yet.')
  expect(stored(r)).toEqual([])
  await $.tool.call(read('Read', 'b.ts'))
  expect(stored(r).length).toBe(1)
  expect((await $.command.run({ command: 'replay', args: 'clear' })).text).toBe('The replay was cleared.')
  expect(stored(r)).toEqual([])
  await ui.unmount()
})

test('the ring keeps 500 events; the pane shows the newest 60 and "+N older"', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await turnStart($, 'many')
  for (let i = 0; i < 519; i++) await $.tool.call(read('Read', `src/file-${i}.ts`))
  // 1 turn + 519 tools = 520 events, 500 stay
  const ui = await $.ui.mount(PANE())
  const rows = await rowsOf(ui)
  expect(rows.length).toBe(60)
  expect(rows[0]?.text).toContain('src/file-518.ts')
  expect(rows[59]?.text).toContain('src/file-459.ts')
  expect(await joined(ui)).toContain('+440 older')
  expect(await joined(ui)).toContain('500 events')
  await ui.press({ key: 'rp-copy' })
  const lines = r.copied[0]?.split('\n') ?? []
  expect(lines.length).toBe(501)
  expect(lines[0]).toBe('Session replay · 500 events')
  expect(lines[1]).toContain('src/file-19.ts') // 520 - 500 = the first 20 are gone: the turn and file-0..18
  expect(r.copied[0]).not.toContain('src/file-18.ts')
  expect(r.copied[0]).not.toContain('▶ many')
  await ui.unmount()
})

test('the terminal draws the same pane', SLOW, async ($, on) => {
  rig(on)
  await start($)
  await turnStart($, 'terminal turn')
  await $.tool.call(read('Read', 'a.ts'))
  const ui = await $.ui.mount(PANE('terminal'))
  const all = await joined(ui)
  expect(all).toContain('2 events')
  expect((await rowsOf(ui)).length).toBe(2)
  expect((await ui.findAll({ type: 'Button' })).length).toBe(10 + 2)
  await ui.unmount()
})

test('Hebrew: command, pane, filters, footnote and a Hebrew prompt', SLOW, async ($, on) => {
  const r = rig(on, { lang: 'he' })
  await start($)
  expect((await $.command.run({ command: 'replay', args: '' })).text).toBe('שחזור הסשן נפתח.')
  expect((await $.command.run({ command: 'replay', args: 'x' })).text).toContain('שימוש')
  const prompt = 'תקן את הבאג בפרסר ' + 'א'.repeat(80)
  await $.prompt.submit({ text: prompt })
  await turnStart($, prompt)
  await $.tool.call(read('Read', 'a.ts'))
  await turnDone($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('שחזור')
  expect(all).toMatch(/\d+ אירועים/)
  expect(all).toContain('שמירה: הסשן הזה בלבד.')
  expect(await label(ui, 'rp-f-turns')).toBe('● תורים')
  expect(await label(ui, 'rp-f-tools')).toBe('● כלים')
  expect(await label(ui, 'rp-f-errors')).toBe('● שגיאות')
  expect(await label(ui, 'rp-copy')).toBe('העתק')
  expect(await label(ui, 'rp-keep')).toBe('שמירה בין סשנים כבוי')
  expect(await label(ui, 'rp-clear')).toBe('נקה')
  const rows = (await rowsOf(ui)).map(x => x.text)
  expect(rows[0]).toContain('התור הסתיים · 1:05')
  expect(rows[rows.length - 1]).toContain(prompt.slice(0, 18)) // the Hebrew words survive
  await ui.press({ key: 'rp-copy' })
  expect(r.copied[0]?.split('\n')[0]).toMatch(/^שחזור הסשן · \d+ אירועים$/)
  await ui.unmount()
})

test('Hebrew prompt label is cut at 60 characters', SLOW, async ($, on) => {
  const r = rig(on, { lang: 'he' })
  await start($)
  await $.command.run({ command: 'replay', args: 'keep on' })
  const prompt = 'תקן את הבאג בפרסר ' + 'א'.repeat(80)
  await $.prompt.submit({ text: prompt })
  await turnStart($, prompt)
  expect(stored(r)[0]?.['text']).toBe(prompt.slice(0, 60))
})

test('off switch: nothing is recorded, the command and pane say it is off, no store writes', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { 'session-replay': false } })
  await start($)
  expect(r.commands).toContain('replay') // registered even when off
  const cmd = await $.command.run({ command: 'replay', args: '' })
  expect(cmd.text).toBe('The "Session replay" feature is off in the switches panel.')
  expect(r.opened).not.toContain('session-replay')
  expect((await $.command.run({ command: 'replay', args: 'keep on' })).text).toBe('The "Session replay" feature is off in the switches panel.')

  const out = await $.prompt.submit({ text: 'hello there' })
  expect((out as any).text).toBe('hello there')
  await turnStart($, 'hello there')
  await $.tool.call(read('Read', 'a.ts'))
  await $.tool.call({ tool: 'Edit', file_path: 'a.ts', old_string: 'a', new_string: 'b' } as never)
  await $.tool.check({ tool: 'Bash', input: { command: 'git push' }, tool_use_id: 'tuZ' })
  await turnDone($)
  expect(r.storeSets.filter(s => s.key.startsWith('session-replay'))).toEqual([])

  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('The feature is off in the switches panel.')
  expect((await ui.findAll({ type: 'Button' })).length).toBe(0)
  await ui.unmount()
})

test('turning the feature on later starts from an empty log (nothing recorded while it was off)', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { 'session-replay': false } })
  await start($)
  await turnStart($, 'while off')
  await $.tool.call(read('Read', 'a.ts'))
  await turnDone($)
  void r
  const ui = await $.ui.mount(PANE())
  expect((await rowsOf(ui)).length).toBe(0)
  await ui.unmount()
})

test('no chip: the band stays quiet', SLOW, async ($, on) => {
  rig(on)
  await start($)
  await turnStart($, 'x')
  await $.tool.call(read('Read', 'a.ts'))
  const band = await $.ui.mount({ plugin: 'toolkitty', component: 'AbovePrompt', surface: 'desktop', requestId: 'band-u', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} } } as never)
  expect(await band.find({ key: 'chip-session-replay' })).toBeUndefined()
  await band.unmount()
})

test('turn ends: answered, stopped and failed read differently; checks and incidents are logged once, not again next turn', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { 'claim-check': true } })
  r.out = (e: any) => (e.tool === 'Edit' ? { isError: true, result: 'old_string not found', text: 'old_string not found' } : OK)
  await start($)
  await $.command.run({ command: 'replay', args: 'keep on' })
  await turnStart($, 'one')
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'x.ts', old_string: 'a', new_string: 'b' } as never) // an errored edit is an error row, not an edit row
  await turnDone($)
  const count = (kind: string) => stored(r).filter(ev => ev['kind'] === kind).length
  expect(count('check')).toBe(1)
  expect(count('incident')).toBe(1)
  expect(count('edit')).toBe(0)
  expect(stored(r).find(ev => ev['kind'] === 'error')?.['text']).toBe('old_string not found')
  expect(stored(r).find(ev => ev['kind'] === 'check')?.['ok']).toBe(true)
  expect(stored(r).find(ev => ev['kind'] === 'incident')?.['ok']).toBe(false)

  await r.clock.advance(5 * SEC)
  await turnStart($, 'two') // nothing new: the same evidence and the same signal are not logged twice
  await turnDone($, { isAborted: true, reason: 'aborted' })
  await turnStart($, 'three')
  await turnDone($, { reason: 'error', durationMs: 3000 })
  expect(count('check')).toBe(1)
  expect(count('incident')).toBe(1)
  const ends = stored(r).filter(ev => ev['kind'] === 'turn' && /^Turn /.test(ev['text'] as string))
  expect(ends.map(ev => ev['text'])).toEqual(['Turn ended · 1:05', 'Turn stopped · 1:05', 'Turn ended with an error · 0:03'])
  expect(ends.map(ev => ev['ok'])).toEqual([true, false, false])
  expect(ends.every(ev => typeof ev['turnId'] === 'string')).toBe(true)
})

test('detail: the last 8 events, newest first', SLOW, async ($, on) => {
  rig(on)
  await start($)
  await turnStart($, 'detail')
  for (let i = 0; i < 12; i++) {
    await $.tool.call(read('Read', `d${i}.ts`))
  }
  // The real module gives session-replay neither a chip (renderChip is null) nor a band line, so no button
  // opens Toolkitty detail pane for it (register.tsx openDetail is only reachable from chips/bands/home rows).
  // Its last events are shown by its own pane; assert the band offers no way into the (unreachable) detail.
  const band = await $.ui.mount({ plugin: 'toolkitty', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } } as never)
  const keys = (await band.findAll({ type: 'Button' })).map((x: any) => String(x.key))
  expect(keys.filter((k: string) => /session-replay/.test(k))).toEqual([])
  await band.unmount()
  // the feature's own pane holds the events (the count is what it states)
  expect((await $.command.run({ command: 'replay', args: '' })).text).toBe('The session replay is open.')
  const ui = await $.ui.mount({ plugin: 'toolkitty', component: 'Pane', requestId: 'session-replay', surface: 'desktop', props: { title: 'Replay', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } } as never)
  const all = await joined(ui)
  expect(all).toContain('13 events')
  await ui.unmount()
})
