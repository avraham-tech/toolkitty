import { expect, test } from 'claude-code/testing'

import { begin, boot, noticesOf, paneOf, SLOW, submitPrompt, T0, textsOf } from './world'
import type { World } from './world'

const ID = 'handoff'
const CWD = 'C:/tmp/project'

// Every other feature is switched off so that only the handoff observes the scripted session.
const OTHERS =
  'advisor agent-profiler agents-monitor aurora-backdrop auto-continue auto-format bash-log blast-radius branch-lock break-timer buddy budget-guard cache-countdown claim-check commit-msg context-aquarium context-doctor context-info copy-last correction-capture cost-meter daily-total dangerous-commands decision-ledger diff-review done-notify dup-read-detector edit-undo error-counter error-detective explain-error files-touched focus-mode git-context goal-tracker idle-handoff incidents injection-tripwire lint-after-edit live-ticker long-turn-toast loop-detective merge-gate model-indicator monday-report notes onboarding output-archive output-trimmer pasted-secret-scan pinned-files plan-pace profiles project-config prompt-history prompt-snippets protect-secrets savings scope-guard secret-mask session-finder session-memory sounds standup subagent-guard task-board task-pulse test-on-change themes tldr turn-history turn-receipt turn-summary uncommitted-reminder update-check waiting-alert week-heatmap'.split(
    ' ',
  )
const ON = { enabled: { ...Object.fromEntries(OTHERS.map(x => [x, false])), [ID]: true } }

/* The test `$` has no state noun: the plugin's atoms go through an in-memory state beneath it (as the advisor's test does). */
type Slot = { value: unknown; version: number }
let slots = new Map<string, Slot>()
const slotKey = (e: any): string => `${e.plugin}/${e.key}/${e.id ?? ''}`

function setup(on: any, store: Record<string, unknown> = ON): World {
  slots = new Map()
  const w = boot(on, store)
  on('state.get', (_: any, e: any) => {
    const s = slots.get(slotKey(e))
    return { value: { value: s?.value, version: s?.version ?? 0 } }
  })
  on('state.set', (_: any, e: any) => {
    const prev = slots.get(slotKey(e))
    const version = prev?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false, version } }
    slots.set(slotKey(e), { value: e.value, version: version + 1 })
    return { value: { isSet: true, version: version + 1 } }
  })
  // The kit hands a plugin's own compaction to a hook without a matcher (not to the world's `{ trigger: 'plugin' }` one).
  on('session.compact', (_: any, e: any) => {
    w.compactCalls.push({ trigger: 'plugin', ...e })
    if (w.compactFails) throw new Error('compaction failed')
    return w.compact
  })
  return w
}

const opened = (w: World) => w.opened.filter(x => x.id === ID)

const bump = (key: string, value: unknown) => slots.set(key, { value, version: (slots.get(key)?.version ?? 0) + 1 })
const seedEvidence = (items: Record<string, unknown>[]) => bump('toolkitty/slot/evidence', { items })
const seedSignals = (items: Record<string, unknown>[]) => bump('toolkitty/slot/signals', { items })
const setEnabled = (map: Record<string, boolean>) => bump('toolkitty/enabled/', map)

const ev = (at: number, kind: string, ok: boolean, summary: string, ref: string) => ({ at, kind, ok, summary, ref, feature: 'test' })
const sig = (id: string, kind: string, text: string) => ({ id, feature: id.split(':')[0], kind, level: 'warn', text, at: T0 })

const todoWrite = ($: any, todos: [string, string][], extra: Record<string, unknown> = {}) =>
  $.tool.call({ tool: 'TodoWrite', todos: todos.map(([content, status]) => ({ content, status, activeForm: content })), ...extra })
const edit = ($: any, file_path: string) => $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' })
const write = ($: any, file_path: string) => $.tool.call({ tool: 'Write', file_path, content: 'x' })
const handoff = ($: any) => $.command.run({ command: 'handoff', args: '' })
const mount = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...paneOf(ID), surface })

const TITLES = {
  en: ['Objective', 'Done', 'Decisions', 'Files', 'Known failures', 'Verified results', 'Constraints', 'Next recommended action'],
  he: ['מטרה', 'הושלם', 'החלטות', 'קבצים', 'כשלים ידועים', 'תוצאות מאומתות', 'אילוצים', 'הפעולה המומלצת הבאה'],
}

/** The pane's rows grouped under their section titles. */
async function sections(ui: any, lang: 'en' | 'he' = 'en'): Promise<Record<string, string[]>> {
  const titles = TITLES[lang]
  const out: Record<string, string[]> = {}
  let cur: string | undefined
  for (const x of await textsOf(ui)) {
    if (titles.includes(x)) {
      cur = x
      out[x] = []
    } else if (cur !== undefined) out[cur]!.push(x)
  }
  return out
}

/** A session with prompts, a task list, edits, evidence, signals and stored notes and rules. */
async function scripted($: any, w: World) {
  await begin($, w)
  w.stored[`session-memory:notes:${CWD}`] = [{ at: 1, text: 'Use SQLite, not Postgres' }, { at: 2, text: 'Exports are CSV only' }]
  w.stored[`correction-capture:rules:${CWD}`] = ['Never touch the lockfile']
  await submitPrompt($, 'Build the export feature')
  await submitPrompt($, 'Also keep the API stable')
  await submitPrompt($, '/review')
  await submitPrompt($, 'Third prompt')
  await submitPrompt($, 'Fourth prompt')
  await todoWrite($, [
    ['Write parser', 'completed'],
    ['Add tests', 'in_progress'],
    ['Update docs', 'pending'],
  ])
  await edit($, 'C:/tmp/project/src/a.ts')
  await edit($, 'C:/tmp/project/src/a.ts')
  await write($, 'C:\\tmp\\project\\b.md')
  await write($, 'D:/other/c.ts')
  seedSignals([sig('error-counter:turn', 'failure', '3 tool failures this turn'), sig('loop-detective:edit', 'loop', 'Edit a.ts repeated 3 times'), sig('dup:read', 'waste', 'duplicate reads: 4')])
  seedEvidence([
    ev(1, 'lint', false, 'eslint · 4 errors', 'npm run lint'),
    ev(2, 'lint', true, 'eslint · clean', 'npm run lint'),
    ev(3, 'test', false, 'npm test · 2 failed', 'npm test'),
    ev(4, 'build', true, 'tsc · 0 errors', 'npm run build'),
    ev(5, 'diff', true, 'a.ts · +3 -1', 'a.ts'),
    ev(6, 'git', true, 'git status · clean', 'git status'),
    ev(7, 'typecheck', true, 'tsc --noEmit · ok', 'tsc'),
    ev(8, 'run', true, 'node x.js · exit 0', 'node x.js'),
  ])
}

test('loads: /handoff is registered once, by idle-handoff, even with idle-handoff off', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  expect(w.commands.filter(x => x === 'handoff').length).toBe(1)
  expect(opened(w)).toEqual([])
  expect(w.compactCalls).toEqual([])
})

test('/handoff opens the pane focused and closable with Escape, and says that nothing is compacted yet', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  const out = await handoff($)
  expect(out.text).toBe('The handoff preview is open. Nothing is compacted until you press Compact now.')
  expect(opened(w)).toEqual([{ id: 'handoff', title: 'Handoff', focus: true, closeOnEscape: true }])
  await w.clock.advance(60 * 60_000)
  expect(w.compactCalls).toEqual([])
})

test('the draft is built from the seeded prompts, task list, edits, signals, evidence and store', SLOW, async ($, on) => {
  const w = setup(on)
  await scripted($, w)
  await handoff($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await mount($, surface)
    const s = await sections(ui)
    expect(Object.keys(s)).toEqual(TITLES.en)
    expect(s['Objective']).toEqual([
      'Build the export feature',
      'Then: Also keep the API stable',
      'Then: Third prompt',
      'Remaining: Add tests',
      'Remaining: Update docs',
    ])
    expect(s['Done']).toEqual(['Write parser', 'Files changed: 3'])
    expect(s['Decisions']).toEqual(['Use SQLite, not Postgres', 'Exports are CSV only'])
    expect(s['Files']).toEqual(['src/a.ts', 'b.md', 'D:/other/c.ts'])
    expect(s['Known failures']).toEqual(['3 tool failures this turn', 'Edit a.ts repeated 3 times', 'test: npm test · 2 failed'])
    // newest five of the seven passing records, newest first; the lint that failed and then passed is not a failure
    expect(s['Verified results']).toEqual([
      'run: node x.js · exit 0',
      'typecheck: tsc --noEmit · ok',
      'git: git status · clean',
      'diff: a.ts · +3 -1',
      'build: tsc · 0 errors',
    ])
    expect(s['Constraints']).toEqual(['Never touch the lockfile'])
    expect(s['Next recommended action']).toEqual(['Continue with: Add tests'])
    // header: title, one status word, the warning
    expect((await textsOf(ui)).slice(0, 3)).toEqual(['Handoff', 'draft', 'Compaction keeps only what this draft says; everything else is dropped.'])
    await ui.unmount()
  }
})

test('empty session: every section says none and the next step asks to confirm', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await handoff($)
  const ui = await mount($)
  const s = await sections(ui)
  for (const k of TITLES.en.slice(0, 7)) expect(s[k]).toEqual(['none'])
  expect(s['Next recommended action']).toEqual(['No open item is recorded; confirm the next step first.'])
  await ui.unmount()
})

test('the next step: the first open task, else the last failure', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await todoWrite($, [['A done', 'completed'], ['B waits', 'pending'], ['C runs', 'in_progress']])
  await handoff($)
  let ui = await mount($)
  expect((await sections(ui))['Next recommended action']).toEqual(['Continue with: C runs'])
  await ui.unmount()
  await todoWrite($, [['A done', 'completed'], ['B waits', 'pending']])
  await handoff($)
  ui = await mount($)
  expect((await sections(ui))['Next recommended action']).toEqual(['Continue with: B waits'])
  await ui.unmount()
  await todoWrite($, [['A done', 'completed']])
  seedEvidence([ev(1, 'test', false, 'npm test · 1 failed', 'npm test')])
  await handoff($)
  ui = await mount($)
  const s = await sections(ui)
  expect(s['Next recommended action']).toEqual(['Continue from the last failure: test: npm test · 1 failed'])
  expect(s['Objective']).toEqual(['none'])
  expect(s['Done']).toEqual(['A done', ])
  await ui.unmount()
})

test('prompts: only the first three real ones, cut to 300 characters; commands, meta and plugin prompts are ignored', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await submitPrompt($, '   ')
  await submitPrompt($, '/compact now')
  await submitPrompt($, 'meta text', { isMeta: true })
  await submitPrompt($, 'plugin text', { origin: { kind: 'plugin' } })
  await submitPrompt($, 'x'.repeat(400))
  await submitPrompt($, '  second  ')
  await submitPrompt($, 'third')
  await submitPrompt($, 'fourth')
  await handoff($)
  const ui = await mount($)
  const rows = (await sections(ui))['Objective']!
  expect(rows).toEqual(['x'.repeat(300), 'Then: second', 'Then: third'])
  await ui.unmount()
})

test('a subagent task list, a denied edit and a denied task write change nothing', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await todoWrite($, [['Mine', 'pending']], { agentId: 'sub1' })
  w.toolResult = () => ({ deny: 'blocked' })
  await edit($, 'C:/tmp/project/denied.ts')
  await todoWrite($, [['Denied', 'pending']])
  await handoff($)
  const ui = await mount($)
  const s = await sections(ui)
  expect(s['Objective']).toEqual(['none'])
  expect(s['Files']).toEqual(['none'])
  await ui.unmount()
})

test('long lists are cut: ten rows and "and N more"', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await todoWrite($, Array.from({ length: 13 }, (_, i) => [`task ${i + 1}`, 'pending'] as [string, string]))
  for (let i = 0; i < 12; i++) await edit($, `C:/tmp/project/f${i}.ts`)
  await handoff($)
  const ui = await mount($)
  const s = await sections(ui)
  expect(s['Objective']!.length).toBe(11)
  expect(s['Objective']![0]).toBe('Remaining: task 1')
  expect(s['Objective']![10]).toBe('... and 3 more')
  expect(s['Files']!.length).toBe(11)
  expect(s['Files']![10]).toBe('... and 2 more')
  await ui.unmount()
})

test('the four buttons, in order, with the hotkeys and the primary one', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await handoff($)
  const ui = await mount($)
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map((b: any) => b.key)).toEqual(['handoff-compact', 'handoff-copy', 'handoff-refresh', 'handoff-cancel'])
  expect(buttons.map((b: any) => b.props.label)).toEqual(['Compact now', 'Copy', 'Refresh', 'Cancel'])
  expect(buttons.map((b: any) => b.props.hotkey)).toEqual(['1', '2', '3', '4'])
  expect(buttons[0].props.variant).toBe('primary')
  await ui.unmount()
})

test('Cancel closes the pane and compacts nothing', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await handoff($)
  const ui = await mount($)
  await ui.press({ key: 'handoff-cancel' })
  expect(w.closed.filter(x => x === ID)).toEqual([ID])
  await w.clock.advance(60_000)
  expect(w.compactCalls).toEqual([])
  await ui.unmount()
})

test('Refresh rebuilds the draft; until then the pane keeps the saved one', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await todoWrite($, [['First', 'pending']])
  await handoff($)
  const ui = await mount($)
  expect((await sections(ui))['Objective']).toEqual(['Remaining: First'])
  await todoWrite($, [['First', 'completed'], ['Second', 'pending']])
  await ui.redraw()
  expect((await sections(ui))['Objective']).toEqual(['Remaining: First'])
  await ui.press({ key: 'handoff-refresh' })
  await ui.redraw()
  const s = await sections(ui)
  expect(s['Objective']).toEqual(['Remaining: Second'])
  expect(s['Done']).toEqual(['First'])
  expect(w.closed).toEqual([])
  await ui.unmount()
})

test('the notes Input: typed text is kept, copied and sent to the compaction, line by line', SLOW, async ($, on) => {
  const w = setup(on)
  await scripted($, w)
  await handoff($)
  const ui = await mount($)
  const input = await ui.find({ key: 'handoff-notes' })
  expect(input.props.label).toBe('Extra notes')
  expect(input.props.placeholder).toBe('Anything else the next context must know')
  expect(input.props.value).toBe('')
  await ui.input({ key: 'handoff-notes', text: 'Staging URL is in .env.example\n  Ask before deploying ', kind: 'change' })
  await ui.redraw()
  expect((await ui.find({ key: 'handoff-notes' })).props.value).toBe('Staging URL is in .env.example\n  Ask before deploying ')
  // the notes are not rows of the draft above the field
  expect(Object.keys(await sections(ui))).toEqual(TITLES.en)
  await ui.press({ key: 'handoff-copy' })
  const copied = w.copied[0].text as string
  expect(copied.endsWith('## Extra notes\n- Staging URL is in .env.example\n- Ask before deploying')).toBe(true)
  await ui.press({ key: 'handoff-compact' })
  await w.clock.advance(100)
  expect((w.compactCalls[0].instructions as string).endsWith(copied)).toBe(true)
  await ui.unmount()
})

test('Enter in the notes field keeps the notes too, and they survive a refresh', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await handoff($)
  const ui = await mount($, 'terminal')
  await ui.input({ key: 'handoff-notes', text: 'Final note' })
  await ui.redraw()
  expect((await ui.find({ key: 'handoff-notes' })).props.value).toBe('Final note')
  await ui.press({ key: 'handoff-refresh' })
  await ui.redraw()
  expect((await ui.find({ key: 'handoff-notes' })).props.value).toBe('Final note')
  await ui.press({ key: 'handoff-copy' })
  expect((w.copied[0].text as string).endsWith('## Extra notes\n- Final note')).toBe(true)
  await ui.unmount()
})

test('Copy puts the English draft text on the clipboard of the surface and says so', SLOW, async ($, on) => {
  const w = setup(on)
  await scripted($, w)
  await handoff($)
  const ui = await mount($, 'terminal')
  await ui.press({ key: 'handoff-copy' })
  expect(w.copied.length).toBe(1)
  expect(w.copied[0].surface).toBe('terminal')
  expect(w.copied[0].text).toBe(
    [
      '# Handoff',
      '',
      '## Objective',
      '- Build the export feature',
      '- Then: Also keep the API stable',
      '- Then: Third prompt',
      '- Remaining: Add tests',
      '- Remaining: Update docs',
      '',
      '## Done',
      '- Write parser',
      '- Files changed: 3',
      '',
      '## Decisions',
      '- Use SQLite, not Postgres',
      '- Exports are CSV only',
      '',
      '## Files',
      '- src/a.ts',
      '- b.md',
      '- D:/other/c.ts',
      '',
      '## Known failures',
      '- 3 tool failures this turn',
      '- Edit a.ts repeated 3 times',
      '- test: npm test · 2 failed',
      '',
      '## Verified results',
      '- run: node x.js · exit 0',
      '- typecheck: tsc --noEmit · ok',
      '- git: git status · clean',
      '- diff: a.ts · +3 -1',
      '- build: tsc · 0 errors',
      '',
      '## Constraints',
      '- Never touch the lockfile',
      '',
      '## Next recommended action',
      '- Continue with: Add tests',
    ].join('\n'),
  )
  expect(await noticesOf($, ID)).toEqual(['Handoff draft copied.'])
  expect(w.closed).toEqual([])
  w.copyOk = false
  await ui.press({ key: 'handoff-copy' })
  expect((await noticesOf($, ID)).slice(-1)).toEqual(['Could not copy the handoff draft.'])
  await ui.unmount()
})

test('Compact now: nothing before the press; after it a timer compacts with the draft, tells the person once, closes the pane', SLOW, async ($, on) => {
  const w = setup(on)
  await scripted($, w)
  await handoff($)
  const ui = await mount($)
  await w.clock.advance(10 * 60_000)
  expect(w.compactCalls).toEqual([])
  await ui.press({ key: 'handoff-compact' })
  // answered at once: the compaction is attempted from the timer, not inside the press
  expect(w.compactCalls).toEqual([])
  expect(w.closed).toEqual([])
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: 'compacting' })).text).toBe('compacting')
  await w.clock.advance(100)
  expect(w.compactCalls.length).toBe(1)
  const text = w.compactCalls[0].instructions as string
  expect(w.compactCalls[0].trigger).toBe('plugin')
  expect(text.startsWith('Compact the conversation so that it keeps the handoff below')).toBe(true)
  expect(text).toContain('# Handoff\n\n## Objective\n- Build the export feature\n- Then: Also keep the API stable')
  expect(text).toContain('## Known failures\n- 3 tool failures this turn\n- Edit a.ts repeated 3 times\n- test: npm test · 2 failed')
  expect(text).toContain('## Constraints\n- Never touch the lockfile')
  expect(text.endsWith('## Next recommended action\n- Continue with: Add tests')).toBe(true)
  expect(await noticesOf($, ID)).toEqual(['Session compacted. Context: 90,000 -> 12,000 tokens.'])
  expect(w.closed.filter(x => x === ID)).toEqual([ID])
  expect(w.toasts).toEqual([])
  await w.clock.advance(10 * 60_000)
  expect(w.compactCalls.length).toBe(1)
  await ui.unmount()
})

test('a second press while compacting does nothing; the draft sent is the saved one', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await todoWrite($, [['Saved task', 'pending']])
  await handoff($)
  await todoWrite($, [['Newer task', 'pending']])
  const ui = await mount($)
  await ui.press({ key: 'handoff-compact' })
  await ui.press({ key: 'handoff-compact' })
  await w.clock.advance(100)
  expect(w.compactCalls.length).toBe(1)
  expect(w.compactCalls[0].instructions).toContain('Remaining: Saved task')
  expect(w.compactCalls[0].instructions).not.toContain('Newer task')
  await ui.unmount()
})

test('the other compaction answers: skipped, no counts, and a failure that keeps the pane open for a retry', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await handoff($)
  const ui = await mount($)
  w.compact = { skip: 'The conversation is too short' }
  await ui.press({ key: 'handoff-compact' })
  await w.clock.advance(100)
  expect((await noticesOf($, ID)).slice(-1)).toEqual(['Nothing was compacted: The conversation is too short'])
  expect(w.closed.filter(x => x === ID)).toEqual([ID])
  w.compact = { messages: [{ role: 'assistant', text: 's', toolUses: [] }] }
  await ui.press({ key: 'handoff-compact' })
  await w.clock.advance(100)
  expect((await noticesOf($, ID)).slice(-1)).toEqual(['Session compacted with the handoff draft.'])
  expect(w.closed.filter(x => x === ID)).toEqual([ID, ID])
  w.compactFails = true
  await ui.press({ key: 'handoff-compact' })
  await w.clock.advance(100)
  expect((await noticesOf($, ID)).slice(-1)).toEqual(['Compaction failed. Try again, or use the built-in /compact.'])
  expect(w.toasts).toContain('Compaction failed. Try again, or use the built-in /compact.')
  expect(w.closed.filter(x => x === ID).length).toBe(2)
  // and the button works again
  w.compactFails = false
  w.compact = { messages: [{ role: 'assistant', text: 's', toolUses: [] }], tokensBefore: 5, tokensAfter: 1 }
  await ui.press({ key: 'handoff-compact' })
  await w.clock.advance(100)
  expect(w.compactCalls.length).toBe(4)
  expect((await noticesOf($, ID)).slice(-1)).toEqual(['Session compacted. Context: 5 -> 1 tokens.'])
  await ui.unmount()
})

test('switching the feature off before the timer fires cancels the compaction', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  await handoff($)
  const ui = await mount($)
  await ui.press({ key: 'handoff-compact' })
  setEnabled({ ...ON.enabled, [ID]: false })
  await w.clock.advance(100)
  expect(w.compactCalls).toEqual([])
  expect(w.closed).toEqual([])
  await ui.unmount()
})

test('off switch: the command answers off, nothing is collected, the pane says it is off', SLOW, async ($, on) => {
  const w = setup(on, { enabled: { ...ON.enabled, [ID]: false } })
  await begin($, w)
  await submitPrompt($, 'Ignored while off')
  await todoWrite($, [['Ignored', 'pending']])
  await edit($, 'C:/tmp/project/x.ts')
  expect((await handoff($)).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(opened(w)).toEqual([])
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'The handoff preview is off.' })).text).toBeTruthy()
  expect(await ui.findAll({ type: 'Button' })).toEqual([])
  await ui.unmount()
  // switched on again, nothing of what happened while off is in the draft
  setEnabled({ ...ON.enabled, [ID]: true })
  await handoff($)
  const on2 = await mount($)
  const s = await sections(on2)
  expect(s['Objective']).toEqual(['none'])
  expect(s['Files']).toEqual(['none'])
  await on2.unmount()
})

test('a new session starts with an empty draft', SLOW, async ($, on) => {
  const w = setup(on)
  await scripted($, w)
  await begin($, w)
  await handoff($)
  const ui = await mount($)
  const s = await sections(ui)
  expect(s['Objective']).toEqual(['none'])
  expect(s['Files']).toEqual(['none'])
  await ui.unmount()
})

test('the pane before any /handoff shows an empty state and no notes field', SLOW, async ($, on) => {
  const w = setup(on)
  await begin($, w)
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'No handoff draft yet.' })).text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: 'Run /handoff to build one from this session.' })).text).toBeTruthy()
  expect(await ui.find({ key: 'handoff-notes' })).toBeUndefined()
  await ui.unmount()
})

test('hebrew: the command answer, the pane, the notices; the text sent to the model stays English', SLOW, async ($, on) => {
  const w = setup(on, { ...ON, language: 'he' })
  await scripted($, w)
  expect((await handoff($)).text).toBe('התצוגה המקדימה להעברה נפתחה. שום דבר לא נדחס עד שתלחץ על דחוס עכשיו.')
  expect(opened(w)[0]!.title).toBe('העברה')
  const ui = await mount($)
  const s = await sections(ui, 'he')
  expect(Object.keys(s)).toEqual(TITLES.he)
  expect(s['מטרה']).toEqual(['Build the export feature', 'אחר כך: Also keep the API stable', 'אחר כך: Third prompt', 'נותר: Add tests', 'נותר: Update docs'])
  expect(s['הושלם']).toEqual(['Write parser', 'קבצים ששונו: 3'])
  expect(s['הפעולה המומלצת הבאה']).toEqual(['המשך עם: Add tests'])
  const all = (await textsOf(ui)).join('\n')
  expect(all).toContain('טיוטה')
  expect(all).toContain('הדחיסה שומרת רק את מה שהטיוטה הזו אומרת; כל השאר נזרק.')
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.props.label)).toEqual(['דחוס עכשיו', 'העתק', 'רענן', 'ביטול'])
  expect((await ui.find({ key: 'handoff-notes' })).props.label).toBe('הערות נוספות')
  await ui.press({ key: 'handoff-copy' })
  expect(w.copied[0].text).toContain('## Objective\n- Build the export feature\n- Then: Also keep the API stable')
  expect(w.copied[0].text).not.toMatch(/[א-ת]/)
  expect((await noticesOf($, ID)).slice(-1)).toEqual(['טיוטת ההעברה הועתקה.'])
  await ui.press({ key: 'handoff-compact' })
  await w.clock.advance(100)
  expect(w.compactCalls[0].instructions).toContain('## Known failures\n- 3 tool failures this turn')
  expect(w.compactCalls[0].instructions).not.toMatch(/[א-ת]/)
  expect((await noticesOf($, ID)).slice(-1)).toEqual(['הסשן נדחס. הקשר: 90,000 -> 12,000 טוקנים.'])
  await ui.unmount()
})
