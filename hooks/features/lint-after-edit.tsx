import type { EngineInterface } from 'claude-code'

import { extensionOf, isOn, notice, t } from '../core'
import type { Feature, ToolCallInput, ToolCallOutput } from '../core'
import { recordEvidence } from '../evidence'

const T = {
  title: { en: 'Lint after edit', he: 'לינט אחרי עריכה', es: 'Lint tras editar', fr: 'Lint après modification', ru: 'Линт после правки', zh: '编辑后 Lint', ja: '編集後に Lint', pt: 'Lint após editar', de: 'Lint nach Änderung', ko: '편집 후 린트' },
  description: { en: 'Runs ESLint / ruff on an edited file and passes the problems to the model so it fixes them.', he: 'מריץ ESLint / ruff על קובץ שנערך ומעביר למודל את הבעיות כדי שיתקן.', es: 'Ejecuta ESLint / ruff sobre el archivo editado y pasa los problemas al modelo para que los corrija.', fr: 'Exécute ESLint / ruff sur le fichier modifié et transmet les problèmes au modèle pour qu\'il les corrige.', ru: 'Запускает ESLint / ruff для изменённого файла и передаёт проблемы модели, чтобы она их исправила.', zh: '对编辑过的文件运行 ESLint / ruff，并把问题交给模型去修复。', ja: '編集したファイルに ESLint / ruff を実行し、見つかった問題をモデルに渡して修正させます。', pt: 'Executa ESLint / ruff em um arquivo editado e passa os problemas ao modelo para que ele os corrija.', de: 'Führt ESLint / ruff auf einer bearbeiteten Datei aus und gibt die Probleme ans Modell weiter, damit es sie behebt.', ko: '편집한 파일에 ESLint / ruff를 실행하고, 발견된 문제를 모델에 넘겨 고치게 합니다.' },
  lintFailed: { en: 'Lint run failed', he: 'הרצת הלינט נכשלה', es: 'Falló la ejecución del lint', fr: 'Échec de l\'exécution du lint', ru: 'Не удалось запустить линт', zh: 'Lint 运行失败', ja: 'Lint の実行に失敗', pt: 'Falha ao executar o lint', de: 'Lint-Lauf fehlgeschlagen', ko: '린트 실행 실패' },
} as const

const JS_EXT = new Set(['js', 'jsx', 'ts', 'tsx'])

const pathOf = (e: object): string | undefined => {
  const p = (e as Record<string, unknown>)['file_path']
  return typeof p === 'string' ? p : undefined
}

async function runLint($: EngineInterface, argv: string[], cwd: string): Promise<string> {
  const full = argv[0]?.toLowerCase().endsWith('.cmd') ? ['cmd', '/c', ...argv] : argv
  const res = await $.process.run(full, { cwd, timeoutMs: 30000 })
  // Exit 0 (clean) and 1 (problems) are results of the lint; 2 and up is a crash and is no evidence.
  if (res.exitCode === 0 || res.exitCode === 1) {
    const lines = (res.stdout + '\n' + res.stderr).split('\n').map(x => x.trim()).filter(x => x !== '')
    const name = (argv[0] ?? 'lint').split(/[\\/]/).pop() ?? 'lint'
    await recordEvidence($, {
      kind: 'lint',
      ok: res.exitCode === 0,
      summary: (name.replace(/\.cmd$/i, '') + ' · ' + (res.exitCode === 0 ? 'clean' : (lines[lines.length - 1] ?? 'problems found'))).slice(0, 100),
      ref: argv.map(x => x.split(/[\\/]/).pop() ?? x).join(' ').slice(0, 120),
      feature: feature.id,
    })
  }
  // Exit 1 means "problems found" for both ESLint and ruff; 2 and up is a crash or missing config, which is not a problem in the edit.
  if (res.exitCode !== 1) return ''
  return (res.stdout + (res.stdout.endsWith('\n') || res.stdout === '' ? '' : '\n') + res.stderr).trim()
}

async function lint($: EngineInterface, path: string, ext: string, cwd: string): Promise<string> {
  if (JS_EXT.has(ext)) {
    for (const bin of ['eslint.cmd', 'eslint']) {
      const full = `${cwd}/node_modules/.bin/${bin}`
      if (await $.fs.exists(full)) return runLint($, [full, '--format', 'stylish', path], cwd)
    }
    return ''
  }
  if (ext === 'py') {
    try {
      return await runLint($, ['ruff', 'check', '--output-format', 'concise', path], cwd)
    } catch {
      return '' // ruff not installed
    }
  }
  return ''
}

export const feature: Feature = {
  id: 'lint-after-edit',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function afterEditCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.tool !== 'Edit' && e.tool !== 'Write') return result
  if (!(await isOn($, feature))) return result

  if (result.deny !== undefined || result.isError) return result

  const path = pathOf(e)
  if (path === undefined) return result

  try {
    const cwd = await $.session.cwd()
    const ext = extensionOf(path)
    const out = await lint($, path, ext, cwd)
    if (out === '') return result

    const snippet = out.split('\n').slice(0, 30).join('\n')
    return { ...result, context: [...(result.context ?? []), (ext === 'py' ? 'Ruff:\n' : 'ESLint:\n') + snippet] }
  } catch {
    await notice($, 'warn', t(T.lintFailed), feature.id)
    return result
  }
}
