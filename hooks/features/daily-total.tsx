import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import { isOn, storeGet, storeSet, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput } from '../core'
import { emptyState, ICONS, listRow, sectionTitle } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: { en: 'Daily total', he: 'סה"כ יומי', es: 'Total diario', fr: 'Total quotidien', ru: 'Итог за день', zh: '每日总计', ja: '1日の合計', pt: 'Total diário', de: 'Tagessumme', ko: '일일 합계' },
  description: {
    en: 'A line showing how many hours you worked with Claude today, across all sessions.',
    he: 'פס שמראה כמה שעות עבדת היום עם קלוד, בכל הסשנים.',
    es: 'Una línea que muestra cuántas horas has trabajado hoy con Claude, en todas las sesiones.',
    fr: "Une ligne qui indique combien d'heures vous avez travaillé aujourd'hui avec Claude, toutes sessions confondues.",
    ru: 'Строка, показывающая, сколько часов вы сегодня работали с Claude во всех сессиях.',
    zh: '一行显示你今天与 Claude 一起工作了多少小时，涵盖所有会话。',
    ja: '今日、すべてのセッションを合わせて Claude と何時間作業したかを示す1行です。',
    pt: 'Uma linha mostrando quantas horas você trabalhou com o Claude hoje, somando todas as sessões.',
    de: 'Eine Zeile, die zeigt, wie viele Stunden du heute über alle Sessions hinweg mit Claude gearbeitet hast.',
    ko: '오늘 모든 세션을 합쳐 Claude와 몇 시간 작업했는지 보여 주는 한 줄입니다.',
  },
  today: { en: 'Today', he: 'היום', es: 'Hoy', fr: "Aujourd'hui", ru: 'Сегодня', zh: '今天', ja: '今日', pt: 'Hoje', de: 'Heute', ko: '오늘' },
  hoursWithClaude: { en: 'hours of work with Claude', he: 'שעות עבודה עם קלוד', es: 'horas de trabajo con Claude', fr: 'heures de travail avec Claude', ru: 'ч работы с Claude', zh: '与 Claude 一起工作的小时数', ja: 'Claude との作業時間', pt: 'horas de trabalho com o Claude', de: 'Stunden Arbeit mit Claude', ko: 'Claude와 작업한 시간' },
  dToday: {
    en: 'Today: {time} of work · {turns} turns this session',
    he: 'היום: {time} עבודה · {turns} תורות בסשן הזה',
    es: 'Hoy: {time} de trabajo · {turns} turnos en esta sesión',
    fr: 'Aujourd\'hui : {time} de travail · {turns} tours dans cette session',
    ru: 'Сегодня: {time} работы · ходов в этой сессии: {turns}',
    zh: '今天：工作 {time} · 本会话 {turns} 轮',
    ja: '今日: 作業 {time} · このセッションで {turns} ターン',
    pt: 'Hoje: {time} de trabalho · {turns} turnos nesta sessão',
    de: 'Heute: {time} Arbeit · {turns} Durchgänge in dieser Session',
    ko: '오늘: 작업 {time} · 이 세션 {turns}턴',
  },
  dWeek: { en: 'Last 7 days', he: '7 הימים האחרונים', es: 'Últimos 7 días', fr: '7 derniers jours', ru: 'Последние 7 дней', zh: '最近 7 天', ja: '過去7日間', pt: 'Últimos 7 dias', de: 'Letzte 7 Tage', ko: '최근 7일' },
  chip: { en: '{time} today', he: 'היום {time}', es: '{time} hoy', fr: '{time} auj.', ru: '{time} сегодня', zh: '今天 {time}', ja: '今日 {time}', pt: '{time} hoje', de: '{time} heute', ko: '오늘 {time}' },
  dNoneHint: { en: 'Each finished turn adds its time to the day; the last 7 days are kept.', he: 'כל תור שמסתיים מוסיף את הזמן שלו ליום; נשמרים 7 הימים האחרונים.', es: 'Cada turno terminado suma su tiempo al día; se guardan los últimos 7 días.', fr: 'Chaque tour terminé ajoute son temps à la journée ; les 7 derniers jours sont conservés.', ru: 'Каждый завершённый ход добавляет своё время к дню; хранятся последние 7 дней.', zh: '每完成一轮，其耗时会计入当天；保留最近 7 天。', ja: '完了したターンの時間がその日に加算されます。直近7日分が保持されます。', pt: 'Cada turno concluído soma seu tempo ao dia; os últimos 7 dias são mantidos.', de: 'Jeder abgeschlossene Durchgang addiert seine Zeit zum Tag; die letzten 7 Tage werden aufbewahrt.', ko: '끝난 턴의 시간이 그날에 더해지며, 최근 7일이 보관됩니다.' },
  dNone: { en: 'No time recorded yet.', he: 'עדיין לא נרשם זמן.', es: 'Aún no se ha registrado tiempo.', fr: 'Aucun temps enregistré pour l\'instant.', ru: 'Время пока не записано.', zh: '还没有记录任何时间。', ja: 'まだ時間は記録されていません。', pt: 'Nenhum tempo registrado ainda.', de: 'Noch keine Zeit erfasst.', ko: '아직 기록된 시간이 없습니다.' },
} as const

type Daily = { turns: number; todayMs: number }

const daily = atom({ plugin: 'toolkitty', key: 'slot', id: 'daily-total' } as const, { turns: 0, todayMs: 0 }) as unknown as Atom<Daily>

const PREFIX = 'daily-total:'
const KEEP_DAYS = 7

const dayKey = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const hoursText = (ms: number): string => {
  const minutes = Math.floor(ms / 60000)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

export const feature: Feature = {
  id: 'daily-total',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  try {
    const key = PREFIX + dayKey(await $.clock.now())
    const total = (await storeGet<number>($, key, 0)) + Math.max(0, e.durationMs)
    await storeSet($, key, total)
    await update($, daily, d => ({ turns: d.turns + 1, todayMs: total }))

    const keys = (await $.store.keys()).filter(k => k.startsWith(PREFIX)).sort()
    for (const old of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) await $.store.delete(old)
  } catch {
    // the total is a convenience; never break the turn over it
  }
}

/** What a press on the band line shows: today's time and turns, and the last 7 days. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const d = await read($, daily)
  const { Box, Text } = $.ui.resolve(e)
  const rows: { day: string; ms: number }[] = []
  try {
    const keys = (await $.store.keys()).filter(k => /^daily-total:\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse().slice(0, KEEP_DAYS)
    for (const key of keys) rows.push({ day: key.slice(PREFIX.length), ms: await storeGet<number>($, key, 0) })
  } catch {
    // the list is a convenience
  }
  return (
    <Box flexDirection="column">
      <Text bold>{t(T.dToday, { time: hoursText(d.todayMs), turns: d.turns })}</Text>
      {sectionTitle($, e, t(T.dWeek))}
      {rows.length === 0 ? emptyState($, e, t(T.dNone), t(T.dNoneHint)) : null}
      {rows.map(r => listRow($, e, { key: `day-${r.day}`, left: r.day, text: hoursText(r.ms) }))}
    </Box>
  )
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const d = await read($, daily)
  if (d.turns === 0) return null

  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      {t(T.today)}: <Text mono>{hoursText(d.todayMs)}</Text> {t(T.hoursWithClaude)}
    </Text>
  )
}

/** The short band form: today's hours with Claude. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const d = await read($, daily)
  if (d.turns === 0) return null

  return { text: t(T.chip, { time: hoursText(d.todayMs) }), level: 'ok', icon: ICONS.insight }
}
