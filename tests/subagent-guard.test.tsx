import { expect, test } from 'claude-code/testing'

import { allText, bandLine, BAND, begin, boot, openBand, openDetail, SLOW } from './world'

const ID = 'subagent-guard'
const cmd = ($: any, args: string) => $.command.run({ command: 'agent-cap', args })
const spawn = ($: any, description = 'look around') => $.tool.call({ tool: 'Agent', description, prompt: 'do it', subagent_type: 'Explore' })
const agent = (id: string, status: string, type = 'Explore') => ({ id, description: 'd', type, status })
const sub = async ($: any, turnId: string, tokens: { input_tokens: number; output_tokens: number } | undefined, agentId = 'a1') => {
  await $.turn.start({ text: 'sub', turnId, agentId })
  await $.turn.complete({
    answer: 'x',
    durationMs: 5,
    isAborted: false,
    turnId,
    reason: 'answer',
    agentId,
    ...(tokens === undefined ? {} : { usage: { ...tokens, model: 'claude-haiku-5-5' } }),
  })
}
const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const CAPS_DEFAULT = 'Subagent caps: 4 at once, 25 per session, 3,000,000 tokens. Change with /agent-cap concurrent|session|tokens <n>.'
const USAGE = 'Usage: /agent-cap concurrent|session|tokens <n> (a positive whole number; k and m suffixes work).'

test('loads and registers /agent-cap; no band before any spawn', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  expect(w.commands).toContain('agent-cap')
  expect(await bandLine($, ID)).toBeUndefined()
  expect(w.toasts).toEqual([])
})

test('/agent-cap shows the defaults and sets each cap, with suffixes and bad forms', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  expect((await cmd($, '')).text).toBe(CAPS_DEFAULT)
  expect((await cmd($, 'concurrent 2')).text).toBe('Cap set: concurrent = 2.')
  expect((await cmd($, 'SESSION 10')).text).toBe('Cap set: session = 10.')
  expect((await cmd($, 'tokens 500k')).text).toBe('Cap set: tokens = 500,000.')
  expect((await cmd($, '')).text).toBe('Subagent caps: 2 at once, 10 per session, 500,000 tokens. Change with /agent-cap concurrent|session|tokens <n>.')
  expect((await cmd($, 'tokens 3M')).text).toBe('Cap set: tokens = 3,000,000.')
  expect((await cmd($, 'tokens 1.5k')).text).toBe('Cap set: tokens = 1,500.')
  for (const bad of ['concurrent', 'concurrent 0', 'concurrent -1', 'concurrent abc', 'concurrent 2x', 'bogus 3', '5', 'concurrent 0.2']) {
    expect((await cmd($, bad)).text).toBe(USAGE)
  }
  // the bad forms changed nothing
  expect((await cmd($, '')).text).toBe('Subagent caps: 2 at once, 10 per session, 1,500 tokens. Change with /agent-cap concurrent|session|tokens <n>.')
  expect(w.toasts).toEqual([])
})

test('caps are kept in the store across sessions; corrupt stored values fall back to the defaults', SLOW, async ($, on) => {
  const w = boot(on, { 'subagent-guard:caps': { concurrent: 7, session: 'many', tokens: -5 } })
  await begin($, w)
  expect((await cmd($, '')).text).toBe('Subagent caps: 7 at once, 25 per session, 3,000,000 tokens. Change with /agent-cap concurrent|session|tokens <n>.')
})

test('a spawn under the caps passes to the tool and is counted; other tools are untouched', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  const ran = await spawn($)
  expect(ran.deny).toBeUndefined()
  expect(ran.result).toEqual({})
  const bash = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(bash.deny).toBeUndefined()
  expect(await bandLine($, ID)).toBe('agents 0 running · 1 spawned · 0 tok')
  expect(await bandLine($, ID, 'terminal')).toBe('agents 0 running · 1 spawned · 0 tok')
})

test('the concurrent cap denies with the numbers; finished agents do not count', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'concurrent 2')
  w.agents = [agent('a1', 'running'), agent('a2', 'completed'), agent('a3', 'failed'), agent('a4', 'killed'), agent('a5', 'waiting')]
  // two live (running, waiting): at the cap
  const denied = await spawn($)
  expect(denied.deny).toBe(
    'Toolkitty · Subagent guard: 2 subagents are already running (cap 2). Wait for one to finish, or raise the cap with /agent-cap concurrent <n>.',
  )
  // one finishes: a spawn passes
  w.agents = [agent('a1', 'completed'), agent('a5', 'idle')]
  expect((await spawn($)).deny).toBeUndefined()
  // pending and idle count as live
  w.agents = [agent('a1', 'pending'), agent('a5', 'idle')]
  expect((await spawn($)).deny).toMatch(/2 subagents are already running/)
  expect(await bandLine($, ID)).toBe('agents 2 running · 1 spawned · 0 tok · 2 denied')
})

test('the band marks denials in the warning colour', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'concurrent 1')
  w.agents = [agent('a1', 'running')]
  await spawn($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // compact band: the chip carries the warning colour
  const chip = await ui.find({ key: 'chip-subagent-guard' })
  expect(chip).toBeDefined()
  const chipText = (await ui.findAll({ type: 'Text' })).find((x: any) => x.text === '◐ 1 agents · 1 denied')
  expect(chipText).toBeDefined()
  expect(chipText.props['color']).toBe('warning')
  // expanded: the full line marks only the denials in the warning colour
  await openBand(ui)
  const line = await ui.find({ key: 'band-subagent-guard' })
  const warn = (await line.findAll?.({ type: 'Text' }) ?? (await ui.findAll({ type: 'Text' }))).filter((x: any) => x.props['color'] === 'warning' && x.text !== chipText.text)
  expect(warn.map((x: any) => x.text)).toEqual([' · 1 denied'])
  await ui.unmount()
})

test('the session cap denies the spawn after N were let through', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'session 3')
  for (let i = 0; i < 3; i++) expect((await spawn($)).deny).toBeUndefined()
  const denied = await spawn($)
  expect(denied.deny).toBe('Toolkitty · Subagent guard: this session already spawned 3 subagents (cap 3). Raise the cap with /agent-cap session <n>.')
  // raising it lets the next through
  await cmd($, 'session 4')
  expect((await spawn($)).deny).toBeUndefined()
  expect(await bandLine($, ID)).toBe('agents 0 running · 4 spawned · 0 tok · 1 denied')
})

test('the token cap: subagent turns add up, and the spawn is denied once the total is over the cap', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'tokens 1000')
  await sub($, 's1', { input_tokens: 600, output_tokens: 200 })
  // 800 of 1000: still fine
  expect((await spawn($)).deny).toBeUndefined()
  await sub($, 's2', { input_tokens: 200, output_tokens: 0 })
  // exactly at the cap is not over it
  expect((await spawn($)).deny).toBeUndefined()
  await sub($, 's3', { input_tokens: 1, output_tokens: 1 })
  const denied = await spawn($)
  expect(denied.deny).toBe('Toolkitty · Subagent guard: subagents have used 1,002 tokens this session (cap 1,000). Raise the cap with /agent-cap tokens <n>.')
  expect(await bandLine($, ID)).toBe('agents 0 running · 2 spawned · 1.0k tok · 1 denied')
})

test('tokens take priority over the session cap, which takes priority over the concurrent cap', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'tokens 10')
  await cmd($, 'session 1')
  await cmd($, 'concurrent 1')
  await spawn($)
  w.agents = [agent('a1', 'running')]
  expect((await spawn($)).deny).toMatch(/already spawned 1 subagents/)
  await sub($, 's1', { input_tokens: 50, output_tokens: 0 })
  expect((await spawn($)).deny).toMatch(/have used 50 tokens/)
})

test('main-loop turns and a missing usage add no tokens', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await $.turn.start({ text: 'main', turnId: 'm1' })
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer', usage: { input_tokens: 9_999_999, output_tokens: 1, model: 'm' } })
  await sub($, 's1', undefined)
  await spawn($)
  expect(await bandLine($, ID)).toBe('agents 0 running · 1 spawned · 0 tok')
})

test('a parallel batch counts itself: only as many start as the concurrent cap allows', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'concurrent 2')
  // each agent call stays inside the tool for a second of mocked time
  w.toolResult = () => w.clock.sleep(1000).then(() => ({ result: {} }))
  const calls = [spawn($, 'one'), spawn($, 'two'), spawn($, 'three')]
  await w.clock.settle()
  await w.clock.advance(1500)
  const results = await Promise.all(calls)
  expect(results.filter((r: any) => r.deny === undefined).length).toBe(2)
  const denied = results.filter((r: any) => r.deny !== undefined)
  expect(denied.length).toBe(1)
  expect(denied[0].deny).toMatch(/2 subagents are already running \(cap 2\)/)
  // and the batch is over: a new spawn is fine again
  expect((await Promise.all([spawn($, 'four'), w.clock.advance(1500)]))[0].deny).toBeUndefined()
})

test('the running count follows the roster at subagent turn start and end', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await spawn($)
  w.agents = [agent('a1', 'running'), agent('a2', 'running')]
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  expect(await bandLine($, ID)).toBe('agents 2 running · 1 spawned · 0 tok')
  w.agents = [agent('a1', 'running'), agent('a2', 'completed')]
  await sub($, 's2', { input_tokens: 10, output_tokens: 5 }, 'a2')
  expect(await bandLine($, ID)).toBe('agents 1 running · 1 spawned · 15 tok')
  // a main turn start does not read the roster
  w.agents = []
  await $.turn.start({ text: 'main', turnId: 'm1' })
  expect(await bandLine($, ID)).toBe('agents 1 running · 1 spawned · 15 tok')
})

test('token counts are shortened to k and M in the band', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await spawn($)
  await sub($, 's1', { input_tokens: 1_499, output_tokens: 0 })
  expect(await bandLine($, ID)).toBe('agents 0 running · 1 spawned · 1.5k tok')
  await sub($, 's2', { input_tokens: 2_000_000, output_tokens: 0 })
  expect(await bandLine($, ID)).toBe('agents 0 running · 1 spawned · 2.0M tok')
})

test('a new session starts the count from zero', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await spawn($)
  expect(await bandLine($, ID)).toBeDefined()
  await begin($, w)
  expect(await bandLine($, ID)).toBeUndefined()
})

test('the detail pane lists denials newest first, the caps and the running agents', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'concurrent 1')
  w.agents = [agent('abcdefghijkl', 'running', 'general-purpose')]
  await spawn($)
  await w.clock.advance(65_000)
  await cmd($, 'concurrent 9')
  await cmd($, 'session 1')
  expect((await spawn($)).deny).toBeUndefined()
  expect((await spawn($)).deny).toBeDefined()
  const ui = await openDetail($, ID)
  const text = await allText(ui)
  const lines = text.split('\n')
  const first = lines.findIndex(l => /1:05 ago/.test(l))
  const second = lines.findIndex(l => /^0:00 ago/.test(l))
  expect(lines).toContain('Denied subagent spawns (newest first)')
  expect(lines).toContain('0:00 ago · session cap · 1 spawned, cap 1')
  expect(lines).toContain('1:05 ago · concurrent cap · 1 running, cap 1')
  expect(second).toBeLessThan(first)
  expect(lines).toContain('Running now')
  expect(lines).toContain('abcdefgh · general-purpose · running')
  expect(text).toContain('Subagent caps: 9 at once, 1 per session, 3,000,000 tokens.')
  await ui.unmount()
})

test('the detail pane says nothing was denied and no subagents run', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await spawn($)
  const ui = await openDetail($, ID)
  const text = await allText(ui)
  expect(text).toContain('Nothing was denied this session.')
  expect(text).toContain('No subagents are running.')
  await ui.unmount()
})

test('the detail pane keeps the newest 6 denials', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'session 1')
  await spawn($)
  for (let i = 0; i < 8; i++) await spawn($)
  const ui = await openDetail($, ID)
  const rows = (await allText(ui)).split('\n').filter(l => /session cap/.test(l))
  expect(rows.length).toBe(6)
  await ui.unmount()
})

test('hebrew: command, deny text, band and detail', SLOW, async ($, on) => {
  const w = boot(on, { language: 'he' })
  await begin($, w)
  expect((await cmd($, '')).text).toBe('מגבלות סוכני משנה: 4 במקביל, 25 לסשן, 3,000,000 טוקנים. לשינוי: /agent-cap concurrent|session|tokens <n>.')
  expect((await cmd($, 'concurrent 1')).text).toBe('המגבלה נקבעה: concurrent = 1.')
  expect((await cmd($, 'x')).text).toBe('שימוש: /agent-cap concurrent|session|tokens <n> (מספר שלם חיובי; אפשר להוסיף k או m).')
  w.agents = [agent('a1', 'running')]
  const denied = await spawn($)
  expect(denied.deny).toBe(
    'Toolkitty · שומר סוכני משנה: 1 סוכני משנה כבר רצים (מגבלה 1). המתן שאחד יסתיים, או הגדל את המגבלה עם /agent-cap concurrent <n>.',
  )
  expect(await bandLine($, ID)).toBe('סוכנים: 1 רצים · 0 הופעלו · 0 טוק׳ · 1 נחסמו')
  const ui = await openDetail($, ID)
  const text = await allText(ui)
  expect(text).toContain('הפעלות סוכני משנה שנחסמו (החדשות ראשונות)')
  expect(text).toContain('לפני 0:00 · מגבלת מקביליות · 1 רצים, מגבלה 1')
  expect(text).toContain('רצים עכשיו')
  await ui.unmount()
})

test('off switch: spawns pass uncounted, no band, the command says it is off', SLOW, async ($, on) => {
  const w = boot(on, { enabled: { [ID]: false, 'loop-detective': false } })
  await begin($, w)
  expect((await cmd($, '')).text).toBe(OFF)
  expect((await cmd($, 'concurrent 1')).text).toBe(OFF)
  w.agents = [agent('a1', 'running'), agent('a2', 'running'), agent('a3', 'running'), agent('a4', 'running'), agent('a5', 'running')]
  for (let i = 0; i < 30; i++) expect((await spawn($)).deny).toBeUndefined()
  await sub($, 's1', { input_tokens: 99_999_999, output_tokens: 0 })
  expect(await bandLine($, ID)).toBeUndefined()
  expect(w.toasts).toEqual([])
})

test('turning the feature off from its detail pane lets spawns through again', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'session 1')
  await spawn($)
  expect((await spawn($)).deny).toBeDefined()
  const ui = await openDetail($, ID)
  await ui.press({ key: 'detail-toggle' })
  expect((await spawn($)).deny).toBeUndefined()
  await ui.press({ key: 'detail-toggle' })
  expect((await spawn($)).deny).toBeDefined()
  await ui.unmount()
})

test('the caps are written to the store one at a time, keeping the others', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, 'concurrent 2')
  expect(w.stored['subagent-guard:caps']).toEqual({ concurrent: 2, session: 25, tokens: 3_000_000 })
  await cmd($, 'tokens 2m')
  expect(w.stored['subagent-guard:caps']).toEqual({ concurrent: 2, session: 25, tokens: 2_000_000 })
  await cmd($, 'session 0')
  expect(w.stored['subagent-guard:caps']).toEqual({ concurrent: 2, session: 25, tokens: 2_000_000 })
})
