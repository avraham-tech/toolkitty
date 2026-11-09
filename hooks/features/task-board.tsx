import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { emptyState, listRow, paneHeader } from '../ui'

const T = {
  title: {
    en: 'Task board',
    he: 'לוח משימות',
    es: 'Tablero de tareas',
    fr: 'Tableau des tâches',
    ru: 'Доска задач',
    zh: '任务看板',
    ja: 'タスクボード',
    pt: 'Quadro de tarefas',
    de: 'Aufgabenboard',
    ko: '작업 보드',
  },
  description: {
    en: 'A pane with the session task list (/board): ✔ done, ▸ in progress, ○ pending.',
    he: 'חלונית עם רשימת המשימות של הסשן (/board): ✔ הושלם, ▸ בעבודה, ○ ממתין.',
    es: 'Un panel con la lista de tareas de la sesión (/board): ✔ hecha, ▸ en curso, ○ pendiente.',
    fr: 'Un panneau avec la liste des tâches de la session (/board) : ✔ terminée, ▸ en cours, ○ en attente.',
    ru: 'Панель со списком задач сессии (/board): ✔ готово, ▸ в работе, ○ ожидает.',
    zh: '显示会话任务列表的面板（/board）：✔ 已完成，▸ 进行中，○ 待处理。',
    ja: 'セッションのタスク一覧を表示するペイン（/board）：✔ 完了、▸ 進行中、○ 未着手。',
    pt: 'Um painel com a lista de tarefas da sessão (/board): ✔ concluída, ▸ em andamento, ○ pendente.',
    de: 'Ein Panel mit der Aufgabenliste der Session (/board): ✔ erledigt, ▸ in Arbeit, ○ offen.',
    ko: '세션의 작업 목록을 보여 주는 창(/board): ✔ 완료, ▸ 진행 중, ○ 대기 중.',
  },
  off: {
    en: 'This feature is off; turn it on in the /toolkitty panel',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'Esta función está desactivada; actívala en el panel /toolkitty',
    fr: 'Cette fonctionnalité est désactivée ; active-la dans le panneau /toolkitty',
    ru: 'Функция выключена; включите её на панели /toolkitty',
    zh: '此功能已关闭，请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'Este recurso está desativado; ative-o no painel /toolkitty',
    de: 'Diese Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  commandDesc: {
    en: 'Opens a pane with the session task list',
    he: 'פותח חלונית עם רשימת המשימות של הסשן',
    es: 'Abre un panel con la lista de tareas de la sesión',
    fr: 'Ouvre un panneau avec la liste des tâches de la session',
    ru: 'Открывает панель со списком задач сессии',
    zh: '打开显示会话任务列表的面板',
    ja: 'セッションのタスク一覧を表示するペインを開きます',
    pt: 'Abre um painel com a lista de tarefas da sessão',
    de: 'Öffnet ein Panel mit der Aufgabenliste der Session',
    ko: '세션의 작업 목록 창을 엽니다',
  },
  paneTitle: {
    en: 'Tasks',
    he: 'משימות',
    es: 'Tareas',
    fr: 'Tâches',
    ru: 'Задачи',
    zh: '任务',
    ja: 'タスク',
    pt: 'Tarefas',
    de: 'Aufgaben',
    ko: '작업',
  },
  opened: {
    en: 'The task board is open.',
    he: 'לוח המשימות נפתח.',
    es: 'El tablero de tareas está abierto.',
    fr: 'Le tableau des tâches est ouvert.',
    ru: 'Доска задач открыта.',
    zh: '任务看板已打开。',
    ja: 'タスクボードを開きました。',
    pt: 'O quadro de tarefas está aberto.',
    de: 'Das Aufgabenboard ist geöffnet.',
    ko: '작업 보드가 열렸습니다.',
  },
  paneOff: {
    en: 'The feature is off in the switches panel.',
    he: 'השכלול כבוי בלוח המתגים.',
    es: 'La función está desactivada en el panel de interruptores.',
    fr: 'La fonctionnalité est désactivée dans le panneau des interrupteurs.',
    ru: 'Функция выключена на панели переключателей.',
    zh: '此功能在开关面板中已关闭。',
    ja: 'この機能はスイッチパネルでオフになっています。',
    pt: 'O recurso está desativado no painel de controle.',
    de: 'Die Funktion ist in der Schaltzentrale aus.',
    ko: '이 기능은 스위치 패널에서 꺼져 있습니다.',
  },
  empty: {
    en: 'No tasks in the session yet.',
    he: 'אין עדיין משימות בסשן.',
    es: 'Aún no hay tareas en la sesión.',
    fr: 'Aucune tâche dans la session pour le moment.',
    ru: 'В сессии пока нет задач.',
    zh: '会话中还没有任务。',
    ja: 'セッションにはまだタスクがありません。',
    pt: 'Ainda não há tarefas na sessão.',
    de: 'In der Session gibt es noch keine Aufgaben.',
    ko: '세션에 아직 작업이 없습니다.',
  },
  header: {
    en: '{done}/{total} completed',
    he: '{done}/{total} הושלמו',
    es: '{done}/{total} completadas',
    fr: '{done}/{total} terminées',
    ru: 'выполнено {done} из {total}',
    zh: '已完成 {done}/{total}',
    ja: '{done}/{total} 完了',
    pt: '{done}/{total} concluídas',
    de: '{done}/{total} erledigt',
    ko: '{done}/{total} 완료',
  },
  emptyHint: {
    en: 'When Claude writes a task list (TodoWrite) it shows up here with its progress.',
    he: 'כש-Claude כותב רשימת משימות (TodoWrite) היא מופיעה כאן עם ההתקדמות.',
    es: 'Cuando Claude escribe una lista de tareas (TodoWrite), aparece aquí con su progreso.',
    fr: 'Quand Claude écrit une liste de tâches (TodoWrite), elle apparaît ici avec sa progression.',
    ru: 'Когда Claude составляет список задач (TodoWrite), он появляется здесь с прогрессом.',
    zh: 'Claude 写出任务列表（TodoWrite）后，会连同进度显示在这里。',
    ja: 'Claude がタスクリスト（TodoWrite）を書くと、進捗とともにここに表示されます。',
    pt: 'Quando o Claude escreve uma lista de tarefas (TodoWrite), ela aparece aqui com o progresso.',
    de: 'Wenn Claude eine Aufgabenliste (TodoWrite) schreibt, erscheint sie hier mit dem Fortschritt.',
    ko: 'Claude가 작업 목록(TodoWrite)을 작성하면 진행 상황과 함께 여기에 표시됩니다.',
  },
  more: {
    en: '... and {n} more',
    he: '... ועוד {n}',
    es: '... y {n} más',
    fr: '... et {n} autres',
    ru: '... и ещё {n}',
    zh: '……另有 {n} 项',
    ja: '… ほか {n} 件',
    pt: '... e mais {n}',
    de: '... und {n} weitere',
    ko: '... 외 {n}개',
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

type Status = 'pending' | 'in_progress' | 'completed'
type Task = { id: string; content: string; status: Status }
type Board = { tasks: Task[] }

const board = atom({ plugin: 'toolkitty', key: 'slot', id: 'task-board' } as const, { tasks: [] }) as unknown as Atom<Board>

const asStatus = (value: unknown): Status =>
  value === 'completed' || value === 'done' ? 'completed' : value === 'in_progress' || value === 'active' ? 'in_progress' : 'pending'

/** Reads `{ content, status }` items from a loose tool input. */
const itemsOf = (args: Record<string, unknown>): Task[] | null => {
  const raw = args['todos'] ?? args['items'] ?? args['plan']
  if (!Array.isArray(raw)) return null
  const out: Task[] = []
  raw.forEach((item, i) => {
    if (item === null || typeof item !== 'object') return
    const r = item as Record<string, unknown>
    const content = r['content'] ?? r['step'] ?? r['subject'] ?? r['title']
    if (typeof content !== 'string') return
    out.push({ id: String(i + 1), content, status: asStatus(r['status']) })
  })
  return out
}

const icon = (s: Status): string => (s === 'completed' ? '✔' : s === 'in_progress' ? '▸' : '○')

export const feature: Feature = {
  id: 'task-board',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'board', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'board', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
    if (!(await isOn($, feature))) return undefined

    const name: string = e.tool
    const args = e as unknown as Record<string, unknown>

    if (name === 'TodoWrite' || /update_plan$/.test(name)) {
      const items = itemsOf(args)
      if (items !== null) {
        await update($, board, () => ({ tasks: items }))
      }
    } else if (name === 'TaskCreate') {
      const subject = args['subject']
      if (typeof subject === 'string') {
        await update($, board, b => {
          const nextId = b.tasks.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0) + 1
          return { tasks: [...b.tasks, { id: String(nextId), content: subject, status: 'pending' as Status }] }
        })
      }
    } else if (name === 'TaskUpdate') {
      const taskId = args['taskId']
      if (typeof taskId === 'string') {
        const status = args['status']
        const subject = args['subject']
        await update($, board, b => ({
          tasks:
            status === 'deleted'
              ? b.tasks.filter(t => t.id !== taskId)
              : b.tasks.map(t =>
                  t.id !== taskId
                    ? t
                    : {
                        ...t,
                        content: typeof subject === 'string' ? subject : t.content,
                        status: status === undefined ? t.status : asStatus(status),
                      },
                ),
        }))
      }
    }

    return undefined
}

export function register(on: On) {
    on('command.run', { command: 'board' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(T.off) }
      await $.ui.open({ id: 'task-board', title: t(T.paneTitle) })
      return { text: t(T.opened) }
    })

    on('ui.render', { component: 'Pane', requestId: 'task-board' }, async ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

      const { tasks } = await read($, board)
      if (tasks.length === 0) {
        return (
          <Box flexDirection="column">
            {paneHeader($, e, { title: t(T.paneTitle) })}
            {emptyState($, e, t(T.empty), t(T.emptyHint))}
          </Box>
        )
      }

      const done = tasks.filter(task => task.status === 'completed').length
      const room = Math.max(3, (e.viewport?.rows ?? 25) - 3)

      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), status: t(T.header, { done, total: tasks.length }), level: done === tasks.length ? 'ok' : 'info' })}
          {tasks.slice(0, room).map(task =>
            listRow($, e, {
              key: `task-${task.id}`,
              left: icon(task.status),
              text: task.content,
              level: task.status === 'in_progress' ? 'info' : 'ok',
            }),
          )}
          {tasks.length > room ? <Text dimColor>{t(T.more, { n: tasks.length - room })}</Text> : null}
        </Box>
      )
    })
}
