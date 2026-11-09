import { expect, mock, test } from 'claude-code/testing'

type Ctx = { reply: any }

async function boot($: any, on: any, store: Record<string, unknown> = {}): Promise<Ctx> {
  const ctx: Ctx = { reply: { result: { stdout: '', stderr: '', interrupted: false } } }
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
  on('tool.call', { tool: 'Bash' }, () => ctx.reply)
  return ctx
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const run = ($: any, command = 'npm test') => $.tool.call({ tool: 'Bash', command }) as Promise<any>
const lines = (n: number, prefix = 'line'): string => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join('\n')
const out = (stdout: string, stderr = '') => ({ result: { stdout, stderr, interrupted: false } })

test('output of 200 lines or fewer is untouched', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  for (const n of [1, 50, 199, 200]) {
    ctx.reply = out(lines(n))
    const r = await run($)
    expect(r.result.stdout).toBe(lines(n))
  }
})

test('201 lines: first 60, a marker, last 100', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.reply = out(lines(201))
  const r = await run($)
  const got: string[] = r.result.stdout.split('\n')
  expect(got.length).toBe(161)
  expect(got.slice(0, 60)).toEqual(lines(201).split('\n').slice(0, 60))
  expect(got[60]).toBe('... [Toolkitty trimmed 41 lines from the middle] ...')
  expect(got.slice(61)).toEqual(lines(201).split('\n').slice(-100))
  expect(got[61]).toBe('line 102')
  expect(got[160]).toBe('line 201')
})

test('1000 lines: exact marker count and the kept ends', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.reply = out(lines(1000))
  const got: string[] = (await run($)).result.stdout.split('\n')
  expect(got[0]).toBe('line 1')
  expect(got[59]).toBe('line 60')
  expect(got[60]).toBe('... [Toolkitty trimmed 840 lines from the middle] ...')
  expect(got[61]).toBe('line 901')
  expect(got[got.length - 1]).toBe('line 1000')
})

test('the text the model reads is trimmed the same way', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.reply = { ...out(lines(300)), text: lines(300) }
  const r = await run($)
  const t: string[] = r.text.split('\n')
  expect(t.length).toBe(161)
  expect(t[60]).toBe('... [Toolkitty trimmed 140 lines from the middle] ...')
  expect(r.result.stdout.split('\n')[60]).toBe('... [Toolkitty trimmed 140 lines from the middle] ...')
})

test('long stderr is trimmed even when stdout is short', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.reply = { ...out('done', lines(500, 'warn')), text: 'done\n' + lines(500, 'warn') }
  const r = await run($)
  expect(r.result.stdout).toBe('done')
  const e: string[] = r.result.stderr.split('\n')
  expect(e.length).toBe(161)
  expect(e[60]).toBe('... [Toolkitty trimmed 340 lines from the middle] ...')
  expect(r.text.split('\n').length).toBeLessThan(200)
})

test('an errored call is returned as it was', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.reply = { isError: true, result: lines(500), text: lines(500) }
  const r = await run($)
  expect(r.isError).toBe(true)
  expect(r.text).toBe(lines(500))
})

test('Hebrew marker', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { language: 'he' })
  await start($)
  ctx.reply = out(lines(210))
  const got: string[] = (await run($)).result.stdout.split('\n')
  expect(got[60]).toBe('... [Toolkitty קיצר 50 שורות מהאמצע] ...')
})

test('off switch: long output is returned whole', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { enabled: { 'output-trimmer': false } })
  await start($)
  ctx.reply = out(lines(500))
  expect((await run($)).result.stdout).toBe(lines(500))
})

test('the saving is recorded for the savings feature', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  ctx.reply = out(lines(1000))
  await run($)
  const ui = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'savings',
    props: { title: 'x', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const all = await ui.findAll({ type: 'Text' })
  const joined = all.map((x: any) => x.text).join('\n')
  expect(joined).toMatch(/Output trimming|output-trimmer/i)
  await ui.unmount()
})
