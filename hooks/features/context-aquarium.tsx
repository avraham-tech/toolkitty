import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { exportBar } from '../exports'
import { ICONS, paneHeader } from '../ui'
import type { Level } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Context aquarium', he: 'אקווריום ההקשר', es: 'Acuario de contexto', fr: 'Aquarium du contexte', ru: 'Аквариум контекста', zh: '上下文水族箱', ja: 'コンテキスト水槽', pt: 'Aquário de contexto', de: 'Kontext-Aquarium', ko: '컨텍스트 수족관' },
  description: {
    en: 'The context window as a fish tank: the water rises with usage and turns murky, each tool call in a turn is a fish, bubbles rise while Claude works.',
    he: 'חלון ההקשר כאקווריום: המים עולים עם השימוש ומתעכרים, כל קריאה לכלי בתור היא דג, ובועות עולות בזמן שClaude עובד.',
    es: 'La ventana de contexto como un acuario: el agua sube con el uso y se enturbia, cada herramienta del turno es un pez y suben burbujas mientras Claude trabaja.',
    fr: 'La fenêtre de contexte en aquarium : l’eau monte avec l’usage et se trouble, chaque appel d’outil du tour est un poisson, des bulles montent pendant que Claude travaille.',
    ru: 'Окно контекста как аквариум: вода поднимается и мутнеет, каждый вызов инструмента в ходе — рыбка, пока Claude работает, поднимаются пузырьки.',
    zh: '把上下文窗口画成鱼缸：用量越多水位越高、水越浑浊，一轮中的每次工具调用是一条鱼，Claude 工作时会冒泡。',
    ja: 'コンテキストウィンドウを水槽として表示します: 使用量が増えると水位が上がって濁り、ターン内のツール呼び出しは1匹の魚になり、Claude が作業中は泡が立ちます。',
    pt: 'A janela de contexto como um aquário: a água sobe com o uso e fica turva, cada chamada de ferramenta em um turno é um peixe e bolhas sobem enquanto o Claude trabalha.',
    de: 'Das Kontextfenster als Fischbecken: Das Wasser steigt mit der Nutzung und trübt sich, jeder Tool-Aufruf in einem Durchgang ist ein Fisch, Blasen steigen auf, während Claude arbeitet.',
    ko: '컨텍스트 창을 어항으로 보여 줍니다. 사용량이 늘수록 물이 차오르며 탁해지고, 한 턴의 도구 호출 하나가 물고기 한 마리가 되며, Claude가 일하는 동안 거품이 올라옵니다.',
  },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty',
    ru: 'Функция отключена; включите её в панели /toolkitty',
    zh: '该功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  cmdDesc: {
    en: 'Shows the context window as an aquarium',
    he: 'מציג את חלון ההקשר כאקווריום',
    es: 'Muestra la ventana de contexto como un acuario',
    fr: 'Affiche la fenêtre de contexte sous forme d’aquarium',
    ru: 'Показывает окно контекста в виде аквариума',
    zh: '把上下文窗口显示为水族箱',
    ja: 'コンテキストウィンドウを水槽として表示します',
    pt: 'Mostra a janela de contexto como um aquário',
    de: 'Zeigt das Kontextfenster als Aquarium',
    ko: '컨텍스트 창을 수족관으로 보여 줍니다',
  },
  paneTitle: { en: 'Aquarium', he: 'אקווריום', es: 'Acuario', fr: 'Aquarium', ru: 'Аквариум', zh: '水族箱', ja: '水槽', pt: 'Aquário', de: 'Aquarium', ko: '수족관' },
  opened: { en: 'The aquarium is open.', he: 'האקווריום פתוח.', es: 'El acuario está abierto.', fr: 'L’aquarium est ouvert.', ru: 'Аквариум открыт.', zh: '水族箱已打开。', ja: '水槽を開きました。', pt: 'O aquário está aberto.', de: 'Das Aquarium ist offen.', ko: '수족관이 열려 있습니다.' },
  context: { en: 'CONTEXT', he: 'הקשר', es: 'CONTEXTO', fr: 'CONTEXTE', ru: 'КОНТЕКСТ', zh: '上下文', ja: 'コンテキスト', pt: 'CONTEXTO', de: 'KONTEXT', ko: '컨텍스트' },
  caption: {
    en: '{percent} of the context window · {n} fish (tool calls this turn)',
    he: '{percent} מחלון ההקשר · {n} דגים (קריאות לכלים בתור הזה)',
    es: '{percent} de la ventana de contexto · {n} peces (herramientas de este turno)',
    fr: '{percent} de la fenêtre de contexte · {n} poissons (outils de ce tour)',
    ru: '{percent} окна контекста · рыбок: {n} (вызовы инструментов в этом ходу)',
    zh: '占上下文窗口的 {percent} · {n} 条鱼（本轮工具调用）',
    ja: 'コンテキストウィンドウの {percent} · 魚 {n} 匹（このターンのツール呼び出し）',
    pt: '{percent} da janela de contexto · {n} peixes (chamadas de ferramenta neste turno)',
    de: '{percent} des Kontextfensters · {n} Fische (Tool-Aufrufe in diesem Durchgang)',
    ko: '컨텍스트 창의 {percent} · 물고기 {n}마리(이번 턴의 도구 호출)',
  },
  unknown: { en: 'unknown', he: 'לא ידוע', es: 'desconocido', fr: 'inconnu', ru: 'неизвестно', zh: '未知', ja: '不明', pt: 'desconhecido', de: 'unbekannt', ko: '알 수 없음' },
  murky: {
    en: 'The water is getting murky: context is past 90%. Time to /compact or start fresh.',
    he: 'המים מתעכרים: ההקשר מעל 90%. הגיע הזמן ל-/compact או להתחיל מחדש.',
    es: 'El agua se enturbia: el contexto supera el 90%. Es hora de /compact o de empezar de nuevo.',
    fr: 'L’eau se trouble : le contexte dépasse 90 %. Il est temps de faire /compact ou de repartir à zéro.',
    ru: 'Вода мутнеет: контекст заполнен более чем на 90%. Пора выполнить /compact или начать заново.',
    zh: '水变浑浊了：上下文已超过 90%。该 /compact 或重新开始了。',
    ja: '水が濁ってきました: コンテキストが90%を超えています。/compact するか、新しく始めましょう。',
    pt: 'A água está ficando turva: o contexto passou de 90%. Hora de usar /compact ou começar do zero.',
    de: 'Das Wasser wird trüb: Der Kontext liegt über 90 %. Zeit für /compact oder einen Neustart.',
    ko: '물이 탁해지고 있습니다: 컨텍스트가 90%를 넘었습니다. /compact 하거나 새로 시작할 때입니다.',
  },
  alt: {
    en: 'An aquarium filled to {percent}, with {n} fish',
    he: 'אקווריום מלא עד {percent}, עם {n} דגים',
    es: 'Un acuario lleno al {percent}, con {n} peces',
    fr: 'Un aquarium rempli à {percent}, avec {n} poissons',
    ru: 'Аквариум, заполненный на {percent}, рыбок: {n}',
    zh: '水位达到 {percent} 的水族箱，里面有 {n} 条鱼',
    ja: '{percent} まで満たされた水槽、魚は {n} 匹',
    pt: 'Um aquário cheio até {percent}, com {n} peixes',
    de: 'Ein bis {percent} gefülltes Aquarium mit {n} Fischen',
    ko: '{percent}까지 찬 수족관, 물고기 {n}마리',
  },
} as const

type State = { percent: number | null; fish: number; working: boolean }

const tank = atom({ plugin: 'toolkitty', key: 'slot', id: 'context-aquarium' } as const, { percent: null, fish: 0, working: false } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'context-aquarium',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const MAX_FISH = 12
const FLOOR = 28
let warned = false

// ---------- colour of the water: clear blue, murky green past 70%, brown past 90% ----------

const STOPS: Array<[number, [number, number, number]]> = [
  [0, [56, 189, 248]],
  [60, [56, 189, 248]],
  [75, [122, 166, 59]],
  [90, [139, 94, 52]],
  [100, [104, 68, 38]],
]

function waterRgb(percent: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    const hi = STOPS[i]
    const lo = STOPS[i - 1]
    if (hi === undefined || lo === undefined) continue
    if (percent <= hi[0]) {
      const f = hi[0] === lo[0] ? 1 : (percent - lo[0]) / (hi[0] - lo[0])
      return [Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * f), Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * f), Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * f)]
    }
  }
  return [104, 68, 38]
}

const hex = (c: [number, number, number], k = 1): string => `#${c.map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('')}`

// ---------- the desktop drawing ----------

const FISH_COLORS = ['#fb923c', '#facc15', '#f472b6', '#2dd4bf', '#a78bfa', '#f87171']

function fishShape(kind: number, c: string): string {
  if (kind === 0) {
    return `<ellipse rx="9" ry="5.5" fill="${c}"/><path d="M-8 0L-16 -5.5V5.5z" fill="${c}"/><path d="M-1 -5L2 -9.5L5.5 -5z" fill="#000" opacity=".2"/><circle cx="5" cy="-1.4" r="1.3" fill="#111"/>`
  }
  if (kind === 1) {
    return `<circle r="7" fill="${c}"/><path d="M-6 0L-13.5 -5.5V5.5z" fill="${c}"/><path d="M-1 -6.5L3.5 -12L6 -5.5zM-1 6.5L3.5 12L6 5.5z" fill="#000" opacity=".2"/><circle cx="3.5" cy="-1.4" r="1.3" fill="#111"/>`
  }
  return `<path d="M-11 0Q0 -6.5 11 0Q0 6.5 -11 0z" fill="${c}"/><path d="M-10 0L-17.5 -4.5L-15 0L-17.5 4.5z" fill="${c}"/><path d="M-4.5 -1.4H6" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/><circle cx="7" cy="-0.8" r="1.1" fill="#111"/>`
}

function tankSvg(percent: number, fish: number, working: boolean): string {
  const X = 22
  const W = 276
  const BOTTOM = 190
  const H = 160
  const level = Math.max(percent, FLOOR) / 100
  const waterH = H * level
  const top = BOTTOM - waterH
  const rgb = waterRgb(percent)
  const topColor = hex(rgb, 1.15)
  const deepColor = hex(rgb, 0.62)
  const label = percent >= 90 ? '#fca5a5' : percent >= 70 ? '#d9f99d' : '#e0f2fe'

  // water surface wave: period 46, drawn wider than the tank and slid left forever
  let wave = `M${X - 46} ${top.toFixed(1)}`
  for (let i = 0; i < 17; i++) wave += i === 0 ? 'q11.5 -5 23 0' : 't23 0'
  wave += `V${(top + 16).toFixed(1)}H${X - 46}Z`

  const count = Math.max(1, Math.min(MAX_FISH, fish))
  const yMax = 164
  const yMin = Math.min(top + 12, yMax - 4)
  let swimmers = ''
  for (let i = 0; i < count; i++) {
    const dir = i % 2 === 0 ? 1 : -1
    const dur = working ? 8 + (i % 5) * 1.7 : 22 + (i % 5) * 3.4
    const begin = ((i * 37) % 100) / 100 * dur
    const y = yMin + (((i * 53) % 100) / 100) * (yMax - yMin)
    const from = dir === 1 ? X - 26 : X + W + 26
    const to = dir === 1 ? X + W + 26 : X - 26
    const bob = 1.5 + (i % 3) * 0.4
    swimmers +=
      `<g><animateTransform attributeName="transform" type="translate" values="${from} ${y.toFixed(1)};${to} ${y.toFixed(1)}" dur="${dur.toFixed(1)}s" begin="${(-begin).toFixed(1)}s" repeatCount="indefinite"/>` +
      `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="${bob.toFixed(1)}s" repeatCount="indefinite"/>` +
      `<g transform="scale(${dir} 1)">${fishShape(i % 3, FISH_COLORS[i % FISH_COLORS.length] ?? '#fb923c')}</g></g></g>`
  }

  let bubbles = ''
  if (working) {
    const xs = [66, 118, 124, 176, 192, 232, 262, 142, 100]
    xs.forEach((x, i) => {
      const dur = 2.6 + (i % 4) * 0.8
      bubbles +=
        `<circle cx="${x}" cy="168" r="${(1.4 + (i % 3) * 0.7).toFixed(1)}" fill="#e0f2fe" fill-opacity=".18" stroke="#e0f2fe" stroke-width="1">` +
        `<animate attributeName="cy" values="168;${(top + 2).toFixed(1)}" dur="${dur}s" begin="${(-i * 0.6).toFixed(1)}s" repeatCount="indefinite"/>` +
        `<animate attributeName="cx" values="${x};${x + 3};${x - 3};${x}" dur="${dur}s" begin="${(-i * 0.6).toFixed(1)}s" repeatCount="indefinite"/>` +
        `<animate attributeName="opacity" values="0;.9;.9;0" keyTimes="0;.15;.8;1" dur="${dur}s" begin="${(-i * 0.6).toFixed(1)}s" repeatCount="indefinite"/></circle>`
    })
  }

  const strand = (x: number, hh: number, dur: number, c: string): string =>
    `<g transform="translate(${x} 178)"><g><animateTransform attributeName="transform" type="skewX" values="-5;5;-5" dur="${dur}s" repeatCount="indefinite"/>` +
    `<path d="M0 0C-8 ${-hh * 0.22} 8 ${-hh * 0.4} 0 ${-hh * 0.62}C-6 ${-hh * 0.8} 4 ${-hh * 0.9} 0 ${-hh}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/></g></g>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" width="320" height="220">` +
    `<defs><linearGradient id="wt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${topColor}" stop-opacity=".62"/><stop offset="1" stop-color="${deepColor}" stop-opacity=".92"/></linearGradient>` +
    `<clipPath id="tk"><rect x="${X}" y="30" width="${W}" height="${H}" rx="9"/></clipPath></defs>` +
    `<rect width="320" height="220" rx="16" fill="#10131c"/>` +
    `<text x="22" y="21" font-family="sans-serif" font-size="10" font-weight="700" letter-spacing="2" fill="#8b95a5">${t(T.context)}</text>` +
    `<text x="298" y="22" text-anchor="end" font-family="sans-serif" font-size="17" font-weight="800" fill="${label}">${Math.round(percent)}%</text>` +
    `<rect x="${X}" y="30" width="${W}" height="${H}" rx="9" fill="#0b1220"/>` +
    `<g clip-path="url(#tk)">` +
    `<rect x="${X}" y="${top.toFixed(1)}" width="${W}" height="${waterH.toFixed(1)}" fill="url(#wt)"/>` +
    `<g fill="${topColor}" fill-opacity=".62"><animateTransform attributeName="transform" type="translate" values="0 0;-46 0" dur="3.6s" repeatCount="indefinite"/><path d="${wave}"/></g>` +
    `<path d="M${X} 176Q80 168 140 176T260 174T${X + W} 177V${BOTTOM}H${X}Z" fill="#e2c58a"/>` +
    `<circle cx="48" cy="183" r="1.6" fill="#c9a96b"/><circle cx="104" cy="185" r="1.3" fill="#c9a96b"/><circle cx="170" cy="182" r="1.5" fill="#c9a96b"/><circle cx="214" cy="186" r="1.2" fill="#c9a96b"/>` +
    `<ellipse cx="64" cy="176" rx="16" ry="9" fill="#7c8696"/><ellipse cx="83" cy="180" rx="10" ry="6" fill="#98a2b3"/>` +
    strand(246, 64, 3.4, '#3fae6a') +
    strand(256, 48, 2.9, '#52c27d') +
    strand(237, 40, 3.9, '#2f9a5a') +
    swimmers +
    bubbles +
    `<line x1="${X}" y1="${(BOTTOM - H * 0.9).toFixed(1)}" x2="${X + W}" y2="${(BOTTOM - H * 0.9).toFixed(1)}" stroke="#f87171" stroke-width="1" stroke-dasharray="4 4" opacity=".55"/>` +
    `<path d="M50 30L74 30L38 190L22 190L22 170z" fill="#fff" opacity=".05"/>` +
    `</g>` +
    `<rect x="${X}" y="30" width="${W}" height="${H}" rx="9" fill="none" stroke="#cbd5e1" stroke-opacity=".55" stroke-width="3"/>` +
    `<rect x="14" y="192" width="292" height="14" rx="5" fill="#1b2030"/>` +
    `</svg>`
  )
}

// ---------- the terminal drawing ----------

function tankRows(percent: number, fish: number, working: boolean): { rows: string[]; surface: number } {
  const WIDTH = 30
  const ROWS = 10
  const waterRows = Math.max(3, Math.min(9, Math.round((Math.max(percent, FLOOR) / 100) * 9)))
  const surface = ROWS - 1 - waterRows
  const grid: string[][] = Array.from({ length: ROWS }, () => Array.from({ length: WIDTH }, () => ' '))
  const put = (row: number, col: number, text: string): void => {
    const line = grid[row]
    if (line === undefined || row <= surface || row >= ROWS - 1) return
    ;[...text].forEach((ch, i) => {
      if (col + i < WIDTH && line[col + i] === ' ') line[col + i] = ch
    })
  }
  const open = ROWS - 2 - surface
  const count = Math.max(1, Math.min(MAX_FISH, fish))
  for (let i = 0; i < count; i++) {
    put(surface + 1 + ((i * 5) % Math.max(1, open)), (i * 11 + 2) % (WIDTH - 3), i % 2 === 0 ? '><>' : '<><')
  }
  if (working) {
    for (const [k, col] of [4, 15, 25].entries()) put(surface + 1 + ((k * 2) % Math.max(1, open)), col, k % 2 === 0 ? 'o' : '°')
  }
  const surfaceLine = grid[surface]
  if (surfaceLine !== undefined) for (let c = 0; c < WIDTH; c++) surfaceLine[c] = c % 2 === 0 ? '~' : '-'
  const sand = grid[ROWS - 1]
  if (sand !== undefined) for (let c = 0; c < WIDTH; c++) sand[c] = c % 3 === 0 ? ':' : '.'
  if (sand !== undefined) sand[WIDTH - 5] = 'Y'
  return { rows: grid.map(r => r.join('')), surface }
}

// ---------- state ----------

async function checkWater($: EngineInterface, percent: number): Promise<void> {
  if (percent >= 90 && !warned) {
    warned = true
    await notice($, 'warn', t(T.murky), feature.id)
  } else if (percent < 80) {
    warned = false
  }
}

async function setPercent($: EngineInterface, raw: number | undefined): Promise<void> {
  if (raw === undefined) return
  const percent = Math.max(0, Math.min(100, Math.round(raw)))
  const s = await read($, tank)
  if (s.percent !== percent) await update($, tank, cur => ({ ...cur, percent }))
  await checkWater($, percent)
}

// ---------- handlers ----------

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'aquarium', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'aquarium', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  const usage = await $.session.usage()
  await setPercent($, usage.context.percent)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await update($, tank, cur => ({ ...cur, fish: 0, working: true }))
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (result.deny === undefined) await update($, tank, cur => ({ ...cur, fish: Math.min(MAX_FISH, cur.fish + 1) }))
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await update($, tank, cur => ({ ...cur, working: false }))
  const usage = await $.session.usage()
  await setPercent($, usage.context.percent)
}

export async function onMeasure($: EngineInterface, e: Input<'session.measure'>): Promise<void> {
  if (!(await isOn($, feature))) return
  await setPercent($, e.context.percent)
}

export function register(on: On) {
  on('command.run', { command: 'aquarium' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: 'aquarium', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'aquarium' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.off)}</Text>

    const s = await read($, tank)
    const percent = s.percent ?? 0
    const shown = s.percent === null ? '—' : `${Math.round(s.percent)}%`
    const level: Level = s.percent === null ? 'ok' : percent >= 90 ? 'alert' : percent >= 70 ? 'warn' : 'info'
    const header = paneHeader($, e, { title: t(T.paneTitle), status: shown, level, icon: ICONS.visual })
    const captionText = t(T.caption, { percent: shown, n: Math.max(1, Math.min(MAX_FISH, s.fish)) })
    const caption = <Text dimColor>{captionText}</Text>
    const bar = exportBar($, e, {
      feature: feature.id,
      kind: 'aquarium',
      svg: e.surface === 'desktop' ? tankSvg(percent, s.fish, s.working) : undefined,
      text: `${t(T.paneTitle)}: ${shown}\n${captionText}`,
    })

    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      const alt = t(T.alt, { percent: shown, n: Math.max(1, Math.min(MAX_FISH, s.fish)) })
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          <Svg source={tankSvg(percent, s.fish, s.working)} alt={alt} width={320} height={220} isInteractive />
          {bar}
          {caption}
        </Box>
      )
    }

    const { rows, surface } = tankRows(percent, s.fish, s.working)
    const water = hex(waterRgb(percent))
    const pctColor = percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'success'
    return (
      <Box flexDirection="column" gap={1}>
        {header}
        <Box flexDirection="column">
          <Box justifyContent="space-between" width={32}>
            <Text dimColor>{t(T.context)}</Text>
            <Text bold color={pctColor}>
              {shown}
            </Text>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderColor={water} width={32}>
            {rows.map((row, i) => (
              <Text key={`tank-${i}`} color={i === rows.length - 1 ? '#e2c58a' : i >= surface ? water : undefined}>
                {row}
              </Text>
            ))}
          </Box>
        </Box>
        {bar}
        {caption}
      </Box>
    )
  })
}
