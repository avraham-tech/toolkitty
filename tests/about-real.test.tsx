import { expect, test } from 'claude-code/testing'
import { SLOW, activity, aboutPane, boot, buttonKeys, buttonLabels, noticeTexts, reportPane, start, texts } from './about-kit'

// This file runs against the credits as shipped (real repository and Ko-fi links); about.test.tsx covers the same state from the pane side.

const FOOTER_EN = 'If Toolkitty saved you time, a symbolic coffee is welcome: https://ko-fi.com/toolkitty'

test('the pane with real links: author line, support section and the support button', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  const ui = await aboutPane($)
  const out = await texts(ui)
  expect(out).toContain('Made by Avraham Shemesh')
  expect(out).toContain('Author: https://github.com/avraham-tech')
  expect(out).toContain('Repository: https://github.com/avraham-tech/toolkitty')
  expect(out).toContain('Support')
  expect(out).toContain('https://ko-fi.com/toolkitty')
  expect(out.some(x => x.includes('There is no obligation'))).toBe(true)
  expect(await buttonKeys(ui)).toEqual(['about-copy-repo', 'about-copy-support', 'about-copy-thanks'])
  expect(await buttonLabels(ui)).toEqual(['Copy repo link', 'Copy support link', 'Copy "thanks" post'])
  await ui.press({ key: 'about-copy-support' })
  expect(seen.copies).toEqual([{ text: 'https://ko-fi.com/toolkitty', surface: 'desktop' }])
  expect(await noticeTexts($)).toContain('Support link copied')
  await ui.press({ key: 'about-copy-repo' })
  expect(seen.copies[1]?.text).toBe('https://github.com/avraham-tech/toolkitty')
  await ui.press({ key: 'about-copy-thanks' })
  expect(seen.copies[2]?.text).toContain('https://github.com/avraham-tech/toolkitty')
  await ui.unmount()
})

test('the support section in Hebrew', SLOW, async ($, on) => {
  boot(on, { language: 'he' })
  await start($)
  const ui = await aboutPane($)
  expect(await buttonLabels(ui)).toEqual(['העתק קישור למאגר', 'העתק קישור לתמיכה', 'העתק פוסט תודה'])
  expect(await texts(ui)).toContain('תמיכה')
  await ui.unmount()
})

test('29th session: no support line yet; the 30th shows it, once, in the weekly report', SLOW, async ($, on) => {
  const { kv, seen } = boot(on, { ...activity(), 'about:sessions': 28 })
  await start($)
  expect(kv.get('about:sessions')).toBe(29)
  let ui = await reportPane($)
  expect((await texts(ui)).some(x => x.includes('symbolic coffee'))).toBe(false)
  expect(await buttonKeys(ui)).toEqual(['report-copy'])
  await ui.unmount()

  await start($)
  expect(kv.get('about:sessions')).toBe(30)
  ui = await reportPane($)
  const out = await texts(ui)
  expect(out.filter(x => x === FOOTER_EN)).toHaveLength(1)
  expect(await buttonKeys(ui)).toEqual(['report-copy', 'about-dismiss-support'])
  expect(await buttonLabels(ui)).toEqual(['Copy', 'Dismiss'])
  await ui.unmount()
  // never a toast, never a notice
  expect(seen.toasts.filter(x => /coffee/i.test(x))).toEqual([])
  expect((await noticeTexts($)).filter(x => /coffee/i.test(x))).toEqual([])
})

test('the support line also shows on the terminal surface', SLOW, async ($, on) => {
  boot(on, { ...activity(), 'about:sessions': 60 }, ['terminal'])
  await start($, 'terminal')
  const ui = await reportPane($, 'terminal')
  expect((await texts(ui)).filter(x => x === FOOTER_EN)).toHaveLength(1)
  expect(await buttonKeys(ui)).toContain('about-dismiss-support')
  await ui.unmount()
})

test('Dismiss hides the line at once and for good', SLOW, async ($, on) => {
  const { kv } = boot(on, { ...activity(), 'about:sessions': 40 })
  await start($)
  let ui = await reportPane($)
  expect((await texts(ui)).includes(FOOTER_EN)).toBe(true)
  await ui.press({ key: 'about-dismiss-support' })
  expect(kv.get('about:supportDismissed')).toBe(true)
  await ui.redraw()
  expect((await texts(ui)).some(x => x.includes('symbolic coffee'))).toBe(false)
  expect(await buttonKeys(ui)).toEqual(['report-copy'])
  await ui.unmount()

  // later sessions keep counting but never bring it back
  await start($)
  expect(kv.get('about:sessions')).toBe(42)
  ui = await reportPane($)
  expect((await texts(ui)).some(x => x.includes('symbolic coffee'))).toBe(false)
  await ui.unmount()
})

test('dismissed before: nothing shows even far past 30 sessions', SLOW, async ($, on) => {
  boot(on, { ...activity(), 'about:sessions': 500, 'about:supportDismissed': true })
  await start($)
  const ui = await reportPane($)
  expect((await texts(ui)).some(x => x.includes('symbolic coffee'))).toBe(false)
  await ui.unmount()
})

test('the support line in Hebrew with a Hebrew Dismiss', SLOW, async ($, on) => {
  boot(on, { ...activity(), 'about:sessions': 30, language: 'he' })
  await start($)
  const ui = await reportPane($)
  expect((await texts(ui)).includes('אם ה-Toolkitty חסך לך זמן, קפה סמלי יתקבל בברכה: https://ko-fi.com/toolkitty')).toBe(true)
  expect(await buttonLabels(ui)).toEqual(['העתק', 'סגור'])
  await ui.unmount()
})

test('with the switch off the sessions are not counted and no line shows', SLOW, async ($, on) => {
  const { kv } = boot(on, { ...activity(), 'about:sessions': 80, enabled: { about: false } })
  await start($)
  expect(kv.get('about:sessions')).toBe(80)
  const ui = await reportPane($)
  expect((await texts(ui)).some(x => x.includes('symbolic coffee'))).toBe(false)
  await ui.unmount()
})

test('a report with no activity has no support line', SLOW, async ($, on) => {
  boot(on, { 'about:sessions': 80 })
  await start($)
  const ui = await reportPane($)
  expect((await texts(ui)).some(x => x.includes('symbolic coffee'))).toBe(false)
  await ui.unmount()
})
