import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { Feature, Input, Output } from '../core'

const T = {
  title: { en: 'Pinned files', he: 'קבצים מוצמדים', es: 'Archivos fijados', fr: 'Fichiers épinglés', ru: 'Закреплённые файлы', zh: '固定文件', ja: '固定ファイル', pt: 'Arquivos fixados', de: 'Angeheftete Dateien', ko: '고정 파일' },
  description: { en: '/pin pins files; their current contents are injected into the model every turn.', he: '/pin מצמיד קבצים; תוכנם הנוכחי מוזרק למודל בכל תור.', es: '/pin fija archivos; su contenido actual se inyecta en el modelo en cada turno.', fr: '/pin épingle des fichiers ; leur contenu actuel est injecté dans le modèle à chaque tour.', ru: '/pin закрепляет файлы; их текущее содержимое передаётся модели в каждом ходу.', zh: '/pin 固定文件；其当前内容会在每一轮注入模型。', ja: '/pin でファイルを固定します。現在の内容が毎ターンモデルに挿入されます。', pt: '/pin fixa arquivos; o conteúdo atual deles é injetado no modelo a cada turno.', de: '/pin heftet Dateien an; ihr aktueller Inhalt wird in jedem Durchgang ins Modell eingespeist.', ko: '/pin으로 파일을 고정하면 현재 내용이 매 턴마다 모델에 주입됩니다.' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  pinDesc: { en: 'Pins a file so its current contents are injected into the model every turn', he: 'מצמיד קובץ כך שתוכנו הנוכחי יוזרק למודל בכל תור', es: 'Fija un archivo para que su contenido actual se inyecte en el modelo en cada turno', fr: 'Épingle un fichier pour que son contenu actuel soit injecté dans le modèle à chaque tour', ru: 'Закрепляет файл, чтобы его текущее содержимое передавалось модели в каждом ходу', zh: '固定一个文件，使其当前内容在每一轮都注入模型', ja: 'ファイルを固定し、現在の内容を毎ターンモデルに挿入します', pt: 'Fixa um arquivo para que seu conteúdo atual seja injetado no modelo a cada turno', de: 'Heftet eine Datei an, damit ihr aktueller Inhalt in jedem Durchgang ins Modell eingespeist wird', ko: '파일을 고정해 현재 내용이 매 턴마다 모델에 주입되게 합니다' },
  pathHint: { en: '<path>', he: '<נתיב>', es: '<ruta>', fr: '<chemin>', ru: '<путь>', zh: '<路径>', ja: '<パス>', pt: '<caminho>', de: '<Pfad>', ko: '<경로>' },
  unpinDesc: { en: 'Removes a file from the pinned files', he: 'מסיר קובץ מהקבצים המוצמדים', es: 'Quita un archivo de los archivos fijados', fr: 'Retire un fichier des fichiers épinglés', ru: 'Убирает файл из закреплённых', zh: '从固定文件中移除一个文件', ja: '固定ファイルからファイルを外します', pt: 'Remove um arquivo dos arquivos fixados', de: 'Entfernt eine Datei aus den angehefteten Dateien', ko: '고정 파일에서 파일을 제거합니다' },
  pinsDesc: { en: 'Shows the pinned files in this folder', he: 'מציג את הקבצים המוצמדים בתיקייה הזו', es: 'Muestra los archivos fijados en esta carpeta', fr: 'Affiche les fichiers épinglés dans ce dossier', ru: 'Показывает закреплённые файлы в этой папке', zh: '显示此文件夹中的固定文件', ja: 'このフォルダの固定ファイルを表示します', pt: 'Mostra os arquivos fixados nesta pasta', de: 'Zeigt die angehefteten Dateien in diesem Ordner', ko: '이 폴더의 고정 파일을 보여 줍니다' },
  usagePin: { en: 'Usage: /pin <path>', he: 'שימוש: /pin <נתיב>', es: 'Uso: /pin <ruta>', fr: 'Utilisation : /pin <chemin>', ru: 'Использование: /pin <путь>', zh: '用法：/pin <路径>', ja: '使い方：/pin <パス>', pt: 'Uso: /pin <caminho>', de: 'Verwendung: /pin <Pfad>', ko: '사용법: /pin <경로>' },
  already: { en: 'The file is already pinned.', he: 'הקובץ כבר מוצמד.', es: 'El archivo ya está fijado.', fr: 'Le fichier est déjà épinglé.', ru: 'Файл уже закреплён.', zh: '该文件已被固定。', ja: 'このファイルはすでに固定されています。', pt: 'O arquivo já está fixado.', de: 'Die Datei ist bereits angeheftet.', ko: '이미 고정된 파일입니다.' },
  limit: { en: 'You can pin up to {n} files; remove one with /unpin.', he: 'אפשר להצמיד עד {n} קבצים; הסר אחד עם /unpin.', es: 'Puedes fijar hasta {n} archivos; quita uno con /unpin.', fr: 'Tu peux épingler jusqu’à {n} fichiers ; retires-en un avec /unpin.', ru: 'Можно закрепить до {n} файлов; уберите один командой /unpin.', zh: '最多可固定 {n} 个文件；用 /unpin 移除一个。', ja: '固定できるファイルは最大 {n} 件です。/unpin で外せます。', pt: 'Você pode fixar até {n} arquivos; remova um com /unpin.', de: 'Du kannst bis zu {n} Dateien anheften; entferne eine mit /unpin.', ko: '파일은 최대 {n}개까지 고정할 수 있습니다. /unpin으로 하나를 제거하세요.' },
  cantRead: { en: 'Cannot read {path}.', he: 'לא ניתן לקרוא את {path}.', es: 'No se puede leer {path}.', fr: 'Impossible de lire {path}.', ru: 'Не удаётся прочитать {path}.', zh: '无法读取 {path}。', ja: '{path} を読み取れません。', pt: 'Não foi possível ler {path}.', de: '{path} kann nicht gelesen werden.', ko: '{path}을(를) 읽을 수 없습니다.' },
  pinned: { en: 'Pinned: {path}', he: 'הוצמד: {path}', es: 'Fijado: {path}', fr: 'Épinglé : {path}', ru: 'Закреплён: {path}', zh: '已固定：{path}', ja: '固定しました：{path}', pt: 'Fixado: {path}', de: 'Angeheftet: {path}', ko: '고정됨: {path}' },
  usageUnpin: { en: 'Usage: /unpin <path>', he: 'שימוש: /unpin <נתיב>', es: 'Uso: /unpin <ruta>', fr: 'Utilisation : /unpin <chemin>', ru: 'Использование: /unpin <путь>', zh: '用法：/unpin <路径>', ja: '使い方：/unpin <パス>', pt: 'Uso: /unpin <caminho>', de: 'Verwendung: /unpin <Pfad>', ko: '사용법: /unpin <경로>' },
  notPinned: { en: '{path} is not pinned.', he: '{path} אינו מוצמד.', es: '{path} no está fijado.', fr: '{path} n\'est pas épinglé.', ru: '{path} не закреплён.', zh: '{path} 未被固定。', ja: '{path} は固定されていません。', pt: '{path} não está fixado.', de: '{path} ist nicht angeheftet.', ko: '{path}은(는) 고정되어 있지 않습니다.' },
  removed: { en: 'Removed: {path}', he: 'הוסר: {path}', es: 'Quitado: {path}', fr: 'Retiré : {path}', ru: 'Убран: {path}', zh: '已移除：{path}', ja: '外しました：{path}', pt: 'Removido: {path}', de: 'Entfernt: {path}', ko: '제거됨: {path}' },
  noPins: { en: 'No pinned files. Add one with /pin <path>.', he: 'אין קבצים מוצמדים. הוסף עם /pin <נתיב>.', es: 'No hay archivos fijados. Añade uno con /pin <ruta>.', fr: 'Aucun fichier épinglé. Ajoutes-en un avec /pin <chemin>.', ru: 'Нет закреплённых файлов. Добавьте командой /pin <путь>.', zh: '没有固定文件。用 /pin <路径> 添加。', ja: '固定ファイルはありません。/pin <パス> で追加できます。', pt: 'Nenhum arquivo fixado. Adicione um com /pin <caminho>.', de: 'Keine angehefteten Dateien. Füge eine mit /pin <Pfad> hinzu.', ko: '고정된 파일이 없습니다. /pin <경로>로 추가하세요.' },
  listHead: { en: 'Pinned files:', he: 'קבצים מוצמדים:', es: 'Archivos fijados:', fr: 'Fichiers épinglés :', ru: 'Закреплённые файлы:', zh: '固定文件：', ja: '固定ファイル：', pt: 'Arquivos fixados:', de: 'Angeheftete Dateien:', ko: '고정 파일:' },
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

type Pinned = { path: string; text: string }
type PinState = { cwd: string; files: Pinned[] }

const pins = atom({ plugin: 'toolkitty', key: 'slot', id: 'pinned-files' } as const, { cwd: '', files: [] }) as unknown as Atom<PinState>

const SECTION_ID = 'toolkitty:pinned-files'
const MAX_FILES = 5
const MAX_CHARS = 3000

const key = (cwd: string) => `pinned-files:${cwd}`
const isAbsolute = (p: string) => /^([a-zA-Z]:)?[\\/]/.test(p)
const resolvePath = (cwd: string, p: string) => (isAbsolute(p) ? p : `${cwd.replace(/[\\/]+$/, '')}/${p}`)
const sameFile = (a: string, b: string) => a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase()

export const feature: Feature = {
  id: 'pinned-files',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

async function refresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const paths = await storeGet<string[]>($, key(cwd), [])
  const files: Pinned[] = []
  for (const p of paths.slice(0, MAX_FILES)) {
    try {
      const content = await $.fs.read(resolvePath(cwd, p))
      files.push({ path: p, text: content.slice(0, MAX_CHARS) })
    } catch {
      files.push({ path: p, text: '(file could not be read)' })
    }
  }
  const prev = await read($, pins)
  await update($, pins, () => ({ cwd, files }))
  if (JSON.stringify(prev.files) !== JSON.stringify(files)) $.ui.invalidate('prompt.section')
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({
      name: 'pin',
      description: t(T.pinDesc),
      argumentHint: t(T.pathHint),
    })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'pin', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  try {
    await $.command.register({ name: 'unpin', description: t(T.unpinDesc), argumentHint: t(T.pathHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'unpin', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  try {
    await $.command.register({ name: 'pins', description: t(T.pinsDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'pins', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (await isOn($, feature)) await refresh($)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await refresh($)
}

export async function onPromptCompose(
  $: EngineInterface,
  e: Input<'prompt.compose'>,
  result: Output<'prompt.compose'>,
): Promise<Output<'prompt.compose'>> {
  if (!(await isOn($, feature))) return result

  const { files } = await read($, pins)
  if (files.length === 0) return result

  const parts = ['# Pinned files (current contents; the user pinned these for reference)']
  // 4,000 characters in all: share the budget so every pinned file shows.
  const each = Math.min(MAX_CHARS, Math.floor(3600 / files.length))
  for (const f of files) parts.push(`## ${f.path}\n${f.text.slice(0, each)}`)
  const text = parts.join('\n\n').slice(0, 3990)

  return {
    ...result,
    sections: [
      ...result.sections.filter(s => s.id !== SECTION_ID),
      { id: SECTION_ID, text, scope: 'session' as const },
    ],
  }
}

export function register(on: On) {
    on('command.run', { command: 'pin' }, async ($, e) => {
      if (!(await isOn($, feature))) return { text: t(T.off) }
      const path = e.args.trim().replace(/^["']|["']$/g, '')
      if (path === '') return { text: t(T.usagePin) }

      const cwd = await $.session.cwd()
      const list = await storeGet<string[]>($, key(cwd), [])
      if (list.some(p => sameFile(p, path))) return { text: t(T.already) }
      if (list.length >= MAX_FILES) return { text: t(T.limit, { n: MAX_FILES }) }

      try {
        await $.fs.read(resolvePath(cwd, path))
      } catch {
        return { text: t(T.cantRead, { path }) }
      }
      await storeSet($, key(cwd), [...list, path])
      await refresh($)
      return { text: t(T.pinned, { path }) }
    })

    on('command.run', { command: 'unpin' }, async ($, e) => {
      if (!(await isOn($, feature))) return { text: t(T.off) }
      const path = e.args.trim().replace(/^["']|["']$/g, '')
      if (path === '') return { text: t(T.usageUnpin) }

      const cwd = await $.session.cwd()
      const list = await storeGet<string[]>($, key(cwd), [])
      const rest = list.filter(p => !sameFile(p, path))
      if (rest.length === list.length) return { text: t(T.notPinned, { path }) }
      await storeSet($, key(cwd), rest)
      await refresh($)
      return { text: t(T.removed, { path }) }
    })

    on('command.run', { command: 'pins' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(T.off) }
      const cwd = await $.session.cwd()
      const list = await storeGet<string[]>($, key(cwd), [])
      if (list.length === 0) return { text: t(T.noPins) }
      return { text: [t(T.listHead), ...list.map((p, i) => `${i + 1}. ${p}`)].join('\n') }
    })
}
