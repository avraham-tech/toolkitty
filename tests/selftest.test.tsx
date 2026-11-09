import { expect, mock, test } from 'claude-code/testing'

/*
 * The live self-test. The engine side (everything the plugin calls on `$`) is answered below; each test changes what the
 * "engine" answers (refusals, throws, hangs) and checks the report rows, counts, copy text, buttons, chip, language, off switch.
 */

const CWD = 'C:/proj'
/** Rows in a full run: surfaces, 34 panes, backdrop, place, notify, toast, audio, prompt, copy, store, clock, 3 processes, model, features, commands. */
const PANE_COUNT = 42 // the 34 earlier panes + achievements, share-cards, efficiency, safety-receipt, demo, toolkitty-perf
const ROWS = 1 + PANE_COUNT + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 3 + 1 + 1 + 1

type Slot = { value: unknown; version: number }

type W = {
  cmds: string[]
  opened: { id: string; title?: string; focus?: boolean }[]
  closed: string[]
  toasts: string[]
  copies: string[]
  played: string[]
  places: string[]
  backdrops: unknown[]
  notifies: { text: string; title?: string }[]
  procs: string[][]
  models: { model: string; prompt: string }[]
  surfaces: string[]
  openNow: Map<string, boolean>
  /** pane id -> reason it is not drawn */
  unplaced: Record<string, string>
  hangOpen: boolean
  placeThrow: string | undefined
  placeRes: Record<string, unknown>
  backdropRes: Record<string, unknown>
  copyRes: Record<string, unknown>
  notifyRes: Record<string, unknown>
  audioFail: string | undefined
  proc: (argv: string[]) => { exitCode: number; stdout: string; stderr: string } | 'throw-enoent'
  modelRes: Record<string, unknown>
  slots: Map<string, Slot>
  clock: ReturnType<typeof mock.clock>
}

const NOTICES = 'toolkitty/slot/notices'

function rig(on: any, o: { store?: Record<string, unknown>; surfaces?: string[] } = {}): W {
  mock.store(on, { language: 'en', 'onboarding:done': true, ...(o.store ?? {}) })
  const clock = mock.clock(on, { now: 1_700_000_000_000 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', HOME: 'C:/Users/test' })
  mock.session(on)
  const w: W = {
    cmds: [],
    opened: [],
    closed: [],
    toasts: [],
    copies: [],
    played: [],
    places: [],
    backdrops: [],
    notifies: [],
    procs: [],
    models: [],
    surfaces: o.surfaces ?? ['desktop'],
    openNow: new Map(),
    unplaced: {},
    hangOpen: false,
    placeThrow: undefined,
    placeRes: { isPlaced: true, requestId: 'selftest-row' },
    backdropRes: { isDrawn: true, requestId: 'backdrop' },
    copyRes: { isCopied: true },
    notifyRes: { isSent: true, channel: 'kitty' },
    audioFail: undefined,
    proc: argv => ({ exitCode: 0, stdout: `${argv[0]} version 1.2.3\nmore`, stderr: '' }),
    modelRes: { isAnswered: true, text: 'ok', usage: {} },
    slots: new Map(),
    clock,
  }
  on('state.get', (_: any, e: any) => {
    const s = w.slots.get(`${e.plugin}/${e.key}/${e.id ?? ''}`)
    return { value: { value: s?.value, version: s?.version ?? 0 } }
  })
  on('state.set', (_: any, e: any) => {
    const key = `${e.plugin}/${e.key}/${e.id ?? ''}`
    const prev = w.slots.get(key)
    const version = prev?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false, version } }
    w.slots.set(key, { value: e.value, version: version + 1 })
    return { value: { isSet: true, version: version + 1 } }
  })
  on('command.register', (_: any, e: any) => {
    w.cmds.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    if (w.hangOpen && e.id !== 'selftest') return new Promise(() => undefined) as never
    w.opened.push({ id: e.id, title: e.title, focus: e.focus })
    const why = w.unplaced[e.id]
    w.openNow.set(e.id, why === undefined)
    return { value: why === undefined ? { isPlaced: true } : { isPlaced: false, reason: why } }
  })
  on('ui.close', (_: any, e: any) => {
    w.closed.push(e.id)
    w.openNow.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: [...w.openNow.entries()].map(([id, isPlaced]) => ({ id, title: id, isShown: false, isFocused: false, isPlaced })),
  }))
  on('ui.toast', (_: any, e: any) => {
    w.toasts.push(String(e.text))
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.copy', (_: any, e: any) => {
    w.copies.push(String(e.text))
    return { value: w.copyRes } as never
  })
  on('ui.notify', (_: any, e: any) => {
    w.notifies.push({ text: e.text, title: e.title })
    return { value: w.notifyRes } as never
  })
  on('ui.place', (_: any, e: any) => {
    w.places.push(e.id)
    if (w.placeThrow !== undefined) return { deny: w.placeThrow } as never
    return { value: w.placeRes } as never
  })
  on('ui.backdrop', (_: any, e: any) => {
    w.backdrops.push(e.backdrop)
    return { value: w.backdropRes } as never
  })
  on('audio.play', (_: any, e: any) => {
    w.played.push(JSON.stringify(e))
    if (w.audioFail !== undefined) return { deny: w.audioFail } as never
    return { value: undefined }
  })
  on('process.run', (_: any, e: any) => {
    const argv = [...e.argv] as string[]
    w.procs.push(argv)
    const out = w.proc(argv)
    if (out === 'throw-enoent') return { deny: `spawn ${argv[0]} ENOENT` } as never
    return { value: { ...out, isStdoutTruncated: false, isStderrTruncated: false } } as never
  })
  on('model.complete', (_: any, e: any) => {
    w.models.push({ model: e.model, prompt: e.prompt })
    return { value: w.modelRes } as never
  })
  on('session.surfaces', () => ({ value: w.surfaces }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.id', () => ({ value: 'test-session' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 10 }, rateLimits: [] } }) as never)
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.measure', () => ({ changed: [] }) as never)
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }) as never)
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }) as never)
  on('prompt.compose', () => ({ sections: [] }) as never)
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }) as never)
  on('tool.call', () => ({ result: {} }) as never)
  on('fs.exists', () => ({ value: false }) as never)
  on('fs.read', (_: any, e: any) => ({ deny: 'ENOENT ' + e.path }) as never)
  on('fs.stat', (_: any, e: any) => ({ deny: 'ENOENT ' + e.path }) as never)
  on('fs.list', () => ({ value: [] }) as never)
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return w
}

const start = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.session.start({ cwd: CWD, surface, isInteractive: true })

/** Awaits `p` while moving the mocked clock on, so the self-test's timers (and caps) can fire. */
async function drive<V>(w: W, p: Promise<V>, stepMs = 100): Promise<V> {
  let done = false
  const tracked = p.then(
    v => {
      done = true
      return v
    },
    err => {
      done = true
      throw err
    },
  )
  tracked.catch(() => undefined)
  for (let i = 0; i < 4000 && !done; i += 1) await w.clock.advance(stepMs)
  return tracked
}

/** Presses a header button and lets the run it starts finish (the clock moves on), then redraws. */
async function pressAndWait(w: W, ui: any, key: string): Promise<void> {
  await drive(w, ui.press({ key }))
  for (let i = 0; i < 10; i += 1) await w.clock.advance(100)
  await ui.redraw()
}

const run = ($: any, w: W, args = '', stepMs = 100): Promise<{ text?: string }> => drive(w, $.command.run({ command: 'selftest', args }), stepMs)

const PANE_PROPS = { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} }
const mountPane = ($: any, id = 'selftest', surface = 'desktop') =>
  $.ui.mount({ plugin: 'toolkitty', surface, component: 'Pane', requestId: id, props: PANE_PROPS })
const mountBand = ($: any) =>
  $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 19 }, view: {} },
  })

async function texts(ui: any): Promise<string> {
  const all = await ui.findAll({ type: 'Text' })
  return all.map((x: { text: string }) => x.text).join('\n')
}

/** One report row as drawn: mark, name, detail on consecutive Text lines. */
const row = (markChar: string, name: string, detail: string): string => `${markChar}\n${name}\n${detail}`

/** The header status of the pane, e.g. "47 ok · 0 failed · 3 skipped". */
const COUNTS = /(\d+) ok · (\d+) failed · (\d+) skipped/
async function counts($: any): Promise<[number, number, number]> {
  const ui = await mountPane($)
  const m = COUNTS.exec(await texts(ui))
  await ui.unmount()
  if (m === null) throw new Error('no counts in the pane')
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

test('load: /selftest registers, the pane starts empty and no chip shows', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  await start($)
  expect(w.cmds).toContain('selftest')
  const ui = await mountPane($)
  const all = await texts(ui)
  expect(all).toContain('Self-test')
  expect(all).toContain('No report yet.')
  expect(all).toContain('Run /selftest to try every capability live')
  // the three actions are plain header buttons
  expect((await ui.find({ key: 'run' })).props.label).toBe('Run again')
  expect((await ui.find({ key: 'copy' })).props.label).toBe('Copy report')
  expect((await ui.find({ key: 'model' })).props.label).toBe('Run with model')
  await ui.unmount()
  const band = await mountBand($)
  expect(await band.find({ key: 'chip-selftest' })).toBeUndefined()
  await band.unmount()
})

test('a full run where everything works: every row, the counts, the opened and closed panes', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  await start($)
  // Toolkitty's own session start leaves some panes open (the switchboard, the report): those are left alone
  const pre = [...w.openNow.keys()]
  expect(pre).toContain('toolkitty')
  const r = await run($, w)
  expect(r.text).toBe(`Self-test: ${ROWS - 3} ok · 0 failed · 3 skipped.`)

  // panes: all but the open ones were opened with the title, then closed again
  const opened = w.opened.filter(o => o.title === 'Toolkitty self-test' && o.focus !== true).map(o => o.id)
  expect(opened.length).toBe(PANE_COUNT - 1 - (pre.length - (pre.includes('selftest') ? 1 : 0)))
  for (const id of pre) expect(opened).not.toContain(id)
  expect(opened).toContain('toolkitty-notices')
  expect(opened).toContain('wrapped')
  expect(opened).toContain('advisor')
  expect([...w.closed].sort()).toEqual([...opened].sort())
  expect(opened).not.toContain('selftest')
  // the report pane itself was opened with focus and left open
  expect(w.opened.filter(o => o.id === 'selftest').every(o => o.focus === true)).toBe(true)
  expect(w.openNow.has('selftest')).toBe(true)

  const ui = await mountPane($)
  const all = await texts(ui)
  expect(all).toContain(`${ROWS - 3} ok · 0 failed · 3 skipped`)
  expect(all).toContain(row('✓', 'Surfaces', 'desktop'))
  expect(all).toContain(row('✓', 'Pane toolkitty', 'already open and drawn; left alone'))
  expect(all).toContain(row('✓', 'Pane toolkitty-detail', 'drawn'))
  expect(all).toContain(row('✓', 'Pane wrapped', 'drawn'))
  expect(all).toContain(row('✓', 'Pane selftest', 'already open and drawn; left alone'))
  expect(all).toContain(row('✓', 'Backdrop', 'drawn'))
  expect(all).toContain(row('✓', 'Placed row', 'placed (the row itself draws nothing)'))
  expect(all).toContain(row('✓', 'Notification', 'sent via kitty'))
  expect(all).toContain(row('✓', 'Toast', 'shown (look at the corner of the window)'))
  expect(all).toContain(row('✓', 'Sound', 'call resolved (a machine without a player stays silent)'))
  expect(all).toContain(row('–', 'Prompt box', 'not exercised (would change your prompt box)'))
  expect(all).toContain(row('✓', 'Clipboard', 'copied a short test text to the clipboard'))
  expect(all).toContain(row('✓', 'Store', 'wrote and read back 1700000000000'))
  expect(all).toMatch(/✓\nClock\nnow 2023-11-14T22:13:20\.\d+Z; a 10 ms timer fired/)
  expect(all).toContain(row('✓', 'Process: git --version', 'git version 1.2.3'))
  expect(all).toContain(row('✓', 'Process: node --version', 'node version 1.2.3'))
  expect(all).toContain(row('✓', 'Process: gh --version', 'gh version 1.2.3'))
  expect(all).toContain(row('–', 'Model', 'skipped: costs money; run /selftest model'))
  expect(all).toMatch(/✓\nFeature health\n\d+ of \d+ features on; no failure notice this session/)
  expect(all).toContain(row('–', 'Commands', 'not listable from a plugin; see /toolkitty'))
  expect(all).toContain('Engine calls')
  expect(all).toContain('Panes')
  await ui.unmount()

  // what the engine was asked
  expect(w.places).toEqual(['selftest-row'])
  expect(w.notifies).toEqual([{ text: 'Toolkitty self-test', title: 'Toolkitty' }])
  expect(w.copies).toEqual(['toolkitty selftest'])
  expect(w.played.length).toBe(1)
  expect(w.played[0]).toContain('sounds/done.wav')
  expect(w.backdrops).toEqual([{ id: 'selftest' }, undefined])
  // (other features run git at session start; the self-test's three probes come last)
  expect(w.procs.filter(a => a[1] === '--version')).toEqual([['git', '--version'], ['node', '--version'], ['gh', '--version']])
  expect(w.procs.slice(-3)).toEqual([['git', '--version'], ['node', '--version'], ['gh', '--version']])
  expect(w.toasts).toContain('Toolkitty self-test')
  expect(w.models.length).toBe(0)
})

test('panes already open are not touched; their state comes from the pane list', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  w.openNow.set('notes', true)
  w.openNow.set('buddy', false)
  await start($)
  await run($, w)
  expect(w.opened.map(o => o.id)).not.toContain('notes')
  expect(w.opened.map(o => o.id)).not.toContain('buddy')
  expect(w.closed).not.toContain('notes')
  expect(w.closed).not.toContain('buddy')
  const ui = await mountPane($)
  const all = await texts(ui)
  expect(all).toContain(row('✓', 'Pane notes', 'already open and drawn; left alone'))
  expect(all).toContain(row('✗', 'Pane buddy', 'open but not drawn'))
  await ui.unmount()
})

test('refusals show the engine reasons verbatim and are counted; throws and missing programs do not crash the run', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  w.unplaced['buddy'] = 'x'
  w.unplaced['heatmap'] = 'floor 144 columns, now 90'
  w.backdropRes = { isDrawn: false, reason: 'no-surface' }
  w.placeRes = { isPlaced: false, reason: 'y' }
  w.copyRes = { isCopied: false, reason: 'no-clipboard' }
  w.notifyRes = { isSent: false, reason: 'no-surface' }
  w.audioFail = 'no player installed'
  w.proc = argv => {
    if (argv[0] === 'node') return 'throw-enoent'
    if (argv[0] === 'gh') return { exitCode: 1, stdout: '', stderr: 'boom\nsecond line' }
    return { exitCode: 0, stdout: 'git version 2.45.0', stderr: '' }
  }
  await start($)
  const r = await run($, w)
  // failed: 2 panes, backdrop, place, copy, audio, gh = 7; skipped: prompt, model, commands, notify, node = 5
  expect(r.text).toBe(`Self-test: ${ROWS - 12} ok · 7 failed · 5 skipped. Failed: Pane buddy, Pane heatmap, Backdrop, Placed row, Sound, ….`)
  expect(await counts($)).toEqual([ROWS - 12, 7, 5])

  const ui = await mountPane($)
  const all = await texts(ui)
  expect(all).toContain(row('✗', 'Pane buddy', 'x'))
  expect(all).toContain(row('✗', 'Pane heatmap', 'floor 144 columns, now 90'))
  expect(all).toContain(row('✗', 'Backdrop', 'no-surface'))
  expect(all).toContain(row('✗', 'Placed row', 'y'))
  expect(all).toContain(row('✗', 'Clipboard', 'no-clipboard'))
  expect(all).toContain(row('–', 'Notification', 'no-surface'))
  expect(all).toContain('✗\nSound\n')
  expect(all).toContain('no player installed')
  // the engine words the failed spawn itself: its text stays as given inside the "not installed" detail
  expect(all).toMatch(/–\nProcess: node --version\nnot installed \(.*spawn node ENOENT\)/)
  expect(all).toContain(row('✗', 'Process: gh --version', 'exit 1: boom'))
  expect(all).toContain(row('✓', 'Process: git --version', 'git version 2.45.0'))
  await ui.unmount()
  // the unplaced panes were still closed, and the backdrop cleared
  expect(w.closed).toContain('buddy')
  expect(w.backdrops[w.backdrops.length - 1]).toBeUndefined()
})

test('a check that throws is a failed row with the message, never a crash', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  w.placeThrow = 'place exploded'
  await start($)
  const r = await run($, w)
  expect(r.text).toContain('1 failed')
  expect(r.text).toContain('Failed: Placed row.')
  const ui = await mountPane($)
  const all = await texts(ui)
  expect(all).toContain('✗\nPlaced row\n')
  expect(all).toContain('place exploded')
  // the rows after it still ran
  expect(all).toContain(row('✓', 'Clipboard', 'copied a short test text to the clipboard'))
  expect(all).toContain(row('–', 'Commands', 'not listable from a plugin; see /toolkitty'))
  await ui.unmount()
})

test('/selftest copy: nothing yet, then the report text; a refused copy says why', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  w.unplaced['buddy'] = 'x'
  await start($)
  expect((await $.command.run({ command: 'selftest', args: 'copy' })).text).toBe('No report yet; run /selftest first.')
  expect(w.copies.length).toBe(0)
  await run($, w)
  w.copies.length = 0
  expect((await $.command.run({ command: 'selftest', args: 'copy' })).text).toBe('Self-test report copied.')
  expect(w.copies.length).toBe(1)
  const text = w.copies[0] as string
  expect(text.split('\n')[0]).toBe(`Toolkitty self-test: ${ROWS - 4} ok · 1 failed · 3 skipped`)
  expect(text).toContain('✓ Surfaces — desktop')
  expect(text).toContain('✗ Pane buddy — x')
  expect(text).toContain('– Model — skipped: costs money; run /selftest model')
  expect(text.split('\n').length).toBe(ROWS + 1)

  w.copyRes = { isCopied: false, reason: 'no-clipboard' }
  expect((await $.command.run({ command: 'selftest', args: 'copy' })).text).toBe('Could not copy the report: no-clipboard')
})

test('the Copy report button copies the same text', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  await start($)
  await run($, w)
  w.copies.length = 0
  const ui = await mountPane($)
  await ui.press({ key: 'copy' })
  expect(w.copies.length).toBe(1)
  expect(w.copies[0]).toContain('✓ Surfaces — desktop')
  await ui.unmount()
})

test('Run again re-runs every check and replaces the report', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  w.copyRes = { isCopied: false, reason: 'no-clipboard' }
  await start($)
  await run($, w)
  expect(await counts($)).toEqual([ROWS - 4, 1, 3])
  const callsBefore = w.copies.length

  w.copyRes = { isCopied: true }
  const ui = await mountPane($)
  await pressAndWait(w, ui, 'run')
  expect(w.copies.length).toBe(callsBefore + 1)
  const all = await texts(ui)
  expect(all).toContain(`${ROWS - 3} ok · 0 failed · 3 skipped`)
  expect(all).toContain(row('✓', 'Clipboard', 'copied a short test text to the clipboard'))
  await ui.unmount()
})

test('the model is opt-in: a plain run never calls it; /selftest model and the button do, once each', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  await start($)
  await run($, w)
  expect(w.models.length).toBe(0)

  const r = await run($, w, 'model')
  expect(w.models.length).toBe(1)
  expect(w.models[0]?.model).toBe('claude-haiku-5-5')
  expect(r.text).toBe(`Self-test: ${ROWS - 2} ok · 0 failed · 2 skipped.`)
  let ui = await mountPane($)
  expect(await texts(ui)).toContain(row('✓', 'Model', 'answered: ok'))
  await ui.unmount()

  // not answered: the engine's reason
  w.modelRes = { isAnswered: false, reason: 'api-error', status: 529, usage: {} }
  ui = await mountPane($)
  await pressAndWait(w, ui, 'model')
  expect(w.models.length).toBe(2)
  expect(await texts(ui)).toContain(row('✗', 'Model', 'not answered: api-error'))
  await ui.unmount()

  // Run again without the model goes back to skipping it
  ui = await mountPane($)
  await pressAndWait(w, ui, 'run')
  expect(w.models.length).toBe(2)
  expect(await texts(ui)).toContain(row('–', 'Model', 'skipped: costs money; run /selftest model'))
  await ui.unmount()
})

test('the chip shows only after a run with failures, as "selftest ✗ N"', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  w.unplaced['buddy'] = 'x'
  w.unplaced['heatmap'] = 'y'
  await start($)
  await run($, w)
  let band = await mountBand($)
  const chip = await band.find({ key: 'chip-selftest' })
  expect(chip).toBeDefined()
  expect(chip.text).toContain('selftest ✗ 2')
  await band.unmount()

  w.unplaced = {}
  await run($, w)
  band = await mountBand($)
  expect(await band.find({ key: 'chip-selftest' })).toBeUndefined()
  await band.unmount()
})

test('with aurora on, the backdrop check re-issues the aurora backdrop and reports drawn, without clearing it', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on, { store: { enabled: { 'aurora-backdrop': true } } })
  await start($)
  const before = w.backdrops.length
  await run($, w)
  const ui = await mountPane($)
  expect(await texts(ui)).toContain(row('✓', 'Backdrop', 'drawn'))
  await ui.unmount()
  // what the self-test itself asked of the surface: aurora's id with a glass, never its own `selftest` backdrop, and no clearing
  const mine = w.backdrops.slice(before)
  expect(mine).toEqual([{ id: 'aurora', glass: { blur: 18, opacity: 0.5 } }])
  expect(w.backdrops.some(b => (b as { id?: string } | undefined)?.id === 'selftest')).toBe(false)
})

test('with aurora on, a backdrop the surface refuses is a failed row carrying the surface reason', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on, { store: { enabled: { 'aurora-backdrop': true } } })
  w.backdropRes = { isDrawn: false, reason: 'no-surface' }
  await start($)
  await run($, w)
  const ui = await mountPane($)
  expect(await texts(ui)).toContain(row('✗', 'Backdrop', 'no-surface'))
  await ui.unmount()
})

test('on a terminal the backdrop is skipped as desktop only, and the pane draws the same on both surfaces', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on, { surfaces: ['terminal'] })
  await start($, 'terminal')
  await run($, w)
  const ui = await mountPane($, 'selftest', 'terminal')
  const all = await texts(ui)
  expect(all).toContain(row('✓', 'Surfaces', 'terminal'))
  expect(all).toContain(row('–', 'Backdrop', 'desktop only; no desktop surface attached'))
  expect((await ui.find({ key: 'run' })).props.label).toBe('Run again')
  await ui.unmount()
  expect(w.backdrops.length).toBe(0)
})

test('feature health: a failure notice names the feature; the count of features on follows the switchboard', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on, { store: { enabled: { notes: false } } })
  w.slots.set(NOTICES, {
    version: 1,
    value: {
      unread: 1,
      items: [
        { at: Date.now() + 600001, level: 'alert', text: 'Toolkitty: feature goal-tracker failed: boom', feature: 'goal-tracker', count: 1 },
        { at: Date.now() + 600002, level: 'info', text: 'Toolkitty: la fonction savings a échoué : bang', feature: 'savings', count: 1 },
        { at: Date.now() + 600003, level: 'info', text: 'notes saved failed to cheer', feature: 'notes', count: 1 },
      ],
    },
  })
  await start($)
  await run($, w)
  const ui = await mountPane($)
  const all = await texts(ui)
  expect(all).toMatch(/✗\nFeature health\n\d+ of \d+ features on; failed this session: goal-tracker, savings/)
  expect(all).not.toContain('failed this session: goal-tracker, savings, notes')
  await ui.unmount()
})

test('hung pane opens are capped at 1.5 s, and the time budget skips the rest so the run stays short', { timeoutMs: 60_000 }, async ($, on) => {
  const w = rig(on)
  w.hangOpen = true
  await start($)
  const t0 = w.clock.now()
  const r = await run($, w, '', 500)
  const elapsed = w.clock.now() - t0
  expect(elapsed).toBeLessThan(15_000)
  expect(r.text).toMatch(/Self-test: \d+ ok · \d+ failed · \d+ skipped\./)
  const ui = await mountPane($)
  const all = await texts(ui)
  expect(all).toContain(row('✗', 'Pane toolkitty-detail', 'no answer within 1.5 s'))
  expect(all).toContain('time budget of 9 s used up')
  // the other checks after the panes also ran or were skipped, never missing
  expect(all).toContain('Commands')
  await ui.unmount()
})

test('unknown arguments get the usage line and run nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on)
  await start($)
  const openedBefore = w.opened.length
  const procsBefore = w.procs.length
  const r = await $.command.run({ command: 'selftest', args: 'bogus' })
  expect(r.text).toBe('Usage: /selftest runs the checks, /selftest model adds one paid model call, /selftest copy copies the last report.')
  expect(w.opened.length).toBe(openedBefore)
  expect(w.procs.length).toBe(procsBefore)
})

test('Hebrew: command text, pane title, counts, names, buttons', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on, { store: { language: 'he' } })
  w.unplaced['buddy'] = 'x'
  await start($)
  const r = await run($, w)
  expect(r.text).toContain('בדיקה עצמית:')
  expect(r.text).toContain('תקינים')
  expect(r.text).toContain('נכשלו')
  expect(r.text).toContain('דולגו')
  expect(r.text).toContain('Pane buddy'.replace('Pane', 'לוח'))
  const ui = await mountPane($)
  const all = await texts(ui)
  expect(all).toContain('בדיקה עצמית')
  expect(all).toMatch(/\d+ תקינים · 1 נכשלו · 3 דולגו/)
  expect(all).toContain(row('✗', 'לוח buddy', 'x')) // the engine's reason stays as given
  expect(all).toContain('משטחים')
  expect(all).toContain('לוחות')
  expect((await ui.find({ key: 'run' })).props.label).toBe('הרץ שוב')
  expect((await ui.find({ key: 'copy' })).props.label).toBe('העתק דוח')
  expect((await ui.find({ key: 'model' })).props.label).toBe('הרץ עם מודל')
  await ui.unmount()
  expect((await $.command.run({ command: 'selftest', args: 'bogus' })).text).toContain('שימוש:')
  expect((await $.command.run({ command: 'selftest', args: 'copy' })).text).toBe('דוח הבדיקה העצמית הועתק.')
})

test('off switch: the command answers the off text, nothing is opened or called, the pane and chip stay quiet', { timeoutMs: 30_000 }, async ($, on) => {
  const w = rig(on, { store: { enabled: { selftest: false } } })
  w.unplaced['buddy'] = 'x'
  await start($)
  expect(w.cmds).toContain('selftest')
  const openedBefore = w.opened.length
  const procsBefore = w.procs.length
  for (const args of ['', 'model', 'copy', 'bogus']) {
    expect((await $.command.run({ command: 'selftest', args })).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  }
  expect(w.opened.length).toBe(openedBefore)
  expect(w.procs.length).toBe(procsBefore)
  expect(w.models.length).toBe(0)
  const ui = await mountPane($)
  expect(await texts(ui)).toContain('The feature is off; turn it on in the /toolkitty pane')
  expect(await ui.find({ key: 'run' })).toBeUndefined()
  await ui.unmount()
  const band = await mountBand($)
  expect(await band.find({ key: 'chip-selftest' })).toBeUndefined()
  await band.unmount()
})
