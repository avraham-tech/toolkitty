import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import { isOn, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput } from '../core'
import { publish, retract, retractAll } from '../signals'
import { ICONS, emptyState } from '../ui'
import type { Chip, Level } from '../ui'

const T = {
  title: {
    en: 'Plan pace',
    he: 'קצב התוכנית',
    es: 'Ritmo del plan',
    fr: 'Rythme du forfait',
    ru: 'Темп расхода тарифа',
    zh: '套餐进度',
    ja: 'プラン消費ペース',
    pt: 'Ritmo do plano',
    de: 'Plan-Tempo',
    ko: '플랜 페이스',
  },
  description: {
    en: 'Shows your 5-hour and weekly plan usage, the time to reset, and whether you are burning through it faster than the window allows.',
    he: 'מציג את צריכת התוכנית ב-5 שעות ובשבוע, את הזמן עד האיפוס, והאם הצריכה מהירה מדי ביחס לחלון.',
    es: 'Muestra el uso del plan en 5 horas y en la semana, el tiempo hasta el reinicio y si lo gastas más rápido de lo que permite la ventana.',
    fr: 'Affiche l’utilisation du forfait sur 5 heures et sur la semaine, le temps avant la réinitialisation et si tu le consommes plus vite que la fenêtre ne le permet.',
    ru: 'Показывает расход тарифа за 5 часов и за неделю, время до сброса и не тратите ли вы лимит быстрее, чем позволяет окно.',
    zh: '显示你的 5 小时和每周套餐用量、距重置的时间，以及消耗速度是否超过窗口允许的范围。',
    ja: '5 時間と週間のプラン使用量、リセットまでの時間、ウィンドウの許容より速く消費していないかを表示します。',
    pt: 'Mostra o uso do plano de 5 horas e semanal, o tempo até a redefinição e se você está consumindo mais rápido do que a janela permite.',
    de: 'Zeigt deine 5-Stunden- und Wochen-Plannutzung, die Zeit bis zum Reset und ob du schneller verbrauchst, als das Fenster erlaubt.',
    ko: '5시간 및 주간 플랜 사용량, 초기화까지 남은 시간, 그리고 구간이 허용하는 것보다 빠르게 쓰고 있는지 보여 줍니다.',
  },
  fiveHour: { en: '5h', he: '5 ש׳', es: '5h', fr: '5h', ru: '5ч', zh: '5小时', ja: '5時間', pt: '5h', de: '5h', ko: '5시간' },
  sevenDay: { en: '7d', he: '7 י׳', es: '7d', fr: '7j', ru: '7д', zh: '7天', ja: '7日', pt: '7d', de: '7T', ko: '7일' },
  spend: { en: 'spend', he: 'הוצאה', es: 'gasto', fr: 'dépense', ru: 'расходы', zh: '消耗', ja: '消費', pt: 'gasto', de: 'Verbrauch', ko: '소비' },
  resets: { en: 'resets {time}', he: 'איפוס בעוד {time}', es: 'reinicio en {time}', fr: 'réinit. dans {time}', ru: 'сброс через {time}', zh: '{time}后重置', ja: '{time}後にリセット', pt: 'reinicia em {time}', de: 'Reset in {time}', ko: '{time} 후 초기화' },
  ahead: { en: 'ahead of pace', he: 'מהיר מהקצב', es: 'por encima del ritmo', fr: 'au-dessus du rythme', ru: 'быстрее темпа', zh: '超前于进度', ja: 'ペース超過', pt: 'acima do ritmo', de: 'zu schnell', ko: '페이스 초과' },
  runsOut: {
    en: 'runs out before reset',
    he: 'ייגמר לפני האיפוס',
    es: 'se agota antes del reinicio',
    fr: 'épuisé avant la réinitialisation',
    ru: 'закончится до сброса',
    zh: '重置前将耗尽',
    ja: 'リセット前に枯渇',
    pt: 'acaba antes da redefinição',
    de: 'reicht nicht bis zum Reset',
    ko: '초기화 전 소진',
  },
  dNone: { en: 'No plan usage data yet.', he: 'עדיין אין נתוני שימוש בתוכנית.', es: 'Aún no hay datos de uso del plan.', fr: 'Pas encore de données d\'utilisation du forfait.', ru: 'Данных об использовании тарифа пока нет.', zh: '暂无套餐用量数据。', ja: 'プランの使用量データはまだありません。', pt: 'Ainda não há dados de uso do plano.', de: 'Noch keine Plan-Nutzungsdaten.', ko: '아직 플랜 사용량 데이터가 없습니다.' },
  dNoneHint: {
    en: 'Limits appear after the next turn or usage update.',
    he: 'המגבלות יופיעו אחרי התור הבא או עדכון השימוש.',
    es: 'Los límites aparecen tras el próximo turno o actualización de uso.',
    fr: 'Les limites apparaissent après le prochain tour ou la prochaine mise à jour.',
    ru: 'Лимиты появятся после следующего хода или обновления данных.',
    zh: '下一轮或用量更新后会显示限额。',
    ja: '次のターンまたは使用量の更新後に上限が表示されます。',
    pt: 'Os limites aparecem após o próximo turno ou atualização de uso.',
    de: 'Limits erscheinen nach dem nächsten Durchgang oder der nächsten Nutzungsaktualisierung.',
    ko: '다음 턴이나 사용량 갱신 후에 한도가 표시됩니다.',
  },
  dWindow: {
    en: '{label}: {used}% used · {elapsed}% of the window elapsed · projected {proj}% at reset',
    he: '{label}: {used}% נוצלו · {elapsed}% מהחלון חלפו · צפי של {proj}% באיפוס',
    es: '{label}: {used}% usado · {elapsed}% de la ventana transcurrido · proyección de {proj}% al reiniciar',
    fr: '{label} : {used}% utilisé · {elapsed}% de la fenêtre écoulé · projection de {proj}% à la réinitialisation',
    ru: '{label}: использовано {used}% · прошло {elapsed}% окна · прогноз к сбросу {proj}%',
    zh: '{label}：已用 {used}% · 窗口已过 {elapsed}% · 重置时预计 {proj}%',
    ja: '{label}：{used}% 使用済み · ウィンドウの {elapsed}% 経過 · リセット時の予測 {proj}%',
    pt: '{label}: {used}% usado · {elapsed}% da janela decorrido · projetado {proj}% na redefinição',
    de: '{label}: {used}% verbraucht · {elapsed}% des Fensters vergangen · prognostiziert {proj}% beim Reset',
    ko: '{label}: {used}% 사용 · 구간 {elapsed}% 경과 · 초기화 시 예상 {proj}%',
  },
  dEarly: {
    en: '{label}: {used}% used · {elapsed}% of the window elapsed · too early to project',
    he: '{label}: {used}% נוצלו · {elapsed}% מהחלון חלפו · מוקדם מדי לחזות',
    es: '{label}: {used}% usado · {elapsed}% de la ventana transcurrido · demasiado pronto para proyectar',
    fr: '{label} : {used}% utilisé · {elapsed}% de la fenêtre écoulé · trop tôt pour projeter',
    ru: '{label}: использовано {used}% · прошло {elapsed}% окна · рано для прогноза',
    zh: '{label}：已用 {used}% · 窗口已过 {elapsed}% · 时间太短，无法预测',
    ja: '{label}：{used}% 使用済み · ウィンドウの {elapsed}% 経過 · まだ予測できません',
    pt: '{label}: {used}% usado · {elapsed}% da janela decorrido · cedo demais para projetar',
    de: '{label}: {used}% verbraucht · {elapsed}% des Fensters vergangen · noch zu früh für eine Prognose',
    ko: '{label}: {used}% 사용 · 구간 {elapsed}% 경과 · 예측하기엔 이름',
  },
  dPlain: { en: '{label}: {used}% used', he: '{label}: {used}% נוצלו', es: '{label}: {used}% usado', fr: '{label} : {used}% utilisé', ru: '{label}: использовано {used}%', zh: '{label}：已用 {used}%', ja: '{label}：{used}% 使用済み', pt: '{label}: {used}% usado', de: '{label}: {used}% verbraucht', ko: '{label}: {used}% 사용' },
  dReset: {
    en: '{label} resets in {time} (at {at})',
    he: '{label} מתאפס בעוד {time} (ב-{at})',
    es: '{label} se reinicia en {time} (a las {at})',
    fr: '{label} se réinitialise dans {time} (à {at})',
    ru: '{label}: сброс через {time} (в {at})',
    zh: '{label} 将在 {time}后重置（{at}）',
    ja: '{label} は {time} 後にリセット（{at}）',
    pt: '{label} reinicia em {time} (às {at})',
    de: '{label} wird in {time} zurückgesetzt (um {at})',
    ko: '{label}은(는) {time} 후 초기화됩니다({at})',
  },
  dExplain: {
    en: '"Ahead of pace" means you have used a larger share of the window\'s allowance than the share of the window that has passed, so at this rate you would hit the limit before it resets.',
    he: '"מהיר מהקצב" אומר שניצלת חלק גדול יותר מהמכסה מאשר החלק שחלף מהחלון, ולכן בקצב הזה תגיע למגבלה לפני האיפוס.',
    es: '«Por encima del ritmo» significa que has usado una parte mayor de la cuota que la parte de la ventana transcurrida, así que a este ritmo llegarías al límite antes del reinicio.',
    fr: '« Au-dessus du rythme » signifie que tu as consommé une part du quota supérieure à la part de la fenêtre écoulée : à ce rythme, tu atteindrais la limite avant la réinitialisation.',
    ru: '«Быстрее темпа» значит, что вы израсходовали большую долю лимита, чем прошло от окна, и при таком темпе лимит закончится до сброса.',
    zh: '“超前于进度”表示你已用掉的额度占比大于窗口已过去的时间占比，按此速度你会在重置前达到上限。',
    ja: '「ペース超過」は、ウィンドウの経過割合より多くの枠を使っていることを意味し、このままだとリセット前に上限に達します。',
    pt: '"Acima do ritmo" significa que você usou uma fatia maior da cota da janela do que a fatia da janela que já passou; nesse ritmo você atingiria o limite antes da redefinição.',
    de: '„Zu schnell“ heißt: Du hast einen größeren Anteil des Fenster-Kontingents verbraucht, als vom Fenster vergangen ist; in diesem Tempo erreichst du das Limit vor dem Reset.',
    ko: '"페이스 초과"는 구간의 경과 비율보다 허용량을 더 많이 썼다는 뜻으로, 이 속도라면 초기화 전에 한도에 도달합니다.',
  },
} as const

type Limit = { kind: string; percentUsed: number; resetsAt?: string }
type Pace = { limits: Limit[]; now: number }

const pace = atom({ plugin: 'toolkitty', key: 'slot', id: 'plan-pace' } as const, {
  limits: [],
  now: 0,
} as Pace) as unknown as Atom<Pace>

export const feature: Feature = {
  id: 'plan-pace',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const HOUR_MS = 60 * 60 * 1000
const LENGTH_MS: Readonly<Record<string, number>> = { five_hour: 5 * HOUR_MS, seven_day: 7 * 24 * HOUR_MS }
const AHEAD_FACTOR = 1.15
const AHEAD_MIN_PERCENT = 20
/** Below this elapsed fraction a projection is too noisy to trust. */
const MIN_ELAPSED = 0.1

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** h:mm, with days in front once past 24 hours. */
const untilText = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  return days > 0 ? `${days}d ${hours}:${pad2(mins)}` : `${hours}:${pad2(mins)}`
}

async function refresh($: EngineInterface): Promise<void> {
  const usage = await $.session.usage()
  const now = await $.clock.now()
  const limits: Limit[] = usage.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt }))
  await update($, pace, () => ({ limits, now }))
  await publishQuota($, limits, now)
}

/** One quota signal per window (5h, 7d); a window that is not reported any more is retracted. */
async function publishQuota($: EngineInterface, limits: Limit[], now: number): Promise<void> {
  const windows: { kind: string; id: string; label: string }[] = [
    { kind: 'five_hour', id: 'plan-pace:5h', label: '5h' },
    { kind: 'seven_day', id: 'plan-pace:7d', label: '7d' },
  ]
  for (const w of windows) {
    const l = limits.find(x => x.kind === w.kind)
    if (l === undefined) {
      await retract($, w.id)
      continue
    }
    const percent = Math.round(l.percentUsed)
    await publish($, { id: w.id, feature: feature.id, kind: 'quota', level: assess(l, now), value: percent, text: `${w.label} ${percent}%` })
  }
}

export async function onMeasure($: EngineInterface, e: Input<'session.measure'>): Promise<void> {
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }
  await refresh($)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }
  await refresh($)
}

/** What a press on the band line shows: each window as text with the pace math, the reset times, what "ahead of pace" means. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const p = await read($, pace)
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)
  const shown = p.limits.filter(l => l.kind === 'five_hour' || l.kind === 'seven_day' || l.kind === 'spend_limit')
  if (shown.length === 0) {
    return emptyState($, e, T.dNone, T.dNoneHint)
  }

  const rows: string[] = []
  for (const l of shown) {
    const label = l.kind === 'five_hour' ? t(T.fiveHour) : l.kind === 'seven_day' ? t(T.sevenDay) : t(T.spend)
    const used = Math.round(l.percentUsed)
    const resetsAt = l.resetsAt === undefined ? NaN : Date.parse(l.resetsAt)
    const lengthMs = LENGTH_MS[l.kind]
    if (lengthMs === undefined || !Number.isFinite(resetsAt)) {
      rows.push(t(T.dPlain, { label, used }))
      continue
    }
    const elapsed = Math.min(1, Math.max(0, (now - (resetsAt - lengthMs)) / lengthMs))
    const elapsedPercent = Math.round(elapsed * 100)
    rows.push(
      elapsed >= MIN_ELAPSED
        ? t(T.dWindow, { label, used, elapsed: elapsedPercent, proj: Math.round(l.percentUsed / elapsed) })
        : t(T.dEarly, { label, used, elapsed: elapsedPercent }),
    )
    const at = new Date(resetsAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    rows.push(t(T.dReset, { label, time: untilText(resetsAt - now), at }))
  }

  return (
    <Box flexDirection="column">
      {rows.map((row, i) => (
        <Text key={`p${i}`}>{row}</Text>
      ))}
      <Text dimColor>{t(T.dExplain)}</Text>
    </Box>
  )
}

/** How one window is doing: alert when it runs out before reset, warn when ahead of pace, else ok. */
function assess(l: Limit, now: number): Level {
  const resetsAt = l.resetsAt === undefined ? NaN : Date.parse(l.resetsAt)
  const lengthMs = LENGTH_MS[l.kind]
  if (lengthMs === undefined || !Number.isFinite(resetsAt)) return 'ok'
  const elapsed = Math.min(1, Math.max(0, (now - (resetsAt - lengthMs)) / lengthMs))
  if (elapsed >= MIN_ELAPSED && l.percentUsed / 100 / elapsed > 1) return 'alert'
  if (l.percentUsed > AHEAD_MIN_PERCENT && l.percentUsed / 100 > elapsed * AHEAD_FACTOR) return 'warn'
  return 'ok'
}

/** The short band form: the window that needs attention most, e.g. "7d 30% ▲". Quiet when every window is on pace. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const p = await read($, pace)
  const now = await $.clock.now()
  let best: { l: Limit; level: Level } | undefined
  for (const l of p.limits) {
    if (l.kind !== 'five_hour' && l.kind !== 'seven_day' && l.kind !== 'spend_limit') continue
    const level = assess(l, now)
    if (level === 'ok') continue
    const rank = (v: Level): number => (v === 'alert' ? 2 : 1)
    if (best === undefined || rank(level) > rank(best.level) || (rank(level) === rank(best.level) && l.percentUsed > best.l.percentUsed)) {
      best = { l, level }
    }
  }
  if (best === undefined) return null
  const label = best.l.kind === 'five_hour' ? t(T.fiveHour) : best.l.kind === 'seven_day' ? t(T.sevenDay) : t(T.spend)
  return { text: `${label} ${Math.round(best.l.percentUsed)}% ▲`, level: best.level, icon: ICONS.quota }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const p = await read($, pace)
  if (p.limits.length === 0) return null

  const { Text } = $.ui.resolve(e)
  const now = await $.clock.now()
  const five = p.limits.find(l => l.kind === 'five_hour')
  const week = p.limits.find(l => l.kind === 'seven_day')
  const spend = p.limits.find(l => l.kind === 'spend_limit')
  const shown = [five, week, spend].filter((l): l is Limit => l !== undefined)
  if (shown.length === 0) return null

  const parts = shown.map(l => {
    const label = l.kind === 'five_hour' ? t(T.fiveHour) : l.kind === 'seven_day' ? t(T.sevenDay) : t(T.spend)
    const percent = Math.round(l.percentUsed)
    const resetsAt = l.resetsAt === undefined ? NaN : Date.parse(l.resetsAt)
    const lengthMs = LENGTH_MS[l.kind]

    let color: 'warning' | 'error' | undefined
    let note: string | undefined
    if (lengthMs !== undefined && Number.isFinite(resetsAt)) {
      const elapsed = Math.min(1, Math.max(0, (now - (resetsAt - lengthMs)) / lengthMs))
      if (elapsed >= MIN_ELAPSED && l.percentUsed / 100 / elapsed > 1) {
        color = 'error'
        note = t(T.runsOut)
      } else if (l.percentUsed > AHEAD_MIN_PERCENT && l.percentUsed / 100 > elapsed * AHEAD_FACTOR) {
        color = 'warning'
        note = t(T.ahead)
      }
    }

    // The reset time is shown for the 5-hour window; the weekly one only when it stands alone.
    const showReset = Number.isFinite(resetsAt) && (l.kind === 'five_hour' || (l.kind === 'seven_day' && five === undefined))
    return (
      <Text key={l.kind}>
        <Text color={color}>
          {label} {percent}%{note === undefined ? '' : ` · ${note}`}
        </Text>
        {showReset ? ` · ${t(T.resets, { time: untilText(resetsAt - now) })}` : ''}
      </Text>
    )
  })

  return (
    <Text dimColor size="footnote">
      {parts.map((part, i) => (
        <Text key={`part-${i}`}>
          {i > 0 ? ' · ' : ''}
          {part}
        </Text>
      ))}
    </Text>
  )
}
