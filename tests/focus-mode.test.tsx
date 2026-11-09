import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:/tmp/project'

function boot(on: On, store: Record<string, unknown> = {}) {
  mock.store(on, store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  // what the engine itself draws for a tool result
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine result</Text>
  })
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n')

const RESULT = (output: unknown, props: Record<string, unknown> = {}, surface: 'desktop' | 'terminal' = 'desktop') =>
  ({
    plugin: 'toolkitty',
    component: 'ToolResult',
    requestId: 'tu1',
    surface,
    props: { tool_use_id: 'tu1', tool: 'Bash', output, isErrored: false, ...props },
  }) as const

async function draw($: any, output: unknown, props: Record<string, unknown> = {}, surface: 'desktop' | 'terminal' = 'desktop', store?: undefined) {
  void store
  const ui = await $.ui.mount(RESULT(output, props, surface))
  const more = await ui.find({ type: 'Text', text: /^... / })
  const engine = await ui.find({ type: 'Text', text: /engine result/ })
  const boxes = await ui.findAll({ type: 'Box' })
  await ui.unmount()
  return { more: more?.text as string | undefined, engine: engine?.text as string | undefined, boxes }
}

const ON = { enabled: { 'focus-mode': true } }

test('is off by default: a long result is left to the engine', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  const r = await draw($, { stdout: lines(100) })
  expect(r.engine).toBe('engine result')
  expect(r.more).toBeUndefined()
})

test('on: a long Bash result is capped at 10 lines and says how many more', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, ON)
  await start($)
  const r = await draw($, { stdout: lines(100) })
  expect(r.engine).toBe('engine result')
  expect(r.more).toBe('... 90 more lines')
  const capped = r.boxes.find(b => b.props['height'] === 10)
  expect(capped).toBeDefined()
  expect(capped?.props['overflow']).toBe('hidden')
})

test('the same on the terminal', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, ON)
  await start($)
  const r = await draw($, { stdout: lines(31) }, {}, 'terminal')
  expect(r.more).toBe('... 21 more lines')
})

test('exactly 30 lines is left alone, 31 is cut', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, ON)
  await start($)
  expect((await draw($, { stdout: lines(30) })).more).toBeUndefined()
  expect((await draw($, { stdout: lines(31) })).more).toBe('... 21 more lines')
})

test('the text is found in a string output, content, output, text and a Read file content', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, ON)
  await start($)
  expect((await draw($, lines(40))).more).toBe('... 30 more lines')
  expect((await draw($, { content: lines(40) })).more).toBe('... 30 more lines')
  expect((await draw($, { output: lines(40) })).more).toBe('... 30 more lines')
  expect((await draw($, { text: lines(40) })).more).toBe('... 30 more lines')
  expect((await draw($, { file: { content: lines(50) } }, { tool: 'Read' })).more).toBe('... 40 more lines')
})

test('short results, empty output and unknown shapes pass through', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, ON)
  await start($)
  for (const output of [{ stdout: 'ok' }, { stdout: '' }, {}, null, 42, { stdout: 5 }]) {
    const r = await draw($, output)
    expect(r.engine).toBe('engine result')
    expect(r.more).toBeUndefined()
  }
})

test('an errored result and an expanded (ctrl+o) result are shown in full', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, ON)
  await start($)
  expect((await draw($, { stdout: lines(100) }, { isErrored: true })).more).toBeUndefined()
  expect((await draw($, { stdout: lines(100) }, { isExpanded: true })).more).toBeUndefined()
  // and not expanded is still cut
  expect((await draw($, { stdout: lines(100) }, { isExpanded: false })).more).toBe('... 90 more lines')
})

test('Hebrew text', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { ...ON, language: 'he' })
  await start($)
  expect((await draw($, { stdout: lines(100) })).more).toBe('... 90 שורות נוספות')
})

test('off switch set explicitly: nothing is cut', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { enabled: { 'focus-mode': false } })
  await start($)
  const r = await draw($, { stdout: lines(100) })
  expect(r.more).toBeUndefined()
  expect(r.engine).toBe('engine result')
})
