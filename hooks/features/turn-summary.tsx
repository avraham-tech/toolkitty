import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import { isOn, t } from '../core'
import type { Feature, Input, Output, ToolCallInput, ToolCallOutput } from '../core'

const T = {
  title: {
    en: 'Turn summary',
    he: 'סיכום תור',
    es: 'Resumen del turno',
    fr: 'Résumé du tour',
    ru: 'Итог хода',
    zh: '轮次摘要',
    ja: 'ターンの要約',
    pt: 'Resumo do turno',
    de: 'Runden-Zusammenfassung',
    ko: '턴 요약',
  },
  description: {
    en: 'A short line under the answer: how many files were edited and how many actions ran in the turn.',
    he: 'שורה קצרה מתחת לתשובה: כמה קבצים נערכו וכמה פעולות רצו בתור.',
    es: 'Una línea breve bajo la respuesta: cuántos archivos se editaron y cuántas acciones se ejecutaron en el turno.',
    fr: "Une courte ligne sous la réponse : combien de fichiers ont été modifiés et combien d'actions ont été exécutées dans le tour.",
    ru: 'Короткая строка под ответом: сколько файлов изменено и сколько действий выполнено за ход.',
    zh: '回答下方的一行简短说明：本轮编辑了多少个文件、执行了多少次操作。',
    ja: '回答の下に出る短い 1 行：このターンで編集したファイル数と実行したアクション数。',
    pt: 'Uma linha curta abaixo da resposta: quantos arquivos foram editados e quantas ações rodaram no turno.',
    de: 'Eine kurze Zeile unter der Antwort: wie viele Dateien bearbeitet und wie viele Aktionen in der Runde ausgeführt wurden.',
    ko: '답변 아래의 짧은 한 줄: 이번 턴에서 편집한 파일 수와 실행한 작업 수.',
  },
  oneFile: {
    en: 'One file edited',
    he: 'קובץ אחד נערך',
    es: 'Se editó un archivo',
    fr: 'Un fichier modifié',
    ru: 'Изменён один файл',
    zh: '编辑了 1 个文件',
    ja: '1 ファイルを編集',
    pt: 'Um arquivo editado',
    de: 'Eine Datei bearbeitet',
    ko: '파일 1개 편집',
  },
  files: {
    en: '{n} files edited',
    he: '{n} קבצים נערכו',
    es: 'Se editaron {n} archivos',
    fr: '{n} fichiers modifiés',
    ru: 'Изменено файлов: {n}',
    zh: '编辑了 {n} 个文件',
    ja: '{n} ファイルを編集',
    pt: '{n} arquivos editados',
    de: '{n} Dateien bearbeitet',
    ko: '파일 {n}개 편집',
  },
  oneCall: {
    en: '1 action in the turn',
    he: 'פעולה אחת בתור',
    es: '1 acción en el turno',
    fr: '1 action dans le tour',
    ru: 'Одно действие за ход',
    zh: '本轮 1 个操作',
    ja: 'このターンで 1 アクション',
    pt: '1 ação no turno',
    de: '1 Aktion in der Runde',
    ko: '이번 턴에 작업 1개',
  },
  calls: {
    en: '{n} actions in the turn',
    he: '{n} פעולות בתור',
    es: '{n} acciones en el turno',
    fr: '{n} actions dans le tour',
    ru: 'Действий за ход: {n}',
    zh: '本轮 {n} 个操作',
    ja: 'このターンで {n} アクション',
    pt: '{n} ações no turno',
    de: '{n} Aktionen in der Runde',
    ko: '이번 턴에 작업 {n}개',
  },
} as const

type Counts = { files: string[]; calls: number }

const counts = atom({ plugin: 'toolkitty', key: 'slot', id: 'turn-summary' } as const, { files: [], calls: 0 }) as unknown as Atom<Counts>

export const feature: Feature = {
  id: 'turn-summary',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await update($, counts, () => ({ files: [], calls: 0 }))
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined

  let path: string | undefined
  if (e.tool === 'Edit' || e.tool === 'Write') path = e.file_path
  else if (e.tool === 'NotebookEdit') path = e.notebook_path

  await update($, counts, c => ({
    calls: c.calls + 1,
    files: path !== undefined && !c.files.includes(path) ? [...c.files, path] : c.files,
  }))

  return undefined
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>, result: Output<'turn.complete'>): Promise<Output<'turn.complete'>> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return result

  const c = await read($, counts)
  if (c.files.length === 0) return result

  const filesText = c.files.length === 1 ? t(T.oneFile) : t(T.files, { n: c.files.length })
  const line = `${filesText} · ${c.calls === 1 ? t(T.oneCall) : t(T.calls, { n: c.calls })}`
  return { ...result, text: result.text + '\n\n' + line }
}
