import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, Timer } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { Feature, Input, Localized } from '../core'
import { emptyState, listRow, paneHeader } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Agents monitor', he: 'מוניטור סוכנים', es: 'Monitor de agentes', fr: 'Moniteur d\'agents', ru: 'Монитор агентов', zh: '代理监视器', ja: 'エージェントモニター', pt: 'Monitor de agentes', de: 'Agent-Monitor', ko: '에이전트 모니터' },
  description: { en: 'A pane with the sub-agents running now and for how long (/subagents).', he: 'חלונית עם סוכני המשנה שרצים עכשיו וכמה זמן הם רצים (/subagents).', es: 'Un panel con los subagentes en ejecución y cuánto tiempo llevan (/subagents).', fr: 'Un panneau avec les sous-agents en cours et depuis combien de temps (/subagents).', ru: 'Панель с работающими сейчас субагентами и временем их работы (/subagents).', zh: '一个显示当前运行的子代理及其运行时长的面板（/subagents）。', ja: '実行中のサブエージェントとその経過時間を表示するペイン（/subagents）。', pt: 'Um painel com os subagentes em execução agora e há quanto tempo (/subagents).', de: 'Ein Panel mit den aktuell laufenden Subagenten und ihrer Laufzeit (/subagents).', ko: '지금 실행 중인 서브에이전트와 실행 시간을 보여 주는 창입니다(/subagents).' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция выключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  paneOff: { en: 'The feature is off in the switchboard.', he: 'השכלול כבוי בלוח המתגים.', es: 'La función está desactivada en el panel de interruptores.', fr: 'La fonctionnalité est désactivée dans le panneau des interrupteurs.', ru: 'Функция выключена на панели переключателей.', zh: '该功能在开关面板中已关闭。', ja: 'この機能はスイッチパネルでオフになっています。', pt: 'O recurso está desativado no painel de controle.', de: 'Die Funktion ist in der Schaltzentrale aus.', ko: '이 기능은 스위치 패널에서 꺼져 있습니다.' },
  cmdDesc: { en: 'Opens a pane with the running sub-agents', he: 'פותח חלונית עם סוכני המשנה הרצים', es: 'Abre un panel con los subagentes en ejecución', fr: 'Ouvre un panneau avec les sous-agents en cours', ru: 'Открывает панель с работающими субагентами', zh: '打开显示正在运行的子代理的面板', ja: '実行中のサブエージェントを表示するペインを開きます', pt: 'Abre um painel com os subagentes em execução', de: 'Öffnet ein Panel mit den laufenden Subagenten', ko: '실행 중인 서브에이전트를 보여 주는 창을 엽니다' },
  paneTitle: { en: 'Agents', he: 'סוכנים', es: 'Agentes', fr: 'Agents', ru: 'Агенты', zh: '代理', ja: 'エージェント', pt: 'Agentes', de: 'Agenten', ko: '에이전트' },
  opened: { en: 'The agents monitor is open.', he: 'מוניטור הסוכנים נפתח.', es: 'El monitor de agentes está abierto.', fr: 'Le moniteur d\'agents est ouvert.', ru: 'Монитор агентов открыт.', zh: '代理监视器已打开。', ja: 'エージェントモニターを開きました。', pt: 'O monitor de agentes está aberto.', de: 'Der Agent-Monitor ist offen.', ko: '에이전트 모니터가 열려 있습니다.' },
  none: { en: 'No agents in the session right now.', he: 'אין סוכנים בסשן כרגע.', es: 'No hay agentes en la sesión ahora mismo.', fr: 'Aucun agent dans la session pour le moment.', ru: 'В сессии сейчас нет агентов.', zh: '会话中目前没有代理。', ja: '現在、セッションにエージェントはいません。', pt: 'Nenhum agente na sessão agora.', de: 'Gerade keine Agenten in der Session.', ko: '지금 세션에 에이전트가 없습니다.' },
  header: { en: '{live} active of {total}', he: '{live} פעילים מתוך {total}', es: '{live} activos de {total}', fr: '{live} actifs sur {total}', ru: 'активных: {live} из {total}', zh: '共 {total} 个，{live} 个活跃', ja: '{total} 件中 {live} 件が稼働中', pt: '{live} ativos de {total}', de: '{live} aktiv von {total}', ko: '총 {total}개 중 {live}개 활성' },
  noneHint: { en: 'Sub-agents appear here while they run and stay after they finish; open it with /subagents.', he: 'סוכני משנה מופיעים כאן בזמן שהם רצים ונשארים אחרי שסיימו; פתח אותו עם /subagents.', es: 'Los subagentes aparecen aquí mientras se ejecutan y se quedan al terminar; se abre con /subagents.', fr: 'Les sous-agents apparaissent ici pendant leur exécution et y restent ensuite ; ouvre-le avec /subagents.', ru: 'Субагенты появляются здесь, пока работают, и остаются после завершения; открывается командой /subagents.', zh: '子代理运行时会显示在这里，结束后仍会保留；用 /subagents 打开。', ja: 'サブエージェントは実行中ここに表示され、終了後も残ります。/subagents で開きます。', pt: 'Os subagentes aparecem aqui enquanto rodam e continuam depois de terminar; abra com /subagents.', de: 'Subagenten erscheinen hier, solange sie laufen, und bleiben danach stehen; öffne es mit /subagents.', ko: '서브에이전트는 실행되는 동안 여기에 나타나고 끝난 뒤에도 남습니다. /subagents로 여세요.' },
  statusPending: { en: 'pending', he: 'ממתין', es: 'pendiente', fr: 'en attente', ru: 'ожидает', zh: '待处理', ja: '保留中', pt: 'pendente', de: 'ausstehend', ko: '대기 중' },
  statusRunning: { en: 'running', he: 'רץ', es: 'en ejecución', fr: 'en cours', ru: 'работает', zh: '运行中', ja: '実行中', pt: 'executando', de: 'läuft', ko: '실행 중' },
  statusWaiting: { en: 'waiting', he: 'מחכה', es: 'esperando', fr: 'en attente', ru: 'ждёт', zh: '等待中', ja: '待機中', pt: 'aguardando', de: 'wartet', ko: '대기' },
  statusIdle: { en: 'idle', he: 'לא פעיל', es: 'inactivo', fr: 'inactif', ru: 'простаивает', zh: '空闲', ja: 'アイドル', pt: 'ocioso', de: 'Leerlauf', ko: '유휴' },
  statusCompleted: { en: 'completed', he: 'הסתיים', es: 'completado', fr: 'terminé', ru: 'завершён', zh: '已完成', ja: '完了', pt: 'concluído', de: 'fertig', ko: '완료' },
  statusFailed: { en: 'failed', he: 'נכשל', es: 'fallido', fr: 'échoué', ru: 'сбой', zh: '失败', ja: '失敗', pt: 'falhou', de: 'Fehler', ko: '실패' },
  statusKilled: { en: 'stopped', he: 'הופסק', es: 'detenido', fr: 'arrêté', ru: 'остановлен', zh: '已停止', ja: '停止', pt: 'parado', de: 'gestoppt', ko: '중지됨' },
} as const

type Row = { id: string; label: string; type: string; status: string; firstSeen: number }
type Monitor = { rows: Row[] }

const monitor = atom({ plugin: 'toolkitty', key: 'slot', id: 'agents-monitor' } as const, { rows: [] }) as unknown as Atom<Monitor>

const OFF = T.off
const PANE = 'agents-monitor'

const STATUS: Record<string, Localized> = {
  pending: T.statusPending,
  running: T.statusRunning,
  waiting: T.statusWaiting,
  idle: T.statusIdle,
  completed: T.statusCompleted,
  failed: T.statusFailed,
  killed: T.statusKilled,
}

const signature = (rows: Row[]): string => rows.map(r => `${r.id}:${r.status}`).join('|')
const isLive = (status: string): boolean => status === 'running' || status === 'pending' || status === 'waiting'

let ticker: Timer | undefined

export const feature: Feature = {
  id: 'agents-monitor',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'subagents', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'subagents', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }

  ticker?.cancel()
  ticker = $.clock.every(2000, async () => {
    try {
      if (!(await isOn($, feature))) return
      const open = (await $.ui.panes()).some(p => p.id === PANE)
      if (!open) return

      const [list, now, prev] = await Promise.all([$.agent.list(), $.clock.now(), read($, monitor)])
      const known = new Map(prev.rows.map(r => [r.id, r.firstSeen]))
      const rows: Row[] = list.map(a => ({
        id: a.id,
        label: a.name ?? a.description,
        type: a.type,
        status: a.status,
        firstSeen: known.get(a.id) ?? now,
      }))

      const changed = signature(rows) !== signature(prev.rows)
      if (changed || rows.some(r => isLive(r.status))) await update($, monitor, () => ({ rows }))
    } catch {
      // a failed poll is retried on the next tick
    }
  })
}

export function register(on: On) {
    on('command.run', { command: 'subagents' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(OFF) }
      await $.ui.open({ id: PANE, title: t(T.paneTitle) })
      return { text: t(T.opened) }
    })

    on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

      const { rows } = await read($, monitor)
      if (rows.length === 0) {
        return (
          <Box flexDirection="column">
            {paneHeader($, e, { title: t(T.paneTitle) })}
            {emptyState($, e, t(T.none), t(T.noneHint))}
          </Box>
        )
      }

      const now = await $.clock.now()
      const room = Math.max(3, (e.viewport?.rows ?? 25) - 3)
      const live = rows.filter(r => isLive(r.status)).length
      const sorted = [...rows].sort((a, b) => Number(isLive(b.status)) - Number(isLive(a.status)))

      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), status: t(T.header, { live, total: rows.length }), level: live > 0 ? 'info' : 'ok' })}
          {sorted.slice(0, room).map(r =>
            listRow($, e, {
              key: `agent-${r.id}`,
              left: isLive(r.status) ? '●' : '○',
              text: r.label,
              right: `(${r.type}) · ${STATUS[r.status] !== undefined ? t(STATUS[r.status]!) : r.status} · ${clockText(now - r.firstSeen)}`,
              level: isLive(r.status) ? 'info' : 'ok',
            }),
          )}
        </Box>
      )
    })
}
