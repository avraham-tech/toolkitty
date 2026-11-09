import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, Timer } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'

const T = {
  title: { en: 'Break reminder', he: 'תזכורת הפסקה', es: 'Recordatorio de descanso', fr: 'Rappel de pause', ru: 'Напоминание о перерыве', zh: '休息提醒', ja: '休憩リマインダー', pt: 'Lembrete de pausa', de: 'Pausenerinnerung', ko: '휴식 알림' },
  description: { en: 'After an hour of continuous work: a toast suggesting a break.', he: 'אחרי שעה של עבודה רצופה: הודעה קופצת שמציעה הפסקה.', es: 'Tras una hora de trabajo continuo: un aviso emergente que sugiere un descanso.', fr: 'Après une heure de travail continu : une notification qui suggère une pause.', ru: 'После часа непрерывной работы: всплывающее уведомление с предложением сделать перерыв.', zh: '连续工作一小时后：弹出提示建议休息。', ja: '1時間連続で作業した後: 休憩を勧めるトーストを表示します。', pt: 'Após uma hora de trabalho contínuo: um aviso sugerindo uma pausa.', de: 'Nach einer Stunde Dauerarbeit: ein Toast, der eine Pause vorschlägt.', ko: '1시간 연속으로 작업하면 휴식을 권하는 토스트를 띄웁니다.' },
  toast: { en: 'An hour of continuous work has passed. How about a break?', he: 'עברה שעה של עבודה רצופה, רגע הפסקה?', es: 'Ha pasado una hora de trabajo continuo. ¿Un descanso?', fr: 'Une heure de travail continu s\'est écoulée. Une petite pause ?', ru: 'Прошёл час непрерывной работы. Может, сделать перерыв?', zh: '已连续工作一小时。要不要休息一下？', ja: '1時間連続で作業しています。休憩しませんか？', pt: 'Já se passou uma hora de trabalho contínuo. Que tal uma pausa?', de: 'Seit einer Stunde ununterbrochen gearbeitet. Wie wäre es mit einer Pause?', ko: '1시간째 쉬지 않고 작업 중입니다. 잠깐 쉬는 건 어떨까요?' },
} as const

type State = { streakStart: number | null; lastActivity: number | null; lastToastAt: number | null }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'break-timer' } as const, { streakStart: null, lastActivity: null, lastToastAt: null }) as unknown as Atom<State>

const MINUTE = 60_000
const STREAK_MS = 60 * MINUTE
const IDLE_RESET_MS = 15 * MINUTE

let ticker: Timer | undefined

export const feature: Feature = {
  id: 'break-timer',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

async function touch($: EngineInterface) {
  const now = await $.clock.now()
  await update($, state, s => {
    const isFresh = s.lastActivity === null || now - s.lastActivity >= IDLE_RESET_MS || s.streakStart === null
    return { ...s, streakStart: isFresh ? now : s.streakStart, lastActivity: now }
  })
}

// The timer is always started; its callback checks the switch, so turning the
// feature on later in the session still works.
export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  ticker?.cancel()
  ticker = $.clock.every(MINUTE, async () => {
    if (!(await isOn($, feature))) return

    const now = await $.clock.now()
    const s = await read($, state)
    if (s.lastActivity === null || s.streakStart === null) return

    if (now - s.lastActivity >= IDLE_RESET_MS) {
      await update($, state, p => ({ ...p, streakStart: null }))
      return
    }

    const isDue = now - s.streakStart >= STREAK_MS && (s.lastToastAt === null || now - s.lastToastAt >= STREAK_MS)
    if (isDue) {
      await update($, state, p => ({ ...p, lastToastAt: now }))
      await notice($, 'info', t(T.toast), feature.id)
    }
  })
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (!(await isOn($, feature))) return
  await touch($)
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined
  await touch($)
  return undefined
}
