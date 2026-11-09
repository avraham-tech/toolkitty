import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, FsEntry, On, Timer } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { BandInput, Feature, Input, Output, ToolCallInput, ToolCallOutput } from '../core'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip, Level } from '../ui'

/*
 * Mission Control. A plugin sees only its own session, so every session that
 * runs Toolkitty writes a small heartbeat file into
 * `<home>/.claude/toolkitty-sessions/<sessionId>.json` and reads everyone
 * else's. `$.fs` has no delete, so a session that ended is simply shown as
 * stale; "Prune stale" overwrites such files with `{ "ended": true }` and a
 * file silent for 24 hours is overwritten the same way by whoever reads it.
 * A heartbeat holds a project name, the first 80 characters of the task
 * (redacted for obvious secrets, never a whole prompt) and a state: nothing else.
 */

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Mission Control', he: 'חדר בקרה', es: 'Centro de control', fr: 'Centre de contrôle', ru: 'Центр управления', zh: '任务指挥中心', ja: 'ミッションコントロール', pt: 'Central de missões', de: 'Mission Control', ko: '미션 컨트롤' },
  description: {
    en: 'A pane listing every running Claude Code session on this machine and which ones need you (/mission).',
    he: 'חלונית שמציגה כל סשן Claude Code שרץ במחשב הזה ואילו מהם זקוקים לך (/mission).',
    es: 'Un panel con todas las sesiones de Claude Code en ejecución en este equipo y cuáles te necesitan (/mission).',
    fr: 'Un panneau listant chaque session Claude Code en cours sur cette machine et celles qui ont besoin de toi (/mission).',
    ru: 'Панель со всеми запущенными сессиями Claude Code на этом компьютере и тем, какие из них ждут вас (/mission).',
    zh: '列出本机所有运行中的 Claude Code 会话以及哪些需要你处理的面板（/mission）。',
    ja: 'このマシンで実行中のすべての Claude Code セッションと、対応が必要なものを一覧表示するペイン（/mission）。',
    pt: 'Um painel que lista todas as sessões do Claude Code em execução nesta máquina e quais precisam de você (/mission).',
    de: 'Ein Panel, das alle laufenden Claude-Code-Sessions auf diesem Rechner zeigt und welche dich brauchen (/mission).',
    ko: '이 컴퓨터에서 실행 중인 모든 Claude Code 세션과 사용자 확인이 필요한 세션을 보여 주는 창입니다(/mission).',
  },
  cmdDesc: {
    en: 'Opens Mission Control: every running session on this machine',
    he: 'פותח את חדר הבקרה: כל הסשנים הרצים במחשב הזה',
    es: 'Abre el centro de control: todas las sesiones en ejecución en este equipo',
    fr: 'Ouvre le centre de contrôle : toutes les sessions en cours sur cette machine',
    ru: 'Открывает центр управления: все запущенные сессии на этом компьютере',
    zh: '打开任务指挥中心：本机所有运行中的会话',
    ja: 'ミッションコントロールを開きます：このマシンで実行中のすべてのセッション',
    pt: 'Abre a Central de missões: todas as sessões em execução nesta máquina',
    de: 'Öffnet Mission Control: alle laufenden Sessions auf diesem Rechner',
    ko: '미션 컨트롤을 엽니다: 이 컴퓨터에서 실행 중인 모든 세션',
  },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty',
    ru: 'Функция выключена; включите её в панели /toolkitty',
    zh: '该功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  paneOff: {
    en: 'The feature is off in the switchboard.',
    he: 'השכלול כבוי בלוח המתגים.',
    es: 'La función está desactivada en el panel de interruptores.',
    fr: 'La fonctionnalité est désactivée dans le panneau des interrupteurs.',
    ru: 'Функция выключена на панели переключателей.',
    zh: '该功能已在开关面板中关闭。',
    ja: 'この機能はスイッチパネルでオフになっています。',
    pt: 'O recurso está desativado no painel de controle.',
    de: 'Die Funktion ist in der Schaltzentrale aus.',
    ko: '이 기능은 스위치 패널에서 꺼져 있습니다.',
  },
  opened: { en: 'Mission Control is open.', he: 'חדר הבקרה נפתח.', es: 'El centro de control está abierto.', fr: 'Le centre de contrôle est ouvert.', ru: 'Центр управления открыт.', zh: '任务指挥中心已打开。', ja: 'ミッションコントロールを開いています。', pt: 'A Central de missões está aberta.', de: 'Mission Control ist geöffnet.', ko: '미션 컨트롤이 열려 있습니다.' },
  paneTitle: { en: 'Mission Control', he: 'חדר בקרה', es: 'Centro de control', fr: 'Centre de contrôle', ru: 'Центр управления', zh: '任务指挥中心', ja: 'ミッションコントロール', pt: 'Central de missões', de: 'Mission Control', ko: '미션 컨트롤' },
  status: {
    en: '{n} sessions · {m} need you',
    he: '{n} סשנים · {m} זקוקים לך',
    es: '{n} sesiones · {m} te necesitan',
    fr: '{n} sessions · {m} t’attendent',
    ru: 'сессий: {n} · ждут вас: {m}',
    zh: '{n} 个会话 · {m} 个需要你',
    ja: '{n} セッション · {m} 件が対応待ち',
    pt: '{n} sessões · {m} precisam de você',
    de: '{n} Sessions · {m} brauchen dich',
    ko: '세션 {n}개 · {m}개 확인 필요',
  },
  needsMe: { en: 'Needs me', he: 'זקוקים לי', es: 'Me necesitan', fr: 'Ont besoin de moi', ru: 'Ждут меня', zh: '需要我处理', ja: '要対応', pt: 'Precisam de mim', de: 'Braucht mich', ko: '내 확인 필요' },
  running: { en: 'Sessions', he: 'סשנים', es: 'Sesiones', fr: 'Sessions', ru: 'Сессии', zh: '会话', ja: 'セッション', pt: 'Sessões', de: 'Sessions', ko: '세션' },
  staleTitle: { en: 'Stale (no heartbeat for 2 minutes)', he: 'תקועים (בלי דופק 2 דקות)', es: 'Obsoletas (sin señal desde hace 2 minutos)', fr: 'Périmées (aucun signal depuis 2 minutes)', ru: 'Устаревшие (нет сигнала 2 минуты)', zh: '已失效（2 分钟无心跳）', ja: '停止（2 分間ハートビートなし）', pt: 'Inativas (sem heartbeat há 2 minutos)', de: 'Veraltet (seit 2 Minuten kein Heartbeat)', ko: '오래됨(2분간 하트비트 없음)' },
  btnRefresh: { en: 'Refresh', he: 'רענן', es: 'Actualizar', fr: 'Actualiser', ru: 'Обновить', zh: '刷新', ja: '更新', pt: 'Atualizar', de: 'Aktualisieren', ko: '새로고침' },
  btnOnly: { en: 'Only mine needing attention', he: 'רק אלה שזקוקים לי', es: 'Solo las que necesitan atención', fr: 'Seulement celles à traiter', ru: 'Только требующие внимания', zh: '仅显示需要我处理的', ja: '要対応のものだけ表示', pt: 'Só as que precisam de mim', de: 'Nur meine, die Aufmerksamkeit brauchen', ko: '내 확인이 필요한 것만' },
  btnPrune: { en: 'Prune stale', he: 'נקה תקועים', es: 'Limpiar obsoletas', fr: 'Purger les périmées', ru: 'Убрать устаревшие', zh: '清理失效会话', ja: '停止したものを削除', pt: 'Limpar inativas', de: 'Veraltete entfernen', ko: '오래된 세션 정리' },
  thisOne: { en: '(this)', he: '(זה)', es: '(esta)', fr: '(celle-ci)', ru: '(эта)', zh: '（当前）', ja: '（これ）', pt: '(esta)', de: '(diese)', ko: '(현재)' },
  noTask: { en: 'no task yet', he: 'אין משימה עדיין', es: 'sin tarea aún', fr: 'pas encore de tâche', ru: 'задачи пока нет', zh: '暂无任务', ja: 'タスクはまだありません', pt: 'sem tarefa ainda', de: 'noch keine Aufgabe', ko: '아직 작업 없음' },
  stWorking: { en: 'working', he: 'עובד', es: 'trabajando', fr: 'en cours', ru: 'работает', zh: '工作中', ja: '作業中', pt: 'trabalhando', de: 'arbeitet', ko: '작업 중' },
  stWaiting: { en: 'waiting for you', he: 'מחכה לך', es: 'te espera', fr: 't’attend', ru: 'ждёт вас', zh: '等待你', ja: 'あなたの対応待ち', pt: 'aguardando você', de: 'wartet auf dich', ko: '사용자 대기 중' },
  stError: { en: 'error', he: 'שגיאה', es: 'error', fr: 'erreur', ru: 'ошибка', zh: '错误', ja: 'エラー', pt: 'erro', de: 'Fehler', ko: '오류' },
  stIdle: { en: 'idle', he: 'לא פעיל', es: 'inactiva', fr: 'inactive', ru: 'простаивает', zh: '空闲', ja: 'アイドル', pt: 'ocioso', de: 'untätig', ko: '유휴' },
  stDone: { en: 'done', he: 'הסתיים', es: 'lista', fr: 'terminée', ru: 'готово', zh: '已完成', ja: '完了', pt: 'concluído', de: 'fertig', ko: '완료' },
  stStale: { en: 'stale', he: 'תקוע', es: 'obsoleta', fr: 'périmée', ru: 'устарела', zh: '已失效', ja: '停止', pt: 'inativa', de: 'veraltet', ko: '오래됨' },
  ageNow: { en: 'now', he: 'עכשיו', es: 'ahora', fr: 'maintenant', ru: 'сейчас', zh: '刚刚', ja: '今', pt: 'agora', de: 'jetzt', ko: '지금' },
  ageMin: { en: '{n}m', he: '{n} ד׳', es: '{n} min', fr: '{n} min', ru: '{n} мин', zh: '{n}分', ja: '{n}分', pt: '{n}m', de: '{n}m', ko: '{n}분' },
  ageHour: { en: '{n}h', he: '{n} ש׳', es: '{n} h', fr: '{n} h', ru: '{n} ч', zh: '{n}小时', ja: '{n}時間', pt: '{n}h', de: '{n}h', ko: '{n}시간' },
  ageDay: { en: '{n}d', he: '{n} י׳', es: '{n} d', fr: '{n} j', ru: '{n} д', zh: '{n}天', ja: '{n}日', pt: '{n}d', de: '{n}T', ko: '{n}일' },
  more: { en: '+{n} more not shown', he: '+{n} נוספים שלא מוצגים', es: '+{n} más sin mostrar', fr: '+{n} autres non affichées', ru: 'ещё не показано: {n}', zh: '另有 {n} 项未显示', ja: 'ほか {n} 件は非表示', pt: '+{n} a mais não exibidos', de: '+{n} weitere nicht angezeigt', ko: '+{n}개 더 표시되지 않음' },
  none: { en: 'No sessions are reporting yet.', he: 'עדיין אין סשנים שמדווחים.', es: 'Aún no informa ninguna sesión.', fr: 'Aucune session ne se signale pour le moment.', ru: 'Пока ни одна сессия не отчитывается.', zh: '还没有会话在上报。', ja: '報告しているセッションはまだありません。', pt: 'Nenhuma sessão está reportando ainda.', de: 'Noch meldet sich keine Session.', ko: '아직 보고하는 세션이 없습니다.' },
  noneHint: {
    en: 'Every session running this toolkitty writes a heartbeat every 30 seconds and shows up here. Switching to another session from here is not supported.',
    he: 'כל סשן שמריץ את Toolkitty כותב דופק כל 30 שניות ומופיע כאן. מעבר לסשן אחר מכאן אינו נתמך.',
    es: 'Cada sesión que ejecuta Toolkitty escribe un latido cada 30 segundos y aparece aquí. Cambiar a otra sesión desde aquí no es posible.',
    fr: 'Chaque session qui exécute Toolkitty écrit un battement toutes les 30 secondes et apparaît ici. Passer à une autre session depuis ici n’est pas pris en charge.',
    ru: 'Каждая сессия с Toolkitty пишет сигнал раз в 30 секунд и появляется здесь. Переключиться на другую сессию отсюда нельзя.',
    zh: '每个运行 Toolkitty 的会话每 30 秒写入一次心跳，并显示在这里。不支持从这里切换到其他会话。',
    ja: 'Toolkitty を実行しているセッションは 30 秒ごとにハートビートを書き込み、ここに表示されます。ここから別のセッションに切り替えることはできません。',
    pt: 'Toda sessão que executa o Toolkitty grava um heartbeat a cada 30 segundos e aparece aqui. Não é possível alternar para outra sessão a partir daqui.',
    de: 'Jede Session, in der Toolkitty läuft, schreibt alle 30 Sekunden einen Heartbeat und erscheint hier. Der Wechsel zu einer anderen Session von hier aus wird nicht unterstützt.',
    ko: 'Toolkitty를 실행 중인 모든 세션은 30초마다 하트비트를 기록하며 여기에 표시됩니다. 여기서 다른 세션으로 전환하는 기능은 지원되지 않습니다.',
  },
  alone: { en: 'No other sessions are running.', he: 'אין סשנים אחרים שרצים.', es: 'No hay otras sesiones en ejecución.', fr: 'Aucune autre session en cours.', ru: 'Других запущенных сессий нет.', zh: '没有其他运行中的会话。', ja: '他に実行中のセッションはありません。', pt: 'Nenhuma outra sessão em execução.', de: 'Es laufen keine anderen Sessions.', ko: '실행 중인 다른 세션이 없습니다.' },
  aloneHint: {
    en: 'Other sessions appear here once they run Toolkitty. Switching to another session from here is not supported.',
    he: 'סשנים אחרים יופיעו כאן כשירוצו את Toolkitty. מעבר לסשן אחר מכאן אינו נתמך.',
    es: 'Otras sesiones aparecerán aquí cuando ejecuten Toolkitty. Cambiar a otra sesión desde aquí no es posible.',
    fr: 'Les autres sessions apparaîtront ici dès qu’elles exécutent Toolkitty. Passer à une autre session depuis ici n’est pas pris en charge.',
    ru: 'Другие сессии появятся здесь, когда в них запустится Toolkitty. Переключиться на другую сессию отсюда нельзя.',
    zh: '其他会话运行 Toolkitty 后会显示在这里。不支持从这里切换到其他会话。',
    ja: '他のセッションが Toolkitty を実行すると、ここに表示されます。ここから別のセッションに切り替えることはできません。',
    pt: 'Outras sessões aparecem aqui quando executam o Toolkitty. Não é possível alternar para outra sessão a partir daqui.',
    de: 'Andere Sessions erscheinen hier, sobald in ihnen Toolkitty läuft. Der Wechsel zu einer anderen Session von hier aus wird nicht unterstützt.',
    ko: '다른 세션이 Toolkitty를 실행하면 여기에 표시됩니다. 여기서 다른 세션으로 전환하는 기능은 지원되지 않습니다.',
  },
  noNeeding: { en: 'No session needs you right now.', he: 'אף סשן לא זקוק לך כרגע.', es: 'Ninguna sesión te necesita ahora mismo.', fr: 'Aucune session n’a besoin de toi pour le moment.', ru: 'Сейчас вас не ждёт ни одна сессия.', zh: '目前没有需要你处理的会话。', ja: '今、対応が必要なセッションはありません。', pt: 'Nenhuma sessão precisa de você agora.', de: 'Im Moment braucht dich keine Session.', ko: '지금 확인이 필요한 세션이 없습니다.' },
  noNeedingHint: {
    en: 'Turn off "Only mine needing attention" to see every session.',
    he: 'כבה את "רק אלה שזקוקים לי" כדי לראות את כל הסשנים.',
    es: 'Desactiva "Solo las que necesitan atención" para ver todas las sesiones.',
    fr: 'Désactive « Seulement celles à traiter » pour voir toutes les sessions.',
    ru: 'Выключите «Только требующие внимания», чтобы увидеть все сессии.',
    zh: '关闭“仅显示需要我处理的”即可查看所有会话。',
    ja: 'すべてのセッションを見るには「要対応のものだけ表示」をオフにしてください。',
    pt: 'Desative "Só as que precisam de mim" para ver todas as sessões.',
    de: 'Schalte „Nur meine, die Aufmerksamkeit brauchen“ aus, um alle Sessions zu sehen.',
    ko: '모든 세션을 보려면 "내 확인이 필요한 것만"을 끄세요.',
  },
  footer: {
    en: 'Listing only: switching to another session from here is not supported.',
    he: 'רשימה בלבד: מעבר לסשן אחר מכאן אינו נתמך.',
    es: 'Solo un listado: cambiar a otra sesión desde aquí no es posible.',
    fr: 'Liste seule : passer à une autre session depuis ici n\'est pas pris en charge.',
    ru: 'Только список: переключиться на другую сессию отсюда нельзя.',
    zh: '仅供查看：不支持从这里切换到其他会话。',
    ja: '一覧表示のみ：ここから別のセッションに切り替えることはできません。',
    pt: 'Apenas listagem: não é possível alternar para outra sessão a partir daqui.',
    de: 'Nur Auflistung: Der Wechsel zu einer anderen Session von hier aus wird nicht unterstützt.',
    ko: '목록 전용: 여기서 다른 세션으로 전환하는 기능은 지원되지 않습니다.',
  },
  pruned: { en: 'Pruned {n} stale sessions.', he: 'נוקו {n} סשנים תקועים.', es: 'Se limpiaron {n} sesiones obsoletas.', fr: '{n} sessions périmées purgées.', ru: 'Убрано устаревших сессий: {n}.', zh: '已清理 {n} 个失效会话。', ja: '停止したセッションを {n} 件削除しました。', pt: '{n} sessões inativas removidas.', de: '{n} veraltete Sessions entfernt.', ko: '오래된 세션 {n}개를 정리했습니다.' },
  nothingToPrune: { en: 'Nothing stale to prune.', he: 'אין מה לנקות.', es: 'No hay nada obsoleto que limpiar.', fr: 'Rien de périmé à purger.', ru: 'Устаревших нет.', zh: '没有需要清理的失效会话。', ja: '削除する停止セッションはありません。', pt: 'Nada inativo para limpar.', de: 'Nichts Veraltetes zu entfernen.', ko: '정리할 오래된 세션이 없습니다.' },
  chip: { en: '{n} need you', he: '{n} זקוקים לך', es: '{n} te necesitan', fr: '{n} t’attendent', ru: 'ждут вас: {n}', zh: '{n} 个需要你', ja: '{n} 件が対応待ち', pt: '{n} precisam de você', de: '{n} brauchen dich', ko: '{n}개 확인 필요' },
} as const

type BeatState = 'working' | 'waiting' | 'idle' | 'error' | 'done'
type Usage = { contextPercent?: number; weeklyPercent?: number }

/** A session's heartbeat as it is written to its file (`stateSince` is an optional extra: when `state` last changed). */
type Beat = {
  id: string
  cwd: string
  project: string
  startedAt: number
  updatedAt: number
  state: BeatState
  task: string
  stateSince?: number
  lastError?: string
  usage?: Usage
}
/** A heartbeat read back, with the file it came from. */
type Row = Beat & { file: string }

type Mc = {
  selfId: string
  cwd: string
  startedAt: number
  state: BeatState
  stateSince: number
  task: string
  prompt: string
  lastError: string
  sessions: Row[]
  scannedAt: number
  mineOnly: boolean
}

const mc = atom(
  { plugin: 'toolkitty', key: 'slot', id: 'mission-control' } as const,
  {
    selfId: '',
    cwd: '',
    startedAt: 0,
    state: 'idle',
    stateSince: 0,
    task: '',
    prompt: '',
    lastError: '',
    sessions: [],
    scannedAt: 0,
    mineOnly: false,
  } as Mc,
) as unknown as Atom<Mc>

export const feature: Feature = {
  id: 'mission-control',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const PANE = 'mission-control'
const FOLDER = '.claude/toolkitty-sessions'
const BEAT_MS = 30_000
const POLL_MS = 15_000
const STALE_MS = 120_000
const DEAD_MS = 86_400_000
const MAX_TASK = 80
const MAX_FILES = 80
const MAX_TOMBSTONES = 20
const STATES: readonly string[] = ['working', 'waiting', 'idle', 'error', 'done']
const ERROR_TEXT = 'turn ended with an error'

let ticker: Timer | undefined
let poller: Timer | undefined
/** File name -> mtime at which it was seen ended, so a dead file is not read again until it changes. */
const endedSeen = new Map<string, number>()

/* ---------- pure helpers ---------- */

const SECRETS: readonly [RegExp, string][] = [
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, '[redacted]'],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/g, '[redacted]'],
  [/\bAKIA[0-9A-Z]{12,}/g, '[redacted]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{8,}/g, '[redacted]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.?[A-Za-z0-9_-]*/g, '[redacted]'],
  [/\/\/[^\s/:@]+:[^\s/@]+@/g, '//[redacted]@'],
  [/\b(password|passwd|pwd|secret|token|api[_-]?key|apikey|auth)\s*[:=]\s*\S+/gi, '$1=[redacted]'],
  [/\b(?=[A-Za-z0-9+_-]*\d)(?=[A-Za-z0-9+_-]*[A-Za-z])[A-Za-z0-9+_-]{32,}/g, '[redacted]'],
]

/** One line of at most 80 characters, with obvious secrets masked. Never a whole prompt. */
function cleanText(text: string, max: number = MAX_TASK): string {
  let s = text.replace(/\s+/g, ' ').trim()
  for (const [pattern, to] of SECRETS) s = s.replace(pattern, to)
  return Array.from(s).slice(0, max).join('').trimEnd()
}

function folderOf(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(p => p !== '')
  return cleanText(parts[parts.length - 1] ?? cwd, 40)
}

const fileOf = (id: string): string => `${id.replace(/[^\w-]/g, '_')}.json`

const isStale = (b: Beat, now: number): boolean => now - b.updatedAt > STALE_MS
const needsMe = (b: Beat, now: number): boolean => !isStale(b, now) && (b.state === 'waiting' || b.state === 'error')

const num = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)

/** Reads one heartbeat file: a Row, 'ended' for a tombstone, or null when it is not a heartbeat. */
function parseBeat(file: string, text: string): Row | 'ended' | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o['ended'] === true) return 'ended'
  const updatedAt = num(o['updatedAt'])
  if (updatedAt === undefined) return null
  const id = typeof o['id'] === 'string' && o['id'] !== '' ? cleanText(o['id'], 80) : file.replace(/\.json$/, '')
  const cwd = typeof o['cwd'] === 'string' ? cleanText(o['cwd'], 300) : ''
  const stateRaw = typeof o['state'] === 'string' && STATES.includes(o['state']) ? (o['state'] as BeatState) : 'idle'
  const row: Row = {
    id,
    file,
    cwd,
    project: typeof o['project'] === 'string' && o['project'] !== '' ? cleanText(o['project'], 40) : folderOf(cwd),
    startedAt: num(o['startedAt']) ?? updatedAt,
    updatedAt,
    state: stateRaw,
    task: typeof o['task'] === 'string' ? cleanText(o['task']) : '',
  }
  const since = num(o['stateSince'])
  if (since !== undefined) row.stateSince = since
  if (typeof o['lastError'] === 'string' && o['lastError'] !== '') row.lastError = cleanText(o['lastError'])
  const u = o['usage']
  if (u !== null && typeof u === 'object') {
    const r = u as Record<string, unknown>
    const usage: Usage = {}
    const c = num(r['contextPercent'])
    const w = num(r['weeklyPercent'])
    if (c !== undefined) usage.contextPercent = c
    if (w !== undefined) usage.weeklyPercent = w
    row.usage = usage
  }
  return row
}

function ageText(ms: number): string {
  const mins = Math.floor(Math.max(0, ms) / 60_000)
  if (mins < 1) return t(T.ageNow)
  if (mins < 60) return t(T.ageMin, { n: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t(T.ageHour, { n: hrs })
  return t(T.ageDay, { n: Math.floor(hrs / 24) })
}

function stateLabel(state: BeatState): string {
  switch (state) {
    case 'working':
      return t(T.stWorking)
    case 'waiting':
      return t(T.stWaiting)
    case 'error':
      return t(T.stError)
    case 'done':
      return t(T.stDone)
    default:
      return t(T.stIdle)
  }
}

const GLYPH: Record<BeatState, string> = { working: '⚡', waiting: '🟡', error: '🔴', idle: '○', done: '✓' }
const STALE_GLYPH = '◌'

const LEVEL_OF: Record<BeatState, Level> = { working: 'info', waiting: 'warn', error: 'alert', idle: 'ok', done: 'ok' }

const ORDER: Record<BeatState, number> = { waiting: 0, error: 1, working: 2, idle: 3, done: 4 }

/* ---------- file access (all best effort: a heartbeat must never break a turn) ---------- */

async function folderPath($: EngineInterface): Promise<string> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
  const clean = home.split(String.fromCharCode(92)).join('/').replace(/\/+$/, '')
  return clean === '' ? '' : `${clean}/${FOLDER}`
}

async function usageOf($: EngineInterface): Promise<Usage | undefined> {
  try {
    const u = await $.session.usage()
    const usage: Usage = {}
    const c = u.context.percent
    if (typeof c === 'number' && Number.isFinite(c)) usage.contextPercent = Math.round(c)
    const week = u.rateLimits.find(r => r.kind === 'seven_day')
    if (week !== undefined && Number.isFinite(week.percentUsed)) usage.weeklyPercent = Math.round(week.percentUsed)
    return usage.contextPercent === undefined && usage.weeklyPercent === undefined ? undefined : usage
  } catch {
    return undefined
  }
}

function beatOf(m: Mc, now: number, usage?: Usage): Beat {
  const beat: Beat = {
    id: m.selfId,
    cwd: cleanText(m.cwd, 300),
    project: folderOf(m.cwd),
    startedAt: m.startedAt,
    updatedAt: now,
    state: m.state,
    task: m.task,
    stateSince: m.stateSince,
  }
  if (m.state === 'error' && m.lastError !== '') beat.lastError = m.lastError
  if (usage !== undefined) beat.usage = usage
  return beat
}

/** The rows with this session's own row rebuilt from its live state (the file may lag or fail to write). */
function withSelf(m: Mc, rows: Row[], now: number): Row[] {
  if (m.selfId === '') return rows
  const own = rows.find(r => r.id === m.selfId)
  const me: Row = { ...beatOf(m, now, own?.usage), file: fileOf(m.selfId) }
  return [...rows.filter(r => r.id !== m.selfId), me]
}

/** Writes this session's heartbeat file. */
async function writeBeat($: EngineInterface): Promise<void> {
  try {
    const m = await read($, mc)
    if (m.selfId === '') return
    const dir = await folderPath($)
    if (dir === '') return
    const now = await $.clock.now()
    const usage = await usageOf($)
    await $.fs.write(`${dir}/${fileOf(m.selfId)}`, JSON.stringify(beatOf(m, now, usage)))
  } catch {
    // best effort; a later heartbeat tries again
  }
}

/** Reads every heartbeat in the folder into the atom (and tombstones the ones silent for a day). */
async function scanFolder($: EngineInterface): Promise<void> {
  try {
    const dir = await folderPath($)
    if (dir === '') return
    let entries: FsEntry[] = []
    try {
      entries = await $.fs.list(dir)
    } catch {
      entries = []
    }
    const now = await $.clock.now()
    const m = await read($, mc)
    const files = entries
      .filter(x => x.kind === 'file' && /^[\w.-]+\.json$/.test(x.name) && endedSeen.get(x.name) !== x.mtimeMs)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, MAX_FILES)

    const read1 = async (f: FsEntry): Promise<Row | null> => {
      try {
        const parsed = parseBeat(f.name, await $.fs.read(`${dir}/${f.name}`))
        if (parsed === 'ended') {
          endedSeen.set(f.name, f.mtimeMs)
          return null
        }
        return parsed
      } catch {
        return null
      }
    }
    const rows = (await Promise.all(files.map(read1))).filter((r): r is Row => r !== null)

    const found: Row[] = []
    let tombstones = 0
    for (const r of rows) {
      if (r.id === m.selfId) continue
      if (now - r.updatedAt > DEAD_MS) {
        if (tombstones < MAX_TOMBSTONES) {
          tombstones += 1
          try {
            await $.fs.write(`${dir}/${r.file}`, JSON.stringify({ ended: true }))
          } catch {
            // left for a later reader
          }
        }
        continue
      }
      found.push(r)
    }

    const own = rows.find(r => r.id === m.selfId)
    if (own !== undefined) found.push(own)

    await update($, mc, s => ({ ...s, sessions: found, scannedAt: now }))
  } catch {
    // a failed scan is retried on a later tick
  }
}

/** Starts (or restarts) this session's heartbeat: writes the file, reads the others, and keeps both going every 30 s. */
async function begin($: EngineInterface): Promise<void> {
  const [id, cwd, now] = await Promise.all([$.session.id(), $.session.cwd(), $.clock.now()])
  await update($, mc, s => ({ ...s, selfId: id, cwd, startedAt: now, state: 'idle' as BeatState, stateSince: now, task: '', prompt: '', lastError: '' }))
  await writeBeat($)
  await scanFolder($)
  ticker?.cancel()
  ticker = $.clock.every(BEAT_MS, async () => {
    try {
      if (!(await isOn($, feature))) return
      await writeBeat($)
      await scanFolder($)
    } catch {
      // retried on a later tick
    }
  })
}

/** A feature switched on mid-session has no identity yet: start it the first time an event arrives. */
async function ensureStarted($: EngineInterface): Promise<void> {
  if ((await read($, mc)).selfId === '') await begin($)
}

type Patch = { state?: BeatState; task?: string; lastError?: string }

/** Changes this session's own heartbeat and writes it when something the file shows changed. */
async function setSelf($: EngineInterface, patch: Patch): Promise<void> {
  const before = await read($, mc)
  const state = patch.state ?? before.state
  const task = patch.task ?? before.task
  const lastError = patch.lastError ?? before.lastError
  if (state === before.state && task === before.task && lastError === before.lastError) return
  const now = await $.clock.now()
  await update($, mc, s => ({ ...s, state, task, lastError, stateSince: state === s.state ? s.stateSince : now }))
  await writeBeat($)
}

async function startPoll($: EngineInterface): Promise<void> {
  poller?.cancel()
  poller = $.clock.every(POLL_MS, async () => {
    try {
      const open = (await isOn($, feature)) && (await $.ui.panes()).some(p => p.id === PANE)
      if (!open) {
        poller?.cancel()
        poller = undefined
        return
      }
      await scanFolder($)
    } catch {
      // retried on a later tick
    }
  })
}

async function refreshNow($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  await scanFolder($)
}

async function toggleOnly($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  await update($, mc, s => ({ ...s, mineOnly: !s.mineOnly }))
}

/** Overwrites every other session's stale file with `{ "ended": true }` ($.fs has no delete). */
async function pruneStale($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  await scanFolder($)
  const m = await read($, mc)
  const now = await $.clock.now()
  const dir = await folderPath($)
  let pruned = 0
  if (dir !== '') {
    for (const r of m.sessions) {
      if (r.id === m.selfId || !isStale(r, now)) continue
      try {
        await $.fs.write(`${dir}/${r.file}`, JSON.stringify({ ended: true }))
        pruned += 1
      } catch {
        // left in place
      }
    }
  }
  await scanFolder($)
  await notice($, 'info', pruned > 0 ? t(T.pruned, { n: pruned }) : t(T.nothingToPrune), feature.id, { immediate: true })
}

/* ---------- handlers ---------- */

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'mission', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'mission', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  await begin($)
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'> | { drop: string }> {
  if (!(await isOn($, feature))) return e
  const text = e.text.trim()
  if (text === '' || text.startsWith('/')) return e
  await ensureStarted($)
  const prompt = cleanText(text)
  await update($, mc, s => (s.prompt === prompt ? s : { ...s, prompt }))
  return e
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await ensureStarted($)
  const m = await read($, mc)
  const fromText = e.text.trim().startsWith('/') ? '' : cleanText(e.text)
  const task = m.prompt !== '' ? m.prompt : fromText !== '' ? fromText : m.task
  await update($, mc, s => ({ ...s, prompt: '' }))
  await setSelf($, { state: 'working', task, lastError: '' })
}

export async function afterToolCheck($: EngineInterface, e: Input<'tool.check'>, verdict: Output<'tool.check'>): Promise<Output<'tool.check'>> {
  if (verdict.decision !== 'ask' || !(await isOn($, feature))) return verdict
  await ensureStarted($)
  await setSelf($, { state: 'waiting' })
  return verdict
}

function inProgressTodo(e: ToolCallInput): string | undefined {
  const todos = (e as unknown as Record<string, unknown>)['todos']
  if (!Array.isArray(todos)) return undefined
  for (const item of todos) {
    if (item === null || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (r['status'] === 'in_progress' && typeof r['content'] === 'string' && r['content'].trim() !== '') return cleanText(r['content'])
  }
  return undefined
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  const isMain = (e as unknown as { agentId?: string }).agentId === undefined
  const todo = e.tool === 'TodoWrite' && isMain ? inProgressTodo(e) : undefined
  const m = await read($, mc)
  const patch: Patch = {}
  if (todo !== undefined) patch.task = todo
  if (m.state === 'waiting') patch.state = 'working'
  if (patch.task !== undefined || patch.state !== undefined) {
    await ensureStarted($)
    await setSelf($, patch)
  }
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  poller?.cancel()
  poller = undefined
  if (!(await isOn($, feature))) return
  await ensureStarted($)
  if (e.reason === 'error') await setSelf($, { state: 'error', lastError: ERROR_TEXT })
  else await setSelf($, { state: 'idle', lastError: '' })
}

/** The short band form: how many OTHER sessions are waiting for the person or failed. Quiet when none. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const m = await read($, mc)
  const now = await $.clock.now()
  const n = m.sessions.filter(r => r.id !== m.selfId && needsMe(r, now)).length
  if (n === 0) return null
  return { text: t(T.chip, { n }), level: 'warn', icon: ICONS.visibility }
}

export function register(on: On) {
  on('command.run', { command: 'mission' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await ensureStarted($)
    await $.ui.open({ id: PANE, title: t(T.paneTitle) })
    await startPoll($)
    await scanFolder($)
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const m = await read($, mc)
    const now = await $.clock.now()
    const sessions = withSelf(m, m.sessions, now)
    const live = sessions.filter(r => !isStale(r, now))
    const stale = sessions.filter(r => isStale(r, now)).sort((a, b) => b.updatedAt - a.updatedAt)
    const needs = live
      .filter(r => needsMe(r, now))
      .sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.stateSince ?? a.updatedAt) - (b.stateSince ?? b.updatedAt))
    const rest = live
      .filter(r => !needsMe(r, now))
      .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.project.localeCompare(b.project))
    const others = sessions.filter(r => r.id !== m.selfId).length
    const hasError = needs.some(r => r.state === 'error')
    const level: Level = needs.length === 0 ? 'ok' : hasError ? 'alert' : 'warn'

    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: t(T.status, { n: live.length, m: needs.length }),
      level,
      icon: ICONS.visibility,
      actions: [
        { key: 'mc-refresh', label: t(T.btnRefresh), onPress: () => void refreshNow($) },
        { key: 'mc-only', label: `${m.mineOnly ? '●' : '○'} ${t(T.btnOnly)}`, onPress: () => void toggleOnly($) },
        { key: 'mc-prune', label: t(T.btnPrune), onPress: () => void pruneStale($) },
      ],
    })

    if (sessions.length === 0) {
      return (
        <Box flexDirection="column">
          {header}
          {emptyState($, e, t(T.none), t(T.noneHint))}
        </Box>
      )
    }
    if (m.mineOnly && needs.length === 0) {
      return (
        <Box flexDirection="column">
          {header}
          {emptyState($, e, t(T.noNeeding), t(T.noNeedingHint))}
        </Box>
      )
    }

    const rowFor = (r: Row, isOld: boolean) => {
      const self = r.id === m.selfId
      const task = r.task !== '' ? r.task : t(T.noTask)
      const since = isOld ? r.updatedAt : (r.stateSince ?? r.updatedAt)
      return listRow($, e, {
        key: `mc-${r.id}`,
        left: isOld ? STALE_GLYPH : GLYPH[r.state],
        text: `${r.project}${self ? ` ${t(T.thisOne)}` : ''} · ${task}`,
        right: `${isOld ? t(T.stStale) : stateLabel(r.state)} · ${ageText(now - since)}`,
        level: isOld ? 'ok' : LEVEL_OF[r.state],
      })
    }

    let room = Math.max(4, (e.viewport?.rows ?? 25) - 8)
    const take = (list: Row[]): Row[] => {
      const shown = list.slice(0, Math.max(0, room))
      room -= shown.length
      return shown
    }
    const showNeeds = take(needs)
    const showRest = m.mineOnly ? [] : take(rest)
    const showStale = m.mineOnly ? [] : take(stale)
    const hidden = needs.length - showNeeds.length + (m.mineOnly ? 0 : rest.length - showRest.length + stale.length - showStale.length)

    return (
      <Box flexDirection="column">
        {header}
        {showNeeds.length > 0 ? sectionTitle($, e, t(T.needsMe)) : null}
        {showNeeds.map(r => rowFor(r, false))}
        {showRest.length > 0 ? sectionTitle($, e, t(T.running)) : null}
        {showRest.map(r => rowFor(r, false))}
        {showStale.length > 0 ? sectionTitle($, e, t(T.staleTitle)) : null}
        {showStale.map(r => rowFor(r, true))}
        {hidden > 0 ? <Text dimColor>{t(T.more, { n: hidden })}</Text> : null}
        {others === 0 ? emptyState($, e, t(T.alone), t(T.aloneHint)) : (
          <Text dimColor size="footnote">
            {t(T.footer)}
          </Text>
        )}
      </Box>
    )
  })
}
