import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: {
    en: 'Agent profiler',
    he: 'פרופיילר סוכן',
    es: 'Perfilador del agente',
    fr: "Profileur d'agent",
    ru: 'Профилировщик агента',
    zh: '代理分析器',
    ja: 'エージェントプロファイラー',
    pt: 'Perfilador de agentes',
    de: 'Agent-Profiler',
    ko: '에이전트 프로파일러',
  },
  description: {
    en: 'Where the time goes: model wait vs tools vs subagents, per turn and for the session (/profile).',
    he: 'לאן הזמן הולך: המתנה למודל מול כלים מול סוכני משנה, לפי תור ולכל הסשן (‎/profile).',
    es: 'A dónde va el tiempo: espera del modelo frente a herramientas y subagentes, por turno y en la sesión (/profile).',
    fr: "Où va le temps : attente du modèle, outils et sous-agents, par tour et pour la session (/profile).",
    ru: 'Куда уходит время: ожидание модели, инструменты и субагенты — по ходам и за сессию (/profile).',
    zh: '时间花在哪里：模型等待、工具、子代理，按每轮和整个会话统计（/profile）。',
    ja: '時間の使われ方：モデル待ち、ツール、サブエージェントを、ターンごと・セッション全体で表示します（/profile）。',
    pt: 'Para onde vai o tempo: espera do modelo, ferramentas e subagentes, por turno e na sessão (/profile).',
    de: 'Wohin die Zeit geht: Modellwartezeit, Tools und Subagenten, pro Durchgang und für die Session (/profile).',
    ko: '시간이 어디에 쓰이는지: 모델 대기, 도구, 서브에이전트를 턴별·세션 전체로 보여 줍니다(/profile).',
  },
  off: {
    en: 'This feature is off; turn it on in the /toolkitty panel',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'Esta función está desactivada; actívala en el panel /toolkitty',
    fr: 'Cette fonctionnalité est désactivée ; active-la dans le panneau /toolkitty',
    ru: 'Функция выключена; включите её на панели /toolkitty',
    zh: '此功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty パネルでオンにしてください',
    pt: 'Este recurso está desativado; ative-o no painel /toolkitty',
    de: 'Diese Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  commandDesc: {
    en: 'Opens a pane showing where the time went',
    he: 'פותח חלונית שמראה לאן הזמן הלך',
    es: 'Abre un panel que muestra a dónde fue el tiempo',
    fr: 'Ouvre un panneau montrant où est passé le temps',
    ru: 'Открывает панель с разбивкой времени',
    zh: '打开一个显示时间花在哪里的面板',
    ja: '時間の使われ方を示すペインを開きます',
    pt: 'Abre um painel mostrando para onde foi o tempo',
    de: 'Öffnet ein Panel, das zeigt, wohin die Zeit ging',
    ko: '시간이 어디에 쓰였는지 보여 주는 창을 엽니다',
  },
  paneTitle: { en: 'Profile', he: 'פרופיל', es: 'Perfil', fr: 'Profil', ru: 'Профиль', zh: '分析', ja: 'プロファイル', pt: 'Perfil', de: 'Profil', ko: '프로파일' },
  opened: {
    en: 'The profile pane is open.',
    he: 'חלונית הפרופיל נפתחה.',
    es: 'El panel de perfil está abierto.',
    fr: 'Le panneau de profil est ouvert.',
    ru: 'Панель профиля открыта.',
    zh: '分析面板已打开。',
    ja: 'プロファイルペインを開きました。',
    pt: 'O painel de perfil está aberto.',
    de: 'Das Profil-Panel ist offen.',
    ko: '프로파일 창이 열려 있습니다.',
  },
  paneOff: {
    en: 'The feature is off in the switches panel.',
    he: 'השכלול כבוי בלוח המתגים.',
    es: 'La función está desactivada en el panel de interruptores.',
    fr: 'La fonctionnalité est désactivée dans le panneau des interrupteurs.',
    ru: 'Функция выключена на панели переключателей.',
    zh: '该功能在开关面板中已关闭。',
    ja: 'この機能はスイッチパネルでオフになっています。',
    pt: 'O recurso está desativado no painel de controle.',
    de: 'Die Funktion ist in der Schaltzentrale aus.',
    ko: '이 기능은 스위치 패널에서 꺼져 있습니다.',
  },
  empty: {
    en: 'Nothing measured yet: finish a turn first.',
    he: 'עוד לא נמדד דבר: סיים תור קודם.',
    es: 'Aún no se ha medido nada: termina un turno primero.',
    fr: "Rien n’a encore été mesuré : termine d’abord un tour.",
    ru: 'Пока ничего не измерено: завершите ход.',
    zh: '还没有测量数据：请先完成一轮对话。',
    ja: 'まだ計測データがありません。まず1ターンを完了してください。',
    pt: 'Nada medido ainda: termine um turno primeiro.',
    de: 'Noch nichts gemessen: beende zuerst einen Durchgang.',
    ko: '아직 측정된 데이터가 없습니다. 먼저 한 턴을 마치세요.',
  },
  turnsHead: {
    en: 'Last {n} turns',
    he: '{n} התורים האחרונים',
    es: 'Últimos {n} turnos',
    fr: '{n} derniers tours',
    ru: 'Последние ходы ({n})',
    zh: '最近 {n} 轮',
    ja: '直近 {n} ターン',
    pt: 'Últimos {n} turnos',
    de: 'Letzte {n} Durchgänge',
    ko: '최근 {n}턴',
  },
  colTurn: { en: '#', he: '#', es: '#', fr: '#', ru: '№', zh: '#', ja: '#', pt: '#', de: '#', ko: '#' },
  colTotal: { en: 'total', he: 'סה״כ', es: 'total', fr: 'total', ru: 'всего', zh: '总计', ja: '合計', pt: 'total', de: 'gesamt', ko: '합계' },
  colModel: { en: 'model', he: 'מודל', es: 'modelo', fr: 'modèle', ru: 'модель', zh: '模型', ja: 'モデル', pt: 'modelo', de: 'Modell', ko: '모델' },
  colTools: { en: 'tools', he: 'כלים', es: 'herram.', fr: 'outils', ru: 'инстр.', zh: '工具', ja: 'ツール', pt: 'ferram.', de: 'Tools', ko: '도구' },
  colAgents: { en: 'agents', he: 'סוכנים', es: 'agentes', fr: 'agents', ru: 'агенты', zh: '代理', ja: 'エージェント', pt: 'agentes', de: 'Agenten', ko: '에이전트' },
  summaryHead: {
    en: 'Session: {total} in {n} turns',
    he: 'סשן: {total} ב-{n} תורים',
    es: 'Sesión: {total} en {n} turnos',
    fr: 'Session : {total} en {n} tours',
    ru: 'Сессия: {total}, ходов: {n}',
    zh: '会话：{n} 轮共 {total}',
    ja: 'セッション：{n} ターンで {total}',
    pt: 'Sessão: {total} em {n} turnos',
    de: 'Session: {total} in {n} Durchgängen',
    ko: '세션: {n}턴, 총 {total}',
  },
  shares: {
    en: 'model {model}% · tools {tools}% · subagents {agents}%',
    he: 'מודל {model}% · כלים {tools}% · סוכני משנה {agents}%',
    es: 'modelo {model}% · herramientas {tools}% · subagentes {agents}%',
    fr: 'modèle {model}% · outils {tools}% · sous-agents {agents}%',
    ru: 'модель {model}% · инструменты {tools}% · субагенты {agents}%',
    zh: '模型 {model}% · 工具 {tools}% · 子代理 {agents}%',
    ja: 'モデル {model}% · ツール {tools}% · サブエージェント {agents}%',
    pt: 'modelo {model}% · ferramentas {tools}% · subagentes {agents}%',
    de: 'Modell {model}% · Tools {tools}% · Subagenten {agents}%',
    ko: '모델 {model}% · 도구 {tools}% · 서브에이전트 {agents}%',
  },
  subWork: {
    en: 'Subagent work: {time} across {n} subagent turns',
    he: 'עבודת סוכני משנה: {time} ב-{n} תורים של סוכני משנה',
    es: 'Trabajo de subagentes: {time} en {n} turnos de subagentes',
    fr: 'Travail des sous-agents : {time} sur {n} tours de sous-agents',
    ru: 'Работа субагентов: {time}, ходов субагентов: {n}',
    zh: '子代理工作：{n} 轮子代理对话共 {time}',
    ja: 'サブエージェントの作業：{n} ターンで {time}',
    pt: 'Trabalho de subagentes: {time} em {n} turnos de subagentes',
    de: 'Subagenten-Arbeit: {time} über {n} Subagenten-Durchgänge',
    ko: '서브에이전트 작업: 서브에이전트 {n}턴, 총 {time}',
  },
  perTool: {
    en: 'Time per tool',
    he: 'זמן לפי כלי',
    es: 'Tiempo por herramienta',
    fr: 'Temps par outil',
    ru: 'Время по инструментам',
    zh: '各工具耗时',
    ja: 'ツール別の時間',
    pt: 'Tempo por ferramenta',
    de: 'Zeit pro Tool',
    ko: '도구별 시간',
  },
  toolRow: {
    en: '{tool}: {time} ({n} calls)',
    he: '{tool}: {time} ({n} קריאות)',
    es: '{tool}: {time} ({n} llamadas)',
    fr: '{tool} : {time} ({n} appels)',
    ru: '{tool}: {time} (вызовов: {n})',
    zh: '{tool}：{time}（{n} 次调用）',
    ja: '{tool}: {time}（{n} 回の呼び出し）',
    pt: '{tool}: {time} ({n} chamadas)',
    de: '{tool}: {time} ({n} Aufrufe)',
    ko: '{tool}: {time} ({n}회 호출)',
  },
  slowest: {
    en: 'Slowest calls',
    he: 'הקריאות האיטיות ביותר',
    es: 'Llamadas más lentas',
    fr: 'Appels les plus lents',
    ru: 'Самые медленные вызовы',
    zh: '最慢的调用',
    ja: '最も遅い呼び出し',
    pt: 'Chamadas mais lentas',
    de: 'Langsamste Aufrufe',
    ko: '가장 느린 호출',
  },
  slowRow: {
    en: '{time} · {label}',
    he: '{time} · {label}',
    es: '{time} · {label}',
    fr: '{time} · {label}',
    ru: '{time} · {label}',
    zh: '{time} · {label}',
    ja: '{time} · {label}',
    pt: '{time} · {label}',
    de: '{time} · {label}',
    ko: '{time} · {label}',
  },
  statusTurns: { en: '{n} turns', he: '{n} תורים', es: '{n} turnos', fr: '{n} tours', ru: 'ходов: {n}', zh: '{n} 轮', ja: '{n} ターン', pt: '{n} turnos', de: '{n} Durchgänge', ko: '{n}턴' },
  emptyHint: {
    en: 'The first finished turn fills this pane; /profile opens it any time.',
    he: 'התור הראשון שיסתיים ימלא את החלונית; ‎/profile פותח אותה בכל עת.',
    es: 'El primer turno terminado llenará este panel; /profile lo abre cuando quieras.',
    fr: "Le premier tour terminé remplira ce panneau ; /profile l'ouvre à tout moment.",
    ru: 'Первый завершённый ход заполнит панель; /profile открывает её в любой момент.',
    zh: '第一轮对话结束后此面板会填入数据；随时可用 /profile 打开。',
    ja: '最初のターンが終わるとこのペインにデータが入ります。/profile でいつでも開けます。',
    pt: 'O primeiro turno concluído preenche este painel; /profile o abre a qualquer momento.',
    de: 'Der erste abgeschlossene Durchgang füllt dieses Panel; /profile öffnet es jederzeit.',
    ko: '첫 번째 턴이 끝나면 이 창이 채워집니다. /profile로 언제든 열 수 있습니다.',
  },
  noteAgents: {
    en: 'agents = the main loop waiting on Agent calls',
    he: 'סוכנים = זמן ההמתנה של הלולאה הראשית לקריאות Agent',
    es: 'agentes = el bucle principal esperando llamadas Agent',
    fr: 'agents = temps où la boucle principale attend les appels Agent',
    ru: 'агенты = основной цикл ждёт вызовы Agent',
    zh: '代理 = 主循环等待 Agent 调用的时间',
    ja: 'エージェント = メインループが Agent 呼び出しを待っている時間',
    pt: 'agentes = o loop principal esperando chamadas de Agent',
    de: 'Agenten = Wartezeit der Hauptschleife auf Agent-Aufrufe',
    ko: '에이전트 = 메인 루프가 Agent 호출을 기다린 시간',
  },
} as const

type Running = { tool: string; label: string; at: number; isMain: boolean }
type Slow = { tool: string; label: string; ms: number }
type Row = { n: number; total: number; model: number; tools: number; agents: number }
type Current = { startedAt: number; toolMs: number; agentWaitMs: number }
type State = {
  running: Record<string, Running>
  perTool: Record<string, { ms: number; n: number }>
  slowest: Slow[]
  current: Current | null
  turns: Row[]
  turnCount: number
  totals: { model: number; tools: number; agents: number; total: number }
  subMs: number
  subTurns: number
}

const initial: State = {
  running: {},
  perTool: {},
  slowest: [],
  current: null,
  turns: [],
  turnCount: 0,
  totals: { model: 0, tools: 0, agents: 0, total: 0 },
  subMs: 0,
  subTurns: 0,
}

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'agent-profiler' } as const, initial) as unknown as Atom<State>

const KEEP_TURNS = 10
const STALE_MS = 3_600_000

export const feature: Feature = {
  id: 'agent-profiler',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const field = (e: unknown, key: string): string => {
  const value = (e as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

const shortPath = (path: string): string => path.split(/[\\/]/).filter(s => s !== '').slice(-2).join('/')

const clip = (text: string, max: number): string => {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

const labelOf = (e: ToolCallInput): string => {
  const path = field(e, 'file_path') || field(e, 'notebook_path')
  if (path !== '') return `${e.tool} ${shortPath(path)}`
  const command = field(e, 'command')
  if (command !== '') return `${e.tool}: ${clip(command, 40)}`
  const detail = field(e, 'pattern') || field(e, 'query') || field(e, 'url') || field(e, 'description')
  return detail !== '' ? `${e.tool}: ${clip(detail, 40)}` : e.tool
}

/** Sub-ten-second durations keep a decimal; longer ones use Toolkitty's clock text. */
const dur = (ms: number): string => (ms < 10_000 ? `${(Math.max(0, ms) / 1000).toFixed(1)}s` : clockText(ms))

const pct = (part: number, whole: number): number => (whole <= 0 ? 0 : Math.round((part / whole) * 100))

const pad = (text: string, width: number): string => text.padEnd(width, ' ')

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'profile', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'profile', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const startedAt = await $.clock.now()
  await update($, state, s => ({ ...s, current: { startedAt, toolMs: 0, agentWaitMs: 0 } }))
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature)) || e.tool_use_id === undefined) return undefined

  const id = e.tool_use_id
  const at = await $.clock.now()
  const entry: Running = { tool: e.tool, label: labelOf(e), at, isMain: e.agentId === undefined }
  await update($, state, s => {
    const running: Record<string, Running> = {}
    for (const [key, value] of Object.entries(s.running)) if (at - value.at < STALE_MS) running[key] = value
    running[id] = entry
    return { ...s, running }
  })
  return undefined
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature)) || e.tool_use_id === undefined) return result

  const id = e.tool_use_id
  const end = await $.clock.now()
  await update($, state, s => {
    const started = s.running[id]
    if (started === undefined) return s

    const running = { ...s.running }
    delete running[id]

    const ms = Math.max(0, end - started.at)
    const prev = s.perTool[started.tool] ?? { ms: 0, n: 0 }
    const perTool = { ...s.perTool, [started.tool]: { ms: prev.ms + ms, n: prev.n + 1 } }
    const slowest = [...s.slowest, { tool: started.tool, label: started.label, ms }].sort((a, b) => b.ms - a.ms).slice(0, 5)

    let current = s.current
    if (current !== null && started.isMain) {
      current =
        started.tool === 'Agent'
          ? { ...current, agentWaitMs: current.agentWaitMs + ms }
          : { ...current, toolMs: current.toolMs + ms }
    }
    return { ...s, running, perTool, slowest, current }
  })
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (!(await isOn($, feature))) return

  if (e.agentId !== undefined) {
    await update($, state, s => ({ ...s, subMs: s.subMs + e.durationMs, subTurns: s.subTurns + 1 }))
    return
  }

  await update($, state, s => {
    const toolMs = s.current?.toolMs ?? 0
    const agentMs = s.current?.agentWaitMs ?? 0
    const total = e.durationMs
    const model = Math.max(0, total - toolMs - agentMs)
    const n = s.turnCount + 1
    return {
      ...s,
      current: null,
      turnCount: n,
      turns: [...s.turns, { n, total, model, tools: toolMs, agents: agentMs }].slice(-KEEP_TURNS),
      totals: {
        model: s.totals.model + model,
        tools: s.totals.tools + toolMs,
        agents: s.totals.agents + agentMs,
        total: s.totals.total + total,
      },
    }
  })
}

export function register(on: On) {
  on('command.run', { command: 'profile' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: 'agent-profiler', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'agent-profiler' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const s = await read($, state)
    if (s.turnCount === 0) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.insight })}
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
        </Box>
      )
    }

    const totals = s.totals
    const tools = Object.entries(s.perTool).sort((a, b) => b[1].ms - a[1].ms)
    const room = Math.max(3, (e.viewport?.rows ?? 30) - 24)
    const rows = s.turns.slice(-Math.min(KEEP_TURNS, Math.max(3, room))).reverse()

    return (
      <Box flexDirection="column">
        {paneHeader($, e, { title: t(T.paneTitle), status: t(T.statusTurns, { n: s.turnCount }), level: 'info', icon: ICONS.insight })}
        {sectionTitle($, e, t(T.turnsHead, { n: rows.length }))}
        <Text dimColor mono>
          {pad(t(T.colTurn), 4)}
          {pad(t(T.colTotal), 8)}
          {pad(t(T.colModel), 8)}
          {pad(t(T.colTools), 8)}
          {t(T.colAgents)}
        </Text>
        {rows.map(row => (
          <Text key={`turn-${row.n}`} mono>
            {pad(String(row.n), 4)}
            {pad(dur(row.total), 8)}
            {pad(dur(row.model), 8)}
            {pad(dur(row.tools), 8)}
            {dur(row.agents)}
          </Text>
        ))}
        <Text dimColor size="footnote">
          {t(T.noteAgents)}
        </Text>

        {sectionTitle($, e, t(T.summaryHead, { total: dur(totals.total), n: s.turnCount }))}
        <Text>
          {t(T.shares, {
            model: pct(totals.model, totals.total),
            tools: pct(totals.tools, totals.total),
            agents: pct(totals.agents, totals.total),
          })}
        </Text>
        {s.subTurns > 0 ? <Text dimColor>{t(T.subWork, { time: dur(s.subMs), n: s.subTurns })}</Text> : null}

        {sectionTitle($, e, t(T.perTool))}
        {tools.slice(0, 12).map(([name, v]) =>
          listRow($, e, { key: `tool-${name}`, text: t(T.toolRow, { tool: name, time: dur(v.ms), n: v.n }) }),
        )}

        {sectionTitle($, e, t(T.slowest))}
        {s.slowest.map((slow, i) =>
          listRow($, e, { key: `slow-${i}`, text: t(T.slowRow, { time: dur(slow.ms), label: slow.label }) }),
        )}
      </Box>
    )
  })
}
