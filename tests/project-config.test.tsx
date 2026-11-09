import { expect, test } from 'claude-code/testing'
import { PANE, noticeTexts, start, turnStart, world } from './harness'

const FILE = 'C:/proj/.claude/toolkitty.json'
const SHOWN = 'C:\\proj/.claude/toolkitty.json' // what the plugin prints: the engine's cwd spelling
const OFF = 'Project profiles are turned off in the switchboard.'
const cfg = (o: unknown) => JSON.stringify(o)
const scopeKey = (w: any) => [...w.store.keys()].find((k: string) => k.startsWith('scope-guard:'))

test('load: both commands are registered; without a file nothing is applied', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('toolkitty-export')
  expect(w.cmds).toContain('toolkitty-profile')
  expect((await noticeTexts($)).some(x => x.includes('project profile applied'))).toBe(false)
  const r = await $.command.run({ command: 'toolkitty-profile', args: '' })
  expect(r.text).toMatch(/^No project profile: .*toolkitty\.json does not exist\. \/toolkitty-export creates it from your current setup\.$/)
})

test('the file is applied at session start: enabled merged, language, scope, budget', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, {
    store: { enabled: { notes: false, buddy: true }, 'budget-guard:settings': { weekly: 10, warn: true } },
    files: { [FILE]: cfg({ enabled: { buddy: false, 'turn-receipt': true }, language: 'he', scope: ['src/**', ' docs/** '], budget: { weekly: 50, fiveHour: 5 } }) },
  })
  await start($)
  expect(w.store.get('enabled')).toMatchObject({ notes: false, buddy: false, 'turn-receipt': true })
  expect(w.store.get('language')).toBe('he')
  expect(w.store.get(scopeKey(w)!)).toEqual(['src/**', 'docs/**'])
  expect(w.store.get('budget-guard:settings')).toEqual({ weekly: 50, warn: true, fiveHour: 5 })
  // the toast is in the new language, and says how many features were set
  expect(await noticeTexts($)).toContain('Toolkitty: פרופיל הפרויקט הוחל (2 שכלולים)')
  // buddy now off: its command says so
  expect((await $.command.run({ command: 'buddy', args: '' })).text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})

test('applied toast in English; only once per session even when the file changes', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ enabled: { buddy: false } }) } })
  await start($)
  expect((await noticeTexts($)).filter(x => x === 'Toolkitty: project profile applied (1 features)').length).toBe(1)
  w.files[FILE] = cfg({ enabled: { buddy: true, notes: false } })
  w.mtime[FILE] = 5
  await turnStart($)
  expect((await noticeTexts($)).filter(x => x.includes('project profile applied')).length).toBe(1)
  expect(w.store.get('enabled')).toMatchObject({ buddy: true, notes: false })
})

test('the file is re-read at a turn only when it changed', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ enabled: { notes: false } }) } })
  await start($)
  expect(w.store.get('enabled')).toMatchObject({ notes: false })
  // someone turns notes back on by hand; an unchanged file must not undo it
  w.store.set('enabled', { notes: true })
  const mine = () => w.storeSets.filter(x => ['enabled', 'language'].includes(x.key) || x.key.startsWith('scope-guard:')).length
  const sets = mine()
  await turnStart($)
  expect(mine()).toBe(sets)
  expect(w.store.get('enabled')).toMatchObject({ notes: true })
  // a new mtime applies it again
  w.mtime[FILE] = 99
  await turnStart($)
  expect(w.store.get('enabled')).toMatchObject({ notes: false })
})

test('a file that appears later is picked up at the next turn', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  w.files[FILE] = cfg({ enabled: { sounds: false } })
  await turnStart($)
  expect(w.store.get('enabled')).toMatchObject({ sounds: false })
})

test('unknown or malformed parts are dropped, valid ones kept', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, {
    files: {
      [FILE]: cfg({
        enabled: { buddy: false, 'Bad_ID': true, notes: 'yes', ['x'.repeat(65)]: true, sounds: true },
        language: 'xx',
        scope: ['ok/**', 3, '', '   ', null, 'also/**'],
        budget: { weekly: -1, fiveHour: 'lots' },
        extra: 1,
      }),
    },
  })
  await start($)
  expect(w.store.get('enabled')).toEqual({ buddy: false, sounds: true })
  expect(w.store.get('language')).toBeUndefined()
  expect(w.store.get(scopeKey(w)!)).toEqual(['ok/**', 'also/**'])
  expect(w.store.get('budget-guard:settings')).toBeUndefined()
})

test('a budget with one valid amount keeps just that', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ budget: { fiveHour: 0, weekly: Number.NaN } }) } })
  await start($)
  expect(w.store.get('budget-guard:settings')).toEqual({ fiveHour: 0 })
  // an empty enabled map still announces zero features
  expect(await noticeTexts($)).toContain('Toolkitty: project profile applied (0 features)')
})

test('a file that is not JSON, or not an object, is reported', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: '{ nope' } })
  await start($)
  expect((await noticeTexts($)).some(x => /^Project profile .*toolkitty\.json is not valid: not JSON$/.test(x))).toBe(true)
  expect(w.store.get('enabled')).toBeUndefined()
  w.files[FILE] = '[1,2]'
  w.mtime[FILE] = 7
  await turnStart($)
  expect((await noticeTexts($)).some(x => /is not valid: the file must hold a JSON object$/.test(x))).toBe(true)
  const r = await $.command.run({ command: 'toolkitty-profile', args: '' })
  expect(r.text).toMatch(/is not valid: the file must hold a JSON object$/)
})

test('/toolkitty-profile lists what the file sets', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, {
    files: { [FILE]: cfg({ enabled: { buddy: false, notes: true, sounds: true }, language: 'en', scope: ['a/**', 'b/**'], budget: { weekly: 20 } }) },
  })
  await start($)
  const r = await $.command.run({ command: 'toolkitty-profile', args: '' })
  const lines = r.text.split('\n')
  expect(lines[0]).toMatch(/^Project profile \(.*toolkitty\.json\)$/)
  expect(lines).toContain('Turned on (2): notes, sounds')
  expect(lines).toContain('Turned off (1): buddy')
  expect(lines).toContain('Language: en')
  expect(lines).toContain('Edit scope (2): a/**, b/**')
  expect(lines).toContain('Budget: weekly 20, five-hour unchanged')
  void w
})

test('/toolkitty-profile with an empty object', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { files: { [FILE]: '{}' } })
  await start($)
  const lines = (await $.command.run({ command: 'toolkitty-profile', args: '' })).text.split('\n')
  expect(lines[0]).toMatch(/^Project profile \(/)
  expect(lines[1]).toBe('The file sets nothing.')
})

test('/toolkitty-profile with a budget of both amounts', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { files: { [FILE]: cfg({ budget: { weekly: 3, fiveHour: 1.5 } }) } })
  await start($)
  const r = await $.command.run({ command: 'toolkitty-profile', args: '' })
  expect(r.text).toContain('Budget: weekly 3, five-hour 1.5')
})

test('/toolkitty-export writes the current setup, with language and scope', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { buddy: false, 'aurora-backdrop': true }, language: 'es' } })
  await start($)
  w.store.set('scope-guard:C:/proj', ['src/**'])
  const r = await $.command.run({ command: 'toolkitty-export', args: '' })
  expect(r.text).toMatch(/^Configuración del Toolkitty escrita en .*toolkitty\.json$/)
  expect(w.written.length).toBe(1)
  expect(w.written[0]!.path).toBe(FILE)
  expect(w.written[0]!.text.endsWith('}\n')).toBe(true)
  const out = JSON.parse(w.written[0]!.text)
  expect(out.language).toBe('es')
  expect(out.scope).toEqual(['src/**'])
  expect(out.enabled.buddy).toBe(false)
  expect(out.enabled['aurora-backdrop']).toBe(true)
  expect(out.enabled['task-pulse']).toBe(true) // a default
  expect(out.enabled['onboarding']).toBe(true)
  // every feature of the switchboard is in it
  const sw = await $.ui.mount({ ...PANE('toolkitty'), surface: 'desktop' })
  const rows = (await sw.findAll({ type: 'Button' })).filter((b: any) => (b.key as string).startsWith('t-')).length
  expect(Object.keys(out.enabled).length).toBe(rows)
  await sw.unmount()
  expect(await noticeTexts($)).toContain(r.text)
  // and /toolkitty-profile reads it back
  const p = await $.command.run({ command: 'toolkitty-profile', args: '' })
  expect(p.text).toContain('Idioma: es')
  expect(p.text).toContain('Ámbito de edición (1): src/**')
  expect(p.text).toContain('Desactivadas (')
})

test('/toolkitty-export without a scope omits it', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await $.command.run({ command: 'toolkitty-export', args: '' })
  const out = JSON.parse(w.written[0]!.text)
  expect(out.scope).toBeUndefined()
  expect(out.language).toBe('en')
})

test('/toolkitty-export reports a failed write', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.failWrite = true
  await start($)
  const r = await $.command.run({ command: 'toolkitty-export', args: '' })
  expect(r.text).toMatch(/^Could not write .*toolkitty\.json: .+$/)
  expect(w.written).toEqual([])
})

test('after an export the next turn does not re-apply the file over later changes', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { notes: false } } })
  await start($)
  await $.command.run({ command: 'toolkitty-export', args: '' })
  // the person toggles notes on in the switchboard after exporting
  w.store.set('enabled', { ...(w.store.get('enabled') as object), notes: true })
  await turnStart($)
  expect((w.store.get('enabled') as Record<string, boolean>)['notes']).toBe(true)
  // a real edit of the file later is still picked up
  w.files[FILE] = cfg({ enabled: { notes: false } })
  w.mtime[FILE] = (w.mtime[FILE] ?? 0) + 10
  await turnStart($)
  expect((w.store.get('enabled') as Record<string, boolean>)['notes']).toBe(false)
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' }, files: { [FILE]: cfg({ enabled: { buddy: false }, language: 'he' }) } })
  await start($)
  const r = await $.command.run({ command: 'toolkitty-profile', args: '' })
  expect(r.text).toContain('פרופיל פרויקט')
  expect(r.text).toContain('כבויים (1): buddy')
  expect(r.text).toContain('שפה: he')
  const e = await $.command.run({ command: 'toolkitty-export', args: '' })
  expect(e.text).toContain('הגדרות ה-Toolkitty נכתבו אל')
  void w
})

test('Hebrew: no file', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  const r = await $.command.run({ command: 'toolkitty-profile', args: '' })
  expect(r.text).toContain('אין פרופיל פרויקט')
})

test('off switch: commands answer the off text; the file is not applied', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'project-config': false } }, files: { [FILE]: cfg({ enabled: { buddy: false }, language: 'he' }) } })
  await start($)
  expect((await $.command.run({ command: 'toolkitty-export', args: '' })).text).toBe(OFF)
  expect((await $.command.run({ command: 'toolkitty-profile', args: '' })).text).toBe(OFF)
  expect(w.store.get('language')).toBeUndefined()
  expect(w.written).toEqual([])
  w.mtime[FILE] = 4
  await turnStart($)
  expect(w.store.get('language')).toBeUndefined()
  expect((w.store.get('enabled') as Record<string, boolean>)['buddy']).toBeUndefined()
})

test('a bad file is a warn notice (amber); applying a good one is a quiet info notice', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: '{ nope' } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('toolkitty-notices'), surface: 'desktop' })
  const warn = (await ui.findAll({ type: 'Text' })).find((x: any) => /is not valid: not JSON$/.test(x.text))!
  expect(warn.props['color']).toBe('warning')
  w.files[FILE] = cfg({ enabled: { buddy: false } })
  w.mtime[FILE] = 9
  await turnStart($)
  const info = (await ui.findAll({ type: 'Text' })).find((x: any) => x.text === 'Toolkitty: project profile applied (1 features)')!
  expect(info.props['color']).toBeUndefined()
  await ui.unmount()
})

// ---- the repo's display profile ("profile": "minimal|productive|playful")

const GUARDS = ['dangerous-commands', 'protect-secrets', 'secret-mask', 'pasted-secret-scan', 'budget-guard', 'incidents', 'injection-tripwire', 'blast-radius']
const enabledOf = (w: any) => w.store.get('enabled') as Record<string, boolean>

test('profile minimal in the file is applied at session start, guards on', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ profile: 'minimal' }) } })
  await start($)
  const map = enabledOf(w)
  for (const id of GUARDS) expect(map[id], id).toBe(true)
  for (const id of ['task-pulse', 'cost-meter', 'savings', 'onboarding', 'project-config']) expect(map[id], id).toBe(true)
  for (const id of ['buddy', 'notes', 'plan-pace', 'themes', 'auto-format']) expect(map[id], id).toBe(false)
  expect(w.store.get('profile')).toBe('minimal')
  expect((w.store.get('profiles:applied') as any).profile).toBe('minimal')
  expect(w.store.get('profiles:overrides')).toEqual({})
  expect((w.store.get('notices:prefs') as any).quiet).toBe(true)
})

test('profile productive and playful', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ profile: 'productive' }) } })
  await start($)
  expect(enabledOf(w)).toMatchObject({ 'plan-pace': true, 'loop-detective': true, 'done-notify': true, buddy: false, 'dangerous-commands': true })
  expect(w.store.get('profile')).toBe('productive')
  expect(w.store.get('notices:prefs')).toBeUndefined()
  w.files[FILE] = cfg({ profile: 'playful' })
  w.mtime[FILE] = 3
  await turnStart($)
  expect(enabledOf(w)).toMatchObject({ buddy: true, themes: true, 'plan-pace': true, 'aurora-backdrop': false, 'dangerous-commands': true })
  expect(w.store.get('profile')).toBe('playful')
})

test('the profile goes first, the file\'s enabled entries override single features after it', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ profile: 'minimal', enabled: { buddy: true, 'cost-meter': false } }) } })
  await start($)
  const map = enabledOf(w)
  expect(map['buddy']).toBe(true)
  expect(map['cost-meter']).toBe(false)
  expect(map['task-pulse']).toBe(true)
  expect(map['notes']).toBe(false)
  // what the file set is the baseline, so it is not mistaken for a hand change
  expect((w.store.get('profiles:applied') as any).map).toMatchObject({ buddy: true, 'cost-meter': false })
  expect(w.store.get('profiles:overrides')).toEqual({})
})

test('a file with a profile and no enabled map still announces and applies', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ profile: 'playful', language: 'en' }) } })
  await start($)
  const texts = await noticeTexts($)
  expect(texts.some(x => /^Toolkitty: project profile applied \(\d+ features\)$/.test(x))).toBe(true)
  expect(w.store.get('profile')).toBe('playful')
})

test('an unknown profile name is dropped; the rest of the file still applies', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ profile: 'wild', enabled: { sounds: true } }) } })
  await start($)
  expect(w.store.get('profile')).toBeUndefined()
  expect(w.store.get('enabled')).toEqual({ sounds: true })
  const w2 = await $.command.run({ command: 'toolkitty-profile', args: '' })
  expect(w2.text).not.toContain('Display profile')
})

test('a non-string profile is dropped', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ profile: 3, enabled: { notes: false } }) } })
  await start($)
  expect(w.store.get('profile')).toBeUndefined()
  expect(w.store.get('enabled')).toEqual({ notes: false })
})

test('/toolkitty-profile names the profile; a file with only a profile is not "empty"', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { files: { [FILE]: cfg({ profile: 'productive' }) } })
  await start($)
  const lines = (await $.command.run({ command: 'toolkitty-profile', args: '' })).text.split('\n')
  expect(lines[0]).toMatch(/^Project profile \(/)
  expect(lines).toContain('Display profile: productive')
  expect(lines).not.toContain('The file sets nothing.')
})

test('/toolkitty-profile names the profile in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' }, files: { [FILE]: cfg({ profile: 'minimal' }) } })
  await start($)
  const lines = (await $.command.run({ command: 'toolkitty-profile', args: '' })).text.split('\n')
  expect(lines).toContain('פרופיל תצוגה: minimal')
})

test('leaving minimal through the file gives the notices back', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [FILE]: cfg({ profile: 'minimal' }) } })
  await start($)
  expect((w.store.get('notices:prefs') as any).quiet).toBe(true)
  w.files[FILE] = cfg({ profile: 'productive' })
  w.mtime[FILE] = 8
  await turnStart($)
  expect((w.store.get('notices:prefs') as any).quiet).toBe(false)
})

test('off switch: the file\'s profile is not applied', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'project-config': false } }, files: { [FILE]: cfg({ profile: 'minimal' }) } })
  await start($)
  expect(w.store.get('profile')).toBeUndefined()
  expect(w.store.get('notices:prefs')).toBeUndefined()
})
