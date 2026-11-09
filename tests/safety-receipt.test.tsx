import { expect, test } from 'claude-code/testing'
import { BAND, NOON, PANE, joined, noticeTexts, start, svgOf, texts, turnDone, turnStart } from './harness'
import { only, put, setup, slotValue, slots } from './zkit'

const ID = 'safety-receipt'
const ON = [ID]
const pane = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('safety-receipt'), surface })
const SECRET_PATH = 'C:/Users/someone/.ssh/id_rsa-SECRET-VALUE-9f8e7d'

/** An incident signal as the incidents feature publishes it, then one finished turn. */
async function incident($: any, kind: string, count = 1, at = NOON): Promise<void> {
  put('incidents:last', 'incident', { feature: 'seed', level: 'alert', value: count, text: kind, at, ttlMs: 15000 })
  await turnStart($)
  await turnDone($)
}

const opens = (w: any): number => w.opened.filter((o: any) => o.id === 'safety-receipt').length

test('it is on by default and registers /safety-receipt; with no receipt the command says so and opens nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  expect(w.cmds).toContain('safety-receipt')
  expect((await $.command.run({ command: 'safety-receipt', args: '' })).text).toBe('No safety receipt yet.')
  expect(w.opened.map(o => o.id)).not.toContain('safety-receipt')
  const ui = await pane($)
  const text = await joined(ui)
  expect(text).toContain('No safety receipt yet.')
  expect(text).toContain('One appears when a guard blocks or redacts something.')
  await ui.unmount()
})

test('the feature is on without being listed in the stored map', { timeoutMs: 30_000 }, async ($, on) => {
  const others = Object.fromEntries(Object.entries(only()).filter(([id]) => id !== ID))
  const w = setup(on, [], { store: { enabled: others } })
  await start($)
  await incident($, 'dangerous-command')
  expect(opens(w)).toBe(1)
})

test('an incident signal opens the receipt pane, not focused', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await incident($, 'dangerous-command')
  expect(opens(w)).toBe(1)
  const o = w.opened.find(x => x.id === 'safety-receipt')
  expect(o?.title).toBe('Safety receipt')
  expect(o?.focus).toBeUndefined()
})

test('terminal: a bordered 38-column box with the operation, the careful risk wording, the action and the result', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await incident($, 'dangerous-command')
  const ui = await pane($, 'terminal')
  const lines = await texts(ui)
  expect(lines).toContain('TOOLKITTY SAFETY RECEIPT')
  expect(lines).toContain('OPERATION')
  expect(lines).toContain('Dangerous shell command')
  expect(lines).toContain('RISK')
  expect(lines).toContain('potentially dangerous')
  expect(lines).toContain('ACTION')
  expect(lines).toContain('blocked')
  expect(lines).toContain('RESULT')
  expect(lines).toContain('your review required')
  expect(lines.some(x => /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(x))).toBe(true)
  const text = lines.join('\n')
  expect(text).not.toMatch(/prevented|damage|saved/i)
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.some((b: any) => b.props.borderStyle === 'single' && b.props.width === 38)).toBe(true)
  expect(w.toasts.filter(x => /safety|receipt/i.test(x))).toEqual([])
  await ui.unmount()
})

test('desktop: the receipt is an Svg with the same words and an alt text', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await incident($, 'secret-file')
  const ui = await pane($)
  const svg = await svgOf(ui)
  expect(svg.source.startsWith('<svg')).toBe(true)
  expect(svg.source.length).toBeLessThan(128 * 1024)
  expect(svg.source).toContain('TOOLKITTY SAFETY RECEIPT')
  expect(svg.source).toContain('Read of a secrets file')
  expect(svg.source).toContain('potentially dangerous')
  expect(svg.source).toContain('blocked')
  expect(svg.source).toContain('your review required')
  expect(svg.source).not.toMatch(/prevented|damage/i)
  expect(svg.alt).toBe('Safety receipt: Read of a secrets file, potentially dangerous, blocked, your review required')
  await ui.unmount()
})

for (const [kind, text] of [
  ['secret-file', 'Read of a secrets file'],
  ['pasted-secret', 'Secret pasted into a prompt'],
  ['commit-secret', 'Secret in a commit'],
  ['dangerous-command', 'Dangerous shell command'],
  ['blast-radius', 'Large recursive delete'],
  ['scope', 'Edit outside the allowed scope'],
  ['branch-lock', 'Edit on a locked branch'],
  ['ci-red', 'Merge while CI is failing'],
  ['injection', 'Suspected prompt injection'],
  ['something-new', 'Guarded action'],
] as const) {
  test(`kind ${kind} reads "${text}"`, { timeoutMs: 30_000 }, async ($, on) => {
    setup(on, ON)
    await start($)
    await incident($, kind)
    const ui = await pane($, 'terminal')
    expect(await texts(ui)).toContain(text)
    await ui.unmount()
  })
}

test('a pasted secret is "redacted", every other kind is "blocked"', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await incident($, 'pasted-secret')
  let ui = await pane($, 'terminal')
  let lines = await texts(ui)
  expect(lines).toContain('redacted')
  expect(lines).not.toContain('blocked')
  await ui.unmount()

  await incident($, 'commit-secret', 2, NOON + 1)
  ui = await pane($, 'terminal')
  lines = await texts(ui)
  expect(lines).toContain('blocked')
  expect(lines).not.toContain('redacted')
  await ui.unmount()
})

test('the header buttons: Details, Share redacted, Dismiss; the export bar adds Save (SVG on the desktop, text on the terminal)', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await incident($, 'dangerous-command')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await pane($, surface)
    const labels = (await ui.findAll({ type: 'Button' })).map((b: any) => b.props.label)
    expect(labels).toEqual(['Details', 'Share redacted', 'Dismiss', surface === 'desktop' ? 'Save SVG' : 'Save text', 'Print', 'Open folder', 'Copy path'])
    expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['safety-receipt-details', 'safety-receipt-share', 'safety-receipt-dismiss', 'exp-save-safety-receipt', 'exp-print-safety-receipt', 'exp-open-safety-receipt', 'exp-path-safety-receipt'])
    await ui.unmount()
  }
})

test('Details opens the incidents pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await incident($, 'dangerous-command')
  const ui = await pane($)
  await ui.press({ key: 'safety-receipt-details' })
  expect(w.opened.map(o => o.id)).toContain('incidents')
  expect(w.opened.find(o => o.id === 'incidents')?.title).toBe('Disasters prevented')
  await ui.unmount()
})

test('Share redacted copies the kind only: no path, no value, no command', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  // the incident log holds a detail with a path and a value; the share text must never reach for it
  slots.set('toolkitty/slot/incidents', { value: { count: 1, items: [{ at: NOON, feature: 'protect-secrets', kind: 'secret-file', detail: SECRET_PATH }], lastAt: NOON }, version: 1 })
  put('incidents:last', 'incident', { feature: 'seed', level: 'alert', value: 1, text: 'secret-file', at: NOON, ttlMs: 15000 })
  await turnStart($)
  await turnDone($)
  const ui = await pane($)
  await ui.press({ key: 'safety-receipt-share' })
  expect(w.copies.length).toBe(1)
  expect(w.copies[0]?.text).toBe('Toolkitty safety receipt: a potentially dangerous action (Read of a secrets file) was blocked. Review required.')
  expect(w.copies[0]?.surface).toBe('desktop')
  expect(w.copies[0]?.text).not.toContain(SECRET_PATH)
  expect(w.copies[0]?.text).not.toMatch(/[\\/]/)
  expect(await noticeTexts($)).toContain('Redacted receipt text copied')
  await ui.unmount()
})

test('Share redacted: a failed copy says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await incident($, 'injection')
  w.copyOk = false
  const ui = await pane($, 'terminal')
  await ui.press({ key: 'safety-receipt-share' })
  expect(await noticeTexts($)).toContain('Could not copy')
  await ui.unmount()
})

test('Dismiss closes the pane; /safety-receipt reopens the last receipt', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await incident($, 'dangerous-command')
  const ui = await pane($)
  await ui.press({ key: 'safety-receipt-dismiss' })
  expect(w.closed).toContain('safety-receipt')
  await ui.unmount()

  expect(opens(w)).toBe(1)
  expect((await $.command.run({ command: 'safety-receipt', args: '' })).text).toBe('Opened the last safety receipt.')
  expect(opens(w)).toBe(2)
  const again = await pane($, 'terminal')
  expect(await texts(again)).toContain('Dangerous shell command')
  await again.unmount()
})

test('the same live signal gives one receipt; a new incident gives another and the pane shows the newest', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await incident($, 'dangerous-command', 1)
  await turnStart($)
  await turnDone($)
  expect(opens(w)).toBe(1)

  await incident($, 'injection', 2, NOON + 100)
  expect(opens(w)).toBe(2)
  const ui = await pane($, 'terminal')
  expect(await texts(ui)).toContain('Suspected prompt injection')
  await ui.unmount()
})

test('a turn with no incident signal opens nothing; an expired signal does not either', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await turnStart($)
  await turnDone($)
  put('incidents:last', 'incident', { feature: 'seed', level: 'alert', value: 1, text: 'scope', at: NOON - 60_000, ttlMs: 15000 })
  await turnStart($)
  await turnDone($)
  put('other:thing', 'incident', { value: 1, text: 'scope' })
  await turnStart($)
  await turnDone($)
  expect(opens(w)).toBe(0)
})

test('a sub-agent turn does not make a receipt', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  put('incidents:last', 'incident', { feature: 'seed', level: 'alert', value: 1, text: 'scope', at: NOON, ttlMs: 15000 })
  await turnStart($, { agentId: 'sub-1' })
  await turnDone($, 1000, { agentId: 'sub-1' })
  expect(opens(w)).toBe(0)
})

test('only the last 20 receipts are kept in the atom', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  for (let i = 1; i <= 23; i++) await incident($, 'dangerous-command', i, NOON + i)
  const s = slotValue('safety-receipt')
  expect(s.seq).toBe(23)
  expect(s.list.length).toBe(20)
  expect(s.list.map((r: any) => r.id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 4))
  expect(opens(w)).toBe(23)
})

test('no band chip, ever', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await incident($, 'dangerous-command')
  for (const surface of ['desktop', 'terminal'] as const) {
    const b = await $.ui.mount({ ...BAND(surface), requestId: `band-${surface}` })
    expect(await b.find({ key: 'chip-safety-receipt' })).toBeUndefined()
    await b.unmount()
  }
})

test('Hebrew: the receipt, the buttons and the share text are localized', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON, { store: { language: 'he' } })
  await start($)
  await incident($, 'dangerous-command')
  const ui = await pane($, 'terminal')
  const lines = await texts(ui)
  expect(lines).toContain('קבלת בטיחות של TOOLKITTY')
  expect(lines).toContain('פקודת מעטפת מסוכנת')
  expect(lines).toContain('עלול להיות מסוכן')
  expect(lines).toContain('נחסם')
  expect(lines).toContain('נדרשת בדיקה שלך')
  const labels = (await ui.findAll({ type: 'Button' })).map((b: any) => b.props.label)
  expect(labels).toEqual(['פרטים', 'שתף גרסה מוסתרת', 'סגור', 'שמור טקסט', 'הדפס', 'פתח תיקייה', 'העתק נתיב'])
  await ui.press({ key: 'safety-receipt-share' })
  expect(w.copies[0]?.text).toContain('קבלת בטיחות של Toolkitty')
  expect(w.copies[0]?.text).toContain('פקודת מעטפת מסוכנת')
  await ui.unmount()
  expect((await $.command.run({ command: 'safety-receipt', args: '' })).text).toBe('קבלת הבטיחות האחרונה נפתחה.')
})

test('Hebrew: no receipt yet', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON, { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'safety-receipt', args: '' })).text).toBe('עדיין אין קבלת בטיחות.')
})

test('off switch: no receipt on an incident, the command and the pane say it is off', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, [])
  await start($)
  expect(w.cmds).toContain('safety-receipt')
  await incident($, 'dangerous-command')
  expect(opens(w)).toBe(0)
  expect((await $.command.run({ command: 'safety-receipt', args: '' })).text).toBe('Safety receipts are off. Turn them on in the /toolkitty pane.')
  const ui = await pane($)
  expect(await joined(ui)).toContain('Safety receipts are off.')
  await ui.unmount()
})

test('off switch, Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, [], { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'safety-receipt', args: '' })).text).toBe('קבלות הבטיחות כבויות. הפעל אותן בלוח /toolkitty.')
})

test('no surface attached: the receipt still lands in the atom and the turn goes on', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  w.failOpen = true
  await start($)
  await incident($, 'dangerous-command')
  expect(slotValue('safety-receipt').list.length).toBe(1)
})

test('Save SVG on the desktop writes the receipt picture under toolkitty-exports, with no path or value in it; the terminal saves the text', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await incident($, 'dangerous-command')
  const ui = await pane($, 'desktop')
  await ui.press({ key: 'exp-save-safety-receipt' })
  const svgs = w.written.filter((x: any) => x.path.endsWith('.svg'))
  expect(svgs.length).toBe(1)
  expect(svgs[0]!.path).toMatch(/^C:\/proj\/toolkitty-exports\/safety-receipt-\d{4}-\d{2}-\d{2}-\d{4}\.svg$/)
  expect(svgs[0]!.text.startsWith('<svg')).toBe(true)
  expect(svgs[0]!.text).not.toContain('id_rsa')
  expect((await noticeTexts($)).some(x => x.startsWith('Saved C:') && x.includes('toolkitty-exports') && /safety-receipt-.*\.svg$/.test(x))).toBe(true)
  await ui.unmount()

  const term = await pane($, 'terminal')
  await term.press({ key: 'exp-save-safety-receipt' })
  const txts = w.written.filter((x: any) => x.path.endsWith('.txt'))
  expect(txts.length).toBe(1)
  expect(txts[0]!.text).toContain('Dangerous shell command')
  expect((await noticeTexts($)).some(x => /\.txt as text \(this surface cannot draw images\)$/.test(x))).toBe(true)
  await term.unmount()
})
