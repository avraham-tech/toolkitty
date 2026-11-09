import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { Incidents } from '../shared'
import type { BandInput, BandLine, Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { ICONS } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: { en: 'Scope guard', he: 'שומר היקף', es: 'Guardián de alcance', fr: 'Garde de périmètre', ru: 'Ограничитель области', zh: '范围防护', ja: 'スコープガード', pt: 'Guarda de escopo', de: 'Bereichswächter', ko: '범위 가드' },
  description: { en: '/scope limits file edits to the paths you declare; edits outside them are blocked.', he: '/scope מגביל עריכות קבצים לנתיבים שהגדרת; עריכות מחוץ להם נחסמות.', es: '/scope limita las ediciones de archivos a las rutas que declares; las ediciones fuera de ellas se bloquean.', fr: '/scope limite les modifications de fichiers aux chemins que tu déclares ; celles en dehors sont bloquées.', ru: '/scope ограничивает правки файлов объявленными путями; правки вне них блокируются.', zh: '/scope 将文件编辑限制在你声明的路径内；范围外的编辑会被拦截。', ja: '/scope はファイル編集を宣言したパス内に制限し、範囲外の編集をブロックします。', pt: '/scope limita as edições de arquivos aos caminhos que você declara; edições fora deles são bloqueadas.', de: '/scope beschränkt Dateibearbeitungen auf die von dir angegebenen Pfade; Bearbeitungen außerhalb werden blockiert.', ko: '/scope는 파일 편집을 선언한 경로로 제한하며, 범위 밖 편집은 차단됩니다.' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  cmdDesc: { en: 'Limits edits to declared paths: /scope add <glob>, remove <glob>, clear, or no argument to list', he: 'מגביל עריכות לנתיבים מוגדרים: /scope add <glob>, remove <glob>, clear, או בלי ארגומנט להצגה', es: 'Limita las ediciones a rutas declaradas: /scope add <glob>, remove <glob>, clear, o sin argumento para listar', fr: 'Limite les modifications aux chemins déclarés : /scope add <glob>, remove <glob>, clear, ou sans argument pour lister', ru: 'Ограничивает правки объявленными путями: /scope add <glob>, remove <glob>, clear или без аргумента для списка', zh: '将编辑限制在声明的路径内：/scope add <glob>、remove <glob>、clear，不带参数则列出', ja: '編集を宣言したパスに制限：/scope add <glob>、remove <glob>、clear、引数なしで一覧表示', pt: 'Limita edições aos caminhos declarados: /scope add <glob>, remove <glob>, clear, ou sem argumento para listar', de: 'Beschränkt Bearbeitungen auf angegebene Pfade: /scope add <glob>, remove <glob>, clear oder ohne Argument zum Auflisten', ko: '편집을 선언한 경로로 제한: /scope add <glob>, remove <glob>, clear, 인수가 없으면 목록 표시' },
  argHint: { en: 'add|remove <glob> | clear', he: 'add|remove <glob> | clear', es: 'add|remove <glob> | clear', fr: 'add|remove <glob> | clear', ru: 'add|remove <glob> | clear', zh: 'add|remove <glob> | clear', ja: 'add|remove <glob> | clear', pt: 'add|remove <glob> | clear', de: 'add|remove <glob> | clear', ko: 'add|remove <glob> | clear' },
  usage: { en: 'Usage: /scope add <glob> | /scope remove <glob> | /scope clear | /scope', he: 'שימוש: /scope add <glob> | /scope remove <glob> | /scope clear | /scope', es: 'Uso: /scope add <glob> | /scope remove <glob> | /scope clear | /scope', fr: 'Utilisation : /scope add <glob> | /scope remove <glob> | /scope clear | /scope', ru: 'Использование: /scope add <glob> | /scope remove <glob> | /scope clear | /scope', zh: '用法：/scope add <glob> | /scope remove <glob> | /scope clear | /scope', ja: '使い方：/scope add <glob> | /scope remove <glob> | /scope clear | /scope', pt: 'Uso: /scope add <glob> | /scope remove <glob> | /scope clear | /scope', de: 'Verwendung: /scope add <glob> | /scope remove <glob> | /scope clear | /scope', ko: '사용법: /scope add <glob> | /scope remove <glob> | /scope clear | /scope' },
  added: { en: 'Added to scope: {glob}', he: 'נוסף להיקף: {glob}', es: 'Añadido al alcance: {glob}', fr: 'Ajouté au périmètre : {glob}', ru: 'Добавлено в область: {glob}', zh: '已加入范围：{glob}', ja: 'スコープに追加しました：{glob}', pt: 'Adicionado ao escopo: {glob}', de: 'Zum Bereich hinzugefügt: {glob}', ko: '범위에 추가됨: {glob}' },
  already: { en: '{glob} is already in the scope.', he: '{glob} כבר בהיקף.', es: '{glob} ya está en el alcance.', fr: '{glob} est déjà dans le périmètre.', ru: '{glob} уже в области.', zh: '{glob} 已在范围内。', ja: '{glob} はすでにスコープに含まれています。', pt: '{glob} já está no escopo.', de: '{glob} ist bereits im Bereich.', ko: '{glob}은(는) 이미 범위에 있습니다.' },
  removed: { en: 'Removed from scope: {glob}', he: 'הוסר מההיקף: {glob}', es: 'Quitado del alcance: {glob}', fr: 'Retiré du périmètre : {glob}', ru: 'Убрано из области: {glob}', zh: '已从范围移除：{glob}', ja: 'スコープから外しました：{glob}', pt: 'Removido do escopo: {glob}', de: 'Aus dem Bereich entfernt: {glob}', ko: '범위에서 제거됨: {glob}' },
  notThere: { en: '{glob} is not in the scope.', he: '{glob} אינו בהיקף.', es: '{glob} no está en el alcance.', fr: '{glob} n\'est pas dans le périmètre.', ru: '{glob} нет в области.', zh: '{glob} 不在范围内。', ja: '{glob} はスコープに含まれていません。', pt: '{glob} não está no escopo.', de: '{glob} ist nicht im Bereich.', ko: '{glob}은(는) 범위에 없습니다.' },
  cleared: { en: 'Scope cleared; edits are no longer restricted in this project.', he: 'ההיקף נוקה; העריכות אינן מוגבלות עוד בפרויקט הזה.', es: 'Alcance borrado; las ediciones ya no están restringidas en este proyecto.', fr: 'Périmètre effacé ; les modifications ne sont plus restreintes dans ce projet.', ru: 'Область очищена; правки в этом проекте больше не ограничены.', zh: '范围已清除；此项目的编辑不再受限制。', ja: 'スコープをクリアしました。このプロジェクトの編集は制限されなくなりました。', pt: 'Escopo limpo; as edições não são mais restritas neste projeto.', de: 'Bereich geleert; Bearbeitungen sind in diesem Projekt nicht mehr beschränkt.', ko: '범위를 지웠습니다. 이 프로젝트에서 편집이 더 이상 제한되지 않습니다.' },
  empty: { en: 'No scope is set: edits are not restricted. Add one with /scope add <glob>.', he: 'לא הוגדר היקף: העריכות אינן מוגבלות. הוסף עם /scope add <glob>.', es: 'No hay alcance definido: las ediciones no están restringidas. Añade uno con /scope add <glob>.', fr: 'Aucun périmètre défini : les modifications ne sont pas restreintes. Ajoutes-en un avec /scope add <glob>.', ru: 'Область не задана: правки не ограничены. Добавьте её командой /scope add <glob>.', zh: '尚未设置范围：编辑不受限制。用 /scope add <glob> 添加。', ja: 'スコープは未設定です：編集は制限されません。/scope add <glob> で追加できます。', pt: 'Nenhum escopo definido: as edições não são restritas. Adicione um com /scope add <glob>.', de: 'Kein Bereich festgelegt: Bearbeitungen sind nicht beschränkt. Füge einen mit /scope add <glob> hinzu.', ko: '설정된 범위가 없습니다: 편집이 제한되지 않습니다. /scope add <glob>으로 추가하세요.' },
  listHead: { en: 'Edits are limited to these paths:', he: 'העריכות מוגבלות לנתיבים האלה:', es: 'Las ediciones están limitadas a estas rutas:', fr: 'Les modifications sont limitées à ces chemins :', ru: 'Правки ограничены этими путями:', zh: '编辑仅限于以下路径：', ja: '編集は次のパスに制限されています：', pt: 'As edições estão limitadas a estes caminhos:', de: 'Bearbeitungen sind auf diese Pfade beschränkt:', ko: '편집은 다음 경로로 제한됩니다:' },
  deny: { en: 'Toolkitty · Scope guard: {path} is outside the allowed scope for this project. Allowed: {globs}. Ask the user to run /scope add <glob> if this file should be editable, or turn the feature off in the /toolkitty pane.', he: 'Toolkitty · שומר היקף: {path} נמצא מחוץ להיקף המותר בפרויקט הזה. מותר: {globs}. בקש מהמשתמש להריץ /scope add <glob> אם יש לאפשר עריכה של הקובץ, או כבה את השכלול בלוח /toolkitty.', es: 'Toolkitty · Guardián de alcance: {path} está fuera del alcance permitido en este proyecto. Permitido: {globs}. Pide al usuario que ejecute /scope add <glob> si este archivo debe ser editable, o desactiva la función en el panel /toolkitty.', fr: 'Toolkitty · Garde de périmètre : {path} est en dehors du périmètre autorisé pour ce projet. Autorisé : {globs}. Demandez à l\'utilisateur d\'exécuter /scope add <glob> si ce fichier doit être modifiable, ou désactivez la fonctionnalité dans le panneau /toolkitty.', ru: 'Toolkitty · Ограничитель области: {path} вне разрешённой области этого проекта. Разрешено: {globs}. Попросите пользователя выполнить /scope add <glob>, если файл можно править, или выключите функцию в панели /toolkitty.', zh: 'Toolkitty · 范围防护：{path} 超出了此项目的允许范围。允许范围：{globs}。如果该文件应可编辑，请让用户运行 /scope add <glob>，或在 /toolkitty 面板中关闭此功能。', ja: 'Toolkitty · スコープガード：{path} はこのプロジェクトの許可スコープ外です。許可：{globs}。このファイルを編集可能にするには、ユーザーに /scope add <glob> の実行を依頼するか、/toolkitty ペインでこの機能をオフにしてください。', pt: 'Toolkitty · Guarda de escopo: {path} está fora do escopo permitido deste projeto. Permitido: {globs}. Peça ao usuário para executar /scope add <glob> se este arquivo deve ser editável, ou desative o recurso no painel /toolkitty.', de: 'Toolkitty · Bereichswächter: {path} liegt außerhalb des erlaubten Bereichs dieses Projekts. Erlaubt: {globs}. Bitte den Nutzer, /scope add <glob> auszuführen, wenn diese Datei bearbeitbar sein soll, oder schalte die Funktion im Panel /toolkitty aus.', ko: 'Toolkitty · 범위 가드: {path}은(는) 이 프로젝트의 허용 범위 밖입니다. 허용: {globs}. 이 파일을 편집할 수 있어야 한다면 사용자에게 /scope add <glob> 실행을 요청하거나, /toolkitty 창에서 이 기능을 끄세요.' },
  chipScope: { en: 'scope {n}', he: 'היקף {n}', es: 'alcance {n}', fr: 'périm. {n}', ru: 'область {n}', zh: '范围 {n}', ja: 'スコープ {n}', pt: 'escopo {n}', de: 'Bereich {n}', ko: '범위 {n}' },
  bandOne: { en: '🔒 scope: 1 glob', he: '🔒 היקף: glob אחד', es: '🔒 alcance: 1 glob', fr: '🔒 périmètre : 1 glob', ru: '🔒 область: 1 glob', zh: '🔒 范围：1 个 glob', ja: '🔒 スコープ：glob 1 件', pt: '🔒 escopo: 1 glob', de: '🔒 Bereich: 1 Glob', ko: '🔒 범위: glob 1개' },
  bandMany: { en: '🔒 scope: {n} globs', he: '🔒 היקף: {n} globs', es: '🔒 alcance: {n} globs', fr: '🔒 périmètre : {n} globs', ru: '🔒 область: {n} globs', zh: '🔒 范围：{n} 个 glob', ja: '🔒 スコープ：glob {n} 件', pt: '🔒 escopo: {n} globs', de: '🔒 Bereich: {n} Globs', ko: '🔒 범위: glob {n}개' },
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

type State = { cwd: string; globs: string[] }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'scope-guard' } as const, { cwd: '', globs: [] } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'scope-guard',
  title: T.title,
  description: T.description,
  defaultOn: false,
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

const storeKey = (cwd: string) => `scope-guard:${cwd}`
const slashes = (p: string) => p.replace(/\\/g, '/')
/** Resolves `.` and `..` segments, so `src/../secret.ts` cannot pass for something inside `src/`. */
function collapsePath(raw: string): string {
  const p = slashes(raw)
  const drive = /^[a-zA-Z]:/.exec(p)?.[0] ?? ''
  const rest = p.slice(drive.length)
  const isRooted = rest.startsWith('/')
  const out: string[] = []
  for (const seg of rest.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
      else if (!isRooted && drive === '') out.push('..')
      continue
    }
    out.push(seg)
  }
  return `${drive}${isRooted ? '/' : ''}${out.join('/')}`
}
const isWindowsPath = (p: string) => /^[a-zA-Z]:/.test(p) || p.includes('\\')

function normalizeGlob(raw: string): string {
  let g = slashes(raw.trim().replace(/^["']|["']$/g, ''))
  while (g.startsWith('./')) g = g.slice(2)
  return g
}

/** `*` stays inside a path segment, `**` crosses segments, `?` is one character. A glob with no slash matches at any depth; a directory glob covers what is inside it. */
function globToRegExp(raw: string, caseless: boolean): RegExp {
  let g = normalizeGlob(raw)
  if (g.endsWith('/')) g = `${g}**`
  if (!g.includes('/')) g = `**/${g}`
  let out = ''
  let i = 0
  while (i < g.length) {
    const ch = g.charAt(i)
    if (ch === '*') {
      if (g.charAt(i + 1) === '*') {
        if (g.charAt(i + 2) === '/') {
          out += '(?:.*/)?'
          i += 3
        } else {
          out += '.*'
          i += 2
        }
      } else {
        out += '[^/]*'
        i += 1
      }
    } else if (ch === '?') {
      out += '[^/]'
      i += 1
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')
      i += 1
    }
  }
  return new RegExp(`^${out}(?:/.*)?$`, caseless ? 'i' : '')
}

function relativeTo(cwd: string, file: string): string {
  const base = slashes(cwd).replace(/\/+$/, '')
  const target = slashes(file)
  const caseless = isWindowsPath(cwd) || isWindowsPath(file)
  const a = caseless ? base.toLowerCase() : base
  const b = caseless ? target.toLowerCase() : target
  if (b === a) return ''
  if (b.startsWith(`${a}/`)) return target.slice(base.length + 1)
  return target
}

function allowed(globs: readonly string[], cwd: string, file: string): boolean {
  const caseless = isWindowsPath(cwd) || isWindowsPath(file)
  const rel = relativeTo(cwd, file)
  const abs = slashes(file)
  return globs.some(g => {
    const re = globToRegExp(g, caseless)
    return re.test(rel) || re.test(abs)
  })
}

async function loadScope($: EngineInterface): Promise<State> {
  const cwd = await $.session.cwd()
  const cur = await read($, state)
  if (cur.cwd === cwd) return cur
  const globs = await storeGet<string[]>($, storeKey(cwd), [])
  await update($, state, () => ({ cwd, globs }))
  return { cwd, globs }
}

async function saveScope($: EngineInterface, cwd: string, globs: string[]): Promise<void> {
  await storeSet($, storeKey(cwd), globs)
  await update($, state, () => ({ cwd, globs }))
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'scope', description: t(T.cmdDesc), argumentHint: t(T.argHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'scope', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (await isOn($, feature)) await loadScope($)
}

export async function beforeEditCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined
  if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit') return undefined

  const scope = await loadScope($)
  if (scope.globs.length === 0) return undefined

  const x = e as unknown as Record<string, unknown>
  const raw = x['file_path'] ?? x['notebook_path']
  if (typeof raw !== 'string' || raw === '') return undefined

  const file = collapsePath(raw)
  if (allowed(scope.globs, scope.cwd, file)) return undefined

  const shown = relativeTo(scope.cwd, file) || file
  await reportIncident($, 'scope', shown)
  return { deny: t(T.deny, { path: shown, globs: scope.globs.join(', ') }) }
}

/** The short band form: "scope 3" while edits are limited to globs. Quiet without a scope. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const { globs } = await read($, state)
  if (globs.length === 0) return null
  return { text: t(T.chipScope, { n: globs.length }), level: 'info', icon: ICONS.guard }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const { globs } = await read($, state)
  if (globs.length === 0) return null

  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      {globs.length === 1 ? t(T.bandOne) : t(T.bandMany, { n: globs.length })}
    </Text>
  )
}

export function register(on: On) {
  on('command.run', { command: 'scope' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const scope = await loadScope($)
    const args = e.args.trim()
    const match = /^(\S+)\s*([\s\S]*)$/.exec(args)
    const verb = match === null ? '' : (match[1] ?? '').toLowerCase()
    const rest = match === null ? '' : normalizeGlob(match[2] ?? '')

    if (verb === '' || verb === 'list') {
      if (scope.globs.length === 0) return { text: t(T.empty) }
      return { text: [t(T.listHead), ...scope.globs.map(g => `- ${g}`)].join('\n') }
    }

    if (verb === 'clear') {
      await saveScope($, scope.cwd, [])
      return { text: t(T.cleared) }
    }

    if (verb === 'add' && rest !== '') {
      if (scope.globs.some(g => g.toLowerCase() === rest.toLowerCase())) return { text: t(T.already, { glob: rest }) }
      await saveScope($, scope.cwd, [...scope.globs, rest])
      return { text: t(T.added, { glob: rest }) }
    }

    if ((verb === 'remove' || verb === 'rm') && rest !== '') {
      const kept = scope.globs.filter(g => g.toLowerCase() !== rest.toLowerCase())
      if (kept.length === scope.globs.length) return { text: t(T.notThere, { glob: rest }) }
      await saveScope($, scope.cwd, kept)
      return { text: t(T.removed, { glob: rest }) }
    }

    return { text: t(T.usage) }
  })
}
