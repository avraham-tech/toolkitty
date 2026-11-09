import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, Timer } from 'claude-code'

import { clockText, isOn, notice, storeGet, storeSet, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput } from '../core'
import { publish, retractAll } from '../signals'
import { ICONS, short } from '../ui'
import type { Chip } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: {
    en: 'Cache countdown',
    he: 'ספירה לאחור של המטמון',
    es: 'Cuenta atrás de la caché',
    fr: 'Compte à rebours du cache',
    ru: 'Обратный отсчёт кэша',
    zh: '缓存倒计时',
    ja: 'キャッシュカウントダウン',
    pt: 'Contagem do cache',
    de: 'Cache-Countdown',
    ko: '캐시 카운트다운',
  },
  description: {
    en: 'Shows how long the prompt cache stays warm after the last turn, and warns before a cold-cache send of a large context.',
    he: 'מציג כמה זמן מטמון הפרומפט נשאר חם אחרי התור האחרון, ומזהיר לפני שליחה עם מטמון קר והקשר גדול.',
    es: 'Muestra cuánto tiempo sigue caliente la caché del prompt tras el último turno y avisa antes de enviar con la caché fría y un contexto grande.',
    fr: 'Affiche combien de temps le cache du prompt reste chaud après le dernier tour et prévient avant un envoi à cache froid avec un gros contexte.',
    ru: 'Показывает, как долго кэш промпта остаётся тёплым после последнего хода, и предупреждает об отправке с холодным кэшем при большом контексте.',
    zh: '显示上一轮之后提示缓存还能保持多久的热状态，并在对大上下文进行冷缓存发送前发出警告。',
    ja: '最後のターンの後、プロンプトキャッシュがあとどれくらい温かいままかを表示し、大きなコンテキストをキャッシュが冷えた状態で送信する前に警告します。',
    pt: 'Mostra por quanto tempo o cache do prompt continua quente após o último turno e avisa antes de um envio com cache frio de um contexto grande.',
    de: 'Zeigt, wie lange der Prompt-Cache nach dem letzten Durchgang warm bleibt, und warnt vor dem Senden eines großen Kontexts bei kaltem Cache.',
    ko: '마지막 턴 이후 프롬프트 캐시가 얼마나 오래 따뜻하게 유지되는지 보여 주고, 큰 컨텍스트를 캐시가 식은 채로 보내기 전에 경고합니다.',
  },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty',
    ru: 'Функция отключена; включите её в панели /toolkitty',
    zh: '该功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  warm: {
    en: 'cache ⏱ {time}',
    he: 'מטמון ⏱ {time}',
    es: 'caché ⏱ {time}',
    fr: 'cache ⏱ {time}',
    ru: 'кэш ⏱ {time}',
    zh: '缓存 ⏱ {time}',
    ja: 'キャッシュ ⏱ {time}',
    pt: 'cache ⏱ {time}',
    de: 'Cache ⏱ {time}',
    ko: '캐시 ⏱ {time}',
  },
  chipWarm: { en: 'cache {time}', he: 'מטמון {time}', es: 'caché {time}', fr: 'cache {time}', ru: 'кэш {time}', zh: '缓存 {time}', ja: 'キャッシュ {time}', pt: 'cache {time}', de: 'Cache {time}', ko: '캐시 {time}' },
  cold: {
    en: 'cache cold',
    he: 'המטמון קר',
    es: 'caché fría',
    fr: 'cache froid',
    ru: 'кэш холодный',
    zh: '缓存已冷',
    ja: 'キャッシュ冷却',
    pt: 'cache frio',
    de: 'Cache kalt',
    ko: '캐시 식음',
  },
  warnPercent: {
    en: 'The prompt cache is cold: this send re-reads the whole context ({percent}% of the window).',
    he: 'מטמון הפרומפט קר: השליחה הזו קוראת מחדש את כל ההקשר ({percent}% מהחלון).',
    es: 'La caché del prompt está fría: este envío vuelve a leer todo el contexto ({percent}% de la ventana).',
    fr: 'Le cache du prompt est froid : cet envoi relit tout le contexte ({percent} % de la fenêtre).',
    ru: 'Кэш промпта холодный: эта отправка заново читает весь контекст ({percent}% окна).',
    zh: '提示缓存已冷：此次发送将重新读取整个上下文（占窗口的 {percent}%）。',
    ja: 'プロンプトキャッシュが冷えています: この送信ではコンテキスト全体が再読み込みされます（ウィンドウの {percent}%）。',
    pt: 'O cache do prompt está frio: este envio relê todo o contexto ({percent}% da janela).',
    de: 'Der Prompt-Cache ist kalt: Dieses Senden liest den gesamten Kontext neu ein ({percent} % des Fensters).',
    ko: '프롬프트 캐시가 식었습니다: 이번 전송에서 컨텍스트 전체를 다시 읽습니다(창의 {percent}%).',
  },
  warnTokens: {
    en: 'The prompt cache is cold: this send re-reads the whole context ({percent}% of the window, {tokens} tokens).',
    he: 'מטמון הפרומפט קר: השליחה הזו קוראת מחדש את כל ההקשר ({percent}% מהחלון, {tokens} טוקנים).',
    es: 'La caché del prompt está fría: este envío vuelve a leer todo el contexto ({percent}% de la ventana, {tokens} tokens).',
    fr: 'Le cache du prompt est froid : cet envoi relit tout le contexte ({percent} % de la fenêtre, {tokens} tokens).',
    ru: 'Кэш промпта холодный: эта отправка заново читает весь контекст ({percent}% окна, токенов: {tokens}).',
    zh: '提示缓存已冷：此次发送将重新读取整个上下文（占窗口的 {percent}%，{tokens} 个 token）。',
    ja: 'プロンプトキャッシュが冷えています: この送信ではコンテキスト全体が再読み込みされます（ウィンドウの {percent}%、{tokens} トークン）。',
    pt: 'O cache do prompt está frio: este envio relê todo o contexto ({percent}% da janela, {tokens} tokens).',
    de: 'Der Prompt-Cache ist kalt: Dieses Senden liest den gesamten Kontext neu ein ({percent} % des Fensters, {tokens} Tokens).',
    ko: '프롬프트 캐시가 식었습니다: 이번 전송에서 컨텍스트 전체를 다시 읽습니다(창의 {percent}%, {tokens} 토큰).',
  },
  cmdDesc: {
    en: 'Sets the prompt cache lifetime used by the countdown (5m or 1h)',
    he: 'קובע את משך חיי מטמון הפרומפט לספירה לאחור (5m או 1h)',
    es: 'Define la duración de la caché del prompt para la cuenta atrás (5m o 1h)',
    fr: 'Définit la durée de vie du cache du prompt pour le compte à rebours (5m ou 1h)',
    ru: 'Задаёт время жизни кэша промпта для отсчёта (5m или 1h)',
    zh: '设置倒计时使用的提示缓存时长（5m 或 1h）',
    ja: 'カウントダウンで使うプロンプトキャッシュの有効時間を設定します（5m または 1h）',
    pt: 'Define a duração do cache do prompt usada na contagem (5m ou 1h)',
    de: 'Legt die für den Countdown genutzte Lebensdauer des Prompt-Caches fest (5m oder 1h)',
    ko: '카운트다운에 쓰는 프롬프트 캐시 유지 시간을 설정합니다(5m 또는 1h)',
  },
  cmdHint: {
    en: '[5m|1h]',
    he: '[5m|1h]',
    es: '[5m|1h]',
    fr: '[5m|1h]',
    ru: '[5m|1h]',
    zh: '[5m|1h]',
    ja: '[5m|1h]',
    pt: '[5m|1h]',
    de: '[5m|1h]',
    ko: '[5m|1h]',
  },
  current: {
    en: 'Prompt cache lifetime: {ttl}. Change it with /cache-ttl 5m or /cache-ttl 1h.',
    he: 'משך חיי מטמון הפרומפט: {ttl}. לשינוי: /cache-ttl 5m או /cache-ttl 1h.',
    es: 'Duración de la caché del prompt: {ttl}. Cámbiala con /cache-ttl 5m o /cache-ttl 1h.',
    fr: 'Durée de vie du cache du prompt : {ttl}. Modifiez-la avec /cache-ttl 5m ou /cache-ttl 1h.',
    ru: 'Время жизни кэша промпта: {ttl}. Измените командой /cache-ttl 5m или /cache-ttl 1h.',
    zh: '提示缓存时长：{ttl}。可用 /cache-ttl 5m 或 /cache-ttl 1h 更改。',
    ja: 'プロンプトキャッシュの有効時間: {ttl}。/cache-ttl 5m または /cache-ttl 1h で変更できます。',
    pt: 'Duração do cache do prompt: {ttl}. Altere com /cache-ttl 5m ou /cache-ttl 1h.',
    de: 'Lebensdauer des Prompt-Caches: {ttl}. Ändere sie mit /cache-ttl 5m oder /cache-ttl 1h.',
    ko: '프롬프트 캐시 유지 시간: {ttl}. /cache-ttl 5m 또는 /cache-ttl 1h로 바꿀 수 있습니다.',
  },
  changed: {
    en: 'Prompt cache lifetime set to {ttl}.',
    he: 'משך חיי מטמון הפרומפט נקבע ל-{ttl}.',
    es: 'Duración de la caché del prompt establecida en {ttl}.',
    fr: 'Durée de vie du cache du prompt réglée sur {ttl}.',
    ru: 'Время жизни кэша промпта установлено: {ttl}.',
    zh: '提示缓存时长已设为 {ttl}。',
    ja: 'プロンプトキャッシュの有効時間を {ttl} に設定しました。',
    pt: 'Duração do cache do prompt definida para {ttl}.',
    de: 'Lebensdauer des Prompt-Caches auf {ttl} gesetzt.',
    ko: '프롬프트 캐시 유지 시간을 {ttl}(으)로 설정했습니다.',
  },
  invalid: {
    en: 'Unknown value. Use /cache-ttl 5m or /cache-ttl 1h.',
    he: 'ערך לא מוכר. השתמש ב-/cache-ttl 5m או /cache-ttl 1h.',
    es: 'Valor desconocido. Usa /cache-ttl 5m o /cache-ttl 1h.',
    fr: 'Valeur inconnue. Utilisez /cache-ttl 5m ou /cache-ttl 1h.',
    ru: 'Неизвестное значение. Используйте /cache-ttl 5m или /cache-ttl 1h.',
    zh: '值无效。请使用 /cache-ttl 5m 或 /cache-ttl 1h。',
    ja: '不明な値です。/cache-ttl 5m または /cache-ttl 1h を使ってください。',
    pt: 'Valor desconhecido. Use /cache-ttl 5m ou /cache-ttl 1h.',
    de: 'Unbekannter Wert. Verwende /cache-ttl 5m oder /cache-ttl 1h.',
    ko: '알 수 없는 값입니다. /cache-ttl 5m 또는 /cache-ttl 1h를 사용하세요.',
  },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  dWarm: { en: 'Cache is warm for another {time}.', he: 'המטמון חם עוד {time}.', es: 'La caché sigue caliente {time} más.', fr: 'Le cache reste chaud encore {time}.', ru: 'Кэш будет тёплым ещё {time}.', zh: '缓存还能保持热状态 {time}。', ja: 'キャッシュはあと {time} 温かいままです。', pt: 'O cache continua quente por mais {time}.', de: 'Der Cache bleibt noch {time} warm.', ko: '캐시가 앞으로 {time} 동안 따뜻하게 유지됩니다.' },
  dCold: { en: 'Cache went cold {ago} ago.', he: 'המטמון התקרר לפני {ago}.', es: 'La caché se enfrió hace {ago}.', fr: 'Le cache s\'est refroidi il y a {ago}.', ru: 'Кэш остыл {ago} назад.', zh: '缓存已在 {ago}前变冷。', ja: 'キャッシュは {ago}前に冷えました。', pt: 'O cache esfriou há {ago}.', de: 'Der Cache ist vor {ago} kalt geworden.', ko: '캐시는 {ago} 전에 식었습니다.' },
  dNoTurn: { en: 'No turn has finished yet, so the cache has not started.', he: 'עדיין לא הסתיים תור, ולכן המטמון לא התחיל.', es: 'Aún no ha terminado ningún turno, así que la caché no ha empezado.', fr: 'Aucun tour n\'est encore terminé : le cache n\'a pas démarré.', ru: 'Ни один ход ещё не завершён, кэш не начат.', zh: '还没有完成任何一轮对话，因此缓存尚未开始。', ja: 'まだターンが完了していないため、キャッシュは始まっていません。', pt: 'Nenhum turno terminou ainda, então o cache não começou.', de: 'Es wurde noch kein Durchgang abgeschlossen, daher hat der Cache nicht begonnen.', ko: '아직 끝난 턴이 없어 캐시가 시작되지 않았습니다.' },
  dWarnedHead: { en: 'Cold sends warned about: {n}', he: 'שליחות במטמון קר שהוזהר עליהן: {n}', es: 'Envíos con caché fría avisados: {n}', fr: 'Envois à cache froid signalés : {n}', ru: 'Отправок с холодным кэшем с предупреждением: {n}', zh: '已警告的冷缓存发送：{n}', ja: '警告した冷えたキャッシュでの送信: {n}', pt: 'Envios com cache frio avisados: {n}', de: 'Gewarnte Sendungen bei kaltem Cache: {n}', ko: '경고한 캐시 식은 전송: {n}' },
  dSend: { en: '{ago} · context {percent}%', he: '{ago} · הקשר {percent}%', es: '{ago} · contexto {percent}%', fr: '{ago} · contexte {percent}%', ru: '{ago} · контекст {percent}%', zh: '{ago} · 上下文 {percent}%', ja: '{ago} · コンテキスト {percent}%', pt: '{ago} · contexto {percent}%', de: '{ago} · Kontext {percent} %', ko: '{ago} · 컨텍스트 {percent}%' },
  dTokens: { en: '{tokens} tokens', he: '{tokens} טוקנים', es: '{tokens} tokens', fr: '{tokens} tokens', ru: '{tokens} токенов', zh: '{tokens} 个 token', ja: '{tokens} トークン', pt: '{tokens} tokens', de: '{tokens} Tokens', ko: '{tokens} 토큰' },
} as const

type Warned = { at: number; percent: number; tokens: number | null }
type Cache = { lastAt: number | null; now: number; ttlMs: number; warned: Warned[] }

const MIN_MS = 60 * 1000
const HOUR_MS = 60 * MIN_MS
const WARN_PERCENT = 30
const STORE_KEY = 'cache-countdown:ttl'

const cache = atom({ plugin: 'toolkitty', key: 'slot', id: 'cache-countdown' } as const, {
  lastAt: null,
  now: 0,
  ttlMs: 5 * MIN_MS,
  warned: [],
} as Cache) as unknown as Atom<Cache>

export const feature: Feature = {
  id: 'cache-countdown',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

let ticker: Timer | undefined

const ttlName = (ms: number): string => (ms >= HOUR_MS ? '1h' : '5m')
const countText = (n: number): string => n.toLocaleString('en-US')

/** Says how long the prompt cache stays warm: seconds left, 0 once it is cold. */
async function publishCache($: EngineInterface, c: Cache, now: number): Promise<void> {
  if (c.lastAt === null) return
  const left = c.ttlMs - (now - c.lastAt)
  if (left <= 0) {
    await publish($, { id: 'cache-countdown:cache', feature: feature.id, kind: 'cache', level: 'info', value: 0, text: 'cache cold' })
    return
  }
  await publish($, { id: 'cache-countdown:cache', feature: feature.id, kind: 'cache', level: 'ok', value: Math.ceil(left / 1000), text: `cache ${short(left)}` })
}

/** One state write a second while the cache is warm; stops itself once it is cold. */
async function startTicker($: EngineInterface): Promise<void> {
  ticker?.cancel()
  ticker = $.clock.every(1000, async () => {
    if (!(await isOn($, feature))) {
      ticker?.cancel()
      ticker = undefined
      await retractAll($, feature.id)
      return
    }
    const now = await $.clock.now()
    const c = await read($, cache)
    await update($, cache, s => ({ ...s, now }))
    await publishCache($, c, now)
    if (c.lastAt === null || now - c.lastAt >= c.ttlMs) {
      ticker?.cancel()
      ticker = undefined
    }
  })
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'cache-ttl', description: t(T.cmdDesc), argumentHint: t(T.cmdHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'cache-ttl', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  const saved = await storeGet<number>($, STORE_KEY, 5 * MIN_MS)
  const ttlMs = saved >= HOUR_MS ? HOUR_MS : 5 * MIN_MS
  await update($, cache, s => ({ ...s, ttlMs }))
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }

  const now = await $.clock.now()
  await update($, cache, s => ({ ...s, lastAt: now, now }))
  await publishCache($, { ...(await read($, cache)), lastAt: now }, now)
  await startTicker($)
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'>> {
  if (!(await isOn($, feature))) return e
  if (e.command !== undefined || e.isMeta) return e

  const c = await read($, cache)
  if (c.lastAt === null) return e
  const now = await $.clock.now()
  if (now - c.lastAt < c.ttlMs) return e

  try {
    const { context } = await $.session.usage()
    const percent = context.percent
    if (percent === undefined || percent <= WARN_PERCENT) return e
    const text =
      context.tokens === undefined
        ? t(T.warnPercent, { percent: Math.round(percent) })
        : t(T.warnTokens, { percent: Math.round(percent), tokens: countText(context.tokens) })
    await notice($, 'warn', text, feature.id)
    const hit: Warned = { at: now, percent: Math.round(percent), tokens: context.tokens ?? null }
    await update($, cache, s => ({ ...s, warned: [...(s.warned ?? []), hit].slice(-50) }))
  } catch {
    // A failed usage read never blocks the send.
  }
  return e
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const c = await read($, cache)
  if (c.lastAt === null) return null

  const { Text } = $.ui.resolve(e)
  const left = c.ttlMs - (c.now - c.lastAt)
  if (left <= 0) {
    return (
      <Text dimColor size="footnote">
        {t(T.cold)}
      </Text>
    )
  }
  return <Text size="footnote">{t(T.warm, { time: clockText(left) })}</Text>
}

/** The short band form: the time the cache stays warm, or "cache cold" once it has gone cold. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const c = await read($, cache)
  if (c.lastAt === null) return null

  const left = c.ttlMs - (c.now - c.lastAt)
  if (left <= 0) return { text: t(T.cold), level: 'info', icon: ICONS.quota }
  return { text: t(T.chipWarm, { time: short(left) }), level: 'ok', icon: ICONS.quota }
}

/** What a press on the band line shows: the lifetime, when the cache went cold, and the cold sends warned about. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const c = await read($, cache)
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)

  let status: string
  if (c.lastAt === null) status = t(T.dNoTurn)
  else if (now - c.lastAt < c.ttlMs) status = t(T.dWarm, { time: clockText(c.ttlMs - (now - c.lastAt)) })
  else status = t(T.dCold, { ago: clockText(now - (c.lastAt + c.ttlMs)) })

  const warned = (c.warned ?? []).slice(-12).reverse()
  return (
    <Box flexDirection="column">
      <Text>{t(T.current, { ttl: ttlName(c.ttlMs) })}</Text>
      <Text>{status}</Text>
      <Text bold>{t(T.dWarnedHead, { n: (c.warned ?? []).length })}</Text>
      {warned.map((w, i) => (
        <Text key={`w${i}`}>
          {`${t(T.dSend, { ago: t(T.ago, { t: clockText(now - w.at) }), percent: w.percent })}${w.tokens === null ? '' : ` · ${t(T.dTokens, { tokens: countText(w.tokens) })}`}`}
        </Text>
      ))}
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'cache-ttl' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const arg = e.args.trim().toLowerCase()
    if (arg === '') {
      const c = await read($, cache)
      return { text: t(T.current, { ttl: ttlName(c.ttlMs) }) }
    }
    if (arg !== '5m' && arg !== '1h') return { text: t(T.invalid) }

    const ttlMs = arg === '1h' ? HOUR_MS : 5 * MIN_MS
    await storeSet($, STORE_KEY, ttlMs)
    const now = await $.clock.now()
    await update($, cache, s => ({ ...s, ttlMs, now }))
    // A longer lifetime can make a cold cache warm again.
    const c = await read($, cache)
    if (c.lastAt !== null && now - c.lastAt < ttlMs) await startTicker($)
    return { text: t(T.changed, { ttl: arg }) }
  })
}
