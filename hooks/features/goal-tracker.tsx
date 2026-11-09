import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { allEvidence } from '../evidence'
import type { Evidence, EvidenceKind } from '../evidence'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle, short } from '../ui'
import type { Chip, Level } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Goal tracker', he: 'מעקב יעדים', es: 'Seguimiento de objetivos', fr: 'Suivi des objectifs', ru: 'Трекер целей', zh: '目标追踪器', ja: 'ゴールトラッカー', pt: 'Rastreador de metas', de: 'Zielverfolgung', ko: '목표 트래커' },
  description: {
    en: 'Turns the task list and your acceptance criteria into goals and marks each verified only by real evidence (a passing test, build, lint, typecheck or a diff), never by the model\'s word.',
    he: 'הופך את רשימת המשימות ואת קריטריוני הקבלה שלך ליעדים, ומסמן כל אחד כמאומת רק לפי ראיה אמיתית (בדיקה, בנייה, לינט, בדיקת טיפוסים או diff), לא לפי דברי המודל.',
    es: 'Convierte la lista de tareas y tus criterios de aceptación en objetivos y marca cada uno como verificado solo con evidencia real (una prueba, compilación, lint o comprobación de tipos superados, o un diff), nunca por la palabra del modelo.',
    fr: 'Transforme la liste de tâches et tes critères d’acceptation en objectifs et ne marque chacun comme vérifié que sur preuve réelle (test, build, lint, vérification de types ou diff), jamais sur la parole du modèle.',
    ru: 'Превращает список задач и ваши критерии приёмки в цели и отмечает каждую проверенной только по реальным доказательствам (тест, сборка, линтер, проверка типов или diff), а не по словам модели.',
    zh: '把任务列表和你的验收标准变成目标，只有在有真实证据（通过的测试、构建、lint、类型检查或 diff）时才标记为已验证，绝不凭模型的一面之词。',
    ja: 'タスクリストと受け入れ基準をゴールに変え、本物の証拠（テスト・ビルド・lint・型チェックの成功、または diff）があるときだけ検証済みにします。モデルの言葉だけでは決して検証済みにしません。',
    pt: 'Transforma a lista de tarefas e seus critérios de aceitação em metas e marca cada uma como verificada apenas com evidência real (teste, build, lint, typecheck aprovado ou um diff), nunca pela palavra do modelo.',
    de: 'Macht aus der Aufgabenliste und deinen Abnahmekriterien Ziele und markiert jedes nur bei echtem Nachweis als verifiziert (bestandener Test, Build, Lint, Typprüfung oder ein Diff), nie auf das Wort des Modells hin.',
    ko: '작업 목록과 인수 기준을 목표로 바꾸고, 실제 증거(통과한 테스트·빌드·린트·타입 검사 또는 diff)가 있을 때만 검증됨으로 표시하며, 모델의 말만으로는 절대 표시하지 않습니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  cmdGoals: { en: 'Opens the goal tracker; /goals add <text> adds a criterion, /goals na <n> <reason> marks a goal not applicable', he: 'פותח את מעקב היעדים; /goals add <טקסט> מוסיף קריטריון, /goals na <מספר> <סיבה> מסמן יעד כלא רלוונטי', es: 'Abre el seguimiento de objetivos; /goals add <texto> añade un criterio, /goals na <n> <motivo> marca un objetivo como no aplicable', fr: 'Ouvre le suivi des objectifs ; /goals add <texte> ajoute un critère, /goals na <n> <raison> marque un objectif comme sans objet', ru: 'Открывает трекер целей; /goals add <текст> добавляет критерий, /goals na <n> <причина> помечает цель неприменимой', zh: '打开目标追踪器；/goals add <text> 添加一条标准，/goals na <n> <reason> 将某个目标标记为不适用', ja: 'ゴールトラッカーを開きます。/goals add <text> で基準を追加、/goals na <n> <reason> でゴールを対象外にします', pt: 'Abre o rastreador de metas; /goals add <text> adiciona um critério, /goals na <n> <reason> marca uma meta como não aplicável', de: 'Öffnet die Zielverfolgung; /goals add <text> fügt ein Kriterium hinzu, /goals na <n> <reason> markiert ein Ziel als nicht zutreffend', ko: '목표 트래커를 엽니다. /goals add <text>는 기준을 추가하고, /goals na <n> <reason>은 목표를 해당 없음으로 표시합니다' },
  opened: { en: 'The goal tracker is open.', he: 'מעקב היעדים נפתח.', es: 'El seguimiento de objetivos está abierto.', fr: 'Le suivi des objectifs est ouvert.', ru: 'Трекер целей открыт.', zh: '目标追踪器已打开。', ja: 'ゴールトラッカーを開いています。', pt: 'O rastreador de metas está aberto.', de: 'Die Zielverfolgung ist geöffnet.', ko: '목표 트래커가 열려 있습니다.' },
  usage: { en: 'Usage: /goals add <text> or /goals na <n> <reason>', he: 'שימוש: /goals add <טקסט> או /goals na <מספר> <סיבה>', es: 'Uso: /goals add <texto> o /goals na <n> <motivo>', fr: 'Usage : /goals add <texte> ou /goals na <n> <raison>', ru: 'Использование: /goals add <текст> или /goals na <n> <причина>', zh: '用法：/goals add <text> 或 /goals na <n> <reason>', ja: '使い方：/goals add <text> または /goals na <n> <reason>', pt: 'Uso: /goals add <text> ou /goals na <n> <reason>', de: 'Verwendung: /goals add <text> oder /goals na <n> <reason>', ko: '사용법: /goals add <text> 또는 /goals na <n> <reason>' },
  added: { en: 'Goal {n} added: {text}', he: 'יעד {n} נוסף: {text}', es: 'Objetivo {n} añadido: {text}', fr: 'Objectif {n} ajouté : {text}', ru: 'Цель {n} добавлена: {text}', zh: '已添加目标 {n}：{text}', ja: 'ゴール {n} を追加しました：{text}', pt: 'Meta {n} adicionada: {text}', de: 'Ziel {n} hinzugefügt: {text}', ko: '목표 {n} 추가됨: {text}' },
  markedNa: { en: 'Goal {n} marked not applicable ({reason})', he: 'יעד {n} סומן כלא רלוונטי ({reason})', es: 'Objetivo {n} marcado como no aplicable ({reason})', fr: 'Objectif {n} marqué sans objet ({reason})', ru: 'Цель {n} помечена неприменимой ({reason})', zh: '目标 {n} 已标记为不适用（{reason}）', ja: 'ゴール {n} を対象外にしました（{reason}）', pt: 'Meta {n} marcada como não aplicável ({reason})', de: 'Ziel {n} als nicht zutreffend markiert ({reason})', ko: '목표 {n}을(를) 해당 없음으로 표시했습니다({reason})' },
  noSuchGoal: { en: 'There is no goal {n}. Open /goals to see the numbers.', he: 'אין יעד {n}. פתח /goals כדי לראות את המספרים.', es: 'No existe el objetivo {n}. Abre /goals para ver los números.', fr: 'Il n’y a pas d’objectif {n}. Ouvre /goals pour voir les numéros.', ru: 'Цели {n} нет. Откройте /goals, чтобы увидеть номера.', zh: '没有目标 {n}。打开 /goals 查看编号。', ja: 'ゴール {n} はありません。/goals を開いて番号を確認してください。', pt: 'Não existe a meta {n}. Abra /goals para ver os números.', de: 'Es gibt kein Ziel {n}. Öffne /goals, um die Nummern zu sehen.', ko: '목표 {n}이(가) 없습니다. /goals를 열어 번호를 확인하세요.' },
  needReason: { en: 'Give a reason: /goals na <n> <reason>', he: 'ציין סיבה: /goals na <מספר> <סיבה>', es: 'Indica un motivo: /goals na <n> <motivo>', fr: 'Indique une raison : /goals na <n> <raison>', ru: 'Укажите причину: /goals na <n> <причина>', zh: '请给出理由：/goals na <n> <reason>', ja: '理由を指定してください：/goals na <n> <reason>', pt: 'Informe um motivo: /goals na <n> <reason>', de: 'Gib einen Grund an: /goals na <n> <reason>', ko: '이유를 입력하세요: /goals na <n> <reason>' },
  paneTitle: { en: 'Goals', he: 'יעדים', es: 'Objetivos', fr: 'Objectifs', ru: 'Цели', zh: '目标', ja: 'ゴール', pt: 'Metas', de: 'Ziele', ko: '목표' },
  status: { en: '{v}/{m} verified', he: '{v}/{m} אומתו', es: '{v}/{m} verificados', fr: '{v}/{m} vérifiés', ru: 'проверено {v} из {m}', zh: '已验证 {v}/{m}', ja: '検証済み {v}/{m}', pt: '{v}/{m} verificadas', de: '{v}/{m} verifiziert', ko: '{v}/{m} 검증됨' },
  runMissing: { en: 'Run missing checks', he: 'הרץ בדיקות חסרות', es: 'Ejecutar comprobaciones que faltan', fr: 'Lancer les vérifications manquantes', ru: 'Запустить недостающие проверки', zh: '运行缺失的检查', ja: '不足している検査を実行', pt: 'Executar verificações ausentes', de: 'Fehlende Prüfungen ausführen', ko: '누락된 검사 실행' },
  createReport: { en: 'Create report', he: 'צור דוח', es: 'Crear informe', fr: 'Créer le rapport', ru: 'Создать отчёт', zh: '生成报告', ja: 'レポートを作成', pt: 'Criar relatório', de: 'Bericht erstellen', ko: '보고서 만들기' },
  clear: { en: 'Clear', he: 'נקה', es: 'Borrar', fr: 'Effacer', ru: 'Очистить', zh: '清除', ja: 'クリア', pt: 'Limpar', de: 'Löschen', ko: '지우기' },
  evidenceTitle: { en: 'Evidence this session', he: 'ראיות בסשן הזה', es: 'Evidencia de esta sesión', fr: 'Preuves de cette session', ru: 'Доказательства этой сессии', zh: '本会话的证据', ja: 'このセッションの証拠', pt: 'Evidências desta sessão', de: 'Nachweise dieser Session', ko: '이번 세션의 증거' },
  emptyGoals: { en: 'No goals yet.', he: 'עדיין אין יעדים.', es: 'Aún no hay objetivos.', fr: 'Aucun objectif pour le moment.', ru: 'Целей пока нет.', zh: '还没有目标。', ja: 'まだゴールがありません。', pt: 'Ainda sem metas.', de: 'Noch keine Ziele.', ko: '아직 목표가 없습니다.' },
  emptyHint: { en: 'Claude\'s task list becomes goals; add your own with /goals add <text>.', he: 'רשימת המשימות של Claude הופכת ליעדים; הוסף משלך עם /goals add <טקסט>.', es: 'La lista de tareas de Claude se convierte en objetivos; añade los tuyos con /goals add <texto>.', fr: 'La liste de tâches de Claude devient des objectifs ; ajoute les tiens avec /goals add <texte>.', ru: 'Список задач Claude становится целями; добавьте свои через /goals add <текст>.', zh: 'Claude 的任务列表会变成目标；用 /goals add <text> 添加你自己的目标。', ja: 'Claude のタスクリストがゴールになります。/goals add <text> で自分のゴールを追加できます。', pt: 'A lista de tarefas do Claude vira metas; adicione as suas com /goals add <text>.', de: 'Claudes Aufgabenliste wird zu Zielen; füge eigene mit /goals add <text> hinzu.', ko: 'Claude의 작업 목록이 목표가 됩니다. /goals add <text>로 직접 추가할 수 있습니다.' },
  emptyEvidence: { en: 'No evidence recorded yet.', he: 'עדיין לא נרשמו ראיות.', es: 'Aún no se registró evidencia.', fr: 'Aucune preuve enregistrée pour le moment.', ru: 'Доказательств пока нет.', zh: '还没有记录证据。', ja: 'まだ記録された証拠はありません。', pt: 'Nenhuma evidência registrada ainda.', de: 'Noch keine Nachweise erfasst.', ko: '아직 기록된 증거가 없습니다.' },
  evidenceHint: { en: 'Test, build, lint and typecheck runs and file diffs appear here as they happen.', he: 'הרצות של בדיקות, בנייה, לינט ובדיקת טיפוסים ו-diff של קבצים מופיעים כאן כשהם קורים.', es: 'Las ejecuciones de pruebas, compilación, lint y comprobación de tipos, y los diffs de archivos, aparecen aquí a medida que ocurren.', fr: 'Les exécutions de tests, build, lint et types et les diffs apparaissent ici au fil de l\'eau.', ru: 'Запуски тестов, сборки, линтера и проверки типов, а также diff файлов появляются здесь по мере выполнения.', zh: '测试、构建、lint 和类型检查的运行以及文件 diff 会在发生时显示在这里。', ja: 'テスト・ビルド・lint・型チェックの実行とファイルの diff が、発生した時点でここに表示されます。', pt: 'Execuções de teste, build, lint e typecheck e diffs de arquivos aparecem aqui conforme acontecem.', de: 'Läufe von Test, Build, Lint und Typprüfung sowie Datei-Diffs erscheinen hier, sobald sie auftreten.', ko: '테스트·빌드·린트·타입 검사 실행과 파일 diff가 발생하는 대로 여기에 표시됩니다.' },
  paneOff: { en: 'The feature is off in the switches panel.', he: 'השכלול כבוי בלוח המתגים.', es: 'La función está desactivada en el panel de interruptores.', fr: 'La fonctionnalité est désactivée dans le panneau des interrupteurs.', ru: 'Функция выключена на панели переключателей.', zh: '该功能已在开关面板中关闭。', ja: 'この機能はスイッチパネルでオフになっています。', pt: 'O recurso está desativado no painel de controle.', de: 'Die Funktion ist in der Schaltzentrale aus.', ko: '이 기능이 스위치 패널에서 꺼져 있습니다.' },
  chip: { en: 'goals {v}/{m} ✓', he: 'יעדים {v}/{m} ✓', es: 'objetivos {v}/{m} ✓', fr: 'objectifs {v}/{m} ✓', ru: 'цели {v}/{m} ✓', zh: '目标 {v}/{m} ✓', ja: 'ゴール {v}/{m} ✓', pt: 'metas {v}/{m} ✓', de: 'Ziele {v}/{m} ✓', ko: '목표 {v}/{m} ✓' },
  claimed: { en: 'claimed, not proven', he: 'נטען, לא הוכח', es: 'afirmado, no probado', fr: 'affirmé, non prouvé', ru: 'заявлено, не доказано', zh: '已声称，未证实', ja: '主張のみ・未証明', pt: 'declarado, não comprovado', de: 'behauptet, nicht belegt', ko: '주장만 있고 증명 안 됨' },
  noEvidence: { en: 'no evidence', he: 'אין ראיה', es: 'sin evidencia', fr: 'aucune preuve', ru: 'нет доказательств', zh: '无证据', ja: '証拠なし', pt: 'sem evidência', de: 'kein Nachweis', ko: '증거 없음' },
  naWord: { en: 'n/a', he: 'לא רלוונטי', es: 'no aplica', fr: 'sans objet', ru: 'не применимо', zh: '不适用', ja: '対象外', pt: 'n/a', de: 'k. A.', ko: '해당 없음' },
  nothingMissing: { en: 'Every goal is verified or not applicable; nothing to run.', he: 'כל יעד מאומת או לא רלוונטי; אין מה להריץ.', es: 'Todos los objetivos están verificados o no aplican; nada que ejecutar.', fr: 'Chaque objectif est vérifié ou sans objet ; rien à lancer.', ru: 'Все цели проверены или неприменимы; запускать нечего.', zh: '所有目标都已验证或不适用；无需运行。', ja: 'すべてのゴールが検証済みか対象外です。実行するものはありません。', pt: 'Todas as metas estão verificadas ou não se aplicam; nada a executar.', de: 'Jedes Ziel ist verifiziert oder nicht zutreffend; nichts auszuführen.', ko: '모든 목표가 검증되었거나 해당 없음입니다. 실행할 것이 없습니다.' },
  promptFilled: { en: 'Asked Claude to run the missing checks; press Enter to send.', he: 'ביקשתי מ-Claude להריץ את הבדיקות החסרות; לחץ Enter לשליחה.', es: 'Se pidió a Claude ejecutar las comprobaciones que faltan; pulsa Enter para enviar.', fr: 'Demande prête pour Claude : lancer les vérifications manquantes ; appuie sur Entrée pour envoyer.', ru: 'Просьба запустить недостающие проверки подготовлена; нажмите Enter, чтобы отправить.', zh: '已请 Claude 运行缺失的检查；按 Enter 发送。', ja: '不足している検査を実行するよう Claude に依頼しました。Enter で送信します。', pt: 'Pedido para executar as verificações ausentes colocado na caixa de prompt; pressione Enter para enviar.', de: 'Claude wurde gebeten, die fehlenden Prüfungen auszuführen; mit Enter senden.', ko: '누락된 검사를 실행하도록 Claude에게 요청했습니다. Enter를 눌러 전송하세요.' },
  promptRefused: { en: 'The prompt box could not take the message.', he: 'תיבת הכתיבה לא קיבלה את ההודעה.', es: 'El cuadro de texto no pudo recibir el mensaje.', fr: 'La zone de saisie n\'a pas pu recevoir le message.', ru: 'Поле ввода не приняло сообщение.', zh: '输入框无法接收该消息。', ja: '入力欄にメッセージを入れられませんでした。', pt: 'A caixa de prompt não pôde receber a mensagem.', de: 'Das Eingabefeld konnte die Nachricht nicht aufnehmen.', ko: '입력창에 메시지를 넣을 수 없습니다.' },
  reportCopied: { en: 'Goal report copied.', he: 'דוח היעדים הועתק.', es: 'Informe de objetivos copiado.', fr: 'Rapport des objectifs copié.', ru: 'Отчёт по целям скопирован.', zh: '已复制目标报告。', ja: 'ゴールレポートをコピーしました。', pt: 'Relatório de metas copiado.', de: 'Zielbericht kopiert.', ko: '목표 보고서를 복사했습니다.' },
  reportNotCopied: { en: 'Could not copy the report.', he: 'לא ניתן היה להעתיק את הדוח.', es: 'No se pudo copiar el informe.', fr: 'Impossible de copier le rapport.', ru: 'Не удалось скопировать отчёт.', zh: '无法复制报告。', ja: 'レポートをコピーできませんでした。', pt: 'Não foi possível copiar o relatório.', de: 'Der Bericht konnte nicht kopiert werden.', ko: '보고서를 복사할 수 없습니다.' },
  cleared: { en: 'Goals cleared.', he: 'היעדים נוקו.', es: 'Objetivos borrados.', fr: 'Objectifs effacés.', ru: 'Цели очищены.', zh: '目标已清除。', ja: 'ゴールをクリアしました。', pt: 'Metas limpas.', de: 'Ziele gelöscht.', ko: '목표를 지웠습니다.' },
  reportTitle: { en: 'Goal report: {v}/{m} verified', he: 'דוח יעדים: {v}/{m} אומתו', es: 'Informe de objetivos: {v}/{m} verificados', fr: 'Rapport des objectifs : {v}/{m} vérifiés', ru: 'Отчёт по целям: проверено {v} из {m}', zh: '目标报告：已验证 {v}/{m}', ja: 'ゴールレポート：{v}/{m} 検証済み', pt: 'Relatório de metas: {v}/{m} verificadas', de: 'Zielbericht: {v}/{m} verifiziert', ko: '목표 보고서: {v}/{m} 검증됨' },
  stateVerified: { en: 'verified', he: 'מאומת', es: 'verificado', fr: 'vérifié', ru: 'проверено', zh: '已验证', ja: '検証済み', pt: 'verificado', de: 'verifiziert', ko: '검증됨' },
  stateUnverified: { en: 'unverified', he: 'לא מאומת', es: 'sin verificar', fr: 'non vérifié', ru: 'не проверено', zh: '未验证', ja: '未検証', pt: 'não verificado', de: 'nicht verifiziert', ko: '미검증' },
  stateFailed: { en: 'failed', he: 'נכשל', es: 'fallido', fr: 'échec', ru: 'не пройдена', zh: '失败', ja: '失敗', pt: 'falhou', de: 'fehlgeschlagen', ko: '실패' },
  stateOpen: { en: 'open', he: 'פתוח', es: 'abierto', fr: 'ouvert', ru: 'открыта', zh: '未完成', ja: '未解決', pt: 'aberto', de: 'offen', ko: '열림' },
} as const

type Status = 'pending' | 'in_progress' | 'completed'
type Goal = {
  id: number
  text: string
  source: 'todo' | 'user'
  status: Status
  createdAt: number
  completedAt?: number
  na?: string
}
type State = { goals: Goal[]; nextId: number }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'goal-tracker' } as const, { goals: [], nextId: 1 } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'goal-tracker',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const MAX_GOALS = 60

type GoalState = 'verified' | 'unverified' | 'failed' | 'na' | 'open'
type Verdict = { state: GoalState; summary: string }

const GLYPH: Record<GoalState, string> = { verified: '✓', unverified: '?', failed: '✗', na: '–', open: '○' }
const LEVEL: Record<GoalState, Level> = { verified: 'ok', unverified: 'warn', failed: 'alert', na: 'ok', open: 'ok' }

const KIND_WORDS: readonly { kind: EvidenceKind; re: RegExp }[] = [
  { kind: 'test', re: /\b(?:tests?|testing|specs?)\b|בדיקות|בדיקה|טסט/i },
  { kind: 'build', re: /\bbuilds?\b|\bcompil(?:e|es|ing)\b|בנייה|בניה|בילד/i },
  { kind: 'lint', re: /\blint(?:s|er|ing)?\b|לינט/i },
  { kind: 'typecheck', re: /\btype-?checks?\b|\btypes\b|\btsc\b|טיפוסים/i },
]

const FILE_RE = /[\w./\\-]+\.[A-Za-z0-9]{1,6}\b/g

/** The kinds of evidence a goal's wording asks for. */
function kindsOf(text: string): EvidenceKind[] {
  return KIND_WORDS.filter(k => k.re.test(text)).map(k => k.kind)
}

const baseOf = (p: string): string => (p.split(/[\\/]/).pop() ?? p).toLowerCase()

/** The file names a goal mentions, lowercase. */
function filesOf(text: string): string[] {
  return (text.match(FILE_RE) ?? []).map(baseOf)
}

/** What the evidence says about one goal. Nothing here reads the model's words. */
function verdictOf(goal: Goal, ev: readonly Evidence[]): Verdict {
  if (goal.na !== undefined) return { state: 'na', summary: goal.na }
  const after = ev.filter(x => x.at >= goal.createdAt)
  const kinds = kindsOf(goal.text)
  if (kinds.length > 0) {
    const lasts = kinds.map(k => [...after].reverse().find(x => x.kind === k))
    const failed = lasts.find(x => x !== undefined && !x.ok)
    if (failed !== undefined) return { state: 'failed', summary: failed.summary }
    if (lasts.every(x => x !== undefined)) return { state: 'verified', summary: lasts.map(x => x?.summary ?? '').join(' · ') }
    return { state: goal.status === 'completed' ? 'unverified' : 'open', summary: '' }
  }
  const files = filesOf(goal.text)
  if (files.length > 0) {
    const hit = [...after].reverse().find(x => x.kind === 'diff' && x.ok && files.includes(baseOf(x.ref)))
    if (hit !== undefined) return { state: 'verified', summary: hit.summary }
  }
  if (goal.status === 'completed') {
    const from = goal.completedAt ?? goal.createdAt
    const claimed = [...ev].reverse().find(x => x.ok && x.at >= from)
    return { state: 'unverified', summary: claimed === undefined ? '' : claimed.summary }
  }
  return { state: 'open', summary: '' }
}

const rightOf = (v: Verdict, goal: Goal): string => {
  if (v.state === 'na') return t(T.naWord) + (v.summary !== '' ? ' · ' + v.summary : '')
  if (v.state === 'unverified') return v.summary === '' ? t(T.noEvidence) : t(T.claimed) + ' · ' + v.summary
  if (v.state === 'open') return goal.status === 'in_progress' ? '▸' : ''
  return v.summary
}

function countsOf(goals: readonly Goal[], ev: readonly Evidence[]): { v: number; m: number; failed: number; unverified: number } {
  let v = 0
  let m = 0
  let failed = 0
  let unverified = 0
  for (const g of goals) {
    const s = verdictOf(g, ev).state
    if (s === 'na') continue
    m++
    if (s === 'verified') v++
    else if (s === 'failed') failed++
    else if (s === 'unverified') unverified++
  }
  return { v, m, failed, unverified }
}

const asStatus = (value: unknown): Status => (value === 'completed' ? 'completed' : value === 'in_progress' ? 'in_progress' : 'pending')

/** Reads `{ content, status }` items from a TodoWrite input. */
function todosOf(args: Record<string, unknown>): { text: string; status: Status }[] {
  const raw = args['todos']
  if (!Array.isArray(raw)) return []
  const out: { text: string; status: Status }[] = []
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const content = r['content']
    if (typeof content === 'string' && content.trim() !== '') out.push({ text: content.trim(), status: asStatus(r['status']) })
  }
  return out
}

async function addGoal($: EngineInterface, text: string): Promise<number> {
  const now = await $.clock.now()
  const cur = await read($, state)
  const n = cur.goals.length + 1
  await update($, state, s => ({
    goals: [...s.goals, { id: s.nextId, text, source: 'user' as const, status: 'pending' as Status, createdAt: now }].slice(-MAX_GOALS),
    nextId: s.nextId + 1,
  }))
  return n
}

async function markNa($: EngineInterface, n: number, reason: string): Promise<boolean> {
  const cur = await read($, state)
  const goal = cur.goals[n - 1]
  if (goal === undefined) return false
  await update($, state, s => ({ ...s, goals: s.goals.map(g => (g.id === goal.id ? { ...g, na: reason } : g)) }))
  return true
}

/** The checks to ask for, one line per goal that is neither verified nor not applicable. */
function missingLines(goals: readonly Goal[], ev: readonly Evidence[]): string[] {
  const lines: string[] = []
  goals.forEach((g, i) => {
    const v = verdictOf(g, ev)
    if (v.state === 'verified' || v.state === 'na') return
    const kinds = kindsOf(g.text)
    const how =
      kinds.length > 0
        ? 'run the ' + kinds.map(k => (k === 'typecheck' ? 'type check' : k)).join(' and ') + ' command'
        : 'show evidence (a command result or the changed files)'
    lines.push(`${i + 1}. "${g.text}": ${how}${v.state === 'failed' ? ' again, it failed last time' : ''}`)
  })
  return lines
}

async function runMissing($: EngineInterface): Promise<void> {
  const { goals } = await read($, state)
  const ev = await allEvidence($)
  const lines = missingLines(goals, ev)
  if (lines.length === 0) {
    await notice($, 'info', t(T.nothingMissing), feature.id, { immediate: true })
    return
  }
  const text = 'Before saying these goals are done, run the specific checks that are missing and report their real results:\n' + lines.join('\n')
  const filled = await $.prompt.fill({ text, mode: 'replace' })
  if (filled.isFilled) await notice($, 'info', t(T.promptFilled), feature.id, { immediate: true })
  else await notice($, 'warn', t(T.promptRefused), feature.id, { immediate: true })
}

function reportText(goals: readonly Goal[], ev: readonly Evidence[]): string {
  const { v, m } = countsOf(goals, ev)
  const label: Record<GoalState, string> = {
    verified: t(T.stateVerified),
    unverified: t(T.stateUnverified),
    failed: t(T.stateFailed),
    na: t(T.naWord),
    open: t(T.stateOpen),
  }
  const lines = [t(T.reportTitle, { v, m })]
  goals.forEach((g, i) => {
    const verdict = verdictOf(g, ev)
    const extra = rightOf(verdict, g)
    lines.push(`${i + 1}. [${GLYPH[verdict.state]} ${label[verdict.state]}] ${g.text}${extra !== '' ? ' (' + extra + ')' : ''}`)
  })
  lines.push('', t(T.evidenceTitle))
  for (const x of ev.slice(-10).reverse()) lines.push(`- ${x.ok ? 'ok' : 'FAILED'} ${x.kind}: ${x.summary}`)
  return lines.join('\n')
}

async function copyReport($: EngineInterface, surface: string | undefined): Promise<void> {
  const { goals } = await read($, state)
  const ev = await allEvidence($)
  const res = surface === 'desktop' || surface === 'terminal' ? await $.ui.copy({ text: reportText(goals, ev), surface }) : await $.ui.copy({ text: reportText(goals, ev) })
  if (res.isCopied) await notice($, 'info', t(T.reportCopied), feature.id, { immediate: true })
  else await notice($, 'warn', t(T.reportNotCopied), feature.id, { immediate: true })
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'goals', description: t(T.cmdGoals) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'goals', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (e.tool !== 'TodoWrite' || e.agentId !== undefined) return undefined
  if (!(await isOn($, feature))) return undefined
  const items = todosOf(e as unknown as Record<string, unknown>)
  if (items.length === 0) return undefined
  const now = await $.clock.now()
  await update($, state, s => {
    const old = s.goals.filter(g => g.source === 'todo')
    const users = s.goals.filter(g => g.source === 'user')
    const used = new Set<number>()
    let nextId = s.nextId
    const todos: Goal[] = items.map(it => {
      const prev = old.find(g => g.text === it.text && !used.has(g.id))
      if (prev !== undefined) used.add(prev.id)
      const completedAt = it.status === 'completed' ? (prev !== undefined && prev.status === 'completed' ? prev.completedAt : undefined) ?? now : undefined
      const base: Goal = {
        id: prev !== undefined ? prev.id : nextId++,
        text: it.text,
        source: 'todo',
        status: it.status,
        createdAt: prev !== undefined ? prev.createdAt : now,
      }
      const withDone = completedAt !== undefined ? { ...base, completedAt } : base
      return prev !== undefined && prev.na !== undefined ? { ...withDone, na: prev.na } : withDone
    })
    return { goals: [...todos, ...users].slice(-MAX_GOALS), nextId }
  })
  return undefined
}

export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const { goals } = await read($, state)
  if (goals.length === 0) return null
  const ev = await allEvidence($)
  const { v, m, failed, unverified } = countsOf(goals, ev)
  if (m === 0) return null
  const level: Level = failed > 0 ? 'warn' : unverified > 0 ? 'info' : 'ok'
  return { text: t(T.chip, { v, m }), level, icon: ICONS.visibility }
}

export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null
  const { goals } = await read($, state)
  const ev = await allEvidence($)
  const { Box } = $.ui.resolve(e)
  if (goals.length === 0) return emptyState($, e, t(T.emptyGoals), t(T.emptyHint))
  return (
    <Box flexDirection="column">
      {goals.map((g, i) => {
        const v = verdictOf(g, ev)
        return listRow($, e, { key: `goal-${g.id}`, left: String(i + 1), text: `${GLYPH[v.state]} ${g.text}`, right: rightOf(v, g), level: LEVEL[v.state] })
      })}
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'goals' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const args = e.args.trim()
    if (args === '') {
      await $.ui.open({ id: 'goal-tracker', title: t(T.paneTitle) })
      return { text: t(T.opened) }
    }
    const add = /^add\s+([\s\S]+)$/i.exec(args)
    if (add !== null) {
      const text = (add[1] ?? '').trim()
      const n = await addGoal($, text)
      return { text: t(T.added, { n, text }) }
    }
    const na = /^na\s+(\d+)(?:\s+([\s\S]+))?$/i.exec(args)
    if (na !== null) {
      const n = Number(na[1])
      const reason = (na[2] ?? '').trim()
      if (reason === '') return { text: t(T.needReason) }
      const done = await markNa($, n, reason)
      return { text: done ? t(T.markedNa, { n, reason }) : t(T.noSuchGoal, { n }) }
    }
    return { text: t(T.usage) }
  })

  on('ui.render', { component: 'Pane', requestId: 'goal-tracker' }, async ($, e) => {
    const { Box } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.visibility })}
          {emptyState($, e, t(T.paneOff))}
        </Box>
      )
    }
    const { goals } = await read($, state)
    const ev = await allEvidence($)
    const now = await $.clock.now()
    const { v, m, failed, unverified } = countsOf(goals, ev)
    const level: Level = failed > 0 ? 'warn' : unverified > 0 ? 'info' : 'ok'
    const recent = ev.slice(-10).reverse()
    const clear = async () => {
      await update($, state, () => ({ goals: [], nextId: 1 }))
      await notice($, 'info', t(T.cleared), feature.id, { immediate: true })
    }
    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: t(T.status, { v, m }),
          level,
          icon: ICONS.visibility,
          actions: [
            { key: 'goal-run-missing', label: t(T.runMissing), onPress: () => runMissing($) },
            { key: 'goal-report', label: t(T.createReport), onPress: () => copyReport($, e.surface) },
            { key: 'goal-clear', label: t(T.clear), onPress: clear },
          ],
        })}
        {goals.length === 0 ? (
          emptyState($, e, t(T.emptyGoals), t(T.emptyHint))
        ) : (
          goals.map((g, i) => {
            const verdict = verdictOf(g, ev)
            return listRow($, e, { key: `goal-${g.id}`, left: String(i + 1), text: `${GLYPH[verdict.state]} ${g.text}`, right: rightOf(verdict, g), level: LEVEL[verdict.state] })
          })
        )}
        {sectionTitle($, e, t(T.evidenceTitle))}
        {recent.length === 0
          ? emptyState($, e, t(T.emptyEvidence), t(T.evidenceHint))
          : recent.map((x, i) => listRow($, e, { key: `ev-${i}`, left: short(Math.max(0, now - x.at)), text: `${x.ok ? '✓' : '✗'} ${x.kind} · ${x.summary}`, level: x.ok ? 'ok' : 'warn' }))}
      </Box>
    )
  })
}
