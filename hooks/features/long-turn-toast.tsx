import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, Timer } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input } from '../core'

const T = {
  title: { en: 'Long turn', he: 'תור ארוך', es: 'Turno largo', fr: 'Tour long', ru: 'Долгий ход', zh: '长回合', ja: '長いターン', pt: 'Turno longo', de: 'Langer Turn', ko: '긴 턴' },
  description: { en: 'A toast every 5 minutes while a turn runs for a long time.', he: 'הודעה קופצת כל 5 דקות כשתור רץ זמן רב.', es: 'Un aviso cada 5 minutos mientras un turno se ejecuta durante mucho tiempo.', fr: 'Une notification toutes les 5 minutes lorsqu\'un tour dure longtemps.', ru: 'Уведомление каждые 5 минут, пока ход выполняется долго.', zh: '回合运行很久时，每 5 分钟弹出一次提示。', ja: 'ターンが長く続くとき、5 分ごとにトーストを表示します。', pt: 'Um aviso a cada 5 minutos enquanto um turno demora muito.', de: 'Alle 5 Minuten ein Toast, solange ein Turn lange läuft.', ko: '턴이 오래 실행되는 동안 5분마다 토스트를 띄웁니다.' },
  running: { en: 'The turn has been running for {n} minutes', he: 'התור רץ כבר {n} דקות', es: 'El turno lleva {n} minutos en ejecución', fr: 'Le tour s\'exécute depuis {n} minutes', ru: 'Ход выполняется уже {n} мин.', zh: '该回合已运行 {n} 分钟', ja: 'このターンは {n} 分間実行されています', pt: 'O turno está em execução há {n} minutos', de: 'Der Turn läuft seit {n} Minuten', ko: '이 턴이 {n}분째 실행 중입니다' },
} as const

type State = { startedAt: number | null }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'long-turn-toast' } as const, { startedAt: null }) as unknown as Atom<State>

const PERIOD_MS = 5 * 60_000

export const feature: Feature = {
  id: 'long-turn-toast',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

let ticker: Timer | undefined

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const startedAt = await $.clock.now()
  await update($, state, () => ({ startedAt }))

  ticker?.cancel()
  ticker = $.clock.every(PERIOD_MS, async () => {
    if (!(await isOn($, feature))) return

    const s = await read($, state)
    if (s.startedAt === null) return

    const minutes = Math.round(((await $.clock.now()) - s.startedAt) / 60_000)
    await notice($, 'alert', t(T.running, { n: minutes }), feature.id)
  })
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return

  ticker?.cancel()
  ticker = undefined
  await update($, state, () => ({ startedAt: null }))
}
