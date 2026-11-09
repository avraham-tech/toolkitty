import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement } from 'claude-code'

import { isOn, notice, t } from '../core'
import { exportBar } from '../exports'
import type { BandInput, Feature, Input, Localized, PaneInput } from '../core'
import { current } from '../signals'
import { ICONS, emptyState, paneHeader } from '../ui'
import type { Chip } from '../ui'

/*
 * Safety receipts: when a guard stopped something (the incidents feature
 * publishes the `incidents:last` signal with the kind), a small receipt opens
 * in the turn-receipt style. The wording is careful on purpose: the action was
 * "potentially dangerous", never "damage prevented", and the result is "your
 * review required". The share text carries the kind only: no paths, no values.
 * Must run after incidents.onTurnComplete so the signal is already there.
 */

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Safety receipts', he: 'קבלות בטיחות', es: 'Recibos de seguridad', fr: 'Reçus de sécurité', ru: 'Квитанции безопасности', zh: '安全回执', ja: 'セーフティレシート', pt: 'Recibos de segurança', de: 'Sicherheitsbelege', ko: '안전 영수증' },
  description: {
    en: 'When a guard blocks or redacts something, a small receipt shows what kind of action it was, what was done and that your review is required. The share text names the kind only, never paths or values.',
    he: 'כשמנגנון הגנה חוסם או מסתיר משהו, מוצגת קבלה קטנה: איזה סוג פעולה זו הייתה, מה נעשה, ושנדרשת בדיקה שלך. טקסט השיתוף מציין את הסוג בלבד, בלי נתיבים או ערכים.',
    es: 'Cuando una protección bloquea u oculta algo, aparece un pequeño recibo con el tipo de acción, lo que se hizo y que se requiere tu revisión. El texto para compartir nombra solo el tipo, nunca rutas ni valores.',
    fr: 'Quand une protection bloque ou masque quelque chose, un petit reçu indique le type d’action, ce qui a été fait et que ta vérification est nécessaire. Le texte à partager ne nomme que le type, jamais de chemins ni de valeurs.',
    ru: 'Когда защита блокирует или скрывает что-то, появляется небольшая квитанция: тип действия, что сделано и что нужна ваша проверка. В тексте для отправки только тип, без путей и значений.',
    zh: '当防护拦截或隐去某些内容时，会出现一张小回执，说明这是什么类型的操作、做了什么处理，以及需要你审查。分享文本只写明类型，绝不包含路径或值。',
    ja: 'ガードが何かをブロックまたは伏せ字にすると、操作の種類、行った処置、確認が必要であることを示す小さなレシートが表示されます。共有テキストには種類のみが含まれ、パスや値は含まれません。',
    pt: 'Quando uma proteção bloqueia ou oculta algo, um pequeno recibo mostra que tipo de ação foi, o que foi feito e que sua revisão é necessária. O texto de compartilhamento cita só o tipo, nunca caminhos ou valores.',
    de: 'Wenn ein Guard etwas blockiert oder schwärzt, zeigt ein kleiner Beleg, um welche Art von Aktion es ging, was getan wurde und dass deine Prüfung nötig ist. Der Teilen-Text nennt nur die Art, nie Pfade oder Werte.',
    ko: '가드가 무언가를 차단하거나 가리면, 어떤 종류의 작업이었는지, 무엇을 했는지, 그리고 검토가 필요하다는 점을 알려 주는 작은 영수증이 나타납니다. 공유 텍스트에는 종류만 들어가며 경로나 값은 절대 포함되지 않습니다.',
  },
  cmdDesc: { en: 'Reopens the last safety receipt', he: 'פותח מחדש את קבלת הבטיחות האחרונה', es: 'Reabre el último recibo de seguridad', fr: 'Rouvre le dernier reçu de sécurité', ru: 'Снова открывает последнюю квитанцию безопасности', zh: '重新打开最近一张安全回执', ja: '直近のセーフティレシートを再度開きます', pt: 'Reabre o último recibo de segurança', de: 'Öffnet den letzten Sicherheitsbeleg erneut', ko: '마지막 안전 영수증을 다시 엽니다' },
  off: { en: 'Safety receipts are off. Turn them on in the /toolkitty pane.', he: 'קבלות הבטיחות כבויות. הפעל אותן בלוח /toolkitty.', es: 'Los recibos de seguridad están desactivados. Actívalos en el panel /toolkitty.', fr: 'Les reçus de sécurité sont désactivés. Active-les dans le panneau /toolkitty.', ru: 'Квитанции безопасности отключены. Включите их в панели /toolkitty.', zh: '安全回执已关闭。请在 /toolkitty 面板中开启。', ja: 'セーフティレシートはオフです。/toolkitty ペインでオンにしてください。', pt: 'Os recibos de segurança estão desativados. Ative-os no painel /toolkitty.', de: 'Sicherheitsbelege sind aus. Schalte sie im Panel /toolkitty ein.', ko: '안전 영수증이 꺼져 있습니다. /toolkitty 창에서 켜세요.' },
  paneOff: { en: 'Safety receipts are off.', he: 'קבלות הבטיחות כבויות.', es: 'Los recibos de seguridad están desactivados.', fr: 'Les reçus de sécurité sont désactivés.', ru: 'Квитанции безопасности отключены.', zh: '安全回执已关闭。', ja: 'セーフティレシートはオフです。', pt: 'Os recibos de segurança estão desativados.', de: 'Sicherheitsbelege sind aus.', ko: '안전 영수증이 꺼져 있습니다.' },
  opened: { en: 'Opened the last safety receipt.', he: 'קבלת הבטיחות האחרונה נפתחה.', es: 'Último recibo de seguridad abierto.', fr: 'Dernier reçu de sécurité ouvert.', ru: 'Последняя квитанция безопасности открыта.', zh: '已打开最近一张安全回执。', ja: '直近のセーフティレシートを開きました。', pt: 'Último recibo de segurança aberto.', de: 'Letzten Sicherheitsbeleg geöffnet.', ko: '마지막 안전 영수증을 열었습니다.' },
  noReceipt: { en: 'No safety receipt yet.', he: 'עדיין אין קבלת בטיחות.', es: 'Aún no hay recibo de seguridad.', fr: 'Pas encore de reçu de sécurité.', ru: 'Квитанций безопасности пока нет.', zh: '还没有安全回执。', ja: 'セーフティレシートはまだありません。', pt: 'Ainda não há recibo de segurança.', de: 'Noch kein Sicherheitsbeleg.', ko: '아직 안전 영수증이 없습니다.' },
  noReceiptHint: { en: 'One appears when a guard blocks or redacts something.', he: 'תופיע אחת כשמנגנון הגנה חוסם או מסתיר משהו.', es: 'Aparece uno cuando una protección bloquea u oculta algo.', fr: 'Un reçu apparaît quand une protection bloque ou masque quelque chose.', ru: 'Появится, когда защита что-то заблокирует или скроет.', zh: '当防护拦截或隐去某些内容时会出现一张。', ja: 'ガードが何かをブロックまたは伏せ字にすると表示されます。', pt: 'Um aparece quando uma proteção bloqueia ou oculta algo.', de: 'Einer erscheint, wenn ein Guard etwas blockiert oder schwärzt.', ko: '가드가 무언가를 차단하거나 가리면 하나가 나타납니다.' },
  paneTitle: { en: 'Safety receipt', he: 'קבלת בטיחות', es: 'Recibo de seguridad', fr: 'Reçu de sécurité', ru: 'Квитанция безопасности', zh: '安全回执', ja: 'セーフティレシート', pt: 'Recibo de segurança', de: 'Sicherheitsbeleg', ko: '안전 영수증' },
  incidentsTitle: { en: 'Disasters prevented', he: 'אסונות שנמנעו', es: 'Desastres evitados', fr: 'Désastres évités', ru: 'Предотвращённые катастрофы', zh: '已避免的灾难', ja: '防いだ事故', pt: 'Desastres evitados', de: 'Verhinderte Katastrophen', ko: '막아낸 사고' },
  header: { en: 'TOOLKITTY SAFETY RECEIPT', he: 'קבלת בטיחות של TOOLKITTY', es: 'RECIBO DE SEGURIDAD TOOLKITTY', fr: 'REÇU DE SÉCURITÉ TOOLKITTY', ru: 'КВИТАНЦИЯ БЕЗОПАСНОСТИ TOOLKITTY', zh: 'TOOLKITTY 安全回执', ja: 'TOOLKITTY セーフティレシート', pt: 'RECIBO DE SEGURANÇA DO TOOLKITTY', de: 'TOOLKITTY-SICHERHEITSBELEG', ko: 'TOOLKITTY 안전 영수증' },
  opLabel: { en: 'OPERATION', he: 'פעולה', es: 'OPERACIÓN', fr: 'OPÉRATION', ru: 'ОПЕРАЦИЯ', zh: '操作', ja: '操作', pt: 'OPERAÇÃO', de: 'VORGANG', ko: '작업' },
  riskLabel: { en: 'RISK', he: 'סיכון', es: 'RIESGO', fr: 'RISQUE', ru: 'РИСК', zh: '风险', ja: 'リスク', pt: 'RISCO', de: 'RISIKO', ko: '위험' },
  actionLabel: { en: 'ACTION', he: 'פעולת הגנה', es: 'ACCIÓN', fr: 'ACTION', ru: 'ДЕЙСТВИЕ', zh: '处理', ja: '対応', pt: 'AÇÃO', de: 'AKTION', ko: '조치' },
  resultLabel: { en: 'RESULT', he: 'תוצאה', es: 'RESULTADO', fr: 'RÉSULTAT', ru: 'ИТОГ', zh: '结果', ja: '結果', pt: 'RESULTADO', de: 'ERGEBNIS', ko: '결과' },
  timeLabel: { en: 'TIME', he: 'זמן', es: 'HORA', fr: 'HEURE', ru: 'ВРЕМЯ', zh: '时间', ja: '時刻', pt: 'HORA', de: 'ZEIT', ko: '시간' },
  risk: { en: 'potentially dangerous', he: 'עלול להיות מסוכן', es: 'potencialmente peligroso', fr: 'potentiellement dangereux', ru: 'потенциально опасно', zh: '可能有危险', ja: '危険の可能性あり', pt: 'potencialmente perigoso', de: 'potenziell gefährlich', ko: '위험 가능성 있음' },
  blocked: { en: 'blocked', he: 'נחסם', es: 'bloqueado', fr: 'bloqué', ru: 'заблокировано', zh: '已拦截', ja: 'ブロック済み', pt: 'bloqueado', de: 'blockiert', ko: '차단됨' },
  redacted: { en: 'redacted', he: 'הוסתר', es: 'ocultado', fr: 'masqué', ru: 'скрыто', zh: '已隐去', ja: '伏せ字済み', pt: 'ocultado', de: 'geschwärzt', ko: '가려짐' },
  result: { en: 'your review required', he: 'נדרשת בדיקה שלך', es: 'se requiere tu revisión', fr: 'ta vérification requise', ru: 'требуется ваша проверка', zh: '需要你审查', ja: '要確認', pt: 'requer sua revisão', de: 'deine Prüfung nötig', ko: '검토 필요' },
  details: { en: 'Details', he: 'פרטים', es: 'Detalles', fr: 'Détails', ru: 'Подробности', zh: '详情', ja: '詳細', pt: 'Detalhes', de: 'Details', ko: '자세히' },
  shareRedacted: { en: 'Share redacted', he: 'שתף גרסה מוסתרת', es: 'Compartir sin datos', fr: 'Partager masqué', ru: 'Поделиться без данных', zh: '分享（已脱敏）', ja: '共有（伏せ字済み）', pt: 'Compartilhar sem detalhes', de: 'Geschwärzt teilen', ko: '가림 처리 후 공유' },
  dismiss: { en: 'Dismiss', he: 'סגור', es: 'Descartar', fr: 'Fermer', ru: 'Закрыть', zh: '关闭', ja: '閉じる', pt: 'Dispensar', de: 'Schließen', ko: '닫기' },
  shareText: {
    en: 'Toolkitty safety receipt: a potentially dangerous action ({op}) was {action}. Review required.',
    he: 'קבלת בטיחות של Toolkitty: פעולה שעלולה להיות מסוכנת ({op}) {action}. נדרשת בדיקה.',
    es: 'Recibo de seguridad de Toolkitty: acción potencialmente peligrosa ({op}) · resultado: {action}. Se requiere revisión.',
    fr: 'Reçu de sécurité Toolkitty : une action potentiellement dangereuse ({op}) a été {action}. Vérification requise.',
    ru: 'Квитанция безопасности Toolkitty: потенциально опасное действие ({op}): {action}. Требуется проверка.',
    zh: 'Toolkitty 安全回执：一项可能有危险的操作（{op}）{action}。需要审查。',
    ja: 'Toolkitty セーフティレシート：危険の可能性がある操作（{op}）は{action}です。要確認。',
    pt: 'Recibo de segurança do Toolkitty: uma ação potencialmente perigosa ({op}) foi {action}. Revisão necessária.',
    de: 'Toolkitty-Sicherheitsbeleg: Eine potenziell gefährliche Aktion ({op}) wurde {action}. Prüfung erforderlich.',
    ko: 'Toolkitty 안전 영수증: 위험 가능성이 있는 작업({op})이 {action}. 검토가 필요합니다.',
  },
  copied: { en: 'Redacted receipt text copied', he: 'טקסט הקבלה המוסתר הועתק', es: 'Texto del recibo sin datos copiado', fr: 'Texte du reçu masqué copié', ru: 'Текст квитанции без данных скопирован', zh: '已复制脱敏后的回执文本', ja: '伏せ字済みのレシートテキストをコピーしました', pt: 'Texto do recibo ocultado copiado', de: 'Geschwärzter Belegtext kopiert', ko: '가림 처리한 영수증 텍스트를 복사했습니다' },
  copyFailed: { en: 'Could not copy', he: 'ההעתקה נכשלה', es: 'No se pudo copiar', fr: 'Copie impossible', ru: 'Не удалось скопировать', zh: '无法复制', ja: 'コピーできませんでした', pt: 'Não foi possível copiar', de: 'Kopieren nicht möglich', ko: '복사할 수 없습니다' },
  alt: {
    en: 'Safety receipt: {op}, potentially dangerous, {action}, your review required',
    he: 'קבלת בטיחות: {op}, עלול להיות מסוכן, {action}, נדרשת בדיקה שלך',
    es: 'Recibo de seguridad: {op}, riesgo potencial, resultado: {action}, se requiere tu revisión',
    fr: 'Reçu de sécurité : {op}, potentiellement dangereux, {action}, ta vérification est requise',
    ru: 'Квитанция безопасности: {op}, потенциально опасно, {action}, требуется ваша проверка',
    zh: '安全回执：{op}，可能有危险，{action}，需要你审查',
    ja: 'セーフティレシート：{op}、危険の可能性あり、{action}、要確認',
    pt: 'Recibo de segurança: {op}, potencialmente perigoso, {action}, requer sua revisão',
    de: 'Sicherheitsbeleg: {op}, potenziell gefährlich, {action}, deine Prüfung nötig',
    ko: '안전 영수증: {op}, 위험 가능성 있음, {action}, 검토 필요',
  },
  // the kinds the guards report, in words
  kSecretFile: { en: 'Read of a secrets file', he: 'קריאת קובץ סודות', es: 'Lectura de un archivo de secretos', fr: 'Lecture d’un fichier de secrets', ru: 'Чтение файла с секретами', zh: '读取密钥文件', ja: 'シークレットファイルの読み取り', pt: 'Leitura de um arquivo de segredos', de: 'Lesen einer Geheimnisdatei', ko: '비밀 파일 읽기' },
  kPastedSecret: { en: 'Secret pasted into a prompt', he: 'סוד שהודבק בפרומפט', es: 'Secreto pegado en un prompt', fr: 'Secret collé dans un prompt', ru: 'Секрет в тексте запроса', zh: '密钥被粘贴到提示词中', ja: 'プロンプトに貼り付けられたシークレット', pt: 'Segredo colado em um prompt', de: 'Geheimnis in einen Prompt eingefügt', ko: '프롬프트에 붙여넣은 비밀 값' },
  kCommitSecret: { en: 'Secret in a commit', he: 'סוד בקומיט', es: 'Secreto en un commit', fr: 'Secret dans un commit', ru: 'Секрет в коммите', zh: '提交中含有密钥', ja: 'コミット内のシークレット', pt: 'Segredo em um commit', de: 'Geheimnis in einem Commit', ko: '커밋 안의 비밀 값' },
  kDangerous: { en: 'Dangerous shell command', he: 'פקודת מעטפת מסוכנת', es: 'Comando de shell peligroso', fr: 'Commande shell dangereuse', ru: 'Опасная команда оболочки', zh: '危险的 shell 命令', ja: '危険なシェルコマンド', pt: 'Comando de shell perigoso', de: 'Gefährlicher Shell-Befehl', ko: '위험한 셸 명령' },
  kBlast: { en: 'Large recursive delete', he: 'מחיקה רקורסיבית גדולה', es: 'Borrado recursivo grande', fr: 'Grande suppression récursive', ru: 'Массовое рекурсивное удаление', zh: '大范围递归删除', ja: '大規模な再帰削除', pt: 'Exclusão recursiva grande', de: 'Großes rekursives Löschen', ko: '대규모 재귀 삭제' },
  kScope: { en: 'Edit outside the allowed scope', he: 'עריכה מחוץ לתחום המותר', es: 'Edición fuera del alcance permitido', fr: 'Modification hors du périmètre autorisé', ru: 'Правка вне разрешённой области', zh: '在允许范围之外编辑', ja: '許可スコープ外の編集', pt: 'Edição fora do escopo permitido', de: 'Bearbeitung außerhalb des erlaubten Bereichs', ko: '허용 범위 밖 편집' },
  kBranch: { en: 'Edit on a locked branch', he: 'עריכה בענף נעול', es: 'Edición en una rama bloqueada', fr: 'Modification sur une branche verrouillée', ru: 'Правка в заблокированной ветке', zh: '在锁定分支上编辑', ja: 'ロックされたブランチでの編集', pt: 'Edição em um branch bloqueado', de: 'Bearbeitung auf gesperrtem Branch', ko: '잠긴 브랜치에서 편집' },
  kCiRed: { en: 'Merge while CI is failing', he: 'מיזוג בזמן ש-CI נכשל', es: 'Fusión con CI fallando', fr: 'Fusion avec un CI en échec', ru: 'Слияние при красном CI', zh: 'CI 失败时合并', ja: 'CI が失敗中のマージ', pt: 'Merge com o CI falhando', de: 'Merge bei fehlschlagender CI', ko: 'CI 실패 중 병합' },
  kInjection: { en: 'Suspected prompt injection', he: 'חשד להזרקת פרומפט', es: 'Posible inyección de prompt', fr: 'Injection de prompt suspectée', ru: 'Подозрение на инъекцию в промпт', zh: '疑似提示词注入', ja: 'プロンプトインジェクションの疑い', pt: 'Suspeita de injeção de prompt', de: 'Verdacht auf Prompt-Injection', ko: '프롬프트 인젝션 의심' },
  kOther: { en: 'Guarded action', he: 'פעולה מוגנת', es: 'Acción protegida', fr: 'Action protégée', ru: 'Защищённое действие', zh: '受保护的操作', ja: 'ガード対象の操作', pt: 'Ação protegida', de: 'Geschützte Aktion', ko: '보호된 작업' },
} as const

type Action = 'blocked' | 'redacted'
type Receipt = { id: number; at: number; kind: string; action: Action }
type State = { seq: number; list: Receipt[]; lastKey: string }

const receipts = atom({ plugin: 'toolkitty', key: 'slot', id: 'safety-receipt' } as const, { seq: 0, list: [], lastKey: '' } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'safety-receipt',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const PANE_ID = 'safety-receipt'
const INCIDENTS_PANE_ID = 'incidents'
const SIGNAL_ID = 'incidents:last'
const KEEP = 20
const REDACTED_KINDS: readonly string[] = ['pasted-secret']
const COLS = 34
const WRAP = 30

const KIND_TEXT: Readonly<Record<string, Localized>> = {
  'secret-file': T.kSecretFile,
  'pasted-secret': T.kPastedSecret,
  'commit-secret': T.kCommitSecret,
  'dangerous-command': T.kDangerous,
  'blast-radius': T.kBlast,
  scope: T.kScope,
  'branch-lock': T.kBranch,
  'ci-red': T.kCiRed,
  injection: T.kInjection,
}

function kindText(kind: string): string {
  return t(KIND_TEXT[kind] ?? T.kOther)
}

const actionText = (a: Action): string => t(a === 'redacted' ? T.redacted : T.blocked)
const pad2 = (n: number): string => String(n).padStart(2, '0')
const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function timeLine(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Splits a value into lines of at most `width` characters at word breaks. */
function wrap(text: string, width: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line !== '' && [...line].length + 1 + [...word].length > width) {
      out.push(line)
      line = word
    } else {
      line = line === '' ? word : `${line} ${word}`
    }
  }
  if (line !== '') out.push(line)
  return out
}

/** The text a share carries: the kind and what was done, nothing else. */
function shareTextOf(r: Receipt): string {
  return t(T.shareText, { op: kindText(r.kind), action: actionText(r.action) })
}

type Row = { k: 'title' } | { k: 'center'; text: string; dim?: boolean } | { k: 'sep' } | { k: 'field'; label: string; value: string }

function rowsOf(r: Receipt): Row[] {
  return [
    { k: 'title' },
    { k: 'center', text: timeLine(r.at), dim: true },
    { k: 'sep' },
    { k: 'field', label: t(T.opLabel), value: kindText(r.kind) },
    { k: 'field', label: t(T.riskLabel), value: t(T.risk) },
    { k: 'field', label: t(T.actionLabel), value: actionText(r.action) },
    { k: 'sep' },
    { k: 'field', label: t(T.resultLabel), value: t(T.result) },
  ]
}

function receiptSvg(r: Receipt): { source: string; width: number; height: number } {
  const W = 320
  const M = 24
  const font = "'Cascadia Mono','SF Mono',Consolas,'Courier New',monospace"
  const ink = '#2b2926'
  const faint = '#8a857c'
  const accent = '#e5484d'
  let y = 34
  let body = `<g stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="${accent}" fill-opacity="0.12" transform="translate(${W / 2} ${y})"><path d="M0 -14 L13 -9 V2 C13 10 7 16 0 19 C-7 16 -13 10 -13 2 V-9 Z"/><path d="M-6 2 L-2 6 L7 -4" fill="none"/></g>`
  y += 40
  for (const row of rowsOf(r)) {
    if (row.k === 'title') {
      body += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${font}" font-size="13.5" font-weight="700" letter-spacing="1" fill="${ink}">${escapeXml(t(T.header))}</text>`
      y += 20
    } else if (row.k === 'center') {
      body += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${font}" font-size="12.5" fill="${faint}">${escapeXml(row.text)}</text>`
      y += 20
    } else if (row.k === 'sep') {
      body += `<line x1="${M}" y1="${y - 5}" x2="${W - M}" y2="${y - 5}" stroke="${faint}" stroke-width="1.5" stroke-dasharray="2 4"/>`
      y += 14
    } else {
      body += `<text x="${M}" y="${y}" font-family="${font}" font-size="11" letter-spacing="1" fill="${faint}">${escapeXml(row.label)}</text>`
      y += 17
      for (const line of wrap(row.value, WRAP)) {
        body += `<text x="${M}" y="${y}" font-family="${font}" font-size="13.5" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`
        y += 19
      }
      y += 6
    }
  }
  y += 6
  const teeth = 32
  const tw = W / teeth
  let top = 'M0 8'
  for (let i = 0; i < teeth; i++) top += `L${(i * tw + tw / 2).toFixed(1)} ${i % 2 === 0 ? 1 : 9}L${((i + 1) * tw).toFixed(1)} 8`
  let bottom = ''
  for (let i = teeth; i > 0; i--) bottom += `L${(i * tw - tw / 2).toFixed(1)} ${y + (i % 2 === 0 ? 10 : 1)}L${((i - 1) * tw).toFixed(1)} ${y + 4}`
  const paper = `${top}L${W} ${y + 4}${bottom}Z`
  const pad = 10
  const height = y + 12 + 2 * pad
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${height}" width="${W + 2 * pad}" height="${height}">` +
    `<defs><filter id="sh" x="-10%" y="-5%" width="120%" height="115%"><feDropShadow dx="0" dy="3" stdDeviation="3.2" flood-color="#000" flood-opacity=".38"/></filter></defs>` +
    `<path d="${paper}" fill="#fbf9f3" filter="url(#sh)"/>` +
    body +
    `</svg>`
  return { source, width: W + 2 * pad, height }
}

/** The receipt as plain text: what the Save button writes where no picture is drawn. */
function receiptText(r: Receipt): string {
  const lines: string[] = []
  for (const row of rowsOf(r)) {
    if (row.k === 'title') lines.push(t(T.header))
    else if (row.k === 'center') lines.push(row.text)
    else if (row.k === 'sep') lines.push('-'.repeat(COLS))
    else lines.push(`${row.label}: ${row.value}`)
  }
  return lines.join('\n')
}

function drawReceipt($: EngineInterface, e: PaneInput, r: Receipt, header: RenderElement): RenderElement {
  // Copy is the header's "Share redacted"; the bar adds Save (the picture, or the text where none is drawn).
  const bar = exportBar($, e, { kind: 'safety-receipt', svg: receiptSvg(r).source, text: receiptText(r), skip: ['copy'], feature: feature.id })
  if (e.surface === 'desktop') {
    const { Box, Svg } = $.ui.resolve(e)
    const svg = receiptSvg(r)
    return (
      <Box flexDirection="column" marginY={1}>
        {header}
        <Svg source={svg.source} alt={t(T.alt, { op: kindText(r.kind), action: actionText(r.action) })} width={svg.width} height={svg.height} />
        {bar}
      </Box>
    )
  }

  const { Box, Text } = $.ui.resolve(e)
  const rule = '-'.repeat(COLS)
  return (
    <Box flexDirection="column" marginY={1}>
      {header}
      <Box flexDirection="column" borderStyle="single" width={38} paddingX={1}>
        {rowsOf(r).map((row, i) => {
          const key = `sr-${i}`
          if (row.k === 'title') {
            return (
              <Box key={key} justifyContent="center">
                <Text bold color="error">
                  {t(T.header)}
                </Text>
              </Box>
            )
          }
          if (row.k === 'center') {
            return (
              <Box key={key} justifyContent="center">
                <Text dimColor={row.dim === true}>{row.text}</Text>
              </Box>
            )
          }
          if (row.k === 'sep') {
            return (
              <Text key={key} dimColor>
                {rule}
              </Text>
            )
          }
          return (
            <Box key={key} flexDirection="column">
              <Text dimColor>{row.label}</Text>
              <Text bold>{row.value}</Text>
            </Box>
          )
        })}
      </Box>
      {bar}
    </Box>
  )
}

// ---------- handlers ----------

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'safety-receipt', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'safety-receipt', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  const now = await $.clock.now()
  const sg = (await current($, now)).find(x => x.id === SIGNAL_ID && x.kind === 'incident')
  if (sg === undefined) return

  // the same signal can still be live at the next turn's end: one receipt per signal
  const key = `${sg.value ?? 0}:${sg.at}`
  const prev = await read($, receipts)
  if (prev.lastKey === key) return

  const kind = sg.text.slice(0, 40)
  const id = prev.seq + 1
  const receipt: Receipt = { id, at: now, kind, action: REDACTED_KINDS.includes(kind) ? 'redacted' : 'blocked' }
  await update($, receipts, s => ({ seq: id, list: [...s.list, receipt].slice(-KEEP), lastKey: key }))

  try {
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle) })
  } catch {
    // no surface attached: the receipt waits for /safety-receipt
  }
}

/** Safety receipts have no band chip: the receipt pane is the whole surface. */
export async function renderChip($: EngineInterface, _e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature))) return null
  return null
}

export function register(on: On) {
  on('command.run', { command: 'safety-receipt' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const s = await read($, receipts)
    if (s.list.length === 0) return { text: t(T.noReceipt) }
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'safety-receipt' }, async ($, e) => {
    const { Box } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.guard })}
          {emptyState($, e, t(T.paneOff))}
        </Box>
      )
    }

    const s = await read($, receipts)
    const r = s.list[s.list.length - 1]
    if (r === undefined) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.guard })}
          {emptyState($, e, t(T.noReceipt), t(T.noReceiptHint))}
        </Box>
      )
    }

    const surface = e.surface
    const share = shareTextOf(r)
    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: actionText(r.action),
      level: 'warn',
      icon: ICONS.guard,
      actions: [
        {
          key: 'safety-receipt-details',
          label: t(T.details),
          onPress: () => {
            void $.ui.open({ id: INCIDENTS_PANE_ID, title: t(T.incidentsTitle) })
          },
        },
        {
          key: 'safety-receipt-share',
          label: t(T.shareRedacted),
          onPress: () => {
            $.ui.copy({ text: share, surface }).then(
              c => notice($, c.isCopied ? 'info' : 'warn', c.isCopied ? t(T.copied) : t(T.copyFailed), feature.id, { immediate: true }),
              () => notice($, 'warn', t(T.copyFailed), feature.id, { immediate: true }),
            )
          },
        },
        {
          key: 'safety-receipt-dismiss',
          label: t(T.dismiss),
          onPress: () => {
            void $.ui.close({ id: PANE_ID })
          },
        },
      ],
    })
    return drawReceipt($, e, r, header)
  })
}
