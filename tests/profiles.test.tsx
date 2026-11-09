import { expect, test } from 'claude-code/testing'
import { PANE, joined, labels, start, turnStart, world } from './harness'

const GUARDS = ['dangerous-commands', 'protect-secrets', 'secret-mask', 'pasted-secret-scan', 'budget-guard', 'incidents', 'injection-tripwire', 'blast-radius']
const run = ($: any, args: string) => $.command.run({ command: 'profiles', args })
const enabledMap = (w: any) => w.store.get('enabled') as Record<string, boolean>
const board = ($: any) => $.ui.mount({ ...PANE('toolkitty'), surface: 'desktop' })
const pane = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('profiles'), surface })
const keys = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => b.key)

/** The feature ids the switchboard lists, from its toggle buttons. */
async function allIds($: any): Promise<string[]> {
  const sw = await board($)
  const ids = (await keys(sw)).filter((k: string) => k.startsWith('t-')).map((k: string) => k.slice(2))
  await sw.unmount()
  return ids
}

test('profiles loads, registers /profiles and shows up in the switchboard', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('profiles')
  expect(await allIds($)).toContain('profiles')
})

test('/profiles with no arguments shows the current profile (none yet) and the three choices', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const lines = (await run($, '')).text.split('\n')
  expect(lines[0]).toMatch(/^Display profile: none applied yet · \d+ features on$/)
  expect(lines.filter((l: string) => l.startsWith('· '))).toHaveLength(3)
  expect(lines[1]).toMatch(/^· minimal \(Minimal\): The headline and the bell only/)
  expect(lines[2]).toMatch(/^· productive \(Productive\): /)
  expect(lines[3]).toMatch(/^· playful \(Playful\): /)
  expect(lines[lines.length - 1]).toBe('Switch with /profiles <name>; /profiles pane opens the cards.')
})

test('/profiles in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  const lines = (await run($, '')).text.split('\n')
  expect(lines[0]).toMatch(/^פרופיל תצוגה: עדיין לא הוחל/)
  expect(lines[1]).toContain('מינימלי')
  expect(lines[2]).toContain('פרודוקטיבי')
  expect(lines[3]).toContain('שובב')
})

test('an unknown profile name is refused with the choices', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect((await run($, 'bogus')).text).toBe('Unknown profile "bogus". Choose minimal, productive or playful.')
  expect(w.asked).toEqual([])
  expect(w.store.get('profile')).toBeUndefined()
})

test('/profiles pane opens the cards as a dialog', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect((await run($, 'pane')).text).toBe('Display profiles opened.')
  expect(w.opened.filter((o: any) => o.id === 'profiles')).toEqual([{ id: 'profiles', title: 'Display profiles', focus: true, closeOnEscape: true }])
})

test('/profiles minimal previews what goes off; Apply sets the map, the store profile and quiet notices', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'Apply'
  await start($)
  const r = await run($, 'minimal')
  expect(w.asked).toHaveLength(1)
  expect(w.asked[0]).toContain('Switch to the Minimal profile? This turns off ')
  expect(w.asked[0]).toContain('Safety guards stay on.')
  expect(w.asked[0]).toMatch(/… \+\d+ more/)
  expect(r.text).toMatch(/^Profile Minimal applied: \d+ features on, \d+ off\.$/)
  const map = enabledMap(w)
  for (const id of GUARDS) expect(map[id], id).toBe(true)
  for (const id of ['task-pulse', 'cost-meter', 'savings', 'onboarding', 'project-config', 'profiles']) expect(map[id], id).toBe(true)
  for (const id of ['buddy', 'notes', 'plan-pace', 'themes', 'turn-receipt', 'auto-format', 'model-indicator']) expect(map[id], id).toBe(false)
  expect(w.store.get('profile')).toBe('minimal')
  expect((w.store.get('profiles:applied') as any).profile).toBe('minimal')
  expect(w.store.get('profiles:overrides')).toEqual({})
  expect((w.store.get('notices:prefs') as any).quiet).toBe(true)
  // nothing more to turn off the second time: no question
  w.asked.length = 0
  await run($, 'minimal')
  expect(w.asked).toHaveLength(0)
})

test('Cancel changes nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const r = await run($, 'minimal')
  expect(w.asked).toHaveLength(1)
  expect(r.text).toBe('Profile unchanged.')
  expect(w.store.get('profile')).toBeUndefined()
  expect(w.store.get('enabled')).toBeUndefined()
  expect(w.store.get('notices:prefs')).toBeUndefined()
})

test('a typed answer that is not Apply cancels too; the name is case-insensitive', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'sure, why not'
  await start($)
  expect((await run($, '  MINIMAL ')).text).toBe('Profile unchanged.')
  expect(w.asked).toHaveLength(1)
})

test('productive: minimal plus the working tools; claim-check is listed so it is on', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'Apply'
  await start($)
  await run($, 'productive')
  const map = enabledMap(w)
  for (const id of GUARDS) expect(map[id], id).toBe(true)
  for (const id of ['task-pulse', 'cost-meter', 'savings', 'plan-pace', 'cache-countdown', 'dup-read-detector', 'output-archive', 'error-counter', 'loop-detective', 'claim-check', 'live-ticker', 'waiting-alert', 'diff-review', 'session-finder', 'monday-report', 'correction-capture', 'agent-profiler', 'uncommitted-reminder', 'git-context', 'done-notify']) {
    expect(map[id], id).toBe(true)
  }
  for (const id of ['buddy', 'turn-receipt', 'week-heatmap', 'context-aquarium', 'aurora-backdrop', 'themes', 'sounds', 'auto-format', 'lint-after-edit', 'notes']) expect(map[id], id).toBe(false)
  expect(w.store.get('profile')).toBe('productive')
  // productive does not touch the notice preferences
  expect(w.store.get('notices:prefs')).toBeUndefined()
})

test('playful: every default-on feature, visuals included; default-off stays off', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { buddy: false, notes: false, 'task-pulse': false } } })
  w.askAnswer = 'Apply'
  await start($)
  const r = await run($, 'playful')
  expect(r.text).toMatch(/^Profile Playful applied/)
  const map = enabledMap(w)
  for (const id of [...GUARDS, 'buddy', 'notes', 'task-pulse', 'turn-receipt', 'week-heatmap', 'context-aquarium', 'themes', 'plan-pace']) expect(map[id], id).toBe(true)
  for (const id of ['aurora-backdrop', 'sounds', 'scope-guard']) expect(map[id], id).toBe(false)
  expect(w.store.get('profile')).toBe('playful')
  // sounds etc. were off by default and stay off; nothing that was on goes off: no question
  expect(w.asked).toHaveLength(0)
})

for (const profile of ['minimal', 'productive', 'playful']) {
  test(`guards stay on in ${profile}, even when everything was off before`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = world(on)
    w.askAnswer = 'Apply'
    await start($)
    const ids = await allIds($)
    expect(ids.length).toBeGreaterThan(40)
    const allOff: Record<string, boolean> = {}
    for (const id of ids) allOff[id] = id === 'profiles' // everything off but the switcher itself
    w.store.set('enabled', allOff)
    await start($)
    await run($, profile)
    const map = enabledMap(w)
    for (const id of GUARDS) expect(map[id], id).toBe(true)
    expect(map['profiles']).toBe(true)
    // everything was off, so the preview has nothing to turn off
    expect(w.asked).toHaveLength(0)
    expect(w.store.get('profile')).toBe(profile)
  })
}

test('a guard the person turned off by hand after a profile stays off when the profile is applied again (their choice, not the profile)', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'Apply'
  await start($)
  await run($, 'productive')
  const sw = await board($)
  await sw.press({ key: 't-blast-radius' })
  await sw.unmount()
  expect(enabledMap(w)['blast-radius']).toBe(false)
  await run($, 'playful')
  expect(enabledMap(w)['blast-radius']).toBe(false)
  expect(w.store.get('profiles:overrides')).toEqual({ 'blast-radius': false })
  // after resetting the changes the profile switches it on again
  const ui = await pane($)
  await ui.press({ key: 'reset' })
  expect(enabledMap(w)['blast-radius']).toBe(true)
  await ui.unmount()
})

test('the preview never lists a guard', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await run($, 'minimal')
  for (const id of GUARDS) expect(w.asked[0]!.includes(`${id},`)).toBe(false)
})

test('hand changes after applying a profile are stored as overrides and re-applied on top', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'Apply'
  await start($)
  await run($, 'minimal')
  expect(w.store.get('profiles:overrides')).toEqual({})

  // by hand in the switchboard: buddy on, task-pulse off
  const sw = await board($)
  await sw.press({ key: 't-buddy' })
  await sw.press({ key: 't-task-pulse' })
  expect(enabledMap(w)['buddy']).toBe(true)
  expect(enabledMap(w)['task-pulse']).toBe(false)
  await turnStart($)
  expect(w.store.get('profiles:overrides')).toEqual({ buddy: true, 'task-pulse': false })

  // another profile and the same one again keep them on top
  await run($, 'productive')
  expect(enabledMap(w)['buddy']).toBe(true)
  expect(enabledMap(w)['task-pulse']).toBe(false)
  expect(enabledMap(w)['plan-pace']).toBe(true)
  expect(w.store.get('profiles:overrides')).toEqual({ buddy: true, 'task-pulse': false })
  await run($, 'productive')
  expect(enabledMap(w)['buddy']).toBe(true)
  expect(w.store.get('profile')).toBe('productive')
  expect(w.store.get('profiles:overrides')).toEqual({ buddy: true, 'task-pulse': false })

  // the result says how many were kept
  const again = await run($, 'productive')
  expect(again.text).toMatch(/2 of your own changes were kept on top\.$/)
  await sw.unmount()
})

test('overrides survive a new session', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'Apply'
  await start($)
  await run($, 'productive')
  const sw = await board($)
  await sw.press({ key: 't-notes' }) // notes are off in productive: this turns them on
  await sw.unmount()
  await start($)
  expect(w.store.get('profiles:overrides')).toEqual({ notes: true })
  const text = (await run($, '')).text
  expect(text).toContain('Display profile: Productive')
  expect(text).toContain('Changed by hand (1): ')
})

test('an override that equals the new profile disappears', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'Apply'
  await start($)
  await run($, 'playful')
  const sw = await board($)
  await sw.press({ key: 't-buddy' }) // off by hand
  await sw.unmount()
  await run($, 'minimal') // buddy is off in minimal anyway
  expect(enabledMap(w)['buddy']).toBe(false)
  expect(w.store.get('profiles:overrides')).toEqual({})
  await run($, 'playful')
  expect(enabledMap(w)['buddy']).toBe(true)
})

test('leaving minimal gives the notices back', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'Apply'
  await start($)
  await run($, 'minimal')
  expect((w.store.get('notices:prefs') as any).quiet).toBe(true)
  await run($, 'playful')
  expect((w.store.get('notices:prefs') as any).quiet).toBe(false)
})

test('the pane: three cards with a select button each, no overrides yet', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await pane($)
  expect(await keys(ui)).toEqual(['select-minimal', 'select-productive', 'select-playful'])
  expect(await labels(ui)).toEqual(['Select', 'Select', 'Select'])
  const all = await joined(ui)
  expect(all).toContain('Display profiles')
  expect(all).toContain('none applied')
  for (const name of ['Minimal', 'Productive', 'Playful']) expect(all).toContain(name)
  expect(all).toContain('The headline and the bell only; quiet notices, no visuals.')
  expect(all.match(/\d+ features on/g)).toHaveLength(3)
  expect(all).toContain('Your changes on top')
  expect(all).toContain('No changes by hand since a profile was applied.')
  expect(all).toContain('Safety guards are never turned off by a profile.')
  expect(w.asked).toEqual([])
  await ui.unmount()
})

test('the pane counts grow: minimal < productive < playful', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await pane($)
  const counts = ((await joined(ui)).match(/(\d+) features on/g) ?? []).map((x: string) => Number(x.split(' ')[0]))
  expect(counts).toHaveLength(3)
  expect(counts[0]!).toBeLessThan(counts[1]!)
  expect(counts[1]!).toBeLessThan(counts[2]!)
  await ui.unmount()
})

test('pressing select asks first; Apply applies and the card shows current', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'Apply'
  await start($)
  const ui = await pane($)
  await ui.press({ key: 'select-productive' })
  expect(w.asked).toHaveLength(1)
  expect(w.asked[0]).toContain('Switch to the Productive profile?')
  expect(w.store.get('profile')).toBe('productive')
  expect(await joined(ui)).toContain('✓ current')
  const texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text)
  expect(texts.slice(0, 3)).toEqual(['⚙', 'Display profiles', 'Productive'])
  await ui.unmount()
})

test('pressing select and cancelling leaves the pane as it was (terminal)', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await pane($, 'terminal')
  await ui.press({ key: 'select-minimal' })
  expect(w.asked).toHaveLength(1)
  expect(w.store.get('profile')).toBeUndefined()
  expect(await joined(ui)).not.toContain('✓ current')
  await ui.unmount()
})

test('the pane lists the overrides and the reset button puts them back', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.askAnswer = 'Apply'
  await start($)
  await run($, 'minimal')
  const sw = await board($)
  await sw.press({ key: 't-buddy' })
  await sw.press({ key: 't-task-pulse' })
  await sw.unmount()

  const ui = await pane($)
  expect(await keys(ui)).toEqual(['reset', 'select-minimal', 'select-productive', 'select-playful'])
  expect(await labels(ui)).toEqual(['Reset changes', 'Select', 'Select', 'Select'])
  const all = await joined(ui)
  expect(all).not.toContain('No changes by hand')
  expect(all).toMatch(/\bon\b/)
  expect(all).toMatch(/\boff\b/)
  expect((await ui.find({ key: 'reset' }))!.props['hotkey']).toBe('1')

  await ui.press({ key: 'reset' })
  expect(enabledMap(w)['buddy']).toBe(false)
  expect(enabledMap(w)['task-pulse']).toBe(true)
  expect(w.store.get('profiles:overrides')).toEqual({})
  expect(await keys(ui)).toEqual(['select-minimal', 'select-productive', 'select-playful'])
  expect(await joined(ui)).toContain('No changes by hand since a profile was applied.')
  await ui.unmount()
})

test('the pane in Hebrew, and the question and its answer in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  w.askAnswer = 'החל'
  await start($)
  const ui = await pane($)
  const all = await joined(ui)
  expect(all).toContain('פרופילי תצוגה')
  expect(all).toContain('לא הוחל')
  for (const name of ['מינימלי', 'פרודוקטיבי', 'שובב']) expect(all).toContain(name)
  expect(await labels(ui)).toEqual(['בחר', 'בחר', 'בחר'])
  expect(all).toContain('אין שינויים ידניים מאז שהוחל פרופיל.')
  await ui.press({ key: 'select-minimal' })
  expect(w.asked[0]).toContain('לעבור לפרופיל מינימלי?')
  expect(w.asked[0]).toContain('שומרי הבטיחות נשארים פעילים.')
  expect(w.store.get('profile')).toBe('minimal')
  expect(await joined(ui)).toContain('✓ נוכחי')
  await ui.unmount()
})

test('the stored profile and its map are loaded at session start', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, {
    store: { profile: 'productive', 'profiles:applied': { profile: 'productive', map: { buddy: false } }, enabled: { buddy: true } },
  })
  await start($)
  const text = (await run($, '')).text
  expect(text).toContain('Display profile: Productive')
  expect(text).toContain('Changed by hand (1): ')
  expect(w.store.get('profiles:overrides')).toEqual({ buddy: true })
})

test('a garbage stored profile is ignored', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { profile: 'wild', 'profiles:applied': 'nope' } })
  await start($)
  expect((await run($, '')).text).toMatch(/^Display profile: none applied yet/)
})

test('off switch: the command answers off, the pane says so, nothing is written', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { profiles: false }, profile: 'minimal', 'profiles:applied': { profile: 'minimal', map: { buddy: false } } } })
  await start($)
  expect(w.cmds).toContain('profiles')
  expect((await run($, '')).text).toBe('Display profiles are turned off in the switchboard.')
  expect((await run($, 'minimal')).text).toBe('Display profiles are turned off in the switchboard.')
  expect(w.asked).toEqual([])
  const ui = await pane($)
  expect(await joined(ui)).toBe('Display profiles are turned off in the switchboard.')
  expect(await keys(ui)).toEqual([])
  await ui.unmount()
  await turnStart($)
  expect(w.store.get('profiles:overrides')).toBeUndefined()
})
