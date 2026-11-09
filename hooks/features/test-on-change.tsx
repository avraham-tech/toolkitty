import type { EngineInterface } from 'claude-code'

import { extensionOf, isOn, notice, t } from '../core'
import type { Feature, ToolCallInput, ToolCallOutput } from '../core'
import { recordEvidence } from '../evidence'
import { publish, retractAll } from '../signals'

const T = {
  title: {
    en: 'Tests on change',
    he: 'בדיקות בשינוי',
    es: 'Pruebas al cambiar',
    fr: 'Tests à la modification',
    ru: 'Тесты при изменении',
    zh: '变更时运行测试',
    ja: '変更時にテスト実行',
    pt: 'Testes ao alterar',
    de: 'Tests bei Änderung',
    ko: '변경 시 테스트',
  },
  description: {
    en: 'Runs the test file next to the edited file and reports to the model only on failure (may be slow).',
    he: 'מריץ את קובץ הבדיקות שליד הקובץ שנערך, ומדווח למודל רק על כישלון (עלול להיות איטי).',
    es: 'Ejecuta el archivo de pruebas junto al archivo editado y solo informa al modelo si falla (puede ser lento).',
    fr: 'Exécute le fichier de tests voisin du fichier modifié et ne signale au modèle que les échecs (peut être lent).',
    ru: 'Запускает файл тестов рядом с изменённым файлом и сообщает модели только о сбоях (может быть медленно).',
    zh: '运行与被编辑文件相邻的测试文件，仅在失败时向模型报告（可能较慢）。',
    ja: '編集したファイルの隣にあるテストファイルを実行し、失敗したときだけモデルに報告します（遅いことがあります）。',
    pt: 'Executa o arquivo de teste ao lado do arquivo editado e só avisa o modelo em caso de falha (pode ser lento).',
    de: 'Führt die Testdatei neben der bearbeiteten Datei aus und meldet dem Modell nur bei Fehlschlag (kann langsam sein).',
    ko: '편집한 파일 옆의 테스트 파일을 실행하고 실패할 때만 모델에 알립니다(느릴 수 있음).',
  },
  failedToast: {
    en: 'Tests failed: {name}',
    he: 'בדיקות נכשלו: {name}',
    es: 'Las pruebas fallaron: {name}',
    fr: 'Échec des tests : {name}',
    ru: 'Тесты не прошли: {name}',
    zh: '测试失败：{name}',
    ja: 'テスト失敗：{name}',
    pt: 'Testes falharam: {name}',
    de: 'Tests fehlgeschlagen: {name}',
    ko: '테스트 실패: {name}',
  },
  failedContext: {
    en: 'Tests failed after editing {name}',
    he: 'בדיקות נכשלו אחרי העריכה של {name}',
    es: 'Las pruebas fallaron tras editar {name}',
    fr: 'Les tests ont échoué après la modification de {name}',
    ru: 'Тесты не прошли после правки {name}',
    zh: '编辑 {name} 后测试失败',
    ja: '{name} の編集後にテストが失敗しました',
    pt: 'Testes falharam após editar {name}',
    de: 'Tests nach Bearbeitung von {name} fehlgeschlagen',
    ko: '{name} 편집 후 테스트 실패',
  },
  runFailed: {
    en: 'Running the tests failed or took longer than 60 seconds',
    he: 'הרצת הבדיקות נכשלה או חרגה מ-60 שניות',
    es: 'La ejecución de las pruebas falló o superó los 60 segundos',
    fr: "L'exécution des tests a échoué ou a dépassé 60 secondes",
    ru: 'Не удалось запустить тесты, либо они шли дольше 60 секунд',
    zh: '运行测试失败或耗时超过 60 秒',
    ja: 'テストの実行に失敗したか、60 秒を超えました',
    pt: 'A execução dos testes falhou ou levou mais de 60 segundos',
    de: 'Das Ausführen der Tests ist fehlgeschlagen oder dauerte länger als 60 Sekunden',
    ko: '테스트 실행에 실패했거나 60초를 넘겼습니다',
  },
} as const

const JS_EXT = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'])

const pathOf = (e: object): string | undefined => {
  const p = (e as Record<string, unknown>)['file_path']
  return typeof p === 'string' ? p : undefined
}

const isTestFile = (name: string): boolean =>
  /\.(test|spec)\./.test(name) || /^test_/.test(name) || /_test\.go$/.test(name)

/** Looks for a sibling test file of `path`; undefined when none exists. */
async function findTest($: EngineInterface, path: string, ext: string): Promise<string | undefined> {
  const norm = path.replace(/\\/g, '/')
  const slash = norm.lastIndexOf('/')
  const dir = slash >= 0 ? norm.slice(0, slash) : '.'
  const file = norm.slice(slash + 1)
  const stem = file.slice(0, file.length - ext.length - 1)
  if (isTestFile(file)) return undefined

  let candidates: string[] = []
  if (JS_EXT.has(ext)) {
    candidates = [`${dir}/${stem}.test.${ext}`, `${dir}/${stem}.spec.${ext}`, `${dir}/__tests__/${stem}.${ext}`]
  } else if (ext === 'py') {
    candidates = [`${dir}/test_${stem}.py`]
  } else if (ext === 'go') {
    candidates = [`${dir}/${stem}_test.go`]
  }
  for (const c of candidates) if (await $.fs.exists(c)) return c
  return undefined
}

async function exec($: EngineInterface, argv: string[], cwd: string) {
  const full = argv[0]?.toLowerCase().endsWith('.cmd') ? ['cmd', '/c', ...argv] : argv
  return $.process.run(full, { cwd, timeoutMs: 60000 })
}

/** What a test run said: whether it passed, its output when it did not, and the one-line evidence. */
type Ran = { ok: boolean; output: string; runner: string; ref: string; tail: string }

const ranOf = (res: { exitCode: number | null; stdout: string; stderr: string }, runner: string, argv: string[]): Ran => {
  const all = (res.stdout + '\n' + res.stderr).trim()
  const lines = all.split('\n').map(x => x.trim()).filter(x => x !== '')
  const tail = (lines[lines.length - 1] ?? '').slice(0, 80)
  const ref = argv.map(x => x.split(/[\\/]/).pop() ?? x).join(' ').slice(0, 120)
  return { ok: res.exitCode === 0, output: res.exitCode === 0 ? '' : all, runner, ref, tail }
}

/** Runs the test file; resolves what the run said, or null when no runner exists. */
async function runTest($: EngineInterface, test: string, ext: string, cwd: string): Promise<Ran | null> {
  const dir = test.slice(0, Math.max(test.lastIndexOf('/'), 0)) || '.'
  if (JS_EXT.has(ext)) {
    for (const [name, args] of [['vitest', ['run']], ['jest', []]] as const) {
      for (const bin of [`${name}.cmd`, name]) {
        const full = `${cwd}/node_modules/.bin/${bin}`
        if (await $.fs.exists(full)) {
          const argv = [full, ...args, test]
          return ranOf(await exec($, argv, cwd), name, argv)
        }
      }
    }
    return null
  }
  if (ext === 'py') {
    const argv = ['python', '-m', 'pytest', '-q', test]
    return ranOf(await exec($, argv, cwd), 'pytest', argv)
  }
  if (ext === 'go') {
    const argv = ['go', 'test', '.']
    return ranOf(await exec($, argv, dir), 'go test', argv)
  }
  return null
}

export const feature: Feature = {
  id: 'test-on-change',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

export async function afterEditCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return result
  }
  if (e.tool !== 'Edit' && e.tool !== 'Write') return result
  if (result.deny !== undefined || result.isError) return result

  const path = pathOf(e)
  if (path === undefined) return result
  const ext = extensionOf(path)

  try {
    const test = await findTest($, path, ext)
    if (test === undefined) return result

    const cwd = await $.session.cwd()
    const ran = await runTest($, test, ext, cwd)
    if (ran === null) return result
    await recordEvidence($, {
      kind: 'test',
      ok: ran.ok,
      summary: ran.runner + ' · ' + (ran.tail !== '' ? ran.tail : ran.ok ? 'passed' : 'failed'),
      ref: ran.ref,
      feature: feature.id,
    })
    await publish($, {
      id: 'test-on-change:evidence',
      feature: feature.id,
      kind: 'evidence',
      level: ran.ok ? 'ok' : 'warn',
      value: ran.ok ? 1 : 0,
      text: ran.ok ? 'tests passed' : 'tests failed',
      ttlMs: 10 * 60 * 1000,
    })
    const out = ran.output
    if (out === '') return result

    const tail = out.split('\n').slice(-20).join('\n')
    const name = path.split(/[\\/]/).pop() ?? path
    await notice($, 'warn', t(T.failedToast, { name }), feature.id)
    return { ...result, context: [...(result.context ?? []), t(T.failedContext, { name }) + ':\n' + tail] }
  } catch {
    await notice($, 'warn', t(T.runFailed), feature.id)
    return result
  }
}
