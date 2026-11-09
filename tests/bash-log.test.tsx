import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'bash-log',
  props: {
    title: 'Command log',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

type Opts = { store?: Record<string, unknown>; result?: (cmd: string) => Record<string, unknown>; sleepMs?: (cmd: string) => number }

function setup(on: any, opts: Opts = {}) {
  const registered: string[] = []
  const opened: string[] = []
  const filled: { text: string; mode?: string }[] = []
  mock.store(on, opts.store)
  const clock = mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test' })
  mock.session(on)
  on('command.register', (_: unknown, e: { name: string }) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: unknown, e: { id: string }) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('prompt.fill', (_: unknown, e: { text: string; mode?: string }) => {
    filled.push({ text: e.text, mode: e.mode })
    return { isFilled: true }
  })
  on('tool.call', async (_: unknown, e: any) => {
    const ms = opts.sleepMs?.(e.command) ?? 0
    if (ms > 0) await clock.sleep(ms)
    return opts.result?.(e.command) ?? { result: { stdout: 'ok', stderr: '', interrupted: false } }
  })
  return { registered, opened, filled, clock }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const bash = ($: any, command: string) => $.tool.call({ tool: 'Bash', command })

test('loads and registers /bash-log', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.registered).toContain('bash-log')
})

test('/bash-log opens the pane for any args, in English and Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  for (const args of ['', 'x y', '  ']) {
    const r = await $.command.run({ command: 'bash-log', args })
    expect((r as any).text).toBe('The command log is open.')
  }
  expect(s.opened.filter(x => x === 'bash-log').length).toBe(3)
})

test('/bash-log in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he' } })
  await start($)
  const r = await $.command.run({ command: 'bash-log', args: '' })
  expect((r as any).text).toBe('יומן הפקודות נפתח.')
})

test('empty pane shows count 0 and the empty text', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: '0 commands' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: 'No commands have run yet.' }))?.text).toBeTruthy()
  // header title, and a hint on what fills the pane
  expect((await ui.find({ type: 'Text', text: 'Command log' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /press a row to run it again/ }))?.text).toBeTruthy()
  expect((await ui.findAll({ type: 'Button' })).length).toBe(0)
  await ui.unmount()
})

test('a run is logged with success mark, duration and a re-run button', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { sleepMs: () => 3000 })
  await start($)
  const call = bash($, 'ls -la')
  await s.clock.advance(3000)
  const r = (await call) as any
  expect(r.result).toBeTruthy()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: '1 commands' }))?.text).toBeTruthy()
  // the row is one Button: mark, command, then the dim duration and the re-run word
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.length).toBe(1)
  expect(buttons[0]!.text).toMatch(/^✓ ls -la\s+0:03 · Run again$/)
  await ui.unmount()
})

test('an error result is logged as failed (cross mark)', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { result: () => ({ result: { stdout: '', stderr: 'nope', interrupted: false }, isError: true }) })
  await start($)
  await bash($, 'false')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.length).toBe(1)
  expect(buttons[0]!.text).toMatch(/^✗ false/)
  expect(buttons[0]!.text).not.toMatch(/✓/)
  await ui.unmount()
})

test('pressing Run again fills the prompt with the command (replace mode)', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await bash($, 'echo   hi')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const [btn] = await ui.findAll({ type: 'Button' })
  await ui.press({ key: btn!.key! })
  expect(s.filled.length).toBe(1)
  expect(s.filled[0]!.text).toBe('Run again: echo   hi')
  expect(s.filled[0]!.mode).toBe('replace')
  await ui.unmount()
})

test('the Run again prompt is in Hebrew in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { store: { language: 'he' } })
  await start($)
  await bash($, 'ls')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: '1 פקודות' }))?.text).toBeTruthy()
  const [btn] = await ui.findAll({ type: 'Button' })
  expect(btn!.text).toContain('הרץ שוב')
  await ui.press({ key: btn!.key! })
  expect(s.filled[0]!.text).toBe('הרץ שוב: ls')
  await ui.unmount()
})

test('newest first, whitespace collapsed, long commands cut at 60 characters', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await bash($, 'echo first')
  await bash($, 'echo   second\n  line')
  await bash($, 'echo ' + 'x'.repeat(100))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const texts = (await ui.findAll({ type: 'Button' })).map(x => x.text.replace(/^[✓✗] /, ''))
  const iLong = texts.findIndex(x => x.startsWith('echo xxx'))
  const iSecond = texts.findIndex(x => x.startsWith('echo second line'))
  const iFirst = texts.findIndex(x => x.startsWith('echo first'))
  expect(iLong).toBeGreaterThan(-1)
  expect(iSecond).toBeGreaterThan(-1)
  expect(iFirst).toBeGreaterThan(-1)
  expect(iLong).toBeLessThan(iSecond)
  expect(iSecond).toBeLessThan(iFirst)
  expect(texts[iLong]!).toMatch(/^echo x{55}\s/)
  await ui.unmount()
})

test('the pane keeps at most 50 entries and shows what fits', { timeoutMs: 20000 }, async ($, on) => {
  setup(on)
  await start($)
  for (let i = 1; i <= 52; i++) await bash($, `cmd-${i}`)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', viewport: { columns: 100, rows: 40 } })
  expect((await ui.find({ type: 'Text', text: '50 commands' }))?.text).toBeTruthy()
  // 40 rows -> floor((40-3)/2) = 18 rows, newest first
  expect((await ui.findAll({ type: 'Button' })).length).toBe(18)
  const rows = (await ui.findAll({ type: 'Button' })).map(b => b.text)
  expect(rows.some(r => /\bcmd-52\b/.test(r))).toBe(true)
  expect(rows.some(r => /\bcmd-35\b/.test(r))).toBe(true)
  expect(rows.some(r => /\bcmd-34\b/.test(r))).toBe(false)
  expect(rows.some(r => /\bcmd-1\b/.test(r))).toBe(false)
  await ui.unmount()
})

test('a command another feature denies is not logged', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const r = (await bash($, 'rm -rf /')) as any
  expect(typeof r.deny).toBe('string')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: '0 commands' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('a non-Bash tool is not logged', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.tool.call({ tool: 'Read', file_path: 'C:/x.txt' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: '0 commands' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('a subagent Bash call is logged too', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'pwd', agentId: 'a1' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: '1 commands' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('off switch: command and pane say off, nothing is logged', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { store: { enabled: { 'bash-log': false } } })
  await start($)
  expect(s.registered).toContain('bash-log')
  const r = await $.command.run({ command: 'bash-log', args: '' })
  expect((r as any).text).toBe('The "Command log" feature is off in the switchboard.')
  expect(s.opened).not.toContain('bash-log')
  const res = (await bash($, 'ls')) as any
  expect(res.result).toBeTruthy()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: 'The feature is off in the switchboard.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('off switch in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he', enabled: { 'bash-log': false } } })
  await start($)
  const r = await $.command.run({ command: 'bash-log', args: '' })
  expect((r as any).text).toBe('שכלול "יומן פקודות" כבוי בלוח המתגים.')
})
