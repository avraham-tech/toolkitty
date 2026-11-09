import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { BandInput, BandLine, Feature, Input, Output, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { publish, retract, retractAll } from '../signals'
import { ICONS } from '../ui'
import type { Chip } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Loop detective', he: 'בלש לולאות', es: 'Detective de bucles', fr: 'Détective de boucles', ru: 'Детектив зацикливания', zh: '循环侦探', ja: 'ループ探偵', pt: 'Detetive de loops', de: 'Schleifendetektiv', ko: '루프 탐정' },
  description: { en: 'Notices when Claude goes in circles (the same failing command, edit-then-fail cycles, repeated calls), warns you and nudges the model to change approach.', he: 'מזהה כש-Claude מסתובב במעגלים (אותה פקודה שנכשלת, מחזורי עריכה-וכישלון, קריאות חוזרות), מתריע ודוחף את המודל לשנות גישה.', es: 'Detecta cuando Claude da vueltas en círculos (el mismo comando que falla, ciclos de editar y fallar, llamadas repetidas), te avisa y empuja al modelo a cambiar de enfoque.', fr: 'Repère quand Claude tourne en rond (même commande qui échoue, cycles modification puis échec, appels répétés), vous prévient et pousse le modèle à changer d\'approche.', ru: 'Замечает, когда Claude ходит по кругу (одна и та же падающая команда, циклы правка-сбой, повторные вызовы), предупреждает вас и подталкивает модель сменить подход.', zh: '发现 Claude 在兜圈子时（同一条失败的命令、编辑后失败的循环、重复调用）会警告你，并提示模型改变做法。', ja: 'Claude が堂々巡りしているとき（同じ失敗コマンド、編集して失敗するサイクル、繰り返しの呼び出し）に気づいて警告し、やり方を変えるようモデルに促します。', pt: 'Percebe quando o Claude anda em círculos (o mesmo comando falhando, ciclos de editar e falhar, chamadas repetidas), avisa você e orienta o modelo a mudar de abordagem.', de: 'Erkennt, wenn Claude sich im Kreis dreht (derselbe fehlschlagende Befehl, Zyklen aus Ändern und Fehlschlagen, wiederholte Aufrufe), warnt dich und weist das Modell an, den Ansatz zu ändern.', ko: 'Claude가 제자리를 맴돌 때(같은 명령의 반복 실패, 수정 후 실패 사이클, 반복 호출)를 알아채 경고하고, 접근 방식을 바꾸도록 모델을 유도합니다.' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty パネルでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; schalte sie im /toolkitty-Bereich ein', ko: '이 기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요' },
  cmdDesc: { en: 'Shows the loops caught in this session', he: 'מציג את הלולאות שנתפסו בסשן הזה', es: 'Muestra los bucles detectados en esta sesión', fr: 'Affiche les boucles détectées dans cette session', ru: 'Показывает зацикливания, пойманные в этой сессии', zh: '显示本会话中发现的循环', ja: 'このセッションで検出したループを表示します', pt: 'Mostra os loops detectados nesta sessão', de: 'Zeigt die in dieser Sitzung erkannten Schleifen', ko: '이번 세션에서 감지된 루프를 보여줍니다' },
  descA: { en: '"{cmd}" keeps failing', he: '"{cmd}" ממשיכה להיכשל', es: '"{cmd}" sigue fallando', fr: '« {cmd} » continue d\'échouer', ru: '«{cmd}» продолжает падать', zh: '"{cmd}" 一直失败', ja: '"{cmd}" が失敗し続けています', pt: '"{cmd}" continua falhando', de: '"{cmd}" schlägt immer wieder fehl', ko: '"{cmd}"이(가) 계속 실패함' },
  descB: { en: 'edit, then failing tests on {path}', he: 'עריכה ואז בדיקות שנכשלות על {path}', es: 'editar y luego pruebas que fallan en {path}', fr: 'modification puis tests en échec sur {path}', ru: 'правка, затем падающие тесты по {path}', zh: '编辑 {path} 后测试仍然失败', ja: '{path} を編集後にテスト失敗', pt: 'editar e depois testes falhando em {path}', de: 'Änderung, dann fehlschlagende Tests bei {path}', ko: '{path} 수정 후 테스트 실패' },
  descC: { en: '{tool} repeated with the same input', he: '{tool} חוזר עם אותו קלט', es: '{tool} repetido con la misma entrada', fr: '{tool} répété avec la même entrée', ru: '{tool} повторяется с теми же аргументами', zh: '{tool} 以相同输入重复调用', ja: '{tool} が同じ入力で繰り返されています', pt: '{tool} repetido com a mesma entrada', de: '{tool} mit derselben Eingabe wiederholt', ko: '{tool}이(가) 같은 입력으로 반복됨' },
  toast: { en: '🔁 Possible loop: {desc}', he: '🔁 ייתכן שזו לולאה: {desc}', es: '🔁 Posible bucle: {desc}', fr: '🔁 Boucle possible : {desc}', ru: '🔁 Возможное зацикливание: {desc}', zh: '🔁 可能存在循环：{desc}', ja: '🔁 ループの可能性: {desc}', pt: '🔁 Possível loop: {desc}', de: '🔁 Mögliche Schleife: {desc}', ko: '🔁 루프 가능성: {desc}' },
  chipLoop: { en: 'loop!', he: 'לולאה!', es: '¡bucle!', fr: 'boucle !', ru: 'цикл!', zh: '循环！', ja: 'ループ！', pt: 'loop!', de: 'Schleife!', ko: '루프!' },
  band: { en: '🔁 loop: {desc}', he: '🔁 לולאה: {desc}', es: '🔁 bucle: {desc}', fr: '🔁 boucle : {desc}', ru: '🔁 цикл: {desc}', zh: '🔁 循环：{desc}', ja: '🔁 ループ: {desc}', pt: '🔁 loop: {desc}', de: '🔁 Schleife: {desc}', ko: '🔁 루프: {desc}' },
  none: { en: 'No loops caught in this session.', he: 'לא נתפסו לולאות בסשן הזה.', es: 'No se detectaron bucles en esta sesión.', fr: 'Aucune boucle détectée dans cette session.', ru: 'В этой сессии зацикливаний не поймано.', zh: '本会话中没有发现循环。', ja: 'このセッションでループは検出されていません。', pt: 'Nenhum loop detectado nesta sessão.', de: 'In dieser Sitzung wurden keine Schleifen erkannt.', ko: '이번 세션에서 감지된 루프가 없습니다.' },
  head: { en: 'Loops caught in this session: {n}', he: 'לולאות שנתפסו בסשן הזה: {n}', es: 'Bucles detectados en esta sesión: {n}', fr: 'Boucles détectées dans cette session : {n}', ru: 'Зацикливаний поймано в этой сессии: {n}', zh: '本会话发现的循环：{n}', ja: 'このセッションで検出したループ: {n}', pt: 'Loops detectados nesta sessão: {n}', de: 'In dieser Sitzung erkannte Schleifen: {n}', ko: '이번 세션에서 감지된 루프: {n}' },
  active: { en: 'Active now: {desc}', he: 'פעילה כעת: {desc}', es: 'Activo ahora: {desc}', fr: 'Actif maintenant : {desc}', ru: 'Сейчас активно: {desc}', zh: '当前活跃：{desc}', ja: '現在進行中: {desc}', pt: 'Ativo agora: {desc}', de: 'Jetzt aktiv: {desc}', ko: '현재 진행 중: {desc}' },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  dNone: { en: 'No loops caught this session.', he: 'לא נתפסו לולאות בסשן הזה.', es: 'No se detectaron bucles en esta sesión.', fr: 'Aucune boucle détectée dans cette session.', ru: 'В этой сессии зацикливаний не было.', zh: '本会话没有发现循环。', ja: 'このセッションでループは検出されていません。', pt: 'Nenhum loop detectado nesta sessão.', de: 'In dieser Sitzung keine Schleifen erkannt.', ko: '이번 세션에는 감지된 루프가 없습니다.' },
  patA: { en: 'same command failing', he: 'אותה פקודה נכשלת', es: 'el mismo comando falla', fr: 'même commande en échec', ru: 'одна и та же команда падает', zh: '同一命令持续失败', ja: '同じコマンドが失敗', pt: 'mesmo comando falhando', de: 'derselbe Befehl schlägt fehl', ko: '같은 명령 실패' },
  patB: { en: 'edit, then fail', he: 'עריכה ואז כשלון', es: 'editar y fallar', fr: 'modifier puis échouer', ru: 'правка, затем сбой', zh: '编辑后失败', ja: '編集後に失敗', pt: 'editar e falhar', de: 'Ändern, dann Fehler', ko: '수정 후 실패' },
  patC: { en: 'same call repeated', he: 'אותה קריאה שוב ושוב', es: 'la misma llamada repetida', fr: 'même appel répété', ru: 'повтор одного вызова', zh: '同一调用重复', ja: '同じ呼び出しの繰り返し', pt: 'mesma chamada repetida', de: 'derselbe Aufruf wiederholt', ko: '같은 호출 반복' },
  times: { en: '{n} times', he: '{n} פעמים', es: '{n} veces', fr: '{n} fois', ru: '{n} раз', zh: '{n} 次', ja: '{n} 回', pt: '{n} vezes', de: '{n}-mal', ko: '{n}회' },
} as const

type Kind = 'a' | 'b' | 'c'
type Entry = { tool: string; sig: string; isError: boolean; path: string; verify: boolean; cmd: string }
type Nudge = { kind: Kind; sig: string; desc: string; model: string }
type Caught = { kind: string; desc: string; at: number; times?: number }
type State = { window: Entry[]; nudge: Nudge | null; caught: Caught[]; toasted: Record<string, number> }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'loop-detective' } as const, { window: [], nudge: null, caught: [], toasted: {} } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'loop-detective',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const WINDOW = 30
const REPEAT_SPAN = 12
const TOAST_GAP_MS = 5 * 60 * 1000
const SECTION_ID = 'toolkitty:loop-detective'
const RESERVED = ['tool', 'tool_use_id', 'agentId', 'requestMeta']
const EDIT_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit']

const VERIFY_RE =
  /\b(jest|vitest|pytest|mocha|phpunit|rspec|playwright\s+test|cypress\s+run|tsc|vue-tsc|mypy|pyright|eslint|biome|ruff|flake8|pylint|clippy|(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|typecheck|type-check|check)|(vite|next|webpack|rollup|esbuild|tsup|turbo)\s+build|go\s+(test|build|vet)|cargo\s+(test|build|check|clippy)|dotnet\s+(test|build)|mvn\s+\S*(test|package|compile|verify)|gradle\w*\s+(test|build|check)|make)\b/i

function hashOf(text: string): string {
  let acc = 5381
  for (let i = 0; i < text.length; i++) acc = ((acc * 33) ^ text.charCodeAt(i)) >>> 0
  return acc.toString(36)
}

function inputSig(x: Record<string, unknown>): string {
  const json = JSON.stringify(x, (name, value: unknown) => {
    if (RESERVED.includes(name)) return undefined
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort((p, q) => (p[0] < q[0] ? -1 : 1)))
    }
    return value
  })
  return hashOf(json ?? '')
}

function entryOf(e: ToolCallInput, isError: boolean): Entry {
  const x = e as unknown as Record<string, unknown>
  const tool = String(x['tool'] ?? '')
  const rawPath = x['file_path'] ?? x['notebook_path'] ?? x['path']
  const cmd = typeof x['command'] === 'string' ? (x['command'] as string) : ''
  return {
    tool,
    sig: `${tool}:${inputSig(x)}`,
    isError,
    path: typeof rawPath === 'string' ? rawPath : '',
    verify: tool === 'Bash' && VERIFY_RE.test(cmd),
    cmd: cmd.replace(/\s+/g, ' ').trim().slice(0, 50),
  }
}

type Hit = { kind: Kind; sig: string; desc: string; model: string; times: number }

function analyze(win: readonly Entry[]): Hit | null {
  const last = win[win.length - 1]
  if (last === undefined) return null

  // (a) the same Bash command failed 3 times in a row
  const tail = win.slice(-3)
  if (tail.length === 3 && tail.every(x => x.tool === 'Bash' && x.isError && x.sig === last.sig)) {
    return {
      kind: 'a',
      sig: last.sig,
      times: 3,
      desc: t(T.descA, { cmd: last.cmd }),
      model: `the command "${last.cmd}" has failed 3 times in a row`,
    }
  }

  // (b) a file edited, then a test/build command failed, 3 cycles
  const cycles = new Map<string, number>()
  let pendingPath = ''
  let hit: Hit | null = null
  for (const x of win) {
    if (EDIT_TOOLS.includes(x.tool)) {
      pendingPath = x.path
      continue
    }
    if (x.tool !== 'Bash' || !x.verify) continue
    if (!x.isError) {
      cycles.clear()
      pendingPath = ''
      hit = null
      continue
    }
    if (pendingPath === '') continue
    const n = (cycles.get(pendingPath) ?? 0) + 1
    cycles.set(pendingPath, n)
    if (n >= 3) {
      hit = {
        kind: 'b',
        sig: x.sig,
        times: n,
        desc: t(T.descB, { path: pendingPath }),
        model: `editing ${pendingPath} and re-running "${x.cmd}" has failed 3 times (edit, fail, edit, fail)`,
      }
    }
    pendingPath = ''
  }
  if (hit !== null) return hit

  // (c) the same tool with the same input 4 times
  if (last.tool !== 'TodoWrite') {
    const same = win.slice(-REPEAT_SPAN).filter(x => x.sig === last.sig).length
    if (same >= 4) {
      return {
        kind: 'c',
        sig: last.sig,
        times: same,
        desc: t(T.descC, { tool: last.tool }),
        model: `the ${last.tool} tool has been called ${same} times with identical input`,
      }
    }
  }
  return null
}

type Step = { after: State; toast: string }

function step(cur: State, entry: Entry, now: number): Step {
  let win = [...cur.window, entry].slice(-WINDOW)
  let nudge = cur.nudge

  if (nudge !== null && !entry.isError) {
    const clears = nudge.kind === 'c' ? entry.sig !== nudge.sig : entry.sig === nudge.sig
    if (clears) {
      const gone = nudge.sig
      win = win.filter(x => x.sig !== gone)
      nudge = null
    }
  }

  let caught = cur.caught
  let toasted = cur.toasted
  let toast = ''
  if (nudge === null) {
    const found = analyze(win)
    if (found !== null) {
      nudge = { kind: found.kind, sig: found.sig, desc: found.desc, model: found.model }
      caught = [...caught, { kind: found.kind, desc: found.desc, at: now, times: found.times }].slice(-50)
      if (now - (toasted[found.kind] ?? 0) >= TOAST_GAP_MS) {
        toasted = { ...toasted, [found.kind]: now }
        toast = t(T.toast, { desc: found.desc })
      }
    }
  }
  return { after: { window: win, nudge, caught, toasted }, toast }
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.agentId !== undefined) return result
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return result
  }
  if (result.deny !== undefined) return result

  const now = await $.clock.now()
  const cur = await read($, state)
  const out = step(cur, entryOf(e, result.isError === true), now)
  await update($, state, () => out.after)
  if (out.after.nudge !== null) {
    await publish($, { id: 'loop-detective:loop', feature: feature.id, kind: 'loop', level: 'warn', text: out.after.nudge.desc.slice(0, 80) })
  } else {
    await retract($, 'loop-detective:loop')
  }
  if (out.toast !== '') await notice($, 'alert', out.toast, feature.id)
  return result
}

export async function onPromptCompose($: EngineInterface, e: Input<'prompt.compose'>, result: Output<'prompt.compose'>): Promise<Output<'prompt.compose'>> {
  if (!(await isOn($, feature))) return result

  const { nudge } = await read($, state)
  if (nudge === null) return result

  const text = [
    '# Possible loop detected',
    `You appear to be looping: ${nudge.model}.`,
    'Stop repeating it. In your next message, briefly state what you have already tried and why it did not work, then propose a genuinely different approach, or ask the user for the information or decision you are missing. Do not run the same thing again.',
  ].join('\n')

  return {
    ...result,
    sections: [...result.sections.filter(s => s.id !== SECTION_ID), { id: SECTION_ID, text, scope: 'session' as const }],
  }
}

/** The short band form: "loop!" while a loop is being nudged. Quiet otherwise. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const { nudge } = await read($, state)
  if (nudge === null) return null
  return { text: t(T.chipLoop), level: 'alert', icon: ICONS.guard }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const { nudge } = await read($, state)
  if (nudge === null) return null

  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      {t(T.band, { desc: nudge.desc })}
    </Text>
  )
}

/** What a press on the band line shows: the loops caught, newest first, with pattern, what repeated, count and time. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const s = await read($, state)
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)
  const patternOf = (kind: string): string => (kind === 'a' ? t(T.patA) : kind === 'b' ? t(T.patB) : t(T.patC))
  const rows = s.caught.slice(-14).reverse()
  return (
    <Box flexDirection="column">
      {rows.length === 0 ? <Text dimColor>{t(T.dNone)}</Text> : <Text bold>{t(T.head, { n: s.caught.length })}</Text>}
      {s.nudge !== null ? <Text color="warning">{t(T.active, { desc: s.nudge.desc })}</Text> : null}
      {rows.map((c, i) => (
        <Text key={`l${i}`}>
          {`${t(T.ago, { t: clockText(now - c.at) })} · ${patternOf(c.kind)} · ${c.desc}${c.times === undefined ? '' : ` · ${t(T.times, { n: c.times })}`}`}
        </Text>
      ))}
    </Box>
  )
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'repeats', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'repeats', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) await retractAll($, feature.id)
}

export function register(on: On) {
  on('command.run', { command: 'repeats' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const s = await read($, state)
    if (s.caught.length === 0) return { text: t(T.none) }

    const lines = [t(T.head, { n: s.caught.length }), ...s.caught.map((c, i) => `${i + 1}. ${c.desc}`)]
    if (s.nudge !== null) lines.push(t(T.active, { desc: s.nudge.desc }))
    return { text: lines.join('\n') }
  })
}
