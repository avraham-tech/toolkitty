import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, Timer } from 'claude-code'

import { clockText, isOn, language, LANG_NAMES, notice, t } from '../core'
import type { BandInput, BandLine, Feature, Input } from '../core'
import { ICONS, short } from '../ui'
import type { Chip } from '../ui'

const CONTINUE_EN =
  'The usage limit has reset. Continue the task you were working on from exactly where it stopped. First briefly summarize what remains to be done (a few lines), then carry on. If nothing remains, say so and stop. Write your reply in {lang}.'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: {
    en: 'Auto-continue after limit',
    he: 'המשך אוטומטי אחרי מגבלה',
    es: 'Continuar automáticamente tras el límite',
    fr: 'Reprise automatique après la limite',
    ru: 'Автопродолжение после лимита',
    zh: '达到限额后自动继续',
    ja: '上限到達後に自動で再開',
    pt: 'Continuar automaticamente após o limite',
    de: 'Automatisch fortsetzen nach dem Limit',
    ko: '한도 도달 후 자동 계속',
  },
  description: {
    en: 'When a usage limit is hit, waits for the window to reset and then resumes the task automatically.',
    he: 'כשמגיעים למגבלת שימוש, ממתין לאיפוס החלון ואז ממשיך במשימה אוטומטית.',
    es: 'Al alcanzar un límite de uso, espera a que se reinicie la ventana y retoma la tarea automáticamente.',
    fr: 'Quand une limite d\'utilisation est atteinte, attend la réinitialisation de la fenêtre puis reprend la tâche automatiquement.',
    ru: 'При достижении лимита использования ждёт сброса окна и автоматически продолжает задачу.',
    zh: '达到用量限额时，等待窗口重置，然后自动恢复任务。',
    ja: '使用量の上限に達したら、ウィンドウがリセットされるまで待ち、自動でタスクを再開します。',
    pt: 'Ao atingir um limite de uso, espera a janela reiniciar e retoma a tarefa automaticamente.',
    de: 'Wenn ein Nutzungslimit erreicht ist, wartet es auf das Zurücksetzen des Fensters und setzt die Aufgabe dann automatisch fort.',
    ko: '사용량 한도에 도달하면 창이 초기화될 때까지 기다린 뒤 작업을 자동으로 이어갑니다.',
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
  // Sent to the model, so every language holds the same English text.
  continuePrompt: { en: CONTINUE_EN, he: CONTINUE_EN, es: CONTINUE_EN, fr: CONTINUE_EN, ru: CONTINUE_EN, zh: CONTINUE_EN, ja: CONTINUE_EN, pt: CONTINUE_EN, de: CONTINUE_EN, ko: CONTINUE_EN },
  band: {
    en: '⏸ limit hit · resumes in {time}',
    he: '⏸ הגעת למגבלה · ממשיך בעוד {time}',
    es: '⏸ límite alcanzado · se reanuda en {time}',
    fr: '⏸ limite atteinte · reprise dans {time}',
    ru: '⏸ лимит достигнут · продолжение через {time}',
    zh: '⏸ 达到限额 · {time}后恢复',
    ja: '⏸ 上限到達 · {time}後に再開',
    pt: '⏸ limite atingido · retoma em {time}',
    de: '⏸ Limit erreicht · weiter in {time}',
    ko: '⏸ 한도 도달 · {time} 후 재개',
  },
  chipResume: { en: 'resume {time}', he: 'המשך {time}', es: 'reanuda {time}', fr: 'reprise {time}', ru: 'продолж. {time}', zh: '{time}后恢复', ja: '{time}後に再開', pt: 'retoma {time}', de: 'weiter {time}', ko: '{time} 후 재개' },
  cancel: { en: 'cancel', he: 'ביטול', es: 'cancelar', fr: 'annuler', ru: 'отмена', zh: '取消', ja: 'キャンセル', pt: 'cancelar', de: 'abbrechen', ko: '취소' },
  armedToast: {
    en: 'Usage limit hit. The task will resume automatically in {time}.',
    he: 'הגעת למגבלת שימוש. המשימה תימשך אוטומטית בעוד {time}.',
    es: 'Límite de uso alcanzado. La tarea se reanudará automáticamente en {time}.',
    fr: 'Limite d\'utilisation atteinte. La tâche reprendra automatiquement dans {time}.',
    ru: 'Достигнут лимит использования. Задача продолжится автоматически через {time}.',
    zh: '已达到用量限额。任务将在 {time}后自动恢复。',
    ja: '使用量の上限に達しました。タスクは {time}後に自動で再開されます。',
    pt: 'Limite de uso atingido. A tarefa retomará automaticamente em {time}.',
    de: 'Nutzungslimit erreicht. Die Aufgabe wird in {time} automatisch fortgesetzt.',
    ko: '사용량 한도에 도달했습니다. 작업은 {time} 후 자동으로 재개됩니다.',
  },
  gaveUp: {
    en: 'Auto-continue stopped: the limit was still hit after {n} attempts.',
    he: 'ההמשך האוטומטי נעצר: המגבלה עדיין חסמה אחרי {n} ניסיונות.',
    es: 'Continuación automática detenida: el límite seguía activo tras {n} intentos.',
    fr: 'Reprise automatique arrêtée : la limite était toujours atteinte après {n} tentatives.',
    ru: 'Автопродолжение остановлено: лимит всё ещё действует после попыток: {n}.',
    zh: '自动继续已停止：尝试 {n} 次后仍然触及限额。',
    ja: '自動再開を停止しました: {n} 回試行しても上限に達したままでした。',
    pt: 'Continuação automática interrompida: o limite ainda estava ativo após {n} tentativas.',
    de: 'Automatisches Fortsetzen gestoppt: Das Limit war nach {n} Versuchen noch aktiv.',
    ko: '자동 계속이 중지되었습니다: {n}번 시도 후에도 한도가 풀리지 않았습니다.',
  },
  submitFailed: {
    en: 'Auto-continue could not send the resume prompt.',
    he: 'ההמשך האוטומטי לא הצליח לשלוח את בקשת ההמשך.',
    es: 'La continuación automática no pudo enviar el mensaje de reanudación.',
    fr: 'La reprise automatique n\'a pas pu envoyer le message de reprise.',
    ru: 'Автопродолжение не смогло отправить сообщение о продолжении.',
    zh: '自动继续无法发送恢复提示。',
    ja: '自動再開は再開用プロンプトを送信できませんでした。',
    pt: 'A continuação automática não conseguiu enviar o prompt de retomada.',
    de: 'Das automatische Fortsetzen konnte den Fortsetzungs-Prompt nicht senden.',
    ko: '자동 계속이 재개 프롬프트를 보내지 못했습니다.',
  },
  cmdDesc: {
    en: 'Shows the auto-continue status, or cancels a pending resume (/auto-continue cancel)',
    he: 'מציג את מצב ההמשך האוטומטי, או מבטל המשך ממתין (/auto-continue cancel)',
    es: 'Muestra el estado de la continuación automática o cancela una reanudación pendiente (/auto-continue cancel)',
    fr: 'Affiche l\'état de la reprise automatique ou annule une reprise en attente (/auto-continue cancel)',
    ru: 'Показывает состояние автопродолжения или отменяет ожидающее продолжение (/auto-continue cancel)',
    zh: '显示自动继续状态，或取消待处理的恢复（/auto-continue cancel）',
    ja: '自動再開の状態を表示、または保留中の再開をキャンセルします（/auto-continue cancel）',
    pt: 'Mostra o status da continuação automática ou cancela uma retomada pendente (/auto-continue cancel)',
    de: 'Zeigt den Status des automatischen Fortsetzens oder bricht eine ausstehende Fortsetzung ab (/auto-continue cancel)',
    ko: '자동 계속 상태를 보여 주거나 대기 중인 재개를 취소합니다(/auto-continue cancel)',
  },
  cmdHint: { en: '[status|cancel]', he: '[status|cancel]', es: '[status|cancel]', fr: '[status|cancel]', ru: '[status|cancel]', zh: '[status|cancel]', ja: '[status|cancel]', pt: '[status|cancel]', de: '[status|cancel]', ko: '[status|cancel]' },
  statusIdle: {
    en: 'Auto-continue is on and nothing is pending.',
    he: 'ההמשך האוטומטי פעיל ואין דבר ממתין.',
    es: 'La continuación automática está activa y no hay nada pendiente.',
    fr: 'La reprise automatique est active et rien n\'est en attente.',
    ru: 'Автопродолжение включено, ничего не ожидается.',
    zh: '自动继续已开启，当前没有待处理的恢复。',
    ja: '自動再開はオンで、保留中のものはありません。',
    pt: 'A continuação automática está ativa e nada está pendente.',
    de: 'Automatisches Fortsetzen ist an, nichts steht aus.',
    ko: '자동 계속이 켜져 있으며 대기 중인 항목은 없습니다.',
  },
  statusArmed: {
    en: 'Auto-continue is armed: resuming in {time} (attempt {n} of {max}).',
    he: 'ההמשך האוטומטי דרוך: ממשיך בעוד {time} (ניסיון {n} מתוך {max}).',
    es: 'Continuación automática armada: se reanuda en {time} (intento {n} de {max}).',
    fr: 'Reprise automatique armée : reprise dans {time} (tentative {n} sur {max}).',
    ru: 'Автопродолжение запланировано: через {time} (попытка {n} из {max}).',
    zh: '自动继续已就绪：将在 {time}后恢复（第 {n} 次，共 {max} 次）。',
    ja: '自動再開が待機中: {time}後に再開します（{n}/{max} 回目）。',
    pt: 'A continuação automática está armada: retoma em {time} (tentativa {n} de {max}).',
    de: 'Automatisches Fortsetzen ist scharf: Weiter in {time} (Versuch {n} von {max}).',
    ko: '자동 계속 대기 중: {time} 후 재개합니다({max}회 중 {n}번째 시도).',
  },
  cancelled: {
    en: 'Auto-continue cancelled.',
    he: 'ההמשך האוטומטי בוטל.',
    es: 'Continuación automática cancelada.',
    fr: 'Reprise automatique annulée.',
    ru: 'Автопродолжение отменено.',
    zh: '自动继续已取消。',
    ja: '自動再開をキャンセルしました。',
    pt: 'Continuação automática cancelada.',
    de: 'Automatisches Fortsetzen abgebrochen.',
    ko: '자동 계속이 취소되었습니다.',
  },
  nothingToCancel: {
    en: 'Nothing is pending.',
    he: 'אין דבר ממתין.',
    es: 'No hay nada pendiente.',
    fr: 'Rien n\'est en attente.',
    ru: 'Ничего не ожидается.',
    zh: '没有待处理的内容。',
    ja: '保留中のものはありません。',
    pt: 'Nada pendente.',
    de: 'Nichts steht aus.',
    ko: '대기 중인 항목이 없습니다.',
  },
  switchboard: {
    en: 'Turn auto-continue on or off in the /toolkitty pane. Here you can use status or cancel.',
    he: 'הפעלה וכיבוי של ההמשך האוטומטי נעשים בלוח /toolkitty. כאן אפשר להשתמש ב-status או cancel.',
    es: 'Activa o desactiva la continuación automática en el panel /toolkitty. Aquí puedes usar status o cancel.',
    fr: 'Activez ou désactivez la reprise automatique dans le panneau /toolkitty. Ici, utilisez status ou cancel.',
    ru: 'Включать и отключать автопродолжение можно в панели /toolkitty. Здесь доступны status и cancel.',
    zh: '请在 /toolkitty 面板中开启或关闭自动继续。这里可使用 status 或 cancel。',
    ja: '自動再開のオン/オフは /toolkitty ペインで切り替えます。ここでは status または cancel が使えます。',
    pt: 'Ligue ou desligue a continuação automática no painel /toolkitty. Aqui você pode usar status ou cancel.',
    de: 'Schalte das automatische Fortsetzen im Panel /toolkitty an oder aus. Hier kannst du status oder cancel verwenden.',
    ko: '자동 계속은 /toolkitty 창에서 켜고 끕니다. 여기서는 status 또는 cancel을 사용할 수 있습니다.',
  },
} as const

type Resume = {
  armed: boolean
  resumeAt: number | null
  attempts: number
  /** True when no reset time was known and the wait is a fixed 15-minute retry. */
  isBlind: boolean
  /** True from the moment the resume prompt is sent until its turn completes. */
  inFlight: boolean
  now: number
}

const resume = atom({ plugin: 'toolkitty', key: 'slot', id: 'auto-continue' } as const, {
  armed: false,
  resumeAt: null,
  attempts: 0,
  isBlind: false,
  inFlight: false,
  now: 0,
} as Resume) as unknown as Atom<Resume>

export const feature: Feature = {
  id: 'auto-continue',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

const SLACK_MS = 60 * 1000
const BLIND_RETRY_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 3
const MAX_BLIND_ATTEMPTS = 20 // 15 minutes x 20 = 5 hours
const MAX_TIMER_MS = 2_000_000_000

let fireTimer: Timer | undefined
let ticker: Timer | undefined

type Limit = { kind: string; percentUsed: number; resetsAt?: string }

const isAtLimit = (limits: readonly Limit[]): boolean => limits.some(l => l.percentUsed >= 100)

/** The soonest future reset among the windows at 100% (else among all windows), or null. */
const soonestReset = (limits: readonly Limit[], now: number): number | null => {
  const times = (list: readonly Limit[]): number[] =>
    list.flatMap(l => (l.resetsAt === undefined ? [] : [Date.parse(l.resetsAt)])).filter(ms => Number.isFinite(ms) && ms > now)
  const full = times(limits.filter(l => l.percentUsed >= 100))
  const all = full.length > 0 ? full : times(limits)
  return all.length === 0 ? null : Math.min(...all)
}

async function fireResume($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  const s = await read($, resume)
  if (!s.armed) return

  ticker?.cancel()
  ticker = undefined
  fireTimer = undefined
  await update($, resume, c => ({ ...c, armed: false, resumeAt: null, inFlight: true, attempts: c.attempts + 1 }))

  try {
    await $.prompt.submit({ text: t(T.continuePrompt, { lang: LANG_NAMES[language()] }), asUser: true })
  } catch {
    await update($, resume, c => ({ ...c, inFlight: false, attempts: 0 }))
    await notice($, 'alert', t(T.submitFailed), feature.id)
  }
}

async function arm($: EngineInterface, limits: readonly Limit[]): Promise<void> {
  const s = await read($, resume)
  if (s.armed || s.inFlight) return

  const now = await $.clock.now()
  const reset = soonestReset(limits, now)
  const isBlind = reset === null
  const max = isBlind ? MAX_BLIND_ATTEMPTS : MAX_ATTEMPTS
  if (s.attempts >= max) {
    await notice($, 'alert', t(T.gaveUp, { n: s.attempts }), feature.id)
    await update($, resume, c => ({ ...c, attempts: 0, isBlind: false }))
    return
  }

  const waitMs = isBlind ? BLIND_RETRY_MS : reset - now + SLACK_MS
  const resumeAt = now + waitMs
  await update($, resume, c => ({ ...c, armed: true, resumeAt, isBlind, now }))

  fireTimer?.cancel()
  fireTimer = $.clock.after(Math.min(waitMs, MAX_TIMER_MS), async () => {
    await fireResume($)
  })

  ticker?.cancel()
  ticker = $.clock.every(1000, async () => {
    if (!(await isOn($, feature))) return
    const tick = await $.clock.now()
    await update($, resume, c => (c.armed ? { ...c, now: tick } : c))
  })

  await notice($, 'alert', t(T.armedToast, { time: clockText(waitMs) }), feature.id)
}

async function disarm($: EngineInterface): Promise<void> {
  fireTimer?.cancel()
  fireTimer = undefined
  ticker?.cancel()
  ticker = undefined
  await update($, resume, c => ({ ...c, armed: false, resumeAt: null, attempts: 0, isBlind: false, inFlight: false }))
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'auto-continue', description: t(T.cmdDesc), argumentHint: t(T.cmdHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'auto-continue', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  // A turn the person starts by hand while a resume is pending makes the resume pointless.
  const s = await read($, resume)
  if (s.armed) await disarm($)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const before = await read($, resume)
  await update($, resume, c => ({ ...c, inFlight: false }))

  let limits: Limit[] = []
  try {
    limits = (await $.session.usage()).rateLimits
  } catch {
    // Without usage the answer text alone decides.
  }

  const isLimitError = e.reason === 'error' && (isAtLimit(limits) || /limit|quota|usage/i.test(e.answer))
  if (isLimitError) {
    await arm($, limits)
    return
  }
  // A turn that ended without a limit error ends the retry streak.
  if (before.attempts > 0) await update($, resume, c => ({ ...c, attempts: 0, isBlind: false }))
}

export async function onMeasure($: EngineInterface, e: Input<'session.measure'>): Promise<void> {
  if (!(await isOn($, feature))) return
  if (!isAtLimit(e.rateLimits)) return
  await arm($, e.rateLimits)
}

/** The short band form: "resume 1:42" while a resume is armed, nothing otherwise. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const s = await read($, resume)
  if (!s.armed || s.resumeAt === null) return null
  return { text: t(T.chipResume, { time: short(s.resumeAt - s.now) }), level: 'info', icon: ICONS.quota }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const s = await read($, resume)
  if (!s.armed || s.resumeAt === null) return null

  const { Box, Button, Text } = $.ui.resolve(e)
  return (
    <Box gap={1}>
      <Text dimColor size="footnote">
        {t(T.band, { time: clockText(s.resumeAt - s.now) })}
      </Text>
      <Button
        key="auto-continue-cancel"
        label={t(T.cancel)}
        plain
        onPress={() => {
          void disarm($)
        }}
      />
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'auto-continue' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const arg = e.args.trim().toLowerCase()
    const s = await read($, resume)

    if (arg === 'cancel') {
      if (!s.armed) return { text: t(T.nothingToCancel) }
      await disarm($)
      return { text: t(T.cancelled) }
    }
    if (arg === 'on' || arg === 'off') return { text: t(T.switchboard) }

    if (!s.armed || s.resumeAt === null) return { text: t(T.statusIdle) }
    const now = await $.clock.now()
    return {
      text: t(T.statusArmed, {
        time: clockText(s.resumeAt - now),
        n: s.attempts + 1,
        max: s.isBlind ? MAX_BLIND_ATTEMPTS : MAX_ATTEMPTS,
      }),
    }
  })
}
