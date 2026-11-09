/*
 * The sharing layer: pure functions that turn Toolkitty's local numbers into
 * share cards (SVG, 1200x630) and post texts, and that scrub text before it
 * leaves the machine. No atoms and no `$` live here, so any file may import it.
 *
 *   redact(text, opts)      paths -> basename, secrets masked (same kinds as
 *                           pasted-secret-scan), project folder -> "my project"
 *   cardSvg(kind, data, th) one visual language for four cards
 *   postText(kind, data)    localized post ending with the install command
 *
 * Nothing here uploads anything, and no card carries a user identity: no
 * name, no path, no project, no prompt text.
 */
import { REPO_URL, isPlaceholder } from './credits'
import type { Theme } from './themes'

export type Lang = 'en' | 'he' | 'es' | 'fr' | 'ru' | 'zh' | 'ja' | 'pt' | 'de' | 'ko'
export type CardKind = 'savings' | 'safety' | 'achievement' | 'pet'
export const CARD_KINDS: readonly CardKind[] = ['savings', 'safety', 'achievement', 'pet']

export const FOOTER = 'Claude Code · Toolkitty'
export const INSTALL_CMD = 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty'
export const PROJECT_ALIAS = 'my project'
export const MAX_SVG_BYTES = 24 * 1024

// ---------- data shapes ----------

export type Species = 'cat' | 'fox' | 'owl' | 'octopus' | 'dragon' | 'axolotl' | 'penguin' | 'capybara' | 'raccoon' | 'robot' | 'ghost' | 'slime'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

/** Tokens and dollars estimated this week, and the tokens of each of the last 7 days (oldest first). */
export type SavingsData = { tokens: number; usd: number; days: number[] }
/** Prevented incidents this month: the total and the count per family (secrets, destructive, edits, ci, injection, other). */
export type SafetyData = { total: number; families: Record<string, number> }
/** The newest trophy: its icon, title and date (YYYY-MM-DD); null while there is none. */
export type AchievementData = { icon: string; title: string; date: string } | null
/** The buddy's pose, as `buddy:mood` stores it (the same word the buddy pane shows). */
export type PetMood = 'idle' | 'working' | 'celebrating' | 'worried' | 'sleeping' | 'guarding' | 'chasing'
export const PET_MOODS: readonly PetMood[] = ['idle', 'working', 'celebrating', 'worried', 'sleeping', 'guarding', 'chasing']
const isPetMood = (v: unknown): v is PetMood => typeof v === 'string' && (PET_MOODS as readonly string[]).includes(v)
/** The companion: species, rarity, stage 1..3, XP (minutes worked) and its current pose; null while there is none. */
export type PetData = { species: Species; rarity: Rarity; shiny: boolean; stage: 1 | 2 | 3; xp: number; mood: PetMood } | null

export type CardDataMap = { savings: SavingsData; safety: SafetyData; achievement: AchievementData; pet: PetData }

// ---------- localized words (own tables: this file is pure and cannot use core's t) ----------

type Tx = Readonly<Record<'en' | 'he' | 'es' | 'fr' | 'ru', string>> & Readonly<Partial<Record<Lang, string>>>

function tx(d: Tx, lang: Lang, vars?: Readonly<Record<string, string | number>>): string {
  let out = d[lang] ?? d.en
  if (vars !== undefined) {
    for (const key of Object.keys(vars)) out = out.split(`{${key}}`).join(String(vars[key]))
  }
  return out
}

const W = {
  kSavings: { en: 'SAVINGS · THIS WEEK', he: 'חיסכון · השבוע', es: 'AHORRO · ESTA SEMANA', fr: 'ÉCONOMIES · CETTE SEMAINE', ru: 'ЭКОНОМИЯ · ЗА НЕДЕЛЮ', zh: '节省 · 本周', ja: '節約 · 今週', pt: 'ECONOMIA · ESTA SEMANA', de: 'ERSPARNIS · DIESE WOCHE', ko: '절약 · 이번 주' },
  kSafety: { en: 'SAFETY · THIS MONTH', he: 'בטיחות · החודש', es: 'SEGURIDAD · ESTE MES', fr: 'SÉCURITÉ · CE MOIS-CI', ru: 'БЕЗОПАСНОСТЬ · ЗА МЕСЯЦ', zh: '安全 · 本月', ja: '安全 · 今月', pt: 'SEGURANÇA · ESTE MÊS', de: 'SICHERHEIT · DIESER MONAT', ko: '안전 · 이번 달' },
  kAchievement: { en: 'LATEST ACHIEVEMENT', he: 'ההישג האחרון', es: 'ÚLTIMO LOGRO', fr: 'DERNIER SUCCÈS', ru: 'ПОСЛЕДНЕЕ ДОСТИЖЕНИЕ', zh: '最新成就', ja: '最新の実績', pt: 'ÚLTIMA CONQUISTA', de: 'LETZTER ERFOLG', ko: '최근 업적' },
  kPet: { en: 'MY COMPANION', he: 'המלווה שלי', es: 'MI COMPAÑERO', fr: 'MON COMPAGNON', ru: 'МОЙ ПИТОМЕЦ', zh: '我的伙伴', ja: '私の相棒', pt: 'MEU COMPANHEIRO', de: 'MEIN BEGLEITER', ko: '내 버디' },
  tokens: { en: 'tokens', he: 'טוקנים', es: 'tokens', fr: 'tokens', ru: 'токенов', zh: 'token', ja: 'トークン', pt: 'tokens', de: 'Tokens', ko: '토큰' },
  estimated: { en: 'estimated', he: 'הערכה', es: 'estimado', fr: 'estimé', ru: 'оценка', zh: '估算', ja: '推定', pt: 'estimado', de: 'geschätzt', ko: '추정' },
  estimatedNote: { en: 'estimated, not your bill', he: 'הערכה, לא החשבון שלך', es: 'estimado, no tu factura', fr: 'estimé, pas ta facture', ru: 'оценка, не ваш счёт', zh: '估算值，并非你的账单', ja: '推定値で、請求額ではありません', pt: 'estimado, não é a sua fatura', de: 'geschätzt, nicht deine Rechnung', ko: '추정치이며 실제 청구액이 아닙니다' },
  last7: { en: 'LAST 7 DAYS', he: '7 הימים האחרונים', es: 'ÚLTIMOS 7 DÍAS', fr: '7 DERNIERS JOURS', ru: 'ПОСЛЕДНИЕ 7 ДНЕЙ', zh: '最近 7 天', ja: '過去 7 日間', pt: 'ÚLTIMOS 7 DIAS', de: 'LETZTE 7 TAGE', ko: '최근 7일' },
  blocked: {
    en: 'potentially dangerous operations blocked',
    he: 'פעולות שעלולות להיות מסוכנות נחסמו',
    es: 'operaciones potencialmente peligrosas bloqueadas',
    fr: 'opérations potentiellement dangereuses bloquées',
    ru: 'потенциально опасных операций заблокировано',
    zh: '项潜在危险操作已拦截',
    ja: '件の危険の可能性がある操作をブロック',
    pt: 'operações potencialmente perigosas bloqueadas',
    de: 'potenziell gefährliche Vorgänge blockiert',
    ko: '건의 잠재적 위험 작업 차단됨',
  },
  famSecrets: { en: 'Secrets', he: 'סודות', es: 'Secretos', fr: 'Secrets', ru: 'Секреты', zh: '密钥', ja: 'シークレット', pt: 'Segredos', de: 'Geheimnisse', ko: '시크릿' },
  famDestructive: { en: 'Destructive commands', he: 'פקודות הרסניות', es: 'Comandos destructivos', fr: 'Commandes destructrices', ru: 'Опасные команды', zh: '破坏性命令', ja: '破壊的なコマンド', pt: 'Comandos destrutivos', de: 'Destruktive Befehle', ko: '파괴적 명령' },
  famEdits: { en: 'Risky edits', he: 'עריכות מסוכנות', es: 'Ediciones arriesgadas', fr: 'Modifications risquées', ru: 'Рискованные правки', zh: '高风险编辑', ja: '危険な編集', pt: 'Edições arriscadas', de: 'Riskante Änderungen', ko: '위험한 편집' },
  famCi: { en: 'Red CI', he: 'CI אדום', es: 'CI en rojo', fr: 'CI rouge', ru: 'Красный CI', zh: 'CI 红灯', ja: 'CI 失敗', pt: 'CI vermelho', de: 'CI rot', ko: 'CI 실패' },
  famInjection: { en: 'Injection', he: 'הזרקה', es: 'Inyección', fr: 'Injection', ru: 'Инъекции', zh: '注入', ja: 'インジェクション', pt: 'Injeção', de: 'Injection', ko: '인젝션' },
  famOther: { en: 'Other', he: 'אחר', es: 'Otros', fr: 'Autres', ru: 'Другое', zh: '其他', ja: 'その他', pt: 'Outros', de: 'Sonstiges', ko: '기타' },
  unlocked: { en: 'Unlocked {date}', he: 'נפתח ב-{date}', es: 'Desbloqueado el {date}', fr: 'Débloqué le {date}', ru: 'Открыто {date}', zh: '解锁于 {date}', ja: '{date} に獲得', pt: 'Desbloqueado em {date}', de: 'Freigeschaltet am {date}', ko: '{date}에 달성' },
  noTrophy: { en: 'No achievements yet', he: 'עדיין אין הישגים', es: 'Aún no hay logros', fr: 'Pas encore de succès', ru: 'Достижений пока нет', zh: '还没有成就', ja: '実績はまだありません', pt: 'Nenhuma conquista ainda', de: 'Noch keine Erfolge', ko: '아직 업적이 없습니다' },
  noTrophyHint: { en: 'Your first one is on its way', he: 'הראשון בדרך', es: 'El primero está en camino', fr: 'Le premier arrive', ru: 'Первое уже близко', zh: '第一个很快就来', ja: '最初の実績はもうすぐです', pt: 'A primeira está a caminho', de: 'Dein erster ist unterwegs', ko: '첫 업적이 곧 옵니다' },
  noPet: { en: 'No companion yet', he: 'עדיין אין מלווה', es: 'Aún no hay compañero', fr: 'Pas encore de compagnon', ru: 'Питомца пока нет', zh: '还没有伙伴', ja: '相棒はまだいません', pt: 'Nenhum companheiro ainda', de: 'Noch kein Begleiter', ko: '아직 버디가 없습니다' },
  noPetHint: { en: 'Run /buddy to meet yours', he: 'הרץ /buddy כדי להכיר', es: 'Ejecuta /buddy para conocerlo', fr: 'Lance /buddy pour le rencontrer', ru: 'Запустите /buddy, чтобы познакомиться', zh: '运行 /buddy 来认识你的伙伴', ja: '/buddy を実行して出会いましょう', pt: 'Execute /buddy para conhecer o seu', de: 'Führe /buddy aus, um ihn kennenzulernen', ko: '/buddy를 실행해 만나 보세요' },
  stage: { en: 'Stage {n}', he: 'שלב {n}', es: 'Etapa {n}', fr: 'Stade {n}', ru: 'Стадия {n}', zh: '阶段 {n}', ja: 'ステージ {n}', pt: 'Estágio {n}', de: 'Stufe {n}', ko: '{n}단계' },
  stage1: { en: 'hatchling', he: 'גוזל', es: 'cría', fr: 'bébé', ru: 'птенец', zh: '幼崽', ja: 'ひな', pt: 'filhote', de: 'Schlüpfling', ko: '아기' },
  stage2: { en: 'companion', he: 'מלווה', es: 'compañero', fr: 'compagnon', ru: 'спутник', zh: '伙伴', ja: '相棒', pt: 'companheiro', de: 'Begleiter', ko: '동료' },
  stage3: { en: 'veteran', he: 'ותיק', es: 'veterano', fr: 'vétéran', ru: 'ветеран', zh: '老手', ja: 'ベテラン', pt: 'veterano', de: 'Veteran', ko: '베테랑' },
  mIdle: { en: 'calm', he: 'רגוע', es: 'tranquilo', fr: 'tranquille', ru: 'отдыхает', zh: '平静', ja: 'のんびり', pt: 'tranquilo', de: 'entspannt', ko: '한가함' },
  mWorking: { en: 'typing', he: 'מקליד', es: 'tecleando', fr: 'en train de taper', ru: 'печатает', zh: '打字中', ja: '入力中', pt: 'digitando', de: 'tippt', ko: '작업 중' },
  mCelebrating: { en: 'celebrating', he: 'חוגג', es: 'celebrando', fr: 'en fête', ru: 'празднует', zh: '庆祝中', ja: 'お祝い中', pt: 'comemorando', de: 'feiernd', ko: '축하 중' },
  mWorried: { en: 'worried', he: 'מודאג', es: 'preocupado', fr: 'inquiet', ru: 'тревожится', zh: '担心', ja: '心配', pt: 'preocupado', de: 'besorgt', ko: '걱정됨' },
  mSleeping: { en: 'asleep', he: 'ישן', es: 'dormido', fr: 'endormi', ru: 'спит', zh: '睡着了', ja: '睡眠中', pt: 'dormindo', de: 'schlafend', ko: '자는 중' },
  mGuarding: { en: 'on guard', he: 'על המשמר', es: 'en guardia', fr: 'en garde', ru: 'на страже', zh: '警戒中', ja: '警戒中', pt: 'de guarda', de: 'auf der Hut', ko: '경계 중' },
  mChasing: { en: 'chasing its tail', he: 'רודף אחרי הזנב', es: 'persiguiendo su cola', fr: 'court après sa queue', ru: 'гоняется за хвостом', zh: '追着尾巴转', ja: 'しっぽ追いかけ中', pt: 'correndo atrás do rabo', de: 'jagt den eigenen Schwanz', ko: '꼬리 쫓는 중' },
  shiny: { en: 'shiny', he: 'נוצץ', es: 'brillante', fr: 'chromatique', ru: 'шайни', zh: '闪光', ja: 'シャイニー', pt: 'brilhante', de: 'schillernd', ko: '빛나는' },
  // post texts
  postSavings: {
    en: 'Toolkitty saved me an estimated {usd} ({tok} tokens) this week.',
    he: 'Toolkitty חסך לי לפי הערכה {usd} ({tok} טוקנים) השבוע.',
    es: 'Toolkitty me ahorró un estimado de {usd} ({tok} tokens) esta semana.',
    fr: 'Toolkitty m’a fait économiser environ {usd} ({tok} tokens) cette semaine.',
    ru: 'Toolkitty сэкономил мне примерно {usd} ({tok} токенов) на этой неделе.',
    zh: '本周 Toolkitty 为我节省了约 {usd}（{tok} 个 token）。',
    ja: '今週、Toolkitty のおかげで推定 {usd}（{tok} トークン）を節約できました。',
    pt: 'O Toolkitty me economizou cerca de {usd} ({tok} tokens) esta semana.',
    de: 'Toolkitty hat mir diese Woche geschätzte {usd} ({tok} Tokens) gespart.',
    ko: '이번 주 Toolkitty 덕분에 약 {usd}({tok} 토큰)를 절약했습니다.',
  },
  postSafetyParts: {
    en: 'Toolkitty blocked {n} potentially dangerous operations this month ({parts}).',
    he: 'Toolkitty חסם {n} פעולות שעלולות להיות מסוכנות החודש ({parts}).',
    es: 'Toolkitty bloqueó {n} operaciones potencialmente peligrosas este mes ({parts}).',
    fr: 'Toolkitty a bloqué {n} opérations potentiellement dangereuses ce mois-ci ({parts}).',
    ru: 'Toolkitty заблокировал {n} потенциально опасных операций за месяц ({parts}).',
    zh: 'Toolkitty 本月拦截了 {n} 项潜在危险操作（{parts}）。',
    ja: '今月、Toolkitty は危険の可能性がある操作を {n} 件ブロックしました（{parts}）。',
    pt: 'O Toolkitty bloqueou {n} operações potencialmente perigosas este mês ({parts}).',
    de: 'Toolkitty hat diesen Monat {n} potenziell gefährliche Vorgänge blockiert ({parts}).',
    ko: '이번 달 Toolkitty가 잠재적으로 위험한 작업 {n}건을 차단했습니다({parts}).',
  },
  postSafetyNone: {
    en: 'Toolkitty watches my Claude Code sessions: no potentially dangerous operations this month.',
    he: 'Toolkitty שומר על הסשנים שלי ב-Claude Code: אין החודש פעולות שעלולות להיות מסוכנות.',
    es: 'Toolkitty vigila mis sesiones de Claude Code: ninguna operación potencialmente peligrosa este mes.',
    fr: 'Toolkitty veille sur mes sessions Claude Code : aucune opération potentiellement dangereuse ce mois-ci.',
    ru: 'Toolkitty следит за моими сессиями Claude Code: потенциально опасных операций в этом месяце не было.',
    zh: 'Toolkitty 守护着我的 Claude Code 会话：本月没有潜在危险操作。',
    ja: 'Toolkitty が Claude Code のセッションを見守っています。今月、危険の可能性がある操作はありませんでした。',
    pt: 'O Toolkitty protege minhas sessões do Claude Code: nenhuma operação potencialmente perigosa este mês.',
    de: 'Toolkitty überwacht meine Claude-Code-Sitzungen: diesen Monat keine potenziell gefährlichen Vorgänge.',
    ko: 'Toolkitty가 내 Claude Code 세션을 지켜보고 있습니다. 이번 달에는 잠재적으로 위험한 작업이 없었습니다.',
  },
  postAchievement: {
    en: 'Unlocked “{title}” in Claude Code ({date}).',
    he: 'פתחתי את “{title}” ב-Claude Code ({date}).',
    es: 'Desbloqueé “{title}” en Claude Code ({date}).',
    fr: 'Débloqué : « {title} » dans Claude Code ({date}).',
    ru: 'Открыто достижение «{title}» в Claude Code ({date}).',
    zh: '在 Claude Code 中解锁了“{title}”（{date}）。',
    ja: 'Claude Code で「{title}」を獲得しました（{date}）。',
    pt: 'Desbloqueei “{title}” no Claude Code ({date}).',
    de: '„{title}“ in Claude Code freigeschaltet ({date}).',
    ko: 'Claude Code에서 “{title}” 업적을 달성했습니다({date}).',
  },
  postAchievementNone: {
    en: 'Collecting achievements in Claude Code with Toolkitty.',
    he: 'אוסף הישגים ב-Claude Code עם Toolkitty.',
    es: 'Coleccionando logros en Claude Code con Toolkitty.',
    fr: 'Je collectionne les succès dans Claude Code avec Toolkitty.',
    ru: 'Собираю достижения в Claude Code с Toolkitty.',
    zh: '用 Toolkitty 在 Claude Code 里收集成就。',
    ja: 'Toolkitty で Claude Code の実績を集めています。',
    pt: 'Colecionando conquistas no Claude Code com o Toolkitty.',
    de: 'Ich sammle Erfolge in Claude Code mit Toolkitty.',
    ko: 'Toolkitty로 Claude Code 업적을 모으는 중입니다.',
  },
  postPet: {
    en: 'My Claude Code companion is a {rarity} {species}: {stage}, {xp} XP.',
    he: 'המלווה שלי ב-Claude Code: {species} ({rarity}), {stage}, {xp} XP.',
    es: 'Mi compañero de Claude Code es un {species} ({rarity}): {stage}, {xp} XP.',
    fr: 'Mon compagnon Claude Code est un {species} ({rarity}) : {stage}, {xp} XP.',
    ru: 'Мой питомец в Claude Code: {species} ({rarity}), {stage}, {xp} XP.',
    zh: '我的 Claude Code 伙伴：{species}（{rarity}），{stage}，{xp} XP。',
    ja: 'Claude Code の相棒は {species}（{rarity}）、{stage}、{xp} XP です。',
    pt: 'Meu companheiro no Claude Code: {species} ({rarity}), {stage}, {xp} XP.',
    de: 'Mein Claude-Code-Begleiter: {species} ({rarity}), {stage}, {xp} XP.',
    ko: '내 Claude Code 버디: {species}({rarity}), {stage}, {xp} XP.',
  },
  postPetShiny: {
    en: 'My Claude Code companion is a shiny {rarity} {species}: {stage}, {xp} XP.',
    he: 'המלווה שלי ב-Claude Code: {species} נוצץ ({rarity}), {stage}, {xp} XP.',
    es: 'Mi compañero de Claude Code es un {species} brillante ({rarity}): {stage}, {xp} XP.',
    fr: 'Mon compagnon Claude Code est un {species} chromatique ({rarity}) : {stage}, {xp} XP.',
    ru: 'Мой питомец в Claude Code: шайни {species} ({rarity}), {stage}, {xp} XP.',
    zh: '我的 Claude Code 伙伴：闪光{species}（{rarity}），{stage}，{xp} XP。',
    ja: 'Claude Code の相棒はシャイニーの {species}（{rarity}）、{stage}、{xp} XP です。',
    pt: 'Meu companheiro no Claude Code: {species} brilhante ({rarity}), {stage}, {xp} XP.',
    de: 'Mein Claude-Code-Begleiter: {species}, schillernd ({rarity}), {stage}, {xp} XP.',
    ko: '내 Claude Code 버디: 빛나는 {species}({rarity}), {stage}, {xp} XP.',
  },
  postPetNone: {
    en: 'Meet your Claude Code companion.',
    he: 'הכירו את המלווה שלכם ב-Claude Code.',
    es: 'Conoce a tu compañero de Claude Code.',
    fr: 'Rencontre ton compagnon Claude Code.',
    ru: 'Познакомьтесь со своим питомцем в Claude Code.',
    zh: '来认识一下你的 Claude Code 伙伴。',
    ja: 'あなたの Claude Code の相棒に会いましょう。',
    pt: 'Conheça o seu companheiro do Claude Code.',
    de: 'Lerne deinen Claude-Code-Begleiter kennen.',
    ko: 'Claude Code 버디를 만나 보세요.',
  },
  // what each card contains (the privacy preview)
  cSavings: {
    en: 'estimated tokens and dollars saved this week, seven daily bars, the word “estimated”',
    he: 'טוקנים ודולרים שנחסכו השבוע (הערכה), שבעה עמודי ימים, המילה “הערכה”',
    es: 'tokens y dólares estimados ahorrados esta semana, siete barras diarias, la palabra “estimado”',
    fr: 'tokens et dollars économisés estimés cette semaine, sept barres quotidiennes, le mot « estimé »',
    ru: 'оценка сэкономленных токенов и долларов за неделю, семь столбцов по дням, слово «оценка»',
    zh: '本周估算节省的 token 和美元数、每日七根柱状条、“估算”一词',
    ja: '今週の推定節約トークン数とドル額、日別の棒グラフ 7 本、「推定」の文字',
    pt: 'tokens e dólares economizados estimados esta semana, sete barras diárias, a palavra “estimado”',
    de: 'geschätzte gesparte Tokens und Dollar dieser Woche, sieben Tagesbalken, das Wort „geschätzt“',
    ko: '이번 주 절약한 추정 토큰과 달러, 일별 막대 7개, “추정”이라는 단어',
  },
  cSafety: {
    en: 'the count of blocked operations this month and the count per kind',
    he: 'מספר הפעולות שנחסמו החודש ומספרן לפי סוג',
    es: 'el número de operaciones bloqueadas este mes y por tipo',
    fr: 'le nombre d’opérations bloquées ce mois-ci et par type',
    ru: 'число заблокированных операций за месяц и по видам',
    zh: '本月被拦截操作的总数及各类别的数量',
    ja: '今月ブロックした操作の件数と種類別の件数',
    pt: 'o número de operações bloqueadas este mês e por tipo',
    de: 'die Anzahl blockierter Vorgänge dieses Monats und pro Art',
    ko: '이번 달 차단된 작업 수와 유형별 수',
  },
  cAchievement: {
    en: 'the newest trophy’s icon, title and date',
    he: 'סמל, כותרת ותאריך של ההישג האחרון',
    es: 'el icono, título y fecha del último logro',
    fr: 'l’icône, le titre et la date du dernier succès',
    ru: 'значок, название и дата последнего достижения',
    zh: '最新成就的图标、标题和日期',
    ja: '最新の実績のアイコン、タイトル、日付',
    pt: 'o ícone, o título e a data da conquista mais recente',
    de: 'Symbol, Titel und Datum des neuesten Erfolgs',
    ko: '가장 최근 업적의 아이콘, 제목, 날짜',
  },
  cPet: {
    en: 'the companion’s species, rarity, stage and XP (its name is left out)',
    he: 'מין, נדירות, שלב ו-XP של המלווה (השם לא נכלל)',
    es: 'especie, rareza, etapa y XP del compañero (sin su nombre)',
    fr: 'espèce, rareté, stade et XP du compagnon (sans son nom)',
    ru: 'вид, редкость, стадия и XP питомца (без имени)',
    zh: '伙伴的物种、稀有度、阶段和 XP（不含名字）',
    ja: '相棒の種類、レア度、ステージ、XP（名前は含みません）',
    pt: 'espécie, raridade, estágio e XP do companheiro (sem o nome)',
    de: 'Art, Seltenheit, Stufe und XP des Begleiters (ohne Namen)',
    ko: '버디의 종류, 희귀도, 단계, XP(이름은 제외)',
  },
  cNever: {
    en: 'no name, path, project, prompt or file content',
    he: 'ללא שם, נתיב, פרויקט, הודעה או תוכן קבצים',
    es: 'sin nombre, ruta, proyecto, mensajes ni contenido de archivos',
    fr: 'ni nom, ni chemin, ni projet, ni message, ni contenu de fichier',
    ru: 'без имени, пути, проекта, запросов и содержимого файлов',
    zh: '不含名称、路径、项目、提示词或文件内容',
    ja: '名前、パス、プロジェクト、プロンプト、ファイルの内容は含みません',
    pt: 'sem nome, caminho, projeto, prompt nem conteúdo de arquivos',
    de: 'kein Name, Pfad, Projekt, Prompt oder Dateiinhalt',
    ko: '이름, 경로, 프로젝트, 프롬프트, 파일 내용은 포함하지 않음',
  },
  install: {
    en: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    he: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    es: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    fr: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ru: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    zh: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ja: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    pt: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    de: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ko: 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
  },
  none: { en: 'none yet', he: 'עדיין אין', es: 'aún nada', fr: 'rien encore', ru: 'пока нет', zh: '暂无', ja: 'まだなし', pt: 'nada ainda', de: 'noch keine', ko: '아직 없음' },
} as const

const SPECIES_ORDER: readonly Species[] = ['cat', 'fox', 'owl', 'octopus', 'dragon', 'axolotl', 'penguin', 'capybara', 'raccoon', 'robot', 'ghost', 'slime']
const SPECIES_NAMES: Partial<Record<Lang, readonly string[]>> & Record<'en', readonly string[]> = {
  en: ['Cat', 'Fox', 'Owl', 'Octopus', 'Dragon', 'Axolotl', 'Penguin', 'Capybara', 'Raccoon', 'Robot', 'Ghost', 'Slime'],
  he: ['חתול', 'שועל', 'ינשוף', 'תמנון', 'דרקון', 'אקסולוטל', 'פינגווין', 'קפיברה', 'דביבון', 'רובוט', 'רוח רפאים', 'סליים'],
  es: ['Gato', 'Zorro', 'Búho', 'Pulpo', 'Dragón', 'Ajolote', 'Pingüino', 'Capibara', 'Mapache', 'Robot', 'Fantasma', 'Slime'],
  fr: ['Chat', 'Renard', 'Hibou', 'Pieuvre', 'Dragon', 'Axolotl', 'Pingouin', 'Capybara', 'Raton laveur', 'Robot', 'Fantôme', 'Slime'],
  ru: ['Кот', 'Лиса', 'Сова', 'Осьминог', 'Дракон', 'Аксолотль', 'Пингвин', 'Капибара', 'Енот', 'Робот', 'Привидение', 'Слайм'],
  zh: ['猫', '狐狸', '猫头鹰', '章鱼', '龙', '美西螈', '企鹅', '水豚', '浣熊', '机器人', '幽灵', '史莱姆'],
  ja: ['ネコ', 'キツネ', 'フクロウ', 'タコ', 'ドラゴン', 'ウーパールーパー', 'ペンギン', 'カピバラ', 'アライグマ', 'ロボット', 'ゴースト', 'スライム'],
  pt: ['Gato', 'Raposa', 'Coruja', 'Polvo', 'Dragão', 'Axolote', 'Pinguim', 'Capivara', 'Guaxinim', 'Robô', 'Fantasma', 'Slime'],
  de: ['Katze', 'Fuchs', 'Eule', 'Oktopus', 'Drache', 'Axolotl', 'Pinguin', 'Wasserschwein', 'Waschbär', 'Roboter', 'Geist', 'Schleim'],
  ko: ['고양이', '여우', '부엉이', '문어', '드래곤', '아홀로틀', '펭귄', '카피바라', '너구리', '로봇', '유령', '슬라임'],
}
const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const RARITY_NAMES: Partial<Record<Lang, readonly string[]>> & Record<'en', readonly string[]> = {
  en: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'],
  he: ['נפוץ', 'לא נפוץ', 'נדיר', 'אפי', 'אגדי'],
  es: ['Común', 'Poco común', 'Raro', 'Épico', 'Legendario'],
  fr: ['Commun', 'Peu commun', 'Rare', 'Épique', 'Légendaire'],
  ru: ['Обычный', 'Необычный', 'Редкий', 'Эпический', 'Легендарный'],
  zh: ['普通', '少见', '稀有', '史诗', '传说'],
  ja: ['コモン', 'アンコモン', 'レア', 'エピック', 'レジェンダリー'],
  pt: ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário'],
  de: ['Gewöhnlich', 'Ungewöhnlich', 'Selten', 'Episch', 'Legendär'],
  ko: ['일반', '고급', '희귀', '에픽', '전설'],
}
const RARITY_COLOR: Record<Rarity, string> = { common: '#9aa3ad', uncommon: '#4cc38a', rare: '#4c8dff', epic: '#a56bff', legendary: '#ffc83d' }
const FAMILIES = ['secrets', 'destructive', 'edits', 'ci', 'injection', 'other'] as const
const FAMILY_WORD: Record<string, Tx> = {
  secrets: W.famSecrets,
  destructive: W.famDestructive,
  edits: W.famEdits,
  ci: W.famCi,
  injection: W.famInjection,
  other: W.famOther,
}

export const speciesName = (s: Species, lang: Lang): string => (SPECIES_NAMES[lang] ?? SPECIES_NAMES.en)[SPECIES_ORDER.indexOf(s)] ?? s
export const rarityName = (r: Rarity, lang: Lang): string => (RARITY_NAMES[lang] ?? RARITY_NAMES.en)[RARITY_ORDER.indexOf(r)] ?? r
const stageWord = (n: 1 | 2 | 3, lang: Lang): string => tx(n === 1 ? W.stage1 : n === 2 ? W.stage2 : W.stage3, lang)
const MOOD_WORD: Readonly<Record<PetMood, Tx>> = { idle: W.mIdle, working: W.mWorking, celebrating: W.mCelebrating, worried: W.mWorried, sleeping: W.mSleeping, guarding: W.mGuarding, chasing: W.mChasing }
const moodWord = (m: PetMood, lang: Lang): string => tx(MOOD_WORD[m], lang)

/** The pose's emblem beside the silhouette (static: cards never animate), in card coordinates; empty for the calm pose. */
function poseEmblem(m: PetMood, accent: string): string {
  switch (m) {
    case 'guarding':
      return `<g id="pose-shield" transform="translate(370 420) scale(1.6)"><path d="M0 -26L24 -17V2C24 16 13 27 0 32C-13 27 -24 16 -24 2V-17Z" fill="#4c8dff" stroke="#e2ecff" stroke-width="2.5"/><path d="M-10 2L-3 9L11 -7" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`
    case 'chasing':
      return `<g id="pose-loop">${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${Math.round(250 + 150 * Math.cos((i * Math.PI) / 3))}" cy="${Math.round(430 + 50 * Math.sin((i * Math.PI) / 3))}" r="7" fill="#ffd166" opacity="${(0.25 + i * 0.15).toFixed(2)}"/>`).join('')}</g>`
    case 'sleeping':
      return `<g id="pose-zzz" font-family="sans-serif" font-weight="700" fill="#cbd5ff"><text x="350" y="300" font-size="40">Z</text><text x="380" y="262" font-size="52">Z</text><text x="420" y="214" font-size="64">Z</text></g>`
    case 'celebrating':
      return `<g id="pose-confetti">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${110 + i * 40}" y="${150 + (i % 3) * 38}" width="12" height="18" rx="3" fill="${['#ff6b6b', '#ffd166', '#4cc38a', '#4c8dff'][i % 4]}" transform="rotate(${-30 + i * 9} ${116 + i * 40} ${159 + (i % 3) * 38})"/>`).join('')}</g>`
    case 'worried':
      return `<g id="pose-drop" transform="translate(372 300) scale(2.2)"><path d="M0 -10C5 -3 8 1 8 5A8 8 0 0 1 -8 5C-8 1 -5 -3 0 -10z" fill="#7dd3fc" stroke="#e0f2fe" stroke-width="1.2"/></g>`
    case 'working':
      return `<g id="pose-typing">${[0, 1, 2].map(i => `<circle cx="${330 + i * 30}" cy="300" r="9" fill="${accent}" opacity="${(0.35 + i * 0.3).toFixed(2)}"/>`).join('')}</g>`
    default:
      return ''
  }
}

// ---------- redaction ----------

export type RedactOpts = {
  /** Keep project folder names as they are. Default false: they become "my project". */
  allowProject?: boolean
  /** The project folder name(s) to hide. */
  project?: string
  projects?: readonly string[]
}
export type RedactReport = { text: string; paths: number; secrets: number; projects: number }

type SecretPattern = { id: string; re: RegExp }

// Same kinds, same order as pasted-secret-scan: specific shapes first, the generic one last.
const SECRET_PATTERNS: readonly SecretPattern[] = [
  { id: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/ },
  { id: 'aws', re: /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}/ },
  { id: 'github', re: /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36,}/ },
  { id: 'api-key', re: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/ },
  { id: 'slack', re: /xox[baprs]-[A-Za-z0-9-]{8,}/ },
  { id: 'google', re: /AIza[0-9A-Za-z_-]{35}/ },
  { id: 'jwt', re: /eyJ[\w-]+\.[\w-]+\.[\w-]+/ },
  { id: 'generic', re: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/i },
]

/** Whether a match is a real credential: plain words (task-management-refactoring-plan) carry no digit. */
function isRealSecret(id: string, match: string): boolean {
  if (id === 'generic') {
    const value = /[A-Za-z0-9_-]{16,}$/.exec(match)
    return value !== null && /\d/.test(value[0])
  }
  if (id === 'api-key') return /\d/.test(match)
  return true
}

const PATH_CHARS = `[^\\s\\\\/:*?"<>|'\`()\\[\\]{},;]`
const PATH_RE = new RegExp(
  `(?<![\\w:./~\\\\-])(?:[A-Za-z]:[\\\\/]|\\\\\\\\|~[\\\\/]|/)(?:${PATH_CHARS}+[\\\\/])*${PATH_CHARS}*`,
  'g',
)

/** The last segment of a path; a bare user folder (C:\Users\name, /home/name) becomes "~" so a user name never survives. */
function baseOf(segments: string[]): string {
  const last = segments[segments.length - 1] ?? ''
  const before = segments[segments.length - 2] ?? ''
  if (/^(users|home)$/i.test(before)) return '~'
  return last
}

function escapeRegex(text: string): string {
  const specials = '.*+?^{}()|[]\\' + String.fromCharCode(36)
  let out = ''
  for (const ch of text) out += specials.includes(ch) ? `\\${ch}` : ch
  return out
}

/** Redacts `text` and counts what changed (for the privacy preview). */
export function redactReport(text: string, opts: RedactOpts = {}): RedactReport {
  let out = text
  let secrets = 0
  for (const p of SECRET_PATTERNS) {
    out = out.replace(new RegExp(p.re.source, `${p.re.flags}g`), (match: string) => {
      if (!isRealSecret(p.id, match)) return match
      secrets += 1
      if (p.id === 'generic') return match.replace(/[A-Za-z0-9_-]{16,}$/, `[REDACTED ${p.id}]`)
      return `[REDACTED ${p.id}]`
    })
  }

  let paths = 0
  out = out.replace(PATH_RE, (match: string) => {
    const tail = /[.,;:!?]+$/.exec(match)?.[0] ?? ''
    const body = tail === '' ? match : match.slice(0, match.length - tail.length)
    const segments = body.split(/[\\/]+/).filter(s => s !== '')
    // A lone "/share" is a command, not a path: a path takes a directory and a name (or a drive and a name).
    if (segments.length < 2) return match
    paths += 1
    return baseOf(segments) + tail
  })

  let projects = 0
  if (opts.allowProject !== true) {
    const names = [...(opts.projects ?? []), ...(opts.project === undefined ? [] : [opts.project])].filter(n => n.trim().length >= 2)
    for (const name of new Set(names.map(n => n.trim()))) {
      const re = new RegExp(`(?<![A-Za-z0-9_-])${escapeRegex(name)}(?![A-Za-z0-9_-])`, 'gi')
      out = out.replace(re, () => {
        projects += 1
        return PROJECT_ALIAS
      })
    }
  }
  return { text: out, paths, secrets, projects }
}

/** `text` with paths cut to their basename, secrets masked and project folder names replaced by "my project". */
export function redact(text: string, opts: RedactOpts = {}): string {
  return redactReport(text, opts).text
}

// ---------- numbers ----------

function compactNum(n: number): string {
  const fix = (v: number, unit: string): string => `${v.toFixed(1).replace(/\.0$/, '')}${unit}`
  if (n >= 1e9) return fix(n / 1e9, 'B')
  if (n >= 1e6) return fix(n / 1e6, 'M')
  if (n >= 1e3) return fix(n / 1e3, 'K')
  return String(Math.round(n))
}

function usdText(usd: number): string {
  if (usd > 0 && usd < 0.01) return '<$0.01'
  if (usd >= 1000) return `$${compactNum(usd)}`
  return `$${usd.toFixed(2)}`
}

const finite = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0)

/** Safety families, nonzero, biggest first. */
function familyRows(d: SafetyData): { key: string; n: number }[] {
  const keys = [...FAMILIES, ...Object.keys(d.families).filter(k => !(FAMILIES as readonly string[]).includes(k))]
  return keys
    .map(key => ({ key, n: finite(d.families[key]) }))
    .filter(r => r.n > 0)
    .sort((a, b) => b.n - a.n)
}

const familyLabel = (key: string, lang: Lang): string => {
  const word = FAMILY_WORD[key]
  return word === undefined ? key : tx(word, lang)
}

// ---------- the cards ----------

const FONT = "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif"
const BASE = '#0d0f15'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** a*ratio + b*(1-ratio), both '#rrggbb'. */
function mix(a: string, b: string, ratio: number): string {
  if (!HEX_RE.test(a) || !HEX_RE.test(b)) return HEX_RE.test(b) ? b : BASE
  const part = (hex: string, i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  let out = '#'
  for (let i = 0; i < 3; i++) {
    const v = Math.round(part(a, i) * ratio + part(b, i) * (1 - ratio))
    out += Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  }
  return out
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Colors = { bgA: string; bgB: string; glowA: string; glowB: string; accent: string; track: string; soft: string }

function colorsOf(th: Theme): Colors {
  const accent = HEX_RE.test(th.receipt.accent) ? th.receipt.accent : '#d97757'
  return {
    bgA: mix(th.aurora.idle[0], BASE, 0.1),
    bgB: mix(th.aurora.idle[2], '#05060a', 0.14),
    glowA: th.aurora.idle[0],
    glowB: th.aurora.idle[1],
    accent,
    track: '#262b38',
    soft: mix(accent, '#262b38', 0.5),
  }
}

/** Up to two lines of at most `max` characters; the last is cut with an ellipsis. */
function wrap(text: string, max: number): string[] {
  const words = text.trim().split(/\s+/).filter(w => w !== '')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const w = [...word].length > max ? `${[...word].slice(0, max - 1).join('')}…` : word
    if (cur === '') cur = w
    else if ([...cur].length + 1 + [...w].length <= max) cur += ` ${w}`
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur !== '') lines.push(cur)
  if (lines.length <= 2) return lines
  const second = lines[1] ?? ''
  return [lines[0] ?? '', `${[...second].slice(0, Math.max(1, max - 1)).join('')}…`]
}

/** The shared frame: dark themed background, kind label top left, "Claude Code · Toolkitty" bottom right. */
function frame(th: Theme, label: string, body: string): string {
  const c = colorsOf(th)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" font-family="${FONT}">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.bgA}"/><stop offset="1" stop-color="${c.bgB}"/></linearGradient>` +
    `<radialGradient id="g1" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${c.glowA}" stop-opacity=".26"/><stop offset="1" stop-color="${c.glowA}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="g2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${c.glowB}" stop-opacity=".14"/><stop offset="1" stop-color="${c.glowB}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="1200" height="630" fill="url(#bg)"/><circle cx="1080" cy="40" r="460" fill="url(#g1)"/><circle cx="60" cy="640" r="420" fill="url(#g2)"/>` +
    `<rect x="1.5" y="1.5" width="1197" height="627" fill="none" stroke="#262b3a" stroke-width="3"/>` +
    `<g stroke="${c.accent}" stroke-width="4" stroke-linecap="round" transform="translate(76 68)"><path d="M0 -13V13M-13 0H13M-9 -9L9 9M-9 9L9 -9"/></g>` +
    `<text x="106" y="75" font-size="20" font-weight="700" letter-spacing="4" fill="#9aa4b2">${esc(label)}</text>` +
    body +
    `<text x="1140" y="596" text-anchor="end" font-size="22" font-weight="600" fill="#9aa4b2">${esc(FOOTER)}</text>` +
    `</svg>`
  )
}

const caption = (x: number, y: number, text: string, anchor = 'start'): string =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="17" font-weight="600" letter-spacing="3" fill="#8b95a5">${esc(text)}</text>`

function savingsBody(d: SavingsData, th: Theme, lang: Lang): string {
  const c = colorsOf(th)
  const days = Array.from({ length: 7 }, (_, i) => finite(d.days[d.days.length - 7 + i]))
  const top = Math.max(1, ...days)
  let out = `<text x="60" y="320" font-size="150" font-weight="800" fill="#ffffff">${esc(compactNum(finite(d.tokens)))}</text>`
  out += `<text x="64" y="372" font-size="30" font-weight="600" fill="#c4cbd6">${esc(tx(W.tokens, lang))}</text>`
  out += `<text x="60" y="462" font-size="84" font-weight="800" fill="${c.accent}">≈ ${esc(usdText(finite(d.usd)))}</text>`
  out += `<rect x="60" y="486" width="${40 + [...tx(W.estimated, lang)].length * 14}" height="36" rx="18" fill="none" stroke="${c.accent}" stroke-width="2"/>`
  out += `<text x="80" y="511" font-size="20" font-weight="700" letter-spacing="2" fill="${c.accent}">${esc(tx(W.estimated, lang))}</text>`
  out += caption(720, 150, tx(W.last7, lang))
  days.forEach((v, i) => {
    const hgt = v <= 0 ? 6 : Math.max(10, Math.round((260 * v) / top))
    const fill = v <= 0 ? c.track : i === 6 ? c.accent : c.soft
    out += `<rect x="${720 + i * 62}" y="${450 - hgt}" width="48" height="${hgt}" rx="8" fill="${fill}"/>`
  })
  out += `<line x1="720" y1="462" x2="1140" y2="462" stroke="#232836" stroke-width="2"/>`
  out += `<text x="720" y="496" font-size="20" fill="#8b95a5">${esc(tx(W.estimatedNote, lang))}</text>`
  return out
}

function safetyBody(d: SafetyData, th: Theme, lang: Lang): string {
  const c = colorsOf(th)
  const rows = familyRows(d).slice(0, 5)
  const top = Math.max(1, ...rows.map(r => r.n))
  let out = `<text x="60" y="330" font-size="170" font-weight="800" fill="#ffffff">${finite(d.total)}</text>`
  out += `<text x="64" y="388" font-size="26" font-weight="600" fill="${c.accent}">${esc(tx(W.blocked, lang))}</text>`
  out += `<text x="64" y="430" font-size="22" fill="#9aa4b2">${esc(tx(W.kSafety, lang).split(' · ')[1] ?? '')}</text>`
  rows.forEach((r, i) => {
    const y = 170 + i * 66
    const w = Math.max(10, Math.round((420 * r.n) / top))
    out += `<text x="720" y="${y}" font-size="24" font-weight="600" fill="#ffffff">${esc(familyLabel(r.key, lang))}</text>`
    out += `<text x="1140" y="${y}" text-anchor="end" font-size="22" fill="#9aa4b2">${r.n}</text>`
    out += `<rect x="720" y="${y + 12}" width="420" height="10" rx="5" fill="${c.track}"/><rect x="720" y="${y + 12}" width="${w}" height="10" rx="5" fill="${c.accent}"/>`
  })
  return out
}

function achievementBody(d: AchievementData, th: Theme, lang: Lang): string {
  const c = colorsOf(th)
  const icon = d === null ? '🏆' : d.icon === '' ? '🏆' : d.icon
  let out = `<circle cx="250" cy="320" r="130" fill="none" stroke="${d === null ? c.track : c.accent}" stroke-width="6"/>`
  out += `<circle cx="250" cy="320" r="112" fill="${mix(c.accent, BASE, 0.12)}"/>`
  out += `<text x="250" y="365" text-anchor="middle" font-size="118" opacity="${d === null ? '.35' : '1'}">${esc([...icon].slice(0, 2).join(''))}</text>`
  const title = d === null ? tx(W.noTrophy, lang) : redact(d.title)
  const lines = wrap(title, 22)
  lines.forEach((line, i) => {
    out += `<text x="450" y="${300 + i * 70}" font-size="58" font-weight="800" fill="#ffffff">${esc(line)}</text>`
  })
  const sub = d === null ? tx(W.noTrophyHint, lang) : d.date === '' ? '' : tx(W.unlocked, lang, { date: d.date })
  out += `<text x="450" y="${300 + lines.length * 70 + 4}" font-size="28" fill="${c.accent}">${esc(sub)}</text>`
  return out
}

/** A simple silhouette per species, feet at (0,0), about 140 wide and 190 tall. `c` is the body color, `d` the dark detail color. */
const SILHOUETTE: Record<Species, (c: string, d: string) => string> = {
  cat: (c, d) =>
    `<path d="M50 -28 C95 -34 100 -85 78 -92" fill="none" stroke="${c}" stroke-width="15" stroke-linecap="round"/><ellipse cx="0" cy="-55" rx="52" ry="55" fill="${c}"/><circle cx="0" cy="-118" r="38" fill="${c}"/>` +
    `<path d="M-36 -138 L-32 -182 L-8 -152 Z M36 -138 L32 -182 L8 -152 Z" fill="${c}"/><circle cx="-13" cy="-120" r="5" fill="${d}"/><circle cx="13" cy="-120" r="5" fill="${d}"/>`,
  fox: (c, d) =>
    `<ellipse cx="74" cy="-42" rx="15" ry="42" transform="rotate(35 74 -42)" fill="${c}"/><ellipse cx="0" cy="-55" rx="48" ry="55" fill="${c}"/><path d="M-42 -112 L0 -96 L42 -112 L0 -150 Z" fill="${c}"/><circle cx="0" cy="-118" r="34" fill="${c}"/>` +
    `<path d="M-40 -134 L-38 -190 L-8 -150 Z M40 -134 L38 -190 L8 -150 Z" fill="${c}"/><path d="M-12 -108 L0 -92 L12 -108 Z" fill="${d}"/><circle cx="-13" cy="-122" r="4.5" fill="${d}"/><circle cx="13" cy="-122" r="4.5" fill="${d}"/>`,
  owl: (c, d) =>
    `<ellipse cx="0" cy="-72" rx="52" ry="72" fill="${c}"/><path d="M-44 -126 L-40 -172 L-14 -140 Z M44 -126 L40 -172 L14 -140 Z" fill="${c}"/>` +
    `<circle cx="-20" cy="-108" r="17" fill="${d}"/><circle cx="20" cy="-108" r="17" fill="${d}"/><circle cx="-20" cy="-108" r="6" fill="${c}"/><circle cx="20" cy="-108" r="6" fill="${c}"/><path d="M-7 -92 L0 -78 L7 -92 Z" fill="${d}"/>`,
  octopus: (c, d) =>
    `<ellipse cx="0" cy="-100" rx="52" ry="50" fill="${c}"/><path d="M-38 -64 Q-52 -30 -70 -14 M-13 -58 Q-16 -28 -28 0 M13 -58 Q16 -28 28 0 M38 -64 Q52 -30 70 -14" fill="none" stroke="${c}" stroke-width="15" stroke-linecap="round"/>` +
    `<circle cx="-18" cy="-102" r="7" fill="${d}"/><circle cx="18" cy="-102" r="7" fill="${d}"/>`,
  dragon: (c, d) =>
    `<path d="M36 -86 L104 -150 L92 -70 Z" fill="${c}" opacity=".75"/><path d="M-36 -86 L-104 -150 L-92 -70 Z" fill="${c}" opacity=".75"/><ellipse cx="0" cy="-55" rx="48" ry="55" fill="${c}"/><circle cx="0" cy="-116" r="36" fill="${c}"/>` +
    `<path d="M-24 -142 L-34 -184 L-8 -150 Z M24 -142 L34 -184 L8 -150 Z" fill="${c}"/><path d="M52 -20 Q96 -14 100 -48" fill="none" stroke="${c}" stroke-width="14" stroke-linecap="round"/><circle cx="-13" cy="-120" r="5" fill="${d}"/><circle cx="13" cy="-120" r="5" fill="${d}"/>`,
  axolotl: (c, d) =>
    `<path d="M-46 -70 L-82 -96 M-50 -58 L-86 -62 M-46 -46 L-80 -30 M46 -70 L82 -96 M50 -58 L86 -62 M46 -46 L80 -30" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>` +
    `<ellipse cx="0" cy="-60" rx="56" ry="42" fill="${c}"/><path d="M-30 -22 Q0 20 70 -4" fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round"/><circle cx="-20" cy="-66" r="5" fill="${d}"/><circle cx="20" cy="-66" r="5" fill="${d}"/>`,
  penguin: (c, d) =>
    `<ellipse cx="0" cy="-78" rx="46" ry="78" fill="${c}"/><ellipse cx="0" cy="-66" rx="28" ry="56" fill="${d}" opacity=".35"/><circle cx="-14" cy="-120" r="5" fill="${d}"/><circle cx="14" cy="-120" r="5" fill="${d}"/><path d="M-9 -108 L0 -96 L9 -108 Z" fill="${d}"/>`,
  capybara: (c, d) =>
    `<rect x="-68" y="-76" width="136" height="76" rx="34" fill="${c}"/><ellipse cx="54" cy="-86" rx="30" ry="26" fill="${c}"/><circle cx="34" cy="-110" r="9" fill="${c}"/><circle cx="68" cy="-90" r="4" fill="${d}"/><circle cx="46" cy="-96" r="4" fill="${d}"/>`,
  raccoon: (c, d) =>
    `<path d="M44 -30 Q92 -30 98 -78" fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round"/><path d="M60 -38 L72 -26 M76 -52 L90 -44" stroke="${d}" stroke-width="5"/><ellipse cx="0" cy="-52" rx="46" ry="52" fill="${c}"/>` +
    `<ellipse cx="0" cy="-112" rx="48" ry="38" fill="${c}"/><circle cx="-34" cy="-142" r="13" fill="${c}"/><circle cx="34" cy="-142" r="13" fill="${c}"/><rect x="-46" y="-124" width="92" height="18" rx="9" fill="${d}" opacity=".6"/>`,
  robot: (c, d) =>
    `<rect x="-38" y="-62" width="76" height="62" rx="12" fill="${c}"/><rect x="-46" y="-136" width="92" height="68" rx="16" fill="${c}"/><path d="M0 -136 V-164" stroke="${c}" stroke-width="6"/><circle cx="0" cy="-168" r="8" fill="${c}"/>` +
    `<rect x="-28" y="-116" width="16" height="16" rx="3" fill="${d}"/><rect x="12" y="-116" width="16" height="16" rx="3" fill="${d}"/>`,
  ghost: (c, d) =>
    `<path d="M-48 0 V-92 A48 54 0 0 1 48 -92 V0 L32 -15 L16 0 L0 -15 L-16 0 L-32 -15 Z" fill="${c}"/><circle cx="-17" cy="-98" r="8" fill="${d}"/><circle cx="17" cy="-98" r="8" fill="${d}"/>`,
  slime: (c, d) =>
    `<path d="M-66 0 C-76 -64 -34 -126 0 -126 C34 -126 76 -64 66 0 Z" fill="${c}"/><circle cx="-18" cy="-70" r="7" fill="${d}"/><circle cx="18" cy="-70" r="7" fill="${d}"/><path d="M-30 -104 Q-16 -116 -4 -112" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".5"/>`,
}

function petBody(d: PetData, th: Theme, lang: Lang): string {
  const c = colorsOf(th)
  if (d === null) {
    let out = `<g transform="translate(250 500) scale(1.35)" opacity=".35">${SILHOUETTE.ghost('#8b95a5', BASE)}</g>`
    out += `<text x="450" y="300" font-size="58" font-weight="800" fill="#ffffff">${esc(tx(W.noPet, lang))}</text>`
    out += `<text x="450" y="350" font-size="28" fill="${c.accent}">${esc(tx(W.noPetHint, lang))}</text>`
    return out
  }
  const color = RARITY_COLOR[d.rarity]
  const scale = d.stage === 1 ? 1.35 : d.stage === 2 ? 1.46 : 1.57
  const stars = RARITY_ORDER.indexOf(d.rarity) + 1
  let out = `<ellipse cx="250" cy="508" rx="${Math.round(60 * scale)}" ry="10" fill="#000000" opacity=".3"/>`
  out += `<g transform="translate(250 504) scale(${scale})">${SILHOUETTE[d.species](color, BASE)}</g>`
  if (d.shiny) out += `<text x="360" y="200" font-size="46" fill="#ffc83d">✦</text><text x="120" y="250" font-size="30" fill="#ffc83d">✦</text>`
  const mood: PetMood = isPetMood(d.mood) ? d.mood : 'idle' // older callers may hand a pet without a pose
  out += poseEmblem(mood, c.accent)
  const name = speciesName(d.species, lang)
  out += `<text x="450" y="260" font-size="${[...name].length > 11 ? 64 : 84}" font-weight="800" fill="#ffffff">${esc(name)}</text>`
  out += `<text x="450" y="318" font-size="34" font-weight="700" fill="${color}">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}  ${esc(rarityName(d.rarity, lang))}${d.shiny ? ` · ${esc(tx(W.shiny, lang))}` : ''}</text>`
  out += `<text x="450" y="372" font-size="28" fill="#c4cbd6">${esc(tx(W.stage, lang, { n: d.stage }))} · ${esc(stageWord(d.stage, lang))} · ${esc(moodWord(mood, lang))}</text>`
  out += `<text x="450" y="486" font-size="84" font-weight="800" fill="${c.accent}">${esc(compactNum(finite(d.xp)))}</text>`
  out += `<text x="${450 + 24 + String(compactNum(finite(d.xp))).length * 46}" y="486" font-size="30" font-weight="700" letter-spacing="3" fill="#8b95a5">XP</text>`
  return out
}

/** The card as an SVG string (1200x630, under 24 KB). `lang` defaults to English. */
export function cardSvg<K extends CardKind>(kind: K, data: CardDataMap[K], theme: Theme, lang: Lang = 'en'): string {
  switch (kind) {
    case 'savings':
      return frame(theme, tx(W.kSavings, lang), savingsBody(data as SavingsData, theme, lang))
    case 'safety':
      return frame(theme, tx(W.kSafety, lang), safetyBody(data as SafetyData, theme, lang))
    case 'achievement':
      return frame(theme, tx(W.kAchievement, lang), achievementBody(data as AchievementData, theme, lang))
    default:
      return frame(theme, tx(W.kPet, lang), petBody(data as PetData, theme, lang))
  }
}

// ---------- post text ----------

/** A localized post for the card, ending with the install command and, when it is a real link, the repo URL. */
export function postText<K extends CardKind>(kind: K, data: CardDataMap[K], lang: Lang = 'en'): string {
  let body: string
  if (kind === 'savings') {
    const d = data as SavingsData
    body = tx(W.postSavings, lang, { usd: usdText(finite(d.usd)), tok: compactNum(finite(d.tokens)) })
  } else if (kind === 'safety') {
    const d = data as SafetyData
    const rows = familyRows(d)
    body =
      finite(d.total) === 0
        ? tx(W.postSafetyNone, lang)
        : tx(W.postSafetyParts, lang, { n: d.total, parts: rows.map(r => `${familyLabel(r.key, lang).toLowerCase()} ${r.n}`).join(', ') })
  } else if (kind === 'achievement') {
    const d = data as AchievementData
    body = d === null ? tx(W.postAchievementNone, lang) : tx(W.postAchievement, lang, { title: d.title, date: d.date }).replace(' ()', '')
  } else {
    const d = data as PetData
    body =
      d === null
        ? tx(W.postPetNone, lang)
        : tx(d.shiny ? W.postPetShiny : W.postPet, lang, {
            rarity: rarityName(d.rarity, lang).toLowerCase(),
            species: speciesName(d.species, lang).toLowerCase(),
            stage: stageWord(d.stage, lang),
            xp: compactNum(finite(d.xp)),
          })
  }
  const lines = [redact(body), INSTALL_CMD]
  if (!isPlaceholder(REPO_URL)) lines.push(REPO_URL)
  return lines.join('\n')
}

// ---------- the pane's helpers ----------

/** Whether the card has real data behind it. */
export function hasData<K extends CardKind>(kind: K, data: CardDataMap[K]): boolean {
  if (kind === 'savings') {
    const d = data as SavingsData
    return finite(d.tokens) > 0 || finite(d.usd) > 0
  }
  if (kind === 'safety') return finite((data as SafetyData).total) > 0
  if (kind === 'achievement') return (data as AchievementData) !== null
  return (data as PetData) !== null
}

/** The card as a few plain lines (the terminal's preview). */
export function summaryText<K extends CardKind>(kind: K, data: CardDataMap[K], lang: Lang = 'en'): string {
  if (kind === 'savings') {
    const d = data as SavingsData
    return `≈ ${compactNum(finite(d.tokens))} ${tx(W.tokens, lang)} · ≈ ${usdText(finite(d.usd))} · ${tx(W.estimated, lang)} · ${tx(W.kSavings, lang).split(' · ')[1] ?? ''}`
  }
  if (kind === 'safety') {
    const d = data as SafetyData
    const parts = familyRows(d).map(r => `${familyLabel(r.key, lang)} ${r.n}`)
    return `${finite(d.total)} ${tx(W.blocked, lang)}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`
  }
  if (kind === 'achievement') {
    const d = data as AchievementData
    return d === null ? tx(W.noTrophy, lang) : `${d.icon} ${redact(d.title)}${d.date === '' ? '' : ` · ${tx(W.unlocked, lang, { date: d.date })}`}`.trim()
  }
  const d = data as PetData
  if (d === null) return `${tx(W.noPet, lang)} · ${tx(W.noPetHint, lang)}`
  return `${speciesName(d.species, lang)} · ${rarityName(d.rarity, lang)}${d.shiny ? ` · ${tx(W.shiny, lang)}` : ''} · ${tx(W.stage, lang, { n: d.stage })} (${stageWord(d.stage, lang)}) · ${compactNum(finite(d.xp))} XP`
}

/** What the card contains, in words (the privacy preview's first half). */
export function containsText(kind: CardKind, lang: Lang = 'en'): string {
  const word = kind === 'savings' ? W.cSavings : kind === 'safety' ? W.cSafety : kind === 'achievement' ? W.cAchievement : W.cPet
  return `${tx(word, lang)}; ${FOOTER}; ${tx(W.cNever, lang)}`
}

// ---------- building card data from Toolkitty's stores (pure) ----------

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** YYYY-MM-DD in local time: the same key savings.tsx and week-heatmap.tsx use. */
export function dayKeyOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const DAY_MS = 86_400_000

/** `savings:days` ({ 'YYYY-MM-DD': { tokens, usd } }) as the week's card data. */
export function savingsFromDays(raw: unknown, nowMs: number): SavingsData {
  const days: Record<string, unknown> = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  let tokens = 0
  let usd = 0
  const perDay: number[] = []
  for (let i = 6; i >= 0; i--) {
    const entry = days[dayKeyOf(nowMs - i * DAY_MS)]
    const o = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
    const t = finite(o['tokens'])
    tokens += t
    usd += finite(o['usd'])
    perDay.push(t)
  }
  return { tokens, usd, days: perDay }
}

const SECRET_KINDS = ['secret-file', 'pasted-secret', 'commit-secret']
const DESTRUCTIVE_KINDS = ['dangerous-command', 'blast-radius']
const EDIT_KINDS = ['branch-lock', 'scope']
const MONTH_MS = 30 * DAY_MS

/** `incidents:<cwd>` ({ items: [{ at, kind }] }) as this month's card data. */
export function safetyFromIncidents(raw: unknown, nowMs: number): SafetyData {
  const items = typeof raw === 'object' && raw !== null && Array.isArray((raw as { items?: unknown }).items) ? ((raw as { items: unknown[] }).items) : []
  const families: Record<string, number> = {}
  let total = 0
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    if (typeof o['at'] !== 'number' || nowMs - o['at'] > MONTH_MS) continue
    const kind = typeof o['kind'] === 'string' ? o['kind'] : ''
    const family = SECRET_KINDS.includes(kind)
      ? 'secrets'
      : DESTRUCTIVE_KINDS.includes(kind)
        ? 'destructive'
        : EDIT_KINDS.includes(kind)
          ? 'edits'
          : kind === 'ci-red'
            ? 'ci'
            : kind === 'injection'
              ? 'injection'
              : 'other'
    families[family] = (families[family] ?? 0) + 1
    total += 1
  }
  return { total, families }
}

/** An achievement's catalog entry (from features/achievements.tsx), already localized: the title and icon of an id. */
export type AchievementDef = { id: string; icon: string; title: string }

/**
 * The newest entry of `achievements:unlocked`. The real format (written by features/achievements.tsx) is a
 * record `{ [id]: unlockedAtMs }`; `defs` supplies each id's icon and title. Without a definition (an id the
 * catalog no longer has) the id itself is the title. Other shapes are still read defensively: an array of ids,
 * of { id, title|name, icon, at|ts|unlockedAt|time } objects, or a record id -> object.
 * Null when there is none.
 */
export function latestAchievement(raw: unknown, defs: readonly AchievementDef[] = []): AchievementData {
  const entries: { key: string; value: unknown }[] = []
  if (Array.isArray(raw)) raw.forEach((value, i) => entries.push({ key: typeof value === 'string' ? value : String(i), value }))
  else if (typeof raw === 'object' && raw !== null) for (const key of Object.keys(raw)) entries.push({ key, value: (raw as Record<string, unknown>)[key] })
  let best: { at: number; icon: string; title: string } | null = null
  for (const entry of entries) {
    const v = entry.value
    let at = 0
    // An id (not a written title) reads better with spaces: first-commit -> first commit.
    let title = (typeof v === 'string' ? v : entry.key).replace(/^([a-z0-9]+)([-_][a-z0-9]+)+$/, m => m.replace(/[-_]+/g, ' '))
    let icon = ''
    if (typeof v === 'number') at = v
    else if (typeof v === 'object' && v !== null) {
      const o = v as Record<string, unknown>
      for (const k of ['at', 'ts', 'unlockedAt', 'time', 'date']) {
        const val = o[k]
        if (typeof val === 'number') at = val
        else if (typeof val === 'string' && Number.isFinite(Date.parse(val))) at = Date.parse(val)
        if (at > 0) break
      }
      const name = o['title'] ?? o['name'] ?? o['id']
      if (typeof name === 'string' && name.trim() !== '') title = name
      else if (typeof name === 'object' && name !== null && typeof (name as Record<string, unknown>)['en'] === 'string') title = (name as Record<string, string>)['en'] ?? title
      if (typeof o['icon'] === 'string') icon = o['icon']
    }
    const def = defs.find(d => d.id === entry.key)
    if (def !== undefined) {
      title = def.title
      if (icon === '') icon = def.icon
    }
    // later entries win ties: the newest is last in an append-only list
    if (best === null || at >= best.at) best = { at, icon, title }
  }
  const found = best as { at: number; icon: string; title: string } | null
  if (found === null) return null
  return { icon: found.icon, title: found.title.trim().slice(0, 80), date: found.at > 0 ? dayKeyOf(found.at) : '' }
}

// ---------- the companion (the seed -> species/rarity mapping of buddy.tsx, replicated) ----------

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = s
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** The same seed always gives the same species, rarity and shininess (identical to buddy.tsx). */
export function rollPet(seed: number): { species: Species; rarity: Rarity; shiny: boolean } {
  const r = rng(seed)
  const species = SPECIES_ORDER[Math.floor(r() * SPECIES_ORDER.length)] ?? 'cat'
  const q = r() * 100
  const rarity: Rarity = q < 60 ? 'common' : q < 85 ? 'uncommon' : q < 95 ? 'rare' : q < 99 ? 'epic' : 'legendary'
  const shiny = r() < 0.01
  return { species, rarity, shiny }
}

/** Pet card data from `buddy:seed`, `buddy:stage`, the minutes worked and `buddy:mood` (calm when unknown); null when there is no seed. */
export function petFromStore(seed: unknown, stage: unknown, minutes: number, mood?: unknown): PetData {
  if (typeof seed !== 'number' || !Number.isFinite(seed) || seed <= 0) return null
  const st = stage === 3 ? 3 : stage === 2 ? 2 : 1
  return { ...rollPet(seed), stage: st, xp: Math.max(0, Math.round(minutes)), mood: isPetMood(mood) ? mood : 'idle' }
}

/** Minutes worked, summed over `week-heatmap:days` ({ key: { ms } }). */
export function minutesWorked(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null) return 0
  let ms = 0
  for (const key of Object.keys(raw)) {
    const d = (raw as Record<string, unknown>)[key]
    if (typeof d === 'object' && d !== null) ms += finite((d as Record<string, unknown>)['ms'])
  }
  return Math.round(ms / 60_000)
}
