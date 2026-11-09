import { atom, read } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput } from '../core'
import type { Savings } from '../shared'
import { publish, retract, retractAll } from '../signals'
import { ICONS, compact, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: { en: 'Savings meter', he: 'מד חיסכון', es: 'Medidor de ahorro', fr: "Compteur d'économies", ru: 'Счётчик экономии', zh: '节省计量', ja: '節約メーター', pt: 'Medidor de economia', de: 'Spar-Zähler', ko: '절약 미터' },
  description: {
    en: 'Adds up the context Toolkitty kept out of the conversation (trimmed and archived output), as an estimate in tokens and dollars. /savings shows the totals.',
    he: 'מסכם את ההקשר שה-toolkitty הרחיק מהשיחה (פלט שקוצר או הועבר לארכיון), כהערכה בטוקנים ובדולרים. /savings מציג את הסיכומים.',
    es: 'Suma el contexto que el toolkitty mantuvo fuera de la conversación (salida recortada y archivada), como estimación en tokens y dólares. /savings muestra los totales.',
    fr: "Additionne le contexte que le toolkitty a gardé hors de la conversation (sortie réduite et archivée), en estimation de jetons et de dollars. /savings affiche les totaux.",
    ru: 'Суммирует контекст, который toolkitty не пустил в разговор (сокращённый и архивированный вывод), в виде оценки в токенах и долларах. /savings показывает итоги.',
    zh: '汇总 Toolkitty 让多少内容没有进入对话上下文（被精简和归档的输出），以 token 和美元估算。/savings 显示总计。',
    ja: 'Toolkitty が会話のコンテキストに入れずに済ませた量（トリミング・アーカイブした出力）を、トークンとドルの概算で合計します。/savings で合計を表示。',
    pt: 'Soma o contexto que o toolkitty manteve fora da conversa (saídas cortadas e arquivadas), como estimativa em tokens e dólares. /savings mostra os totais.',
    de: 'Summiert den Kontext, den das Toolkitty aus der Unterhaltung herausgehalten hat (gekürzte und archivierte Ausgaben), als Schätzung in Tokens und Dollar. /savings zeigt die Summen.',
    ko: 'Toolkitty이 대화에서 덜어 낸 컨텍스트(줄이거나 보관한 출력)를 토큰과 달러 추정치로 합산합니다. /savings로 합계를 봅니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty パネルでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; im /toolkitty-Panel einschalten', ko: '기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요' },
  commandDesc: { en: 'Shows the estimated tokens and dollars Toolkitty saved', he: 'מציג את הערכת הטוקנים והדולרים שה-toolkitty חסך', es: 'Muestra los tokens y dólares estimados que ahorró el toolkitty', fr: 'Affiche les jetons et dollars estimés économisés par le toolkitty', ru: 'Показывает оценку токенов и долларов, сэкономленных toolkitty', zh: '显示 Toolkitty 节省的估算 token 数和美元数', ja: 'Toolkitty が節約した推定トークン数とドル額を表示します', pt: 'Mostra os tokens e dólares estimados que o toolkitty economizou', de: 'Zeigt die geschätzten Tokens und Dollar, die das Toolkitty gespart hat', ko: 'Toolkitty이 절약한 추정 토큰과 달러를 보여 줍니다' },
  paneTitle: { en: 'Savings meter', he: 'מד חיסכון', es: 'Medidor de ahorro', fr: "Compteur d'économies", ru: 'Счётчик экономии', zh: '节省计量', ja: '節約メーター', pt: 'Medidor de economia', de: 'Spar-Zähler', ko: '절약 미터' },
  paneOff: { en: 'The savings meter is off. Turn it on in the /toolkitty pane.', he: 'מד החיסכון כבוי. הפעל אותו בלוח /toolkitty.', es: 'El medidor de ahorro está desactivado. Actívalo en el panel /toolkitty.', fr: "Le compteur d'économies est désactivé. Activez-le dans le panneau /toolkitty.", ru: 'Счётчик экономии отключён. Включите его в панели /toolkitty.', zh: '节省计量已关闭。请在 /toolkitty 面板中开启。', ja: '節約メーターはオフです。/toolkitty パネルでオンにしてください。', pt: 'O medidor de economia está desativado. Ative-o no painel /toolkitty.', de: 'Der Spar-Zähler ist aus. Schalte ihn im /toolkitty-Panel ein.', ko: '절약 미터가 꺼져 있습니다. /toolkitty 패널에서 켜세요.' },
  opened: { en: 'Opened the savings meter.', he: 'מד החיסכון נפתח.', es: 'Medidor de ahorro abierto.', fr: "Compteur d'économies ouvert.", ru: 'Счётчик экономии открыт.', zh: '已打开节省计量。', ja: '節約メーターを開きました。', pt: 'Medidor de economia aberto.', de: 'Spar-Zähler geöffnet.', ko: '절약 미터를 열었습니다.' },
  band: { en: '💸 saved ≈ {tok} tok · {usd} this session', he: '💸 נחסך ≈ {tok} טוקנים · {usd} בסשן הזה', es: '💸 ahorrado ≈ {tok} tok · {usd} en esta sesión', fr: '💸 économisé ≈ {tok} jetons · {usd} cette session', ru: '💸 сэкономлено ≈ {tok} ток. · {usd} за сессию', zh: '💸 已节省 ≈ {tok} tok · 本次会话 {usd}', ja: '💸 節約 ≈ {tok} tok · このセッション {usd}', pt: '💸 economizado ≈ {tok} tok · {usd} nesta sessão', de: '💸 gespart ≈ {tok} Tok · {usd} in dieser Sitzung', ko: '💸 절약 ≈ {tok} tok · 이번 세션 {usd}' },
  chipSaved: { en: 'saved {tok}', he: 'נחסך {tok}', es: 'ahorro {tok}', fr: 'éco. {tok}', ru: 'сэкон. {tok}', zh: '已省 {tok}', ja: '節約 {tok}', pt: 'econ. {tok}', de: 'gespart {tok}', ko: '절약 {tok}' },
  nothingHint: {
    en: 'Savings appear when output is trimmed, archived or a duplicate read is flagged.',
    he: 'חיסכון יופיע כשפלט מקוצר או מועבר לארכיון, או כשקריאה כפולה מסומנת.',
    es: 'El ahorro aparece cuando se recorta o archiva una salida, o se señala una lectura duplicada.',
    fr: 'Les économies apparaissent quand une sortie est réduite, archivée ou qu\'une lecture en double est signalée.',
    ru: 'Экономия появится, когда вывод сократят или архивируют либо отметят повторное чтение.',
    zh: '当输出被精简、归档，或标记出重复读取时，这里会显示节省量。',
    ja: '出力のトリミング・アーカイブ、または重複読み取りの検出時に節約量が表示されます。',
    pt: 'A economia aparece quando uma saída é cortada, arquivada ou uma leitura duplicada é sinalizada.',
    de: 'Einsparungen erscheinen, wenn Ausgaben gekürzt oder archiviert oder doppelte Lesevorgänge markiert werden.',
    ko: '출력이 줄거나 보관되거나 중복 읽기가 감지되면 절약량이 나타납니다.',
  },
  head: { en: 'Estimated savings', he: 'חיסכון משוער', es: 'Ahorro estimado', fr: 'Économies estimées', ru: 'Оценка экономии', zh: '估算节省', ja: '推定節約額', pt: 'Economia estimada', de: 'Geschätzte Einsparungen', ko: '추정 절약량' },
  session: { en: 'This session', he: 'הסשן הזה', es: 'Esta sesión', fr: 'Cette session', ru: 'Эта сессия', zh: '本次会话', ja: 'このセッション', pt: 'Esta sessão', de: 'Diese Sitzung', ko: '이번 세션' },
  today: { en: 'Today', he: 'היום', es: 'Hoy', fr: "Aujourd'hui", ru: 'Сегодня', zh: '今天', ja: '今日', pt: 'Hoje', de: 'Heute', ko: '오늘' },
  week: { en: 'Last 7 days', he: '7 הימים האחרונים', es: 'Últimos 7 días', fr: '7 derniers jours', ru: 'Последние 7 дней', zh: '最近 7 天', ja: '過去 7 日間', pt: 'Últimos 7 dias', de: 'Letzte 7 Tage', ko: '최근 7일' },
  all: { en: 'All time', he: 'מאז ומעולם', es: 'Total', fr: 'Depuis toujours', ru: 'За всё время', zh: '全部时间', ja: '全期間', pt: 'Todo o período', de: 'Gesamt', ko: '전체 기간' },
  line: { en: '≈ {tok} tok · {usd}', he: '≈ {tok} טוקנים · {usd}', es: '≈ {tok} tok · {usd}', fr: '≈ {tok} jetons · {usd}', ru: '≈ {tok} ток. · {usd}', zh: '≈ {tok} tok · {usd}', ja: '≈ {tok} tok · {usd}', pt: '≈ {tok} tok · {usd}', de: '≈ {tok} Tok · {usd}', ko: '≈ {tok} tok · {usd}' },
  byFeature: { en: 'By feature (this session)', he: 'לפי שכלול (הסשן הזה)', es: 'Por función (esta sesión)', fr: 'Par fonctionnalité (cette session)', ru: 'По функциям (эта сессия)', zh: '按功能（本次会话）', ja: '機能別（このセッション）', pt: 'Por recurso (esta sessão)', de: 'Nach Funktion (diese Sitzung)', ko: '기능별 (이번 세션)' },
  nothing: { en: 'Nothing saved yet this session.', he: 'עדיין לא נחסך דבר בסשן הזה.', es: 'Aún no se ha ahorrado nada en esta sesión.', fr: "Rien d'économisé pour l'instant dans cette session.", ru: 'В этой сессии пока ничего не сэкономлено.', zh: '本次会话尚未节省任何内容。', ja: 'このセッションではまだ節約できていません。', pt: 'Nada foi economizado nesta sessão ainda.', de: 'In dieser Sitzung wurde noch nichts gespart.', ko: '이번 세션에는 아직 절약한 것이 없습니다.' },
  flagged: { en: 'flagged, not yet saved', he: 'סומן, עדיין לא נחסך', es: 'señalado, aún no ahorrado', fr: 'signalé, pas encore économisé', ru: 'отмечено, ещё не сэкономлено', zh: '已标记，尚未节省', ja: '検出済み、未節約', pt: 'sinalizado, ainda não economizado', de: 'markiert, noch nicht gespart', ko: '감지됨, 아직 절약 안 됨' },
  note: {
    en: 'All figures are estimates (characters ÷ 4, about $3 per million input tokens). Each saving is counted once; a token kept out of the context is usually re-read on every later turn, so the real saving is likely larger.',
    he: 'כל המספרים הם הערכות (תווים ÷ 4, כ-3$ למיליון טוקני קלט). כל חיסכון נספר פעם אחת; טוקן שהורחק מההקשר היה נקרא מחדש בדרך כלל בכל תור, ולכן החיסכון האמיתי כנראה גדול יותר.',
    es: 'Todas las cifras son estimaciones (caracteres ÷ 4, unos 3 $ por millón de tokens de entrada). Cada ahorro se cuenta una vez; un token fuera del contexto suele releerse en cada turno posterior, así que el ahorro real probablemente es mayor.',
    fr: "Tous les chiffres sont des estimations (caractères ÷ 4, environ 3 $ le million de jetons d'entrée). Chaque économie n'est comptée qu'une fois ; un jeton gardé hors du contexte serait en général relu à chaque tour suivant, donc l'économie réelle est probablement plus grande.",
    ru: 'Все числа — оценки (символы ÷ 4, около 3 $ за миллион входных токенов). Каждая экономия считается один раз; токен, не попавший в контекст, обычно перечитывался бы на каждом следующем ходу, так что реальная экономия, вероятно, больше.',
    zh: '所有数字均为估算（字符数 ÷ 4，约每百万输入 token 3 美元）。每笔节省只计一次；未进入上下文的 token 通常会在之后每一轮被重新读取，因此实际节省很可能更多。',
    ja: '数値はすべて推定です（文字数 ÷ 4、入力トークン 100 万あたり約 3 ドル）。各節約は一度だけ計上されます。コンテキストに入れなかったトークンは、通常その後のターンごとに再読み込みされるため、実際の節約はさらに大きい可能性があります。',
    pt: 'Todos os valores são estimativas (caracteres ÷ 4, cerca de US$ 3 por milhão de tokens de entrada). Cada economia é contada uma vez; um token mantido fora do contexto costuma ser relido a cada turno seguinte, então a economia real provavelmente é maior.',
    de: 'Alle Zahlen sind Schätzungen (Zeichen ÷ 4, etwa 3 $ pro Million Eingabe-Tokens). Jede Einsparung wird einmal gezählt; ein aus dem Kontext herausgehaltener Token würde sonst meist in jedem späteren Zug erneut gelesen, die echte Einsparung ist also wohl größer.',
    ko: '모든 수치는 추정치입니다(문자 수 ÷ 4, 입력 토큰 100만 개당 약 3달러). 각 절약은 한 번만 집계되며, 컨텍스트에서 뺀 토큰은 보통 이후 매 턴마다 다시 읽히므로 실제 절약은 더 클 가능성이 높습니다.',
  },
  copy: { en: 'Copy share text', he: 'העתק טקסט לשיתוף', es: 'Copiar texto para compartir', fr: 'Copier le texte à partager', ru: 'Скопировать текст', zh: '复制分享文本', ja: '共有テキストをコピー', pt: 'Copiar texto para compartilhar', de: 'Freigabetext kopieren', ko: '공유 텍스트 복사' },
  copied: { en: 'Copied the share text', he: 'טקסט השיתוף הועתק', es: 'Texto para compartir copiado', fr: 'Texte à partager copié', ru: 'Текст скопирован', zh: '已复制分享文本', ja: '共有テキストをコピーしました', pt: 'Texto para compartilhar copiado', de: 'Freigabetext kopiert', ko: '공유 텍스트를 복사했습니다' },
  copyFailed: { en: 'Could not copy', he: 'ההעתקה נכשלה', es: 'No se pudo copiar', fr: 'Copie impossible', ru: 'Не удалось скопировать', zh: '无法复制', ja: 'コピーできませんでした', pt: 'Não foi possível copiar', de: 'Kopieren nicht möglich', ko: '복사할 수 없습니다' },
  share: {
    en: 'Toolkitty saved me ≈ {usd} and {tok} tokens this week.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    he: 'ה-Toolkitty חסך לי ≈ {usd} ו-{tok} טוקנים השבוע.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    es: 'Toolkitty me ahorró ≈ {usd} y {tok} tokens esta semana.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    fr: "Toolkitty m'a fait économiser ≈ {usd} et {tok} jetons cette semaine.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty",
    ru: 'Toolkitty сэкономил мне ≈ {usd} и {tok} токенов на этой неделе.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    zh: 'Toolkitty 本周帮我节省了约 {usd} 和 {tok} 个 token。\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ja: 'Toolkitty は今週、約 {usd} と {tok} トークンを節約してくれました。\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    pt: 'O Toolkitty me economizou ≈ {usd} e {tok} tokens esta semana.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    de: 'Toolkitty hat mir diese Woche ≈ {usd} und {tok} Tokens gespart.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ko: 'Toolkitty이 이번 주에 약 {usd}와 토큰 {tok}개를 아껴 줬어요.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
  },
  nameTrimmer: { en: 'Output trimming', he: 'קיצור פלט', es: 'Recorte de salida', fr: 'Réduction de la sortie', ru: 'Сокращение вывода', zh: '输出精简', ja: '出力のトリミング', pt: 'Corte de saída', de: 'Ausgabe kürzen', ko: '출력 줄이기' },
  nameArchive: { en: 'Output archive', he: 'ארכיון פלט', es: 'Archivo de salidas', fr: 'Archive des sorties', ru: 'Архив вывода', zh: '输出归档', ja: '出力アーカイブ', pt: 'Arquivo de saídas', de: 'Ausgabe-Archiv', ko: '출력 보관' },
  nameDup: { en: 'Duplicate read detector', he: 'זיהוי קריאות כפולות', es: 'Detector de lecturas duplicadas', fr: 'Détecteur de lectures en double', ru: 'Детектор повторных чтений', zh: '重复读取检测', ja: '重複読み取りの検出', pt: 'Detector de leitura duplicada', de: 'Erkennung doppelter Lesevorgänge', ko: '중복 읽기 감지' },
  rate: {
    en: 'Estimate rate: characters ÷ 4 = tokens, at $0.000003 per input token ($3 per million).',
    he: 'שער ההערכה: תווים ÷ 4 = טוקנים, ב-$0.000003 לטוקן קלט ($3 למיליון).',
    es: 'Tasa de estimación: caracteres ÷ 4 = tokens, a $0.000003 por token de entrada ($3 por millón).',
    fr: 'Taux d\'estimation : caractères ÷ 4 = tokens, à 0,000003 $ par token d\'entrée (3 $ le million).',
    ru: 'Ставка оценки: символы ÷ 4 = токены, $0.000003 за входной токен ($3 за миллион).',
    zh: '估算比率：字符数 ÷ 4 = token 数，按每个输入 token 0.000003 美元计（每百万 3 美元）。',
    ja: '推定レート：文字数 ÷ 4 = トークン数、入力トークン 1 個あたり $0.000003（100 万あたり $3）。',
    pt: 'Taxa de estimativa: caracteres ÷ 4 = tokens, a US$ 0,000003 por token de entrada (US$ 3 por milhão).',
    de: 'Schätzrate: Zeichen ÷ 4 = Tokens, bei 0,000003 $ pro Eingabe-Token (3 $ pro Million).',
    ko: '추정 비율: 문자 수 ÷ 4 = 토큰 수, 입력 토큰당 $0.000003(100만 개당 $3).',
  },
  fourHead: { en: 'Used, saved, avoidable and money: kept apart', he: 'נצרך, נחסך, ניתן להימנעות וכסף: בנפרד', es: 'Usado, ahorrado, evitable y dinero: por separado', fr: 'Utilisé, économisé, évitable et argent : séparés', ru: 'Потрачено, сэкономлено, можно избежать и деньги: отдельно', zh: '已用、已省、可避免与金额：分开列示', ja: '使用量、節約量、回避可能量、金額：別々に表示', pt: 'Usado, economizado, evitável e dinheiro: separados', de: 'Verbraucht, gespart, vermeidbar und Geld: getrennt', ko: '사용량, 절약량, 피할 수 있는 양, 금액: 따로 표시' },
  fourActual: { en: 'Metered usage (actual)', he: 'צריכה נמדדת (בפועל)', es: 'Uso medido (real)', fr: 'Consommation mesurée (réelle)', ru: 'Измеренный расход (фактический)', zh: '计量用量（实际）', ja: '計測済み使用量（実測）', pt: 'Uso medido (real)', de: 'Gemessene Nutzung (tatsächlich)', ko: '측정된 사용량 (실제)' },
  fourActualValue: { en: '{usd} · actual', he: '{usd} · בפועל', es: '{usd} · real', fr: '{usd} · réel', ru: '{usd} · фактически', zh: '{usd} · 实际', ja: '{usd} · 実測', pt: '{usd} · real', de: '{usd} · tatsächlich', ko: '{usd} · 실제' },
  fourNoMeter: { en: 'not metered yet', he: 'עדיין לא נמדד', es: 'aún sin medir', fr: 'pas encore mesuré', ru: 'ещё не измерено', zh: '尚未计量', ja: '未計測', pt: 'ainda não medido', de: 'noch nicht gemessen', ko: '아직 측정 안 됨' },
  fourSaved: { en: 'Estimated saved', he: 'חיסכון משוער', es: 'Ahorro estimado', fr: 'Économie estimée', ru: 'Оценка экономии', zh: '估算已省', ja: '推定節約量', pt: 'Economia estimada', de: 'Geschätzt gespart', ko: '추정 절약량' },
  fourSavedValue: { en: '≈ {tok} tok · {usd} · estimated', he: '≈ {tok} טוקנים · {usd} · הערכה', es: '≈ {tok} tok · {usd} · estimado', fr: '≈ {tok} jetons · {usd} · estimé', ru: '≈ {tok} ток. · {usd} · оценка', zh: '≈ {tok} tok · {usd} · 估算', ja: '≈ {tok} tok · {usd} · 推定', pt: '≈ {tok} tok · {usd} · estimado', de: '≈ {tok} Tok · {usd} · geschätzt', ko: '≈ {tok} tok · {usd} · 추정' },
  fourLeaks: { en: 'Hypothetical opportunities', he: 'הזדמנויות היפותטיות', es: 'Oportunidades hipotéticas', fr: 'Occasions hypothétiques', ru: 'Гипотетические возможности', zh: '假设性的机会', ja: '仮定の削減余地', pt: 'Oportunidades hipotéticas', de: 'Hypothetische Möglichkeiten', ko: '가상의 절약 기회' },
  fourLeaksValue: { en: '≈ {tok} tok · if avoided', he: '≈ {tok} טוקנים · אילו נמנע', es: '≈ {tok} tok · si se evitara', fr: '≈ {tok} jetons · si évité', ru: '≈ {tok} ток. · если избежать', zh: '≈ {tok} tok · 若可避免', ja: '≈ {tok} tok · 回避できれば', pt: '≈ {tok} tok · se evitado', de: '≈ {tok} Tok · falls vermieden', ko: '≈ {tok} tok · 피했다면' },
  fourMoney: { en: 'Monetary estimate', he: 'הערכה כספית', es: 'Estimación monetaria', fr: 'Estimation monétaire', ru: 'Денежная оценка', zh: '金额估算', ja: '金額の推定', pt: 'Estimativa monetária', de: 'Geldschätzung', ko: '금액 추정' },
  fourMoneyValue: { en: '≈ {usd} · estimate, not your bill', he: '≈ {usd} · הערכה, לא החשבון שלך', es: '≈ {usd} · estimación, no tu factura', fr: '≈ {usd} · estimation, pas votre facture', ru: '≈ {usd} · оценка, не ваш счёт', zh: '≈ {usd} · 估算，不是你的账单', ja: '≈ {usd} · 推定であり、請求額ではありません', pt: '≈ {usd} · estimativa, não sua fatura', de: '≈ {usd} · Schätzung, nicht deine Rechnung', ko: '≈ {usd} · 추정치이며 실제 청구액이 아님' },
  leakDupRead: { en: 'Duplicate reads', he: 'קריאות כפולות', es: 'Lecturas duplicadas', fr: 'Lectures en double', ru: 'Повторные чтения', zh: '重复读取', ja: '重複読み取り', pt: 'Leituras duplicadas', de: 'Doppelte Lesevorgänge', ko: '중복 읽기' },
  leakRepeatCmd: { en: 'Repeated commands', he: 'פקודות חוזרות', es: 'Comandos repetidos', fr: 'Commandes répétées', ru: 'Повторы команд', zh: '重复命令', ja: '繰り返されたコマンド', pt: 'Comandos repetidos', de: 'Wiederholte Befehle', ko: '반복된 명령' },
  leakFailed: { en: 'Failed attempts', he: 'ניסיונות שנכשלו', es: 'Intentos fallidos', fr: 'Tentatives échouées', ru: 'Неудачные попытки', zh: '失败的尝试', ja: '失敗した試行', pt: 'Tentativas com falha', de: 'Fehlgeschlagene Versuche', ko: '실패한 시도' },
  leakAgent: { en: 'Subagent spend', he: 'צריכת תת-סוכנים', es: 'Gasto de subagentes', fr: 'Dépense des sous-agents', ru: 'Расход субагентов', zh: '子代理开销', ja: 'サブエージェントの消費', pt: 'Gasto de subagentes', de: 'Subagent-Kosten', ko: '서브에이전트 비용' },
  cmdTaken: {
    en: 'The command /{name} could not be registered: {reason}',
    he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}',
    es: 'No se pudo registrar el comando /{name}: {reason}',
    fr: "Impossible d'enregistrer la commande /{name} : {reason}",
    ru: 'Не удалось зарегистрировать команду /{name}: {reason}',
    zh: '无法注册命令 /{name}：{reason}',
    ja: 'コマンド /{name} を登録できませんでした：{reason}',
    pt: 'Não foi possível registrar o comando /{name}: {reason}',
    de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}',
    ko: '/{name} 명령을 등록할 수 없습니다: {reason}',
  },
} as const

type Day = { tokens: number; usd: number }
type Mark = { started: number; tokens: number; usd: number }

const savings = atom({ plugin: 'toolkitty', key: 'slot', id: 'savings' } as const, { tokens: 0, usd: 0, byFeature: {}, leaks: {} } as Savings) as unknown as Atom<Savings>

const DAYS_KEY = 'savings:days'
const MARK_KEY = 'savings:mark'
const DAY_MS = 86_400_000
const DUP_ID = 'dup-read-detector'
const BAR_WIDTH = 20

export const feature: Feature = {
  id: 'savings',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const dayKey = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const tokText = (n: number): string => {
  if (n < 1000) return String(Math.round(n))
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

const usdText = (usd: number): string => (usd > 0 && usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`)

const lineText = (d: Day): string => t(T.line, { tok: tokText(d.tokens), usd: usdText(d.usd) })

/** What of the session's savings is already in the day totals. */
const countedOf = (mark: Mark, started: number, now: Savings): Day =>
  mark.started === started && now.tokens >= mark.tokens ? { tokens: mark.tokens, usd: mark.usd } : { tokens: 0, usd: 0 }

const featureName = (id: string): string => {
  if (id === 'output-trimmer') return t(T.nameTrimmer)
  if (id === 'output-archive') return t(T.nameArchive)
  if (id === DUP_ID) return t(T.nameDup)
  return id
}

const RATE = 0.000003

const leakName = (kind: string): string =>
  kind === 'dup-read' ? t(T.leakDupRead) : kind === 'repeat-cmd' ? t(T.leakRepeatCmd) : kind === 'failed-attempt' ? t(T.leakFailed) : kind === 'agent-spend' ? t(T.leakAgent) : kind

type Totals = {
  session: Day
  today: Day
  week: Day
  all: Day
  byFeature: Record<string, number>
  /** hypothetical tokens per leak kind */
  leaks: Record<string, number>
  /** the session's metered cost in dollars, when the engine reports one */
  metered: number | undefined
}

/** The figures the pane shows: stored days plus what this session has not yet written to them. */
async function loadTotals($: EngineInterface): Promise<Totals> {
  const now = await read($, savings)
  const days = await storeGet<Record<string, Day>>($, DAYS_KEY, {})
  const mark = await storeGet<Mark>($, MARK_KEY, { started: 0, tokens: 0, usd: 0 })
  const usage = await $.session.usage()
  const started = usage.startedAt
  const counted = countedOf(mark, started, now)
  const pending: Day = { tokens: Math.max(0, now.tokens - counted.tokens), usd: Math.max(0, now.usd - counted.usd) }

  const nowMs = await $.clock.now()
  const week = new Set<string>()
  for (let i = 0; i < 7; i++) week.add(dayKey(nowMs - i * DAY_MS))
  const today = dayKey(nowMs)

  const sum = (pick: (key: string) => boolean): Day => {
    let tokens = 0
    let usd = 0
    for (const [key, d] of Object.entries(days)) {
      if (!pick(key)) continue
      tokens += d.tokens
      usd += d.usd
    }
    return { tokens, usd }
  }
  const add = (a: Day): Day => ({ tokens: a.tokens + pending.tokens, usd: a.usd + pending.usd })

  return {
    session: { tokens: now.tokens, usd: now.usd },
    today: add(sum(key => key === today)),
    week: add(sum(key => week.has(key))),
    all: add(sum(() => true)),
    byFeature: now.byFeature,
    leaks: now.leaks ?? {},
    metered: usage.cost?.usd,
  }
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'savings', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'savings', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }

  try {
    const now = await read($, savings)
    if (now.tokens > 0) {
      await publish($, { id: 'savings:session', feature: feature.id, kind: 'saving', level: 'ok', value: Math.round(now.tokens), text: `saved ${compact(now.tokens)} tok` })
    } else {
      await retract($, 'savings:session')
    }
    const started = (await $.session.usage()).startedAt
    const mark = await storeGet<Mark>($, MARK_KEY, { started: 0, tokens: 0, usd: 0 })
    const counted = countedOf(mark, started, now)
    const add: Day = { tokens: Math.max(0, now.tokens - counted.tokens), usd: Math.max(0, now.usd - counted.usd) }
    if (add.tokens === 0 && add.usd === 0 && mark.started === started) return

    if (add.tokens > 0 || add.usd > 0) {
      const days = await storeGet<Record<string, Day>>($, DAYS_KEY, {})
      const key = dayKey(await $.clock.now())
      const cur = days[key] ?? { tokens: 0, usd: 0 }
      await storeSet($, DAYS_KEY, { ...days, [key]: { tokens: cur.tokens + add.tokens, usd: cur.usd + add.usd } })
    }
    await storeSet($, MARK_KEY, { started, tokens: now.tokens, usd: now.usd })
  } catch {
    // the totals are a convenience; never break the turn over them
  }
}

/** What a press on the band line shows: this session's tokens per feature and the rate behind the estimate. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const s = await read($, savings)
  const { Box, Text } = $.ui.resolve(e)
  const features = Object.entries(s.byFeature)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  return (
    <Box flexDirection="column">
      <Text bold>{`${t(T.session)}: ${lineText({ tokens: s.tokens, usd: s.usd })}`}</Text>
      <Text bold>{t(T.byFeature)}</Text>
      {features.length === 0 ? emptyState($, e, t(T.nothing), t(T.nothingHint)) : null}
      {features.map(([id, n]) => (
        <Text key={`sv-${id}`} dimColor={id === DUP_ID}>
          {`${featureName(id)} · ${lineText({ tokens: n, usd: n * 0.000003 })}${id === DUP_ID ? ` (${t(T.flagged)})` : ''}`}
        </Text>
      ))}
      <Text dimColor>{t(T.rate)}</Text>
    </Box>
  )
}

/** The short band form: the tokens kept out of this session, e.g. "saved 108k". Quiet until something was saved. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const s = await read($, savings)
  if (s.tokens <= 0) return null
  return { text: t(T.chipSaved, { tok: compact(s.tokens) }), level: 'ok', icon: ICONS.quota }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const s = await read($, savings)
  if (s.tokens <= 0) return null

  const { Text } = $.ui.resolve(e)
  return <Text dimColor size="footnote">{t(T.band, { tok: tokText(s.tokens), usd: usdText(s.usd) })}</Text>
}

export function register(on: On) {
  on('command.run', { command: 'savings' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: 'savings', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'savings' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.quota })}
          {emptyState($, e, t(T.paneOff))}
        </Box>
      )
    }

    const totals = await loadTotals($)
    const rows: { label: string; day: Day }[] = [
      { label: t(T.session), day: totals.session },
      { label: t(T.today), day: totals.today },
      { label: t(T.week), day: totals.week },
      { label: t(T.all), day: totals.all },
    ]

    const features = Object.entries(totals.byFeature)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
    const leakKinds = Object.entries(totals.leaks)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
    const leakTotal = leakKinds.reduce((sum, [, n]) => sum + n, 0)
    const biggest = features.reduce((m, [, n]) => Math.max(m, n), 0)

    const shareText = t(T.share, { usd: usdText(totals.week.usd), tok: tokText(totals.week.tokens) })
    const copy = async (surface: typeof e.surface) => {
      const done = await $.ui.copy({ text: shareText, surface })
      await notice($, done.isCopied ? 'info' : 'warn', t(done.isCopied ? T.copied : T.copyFailed), feature.id)
    }

    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: tokText(totals.session.tokens),
          level: totals.session.tokens > 0 ? 'info' : 'ok',
          icon: ICONS.quota,
          actions: [{ key: 'savings-copy', label: t(T.copy), onPress: () => copy(e.surface) }],
        })}
        {sectionTitle($, e, t(T.fourHead))}
        {listRow($, e, {
          key: 'four-actual',
          text: t(T.fourActual),
          right: totals.metered === undefined ? t(T.fourNoMeter) : t(T.fourActualValue, { usd: usdText(totals.metered) }),
        })}
        {listRow($, e, {
          key: 'four-saved',
          text: t(T.fourSaved),
          right: t(T.fourSavedValue, { tok: tokText(totals.session.tokens), usd: usdText(totals.session.usd) }),
        })}
        {listRow($, e, { key: 'four-leaks', text: t(T.fourLeaks), right: t(T.fourLeaksValue, { tok: tokText(leakTotal) }), level: leakTotal > 0 ? 'info' : 'ok' })}
        {leakKinds.map(([kind, n]) => (
          <Text key={`leak-${kind}`} dimColor size="footnote">
            {`  ${leakName(kind)} · ≈ ${tokText(n)} tok`}
          </Text>
        ))}
        {listRow($, e, { key: 'four-money', text: t(T.fourMoney), right: t(T.fourMoneyValue, { usd: usdText(leakTotal * RATE) }) })}
        {sectionTitle($, e, t(T.head))}
        {rows.map(r => listRow($, e, { key: `row-${r.label}`, text: r.label, right: lineText(r.day) }))}
        {sectionTitle($, e, t(T.byFeature))}
        {features.length === 0 && emptyState($, e, t(T.nothing), t(T.nothingHint))}
        {features.map(([id, n]) => {
          const flagged = id === DUP_ID
          const width = Math.max(1, Math.round((n / biggest) * BAR_WIDTH))
          return (
            <Box key={`feat-${id}`} gap={1}>
              <Text dimColor={flagged}>{featureName(id)}</Text>
              <Text color={flagged ? undefined : 'success'} dimColor={flagged}>
                {(flagged ? '░' : '█').repeat(width)}
              </Text>
              <Text mono dimColor={flagged}>
                {flagged ? `${tokText(n)} (${t(T.flagged)})` : tokText(n)}
              </Text>
            </Box>
          )
        })}
        <Text dimColor size="footnote">{t(T.note)}</Text>
      </Box>
    )
  })
}
