import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput } from '../core'
import type { Savings } from '../shared'
import { current, ofKind } from '../signals'
import { ICONS, compact, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip, Level } from '../ui'

/*
 * Context Doctor: one transparent 0-100 health score for the conversation,
 * built only from what the other features already say on the signals bus (and
 * the `savings` store), plus four numbers that are never mixed up:
 *   1. tokens in the active conversation now (from session.usage)
 *   2. future consumption prevented (estimated)
 *   3. archived outside the conversation (estimated, output-archive's share)
 *   4. reclaimable (estimated; verified only after a real compaction)
 * Nothing here ever compacts: "Prepare optimization" only previews what a
 * compaction would keep, and "Create handoff" opens the handoff pane.
 */

// Sent to the model by /handoff (idle-handoff); previewed here, so the text is the same in every language.
const HANDOFF_EN =
  'Keep the task goal, the decisions made so far and why, the open items and next steps, and the files involved (with their paths and what was changed in each). Drop exploratory dead ends, raw tool output and anything already resolved.'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Context Doctor', he: 'רופא ההקשר', es: 'Doctor del contexto', fr: 'Docteur du contexte', ru: 'Врач контекста', zh: '上下文医生', ja: 'コンテキストドクター', pt: 'Context Doctor', de: 'Context Doctor', ko: '컨텍스트 닥터' },
  description: {
    en: 'A transparent 0-100 health score for the conversation (context fill, duplicate reads, cold cache, repeated failures) and four clearly separated token numbers. /context-doctor opens it; it never compacts anything by itself.',
    he: 'ציון בריאות שקוף 0-100 לשיחה (מילוי ההקשר, קריאות כפולות, מטמון קר, כשלים חוזרים) וארבעה מספרי טוקנים נפרדים בבירור. /context-doctor פותח אותו; הוא לעולם לא דוחס דבר מעצמו.',
    es: 'Una puntuación de salud transparente de 0 a 100 para la conversación (llenado del contexto, lecturas duplicadas, caché fría, fallos repetidos) y cuatro cifras de tokens claramente separadas. /context-doctor la abre; nunca compacta nada por sí sola.',
    fr: 'Un score de santé transparent de 0 à 100 pour la conversation (remplissage du contexte, lectures en double, cache froid, échecs répétés) et quatre chiffres de jetons clairement séparés. /context-doctor l\'ouvre ; il ne compacte jamais rien de lui-même.',
    ru: 'Прозрачная оценка здоровья разговора от 0 до 100 (заполнение контекста, повторные чтения, холодный кэш, повторяющиеся сбои) и четыре чётко разделённых числа токенов. /context-doctor открывает её; сама она ничего не сжимает.',
    zh: '为对话给出透明的 0-100 健康分（上下文占用、重复读取、冷缓存、重复失败），并给出四个清晰区分的 token 数字。/context-doctor 可打开它；它不会自行压缩任何内容。',
    ja: '会話の健全性を0〜100の透明なスコア（コンテキストの使用率、重複読み取り、キャッシュの冷え、繰り返しの失敗）で示し、明確に区別された4つのトークン数を表示します。/context-doctor で開きます。自分では何も圧縮しません。',
    pt: 'Uma pontuação de saúde transparente de 0 a 100 para a conversa (preenchimento do contexto, leituras duplicadas, cache frio, falhas repetidas) e quatro números de tokens claramente separados. /context-doctor a abre; ela nunca compacta nada sozinha.',
    de: 'Ein transparenter Gesundheitswert von 0 bis 100 für die Unterhaltung (Kontextfüllung, doppelte Lesevorgänge, kalter Cache, wiederholte Fehler) und vier klar getrennte Token-Zahlen. /context-doctor öffnet ihn; er komprimiert nie von selbst.',
    ko: '대화의 건강 점수를 0~100으로 투명하게 보여 주고(컨텍스트 사용률, 중복 읽기, 캐시 식음, 반복 실패), 명확히 구분된 네 가지 토큰 수치를 제공합니다. /context-doctor로 열며, 스스로 압축하지는 않습니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  cmdDesc: { en: 'Shows the context health score and what is behind it', he: 'מציג את ציון בריאות ההקשר ומה עומד מאחוריו', es: 'Muestra la puntuación de salud del contexto y qué hay detrás', fr: 'Affiche le score de santé du contexte et ce qui le compose', ru: 'Показывает оценку здоровья контекста и её составляющие', zh: '显示上下文健康分及其构成', ja: 'コンテキストの健全性スコアとその内訳を表示します', pt: 'Mostra a pontuação de saúde do contexto e o que há por trás dela', de: 'Zeigt den Kontext-Gesundheitswert und was dahintersteckt', ko: '컨텍스트 건강 점수와 그 근거를 보여 줍니다' },
  opened: { en: 'Opened the Context Doctor.', he: 'רופא ההקשר נפתח.', es: 'Doctor del contexto abierto.', fr: 'Docteur du contexte ouvert.', ru: 'Врач контекста открыт.', zh: '已打开上下文医生。', ja: 'コンテキストドクターを開きました。', pt: 'Context Doctor aberto.', de: 'Context Doctor geöffnet.', ko: '컨텍스트 닥터를 열었습니다.' },
  paneTitle: { en: 'Context health', he: 'בריאות ההקשר', es: 'Salud del contexto', fr: 'Santé du contexte', ru: 'Здоровье контекста', zh: '上下文健康度', ja: 'コンテキストの健全性', pt: 'Saúde do contexto', de: 'Kontext-Gesundheit', ko: '컨텍스트 건강도' },
  paneOff: { en: 'The Context Doctor is off. Turn it on in the /toolkitty pane.', he: 'רופא ההקשר כבוי. הפעל אותו בלוח /toolkitty.', es: 'El Doctor del contexto está desactivado. Actívalo en el panel /toolkitty.', fr: 'Le Docteur du contexte est désactivé. Activez-le dans le panneau /toolkitty.', ru: 'Врач контекста отключён. Включите его в панели /toolkitty.', zh: '上下文医生已关闭。请在 /toolkitty 面板中开启。', ja: 'コンテキストドクターはオフです。/toolkitty ペインでオンにしてください。', pt: 'O Context Doctor está desativado. Ative-o no painel /toolkitty.', de: 'Der Context Doctor ist aus. Schalte ihn im Panel /toolkitty ein.', ko: '컨텍스트 닥터가 꺼져 있습니다. /toolkitty 창에서 켜세요.' },
  chip: { en: 'ctx health {n}', he: 'בריאות הקשר {n}', es: 'salud ctx {n}', fr: 'santé ctx {n}', ru: 'здор. ктк {n}', zh: '上下文健康 {n}', ja: 'ctx 健全性 {n}', pt: 'saúde ctx {n}', de: 'Ktx-Gesundheit {n}', ko: '컨텍스트 건강 {n}' },

  // actions
  analyze: { en: 'Analyze', he: 'נתח', es: 'Analizar', fr: 'Analyser', ru: 'Анализ', zh: '分析', ja: '分析', pt: 'Analisar', de: 'Analysieren', ko: '분석' },
  prepare: { en: 'Prepare optimization', he: 'הכן אופטימיזציה', es: 'Preparar optimización', fr: 'Préparer l\'optimisation', ru: 'Подготовить оптимизацию', zh: '准备优化', ja: '最適化を準備', pt: 'Preparar otimização', de: 'Optimierung vorbereiten', ko: '최적화 준비' },
  handoff: { en: 'Create handoff', he: 'צור העברה', es: 'Crear traspaso', fr: 'Créer un relais', ru: 'Создать передачу', zh: '创建交接', ja: '引き継ぎを作成', pt: 'Criar transferência', de: 'Übergabe erstellen', ko: '인수인계 만들기' },
  waste: { en: 'View waste', he: 'הצג בזבוז', es: 'Ver desperdicio', fr: 'Voir le gaspillage', ru: 'Показать потери', zh: '查看浪费', ja: '無駄を見る', pt: 'Ver desperdício', de: 'Verschwendung ansehen', ko: '낭비 보기' },
  analyzed: { en: 'Context health {n}/100 recorded.', he: 'בריאות ההקשר {n}/100 נרשמה.', es: 'Salud del contexto {n}/100 registrada.', fr: 'Santé du contexte {n}/100 enregistrée.', ru: 'Здоровье контекста {n}/100 записано.', zh: '已记录上下文健康度 {n}/100。', ja: 'コンテキストの健全性 {n}/100 を記録しました。', pt: 'Saúde do contexto {n}/100 registrada.', de: 'Kontext-Gesundheit {n}/100 aufgezeichnet.', ko: '컨텍스트 건강도 {n}/100을 기록했습니다.' },

  // sections
  secNumbers: { en: 'Four different numbers', he: 'ארבעה מספרים שונים', es: 'Cuatro cifras distintas', fr: 'Quatre chiffres distincts', ru: 'Четыре разных числа', zh: '四个不同的数字', ja: '4つの異なる数値', pt: 'Quatro números diferentes', de: 'Vier verschiedene Zahlen', ko: '서로 다른 네 가지 수치' },
  secFormula: { en: 'How the score is built', he: 'איך הציון נבנה', es: 'Cómo se calcula la puntuación', fr: 'Comment le score est calculé', ru: 'Как считается оценка', zh: '分数是如何得出的', ja: 'スコアの算出方法', pt: 'Como a pontuação é calculada', de: 'Wie der Wert berechnet wird', ko: '점수 산정 방식' },
  trend: { en: 'Trend', he: 'מגמה', es: 'Tendencia', fr: 'Tendance', ru: 'Динамика', zh: '趋势', ja: '推移', pt: 'Tendência', de: 'Trend', ko: '추세' },
  snapshot: { en: 'Last analysis: score {n}, context {pct}', he: 'ניתוח אחרון: ציון {n}, הקשר {pct}', es: 'Último análisis: puntuación {n}, contexto {pct}', fr: 'Dernière analyse : score {n}, contexte {pct}', ru: 'Последний анализ: оценка {n}, контекст {pct}', zh: '上次分析：分数 {n}，上下文 {pct}', ja: '前回の分析: スコア {n}、コンテキスト {pct}', pt: 'Última análise: pontuação {n}, contexto {pct}', de: 'Letzte Analyse: Wert {n}, Kontext {pct}', ko: '마지막 분석: 점수 {n}, 컨텍스트 {pct}' },

  // the four numbers
  rowActive: { en: 'In the conversation now', he: 'בשיחה עכשיו', es: 'En la conversación ahora', fr: 'Dans la conversation maintenant', ru: 'В разговоре сейчас', zh: '当前在对话中', ja: '現在の会話内', pt: 'Na conversa agora', de: 'Aktuell in der Unterhaltung', ko: '현재 대화 안' },
  rowPrevented: { en: 'Future use prevented (estimated)', he: 'צריכה עתידית שנמנעה (הערכה)', es: 'Consumo futuro evitado (estimado)', fr: 'Consommation future évitée (estimation)', ru: 'Предотвращённый расход (оценка)', zh: '避免的未来用量（估算）', ja: '防いだ今後の使用量（推定）', pt: 'Uso futuro evitado (estimado)', de: 'Verhinderter künftiger Verbrauch (geschätzt)', ko: '방지한 향후 사용량(추정)' },
  rowArchived: { en: 'Archived outside the conversation (estimated)', he: 'בארכיון מחוץ לשיחה (הערכה)', es: 'Archivado fuera de la conversación (estimado)', fr: 'Archivé hors de la conversation (estimation)', ru: 'В архиве вне разговора (оценка)', zh: '已归档到对话之外（估算）', ja: '会話の外にアーカイブ済み（推定）', pt: 'Arquivado fora da conversa (estimado)', de: 'Außerhalb der Unterhaltung archiviert (geschätzt)', ko: '대화 밖에 보관됨(추정)' },
  rowReclaimable: { en: 'Reclaimable (estimated, verified only after a compaction)', he: 'ניתן לשחרור (הערכה, מאומת רק אחרי דחיסה)', es: 'Recuperable (estimado, se verifica solo tras una compactación)', fr: 'Récupérable (estimation, vérifié seulement après un compactage)', ru: 'Можно освободить (оценка, подтверждается только после сжатия)', zh: '可回收（估算，仅在压缩后才能验证）', ja: '回収可能（推定、圧縮後にのみ検証可能）', pt: 'Recuperável (estimado, verificado só após uma compactação)', de: 'Rückgewinnbar (geschätzt, erst nach einer Komprimierung überprüfbar)', ko: '회수 가능(추정, 압축 후에만 확인됨)' },
  valTokens: { en: '{tok} tokens', he: '{tok} טוקנים', es: '{tok} tokens', fr: '{tok} jetons', ru: '{tok} токенов', zh: '{tok} 个 token', ja: '{tok} トークン', pt: '{tok} tokens', de: '{tok} Tokens', ko: '{tok} 토큰' },
  valTokensPct: { en: '{tok} tokens ({pct})', he: '{tok} טוקנים ({pct})', es: '{tok} tokens ({pct})', fr: '{tok} jetons ({pct})', ru: '{tok} токенов ({pct})', zh: '{tok} 个 token（{pct}）', ja: '{tok} トークン（{pct}）', pt: '{tok} tokens ({pct})', de: '{tok} Tokens ({pct})', ko: '{tok} 토큰({pct})' },
  valPctOnly: { en: '{pct} of the window (token count is not exposed)', he: '{pct} מהחלון (מספר הטוקנים אינו חשוף)', es: '{pct} de la ventana (el número de tokens no está disponible)', fr: '{pct} de la fenêtre (le nombre de jetons n\'est pas exposé)', ru: '{pct} окна (число токенов недоступно)', zh: '占窗口的 {pct}（未提供 token 数）', ja: 'ウィンドウの {pct}（トークン数は公開されていません）', pt: '{pct} da janela (a contagem de tokens não é exposta)', de: '{pct} des Fensters (Token-Anzahl wird nicht bereitgestellt)', ko: '창의 {pct}(토큰 수는 제공되지 않음)' },
  valApprox: { en: '≈ {tok} tokens', he: '≈ {tok} טוקנים', es: '≈ {tok} tokens', fr: '≈ {tok} jetons', ru: '≈ {tok} токенов', zh: '≈ {tok} 个 token', ja: '≈ {tok} トークン', pt: '≈ {tok} tokens', de: '≈ {tok} Tokens', ko: '≈ {tok} 토큰' },
  valApproxPct: { en: '≈ {pct} of the window', he: '≈ {pct} מהחלון', es: '≈ {pct} de la ventana', fr: '≈ {pct} de la fenêtre', ru: '≈ {pct} окна', zh: '≈ 占窗口的 {pct}', ja: '≈ ウィンドウの {pct}', pt: '≈ {pct} da janela', de: '≈ {pct} des Fensters', ko: '≈ 창의 {pct}' },
  valUnknown: { en: 'unknown', he: 'לא ידוע', es: 'desconocido', fr: 'inconnu', ru: 'неизвестно', zh: '未知', ja: '不明', pt: 'desconhecido', de: 'unbekannt', ko: '알 수 없음' },
  note: {
    en: 'Nothing has been compacted by the Context Doctor. The active conversation shrinks only when a compaction reports it. "Reclaimable" assumes a compaction could drop about half of what is active; the real figure appears only after one runs.',
    he: 'רופא ההקשר לא דחס דבר. השיחה הפעילה מתכווצת רק כשדחיסה מדווחת על כך. "ניתן לשחרור" מניח שדחיסה יכולה להסיר כמחצית ממה שפעיל; המספר האמיתי יופיע רק אחרי שתרוץ אחת.',
    es: 'El Doctor del contexto no ha compactado nada. La conversación activa solo se reduce cuando una compactación lo informa. "Recuperable" supone que una compactación podría quitar cerca de la mitad de lo activo; la cifra real aparece solo tras ejecutarla.',
    fr: 'Le Docteur du contexte n\'a rien compacté. La conversation active ne rétrécit que lorsqu\'un compactage le signale. « Récupérable » suppose qu\'un compactage pourrait retirer environ la moitié de l\'actif ; le chiffre réel n\'apparaît qu\'après son exécution.',
    ru: 'Врач контекста ничего не сжимал. Активный разговор уменьшается, только когда сжатие это подтверждает. «Можно освободить» предполагает, что сжатие уберёт примерно половину активного; реальная цифра появится только после его запуска.',
    zh: '上下文医生没有压缩过任何内容。只有压缩操作报告后，当前对话才会缩小。“可回收”假设压缩可以丢弃当前内容的大约一半；真实数字只有在压缩运行之后才会出现。',
    ja: 'コンテキストドクターは何も圧縮していません。アクティブな会話が縮むのは、圧縮が報告したときだけです。「回収可能」は、圧縮でアクティブな内容の約半分を削れると仮定した値で、実際の数値は圧縮が実行された後にのみ表示されます。',
    pt: 'Nada foi compactado pelo Context Doctor. A conversa ativa só diminui quando uma compactação informa isso. "Recuperável" supõe que uma compactação poderia descartar cerca de metade do que está ativo; o número real só aparece depois que uma é executada.',
    de: 'Der Context Doctor hat nichts komprimiert. Die aktive Unterhaltung schrumpft nur, wenn eine Komprimierung es meldet. „Rückgewinnbar“ nimmt an, dass eine Komprimierung etwa die Hälfte des Aktiven verwerfen könnte; die echte Zahl erscheint erst nach einem Lauf.',
    ko: '컨텍스트 닥터는 아무것도 압축하지 않았습니다. 활성 대화는 압축이 보고될 때만 줄어듭니다. "회수 가능"은 압축으로 활성 내용의 약 절반을 버릴 수 있다고 가정한 값이며, 실제 수치는 압축이 실행된 뒤에만 나타납니다.',
  },

  // the formula
  fStart: { en: 'Start → 100', he: 'התחלה → 100', es: 'Inicio → 100', fr: 'Départ → 100', ru: 'Старт → 100', zh: '起始 → 100', ja: '開始 → 100', pt: 'Início → 100', de: 'Start → 100', ko: '시작 → 100' },
  fContext: { en: 'Context {pct}% → −{n}', he: 'הקשר {pct}% → −{n}', es: 'Contexto {pct}% → −{n}', fr: 'Contexte {pct}% → −{n}', ru: 'Контекст {pct}% → −{n}', zh: '上下文 {pct}% → −{n}', ja: 'コンテキスト {pct}% → −{n}', pt: 'Contexto {pct}% → −{n}', de: 'Kontext {pct} % → −{n}', ko: '컨텍스트 {pct}% → −{n}' },
  fContextNone: { en: 'Context {pct}% → 0 (penalty only above 50%)', he: 'הקשר {pct}% → 0 (קנס רק מעל 50%)', es: 'Contexto {pct}% → 0 (penalización solo por encima del 50%)', fr: 'Contexte {pct}% → 0 (pénalité seulement au-dessus de 50 %)', ru: 'Контекст {pct}% → 0 (штраф только выше 50%)', zh: '上下文 {pct}% → 0（仅在超过 50% 时扣分）', ja: 'コンテキスト {pct}% → 0（減点は50%超のみ）', pt: 'Contexto {pct}% → 0 (penalidade só acima de 50%)', de: 'Kontext {pct} % → 0 (Abzug nur über 50 %)', ko: '컨텍스트 {pct}% → 0(50% 초과일 때만 감점)' },
  fContextUnknown: { en: 'Context unknown → 0', he: 'הקשר לא ידוע → 0', es: 'Contexto desconocido → 0', fr: 'Contexte inconnu → 0', ru: 'Контекст неизвестен → 0', zh: '上下文未知 → 0', ja: 'コンテキスト不明 → 0', pt: 'Contexto desconhecido → 0', de: 'Kontext unbekannt → 0', ko: '컨텍스트 알 수 없음 → 0' },
  fDup: { en: 'Duplicate reads {n} → −{x} (5 each, at most 25)', he: 'קריאות כפולות {n} → −{x} (5 לכל אחת, עד 25)', es: 'Lecturas duplicadas {n} → −{x} (5 cada una, máximo 25)', fr: 'Lectures en double {n} → −{x} (5 chacune, 25 au plus)', ru: 'Повторные чтения {n} → −{x} (по 5, не более 25)', zh: '重复读取 {n} → −{x}（每次 5，最多 25）', ja: '重複読み取り {n} → −{x}（1回につき5、最大25）', pt: 'Leituras duplicadas {n} → −{x} (5 cada, no máximo 25)', de: 'Doppelte Lesevorgänge {n} → −{x} (je 5, höchstens 25)', ko: '중복 읽기 {n} → −{x}(건당 5, 최대 25)' },
  fCold: { en: 'Cache cold with context over 40% → −10', he: 'מטמון קר והקשר מעל 40% → −10', es: 'Caché fría con contexto superior al 40% → −10', fr: 'Cache froid avec contexte au-dessus de 40 % → −10', ru: 'Кэш холодный, контекст выше 40% → −10', zh: '缓存已冷且上下文超过 40% → −10', ja: 'キャッシュが冷えていてコンテキストが40%超 → −10', pt: 'Cache frio com contexto acima de 40% → −10', de: 'Cache kalt bei Kontext über 40 % → −10', ko: '캐시가 식었고 컨텍스트가 40% 초과 → −10' },
  fWarm: { en: 'Cache not cold, or context 40% or less → 0', he: 'המטמון לא קר, או הקשר 40% ומטה → 0', es: 'Caché no fría, o contexto del 40% o menos → 0', fr: 'Cache pas froid, ou contexte de 40 % ou moins → 0', ru: 'Кэш не холодный или контекст не выше 40% → 0', zh: '缓存未冷，或上下文不超过 40% → 0', ja: 'キャッシュが冷えていない、またはコンテキストが40%以下 → 0', pt: 'Cache não frio, ou contexto de 40% ou menos → 0', de: 'Cache nicht kalt oder Kontext höchstens 40 % → 0', ko: '캐시가 식지 않았거나 컨텍스트가 40% 이하 → 0' },
  fFail: { en: 'Repeated failures ({n}) → −15', he: 'כשלים חוזרים ({n}) → −15', es: 'Fallos repetidos ({n}) → −15', fr: 'Échecs répétés ({n}) → −15', ru: 'Повторяющиеся сбои ({n}) → −15', zh: '重复失败（{n}）→ −15', ja: '繰り返しの失敗（{n}）→ −15', pt: 'Falhas repetidas ({n}) → −15', de: 'Wiederholte Fehler ({n}) → −15', ko: '반복 실패({n}) → −15' },
  fFailNone: { en: 'Failures ({n}, repeated at 3) → 0', he: 'כשלים ({n}, חוזרים מ-3) → 0', es: 'Fallos ({n}, repetidos desde 3) → 0', fr: 'Échecs ({n}, répétés à partir de 3) → 0', ru: 'Сбои ({n}, повторяющимися считаются от 3) → 0', zh: '失败（{n}，达到 3 次算重复）→ 0', ja: '失敗（{n}、3回で繰り返しとみなす）→ 0', pt: 'Falhas ({n}, repetidas a partir de 3) → 0', de: 'Fehler ({n}, ab 3 als wiederholt) → 0', ko: '실패({n}, 3회부터 반복으로 간주) → 0' },
  fScore: { en: 'Score → {n}', he: 'ציון → {n}', es: 'Puntuación → {n}', fr: 'Score → {n}', ru: 'Оценка → {n}', zh: '分数 → {n}', ja: 'スコア → {n}', pt: 'Pontuação → {n}', de: 'Wert → {n}', ko: '점수 → {n}' },

  // the optimization preview
  secPreview: { en: 'A compaction would keep (nothing is compacted here)', he: 'דחיסה הייתה שומרת (כאן לא נדחס דבר)', es: 'Una compactación conservaría (aquí no se compacta nada)', fr: 'Un compactage conserverait (rien n\'est compacté ici)', ru: 'Сжатие сохранило бы (здесь ничего не сжимается)', zh: '压缩会保留的内容（此处没有压缩任何内容）', ja: '圧縮で残る内容（ここでは何も圧縮されていません）', pt: 'O que uma compactação manteria (nada foi compactado aqui)', de: 'Was eine Komprimierung behalten würde (hier wird nichts komprimiert)', ko: '압축 시 유지될 내용(여기서는 아무것도 압축되지 않음)' },
  pvGoal: { en: 'Goal', he: 'מטרה', es: 'Objetivo', fr: 'Objectif', ru: 'Цель', zh: '目标', ja: '目標', pt: 'Objetivo', de: 'Ziel', ko: '목표' },
  pvGoalText: { en: 'the task goal', he: 'מטרת המשימה', es: 'el objetivo de la tarea', fr: 'l\'objectif de la tâche', ru: 'цель задачи', zh: '任务目标', ja: 'タスクの目標', pt: 'o objetivo da tarefa', de: 'das Ziel der Aufgabe', ko: '작업 목표' },
  pvDecisions: { en: 'Decisions', he: 'החלטות', es: 'Decisiones', fr: 'Décisions', ru: 'Решения', zh: '决定', ja: '決定事項', pt: 'Decisões', de: 'Entscheidungen', ko: '결정 사항' },
  pvDecisionsText: { en: 'the decisions made so far, and why', he: 'ההחלטות עד כה, ומדוע', es: 'las decisiones tomadas hasta ahora y por qué', fr: 'les décisions prises jusqu\'ici, et pourquoi', ru: 'принятые решения и почему', zh: '到目前为止做出的决定及其原因', ja: 'これまでの決定とその理由', pt: 'as decisões tomadas até agora e por quê', de: 'die bisher getroffenen Entscheidungen und warum', ko: '지금까지 내린 결정과 그 이유' },
  pvOpen: { en: 'Open items', he: 'נושאים פתוחים', es: 'Pendientes', fr: 'Points ouverts', ru: 'Открытые вопросы', zh: '未完成事项', ja: '未完了の項目', pt: 'Pendências', de: 'Offene Punkte', ko: '남은 항목' },
  pvOpenText: { en: 'open items and next steps', he: 'נושאים פתוחים והצעדים הבאים', es: 'pendientes y próximos pasos', fr: 'points ouverts et prochaines étapes', ru: 'открытые вопросы и следующие шаги', zh: '未完成事项和后续步骤', ja: '未完了の項目と次のステップ', pt: 'pendências e próximos passos', de: 'offene Punkte und nächste Schritte', ko: '남은 항목과 다음 단계' },
  pvFiles: { en: 'Files', he: 'קבצים', es: 'Archivos', fr: 'Fichiers', ru: 'Файлы', zh: '文件', ja: 'ファイル', pt: 'Arquivos', de: 'Dateien', ko: '파일' },
  pvFilesText: { en: 'files involved, with their paths and what changed in each', he: 'הקבצים הרלוונטיים, עם נתיביהם ומה השתנה בכל אחד', es: 'archivos implicados, con sus rutas y qué cambió en cada uno', fr: 'fichiers concernés, avec leurs chemins et ce qui a changé dans chacun', ru: 'затронутые файлы, их пути и что изменено в каждом', zh: '涉及的文件，附带路径以及每个文件的更改', ja: '関係するファイル（パスと各ファイルの変更内容つき）', pt: 'arquivos envolvidos, com seus caminhos e o que mudou em cada um', de: 'beteiligte Dateien mit Pfaden und den jeweiligen Änderungen', ko: '관련된 파일과 경로, 각 파일에서 바뀐 내용' },
  pvDrop: { en: 'Dropped: exploratory dead ends, raw tool output, anything already resolved.', he: 'יושמט: ניסיונות שהסתיימו בלא כלום, פלט גולמי של כלים, כל מה שכבר נפתר.', es: 'Se descarta: callejones sin salida, salida bruta de herramientas, lo ya resuelto.', fr: 'Écarté : les pistes abandonnées, la sortie brute des outils, tout ce qui est déjà résolu.', ru: 'Отбрасывается: тупиковые поиски, сырой вывод инструментов, всё уже решённое.', zh: '舍弃：探索性的死胡同、原始工具输出、任何已解决的内容。', ja: '破棄するもの: 探索の行き止まり、生のツール出力、すでに解決済みのもの。', pt: 'Descartado: becos sem saída exploratórios, saída bruta de ferramentas, tudo o que já foi resolvido.', de: 'Verworfen: explorative Sackgassen, rohe Tool-Ausgaben, alles bereits Gelöste.', ko: '버리는 것: 탐색 중 막다른 길, 원시 도구 출력, 이미 해결된 모든 것.' },
  pvInstr: { en: 'Instruction a compaction would receive (English):', he: 'ההוראה שדחיסה הייתה מקבלת (באנגלית):', es: 'Instrucción que recibiría una compactación (en inglés):', fr: 'Consigne que recevrait un compactage (en anglais) :', ru: 'Инструкция, которую получило бы сжатие (на английском):', zh: '压缩会收到的指令（英文）：', ja: '圧縮が受け取る指示（英語）:', pt: 'Instrução que uma compactação receberia (em inglês):', de: 'Anweisung, die eine Komprimierung erhielte (Englisch):', ko: '압축이 받게 될 지침(영어):' },
  copy: { en: 'Copy instructions', he: 'העתק הוראות', es: 'Copiar instrucciones', fr: 'Copier la consigne', ru: 'Скопировать инструкцию', zh: '复制指令', ja: '指示をコピー', pt: 'Copiar instruções', de: 'Anweisungen kopieren', ko: '지침 복사' },
  copied: { en: 'Copied.', he: 'הועתק.', es: 'Copiado.', fr: 'Copié.', ru: 'Скопировано.', zh: '已复制。', ja: 'コピーしました。', pt: 'Copiado.', de: 'Kopiert.', ko: '복사했습니다.' },
  copyFailed: { en: 'Could not copy.', he: 'ההעתקה נכשלה.', es: 'No se pudo copiar.', fr: 'Copie impossible.', ru: 'Не удалось скопировать.', zh: '无法复制。', ja: 'コピーできませんでした。', pt: 'Não foi possível copiar.', de: 'Kopieren fehlgeschlagen.', ko: '복사할 수 없습니다.' },
} as const

type Snap = { at: number; score: number; percent: number | null; tokens: number | null }
type State = { scores: number[]; preview: boolean; snap: Snap | null }
/** The shared slot the aquarium reads later: the latest health score and when it was computed. */
type Health = { score: number; at: number }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'context-doctor' } as const, { scores: [], preview: false, snap: null } as State) as unknown as Atom<State>
const health = atom({ plugin: 'toolkitty', key: 'slot', id: 'context-health' } as const, { score: 100, at: 0 } as Health) as unknown as Atom<Health>
const savings = atom({ plugin: 'toolkitty', key: 'slot', id: 'savings' } as const, { tokens: 0, usd: 0, byFeature: {} } as Savings) as unknown as Atom<Savings>
const detailFeature = atom({ plugin: 'toolkitty', key: 'slot', id: 'detail-feature' } as const, null as string | null) as unknown as Atom<string | null>

export const feature: Feature = {
  id: 'context-doctor',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const PANE_ID = 'context-doctor'
const HANDOFF_PANE_ID = 'handoff'
const DETAIL_PANE_ID = 'toolkitty-detail'
const WASTE_FEATURE = 'dup-read-detector'
const ARCHIVE_FEATURE = 'output-archive'
const KEEP_SCORES = 50
const SPARK = '▁▂▃▅▇'

// ---------- the analysis ----------

type Analysis = {
  score: number
  percent: number | null
  tokens: number | null
  dups: number
  cold: boolean
  failures: number
  prevented: number
  archived: number | null
}

/** Reads the live usage, the signals and the savings slot, and scores them. Pure reading: never writes. */
async function analyze($: EngineInterface): Promise<Analysis> {
  await read($, health) // subscribes a drawing to every new score
  const now = await $.clock.now()
  const items = await current($, now)

  let tokens: number | null = null
  let percent: number | null = null
  try {
    const usage = await $.session.usage()
    if (usage.context.tokens !== undefined) tokens = usage.context.tokens
    if (usage.context.percent !== undefined) percent = Math.round(usage.context.percent)
  } catch {
    // no usage reading: the context signal may still know
  }
  if (percent === null) {
    const sig = ofKind(items, 'context').find(x => x.value !== undefined)
    if (sig?.value !== undefined) percent = Math.round(sig.value)
  }

  const dups = ofKind(items, 'waste').reduce((n, x) => n + Math.max(0, Math.round(x.value ?? 0)), 0)
  const cacheSig = ofKind(items, 'cache')[0]
  const cold = cacheSig !== undefined && cacheSig.value === 0
  const failures = ofKind(items, 'failure').reduce((m, x) => Math.max(m, Math.round(x.value ?? 0)), 0)

  const store = await read($, savings)
  const signalSaved = ofKind(items, 'saving').reduce((n, x) => n + Math.max(0, Math.round(x.value ?? 0)), 0)
  const prevented = signalSaved > 0 ? signalSaved : Math.max(0, Math.round(store.tokens))
  const share = store.byFeature[ARCHIVE_FEATURE]
  const archived = typeof share === 'number' ? Math.max(0, Math.round(share)) : null

  const parts = penalties(percent, dups, cold, failures)
  const score = Math.max(0, Math.min(100, Math.round(100 - parts.context - parts.dups - parts.cold - parts.failures)))
  return { score, percent, tokens, dups, cold, failures, prevented, archived }
}

function penalties(percent: number | null, dups: number, cold: boolean, failures: number): { context: number; dups: number; cold: number; failures: number } {
  return {
    context: percent !== null && percent > 50 ? percent - 50 : 0,
    dups: Math.min(25, dups * 5),
    cold: cold && percent !== null && percent > 40 ? 10 : 0,
    failures: failures >= 3 ? 15 : 0,
  }
}

const levelOf = (score: number): Level => (score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'alert')

const pctText = (percent: number | null): string => (percent === null ? t(T.valUnknown) : `${percent}%`)

/** The score's formula as readable lines, one per term. */
function formulaLines(a: Analysis): string[] {
  const p = penalties(a.percent, a.dups, a.cold, a.failures)
  const lines: string[] = [t(T.fStart)]
  if (a.percent === null) lines.push(t(T.fContextUnknown))
  else if (p.context > 0) lines.push(t(T.fContext, { pct: a.percent, n: p.context }))
  else lines.push(t(T.fContextNone, { pct: a.percent }))
  lines.push(t(T.fDup, { n: a.dups, x: p.dups }))
  lines.push(t(p.cold > 0 ? T.fCold : T.fWarm))
  lines.push(t(p.failures > 0 ? T.fFail : T.fFailNone, { n: a.failures }))
  lines.push(t(T.fScore, { n: a.score }))
  return lines
}

type NumberRow = { key: string; label: string; value: string }

/** The four numbers, each with its own label. The archived row is left out when output-archive has not reported. */
function numberRows(a: Analysis): NumberRow[] {
  const rows: NumberRow[] = []
  let active = t(T.valUnknown)
  if (a.tokens !== null) active = a.percent !== null ? t(T.valTokensPct, { tok: compact(a.tokens), pct: `${a.percent}%` }) : t(T.valTokens, { tok: compact(a.tokens) })
  else if (a.percent !== null) active = t(T.valPctOnly, { pct: `${a.percent}%` })
  rows.push({ key: 'doctor-active', label: t(T.rowActive), value: active })

  rows.push({ key: 'doctor-prevented', label: t(T.rowPrevented), value: t(T.valApprox, { tok: compact(a.prevented) }) })
  if (a.archived !== null) rows.push({ key: 'doctor-archived', label: t(T.rowArchived), value: t(T.valApprox, { tok: compact(a.archived) }) })

  let reclaim = t(T.valUnknown)
  if (a.tokens !== null) reclaim = t(T.valApprox, { tok: compact(Math.round(a.tokens / 2)) })
  else if (a.percent !== null) reclaim = t(T.valApproxPct, { pct: `${Math.round(a.percent / 2)}%` })
  rows.push({ key: 'doctor-reclaimable', label: t(T.rowReclaimable), value: reclaim })
  return rows
}

/** ▁▂▃▅▇ for the recent scores (a low score is a low bar). */
function spark(scores: number[]): string {
  return scores
    .slice(-20)
    .map(s => SPARK[Math.max(0, Math.min(SPARK.length - 1, Math.floor(s / 20)))] ?? '▁')
    .join('')
}

/** Stores a score: always for a manual analysis or a finished turn, on a measurement only when it moved. */
async function record($: EngineInterface, a: Analysis, mode: 'measure' | 'turn' | 'manual'): Promise<void> {
  const now = await $.clock.now()
  await update($, state, s => {
    const last = s.scores[s.scores.length - 1]
    if (mode === 'measure' && last === a.score) return s
    return {
      ...s,
      scores: [...s.scores, a.score].slice(-KEEP_SCORES),
      snap: mode === 'manual' ? { at: now, score: a.score, percent: a.percent, tokens: a.tokens } : s.snap,
    }
  })
  await update($, health, prev => (mode === 'measure' && prev.at !== 0 && prev.score === a.score ? prev : { score: a.score, at: now }))
}

// ---------- the actions ----------

async function runAnalyze($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  const a = await analyze($)
  await record($, a, 'manual')
  await notice($, 'info', t(T.analyzed, { n: a.score }), feature.id, { immediate: true })
}

async function togglePreview($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  await update($, state, s => ({ ...s, preview: !s.preview }))
}

async function openHandoff($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  try {
    await $.ui.open({ id: HANDOFF_PANE_ID, title: 'Toolkitty', focus: true })
  } catch {
    // the handoff pane is not there (yet) or there is no surface to draw it
  }
}

async function openWaste($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  await update($, detailFeature, () => WASTE_FEATURE)
  try {
    await $.ui.open({ id: DETAIL_PANE_ID, title: 'Toolkitty', focus: true, closeOnEscape: true })
  } catch {
    // no surface to draw it
  }
}

async function copyInstructions($: EngineInterface, surface: PaneInput['surface']): Promise<void> {
  if (!(await isOn($, feature))) return
  const done = await $.ui.copy({ text: HANDOFF_EN, surface })
  await notice($, done.isCopied ? 'info' : 'warn', t(done.isCopied ? T.copied : T.copyFailed), feature.id, { immediate: true })
}

// ---------- handlers the main module calls ----------

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'context-doctor', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'context-doctor', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onMeasure($: EngineInterface, _e: Input<'session.measure'>): Promise<void> {
  if (!(await isOn($, feature))) return
  await record($, await analyze($), 'measure')
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await record($, await analyze($), 'turn')
}

/** The short band form: "ctx health 62". Quiet while the score is 80 or more. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const a = await analyze($)
  if (a.score >= 80) return null
  return { text: t(T.chip, { n: a.score }), level: a.score < 50 ? 'alert' : 'warn', icon: ICONS.hygiene }
}

/** What a press on the chip shows: the score, how it was built and the four numbers. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null
  const a = await analyze($)
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      <Text bold>{`${t(T.paneTitle)}: ${a.score}/100`}</Text>
      {formulaLines(a).map((line, i) => (
        <Text key={`f${i}`} dimColor>
          {line}
        </Text>
      ))}
      {numberRows(a).map(r => (
        <Text key={r.key}>{`${r.label}: ${r.value}`}</Text>
      ))}
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'context-doctor' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: 'context-doctor', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'context-doctor' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.hygiene })}
          {emptyState($, e, t(T.paneOff))}
        </Box>
      )
    }

    const a = await analyze($)
    const s = await read($, state)
    const rows = numberRows(a)
    const preview: Array<[string, string, string]> = [
      ['doctor-pv-goal', t(T.pvGoal), t(T.pvGoalText)],
      ['doctor-pv-decisions', t(T.pvDecisions), t(T.pvDecisionsText)],
      ['doctor-pv-open', t(T.pvOpen), t(T.pvOpenText)],
      ['doctor-pv-files', t(T.pvFiles), t(T.pvFilesText)],
    ]

    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: `${a.score}/100`,
          level: levelOf(a.score),
          icon: ICONS.hygiene,
          actions: [
            { key: 'doctor-analyze', label: t(T.analyze), onPress: () => runAnalyze($) },
            { key: 'doctor-prepare', label: t(T.prepare), onPress: () => togglePreview($) },
            { key: 'doctor-handoff', label: t(T.handoff), onPress: () => openHandoff($) },
            { key: 'doctor-waste', label: t(T.waste), onPress: () => openWaste($) },
          ],
        })}
        {s.scores.length > 0 ? <Text dimColor>{`${t(T.trend)} ${spark(s.scores)}`}</Text> : null}
        {s.snap !== null ? (
          <Text dimColor size="footnote">
            {t(T.snapshot, { n: s.snap.score, pct: pctText(s.snap.percent) })}
          </Text>
        ) : null}
        {sectionTitle($, e, t(T.secNumbers))}
        {rows.map(r => listRow($, e, { key: r.key, text: r.label, right: r.value }))}
        <Text dimColor size="footnote">
          {t(T.note)}
        </Text>
        {sectionTitle($, e, t(T.secFormula))}
        {formulaLines(a).map((line, i) => (
          <Text key={`formula-${i}`} dimColor>
            {line}
          </Text>
        ))}
        {s.preview ? (
          <Box flexDirection="column">
            {sectionTitle($, e, t(T.secPreview))}
            {preview.map(([key, label, text]) => listRow($, e, { key, text: label, right: text }))}
            <Text dimColor>{t(T.pvDrop)}</Text>
            <Text dimColor size="footnote">
              {t(T.pvInstr)}
            </Text>
            <Text mono dimColor size="footnote">
              {HANDOFF_EN}
            </Text>
            <Button key="doctor-copy" plain label={t(T.copy)} onPress={() => copyInstructions($, e.surface)} />
          </Box>
        ) : null}
      </Box>
    )
  })
}
