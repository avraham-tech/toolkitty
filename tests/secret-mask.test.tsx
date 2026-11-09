import { expect, mock, test } from 'claude-code/testing'

type Ctx = { toasts: string[]; reply: any }

async function boot($: any, on: any, store: Record<string, unknown> = {}): Promise<Ctx> {
  const ctx: Ctx = { toasts: [], reply: { result: { stdout: '', stderr: '', interrupted: false } } }
  mock.store(on, { language: 'en', ...store })
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_: any, e: any) => {
    ctx.toasts.push(typeof e === 'string' ? e : (e.text ?? e.message ?? JSON.stringify(e)))
    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: 'C:/tmp/project' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('tool.call', { tool: 'Bash' }, () => ctx.reply)
  return ctx
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const run = ($: any, command = 'env') => $.tool.call({ tool: 'Bash', command }) as Promise<any>
const out = (stdout: string, stderr = '') => ({ result: { stdout, stderr, interrupted: false } })

const SK = 'sk-' + 'a1B2c3D4e5F6g7H8i9J0k1L2'
const GHP = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789'
const AKIA = 'AKIA' + 'IOSFODNN7EXAMPLE'
const XOX = 'xoxb-' + '1234567890-abcdefghij'
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
const PEM = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\nabcdef\n-----END RSA PRIVATE KEY-----'

const MASKED: Array<[string, string]> = [
  ['an OpenAI style key', `key is ${SK} ok`],
  ['a GitHub token', `GH ${GHP} end`],
  ['an AWS access key id', `id ${AKIA} end`],
  ['a Slack token', `slack ${XOX} end`],
  ['a JWT', `Bearer ${JWT}`],
  ['a private key block', `before\n${PEM}\nafter`],
  ['password=', 'password=hunter2'],
  ['PASSWORD:', 'PASSWORD: hunter2'],
  ['token =', 'token = abcdef123'],
  ['api_key', 'api_key=abc123'],
  ['api-key', 'api-key: abc123'],
  ['passwd', 'passwd=zzz'],
  ['secret', 'secret=zzz'],
  ['DB_PASSWORD env var', 'DB_PASSWORD=hunter2'],
  ['OPENAI_API_KEY env var', 'OPENAI_API_KEY=abc123'],
  ['GITHUB_TOKEN env var', 'GITHUB_TOKEN=abc123'],
  ['AWS_SECRET_ACCESS_KEY env var', 'AWS_SECRET_ACCESS_KEY=abc/123+xyz'],
  ['a JSON password', '{"password": "hunter2"}'],
]

/** Notices are the new toasts: read them back through the notices pane. */
async function shown($: any): Promise<string[]> {
  const ui = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'toolkitty-notices',
    props: { title: 'x', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const hits = await ui.findAll({ type: 'Text' })
  await ui.unmount()
  return hits.map((h: any) => String(h.text)).filter((x: string) => /secrets masked|הוסתרו/.test(x))
}

test('loads and clean output passes through untouched with no toast', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.reply = out('hello world\nall good', 'a warning')
  await start($)
  ctx.toasts.length = 0
  const r = await run($)
  expect(r.result.stdout).toBe('hello world\nall good')
  expect(r.result.stderr).toBe('a warning')
  expect(await shown($)).toEqual([])
})

test('every kind of secret is replaced by [redacted] in stdout', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.toasts.length = 0
  const bad: string[] = []
  for (const [name, text] of MASKED) {
    ctx.reply = out(text)
    const r = await run($)
    const s: string = r.result.stdout
    if (!s.includes('[redacted]')) bad.push(`${name}: not masked -> ${s}`)
    for (const leak of ['hunter2', 'abc123', SK, GHP, AKIA, XOX, JWT, 'MIIEowIBAAKCAQEA', 'abc/123+xyz', 'zzz']) {
      if (text.includes(leak) && s.includes(leak)) bad.push(`${name}: leaked ${leak}`)
    }
  }
  expect(bad).toEqual([])
})

test('exact rewritten output keeps the surrounding text and the key name', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.toasts.length = 0
  ctx.reply = out(`before ${SK} after`)
  expect((await run($)).result.stdout).toBe('before [redacted] after')
  ctx.reply = out('password=hunter2 next')
  expect((await run($)).result.stdout).toBe('password=[redacted] next')
  ctx.reply = out('API_TOKEN: abc')
  expect((await run($)).result.stdout).toBe('API_TOKEN: [redacted]')
  ctx.reply = out(`a\n${PEM}\nb`)
  expect((await run($)).result.stdout).toBe('a\n[redacted]\nb')
})

test('stderr and the text the model reads are masked too', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.toasts.length = 0
  ctx.reply = { result: { stdout: 'ok', stderr: `error with ${SK}`, interrupted: false }, text: `ok\nerror with ${SK}` }
  const r = await run($)
  expect(r.result.stderr).toBe('error with [redacted]')
  expect(r.text).toBe('ok\nerror with [redacted]')
  expect(r.text).not.toContain(SK)
})

test('an errored call has its text masked', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.toasts.length = 0
  ctx.reply = { isError: true, result: 'failed', text: `failed: password=hunter2` }
  const r = await run($)
  expect(r.isError).toBe(true)
  expect(r.text).toBe('failed: password=[redacted]')
})

test('the toast counts the masked secrets', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.toasts.length = 0
  ctx.reply = out(`one ${SK}\ntwo ${GHP}\npassword=x`)
  await run($)
  expect(await shown($)).toEqual(['3 secrets masked in command output'])
})

test('an already masked value is not counted twice', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.toasts.length = 0
  ctx.reply = out(`token=${SK}`)
  const r = await run($)
  expect(r.result.stdout).toBe('token=[redacted]')
  expect(await shown($)).toEqual(['1 secrets masked in command output'])
})

test('Hebrew mask and toast', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { language: 'he' })
  await start($)
  ctx.toasts.length = 0
  ctx.reply = out(`x ${SK}`)
  const r = await run($)
  expect(r.result.stdout).toBe('x [הוסתר]')
  expect(await shown($)).toEqual(['הוסתרו 1 סודות מפלט הפקודה'])
})

test('off switch: output is returned as it was, no toast', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { enabled: { 'secret-mask': false } })
  await start($)
  ctx.toasts.length = 0
  ctx.reply = out(`x ${SK} password=hunter2`)
  const r = await run($)
  expect(r.result.stdout).toBe(`x ${SK} password=hunter2`)
  expect(await shown($)).toEqual([])
})

test('a very long single-word line is masked quickly', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.toasts.length = 0
  const blob = 'A'.repeat(200_000)
  ctx.reply = out(`${blob}\npassword=x`)
  const t0 = Date.now()
  const r = await run($)
  expect(r.result.stdout.endsWith('password=[redacted]')).toBe(true)
  expect(Date.now() - t0).toBeLessThan(3000)
})

test('numbers named like secrets are left alone', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.toasts.length = 0
  ctx.reply = out('max_tokens=4096\nused 12 tokens\nthe secretary spoke')
  const r = await run($)
  expect(r.result.stdout).toBe('max_tokens=4096\nused 12 tokens\nthe secretary spoke')
  expect(await shown($)).toEqual([])
})
