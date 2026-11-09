import { expect, test } from 'claude-code/testing'
import { CWD, expandBand, mountBand, mountPane, rig, texts, lineOf } from './_kit'

const ON = { 'scope-guard': true, buddy: false }
const OFF_TEXT = 'The feature is off; turn it on in the /toolkitty pane'
const denyText = (path: string, globs: string) =>
  `Toolkitty · Scope guard: ${path} is outside the allowed scope for this project. Allowed: ${globs}. Ask the user to run /scope add <glob> if this file should be editable, or turn the feature off in the /toolkitty pane.`

const edit = (file_path: string) => ({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) as const
const write = (file_path: string) => ({ tool: 'Write', file_path, content: 'x' }) as const
const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const run = ($: any, args: string) => $.command.run({ command: 'scope', args })

test('registers /scope at session start and draws nothing before a scope exists', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  expect(r.regs).toContain('scope')
  const ui = await mountBand($)
  expect(await ui.find({ key: 'band-scope-guard' })).toBe(undefined)
  await expandBand(ui)
  expect(await ui.find({ key: 'band-scope-guard' })).toBe(undefined)
  await ui.unmount()
})

test('off by default: the command says so, edits pass, no band', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, {})
  await start($)
  expect((await run($, '')).text).toBe(OFF_TEXT)
  expect((await run($, 'add src/**')).text).toBe(OFF_TEXT)
  const r = await $.tool.call(edit('C:/proj/anything.ts'))
  expect(r.deny).toBe(undefined)
  const ui = await mountBand($)
  await expandBand(ui)
  expect(await ui.find({ key: 'band-scope-guard' })).toBe(undefined)
  await ui.unmount()
})

test('turned off after a scope was set: guard stops, command says off, band disappears', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON })
  await start($)
  await run($, 'add src/**')
  expect((await $.tool.call(edit('C:/proj/a.ts'))).deny).toBe(denyText('a.ts', 'src/**'))
  const ui = await mountBand($)
  await expandBand(ui)
  expect(await ui.find({ key: 'band-scope-guard' })).not.toBe(undefined)
  await ui.press({ key: 'band-scope-guard' })
  const detail = await mountPane($, 'toolkitty-detail')
  await detail.press({ key: 'detail-toggle' })
  expect((await run($, '')).text).toBe(OFF_TEXT)
  expect((await $.tool.call(edit('C:/proj/a.ts'))).deny).toBe(undefined)
  expect(await ui.find({ key: 'band-scope-guard' })).toBe(undefined)
  // and back on: the scope is still there
  await detail.press({ key: 'detail-toggle' })
  expect((await $.tool.call(edit('C:/proj/a.ts'))).deny).toBe(denyText('a.ts', 'src/**'))
  await ui.unmount()
  await detail.unmount()
})

test('commands: every argument form', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON })
  await start($)
  const empty = 'No scope is set: edits are not restricted. Add one with /scope add <glob>.'
  const usage = 'Usage: /scope add <glob> | /scope remove <glob> | /scope clear | /scope'
  expect((await run($, '')).text).toBe(empty)
  expect((await run($, '   ')).text).toBe(empty)
  expect((await run($, 'list')).text).toBe(empty)
  expect((await run($, 'clear')).text).toBe('Scope cleared; edits are no longer restricted in this project.')
  expect((await run($, 'add')).text).toBe(usage)
  expect((await run($, 'add   ')).text).toBe(usage)
  expect((await run($, 'remove')).text).toBe(usage)
  expect((await run($, 'frobnicate x')).text).toBe(usage)
  expect((await run($, 'src/**')).text).toBe(usage)

  expect((await run($, 'add src/**')).text).toBe('Added to scope: src/**')
  expect((await run($, 'add src/**')).text).toBe('src/** is already in the scope.')
  expect((await run($, 'add SRC/**')).text).toBe('SRC/** is already in the scope.')
  expect((await run($, 'ADD "docs/*.md"')).text).toBe('Added to scope: docs/*.md')
  expect((await run($, "add './lib/'")).text).toBe('Added to scope: lib/')
  expect((await run($, 'add C:\\proj\\tests\\**')).text).toBe('Added to scope: C:/proj/tests/**')
  expect((await run($, '')).text).toBe(['Edits are limited to these paths:', '- src/**', '- docs/*.md', '- lib/', '- C:/proj/tests/**'].join('\n'))
  expect((await run($, 'list')).text).toBe((await run($, '')).text)

  expect((await run($, 'remove nope/**')).text).toBe('nope/** is not in the scope.')
  expect((await run($, 'remove SRC/**')).text).toBe('Removed from scope: SRC/**')
  expect((await run($, 'rm lib/')).text).toBe('Removed from scope: lib/')
  expect((await run($, '')).text).toBe(['Edits are limited to these paths:', '- docs/*.md', '- C:/proj/tests/**'].join('\n'))
  expect((await run($, 'clear')).text).toBe('Scope cleared; edits are no longer restricted in this project.')
  expect((await run($, '')).text).toBe(empty)
})

test('edits outside the scope are denied with the exact text (12 inputs)', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON })
  await start($)
  await run($, 'add src/**')
  await run($, 'add *.md')
  await run($, 'add lib/')
  const globs = 'src/**, *.md, lib/'
  const cases: [Record<string, unknown>, string][] = [
    [edit('C:/proj/a.ts'), 'a.ts'],
    [write('C:/proj/docs/guide.txt'), 'docs/guide.txt'],
    [write('C:\\proj\\scripts\\build.js'), 'scripts/build.js'],
    [{ tool: 'NotebookEdit', notebook_path: 'C:/proj/nb/analysis.ipynb', new_source: 'x' }, 'nb/analysis.ipynb'],
    [edit('D:/other/src/a.ts'), 'D:/other/src/a.ts'],
    [edit('C:/proj-other/src/a.ts'), 'C:/proj-other/src/a.ts'],
    [edit('C:/proj/srcx/a.ts'), 'srcx/a.ts'],
    [edit('C:/proj/library/a.ts'), 'library/a.ts'],
    [edit('C:/proj/package.json'), 'package.json'],
    [edit('C:/proj/config.yml'), 'config.yml'],
    [edit('C:/proj/src/../secret.ts'), 'secret.ts'],
    [edit('C:\\proj\\src\\..\\..\\outside\\x.ts'), 'C:/outside/x.ts'],
  ]
  for (const [call, shown] of cases) {
    const r = await $.tool.call(call as never)
    expect(r.deny, `${JSON.stringify(call)} should be denied`).toBe(denyText(shown, globs))
  }
})

test('edits inside the scope pass (12 inputs)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  await run($, 'add src/**')
  await run($, 'add *.md')
  await run($, 'add lib/')
  await run($, 'add C:/proj/tests/**')
  await run($, 'add app/a?.ts')
  await run($, 'add pkg/*.json')
  const ok: Record<string, unknown>[] = [
    edit('C:/proj/src/a.ts'),
    edit('C:/proj/src/deep/er/b.ts'),
    write('C:\\proj\\src\\win.ts'),
    edit('C:/PROJ/SRC/Case.ts'),
    write('C:/proj/README.md'),
    write('C:/proj/docs/deep/guide.md'),
    edit('C:/proj/lib/x/y/z.ts'),
    edit('C:/proj/tests/unit/a.test.ts'),
    edit('C:/proj/app/ab.ts'),
    edit('C:/proj/pkg/one.json'),
    { tool: 'NotebookEdit', notebook_path: 'C:/proj/src/nb.ipynb', new_source: 'x' },
    edit('src/relative.ts'),
  ]
  for (const call of ok) {
    const res = await $.tool.call(call as never)
    expect(res.deny, `${JSON.stringify(call)} should pass`).toBe(undefined)
  }
  // a non-edit tool is none of the guard's business
  expect((await $.tool.call({ tool: 'Read', file_path: 'C:/outside/a.ts' })).deny).toBe(undefined)
  expect((await $.tool.call({ tool: 'Bash', command: 'echo hi > C:/outside/a.ts' })).deny).toBe(undefined)
  // single * stays inside a segment
  expect((await $.tool.call(edit('C:/proj/pkg/deep/one.json'))).deny).toBe(denyText('pkg/deep/one.json', 'src/**, *.md, lib/, C:/proj/tests/**, app/a?.ts, pkg/*.json'))
  expect((await $.tool.call(edit('C:/proj/app/abc.ts'))).deny).toContain('app/abc.ts')
  expect(r.regs.length).toBeGreaterThan(0)
})

test('no scope: nothing is restricted, a subagent is held to the scope too', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON })
  await start($)
  expect((await $.tool.call(edit('C:/anywhere/at/all.ts'))).deny).toBe(undefined)
  await run($, 'add src/**')
  expect((await $.tool.call({ ...edit('C:/proj/x.ts'), agentId: 'sub1' })).deny).toBe(denyText('x.ts', 'src/**'))
  expect((await $.tool.call({ ...edit('C:/proj/src/x.ts'), agentId: 'sub1' })).deny).toBe(undefined)
  await run($, 'clear')
  expect((await $.tool.call(edit('C:/proj/x.ts'))).deny).toBe(undefined)
})

test('the scope is kept per project in the store and survives a new session', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON, store: { 'scope-guard:C:/proj': ['src/**', 'docs/'] } })
  await start($)
  expect((await run($, '')).text).toBe(['Edits are limited to these paths:', '- src/**', '- docs/'].join('\n'))
  expect((await $.tool.call(edit('C:/proj/other.ts'))).deny).toBe(denyText('other.ts', 'src/**, docs/'))
  expect((await $.tool.call(edit('C:/proj/docs/a.md'))).deny).toBe(undefined)
})

test('a project with its own empty scope is not restricted by another project', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON, cwd: 'C:/other', store: { 'scope-guard:C:/proj': ['src/**'] } })
  await $.session.start({ cwd: 'C:/other', surface: 'desktop', isInteractive: true })
  expect((await run($, '')).text).toBe('No scope is set: edits are not restricted. Add one with /scope add <glob>.')
  expect((await $.tool.call(edit('C:/other/anything.ts'))).deny).toBe(undefined)
})

test('band line and its detail pane, on both surfaces', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  await run($, 'add src/**')
  for (const surface of ['desktop', 'terminal']) {
    const ui = await mountBand($, { surface })
    await expandBand(ui)
    expect((await lineOf(ui, 'scope-guard'))).toBe('🔒 scope: 1 glob')
    await ui.unmount()
  }
  await run($, 'add docs/**')
  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'scope-guard'))).toBe('🔒 scope: 2 globs')
  await ui.press({ key: 'band-scope-guard' })
  expect(r.opened).toContain('toolkitty-detail')
  const detail = await mountPane($, 'toolkitty-detail')
  const all = await texts(detail)
  expect(all).toContain('Scope guard')
  expect(all).toContain('🔒 scope: 2 globs')
  expect(all).toContain('Commands: /scope')
  const keys = (await detail.findAll({ type: 'Button' })).map((b: any) => b.key)
  expect(keys).toEqual(['detail-toggle', 'detail-close'])
  await detail.press({ key: 'detail-close' })
  expect(r.closed).toContain('toolkitty-detail')
  await run($, 'clear')
  expect(await ui.find({ key: 'band-scope-guard' })).toBe(undefined)
  await ui.unmount()
  await detail.unmount()
})

test('a survey holding the band hides the line', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON })
  await start($)
  await run($, 'add src/**')
  const ui = await mountBand($, { hasSurvey: true })
  await expandBand(ui)
  expect(await ui.find({ key: 'band-scope-guard' })).toBe(undefined)
  await ui.unmount()
})

test('a deny lands in the incident counter', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON })
  await start($)
  await run($, 'add src/**')
  await $.tool.call(edit('C:/proj/a.ts'))
  await $.tool.call(edit('C:/proj/src/ok.ts'))
  await $.tool.call(edit('C:/proj/b.ts'))
  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'incidents'))).toBe('🛡 2 prevented')
  await ui.unmount()
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON, lang: 'he' })
  await start($)
  expect((await run($, '')).text).toBe('לא הוגדר היקף: העריכות אינן מוגבלות. הוסף עם /scope add <glob>.')
  expect((await run($, 'add src/**')).text).toBe('נוסף להיקף: src/**')
  expect((await run($, 'bogus')).text).toBe('שימוש: /scope add <glob> | /scope remove <glob> | /scope clear | /scope')
  const r = await $.tool.call(edit('C:/proj/a.ts'))
  expect(r.deny).toContain('שומר היקף')
  expect(r.deny).toContain('a.ts')
  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'scope-guard'))).toBe('🔒 היקף: glob אחד')
  await ui.unmount()
})
