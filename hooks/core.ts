import { atom, read, update } from 'claude-code'
import type { Args, Atom, EngineInterface, EventName, EventResult, Frozen, On, RenderElement, RenderInput } from 'claude-code'

import type { Json } from '../types'

/**
 * One feature of Toolkitty: its metadata. Beside it, each feature file
 * exports a top-level `register(on)` that adds the feature's hooks; the engine
 * only lets `on` be passed to a named top-level or imported function, so the
 * hooks module imports and calls each one directly. Every hook a feature adds
 * MUST start with `if (!(await isOn($, feature))) return next(e)` so the
 * switchboard can turn the feature off at run time; timer callbacks check
 * `isOn` the same way.
 */
export type Feature = {
  /** Stable id: lowercase letters and dashes. Also the feature's state slot. */
  id: string
  /** Short title shown in the switchboard, in every language. */
  title: Localized
  /** One line on what the feature does, in every language. */
  description: Localized
  /** Whether the feature starts on before the person has toggled it. */
  defaultOn: boolean
}

/** The shape of a feature file's optional `register` export: hooks whose (event, matcher) no other feature registers. */
export type FeatureRegister = (on: On) => void

/*
 * The engine lets one hooks module register an event without a matcher only
 * once, and the same matcher only once. So the events several features share
 * are registered once, in register.tsx, whose hook calls each feature's
 * exported handler in turn. The handler shapes:
 *
 *   onSessionStart($, e)           session.start, observe
 *   onTurnStart($, e)              turn.start, observe
 *   onTurnComplete($, e)           turn.complete, observe
 *   beforeToolCall($, e)           tool.call (any tool), before the tool runs; a `{ deny }` stops it
 *   afterToolCall($, e, result)    tool.call (any tool), after; returns the (maybe rewritten) result
 *   beforeBashCall / afterBashCall tool.call matched { tool: 'Bash' }
 *   beforeEditCall / afterEditCall tool.call matched { tool: ['Edit', 'Write', 'NotebookEdit'] }
 *   onPromptSubmit($, e)           prompt.submit; returns `e` or a rewritten copy
 *   onPromptCompose($, e, result)  prompt.compose, after; returns the (maybe changed) result
 *   renderBand($, e)               ui.render { component: 'AbovePrompt' }; one line or null
 *   renderDetail($, e: PaneInput)  what a press on the feature's band line shows: the data behind the number, or null
 *
 * Every handler checks `isOn($, feature)` first and does nothing when off.
 */
export type Input<E extends EventName> = Frozen<Args<E>>
export type Output<E extends EventName> = EventResult<E>
export type ToolCallInput = Input<'tool.call'>
export type ToolCallOutput = Output<'tool.call'>
export type BandInput = RenderInput<'AbovePrompt'>
export type BandLine = RenderElement | null
/** The input of the detail pane a band line opens (`renderDetail`). */
export type PaneInput = RenderInput<'Pane'>

/*
 * Languages. Every string a person sees is a `Localized` record with all five
 * languages, written in the file that uses it, and shown through `t(...)`:
 *   const T = { ready: { en: 'Ready', he: 'מוכן', es: 'Listo', fr: 'Prêt', ru: 'Готово', zh: '就绪', ja: '準備完了', pt: 'Pronto', de: 'Bereit', ko: '준비됨' } } as const
 *   $.ui.toast(t(T.ready))
 * Placeholders are `{name}`: t(T.count, { n: 5 }) with en: '{n} actions'.
 * The language is chosen in the switchboard pane and kept in `$.store`.
 */
export const CORE_LANGS = ['en', 'he', 'es', 'fr', 'ru'] as const
/** Added 2026-11-09 for the largest developer communities after English; a string missing one of these falls back to English. */
export const EXTRA_LANGS = ['zh', 'ja', 'pt', 'de', 'ko'] as const
export const LANGS = [...CORE_LANGS, ...EXTRA_LANGS] as const
export type CoreLang = (typeof CORE_LANGS)[number]
export type ExtraLang = (typeof EXTRA_LANGS)[number]
export type Lang = (typeof LANGS)[number]
export type Localized = Readonly<Record<CoreLang, string>> & Readonly<Partial<Record<ExtraLang, string>>>
export const LANG_NAMES: Readonly<Record<Lang, string>> = { en: 'English', he: 'עברית', es: 'Español', fr: 'Français', ru: 'Русский', zh: '中文', ja: '日本語', pt: 'Português', de: 'Deutsch', ko: '한국어' }
/** Right-to-left languages: the band and panes mirror their row direction for these. */
export const RTL_LANGS: readonly Lang[] = ['he']
/** BCP-47 tags per language, for collation, dates and numbers. */
export const LOCALES: Readonly<Record<Lang, string>> = { en: 'en-US', he: 'he-IL', es: 'es-ES', fr: 'fr-FR', ru: 'ru-RU', zh: 'zh-CN', ja: 'ja-JP', pt: 'pt-BR', de: 'de-DE', ko: 'ko-KR' }
/** English names, for prompts that tell a model which language to answer in. */
export const LANG_ENGLISH_NAMES: Readonly<Record<Lang, string>> = { en: 'English', he: 'Hebrew', es: 'Spanish', fr: 'French', ru: 'Russian', zh: 'Simplified Chinese', ja: 'Japanese', pt: 'Brazilian Portuguese', de: 'German', ko: 'Korean' }
/** The text of a Localized in one language, falling back to English when that language has no translation yet. */
export function pick(text: Localized, lang: Lang): string {
  return text[lang] ?? text.en
}

let currentLang: Lang = 'en'

const isLang = (value: unknown): value is Lang => typeof value === 'string' && (LANGS as readonly string[]).includes(value)

/** The language in use now. */
export function language(): Lang {
  return currentLang
}

/** Whether the language in use is written right to left. */
export function isRtl(): boolean {
  return currentLang === 'he'
}

/** `text` in the language in use, its `{placeholders}` filled from `vars`. */
export function t(text: Localized, vars?: Readonly<Record<string, string | number>>): string {
  let out = text[currentLang] ?? text.en
  if (vars !== undefined) {
    for (const [key, value] of Object.entries(vars)) out = out.split(`{${key}}`).join(String(value))
  }
  return out
}

/** Reads the chosen language from the cross-session store; call it first in session.start. */
export async function loadLanguage($: EngineInterface): Promise<Lang> {
  const stored = await $.store.get('language')
  if (isLang(stored)) currentLang = stored
  return currentLang
}

/** Switches the language, keeps it, and redraws every drawing. */
export async function setLanguage($: EngineInterface, lang: Lang): Promise<void> {
  currentLang = lang
  await $.store.set('language', lang)
  $.ui.invalidate('ui.render')
}

/** The language after `lang` in the cycle the pane's button walks. */
export function nextLanguage(lang: Lang): Lang {
  const i = LANGS.indexOf(lang)
  return LANGS[(i + 1) % LANGS.length] ?? 'en'
}

/*
 * Notices: Toolkitty's notification center. Features call `notice(...)`
 * instead of `$.ui.toast(...)`: every notice lands in the `/notices` pane and
 * on the band's bell chip; only an `alert` also pops a toast, so the person
 * sees a toast for a prevented disaster or a limit, never for "formatted
 * x.ts". The value is a shared slot: register.tsx defines the same ref to draw it.
 */
export type NoticeLevel = 'info' | 'warn' | 'alert'
export type Notice = { at: number; level: NoticeLevel; text: string; feature?: string; count: number }
export type Notices = { items: Notice[]; unread: number }
/** Preferences kept in `$.store` under 'notices:prefs': what still toasts, and quiet mode (only alerts toast, nothing else is even counted as unread). */
export type NoticePrefs = { toastFrom: NoticeLevel; quiet: boolean }
const notices = atom({ plugin: 'toolkitty', key: 'slot', id: 'notices' } as const, { items: [], unread: 0 } as Notices) as unknown as Atom<Notices>

const DEDUPE_MS = 5 * 60_000
const INFO_COOLDOWN_MS = 60_000
const LEVEL_RANK: Record<NoticeLevel, number> = { info: 0, warn: 1, alert: 2 }
let prefs: NoticePrefs = { toastFrom: 'alert', quiet: false }
/** Last info notice per feature, for the cooldown. */
const lastInfoAt = new Map<string, number>()

/** Reads the notice preferences from the store; call once in session.start. */
export async function loadNoticePrefs($: EngineInterface): Promise<NoticePrefs> {
  const stored = await $.store.get('notices:prefs')
  if (stored !== null && typeof stored === 'object' && !Array.isArray(stored)) {
    const o = stored as Record<string, unknown>
    const from = o['toastFrom']
    prefs = {
      toastFrom: from === 'info' || from === 'warn' || from === 'alert' ? from : 'alert',
      quiet: o['quiet'] === true,
    }
  }
  return prefs
}

export function noticePrefs(): NoticePrefs {
  return prefs
}

export async function setNoticePrefs($: EngineInterface, next: Partial<NoticePrefs>): Promise<NoticePrefs> {
  prefs = { ...prefs, ...next }
  await $.store.set('notices:prefs', prefs)
  return prefs
}

/**
 * Records a notice. The same feature saying the same text within five minutes
 * becomes one row with a count; an info notice from a feature that spoke in
 * the last minute is dropped; quiet mode keeps only alerts. A toast pops for
 * levels at or above `toastFrom` (alert by default).
 */
export type NoticeOptions = {
  /** Feedback to something the person just pressed or typed: never dropped by the cooldown. */
  immediate?: boolean
  /** Show a toast whatever the toast-level preference: the answer to a button the person pressed. */
  toast?: boolean
}

export async function notice(
  $: EngineInterface,
  level: NoticeLevel,
  text: string,
  feature?: string,
  options?: NoticeOptions,
): Promise<void> {
  const at = await $.clock.now()
  if (prefs.quiet && level !== 'alert') return
  const key = feature ?? '-'
  if (level === 'info' && options?.immediate !== true) {
    const last = lastInfoAt.get(key)
    if (last !== undefined && at - last < INFO_COOLDOWN_MS) return
    lastInfoAt.set(key, at)
  }
  await update($, notices, n => {
    const same = n.items.findIndex(x => x.text === text && x.feature === feature && at - x.at < DEDUPE_MS)
    if (same >= 0) {
      const items = n.items.slice()
      const prev = items[same]
      if (prev !== undefined) items[same] = { ...prev, at, count: prev.count + 1 }
      return { items, unread: n.unread }
    }
    const item: Notice = feature === undefined ? { at, level, text, count: 1 } : { at, level, text, feature, count: 1 }
    return { items: [...n.items.slice(-99), item], unread: n.unread + 1 }
  })
  if (options?.toast === true || LEVEL_RANK[level] >= LEVEL_RANK[prefs.toastFrom]) $.ui.toast(text)
}

export const PLUGIN = 'toolkitty'
export const PANE_ID = 'toolkitty'

/** Which features are on, by id. Persisted in `$.store` under 'enabled'. */
const enabled = atom({ plugin: 'toolkitty', key: 'enabled' } as const, {} as Record<string, boolean>)

/** Whether `feature` is on now. Inside a `ui.render` hook this read subscribes the drawing. */
export async function isOn($: EngineInterface, feature: Pick<Feature, 'id' | 'defaultOn'>): Promise<boolean> {
  const map = await read($, enabled)
  return map[feature.id] ?? feature.defaultOn
}

/** Reads a JSON value from the cross-session store, or `fallback` when unset. */
export async function storeGet<T extends Json>($: EngineInterface, key: string, fallback: T): Promise<T> {
  const value = await $.store.get(key)
  return value === undefined ? fallback : (value as T)
}

export function storeSet($: EngineInterface, key: string, value: Json): Promise<void> {
  return $.store.set(key, value)
}

/** mm:ss, or h:mm:ss past an hour. */
export const clockText = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hrs = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hrs > 0 ? `${hrs}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** A file's extension, lowercase, without the dot; '' when none. */
export const extensionOf = (path: string): string => {
  const base = path.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}
