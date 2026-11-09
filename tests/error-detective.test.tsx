import { expect, test } from 'claude-code/testing'
import { COMPOSE, CWD, expandBand, mountBand, mountPane, noticesOf, rig, texts } from './_kit'

const SLOW = { timeoutMs: 30_000 }
const ON = { buddy: false }
const ID = 'error-detective'
const OFF_TEXT = 'The feature is off; turn it on in the /toolkitty pane'
const MIN = 60_000

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const bash = (command: string) => ({ tool: 'Bash', command }) as const
const edit = ($: any, file: string, i: number) => $.tool.call({ tool: 'Edit', file_path: `C:/proj/src/${file}`, old_string: `o${i}`, new_string: `n${i}` })
const readFile = ($: any, file: string) => $.tool.call({ tool: 'Read', file_path: `C:/proj/${file}` })
const failResult = (head: string) => ({ isError: true, result: `Exit code 1\n${head}`, text: `Exit code 1\n${head}` })
const HEAD = 'TypeError: x is not a function'

type Rig = ReturnType<typeof rig>

/** Every Bash command starting with `prefix` fails with `head` while `flag.fail` is true. */
function failing(r: Rig, prefix: string, head: string = HEAD): { fail: boolean } {
  const flag = { fail: true }
  r.answer = e => (flag.fail && e['tool'] === 'Bash' && String(e['command']).startsWith(prefix) ? failResult(head) : {})
  return flag
}

/** The prompt box: what $.prompt.fill wrote. */
function boxOf(on: any): { text: string; mode?: string }[] {
  const filled: { text: string; mode?: string }[] = []
  on('prompt.fill', (_: unknown, e: { text: string; mode?: string }) => {
    filled.push({ text: e.text, mode: e.mode })
    return { isFilled: true }
  })
  return filled
}

const mine = (r: Rig, $: any) => noticesOf($, ID)
async function sections($: any): Promise<{ id: string; text: string }[]> {
  return (await $.prompt.compose(COMPOSE)).sections.filter((s: { id: string }) => s.id === 'toolkitty:error-detective')
}
async function chipOf($: any, surface = 'desktop', hasSurvey = false): Promise<string | undefined> {
  const ui = await mountBand($, { surface, hasSurvey })
  const chip = await ui.find({ key: `chip-${ID}` })
  await ui.unmount()
  return chip === undefined ? undefined : (chip.text as string)
}
async function rowsOf(ui: any): Promise<any[]> {
  return (await ui.findAll({ type: 'Button' })).filter((b: any) => String(b.key).startsWith('ed-row-'))
}
async function fails($: any, command: string, n: number) {
  for (let i = 0; i < n; i++) await $.tool.call(bash(command))
}

test('loads, registers /errors, a quiet session lists nothing and says what will fill it', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  expect(r.regs).toContain('errors')
  expect((await $.command.run({ command: 'errors', args: '' })).text).toBe('Opened the error detective.')
  expect(r.opened).toContain('error-detective')
  const ui = await mountPane($, 'error-detective')
  const all = await texts(ui)
  expect(all).toContain('Error detective')
  expect(all).toContain('0 patterns')
  expect(all).toContain('No repeated failures in this session.')
  expect(all).toContain('The same error three times')
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['ed-show', 'ed-suggest', 'ed-clear'])
  expect(await rowsOf(ui)).toHaveLength(0)
  await ui.unmount()
  expect(await chipOf($)).toBeUndefined()
  expect(await sections($)).toHaveLength(0)
})

test('repeated failure: the same signature three times warns once, nudges, shows in the pane and the chip', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, 'npm test')
  await start($)
  await fails($, 'npm test', 2)
  expect(await mine(r, $)).toEqual([])
  expect(await chipOf($)).toBeUndefined()
  await fails($, 'npm test', 1)
  expect(await mine(r, $)).toEqual(['Repeated failure: "npm test" failed 3 times with the same error'])
  expect(await chipOf($)).toBe('↻ 3× same error')
  expect(await chipOf($, 'terminal')).toBe('↻ 3× same error')
  expect(await chipOf($, 'desktop', true)).toBeUndefined()

  const section = (await sections($))[0]
  expect(section?.text).toContain('# Recurring failure detected')
  expect(section?.text).toContain('Bash `npm test` has failed 3 times with the same error: "TypeError: x is not a function".')
  expect(section?.text).toContain('Tried so far: only retrying it, with no change in between.')
  expect(section?.text).toContain('Ruled out: repeating the identical command or the same edit.')
  expect(section?.text).toContain('investigate the cause')

  const ui = await mountPane($, 'error-detective')
  const all = await texts(ui)
  expect(all).toContain('1 pattern')
  const rows = await rowsOf(ui)
  expect(rows).toHaveLength(1)
  expect(rows[0].text).toContain('3×')
  expect(rows[0].text).toContain('Bash · TypeError: x is not a function')
  expect(rows[0].text).toContain('open')
  await ui.unmount()
})

test('the band line and the chip name the worst open pattern', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, 'npm test')
  await start($)
  await fails($, 'npm test', 4)
  const ui = await mountBand($)
  await expandBand(ui)
  expect((await ui.find({ key: `band-${ID}` }))?.text).toBe('↻ same error 4×: npm test')
  expect((await ui.find({ key: `chip-${ID}` }))?.text).toBe('↻ 4× same error')
  await ui.unmount()
})

test('the signature ignores numbers, hashes, line numbers and temp paths', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  const heads = [
    'TypeError: cannot read 12 at /tmp/ab12cd/build.js:45:7 (commit deadbeef1)',
    'TypeError: cannot read 98 at /tmp/zz99xx/build.js:51:3 (commit cafe1234)',
    'TypeError: cannot read 5 at C:\\Users\\a\\AppData\\Local\\Temp\\q1\\build.js:7:1 (commit 0badf00d9)',
  ]
  let i = 0
  r.answer = e => (e['tool'] === 'Bash' ? failResult(heads[i++ % 3] as string) : {})
  await start($)
  await $.tool.call(bash('node build.js --seed 11'))
  await $.tool.call(bash('node build.js --seed 22'))
  await $.tool.call(bash('node build.js --seed 33'))
  expect(await mine(r, $)).toHaveLength(1)
  const ui = await mountPane($, 'error-detective')
  expect(await rowsOf(ui)).toHaveLength(1)
  await ui.unmount()
})

test('not a repeated failure: two failures, different errors, different commands, or failures split by a success', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  // two only
  failing(r, 'npm test')
  await fails($, 'npm test', 2)
  // three failures of one command, three different errors
  let n = 0
  r.answer = e => (e['tool'] === 'Bash' && String(e['command']) === 'make a' ? failResult(['EACCES: no permission', 'ENOENT: no such file', 'SyntaxError: bad token'][n++ % 3] as string) : {})
  await fails($, 'make a', 3)
  // the same error from three different commands
  r.answer = e => (e['tool'] === 'Bash' ? failResult('boom: broke') : {})
  await $.tool.call(bash('cargo build'))
  await $.tool.call(bash('go vet ./...'))
  await $.tool.call(bash('ruff check .'))
  expect(await mine(r, $)).toEqual([])
  expect(await chipOf($)).toBeUndefined()
  const ui = await mountPane($, 'error-detective')
  expect(await texts(ui)).toContain('No repeated failures in this session.')
  await ui.unmount()
  expect(await sections($)).toHaveLength(0)
})

test('a later identical command that succeeds resolves the pattern: nudge and chip go, the row stays as resolved', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  const flag = failing(r, 'npm test')
  await start($)
  await fails($, 'npm test', 3)
  expect(await sections($)).toHaveLength(1)
  expect(await chipOf($)).toBe('↻ 3× same error')
  flag.fail = false
  await $.tool.call(bash('npm test'))
  expect(await sections($)).toHaveLength(0)
  expect(await chipOf($)).toBeUndefined()
  const ui = await mountPane($, 'error-detective')
  const rows = await rowsOf(ui)
  expect(rows).toHaveLength(1)
  expect(rows[0].text).toContain('resolved')
  await ui.unmount()
  // failing again starts counting from one: two more failures are not a new pattern
  flag.fail = true
  await fails($, 'npm test', 2)
  expect(await mine(r, $)).toHaveLength(1)
  expect(await sections($)).toHaveLength(0)
})

test('ineffective fixes: edit, fail, edit, fail with the same signature', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, 'npm test')
  await start($)
  await edit($, 'a.ts', 1)
  await $.tool.call(bash('npm test'))
  expect(await mine(r, $)).toEqual([])
  await edit($, 'b.ts', 2)
  await $.tool.call(bash('npm test'))
  expect(await mine(r, $)).toEqual(['Ineffective fixes: 2 edits did not change the error of "npm test"'])
  const section = (await sections($))[0]
  expect(section?.text).toContain('Tried so far: edited a.ts, b.ts (2 edit-then-fail cycles); those changes did not fix it.')
  // a chip needs a repeated failure (three), not two cycles
  expect(await chipOf($)).toBeUndefined()

  const ui = await mountPane($, 'error-detective')
  const rows = await rowsOf(ui)
  expect(rows).toHaveLength(1)
  await ui.press({ key: rows[0].key })
  const all = await texts(ui)
  expect(all).toContain('Detected: Ineffective fixes')
  expect(all).toContain('Edited between failures: a.ts, b.ts (2 edit-then-fail cycles)')
  await ui.unmount()
})

test('not ineffective fixes: retries without edits, edits followed by different errors, a success in between, stale edits', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  const flag = { pytest: true }
  let k = 0
  r.answer = e => {
    if (e['tool'] !== 'Bash') return {}
    const cmd = String(e['command'])
    if (cmd.startsWith('npm test') || cmd.startsWith('tsc')) return failResult(HEAD)
    if (cmd.startsWith('make')) return failResult(['one bad thing', 'a different bad thing'][k++ % 2] as string)
    return cmd.startsWith('pytest') && flag.pytest ? failResult(HEAD) : {}
  }
  await start($)
  // retries without edits
  await fails($, 'npm test', 2)
  // edit then fail, but with another error each time
  await edit($, 'a.ts', 1)
  await $.tool.call(bash('make x'))
  await edit($, 'a.ts', 2)
  await $.tool.call(bash('make x'))
  // edit, fail, success, edit, fail: the success resolved the first one
  await edit($, 'c.ts', 3)
  await $.tool.call(bash('pytest'))
  flag.pytest = false
  await $.tool.call(bash('pytest'))
  flag.pytest = true
  await edit($, 'c.ts', 4)
  await $.tool.call(bash('pytest'))
  // an edit long before the failure does not count
  await edit($, 'd.ts', 5)
  for (let j = 0; j < 9; j++) await readFile($, `f${j}.ts`)
  await $.tool.call(bash('tsc'))
  await edit($, 'd.ts', 6)
  await $.tool.call(bash('tsc'))
  expect((await mine(r, $)).filter(x => x.startsWith('Ineffective'))).toEqual([])
})

test('unproductive loop: the same call four times, with or without an error', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  for (let i = 0; i < 3; i++) await readFile($, 'a.ts')
  expect(await mine(r, $)).toEqual([])
  await readFile($, 'a.ts')
  expect(await mine(r, $)).toEqual(['Unproductive loop: "C:/proj/a.ts" repeated 4 times'])
  const section = (await sections($))[0]
  expect(section?.text).toContain('has been called 4 times with identical input and no progress.')
  // a loop is not a "same error" chip
  expect(await chipOf($)).toBeUndefined()
  const ui = await mountPane($, 'error-detective')
  const rows = await rowsOf(ui)
  expect(rows).toHaveLength(1)
  expect(rows[0].text).toContain('4×')
  expect(rows[0].text).toContain('open')
  await ui.press({ key: rows[0].key })
  expect(await texts(ui)).toContain('(no error: the same call again and again)')
  await ui.unmount()
})

test('not a loop: varied inputs, TodoWrite, or calls spread beyond the window', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  for (let i = 0; i < 6; i++) await readFile($, `f${i}.ts`)
  for (let i = 0; i < 6; i++) await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'x', status: 'pending', activeForm: 'xing' }] })
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Grep', pattern: 'foo' })
  for (let i = 0; i < 12; i++) await readFile($, `other${i}.ts`)
  await $.tool.call({ tool: 'Grep', pattern: 'foo' })
  expect(await mine(r, $)).toEqual([])
})

test('a loop already seen by the loop detective needs one repeat fewer', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  const flag = failing(r, 'make x')
  await start($)
  // three reads alone are nothing
  for (let i = 0; i < 3; i++) await readFile($, 'plain.ts')
  expect((await mine(r, $)).filter(x => x.startsWith('Unproductive'))).toEqual([])
  // the loop detective catches a command failing three times in a row (its signal stays up)
  await fails($, 'make x', 3)
  expect(flag.fail).toBe(true)
  await readFile($, 'looped.ts')
  await readFile($, 'looped.ts')
  expect((await mine(r, $)).filter(x => x.startsWith('Unproductive'))).toEqual([])
  await readFile($, 'looped.ts')
  expect((await mine(r, $)).filter(x => x.startsWith('Unproductive'))).toEqual(['Unproductive loop: "C:/proj/looped.ts" repeated 3 times'])
})

test('cooldown: one notice per five minutes for a signature, again after that', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, 'npm test')
  await start($)
  await fails($, 'npm test', 3)
  expect(await mine(r, $)).toHaveLength(1)
  await r.clock.advance(MIN)
  await fails($, 'npm test', 1)
  expect(await mine(r, $)).toHaveLength(1)
  await r.clock.advance(5 * MIN)
  await fails($, 'npm test', 1)
  expect(await mine(r, $)).toEqual([
    'Repeated failure: "npm test" failed 3 times with the same error',
    'Repeated failure: "npm test" failed 5 times with the same error',
  ])
})

test('the nudge is armed once per ten minutes per signature and expires on its own', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  const flag = failing(r, 'npm test')
  await start($)
  await fails($, 'npm test', 3)
  expect(await sections($)).toHaveLength(1)
  await r.clock.advance(9 * MIN)
  expect(await sections($)).toHaveLength(1)
  await r.clock.advance(2 * MIN)
  expect(await sections($)).toHaveLength(0)
  // still failing after the ten minutes: armed again
  await fails($, 'npm test', 1)
  expect(await sections($)).toHaveLength(1)
  // resolved, then failing three more times within ten minutes of the last arming: no second nudge
  flag.fail = false
  await $.tool.call(bash('npm test'))
  expect(await sections($)).toHaveLength(0)
  flag.fail = true
  await fails($, 'npm test', 3)
  expect(await sections($)).toHaveLength(0)
  // ten minutes later it may arm again
  await r.clock.advance(11 * MIN)
  await fails($, 'npm test', 1)
  expect(await sections($)).toHaveLength(1)
})

test('several open patterns share one section (at most three)', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  r.answer = e => (e['tool'] === 'Bash' ? failResult(`failed: ${String(e['command']).split(' ')[0]}`) : {})
  await start($)
  for (const c of ['alpha', 'beta', 'gamma', 'delta']) await fails($, `${c} run`, 3)
  const out = await sections($)
  expect(out).toHaveLength(1)
  const text = out[0]?.text ?? ''
  expect((text.match(/has failed 3 times/g) ?? []).length).toBe(3)
  expect(text).toContain('delta run')
  expect(text).not.toContain('alpha run')
})

test('pane: rows expand and collapse on press; Show pattern copies, Suggest alternative fills the prompt, Clear empties', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  const box = boxOf(on)
  failing(r, 'npm test')
  await start($)
  await edit($, 'a.ts', 1)
  await $.tool.call(bash('npm test'))
  await edit($, 'b.ts', 2)
  await $.tool.call(bash('npm test'))
  await $.tool.call(bash('npm test'))

  const ui = await mountPane($, 'error-detective')
  const key = (await rowsOf(ui))[0].key as string
  expect(await texts(ui)).not.toContain('Ruled out')
  await ui.press({ key })
  let all = await texts(ui)
  expect(all).toContain('Call: npm test')
  expect(all).toContain('Error: TypeError: x is not a function')
  expect(all).toContain('Detected: Repeated failure · Ineffective fixes')
  expect(all).toContain('Seen 3 times, first 0:00 ago, last 0:00 ago')
  expect(all).toContain('Edited between failures: a.ts, b.ts (2 edit-then-fail cycles)')
  expect(all).toContain('Ruled out: the same command and the same change.')
  expect(all).toContain('Suggestion: investigate the cause before another edit')
  await ui.press({ key })
  all = await texts(ui)
  expect(all).not.toContain('Ruled out')

  // Show pattern copies the expanded (or newest open) pattern
  await ui.press({ key: 'ed-show' })
  expect(r.copied).toHaveLength(1)
  expect(r.copied[0]).toBe(
    [
      'Pattern: Repeated failure · Ineffective fixes',
      'Call: Bash npm test',
      'Error: TypeError: x is not a function',
      'Seen 3 times (first 0:00 ago, last 0:00 ago), open',
      'Edited between failures: a.ts, b.ts',
    ].join('\n'),
  )
  expect(await noticesOf($, ID)).toContain('Copied the pattern summary')

  // Suggest alternative: an English investigation prompt tailored to the signature
  await ui.press({ key: 'ed-suggest' })
  expect(box).toHaveLength(1)
  expect(box[0]?.mode).toBe('replace')
  expect(box[0]?.text).toContain('The command `npm test` failed 3 times with error: TypeError: x is not a function.')
  expect(box[0]?.text).toContain('The edits to a.ts, b.ts did not change it.')
  expect(box[0]?.text).toContain('Before editing again, investigate the cause')
  expect(box[0]?.text).toContain('Do not repeat the same command or the same change.')
  expect(await noticesOf($, ID)).toContain('Put an investigation prompt in the input box.')

  // Clear
  await ui.press({ key: 'ed-clear' })
  all = await texts(ui)
  expect(all).toContain('No repeated failures in this session.')
  expect(all).toContain('0 patterns')
  expect(await sections($)).toHaveLength(0)
  expect(await chipOf($)).toBeUndefined()
  expect(await noticesOf($, ID)).toContain('Cleared the error patterns.')
  await ui.unmount()
})

test('pane buttons with nothing to use say so; retrying without edits is described as such', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  const box = boxOf(on)
  failing(r, 'npm test')
  await start($)
  const ui = await mountPane($, 'error-detective')
  await ui.press({ key: 'ed-show' })
  await ui.press({ key: 'ed-suggest' })
  expect(r.copied).toEqual([])
  expect(box).toEqual([])
  expect(await noticesOf($, ID)).toEqual(['No pattern to use yet. ×2'])
  await ui.unmount()

  await fails($, 'npm test', 3)
  const again = await mountPane($, 'error-detective')
  await again.press({ key: 'ed-suggest' })
  expect(box[0]?.text).toContain('Retrying it without any change did not help.')
  await again.unmount()
})

test('a loop-only pattern gets its own suggestion', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  const box = boxOf(on)
  await start($)
  for (let i = 0; i < 4; i++) await readFile($, 'a.ts')
  const ui = await mountPane($, 'error-detective')
  await ui.press({ key: 'ed-suggest' })
  expect(box[0]?.text).toContain('The Read call on `C:/proj/a.ts` was repeated 4 times with identical input and made no progress.')
  expect(r.copied).toEqual([])
  await ui.press({ key: 'ed-show' })
  expect(r.copied[0]).toContain('Pattern: Unproductive loop')
  expect(r.copied[0]).toContain('Error: none')
  await ui.unmount()
})

test('the failed results are counted as a leak and appear in the savings meter', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { ...ON, 'output-trimmer': false, 'output-archive': false } })
  on('session.usage', () => ({ value: { startedAt: 5, context: { window: 200_000, tokens: 0, percent: 0 }, rateLimits: [], cost: { usd: 0.42 } } }) as never)
  failing(r, 'npm test')
  await start($)
  const ui0 = await mountPane($, 'savings')
  const first = await texts(ui0)
  expect(first).toContain('Hypothetical opportunities')
  expect(first).toContain('≈ 0 tok · if avoided')
  await ui0.unmount()
  await fails($, 'npm test', 3)
  const text = `Exit code 1\n${HEAD}`
  const tokens = 3 * Math.ceil(text.length / 4)
  const ui = await mountPane($, 'savings')
  const all = await texts(ui)
  expect(all).toContain(`Failed attempts · ≈ ${tokens} tok`)
  expect(all).toContain(`≈ ${tokens} tok · if avoided`)
  expect(all).toContain('Metered usage (actual)')
  expect(all).toContain('$0.42 · actual')
  expect(all).toContain('Estimated saved')
  expect(all).toContain('Monetary estimate')
  expect(all).toContain('· estimate, not your bill')
  await ui.unmount()
})

test('subagent calls are ignored', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, 'npm test')
  await start($)
  for (let i = 0; i < 5; i++) await $.tool.call({ ...bash('npm test'), agentId: 'sub1' })
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts', agentId: 'sub1' })
  expect(await mine(r, $)).toEqual([])
  expect(await sections($)).toHaveLength(0)
})

test('the detail pane behind the band line lists the patterns with their facts', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, 'npm test')
  await start($)
  await edit($, 'a.ts', 1)
  await fails($, 'npm test', 3)
  await r.clock.advance(65_000)
  const ui = await mountBand($)
  await expandBand(ui)
  await ui.press({ key: `band-${ID}` })
  const detail = await mountPane($, 'toolkitty-detail')
  const all = await texts(detail)
  expect(all).toContain('Call: npm test')
  expect(all).toContain('Seen 3 times, first 1:05 ago, last 1:05 ago')
  expect(all).toContain('Ruled out: the same command and the same change.')
  await ui.unmount()
  await detail.unmount()
})

test('off switch: nothing tracked, no chip, no section, command and pane say off', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { ...ON, [ID]: false } })
  failing(r, 'npm test')
  await start($)
  expect(r.regs).toContain('errors')
  await fails($, 'npm test', 5)
  for (let i = 0; i < 5; i++) await readFile($, 'a.ts')
  expect(await mine(r, $)).toEqual([])
  expect(await sections($)).toHaveLength(0)
  expect(await chipOf($)).toBeUndefined()
  expect((await $.command.run({ command: 'errors', args: '' })).text).toBe(OFF_TEXT)
  const ui = await mountPane($, 'error-detective')
  expect(await texts(ui)).toContain('The error detective is off. Turn it on in the /toolkitty pane.')
  expect(await ui.findAll({ type: 'Button' })).toEqual([])
  await ui.unmount()
})

test('Hebrew: notice, chip, pane and buttons', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON, lang: 'he' })
  failing(r, 'npm test')
  await start($)
  await fails($, 'npm test', 3)
  expect(await mine(r, $)).toEqual(['כשלון חוזר: "npm test" נכשלה 3 פעמים עם אותה שגיאה'])
  expect(await chipOf($)).toBe('↻ 3× אותה שגיאה')
  const ui = await mountPane($, 'error-detective')
  const all = await texts(ui)
  expect(all).toContain('בלש שגיאות')
  expect(all).toContain('דפוס אחד')
  const labels = (await ui.findAll({ type: 'Button' })).map((b: any) => b.props['label'])
  expect(labels).toContain('הצג דפוס')
  expect(labels).toContain('הצע חלופה')
  expect(labels).toContain('נקה')
  await ui.press({ key: (await rowsOf(ui))[0].key })
  expect(await texts(ui)).toContain('נשלל: אותה פקודה ואותו שינוי.')
  await ui.unmount()
})

test('Hebrew: the /errors command and the prompt it fills stay in their languages', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON, lang: 'he' })
  const box = boxOf(on)
  failing(r, 'npm test')
  await start($)
  expect((await $.command.run({ command: 'errors', args: '' })).text).toBe('בלש השגיאות נפתח.')
  await fails($, 'npm test', 3)
  const ui = await mountPane($, 'error-detective')
  await ui.press({ key: 'ed-suggest' })
  expect(box[0]?.text).toContain('The command `npm test` failed 3 times with error')
  expect(await noticesOf($, ID)).toContain('הוכנסה בקשת חקירה לתיבת הכתיבה.')
  await ui.unmount()
})

test('the failure signal reaches the advisor: its headline reports the repeats, and clears on resolve', SLOW, async ($, on) => {
  // the failure counter is off so that only this feature publishes a failure signal
  const r = rig(on, { enabled: { ...ON, 'error-counter': false, 'loop-detective': false } })
  const flag = failing(r, 'npm test')
  await start($)
  const headline = async (): Promise<string | undefined> => {
    const ui = await mountBand($)
    const chip = await ui.find({ key: 'chip-advisor' })
    await ui.unmount()
    return chip === undefined ? undefined : (chip.text as string).trim()
  }
  await fails($, 'npm test', 2)
  expect(await headline()).not.toContain('repeated failures')
  await fails($, 'npm test', 1)
  expect(await headline()).toContain('3 repeated failures')
  await fails($, 'npm test', 1)
  expect(await headline()).toContain('4 repeated failures')
  flag.fail = false
  await $.tool.call(bash('npm test'))
  expect(await headline()).not.toContain('repeated failures')
})

const usageStub = (on: any) =>
  on('session.usage', () => ({ value: { startedAt: 5, context: { window: 200_000, tokens: 0, percent: 0 }, rateLimits: [], cost: { usd: 1.5 } } }) as never)

test('leak kinds: duplicate reads, repeated commands and subagent spend land in the savings meter, apart from the saved tokens', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { ...ON, 'output-trimmer': false, 'output-archive': false } })
  usageStub(on)
  on('agent.list', () => ({ value: [] }) as never)
  r.files['C:/proj/a.ts'] = 'const a = 1\n'.repeat(40)
  r.answer = e => (e['tool'] === 'Bash' ? { stdout: 'y'.repeat(400), stderr: '', interrupted: false } : {})
  await start($)
  await readFile($, 'a.ts')
  await readFile($, 'a.ts')
  await $.tool.call(bash('echo hello'))
  await $.tool.call(bash('echo hello'))
  await $.turn.start({ text: 'sub', turnId: 'sub1', agentId: 'a1' })
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'sub1', reason: 'answer', agentId: 'a1', usage: { input_tokens: 1000, output_tokens: 500, model: 'claude-haiku-5-5' } })

  const ui = await mountPane($, 'savings')
  const all = await texts(ui)
  expect(all).toContain('Duplicate reads · ≈ 2.0k tok')
  expect(all).toContain('Repeated commands · ≈ 100 tok')
  expect(all).toContain('Subagent spend · ≈ 1.5k tok')
  expect(all).toContain('≈ 3.6k tok · if avoided')
  expect(all).toContain('≈ $0.01 · estimate, not your bill')
  expect(all).toContain('$1.50 · actual')
  // nothing was saved yet: leaks are not savings
  expect(all).toContain('≈ 0 tok · $0.00 · estimated')
  await ui.unmount()

  // and the leaks do not light the "saved" chip
  const band = await mountBand($)
  expect(await band.find({ key: 'chip-savings' })).toBe(undefined)
  await band.unmount()
})

test('the dup-read detector keeps its own leak list and /waste is unchanged', SLOW, async ($, on) => {
  const r = rig(on, { enabled: ON })
  r.files['C:/proj/b.ts'] = 'x'
  r.answer = e => (e['tool'] === 'Bash' ? { stdout: 'ok', stderr: '', interrupted: false } : {})
  await start($)
  await readFile($, 'b.ts')
  await readFile($, 'b.ts')
  await $.tool.call(bash('echo same'))
  await $.tool.call(bash('echo same'))
  expect((await $.command.run({ command: 'waste', args: '' })).text).toBe(['Files read again unchanged:', '  1× C:/proj/b.ts', 'Commands repeated:', '  1× echo same'].join('\n'))
})
