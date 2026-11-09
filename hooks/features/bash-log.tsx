import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { emptyState, listRow, paneHeader } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Command log', he: 'יומן פקודות', es: 'Registro de comandos', fr: 'Journal des commandes', ru: 'Журнал команд', zh: '命令日志', ja: 'コマンドログ', pt: 'Log de comandos', de: 'Befehlslog', ko: '명령 로그' },
  description: { en: 'A pane with the Bash commands run in the session, their duration, success and a re-run button (/bash-log).', he: 'חלונית עם פקודות ה-Bash שרצו בסשן, משך, הצלחה וכפתור להרצה חוזרת (/bash-log).', es: 'Un panel con los comandos Bash ejecutados en la sesión, su duración, éxito y un botón para repetirlos (/bash-log).', fr: 'Un panneau avec les commandes Bash exécutées dans la session, leur durée, leur réussite et un bouton pour les relancer (/bash-log).', ru: 'Панель с Bash-командами сессии: длительность, успех и кнопка повторного запуска (/bash-log).', zh: '一个显示会话中运行过的 Bash 命令、耗时、是否成功以及重新运行按钮的面板（/bash-log）。', ja: 'セッションで実行した Bash コマンド、所要時間、成否、再実行ボタンを表示するペイン（/bash-log）。', pt: 'Um painel com os comandos Bash executados na sessão, duração, sucesso e um botão para rodar de novo (/bash-log).', de: 'Ein Panel mit den in der Session ausgeführten Bash-Befehlen, Dauer, Erfolg und einer Schaltfläche zum erneuten Ausführen (/bash-log).', ko: '세션에서 실행한 Bash 명령, 소요 시간, 성공 여부, 다시 실행 버튼을 보여 주는 창입니다(/bash-log).' },
  cmdDesc: { en: 'Opens a pane with the Bash commands run in the session', he: 'פותח חלונית עם פקודות ה-Bash שרצו בסשן', es: 'Abre un panel con los comandos Bash ejecutados en la sesión', fr: 'Ouvre un panneau avec les commandes Bash exécutées dans la session', ru: 'Открывает панель с Bash-командами, выполненными в сессии', zh: '打开显示会话中 Bash 命令的面板', ja: 'セッションの Bash コマンドを表示するペインを開きます', pt: 'Abre um painel com os comandos Bash da sessão', de: 'Öffnet ein Panel mit den Bash-Befehlen der Session', ko: '세션의 Bash 명령을 보여 주는 창을 엽니다' },
  featureOff: { en: 'The "Command log" feature is off in the switchboard.', he: 'שכלול "יומן פקודות" כבוי בלוח המתגים.', es: 'La función "Registro de comandos" está desactivada en el panel de interruptores.', fr: 'La fonctionnalité « Journal des commandes » est désactivée dans le panneau des interrupteurs.', ru: 'Функция «Журнал команд» выключена на панели переключателей.', zh: '“命令日志”功能在开关面板中已关闭。', ja: '「コマンドログ」機能はスイッチパネルでオフになっています。', pt: 'O recurso "Log de comandos" está desativado no painel de controle.', de: 'Die Funktion „Befehlslog“ ist in der Schaltzentrale aus.', ko: '“명령 로그” 기능은 스위치 패널에서 꺼져 있습니다.' },
  paneTitle: { en: 'Command log', he: 'יומן פקודות', es: 'Registro de comandos', fr: 'Journal des commandes', ru: 'Журнал команд', zh: '命令日志', ja: 'コマンドログ', pt: 'Log de comandos', de: 'Befehlslog', ko: '명령 로그' },
  opened: { en: 'The command log is open.', he: 'יומן הפקודות נפתח.', es: 'El registro de comandos está abierto.', fr: 'Le journal des commandes est ouvert.', ru: 'Журнал команд открыт.', zh: '命令日志已打开。', ja: 'コマンドログを開きました。', pt: 'O log de comandos está aberto.', de: 'Das Befehlslog ist offen.', ko: '명령 로그가 열려 있습니다.' },
  paneOff: { en: 'The feature is off in the switchboard.', he: 'השכלול כבוי בלוח המתגים.', es: 'La función está desactivada en el panel de interruptores.', fr: 'La fonctionnalité est désactivée dans le panneau des interrupteurs.', ru: 'Функция выключена на панели переключателей.', zh: '该功能在开关面板中已关闭。', ja: 'この機能はスイッチパネルでオフになっています。', pt: 'O recurso está desativado no painel de controle.', de: 'Die Funktion ist in der Schaltzentrale aus.', ko: '이 기능은 스위치 패널에서 꺼져 있습니다.' },
  count: { en: '{n} commands', he: '{n} פקודות', es: '{n} comandos', fr: '{n} commandes', ru: 'команд: {n}', zh: '{n} 条命令', ja: '{n} 件のコマンド', pt: '{n} comandos', de: '{n} Befehle', ko: '명령 {n}개' },
  emptyHint: { en: 'Each Bash command Claude runs is listed here with its duration; press a row to run it again.', he: 'כל פקודת Bash ש-Claude מריץ מופיעה כאן עם משכה; לחץ על שורה כדי להריץ אותה שוב.', es: 'Cada comando Bash que Claude ejecuta aparece aquí con su duración; pulsa una fila para repetirlo.', fr: 'Chaque commande Bash que Claude exécute apparaît ici avec sa durée ; appuie sur une ligne pour la relancer.', ru: 'Каждая Bash-команда, которую запускает Claude, появится здесь с длительностью; нажмите на строку, чтобы запустить снова.', zh: 'Claude 运行的每条 Bash 命令都列在这里并显示耗时；点击某一行可重新运行。', ja: 'Claude が実行した Bash コマンドが所要時間とともに並びます。行を押すと再実行します。', pt: 'Cada comando Bash que o Claude executa aparece aqui com a duração; pressione uma linha para rodá-lo de novo.', de: 'Jeder Bash-Befehl, den Claude ausführt, steht hier mit seiner Dauer; drücke eine Zeile, um ihn erneut auszuführen.', ko: 'Claude가 실행한 모든 Bash 명령이 소요 시간과 함께 나열됩니다. 행을 누르면 다시 실행합니다.' },
  empty: { en: 'No commands have run yet.', he: 'עדיין לא רצו פקודות.', es: 'Aún no se ha ejecutado ningún comando.', fr: 'Aucune commande n\'a encore été exécutée.', ru: 'Команды ещё не запускались.', zh: '还没有运行过命令。', ja: 'まだコマンドは実行されていません。', pt: 'Nenhum comando foi executado ainda.', de: 'Es wurden noch keine Befehle ausgeführt.', ko: '아직 실행된 명령이 없습니다.' },
  rerun: { en: 'Run again', he: 'הרץ שוב', es: 'Repetir', fr: 'Relancer', ru: 'Запустить снова', zh: '重新运行', ja: '再実行', pt: 'Executar de novo', de: 'Erneut ausführen', ko: '다시 실행' },
  rerunPrompt: { en: 'Run again: {command}', he: 'הרץ שוב: {command}', es: 'Ejecuta de nuevo: {command}', fr: 'Relance : {command}', ru: 'Запусти снова: {command}', zh: '重新运行：{command}', ja: '再実行：{command}', pt: 'Executar de novo: {command}', de: 'Erneut ausführen: {command}', ko: '다시 실행: {command}' },
} as const

type Row = { id: number; command: string; ms: number; ok: boolean }
type Log = { seq: number; rows: Row[] }

const log = atom({ plugin: 'toolkitty', key: 'slot', id: 'bash-log' } as const, { seq: 1, rows: [] }) as unknown as Atom<Log>

const MAX = 50

export const feature: Feature = {
  id: 'bash-log',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const started = new Map<string, number>()

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'bash-log', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'bash-log', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function beforeBashCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined
  if (e.tool !== 'Bash') return undefined

  started.set(e.tool_use_id ?? e.command, await $.clock.now())
  return undefined
}

export async function afterBashCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (e.tool !== 'Bash') return result

  const key = e.tool_use_id ?? e.command
  const before = started.get(key)
  started.delete(key)
  const after = await $.clock.now()

  if (before !== undefined && result.deny === undefined) {
    const ok = result.isError !== true
    await update($, log, l => ({
      seq: l.seq + 1,
      rows: [...l.rows, { id: l.seq, command: e.command, ms: after - before, ok }].slice(-MAX),
    }))
  }

  return result
}

export function register(on: On) {
    on('command.run', { command: 'bash-log' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(T.featureOff) }
      await $.ui.open({ id: 'bash-log', title: t(T.paneTitle) })
      return { text: t(T.opened) }
    })

    on('ui.render', { component: 'Pane', requestId: 'bash-log' }, async ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

      const l = await read($, log)
      const room = Math.max(3, Math.floor(((e.viewport?.rows ?? 20) - 3) / 2))
      const shown = l.rows.slice(-room).reverse()

      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), status: t(T.count, { n: l.rows.length }) })}
          {l.rows.length === 0 ? emptyState($, e, t(T.empty), t(T.emptyHint)) : null}
          {shown.map(r =>
            listRow($, e, {
              key: `b-${r.id}`,
              left: r.ok ? '✓' : '✗',
              text: r.command.replace(/\s+/g, ' ').slice(0, 60),
              right: `${clockText(r.ms)} · ${t(T.rerun)}`,
              level: r.ok ? 'ok' : 'alert',
              onPress: () => {
                void $.prompt.fill({ text: t(T.rerunPrompt, { command: r.command }), mode: 'replace' })
              },
            }),
          )}
        </Box>
      )
    })
}
