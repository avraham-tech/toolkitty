import { expect, test } from 'claude-code/testing'
import { LINK_MAX, openerArgv, printHtml, shareLink } from '../hooks/exports'
import { PANE, SHOWN, joined, labels, lastNotice, start, turnDone, turnStart, world } from './harness'

/*
 * The share sheet (pane toolkitty-share) and Print (hooks/exports.tsx), driven through the receipt's Share
 * and Print buttons.
 */

const PLACED = (n: number, surface: 'desktop' | 'terminal' = 'desktop') =>
  ({ plugin: 'toolkitty', component: 'Placed', requestId: `receipt-${n}`, surface, props: { id: `receipt-${n}`, plugin: 'toolkitty' } }) as const
const SHEET = (surface: 'desktop' | 'terminal' = 'desktop') => ({ ...PANE('toolkitty-share'), surface })

const USAGE = { input_tokens: 1000, output_tokens: 234, cache_read_input_tokens: 5000, cache_creation_input_tokens: 100, model: 'claude-sonnet-5-5' }
const STAMP = '2026-11-08-1200'
const DIR = 'C:/proj/toolkitty-exports'
const BS = String.fromCharCode(92)
const OPEN = 'url.dll,FileProtocolHandler'
const enc = encodeURIComponent

async function busyTurn($: any, w: any): Promise<void> {
  w.usage.usd = 1
  await turnStart($)
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/f${i}.ts` })
  w.usage.usd = 1.5
  await turnDone($, 2000, { usage: USAGE })
}

const launches = (w: { ran: string[][] }): string[][] => w.ran.filter(a => a[0] !== 'git' && a[0] !== 'cmd.exe' && a[0] !== 'sh')

/** Presses Share on the receipt row and returns the share text that was copied. */
async function share($: any, w: any, surface: 'desktop' | 'terminal' = 'desktop'): Promise<string> {
  await start($, surface)
  await busyTurn($, w)
  const row = await $.ui.mount(PLACED(1, surface))
  await row.press({ key: 'exp-share-receipt' })
  await row.unmount()
  return w.copies[0]!.text as string
}

const TARGET_KEYS = ['share-whatsapp', 'share-telegram', 'share-x', 'share-linkedin', 'share-reddit', 'share-email'] as const

test('Share saves the picture, copies the text and opens the sheet with the text, the path and the targets', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  const text = await share($, w)
  expect(w.written.map(x => x.path)).toEqual([`${DIR}/receipt-${STAMP}.svg`])
  expect(w.opened.map(o => o.id)).toContain('toolkitty-share')
  const opened = w.opened.find(o => o.id === 'toolkitty-share')!
  expect(opened.focus).toBe(true)
  expect(await lastNotice($)).toBe(`Copied + saved ${SHOWN}receipt-${STAMP}.svg`)

  const ui = await $.ui.mount(SHEET())
  const all = await joined(ui)
  expect(all).toContain('CLAUDE CODE · RECEIPT')
  expect(all).toContain(text.split('\n')[0]!.trim())
  expect(all).toContain(`Picture saved: ${SHOWN}receipt-${STAMP}.svg`)
  expect(all).toContain('Share to')
  expect(all).toContain('Nothing is uploaded. The picture is on disk; attach it in the app you chose.')
  expect(await labels(ui)).toEqual(['Open folder', 'Copy path', 'WhatsApp', 'Telegram', 'X', 'LinkedIn', 'Reddit', 'Email', 'Copy text', 'Print'])
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual([
    'share-open', 'share-path', ...TARGET_KEYS, 'share-copy', 'exp-print-receipt',
  ])
  await ui.unmount()
})

test('each target copies the text first, then launches its prefilled link (rundll32 on Windows) and posts a notice', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  const text = await share($, w)
  const first = text.split('\n')[0]!.trim()
  const rest = text.slice(text.indexOf('\n') + 1).trim()
  const expected: Record<string, string> = {
    'share-whatsapp': `https://wa.me/?text=${enc(text)}`,
    'share-telegram': `https://t.me/share/url?url=${enc('https://github.com/avraham-tech/toolkitty')}&text=${enc(text)}`,
    'share-x': `https://twitter.com/intent/tweet?text=${enc(text)}`,
    'share-linkedin': `https://www.linkedin.com/feed/?shareActive=true&text=${enc(text)}`,
    'share-reddit': `https://www.reddit.com/submit?title=${enc(first)}&text=${enc(rest)}`,
    'share-email': `mailto:?subject=${enc(first)}&body=${enc(text)}`,
  }
  const names: Record<string, string> = { 'share-whatsapp': 'WhatsApp', 'share-telegram': 'Telegram', 'share-x': 'X', 'share-linkedin': 'LinkedIn', 'share-reddit': 'Reddit', 'share-email': 'Email' }
  const ui = await $.ui.mount(SHEET())
  for (const key of TARGET_KEYS) {
    w.ran.length = 0
    w.copies.length = 0
    await ui.press({ key })
    expect(w.copies.map(c => c.text)).toEqual([text])
    expect(launches(w)).toEqual([['rundll32', OPEN, expected[key]!]])
    expect(expected[key]!.length).toBeLessThan(LINK_MAX)
    expect(await lastNotice($)).toBe(`${names[key]!} opened, text copied (rundll32 → 0)`)
  }
  await ui.unmount()
})

async function otherPlatform($: any, on: any, cwd: string, program: string): Promise<void> {
  const w = world(on, { cwd })
  await share($, w)
  const ui = await $.ui.mount(SHEET())
  w.ran.length = 0
  await ui.press({ key: 'share-whatsapp' })
  const url = `https://wa.me/?text=${enc(w.copies[0]!.text)}`
  expect(launches(w)).toEqual([[program, url]])
  await ui.unmount()
}

test('macOS uses open', { timeoutMs: 30_000 }, async ($, on) => {
  await otherPlatform($, on, '/Users/me/proj', 'open')
})

test('Linux uses xdg-open', { timeoutMs: 30_000 }, async ($, on) => {
  await otherPlatform($, on, '/home/me/proj', 'xdg-open')
})

test('a launch that fails posts a warning with the detail; the text was still copied', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  const text = await share($, w)
  const ui = await $.ui.mount(SHEET())
  w.runExit = 3
  w.copies.length = 0
  await ui.press({ key: 'share-telegram' })
  expect(w.copies.map(c => c.text)).toEqual([text])
  expect(await lastNotice($)).toBe('Could not open Telegram (rundll32 → 3). The text is on the clipboard.')
  w.runFail = true
  await ui.press({ key: 'share-reddit' })
  expect(await lastNotice($)).toMatch(/^Could not open Reddit \(.+\)\. The text is on the clipboard\.$/)
  await ui.unmount()
})

test('Copy text, Open folder and Copy path inside the sheet', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.dirs[DIR] = []
  const text = await share($, w)
  const ui = await $.ui.mount(SHEET())
  w.copies.length = 0
  await ui.press({ key: 'share-copy' })
  expect(w.copies.map(c => c.text)).toEqual([text])
  expect(await lastNotice($)).toBe('Copied')
  await ui.press({ key: 'share-path' })
  expect(w.copies.map(c => c.text)[1]).toBe(`${SHOWN}receipt-${STAMP}.svg`)
  expect(await lastNotice($)).toBe(`Copied ${SHOWN}receipt-${STAMP}.svg`)
  w.ran.length = 0
  await ui.press({ key: 'share-open' })
  expect(w.ran).toEqual([['cmd.exe', '/c', 'start', '', `C:${BS}proj${BS}toolkitty-exports`]])
  expect(await lastNotice($)).toBe(`Opening C:${BS}proj${BS}toolkitty-exports (cmd.exe → 0)`)
  await ui.unmount()
})

test('terminal: the same sheet, the targets are plain Buttons', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await share($, w, 'terminal')
  const ui = await $.ui.mount(SHEET('terminal'))
  expect(await labels(ui)).toEqual(['Open folder', 'Copy path', 'WhatsApp', 'Telegram', 'X', 'LinkedIn', 'Reddit', 'Email', 'Copy text', 'Print'])
  w.ran.length = 0
  await ui.press({ key: 'share-x' })
  expect(launches(w)[0]![0]).toBe('rundll32')
  expect(w.copies[w.copies.length - 1]!.surface).toBe('terminal')
  await ui.unmount()
})

test('the sheet with nothing shared says so; with the picture unsaved it says the text can still be shared', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const empty = await $.ui.mount(SHEET())
  expect(await joined(empty)).toContain('Nothing to share yet')
  await empty.unmount()
  w.failWrite = true
  await busyTurn($, w)
  const row = await $.ui.mount(PLACED(1))
  await row.press({ key: 'exp-share-receipt' })
  await row.unmount()
  const ui = await $.ui.mount(SHEET())
  expect(await joined(ui)).toContain('The picture was not saved. The text can still be shared.')
  await ui.unmount()
})

test('Share still works without a surface to show the sheet on', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.failOpen = true
  await share($, w)
  expect(w.written.length).toBe(1)
  expect(await lastNotice($)).toBe(`Copied + saved ${SHOWN}receipt-${STAMP}.svg`)
})

test('Hebrew sheet labels and notices', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  await share($, w)
  const ui = await $.ui.mount(SHEET())
  expect(await labels(ui)).toEqual(['פתח תיקייה', 'העתק נתיב', 'WhatsApp', 'Telegram', 'X', 'LinkedIn', 'Reddit', 'אימייל', 'העתק טקסט', 'הדפס'])
  const all = await joined(ui)
  expect(all).toContain('שיתוף אל')
  expect(all).toContain('שום דבר לא מועלה. התמונה נמצאת בדיסק; צרפו אותה באפליקציה שבחרתם.')
  expect(all).toContain(`התמונה נשמרה: ${SHOWN}receipt-${STAMP}.svg`)
  await ui.press({ key: 'share-email' })
  expect(await lastNotice($)).toBe('אימייל נפתח, הטקסט הועתק (rundll32 → 0)')
  await ui.unmount()
})

test('Japanese sheet labels', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'ja' } })
  await share($, w)
  const ui = await $.ui.mount(SHEET())
  expect(await labels(ui)).toEqual(['フォルダーを開く', 'パスをコピー', 'WhatsApp', 'Telegram', 'X', 'LinkedIn', 'Reddit', 'メール', 'テキストをコピー', '印刷'])
  expect(await joined(ui)).toContain('何もアップロードされません。画像はディスクにあります。選んだアプリで添付してください。')
  await ui.unmount()
})

test('links: encoding, the Telegram link target, and cut-to-fit with an ellipsis under 2,000 characters', () => {
  const text = 'Title & more\nline two: 100% #tag\nhttps://x.y/?a=b&c=d'
  expect(shareLink('whatsapp', text)).toEqual({ url: `https://wa.me/?text=${enc(text)}`, isTrimmed: false })
  expect(shareLink('whatsapp', text).url).toContain('Title%20%26%20more%0Aline%20two%3A%20100%25%20%23tag')
  expect(shareLink('reddit', text).url).toBe(`https://www.reddit.com/submit?title=${enc('Title & more')}&text=${enc('line two: 100% #tag\nhttps://x.y/?a=b&c=d')}`)
  expect(shareLink('email', text).url).toBe(`mailto:?subject=${enc('Title & more')}&body=${enc(text)}`)
  expect(shareLink('telegram', text).url.startsWith(`https://t.me/share/url?url=${enc('https://github.com/avraham-tech/toolkitty')}&text=`)).toBe(true)
  const long = `Headline\n${'word & più '.repeat(400)}END`
  for (const target of ['whatsapp', 'telegram', 'x', 'linkedin', 'reddit', 'email'] as const) {
    const r = shareLink(target, long)
    expect(r.isTrimmed).toBe(true)
    expect(r.url.length).toBeLessThanOrEqual(LINK_MAX)
    expect(r.url.length).toBeGreaterThan(LINK_MAX - 40)
    expect(r.url).toContain(enc('…'))
    expect(r.url).not.toContain('END')
  }
})

test('openerArgv per platform', () => {
  expect(openerArgv('windows', 'https://a/?x=1&y=2')).toEqual(['rundll32', OPEN, 'https://a/?x=1&y=2'])
  expect(openerArgv('mac', 'u')).toEqual(['open', 'u'])
  expect(openerArgv('linux', 'u')).toEqual(['xdg-open', 'u'])
})

test('Print on the receipt bar: writes <kind>-<stamp>.print.html with the SVG inline and the print script, launches it, says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  const row = await $.ui.mount(PLACED(1))
  expect(await labels(row)).toContain('Print')
  w.ran.length = 0
  await row.press({ key: 'exp-print-receipt' })
  const page = w.written.find(x => x.path === `${DIR}/receipt-${STAMP}.print.html`)!
  expect(page).toBeDefined()
  expect(page.text).toContain('<svg')
  expect(page.text).toContain('CLAUDE CODE · RECEIPT')
  expect(page.text).toContain('@page { margin: 12mm }')
  expect(page.text).toContain('@media print')
  expect(page.text).toContain("<script>window.addEventListener('load', () => setTimeout(() => window.print(), 300))</script>")
  expect(page.text).not.toMatch(/(src|href)=|@import|<link|url\(http/)
  expect(launches(w)).toEqual([['rundll32', OPEN, `${SHOWN}receipt-${STAMP}.print.html`]])
  expect(await lastNotice($)).toBe(`Print page opened: ${SHOWN}receipt-${STAMP}.print.html`)
  await row.unmount()
})

test('Print from the sheet uses the shared text under the picture; a launch failure reports the exit code', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  const text = await share($, w)
  const ui = await $.ui.mount(SHEET())
  w.runExit = 5
  await ui.press({ key: 'exp-print-receipt' })
  const page = w.written.find(x => x.path.endsWith('.print.html'))!
  expect(page.text).toContain('<svg')
  expect(page.text).toContain('Get yours: claude plugin install toolkitty --marketplace avraham-tech/toolkitty')
  expect(text).toContain('Get yours: claude plugin install toolkitty --marketplace avraham-tech/toolkitty')
  expect(await lastNotice($)).toBe(`Could not open the print page: ${SHOWN}receipt-${STAMP}.print.html (exit 5)`)
  await ui.unmount()
})

test('Print on the terminal without a picture: the page holds the text in a <pre>', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: { percent: 42 } })
  await start($, 'terminal')
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'terminal' })
  await ui.press({ key: 'exp-print-aquarium' })
  const page = w.written.find(x => x.path === `${DIR}/aquarium-${STAMP}.print.html`)!
  expect(page.text).toContain('<pre class="text">')
  expect(page.text).toContain('Aquarium: 42%')
  expect(page.text).not.toContain('<svg')
  expect(page.text).toContain('window.print()')
  expect(launches(w)).toEqual([['rundll32', OPEN, `${SHOWN}aquarium-${STAMP}.print.html`]])
  await ui.unmount()
})

test('Print label in Hebrew and Japanese on the bar; the Hebrew page is rtl and the Hebrew notice is used', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' }, usage: { percent: 10 } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect(await labels(ui)).toContain('הדפס')
  await ui.press({ key: 'exp-print-aquarium' })
  expect(await lastNotice($)).toBe(`דף ההדפסה נפתח: ${SHOWN}aquarium-${STAMP}.print.html`)
  const page = w.written.find(x => x.path.endsWith('.print.html'))!
  expect(page.text).toContain('<html lang="he" dir="rtl">')
  await ui.unmount()
  expect(printHtml('k', '<svg></svg>', 'a<b')).toContain('a&lt;b')
})

test('Print label in Japanese', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'ja' }, usage: { percent: 10 } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect(await labels(ui)).toEqual(['SVG を保存', 'テキストをコピー', '印刷', 'フォルダーを開く', 'パスをコピー'])
  await ui.press({ key: 'exp-print-aquarium' })
  expect(await lastNotice($)).toBe(`印刷ページを開きました：${SHOWN}aquarium-${STAMP}.print.html`)
  await ui.unmount()
})

test('a second Print in the same minute never overwrites the first page', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: { percent: 10 } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  await ui.press({ key: 'exp-print-aquarium' })
  await ui.press({ key: 'exp-print-aquarium' })
  expect(w.written.map(x => x.path)).toEqual([`${DIR}/aquarium-${STAMP}.print.html`, `${DIR}/aquarium-${STAMP}-2.print.html`])
  await ui.unmount()
})
