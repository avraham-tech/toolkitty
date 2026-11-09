import { expect, test } from 'claude-code/testing'
import { SLOW, activity, aboutPane, boot, buttonKeys, buttonLabels, noticeTexts, reportPane, start, texts } from './about-kit'

// This file runs against the credits exactly as shipped: author, repository and Ko-fi links are all real.

test('loads and registers /about', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(seen.commands).toContain('about')
  expect(seen.toasts.filter(x => !x.startsWith('Toolkitty loaded'))).toEqual([])
})

test('/about opens the pane focused and closable, with any argument', SLOW, async ($, on) => {
  const { opens } = boot(on)
  await start($)
  const r = await $.command.run({ command: 'about', args: '' })
  expect(r.text).toBe('Opened the About pane.')
  expect(opens('about')).toEqual([{ id: 'about', title: 'About Toolkitty', focus: true, closeOnEscape: true }])
  expect((await $.command.run({ command: 'about', args: 'anything' })).text).toBe('Opened the About pane.')
})

test('/about in Hebrew', SLOW, async ($, on) => {
  const { opens } = boot(on, { language: 'he' })
  await start($)
  const r = await $.command.run({ command: 'about', args: '' })
  expect(r.text).toBe('חלונית האודות נפתחה.')
  expect(opens('about')[0].title).toBe('אודות Toolkitty')
})

test('with the switch off the command answers the off text and the pane says it is off', SLOW, async ($, on) => {
  const { opens } = boot(on, { enabled: { about: false } })
  await start($)
  const r = await $.command.run({ command: 'about', args: '' })
  expect(r.text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(opens('about')).toHaveLength(0)
  const ui = await aboutPane($)
  expect(await texts(ui)).toEqual(['The About pane is off.'])
  await ui.unmount()
})

for (const surface of ['desktop', 'terminal'] as const) {
  test(`the pane with the real author credits (${surface}): facts, support section, copy actions`, SLOW, async ($, on) => {
    boot(on)
    await start($, surface)
    const ui = await aboutPane($, surface)
    const out = await texts(ui)
    expect(out).toContain('About Toolkitty')
    expect(out).toContain('0.1.0')
    expect(out).toContain('Toolkitty')
    expect(out).toContain('Version 0.1.0')
    expect(out).toContain('Made by Avraham Shemesh')
    const count = out.map(x => /^(\d+) features$/.exec(x)).find(m => m !== null && m !== undefined)
    expect(count).toBeDefined()
    expect(Number(count?.[1])).toBeGreaterThan(60)
    expect(out).toContain('Languages: English, עברית, Español, Français, Русский, 中文, 日本語, Português, Deutsch, 한국어')
    expect(out).toContain('License: MIT')
    expect(out).toContain('Repository: https://github.com/avraham-tech/toolkitty')
    // the author line and the support section are real; the placeholder repo link hides nothing else
    expect(out).toContain('Author: https://github.com/avraham-tech')
    expect(out).toContain('Support')
    expect(out).toContain('Toolkitty is free. If it saved you time, a symbolic coffee (1 to 5 dollars) is welcome. There is no obligation and nothing is locked.')
    expect(out).toContain('https://ko-fi.com/toolkitty')
    expect(out).toContain('https://ko-fi.com/toolkitty')
    expect(await buttonKeys(ui)).toEqual(['about-copy-repo', 'about-copy-support', 'about-copy-thanks'])
    expect(await buttonLabels(ui)).toEqual(['Copy repo link', 'Copy support link', 'Copy "thanks" post'])
    await ui.unmount()
  })
}

test('Copy repo link and Copy "thanks" post put the right text on the clipboard and say so', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  const ui = await aboutPane($)
  await ui.press({ key: 'about-copy-repo' })
  expect(seen.copies).toEqual([{ text: 'https://github.com/avraham-tech/toolkitty', surface: 'desktop' }])
  expect(await noticeTexts($)).toContain('Repo link copied')
  await ui.press({ key: 'about-copy-thanks' })
  expect(seen.copies).toHaveLength(2)
  const post = seen.copies[1]?.text ?? ''
  expect(post.startsWith('I have been using Toolkitty')).toBe(true)
  expect(post).toContain('https://github.com/avraham-tech/toolkitty')
  expect(post.length).toBeLessThan(320)
  expect(await noticeTexts($)).toContain('Post copied, thank you!')
  // a notice, never a toast
  expect(seen.toasts.filter(x => !x.startsWith('Toolkitty loaded'))).toEqual([])
  await ui.unmount()
})

test('Copy support link puts the sponsors link on the clipboard and says so', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  const ui = await aboutPane($)
  await ui.press({ key: 'about-copy-support' })
  expect(seen.copies).toEqual([{ text: 'https://ko-fi.com/toolkitty', surface: 'desktop' }])
  expect(await noticeTexts($)).toContain('Support link copied')
  await ui.unmount()
})

test('a refused or failing clipboard is reported, not thrown', SLOW, async ($, on) => {
  const { seen, plan } = boot(on)
  await start($)
  const ui = await aboutPane($)
  plan.copy = 'refused'
  await ui.press({ key: 'about-copy-repo' })
  await new Promise(r => setTimeout(r, 20))
  expect((await noticeTexts($)).filter(x => x.startsWith('Could not copy'))).toEqual(['Could not copy'])
  plan.copy = 'throw'
  await ui.press({ key: 'about-copy-thanks' })
  await new Promise(r => setTimeout(r, 20))
  expect(seen.copies).toHaveLength(2)
  // the same warning again inside five minutes folds into the same row with a count
  expect((await noticeTexts($)).filter(x => x.startsWith('Could not copy'))).toEqual(['Could not copy ×2'])
  await ui.unmount()
})

test('the pane in Hebrew', SLOW, async ($, on) => {
  boot(on, { language: 'he' })
  await start($)
  const ui = await aboutPane($)
  const out = await texts(ui)
  expect(out).toContain('גרסה 0.1.0')
  expect(out).toContain('נוצר על ידי Avraham Shemesh')
  expect(out).toContain('מחבר: https://github.com/avraham-tech')
  expect(out).toContain('תמיכה')
  expect(out).toContain('שפות: English, עברית, Español, Français, Русский, 中文, 日本語, Português, Deutsch, 한국어')
  expect(out).toContain('רישיון: MIT')
  expect(out.some(x => /^\d+ שכלולים$/.test(x))).toBe(true)
  expect(await buttonLabels(ui)).toEqual(['העתק קישור למאגר', 'העתק קישור לתמיכה', 'העתק פוסט תודה'])
  await ui.press({ key: 'about-copy-repo' })
  expect(await noticeTexts($)).toContain('הקישור למאגר הועתק')
  await ui.press({ key: 'about-copy-support' })
  expect(await noticeTexts($)).toContain('קישור התמיכה הועתק')
  await ui.unmount()
})

test('an unreadable plugin.json shows the version as unknown', SLOW, async ($, on) => {
  const { plan } = boot(on)
  plan.manifest = null
  await start($)
  const ui = await aboutPane($)
  const out = await texts(ui)
  expect(out).toContain('Version unknown')
  await ui.unmount()
})

test('the version is read from the plugin folder .claude-plugin/plugin.json', SLOW, async ($, on) => {
  const { seen, plan } = boot(on)
  plan.manifest = JSON.stringify({ name: 'toolkitty', version: '9.8.7' })
  await start($)
  const ui = await aboutPane($)
  expect(await texts(ui)).toContain('Version 9.8.7')
  expect(seen.reads.some(p => p.replace(/\\/g, '/').endsWith('/.claude-plugin/plugin.json'))).toBe(true)
  await ui.unmount()
})

test('every session start counts once in about:sessions', SLOW, async ($, on) => {
  const { kv } = boot(on)
  expect(kv.get('about:sessions')).toBeUndefined()
  await start($)
  expect(kv.get('about:sessions')).toBe(1)
  await start($)
  await start($)
  expect(kv.get('about:sessions')).toBe(3)
})

test('with the switch off nothing is counted', SLOW, async ($, on) => {
  const { kv } = boot(on, { enabled: { about: false }, 'about:sessions': 5 })
  await start($)
  await start($)
  expect(kv.get('about:sessions')).toBe(5)
})

test('after 30 sessions the weekly report shows the support line once, and Dismiss removes it for good', SLOW, async ($, on) => {
  const { kv } = boot(on, { ...activity(), 'about:sessions': 29 })
  await start($)
  expect(kv.get('about:sessions')).toBe(30)
  let ui = await reportPane($)
  let out = await texts(ui)
  expect(out).toContain('What Toolkitty did for you')
  expect(out).toContain('If Toolkitty saved you time, a symbolic coffee is welcome: https://ko-fi.com/toolkitty')
  expect(await buttonKeys(ui)).toContain('about-dismiss-support')
  await ui.press({ key: 'about-dismiss-support' })
  expect(kv.get('about:supportDismissed')).toBe(true)
  await ui.redraw()
  out = await texts(ui)
  expect(out.some(x => x.includes('symbolic coffee'))).toBe(false)
  expect(await buttonKeys(ui)).not.toContain('about-dismiss-support')
  await ui.unmount()
  // later sessions do not bring it back
  await start($)
  ui = await reportPane($)
  expect((await texts(ui)).some(x => x.includes('symbolic coffee'))).toBe(false)
  await ui.unmount()
})

test('the support line is not shown before 30 sessions', SLOW, async ($, on) => {
  const { kv } = boot(on, { ...activity(), 'about:sessions': 28 })
  await start($)
  expect(kv.get('about:sessions')).toBe(29)
  const ui = await reportPane($)
  expect((await texts(ui)).some(x => x.includes('symbolic coffee'))).toBe(false)
  expect(await buttonKeys(ui)).not.toContain('about-dismiss-support')
  await ui.unmount()
})

test('the support line is in the language in use (Hebrew)', SLOW, async ($, on) => {
  boot(on, { ...activity(), language: 'he', 'about:sessions': 99 })
  await start($)
  const ui = await reportPane($)
  expect(await texts(ui)).toContain('אם ה-Toolkitty חסך לך זמן, קפה סמלי יתקבל בברכה: https://ko-fi.com/toolkitty')
  expect(await buttonLabels(ui)).toContain('סגור')
  await ui.unmount()
})

test('the weekly report is unchanged for a person with few sessions', SLOW, async ($, on) => {
  boot(on, activity())
  await start($)
  const ui = await reportPane($)
  expect(await buttonKeys(ui)).toEqual(['report-copy'])
  await ui.unmount()
})

test('Toolkitty never raises a notice or toast for the support reminder', SLOW, async ($, on) => {
  const { seen } = boot(on, { ...activity(), 'about:sessions': 99 })
  await start($)
  const ui = await reportPane($)
  await ui.unmount()
  expect(seen.toasts.filter(x => /coffee|support/i.test(x))).toEqual([])
  expect((await noticeTexts($)).filter(x => /coffee/i.test(x))).toEqual([])
})
