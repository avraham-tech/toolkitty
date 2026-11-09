import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'toolkitty',
  props: {
    title: 'Toolkitty',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

test('the switchboard draws every feature and a row toggles', { timeoutMs: 30_000 }, async ($, on) => {
  mock.store(on)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.length).toBeGreaterThan(70)

  const before = await ui.find({ key: 't-task-pulse' })
  expect(before?.props['label']).toMatch(/^●/)
  await ui.press({ key: 't-task-pulse' })
  const after = await ui.find({ key: 't-task-pulse' })
  expect(after?.props['label']).toMatch(/^○/)
  await ui.unmount()
})
