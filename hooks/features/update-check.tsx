import type { EngineInterface, On } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { Feature, Input } from '../core'

// The GitHub repository that publishes Toolkitty releases. A URL still holding the literal OWNER/REPO
// (a fork that has not set its own) skips the check silently.
const RELEASES_URL = 'https://api.github.com/repos/avraham-tech/toolkitty/releases/latest'

const T = {
  title: { en: 'Update check', he: 'בדיקת עדכונים', es: 'Búsqueda de actualizaciones', fr: 'Vérification des mises à jour', ru: 'Проверка обновлений', zh: '检查更新', ja: '更新チェック', pt: 'Verificar atualizações', de: 'Update-Prüfung', ko: '업데이트 확인' },
  description: {
    en: 'Once a day, looks for a newer Toolkitty release on GitHub and tells you with a toast. Nothing is sent but the request itself.',
    he: 'פעם ביום בודק אם יצאה גרסה חדשה של Toolkitty ב-GitHub ומודיע בהודעה קופצת. לא נשלח דבר מלבד הבקשה עצמה.',
    es: 'Una vez al día busca una versión más reciente de Toolkitty en GitHub y te avisa con un aviso. No se envía nada aparte de la propia petición.',
    fr: "Une fois par jour, cherche une version plus récente de Toolkitty sur GitHub et vous prévient par une notification. Rien n'est envoyé hormis la requête elle-même.",
    ru: 'Раз в день ищет на GitHub более новую версию Toolkitty и сообщает о ней уведомлением. Отправляется только сам запрос.',
    zh: '每天一次在 GitHub 上查找更新的 Toolkitty 版本，并用提示通知你。除请求本身外不会发送任何数据。',
    ja: '1 日 1 回、GitHub で新しい Toolkitty リリースを探し、トーストでお知らせします。リクエスト自体以外は何も送信しません。',
    pt: 'Uma vez por dia, procura uma versão mais nova do Toolkitty no GitHub e avisa com um aviso. Nada é enviado além da própria requisição.',
    de: 'Sucht einmal täglich auf GitHub nach einer neueren Toolkitty-Version und meldet sie per Toast. Gesendet wird nur die Anfrage selbst.',
    ko: '하루에 한 번 GitHub에서 더 새로운 Toolkitty 릴리스를 찾아 토스트로 알려 줍니다. 요청 자체 외에는 아무것도 전송하지 않습니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '此功能已关闭，请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty パネルでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; schalte sie im /toolkitty-Panel ein', ko: '이 기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요' },
  cmdDesc: { en: 'Shows the Toolkitty version and the newest known release', he: 'מציג את גרסת Toolkitty ואת הגרסה החדשה ביותר הידועה', es: 'Muestra la versión de Toolkitty y la última versión conocida', fr: 'Affiche la version de Toolkitty et la dernière version connue', ru: 'Показывает версию Toolkitty и самую новую известную версию', zh: '显示 Toolkitty 版本和已知的最新版本', ja: 'Toolkitty のバージョンと既知の最新リリースを表示します', pt: 'Mostra a versão do Toolkitty e a versão mais recente conhecida', de: 'Zeigt die Toolkitty-Version und die neueste bekannte Version', ko: 'Toolkitty 버전과 알려진 최신 릴리스를 보여 줍니다' },
  toast: { en: 'Toolkitty {new} is out (you have {cur}): {name}', he: 'Toolkitty {new} יצאה (יש לך {cur}): {name}', es: 'Ya está Toolkitty {new} (tienes {cur}): {name}', fr: 'Toolkitty {new} est disponible (vous avez {cur}) : {name}', ru: 'Вышел Toolkitty {new} (у вас {cur}): {name}', zh: 'Toolkitty {new} 已发布（你当前是 {cur}）：{name}', ja: 'Toolkitty {new} が公開されました（現在 {cur}）：{name}', pt: 'O Toolkitty {new} saiu (você tem {cur}): {name}', de: 'Toolkitty {new} ist erschienen (du hast {cur}): {name}', ko: 'Toolkitty {new} 출시됨(현재 {cur}): {name}' },
  verCurrent: { en: 'Toolkitty version: {cur}', he: 'גרסת Toolkitty: {cur}', es: 'Versión de Toolkitty: {cur}', fr: 'Version de Toolkitty : {cur}', ru: 'Версия Toolkitty: {cur}', zh: 'Toolkitty 版本：{cur}', ja: 'Toolkitty のバージョン：{cur}', pt: 'Versão do Toolkitty: {cur}', de: 'Toolkitty-Version: {cur}', ko: 'Toolkitty 버전: {cur}' },
  verUnknown: { en: 'unknown', he: 'לא ידועה', es: 'desconocida', fr: 'inconnue', ru: 'неизвестна', zh: '未知', ja: '不明', pt: 'desconhecida', de: 'unbekannt', ko: '알 수 없음' },
  lastCheck: { en: 'Last check: {when}', he: 'בדיקה אחרונה: {when}', es: 'Última comprobación: {when}', fr: 'Dernière vérification : {when}', ru: 'Последняя проверка: {when}', zh: '上次检查：{when}', ja: '最終チェック：{when}', pt: 'Última verificação: {when}', de: 'Zuletzt geprüft: {when}', ko: '마지막 확인: {when}' },
  never: { en: 'never', he: 'מעולם לא', es: 'nunca', fr: 'jamais', ru: 'никогда', zh: '从未', ja: '未実施', pt: 'nunca', de: 'nie', ko: '없음' },
  newest: { en: 'Newest known release: {new} ({name})', he: 'הגרסה החדשה ביותר הידועה: {new} ({name})', es: 'Última versión conocida: {new} ({name})', fr: 'Dernière version connue : {new} ({name})', ru: 'Самая новая известная версия: {new} ({name})', zh: '已知最新版本：{new}（{name}）', ja: '既知の最新リリース：{new}（{name}）', pt: 'Versão mais recente conhecida: {new} ({name})', de: 'Neueste bekannte Version: {new} ({name})', ko: '알려진 최신 릴리스: {new}({name})' },
  newestNone: { en: 'Newest known release: none yet', he: 'הגרסה החדשה ביותר הידועה: עדיין אין', es: 'Última versión conocida: ninguna todavía', fr: "Dernière version connue : aucune pour l'instant", ru: 'Самая новая известная версия: пока нет', zh: '已知最新版本：暂无', ja: '既知の最新リリース：まだなし', pt: 'Versão mais recente conhecida: nenhuma ainda', de: 'Neueste bekannte Version: noch keine', ko: '알려진 최신 릴리스: 아직 없음' },
  upToDate: { en: 'You are up to date.', he: 'הגרסה שלך מעודכנת.', es: 'Estás al día.', fr: 'Vous êtes à jour.', ru: 'У вас последняя версия.', zh: '你已是最新版本。', ja: '最新の状態です。', pt: 'Você está atualizado.', de: 'Du bist auf dem neuesten Stand.', ko: '최신 버전입니다.' },
  newer: { en: 'A newer version is available.', he: 'קיימת גרסה חדשה יותר.', es: 'Hay una versión más reciente.', fr: 'Une version plus récente est disponible.', ru: 'Доступна более новая версия.', zh: '有可用的新版本。', ja: '新しいバージョンがあります。', pt: 'Há uma versão mais nova disponível.', de: 'Eine neuere Version ist verfügbar.', ko: '더 새로운 버전이 있습니다.' },
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

export const feature: Feature = {
  id: 'update-check',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const DAY_MS = 24 * 60 * 60 * 1000
const TIMEOUT_MS = 8000
const LAST_AT_KEY = 'update-check:lastAt'
const LAST_ATTEMPT_KEY = 'update-check:lastAttemptAt'
const LATEST_KEY = 'update-check:latest'

type Latest = { version: string; name: string }

/** Numeric parts of a version like "v1.2.3-beta.1": [1, 2, 3]; null when it has none. */
function parts(version: string): number[] | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version.trim())
  if (m === null) return null
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)]
}

/** Whether `a` is a higher semver than `b` (a pre-release suffix sorts below its release). */
function isNewer(a: string, b: string): boolean {
  const pa = parts(a)
  const pb = parts(b)
  if (pa === null || pb === null) return false
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y
  }
  const preA = /^v?[\d.]+-/.test(a.trim())
  const preB = /^v?[\d.]+-/.test(b.trim())
  return preB && !preA
}

const stripV = (tag: string): string => tag.trim().replace(/^v/i, '')

async function readVersion($: EngineInterface): Promise<string | null> {
  try {
    const raw = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object') {
      const v = (parsed as Record<string, unknown>)['version']
      if (typeof v === 'string' && v !== '') return v
    }
  } catch {
    // unreadable: unknown version
  }
  return null
}

/** One GET of the releases URL that gives up after TIMEOUT_MS. */
async function fetchLatest($: EngineInterface): Promise<{ status: number; ok: boolean; text: string }> {
  let timer: { cancel: () => void } | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = $.clock.after(TIMEOUT_MS, () => reject(new Error('timeout')))
  })
  try {
    return await Promise.race([$.http.fetch(RELEASES_URL, { headers: { accept: 'application/vnd.github+json' } }), timeout])
  } finally {
    timer?.cancel()
  }
}

function whenText(ms: number): string {
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  void e
  try {
    await $.command.register({ name: 'toolkitty-version', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'toolkitty-version', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  if (RELEASES_URL.includes('OWNER/REPO')) return

  const now = await $.clock.now()
  const lastAt = await storeGet<number>($, LAST_AT_KEY, 0)
  const lastAttemptAt = await storeGet<number>($, LAST_ATTEMPT_KEY, 0)
  if (now - Math.max(lastAt, lastAttemptAt) < DAY_MS) return

  try {
    const current = await readVersion($)
    if (current === null) return
    // Failed requests count toward the daily limit too. Keep lastAt for successful checks only.
    await storeSet($, LAST_ATTEMPT_KEY, now)
    const res = await fetchLatest($)
    if (!res.ok) return
    const body: unknown = JSON.parse(res.text)
    if (body === null || typeof body !== 'object') return
    const rec = body as Record<string, unknown>
    const tag = rec['tag_name']
    if (typeof tag !== 'string' || tag === '') return
    const version = stripV(tag)
    const releaseName = typeof rec['name'] === 'string' && rec['name'] !== '' ? rec['name'] : tag
    await storeSet($, LAST_AT_KEY, now)
    await storeSet($, LATEST_KEY, { version, name: releaseName })
    if (isNewer(version, current)) await notice($, 'alert', t(T.toast, { new: version, cur: current, name: releaseName }), feature.id)
  } catch {
    // offline, rate limited, bad JSON: stay silent
  }
}

export function register(on: On) {
  on('command.run', { command: 'toolkitty-version' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const current = await readVersion($)
    const lastAt = await storeGet<number>($, LAST_AT_KEY, 0)
    const latest = await storeGet<Latest | null>($, LATEST_KEY, null)
    const lines = [t(T.verCurrent, { cur: current ?? t(T.verUnknown) }), t(T.lastCheck, { when: lastAt > 0 ? whenText(lastAt) : t(T.never) })]
    if (latest === null) {
      lines.push(t(T.newestNone))
    } else {
      lines.push(t(T.newest, { new: latest.version, name: latest.name }))
      if (current !== null) lines.push(t(isNewer(latest.version, current) ? T.newer : T.upToDate))
    }
    return { text: lines.join('\n') }
  })
}
