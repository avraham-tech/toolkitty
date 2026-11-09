import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement, RenderInput } from 'claude-code'

import { clockText, isOn, notice, storeSet, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { exportBar, writeExport } from '../exports'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import { BUILTIN_THEMES } from '../themes'
import type { Theme } from '../themes'

const T = {
  title: { en: 'Turn receipt', he: 'קבלה לתור', es: 'Recibo del turno', fr: 'Reçu du tour', ru: 'Чек за ход', zh: '轮次小票', ja: 'ターンのレシート', pt: 'Recibo do turno', de: 'Durchgangs-Beleg', ko: '턴 영수증' },
  description: {
    en: 'After a long or busy turn, prints a thermal-printer receipt: tool counts, time, tokens and cost.',
    he: 'אחרי תור ארוך או עמוס מדפיס קבלה כמו מדפסת תרמית: מספר כלים, זמן, טוקנים ועלות.',
    es: 'Tras un turno largo o intenso imprime un recibo de impresora térmica: herramientas, tiempo, tokens y costo.',
    fr: 'Après un tour long ou chargé, imprime un reçu de caisse : outils, durée, jetons et coût.',
    ru: 'После долгого или насыщенного хода печатает чек, как на термопринтере: инструменты, время, токены и стоимость.',
    zh: '在较长或繁忙的一轮之后，打印一张热敏小票：工具次数、用时、token 和费用。',
    ja: '長い、または忙しいターンの後に、サーマルプリンター風のレシートを出します：ツール回数、時間、トークン、コスト。',
    pt: 'Após um turno longo ou intenso, imprime um recibo de impressora térmica: contagem de ferramentas, tempo, tokens e custo.',
    de: 'Druckt nach einem langen oder arbeitsreichen Durchgang einen Thermodrucker-Beleg: Tool-Anzahl, Zeit, Tokens und Kosten.',
    ko: '길거나 바쁜 턴이 끝나면 감열식 프린터 영수증을 출력합니다: 도구 횟수, 시간, 토큰, 비용.',
  },
  paneTitle: { en: 'Receipt', he: 'קבלה', es: 'Recibo', fr: 'Reçu', ru: 'Чек', zh: '小票', ja: 'レシート', pt: 'Recibo', de: 'Beleg', ko: '영수증' },
  reads: { en: 'READS', he: 'קריאות', es: 'LECTURAS', fr: 'LECTURES', ru: 'ЧТЕНИЯ', zh: '读取', ja: '読み取り', pt: 'LEITURAS', de: 'LESEN', ko: '읽기' },
  edits: { en: 'EDITS', he: 'עריכות', es: 'EDICIONES', fr: 'MODIFS', ru: 'ПРАВКИ', zh: '编辑', ja: '編集', pt: 'EDIÇÕES', de: 'ÄNDERUNGEN', ko: '편집' },
  writes: { en: 'WRITES', he: 'כתיבות', es: 'ESCRITURAS', fr: 'ÉCRITURES', ru: 'ЗАПИСИ', zh: '写入', ja: '書き込み', pt: 'GRAVAÇÕES', de: 'SCHREIBEN', ko: '쓰기' },
  searches: { en: 'SEARCHES', he: 'חיפושים', es: 'BÚSQUEDAS', fr: 'RECHERCHES', ru: 'ПОИСКИ', zh: '搜索', ja: '検索', pt: 'BUSCAS', de: 'SUCHEN', ko: '검색' },
  bash: { en: 'COMMANDS', he: 'פקודות', es: 'COMANDOS', fr: 'COMMANDES', ru: 'КОМАНДЫ', zh: '命令', ja: 'コマンド', pt: 'COMANDOS', de: 'BEFEHLE', ko: '명령' },
  web: { en: 'WEB FETCHES', he: 'משיכות רשת', es: 'CONSULTAS WEB', fr: 'REQUÊTES WEB', ru: 'ВЕБ-ЗАПРОСЫ', zh: '网页抓取', ja: 'Web 取得', pt: 'ACESSOS WEB', de: 'WEB-ABRUFE', ko: '웹 가져오기' },
  agents: { en: 'SUBAGENTS', he: 'תת-סוכנים', es: 'SUBAGENTES', fr: 'SOUS-AGENTS', ru: 'СУБАГЕНТЫ', zh: '子代理', ja: 'サブエージェント', pt: 'SUBAGENTES', de: 'SUBAGENTEN', ko: '서브에이전트' },
  other: { en: 'OTHER TOOLS', he: 'כלים אחרים', es: 'OTRAS HERRAM.', fr: 'AUTRES OUTILS', ru: 'ПРОЧЕЕ', zh: '其他工具', ja: 'その他のツール', pt: 'OUTRAS FERRAMENTAS', de: 'SONSTIGE TOOLS', ko: '기타 도구' },
  noTools: { en: '(no tool calls)', he: '(ללא קריאות לכלים)', es: '(sin herramientas)', fr: '(aucun outil)', ru: '(без инструментов)', zh: '（无工具调用）', ja: '（ツール呼び出しなし）', pt: '(sem chamadas de ferramentas)', de: '(keine Tool-Aufrufe)', ko: '(도구 호출 없음)' },
  time: { en: 'TIME', he: 'זמן', es: 'TIEMPO', fr: 'DURÉE', ru: 'ВРЕМЯ', zh: '用时', ja: '時間', pt: 'TEMPO', de: 'ZEIT', ko: '시간' },
  subtotal: { en: 'SUBTOTAL', he: 'סכום ביניים', es: 'SUBTOTAL', fr: 'SOUS-TOTAL', ru: 'ПОДИТОГ', zh: '小计', ja: '小計', pt: 'SUBTOTAL', de: 'ZWISCHENSUMME', ko: '소계' },
  total: { en: 'TOTAL', he: 'סה״כ', es: 'TOTAL', fr: 'TOTAL', ru: 'ИТОГО', zh: '合计', ja: '合計', pt: 'TOTAL', de: 'GESAMT', ko: '합계' },
  tok: { en: 'tok', he: 'טוקנים', es: 'tok', fr: 'jetons', ru: 'ток.', zh: 'token', ja: 'トークン', pt: 'tok', de: 'Tok.', ko: '토큰' },
  footer: {
    en: 'THANK YOU FOR VIBING',
    he: 'תודה שנהניתם',
    es: 'GRACIAS POR LA BUENA VIBRA',
    fr: 'MERCI D’AVOIR VIBRÉ',
    ru: 'СПАСИБО ЗА ВАЙБ',
    zh: '感谢惠顾，VIBE 愉快',
    ja: 'いいバイブスをありがとう',
    pt: 'OBRIGADO PELA VIBE',
    de: 'DANKE FÜRS VIBEN',
    ko: '함께 바이브해 줘서 고마워요',
  },
  alt: {
    en: 'Receipt for the last turn: {calls} tool calls, {time}, {tokens} tokens, total {total}',
    he: 'קבלה לתור האחרון: {calls} קריאות לכלים, {time}, {tokens} טוקנים, סה״כ {total}',
    es: 'Recibo del último turno: {calls} herramientas, {time}, {tokens} tokens, total {total}',
    fr: 'Reçu du dernier tour : {calls} outils, {time}, {tokens} jetons, total {total}',
    ru: 'Чек за последний ход: инструментов {calls}, {time}, токенов {tokens}, итого {total}',
    zh: '上一轮的小票：{calls} 次工具调用，{time}，{tokens} token，合计 {total}',
    ja: '直前のターンのレシート：ツール呼び出し {calls} 回、{time}、{tokens} トークン、合計 {total}',
    pt: 'Recibo do último turno: {calls} chamadas de ferramentas, {time}, {tokens} tokens, total {total}',
    de: 'Beleg des letzten Durchgangs: {calls} Tool-Aufrufe, {time}, {tokens} Tokens, gesamt {total}',
    ko: '마지막 턴 영수증: 도구 호출 {calls}회, {time}, {tokens} 토큰, 합계 {total}',
  },
  noReceipt: { en: 'No receipt yet.', he: 'עדיין אין קבלה.', es: 'Aún no hay recibo.', fr: 'Pas encore de reçu.', ru: 'Чека пока нет.', zh: '还没有小票。', ja: 'レシートはまだありません。', pt: 'Nenhum recibo ainda.', de: 'Noch kein Beleg.', ko: '아직 영수증이 없습니다.' },
  noReceiptHint: { en: 'A long or busy turn prints one here.', he: 'תור ארוך או עמוס יפיק כאן קבלה.', es: 'Un turno largo o intenso imprime uno aquí.', fr: 'Un tour long ou chargé en imprime un ici.', ru: 'Долгий или насыщенный ход напечатает его здесь.', zh: '较长或繁忙的一轮会在这里打印一张。', ja: '長い、または忙しいターンのレシートがここに出力されます。', pt: 'Um turno longo ou intenso imprime um aqui.', de: 'Ein langer oder arbeitsreicher Durchgang druckt hier einen.', ko: '길거나 바쁜 턴이 끝나면 여기에 출력됩니다.' },
  statusCalls: { en: '{n} calls', he: '{n} קריאות', es: '{n} llamadas', fr: '{n} appels', ru: 'вызовов: {n}', zh: '{n} 次调用', ja: '呼び出し {n} 回', pt: '{n} chamadas', de: '{n} Aufrufe', ko: '{n}회 호출' },
  getYours: {
    en: 'Get yours: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    he: 'קבלו גם אתם: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    es: 'Consigue el tuyo: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    fr: 'Prends le tien : claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ru: 'Получите свой: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    zh: '你也来一份：claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ja: '自分も使うには：claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    pt: 'Instale o seu: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    de: 'Hol dir deinen: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ko: '직접 써 보기: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
  },
  off: { en: 'Turn receipts are off. Turn them on in the /toolkitty pane.', he: 'קבלות התור כבויות. הפעל אותן בלוח /toolkitty.', es: 'Los recibos de turno están desactivados. Actívalos en el panel /toolkitty.', fr: 'Les reçus de tour sont désactivés. Activez-les dans le panneau /toolkitty.', ru: 'Чеки за ходы отключены. Включите их в панели /toolkitty.', zh: '轮次小票已关闭。请在 /toolkitty 面板中开启。', ja: 'ターンのレシートはオフです。/toolkitty ペインでオンにしてください。', pt: 'Os recibos de turno estão desativados. Ative-os no painel /toolkitty.', de: 'Durchgangs-Belege sind aus. Schalte sie im Panel /toolkitty ein.', ko: '턴 영수증이 꺼져 있습니다. /toolkitty 창에서 켜세요.' },
  cmdDesc: { en: 'Show the latest turn receipt and its history (save / all write a file)', he: 'הצגת קבלת התור האחרונה וההיסטוריה שלה (save / all שומרים קובץ)', es: 'Muestra el último recibo de turno y su historial (save / all escriben un archivo)', fr: 'Affiche le dernier reçu de tour et son historique (save / all écrivent un fichier)', ru: 'Показать последний чек за ход и историю (save / all записывают файл)', zh: '显示最新的轮次小票及其历史（save / all 会写入文件）', ja: '最新のターンのレシートと履歴を表示します（save / all はファイルに書き出します）', pt: 'Mostra o último recibo de turno e o histórico (save / all gravam um arquivo)', de: 'Zeigt den letzten Durchgangs-Beleg und den Verlauf (save / all schreiben eine Datei)', ko: '최신 턴 영수증과 기록을 표시합니다(save / all은 파일로 저장)' },
  argHint: { en: '[save | all]', he: '[save | all]', es: '[save | all]', fr: '[save | all]', ru: '[save | all]', zh: '[save | all]', ja: '[save | all]', pt: '[save | all]', de: '[save | all]', ko: '[save | all]' },
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  opened: { en: 'Opened the receipt pane.', he: 'חלונית הקבלה נפתחה.', es: 'Panel de recibos abierto.', fr: 'Panneau des reçus ouvert.', ru: 'Панель чеков открыта.', zh: '已打开小票面板。', ja: 'レシートペインを開きました。', pt: 'Painel de recibos aberto.', de: 'Beleg-Panel geöffnet.', ko: '영수증 창을 열었습니다.' },
  usage: { en: 'Usage: /receipt · /receipt save (latest as SVG) · /receipt all (history as .txt)', he: 'שימוש: /receipt · /receipt save (האחרונה כ-SVG) · /receipt all (ההיסטוריה כקובץ txt)', es: 'Uso: /receipt · /receipt save (el último como SVG) · /receipt all (historial como .txt)', fr: 'Usage : /receipt · /receipt save (le dernier en SVG) · /receipt all (historique en .txt)', ru: 'Использование: /receipt · /receipt save (последний как SVG) · /receipt all (история в .txt)', zh: '用法：/receipt · /receipt save（最新一张存为 SVG）· /receipt all（历史存为 .txt）', ja: '使い方：/receipt · /receipt save（最新を SVG で保存） · /receipt all（履歴を .txt で保存）', pt: 'Uso: /receipt · /receipt save (o último como SVG) · /receipt all (histórico em .txt)', de: 'Verwendung: /receipt · /receipt save (letzter als SVG) · /receipt all (Verlauf als .txt)', ko: '사용법: /receipt · /receipt save(최신 항목을 SVG로) · /receipt all(기록을 .txt로)' },
  savedLatest: { en: 'Saved the latest receipt: {path}', he: 'הקבלה האחרונה נשמרה: {path}', es: 'Último recibo guardado: {path}', fr: 'Dernier reçu enregistré : {path}', ru: 'Последний чек сохранён: {path}', zh: '已保存最新小票：{path}', ja: '最新のレシートを保存しました：{path}', pt: 'Último recibo salvo: {path}', de: 'Letzter Beleg gespeichert: {path}', ko: '최신 영수증을 저장했습니다: {path}' },
  savedAll: { en: 'Saved {n} receipts: {path}', he: '{n} קבלות נשמרו: {path}', es: '{n} recibos guardados: {path}', fr: '{n} reçus enregistrés : {path}', ru: 'Чеков сохранено: {n} — {path}', zh: '已保存 {n} 张小票：{path}', ja: '{n} 件のレシートを保存しました：{path}', pt: '{n} recibos salvos: {path}', de: '{n} Belege gespeichert: {path}', ko: '영수증 {n}개를 저장했습니다: {path}' },
  saveFailed: { en: 'Could not save the file', he: 'לא ניתן לשמור את הקובץ', es: 'No se pudo guardar el archivo', fr: 'Impossible d’enregistrer le fichier', ru: 'Не удалось сохранить файл', zh: '无法保存文件', ja: 'ファイルを保存できませんでした', pt: 'Não foi possível salvar o arquivo', de: 'Datei konnte nicht gespeichert werden', ko: '파일을 저장할 수 없습니다' },
  historyTitle: { en: 'History ({n})', he: 'היסטוריה ({n})', es: 'Historial ({n})', fr: 'Historique ({n})', ru: 'История ({n})', zh: '历史（{n}）', ja: '履歴（{n}）', pt: 'Histórico ({n})', de: 'Verlauf ({n})', ko: '기록 ({n})' },
} as const

type Counts = { reads: number; edits: number; writes: number; searches: number; bash: number; web: number; agents: number; other: number }
type Receipt = { id: number; at: number; counts: Counts; durationMs: number; tokens: number; cost: number | null }
/** `view`: the receipt id shown in the pane (null: the latest); `isOpen`: the history list is expanded. */
type State = { seq: number; list: Receipt[]; view: number | null; isOpen: boolean }
type Stored = { seq: number; list: Receipt[] }

const receipts = atom({ plugin: 'toolkitty', key: 'slot', id: 'turn-receipt' } as const, { seq: 0, list: [], view: null, isOpen: false } as State) as unknown as Atom<State>

// The shared theme slot, the same ref as in themes.tsx; the render hooks read it, so a switch redraws.
const theme = atom({ plugin: 'toolkitty', key: 'slot', id: 'theme' } as const, BUILTIN_THEMES[0] as Theme) as unknown as Atom<Theme>

export const feature: Feature = {
  id: 'turn-receipt',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const zero = (): Counts => ({ reads: 0, edits: 0, writes: 0, searches: 0, bash: 0, web: 0, agents: 0, other: 0 })
const COLS = 34
const MIN_MS = 15_000
const MIN_CALLS = 3
const KEEP = 30
const HISTORY_KEY = 'turn-receipt:history'
const HEADER = 'CLAUDE CODE · RECEIPT'

let counts: Counts = zero()
let startCost: number | null = null

function bucket(tool: string): keyof Counts {
  if (tool === 'Read' || tool === 'NotebookRead') return 'reads'
  if (tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') return 'edits'
  if (tool === 'Write') return 'writes'
  if (tool === 'Grep' || tool === 'Glob') return 'searches'
  if (tool === 'Bash' || tool === 'PowerShell') return 'bash'
  if (tool === 'WebFetch' || tool === 'WebSearch') return 'web'
  if (tool === 'Agent' || tool === 'Task') return 'agents'
  return 'other'
}

const total = (c: Counts): number => c.reads + c.edits + c.writes + c.searches + c.bash + c.web + c.agents + c.other
const thousands = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const money = (c: number | null): string => (c === null ? '—' : `$${c.toFixed(2)}`)
const pad2 = (n: number): string => String(n).padStart(2, '0')
const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function dateLine(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = s
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const seedOf = (r: Receipt): number => (r.id * 7919 + (r.at % 100003) + r.tokens) >>> 0
const serial = (r: Receipt): string => `${String(r.id).padStart(4, '0')} ${String(seedOf(r) % 100000).padStart(5, '0')}`

// ---------- the receipt as rows, drawn as a Box (terminal) or an Svg (desktop) ----------

type Row =
  | { k: 'title' }
  | { k: 'center'; text: string; dim?: boolean }
  | { k: 'sep' }
  | { k: 'dsep' }
  | { k: 'leader'; label: string; value: string; big?: boolean }
  | { k: 'barcode' }

/** The footer line: the theme's, or the localized default when the theme has none. */
const footerOf = (th: Theme): string => (th.receipt.footer.trim() === '' ? t(T.footer) : th.receipt.footer)

function rowsOf(r: Receipt, footer: string): Row[] {
  const c = r.counts
  const out: Row[] = [{ k: 'title' }, { k: 'center', text: dateLine(r.at), dim: true }, { k: 'sep' }]
  const items: Array<[string, number]> = [
    [t(T.reads), c.reads],
    [t(T.edits), c.edits],
    [t(T.writes), c.writes],
    [t(T.searches), c.searches],
    [t(T.bash), c.bash],
    [t(T.web), c.web],
    [t(T.agents), c.agents],
    [t(T.other), c.other],
  ]
  let shown = 0
  for (const [label, n] of items) {
    if (n <= 0) continue
    out.push({ k: 'leader', label, value: String(n) })
    shown++
  }
  if (shown === 0) out.push({ k: 'center', text: t(T.noTools), dim: true })
  out.push({ k: 'sep' })
  out.push({ k: 'leader', label: t(T.time), value: clockText(r.durationMs) })
  out.push({ k: 'leader', label: t(T.subtotal), value: `${thousands(r.tokens)} ${t(T.tok)}` })
  out.push({ k: 'dsep' })
  out.push({ k: 'leader', label: t(T.total), value: money(r.cost), big: true })
  out.push({ k: 'sep' })
  out.push({ k: 'barcode' })
  out.push({ k: 'center', text: `* ${serial(r)} *`, dim: true })
  out.push({ k: 'center', text: footer })
  return out
}

const GLYPHS = ['▌', '█', '▐', '║', '|']

function barcodeText(r: Receipt): string {
  const g = rng(seedOf(r))
  let s = ''
  for (let i = 0; i < COLS; i++) s += GLYPHS[Math.floor(g() * GLYPHS.length)] ?? '|'
  return s
}

function leaderText(label: string, value: string): string {
  const dots = Math.max(2, COLS - [...label].length - [...value].length - 2)
  return `${label} ${'.'.repeat(dots)} ${value}`
}

const dashes = (ch: string): string => Array.from({ length: COLS / 2 }, () => ch).join(' ')

function receiptLines(r: Receipt, footer: string): string[] {
  const lines: string[] = []
  for (const row of rowsOf(r, footer)) {
    if (row.k === 'title') lines.push(HEADER)
    else if (row.k === 'center') lines.push(row.text)
    else if (row.k === 'sep') lines.push('-'.repeat(COLS))
    else if (row.k === 'dsep') lines.push('='.repeat(COLS))
    else if (row.k === 'leader') lines.push(leaderText(row.label, row.value))
  }
  return lines
}

function receiptText(r: Receipt, footer: string): string {
  return [...receiptLines(r, footer), '', t(T.getYours)].join('\n')
}

/** The whole history, oldest first, as one text file. */
function historyText(list: Receipt[], footer: string): string {
  const blocks = list.map(r => receiptLines(r, footer).join('\n'))
  return [`${HEADER} · ${t(T.historyTitle, { n: list.length })}`, '', blocks.join('\n\n'), '', t(T.getYours)].join('\n')
}

/** A stored history, checked: anything that is not a well-formed receipt is dropped. */
function sanitize(raw: unknown): Stored {
  if (typeof raw !== 'object' || raw === null) return { seq: 0, list: [] }
  const obj = raw as { seq?: unknown; list?: unknown }
  const list: Receipt[] = []
  const rows: unknown[] = Array.isArray(obj.list) ? obj.list : []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const x = row as Record<string, unknown>
    const c = x.counts as Record<string, unknown> | null | undefined
    if (typeof x.id !== 'number' || typeof x.at !== 'number' || typeof x.durationMs !== 'number' || typeof x.tokens !== 'number') continue
    if (typeof c !== 'object' || c === null) continue
    const num = (k: string): number => (typeof c[k] === 'number' ? (c[k] as number) : 0)
    const counts: Counts = { reads: num('reads'), edits: num('edits'), writes: num('writes'), searches: num('searches'), bash: num('bash'), web: num('web'), agents: num('agents'), other: num('other') }
    list.push({ id: x.id, at: x.at, counts, durationMs: x.durationMs, tokens: x.tokens, cost: typeof x.cost === 'number' ? x.cost : null })
  }
  const top = list.reduce((m, r) => Math.max(m, r.id), 0)
  const seq = typeof obj.seq === 'number' && obj.seq >= top ? obj.seq : top
  return { seq, list: list.slice(-KEEP) }
}

const hhmm = (ms: number): string => {
  const d = new Date(ms)
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function receiptSvg(r: Receipt, th: Theme): { source: string; width: number; height: number } {
  const W = 320
  const M = 24
  const GRID = (W - 2 * M) / COLS
  const font = "'Cascadia Mono','SF Mono',Consolas,'Courier New',monospace"
  const ink = '#2b2926'
  const faint = '#8a857c'
  const rows = rowsOf(r, footerOf(th))
  let y = 30
  let body = ''
  // the asterisk mark
  body += `<g stroke="${th.receipt.accent}" stroke-width="3.4" stroke-linecap="round" transform="translate(${W / 2} ${y})"><path d="M0 -10V10M-10 0H10M-7 -7L7 7M-7 7L7 -7"/></g>`
  y += 32
  for (const row of rows) {
    if (row.k === 'title') {
      body += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${font}" font-size="14.5" font-weight="700" letter-spacing="1" fill="${ink}">${escapeXml(HEADER)}</text>`
      y += 20
    } else if (row.k === 'center') {
      body += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${font}" font-size="12.5" fill="${row.dim === true ? faint : ink}" letter-spacing="${row.dim === true ? 0.3 : 1.2}">${escapeXml(row.text)}</text>`
      y += 20
    } else if (row.k === 'sep' || row.k === 'dsep') {
      body += `<text x="${M}" y="${y}" font-family="${font}" font-size="13" fill="${faint}" textLength="${W - 2 * M}" lengthAdjust="spacing" xml:space="preserve">${dashes(row.k === 'sep' ? '-' : '=')}</text>`
      y += 22
    } else if (row.k === 'leader') {
      const size = row.big === true ? 21 : 13.5
      const wt = row.big === true ? 700 : 400
      const labelW = [...row.label].length * GRID * (size / 13.5) * 0.98 + 6
      const valueW = [...row.value].length * GRID * (size / 13.5) * 0.98 + 6
      if (row.big === true) y += 6
      body += `<text x="${M}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${wt}" fill="${ink}">${escapeXml(row.label)}</text>`
      body += `<text x="${W - M}" y="${y}" text-anchor="end" font-family="${font}" font-size="${size}" font-weight="${wt}" fill="${ink}">${escapeXml(row.value)}</text>`
      if (M + labelW < W - M - valueW - 8) {
        body += `<line x1="${M + labelW}" y1="${y - 3}" x2="${W - M - valueW}" y2="${y - 3}" stroke="${faint}" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 5"/>`
      }
      y += row.big === true ? 28 : 21
    } else {
      const g = rng(seedOf(r))
      let x = M
      let bars = ''
      while (x < W - M - 4) {
        const bw = 1 + Math.floor(g() * 4)
        const gap = 1 + Math.floor(g() * 3)
        if (x + bw > W - M) break
        bars += `<rect x="${x}" y="${y}" width="${bw}" height="38"/>`
        x += bw + gap
      }
      body += `<g fill="${ink}">${bars}</g>`
      y += 54
    }
  }
  y += 6
  // torn top and bottom edges
  const teeth = 32
  const tw = W / teeth
  let top = 'M0 8'
  for (let i = 0; i < teeth; i++) top += `L${(i * tw + tw / 2).toFixed(1)} ${i % 2 === 0 ? 1 : 9}L${((i + 1) * tw).toFixed(1)} 8`
  let bottom = ''
  for (let i = teeth; i > 0; i--) bottom += `L${(i * tw - tw / 2).toFixed(1)} ${y + (i % 2 === 0 ? 10 : 1)}L${((i - 1) * tw).toFixed(1)} ${y + 4}`
  const paper = `${top}L${W} ${y + 4}${bottom}Z`
  const pad = 10
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${y + 12 + 2 * pad}" width="${W + 2 * pad}" height="${y + 12 + 2 * pad}">` +
    `<defs><filter id="sh" x="-10%" y="-5%" width="120%" height="115%"><feDropShadow dx="0" dy="3" stdDeviation="3.2" flood-color="#000" flood-opacity=".38"/></filter>` +
    `<linearGradient id="pp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbf9f3"/><stop offset=".5" stop-color="#fffdf8"/><stop offset="1" stop-color="#f6f2e8"/></linearGradient></defs>` +
    `<path d="${paper}" fill="url(#pp)" filter="url(#sh)"/>` +
    body +
    `</svg>`
  return { source, width: W + 2 * pad, height: y + 12 + 2 * pad }
}

/** `header` is the pane's header (its share action lives there); a placed row has none and keeps its own share button. */
async function drawReceipt(
  $: EngineInterface,
  e: RenderInput<'Placed'> | RenderInput<'Pane'>,
  r: Receipt,
  header: RenderElement | null,
  history: RenderElement | null,
): Promise<RenderElement> {
  const th = await read($, theme)
  const footer = footerOf(th)
  const bar = exportBar($, e, { kind: 'receipt', svg: receiptSvg(r, th).source, text: receiptText(r, footer), share: receiptText(r, footer), feature: feature.id })
  if (e.surface === 'desktop') {
    const { Box, Svg } = $.ui.resolve(e)
    const svg = receiptSvg(r, th)
    const alt = t(T.alt, { calls: total(r.counts), time: clockText(r.durationMs), tokens: thousands(r.tokens), total: money(r.cost) })
    return (
      <Box flexDirection="column" marginY={1}>
        {header}
        <Svg source={svg.source} alt={alt} width={svg.width} height={svg.height} />
        {bar}
        {history}
      </Box>
    )
  }

  const { Box, Text } = $.ui.resolve(e)
  const rows = rowsOf(r, footer)
  return (
    <Box flexDirection="column" marginY={1}>
      {header}
      <Box flexDirection="column" borderStyle="single" width={38} paddingX={1}>
        {rows.map((row, i) => {
          const key = `rc-${i}`
          if (row.k === 'title') {
            return (
              <Box key={key} justifyContent="center">
                <Text bold color={th.receipt.accent}>
                  {HEADER}
                </Text>
              </Box>
            )
          }
          if (row.k === 'center') {
            return (
              <Box key={key} justifyContent="center">
                <Text dimColor={row.dim === true}>{row.text}</Text>
              </Box>
            )
          }
          if (row.k === 'sep') return <Text key={key} dimColor>{dashes('-')}</Text>
          if (row.k === 'dsep') return <Text key={key} dimColor>{dashes('=')}</Text>
          if (row.k === 'leader') {
            return (
              <Text key={key} bold={row.big === true}>
                {leaderText(row.label, row.value)}
              </Text>
            )
          }
          return <Text key={key}>{barcodeText(r)}</Text>
        })}
      </Box>
      {bar}
      {history}
    </Box>
  )
}

async function selectReceipt($: EngineInterface, id: number): Promise<void> {
  await update($, receipts, s => ({ ...s, view: id }))
}

async function toggleHistory($: EngineInterface): Promise<void> {
  await update($, receipts, s => ({ ...s, isOpen: !s.isOpen }))
}

/** Keeps the last receipts in the store so the history survives a restart. */
async function persist($: EngineInterface): Promise<void> {
  const s = await read($, receipts)
  try {
    await storeSet($, HISTORY_KEY, { seq: s.seq, list: s.list.slice(-KEEP) })
  } catch {
    // the live atom still holds them
  }
}

/** The collapsed "History (N)" line and, when open, one line per kept receipt, newest first. */
function historyView($: EngineInterface, e: RenderInput<'Pane'>, s: State, shownId: number): RenderElement {
  const { Box, Button } = $.ui.resolve(e)
  const n = s.list.length
  const title = t(T.historyTitle, { n })
  return (
    <Box flexDirection="column" marginTop={1}>
      <Button key="receipt-history" plain label={`${s.isOpen ? '▾' : '▸'} ${title}`} onPress={() => toggleHistory($)} />
      {s.isOpen ? sectionTitle($, e, title) : null}
      {s.isOpen
        ? [...s.list].reverse().map(r =>
            listRow($, e, {
              key: `receipt-hist-${r.id}`,
              left: r.id === shownId ? '›' : ' ',
              text: `${hhmm(r.at)} · ${t(T.statusCalls, { n: total(r.counts) })} · ${thousands(r.tokens)} ${t(T.tok)} · ${money(r.cost)}`,
              level: r.id === shownId ? 'info' : 'ok',
              onPress: () => selectReceipt($, r.id),
            }),
          )
        : null}
    </Box>
  )
}

// ---------- handlers ----------

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'receipt', description: t(T.cmdDesc), argumentHint: t(T.argHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'receipt', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  // The live atom stays the source; the stored history fills in what an earlier session kept.
  const stored = sanitize(await $.store.get(HISTORY_KEY))
  if (stored.list.length === 0 && stored.seq === 0) return
  await update($, receipts, s => {
    const have = new Set(s.list.map(r => r.id))
    const merged = [...stored.list.filter(r => !have.has(r.id)), ...s.list].sort((a, b) => a.id - b.id).slice(-KEEP)
    return { ...s, seq: Math.max(s.seq, stored.seq), list: merged }
  })
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  counts = zero()
  const usage = await $.session.usage()
  startCost = usage.cost?.usd ?? null
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (result.deny !== undefined) return result
  const name: string = e.tool
  counts = { ...counts, [bucket(name)]: counts[bucket(name)] + 1 }
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  const calls = total(counts)
  if (!(e.durationMs > MIN_MS || calls > MIN_CALLS)) return

  const u = e.usage
  const tokens = u === undefined ? 0 : u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
  const usage = await $.session.usage()
  const nowCost = usage.cost?.usd
  const cost = startCost !== null && nowCost !== undefined ? Math.max(0, nowCost - startCost) : null
  const at = await $.clock.now()

  const prev = await read($, receipts)
  const id = prev.seq + 1
  const receipt: Receipt = { id, at, counts, durationMs: e.durationMs, tokens, cost }
  await update($, receipts, s => ({ ...s, seq: id, list: [...s.list, receipt].slice(-KEEP), view: null }))
  counts = zero()
  await persist($)

  // A new id each turn: a row placed under an id that already stands is the same row.
  try {
    const placed = await $.ui.place({ id: `receipt-${id}` })
    if (!placed.isPlaced) await $.ui.open({ id: 'receipt', title: t(T.paneTitle) })
  } catch {
    // no surface attached: nothing to draw into
  }
}

export function register(on: On) {
  on('command.run', { command: 'receipt' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const arg = e.args.trim().toLowerCase()
    const s = await read($, receipts)
    const latest = s.list[s.list.length - 1]
    if (arg === '') {
      await update($, receipts, cur => ({ ...cur, view: null }))
      await $.ui.open({ id: 'receipt', title: t(T.paneTitle), focus: true, closeOnEscape: true })
      return { text: latest === undefined ? t(T.noReceipt) : t(T.opened) }
    }
    if (arg !== 'save' && arg !== 'all') return { text: t(T.usage) }
    if (latest === undefined) return { text: t(T.noReceipt) }
    const th = await read($, theme)
    if (arg === 'save') {
      const saved = await writeExport($, 'receipt', 'svg', receiptSvg(latest, th).source)
      return { text: saved.isSaved ? t(T.savedLatest, { path: saved.path }) : t(T.saveFailed) }
    }
    const saved = await writeExport($, 'receipt-history', 'txt', historyText(s.list, footerOf(th)))
    return { text: saved.isSaved ? t(T.savedAll, { n: s.list.length, path: saved.path }) : t(T.saveFailed) }
  })

  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    if (!(await isOn($, feature))) return next(e)
    if (!e.props.id.startsWith('receipt-')) return next(e)
    const id = Number(e.props.id.slice('receipt-'.length))
    const s = await read($, receipts)
    const r = s.list.find(one => one.id === id)
    if (r === undefined) return next(e)
    return drawReceipt($, e, r, null, null)
  })

  on('ui.render', { component: 'Pane', requestId: 'receipt' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneTitle)}</Text>
    const s = await read($, receipts)
    const latest = s.list[s.list.length - 1]
    if (latest === undefined) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.visual })}
          {emptyState($, e, t(T.noReceipt), t(T.noReceiptHint))}
        </Box>
      )
    }
    const r = (s.view === null ? undefined : s.list.find(one => one.id === s.view)) ?? latest
    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: t(T.statusCalls, { n: total(r.counts) }),
      level: 'info',
      icon: ICONS.visual,
    })
    return drawReceipt($, e, r, header, historyView($, e, s, r.id))
  })
}
