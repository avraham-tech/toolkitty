import { expect, test } from 'claude-code/testing'
import { PANE, joined, labels, lastNotice, roll, start, turnStart, world } from './harness'

const SEED = 4242
const wizard = (w: any) => w.opened.filter((o: any) => o.id === 'onboarding')
const open = async ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('onboarding'), surface })
const enabledMap = (w: any) => w.store.get('enabled') as Record<string, boolean>

test('first run opens the wizard as a focused dialog; a finished run does not', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  expect(w.cmds).toContain('welcome')
  expect(wizard(w)).toEqual([{ id: 'onboarding', title: 'Toolkitty', focus: true, closeOnEscape: true }])

})

test('already done: nothing opens at start', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'onboarding:done': true } })
  await start($)
  expect(wizard(w)).toEqual([])
})

test('no surface at first run: the wizard waits for the next turn, once', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { surfaces: [] })
  w.store.delete('onboarding:done')
  await start($)
  expect(wizard(w)).toEqual([])
  w.surfaces = ['desktop']
  await turnStart($)
  expect(wizard(w).length).toBe(1)
  await turnStart($)
  expect(wizard(w).length).toBe(1)
})

test('the retry is dropped when the person finished meanwhile', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { surfaces: [] })
  w.store.delete('onboarding:done')
  await start($)
  w.store.set('onboarding:done', true)
  w.surfaces = ['desktop']
  await turnStart($)
  expect(wizard(w)).toEqual([])
})

test('first run ignores the off switch (nothing is configured yet)', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { onboarding: false } } })
  w.store.delete('onboarding:done')
  await start($)
  expect(wizard(w).length).toBe(1)
})

test('step 1 offers every language and a skip; skipping closes and marks done', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key)
  // the pane's actions (skip) sit in its header, above the choices
  expect(keys).toEqual(['skip', 'pick-en', 'pick-he', 'pick-es', 'pick-fr', 'pick-ru', 'pick-zh', 'pick-ja', 'pick-pt', 'pick-de', 'pick-ko'])
  expect(await labels(ui)).toEqual(['skip', 'English', 'עברית', 'Español', 'Français', 'Русский', '中文', '日本語', 'Português', 'Deutsch', '한국어'])
  const all = await joined(ui)
  expect(all).toContain('Choose your language')
  expect(all).toContain('בחר את השפה שלך')
  expect(all).toContain('Выберите язык')
  await ui.press({ key: 'skip' })
  expect(w.store.get('onboarding:done')).toBe(true)
  expect(w.closed).toContain('onboarding')
  await ui.unmount()
})

test('pick a language, a profile, meet the buddy, finish: writes the language, enabled and onboarding:done', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel' } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)

  await ui.press({ key: 'pick-he' })
  expect(w.store.get('language')).toBe('he')
  let all = await joined(ui)
  expect(all).toContain('בחר פרופיל')
  expect(all).toContain('שלב 2 מתוך 3')
  expect(w.store.get('onboarding:done')).toBeUndefined()
  expect(await ui.findAll({ type: 'Button' }).then((bs: any[]) => bs.map(b => b.key))).toEqual(['skip', 'pick-minimal', 'pick-productive', 'pick-playful'])
  expect(await labels(ui)).toEqual(['דלג', 'מינימלי', 'פרודוקטיבי', 'שובב'])

  await ui.press({ key: 'pick-playful' })
  const map = enabledMap(w)
  expect(map['buddy']).toBe(true)
  expect(map['turn-receipt']).toBe(true)
  expect(map['aurora-backdrop']).toBe(false) // off by default stays off
  expect(map['onboarding']).toBe(true)
  expect(map['project-config']).toBe(true)
  expect(w.store.get('onboarding:done')).toBe(true)

  all = await joined(ui)
  expect(all).toContain('הכר את החבר שלך')
  expect(all).toContain('שלב 3 מתוך 3')
  expect(all).toContain('שם: Pixel')
  expect(await labels(ui)).toEqual(['פתח את לוח המתגים', 'סיום', 'דלג'])

  await ui.press({ key: 'done' })
  expect(w.closed).toContain('onboarding')
  expect(await lastNotice($)).toBe('Toolkitty מוכן · /toolkitty פותח את לוח המתגים, /toolkitty help <שאלה> עונה על שאלות')
  await ui.unmount()
})

test('step 2 profiles: minimal keeps the status band and the guards, quiets the notices and records the profile', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-en' })
  expect(await joined(ui)).toContain('Pick a profile')
  expect(await joined(ui)).toContain('Step 2 of 3')
  expect(await labels(ui)).toEqual(['skip', 'Minimal', 'Productive', 'Playful'])
  const all = await joined(ui)
  expect(all).toContain('The headline and the bell only; quiet notices, no visuals.')
  expect(all).toContain('Minimal plus the working tools: pace, cache, loops, review, reports.')
  expect(all).toContain('Every default feature, companion, aquarium and animations included.')
  await ui.press({ key: 'pick-minimal' })
  const map = enabledMap(w)
  for (const id of ['task-pulse', 'cost-meter', 'dangerous-commands', 'protect-secrets', 'secret-mask', 'pasted-secret-scan', 'budget-guard', 'savings', 'incidents', 'injection-tripwire', 'blast-radius']) {
    expect(map[id], id).toBe(true)
  }
  for (const id of ['buddy', 'turn-receipt', 'week-heatmap', 'context-aquarium', 'aurora-backdrop', 'themes', 'sounds', 'model-indicator', 'output-trimmer', 'plan-pace', 'notes']) {
    expect(map[id], id).toBe(false)
  }
  expect(map['onboarding']).toBe(true)
  expect(map['project-config']).toBe(true)
  // the same record profiles.tsx keeps, and Minimal means quiet notices
  expect(w.store.get('profile')).toBe('minimal')
  expect((w.store.get('profiles:applied') as any).profile).toBe('minimal')
  expect((w.store.get('profiles:applied') as any).map).toEqual(map)
  expect(w.store.get('profiles:overrides')).toEqual({})
  expect((w.store.get('notices:prefs') as any).quiet).toBe(true)
  // the buddy is off in this profile
  expect(await joined(ui)).toContain('The companion is off in this profile')
  await ui.unmount()
})

test('step 2 profiles: productive is minimal plus the working tools, notices stay normal', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-en' })
  await ui.press({ key: 'pick-productive' })
  const map = enabledMap(w)
  for (const id of ['buddy', 'turn-receipt', 'week-heatmap', 'aurora-backdrop', 'context-aquarium', 'themes', 'notes', 'auto-format']) expect(map[id], id).toBe(false)
  for (const id of ['task-pulse', 'dangerous-commands', 'plan-pace', 'cache-countdown', 'loop-detective', 'claim-check', 'git-context', 'done-notify', 'onboarding', 'project-config']) expect(map[id], id).toBe(true)
  expect(w.store.get('profile')).toBe('productive')
  expect(w.store.get('notices:prefs')).toBeUndefined()
  await ui.unmount()
})

test('step 2 profiles: playful is every default feature, guards included; default-off stays off', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-en' })
  await ui.press({ key: 'pick-playful' })
  const map = enabledMap(w)
  for (const id of ['buddy', 'turn-receipt', 'week-heatmap', 'context-aquarium', 'themes', 'notes', 'dangerous-commands', 'onboarding', 'project-config']) expect(map[id], id).toBe(true)
  for (const id of ['aurora-backdrop', 'sounds']) expect(map[id], id).toBe(false)
  expect(w.store.get('profile')).toBe('playful')
  expect(w.store.get('notices:prefs')).toBeUndefined()
  await ui.unmount()
})

test('step 2 starts from a state with everything off: the guards still come out on', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const sw = await $.ui.mount({ ...PANE('toolkitty'), surface: 'desktop' })
  const ids = (await sw.findAll({ type: 'Button' })).map((btn: any) => btn.key as string).filter(name => name.startsWith('t-')).map(name => name.slice(2))
  await sw.unmount()
  w.store.set('enabled', Object.fromEntries(ids.map(id => [id, false])))
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-en' })
  await ui.press({ key: 'pick-minimal' })
  const map = enabledMap(w)
  for (const id of ['dangerous-commands', 'protect-secrets', 'secret-mask', 'pasted-secret-scan', 'budget-guard', 'incidents', 'injection-tripwire', 'blast-radius']) expect(map[id], id).toBe(true)
  await ui.unmount()
})

test('step 2 in Hebrew uses the same three profiles', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-he' })
  const all = await joined(ui)
  expect(all).toContain('רק הכותרת והפעמון; התראות שקטות, בלי אפקטים ויזואליים.')
  expect(all).toContain('כל שכלולי ברירת המחדל, כולל החבר, האקווריום והאנימציות.')
  await ui.unmount()
})

test('the switchboard shows the chosen profile', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-en' })
  await ui.press({ key: 'pick-minimal' })
  const sw = await $.ui.mount({ ...PANE('toolkitty'), surface: 'desktop' })
  expect((await sw.find({ key: 't-buddy' }))!.props['label']).toMatch(/^○/)
  expect((await sw.find({ key: 't-task-pulse' }))!.props['label']).toMatch(/^●/)
  await sw.unmount()
  await ui.unmount()
})

test('step 3 reveals the companion: rarity, species, name, shiny', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-en' })
  await ui.press({ key: 'pick-playful' })
  const info = roll(SEED)
  const all = await joined(ui)
  expect(all).toContain('Meet your companion')
  expect(all).toMatch(/Your companion is an? \w+ [\w ]+!/)
  expect(all.toLowerCase()).toContain(info.rarity)
  expect(all.toLowerCase()).toContain(info.species)
  expect(all).toContain('Name: Buddy')
  await ui.unmount()
})

test('step 3 for a shiny seed shows the mark', { timeoutMs: 30_000 }, async ($, on) => {
  let seed = 1
  while (!roll(seed).shiny) seed++
  const w = world(on, { store: { 'buddy:seed': seed } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-en' })
  await ui.press({ key: 'pick-playful' })
  expect(await joined(ui)).toContain('✦ shiny')
  await ui.unmount()
})

test('step 3 without a seed yet says the companion is still waking', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.store.delete('onboarding:done')
  await start($)
  w.store.delete('buddy:seed')
  const ui = await open($)
  await ui.press({ key: 'pick-en' })
  await ui.press({ key: 'pick-playful' })
  w.store.delete('buddy:seed')
  await ui.redraw()
  expect(await joined(ui)).toContain('Your companion is still waking up: type /buddy to meet it.')
  await ui.unmount()
})

test('step 3: the board button opens the switchboard and marks done', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($, 'terminal')
  await ui.press({ key: 'pick-en' })
  await ui.press({ key: 'pick-productive' })
  await ui.press({ key: 'board' })
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'toolkitty', title: 'Toolkitty', focus: true })
  expect(w.store.get('onboarding:done')).toBe(true)
  await ui.unmount()
})

test('skip on every step closes the wizard', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-es' })
  expect(await joined(ui)).toContain('Elige un perfil')
  await ui.press({ key: 'skip' })
  expect(w.closed.filter(x => x === 'onboarding').length).toBe(1)
  expect(w.store.get('language')).toBe('es')
  await ui.unmount()
})

test('the Russian button sets Russian', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  await ui.press({ key: 'pick-ru' })
  expect(w.store.get('language')).toBe('ru')
  expect(await joined(ui)).toContain('Выберите профиль')
  await ui.unmount()
})

test('/welcome reopens at step 1 and answers in the chosen language', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  expect((await $.command.run({ command: 'welcome', args: '' })).text).toBe('Welcome wizard opened.')
  expect(wizard(w).length).toBe(1)
  const ui = await open($)
  expect((await ui.findAll({ type: 'Button' })).length).toBe(11)
  await ui.press({ key: 'pick-en' })
  await ui.press({ key: 'pick-minimal' })
  // reopen: back to step 1
  await $.command.run({ command: 'welcome', args: 'x' })
  expect((await ui.findAll({ type: 'Button' })).length).toBe(11)
  await ui.unmount()
})

test('/welcome in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'welcome', args: '' })).text).toBe('אשף הפתיחה נפתח.')
})

test('/welcome with the wizard turned off', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { onboarding: false } } })
  await start($)
  expect((await $.command.run({ command: 'welcome', args: '' })).text).toBe('The welcome wizard is turned off in the switchboard.')
  expect(wizard(w)).toEqual([])
})

test('every step has a header with its title, the step as status and the actions in it', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  w.store.delete('onboarding:done')
  await start($)
  const ui = await open($)
  const top = async () => (await ui.findAll({ type: 'Text' })).slice(0, 3).map((x: any) => x.text)
  expect(await top()).toEqual(['⚙', 'Toolkitty', 'Step 1 of 3'])
  await ui.press({ key: 'pick-en' })
  expect(await top()).toEqual(['⚙', 'Pick a profile', 'Step 2 of 3'])
  await ui.press({ key: 'pick-productive' })
  expect(await top()).toEqual(['⚙', 'Meet your companion', 'Step 3 of 3'])
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['board', 'done', 'skip'])
  await ui.press({ key: 'done' })
  expect(await lastNotice($)).toMatch(/^Toolkitty is ready/)
  await ui.unmount()
})
