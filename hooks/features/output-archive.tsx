import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, ToolCallResult } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import type { Savings } from '../shared'

const T = {
  title: { en: 'Output archive', he: 'ארכיון פלט', es: 'Archivo de salidas', fr: 'Archive des sorties', ru: 'Архив вывода', zh: '输出归档', ja: '出力アーカイブ', pt: 'Arquivo de saídas', de: 'Ausgabe-Archiv', ko: '출력 보관' },
  description: {
    en: 'Moves long tool output (over 8,000 characters) into a file and keeps only the start in the context. /recall searches it, /archive lists it.',
    he: 'מעביר פלט ארוך של כלים (מעל 8,000 תווים) לקובץ ומשאיר בהקשר רק את ההתחלה. /recall מחפש בו, /archive מציג את הרשימה.',
    es: 'Mueve la salida larga de las herramientas (más de 8.000 caracteres) a un archivo y deja solo el principio en el contexto. /recall la busca, /archive la lista.',
    fr: "Déplace les longues sorties d'outils (plus de 8 000 caractères) dans un fichier et ne garde que le début dans le contexte. /recall y cherche, /archive les liste.",
    ru: 'Переносит длинный вывод инструментов (более 8 000 символов) в файл, оставляя в контексте только начало. /recall ищет в нём, /archive показывает список.',
    zh: '将过长的工具输出（超过 8,000 个字符）移入文件，只在上下文中保留开头部分。/recall 可搜索，/archive 可列出。',
    ja: '長いツール出力（8,000 文字超）をファイルに移し、コンテキストには先頭だけを残します。/recall で検索、/archive で一覧表示。',
    pt: 'Move saídas longas de ferramentas (mais de 8.000 caracteres) para um arquivo e mantém só o início no contexto. /recall busca nele, /archive lista.',
    de: 'Verschiebt lange Tool-Ausgaben (über 8.000 Zeichen) in eine Datei und behält nur den Anfang im Kontext. /recall durchsucht sie, /archive listet sie auf.',
    ko: '긴 도구 출력(8,000자 초과)을 파일로 옮기고 컨텍스트에는 앞부분만 남깁니다. /recall로 검색하고 /archive로 목록을 봅니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  recallDesc: { en: 'Searches an archived tool output, or shows more of it', he: 'מחפש בפלט כלי שהועבר לארכיון, או מציג ממנו עוד', es: 'Busca en una salida archivada, o muestra más de ella', fr: 'Cherche dans une sortie archivée, ou en affiche davantage', ru: 'Ищет в архивированном выводе или показывает его продолжение', zh: '搜索已归档的工具输出，或显示更多内容', ja: 'アーカイブ済みのツール出力を検索、またはさらに表示します', pt: 'Busca em uma saída arquivada ou mostra mais dela', de: 'Durchsucht eine archivierte Tool-Ausgabe oder zeigt mehr davon', ko: '보관된 도구 출력을 검색하거나 더 보여 줍니다' },
  recallHint: { en: '<n> [term]', he: '<מספר> [מונח]', es: '<n> [término]', fr: '<n> [terme]', ru: '<номер> [слово]', zh: '<n> [词语]', ja: '<n> [語句]', pt: '<n> [termo]', de: '<n> [Begriff]', ko: '<n> [검색어]' },
  archiveDesc: { en: 'Lists the archived tool outputs', he: 'מציג את פלטי הכלים שהועברו לארכיון', es: 'Lista las salidas de herramientas archivadas', fr: 'Liste les sorties d\'outils archivées', ru: 'Показывает список архивированного вывода', zh: '列出已归档的工具输出', ja: 'アーカイブ済みのツール出力を一覧表示します', pt: 'Lista as saídas de ferramentas arquivadas', de: 'Listet die archivierten Tool-Ausgaben auf', ko: '보관된 도구 출력 목록을 보여 줍니다' },
  footer: {
    en: '[… archived as #{n}: /recall {n} <term> searches it, /recall {n} shows more]',
    he: '[… הועבר לארכיון כ-#{n}: /recall {n} <מונח> מחפש בו, /recall {n} מציג עוד]',
    es: '[… archivado como #{n}: /recall {n} <término> lo busca, /recall {n} muestra más]',
    fr: '[… archivé sous #{n} : /recall {n} <terme> y cherche, /recall {n} en montre davantage]',
    ru: '[… архивировано как #{n}: /recall {n} <слово> ищет в нём, /recall {n} показывает дальше]',
    zh: '[…… 已归档为 #{n}：/recall {n} <词语> 可搜索，/recall {n} 可显示更多]',
    ja: '[… #{n} としてアーカイブ済み：/recall {n} <語句> で検索、/recall {n} でさらに表示]',
    pt: '[… arquivado como #{n}: /recall {n} <termo> busca nele, /recall {n} mostra mais]',
    de: '[… archiviert als #{n}: /recall {n} <Begriff> durchsucht sie, /recall {n} zeigt mehr]',
    ko: '[… #{n}번으로 보관됨: /recall {n} <검색어>로 검색, /recall {n}으로 더 보기]',
  },
  usage: { en: 'Usage: /recall <n> [term]', he: 'שימוש: /recall <מספר> [מונח]', es: 'Uso: /recall <n> [término]', fr: 'Utilisation : /recall <n> [terme]', ru: 'Использование: /recall <номер> [слово]', zh: '用法：/recall <n> [词语]', ja: '使い方：/recall <n> [語句]', pt: 'Uso: /recall <n> [termo]', de: 'Verwendung: /recall <n> [Begriff]', ko: '사용법: /recall <n> [검색어]' },
  unknown: { en: 'There is no archived output #{n}. /archive lists them.', he: 'אין פלט #{n} בארכיון. /archive מציג את הרשימה.', es: 'No hay ninguna salida archivada #{n}. /archive las lista.', fr: "Il n'y a pas de sortie archivée n° {n}. /archive les liste.", ru: 'Архивированного вывода №{n} нет. /archive показывает список.', zh: '没有已归档的输出 #{n}。/archive 可列出全部。', ja: 'アーカイブ済みの出力 #{n} はありません。/archive で一覧を表示できます。', pt: 'Não há saída arquivada #{n}. /archive lista todas.', de: 'Es gibt keine archivierte Ausgabe #{n}. /archive listet sie auf.', ko: '보관된 출력 #{n}이(가) 없습니다. /archive로 목록을 볼 수 있습니다.' },
  cantRead: { en: 'Cannot read the archive file {path}.', he: 'לא ניתן לקרוא את קובץ הארכיון {path}.', es: 'No se puede leer el archivo {path}.', fr: "Impossible de lire le fichier d'archive {path}.", ru: 'Не удаётся прочитать файл архива {path}.', zh: '无法读取归档文件 {path}。', ja: 'アーカイブファイル {path} を読み取れません。', pt: 'Não foi possível ler o arquivo {path}.', de: 'Die Archivdatei {path} kann nicht gelesen werden.', ko: '보관 파일 {path}을(를) 읽을 수 없습니다.' },
  noMatch: { en: 'No lines in #{n} match "{term}".', he: 'אף שורה ב-#{n} לא תואמת ל-"{term}".', es: 'Ninguna línea de #{n} coincide con "{term}".', fr: 'Aucune ligne de #{n} ne correspond à « {term} ».', ru: 'В №{n} нет строк со словом «{term}».', zh: '#{n} 中没有匹配“{term}”的行。', ja: '#{n} に「{term}」に一致する行はありません。', pt: 'Nenhuma linha em #{n} corresponde a "{term}".', de: 'Keine Zeile in #{n} passt zu „{term}“.', ko: '#{n}에 "{term}"과(와) 일치하는 줄이 없습니다.' },
  end: { en: 'That is the end of #{n}.', he: 'זה סוף #{n}.', es: 'Ese es el final de #{n}.', fr: 'C\'est la fin de #{n}.', ru: 'Это конец №{n}.', zh: '#{n} 到此结束。', ja: '#{n} はここまでです。', pt: 'Este é o fim de #{n}.', de: 'Das ist das Ende von #{n}.', ko: '#{n}의 끝입니다.' },
  none: { en: 'Nothing has been archived yet.', he: 'עדיין לא הועבר דבר לארכיון.', es: 'Aún no se ha archivado nada.', fr: 'Rien n\'a encore été archivé.', ru: 'Пока ничего не архивировано.', zh: '尚未归档任何内容。', ja: 'まだ何もアーカイブされていません。', pt: 'Nada foi arquivado ainda.', de: 'Noch nichts archiviert.', ko: '아직 보관된 것이 없습니다.' },
  listHead: { en: 'Archived outputs:', he: 'פלטים בארכיון:', es: 'Salidas archivadas:', fr: 'Sorties archivées :', ru: 'Архивированный вывод:', zh: '已归档的输出：', ja: 'アーカイブ済みの出力：', pt: 'Saídas arquivadas:', de: 'Archivierte Ausgaben:', ko: '보관된 출력:' },
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

type Entry = { n: number; tool: string; path: string; bytes: number; summaryFirstLine: string; shown: number }
type State = { stamp: string; index: Entry[] }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'output-archive' } as const, { stamp: '', index: [] } as State) as unknown as Atom<State>

const savings = atom({ plugin: 'toolkitty', key: 'slot', id: 'savings' } as const, { tokens: 0, usd: 0, byFeature: {}, leaks: {} } as Savings) as unknown as Atom<Savings>

const LIMIT = 8000
/**
 * A Read is a file the model asked for by name, and it is on disk already: cutting it at LIMIT only buys a
 * second read of the archived copy. So a Read is cut only when it is very long, and never when the model
 * scoped it itself with `offset` or `limit`.
 */
const READ_LIMIT = 40_000
const HEAD = 3000
const MAX_FILE = 3_900_000
const MAX_RECALL = 8000
const CONTEXT_LINES = 2
const TRIMMER_MARK = /\.\.\. \[Toolkitty [^\]]*\] \.\.\./

export const feature: Feature = {
  id: 'output-archive',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const byteLength = (text: string): number => {
  let n = 0
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c <= 0xdbff ? (i++, 4) : 3
  }
  return n
}

const firstLine = (text: string): string => {
  const line = text.split('\n').find(l => l.trim() !== '') ?? ''
  const one = line.trim()
  return one.length > 120 ? `${one.slice(0, 119)}…` : one
}

/** Where the archive lives: the OS temp dir, else the session's .claude folder. */
async function archiveBase($: EngineInterface): Promise<string> {
  const temp = (await $.env.get('TEMP')) ?? (await $.env.get('TMPDIR'))
  const root = temp !== undefined && temp !== '' ? `${temp}/toolkitty-archive` : `${await $.session.cwd()}/.claude/toolkitty-archive`
  return root.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/(?=[A-Za-z]:)/, '')
}

type Archived = { short: string; note: string }

/** Writes `text` to the archive and returns its start plus the model's note, or undefined when it could not be written. */
async function archiveText($: EngineInterface, tool: string, text: string): Promise<Archived | undefined> {
  try {
    const cur = await read($, state)
    const stamp = cur.stamp !== '' ? cur.stamp : (await $.clock.now()).toString(36)
    const n = cur.index.reduce((m, x) => Math.max(m, x.n), 0) + 1
    const path = `${await archiveBase($)}/${stamp}/${n}.txt`
    await $.fs.write(path, text.slice(0, MAX_FILE))
    await update($, state, s => ({
      stamp,
      index: [...s.index, { n, tool, path, bytes: byteLength(text), summaryFirstLine: firstLine(text), shown: HEAD }],
    }))
    const footer = t(T.footer, { n })
    const shortText = `${text.slice(0, HEAD)}\n${footer}`
    const saved = Math.ceil(Math.max(0, text.length - shortText.length) / 4)
    if (saved > 0) {
      await update($, savings, s => ({
        ...s,
        tokens: s.tokens + saved,
        usd: s.usd + saved * 0.000003,
        byFeature: { ...s.byFeature, 'output-archive': (s.byFeature['output-archive'] ?? 0) + saved },
      }))
    }
    return {
      short: shortText,
      note: `Toolkitty note: this ${tool} output was ${text.length} characters long, so only the first ${HEAD} are shown above. The full output is saved at ${path}; you may Read or Grep that file if you need more of it.`,
    }
  } catch {
    return undefined
  }
}

/** The model-facing text of a result, with `from` swapped for `to` when it holds it; otherwise dropped. */
const retext = (text: string | undefined, from: string, to: string): { text?: string } =>
  text !== undefined && from !== '' && text.includes(from) ? { text: text.split(from).join(to) } : {}

/** The leading entries of `names` whose joined length stays within HEAD. */
const headOf = (names: readonly string[]): string[] => {
  const out: string[] = []
  let used = 0
  for (const name of names) {
    used += name.length + 1
    if (used > HEAD && out.length > 0) break
    out.push(name)
  }
  return out
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'recall', description: t(T.recallDesc), argumentHint: t(T.recallHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'recall', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  try {
    await $.command.register({ name: 'archive', description: t(T.archiveDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'archive', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (e.agentId !== undefined || result.deny !== undefined) return result

  if (e.tool === 'Read') {
    if (e.file_path.includes('toolkitty-archive')) return result
    if (e.offset !== undefined || e.limit !== undefined) return result
    const ran = result as ToolCallResult<'Read'>
    if (ran.deny !== undefined || ran.isError || ran.result.type !== 'text') return result
    const content = ran.result.file.content
    if (content.length <= READ_LIMIT) return result
    const done = await archiveText($, 'Read', content)
    if (done === undefined) return result
    const { text: oldText, ...rest } = ran
    return {
      ...rest,
      result: { ...ran.result, file: { ...ran.result.file, content: done.short } },
      ...retext(oldText, content, done.short),
      context: [...(ran.context ?? []), done.note],
    } as ToolCallOutput
  }

  if (e.tool === 'Grep') {
    if ((e.path ?? '').includes('toolkitty-archive')) return result
    const ran = result as ToolCallResult<'Grep'>
    if (ran.deny !== undefined || ran.isError) return result
    const body = ran.result.content
    if (body !== undefined) {
      if (body.length <= LIMIT) return result
      const done = await archiveText($, 'Grep', body)
      if (done === undefined) return result
      const { text: oldText, ...rest } = ran
      return {
        ...rest,
        result: { ...ran.result, content: done.short },
        ...retext(oldText, body, done.short),
        context: [...(ran.context ?? []), done.note],
      } as ToolCallOutput
    }
    const joined = ran.result.filenames.join('\n')
    if (joined.length <= LIMIT) return result
    const done = await archiveText($, 'Grep', joined)
    if (done === undefined) return result
    const kept = headOf(ran.result.filenames)
    const { text: oldText, ...rest } = ran
    return {
      ...rest,
      result: { ...ran.result, filenames: kept, numFiles: kept.length },
      ...retext(oldText, joined, `${kept.join('\n')}\n${t(T.footer, { n: (await read($, state)).index.length })}`),
      context: [...(ran.context ?? []), `${done.note} ${t(T.footer, { n: (await read($, state)).index.length })}`],
    } as ToolCallOutput
  }

  if (e.tool === 'Glob') {
    const ran = result as ToolCallResult<'Glob'>
    if (ran.deny !== undefined || ran.isError) return result
    const joined = ran.result.filenames.join('\n')
    if (joined.length <= LIMIT) return result
    const done = await archiveText($, 'Glob', joined)
    if (done === undefined) return result
    const kept = headOf(ran.result.filenames)
    const footer = t(T.footer, { n: (await read($, state)).index.length })
    const { text: oldText, ...rest } = ran
    return {
      ...rest,
      result: { ...ran.result, filenames: kept, numFiles: kept.length, truncated: true },
      ...retext(oldText, joined, `${kept.join('\n')}\n${footer}`),
      context: [...(ran.context ?? []), `${done.note} ${footer}`],
    } as ToolCallOutput
  }

  if (e.tool === 'Bash') {
    if (e.command.includes('toolkitty-archive')) return result
    const ran = result as ToolCallResult<'Bash'>
    if (ran.deny !== undefined || ran.isError) return result
    const out = ran.result.stdout
    const err = ran.result.stderr
    if (TRIMMER_MARK.test(out)) return result
    const bigOut = out.length > LIMIT
    const bigErr = err.length > LIMIT
    if (!bigOut && !bigErr) return result

    const notes: string[] = []
    let stdout = out
    let stderr = err
    let text = ran.text
    if (bigOut) {
      const done = await archiveText($, 'Bash', out)
      if (done !== undefined) {
        stdout = done.short
        notes.push(done.note)
        text = retext(text, out, done.short).text
      }
    }
    if (bigErr) {
      const done = await archiveText($, 'Bash', err)
      if (done !== undefined) {
        stderr = done.short
        notes.push(done.note)
        text = retext(text, err, done.short).text
      }
    }
    if (notes.length === 0) return result
    const { text: _oldText, ...rest } = ran
    return {
      ...rest,
      result: { ...ran.result, stdout, stderr },
      ...(text !== undefined ? { text } : {}),
      context: [...(ran.context ?? []), ...notes],
    } as ToolCallOutput
  }

  if (e.tool === 'WebFetch') {
    const ran = result as ToolCallResult<'WebFetch'>
    if (ran.deny !== undefined || ran.isError) return result
    const body = ran.result.result
    if (body.length <= LIMIT) return result
    const done = await archiveText($, 'WebFetch', body)
    if (done === undefined) return result
    const { text: oldText, ...rest } = ran
    return {
      ...rest,
      result: { ...ran.result, result: done.short },
      ...retext(oldText, body, done.short),
      context: [...(ran.context ?? []), done.note],
    } as ToolCallOutput
  }

  return result
}

/** Matching lines of `text` with CONTEXT_LINES around each, ranges joined by "--". */
const grepLines = (text: string, term: string): string | undefined => {
  const lines = text.split('\n')
  const needle = term.toLowerCase()
  const keep = new Set<number>()
  lines.forEach((line, i) => {
    if (!line.toLowerCase().includes(needle)) return
    for (let j = Math.max(0, i - CONTEXT_LINES); j <= Math.min(lines.length - 1, i + CONTEXT_LINES); j++) keep.add(j)
  })
  if (keep.size === 0) return undefined
  const out: string[] = []
  let prev = -2
  let used = 0
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (i !== prev + 1 && out.length > 0) out.push('--')
    const row = `${i + 1}: ${lines[i] ?? ''}`
    used += row.length + 1
    if (used > MAX_RECALL) {
      out.push('…')
      break
    }
    out.push(row)
    prev = i
  }
  return out.join('\n')
}

export function register(on: On) {
  on('command.run', { command: 'recall' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const m = /^\s*#?(\d+)(?:\s+([\s\S]*\S))?\s*$/.exec(e.args)
    if (m === null) return { text: t(T.usage) }
    const n = Number(m[1])
    const term = (m[2] ?? '').trim()

    const { index } = await read($, state)
    const entry = index.find(x => x.n === n)
    if (entry === undefined) return { text: t(T.unknown, { n }) }

    let full: string
    try {
      full = await $.fs.read(entry.path)
    } catch {
      return { text: t(T.cantRead, { path: entry.path }) }
    }

    if (term !== '') {
      const found = grepLines(full, term)
      return { text: found === undefined ? t(T.noMatch, { n, term }) : found }
    }

    if (entry.shown >= full.length) return { text: t(T.end, { n }) }
    const chunk = full.slice(entry.shown, entry.shown + HEAD)
    await update($, state, s => ({
      ...s,
      index: s.index.map(x => (x.n === n ? { ...x, shown: entry.shown + HEAD } : x)),
    }))
    return { text: chunk }
  })

  on('command.run', { command: 'archive' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const { index } = await read($, state)
    if (index.length === 0) return { text: t(T.none) }
    const rows = index.map(x => `#${x.n} ${x.tool} · ${x.bytes} B · ${x.path}\n    ${x.summaryFirstLine}`)
    return { text: [t(T.listHead), ...rows].join('\n') }
  })
}
