import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderSurface, Timer } from 'claude-code'

import { LANGS, isOn, notice, storeGet, storeSet, t } from '../core'
import type { BandInput, Feature, Input, Localized } from '../core'
import { allEvidence } from '../evidence'
import { current, ofKind } from '../signals'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip } from '../ui'
import { isSoundOn } from './sounds'

/*
 * Achievements: a small framework of trophies earned by VERIFIED facts only (test runs that passed,
 * incidents a guard prevented, tokens kept out of the context, days of use, switches the person made).
 * Nothing here rewards spending tokens, running more turns than needed, or unsafe behaviour: every
 * definition reads a fact that is good for the person, never a raw amount of activity or cost.
 *
 * `facts` is a plain object assembled each turn; an `Achievement.check` is a pure function of it.
 * Unlocks are kept in the store ('achievements:unlocked': { id: at }) and happen exactly once.
 */

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Achievements', he: 'הישגים', es: 'Logros', fr: 'Succès', ru: 'Достижения', zh: '成就', ja: '実績', pt: 'Conquistas', de: 'Erfolge', ko: '업적' },
  description: {
    en: 'Trophies earned by verified results: passing tests, disasters prevented, tokens saved, days of use. Never for spending or risky behaviour.',
    he: 'גביעים על תוצאות מאומתות: בדיקות שעברו, אסונות שנמנעו, טוקנים שנחסכו, ימי שימוש. אף פעם לא על בזבוז או התנהגות מסוכנת.',
    es: 'Trofeos por resultados verificados: pruebas superadas, desastres evitados, tokens ahorrados, días de uso. Nunca por gastar ni por conductas de riesgo.',
    fr: 'Des trophées pour des résultats vérifiés : tests réussis, désastres évités, tokens économisés, jours d’utilisation. Jamais pour dépenser ou pour un comportement risqué.',
    ru: 'Трофеи за проверенные результаты: пройденные тесты, предотвращённые катастрофы, сэкономленные токены, дни работы. Никогда за траты или рискованное поведение.',
    zh: '凭已验证的成果获得的奖杯：测试通过、避免灾难、节省 token、使用天数。绝不因花费或冒险行为而获得。',
    ja: '検証済みの成果で獲得するトロフィー: テスト合格、災害の防止、トークンの節約、利用日数。支出や危険な行動では決して獲得できません。',
    pt: 'Troféus conquistados por resultados verificados: testes aprovados, desastres evitados, tokens economizados, dias de uso. Nunca por gastos ou comportamento arriscado.',
    de: 'Trophäen für überprüfte Ergebnisse: bestandene Tests, verhinderte Katastrophen, gesparte Tokens, Nutzungstage. Nie für Ausgaben oder riskantes Verhalten.',
    ko: '검증된 결과로 얻는 트로피: 통과한 테스트, 막아낸 사고, 절약한 토큰, 사용 일수. 지출이나 위험한 행동으로는 절대 얻을 수 없습니다.',
  },
  cmdDesc: { en: 'Shows your trophies', he: 'מציג את הגביעים שלך', es: 'Muestra tus trofeos', fr: 'Affiche tes trophées', ru: 'Показывает ваши трофеи', zh: '显示你的奖杯', ja: 'トロフィーを表示します', pt: 'Mostra seus troféus', de: 'Zeigt deine Trophäen', ko: '내 트로피를 보여 줍니다' },
  off: {
    en: 'Achievements is off; turn it on in the /toolkitty pane',
    he: 'ההישגים כבויים; הפעל אותם בלוח /toolkitty',
    es: 'Logros está desactivado; actívalo en el panel /toolkitty',
    fr: 'Succès est désactivé ; activez-le dans le panneau /toolkitty',
    ru: 'Достижения отключены; включите их в панели /toolkitty',
    zh: '成就已关闭；请在 /toolkitty 面板中开启',
    ja: '実績はオフです。/toolkitty ペインでオンにしてください',
    pt: 'As conquistas estão desativadas; ative-as no painel /toolkitty',
    de: 'Erfolge sind aus; aktiviere sie im Panel /toolkitty',
    ko: '업적이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  opened: { en: 'Opened your trophies.', he: 'הגביעים שלך נפתחו.', es: 'Tus trofeos están abiertos.', fr: 'Tes trophées sont ouverts.', ru: 'Ваши трофеи открыты.', zh: '已打开你的奖杯。', ja: 'トロフィーを開きました。', pt: 'Seus troféus foram abertos.', de: 'Deine Trophäen wurden geöffnet.', ko: '트로피를 열었습니다.' },
  paneTitle: { en: 'Achievements', he: 'הישגים', es: 'Logros', fr: 'Succès', ru: 'Достижения', zh: '成就', ja: '実績', pt: 'Conquistas', de: 'Erfolge', ko: '업적' },
  count: { en: '{n} / {total}', he: '{n} / {total}', es: '{n} / {total}', fr: '{n} / {total}', ru: '{n} / {total}', zh: '{n} / {total}', ja: '{n} / {total}', pt: '{n} / {total}', de: '{n} / {total}', ko: '{n} / {total}' },
  unlockedTitle: { en: 'Unlocked', he: 'נפתחו', es: 'Desbloqueados', fr: 'Débloqués', ru: 'Открыто', zh: '已解锁', ja: '獲得済み', pt: 'Desbloqueadas', de: 'Freigeschaltet', ko: '달성' },
  lockedTitle: { en: 'Locked', he: 'נעולים', es: 'Bloqueados', fr: 'Verrouillés', ru: 'Закрыто', zh: '未解锁', ja: '未獲得', pt: 'Bloqueadas', de: 'Gesperrt', ko: '미달성' },
  noneYet: { en: 'No trophies yet.', he: 'עדיין אין גביעים.', es: 'Aún no hay trofeos.', fr: 'Aucun trophée pour le moment.', ru: 'Трофеев пока нет.', zh: '还没有奖杯。', ja: 'トロフィーはまだありません。', pt: 'Nenhum troféu ainda.', de: 'Noch keine Trophäen.', ko: '아직 트로피가 없습니다.' },
  noneHint: {
    en: 'Pass tests, let a guard stop a disaster or save tokens: they are earned by results, never by spending.',
    he: 'עברו בדיקות, תנו לשומר סף לעצור אסון או חסכו טוקנים: מרוויחים אותם בתוצאות, לא בבזבוז.',
    es: 'Supera pruebas, deja que una protección frene un desastre o ahorra tokens: se ganan con resultados, nunca gastando.',
    fr: 'Réussis des tests, laisse une protection arrêter un désastre ou économise des tokens : on les gagne par les résultats, jamais en dépensant.',
    ru: 'Проходите тесты, дайте защите остановить катастрофу или экономьте токены: трофеи даются за результат, а не за траты.',
    zh: '通过测试、让防护拦下一次灾难或节省 token：奖杯凭成果获得，绝不因花费。',
    ja: 'テストに合格する、ガードに災害を止めさせる、トークンを節約する。トロフィーは成果で獲得するもので、支出では獲得できません。',
    pt: 'Passe em testes, deixe uma proteção impedir um desastre ou economize tokens: os troféus vêm de resultados, nunca de gastos.',
    de: 'Bestehe Tests, lass einen Guard eine Katastrophe verhindern oder spare Tokens: Trophäen gibt es für Ergebnisse, nie für Ausgaben.',
    ko: '테스트를 통과하거나, 가드가 사고를 막게 하거나, 토큰을 절약하세요. 트로피는 결과로 얻으며 지출로는 얻을 수 없습니다.',
  },
  unlocked: { en: '🏆 Achievement unlocked: {title}', he: '🏆 הישג נפתח: {title}', es: '🏆 Logro desbloqueado: {title}', fr: '🏆 Succès débloqué : {title}', ru: '🏆 Достижение открыто: {title}', zh: '🏆 成就解锁：{title}', ja: '🏆 実績を獲得: {title}', pt: '🏆 Conquista desbloqueada: {title}', de: '🏆 Erfolg freigeschaltet: {title}', ko: '🏆 업적 달성: {title}' },
  chip: { en: '🏆 {n}', he: '🏆 {n}', es: '🏆 {n}', fr: '🏆 {n}', ru: '🏆 {n}', zh: '🏆 {n}', ja: '🏆 {n}', pt: '🏆 {n}', de: '🏆 {n}', ko: '🏆 {n}' },
  share: { en: 'share', he: 'שתף', es: 'compartir', fr: 'partager', ru: 'поделиться', zh: '分享', ja: '共有', pt: 'compartilhar', de: 'teilen', ko: '공유' },
  shareText: {
    en: '🏆 I just unlocked “{title}” in Claude Code ({n}/{total} trophies). Get yours: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    he: '🏆 הרגע פתחתי את “{title}” ב-Claude Code ({n}/{total} גביעים). קבלו גם אתם: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    es: '🏆 Acabo de desbloquear “{title}” en Claude Code ({n}/{total} trofeos). Consigue los tuyos: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    fr: '🏆 Je viens de débloquer « {title} » dans Claude Code ({n}/{total} trophées). Prends les tiens : claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ru: '🏆 Я только что открыл «{title}» в Claude Code (трофеев: {n}/{total}). Получите свои: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    zh: '🏆 我刚在 Claude Code 中解锁了“{title}”（{n}/{total} 个奖杯）。你也来试试：claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ja: '🏆 Claude Code で「{title}」を獲得しました（トロフィー {n}/{total}）。あなたも: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    pt: '🏆 Acabei de desbloquear “{title}” no Claude Code ({n}/{total} troféus). Instale o seu: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    de: '🏆 Ich habe gerade „{title}“ in Claude Code freigeschaltet ({n}/{total} Trophäen). Hol dir deins: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ko: '🏆 Claude Code에서 “{title}” 달성! (트로피 {n}/{total}) 직접 해 보세요: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
  },
  shareNothing: { en: 'Nothing to share yet', he: 'עדיין אין מה לשתף', es: 'Aún no hay nada que compartir', fr: 'Rien à partager pour le moment', ru: 'Пока нечем делиться', zh: '暂无可分享的内容', ja: '共有できるものはまだありません', pt: 'Nada para compartilhar ainda', de: 'Noch nichts zu teilen', ko: '아직 공유할 내용이 없습니다' },
  copied: { en: 'Share text copied', he: 'טקסט השיתוף הועתק', es: 'Texto para compartir copiado', fr: 'Texte à partager copié', ru: 'Текст скопирован', zh: '分享文本已复制', ja: '共有用テキストをコピーしました', pt: 'Texto de compartilhamento copiado', de: 'Text zum Teilen kopiert', ko: '공유 문구를 복사했습니다' },
  copyFailed: { en: 'Could not copy', he: 'ההעתקה נכשלה', es: 'No se pudo copiar', fr: 'Copie impossible', ru: 'Не удалось скопировать', zh: '无法复制', ja: 'コピーできませんでした', pt: 'Não foi possível copiar', de: 'Kopieren fehlgeschlagen', ko: '복사할 수 없습니다' },
  common: { en: 'common', he: 'נפוץ', es: 'común', fr: 'commun', ru: 'обычное', zh: '普通', ja: 'コモン', pt: 'comum', de: 'gewöhnlich', ko: '일반' },
  rare: { en: 'rare', he: 'נדיר', es: 'raro', fr: 'rare', ru: 'редкое', zh: '稀有', ja: 'レア', pt: 'raro', de: 'selten', ko: '희귀' },
  epic: { en: 'epic', he: 'אפי', es: 'épico', fr: 'épique', ru: 'эпическое', zh: '史诗', ja: 'エピック', pt: 'épico', de: 'episch', ko: '영웅' },
} as const

export type Rarity = 'common' | 'rare' | 'epic'

/** What the checks look at: plain data, assembled each turn from evidence, signals, stores and the switchboard. */
export type Facts = {
  /** Local hour (0-23) of the turn that just ended, or null when not assembled at a turn's end. */
  turnHour: number | null
  /** Passed test runs in the session's evidence log. */
  testsPassed: number
  /** The longest run of passed test runs in a row in that log. */
  testStreak: number
  /** A test that failed and later passed on the same command or file. */
  bugFixed: boolean
  /** Incidents prevented: the larger of the live signal and the project's stored count. */
  incidents: number
  /** Tokens kept out of the context, all time: the larger of the stored days' total and the live signal. */
  savedTokens: number
  /** Consecutive active days ending today (today counts at a turn's end) or yesterday. */
  activeStreak: number
  /** Distinct days with a turn. */
  activeDays: number
  /** Hours worked, from the heatmap's days. */
  hours: number
  /** The stored language code ('en' until the person switches). */
  language: string
  /** The applied profile name, or ''. */
  profile: string
  /** Features switched on / off explicitly in the switchboard. */
  enabledCount: number
  disabledCount: number
}

export type Achievement = {
  id: string
  title: Localized
  /** How to earn it, one line (shown on the locked shelf). */
  body: Localized
  icon: string
  rarity: Rarity
  check: (facts: Facts) => boolean
}

/** The switchboard stores an entry per feature once "all on" is used; the catalog has at least this many. */
const FULL_DECK_MIN = 72

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-save',
    title: { en: 'First Save', he: 'ההצלה הראשונה', es: 'Primer rescate', fr: 'Premier sauvetage', ru: 'Первое спасение', zh: '首次拯救', ja: '初めての救出', pt: 'Primeiro Resgate', de: 'Erste Rettung', ko: '첫 구출' },
    body: { en: 'Let a guard stop your first disaster.', he: 'תנו לשומר סף לעצור את האסון הראשון שלכם.', es: 'Deja que una protección frene tu primer desastre.', fr: 'Laisse une protection arrêter ton premier désastre.', ru: 'Пусть защита остановит вашу первую катастрофу.', zh: '让防护拦下你的第一次灾难。', ja: 'ガードに初めての災害を止めさせましょう。', pt: 'Deixe uma proteção impedir seu primeiro desastre.', de: 'Lass einen Guard deine erste Katastrophe verhindern.', ko: '가드가 첫 번째 사고를 막게 하세요.' },
    icon: '🛟',
    rarity: 'common',
    check: f => f.incidents >= 1,
  },
  {
    id: 'safety-guardian',
    title: { en: 'Safety Guardian', he: 'שומר הבטיחות', es: 'Guardián de seguridad', fr: 'Gardien de la sécurité', ru: 'Страж безопасности', zh: '安全守护者', ja: '安全の守護者', pt: 'Guardião da Segurança', de: 'Sicherheitswächter', ko: '안전 수호자' },
    body: { en: 'Have the guards stop 100 disasters.', he: 'תנו לשומרי הסף לעצור 100 אסונות.', es: 'Deja que las protecciones frenen 100 desastres.', fr: 'Laisse les protections arrêter 100 désastres.', ru: 'Пусть защита остановит 100 катастроф.', zh: '让防护拦下 100 次灾难。', ja: 'ガードに100回の災害を止めさせましょう。', pt: 'Faça as proteções impedirem 100 desastres.', de: 'Lass die Guards 100 Katastrophen verhindern.', ko: '가드가 사고를 100번 막게 하세요.' },
    icon: '🛡',
    rarity: 'epic',
    check: f => f.incidents >= 100,
  },
  {
    id: 'green-streak',
    title: { en: 'Green Streak', he: 'רצף ירוק', es: 'Racha verde', fr: 'Série verte', ru: 'Зелёная серия', zh: '连续绿灯', ja: 'グリーン連続', pt: 'Sequência Verde', de: 'Grüne Serie', ko: '연속 그린' },
    body: { en: 'Get 10 passing test runs in a row.', he: 'השיגו 10 הרצות בדיקות שעברו ברצף.', es: 'Consigue 10 ejecuciones de pruebas superadas seguidas.', fr: 'Enchaîne 10 exécutions de tests réussies.', ru: 'Получите 10 успешных прогонов тестов подряд.', zh: '连续 10 次测试运行通过。', ja: 'テスト実行を10回連続で成功させましょう。', pt: 'Passe em 10 execuções de testes seguidas.', de: 'Bestehe 10 Testläufe in Folge.', ko: '테스트를 10번 연속 통과하세요.' },
    icon: '🟢',
    rarity: 'rare',
    check: f => f.testStreak >= 10,
  },
  {
    id: 'bug-hunter',
    title: { en: 'Bug Hunter', he: 'צייד באגים', es: 'Cazador de bugs', fr: 'Chasseur de bugs', ru: 'Охотник за багами', zh: '漏洞猎人', ja: 'バグハンター', pt: 'Caçador de Bugs', de: 'Bug-Jäger', ko: '버그 사냥꾼' },
    body: { en: 'Turn a failing test green: it fails, then passes.', he: 'הפכו בדיקה כושלת לירוקה: היא נכשלת ואז עוברת.', es: 'Pon en verde una prueba que falla: primero falla y luego pasa.', fr: 'Fais passer un test au vert : il échoue, puis réussit.', ru: 'Почините падающий тест: сначала он падает, потом проходит.', zh: '把失败的测试变绿：先失败，后通过。', ja: '失敗していたテストを成功に変えましょう。失敗してから成功するまで。', pt: 'Faça um teste que falha passar: ele falha e depois passa.', de: 'Bring einen fehlschlagenden Test zum Laufen: erst rot, dann grün.', ko: '실패하던 테스트를 통과시키세요. 먼저 실패하고 이후 통과해야 합니다.' },
    icon: '🐞',
    rarity: 'rare',
    check: f => f.bugFixed,
  },
  {
    id: 'context-ninja',
    title: { en: 'Context Ninja', he: 'נינג׳ה ההקשר', es: 'Ninja del contexto', fr: 'Ninja du contexte', ru: 'Ниндзя контекста', zh: '上下文忍者', ja: 'コンテキスト忍者', pt: 'Ninja do Contexto', de: 'Kontext-Ninja', ko: '컨텍스트 닌자' },
    body: { en: 'Keep 100k tokens out of the context, all time.', he: 'הרחיקו 100k טוקנים מההקשר, בסך הכול.', es: 'Mantén 100k tokens fuera del contexto, en total.', fr: 'Garde 100k tokens hors du contexte, au total.', ru: 'Не пустите в контекст 100k токенов за всё время.', zh: '累计让 10 万 token 不进入上下文。', ja: '累計10万トークンをコンテキストに入れずに済ませましょう。', pt: 'Mantenha 100 mil tokens fora do contexto, no total.', de: 'Halte insgesamt 100k Tokens aus dem Kontext fern.', ko: '누적 10만 토큰을 컨텍스트 밖에 두세요.' },
    icon: '🥷',
    rarity: 'rare',
    check: f => f.savedTokens >= 100_000,
  },
  {
    id: 'marathon',
    title: { en: 'Marathon', he: 'מרתון', es: 'Maratón', fr: 'Marathon', ru: 'Марафон', zh: '马拉松', ja: 'マラソン', pt: 'Maratona', de: 'Marathon', ko: '마라톤' },
    body: { en: 'Work five days in a row.', he: 'עבדו חמישה ימים ברציפות.', es: 'Trabaja cinco días seguidos.', fr: 'Travaille cinq jours d’affilée.', ru: 'Работайте пять дней подряд.', zh: '连续工作五天。', ja: '5日連続で作業しましょう。', pt: 'Trabalhe cinco dias seguidos.', de: 'Arbeite fünf Tage in Folge.', ko: '5일 연속으로 작업하세요.' },
    icon: '🏃',
    rarity: 'rare',
    check: f => f.activeStreak >= 5,
  },
  {
    id: 'night-owl',
    title: { en: 'Night Owl', he: 'ינשוף לילה', es: 'Búho nocturno', fr: 'Oiseau de nuit', ru: 'Ночная сова', zh: '夜猫子', ja: '夜更かし', pt: 'Coruja Noturna', de: 'Nachteule', ko: '올빼미' },
    body: { en: 'Finish a turn between midnight and 5 am.', he: 'סיימו תור בין חצות ל-5 בבוקר.', es: 'Termina un turno entre la medianoche y las 5 de la mañana.', fr: 'Termine un tour entre minuit et 5 h du matin.', ru: 'Завершите ход между полуночью и 5 утра.', zh: '在午夜到凌晨 5 点之间完成一轮对话。', ja: '午前0時から5時の間に1ターンを終えましょう。', pt: 'Termine um turno entre meia-noite e 5h.', de: 'Beende einen Durchgang zwischen Mitternacht und 5 Uhr.', ko: '자정부터 새벽 5시 사이에 한 턴을 마치세요.' },
    icon: '🦉',
    rarity: 'common',
    check: f => f.turnHour !== null && f.turnHour < 5,
  },
  {
    id: 'early-bird',
    title: { en: 'Early Bird', he: 'ציפור השחר', es: 'Madrugador', fr: 'Lève-tôt', ru: 'Ранняя пташка', zh: '早起鸟', ja: '早起き', pt: 'Madrugador', de: 'Frühaufsteher', ko: '일찍 일어나는 새' },
    body: { en: 'Finish a turn between 5 and 7 am.', he: 'סיימו תור בין 5 ל-7 בבוקר.', es: 'Termina un turno entre las 5 y las 7 de la mañana.', fr: 'Termine un tour entre 5 h et 7 h du matin.', ru: 'Завершите ход между 5 и 7 утра.', zh: '在凌晨 5 点到 7 点之间完成一轮对话。', ja: '午前5時から7時の間に1ターンを終えましょう。', pt: 'Termine um turno entre 5h e 7h.', de: 'Beende einen Durchgang zwischen 5 und 7 Uhr.', ko: '새벽 5시부터 7시 사이에 한 턴을 마치세요.' },
    icon: '🐦',
    rarity: 'common',
    check: f => f.turnHour !== null && f.turnHour >= 5 && f.turnHour < 7,
  },
  {
    id: 'polyglot',
    title: { en: 'Polyglot', he: 'פוליגלוט', es: 'Políglota', fr: 'Polyglotte', ru: 'Полиглот', zh: '多语者', ja: '多言語使い', pt: 'Poliglota', de: 'Polyglott', ko: '다국어 사용자' },
    body: { en: 'Switch Toolkitty to another language.', he: 'החליפו את ה-Toolkitty לשפה אחרת.', es: 'Cambia el toolkitty a otro idioma.', fr: 'Passe le toolkitty dans une autre langue.', ru: 'Переключите Toolkitty на другой язык.', zh: '把 Toolkitty 切换到另一种语言。', ja: 'Toolkitty を別の言語に切り替えましょう。', pt: 'Troque o Toolkitty para outro idioma.', de: 'Stelle das Toolkitty auf eine andere Sprache um.', ko: 'Toolkitty을 다른 언어로 바꾸세요.' },
    icon: '🌍',
    rarity: 'common',
    check: f => f.language !== 'en' && (LANGS as readonly string[]).includes(f.language),
  },
  {
    id: 'full-deck',
    title: { en: 'Full Deck', he: 'חפיסה מלאה', es: 'Baraja completa', fr: 'Jeu complet', ru: 'Полная колода', zh: '满牌', ja: 'フルデッキ', pt: 'Baralho Completo', de: 'Volles Deck', ko: '풀 덱' },
    body: { en: 'Turn every feature on.', he: 'הפעילו את כל השכלולים.', es: 'Activa todas las funciones.', fr: 'Active toutes les fonctionnalités.', ru: 'Включите все функции.', zh: '开启所有功能。', ja: 'すべての機能をオンにしましょう。', pt: 'Ative todos os recursos.', de: 'Schalte alle Funktionen ein.', ko: '모든 기능을 켜세요.' },
    icon: '🃏',
    rarity: 'epic',
    check: f => f.disabledCount === 0 && f.enabledCount >= FULL_DECK_MIN,
  },
  {
    id: 'minimalist',
    title: { en: 'Minimalist', he: 'מינימליסט', es: 'Minimalista', fr: 'Minimaliste', ru: 'Минималист', zh: '极简主义者', ja: 'ミニマリスト', pt: 'Minimalista', de: 'Minimalist', ko: '미니멀리스트' },
    body: { en: 'Apply the Minimal profile.', he: 'החילו את הפרופיל המינימלי.', es: 'Aplica el perfil Mínimo.', fr: 'Applique le profil Minimal.', ru: 'Примените профиль «Минимальный».', zh: '应用“极简”配置。', ja: 'Minimal プロファイルを適用しましょう。', pt: 'Aplique o perfil Mínimo.', de: 'Wende das Profil „Minimal“ an.', ko: '최소(Minimal) 프로필을 적용하세요.' },
    icon: '◻',
    rarity: 'common',
    check: f => f.profile === 'minimal',
  },
  {
    id: 'week-one',
    title: { en: 'Week One', he: 'שבוע ראשון', es: 'Primera semana', fr: 'Première semaine', ru: 'Первая неделя', zh: '第一周', ja: '最初の1週間', pt: 'Primeira Semana', de: 'Erste Woche', ko: '첫 주' },
    body: { en: 'Use Claude Code on 7 different days.', he: 'השתמשו ב-Claude Code ב-7 ימים שונים.', es: 'Usa Claude Code en 7 días distintos.', fr: 'Utilise Claude Code pendant 7 jours différents.', ru: 'Работайте в Claude Code в 7 разных дней.', zh: '在 7 个不同的日子使用 Claude Code。', ja: '7日間、異なる日に Claude Code を使いましょう。', pt: 'Use o Claude Code em 7 dias diferentes.', de: 'Nutze Claude Code an 7 verschiedenen Tagen.', ko: '서로 다른 7일 동안 Claude Code를 사용하세요.' },
    icon: '📅',
    rarity: 'common',
    check: f => f.activeDays >= 7,
  },
]

type State = { unlocked: Record<string, number>; flashUntil: number }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'achievements' } as const, { unlocked: {}, flashUntil: 0 } as State) as unknown as Atom<State>

// The shared switchboard slot, the same ref as in core.ts and register.tsx.
const enabled = atom({ plugin: 'toolkitty', key: 'enabled' } as const, {} as Record<string, boolean>) as unknown as Atom<Record<string, boolean>>

export const feature: Feature = {
  id: 'achievements',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const PANE = 'achievements'
const FLASH_MS = 10_000
const SOUND = 'sounds/buddy.wav'
const UNLOCKED_KEY = 'achievements:unlocked'

let flashTimer: Timer | undefined
/** True while a check runs, so two overlapping checks cannot unlock (and announce) the same trophy twice. */
let isChecking = false

const rarityName = (r: Rarity): string => t(T[r])

// ---------- facts ----------

type Day = { turns?: number; ms?: number; tokens?: number }

const pad2 = (n: number): string => String(n).padStart(2, '0')

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function shift(ms: number, days: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12).getTime()
}

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0)

const fieldOf = (value: unknown, key: string): unknown => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined)

/** Consecutive active days ending today, or yesterday when today has no turn yet; today counts when `todayCounts`. */
function streakOf(days: Record<string, Day>, today: number, todayCounts: boolean): number {
  const todayKey = dayKey(today)
  const isActive = (ms: number): boolean => (dayKey(ms) === todayKey && todayCounts) || num(days[dayKey(ms)]?.turns) > 0
  let cursor = isActive(today) ? today : shift(today, -1)
  let run = 0
  while (run < 400 && isActive(cursor)) {
    run++
    cursor = shift(cursor, -1)
  }
  return run
}

async function gather($: EngineInterface, isTurn: boolean): Promise<Facts> {
  const now = await $.clock.now()

  // evidence: the session's test runs
  let testsPassed = 0
  let run = 0
  let testStreak = 0
  let bugFixed = false
  const failed = new Set<string>()
  for (const x of await allEvidence($)) {
    if (x.kind !== 'test') continue
    if (x.ok) {
      testsPassed++
      run++
      testStreak = Math.max(testStreak, run)
      if (failed.has(x.ref)) bugFixed = true
    } else {
      run = 0
      failed.add(x.ref)
    }
  }

  // signals: the live incident count and savings
  const live = await current($, now)
  let sigIncidents = 0
  for (const s of ofKind(live, 'incident')) sigIncidents = Math.max(sigIncidents, num(s.value))
  let sigTokens = 0
  for (const s of ofKind(live, 'saving')) sigTokens = Math.max(sigTokens, num(s.value))

  // stores: this project's incident count, the saved tokens by day, the heatmap's days
  const cwd = await $.session.cwd()
  const storedIncidents = num(fieldOf(await $.store.get(`incidents:${cwd}`), 'count'))
  const saved = await storeGet<Record<string, Day>>($, 'savings:days', {})
  let storedTokens = 0
  for (const k of Object.keys(saved)) storedTokens += num(saved[k]?.tokens)
  const days = await storeGet<Record<string, Day>>($, 'week-heatmap:days', {})
  let ms = 0
  let activeDays = 0
  for (const k of Object.keys(days)) {
    ms += num(days[k]?.ms)
    if (num(days[k]?.turns) > 0) activeDays++
  }
  if (isTurn && num(days[dayKey(now)]?.turns) === 0) activeDays++

  // the switchboard and the person's choices
  const map = await read($, enabled)
  let enabledCount = 0
  let disabledCount = 0
  for (const k of Object.keys(map)) {
    if (map[k] === true) enabledCount++
    else disabledCount++
  }
  const language = await $.store.get('language')
  const profile = await $.store.get('profile')

  return {
    turnHour: isTurn ? new Date(now).getHours() : null,
    testsPassed,
    testStreak,
    bugFixed,
    incidents: Math.max(sigIncidents, storedIncidents),
    savedTokens: Math.max(sigTokens, storedTokens),
    activeStreak: streakOf(days, now, isTurn),
    activeDays,
    hours: ms / 3_600_000,
    language: typeof language === 'string' ? language : 'en',
    profile: typeof profile === 'string' ? profile : '',
    enabledCount,
    disabledCount,
  }
}

// ---------- unlocking ----------

async function readUnlocked($: EngineInterface): Promise<Record<string, number>> {
  const stored = await $.store.get(UNLOCKED_KEY)
  const out: Record<string, number> = {}
  if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
    for (const [id, at] of Object.entries(stored as Record<string, unknown>)) {
      if (typeof at === 'number') out[id] = at
    }
  }
  return out
}

/** Assembles the facts, unlocks what newly passes (once, ever) and announces it. */
async function evaluate($: EngineInterface, isTurn: boolean): Promise<void> {
  if (isChecking || !(await isOn($, feature))) return
  isChecking = true
  try {
    const known = await readUnlocked($)
    const facts = await gather($, isTurn)
    const fresh = ACHIEVEMENTS.filter(a => known[a.id] === undefined && a.check(facts))
    const cur = await read($, state)
    if (fresh.length === 0) {
      if (Object.keys(known).length !== Object.keys(cur.unlocked).length) await update($, state, s => ({ ...s, unlocked: known }))
      return
    }

    const at = await $.clock.now()
    const next: Record<string, number> = { ...known }
    for (const a of fresh) next[a.id] = at
    await storeSet($, UNLOCKED_KEY, next)
    await update($, state, () => ({ unlocked: next, flashUntil: at + FLASH_MS }))

    flashTimer?.cancel()
    flashTimer = $.clock.after(FLASH_MS, async () => {
      if (!(await isOn($, feature))) return
      await update($, state, s => (s.flashUntil === 0 ? s : { ...s, flashUntil: 0 }))
    })

    // A trophy is never dropped by the info cooldown: it is announced once, here.
    for (const a of fresh) {
      const text = t(T.unlocked, { title: t(a.title) })
      await notice($, a.rarity === 'common' ? 'info' : 'alert', text, feature.id, { immediate: true })
    }
    if (await isSoundOn($)) {
      try {
        await $.audio.play({ asset: SOUND })
      } catch {
        // no player or no sound: stay silent
      }
    }
  } finally {
    isChecking = false
  }
}

// ---------- sharing ----------

async function shareLatest($: EngineInterface, surface: RenderSurface): Promise<void> {
  const { unlocked } = await read($, state)
  let latest: Achievement | undefined
  let latestAt = -1
  for (const a of ACHIEVEMENTS) {
    const at = unlocked[a.id]
    if (at !== undefined && at >= latestAt) {
      latest = a
      latestAt = at
    }
  }
  if (latest === undefined) {
    await notice($, 'info', t(T.shareNothing), feature.id, { immediate: true })
    return
  }
  const text = t(T.shareText, { title: t(latest.title), n: Object.keys(unlocked).length, total: ACHIEVEMENTS.length })
  try {
    const r = await $.ui.copy({ text, surface })
    await notice($, r.isCopied ? 'info' : 'warn', r.isCopied ? t(T.copied) : t(T.copyFailed), feature.id, { immediate: true })
  } catch {
    await notice($, 'warn', t(T.copyFailed), feature.id, { immediate: true })
  }
}

// ---------- handlers ----------

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  void e
  try {
    await $.command.register({ name: 'trophies', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'trophies', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  const known = await readUnlocked($)
  await update($, state, s => ({ ...s, unlocked: known }))
  await evaluate($, false)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await evaluate($, true)
}

/** The band chip: the trophy count, only for ten seconds after an unlock. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const s = await read($, state)
  if (s.flashUntil <= (await $.clock.now())) return null
  return { text: t(T.chip, { n: Object.keys(s.unlocked).length }), level: 'info', icon: ICONS.visual }
}

export function register(on: On) {
  on('command.run', { command: 'trophies' }, async ($, e) => {
    void e
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await evaluate($, false)
    await $.ui.open({ id: PANE, title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.off)}</Text>

    const { unlocked } = await read($, state)
    const surface = e.surface
    const done = ACHIEVEMENTS.filter(a => unlocked[a.id] !== undefined).sort((a, b) => (unlocked[b.id] ?? 0) - (unlocked[a.id] ?? 0))
    const locked = ACHIEVEMENTS.filter(a => unlocked[a.id] === undefined)

    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: t(T.count, { n: done.length, total: ACHIEVEMENTS.length }),
      level: done.length > 0 ? 'info' : 'ok',
      icon: ICONS.visual,
      actions: done.length > 0 ? [{ key: 'share-achievements', label: t(T.share), onPress: () => void shareLatest($, surface) }] : [],
    })

    return (
      <Box flexDirection="column">
        {header}
        {sectionTitle($, e, t(T.unlockedTitle))}
        {done.length === 0 ? (
          emptyState($, e, T.noneYet, T.noneHint)
        ) : (
          done.map(a => (
            <Box key={`done-${a.id}`}>
              {listRow($, e, {
                key: `row-${a.id}`,
                left: dayKey(unlocked[a.id] ?? 0),
                text: `${a.icon} ${t(a.title)}`,
                right: rarityName(a.rarity),
                level: a.rarity === 'common' ? 'ok' : 'info',
              })}
            </Box>
          ))
        )}
        {locked.length > 0 ? sectionTitle($, e, t(T.lockedTitle)) : null}
        {locked.map(a => (
          <Box key={`locked-${a.id}`} flexDirection="column">
            <Text dimColor>{`▢ ${t(a.title)}`}</Text>
            <Text dimColor size="footnote">{`   ${t(a.body)}`}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
