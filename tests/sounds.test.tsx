import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }
const ON = { enabled: { sounds: true } }
const OWN_FAILURE = /feature sounds failed/

function boot(on: any, store: Record<string, unknown> = {}) {
  mock.store(on, { language: 'en', ...store })
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = { commands: [] as string[], toasts: [] as string[], played: [] as string[] }
  const plan = { failAt: -1 as number }
  on('command.register', (_: any, e: any) => {
    seen.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('audio.play', (_: any, e: any) => {
    const asset = String(e.clip.asset)
    if (plan.failAt === seen.played.length) {
      plan.failAt = -2
      throw new Error('no audio player')
    }
    seen.played.push(asset)
    return { value: undefined }
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
  /** The chime of a finished long turn. */
  const chimes = () => seen.played.filter(a => a === 'sounds/done.wav')
  return { clock, seen, plan, chimes }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const finish = ($: any, durationMs: number, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs, isAborted: false, turnId: 't1', reason: 'answer', ...extra })
const sounds = ($: any, args: string) => $.command.run({ command: 'sounds', args })

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

test('loads and registers /sounds', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(seen.commands).toContain('sounds')
})

test('it is off by default: the command says so and a long turn is silent', SLOW, async ($, on) => {
  const { seen, chimes } = boot(on)
  await start($)
  expect((await sounds($, 'test')).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect((await sounds($, '')).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  await finish($, 120_000)
  expect(chimes()).toHaveLength(0)
  expect(seen.played).toHaveLength(0)
})

test('/sounds with no argument or another word shows the usage', SLOW, async ($, on) => {
  const { seen } = boot(on, ON)
  await start($)
  for (const args of ['', '   ', 'play', 'tests', 'test now']) {
    expect((await sounds($, args)).text).toBe('Usage: /sounds test')
  }
  expect(seen.played).toHaveLength(0)
})

test('/sounds test plays the four sounds in order, naming each in a notice', SLOW, async ($, on) => {
  const { seen } = boot(on, ON)
  await start($)
  const r = await sounds($, 'test')
  expect(r.text).toBe('Played all four sounds.')
  expect(seen.played).toEqual(['sounds/done.wav', 'sounds/shield.wav', 'sounds/limit.wav', 'sounds/buddy.wav'])
  // each "Playing: ..." notice is immediate feedback, never dropped by the info cooldown: all four are named
  expect((await noticeTexts($)).filter(x => x.startsWith('Playing: ')).sort()).toEqual(
    ['Playing: Turn finished', 'Playing: Shield stopped something', 'Playing: Limit reached', 'Playing: Buddy chirp'].sort(),
  )
})

test('the argument is case- and space-insensitive', SLOW, async ($, on) => {
  const { seen } = boot(on, ON)
  await start($)
  expect((await sounds($, '  TeSt ')).text).toBe('Played all four sounds.')
  expect(seen.played).toHaveLength(4)
})

test('when playing fails the test stops there and says no player is available', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, ON)
  await start($)
  plan.failAt = 1
  const r = await sounds($, 'test')
  expect(r.text).toBe('Could not play the sounds on this machine (no audio player available).')
  expect(seen.played).toEqual(['sounds/done.wav'])
})

test('a turn longer than 30 seconds plays the done chime; 30 seconds or less does not', SLOW, async ($, on) => {
  const { chimes } = boot(on, ON)
  await start($)
  await finish($, 30_000)
  await finish($, 1000)
  expect(chimes()).toHaveLength(0)
  await finish($, 30_001)
  expect(chimes()).toHaveLength(1)
  await finish($, 600_000)
  expect(chimes()).toHaveLength(2)
})

test('subagent turns never chime', SLOW, async ($, on) => {
  const { chimes } = boot(on, ON)
  await start($)
  await finish($, 600_000, { agentId: 'ag1' })
  expect(chimes()).toHaveLength(0)
})

test('a failing player on the chime is swallowed and never breaks the turn', SLOW, async ($, on) => {
  const { plan, seen } = boot(on, ON)
  await start($)
  plan.failAt = 0
  await finish($, 120_000)
  expect((await noticeTexts($)).filter(x => /sounds/.test(x))).toEqual([])
})

test('switching it off again silences the chime and the test', SLOW, async ($, on) => {
  const { chimes } = boot(on, { enabled: { sounds: false } })
  await start($)
  await finish($, 120_000)
  expect(chimes()).toHaveLength(0)
  expect((await sounds($, 'test')).text).toBe('The feature is off; turn it on in the /toolkitty pane')
})

test('Hebrew: command texts and the sound names are in Hebrew', SLOW, async ($, on) => {
  const { seen } = boot(on, { ...ON, language: 'he' })
  await start($)
  expect((await sounds($, '')).text).toBe('שימוש: /sounds test')
  expect((await sounds($, 'test')).text).toBe('ארבעת הצלילים הושמעו.')
  // immediate notices: all four sounds are named
  expect((await noticeTexts($)).filter(x => x.startsWith('מנגן: ')).sort()).toEqual(
    ['מנגן: התור הסתיים', 'מנגן: המגן עצר משהו', 'מנגן: הגעת למגבלה', 'מנגן: ציוץ החבר'].sort(),
  )
})
