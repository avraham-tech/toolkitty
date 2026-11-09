import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input } from '../core'

const T = {
  title: { en: 'Prompt history', he: 'היסטוריית הודעות', es: 'Historial de mensajes', fr: 'Historique des messages', ru: 'История сообщений', zh: '提示词历史', ja: 'プロンプト履歴', pt: 'Histórico de prompts', de: 'Prompt-Verlauf', ko: '프롬프트 기록' },
  description: { en: '/history shows the last 50 messages in the session; /history <number> puts one back in the box.', he: '/history מציג את 50 ההודעות האחרונות בסשן; /history <מספר> מחזיר אחת לתיבה.', es: '/history muestra los últimos 50 mensajes de la sesión; /history <número> devuelve uno al cuadro de texto.', fr: '/history affiche les 50 derniers messages de la session ; /history <numéro> en remet un dans la zone de saisie.', ru: '/history показывает последние 50 сообщений сессии; /history <номер> возвращает одно из них в поле ввода.', zh: '/history 显示本次会话的最近 50 条消息；/history <编号> 把其中一条放回输入框。', ja: '/history でセッションの直近 50 件のメッセージを表示し、/history <番号> で 1 件を入力欄に戻します。', pt: '/history mostra as últimas 50 mensagens da sessão; /history <número> coloca uma de volta na caixa.', de: '/history zeigt die letzten 50 Nachrichten der Sitzung; /history <Nummer> setzt eine zurück ins Eingabefeld.', ko: '/history는 세션의 최근 메시지 50개를 보여 주고, /history <번호>는 하나를 입력창에 되돌립니다.' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty パネルでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; im /toolkitty-Panel einschalten', ko: '기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요' },
  cmdDesc: { en: 'List of the latest messages in the session; with a number: puts a message back in the prompt box', he: 'רשימת ההודעות האחרונות בסשן; עם מספר: מחזיר הודעה לתיבת הכתיבה', es: 'Lista de los últimos mensajes de la sesión; con un número: devuelve un mensaje al cuadro de texto', fr: 'Liste des derniers messages de la session ; avec un numéro : remet un message dans la zone de saisie', ru: 'Список последних сообщений сессии; с номером: возвращает сообщение в поле ввода', zh: '列出本次会话的最近消息；带编号时：把该消息放回输入框', ja: 'セッションの最近のメッセージを一覧表示。番号を付けるとそのメッセージを入力欄に戻します', pt: 'Lista as mensagens recentes da sessão; com um número, coloca a mensagem de volta na caixa de prompt', de: 'Listet die letzten Nachrichten der Sitzung; mit einer Nummer: setzt eine Nachricht zurück ins Eingabefeld', ko: '세션의 최근 메시지를 나열하며, 번호를 주면 그 메시지를 입력창에 되돌립니다' },
  argHint: { en: '[number]', he: '[מספר]', es: '[número]', fr: '[numéro]', ru: '[номер]', zh: '[编号]', ja: '[番号]', pt: '[número]', de: '[Nummer]', ko: '[번호]' },
  empty: { en: 'No messages have been sent in this session yet.', he: 'עוד לא נשלחו הודעות בסשן הזה.', es: 'Todavía no se han enviado mensajes en esta sesión.', fr: 'Aucun message n\'a encore été envoyé dans cette session.', ru: 'В этой сессии ещё не отправлено ни одного сообщения.', zh: '本次会话尚未发送任何消息。', ja: 'このセッションではまだメッセージを送信していません。', pt: 'Nenhuma mensagem foi enviada nesta sessão ainda.', de: 'In dieser Sitzung wurde noch keine Nachricht gesendet.', ko: '이번 세션에서는 아직 보낸 메시지가 없습니다.' },
  head: { en: 'Latest messages (newest first):', he: 'ההודעות האחרונות (החדשה ראשונה):', es: 'Últimos mensajes (el más reciente primero):', fr: 'Derniers messages (le plus récent en premier) :', ru: 'Последние сообщения (новые сверху):', zh: '最近的消息（最新在前）：', ja: '最近のメッセージ（新しい順）：', pt: 'Mensagens recentes (mais novas primeiro):', de: 'Letzte Nachrichten (neueste zuerst):', ko: '최근 메시지 (최신순):' },
  restoreHint: { en: 'To put one back in the box: /history <number>', he: 'להחזרה לתיבה: /history <מספר>', es: 'Para devolver uno al cuadro de texto: /history <número>', fr: 'Pour en remettre un dans la zone de saisie : /history <numéro>', ru: 'Чтобы вернуть сообщение в поле ввода: /history <номер>', zh: '要把某条放回输入框：/history <编号>', ja: '入力欄に戻すには：/history <番号>', pt: 'Para colocar uma de volta na caixa: /history <número>', de: 'Um eine zurück ins Eingabefeld zu setzen: /history <Nummer>', ko: '입력창에 되돌리려면: /history <번호>' },
  noSuch: { en: 'There is no message number {arg}.', he: 'אין הודעה מספר {arg}.', es: 'No existe el mensaje número {arg}.', fr: 'Il n\'y a pas de message numéro {arg}.', ru: 'Сообщения с номером {arg} нет.', zh: '没有编号为 {arg} 的消息。', ja: '番号 {arg} のメッセージはありません。', pt: 'Não existe a mensagem número {arg}.', de: 'Es gibt keine Nachricht mit der Nummer {arg}.', ko: '{arg}번 메시지가 없습니다.' },
  restored: { en: 'Message {n} was put back in the box.', he: 'הודעה {n} הוחזרה לתיבה.', es: 'El mensaje {n} se devolvió al cuadro de texto.', fr: 'Le message {n} a été remis dans la zone de saisie.', ru: 'Сообщение {n} возвращено в поле ввода.', zh: '消息 {n} 已放回输入框。', ja: 'メッセージ {n} を入力欄に戻しました。', pt: 'A mensagem {n} foi colocada de volta na caixa.', de: 'Nachricht {n} wurde zurück ins Eingabefeld gesetzt.', ko: '메시지 {n}을(를) 입력창에 되돌렸습니다.' },
  cantFill: { en: 'The prompt box cannot be filled right now.', he: 'לא ניתן למלא את תיבת הכתיבה כרגע.', es: 'No se puede rellenar el cuadro de texto en este momento.', fr: 'Impossible de remplir la zone de saisie pour le moment.', ru: 'Сейчас невозможно заполнить поле ввода.', zh: '目前无法填充输入框。', ja: '現在は入力欄に入力できません。', pt: 'A caixa de prompt não pode ser preenchida agora.', de: 'Das Eingabefeld kann gerade nicht befüllt werden.', ko: '지금은 입력창을 채울 수 없습니다.' },
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

type History = { prompts: string[] }

const history = atom({ plugin: 'toolkitty', key: 'slot', id: 'prompt-history' } as const, { prompts: [] }) as unknown as Atom<History>

const COMMAND = 'history'
const KEEP = 50
const MAX_STORED = 4000

export const feature: Feature = {
  id: 'prompt-history',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({
      name: COMMAND,
      description: t(T.cmdDesc),
      argumentHint: t(T.argHint),
    })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'history', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  return
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'>> {
  if (e.command !== undefined || e.isMeta === true || !(await isOn($, feature))) return e

  const text = e.text.trim()
  if (text !== '' && !text.startsWith('/')) {
    await update($, history, cur => ({ prompts: [...cur.prompts, text.slice(0, MAX_STORED)].slice(-KEEP) }))
  }
  return e
}

export function register(on: On) {
    on('command.run', { command: COMMAND }, async ($, e) => {
      if (!(await isOn($, feature))) return { text: t(T.off) }

      const { prompts } = await read($, history)
      const newest = [...prompts].reverse()
      const arg = e.args.trim()

      if (arg === '') {
        if (newest.length === 0) return { text: t(T.empty) }
        const lines = newest.map((p, i) => {
          const flat = p.replace(/\s+/g, ' ')
          return `${i + 1}. ${flat.length > 60 ? `${flat.slice(0, 60)}…` : flat}`
        })
        return { text: [t(T.head), ...lines, '', t(T.restoreHint)].join('\n') }
      }

      const n = Number.parseInt(arg, 10)
      const chosen = Number.isInteger(n) ? newest[n - 1] : undefined
      if (chosen === undefined) return { text: t(T.noSuch, { arg }) }

      const filled = await $.prompt.fill({ text: chosen, mode: 'replace' })
      return { text: filled.isFilled ? t(T.restored, { n }) : t(T.cantFill) }
    })
}
