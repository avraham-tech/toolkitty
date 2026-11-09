import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }

const BAND = {
  plugin: 'toolkitty',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const DETAIL = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'toolkitty-detail',
  props: { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

const OWN_FAILURE = /feature live-ticker failed/

function boot(on: any, store: Record<string, unknown> = {}) {
  mock.store(on, { language: 'en', ...store })
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = { commands: [] as string[], toasts: [] as string[], opened: [] as string[] }
  const plan = { hold: 0, fail: false }
  on('command.register', (_: any, e: any) => {
    seen.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('agent.list', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: [] }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', async () => {
    if (plan.hold > 0) await clock.sleep(plan.hold)
    if (plan.fail) return { isError: true, result: 'boom' }
    return { result: {} }
  })
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen, plan }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const turn = (id = 't1', extra: Record<string, unknown> = {}) => ({ text: 'hello', turnId: id, ...extra })
const done = (id = 't1', extra: Record<string, unknown> = {}) => ({
  answer: 'ok',
  durationMs: 1000,
  isAborted: false,
  turnId: id,
  reason: 'answer' as const,
  ...extra,
})

/** Mounts the band; the compact band folds lines past the second behind a toggle, so open it when this line is folded. */
async function mountBand($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  if ((await ui.find({ key: 'band-live-ticker' })) === undefined) {
    const toggle = await ui.find({ key: 'toolkitty-band-toggle' })
    if (toggle !== undefined && /more|עוד/.test(String(toggle.props['label']))) await ui.press({ key: 'toolkitty-band-toggle' })
  }
  return ui
}

async function bandText($: any, surface: 'desktop' | 'terminal' = 'desktop') {
  const ui = await mountBand($, surface)
  const line = await ui.find({ key: 'band-live-ticker' })
  const text = line?.text
  await ui.unmount()
  return text as string | undefined
}

async function pressBand($: any) {
  const band = await mountBand($)
  await band.press({ key: 'band-live-ticker' })
  await band.unmount()
}

async function allTexts(ui: any): Promise<string[]> {
  const found = await ui.findAll({ type: 'Text' })
  return found.map((f: any) => f.text as string)
}

test('loads, registers no command of its own, shows no band before a turn', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(await bandText($)).toBeUndefined()
  expect(seen.commands).not.toContain('live-ticker')
})

test('a turn shows thinking with no seconds, then clears at the end', SLOW, async ($, on) => {
  const { clock } = boot(on)
  await start($)
  await $.turn.start(turn())
  expect(await bandText($)).toBe('▶ thinking…')
  await clock.advance(10_000)
  expect(await bandText($)).toBe('▶ thinking…')
  await $.turn.complete(done())
  expect(await bandText($)).toBeUndefined()
})

test('a running tool shows its action and the seconds once past two, ticking each second', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await $.turn.start(turn())
  plan.hold = 10_000
  const call = $.tool.call({ tool: 'Read', file_path: 'C:/tmp/project/src/deep/a.ts' })
  await clock.advance(1000)
  expect(await bandText($)).toBe('▶ reading deep/a.ts')
  await clock.advance(1000)
  expect(await bandText($)).toBe('▶ reading deep/a.ts · 2s')
  await clock.advance(5000)
  expect(await bandText($)).toBe('▶ reading deep/a.ts · 7s')
  await clock.advance(5000)
  await call
  expect(await bandText($)).toBeUndefined()
  await $.turn.complete(done())
})

test('the detail pane lists finished actions newest first with durations and the current one', SLOW, async ($, on) => {
  const { clock, plan, seen } = boot(on)
  await start($)
  await $.turn.start(turn())
  plan.hold = 1500
  const c1 = $.tool.call({ tool: 'Read', file_path: 'C:/p/x.ts' })
  await clock.advance(1500)
  await c1
  plan.hold = 4000
  const c2 = $.tool.call({ tool: 'Bash', command: 'npm   test' })
  await clock.advance(4000)
  await c2
  plan.hold = 20_000
  const c3 = $.tool.call({ tool: 'Grep', pattern: 'needle' })
  // the ticker beats on whole seconds from the turn start, so 3.5 s later it has counted 3
  await clock.advance(3500)
  expect(await bandText($)).toBe("▶ searching 'needle' · 3s")

  await pressBand($)
  expect(seen.opened).toContain('toolkitty-detail')

  const ui = await $.ui.mount({ ...DETAIL, surface: 'desktop' })
  const texts = await allTexts(ui)
  expect(texts).toContain('Live ticker')
  expect(texts).toContain("Now: searching 'needle'")
  expect(texts).toContain('Last actions (newest first)')
  const rows = texts.filter(x => x.includes(' ago · '))
  expect(rows).toEqual(['0:03 ago · running: npm test · 4.0s', '0:07 ago · reading p/x.ts · 1.5s'])
  await ui.unmount()

  await clock.advance(20_000)
  await c3
  await $.turn.complete(done())
})

test('the detail pane says so when nothing has finished', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  await $.turn.start(turn())
  await pressBand($)
  expect(seen.opened).toContain('toolkitty-detail')
  const ui = await $.ui.mount({ ...DETAIL, surface: 'desktop' })
  const texts = await allTexts(ui)
  expect(texts).toContain('Now: thinking…')
  expect(texts).toContain('No action has finished yet.')
  await ui.unmount()
  await $.turn.complete(done())
})

test('every tool kind is described, and an errored result is logged as failed', SLOW, async ($, on) => {
  const { plan } = boot(on)
  await start($)
  await $.turn.start(turn())
  const calls: Record<string, unknown>[] = [
    { tool: 'Edit', file_path: 'C:/p/src/e.ts', old_string: 'a', new_string: 'b' },
    { tool: 'Write', file_path: 'C:/p/src/w.ts', content: 'x' },
    { tool: 'Glob', pattern: '**/*.ts' },
    { tool: 'PowerShell', command: 'Get-ChildItem' },
    { tool: 'WebFetch', url: 'https://example.com/a/b', prompt: 'p' },
    { tool: 'WebSearch', query: 'vitest docs' },
    { tool: 'Agent', description: 'dig around', prompt: 'p', subagent_type: 'Explore' },
    { tool: 'mcp__srv__do_thing' },
    { tool: 'NotebookEdit', notebook_path: 'C:/p/n.ipynb', new_source: 'x' },
  ]
  for (const c of calls) await $.tool.call(c as any)
  plan.fail = true
  await $.tool.call({ tool: 'Bash', command: 'false' })

  await $.turn.start(turn('t1b'))
  await pressBand($)
  const ui = await $.ui.mount({ ...DETAIL, surface: 'desktop' })
  const rows = (await allTexts(ui)).filter(x => x.includes(' ago · ')).map(x => x.replace(/^[0-9:]+ ago · /, ''))
  expect(rows).toEqual([
    'running: false · 0.0s · failed',
    'editing p/n.ipynb · 0.0s',
    'using do_thing · 0.0s',
    'agent: dig around · 0.0s',
    "searching the web 'vitest docs' · 0.0s",
    'fetching example.com · 0.0s',
    'running: Get-ChildItem · 0.0s',
    'finding **/*.ts · 0.0s',
    'writing src/w.ts · 0.0s',
    'editing src/e.ts · 0.0s',
  ])
  await ui.unmount()
})

test('subagent tool calls and turns leave the ticker alone', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await $.turn.start(turn())
  plan.hold = 5000
  const sub = $.tool.call({ tool: 'Bash', command: 'sub work', agentId: 'a1' })
  await clock.advance(3000)
  expect(await bandText($)).toBe('▶ thinking…')
  await clock.advance(2000)
  await sub
  await $.turn.start({ text: 's', turnId: 'sub1', agentId: 'a1' })
  await $.turn.complete(done('sub1', { agentId: 'a1' }))
  expect(await bandText($)).toBe('▶ thinking…')
  await $.turn.complete(done())
})

test('the ticker timer stops when the turn completes', SLOW, async ($, on) => {
  const { clock } = boot(on)
  await start($)
  await $.turn.start(turn())
  await clock.advance(3000)
  await $.turn.complete(done())
  await clock.advance(60_000)
  expect(await bandText($)).toBeUndefined()
})

test('a new turn restarts the ticker and the old one is not doubled', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await $.turn.start(turn())
  await clock.advance(4000)
  await $.turn.start(turn('t2'))
  plan.hold = 10_000
  const call = $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  await clock.advance(3000)
  expect(await bandText($)).toBe('▶ reading p/a.ts · 3s')
  await clock.advance(7000)
  await call
  await $.turn.complete(done('t2'))
})

test('the band is hidden while a survey holds it, and draws on the terminal', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  const ui = await mountBand($, 'desktop', { hasSurvey: true })
  expect(await ui.find({ key: 'band-live-ticker' })).toBeUndefined()
  await ui.unmount()
  expect(await bandText($, 'terminal')).toBe('▶ thinking…')
  await $.turn.complete(done())
})

test('a tool call is never denied by the ticker', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  const r = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(r.deny).toBeUndefined()
  await $.turn.complete(done())
})

test('off switch: no band, tool calls pass', SLOW, async ($, on) => {
  const { clock, plan } = boot(on, { enabled: { 'live-ticker': false } })
  await start($)
  await $.turn.start(turn())
  plan.hold = 3000
  const call = $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(3000)
  const r = await call
  expect(r.deny).toBeUndefined()
  expect(await bandText($)).toBeUndefined()
  await $.turn.complete(done())
})

test('Hebrew: the action text and the detail pane are in Hebrew', SLOW, async ($, on) => {
  const { clock, plan, seen } = boot(on, { language: 'he' })
  await start($)
  await $.turn.start(turn())
  expect(await bandText($)).toBe('▶ חושב…')
  plan.hold = 1000
  const c = $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  await clock.advance(1000)
  await c
  plan.hold = 3000
  const c2 = $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(500)
  await pressBand($)
  expect(seen.opened).toContain('toolkitty-detail')
  const ui = await $.ui.mount({ ...DETAIL, surface: 'desktop' })
  const texts = await allTexts(ui)
  expect(texts).toContain('הפעולות האחרונות (החדשות ראשונות)')
  expect(texts.some(x => x.startsWith('עכשיו: מריץ: ls'))).toBe(true)
  expect(texts.some(x => x.startsWith('לפני ') && x.includes('קורא p/a.ts'))).toBe(true)
  await ui.unmount()
  await clock.advance(3000)
  await c2
  await $.turn.complete(done())
})
