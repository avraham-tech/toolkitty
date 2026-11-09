import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, Timer } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { Feature, Input, Output, ToolCallInput, ToolCallOutput } from '../core'
import { publish, retract, retractAll } from '../signals'

const T = {
  title: {
    en: 'Waiting alert',
    he: 'התראת המתנה',
    es: 'Alerta de espera',
    fr: "Alerte d'attente",
    ru: 'Оповещение об ожидании',
    zh: '等待提醒',
    ja: '待機アラート',
    pt: 'Alerta de espera',
    de: 'Warte-Hinweis',
    ko: '대기 알림',
  },
  description: {
    en: 'Reminds you if Claude has waited a minute for your approval, and can push to your phone (ntfy.sh) when you are waiting or a long turn is done.',
    he: 'מזכיר לך אם Claude ממתין דקה לאישור שלך, ויכול לשלוח התראה לטלפון (ntfy.sh) כשממתינים או כשתור ארוך הסתיים.',
    es: 'Te recuerda si Claude lleva un minuto esperando tu aprobación, y puede enviar un aviso a tu teléfono (ntfy.sh) al esperar o al terminar un turno largo.',
    fr: "Vous rappelle si Claude attend votre approbation depuis une minute, et peut notifier votre téléphone (ntfy.sh) en cas d'attente ou à la fin d'un long tour.",
    ru: 'Напоминает, если Claude минуту ждёт вашего подтверждения, и может присылать push на телефон (ntfy.sh) при ожидании или завершении долгого хода.',
    zh: '当 Claude 等待你批准满一分钟时提醒你；在等待期间或长时间的一轮结束时，还可推送到手机（ntfy.sh）。',
    ja: 'Claude が承認を 1 分待っているときにお知らせし、待機中や長いターンの完了時にスマートフォンへプッシュ通知もできます（ntfy.sh）。',
    pt: 'Avisa se o Claude esperou um minuto pela sua aprovação e pode enviar push ao celular (ntfy.sh) durante a espera ou ao fim de um turno longo.',
    de: 'Erinnert dich, wenn Claude eine Minute auf deine Freigabe gewartet hat, und kann bei Wartezeit oder nach einem langen Durchgang einen Push aufs Handy senden (ntfy.sh).',
    ko: 'Claude가 승인을 1분간 기다리면 알려 주며, 대기 중이거나 긴 턴이 끝났을 때 휴대폰으로 푸시(ntfy.sh)를 보낼 수 있습니다.',
  },
  off: {
    en: 'This feature is off; turn it on in the /toolkitty panel',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'Esta función está desactivada; actívala en el panel /toolkitty',
    fr: 'Cette fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty',
    ru: 'Функция выключена; включите её на панели /toolkitty',
    zh: '此功能已关闭，请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'Este recurso está desativado; ative-o no painel /toolkitty',
    de: 'Diese Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  commandDesc: {
    en: 'Sets the ntfy.sh push URL: /push-url <url>, off, or test',
    he: 'קובע את כתובת ההתראות של ntfy.sh: ‎/push-url <url>, off או test',
    es: 'Fija la URL de avisos de ntfy.sh: /push-url <url>, off o test',
    fr: "Définit l'URL de notification ntfy.sh : /push-url <url>, off ou test",
    ru: 'Задаёт URL push-уведомлений ntfy.sh: /push-url <url>, off или test',
    zh: '设置 ntfy.sh 推送 URL：/push-url <url>、off 或 test',
    ja: 'ntfy.sh のプッシュ URL を設定します：/push-url <url>、off、または test',
    pt: 'Define a URL de push do ntfy.sh: /push-url <url>, off ou test',
    de: 'Setzt die ntfy.sh-Push-URL: /push-url <url>, off oder test',
    ko: 'ntfy.sh 푸시 URL을 설정합니다: /push-url <url>, off 또는 test',
  },
  argHint: {
    en: '<url> | off | test',
    he: '<url> | off | test',
    es: '<url> | off | test',
    fr: '<url> | off | test',
    ru: '<url> | off | test',
    zh: '<url> | off | test',
    ja: '<url> | off | test',
    pt: '<url> | off | test',
    de: '<url> | off | test',
    ko: '<url> | off | test',
  },
  stillWaiting: {
    en: 'Claude Code is still waiting for your approval of {tool}',
    he: 'Claude Code עדיין ממתין לאישור שלך עבור {tool}',
    es: 'Claude Code sigue esperando tu aprobación de {tool}',
    fr: 'Claude Code attend toujours votre approbation pour {tool}',
    ru: 'Claude Code всё ещё ждёт вашего подтверждения для {tool}',
    zh: 'Claude Code 仍在等待你批准 {tool}',
    ja: 'Claude Code は {tool} の承認をまだ待っています',
    pt: 'O Claude Code ainda aguarda a sua aprovação de {tool}',
    de: 'Claude Code wartet weiter auf deine Freigabe für {tool}',
    ko: 'Claude Code가 {tool}에 대한 승인을 아직 기다리고 있습니다',
  },
  pushDone: {
    en: 'done: {answer}',
    he: 'הסתיים: {answer}',
    es: 'listo: {answer}',
    fr: 'terminé : {answer}',
    ru: 'готово: {answer}',
    zh: '完成：{answer}',
    ja: '完了：{answer}',
    pt: 'concluído: {answer}',
    de: 'fertig: {answer}',
    ko: '완료: {answer}',
  },
  pushTest: {
    en: 'Test message from Claude Code: push notifications work.',
    he: 'הודעת בדיקה מ-Claude Code: ההתראות פועלות.',
    es: 'Mensaje de prueba de Claude Code: los avisos funcionan.',
    fr: 'Message de test de Claude Code : les notifications fonctionnent.',
    ru: 'Тестовое сообщение от Claude Code: push-уведомления работают.',
    zh: '来自 Claude Code 的测试消息：推送通知正常。',
    ja: 'Claude Code からのテストメッセージ：プッシュ通知は動作しています。',
    pt: 'Mensagem de teste do Claude Code: as notificações push funcionam.',
    de: 'Testnachricht von Claude Code: Push-Benachrichtigungen funktionieren.',
    ko: 'Claude Code의 테스트 메시지: 푸시 알림이 작동합니다.',
  },
  urlSet: {
    en: 'Push URL saved ({host}). Use /push-url test to try it.',
    he: 'כתובת ההתראות נשמרה ({host}). ‎/push-url test לבדיקה.',
    es: 'URL de avisos guardada ({host}). Usa /push-url test para probarla.',
    fr: "URL de notification enregistrée ({host}). Utilisez /push-url test pour l'essayer.",
    ru: 'URL push-уведомлений сохранён ({host}). Проверьте командой /push-url test.',
    zh: '推送 URL 已保存（{host}）。用 /push-url test 试一下。',
    ja: 'プッシュ URL を保存しました（{host}）。/push-url test で試せます。',
    pt: 'URL de push salva ({host}). Use /push-url test para testar.',
    de: 'Push-URL gespeichert ({host}). Mit /push-url test ausprobieren.',
    ko: '푸시 URL을 저장했습니다({host}). /push-url test로 시험해 보세요.',
  },
  urlOff: {
    en: 'Push is off; the stored URL was cleared.',
    he: 'ההתראות לטלפון כבויות; הכתובת השמורה נמחקה.',
    es: 'Los avisos al teléfono están desactivados; se borró la URL guardada.',
    fr: "Les notifications push sont désactivées ; l'URL enregistrée a été effacée.",
    ru: 'Push выключен; сохранённый URL удалён.',
    zh: '推送已关闭；已清除保存的 URL。',
    ja: 'プッシュはオフです。保存していた URL を消去しました。',
    pt: 'O push está desativado; a URL salva foi apagada.',
    de: 'Push ist aus; die gespeicherte URL wurde gelöscht.',
    ko: '푸시가 꺼졌고 저장된 URL을 지웠습니다.',
  },
  urlNone: {
    en: 'No push URL is set. Use /push-url https://ntfy.sh/<your-topic>',
    he: 'לא נקבעה כתובת התראות. ‎/push-url https://ntfy.sh/<הנושא-שלך>',
    es: 'No hay URL de avisos. Usa /push-url https://ntfy.sh/<tu-tema>',
    fr: "Aucune URL de notification n'est définie. Utilisez /push-url https://ntfy.sh/<votre-sujet>",
    ru: 'URL push не задан. Используйте /push-url https://ntfy.sh/<ваша-тема>',
    zh: '未设置推送 URL。请使用 /push-url https://ntfy.sh/<your-topic>',
    ja: 'プッシュ URL が未設定です。/push-url https://ntfy.sh/<your-topic> を使ってください',
    pt: 'Nenhuma URL de push definida. Use /push-url https://ntfy.sh/<your-topic>',
    de: 'Keine Push-URL gesetzt. Nutze /push-url https://ntfy.sh/<your-topic>',
    ko: '푸시 URL이 설정되지 않았습니다. /push-url https://ntfy.sh/<your-topic> 명령을 사용하세요',
  },
  urlCurrent: {
    en: 'Push goes to {host} (topic hidden). /push-url off clears it.',
    he: 'ההתראות נשלחות ל-{host} (הנושא מוסתר). ‎/push-url off מנקה.',
    es: 'Los avisos van a {host} (tema oculto). /push-url off lo borra.',
    fr: 'Les notifications vont vers {host} (sujet masqué). /push-url off les désactive.',
    ru: 'Push отправляется на {host} (тема скрыта). /push-url off отключает.',
    zh: '推送发往 {host}（主题已隐藏）。/push-url off 可清除。',
    ja: 'プッシュの送信先は {host} です（トピックは非表示）。/push-url off で消去できます。',
    pt: 'O push vai para {host} (tópico oculto). /push-url off o apaga.',
    de: 'Push geht an {host} (Topic verborgen). /push-url off löscht es.',
    ko: '푸시 전송 대상: {host}(토픽 숨김). /push-url off로 지울 수 있습니다.',
  },
  urlBad: {
    en: 'That is not an http(s) URL. Example: /push-url https://ntfy.sh/my-topic',
    he: 'זו לא כתובת http(s). דוגמה: ‎/push-url https://ntfy.sh/my-topic',
    es: 'Eso no es una URL http(s). Ejemplo: /push-url https://ntfy.sh/mi-tema',
    fr: "Ce n'est pas une URL http(s). Exemple : /push-url https://ntfy.sh/mon-sujet",
    ru: 'Это не http(s) URL. Пример: /push-url https://ntfy.sh/my-topic',
    zh: '这不是 http(s) URL。示例：/push-url https://ntfy.sh/my-topic',
    ja: 'http(s) の URL ではありません。例：/push-url https://ntfy.sh/my-topic',
    pt: 'Isso não é uma URL http(s). Exemplo: /push-url https://ntfy.sh/my-topic',
    de: 'Das ist keine http(s)-URL. Beispiel: /push-url https://ntfy.sh/my-topic',
    ko: 'http(s) URL이 아닙니다. 예: /push-url https://ntfy.sh/my-topic',
  },
  testOk: {
    en: 'Test message sent.',
    he: 'הודעת הבדיקה נשלחה.',
    es: 'Mensaje de prueba enviado.',
    fr: 'Message de test envoyé.',
    ru: 'Тестовое сообщение отправлено.',
    zh: '测试消息已发送。',
    ja: 'テストメッセージを送信しました。',
    pt: 'Mensagem de teste enviada.',
    de: 'Testnachricht gesendet.',
    ko: '테스트 메시지를 보냈습니다.',
  },
  testFail: {
    en: 'Sending failed (check the URL and your network).',
    he: 'השליחה נכשלה (בדוק את הכתובת והרשת).',
    es: 'El envío falló (revisa la URL y la red).',
    fr: "L'envoi a échoué (vérifiez l'URL et le réseau).",
    ru: 'Не удалось отправить (проверьте URL и сеть).',
    zh: '发送失败（请检查 URL 和网络）。',
    ja: '送信に失敗しました（URL とネットワークを確認してください）。',
    pt: 'Falha no envio (verifique a URL e a rede).',
    de: 'Senden fehlgeschlagen (prüfe die URL und dein Netzwerk).',
    ko: '전송에 실패했습니다(URL과 네트워크를 확인하세요).',
  },
  pushFailed: {
    en: 'The push to your phone failed (check /push-url and your network).',
    he: 'השליחה לטלפון נכשלה (בדוק את ‎/push-url והרשת).',
    es: 'El aviso al teléfono falló (revisa /push-url y la red).',
    fr: "La notification vers le téléphone a échoué (vérifiez /push-url et le réseau).",
    ru: 'Не удалось отправить push на телефон (проверьте /push-url и сеть).',
    zh: '推送到手机失败（请检查 /push-url 和网络）。',
    ja: 'スマートフォンへのプッシュに失敗しました（/push-url とネットワークを確認してください）。',
    pt: 'O push para o celular falhou (verifique /push-url e a rede).',
    de: 'Der Push aufs Handy ist fehlgeschlagen (prüfe /push-url und dein Netzwerk).',
    ko: '휴대폰으로 푸시를 보내지 못했습니다(/push-url과 네트워크를 확인하세요).',
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

type Pending = { toolUseId: string; tool: string; askedAt: number }
type State = { pending: Pending[] }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'waiting-alert' } as const, { pending: [] } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'waiting-alert',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const ESCALATE_MS = 60_000
const LONG_TURN_MS = 120_000
const URL_KEY = 'waiting-alert:url'

const escalations = new Map<string, Timer>()
/** Asks that went unanswered for a minute: no longer in `pending`, but the person is still being waited on. */
const escalated = new Set<string>()

const hostOf = (url: string): string => url.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0] ?? url

/** POSTs to the stored push URL; null when none is set, otherwise whether it was accepted. */
async function push($: EngineInterface, priority: string, body: string): Promise<boolean | null> {
  const url = await storeGet<string>($, URL_KEY, '')
  if (url === '') return null
  try {
    const response = await $.http.fetch(url, { method: 'POST', headers: { Title: 'Claude Code', Priority: priority }, body })
    return response.ok
  } catch {
    return false
  }
}

function forget(id: string): void {
  escalations.get(id)?.cancel()
  escalations.delete(id)
}

function forgetAll(): void {
  for (const timer of escalations.values()) timer.cancel()
  escalations.clear()
  escalated.clear()
}

/** Says an ask is pending (the tool being asked about); the level rises once the wait has lasted. */
async function publishWaiting($: EngineInterface, tool: string, level: 'warn' | 'alert'): Promise<void> {
  await publish($, { id: 'waiting-alert:ask', feature: feature.id, kind: 'waiting', level, text: tool })
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'push-url', description: t(T.commandDesc), argumentHint: t(T.argHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'push-url', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }
  forgetAll()
  await update($, state, () => ({ pending: [] }))
  await retract($, 'waiting-alert:ask')
}

/** The first notification is done-notify's; this only starts the escalation clock. */
export async function afterToolCheck(
  $: EngineInterface,
  e: Input<'tool.check'>,
  verdict: Output<'tool.check'>,
): Promise<Output<'tool.check'>> {
  if (verdict.decision !== 'ask' || e.agentId !== undefined || e.tool_use_id === undefined) return verdict
  if (!(await isOn($, feature))) return verdict

  const id = e.tool_use_id
  const tool = e.tool
  const askedAt = await $.clock.now()
  await update($, state, s => ({ pending: [...s.pending.filter(p => p.toolUseId !== id), { toolUseId: id, tool, askedAt }] }))
  await publishWaiting($, tool, 'warn')

  forget(id)
  escalations.set(
    id,
    $.clock.after(ESCALATE_MS, async () => {
      escalations.delete(id)
      if (!(await isOn($, feature))) return

      const s = await read($, state)
      if (!s.pending.some(p => p.toolUseId === id)) return
      await update($, state, cur => ({ pending: cur.pending.filter(p => p.toolUseId !== id) }))
      escalated.add(id)
      await publishWaiting($, tool, 'alert')

      const text = t(T.stillWaiting, { tool })
      // On the desktop $.ui.notify is not sent (terminal channels only); the alert notice below pops a toast there.
      await $.ui.notify(text, { title: 'Claude Code' })
      await notice($, 'alert', text, feature.id)
      const sent = await push($, 'high', text)
      if (sent === false) await notice($, 'alert', t(T.pushFailed), feature.id)
    }),
  )
  return verdict
}

async function answered($: EngineInterface, id: string | undefined): Promise<void> {
  if (id === undefined) return
  forget(id)
  const s = await read($, state)
  const wasWaiting = s.pending.some(p => p.toolUseId === id) || escalated.has(id)
  if (s.pending.some(p => p.toolUseId === id)) {
    await update($, state, cur => ({ pending: cur.pending.filter(p => p.toolUseId !== id) }))
  }
  if (!wasWaiting) return
  escalated.delete(id)
  const left = s.pending.filter(p => p.toolUseId !== id)
  const last = left[left.length - 1]
  if (last === undefined) await retract($, 'waiting-alert:ask')
  else await publishWaiting($, last.tool, 'warn')
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return undefined
  }
  await answered($, e.tool_use_id)
  return undefined
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  await answered($, e.tool_use_id)
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return

  forgetAll()
  await update($, state, () => ({ pending: [] }))
  await retractAll($, feature.id)

  if (!(await isOn($, feature)) || e.isAborted || e.durationMs <= LONG_TURN_MS) return
  const sent = await push($, 'default', t(T.pushDone, { answer: e.answer.replace(/\s+/g, ' ').trim().slice(0, 100) }))
  if (sent === false) await notice($, 'alert', t(T.pushFailed), feature.id)
}

export function register(on: On) {
  on('command.run', { command: 'push-url' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const arg = e.args.trim()
    const url = await storeGet<string>($, URL_KEY, '')

    if (arg === '') {
      return { text: url === '' ? t(T.urlNone) : t(T.urlCurrent, { host: hostOf(url) }) }
    }
    if (arg === 'off') {
      await storeSet($, URL_KEY, '')
      return { text: t(T.urlOff) }
    }
    if (arg === 'test') {
      if (url === '') return { text: t(T.urlNone) }
      const ok = await push($, 'default', t(T.pushTest))
      return { text: ok === true ? t(T.testOk) : t(T.testFail) }
    }
    if (!/^https?:\/\/[^\s]+$/i.test(arg)) return { text: t(T.urlBad) }

    await storeSet($, URL_KEY, arg)
    return { text: t(T.urlSet, { host: hostOf(arg) }) }
  })
}
