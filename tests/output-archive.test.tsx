import { expect, test } from 'claude-code/testing'

import { bashResult, begin, boot, SLOW, T0 } from './world'

const ID = 'output-archive'
const STAMP = T0.toString(36)
const DIR = `C:/tmp/toolkitty-archive/${STAMP}`
const QUIET = { 'output-trimmer': false, 'injection-tripwire': false, 'secret-mask': false, 'loop-detective': false, 'dup-read-detector': false }
const store = (extra: Record<string, unknown> = {}, enabled: Record<string, boolean> = {}) => ({ enabled: { ...QUIET, ...enabled }, ...extra })
const footer = (n: number) => `[… archived as #${n}: /recall ${n} <term> searches it, /recall ${n} shows more]`
const rows = (n: number, tag = 'row') => Array.from({ length: n }, (_, i) => `${tag} ${i + 1} payload`).join('\n')
const recall = ($: any, args: string) => $.command.run({ command: 'recall', args })
const archive = ($: any) => $.command.run({ command: 'archive', args: '' })
const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const note = (tool: string, len: number, path: string) =>
  `Toolkitty note: this ${tool} output was ${len} characters long, so only the first 3000 are shown above. The full output is saved at ${path}; you may Read or Grep that file if you need more of it.`

const bash = ($: any, command = 'cat big.log', extra: Record<string, unknown> = {}) => $.tool.call({ tool: 'Bash', command, ...extra })

test('loads and registers /recall and /archive', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  expect(w.commands).toContain('recall')
  expect(w.commands).toContain('archive')
  expect((await archive($)).text).toBe('Nothing has been archived yet.')
  expect(w.toasts).toEqual([])
})

test('a long Bash stdout is written to a file and only its start stays, with the footer and a model note', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const full = rows(1500)
  expect(full.length).toBeGreaterThan(8000)
  w.toolResult = () => bashResult(full)
  const out = await bash($)
  const short = `${full.slice(0, 3000)}\n${footer(1)}`
  expect(out.result.stdout).toBe(short)
  expect(out.result.stderr).toBe('')
  expect(out.text).toBe(short)
  expect(out.context).toEqual([note('Bash', full.length, `${DIR}/1.txt`)])
  // the whole output is in the file, nothing lost
  expect(w.files[`${DIR}/1.txt`]).toBe(full)
  expect(w.toasts).toEqual([])
})

test('the 8000 character boundary: 8000 stays, 8001 is archived', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult('a'.repeat(8000))
  const small = await bash($)
  expect(small.result.stdout.length).toBe(8000)
  expect(small.context).toBeUndefined()
  expect(Object.keys(w.files)).toEqual([])
  w.toolResult = () => bashResult('a'.repeat(8001))
  const big = await bash($)
  expect(big.result.stdout.length).toBeLessThan(8001)
  expect(big.context?.length).toBe(1)
  expect(Object.keys(w.files)).toEqual([`${DIR}/1.txt`])
})

test('stderr is archived on its own, and both streams get their own numbers', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const out = rows(900, 'out')
  const err = rows(900, 'err')
  w.toolResult = () => bashResult(out, err)
  const r = await bash($)
  expect(r.result.stdout).toBe(`${out.slice(0, 3000)}\n${footer(1)}`)
  expect(r.result.stderr).toBe(`${err.slice(0, 3000)}\n${footer(2)}`)
  expect(r.context.length).toBe(2)
  expect(w.files[`${DIR}/1.txt`]).toBe(out)
  expect(w.files[`${DIR}/2.txt`]).toBe(err)
  const listed = (await archive($)).text.split('\n')
  expect(listed[0]).toBe('Archived outputs:')
  expect(listed[1]).toBe(`#1 Bash · ${out.length} B · ${DIR}/1.txt`)
  expect(listed[2]).toBe('    out 1 payload')
  expect(listed[3]).toBe(`#2 Bash · ${err.length} B · ${DIR}/2.txt`)
})

test('only the big stream is archived when the other is small', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult('ok', rows(1200, 'err'))
  const r = await bash($)
  expect(r.result.stdout).toBe('ok')
  expect(r.result.stderr).toContain(footer(1))
})

test('a command that reads the archive itself, and output the trimmer already cut, are left alone', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult(rows(1500))
  const r = await bash($, 'cat C:/tmp/toolkitty-archive/x/1.txt')
  expect(r.result.stdout.length).toBeGreaterThan(8000)
  expect(r.context).toBeUndefined()
  const marked = 'x'.repeat(9000) + '\n... [Toolkitty trimmed 120 lines from the middle] ...\n' + 'y'.repeat(100)
  w.toolResult = () => bashResult(marked)
  const t = await bash($)
  expect(t.result.stdout).toBe(marked)
  expect(Object.keys(w.files)).toEqual([])
})

test('a subagent\'s and a denied or errored call are not archived', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult(rows(1500))
  const sub = await bash($, 'ls', { agentId: 'a1' })
  expect(sub.context).toBeUndefined()
  w.toolResult = () => ({ deny: 'no' })
  expect((await bash($)).deny).toBe('no')
  w.toolResult = () => ({ ...bashResult(rows(1500)), isError: true })
  const err = await bash($)
  expect(err.context).toBeUndefined()
  expect(Object.keys(w.files)).toEqual([])
})

test('a write that fails leaves the output as it was', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.writeFails = true
  const full = rows(1500)
  w.toolResult = () => bashResult(full)
  const r = await bash($)
  expect(r.result.stdout).toBe(full)
  expect(r.context).toBeUndefined()
  expect((await archive($)).text).toBe('Nothing has been archived yet.')
})

test('a Read of a long file keeps the start and a note; reading the archive itself is not archived again', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const content = rows(3000, 'src')
  expect(content.length).toBeGreaterThan(40_000)
  const file = (path: string, c: string) => ({
    result: { type: 'text', file: { filePath: path, content: c, numLines: 3000, startLine: 1, totalLines: 3000 } },
    text: c,
  })
  w.toolResult = e => file(e.file_path, content)
  const r = await $.tool.call({ tool: 'Read', file_path: 'C:/proj/src/big.ts' })
  expect(r.result.file.content).toBe(`${content.slice(0, 3000)}\n${footer(1)}`)
  expect(r.context).toEqual([note('Read', content.length, `${DIR}/1.txt`)])
  const again = await $.tool.call({ tool: 'Read', file_path: `${DIR}/1.txt` })
  expect(again.result.file.content).toBe(content)
  expect(again.context).toBeUndefined()
  // a small file passes
  w.toolResult = e => file(e.file_path, 'tiny')
  expect((await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })).result.file.content).toBe('tiny')
})

test('a Read is a file the model asked for: up to 40,000 characters, or scoped by offset or limit, it stays whole', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const file = (path: string, c: string) => ({
    result: { type: 'text', file: { filePath: path, content: c, numLines: 1, startLine: 1, totalLines: 1 } },
    text: c,
  })
  // far past the 8,000 of other tools, and the file is already on disk: cutting it would only cost a second read
  const medium = 'm'.repeat(40_000)
  w.toolResult = e => file(e.file_path, medium)
  const whole = await $.tool.call({ tool: 'Read', file_path: 'C:/proj/notes.md' })
  expect(whole.result.file.content).toBe(medium)
  expect(whole.context).toBeUndefined()
  // one character more is archived
  const big = 'b'.repeat(40_001)
  w.toolResult = e => file(e.file_path, big)
  const cut = await $.tool.call({ tool: 'Read', file_path: 'C:/proj/big.md' })
  expect(cut.result.file.content).toBe(`${big.slice(0, 3000)}\n${footer(1)}`)
  // a read the model scoped itself is never cut, whatever its size
  const part = await $.tool.call({ tool: 'Read', file_path: 'C:/proj/big.md', offset: 100, limit: 2000 })
  expect(part.result.file.content).toBe(big)
  expect(part.context).toBeUndefined()
  expect((await $.tool.call({ tool: 'Read', file_path: 'C:/proj/big.md', limit: 2000 })).result.file.content).toBe(big)
  expect((await archive($)).text).toContain('#1')
  expect((await archive($)).text).not.toContain('#2')
})

test('Grep content, Grep file lists, Glob and WebFetch are archived too', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  // grep with content
  const body = rows(1500, 'hit')
  w.toolResult = () => ({ result: { mode: 'content', numFiles: 0, filenames: [], content: body, numLines: 1500 }, text: body })
  const g = await $.tool.call({ tool: 'Grep', pattern: 'hit' })
  expect(g.result.content).toBe(`${body.slice(0, 3000)}\n${footer(1)}`)
  // grep listing only file names
  const names = Array.from({ length: 1000 }, (_, i) => `C:/proj/src/module-number-${i}.ts`)
  w.toolResult = () => ({ result: { mode: 'files_with_matches', numFiles: names.length, filenames: names }, text: names.join('\n') })
  const gf = await $.tool.call({ tool: 'Grep', pattern: 'x' })
  expect(gf.result.filenames.length).toBeLessThan(names.length)
  expect(gf.result.numFiles).toBe(gf.result.filenames.length)
  expect(gf.result.filenames.join('\n').length).toBeLessThanOrEqual(3100)
  expect(gf.text).toContain(footer(2))
  expect(gf.context[0]).toContain(footer(2))
  // glob
  w.toolResult = () => ({ result: { durationMs: 1, numFiles: names.length, filenames: names, truncated: false }, text: names.join('\n') })
  const gl = await $.tool.call({ tool: 'Glob', pattern: '**/*.ts' })
  expect(gl.result.truncated).toBe(true)
  expect(gl.result.filenames.length).toBeLessThan(names.length)
  expect(gl.result.numFiles).toBe(gl.result.filenames.length)
  expect(gl.text).toContain(footer(3))
  // webfetch
  const page = rows(1200, 'para')
  w.toolResult = () => ({ result: { bytes: page.length, code: 200, codeText: 'OK', result: page, durationMs: 5, url: 'https://x.test' }, text: page })
  const wf = await $.tool.call({ tool: 'WebFetch', url: 'https://x.test', prompt: 'summarise' })
  expect(wf.result.result).toBe(`${page.slice(0, 3000)}\n${footer(4)}`)
  const list = (await archive($)).text
  expect(list).toContain('#1 Grep ·')
  expect(list).toContain('#2 Grep ·')
  expect(list).toContain('#3 Glob ·')
  expect(list).toContain('#4 WebFetch ·')
})

test('grep over the archive directory itself is not archived', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const body = rows(1500, 'hit')
  w.toolResult = () => ({ result: { mode: 'content', numFiles: 0, filenames: [], content: body, numLines: 1500 }, text: body })
  const g = await $.tool.call({ tool: 'Grep', pattern: 'hit', path: 'C:/tmp/toolkitty-archive/abc' })
  expect(g.result.content).toBe(body)
})

test('the savings are credited: tokens kept out of the context', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const full = rows(1500)
  w.toolResult = () => bashResult(full)
  await bash($)
  const short = `${full.slice(0, 3000)}\n${footer(1)}`
  const saved = Math.ceil((full.length - short.length) / 4)
  const sv = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'savings',
    props: { title: 'Savings', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const texts = (await sv.findAll({ type: 'Text' })).map((x: any) => x.text)
  const k = saved >= 10_000 ? `${Math.round(saved / 1000)}k` : `${(saved / 1000).toFixed(1)}k`
  expect(texts).toContain(`≈ ${k} tok · $${(saved * 0.000003).toFixed(2)}`)
  expect(texts).toContain('Output archive')
  await sv.unmount()
})

test('/recall: usage, unknown numbers, paging through the rest, and the end', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const full = 'abcdefghij'.repeat(1000) + 'Z'.repeat(500) // 10_500 chars
  w.toolResult = () => bashResult(full)
  await bash($)
  for (const bad of ['', 'abc', '   ', 'x 1', '-1']) expect((await recall($, bad)).text).toBe('Usage: /recall <n> [term]')
  expect((await recall($, '7')).text).toBe('There is no archived output #7. /archive lists them.')
  // the first 3000 are in the context already: recall pages from there
  expect((await recall($, '1')).text).toBe(full.slice(3000, 6000))
  expect((await recall($, '#1')).text).toBe(full.slice(6000, 9000))
  expect((await recall($, ' 1 ')).text).toBe(full.slice(9000, 10_500))
  expect((await recall($, '1')).text).toBe('That is the end of #1.')
})

test('/recall <n> <term>: matching lines with two lines of context, joined ranges, no match', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const lines = Array.from({ length: 1500 }, (_, i) => `line ${i + 1} filler`)
  lines[100] = 'line 101 the NEEDLE is here'
  lines[900] = 'line 901 another needle'
  const full = lines.join('\n')
  w.toolResult = () => bashResult(full)
  await bash($)
  const out = (await recall($, '1 needle')).text.split('\n')
  expect(out).toEqual([
    '99: line 99 filler',
    '100: line 100 filler',
    '101: line 101 the NEEDLE is here',
    '102: line 102 filler',
    '103: line 103 filler',
    '--',
    '899: line 899 filler',
    '900: line 900 filler',
    '901: line 901 another needle',
    '902: line 902 filler',
    '903: line 903 filler',
  ])
  // a term with spaces
  expect((await recall($, '#1 another needle')).text).toContain('901: line 901 another needle')
  expect((await recall($, '1 absent')).text).toBe('No lines in #1 match "absent".')
  // a search does not move the paging position
  expect((await recall($, '1')).text).toBe(full.slice(3000, 6000))
})

test('/recall caps a very broad search and says it was cut', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const full = rows(2000, 'hit')
  w.toolResult = () => bashResult(full)
  await bash($)
  const text = (await recall($, '1 hit')).text
  expect(text.length).toBeLessThan(8200)
  expect(text.endsWith('…')).toBe(true)
})

test('/recall when the archive file is gone', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult(rows(1500))
  await bash($)
  delete w.files[`${DIR}/1.txt`]
  expect((await recall($, '1')).text).toBe(`Cannot read the archive file ${DIR}/1.txt.`)
  expect((await recall($, '1 row')).text).toBe(`Cannot read the archive file ${DIR}/1.txt.`)
})

test('/archive counts bytes in UTF-8 and shortens the summary line', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const heb = 'שלום עולם '.repeat(1000)
  w.toolResult = () => bashResult(`\n\n   ${'x'.repeat(300)}\n${heb}`)
  await bash($)
  const [head, row1, row2] = (await archive($)).text.split('\n')
  expect(head).toBe('Archived outputs:')
  const bytes = new TextEncoder().encode(`\n\n   ${'x'.repeat(300)}\n${heb}`).length
  expect(row1).toBe(`#1 Bash · ${bytes} B · ${DIR}/1.txt`)
  expect(row2).toBe(`    ${'x'.repeat(119)}…`)
})

test('very large outputs are written cut at 3.9 million characters', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult('q'.repeat(4_000_000))
  await bash($)
  expect(w.files[`${DIR}/1.txt`]?.length).toBe(3_900_000)
})

test('hebrew: the footer, the command answers', SLOW, async ($, on) => {
  const w = boot(on, store({ language: 'he' }))
  await begin($, w)
  expect((await archive($)).text).toBe('עדיין לא הועבר דבר לארכיון.')
  expect((await recall($, 'zz')).text).toBe('שימוש: /recall <מספר> [מונח]')
  expect((await recall($, '3')).text).toBe("אין פלט #3 בארכיון. /archive מציג את הרשימה.")
  w.toolResult = () => bashResult(rows(1500))
  const r = await bash($)
  expect(r.result.stdout).toContain('/recall 1')
  expect(r.result.stdout).not.toContain('archived as')
  expect((await archive($)).text.split('\n')[0]).toBe('פלטים בארכיון:')
  expect((await recall($, '1 nothing-here')).text).toBe('אף שורה ב-#1 לא תואמת ל-"nothing-here".')
})

test('off switch: nothing is archived, commands say it is off', SLOW, async ($, on) => {
  const w = boot(on, store({}, { [ID]: false }))
  await begin($, w)
  const full = rows(1500)
  w.toolResult = () => bashResult(full)
  const r = await bash($)
  expect(r.result.stdout).toBe(full)
  expect(Object.keys(w.files)).toEqual([])
  expect((await recall($, '1')).text).toBe(OFF)
  expect((await archive($)).text).toBe(OFF)
})

test('the archive falls back to the session folder when there is no temp directory', SLOW, async ($, on) => {
  const w = boot(on, store(), T0, { USERPROFILE: 'C:/Users/test' })
  await begin($, w)
  w.toolResult = () => bashResult(rows(1500))
  await bash($)
  expect(Object.keys(w.files)).toEqual([`C:/tmp/project/.claude/toolkitty-archive/${STAMP}/1.txt`])
})
