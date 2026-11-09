import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { emptyState, listRow, paneHeader } from '../ui'

const T = {
  title: {
    en: 'Turn history',
    he: 'היסטוריית תורים',
    es: 'Historial de turnos',
    fr: 'Historique des tours',
    ru: 'История ходов',
    zh: '轮次历史',
    ja: 'ターン履歴',
    pt: 'Histórico de turnos',
    de: 'Runden-Verlauf',
    ko: '턴 기록',
  },
  description: {
    en: 'A pane with the last 20 turns: duration, actions and a small chart (/turn-history).',
    he: 'חלונית עם 20 התורים האחרונים: משך, פעולות וגרף קטן (/turn-history).',
    es: 'Un panel con los últimos 20 turnos: duración, acciones y un pequeño gráfico (/turn-history).',
    fr: 'Un panneau avec les 20 derniers tours : durée, actions et un petit graphique (/turn-history).',
    ru: 'Панель с последними 20 ходами: длительность, действия и небольшой график (/turn-history).',
    zh: '显示最近 20 轮的面板：用时、操作数和一张小图表（/turn-history）。',
    ja: '直近 20 ターンのパネル：所要時間、アクション数、小さなグラフ（/turn-history）。',
    pt: 'Um painel com os últimos 20 turnos: duração, ações e um pequeno gráfico (/turn-history).',
    de: 'Ein Panel mit den letzten 20 Runden: Dauer, Aktionen und ein kleines Diagramm (/turn-history).',
    ko: '최근 20턴의 패널: 소요 시간, 작업 수, 작은 차트(/turn-history).',
  },
  commandDesc: {
    en: 'Opens a pane with the duration and actions of recent turns',
    he: 'פותח חלונית עם משך ופעולות של התורים האחרונים',
    es: 'Abre un panel con la duración y las acciones de los turnos recientes',
    fr: 'Ouvre un panneau avec la durée et les actions des derniers tours',
    ru: 'Открывает панель с длительностью и действиями последних ходов',
    zh: '打开显示最近各轮用时和操作数的面板',
    ja: '最近のターンの所要時間とアクションを表示するパネルを開きます',
    pt: 'Abre um painel com a duração e as ações dos turnos recentes',
    de: 'Öffnet ein Panel mit Dauer und Aktionen der letzten Runden',
    ko: '최근 턴의 소요 시간과 작업 수를 보여 주는 패널을 엽니다',
  },
  off: {
    en: 'The "Turn history" feature is off in the switches panel.',
    he: 'שכלול "היסטוריית תורים" כבוי בלוח המתגים.',
    es: 'La función "Historial de turnos" está desactivada en el panel de interruptores.',
    fr: 'La fonctionnalité "Historique des tours" est désactivée dans le panneau des commutateurs.',
    ru: 'Функция «История ходов» выключена на панели переключателей.',
    zh: '“轮次历史”功能在开关面板中已关闭。',
    ja: '「ターン履歴」機能はスイッチボードでオフになっています。',
    pt: 'O recurso "Histórico de turnos" está desativado no painel de chaves.',
    de: 'Die Funktion "Runden-Verlauf" ist in der Schalttafel aus.',
    ko: '"턴 기록" 기능이 스위치보드에서 꺼져 있습니다.',
  },
  paneTitle: {
    en: 'Turn history',
    he: 'היסטוריית תורים',
    es: 'Historial de turnos',
    fr: 'Historique des tours',
    ru: 'История ходов',
    zh: '轮次历史',
    ja: 'ターン履歴',
    pt: 'Histórico de turnos',
    de: 'Runden-Verlauf',
    ko: '턴 기록',
  },
  opened: {
    en: 'The turn history is open.',
    he: 'היסטוריית התורים נפתחה.',
    es: 'El historial de turnos está abierto.',
    fr: "L'historique des tours est ouvert.",
    ru: 'История ходов открыта.',
    zh: '轮次历史已打开。',
    ja: 'ターン履歴を開きました。',
    pt: 'O histórico de turnos está aberto.',
    de: 'Der Runden-Verlauf ist geöffnet.',
    ko: '턴 기록이 열렸습니다.',
  },
  paneOff: {
    en: 'The feature is off in the switches panel.',
    he: 'השכלול כבוי בלוח המתגים.',
    es: 'La función está desactivada en el panel de interruptores.',
    fr: 'La fonctionnalité est désactivée dans le panneau des commutateurs.',
    ru: 'Функция выключена на панели переключателей.',
    zh: '此功能在开关面板中已关闭。',
    ja: 'この機能はスイッチボードでオフになっています。',
    pt: 'O recurso está desativado no painel de chaves.',
    de: 'Die Funktion ist in der Schalttafel aus.',
    ko: '이 기능은 스위치보드에서 꺼져 있습니다.',
  },
  empty: {
    en: 'No turns have finished yet.',
    he: 'עדיין אין תורים שהסתיימו.',
    es: 'Aún no ha terminado ningún turno.',
    fr: "Aucun tour n'est encore terminé.",
    ru: 'Пока нет завершённых ходов.',
    zh: '还没有已完成的轮次。',
    ja: '完了したターンはまだありません。',
    pt: 'Nenhum turno terminou ainda.',
    de: 'Noch keine Runde abgeschlossen.',
    ko: '아직 끝난 턴이 없습니다.',
  },
  emptyHint: {
    en: 'Each finished turn adds a row with its duration and actions (up to 20).',
    he: 'כל תור שמסתיים מוסיף שורה עם משכו ופעולותיו (עד 20).',
    es: 'Cada turno terminado añade una fila con su duración y acciones (hasta 20).',
    fr: 'Chaque tour terminé ajoute une ligne avec sa durée et ses actions (jusqu\'à 20).',
    ru: 'Каждый завершённый ход добавляет строку с длительностью и действиями (до 20).',
    zh: '每完成一轮就会添加一行，包含其用时和操作数（最多 20 行）。',
    ja: '完了したターンごとに、所要時間とアクションを含む行が追加されます（最大 20 件）。',
    pt: 'Cada turno concluído adiciona uma linha com a duração e as ações (até 20).',
    de: 'Jede abgeschlossene Runde fügt eine Zeile mit Dauer und Aktionen hinzu (bis zu 20).',
    ko: '턴이 끝날 때마다 소요 시간과 작업 수가 담긴 행이 추가됩니다(최대 20개).',
  },
  last: {
    en: 'Last {n} turns',
    he: '{n} התורים האחרונים',
    es: 'Últimos {n} turnos',
    fr: '{n} derniers tours',
    ru: 'Последние ходы: {n}',
    zh: '最近 {n} 轮',
    ja: '直近 {n} ターン',
    pt: 'Últimos {n} turnos',
    de: 'Letzte {n} Runden',
    ko: '최근 {n}턴',
  },
  actions: {
    en: '{n} actions',
    he: '{n} פעולות',
    es: '{n} acciones',
    fr: '{n} actions',
    ru: 'действий: {n}',
    zh: '{n} 个操作',
    ja: 'アクション {n} 件',
    pt: '{n} ações',
    de: '{n} Aktionen',
    ko: '작업 {n}개',
  },
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

type Turn = { ms: number; tools: number }
type History = { startedAt: number; tools: number; turns: Turn[] }

const history = atom({ plugin: 'toolkitty', key: 'slot', id: 'turn-history' } as const, { startedAt: 0, tools: 0, turns: [] }) as unknown as Atom<History>

const MAX = 20
const BLOCKS = '▁▂▃▄▅▆▇█'

const sparkline = (values: number[]): string => {
  const top = Math.max(1, ...values)
  return values.map(v => BLOCKS[Math.min(BLOCKS.length - 1, Math.floor((v / top) * (BLOCKS.length - 1)))] ?? '▁').join('')
}

export const feature: Feature = {
  id: 'turn-history',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'turn-history', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'turn-history', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  const startedAt = await $.clock.now()
  await update($, history, hist => ({ ...hist, startedAt, tools: 0 }))
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined
  await update($, history, hist => ({ ...hist, tools: hist.tools + 1 }))
  return undefined
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const now = await $.clock.now()
  await update($, history, hist =>
    hist.startedAt === 0
      ? hist
      : { startedAt: 0, tools: 0, turns: [...hist.turns, { ms: now - hist.startedAt, tools: hist.tools }].slice(-MAX) },
  )
}

export function register(on: On) {
    on('command.run', { command: 'turn-history' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(T.off) }
      await $.ui.open({ id: 'turn-history', title: t(T.paneTitle) })
      return { text: t(T.opened) }
    })

    on('ui.render', { component: 'Pane', requestId: 'turn-history' }, async ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

      const hist = await read($, history)
      if (hist.turns.length === 0) {
        return (
          <Box flexDirection="column">
            {paneHeader($, e, { title: t(T.paneTitle) })}
            {emptyState($, e, t(T.empty), t(T.emptyHint))}
          </Box>
        )
      }

      const room = Math.max(3, (e.viewport?.rows ?? 25) - 4)
      const rows = hist.turns.slice(-room).reverse()

      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), status: t(T.last, { n: hist.turns.length }) })}
          <Text mono>{sparkline(hist.turns.map(turn => turn.ms))}</Text>
          {rows.map((turn, i) =>
            listRow($, e, {
              key: `t-${hist.turns.length - i}`,
              text: `${clockText(turn.ms)} · ${t(T.actions, { n: turn.tools })}`,
            }),
          )}
        </Box>
      )
    })
}
