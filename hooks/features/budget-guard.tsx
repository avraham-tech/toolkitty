import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { BandInput, BandLine, Feature, Input, Output, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { exportBar } from '../exports'
import { publish, retract, retractAll } from '../signals'
import { ICONS, emptyState, paneHeader, sectionTitle } from '../ui'
import type { Chip } from '../ui'

const MODEL_NUDGE_EN =
  'The user\'s usage budget is nearly exhausted ({windows}). Be terse. Do not start large new work or long explorations. Ask the user before doing anything expensive (big refactors, wide searches, many tool calls, sub-agents). Keep the remaining budget for what the user explicitly asks for.'
const MODEL_DENY_EN =
  'The user\'s weekly usage budget is nearly exhausted and Budget guard has paused tool use. Stop now: do not call more tools. Tell the user briefly where you stopped and wait for their approval (they can run /budget allow to approve work until the window resets).'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: {
    en: 'Budget guard',
    he: 'שומר התקציב',
    es: 'Guardián del presupuesto',
    fr: 'Garde-budget',
    ru: 'Страж лимита',
    zh: '预算守卫',
    ja: '予算ガード',
    pt: 'Guarda de orçamento',
    de: 'Budget-Wächter',
    ko: '예산 가드',
  },
  description: {
    en: 'When your weekly or 5-hour usage gets close to the limit, asks for your approval before each prompt, so the last percent is not burned on something unimportant.',
    he: 'כשהצריכה השבועית או ב-5 שעות קרובה למגבלה, מבקש את אישורך לפני כל בקשה, כדי שהאחוז האחרון לא יתבזבז על דבר לא חשוב.',
    es: 'Cuando el uso semanal o de 5 horas se acerca al límite, pide tu aprobación antes de cada mensaje, para que el último porcentaje no se gaste en algo sin importancia.',
    fr: 'Quand ton utilisation hebdomadaire ou sur 5 heures approche de la limite, demande ton accord avant chaque message, pour que le dernier pourcent ne soit pas gaspillé pour rien.',
    ru: 'Когда недельный или 5-часовой расход близок к лимиту, просит вашего подтверждения перед каждым запросом, чтобы последние проценты не ушли на неважное.',
    zh: '当每周或 5 小时用量接近上限时，在每次提示前征求你的批准，避免把最后那一点额度浪费在不重要的事情上。',
    ja: '週間または5時間の使用量が上限に近づくと、各プロンプトの前に承認を求め、最後の数パーセントを重要でない作業で使い切らないようにします。',
    pt: 'Quando o uso semanal ou de 5 horas se aproxima do limite, pede sua aprovação antes de cada prompt, para que o último por cento não seja gasto com algo sem importância.',
    de: 'Wenn dein Wochen- oder 5-Stunden-Verbrauch nahe ans Limit kommt, fragt es vor jedem Prompt nach deiner Freigabe, damit das letzte Prozent nicht für Unwichtiges draufgeht.',
    ko: '주간 또는 5시간 사용량이 한도에 가까워지면 프롬프트마다 승인을 요청해, 마지막 1%를 중요하지 않은 일에 쓰지 않도록 합니다.',
  },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty',
    ru: 'Функция отключена; включите её в панели /toolkitty',
    zh: '该功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  // Sent to the model, so every language holds the same English text.
  modelNudge: { en: MODEL_NUDGE_EN, he: MODEL_NUDGE_EN, es: MODEL_NUDGE_EN, fr: MODEL_NUDGE_EN, ru: MODEL_NUDGE_EN, zh: MODEL_NUDGE_EN, ja: MODEL_NUDGE_EN, pt: MODEL_NUDGE_EN, de: MODEL_NUDGE_EN, ko: MODEL_NUDGE_EN },
  modelDeny: { en: MODEL_DENY_EN, he: MODEL_DENY_EN, es: MODEL_DENY_EN, fr: MODEL_DENY_EN, ru: MODEL_DENY_EN, zh: MODEL_DENY_EN, ja: MODEL_DENY_EN, pt: MODEL_DENY_EN, de: MODEL_DENY_EN, ko: MODEL_DENY_EN },
  header: { en: 'Budget', he: 'תקציב', es: 'Presupuesto', fr: 'Budget', ru: 'Лимит', zh: '预算', ja: '予算', pt: 'Orçamento', de: 'Budget', ko: '예산' },
  once: { en: 'Once', he: 'פעם אחת', es: 'Una vez', fr: 'Une fois', ru: 'Один раз', zh: '仅一次', ja: '今回のみ', pt: 'Uma vez', de: 'Einmal', ko: '한 번만' },
  untilReset: { en: 'Until reset', he: 'עד האיפוס', es: 'Hasta el reinicio', fr: 'Jusqu\'au reset', ru: 'До сброса', zh: '直到重置', ja: 'リセットまで', pt: 'Até reiniciar', de: 'Bis zum Reset', ko: '초기화까지' },
  cancel: { en: 'Cancel', he: 'ביטול', es: 'Cancelar', fr: 'Annuler', ru: 'Отмена', zh: '取消', ja: 'キャンセル', pt: 'Cancelar', de: 'Abbrechen', ko: '취소' },
  askWeekly: {
    en: 'Weekly usage is at {percent}% (resets in {time}). Send this prompt anyway?',
    he: 'הצריכה השבועית היא {percent}% (איפוס בעוד {time}). לשלוח את הבקשה בכל זאת?',
    es: 'El uso semanal está al {percent}% (se reinicia en {time}). ¿Enviar este mensaje de todos modos?',
    fr: 'L’utilisation hebdomadaire est à {percent} % (réinitialisation dans {time}). Envoyer quand même ce message ?',
    ru: 'Недельный расход — {percent}% (сброс через {time}). Всё равно отправить этот запрос?',
    zh: '每周用量已达 {percent}%（{time}后重置）。仍要发送此提示吗？',
    ja: '週間の使用量が {percent}% です（{time}後にリセット）。このプロンプトを送信しますか？',
    pt: 'O uso semanal está em {percent}% (reinicia em {time}). Enviar este prompt mesmo assim?',
    de: 'Der Wochenverbrauch liegt bei {percent} % (Reset in {time}). Diesen Prompt trotzdem senden?',
    ko: '주간 사용량이 {percent}%입니다({time} 후 초기화). 그래도 이 프롬프트를 보낼까요?',
  },
  askFive: {
    en: '5-hour usage is at {percent}% (resets in {time}). Send this prompt anyway?',
    he: 'הצריכה ב-5 שעות היא {percent}% (איפוס בעוד {time}). לשלוח את הבקשה בכל זאת?',
    es: 'El uso de 5 horas está al {percent}% (se reinicia en {time}). ¿Enviar este mensaje de todos modos?',
    fr: 'L’utilisation sur 5 heures est à {percent} % (réinitialisation dans {time}). Envoyer quand même ce message ?',
    ru: 'Расход за 5 часов — {percent}% (сброс через {time}). Всё равно отправить этот запрос?',
    zh: '5 小时用量已达 {percent}%（{time}后重置）。仍要发送此提示吗？',
    ja: '5時間の使用量が {percent}% です（{time}後にリセット）。このプロンプトを送信しますか？',
    pt: 'O uso de 5 horas está em {percent}% (reinicia em {time}). Enviar este prompt mesmo assim?',
    de: 'Der 5-Stunden-Verbrauch liegt bei {percent} % (Reset in {time}). Diesen Prompt trotzdem senden?',
    ko: '5시간 사용량이 {percent}%입니다({time} 후 초기화). 그래도 이 프롬프트를 보낼까요?',
  },
  ctxNote: {
    en: ' This session\'s context is about {size} tokens, so each prompt re-reads all of it.',
    he: ' ההקשר של השיחה הוא כ-{size} טוקנים, ולכן כל בקשה קוראת אותו מחדש.',
    es: ' El contexto de esta sesión es de unos {size} tokens, y cada mensaje lo vuelve a leer entero.',
    fr: ' Le contexte de cette session fait environ {size} tokens, et chaque message le relit en entier.',
    ru: ' Контекст сессии — около {size} токенов, и каждый запрос перечитывает его целиком.',
    zh: '本会话的上下文约有 {size} 个 token，因此每次提示都会重新读取全部内容。',
    ja: 'このセッションのコンテキストは約 {size} トークンあり、プロンプトのたびにすべて再読み込みされます。',
    pt: ' O contexto desta sessão tem cerca de {size} tokens, então cada prompt relê tudo.',
    de: ' Der Kontext dieser Session umfasst etwa {size} Tokens, daher liest jeder Prompt alles erneut.',
    ko: ' 이 세션의 컨텍스트는 약 {size} 토큰이라 프롬프트마다 전부 다시 읽습니다.',
  },
  unknownTime: { en: 'an unknown time', he: 'זמן לא ידוע', es: 'un tiempo desconocido', fr: 'un délai inconnu', ru: 'неизвестное время', zh: '未知时间', ja: '不明な時間', pt: 'um tempo desconhecido', de: 'unbekannte Zeit', ko: '알 수 없는 시간' },
  dropped: {
    en: 'Budget guard: prompt not sent, {name} usage is at {percent}%. Run /budget allow to approve until reset.',
    he: 'שומר התקציב: הבקשה לא נשלחה, הצריכה {name} היא {percent}%. הרץ /budget allow לאישור עד האיפוס.',
    es: 'Guardián del presupuesto: mensaje no enviado, el uso {name} está al {percent}%. Ejecuta /budget allow para aprobar hasta el reinicio.',
    fr: 'Garde-budget : message non envoyé, l’utilisation {name} est à {percent} %. Lance /budget allow pour approuver jusqu’à la réinitialisation.',
    ru: 'Страж лимита: запрос не отправлен, {name} расход — {percent}%. Выполните /budget allow, чтобы разрешить до сброса.',
    zh: '预算守卫：提示未发送，{name}用量已达 {percent}%。运行 /budget allow 可批准至重置。',
    ja: '予算ガード：プロンプトは送信されませんでした。{name}の使用量が {percent}% です。リセットまで承認するには /budget allow を実行してください。',
    pt: 'Guarda de orçamento: prompt não enviado, o uso ({name}) está em {percent}%. Execute /budget allow para aprovar até reiniciar.',
    de: 'Budget-Wächter: Prompt nicht gesendet, der Verbrauch ({name}) liegt bei {percent} %. Mit /budget allow gibst du bis zum Reset frei.',
    ko: '예산 가드: 프롬프트를 보내지 않았습니다. {name} 사용량이 {percent}%입니다. 초기화까지 승인하려면 /budget allow를 실행하세요.',
  },
  noSurface: {
    en: 'Budget guard: usage is at {percent}% and there is no screen to ask on. Prompt not sent; run /budget allow to approve.',
    he: 'שומר התקציב: הצריכה היא {percent}% ואין מסך לשאול בו. הבקשה לא נשלחה; הרץ /budget allow לאישור.',
    es: 'Guardián del presupuesto: el uso está al {percent}% y no hay pantalla para preguntar. Mensaje no enviado; ejecuta /budget allow para aprobar.',
    fr: 'Garde-budget : l’utilisation est à {percent} % et aucun écran ne permet de demander. Message non envoyé ; lance /budget allow pour approuver.',
    ru: 'Страж лимита: расход — {percent}%, а спросить негде. Запрос не отправлен; выполните /budget allow, чтобы разрешить.',
    zh: '预算守卫：用量已达 {percent}%，且没有可供询问的界面。提示未发送；运行 /budget allow 以批准。',
    ja: '予算ガード：使用量が {percent}% で、確認できる画面がありません。プロンプトは送信されませんでした。承認するには /budget allow を実行してください。',
    pt: 'Guarda de orçamento: o uso está em {percent}% e não há tela para perguntar. Prompt não enviado; execute /budget allow para aprovar.',
    de: 'Budget-Wächter: Der Verbrauch liegt bei {percent} % und es gibt keinen Bildschirm zum Nachfragen. Prompt nicht gesendet; mit /budget allow freigeben.',
    ko: '예산 가드: 사용량이 {percent}%인데 물어볼 화면이 없습니다. 프롬프트를 보내지 않았습니다. 승인하려면 /budget allow를 실행하세요.',
  },
  nameWeekly: { en: 'weekly', he: 'השבועית', es: 'semanal', fr: 'hebdomadaire', ru: 'недельный', zh: '每周', ja: '週間', pt: 'semanal', de: 'wöchentlich', ko: '주간' },
  nameFive: { en: '5-hour', he: 'ב-5 שעות', es: 'de 5 horas', fr: 'sur 5 heures', ru: '5-часовой', zh: '5 小时', ja: '5時間', pt: '5 horas', de: '5-Stunden', ko: '5시간' },
  crossedWeekly: {
    en: 'Budget guard: weekly usage reached {percent}% (threshold {threshold}%). Prompts will now ask first.',
    he: 'שומר התקציב: הצריכה השבועית הגיעה ל-{percent}% (סף {threshold}%). מעכשיו כל בקשה תדרוש אישור.',
    es: 'Guardián del presupuesto: el uso semanal llegó al {percent}% (umbral {threshold}%). Ahora cada mensaje pedirá aprobación.',
    fr: 'Garde-budget : l’utilisation hebdomadaire a atteint {percent} % (seuil {threshold} %). Chaque message demandera désormais ton accord.',
    ru: 'Страж лимита: недельный расход достиг {percent}% (порог {threshold}%). Теперь каждый запрос будет требовать подтверждения.',
    zh: '预算守卫：每周用量已达 {percent}%（阈值 {threshold}%）。之后的提示将先询问。',
    ja: '予算ガード：週間の使用量が {percent}% に達しました（しきい値 {threshold}%）。今後のプロンプトは先に確認します。',
    pt: 'Guarda de orçamento: o uso semanal chegou a {percent}% (limite {threshold}%). Os prompts agora vão perguntar antes.',
    de: 'Budget-Wächter: Der Wochenverbrauch hat {percent} % erreicht (Schwelle {threshold} %). Prompts fragen jetzt zuerst nach.',
    ko: '예산 가드: 주간 사용량이 {percent}%에 도달했습니다(임계값 {threshold}%). 이제 프롬프트는 먼저 확인을 요청합니다.',
  },
  crossedFive: {
    en: 'Budget guard: 5-hour usage reached {percent}% (threshold {threshold}%). Prompts will now ask first.',
    he: 'שומר התקציב: הצריכה ב-5 שעות הגיעה ל-{percent}% (סף {threshold}%). מעכשיו כל בקשה תדרוש אישור.',
    es: 'Guardián del presupuesto: el uso de 5 horas llegó al {percent}% (umbral {threshold}%). Ahora cada mensaje pedirá aprobación.',
    fr: 'Garde-budget : l’utilisation sur 5 heures a atteint {percent} % (seuil {threshold} %). Chaque message demandera désormais ton accord.',
    ru: 'Страж лимита: расход за 5 часов достиг {percent}% (порог {threshold}%). Теперь каждый запрос будет требовать подтверждения.',
    zh: '预算守卫：5 小时用量已达 {percent}%（阈值 {threshold}%）。之后的提示将先询问。',
    ja: '予算ガード：5時間の使用量が {percent}% に達しました（しきい値 {threshold}%）。今後のプロンプトは先に確認します。',
    pt: 'Guarda de orçamento: o uso de 5 horas chegou a {percent}% (limite {threshold}%). Os prompts agora vão perguntar antes.',
    de: 'Budget-Wächter: Der 5-Stunden-Verbrauch hat {percent} % erreicht (Schwelle {threshold} %). Prompts fragen jetzt zuerst nach.',
    ko: '예산 가드: 5시간 사용량이 {percent}%에 도달했습니다(임계값 {threshold}%). 이제 프롬프트는 먼저 확인을 요청합니다.',
  },
  spanDays: { en: '{days}d {hours}h', he: '{days}י׳ {hours}ש׳', es: '{days}d {hours}h', fr: '{days}j {hours}h', ru: '{days}д {hours}ч', zh: '{days}天{hours}小时', ja: '{days}日{hours}時間', pt: '{days}d {hours}h', de: '{days}d {hours}h', ko: '{days}일 {hours}시간' },
  spanHours: { en: '{hours}h {mins}m', he: '{hours}ש׳ {mins}ד׳', es: '{hours}h {mins}min', fr: '{hours}h {mins}min', ru: '{hours}ч {mins}мин', zh: '{hours}小时{mins}分', ja: '{hours}時間{mins}分', pt: '{hours}h {mins}m', de: '{hours}h {mins}m', ko: '{hours}시간 {mins}분' },
  spanMins: { en: '{mins}m', he: '{mins}ד׳', es: '{mins}min', fr: '{mins}min', ru: '{mins}мин', zh: '{mins}分', ja: '{mins}分', pt: '{mins}m', de: '{mins}m', ko: '{mins}분' },
  resetsIn: { en: 'resets in {time}', he: 'איפוס בעוד {time}', es: 'reinicio en {time}', fr: 'réinit. dans {time}', ru: 'сброс через {time}', zh: '{time}后重置', ja: '{time}後にリセット', pt: 'reinicia em {time}', de: 'Reset in {time}', ko: '{time} 후 초기화' },
  stateLocked: { en: 'locked', he: 'נעול', es: 'bloqueado', fr: 'verrouillé', ru: 'заблокировано', zh: '已锁定', ja: 'ロック中', pt: 'travado', de: 'gesperrt', ko: '잠김' },
  stateApproved: { en: 'approved until reset', he: 'מאושר עד האיפוס', es: 'aprobado hasta el reinicio', fr: 'approuvé jusqu\'au reset', ru: 'разрешено до сброса', zh: '已批准至重置', ja: 'リセットまで承認済み', pt: 'aprovado até reiniciar', de: 'bis Reset freigegeben', ko: '초기화까지 승인됨' },
  stateOnce: { en: 'approved once', he: 'מאושר פעם אחת', es: 'aprobado una vez', fr: 'approuvé une fois', ru: 'разрешено один раз', zh: '已批准一次', ja: '一度だけ承認済み', pt: 'aprovado uma vez', de: 'einmal freigegeben', ko: '1회 승인됨' },
  bandWeekly: { en: 'weekly {percent}%', he: 'שבועי {percent}%', es: 'semanal {percent}%', fr: 'hebdo {percent}%', ru: 'неделя {percent}%', zh: '每周 {percent}%', ja: '週間 {percent}%', pt: 'semanal {percent}%', de: 'Woche {percent}%', ko: '주간 {percent}%' },
  bandFive: { en: '5h {percent}%', he: '5ש׳ {percent}%', es: '5h {percent}%', fr: '5h {percent}%', ru: '5ч {percent}%', zh: '5 小时 {percent}%', ja: '5時間 {percent}%', pt: '5h {percent}%', de: '5h {percent}%', ko: '5h {percent}%' },
  bandLine: {
    en: '🧯 budget: {windows} · {state}',
    he: '🧯 תקציב: {windows} · {state}',
    es: '🧯 presupuesto: {windows} · {state}',
    fr: '🧯 budget : {windows} · {state}',
    ru: '🧯 лимит: {windows} · {state}',
    zh: '🧯 预算：{windows} · {state}',
    ja: '🧯 予算：{windows} · {state}',
    pt: '🧯 orçamento: {windows} · {state}',
    de: '🧯 Budget: {windows} · {state}',
    ko: '🧯 예산: {windows} · {state}',
  },
  cmdDesc: {
    en: 'Shows your usage windows and the budget guard; set limits with /budget weekly|5h|ceiling <n>, approve with allow, revoke with lock',
    he: 'מציג את חלונות הצריכה ואת שומר התקציב; קובעים סף עם /budget weekly|5h|ceiling <n>, מאשרים עם allow, מבטלים עם lock',
    es: 'Muestra tus ventanas de uso y el guardián; fija límites con /budget weekly|5h|ceiling <n>, aprueba con allow, revoca con lock',
    fr: 'Affiche tes fenêtres d’utilisation et le garde-budget ; fixe les seuils avec /budget weekly|5h|ceiling <n>, approuve avec allow, révoque avec lock',
    ru: 'Показывает окна расхода и стража лимита; пороги: /budget weekly|5h|ceiling <n>, разрешить: allow, отозвать: lock',
    zh: '显示你的用量窗口和预算守卫；用 /budget weekly|5h|ceiling <n> 设置上限，用 allow 批准，用 lock 撤销',
    ja: '使用量ウィンドウと予算ガードを表示します。上限は /budget weekly|5h|ceiling <n> で設定、allow で承認、lock で取り消します',
    pt: 'Mostra suas janelas de uso e a guarda de orçamento; defina limites com /budget weekly|5h|ceiling <n>, aprove com allow, revogue com lock',
    de: 'Zeigt deine Verbrauchsfenster und den Budget-Wächter; Grenzen setzt du mit /budget weekly|5h|ceiling <n>, freigeben mit allow, widerrufen mit lock',
    ko: '사용량 구간과 예산 가드를 보여 줍니다. 한도는 /budget weekly|5h|ceiling <n>으로 설정하고, allow로 승인하고, lock으로 취소합니다',
  },
  cmdHint: {
    en: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
    he: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
    es: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
    fr: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
    ru: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
    zh: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
    ja: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
    pt: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
    de: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
    ko: '[weekly <n>|5h <n>|ceiling <n>|allow|lock]',
  },
  paneTitle: { en: 'Budget guard', he: 'שומר התקציב', es: 'Guardián del presupuesto', fr: 'Garde-budget', ru: 'Страж лимита', zh: '预算守卫', ja: '予算ガード', pt: 'Guarda de orçamento', de: 'Budget-Wächter', ko: '예산 가드' },
  sumHead: { en: 'Budget guard', he: 'שומר התקציב', es: 'Guardián del presupuesto', fr: 'Garde-budget', ru: 'Страж лимита', zh: '预算守卫', ja: '予算ガード', pt: 'Guarda de orçamento', de: 'Budget-Wächter', ko: '예산 가드' },
  nameWeeklyCap: { en: 'Weekly', he: 'שבועי', es: 'Semanal', fr: 'Hebdomadaire', ru: 'Неделя', zh: '每周', ja: '週間', pt: 'Semanal', de: 'Woche', ko: '주간' },
  nameFiveCap: { en: '5-hour', he: '5 שעות', es: '5 horas', fr: '5 heures', ru: '5 часов', zh: '5 小时', ja: '5時間', pt: '5 horas', de: '5 Stunden', ko: '5시간' },
  limitLine: { en: 'threshold {threshold}%', he: 'סף {threshold}%', es: 'umbral {threshold}%', fr: 'seuil {threshold}%', ru: 'порог {threshold}%', zh: '阈值 {threshold}%', ja: 'しきい値 {threshold}%', pt: 'limite {threshold}%', de: 'Schwelle {threshold} %', ko: '임계값 {threshold}%' },
  limitLineCeiling: {
    en: 'threshold {threshold}% · ceiling {ceiling}%',
    he: 'סף {threshold}% · תקרה {ceiling}%',
    es: 'umbral {threshold}% · techo {ceiling}%',
    fr: 'seuil {threshold}% · plafond {ceiling}%',
    ru: 'порог {threshold}% · потолок {ceiling}%',
    zh: '阈值 {threshold}% · 上限 {ceiling}%',
    ja: 'しきい値 {threshold}% · 上限 {ceiling}%',
    pt: 'limite {threshold}% · teto {ceiling}%',
    de: 'Schwelle {threshold} % · Obergrenze {ceiling} %',
    ko: '임계값 {threshold}% · 상한 {ceiling}%',
  },
  approvalLine: { en: 'Approval: {state}', he: 'אישור: {state}', es: 'Aprobación: {state}', fr: 'Approbation : {state}', ru: 'Разрешение: {state}', zh: '批准状态：{state}', ja: '承認：{state}', pt: 'Aprovação: {state}', de: 'Freigabe: {state}', ko: '승인: {state}' },
  chipBudget: { en: 'budget {percent}%', he: 'תקציב {percent}%', es: 'presupuesto {percent}%', fr: 'budget {percent}%', ru: 'лимит {percent}%', zh: '预算 {percent}%', ja: '予算 {percent}%', pt: 'orçamento {percent}%', de: 'Budget {percent} %', ko: '예산 {percent}%' },
  noWindowsHint: {
    en: 'Windows show up once you use a subscription plan; run /budget to look again.',
    he: 'החלונות יופיעו כשתשתמש בתוכנית מנוי; הרץ /budget כדי לבדוק שוב.',
    es: 'Las ventanas aparecen al usar un plan de suscripción; ejecuta /budget para revisar de nuevo.',
    fr: 'Les fenêtres apparaissent avec un forfait d’abonnement ; lance /budget pour revérifier.',
    ru: 'Окна появятся при использовании подписки; выполните /budget, чтобы проверить снова.',
    zh: '使用订阅套餐后才会显示用量窗口；运行 /budget 可再次查看。',
    ja: 'サブスクリプションプランを使うと使用量ウィンドウが表示されます。/budget でもう一度確認できます。',
    pt: 'As janelas aparecem quando você usa um plano de assinatura; execute /budget para ver de novo.',
    de: 'Fenster erscheinen, sobald du einen Abo-Plan nutzt; mit /budget schaust du erneut nach.',
    ko: '구독 플랜을 사용하면 사용량 구간이 표시됩니다. /budget으로 다시 확인하세요.',
  },
  noWindows: {
    en: 'No usage windows are reported (API-key use has none), so there is nothing to guard.',
    he: 'לא דווחו חלונות צריכה (בשימוש במפתח API אין כאלה), ולכן אין מה לשמור.',
    es: 'No se informan ventanas de uso (con clave de API no existen), así que no hay nada que proteger.',
    fr: 'Aucune fenêtre d\'utilisation n\'est signalée (l\'usage par clé d\'API n\'en a pas), il n\'y a donc rien à protéger.',
    ru: 'Окна расхода не сообщаются (при использовании ключа API их нет), охранять нечего.',
    zh: '没有报告任何用量窗口（使用 API 密钥时没有），因此无需防护。',
    ja: '使用量ウィンドウが報告されていません（API キー利用では存在しません）。ガードする対象がありません。',
    pt: 'Nenhuma janela de uso foi informada (o uso com chave de API não tem), então não há o que proteger.',
    de: 'Es werden keine Verbrauchsfenster gemeldet (bei API-Key-Nutzung gibt es keine), daher gibt es nichts zu überwachen.',
    ko: '보고된 사용량 구간이 없어(API 키 사용에는 없습니다) 보호할 대상이 없습니다.',
  },
  setWeekly: { en: 'Weekly threshold set to {n}%.', he: 'סף השבוע נקבע ל-{n}%.', es: 'Umbral semanal fijado en {n}%.', fr: 'Seuil hebdomadaire fixé à {n} %.', ru: 'Недельный порог: {n}%.', zh: '每周阈值已设为 {n}%。', ja: '週間のしきい値を {n}% に設定しました。', pt: 'Limite semanal definido para {n}%.', de: 'Wochen-Schwelle auf {n} % gesetzt.', ko: '주간 임계값을 {n}%로 설정했습니다.' },
  setFive: { en: '5-hour threshold set to {n}%.', he: 'סף ה-5 שעות נקבע ל-{n}%.', es: 'Umbral de 5 horas fijado en {n}%.', fr: 'Seuil sur 5 heures fixé à {n} %.', ru: 'Порог за 5 часов: {n}%.', zh: '5 小时阈值已设为 {n}%。', ja: '5時間のしきい値を {n}% に設定しました。', pt: 'Limite de 5 horas definido para {n}%.', de: '5-Stunden-Schwelle auf {n} % gesetzt.', ko: '5시간 임계값을 {n}%로 설정했습니다.' },
  setCeiling: { en: 'Weekly ceiling set to {n}%.', he: 'תקרת השבוע נקבעה ל-{n}%.', es: 'Techo semanal fijado en {n}%.', fr: 'Plafond hebdomadaire fixé à {n} %.', ru: 'Недельный потолок: {n}%.', zh: '每周上限已设为 {n}%。', ja: '週間の上限を {n}% に設定しました。', pt: 'Teto semanal definido para {n}%.', de: 'Wochen-Obergrenze auf {n} % gesetzt.', ko: '주간 상한을 {n}%로 설정했습니다.' },
  badNumber: {
    en: 'Give a whole number from 1 to 100, for example /budget weekly 85.',
    he: 'ציין מספר שלם בין 1 ל-100, למשל /budget weekly 85.',
    es: 'Indica un número entero de 1 a 100, por ejemplo /budget weekly 85.',
    fr: 'Indique un nombre entier de 1 à 100, par exemple /budget weekly 85.',
    ru: 'Укажите целое число от 1 до 100, например /budget weekly 85.',
    zh: '请输入 1 到 100 的整数，例如 /budget weekly 85。',
    ja: '1〜100 の整数を指定してください。例：/budget weekly 85',
    pt: 'Informe um número inteiro de 1 a 100, por exemplo /budget weekly 85.',
    de: 'Gib eine ganze Zahl von 1 bis 100 an, zum Beispiel /budget weekly 85.',
    ko: '1~100 사이의 정수를 입력하세요. 예: /budget weekly 85.',
  },
  ceilingLow: {
    en: 'The ceiling cannot be lower than the weekly threshold ({n}%).',
    he: 'התקרה לא יכולה להיות נמוכה מסף השבוע ({n}%).',
    es: 'El techo no puede ser menor que el umbral semanal ({n}%).',
    fr: 'Le plafond ne peut pas être inférieur au seuil hebdomadaire ({n} %).',
    ru: 'Потолок не может быть ниже недельного порога ({n}%).',
    zh: '上限不能低于每周阈值（{n}%）。',
    ja: '上限は週間のしきい値（{n}%）より低くできません。',
    pt: 'O teto não pode ser menor que o limite semanal ({n}%).',
    de: 'Die Obergrenze darf nicht unter der Wochen-Schwelle liegen ({n} %).',
    ko: '상한은 주간 임계값({n}%)보다 낮을 수 없습니다.',
  },
  weeklyHigh: {
    en: 'The weekly threshold cannot be above the ceiling ({n}%).',
    he: 'סף השבוע לא יכול להיות גבוה מהתקרה ({n}%).',
    es: 'El umbral semanal no puede superar el techo ({n}%).',
    fr: 'Le seuil hebdomadaire ne peut pas dépasser le plafond ({n} %).',
    ru: 'Недельный порог не может быть выше потолка ({n}%).',
    zh: '每周阈值不能高于上限（{n}%）。',
    ja: '週間のしきい値は上限（{n}%）より高くできません。',
    pt: 'O limite semanal não pode ser maior que o teto ({n}%).',
    de: 'Die Wochen-Schwelle darf nicht über der Obergrenze liegen ({n} %).',
    ko: '주간 임계값은 상한({n}%)보다 높을 수 없습니다.',
  },
  allowed: {
    en: 'Approved until the usage windows reset. Nothing will be asked or blocked until then.',
    he: 'מאושר עד שחלונות הצריכה יתאפסו. עד אז לא יישאל דבר ולא ייחסם דבר.',
    es: 'Aprobado hasta que se reinicien las ventanas de uso. Hasta entonces no se preguntará ni se bloqueará nada.',
    fr: 'Approuvé jusqu\'à la réinitialisation des fenêtres d\'utilisation. D\'ici là, rien ne sera demandé ni bloqué.',
    ru: 'Разрешено до сброса окон расхода. До тех пор ничего не спрашивается и не блокируется.',
    zh: '已批准至用量窗口重置。在此之前不会询问或拦截。',
    ja: '使用量ウィンドウがリセットされるまで承認しました。それまで確認もブロックも行いません。',
    pt: 'Aprovado até as janelas de uso reiniciarem. Nada será perguntado nem bloqueado até lá.',
    de: 'Freigegeben bis zum Zurücksetzen der Verbrauchsfenster. Bis dahin wird nichts abgefragt oder blockiert.',
    ko: '사용량 구간이 초기화될 때까지 승인했습니다. 그때까지는 묻거나 차단하지 않습니다.',
  },
  locked: {
    en: 'Approval revoked. Budget guard will ask again above the thresholds.',
    he: 'האישור בוטל. שומר התקציב ישאל שוב מעל הספים.',
    es: 'Aprobación revocada. El guardián volverá a preguntar por encima de los umbrales.',
    fr: 'Approbation révoquée. Le garde-budget redemandera au-dessus des seuils.',
    ru: 'Разрешение отозвано. Страж снова будет спрашивать выше порогов.',
    zh: '批准已撤销。超过阈值后预算守卫会再次询问。',
    ja: '承認を取り消しました。しきい値を超えると予算ガードが再び確認します。',
    pt: 'Aprovação revogada. A guarda de orçamento voltará a perguntar acima dos limites.',
    de: 'Freigabe widerrufen. Der Budget-Wächter fragt oberhalb der Schwellen wieder nach.',
    ko: '승인이 취소되었습니다. 임계값을 넘으면 예산 가드가 다시 묻습니다.',
  },
  btnAllow: { en: 'allow until reset', he: 'אשר עד האיפוס', es: 'permitir hasta el reinicio', fr: 'autoriser jusqu\'au reset', ru: 'разрешить до сброса', zh: '批准至重置', ja: 'リセットまで許可', pt: 'permitir até reiniciar', de: 'bis Reset erlauben', ko: '초기화까지 허용' },
  btnLock: { en: 'lock', he: 'נעל', es: 'bloquear', fr: 'verrouiller', ru: 'заблокировать', zh: '锁定', ja: 'ロック', pt: 'travar', de: 'sperren', ko: '잠금' },
  btnCeiling: { en: '+5% ceiling', he: '+5% תקרה', es: 'techo +5%', fr: '+5% plafond', ru: '+5% потолок', zh: '上限 +5%', ja: '上限 +5%', pt: 'teto +5%', de: 'Obergrenze +5 %', ko: '상한 +5%' },
  gaugeAlt: {
    en: 'Usage gauges: weekly {weekly}, 5-hour {five}. Approval: {state}.',
    he: 'מדי צריכה: שבועי {weekly}, 5 שעות {five}. אישור: {state}.',
    es: 'Medidores de uso: semanal {weekly}, 5 horas {five}. Aprobación: {state}.',
    fr: 'Jauges d\'utilisation : hebdomadaire {weekly}, 5 heures {five}. Approbation : {state}.',
    ru: 'Шкалы расхода: неделя {weekly}, 5 часов {five}. Разрешение: {state}.',
    zh: '用量仪表：每周 {weekly}，5 小时 {five}。批准状态：{state}。',
    ja: '使用量ゲージ：週間 {weekly}、5時間 {five}。承認：{state}。',
    pt: 'Medidores de uso: semanal {weekly}, 5 horas {five}. Aprovação: {state}.',
    de: 'Verbrauchsanzeigen: Woche {weekly}, 5 Stunden {five}. Freigabe: {state}.',
    ko: '사용량 게이지: 주간 {weekly}, 5시간 {five}. 승인: {state}.',
  },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  approvedUntil: { en: '{name} approved until {at}', he: '{name}: מאושר עד {at}', es: '{name}: aprobado hasta {at}', fr: '{name} : approuvé jusqu\'à {at}', ru: '{name}: разрешено до {at}', zh: '{name} 已批准至 {at}', ja: '{name} は {at} まで承認済み', pt: '{name} aprovado até {at}', de: '{name} freigegeben bis {at}', ko: '{name} {at}까지 승인됨' },
  noApproval: { en: 'No approval is active.', he: 'אין אישור פעיל.', es: 'No hay ninguna aprobación activa.', fr: 'Aucune approbation active.', ru: 'Активных разрешений нет.', zh: '当前没有有效的批准。', ja: '有効な承認はありません。', pt: 'Nenhuma aprovação ativa.', de: 'Keine Freigabe aktiv.', ko: '활성화된 승인이 없습니다.' },
  evHead: { en: 'Prompts held back at the threshold (newest first)', he: 'בקשות שנעצרו בסף (החדשות ראשונות)', es: 'Mensajes retenidos en el umbral (los más recientes primero)', fr: 'Messages retenus au seuil (les plus récents d\'abord)', ru: 'Сообщения, остановленные на пороге (сначала новые)', zh: '在阈值处被拦下的提示（最新在前）', ja: 'しきい値で保留されたプロンプト（新しい順）', pt: 'Prompts retidos no limite (mais recente primeiro)', de: 'Am Schwellenwert zurückgehaltene Prompts (neueste zuerst)', ko: '임계값에서 보류된 프롬프트(최신순)' },
  evNone: { en: 'No prompt was held back this session.', he: 'שום בקשה לא נעצרה בסשן הזה.', es: 'Ningún mensaje fue retenido en esta sesión.', fr: 'Aucun message n\'a été retenu dans cette session.', ru: 'В этой сессии ни одно сообщение не останавливалось.', zh: '本会话中没有被拦下的提示。', ja: 'このセッションで保留されたプロンプトはありません。', pt: 'Nenhum prompt foi retido nesta sessão.', de: 'In dieser Session wurde kein Prompt zurückgehalten.', ko: '이 세션에서 보류된 프롬프트가 없습니다.' },
  chDropped: { en: 'dropped (nobody to ask)', he: 'נזרקה (אין את מי לשאול)', es: 'descartado (nadie a quien preguntar)', fr: 'abandonné (personne à qui demander)', ru: 'отклонено (спросить некого)', zh: '已丢弃（无人可询问）', ja: '破棄（確認先なし）', pt: 'descartado (ninguém para perguntar)', de: 'verworfen (niemand zum Fragen)', ko: '폐기됨(물어볼 대상 없음)' },
} as const

type Choice = 'once' | 'untilReset' | 'cancel' | 'dropped'
type Held = { at: number; kind: Kind; percent: number; choice: Choice }
type Kind = 'weekly' | 'fiveHour'
type Settings = { weekly: number; fiveHour: number; hardCeiling: number }
type Pair<V> = { weekly: V; fiveHour: V }
type State = {
  weekly: number | null
  fiveHour: number | null
  resetsAt: Pair<string | null>
  settings: Settings
  /** Epoch ms each window's approval lasts until; 0 means none. */
  approval: Pair<number>
  /** Whether the person was already told (toast or question) that this window crossed its threshold. */
  asked: Pair<boolean>
  /** True while the turn of a prompt approved with "Once" runs, so its tool calls are not denied. */
  oncePrompt: boolean
  /** The prompts held back or asked about at a threshold: when, which window, the percent, what was chosen (newest last, max 50). */
  held: Held[]
}

const DEFAULTS: Settings = { weekly: 85, fiveHour: 95, hardCeiling: 97 }

const budget = atom({ plugin: 'toolkitty', key: 'slot', id: 'budget-guard' } as const, {
  weekly: null,
  fiveHour: null,
  resetsAt: { weekly: null, fiveHour: null },
  settings: DEFAULTS,
  approval: { weekly: 0, fiveHour: 0 },
  asked: { weekly: false, fiveHour: false },
  oncePrompt: false,
  held: [],
} as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'budget-guard',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

/** True while the guard's own question is open: it is a tool call too, and must not be paused by the ceiling it asks about. */
let isAsking = false

const SETTINGS_KEY = 'budget-guard:settings'
const APPROVAL_KEY = 'budget-guard:approval'
const SECTION_ID = 'toolkitty:budget-guard'
const PANE_ID = 'budget-guard'
const KINDS: readonly Kind[] = ['weekly', 'fiveHour']
const FALLBACK_MS: Readonly<Record<Kind, number>> = { weekly: 7 * 24 * 3600 * 1000, fiveHour: 5 * 3600 * 1000 }
/** A drop of this many points between two readings means the window reset. */
const RESET_DROP = 20

const green = '#3fb950'
const amber = '#d29922'
const red = '#f85149'

const percentOf = (s: State, k: Kind): number | null => (k === 'weekly' ? s.weekly : s.fiveHour)
const thresholdOf = (s: State, k: Kind): number => (k === 'weekly' ? s.settings.weekly : s.settings.fiveHour)
const isOver = (s: State, k: Kind): boolean => {
  const p = percentOf(s, k)
  return p !== null && p >= thresholdOf(s, k)
}
const isApproved = (s: State, k: Kind, now: number): boolean => s.approval[k] > now
const isCovered = (s: State, k: Kind, now: number): boolean => s.oncePrompt || isApproved(s, k, now)
const isAtCeiling = (s: State): boolean => s.weekly !== null && s.weekly >= s.settings.hardCeiling
const nameOf = (k: Kind): string => (k === 'weekly' ? t(T.nameWeekly) : t(T.nameFive))
const capOf = (k: Kind): string => (k === 'weekly' ? t(T.nameWeeklyCap) : t(T.nameFiveCap))

const spanText = (ms: number | null): string => {
  if (ms === null) return t(T.unknownTime)
  const total = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  if (days > 0) return t(T.spanDays, { days, hours })
  if (hours > 0) return t(T.spanHours, { hours, mins })
  return t(T.spanMins, { mins })
}

/** Milliseconds until the window resets, or null when unknown or already past. */
const untilReset = (s: State, k: Kind, now: number): number | null => {
  const iso = s.resetsAt[k]
  if (iso === null) return null
  const at = Date.parse(iso)
  return Number.isFinite(at) && at > now ? at - now : null
}

const approvalState = (s: State, now: number): string => {
  if (s.oncePrompt) return t(T.stateOnce)
  const known = KINDS.filter(k => percentOf(s, k) !== null)
  const hasApproval = known.some(k => isApproved(s, k, now))
  const isBlocked = known.some(k => isOver(s, k) && !isApproved(s, k, now))
  return hasApproval && !isBlocked ? t(T.stateApproved) : t(T.stateLocked)
}

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const levelColor = (percent: number, threshold: number): string =>
  percent >= threshold ? red : percent >= threshold - 10 ? amber : green

const termColor = (percent: number, threshold: number): 'success' | 'warning' | 'error' =>
  percent >= threshold ? 'error' : percent >= threshold - 10 ? 'warning' : 'success'

const barText = (percent: number): string => {
  const width = 20
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const limitText = (s: State, k: Kind): string =>
  k === 'weekly'
    ? t(T.limitLineCeiling, { threshold: s.settings.weekly, ceiling: s.settings.hardCeiling })
    : t(T.limitLine, { threshold: s.settings.fiveHour })

function gaugeSvg(s: State, now: number): string {
  const radius = 52
  const circ = 2 * Math.PI * radius
  const parts: string[] = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 250" width="360" height="250" font-family="system-ui, sans-serif">',
    '<rect x="2" y="2" width="356" height="246" rx="16" fill="#161b22" stroke="#30363d"/>',
  ]
  const tick = (cx: number, cy: number, percent: number, color: string): string => {
    const angle = (Math.min(100, Math.max(0, percent)) / 100) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + (radius - 10) * Math.cos(angle)
    const y1 = cy + (radius - 10) * Math.sin(angle)
    const x2 = cx + (radius + 10) * Math.cos(angle)
    const y2 = cy + (radius + 10) * Math.sin(angle)
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`
  }
  for (const [i, k] of KINDS.entries()) {
    const cx = i === 0 ? 95 : 265
    const cy = 90
    const p = percentOf(s, k)
    const threshold = thresholdOf(s, k)
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#30363d" stroke-width="11"/>`)
    if (p !== null && p > 0) {
      const len = (Math.min(100, p) / 100) * circ
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${levelColor(p, threshold)}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`,
      )
    }
    parts.push(tick(cx, cy, threshold, '#e6edf3'))
    if (k === 'weekly') parts.push(tick(cx, cy, s.settings.hardCeiling, red))
    parts.push(
      `<text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="26" font-weight="700" fill="#e6edf3">${p === null ? '—' : `${Math.round(p)}%`}</text>`,
    )
    parts.push(`<text x="${cx}" y="170" text-anchor="middle" font-size="15" font-weight="600" fill="#e6edf3">${escapeXml(capOf(k))}</text>`)
    const left = untilReset(s, k, now)
    if (left !== null) {
      parts.push(`<text x="${cx}" y="189" text-anchor="middle" font-size="12" fill="#9da7b3">${escapeXml(t(T.resetsIn, { time: spanText(left) }))}</text>`)
    }
    parts.push(`<text x="${cx}" y="207" text-anchor="middle" font-size="11" fill="#9da7b3">${escapeXml(limitText(s, k))}</text>`)
  }
  const state = approvalState(s, now)
  const stateColor = state === t(T.stateLocked) ? '#9da7b3' : green
  parts.push(`<text x="180" y="236" text-anchor="middle" font-size="13" font-weight="600" fill="${stateColor}">${escapeXml(t(T.approvalLine, { state }))}</text>`)
  parts.push('</svg>')
  return parts.join('')
}

function summaryText(s: State, now: number): string {
  const lines = [t(T.sumHead)]
  for (const k of KINDS) {
    const p = percentOf(s, k)
    const left = untilReset(s, k, now)
    const reset = left === null ? '' : ` · ${t(T.resetsIn, { time: spanText(left) })}`
    lines.push(`${capOf(k)}: ${p === null ? '—' : `${Math.round(p)}%`} (${limitText(s, k)})${reset}`)
  }
  lines.push(t(T.approvalLine, { state: approvalState(s, now) }))
  return lines.join('\n')
}

function parseSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULTS }
  if (typeof raw !== 'object' || raw === null) return out
  const obj = raw as Record<string, unknown>
  const pick = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 100 ? v : fallback
  out.weekly = pick(obj.weekly, DEFAULTS.weekly)
  out.fiveHour = pick(obj.fiveHour, DEFAULTS.fiveHour)
  out.hardCeiling = pick(obj.hardCeiling, DEFAULTS.hardCeiling)
  return out
}

function parseApproval(raw: unknown, now: number): Pair<number> {
  const out: Pair<number> = { weekly: 0, fiveHour: 0 }
  if (typeof raw !== 'object' || raw === null) return out
  const obj = raw as Record<string, unknown>
  const weekly = obj.weekly
  const fiveHour = obj.fiveHour
  if (typeof weekly === 'number' && weekly > now) out.weekly = weekly
  if (typeof fiveHour === 'number' && fiveHour > now) out.fiveHour = fiveHour
  return out
}

/**
 * Reads both windows and keeps them in the atom; clears approvals and the "asked" memory
 * of a window that reset. Returns false (and touches nothing) when no window is reported.
 */
/** Tells the signals bus where the budget stands: a signal while a window is over its threshold (alert at the hard ceiling), none below. */
async function publishBudget($: EngineInterface): Promise<void> {
  const s = await read($, budget)
  const now = await $.clock.now()
  const over = KINDS.filter(k => isOver(s, k))
  if (over.length === 0) {
    await retract($, 'budget-guard:state')
    return
  }
  let worst: Kind = over[0] ?? 'weekly'
  for (const k of over) if ((percentOf(s, k) ?? 0) > (percentOf(s, worst) ?? 0)) worst = k
  const percent = Math.round(percentOf(s, worst) ?? 0)
  const known = KINDS.filter(k => percentOf(s, k) !== null)
  const isBlocked = known.some(k => isOver(s, k) && !isApproved(s, k, now))
  const state = s.oncePrompt ? 'approved once' : known.some(k => isApproved(s, k, now)) && !isBlocked ? 'approved' : 'locked'
  await publish($, {
    id: 'budget-guard:state',
    feature: feature.id,
    kind: 'budget',
    level: isAtCeiling(s) ? 'alert' : 'warn',
    value: percent,
    text: `${worst === 'weekly' ? 'weekly' : '5h'} ${percent}% · ${state}`,
  })
}

async function refresh($: EngineInterface, announce: boolean): Promise<boolean> {
  let limits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]
  try {
    limits = (await $.session.usage()).rateLimits
  } catch {
    return false
  }
  if (limits.length === 0) return false
  const week = limits.find(l => l.kind === 'seven_day')
  const five = limits.find(l => l.kind === 'five_hour')
  if (week === undefined && five === undefined) return false

  const now = await $.clock.now()
  const prev = await read($, budget)
  const fresh: Pair<{ percent: number | null; resetsAt: string | null }> = {
    weekly: week === undefined ? { percent: prev.weekly, resetsAt: prev.resetsAt.weekly } : { percent: week.percentUsed, resetsAt: week.resetsAt ?? null },
    fiveHour: five === undefined ? { percent: prev.fiveHour, resetsAt: prev.resetsAt.fiveHour } : { percent: five.percentUsed, resetsAt: five.resetsAt ?? null },
  }

  const approval: Pair<number> = { ...prev.approval }
  const asked: Pair<boolean> = { ...prev.asked }
  const announced: Kind[] = []
  for (const k of KINDS) {
    const before = percentOf(prev, k)
    const after = fresh[k].percent
    const prevIso = prev.resetsAt[k]
    const prevReset = prevIso === null ? NaN : Date.parse(prevIso)
    const isReset =
      after !== null &&
      before !== null &&
      (after < before - RESET_DROP || (Number.isFinite(prevReset) && now >= prevReset && fresh[k].resetsAt !== prevIso))
    if (isReset || (approval[k] !== 0 && approval[k] <= now)) {
      approval[k] = 0
      asked[k] = false
    }
    const isNowOver = after !== null && after >= thresholdOf(prev, k)
    if (isNowOver && !asked[k]) {
      asked[k] = true
      if (announce && approval[k] <= now) announced.push(k)
    }
  }

  await update($, budget, c => ({
    ...c,
    weekly: fresh.weekly.percent,
    fiveHour: fresh.fiveHour.percent,
    resetsAt: { weekly: fresh.weekly.resetsAt, fiveHour: fresh.fiveHour.resetsAt },
    approval,
    asked,
  }))
  if (approval.weekly !== prev.approval.weekly || approval.fiveHour !== prev.approval.fiveHour) {
    await $.store.set(APPROVAL_KEY, approval)
  }
  await publishBudget($)

  for (const k of announced) {
    const percent = Math.round(fresh[k].percent ?? 0)
    const text = k === 'weekly' ? T.crossedWeekly : T.crossedFive
    await notice($, 'warn', t(text, { percent, threshold: thresholdOf(prev, k) }), feature.id)
  }
  return true
}

/** Approves the given windows until they reset (or a fallback span when the reset is unknown). */
async function approve($: EngineInterface, kinds: readonly Kind[]): Promise<void> {
  const s = await read($, budget)
  const now = await $.clock.now()
  const granted: Pair<number> = { ...s.approval }
  for (const k of kinds) {
    const iso = s.resetsAt[k]
    const at = iso === null ? NaN : Date.parse(iso)
    granted[k] = Number.isFinite(at) && at > now ? at : now + FALLBACK_MS[k]
  }
  await update($, budget, c => ({ ...c, approval: granted }))
  await $.store.set(APPROVAL_KEY, granted)
  await publishBudget($)
}

async function lock($: EngineInterface): Promise<void> {
  const cleared: Pair<number> = { weekly: 0, fiveHour: 0 }
  await update($, budget, c => ({ ...c, approval: cleared, oncePrompt: false }))
  await $.store.set(APPROVAL_KEY, cleared)
  await publishBudget($)
}

async function logHeld($: EngineInterface, kind: Kind, percent: number, choice: Choice): Promise<void> {
  const at = await $.clock.now()
  await update($, budget, c => ({ ...c, held: [...(c.held ?? []), { at, kind, percent, choice }].slice(-50) }))
}

async function allowAll($: EngineInterface): Promise<void> {
  await approve($, KINDS)
}

async function saveSettings($: EngineInterface, settings: Settings): Promise<void> {
  await update($, budget, c => ({ ...c, settings }))
  await $.store.set(SETTINGS_KEY, settings)
  await publishBudget($)
}

async function raiseCeiling($: EngineInterface): Promise<void> {
  const s = await read($, budget)
  await saveSettings($, { ...s.settings, hardCeiling: Math.min(100, s.settings.hardCeiling + 5) })
}

async function load($: EngineInterface): Promise<void> {
  const settings = parseSettings(await $.store.get(SETTINGS_KEY))
  const now = await $.clock.now()
  const approval = parseApproval(await $.store.get(APPROVAL_KEY), now)
  await update($, budget, c => ({ ...c, settings, approval }))
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'budget', description: t(T.cmdDesc), argumentHint: t(T.cmdHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'budget', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }
  await load($)
  await refresh($, true)
}

export async function onMeasure($: EngineInterface, e: Input<'session.measure'>): Promise<void> {
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }
  if (e.rateLimits.length === 0) return
  await refresh($, true)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }
  const s = await read($, budget)
  if (s.oncePrompt) await update($, budget, c => ({ ...c, oncePrompt: false }))
  await refresh($, true)
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'> | { drop: string }> {
  if (!(await isOn($, feature))) return e
  if (e.command !== undefined || e.origin.kind === 'plugin') return e

  // Fresh reading; no windows (API-key use) means nothing to guard.
  if (!(await refresh($, false))) return e
  const s = await read($, budget)
  const now = await $.clock.now()
  const pending = KINDS.filter(k => isOver(s, k) && !isApproved(s, k, now))
  if (pending.length === 0) return e

  // Ask about the window that is fullest.
  let worst: Kind = pending[0] ?? 'weekly'
  for (const k of pending) if ((percentOf(s, k) ?? 0) > (percentOf(s, worst) ?? 0)) worst = k
  const percent = Math.round(percentOf(s, worst) ?? 0)
  const reason = t(T.dropped, { name: nameOf(worst), percent })

  // A prompt nobody typed (a notification, a scheduled trigger) is not worth a modal.
  if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') {
    await logHeld($, worst, percent, 'dropped')
    return { drop: reason }
  }

  let question = t(worst === 'weekly' ? T.askWeekly : T.askFive, { percent, time: spanText(untilReset(s, worst, now)) })
  try {
    const usage = await $.session.usage()
    const tokens = usage.context.tokens
    if (tokens !== undefined && tokens > 0) {
      question += t(T.ctxNote, { size: tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens) })
    }
  } catch {
    // The question stands without the context size.
  }

  let answer: string
  isAsking = true
  try {
    answer = await $.ui.ask(question, { header: t(T.header), options: [t(T.once), t(T.untilReset), t(T.cancel)] })
  } catch {
    await notice($, 'alert', t(T.noSurface, { percent }), feature.id)
    await logHeld($, worst, percent, 'dropped')
    return { drop: reason }
  } finally {
    isAsking = false
  }

  if (answer === t(T.once)) {
    await logHeld($, worst, percent, 'once')
    await update($, budget, c => ({ ...c, oncePrompt: true }))
    await publishBudget($)
    return e
  }
  if (answer === t(T.untilReset)) {
    await logHeld($, worst, percent, 'untilReset')
    await approve($, KINDS.filter(k => isOver(s, k)))
    return e
  }
  await logHeld($, worst, percent, 'cancel')
  return { drop: reason }
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return undefined
  // The guard's own question is a tool call (AskUserQuestion); pausing it would make the dialog impossible at the ceiling.
  if (isAsking && e.tool === 'AskUserQuestion') return undefined
  const s = await read($, budget)
  if (!isAtCeiling(s)) return undefined
  const now = await $.clock.now()
  if (isCovered(s, 'weekly', now)) return undefined
  return { deny: t(T.modelDeny) }
}

export async function onPromptCompose(
  $: EngineInterface,
  e: Input<'prompt.compose'>,
  result: Output<'prompt.compose'>,
): Promise<Output<'prompt.compose'>> {
  if (!(await isOn($, feature))) return result
  const s = await read($, budget)
  const over = KINDS.filter(k => isOver(s, k))
  if (over.length === 0) return result

  const windows = over.map(k => (k === 'weekly' ? 'weekly' : '5-hour')).join(' and ')
  const text = t(T.modelNudge, { windows })
  return {
    ...result,
    sections: [...result.sections.filter(sec => sec.id !== SECTION_ID), { id: SECTION_ID, text, scope: 'session' as const }],
  }
}

/** What a press on the band line shows: thresholds, approvals, and the prompts held back with time and choice. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const s = await read($, budget)
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)

  const choiceText = (c: Choice): string =>
    c === 'once' ? t(T.once) : c === 'untilReset' ? t(T.untilReset) : c === 'cancel' ? t(T.cancel) : t(T.chDropped)
  const active = KINDS.filter(k => isApproved(s, k, now))
  const held = (s.held ?? []).slice(-8).reverse()
  return (
    <Box flexDirection="column">
      {KINDS.map(k => {
        const p = percentOf(s, k)
        const left = untilReset(s, k, now)
        return (
          <Text key={`lim-${k}`}>
            {`${capOf(k)}: ${p === null ? '—' : `${Math.round(p)}%`} (${limitText(s, k)})${left === null ? '' : ` · ${t(T.resetsIn, { time: spanText(left) })}`}`}
          </Text>
        )
      })}
      <Text>{t(T.approvalLine, { state: approvalState(s, now) })}</Text>
      {active.length === 0 ? <Text dimColor>{t(T.noApproval)}</Text> : null}
      {active.map(k => (
        <Text key={`apr-${k}`} dimColor>
          {t(T.approvedUntil, { name: capOf(k), at: new Date(s.approval[k]).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) })}
        </Text>
      ))}
      <Text bold>{t(T.evHead)}</Text>
      {held.length === 0 ? <Text dimColor>{t(T.evNone)}</Text> : null}
      {held.map((item, i) => (
        <Text key={`held-${i}`}>
          {`${t(T.ago, { t: clockText(now - item.at) })} · ${nameOf(item.kind)} ${item.percent}% · ${choiceText(item.choice)}`}
        </Text>
      ))}
    </Box>
  )
}

/** The short band form: the fullest window over its threshold, e.g. "budget 91%". Quiet below the thresholds. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const s = await read($, budget)
  const over = KINDS.filter(k => isOver(s, k))
  if (over.length === 0) return null

  let worst = 0
  for (const k of over) worst = Math.max(worst, percentOf(s, k) ?? 0)
  return { text: t(T.chipBudget, { percent: Math.round(worst) }), level: isAtCeiling(s) ? 'alert' : 'warn', icon: ICONS.quota }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const s = await read($, budget)
  const over = KINDS.filter(k => isOver(s, k))
  if (over.length === 0) return null

  const { Text } = $.ui.resolve(e)
  const now = await $.clock.now()
  const windows = over
    .map(k => t(k === 'weekly' ? T.bandWeekly : T.bandFive, { percent: Math.round(percentOf(s, k) ?? 0) }))
    .join(' · ')
  const color = isAtCeiling(s) ? 'error' : 'warning'
  return (
    <Text color={color} size="footnote">
      {t(T.bandLine, { windows, state: approvalState(s, now) })}
    </Text>
  )
}

export function register(on: On) {
  on('command.run', { command: 'budget' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const parts = e.args.trim().toLowerCase().split(/\s+/).filter(p => p !== '')
    const sub = parts[0] ?? ''
    const s0 = await read($, budget)

    if (sub === 'allow') {
      await refresh($, false)
      const s = await read($, budget)
      if (s.weekly === null && s.fiveHour === null) return { text: t(T.noWindows) }
      await allowAll($)
      return { text: t(T.allowed) }
    }
    if (sub === 'lock') {
      await lock($)
      return { text: t(T.locked) }
    }

    const isWeekly = sub === 'weekly' || sub === 'week' || sub === '7d'
    const isFive = sub === '5h' || sub === 'five' || sub === '5hour' || sub === 'fivehour'
    const isCeiling = sub === 'ceiling' || sub === 'ceil' || sub === 'max'
    if (isWeekly || isFive || isCeiling) {
      const n = Number((parts[1] ?? '').replace('%', ''))
      if (!Number.isInteger(n) || n < 1 || n > 100) return { text: t(T.badNumber) }
      if (isWeekly) {
        if (n > s0.settings.hardCeiling) return { text: t(T.weeklyHigh, { n: s0.settings.hardCeiling }) }
        await saveSettings($, { ...s0.settings, weekly: n })
        return { text: t(T.setWeekly, { n }) }
      }
      if (isFive) {
        await saveSettings($, { ...s0.settings, fiveHour: n })
        return { text: t(T.setFive, { n }) }
      }
      if (n < s0.settings.weekly) return { text: t(T.ceilingLow, { n: s0.settings.weekly }) }
      await saveSettings($, { ...s0.settings, hardCeiling: n })
      return { text: t(T.setCeiling, { n }) }
    }

    await refresh($, false)
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle) })
    const s = await read($, budget)
    const now = await $.clock.now()
    const summary = summaryText(s, now)
    return { text: s.weekly === null && s.fiveHour === null ? `${summary}\n${t(T.noWindows)}` : summary }
  })

  on('ui.render', { component: 'Pane', requestId: 'budget-guard' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.quota })}
          {emptyState($, e, t(T.off))}
        </Box>
      )
    }

    const s = await read($, budget)
    const now = await $.clock.now()
    if (s.weekly === null && s.fiveHour === null) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.quota })}
          {emptyState($, e, t(T.noWindows), t(T.noWindowsHint))}
        </Box>
      )
    }

    const level = isAtCeiling(s) ? 'alert' : KINDS.some(k => isOver(s, k)) ? 'warn' : 'ok'
    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: approvalState(s, now),
      level,
      icon: ICONS.quota,
      actions: [
        { key: 'budget-allow', label: t(T.btnAllow), onPress: () => void allowAll($) },
        { key: 'budget-lock', label: t(T.btnLock), onPress: () => void lock($) },
        { key: 'budget-ceiling', label: t(T.btnCeiling), onPress: () => void raiseCeiling($) },
      ],
    })

    const bar = exportBar($, e, {
      feature: feature.id,
      kind: 'budget',
      svg: e.surface === 'desktop' ? gaugeSvg(s, now) : undefined,
      text: summaryText(s, now),
    })

    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      const alt = t(T.gaugeAlt, {
        weekly: s.weekly === null ? '—' : `${Math.round(s.weekly)}%`,
        five: s.fiveHour === null ? '—' : `${Math.round(s.fiveHour)}%`,
        state: approvalState(s, now),
      })
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          <Svg source={gaugeSvg(s, now)} alt={alt} width={360} height={250} />
          {bar}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {header}
        {KINDS.map(k => {
          const p = percentOf(s, k)
          const left = untilReset(s, k, now)
          return (
            <Box key={`bar-${k}`} flexDirection="column">
              {sectionTitle($, e, capOf(k))}
              <Text color={p === null ? undefined : termColor(p, thresholdOf(s, k))}>
                {barText(p ?? 0)} {p === null ? '—' : `${Math.round(p)}%`}
              </Text>
              <Text dimColor>
                {limitText(s, k)}
                {left === null ? '' : ` · ${t(T.resetsIn, { time: spanText(left) })}`}
              </Text>
            </Box>
          )
        })}
        <Text bold>{t(T.approvalLine, { state: approvalState(s, now) })}</Text>
        {bar}
      </Box>
    )
  })
}
