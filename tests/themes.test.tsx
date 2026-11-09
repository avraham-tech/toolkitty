import { expect, test } from 'claude-code/testing'
import { PANE, joined, lastNotice, noticeTexts, roll, start, svgOf, world } from './harness'

const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const DIR = 'C:/Users/test/.claude/toolkitty-themes'
const trio = (a: string, b: string, c: string) => [a, b, c]
const theme = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  aurora: { idle: trio('#001122', '#002244', '#003366'), working: trio('#110022', '#220044', '#330066'), warn: trio('#221100', '#442200', '#663300'), danger: trio('#220011', '#440022', '#660033') },
  receipt: { footer: 'SEA YOU', accent: '#0099ff' },
  buddy: { frame: '', accent: '#00ccff' },
  ...extra,
})
let commonSeed = 1
while (roll(commonSeed).rarity !== 'common') commonSeed++

test('load: /themes is registered; no argument opens the pane and lists the four built-ins', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('themes')
  const r = await $.command.run({ command: 'themes', args: '' })
  expect(w.opened.map(o => o.id)).toContain('themes')
  const lines = r.text.split('\n')
  expect(lines[0]).toBe('Themes (current marked with *):')
  expect(lines[1]).toBe('* classic - Classic')
  expect(lines[2]).toBe('  sunset - Sunset')
  expect(lines[3]).toBe('  matrix - Matrix')
  expect(lines[4]).toBe('  pastel - Pastel')
  expect(r.text).toContain('Add your own: drop a JSON file in ~/.claude/toolkitty-themes/')
})

test('/themes <id> picks by id or by name, any case, and remembers it', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect((await $.command.run({ command: 'themes', args: 'sunset' })).text).toBe('Theme: Sunset')
  expect(w.store.get('themes:current')).toBe('sunset')
  expect(await noticeTexts($)).toContain('Theme: Sunset')
  expect((await $.command.run({ command: 'themes', args: '  MATRIX  ' })).text).toBe('Theme: Matrix')
  expect(w.store.get('themes:current')).toBe('matrix')
  expect((await $.command.run({ command: 'themes', args: 'Pastel' })).text).toBe('Theme: Pastel')
  const r = await $.command.run({ command: 'themes', args: '' })
  expect(r.text).toContain('* pastel - Pastel')
  expect(r.text).toContain('  classic - Classic')
})

test('an unknown theme is reported and changes nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await $.command.run({ command: 'themes', args: 'matrix' })
  expect((await $.command.run({ command: 'themes', args: 'nope' })).text).toBe('No theme "nope". Run /themes to see the list.')
  expect(w.store.get('themes:current')).toBe('matrix')
})

test('the saved theme is restored at session start; an unknown saved id is ignored', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'themes:current': 'pastel' } })
  await start($)
  expect((await $.command.run({ command: 'themes', args: '' })).text).toContain('* pastel - Pastel')
})

test('an unknown saved id keeps classic', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'themes:current': 'gone' } })
  await start($)
  expect((await $.command.run({ command: 'themes', args: '' })).text).toContain('* classic - Classic')
})

test('the pane lists every theme with swatches and a select button', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE('themes'), surface: 'desktop' })
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map((b: any) => b.key)).toEqual(['pick-classic', 'pick-sunset', 'pick-matrix', 'pick-pastel'])
  for (const b of buttons) expect(b.props['label']).toBe('select')
  const all = await joined(ui)
  expect(all).toContain('Classic *')
  expect(all).toContain('Sunset')
  expect(all).toContain('Add your own: drop a JSON file in ~/.claude/toolkitty-themes/')
  // 6 swatches per theme
  const swatches = (await ui.findAll({ type: 'Box' })).filter((b: any) => b.props.backgroundColor !== undefined)
  expect(swatches.length).toBe(24)

  await ui.press({ key: 'pick-matrix' })
  expect(w.store.get('themes:current')).toBe('matrix')
  expect(await lastNotice($)).toBe('Theme: Matrix')
  const after = await joined(ui)
  expect(after).toContain('Matrix *')
  expect(after).not.toContain('Classic *')
  await ui.press({ key: 'pick-classic' })
  expect(await joined(ui)).toContain('Classic *')
  await ui.unmount()
  const t = await $.ui.mount({ ...PANE('themes'), surface: 'terminal' })
  expect((await t.findAll({ type: 'Button' })).length).toBe(4)
  await t.unmount()
})

test('a choice recolors the eye-candy features live', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'buddy:seed': commonSeed } })
  await start($)
  const buddy = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  const before = (await svgOf(buddy)).source
  expect(before).toContain('#9aa3ad') // the common frame of the classic theme
  await $.command.run({ command: 'themes', args: 'matrix' })
  const after = (await svgOf(buddy)).source
  expect(after).not.toBe(before)
  expect(after).toContain('#00ff66')
  await buddy.unmount()
})

test('user themes load from ~/.claude/toolkitty-themes; invalid ones and non-JSON are skipped', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, {
    files: {
      [`${DIR}/ocean.json`]: JSON.stringify(theme('ocean')),
      [`${DIR}/broken.json`]: '{ not json',
      [`${DIR}/bad-color.json`]: JSON.stringify(theme('red', { receipt: { footer: '', accent: 'red' } })),
      [`${DIR}/no-name.json`]: JSON.stringify(theme('x', { name: '   ' })),
      [`${DIR}/bad-id.json`]: JSON.stringify(theme('x', { id: 'bad id!' })),
      [`${DIR}/readme.txt`]: 'hello',
      [`${DIR}/array.json`]: '[]',
      [`${DIR}/classic.json`]: JSON.stringify(theme('classic', { name: 'Classic Reloaded' })),
    },
  })
  w.dirs[DIR] = [
    { name: 'readme.txt', kind: 'file' },
    { name: 'ocean.json', kind: 'file' },
    { name: 'broken.json', kind: 'file' },
    { name: 'bad-color.json', kind: 'file' },
    { name: 'no-name.json', kind: 'file' },
    { name: 'bad-id.json', kind: 'file' },
    { name: 'array.json', kind: 'file' },
    { name: 'classic.json', kind: 'file' },
    { name: 'sub.json', kind: 'directory' },
  ]
  await start($)
  const list = (await $.command.run({ command: 'themes', args: '' })).text
  expect(list).toContain('* classic - Classic Reloaded') // replaced by the user's file of the same id
  expect(list).toContain('ocean - Ocean')
  expect(list).not.toContain('broken')
  expect(list).not.toContain('Red')
  expect(list).not.toContain('bad id')
  expect(list.split('\n').filter(l => /^[ *] \S+ - /.test(l)).length).toBe(5)
  expect((await $.command.run({ command: 'themes', args: 'ocean' })).text).toBe('Theme: Ocean')
  // the Ocean footer reaches the receipt
  const pane = await $.ui.mount({ ...PANE('themes'), surface: 'desktop' })
  expect(await joined(pane)).toContain('Ocean *')
  await pane.unmount()
})

test('a missing theme folder leaves the built-ins', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const list = (await $.command.run({ command: 'themes', args: '' })).text
  expect(list.split('\n').filter(l => /^[ *] \S+ - /.test(l)).length).toBe(4)
})

test('no home directory: built-ins only', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { env: {} })
  await start($)
  const list = (await $.command.run({ command: 'themes', args: '' })).text
  expect(list.split('\n').filter(l => /^[ *] \S+ - /.test(l)).length).toBe(4)
})

test('HOME is used when USERPROFILE is unset', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { env: { HOME: 'C:/Users/test/' }, files: { [`${DIR}/ocean.json`]: JSON.stringify(theme('ocean')) } })
  w.dirs[DIR] = [{ name: 'ocean.json', kind: 'file' }]
  await start($)
  expect((await $.command.run({ command: 'themes', args: 'ocean' })).text).toBe('Theme: Ocean')
})

test('a newly dropped file is found by the next /themes', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect((await $.command.run({ command: 'themes', args: 'ocean' })).text).toContain('No theme "ocean"')
  w.files[`${DIR}/ocean.json`] = JSON.stringify(theme('ocean'))
  w.dirs[DIR] = [{ name: 'ocean.json', kind: 'file' }]
  expect((await $.command.run({ command: 'themes', args: 'ocean' })).text).toBe('Theme: Ocean')
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  const list = (await $.command.run({ command: 'themes', args: '' })).text
  expect(list.split('\n')[0]).toBe('עיצובים (הנוכחי מסומן ב-*):')
  expect((await $.command.run({ command: 'themes', args: 'sunset' })).text).toBe('עיצוב: Sunset')
  expect((await $.command.run({ command: 'themes', args: 'zzz' })).text).toBe('אין עיצוב "zzz". הרץ /themes לרשימה.')
  const ui = await $.ui.mount({ ...PANE('themes'), surface: 'desktop' })
  expect((await ui.find({ type: 'Button', key: 'pick-classic' }))!.props['label']).toBe('בחר')
  await ui.unmount()
})

test('off switch', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { themes: false }, 'themes:current': 'matrix' } })
  await start($)
  expect((await $.command.run({ command: 'themes', args: '' })).text).toBe(OFF)
  expect((await $.command.run({ command: 'themes', args: 'sunset' })).text).toBe(OFF)
  expect(w.store.get('themes:current')).toBe('matrix')
  const ui = await $.ui.mount({ ...PANE('themes'), surface: 'desktop' })
  expect(await joined(ui)).toBe(OFF)
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
  // and off at session start means the saved choice is not applied: the receipt keeps classic
})

test('the pane header names the current theme and follows a pick', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE('themes'), surface: 'desktop' })
  expect((await ui.findAll({ type: 'Text' })).slice(0, 3).map((x: any) => x.text)).toEqual(['✦', 'Themes', 'Classic'])
  await ui.press({ key: 'pick-sunset' })
  expect((await ui.findAll({ type: 'Text' }))[2]!.text).toBe('Sunset')
  expect(await lastNotice($)).toBe('Theme: Sunset')
  await ui.unmount()
})

test('the old /theme name is not registered; /themes is', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).not.toContain('theme')
  expect(w.cmds).toContain('themes')
})
