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
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }) as never)
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const turn = (id = 't1', extra: Record<string, unknown> = {}) => ({ text: 'go', turnId: id, ...extra })
const done = (answer = 'All done.', extra: Record<string, unknown> = {}) => ({
  answer,
  durationMs: 1000,
  isAborted: false,
  turnId: 't1',
  reason: 'answer' as const,
  ...extra,
})
const edit = ($: any, file: string) => $.tool.call({ tool: 'Edit', file_path: file, old_string: 'a', new_string: 'b' })
const write = ($: any, file: string) => $.tool.call({ tool: 'Write', file_path: file, content: 'x' })

test('loads and a turn without edits adds nothing', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect((await $.turn.complete(done())).text).toBe('All done.')
})

test('one edited file: singular text and the action count', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  await edit($, 'C:/tmp/project/a.ts')
  expect((await $.turn.complete(done())).text).toBe('All done.\n\nOne file edited · 1 action in the turn')
})

test('several files, repeated edits of one file count once, other tools count as actions', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  await edit($, 'C:/tmp/project/a.ts')
  await edit($, 'C:/tmp/project/a.ts')
  await write($, 'C:/tmp/project/b.ts')
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: 'C:/tmp/project/n.ipynb', new_source: 'x' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect((await $.turn.complete(done())).text).toBe('All done.\n\n3 files edited · 5 actions in the turn')
})

test('the next turn starts from zero', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  await edit($, 'C:/tmp/project/a.ts')
  await $.turn.complete(done())
  await $.turn.start(turn('t2'))
  await write($, 'C:/tmp/project/z.ts')
  expect((await $.turn.complete(done('second', { turnId: 't2' }))).text).toBe('second\n\nOne file edited · 1 action in the turn')
})

test('a subagent turn neither resets nor gets a line', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  await edit($, 'C:/tmp/project/a.ts')
  await $.turn.start(turn('sub', { agentId: 'a1' }))
  expect((await $.turn.complete(done('sub answer', { turnId: 'sub', agentId: 'a1' }))).text).toBe('sub answer')
  expect((await $.turn.complete(done())).text).toBe('All done.\n\nOne file edited · 1 action in the turn')
})

test('Hebrew line', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' })
  await start($)
  await $.turn.start(turn())
  await edit($, 'C:/tmp/project/a.ts')
  await edit($, 'C:/tmp/project/b.ts')
  expect((await $.turn.complete(done())).text).toBe('All done.\n\n2 קבצים נערכו · 2 פעולות בתור')
})

test('Hebrew singular', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' })
  await start($)
  await $.turn.start(turn())
  await edit($, 'C:/tmp/project/a.ts')
  expect((await $.turn.complete(done())).text).toBe('All done.\n\nקובץ אחד נערך · פעולה אחת בתור')
})

test('tool calls are never denied', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  const r: any = await edit($, 'C:/tmp/project/a.ts')
  expect(r.deny).toBeUndefined()
})

test('off switch: no line and no counting', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { enabled: { 'turn-summary': false } })
  await start($)
  await $.turn.start(turn())
  await edit($, 'C:/tmp/project/a.ts')
  expect((await $.turn.complete(done())).text).toBe('All done.')
})


test('a subagent tool call is counted in the turn that started them (current behaviour)', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  await $.tool.call({ tool: 'Write', file_path: 'C:/tmp/project/s.ts', content: 'x', agentId: 'a1' } as never)
  expect((await $.turn.complete(done())).text).toBe('All done.\n\nOne file edited · 1 action in the turn')
})
