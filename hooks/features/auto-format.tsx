import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import { extensionOf, isOn, notice, t } from '../core'
import type { Feature, ToolCallInput, ToolCallOutput } from '../core'

const T = {
  title: { en: 'Auto-format', he: 'עיצוב אוטומטי', es: 'Formato automático', fr: 'Formatage automatique', ru: 'Автоформатирование', zh: '自动格式化', ja: '自動フォーマット', pt: 'Formatação automática', de: 'Auto-Format', ko: '자동 포맷' },
  description: { en: 'Runs prettier / ruff / gofmt / rustfmt on an edited file, when the tool exists in the project.', he: 'מריץ prettier / ruff / gofmt / rustfmt על קובץ שנערך, כשהכלי קיים בפרויקט.', es: 'Ejecuta prettier / ruff / gofmt / rustfmt sobre un archivo editado, cuando la herramienta existe en el proyecto.', fr: 'Lance prettier / ruff / gofmt / rustfmt sur un fichier modifié, quand l\'outil existe dans le projet.', ru: 'Запускает prettier / ruff / gofmt / rustfmt для изменённого файла, если инструмент есть в проекте.', zh: '编辑文件后，若项目中有 prettier / ruff / gofmt / rustfmt 工具，则自动运行。', ja: 'ファイルを編集した後、プロジェクトに prettier / ruff / gofmt / rustfmt があれば実行します。', pt: 'Executa prettier / ruff / gofmt / rustfmt no arquivo editado, quando a ferramenta existe no projeto.', de: 'Führt prettier / ruff / gofmt / rustfmt auf einer bearbeiteten Datei aus, wenn das Tool im Projekt vorhanden ist.', ko: '파일을 편집하면 프로젝트에 prettier / ruff / gofmt / rustfmt가 있을 때 실행합니다.' },
  formatted: { en: 'Formatted: {file}', he: 'עוצב: {file}', es: 'Formateado: {file}', fr: 'Formaté : {file}', ru: 'Отформатировано: {file}', zh: '已格式化：{file}', ja: 'フォーマットしました: {file}', pt: 'Formatado: {file}', de: 'Formatiert: {file}', ko: '포맷 완료: {file}' },
} as const

type State = { count: number; toasted: boolean }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'auto-format' } as const, { count: 0, toasted: false }) as unknown as Atom<State>

const PRETTIER_EXT = new Set(['js', 'jsx', 'ts', 'tsx', 'json', 'css', 'scss', 'md', 'yaml', 'yml', 'html', 'vue', 'svelte'])

const pathOf = (e: object): string | undefined => {
  const x = e as Record<string, unknown>
  const p = x['file_path'] ?? x['notebook_path']
  return typeof p === 'string' ? p : undefined
}

/** Runs argv; on Windows a `.cmd` shim goes through cmd.exe. Returns true when the exit code was 0. */
async function run($: EngineInterface, argv: string[], cwd: string): Promise<boolean> {
  const full = argv[0]?.toLowerCase().endsWith('.cmd') ? ['cmd', '/c', ...argv] : argv
  const res = await $.process.run(full, { cwd, timeoutMs: 20000 })
  return res.exitCode === 0
}

/** Formats the file with the right tool when one exists; true when something ran OK. */
async function format($: EngineInterface, path: string, ext: string, cwd: string): Promise<boolean> {
  if (PRETTIER_EXT.has(ext)) {
    for (const bin of ['prettier.cmd', 'prettier']) {
      const full = `${cwd}/node_modules/.bin/${bin}`
      if (await $.fs.exists(full)) return run($, [full, '--write', '--log-level', 'warn', path], cwd)
    }
    return false
  }
  if (ext === 'py') {
    for (const argv of [['ruff', 'format', path], ['black', '-q', path]]) {
      try {
        if (await run($, argv, cwd)) return true
      } catch {
        // tool not installed: try the next one
      }
    }
    return false
  }
  if (ext === 'go') return run($, ['gofmt', '-w', path], cwd)
  if (ext === 'rs') return run($, ['rustfmt', path], cwd)
  return false
}

export const feature: Feature = {
  id: 'auto-format',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function afterEditCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit') return result
  if (result.deny !== undefined || result.isError) return result

  const path = pathOf(e)
  if (path === undefined) return result
  const ext = extensionOf(path)

  try {
    const cwd = await $.session.cwd()
    if (!(await format($, path, ext, cwd))) return result

    const before = await read($, state)
    await update($, state, s => ({ count: s.count + 1, toasted: true }))
    if (!before.toasted) await notice($, 'info', t(T.formatted, { file: path.split(/[\\/]/).pop() ?? path }), feature.id)
  } catch {
    // formatting is best effort and must never fail the edit
  }
  return result
}
