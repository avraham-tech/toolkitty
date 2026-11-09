import { expect, mock, test } from 'claude-code/testing'

async function boot($: any, on: any, store: Record<string, unknown> = {}) {
  mock.store(on, { language: 'en', ...store })
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: 'C:/tmp/project' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ran', stderr: '', interrupted: false } }) as any)
  on('tool.call', { tool: 'Edit' }, () => ({ result: { ok: 'ran' } }) as any)
  on('tool.call', { tool: 'Write' }, () => ({ result: { ok: 'ran' } }) as any)
  on('tool.call', { tool: 'NotebookEdit' }, () => ({ result: { ok: 'ran' } }) as any)
  on('tool.call', { tool: 'Read' }, () => ({ result: { ok: 'ran' } }) as any)
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const bash = ($: any, command: string) => $.tool.call({ tool: 'Bash', command }) as Promise<any>
const edit = ($: any, file_path: string) => $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) as Promise<any>
const write = ($: any, file_path: string) => $.tool.call({ tool: 'Write', file_path, content: 'X=1' }) as Promise<any>
const notebook = ($: any, notebook_path: string) => $.tool.call({ tool: 'NotebookEdit', notebook_path, new_source: 'x' }) as Promise<any>

const SECRET_PATHS = [
  'C:/tmp/project/.env',
  'C:\\tmp\\project\\.env',
  '/home/u/app/.env.local',
  'src/config/.env.production',
  'C:/tmp/project/deploy/server.pem',
  'keys/private.key',
  '/home/u/.ssh/id_rsa',
  'certs/client.p12',
  'certs/client.pfx',
  'C:/tmp/project/secrets.yml',
  'C:/tmp/project/credentials.json',
  'C:/tmp/project/.npmrc',
  'C:/Users/test/.netrc',
]

const SAFE_PATHS = [
  'C:/tmp/project/.env.example',
  'C:/tmp/project/.env.sample',
  'C:/tmp/project/.env.template',
  'C:/tmp/project/.env.local.dist',
  'C:/tmp/project/environment.ts',
  'C:/tmp/project/src/monkey.ts',
  'C:/tmp/project/README.md',
  'C:/tmp/project/src/keyboard.tsx',
  'C:/tmp/project/package.json',
]

test('Edit and Write on a secret file are denied, with the file named', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on)
  await start($)
  const missed: string[] = []
  for (const p of SECRET_PATHS) {
    for (const call of [edit, write]) {
      const r = await call($, p)
      if (typeof r.deny !== 'string' || !r.deny.includes('Secret protection') || !r.deny.includes(p)) missed.push(`${call === edit ? 'Edit' : 'Write'} ${p}`)
    }
  }
  expect(missed).toEqual([])
})

test('Edit and Write on ordinary files and templates pass', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on)
  await start($)
  const wrongly: string[] = []
  for (const p of SAFE_PATHS) {
    for (const call of [edit, write]) {
      const r = await call($, p)
      if (r.deny !== undefined || r.result?.ok !== 'ran') wrongly.push(p)
    }
  }
  expect(wrongly).toEqual([])
})

test('NotebookEdit on a secret path is denied, on a normal notebook passes', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on)
  await start($)
  expect((await notebook($, 'C:/tmp/project/secrets.json')).deny).toContain('Secret protection')
  const bad = await notebook($, 'C:/tmp/project/credentials.ipynb')
  expect(bad.deny).toContain('Secret protection')
  const good = await notebook($, 'C:/tmp/project/analysis.ipynb')
  expect(good.deny).toBeUndefined()
  expect(good.result?.ok).toBe('ran')
})

test('reading a secret file is allowed', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on)
  await start($)
  const r = await $.tool.call({ tool: 'Read', file_path: 'C:/tmp/project/.env' })
  expect(r.deny).toBeUndefined()
  expect((await bash($, 'cat .env')).deny).toBeUndefined()
  expect((await bash($, 'cat .env | grep KEY')).deny).toBeUndefined()
  expect((await bash($, 'grep -n TOKEN .env.local')).deny).toBeUndefined()
})

const BASH_DENIED = [
  'echo KEY=1 > .env',
  'echo KEY=1 >> .env.local',
  'printf x>.env',
  'cat a.txt 1> secrets.yml',
  'echo x | tee .env',
  'echo x | tee -a keys/server.key',
  'cp backup.txt .env',
  'cp .env.example .env',
  'mv tmp.txt ~/.ssh/id_rsa',
  'echo x > "server.pem"',
  'cd app && echo x > .npmrc',
  'echo a > ok.txt && echo b > credentials.json',
]

const BASH_PASSED = [
  'echo hi > out.txt',
  'echo hi >> build.log',
  'npm run build > build.log 2>&1',
  'echo oops >&2',
  'cat .env',
  'cp .env .env.example',
  'cp .env.example .env.sample',
  'mv a.txt b.txt',
  'echo x > .env.example',
  'ls -la',
  'tee out.txt < in.txt',
  'git status',
]

test('Bash writing to a secret file is denied', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on)
  await start($)
  const missed: string[] = []
  for (const command of BASH_DENIED) {
    const r = await bash($, command)
    if (typeof r.deny !== 'string' || !r.deny.includes('Secret protection') || !r.deny.includes('the command writes to')) missed.push(command)
  }
  expect(missed).toEqual([])
})

test('Bash that does not write a secret file passes', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on)
  await start($)
  const wrongly: string[] = []
  for (const command of BASH_PASSED) {
    const r = await bash($, command)
    if (r.deny !== undefined || r.result?.stdout !== 'ran') wrongly.push(command)
  }
  expect(wrongly).toEqual([])
})

test('Hebrew deny text', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on, { language: 'he' })
  await start($)
  const r = await edit($, 'C:/tmp/project/.env')
  expect(r.deny).toContain('הגנת סודות')
  expect(r.deny).toContain('קובץ סודות המוגן מכתיבה')
  const b = await bash($, 'echo x > .env')
  expect(b.deny).toContain('הפקודה כותבת אל')
})

test('off switch: secret writes pass through', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on, { enabled: { 'protect-secrets': false } })
  await start($)
  expect((await edit($, 'C:/tmp/project/.env')).result?.ok).toBe('ran')
  expect((await write($, 'C:/tmp/project/server.pem')).result?.ok).toBe('ran')
  expect((await bash($, 'echo x > .env')).result?.stdout).toBe('ran')
})

test('a block is reported to Disasters prevented by file name, not full path', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on)
  await start($)
  await edit($, 'C:\\tmp\\project\\deploy\\server.pem')
  const ui = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'incidents',
    props: { title: 'x', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const hits = await ui.findAll({ type: 'Text', text: /secret-file/ })
  expect(hits.length).toBeGreaterThan(0)
  const joined = hits.map((h: any) => h.text).join('\n')
  expect(joined).toContain('server.pem')
  expect(joined).not.toContain('deploy')
  await ui.unmount()
})
