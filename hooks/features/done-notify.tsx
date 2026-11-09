import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { Feature, Input, Output } from '../core'

const T = {
  title: { en: 'Done notification', he: 'התראת סיום', es: 'Aviso de finalización', fr: 'Notification de fin', ru: 'Уведомление о завершении', zh: '完成通知', ja: '完了通知', pt: 'Notificação de conclusão', de: 'Fertig-Benachrichtigung', ko: '완료 알림' },
  description: {
    en: 'A system notification when a long turn finishes or a permission approval is needed.',
    he: 'התראת מערכת כשתור ארוך מסתיים או כשנדרש אישור הרשאה.',
    es: 'Una notificación del sistema cuando termina un turno largo o se requiere aprobar un permiso.',
    fr: "Une notification système lorsqu'un long tour se termine ou qu'une autorisation est requise.",
    ru: 'Системное уведомление, когда завершается длинный ход или требуется подтверждение разрешения.',
    zh: '当较长的一轮结束，或需要批准权限时，发出系统通知。',
    ja: '長いターンが終わったとき、または権限の承認が必要なときにシステム通知を出します。',
    pt: 'Uma notificação do sistema quando um turno longo termina ou quando é preciso aprovar uma permissão.',
    de: 'Eine Systembenachrichtigung, wenn ein langer Durchgang endet oder eine Berechtigung freigegeben werden muss.',
    ko: '긴 턴이 끝나거나 권한 승인이 필요할 때 시스템 알림을 보냅니다.',
  },
  done: {
    en: 'The session finished the task ({time})',
    he: 'הסשן סיים את המשימה ({time})',
    es: 'La sesión terminó la tarea ({time})',
    fr: 'La session a terminé la tâche ({time})',
    ru: 'Сессия завершила задачу ({time})',
    zh: '会话已完成任务（{time}）',
    ja: 'セッションがタスクを完了しました（{time}）',
    pt: 'A sessão concluiu a tarefa ({time})',
    de: 'Die Session hat die Aufgabe abgeschlossen ({time})',
    ko: '세션이 작업을 마쳤습니다({time})',
  },
  waiting: {
    en: 'Claude Code is waiting for your approval ({tool})',
    he: 'Claude Code ממתין לאישור שלך ({tool})',
    es: 'Claude Code espera tu aprobación ({tool})',
    fr: 'Claude Code attend votre approbation ({tool})',
    ru: 'Claude Code ожидает вашего подтверждения ({tool})',
    zh: 'Claude Code 正在等待你的批准（{tool}）',
    ja: 'Claude Code があなたの承認を待っています（{tool}）',
    pt: 'O Claude Code está aguardando sua aprovação ({tool})',
    de: 'Claude Code wartet auf deine Freigabe ({tool})',
    ko: 'Claude Code가 승인을 기다리고 있습니다({tool})',
  },
} as const

type State = { startedAt: number | null }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'done-notify' } as const, { startedAt: null }) as unknown as Atom<State>

/** A turn shorter than this does not raise a notification. */
const MIN_MS = 20_000

export const feature: Feature = {
  id: 'done-notify',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const startedAt = await $.clock.now()
  await update($, state, () => ({ startedAt }))
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const s = await read($, state)
  await update($, state, () => ({ startedAt: null }))

  const ms = e.durationMs > 0 ? e.durationMs : s.startedAt === null ? 0 : (await $.clock.now()) - s.startedAt
  if (!e.isAborted && ms > MIN_MS) {
    // $.ui.notify reaches a terminal's notification channel only; on the desktop it is not sent, so the alert pops a toast instead.
    const sentDone = await $.ui.notify(t(T.done, { time: clockText(ms) }), { title: 'Claude Code' })
    if (!sentDone.isSent) await notice($, 'alert', t(T.done, { time: clockText(ms) }), feature.id)
  }
}

/** A real tool call that the engine puts to the person is a permission request. */
export async function afterToolCheck(
  $: EngineInterface,
  e: Input<'tool.check'>,
  verdict: Output<'tool.check'>,
): Promise<Output<'tool.check'>> {
  if (e.tool_use_id === undefined || e.agentId !== undefined || !(await isOn($, feature))) return verdict
  if (verdict.decision === 'ask') {
    const sentWait = await $.ui.notify(t(T.waiting, { tool: e.tool }), { title: 'Claude Code' })
    if (!sentWait.isSent) await notice($, 'alert', t(T.waiting, { tool: e.tool }), feature.id)
  }
  return verdict
}
