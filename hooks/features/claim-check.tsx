import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { recordEvidence } from '../evidence'
import { publish, retractAll } from '../signals'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Claim check', he: 'בדיקת טענות', es: 'Verificación de afirmaciones', fr: 'Vérification des affirmations', ru: 'Проверка утверждений', zh: '断言核查', ja: '主張チェック', pt: 'Verificação de afirmações', de: 'Claim-Check', ko: '주장 검증' },
  description: { en: 'Warns when the answer claims tests pass, the build is green or something was verified, but no matching command ran this turn.', he: 'מתריע כשהתשובה טוענת שהבדיקות עוברות, הבנייה תקינה או שמשהו נבדק, אך לא רצה פקודה מתאימה בתור הזה.', es: 'Avisa cuando la respuesta afirma que las pruebas pasan, que la compilación está bien o que algo se verificó, pero no se ejecutó ningún comando correspondiente en este turno.', fr: 'Prévient quand la réponse affirme que les tests passent, que le build est vert ou que quelque chose a été vérifié, sans qu\'aucune commande correspondante n\'ait tourné pendant ce tour.', ru: 'Предупреждает, когда в ответе сказано, что тесты проходят, сборка зелёная или что-то проверено, но подходящая команда в этом ходу не запускалась.', zh: '当回答声称测试通过、构建通过或某事已验证，但本轮没有运行对应命令时发出警告。', ja: '回答が「テストが通った」「ビルドがグリーン」「検証済み」と主張しているのに、このターンで対応するコマンドが実行されていない場合に警告します。', pt: 'Avisa quando a resposta afirma que os testes passam, que o build está verde ou que algo foi verificado, mas nenhum comando correspondente rodou neste turno.', de: 'Warnt, wenn die Antwort behauptet, Tests bestünden, der Build sei grün oder etwas sei verifiziert, in diesem Durchgang aber kein passender Befehl lief.', ko: '답변이 테스트 통과, 빌드 성공, 검증 완료를 주장하는데 이번 턴에 해당하는 명령이 실행되지 않았다면 경고합니다.' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  cmdDesc: { en: 'Lists the unverified claims caught in this session', he: 'מציג את הטענות שלא אומתו שנתפסו בסשן הזה', es: 'Lista las afirmaciones sin verificar detectadas en esta sesión', fr: 'Liste les affirmations non vérifiées détectées dans cette session', ru: 'Показывает непроверенные утверждения, пойманные в этой сессии', zh: '列出本会话中发现的未经验证的断言', ja: 'このセッションで見つかった未検証の主張を一覧表示します', pt: 'Lista as afirmações não verificadas detectadas nesta sessão', de: 'Listet die in dieser Session erkannten unverifizierten Behauptungen auf', ko: '이 세션에서 발견된 검증되지 않은 주장을 나열합니다' },
  catTest: { en: 'test', he: 'בדיקות', es: 'de pruebas', fr: 'de test', ru: 'тестов', zh: '测试', ja: 'テスト', pt: 'teste', de: 'Test', ko: '테스트' },
  catBuild: { en: 'build', he: 'בנייה', es: 'de compilación', fr: 'de build', ru: 'сборки', zh: '构建', ja: 'ビルド', pt: 'build', de: 'Build', ko: '빌드' },
  catLint: { en: 'lint', he: 'לינט', es: 'de lint', fr: 'de lint', ru: 'линтера', zh: '代码检查', ja: 'lint', pt: 'lint', de: 'Lint', ko: '린트' },
  catTypecheck: { en: 'typecheck', he: 'בדיקת טיפוסים', es: 'de comprobación de tipos', fr: 'de vérification de types', ru: 'проверки типов', zh: '类型检查', ja: '型チェック', pt: 'verificação de tipos', de: 'Typprüfung', ko: '타입 검사' },
  catAny: { en: 'test, build, lint or typecheck', he: 'בדיקות, בנייה, לינט או בדיקת טיפוסים', es: 'de pruebas, compilación, lint o tipos', fr: 'de test, build, lint ou types', ru: 'тестов, сборки, линтера или проверки типов', zh: '测试、构建、代码检查或类型检查', ja: 'テスト、ビルド、lint、または型チェック', pt: 'teste, build, lint ou verificação de tipos', de: 'Test, Build, Lint oder Typprüfung', ko: '테스트, 빌드, 린트 또는 타입 검사' },
  toastNone: { en: '⚠ claimed \'{claim}\' but no {category} command ran this turn', he: '⚠ נטען \'{claim}\' אך לא רצה פקודת {category} בתור הזה', es: '⚠ se afirmó \'{claim}\' pero no se ejecutó ningún comando {category} en este turno', fr: '⚠ « {claim} » affirmé, mais aucune commande {category} n’a tourné ce tour-ci', ru: '⚠ заявлено «{claim}», но команда {category} в этом ходу не запускалась', zh: '⚠ 声称“{claim}”，但本轮没有运行{category}命令', ja: '⚠ 「{claim}」と主張しましたが、このターンでは{category}のコマンドが実行されていません', pt: '⚠ afirmou \'{claim}\', mas nenhum comando de {category} rodou neste turno', de: '⚠ „{claim}“ behauptet, aber in diesem Durchgang lief kein {category}-Befehl', ko: '⚠ \'{claim}\'(이)라고 주장했지만 이번 턴에 {category} 명령이 실행되지 않았습니다' },
  toastFailed: { en: '⚠ claimed \'{claim}\' but the {category} command failed this turn', he: '⚠ נטען \'{claim}\' אך פקודת {category} נכשלה בתור הזה', es: '⚠ se afirmó \'{claim}\' pero el comando {category} falló en este turno', fr: '⚠ « {claim} » affirmé, mais la commande {category} a échoué ce tour-ci', ru: '⚠ заявлено «{claim}», но команда {category} в этом ходу завершилась ошибкой', zh: '⚠ 声称“{claim}”，但本轮的{category}命令失败了', ja: '⚠ 「{claim}」と主張しましたが、このターンの{category}コマンドは失敗しました', pt: '⚠ afirmou \'{claim}\', mas o comando de {category} falhou neste turno', de: '⚠ „{claim}“ behauptet, aber der {category}-Befehl ist in diesem Durchgang fehlgeschlagen', ko: '⚠ \'{claim}\'(이)라고 주장했지만 이번 턴에 {category} 명령이 실패했습니다' },
  none: { en: 'No unverified claims caught in this session.', he: 'לא נתפסו טענות שלא אומתו בסשן הזה.', es: 'No se detectaron afirmaciones sin verificar en esta sesión.', fr: 'Aucune affirmation non vérifiée détectée dans cette session.', ru: 'В этой сессии непроверенных утверждений не поймано.', zh: '本会话中没有发现未经验证的断言。', ja: 'このセッションでは未検証の主張は見つかっていません。', pt: 'Nenhuma afirmação não verificada detectada nesta sessão.', de: 'In dieser Session wurden keine unverifizierten Behauptungen erkannt.', ko: '이 세션에서 검증되지 않은 주장이 발견되지 않았습니다.' },
  head: { en: 'Unverified claims in this session: {n}', he: 'טענות שלא אומתו בסשן הזה: {n}', es: 'Afirmaciones sin verificar en esta sesión: {n}', fr: 'Affirmations non vérifiées dans cette session : {n}', ru: 'Непроверенных утверждений в этой сессии: {n}', zh: '本会话中未经验证的断言：{n}', ja: 'このセッションの未検証の主張：{n} 件', pt: 'Afirmações não verificadas nesta sessão: {n}', de: 'Unverifizierte Behauptungen in dieser Session: {n}', ko: '이 세션의 검증되지 않은 주장: {n}' },
  lineNone: { en: '{n}. "{claim}" (no {category} command ran)', he: '{n}. "{claim}" (לא רצה פקודת {category})', es: '{n}. "{claim}" (no se ejecutó ningún comando {category})', fr: '{n}. « {claim} » (aucune commande {category})', ru: '{n}. «{claim}» (команда {category} не запускалась)', zh: '{n}. “{claim}”（未运行{category}命令）', ja: '{n}. 「{claim}」（{category}のコマンドは未実行）', pt: '{n}. "{claim}" (nenhum comando de {category} rodou)', de: '{n}. „{claim}“ (kein {category}-Befehl lief)', ko: '{n}. "{claim}" ({category} 명령이 실행되지 않음)' },
  lineFailed: { en: '{n}. "{claim}" (the {category} command failed)', he: '{n}. "{claim}" (פקודת {category} נכשלה)', es: '{n}. "{claim}" (el comando {category} falló)', fr: '{n}. « {claim} » (la commande {category} a échoué)', ru: '{n}. «{claim}» (команда {category} завершилась ошибкой)', zh: '{n}. “{claim}”（{category}命令失败）', ja: '{n}. 「{claim}」（{category}のコマンドは失敗）', pt: '{n}. "{claim}" (o comando de {category} falhou)', de: '{n}. „{claim}“ ({category}-Befehl fehlgeschlagen)', ko: '{n}. "{claim}" ({category} 명령이 실패함)' },
} as const

type Category = 'test' | 'build' | 'lint' | 'typecheck' | 'any'
type Run = { cats: Category[]; isError: boolean }
type Claim = { claim: string; category: Category; failed: boolean }
type State = { runs: Run[]; claims: Claim[] }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'claim-check' } as const, { runs: [], claims: [] } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'claim-check',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

const MAX_RUNS = 100
const MAX_CLAIMS = 100

const COMMAND_KINDS: readonly { cat: Exclude<Category, 'any'>; re: RegExp }[] = [
  { cat: 'test', re: /\b(jest|vitest|pytest|mocha|phpunit|rspec|nose2?|unittest|playwright\s+test|cypress\s+run|(npm|pnpm|yarn|bun)\s+(run\s+)?test|go\s+test|cargo\s+test|dotnet\s+test|mvn\s+\S*test|gradle\w*\s+(\S+\s+)*test)\b/i },
  { cat: 'build', re: /\b((npm|pnpm|yarn|bun)\s+(run\s+)?build|(vite|next|webpack|rollup|esbuild|tsup|turbo)\s+build|cargo\s+build|go\s+build|dotnet\s+build|mvn\s+\S*(package|compile|install)|gradle\w*\s+(\S+\s+)*build|cmake\s+--build|make)\b/i },
  { cat: 'lint', re: /\b(eslint|biome\s+(check|lint)|ruff|flake8|pylint|clippy|golangci-lint|stylelint|prettier\s+(--check|-c)|(npm|pnpm|yarn|bun)\s+(run\s+)?lint)\b/i },
  { cat: 'typecheck', re: /\b(tsc|vue-tsc|svelte-check|mypy|pyright|(npm|pnpm|yarn|bun)\s+(run\s+)?(type-?check|tsc))\b/i },
]

const CLAIMS: readonly { cat: Category; re: RegExp }[] = [
  { cat: 'test', re: /\ball\s+(?:the\s+)?(?:tests|checks)\s+(?:now\s+)?(?:pass(?:ed|ing)?|are\s+(?:passing|green))\b/i },
  { cat: 'test', re: /\btests?\s+(?:now\s+)?(?:all\s+)?(?:pass(?:ed|ing)?|are\s+(?:passing|green))\b/i },
  { cat: 'test', re: /הבדיקות\s+עוברות|הבדיקות\s+עברו|הטסטים\s+עוברים|הטסטים\s+עברו|כל\s+הבדיקות\s+(?:עוברות|עברו|ירוקות)/ },
  { cat: 'build', re: /\bbuild\s+(?:now\s+)?(?:succeeds|succeeded|passes|passed|works|is\s+(?:green|passing|successful))\b/i },
  { cat: 'build', re: /הבנייה\s+(?:עוברת|הצליחה|תקינה)|הבילד\s+(?:עובר|עבר|הצליח)/ },
  { cat: 'typecheck', re: /\btype-?check(?:s|ing)?\s+(?:now\s+)?(?:pass(?:es|ed)?|clean|is\s+clean|succeeds)\b/i },
  { cat: 'typecheck', re: /\bno\s+type\s+errors\b/i },
  { cat: 'typecheck', re: /בדיקת\s+הטיפוסים\s+(?:עוברת|עברה|נקייה)/ },
  { cat: 'lint', re: /\blint(?:ing)?\s+(?:now\s+)?(?:pass(?:es|ed)?|clean|is\s+clean|succeeds)\b/i },
  { cat: 'lint', re: /הלינט\s+(?:עובר|עבר|נקי)/ },
  { cat: 'any', re: /\bverified\b/i },
  { cat: 'any', re: /נבדק|אומת|וידאתי|בדקתי/ },
]

/** Commands that only read, print or search: a check's name in their arguments is a mention, not a run. */
const INERT_FIRST_WORDS = new Set(['echo', 'printf', 'cat', 'type', 'head', 'tail', 'less', 'more', 'ls', 'dir', 'grep', 'rg', 'ag', 'find', 'fd', 'which', 'where', 'man', 'wc', 'file', 'stat', 'sed', 'awk', 'vim', 'vi', 'nano', 'code', 'open', 'cp', 'mv', 'rm', 'touch', 'mkdir', 'tee', 'diff', 'sort', 'uniq', 'cut', 'tr', 'true', 'false', 'test', 'read'])

function isInert(segment: string): boolean {
  const words = segment.trim().split(/\s+/).filter(w => w !== '' && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w))
  const first = (words[0] ?? '').replace(/^.*[\/]/, '').replace(/\.exe$/i, '').toLowerCase()
  return first === 'git' || INERT_FIRST_WORDS.has(first)
}

function catsOf(command: string): Category[] {
  const found = new Set<Category>()
  for (const segment of command.split(/&&|\|\||;|\||\r?\n/)) {
    if (segment.trim() === '' || isInert(segment)) continue
    for (const k of COMMAND_KINDS) if (k.re.test(segment)) found.add(k.cat)
  }
  return [...found]
}

function categoryName(cat: Category): string {
  if (cat === 'test') return t(T.catTest)
  if (cat === 'build') return t(T.catBuild)
  if (cat === 'lint') return t(T.catLint)
  if (cat === 'typecheck') return t(T.catTypecheck)
  return t(T.catAny)
}

/** Words earlier in the same sentence that turn a phrase into a doubt, a hope or a plan rather than a claim. */
const HEDGE_RE = /(?:\b(?:whether|if|not|unsure|unclear|cannot|unable\s+to|needs?\s+to|hope|hopefully|should|might|could|will|would|once|until|before)\b|n't\b|(?<![֐-׿])(?:לא|אם)(?![֐-׿]))[^.!?\n]*$/i

function findClaims(answer: string): { claim: string; category: Category }[] {
  const found: { claim: string; category: Category }[] = []
  const seen = new Set<string>()
  for (const c of CLAIMS) {
    const m = c.re.exec(answer)
    if (m === null) continue
    if (HEDGE_RE.test(answer.slice(Math.max(0, m.index - 60), m.index))) continue
    const claim = m[0].replace(/\s+/g, ' ').trim()
    const dedupe = `${c.cat}:${claim.toLowerCase()}`
    if (seen.has(dedupe)) continue
    // The all-tests phrase also matches the plain one inside it: keep one per category and span.
    if (found.some(f => f.category === c.cat && f.claim.toLowerCase().includes(claim.toLowerCase()))) continue
    seen.add(dedupe)
    found.push({ claim, category: c.cat })
  }
  return found
}

/** 'ok' when a matching command ran without error, 'failed' when only failing ones ran, 'none' when none ran. */
function verdictFor(runs: readonly Run[], cat: Category): 'ok' | 'failed' | 'none' {
  const matching = runs.filter(r => (cat === 'any' ? r.cats.length > 0 : r.cats.includes(cat)))
  if (matching.length === 0) return 'none'
  return matching.some(r => !r.isError) ? 'ok' : 'failed'
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'claims', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'claims', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.agentId !== undefined) return result
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return result
  }
  if (e.tool !== 'Bash' || result.deny !== undefined) return result

  const cats = catsOf(e.command)
  const run: Run = { cats, isError: result.isError === true }
  await update($, state, s => ({ ...s, runs: [...s.runs, run].slice(-MAX_RUNS) }))
  for (const cat of cats) {
    if (cat === 'any') continue
    await recordEvidence($, {
      kind: cat,
      ok: !run.isError,
      summary: e.command.trim().slice(0, 80) + ' · ' + (run.isError ? 'failed' : 'ok'),
      ref: e.command.trim().slice(0, 200),
      feature: feature.id,
    })
  }
  // A test, build, lint or type-check command was seen: its outcome is evidence for the advisor.
  if (cats.length > 0) {
    await publish($, {
      id: 'claim-check:evidence',
      feature: feature.id,
      kind: 'evidence',
      level: run.isError ? 'warn' : 'ok',
      value: run.isError ? 0 : 1,
      text: run.isError ? 'tests failed' : 'tests passed',
      ttlMs: 10 * 60 * 1000,
    })
  }
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }

  const { runs } = await read($, state)
  const fresh: Claim[] = []
  if (e.reason === 'answer') {
    for (const c of findClaims(e.answer)) {
      const verdict = verdictFor(runs, c.category)
      if (verdict === 'ok') continue
      const category = categoryName(c.category)
      fresh.push({ claim: c.claim, category: c.category, failed: verdict === 'failed' })
      await notice($, 'warn', t(verdict === 'failed' ? T.toastFailed : T.toastNone, { claim: c.claim, category }), feature.id)
    }
  }

  // The commands belong to the turn that just ended, whatever way it ended.
  await update($, state, s => ({ runs: [], claims: [...s.claims, ...fresh].slice(-MAX_CLAIMS) }))
}

export function register(on: On) {
  on('command.run', { command: 'claims' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const { claims } = await read($, state)
    if (claims.length === 0) return { text: t(T.none) }

    const lines = claims.map((c, i) =>
      t(c.failed ? T.lineFailed : T.lineNone, { n: i + 1, claim: c.claim, category: categoryName(c.category) }),
    )
    return { text: [t(T.head, { n: claims.length }), ...lines].join('\n') }
  })
}
