import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { recordEvidence } from '../evidence'
import { publish, retractAll } from '../signals'
import { ICONS, emptyState, paneHeader } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: {
    en: 'Diff review',
    he: 'סקירת שינויים',
    es: 'Revisión de cambios',
    fr: 'Revue des modifications',
    ru: 'Обзор изменений',
    zh: '差异审查',
    ja: '差分レビュー',
    pt: 'Revisão de diff',
    de: 'Diff-Review',
    ko: '변경 검토',
  },
  description: {
    en: 'After a turn, /diff-review lists the files it changed with +added −removed lines and lets you revert each one.',
    he: 'אחרי תור, /diff-review מציג את הקבצים ששונו עם שורות שנוספו ושהוסרו ומאפשר לשחזר כל אחד.',
    es: 'Tras un turno, /diff-review lista los archivos cambiados con líneas añadidas y quitadas y permite revertir cada uno.',
    fr: 'Après un tour, /diff-review liste les fichiers modifiés avec les lignes ajoutées et retirées et permet de les rétablir un par un.',
    ru: 'После хода /diff-review показывает изменённые файлы со строками +добавлено −удалено и позволяет откатить каждый.',
    zh: '一轮结束后，/diff-review 会列出它修改的文件及 +新增 −删除的行数，并允许你逐个还原。',
    ja: 'ターンの後、/diff-review が変更されたファイルを +追加 −削除 の行数付きで一覧にし、ファイルごとに元に戻せます。',
    pt: 'Após um turno, /diff-review lista os arquivos alterados com as linhas +adicionadas −removidas e permite reverter cada um.',
    de: 'Nach einem Durchgang listet /diff-review die geänderten Dateien mit +hinzugefügten −entfernten Zeilen auf und lässt dich jede einzeln zurücksetzen.',
    ko: '턴이 끝나면 /diff-review가 변경된 파일을 +추가 −삭제 줄 수와 함께 나열하고 파일별로 되돌릴 수 있게 합니다.',
  },
  commandDesc: {
    en: 'Reviews and reverts the files the last turn changed',
    he: 'סוקר ומשחזר את הקבצים שהתור האחרון שינה',
    es: 'Revisa y revierte los archivos que cambió el último turno',
    fr: 'Passe en revue et rétablit les fichiers modifiés au dernier tour',
    ru: 'Просмотр и откат файлов, изменённых последним ходом',
    zh: '审查并还原上一轮修改的文件',
    ja: '直前のターンで変更されたファイルをレビューし、元に戻します',
    pt: 'Revisa e reverte os arquivos alterados no último turno',
    de: 'Prüft und setzt die im letzten Durchgang geänderten Dateien zurück',
    ko: '마지막 턴에서 변경된 파일을 검토하고 되돌립니다',
  },
  off: {
    en: 'Diff review is turned off in the Toolkitty pane.',
    he: 'סקירת השינויים כבויה בלוח ה-Toolkitty.',
    es: 'La revisión de cambios está desactivada en el panel de Toolkitty.',
    fr: 'La revue des modifications est désactivée dans le panneau Toolkitty.',
    ru: 'Обзор изменений отключён в панели Toolkitty.',
    zh: '差异审查已在 Toolkitty 面板中关闭。',
    ja: '差分レビューは Toolkitty ペインでオフになっています。',
    pt: 'A revisão de diff está desativada no painel do Toolkitty.',
    de: 'Diff-Review ist im Toolkitty-Panel ausgeschaltet.',
    ko: '변경 검토가 Toolkitty 창에서 꺼져 있습니다.',
  },
  opened: { en: 'Review pane opened.', he: 'לוח הסקירה נפתח.', es: 'Panel de revisión abierto.', fr: 'Panneau de revue ouvert.', ru: 'Панель обзора открыта.', zh: '已打开审查面板。', ja: 'レビューペインを開きました。', pt: 'Painel de revisão aberto.', de: 'Review-Panel geöffnet.', ko: '검토 창을 열었습니다.' },
  paneTitle: { en: 'Review', he: 'סקירה', es: 'Revisión', fr: 'Revue', ru: 'Обзор', zh: '审查', ja: 'レビュー', pt: 'Revisão', de: 'Review', ko: '검토' },
  paneOff: {
    en: 'Diff review is turned off.',
    he: 'סקירת השינויים כבויה.',
    es: 'La revisión de cambios está desactivada.',
    fr: 'La revue des modifications est désactivée.',
    ru: 'Обзор изменений отключён.',
    zh: '差异审查已关闭。',
    ja: '差分レビューはオフです。',
    pt: 'A revisão de diff está desativada.',
    de: 'Diff-Review ist aus.',
    ko: '변경 검토가 꺼져 있습니다.',
  },
  empty: {
    en: 'No changes to review from the last turn.',
    he: 'אין שינויים לסקירה מהתור האחרון.',
    es: 'No hay cambios que revisar del último turno.',
    fr: 'Aucune modification à revoir du dernier tour.',
    ru: 'Нет изменений последнего хода для обзора.',
    zh: '上一轮没有需要审查的更改。',
    ja: '直前のターンにレビューする変更はありません。',
    pt: 'Sem alterações para revisar do último turno.',
    de: 'Keine Änderungen aus dem letzten Durchgang zu prüfen.',
    ko: '마지막 턴에서 검토할 변경 사항이 없습니다.',
  },
  revert: { en: 'revert', he: 'שחזר', es: 'revertir', fr: 'rétablir', ru: 'откатить', zh: '还原', ja: '元に戻す', pt: 'reverter', de: 'zurücksetzen', ko: '되돌리기' },
  revertAll: { en: 'revert all', he: 'שחזר הכל', es: 'revertir todo', fr: 'tout rétablir', ru: 'откатить всё', zh: '全部还原', ja: 'すべて元に戻す', pt: 'reverter tudo', de: 'alles zurücksetzen', ko: '모두 되돌리기' },
  keep: { en: 'keep', he: 'השאר', es: 'conservar', fr: 'garder', ru: 'оставить', zh: '保留', ja: '保持', pt: 'manter', de: 'behalten', ko: '유지' },
  created: { en: 'new', he: 'חדש', es: 'nuevo', fr: 'nouveau', ru: 'новый', zh: '新增', ja: '新規', pt: 'novo', de: 'neu', ko: '신규' },
  reverted: { en: 'Reverted: {name}', he: 'שוחזר: {name}', es: 'Revertido: {name}', fr: 'Rétabli : {name}', ru: 'Откачено: {name}', zh: '已还原：{name}', ja: '元に戻しました: {name}', pt: 'Revertido: {name}', de: 'Zurückgesetzt: {name}', ko: '되돌림: {name}' },
  revertFailed: {
    en: 'Could not revert: {name}',
    he: 'השחזור נכשל: {name}',
    es: 'No se pudo revertir: {name}',
    fr: 'Impossible de rétablir : {name}',
    ru: 'Не удалось откатить: {name}',
    zh: '无法还原：{name}',
    ja: '元に戻せませんでした: {name}',
    pt: 'Não foi possível reverter: {name}',
    de: 'Zurücksetzen nicht möglich: {name}',
    ko: '되돌릴 수 없음: {name}',
  },
  revertedAll: {
    en: 'Reverted {n} files',
    he: 'שוחזרו {n} קבצים',
    es: 'Se revirtieron {n} archivos',
    fr: '{n} fichiers rétablis',
    ru: 'Откачено файлов: {n}',
    zh: '已还原 {n} 个文件',
    ja: '{n} 個のファイルを元に戻しました',
    pt: '{n} arquivos revertidos',
    de: '{n} Dateien zurückgesetzt',
    ko: '파일 {n}개를 되돌렸습니다',
  },
  emptyHint: {
    en: 'After a turn that edits files, they are listed here to keep or revert.',
    he: 'אחרי תור שעורך קבצים, הם יופיעו כאן לשמירה או לשחזור.',
    es: 'Tras un turno que edite archivos, aparecerán aquí para conservarlos o revertirlos.',
    fr: 'Après un tour qui modifie des fichiers, ils apparaissent ici pour les garder ou les rétablir.',
    ru: 'После хода с правками файлы появятся здесь: оставить или откатить.',
    zh: '在修改文件的一轮之后，这些文件会列在这里，供你保留或还原。',
    ja: 'ファイルを編集したターンの後、それらがここに一覧表示され、保持するか元に戻すかを選べます。',
    pt: 'Após um turno que edita arquivos, eles são listados aqui para manter ou reverter.',
    de: 'Nach einem Durchgang, der Dateien ändert, werden sie hier zum Behalten oder Zurücksetzen aufgelistet.',
    ko: '파일을 편집한 턴이 끝나면 해당 파일이 여기에 나열되어 유지하거나 되돌릴 수 있습니다.',
  },
  statusFiles: { en: '{n} files', he: '{n} קבצים', es: '{n} archivos', fr: '{n} fichiers', ru: 'файлов: {n}', zh: '{n} 个文件', ja: '{n} ファイル', pt: '{n} arquivos', de: '{n} Dateien', ko: '파일 {n}개' },
  toastOne: {
    en: '✎ 1 file changed · /diff-review',
    he: '✎ קובץ אחד שונה · /diff-review',
    es: '✎ 1 archivo cambiado · /diff-review',
    fr: '✎ 1 fichier modifié · /diff-review',
    ru: '✎ изменён 1 файл · /diff-review',
    zh: '✎ 1 个文件已更改 · /diff-review',
    ja: '✎ 1 ファイルを変更 · /diff-review',
    pt: '✎ 1 arquivo alterado · /diff-review',
    de: '✎ 1 Datei geändert · /diff-review',
    ko: '✎ 파일 1개 변경됨 · /diff-review',
  },
  toastMany: {
    en: '✎ {n} files changed · /diff-review',
    he: '✎ {n} קבצים שונו · /diff-review',
    es: '✎ {n} archivos cambiados · /diff-review',
    fr: '✎ {n} fichiers modifiés · /diff-review',
    ru: '✎ изменено файлов: {n} · /diff-review',
    zh: '✎ {n} 个文件已更改 · /diff-review',
    ja: '✎ {n} ファイルを変更 · /diff-review',
    pt: '✎ {n} arquivos alterados · /diff-review',
    de: '✎ {n} Dateien geändert · /diff-review',
    ko: '✎ 파일 {n}개 변경됨 · /diff-review',
  },
} as const

type Entry = { path: string; before: string | null; added: number; removed: number }
type State = {
  /** Content before this turn's first change, by path; null when the file did not exist. */
  snaps: Record<string, string | null>
  /** Paths that were really changed this turn, in order. */
  changed: string[]
  lastTurn: Entry[]
}

const state = atom(
  { plugin: 'toolkitty', key: 'slot', id: 'diff-review' } as const,
  { snaps: {}, changed: [], lastTurn: [] } as State,
) as unknown as Atom<State>

const MAX_FILE = 1024 * 1024
const MAX_FILES = 40

export const feature: Feature = {
  id: 'diff-review',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const pathOf = (e: object): string | undefined => {
  const x = e as Record<string, unknown>
  const p = x['file_path'] ?? x['notebook_path']
  return typeof p === 'string' ? p : undefined
}

const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p

const linesOf = (text: string): string[] => (text === '' ? [] : text.split('\n'))

/** Simple line diff: lines of `after` not found in `before` are added, lines of `before` left unmatched are removed. */
function countDiff(before: string, after: string): { added: number; removed: number } {
  const pool = new Map<string, number>()
  const old = linesOf(before)
  for (const line of old) pool.set(line, (pool.get(line) ?? 0) + 1)
  let added = 0
  let matched = 0
  for (const line of linesOf(after)) {
    const n = pool.get(line) ?? 0
    if (n > 0) {
      pool.set(line, n - 1)
      matched += 1
    } else {
      added += 1
    }
  }
  return { added, removed: old.length - matched }
}

/** Writes one file's snapshot back; a file that did not exist before is emptied (the API has no delete). */
async function revertOne($: EngineInterface, entry: Entry): Promise<boolean> {
  try {
    await $.fs.write(entry.path, entry.before ?? '')
    return true
  } catch {
    return false
  }
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'diff-review', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'diff-review', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function beforeEditCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return undefined
  if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit') return undefined

  const path = pathOf(e)
  if (path === undefined) return undefined
  const current = await read($, state)
  if (path in current.snaps) return undefined

  let snap: string | null = null
  try {
    if (await $.fs.exists(path)) {
      const stat = await $.fs.stat(path)
      if (stat.kind !== 'file' || stat.size > MAX_FILE) return undefined
      snap = await $.fs.read(path)
    }
  } catch {
    return undefined
  }
  await update($, state, s => (path in s.snaps ? s : { ...s, snaps: { ...s.snaps, [path]: snap } }))
  return undefined
}

export async function afterEditCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return result
  if (result.deny !== undefined || result.isError) return result

  const path = pathOf(e)
  if (path !== undefined) {
    await update($, state, s => (s.changed.includes(path) || !(path in s.snaps) ? s : { ...s, changed: [...s.changed, path] }))
  }
  return result
}

/** A turn ended: says how many files it really changed. */
async function publishDone($: EngineInterface, files: number): Promise<void> {
  await publish($, {
    id: 'diff-review:done',
    feature: feature.id,
    kind: 'done',
    level: 'ok',
    value: files,
    text: files === 0 ? 'no files changed' : files === 1 ? '1 file changed' : `${files} files changed`,
    ttlMs: 12000,
  })
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }

  const turn = await read($, state)
  if (turn.changed.length === 0) {
    await update($, state, s => ({ ...s, snaps: {}, changed: [] }))
    await publishDone($, 0)
    return
  }

  const entries: Entry[] = []
  for (const path of turn.changed.slice(0, MAX_FILES)) {
    const before = turn.snaps[path]
    if (before === undefined) continue
    let after = ''
    try {
      if (await $.fs.exists(path)) after = await $.fs.read(path)
    } catch {
      continue
    }
    if (before === after) continue
    const { added, removed } = countDiff(before ?? '', after)
    entries.push({ path, before, added, removed })
  }

  await update($, state, () => ({ snaps: {}, changed: [], lastTurn: entries }))
  for (const entry of entries) {
    await recordEvidence($, {
      kind: 'diff',
      ok: true,
      summary: '+' + entry.added + ' −' + entry.removed + ' ' + baseName(entry.path),
      ref: entry.path,
      turnId: e.turnId,
      feature: feature.id,
    })
  }
  await publishDone($, entries.length)
  if (entries.length === 0) return
  await notice($, 'info', entries.length === 1 ? t(T.toastOne) : t(T.toastMany, { n: entries.length }), feature.id, { immediate: true })
}

export function register(on: On) {
  on('command.run', { command: 'diff-review' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: 'diff-review', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'diff-review' }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const { lastTurn } = await read($, state)
    if (lastTurn.length === 0) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.workflow })}
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
        </Box>
      )
    }

    const keep = async (path: string) => {
      await update($, state, s => ({ ...s, lastTurn: s.lastTurn.filter(x => x.path !== path) }))
    }
    const revert = async (path: string) => {
      const entry = (await read($, state)).lastTurn.find(x => x.path === path)
      if (entry === undefined) return
      if (await revertOne($, entry)) {
        await keep(path)
        await notice($, 'info', t(T.reverted, { name: baseName(path) }), feature.id, { immediate: true })
      } else {
        await notice($, 'warn', t(T.revertFailed, { name: baseName(path) }), feature.id)
      }
    }
    const revertAll = async () => {
      const entries = (await read($, state)).lastTurn
      let done = 0
      for (const entry of entries) {
        if (await revertOne($, entry)) {
          done += 1
          await keep(entry.path)
        }
      }
      await notice($, 'info', t(T.revertedAll, { n: done }), feature.id, { immediate: true })
    }

    const room = Math.max(3, (e.viewport?.rows ?? 25) - 6)
    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: t(T.statusFiles, { n: lastTurn.length }),
          level: 'info',
          icon: ICONS.workflow,
          actions: [{ key: 'revert-all', label: t(T.revertAll), onPress: () => revertAll() }],
        })}
        {lastTurn.slice(0, room).map(entry => (
          <Box key={`file-${entry.path}`} gap={1}>
            <Button key={`revert-${entry.path}`} label={t(T.revert)} plain onPress={() => revert(entry.path)} />
            <Button key={`keep-${entry.path}`} label={t(T.keep)} plain onPress={() => keep(entry.path)} />
            <Text color="success">+{entry.added}</Text>
            <Text color="error">−{entry.removed}</Text>
            <Text>{baseName(entry.path)}</Text>
            {entry.before === null ? <Text dimColor>({t(T.created)})</Text> : null}
          </Box>
        ))}
      </Box>
    )
  })
}
