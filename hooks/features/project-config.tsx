import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { LANGS, isOn, language, notice, setLanguage, setNoticePrefs, storeGet, storeSet, t } from '../core'
import type { Feature, Input, Lang } from '../core'
import { buildProfileMap, isProfileName } from './profiles'
import type { ProfileName, ProfileState } from './profiles'
// The catalogue is injected by register.tsx (an import of './index' would be circular).
let features: Feature[] = []

/** Called once by register.tsx before any hook runs. */
export function setCatalog(list: Feature[]): void {
  features = list
}

const T = {
  title: { en: 'Project profiles', he: 'פרופילי פרויקט', es: 'Perfiles de proyecto', fr: 'Profils de projet', ru: 'Профили проекта', zh: '项目配置', ja: 'プロジェクトプロファイル', pt: 'Perfis de projeto', de: 'Projektprofile', ko: '프로젝트 프로필' },
  description: {
    en: 'Reads .claude/toolkitty.json from the repo so a team shares one setup; /toolkitty-export writes it, /toolkitty-profile shows it',
    he: 'קורא את .claude/toolkitty.json מהמאגר כדי שצוות ישתף הגדרה אחת; /toolkitty-export כותב אותו, /toolkitty-profile מציג אותו',
    es: 'Lee .claude/toolkitty.json del repositorio para que un equipo comparta la misma configuración; /toolkitty-export lo escribe, /toolkitty-profile lo muestra',
    fr: 'Lit .claude/toolkitty.json du dépôt pour qu’une équipe partage la même configuration ; /toolkitty-export l’écrit, /toolkitty-profile l’affiche',
    ru: 'Читает .claude/toolkitty.json из репозитория, чтобы команда использовала одну настройку; /toolkitty-export записывает его, /toolkitty-profile показывает',
    zh: '从仓库读取 .claude/toolkitty.json，让团队共用一套设置；/toolkitty-export 写入它，/toolkitty-profile 显示它',
    ja: 'リポジトリの .claude/toolkitty.json を読み込み、チームで同じ設定を共有します。/toolkitty-export で書き出し、/toolkitty-profile で表示',
    pt: 'Lê .claude/toolkitty.json do repositório para a equipe compartilhar uma configuração; /toolkitty-export o grava, /toolkitty-profile o mostra',
    de: 'Liest .claude/toolkitty.json aus dem Repo, damit ein Team ein Setup teilt; /toolkitty-export schreibt sie, /toolkitty-profile zeigt sie',
    ko: '저장소의 .claude/toolkitty.json을 읽어 팀이 같은 설정을 공유합니다. /toolkitty-export로 쓰고 /toolkitty-profile로 봅니다',
  },
  exportDesc: { en: 'Writes the current Toolkitty setup to .claude/toolkitty.json', he: 'כותב את הגדרות Toolkitty הנוכחיות אל .claude/toolkitty.json', es: 'Escribe la configuración actual de Toolkitty en .claude/toolkitty.json', fr: 'Écrit la configuration actuelle de Toolkitty dans .claude/toolkitty.json', ru: 'Записывает текущую настройку Toolkitty в .claude/toolkitty.json', zh: '将当前 Toolkitty 设置写入 .claude/toolkitty.json', ja: '現在の Toolkitty 設定を .claude/toolkitty.json に書き出します', pt: 'Grava a configuração atual do Toolkitty em .claude/toolkitty.json', de: 'Schreibt das aktuelle Toolkitty-Setup nach .claude/toolkitty.json', ko: '현재 Toolkitty 설정을 .claude/toolkitty.json에 씁니다' },
  profileDesc: { en: 'Shows what .claude/toolkitty.json sets for this project', he: 'מציג מה .claude/toolkitty.json קובע לפרויקט הזה', es: 'Muestra lo que .claude/toolkitty.json define para este proyecto', fr: 'Affiche ce que .claude/toolkitty.json définit pour ce projet', ru: 'Показывает, что задаёт .claude/toolkitty.json для этого проекта', zh: '显示 .claude/toolkitty.json 为此项目设置了什么', ja: '.claude/toolkitty.json がこのプロジェクトに設定している内容を表示します', pt: 'Mostra o que .claude/toolkitty.json define para este projeto', de: 'Zeigt, was .claude/toolkitty.json für dieses Projekt festlegt', ko: '.claude/toolkitty.json이 이 프로젝트에 설정한 내용을 보여 줍니다' },
  off: { en: 'Project profiles are turned off in the switchboard.', he: 'פרופילי הפרויקט כבויים בלוח המתגים.', es: 'Los perfiles de proyecto están desactivados en el panel.', fr: 'Les profils de projet sont désactivés dans le panneau des interrupteurs.', ru: 'Профили проекта выключены в панели.', zh: '项目配置已在开关面板中关闭。', ja: 'プロジェクトプロファイルはスイッチパネルでオフになっています。', pt: 'Os perfis de projeto estão desativados no painel de controle.', de: 'Projektprofile sind in der Schaltzentrale aus.', ko: '프로젝트 프로필은 스위치 패널에서 꺼져 있습니다.' },
  applied: { en: 'Toolkitty: project profile applied ({n} features)', he: 'Toolkitty: פרופיל הפרויקט הוחל ({n} שכלולים)', es: 'Toolkitty: perfil del proyecto aplicado ({n} funciones)', fr: 'Toolkitty : profil du projet appliqué ({n} fonctions)', ru: 'Toolkitty: профиль проекта применён ({n} функций)', zh: 'Toolkitty：已应用项目配置（{n} 项功能）', ja: 'Toolkitty：プロジェクトプロファイルを適用しました（{n} 機能）', pt: 'Toolkitty: perfil de projeto aplicado ({n} recursos)', de: 'Toolkitty: Projektprofil angewendet ({n} Funktionen)', ko: 'Toolkitty: 프로젝트 프로필 적용됨(기능 {n}개)' },
  exported: { en: 'Toolkitty setup written to {path}', he: 'הגדרות Toolkitty נכתבו אל {path}', es: 'Configuración de Toolkitty escrita en {path}', fr: 'Configuration de Toolkitty écrite dans {path}', ru: 'Настройка Toolkitty записана в {path}', zh: 'Toolkitty 设置已写入 {path}', ja: 'Toolkitty の設定を {path} に書き出しました', pt: 'Configuração do Toolkitty gravada em {path}', de: 'Toolkitty-Setup nach {path} geschrieben', ko: 'Toolkitty 설정을 {path}에 썼습니다' },
  exportFailed: { en: 'Could not write {path}: {message}', he: 'לא ניתן לכתוב את {path}: {message}', es: 'No se pudo escribir {path}: {message}', fr: 'Impossible d’écrire {path} : {message}', ru: 'Не удалось записать {path}: {message}', zh: '无法写入 {path}：{message}', ja: '{path} に書き込めませんでした：{message}', pt: 'Não foi possível gravar {path}: {message}', de: '{path} konnte nicht geschrieben werden: {message}', ko: '{path}에 쓸 수 없습니다: {message}' },
  noFile: { en: 'No project profile: {path} does not exist. /toolkitty-export creates it from your current setup.', he: 'אין פרופיל פרויקט: {path} לא קיים. /toolkitty-export יוצר אותו מההגדרות הנוכחיות.', es: 'Sin perfil de proyecto: {path} no existe. /toolkitty-export lo crea desde tu configuración actual.', fr: 'Aucun profil de projet : {path} n’existe pas. /toolkitty-export le crée à partir de ta configuration actuelle.', ru: 'Профиля проекта нет: {path} не существует. /toolkitty-export создаст его из текущей настройки.', zh: '没有项目配置：{path} 不存在。/toolkitty-export 会根据你当前的设置创建它。', ja: 'プロジェクトプロファイルがありません：{path} が存在しません。/toolkitty-export で現在の設定から作成できます。', pt: 'Sem perfil de projeto: {path} não existe. /toolkitty-export o cria a partir da sua configuração atual.', de: 'Kein Projektprofil: {path} existiert nicht. /toolkitty-export erstellt es aus deinem aktuellen Setup.', ko: '프로젝트 프로필이 없습니다: {path}이(가) 없습니다. /toolkitty-export가 현재 설정으로 만들어 줍니다.' },
  invalid: { en: 'Project profile {path} is not valid: {reason}', he: 'פרופיל הפרויקט {path} אינו תקין: {reason}', es: 'El perfil de proyecto {path} no es válido: {reason}', fr: 'Le profil de projet {path} n’est pas valide : {reason}', ru: 'Профиль проекта {path} недействителен: {reason}', zh: '项目配置 {path} 无效：{reason}', ja: 'プロジェクトプロファイル {path} は無効です：{reason}', pt: 'O perfil de projeto {path} não é válido: {reason}', de: 'Projektprofil {path} ist ungültig: {reason}', ko: '프로젝트 프로필 {path}이(가) 올바르지 않습니다: {reason}' },
  notObject: { en: 'the file must hold a JSON object', he: 'הקובץ חייב להכיל אובייקט JSON', es: 'el archivo debe contener un objeto JSON', fr: 'le fichier doit contenir un objet JSON', ru: 'файл должен содержать объект JSON', zh: '文件必须是一个 JSON 对象', ja: 'ファイルは JSON オブジェクトである必要があります', pt: 'o arquivo deve conter um objeto JSON', de: 'die Datei muss ein JSON-Objekt enthalten', ko: '파일은 JSON 객체여야 합니다' },
  badJson: { en: 'not JSON', he: 'לא JSON', es: 'no es JSON', fr: 'pas du JSON', ru: 'не JSON', zh: '不是 JSON', ja: 'JSON ではありません', pt: 'não é JSON', de: 'kein JSON', ko: 'JSON이 아님' },
  header: { en: 'Project profile ({path})', he: 'פרופיל פרויקט ({path})', es: 'Perfil de proyecto ({path})', fr: 'Profil de projet ({path})', ru: 'Профиль проекта ({path})', zh: '项目配置（{path}）', ja: 'プロジェクトプロファイル（{path}）', pt: 'Perfil de projeto ({path})', de: 'Projektprofil ({path})', ko: '프로젝트 프로필({path})' },
  featuresOn: { en: 'Turned on ({n}): {list}', he: 'מופעלים ({n}): {list}', es: 'Activadas ({n}): {list}', fr: 'Activées ({n}) : {list}', ru: 'Включено ({n}): {list}', zh: '已开启（{n}）：{list}', ja: 'オンにした項目（{n}）：{list}', pt: 'Ativados ({n}): {list}', de: 'Eingeschaltet ({n}): {list}', ko: '켜짐({n}): {list}' },
  featuresOff: { en: 'Turned off ({n}): {list}', he: 'כבויים ({n}): {list}', es: 'Desactivadas ({n}): {list}', fr: 'Désactivées ({n}) : {list}', ru: 'Выключено ({n}): {list}', zh: '已关闭（{n}）：{list}', ja: 'オフにした項目（{n}）：{list}', pt: 'Desativados ({n}): {list}', de: 'Ausgeschaltet ({n}): {list}', ko: '꺼짐({n}): {list}' },
  profileLine: { en: 'Display profile: {name}', he: 'פרופיל תצוגה: {name}', es: 'Perfil de visualización: {name}', fr: 'Profil d’affichage : {name}', ru: 'Профиль отображения: {name}', zh: '显示配置：{name}', ja: '表示プロファイル：{name}', pt: 'Perfil de exibição: {name}', de: 'Anzeigeprofil: {name}', ko: '표시 프로필: {name}' },
  languageLine: { en: 'Language: {lang}', he: 'שפה: {lang}', es: 'Idioma: {lang}', fr: 'Langue : {lang}', ru: 'Язык: {lang}', zh: '语言：{lang}', ja: '言語：{lang}', pt: 'Idioma: {lang}', de: 'Sprache: {lang}', ko: '언어: {lang}' },
  scopeLine: { en: 'Edit scope ({n}): {list}', he: 'תחום עריכה ({n}): {list}', es: 'Ámbito de edición ({n}): {list}', fr: 'Périmètre d’édition ({n}) : {list}', ru: 'Область правок ({n}): {list}', zh: '编辑范围（{n}）：{list}', ja: '編集スコープ（{n}）：{list}', pt: 'Escopo de edição ({n}): {list}', de: 'Bearbeitungsbereich ({n}): {list}', ko: '편집 범위({n}): {list}' },
  budgetLine: { en: 'Budget: weekly {weekly}, five-hour {fiveHour}', he: 'תקציב: שבועי {weekly}, חמש שעות {fiveHour}', es: 'Presupuesto: semanal {weekly}, cinco horas {fiveHour}', fr: 'Budget : hebdomadaire {weekly}, cinq heures {fiveHour}', ru: 'Бюджет: неделя {weekly}, пять часов {fiveHour}', zh: '预算：每周 {weekly}，五小时 {fiveHour}', ja: '予算：週 {weekly}、5 時間 {fiveHour}', pt: 'Orçamento: semanal {weekly}, cinco horas {fiveHour}', de: 'Budget: wöchentlich {weekly}, fünf Stunden {fiveHour}', ko: '예산: 주간 {weekly}, 5시간 {fiveHour}' },
  unset: { en: 'unchanged', he: 'ללא שינוי', es: 'sin cambios', fr: 'inchangé', ru: 'без изменений', zh: '未更改', ja: '変更なし', pt: 'inalterado', de: 'unverändert', ko: '변경 없음' },
  empty: { en: 'The file sets nothing.', he: 'הקובץ לא קובע דבר.', es: 'El archivo no define nada.', fr: 'Le fichier ne définit rien.', ru: 'Файл ничего не задаёт.', zh: '该文件没有设置任何内容。', ja: 'このファイルには何も設定されていません。', pt: 'O arquivo não define nada.', de: 'Die Datei legt nichts fest.', ko: '이 파일은 아무것도 설정하지 않습니다.' },
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

type Budget = { weekly?: number; fiveHour?: number }
type Config = { enabled: Record<string, boolean>; profile?: ProfileName; language?: Lang; scope?: string[]; budget?: Budget }
type State = { path: string; mtimeMs: number }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'project-config' } as const, { path: '', mtimeMs: 0 } as State) as unknown as Atom<State>
const enabled = atom({ plugin: 'toolkitty', key: 'enabled' } as const, {} as Record<string, boolean>) as unknown as Atom<Record<string, boolean>>
// The same shared slot profiles.tsx keeps: which display profile is applied, and the map it set.
const profileState = atom({ plugin: 'toolkitty', key: 'slot', id: 'profiles' } as const, { profile: null, applied: {} } as ProfileState) as unknown as Atom<ProfileState>

export const feature: Feature = { id: 'project-config', title: T.title, description: T.description, defaultOn: true }

/** Whether this session already showed the "applied" toast. */
let toasted = false

const isLang = (value: unknown): value is Lang => typeof value === 'string' && (LANGS as readonly string[]).includes(value)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

/** Validates defensively: unknown or malformed parts are dropped; a non-object file is an error (the reason's text). */
function parseConfig(text: string): Config | string {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return t(T.badJson)
  }
  if (!isRecord(raw)) return t(T.notObject)
  const config: Config = { enabled: {} }
  if (isRecord(raw.enabled)) {
    for (const [id, value] of Object.entries(raw.enabled)) {
      if (typeof value === 'boolean' && /^[a-z0-9-]{1,64}$/.test(id)) config.enabled[id] = value
    }
  }
  if (isProfileName(raw.profile)) config.profile = raw.profile
  if (isLang(raw.language)) config.language = raw.language
  if (Array.isArray(raw.scope)) {
    config.scope = raw.scope.filter((g): g is string => typeof g === 'string' && g.trim() !== '').map(g => g.trim()).slice(0, 200)
  }
  if (isRecord(raw.budget)) {
    const budget: Budget = {}
    if (isAmount(raw.budget.weekly)) budget.weekly = raw.budget.weekly
    if (isAmount(raw.budget.fiveHour)) budget.fiveHour = raw.budget.fiveHour
    if (budget.weekly !== undefined || budget.fiveHour !== undefined) config.budget = budget
  }
  return config
}

async function configPath($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd()
  return `${cwd.replace(/[\\/]+$/, '')}/.claude/toolkitty.json`
}

/** The file's modification time, or null when it is missing. */
async function mtimeOf($: EngineInterface, path: string): Promise<number | null> {
  try {
    return (await $.fs.stat(path)).mtimeMs
  } catch {
    return null
  }
}

/** Applies the file when it exists and, unless `force`, changed since the last look. */
async function applyFile($: EngineInterface, force: boolean): Promise<void> {
  const path = await configPath($)
  const mtimeMs = await mtimeOf($, path)
  if (mtimeMs === null) return
  const seen = await read($, state)
  if (!force && seen.path === path && seen.mtimeMs === mtimeMs) return
  await update($, state, () => ({ path, mtimeMs }))

  let text: string
  try {
    text = await $.fs.read(path)
  } catch {
    return
  }
  const config = parseConfig(text)
  if (typeof config === 'string') {
    await notice($, 'warn', t(T.invalid, { path, reason: config }), feature.id)
    return
  }

  let ids = Object.keys(config.enabled)
  if (config.profile !== undefined || ids.length > 0) {
    let merged = { ...(await read($, enabled)) }
    if (config.profile !== undefined) {
      // The repo's profile first; its `enabled` entries then override single features.
      const profile = config.profile
      const base = { ...buildProfileMap(profile, features, merged), ...config.enabled }
      const before = await $.store.get('profile')
      merged = { ...merged, ...base }
      ids = Object.keys(base)
      await $.store.set('profile', profile)
      await $.store.set('profiles:applied', { profile, map: base })
      await $.store.set('profiles:overrides', {})
      await update($, profileState, () => ({ profile, applied: base }))
      // The same quiet-mode rule as switching profiles by hand.
      if (profile === 'minimal') await setNoticePrefs($, { quiet: true })
      else if (before === 'minimal') await setNoticePrefs($, { quiet: false })
    } else {
      merged = { ...merged, ...config.enabled }
    }
    await update($, enabled, () => merged)
    await storeSet($, 'enabled', merged)
  }
  if (config.language !== undefined && config.language !== language()) await setLanguage($, config.language)
  if (config.scope !== undefined) {
    const cwd = await $.session.cwd()
    await storeSet($, `scope-guard:${cwd}`, config.scope)
  }
  if (config.budget !== undefined) {
    const existing = await storeGet<Record<string, number | boolean>>($, 'budget-guard:settings', {})
    await storeSet($, 'budget-guard:settings', { ...existing, ...config.budget })
  }
  if (!toasted) {
    toasted = true
    await notice($, 'info', t(T.applied, { n: ids.length }), feature.id)
  }
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'toolkitty-export', description: t(T.exportDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'toolkitty-export', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  try {
    await $.command.register({ name: 'toolkitty-profile', description: t(T.profileDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'toolkitty-profile', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  toasted = false
  await applyFile($, true)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (!(await isOn($, feature))) return
  await applyFile($, false)
}

export function register(on: On) {
  on('command.run', { command: 'toolkitty-export' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const path = await configPath($)
    const cwd = await $.session.cwd()
    const current = await read($, enabled)
    const all: Record<string, boolean> = {}
    for (const f of features) all[f.id] = current[f.id] ?? f.defaultOn
    const scope = await storeGet<string[]>($, `scope-guard:${cwd}`, [])
    const out: Config = { enabled: all, language: language() }
    if (scope.length > 0) out.scope = scope
    try {
      await $.fs.write(path, JSON.stringify(out, null, 2) + '\n')
    } catch (err) {
      return { text: t(T.exportFailed, { path, message: err instanceof Error ? err.message : String(err) }) }
    }
    // Remember the file as it now stands, so the next turn does not re-apply our own export over later changes.
    const written = await mtimeOf($, path)
    await update($, state, () => ({ path, mtimeMs: written ?? 0 }))
    const message = t(T.exported, { path })
    await notice($, 'info', message, feature.id)
    return { text: message }
  })

  on('command.run', { command: 'toolkitty-profile' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const path = await configPath($)
    if ((await mtimeOf($, path)) === null) return { text: t(T.noFile, { path }) }
    let text: string
    try {
      text = await $.fs.read(path)
    } catch (err) {
      return { text: t(T.invalid, { path, reason: err instanceof Error ? err.message : String(err) }) }
    }
    const config = parseConfig(text)
    if (typeof config === 'string') return { text: t(T.invalid, { path, reason: config }) }

    const lines: string[] = [t(T.header, { path })]
    const onIds = Object.keys(config.enabled).filter(id => config.enabled[id] === true)
    const offIds = Object.keys(config.enabled).filter(id => config.enabled[id] === false)
    if (onIds.length > 0) lines.push(t(T.featuresOn, { n: onIds.length, list: onIds.join(', ') }))
    if (offIds.length > 0) lines.push(t(T.featuresOff, { n: offIds.length, list: offIds.join(', ') }))
    if (config.profile !== undefined) lines.push(t(T.profileLine, { name: config.profile }))
    if (config.language !== undefined) lines.push(t(T.languageLine, { lang: config.language }))
    if (config.scope !== undefined) lines.push(t(T.scopeLine, { n: config.scope.length, list: config.scope.join(', ') }))
    if (config.budget !== undefined) {
      lines.push(
        t(T.budgetLine, {
          weekly: config.budget.weekly === undefined ? t(T.unset) : config.budget.weekly,
          fiveHour: config.budget.fiveHour === undefined ? t(T.unset) : config.budget.fiveHour,
        }),
      )
    }
    if (lines.length === 1) lines.push(t(T.empty))
    return { text: lines.join('\n') }
  })
}
