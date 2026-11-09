import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { Incidents } from '../shared'
import type { BandInput, BandLine, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { ICONS } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: { en: 'Pasted secret scan', he: 'סריקת סודות מודבקים', es: 'Análisis de secretos pegados', fr: 'Analyse des secrets collés', ru: 'Проверка вставленных секретов', zh: '粘贴密钥扫描', ja: '貼り付けシークレットのスキャン', pt: 'Verificação de segredos colados', de: 'Scan eingefügter Geheimnisse', ko: '붙여넣은 비밀 검사' },
  description: { en: 'Redacts API keys and tokens from your prompts before they reach the model, and blocks git add / git commit when added lines contain a secret.', he: 'מטשטש מפתחות API וטוקנים בהודעות שלך לפני שהם מגיעים למודל, וחוסם git add / git commit כששורות שנוספו מכילות סוד.', es: 'Oculta claves de API y tokens de tus mensajes antes de que lleguen al modelo, y bloquea git add / git commit cuando las líneas añadidas contienen un secreto.', fr: 'Masque les clés d\'API et jetons de vos messages avant qu\'ils n\'atteignent le modèle, et bloque git add / git commit quand les lignes ajoutées contiennent un secret.', ru: 'Скрывает API-ключи и токены в ваших сообщениях до отправки модели и блокирует git add / git commit, если в добавленных строках есть секрет.', zh: '在提示词到达模型之前，隐去其中的 API 密钥和令牌；当新增行包含密钥时，拦截 git add / git commit。', ja: 'プロンプトがモデルに届く前に API キーやトークンを伏せ字にし、追加行にシークレットが含まれる場合は git add / git commit をブロックします。', pt: 'Oculta chaves de API e tokens dos seus prompts antes de chegarem ao modelo e bloqueia git add / git commit quando as linhas adicionadas contêm um segredo.', de: 'Schwärzt API-Schlüssel und Tokens in deinen Prompts, bevor sie das Modell erreichen, und blockiert git add / git commit, wenn hinzugefügte Zeilen ein Geheimnis enthalten.', ko: '프롬프트가 모델에 도달하기 전에 API 키와 토큰을 가리고, 추가된 줄에 비밀 값이 있으면 git add / git commit을 차단합니다.' },
  toastRedacted: { en: '🔑 Redacted {n} secret(s) from your prompt before sending', he: '🔑 {n} סודות הוסתרו מההודעה לפני השליחה', es: '🔑 Se ocultaron {n} secreto(s) de tu mensaje antes de enviarlo', fr: '🔑 {n} secret(s) masqué(s) dans votre message avant l\'envoi', ru: '🔑 Скрыто секретов в вашем сообщении перед отправкой: {n}', zh: '🔑 发送前已从提示词中隐去 {n} 个密钥', ja: '🔑 送信前にプロンプトから {n} 件のシークレットを伏せ字にしました', pt: '🔑 {n} segredo(s) ocultado(s) do seu prompt antes do envio', de: '🔑 {n} Geheimnis(se) vor dem Senden aus deinem Prompt geschwärzt', ko: '🔑 전송 전에 프롬프트에서 비밀 값 {n}개를 가렸습니다' },
  chipRedacted: { en: '{n} redacted', he: '{n} הוסתרו', es: '{n} ocultados', fr: '{n} masqués', ru: 'скрыто: {n}', zh: '已隐去 {n} 个', ja: '{n} 件伏せ字', pt: '{n} ocultado(s)', de: '{n} geschwärzt', ko: '{n}개 가림' },
  band: { en: '🔑 {n} secrets redacted', he: '🔑 {n} סודות הוסתרו', es: '🔑 {n} secretos ocultados', fr: '🔑 {n} secrets masqués', ru: '🔑 скрыто секретов: {n}', zh: '🔑 已隐去 {n} 个密钥', ja: '🔑 シークレット {n} 件を伏せ字', pt: '🔑 {n} segredos ocultados', de: '🔑 {n} Geheimnisse geschwärzt', ko: '🔑 비밀 값 {n}개 가림' },
  denyGit: { en: 'Toolkitty · Pasted secret scan: the changes about to be added contain what looks like a secret: {found}. Remove it (use an environment variable or an ignored config file) and try again, or turn the feature off in the /toolkitty pane if this is a false positive.', he: 'Toolkitty · סריקת סודות: השינויים שעומדים להתווסף מכילים דבר שנראה כסוד: {found}. הסירו אותו (השתמשו במשתנה סביבה או בקובץ הגדרות שמתעלמים ממנו) ונסו שוב, או כבו את התכונה בחלונית /toolkitty אם זו התראת שווא.', es: 'Toolkitty · Análisis de secretos: los cambios que se van a añadir contienen algo que parece un secreto: {found}. Quítalo (usa una variable de entorno o un archivo de configuración ignorado) e inténtalo de nuevo, o desactiva la función en el panel /toolkitty si es un falso positivo.', fr: 'Toolkitty · Analyse des secrets : les changements sur le point d\'être ajoutés contiennent ce qui ressemble à un secret : {found}. Retirez-le (utilisez une variable d\'environnement ou un fichier de configuration ignoré) et réessayez, ou désactivez la fonctionnalité dans le panneau /toolkitty s\'il s\'agit d\'un faux positif.', ru: 'Toolkitty · Проверка секретов: в изменениях, которые собираются добавить, есть похожее на секрет: {found}. Уберите его (используйте переменную окружения или игнорируемый файл настроек) и повторите или выключите функцию в панели /toolkitty, если это ложное срабатывание.', zh: 'Toolkitty · 粘贴密钥扫描：即将添加的更改中似乎含有密钥：{found}。请移除它（改用环境变量或被忽略的配置文件）后重试；如果是误报，可在 /toolkitty 面板中关闭该功能。', ja: 'Toolkitty · 貼り付けシークレットのスキャン：追加しようとしている変更にシークレットらしきものが含まれています：{found}。削除して（環境変数や無視設定のファイルを使用）再試行してください。誤検出の場合は /toolkitty パネルでこの機能をオフにできます。', pt: 'Toolkitty · Verificação de segredos colados: as alterações prestes a serem adicionadas parecem conter um segredo: {found}. Remova-o (use uma variável de ambiente ou um arquivo de configuração ignorado) e tente de novo, ou desative o recurso no painel /toolkitty se for um falso positivo.', de: 'Toolkitty · Scan eingefügter Geheimnisse: Die Änderungen, die hinzugefügt werden sollen, enthalten offenbar ein Geheimnis: {found}. Entferne es (nutze eine Umgebungsvariable oder eine ignorierte Konfigurationsdatei) und versuche es erneut, oder schalte die Funktion im /toolkitty-Panel aus, falls es ein Fehlalarm ist.', ko: 'Toolkitty · 붙여넣은 비밀 검사: 추가하려는 변경 사항에 비밀 값으로 보이는 것이 있습니다: {found}. 제거한 뒤(환경 변수나 무시되는 설정 파일 사용) 다시 시도하거나, 오탐이면 /toolkitty 패널에서 이 기능을 끄세요.' },
  kindAws: { en: 'AWS access key', he: 'מפתח גישה של AWS', es: 'clave de acceso de AWS', fr: 'clé d\'accès AWS', ru: 'ключ доступа AWS', zh: 'AWS 访问密钥', ja: 'AWS アクセスキー', pt: 'Chave de acesso AWS', de: 'AWS-Zugangsschlüssel', ko: 'AWS 액세스 키' },
  kindGithub: { en: 'GitHub token', he: 'טוקן של GitHub', es: 'token de GitHub', fr: 'jeton GitHub', ru: 'токен GitHub', zh: 'GitHub 令牌', ja: 'GitHub トークン', pt: 'Token do GitHub', de: 'GitHub-Token', ko: 'GitHub 토큰' },
  kindApiKey: { en: 'OpenAI/Anthropic-style API key', he: 'מפתח API בסגנון OpenAI/Anthropic', es: 'clave de API estilo OpenAI/Anthropic', fr: 'clé d\'API de style OpenAI/Anthropic', ru: 'API-ключ вида OpenAI/Anthropic', zh: 'OpenAI/Anthropic 风格的 API 密钥', ja: 'OpenAI/Anthropic 形式の API キー', pt: 'Chave de API estilo OpenAI/Anthropic', de: 'API-Schlüssel im OpenAI/Anthropic-Stil', ko: 'OpenAI/Anthropic 형식 API 키' },
  kindSlack: { en: 'Slack token', he: 'טוקן של Slack', es: 'token de Slack', fr: 'jeton Slack', ru: 'токен Slack', zh: 'Slack 令牌', ja: 'Slack トークン', pt: 'Token do Slack', de: 'Slack-Token', ko: 'Slack 토큰' },
  kindGoogle: { en: 'Google API key', he: 'מפתח API של Google', es: 'clave de API de Google', fr: 'clé d\'API Google', ru: 'API-ключ Google', zh: 'Google API 密钥', ja: 'Google API キー', pt: 'Chave de API do Google', de: 'Google-API-Schlüssel', ko: 'Google API 키' },
  kindPrivate: { en: 'private key', he: 'מפתח פרטי', es: 'clave privada', fr: 'clé privée', ru: 'приватный ключ', zh: '私钥', ja: '秘密鍵', pt: 'chave privada', de: 'privater Schlüssel', ko: '개인 키' },
  kindJwt: { en: 'JWT', he: 'JWT', es: 'JWT', fr: 'JWT', ru: 'JWT', zh: 'JWT', ja: 'JWT', pt: 'JWT', de: 'JWT', ko: 'JWT' },
  kindGeneric: { en: 'generic credential', he: 'פרט גישה כללי', es: 'credencial genérica', fr: 'identifiant générique', ru: 'учётные данные', zh: '通用凭据', ja: '汎用の認証情報', pt: 'credencial genérica', de: 'generische Zugangsdaten', ko: '일반 자격 증명' },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  dHead: {
    en: 'Redacted or blocked secrets (newest first; values are never shown)',
    he: 'סודות שהוסתרו או נחסמו (החדשים ראשונים; הערכים לעולם לא מוצגים)',
    es: 'Secretos ocultados o bloqueados (los más recientes primero; nunca se muestran los valores)',
    fr: 'Secrets masqués ou bloqués (les plus récents d\'abord ; les valeurs ne sont jamais affichées)',
    ru: 'Скрытые или заблокированные секреты (сначала новые; значения не показываются)',
    zh: '已隐去或拦截的密钥（最新在前；从不显示具体值）',
    ja: '伏せ字またはブロックしたシークレット（新しい順。値は表示されません）',
    pt: 'Segredos ocultados ou bloqueados (mais recentes primeiro; os valores nunca são exibidos)',
    de: 'Geschwärzte oder blockierte Geheimnisse (neueste zuerst; Werte werden nie angezeigt)',
    ko: '가리거나 차단한 비밀 값 (최신순, 값은 표시되지 않음)',
  },
  dNone: { en: 'Nothing was redacted or blocked this session.', he: 'שום דבר לא הוסתר או נחסם בסשן הזה.', es: 'No se ocultó ni bloqueó nada en esta sesión.', fr: 'Rien n\'a été masqué ni bloqué dans cette session.', ru: 'В этой сессии ничего не скрывалось и не блокировалось.', zh: '本次会话没有隐去或拦截任何内容。', ja: 'このセッションでは伏せ字やブロックはありませんでした。', pt: 'Nada foi ocultado ou bloqueado nesta sessão.', de: 'In dieser Sitzung wurde nichts geschwärzt oder blockiert.', ko: '이번 세션에서 가리거나 차단한 것이 없습니다.' },
  wherePrompt: { en: 'your prompt', he: 'ההודעה שלך', es: 'tu mensaje', fr: 'votre message', ru: 'ваше сообщение', zh: '你的提示词', ja: 'あなたのプロンプト', pt: 'seu prompt', de: 'dein Prompt', ko: '내 프롬프트' },
  whereCommit: { en: 'git add/commit', he: 'git add/commit', es: 'git add/commit', fr: 'git add/commit', ru: 'git add/commit', zh: 'git add/commit', ja: 'git add/commit', pt: 'git add/commit', de: 'git add/commit', ko: 'git add/commit' },
} as const

type KindId = 'aws' | 'github' | 'api-key' | 'slack' | 'google' | 'private-key' | 'jwt' | 'generic'
type Pattern = { id: KindId; label: (typeof T)[keyof typeof T]; re: RegExp }
/** One redaction or block: where, which kinds, how many, and for a commit the file names. Never a value. */
type Redaction = { at: number; where: 'prompt' | 'commit'; kinds: KindId[]; n: number; files: string[] }
type State = { redacted: number; log: Redaction[] }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'pasted-secret-scan' } as const, { redacted: 0, log: [] } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'pasted-secret-scan',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const incidents = atom({ plugin: 'toolkitty', key: 'slot', id: 'incidents' } as const, { count: 0, items: [], lastAt: null } as Incidents) as unknown as Atom<Incidents>

/** Reports a block or redaction to "Disasters prevented": kind and file name only, never a secret value. */
async function reportIncident($: EngineInterface, kind: string, detail: string): Promise<void> {
  try {
    const at = await $.clock.now()
    await update($, incidents, s => ({ count: s.count + 1, lastAt: at, items: [...s.items.slice(-99), { at, feature: feature.id, kind, detail }] }))
  } catch {
    // reporting never changes what the guard does
  }
}

const DIFF_CAP = 200 * 1024
const GIT_TIMEOUT_MS = 15000

// Specific shapes first, the generic one last (it must not swallow what a specific one already names).
const PATTERNS: readonly Pattern[] = [
  { id: 'private-key', label: T.kindPrivate, re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/ },
  { id: 'aws', label: T.kindAws, re: /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}/ },
  { id: 'github', label: T.kindGithub, re: /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36,}/ },
  { id: 'api-key', label: T.kindApiKey, re: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/ },
  { id: 'slack', label: T.kindSlack, re: /xox[baprs]-[A-Za-z0-9-]{8,}/ },
  { id: 'google', label: T.kindGoogle, re: /AIza[0-9A-Za-z_-]{35}/ },
  { id: 'jwt', label: T.kindJwt, re: /eyJ[\w-]+\.[\w-]+\.[\w-]+/ },
  { id: 'generic', label: T.kindGeneric, re: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/i },
]

/** The generic pattern also matches plain identifiers (password = getPasswordFromEnv); a real value carries a digit. */
function looksLikeValue(match: string): boolean {
  const value = /[A-Za-z0-9_-]{16,}$/.exec(match)
  return value !== null && /\d/.test(value[0])
}

/** Whether a match of `pattern` is a real credential: `sk-` words and plain identifiers (task-management-refactoring-plan) carry no digit. */
function isReal(pattern: Pattern, match: string): boolean {
  if (pattern.id === 'generic') return looksLikeValue(match)
  if (pattern.id === 'api-key') return /\d/.test(match)
  return true
}

function labelOf(pattern: Pattern): string {
  return t(pattern.label)
}

function redact(text: string): { text: string; count: number } {
  let out = text
  let count = 0
  for (const p of PATTERNS) {
    out = out.replace(new RegExp(p.re.source, `${p.re.flags}g`), (match: string) => {
      if (!isReal(p, match)) return match
      if (p.id === 'generic') {
        count += 1
        return match.replace(/[A-Za-z0-9_-]{16,}$/, `[REDACTED ${p.id}]`)
      }
      count += 1
      return `[REDACTED ${p.id}]`
    })
  }
  return { text: out, count }
}

function kindsIn(text: string): Pattern[] {
  const found: Pattern[] = []
  // What a specific pattern already named is taken out before the generic one looks, so one token is one finding.
  let rest = text
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, `${p.re.flags}g`)
    const matches = rest.match(re)
    if (matches === null) continue
    if (!matches.some(m => isReal(p, m))) continue
    found.push(p)
    rest = rest.replace(re, match => (isReal(p, match) ? ' ' : match))
  }
  return found
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'>> {
  if (!(await isOn($, feature))) return e
  // A slash command's line is not rewritten by the engine; the arguments are masked at command.run, not here.
  if (e.command !== undefined) return e

  const out = redact(e.text)
  if (out.count === 0) return e

  const hit: Redaction = { at: await $.clock.now(), where: 'prompt', kinds: kindsIn(e.text).map(p => p.id), n: out.count, files: [] }
  await update($, state, s => ({ ...s, redacted: s.redacted + out.count, log: [...(s.log ?? []), hit].slice(-50) }))
  await reportIncident($, 'pasted-secret', kindsIn(e.text).map(p => p.id).join(', '))
  await notice($, 'warn', t(T.toastRedacted, { n: out.count }), feature.id)
  return { ...e, text: out.text }
}

type GitWords = { verb: 'add' | 'commit'; words: string[] }

function splitSegments(command: string): string[] {
  return command.split(/&&|\|\||;|\||\r?\n/).map(s => s.trim()).filter(s => s !== '')
}

function gitWordsOf(segment: string): GitWords | null {
  const m = /(?:^|\s)git\s+((?:-C\s+\S+\s+|-c\s+\S+\s+|--no-pager\s+)*)(add|commit)\b(.*)$/.exec(segment)
  if (m === null) return null
  const tokens = (m[3] ?? '').match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  return { verb: m[2] === 'add' ? 'add' : 'commit', words: tokens.map(w => w.replace(/^["']|["']$/g, '')) }
}

const joinPath = (cwd: string, p: string) => (/^([a-zA-Z]:)?[\\/]/.test(p) ? p : `${cwd.replace(/[\\/]+$/, '')}/${p}`)

async function gitText($: EngineInterface, argv: string[], cwd: string): Promise<string> {
  try {
    const out = await $.process.run(argv, { cwd, timeoutMs: GIT_TIMEOUT_MS })
    return out.exitCode === 0 ? out.stdout : ''
  } catch {
    return ''
  }
}

type Finding = { file: string; label: string; kind: KindId }

/** Secrets in the added lines of a unified diff (-U0); the first finding per file and kind. */
function scanDiff(diff: string, into: Finding[]): void {
  let file = '?'
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.slice(4).replace(/^b\//, '').trim()
      continue
    }
    if (!line.startsWith('+')) continue
    for (const p of kindsIn(line.slice(1))) {
      const label = labelOf(p)
      if (!into.some(f => f.file === file && f.label === label)) into.push({ file, label, kind: p.id })
    }
  }
}

export async function beforeBashCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined
  if (e.tool !== 'Bash') return undefined

  const parsed = splitSegments(e.command).map(gitWordsOf).filter((g): g is GitWords => g !== null)
  if (parsed.length === 0) return undefined

  const cwd = await $.session.cwd()
  const findings: Finding[] = []
  let budget = DIFF_CAP

  for (const g of parsed) {
    const flags = g.words.filter(w => w.startsWith('-'))
    if (g.verb === 'add') {
      if (flags.some(w => w === '-n' || w === '--dry-run')) continue
      const paths = g.words.filter(w => !w.startsWith('-'))
      const all = paths.length === 0 || paths.some(p => p === '.') || flags.some(w => w === '-A' || w === '--all' || w === '-u' || w === '--update')
      const scope = all ? [] : ['--', ...paths]
      const diff = (await gitText($, ['git', 'diff', '-U0', ...scope], cwd)).slice(0, budget)
      scanDiff(diff, findings)
      budget -= diff.length

      const untracked = (await gitText($, ['git', 'ls-files', '--others', '--exclude-standard', ...scope], cwd)).split('\n').map(s => s.trim()).filter(s => s !== '')
      for (const file of untracked) {
        if (budget <= 0) break
        try {
          const body = (await $.fs.read(joinPath(cwd, file))).slice(0, budget)
          budget -= body.length
          scanDiff(`+++ b/${file}\n${body.split('\n').map(l => `+${l}`).join('\n')}`, findings)
        } catch {
          // unreadable (binary, gone): nothing to scan
        }
      }
    } else {
      const staged = (await gitText($, ['git', 'diff', '--cached', '-U0'], cwd)).slice(0, budget)
      scanDiff(staged, findings)
      budget -= staged.length
      // git commit -a also takes the tracked, modified files
      const takesAll = flags.some(w => w === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(w))
      if (takesAll && budget > 0) {
        const tracked = (await gitText($, ['git', 'diff', '-U0'], cwd)).slice(0, budget)
        scanDiff(tracked, findings)
        budget -= tracked.length
      }
    }
    if (budget <= 0) break
  }

  if (findings.length === 0) return undefined

  const blocked: Redaction = {
    at: await $.clock.now(),
    where: 'commit',
    kinds: [...new Set(findings.map(f => f.kind))],
    n: findings.length,
    files: [...new Set(findings.map(f => f.file))].slice(0, 3),
  }
  await update($, state, s => ({ ...s, log: [...(s.log ?? []), blocked].slice(-50) }))
  await reportIncident($, 'commit-secret', [...new Set(findings.map(f => f.file))].slice(0, 5).join(', '))
  const shown = findings.slice(0, 8).map(f => `${f.file} (${f.label})`).join('; ')
  const more = findings.length > 8 ? ` +${findings.length - 8}` : ''
  return { deny: t(T.denyGit, { found: shown + more }) }
}

/** What a press on the band line shows: what was redacted or blocked, by kind and place; never a value. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const s = await read($, state)
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)
  const rows = (s.log ?? []).slice(-14).reverse()
  const kindsText = (r: Redaction): string =>
    r.kinds.map(id => (PATTERNS.find(p => p.id === id) === undefined ? id : labelOf(PATTERNS.find(p => p.id === id) as Pattern))).join(', ')
  return (
    <Box flexDirection="column">
      <Text bold>{t(T.dHead)}</Text>
      {rows.length === 0 ? <Text dimColor>{t(T.dNone)}</Text> : null}
      {rows.map((r, i) => (
        <Text key={`s${i}`}>
          {`${t(T.ago, { t: clockText(now - r.at) })} · ${r.where === 'prompt' ? t(T.wherePrompt) : t(T.whereCommit)} · ${kindsText(r)} ×${r.n}${r.files.length > 0 ? ` · ${r.files.join(', ')}` : ''}`}
        </Text>
      ))}
    </Box>
  )
}

/** The short band form: "2 redacted". Quiet until a secret was masked. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const { redacted } = await read($, state)
  if (redacted <= 0) return null
  return { text: t(T.chipRedacted, { n: redacted }), level: 'warn', icon: ICONS.guard }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const { redacted } = await read($, state)
  if (redacted <= 0) return null

  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      {t(T.band, { n: redacted })}
    </Text>
  )
}
