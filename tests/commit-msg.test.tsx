import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:/tmp/project'
const STAT = ' a.ts | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)\n'
const DIFF = 'diff --git a/a.ts b/a.ts\n-const a = 1\n+const a = 2\n'

type Calls = { registered: string[]; filled: { text: string; mode: string }[]; argvs: string[][]; prompts: string[] }

function boot(
  on: On,
  store: Record<string, unknown> = {},
  opts: { git?: 'ok' | 'none' | 'empty' | 'big'; fill?: boolean; model?: unknown } = {},
): Calls {
  const calls: Calls = { registered: [], filled: [], argvs: [], prompts: [] }
  mock.store(on, store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_, e) => {
    calls.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('process.run', (_, e) => {
    calls.argvs.push([...e.argv])
    const a = e.argv.join(' ')
    const git = opts.git ?? 'ok'
    const out = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (git === 'none') return out('', 128)
    if (a === 'git diff --cached --stat') return out(git === 'empty' ? '' : STAT)
    if (a === 'git diff --cached') return out(git === 'big' ? 'x'.repeat(20000) : DIFF)
    return out('')
  })
  on('model.complete', (_, e) => {
    calls.prompts.push(e.prompt)
    return {
      value: (opts.model ?? { isAnswered: true, text: 'feat(a): bump a\n\nChanges a to 2.', usage: {} }) as never,
    }
  })
  on('prompt.fill', (_, e) => {
    calls.filled.push({ text: e.text, mode: e.mode })
    return { isFilled: opts.fill ?? true }
  })
  return calls
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })

test('registers /commitmsg at session start', { timeoutMs: 30000 }, async ($, on) => {
  const calls = boot(on)
  await start($)
  expect(calls.registered).toContain('commitmsg')
})

test('fills the prompt with a git commit command built from the staged diff', { timeoutMs: 30000 }, async ($, on) => {
  const calls = boot(on)
  await start($)
  const r = await $.command.run({ command: 'commitmsg', args: '' })
  expect(r.text).toContain('feat(a): bump a')
  expect(r.text).toContain('prompt box')
  expect(calls.filled).toEqual([{ text: 'git commit -m "feat(a): bump a" -m "Changes a to 2."', mode: 'replace' }])
  expect(calls.prompts).toHaveLength(1)
  expect(calls.prompts[0]).toContain('--- git diff --cached --stat ---')
  expect(calls.prompts[0]).toContain('+const a = 2')
  expect(calls.prompts[0]).toContain('Conventional Commits')
})

test('args are ignored (any argument form behaves the same)', { timeoutMs: 30000 }, async ($, on) => {
  const calls = boot(on)
  await start($)
  const a = await $.command.run({ command: 'commitmsg', args: 'whatever --flag' })
  expect(a.text).toContain('feat(a): bump a')
  expect(calls.filled).toHaveLength(1)
})

test('code fences are stripped and shell characters escaped', { timeoutMs: 30000 }, async ($, on) => {
  const calls = boot(on, {}, { model: { isAnswered: true, text: '```\nfix: say "hi" $HOME `x`\n```', usage: {} } })
  await start($)
  const r = await $.command.run({ command: 'commitmsg', args: '' })
  expect(r.text).toContain('fix: say "hi"')
  expect(calls.filled[0]?.text).toBe('git commit -m "fix: say \\"hi\\" \\$HOME \\`x\\`"')
})

test('a long diff is truncated in the prompt', { timeoutMs: 30000 }, async ($, on) => {
  const calls = boot(on, {}, { git: 'big' })
  await start($)
  await $.command.run({ command: 'commitmsg', args: '' })
  expect(calls.prompts[0]).toContain('[diff truncated]')
  expect(calls.prompts[0]!.length).toBeLessThan(13500)
})

test('no repository', { timeoutMs: 30000 }, async ($, on) => {
  const calls = boot(on, {}, { git: 'none' })
  await start($)
  expect((await $.command.run({ command: 'commitmsg', args: '' })).text).toBe('Cannot run git here (no repository?).')
  expect(calls.prompts).toHaveLength(0)
})

test('nothing staged answers without asking the model', { timeoutMs: 30000 }, async ($, on) => {
  const calls = boot(on, {}, { git: 'empty' })
  await start($)
  expect((await $.command.run({ command: 'commitmsg', args: '' })).text).toBe('No staged changes')
  expect(calls.prompts).toHaveLength(0)
})

test('the model not answering', { timeoutMs: 30000 }, async ($, on) => {
  const calls = boot(on, {}, { model: { isAnswered: false, reason: 'aborted', usage: {} } })
  await start($)
  expect((await $.command.run({ command: 'commitmsg', args: '' })).text).toBe('No message received from the model (aborted).')
  expect(calls.filled).toHaveLength(0)
})

test('an empty model reply', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { model: { isAnswered: true, text: '  \n', usage: {} } })
  await start($)
  expect((await $.command.run({ command: 'commitmsg', args: '' })).text).toBe('The model returned an empty message.')
})

test('prompt box refusing the fill shows the command', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { fill: false })
  await start($)
  const r = await $.command.run({ command: 'commitmsg', args: '' })
  expect(r.text).toContain('Could not fill the prompt box')
  expect(r.text).toContain('git commit -m "feat(a): bump a"')
})

test('Hebrew texts', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' }, { git: 'empty' })
  await start($)
  expect((await $.command.run({ command: 'commitmsg', args: '' })).text).toBe('אין שינויים ב-stage')
})

test('off switch: answers the off text and runs nothing', { timeoutMs: 30000 }, async ($, on) => {
  const calls = boot(on, { enabled: { 'commit-msg': false } })
  await start($)
  expect(calls.registered).toContain('commitmsg')
  const r = await $.command.run({ command: 'commitmsg', args: '' })
  expect(r.text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(calls.argvs.filter(a => a[1] === 'diff')).toHaveLength(0)
  expect(calls.prompts).toHaveLength(0)
})

test('off switch in Hebrew', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he', enabled: { 'commit-msg': false } })
  await start($)
  expect((await $.command.run({ command: 'commitmsg', args: '' })).text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})
