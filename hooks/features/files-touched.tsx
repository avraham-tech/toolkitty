import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input } from '../core'
import { emptyState, listRow, paneHeader } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Files this turn', he: 'קבצים בתור', es: 'Archivos del turno', fr: 'Fichiers du tour', ru: 'Файлы хода', zh: '本轮文件', ja: 'このターンのファイル', pt: 'Arquivos neste turno', de: 'Dateien in diesem Durchgang', ko: '이번 턴의 파일' },
  description: {
    en: 'A pane with the files read and edited in the current turn (the /files-touched command).',
    he: 'חלונית עם הקבצים שנקראו ונערכו בתור הנוכחי (הפקודה /files-touched).',
    es: 'Un panel con los archivos leídos y editados en el turno actual (el comando /files-touched).',
    fr: 'Un panneau avec les fichiers lus et modifiés pendant le tour en cours (la commande /files-touched).',
    ru: 'Панель с файлами, прочитанными и изменёнными в текущем ходе (команда /files-touched).',
    zh: '显示本轮中读取和编辑过的文件的面板（/files-touched 命令）。',
    ja: '現在のターンで読み取り・編集したファイルを表示するペイン（/files-touched コマンド）。',
    pt: 'Um painel com os arquivos lidos e editados no turno atual (o comando /files-touched).',
    de: 'Ein Panel mit den im aktuellen Durchgang gelesenen und bearbeiteten Dateien (Befehl /files-touched).',
    ko: '현재 턴에서 읽거나 편집한 파일을 보여 주는 창입니다(/files-touched 명령).',
  },
  commandDesc: {
    en: 'Opens a pane with the files read and edited in the current turn',
    he: 'פותח חלונית עם הקבצים שנקראו ונערכו בתור הנוכחי',
    es: 'Abre un panel con los archivos leídos y editados en el turno actual',
    fr: 'Ouvre un panneau avec les fichiers lus et modifiés pendant le tour en cours',
    ru: 'Открывает панель с файлами, прочитанными и изменёнными в текущем ходе',
    zh: '打开面板，显示本轮中读取和编辑过的文件',
    ja: '現在のターンで読み取り・編集したファイルのペインを開きます',
    pt: 'Abre um painel com os arquivos lidos e editados no turno atual',
    de: 'Öffnet ein Panel mit den im aktuellen Durchgang gelesenen und bearbeiteten Dateien',
    ko: '현재 턴에서 읽거나 편집한 파일을 보여 주는 창을 엽니다',
  },
  off: {
    en: 'The "Files this turn" feature is turned off in the switchboard.',
    he: 'שכלול "קבצים בתור" כבוי בלוח המתגים.',
    es: 'La función "Archivos del turno" está desactivada en el panel de interruptores.',
    fr: 'La fonctionnalité « Fichiers du tour » est désactivée dans le panneau des interrupteurs.',
    ru: 'Функция «Файлы хода» отключена в панели переключателей.',
    zh: '“本轮文件”功能已在开关面板中关闭。',
    ja: '「このターンのファイル」機能はスイッチパネルでオフになっています。',
    pt: 'O recurso "Arquivos neste turno" está desativado no painel de controle.',
    de: 'Die Funktion „Dateien in diesem Durchgang“ ist in der Schaltzentrale aus.',
    ko: '"이번 턴의 파일" 기능이 스위치 패널에서 꺼져 있습니다.',
  },
  opened: {
    en: 'The files pane was opened.',
    he: 'חלונית הקבצים נפתחה.',
    es: 'Se abrió el panel de archivos.',
    fr: 'Le panneau des fichiers a été ouvert.',
    ru: 'Панель файлов открыта.',
    zh: '已打开文件面板。',
    ja: 'ファイルペインを開きました。',
    pt: 'O painel de arquivos foi aberto.',
    de: 'Das Datei-Panel wurde geöffnet.',
    ko: '파일 창을 열었습니다.',
  },
  paneOff: {
    en: 'The feature is turned off in the switchboard.',
    he: 'השכלול כבוי בלוח המתגים.',
    es: 'La función está desactivada en el panel de interruptores.',
    fr: 'La fonctionnalité est désactivée dans le panneau des interrupteurs.',
    ru: 'Функция отключена в панели переключателей.',
    zh: '该功能已在开关面板中关闭。',
    ja: 'この機能はスイッチパネルでオフになっています。',
    pt: 'O recurso está desativado no painel de controle.',
    de: 'Die Funktion ist in der Schaltzentrale aus.',
    ko: '이 기능은 스위치 패널에서 꺼져 있습니다.',
  },
  summary: {
    en: 'Files this turn: {n} · edited {edited}',
    he: 'קבצים בתור הזה: {n} · נערכו {edited}',
    es: 'Archivos en este turno: {n} · editados {edited}',
    fr: 'Fichiers de ce tour : {n} · modifiés {edited}',
    ru: 'Файлов в этом ходе: {n} · изменено {edited}',
    zh: '本轮文件：{n} · 已编辑 {edited}',
    ja: 'このターンのファイル：{n} · 編集 {edited}',
    pt: 'Arquivos neste turno: {n} · editados {edited}',
    de: 'Dateien in diesem Durchgang: {n} · bearbeitet {edited}',
    ko: '이번 턴 파일: {n} · 편집 {edited}',
  },
  status: {
    en: '{n} · edited {edited}',
    he: '{n} · נערכו {edited}',
    es: '{n} · editados {edited}',
    fr: '{n} · modifiés {edited}',
    ru: '{n} · изменено {edited}',
    zh: '{n} · 已编辑 {edited}',
    ja: '{n} · 編集 {edited}',
    pt: '{n} · editados {edited}',
    de: '{n} · bearbeitet {edited}',
    ko: '{n} · 편집 {edited}',
  },
  emptyHint: {
    en: 'Files Claude reads or edits during a turn are listed here; the list resets with each new turn.',
    he: 'קבצים ש-Claude קורא או עורך במהלך תור מופיעים כאן; הרשימה מתאפסת בכל תור חדש.',
    es: 'Los archivos que Claude lee o edita durante un turno aparecen aquí; la lista se reinicia en cada turno nuevo.',
    fr: 'Les fichiers que Claude lit ou modifie pendant un tour apparaissent ici ; la liste repart à zéro à chaque nouveau tour.',
    ru: 'Файлы, которые Claude читает или правит в ходе, появятся здесь; список сбрасывается с каждым новым ходом.',
    zh: 'Claude 在一轮中读取或编辑的文件会列在这里；每开始新的一轮列表都会重置。',
    ja: 'Claude がターン中に読み取ったり編集したりしたファイルがここに表示されます。リストは新しいターンごとにリセットされます。',
    pt: 'Os arquivos que o Claude lê ou edita durante um turno são listados aqui; a lista é zerada a cada novo turno.',
    de: 'Dateien, die Claude während eines Durchgangs liest oder bearbeitet, werden hier aufgelistet; die Liste wird bei jedem neuen Durchgang zurückgesetzt.',
    ko: 'Claude가 턴 중에 읽거나 편집한 파일이 여기에 표시되며, 새 턴마다 목록이 초기화됩니다.',
  },
  empty: {
    en: 'No files touched yet.',
    he: 'עדיין לא נגעו בקבצים.',
    es: 'Aún no se ha tocado ningún archivo.',
    fr: "Aucun fichier touché pour l'instant.",
    ru: 'Файлы пока не затронуты.',
    zh: '还没有涉及任何文件。',
    ja: 'まだ操作されたファイルはありません。',
    pt: 'Nenhum arquivo tocado ainda.',
    de: 'Noch keine Dateien berührt.',
    ko: '아직 다룬 파일이 없습니다.',
  },
  edited: { en: 'edited', he: 'נערך', es: 'editado', fr: 'modifié', ru: 'изменён', zh: '已编辑', ja: '編集済み', pt: 'editado', de: 'bearbeitet', ko: '편집됨' },
  read: { en: 'read', he: 'נקרא', es: 'leído', fr: 'lu', ru: 'прочитан', zh: '已读取', ja: '読み取り', pt: 'lido', de: 'gelesen', ko: '읽음' },
  more: {
    en: '{n} more files...',
    he: 'ועוד {n} קבצים...',
    es: 'y {n} archivos más...',
    fr: 'et {n} fichiers de plus...',
    ru: 'и ещё {n} файлов...',
    zh: '还有 {n} 个文件……',
    ja: 'ほか {n} ファイル…',
    pt: 'mais {n} arquivos...',
    de: '{n} weitere Dateien...',
    ko: '파일 {n}개 더...',
  },
} as const

type Entry = { path: string; kind: 'read' | 'edited' }

const touched = atom({ plugin: 'toolkitty', key: 'slot', id: 'files-touched' } as const, []) as unknown as Atom<Entry[]>

const MAX = 100

async function record($: EngineInterface, path: string | undefined, kind: Entry['kind']) {
  if (path === undefined || path === '') return
  await update($, touched, list => {
    const found = list.find(x => x.path === path)
    if (found !== undefined) {
      return list.map(x => (x.path === path ? { path, kind: kind === 'edited' ? 'edited' : x.kind } : x))
    }
    return [...list, { path, kind }].slice(-MAX)
  })
}

export const feature: Feature = {
  id: 'files-touched',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'files-touched', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'files-touched', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await update($, touched, () => [])
}

export function register(on: On) {
    on('command.run', { command: 'files-touched' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(T.off) }
      await $.ui.open({ id: 'files-touched', title: t(T.title) })
      return { text: t(T.opened) }
    })

    on('tool.call', { tool: 'Read' }, async ($, e, next) => {
      if (!(await isOn($, feature))) return next(e)
      await record($, e.file_path, 'read')
      return next(e)
    })

    on('tool.call', { tool: 'Glob' }, async ($, e, next) => {
      if (!(await isOn($, feature))) return next(e)
      await record($, e.path, 'read')
      return next(e)
    })

    on('tool.call', { tool: 'Grep' }, async ($, e, next) => {
      if (!(await isOn($, feature))) return next(e)
      await record($, e.path, 'read')
      return next(e)
    })

    on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
      if (!(await isOn($, feature))) return next(e)
      await record($, e.file_path, 'edited')
      return next(e)
    })

    on('tool.call', { tool: 'Write' }, async ($, e, next) => {
      if (!(await isOn($, feature))) return next(e)
      await record($, e.file_path, 'edited')
      return next(e)
    })

    on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
      if (!(await isOn($, feature))) return next(e)
      await record($, e.notebook_path, 'edited')
      return next(e)
    })

    on('ui.render', { component: 'Pane', requestId: 'files-touched' }, async ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

      const list = await read($, touched)
      const room = Math.max(3, (e.viewport?.rows ?? 20) - 3)
      const shown = list.slice(-room)
      const edited = list.filter(x => x.kind === 'edited').length

      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.title), status: t(T.status, { n: list.length, edited }), level: edited > 0 ? 'warn' : 'ok' })}
          {list.length === 0 ? emptyState($, e, t(T.empty), t(T.emptyHint)) : null}
          {shown.map(x =>
            listRow($, e, {
              key: `f-${x.path}`,
              left: x.kind === 'edited' ? t(T.edited) : t(T.read),
              text: x.path,
              level: x.kind === 'edited' ? 'warn' : 'ok',
            }),
          )}
          {list.length > shown.length && <Text dimColor>{t(T.more, { n: list.length - shown.length })}</Text>}
        </Box>
      )
    })
}
