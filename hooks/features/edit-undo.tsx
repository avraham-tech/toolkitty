import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, language, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Undo edits', he: 'ביטול עריכות', es: 'Deshacer ediciones', fr: 'Annuler les modifications', ru: 'Отмена правок', zh: '撤销编辑', ja: '編集を元に戻す', pt: 'Desfazer edições', de: 'Änderungen rückgängig', ko: '편집 되돌리기' },
  description: {
    en: 'Saves a version before every edit; /edit-undo restores the last one, /edit-undo list shows the list.',
    he: 'שומר גרסה לפני כל עריכה; /edit-undo משחזר את האחרונה, /edit-undo list מציג את הרשימה.',
    es: 'Guarda una versión antes de cada edición; /edit-undo restaura la última, /edit-undo list muestra la lista.',
    fr: 'Enregistre une version avant chaque modification ; /edit-undo restaure la dernière, /edit-undo list affiche la liste.',
    ru: 'Сохраняет версию перед каждой правкой; /edit-undo восстанавливает последнюю, /edit-undo list показывает список.',
    zh: '每次编辑前保存一个版本；/edit-undo 恢复最近一个，/edit-undo list 显示列表。',
    ja: '編集のたびに事前にバージョンを保存します。/edit-undo で直近のものを復元、/edit-undo list で一覧を表示します。',
    pt: 'Salva uma versão antes de cada edição; /edit-undo restaura a última, /edit-undo list mostra a lista.',
    de: 'Speichert vor jeder Änderung eine Version; /edit-undo stellt die letzte wieder her, /edit-undo list zeigt die Liste.',
    ko: '편집할 때마다 먼저 버전을 저장합니다. /edit-undo는 마지막 버전을 복원하고, /edit-undo list는 목록을 보여줍니다.',
  },
  commandDesc: {
    en: 'Restores the last file Claude edited (list: shows the list)',
    he: 'משחזר את הקובץ האחרון שה-Claude ערך (list: מציג את הרשימה)',
    es: 'Restaura el último archivo que editó Claude (list: muestra la lista)',
    fr: 'Restaure le dernier fichier modifié par Claude (list : affiche la liste)',
    ru: 'Восстанавливает последний файл, изменённый Claude (list: показывает список)',
    zh: '恢复 Claude 最近编辑的文件（list：显示列表）',
    ja: 'Claude が最後に編集したファイルを復元します（list: 一覧を表示）',
    pt: 'Restaura o último arquivo editado pelo Claude (list: mostra a lista)',
    de: 'Stellt die zuletzt von Claude bearbeitete Datei wieder her (list: zeigt die Liste)',
    ko: 'Claude가 마지막으로 편집한 파일을 복원합니다 (list: 목록 표시)',
  },
  off: {
    en: 'Undo edits is turned off in the Toolkitty pane.',
    he: 'ביטול עריכות כבוי בלוח ה-Toolkitty.',
    es: 'Deshacer ediciones está desactivado en el panel de Toolkitty.',
    fr: "Annuler les modifications est désactivé dans le panneau Toolkitty.",
    ru: 'Отмена правок отключена в панели Toolkitty.',
    zh: '撤销编辑已在 Toolkitty 面板中关闭。',
    ja: '「編集を元に戻す」は Toolkitty パネルでオフになっています。',
    pt: 'Desfazer edições está desativado no painel do Toolkitty.',
    de: '„Änderungen rückgängig“ ist im Toolkitty-Bereich ausgeschaltet.',
    ko: '편집 되돌리기가 Toolkitty 패널에서 꺼져 있습니다.',
  },
  nothing: {
    en: 'No edits to restore.',
    he: 'אין עריכות לשחזור.',
    es: 'No hay ediciones para restaurar.',
    fr: 'Aucune modification à restaurer.',
    ru: 'Нет правок для восстановления.',
    zh: '没有可恢复的编辑。',
    ja: '復元できる編集はありません。',
    pt: 'Nenhuma edição para restaurar.',
    de: 'Keine Änderungen zum Wiederherstellen.',
    ko: '복원할 편집이 없습니다.',
  },
  failed: {
    en: 'Restore failed: {path}',
    he: 'השחזור נכשל: {path}',
    es: 'La restauración falló: {path}',
    fr: 'La restauration a échoué : {path}',
    ru: 'Не удалось восстановить: {path}',
    zh: '恢复失败：{path}',
    ja: '復元に失敗しました: {path}',
    pt: 'Falha ao restaurar: {path}',
    de: 'Wiederherstellung fehlgeschlagen: {path}',
    ko: '복원 실패: {path}',
  },
  restored: {
    en: 'Restored: {path}',
    he: 'שוחזר: {path}',
    es: 'Restaurado: {path}',
    fr: 'Restauré : {path}',
    ru: 'Восстановлено: {path}',
    zh: '已恢复：{path}',
    ja: '復元しました: {path}',
    pt: 'Restaurado: {path}',
    de: 'Wiederhergestellt: {path}',
    ko: '복원됨: {path}',
  },
} as const

type Snapshot = { path: string; text: string; at: number }
type State = { stack: Snapshot[] }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'edit-undo' } as const, { stack: [] }) as unknown as Atom<State>

const MAX_FILE = 400 * 1024
const MAX_TOTAL = 2 * 1024 * 1024
const MAX_ENTRIES = 20

const pathOf = (e: object): string | undefined => {
  const x = e as Record<string, unknown>
  const p = x['file_path'] ?? x['notebook_path']
  return typeof p === 'string' ? p : undefined
}

/** Keeps the newest entries within the count and byte caps. */
const cap = (stack: Snapshot[]): Snapshot[] => {
  const out = stack.slice(-MAX_ENTRIES)
  let total = out.reduce((n, s) => n + s.text.length, 0)
  while (out.length > 1 && total > MAX_TOTAL) {
    total -= out.shift()?.text.length ?? 0
  }
  return out
}

export const feature: Feature = {
  id: 'edit-undo',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({
      name: 'edit-undo',
      description: t(T.commandDesc),
      argumentHint: '[list]',
    })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'edit-undo', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function beforeEditCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit') return undefined
  if (!(await isOn($, feature))) return undefined

  const path = pathOf(e)
  if (path !== undefined) {
    try {
      if (await $.fs.exists(path)) {
        const stat = await $.fs.stat(path)
        if (stat.kind === 'file' && stat.size <= MAX_FILE) {
          const text = await $.fs.read(path)
          const at = await $.clock.now()
          await update($, state, s => ({ stack: cap([...s.stack, { path, text, at }]) }))
        }
      }
    } catch {
      // an unreadable file is simply not snapshotted
    }
  }

  return undefined
}

export function register(on: On) {
    on('command.run', { command: 'edit-undo' }, async ($, e) => {
      if (!(await isOn($, feature))) return { text: t(T.off) }

      const { stack } = await read($, state)

      if (e.args.trim() === 'list') {
        if (stack.length === 0) return { text: t(T.nothing) }
        const lines = [...stack].reverse().map((s, i) => {
          const time = new Date(s.at).toLocaleTimeString(language())
          return `${i + 1}. ${s.path} (${time})`
        })
        return { text: lines.join('\n') }
      }

      const last = stack[stack.length - 1]
      if (last === undefined) return { text: t(T.nothing) }

      try {
        await $.fs.write(last.path, last.text)
      } catch {
        return { text: t(T.failed, { path: last.path }) }
      }
      await update($, state, s => ({ stack: s.stack.slice(0, -1) }))
      return { text: t(T.restored, { path: last.path }) }
    })
}
