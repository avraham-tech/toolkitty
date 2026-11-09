import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input, Localized } from '../core'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Copy answer', he: 'העתקת תשובה', es: 'Copiar respuesta', fr: 'Copier la réponse', ru: 'Копирование ответа', zh: '复制回答', ja: '回答をコピー', pt: 'Copiar resposta', de: 'Antwort kopieren', ko: '답변 복사' },
  description: { en: '/copy-last copies the last answer; /copy-last code copies only the last code block.', he: '/copy-last מעתיק את התשובה האחרונה; /copy-last code מעתיק רק את בלוק הקוד האחרון.', es: '/copy-last copia la última respuesta; /copy-last code copia solo el último bloque de código.', fr: '/copy-last copie la dernière réponse ; /copy-last code copie uniquement le dernier bloc de code.', ru: '/copy-last копирует последний ответ; /copy-last code копирует только последний блок кода.', zh: '/copy-last 复制上一条回答；/copy-last code 只复制上一个代码块。', ja: '/copy-last は直前の回答をコピーし、/copy-last code は直前のコードブロックだけをコピーします。', pt: '/copy-last copia a última resposta; /copy-last code copia só o último bloco de código.', de: '/copy-last kopiert die letzte Antwort; /copy-last code kopiert nur den letzten Codeblock.', ko: '/copy-last는 마지막 답변을 복사하고, /copy-last code는 마지막 코드 블록만 복사합니다.' },
  cmdDesc: { en: 'Copies the last answer (or "code" for the last code block)', he: 'מעתיק את התשובה האחרונה (או "code" לבלוק הקוד האחרון)', es: 'Copia la última respuesta (o "code" para el último bloque de código)', fr: 'Copie la dernière réponse (ou "code" pour le dernier bloc de code)', ru: 'Копирует последний ответ (или "code" для последнего блока кода)', zh: '复制上一条回答（用 "code" 复制上一个代码块）', ja: '直前の回答をコピーします（「code」で直前のコードブロック）', pt: 'Copia a última resposta (ou "code" para o último bloco de código)', de: 'Kopiert die letzte Antwort (oder „code“ für den letzten Codeblock)', ko: '마지막 답변을 복사합니다("code"를 주면 마지막 코드 블록)' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция выключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  noAnswer: { en: 'No answer to copy yet.', he: 'אין עדיין תשובה להעתקה.', es: 'Aún no hay ninguna respuesta que copiar.', fr: 'Aucune réponse à copier pour le moment.', ru: 'Пока нет ответа для копирования.', zh: '还没有可复制的回答。', ja: 'コピーできる回答はまだありません。', pt: 'Ainda não há resposta para copiar.', de: 'Noch keine Antwort zum Kopieren.', ko: '아직 복사할 답변이 없습니다.' },
  noCode: { en: 'No code block found in the last answer.', he: 'לא נמצא בלוק קוד בתשובה האחרונה.', es: 'No se encontró ningún bloque de código en la última respuesta.', fr: 'Aucun bloc de code trouvé dans la dernière réponse.', ru: 'В последнем ответе нет блока кода.', zh: '上一条回答中没有找到代码块。', ja: '直前の回答にコードブロックが見つかりませんでした。', pt: 'Nenhum bloco de código encontrado na última resposta.', de: 'Kein Codeblock in der letzten Antwort gefunden.', ko: '마지막 답변에서 코드 블록을 찾지 못했습니다.' },
  copied: { en: 'Copied', he: 'הועתק', es: 'Copiado', fr: 'Copié', ru: 'Скопировано', zh: '已复制', ja: 'コピーしました', pt: 'Copiado', de: 'Kopiert', ko: '복사됨' },
  noSurface: { en: 'no screen is showing the session', he: 'אין מסך שמציג את הסשן', es: 'ninguna pantalla muestra la sesión', fr: 'aucun écran n\'affiche la session', ru: 'нет экрана, на котором отображается сессия', zh: '没有界面正在显示该会话', ja: 'セッションを表示している画面がありません', pt: 'nenhuma tela está mostrando a sessão', de: 'keine Oberfläche zeigt die Session an', ko: '세션을 표시하는 화면이 없습니다' },
  noClipboard: { en: 'no clipboard available', he: 'אין לוח העתקה זמין', es: 'no hay portapapeles disponible', fr: 'aucun presse-papiers disponible', ru: 'буфер обмена недоступен', zh: '没有可用的剪贴板', ja: '使えるクリップボードがありません', pt: 'nenhuma área de transferência disponível', de: 'keine Zwischenablage verfügbar', ko: '사용할 수 있는 클립보드가 없습니다' },
  refused: { en: 'the copy was refused', he: 'ההעתקה נדחתה', es: 'se rechazó la copia', fr: 'la copie a été refusée', ru: 'копирование отклонено', zh: '复制被拒绝', ja: 'コピーが拒否されました', pt: 'a cópia foi recusada', de: 'das Kopieren wurde abgelehnt', ko: '복사가 거부되었습니다' },
  failed: { en: 'Copy failed: {why}', he: 'ההעתקה נכשלה: {why}', es: 'La copia falló: {why}', fr: 'La copie a échoué : {why}', ru: 'Не удалось скопировать: {why}', zh: '复制失败：{why}', ja: 'コピーに失敗しました: {why}', pt: 'Falha ao copiar: {why}', de: 'Kopieren fehlgeschlagen: {why}', ko: '복사 실패: {why}' },
} as const

type Last = { text: string }

const last = atom({ plugin: 'toolkitty', key: 'slot', id: 'copy-last' } as const, { text: '' }) as unknown as Atom<Last>

const MAX_CHARS = 50000
const OFF = T.off

/** The body of the last fenced code block, or null when there is none. */
const lastCodeBlock = (text: string): string | null => {
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
  const body = blocks[blocks.length - 1]?.[1]
  return body === undefined ? null : body.replace(/\n$/, '')
}

export const feature: Feature = {
  id: 'copy-last',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'copy-last', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'copy-last', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  if (e.answer.trim() !== '') await update($, last, () => ({ text: e.answer.slice(0, MAX_CHARS) }))
}

export function register(on: On) {
    on('command.run', { command: 'copy-last' }, async ($, e) => {
      if (!(await isOn($, feature))) return { text: t(OFF) }

      const { text } = await read($, last)
      if (text === '') return { text: t(T.noAnswer) }

      const wantsCode = e.args.trim().toLowerCase() === 'code'
      const payload = wantsCode ? lastCodeBlock(text) : text
      if (payload === null) return { text: t(T.noCode) }

      const r = await $.ui.copy({ text: payload })
      if (r.isCopied) return { text: t(T.copied) }

      const why: Record<string, Localized> = {
        'no-surface': T.noSurface,
        'no-clipboard': T.noClipboard,
        refused: T.refused,
      }
      const reason = why[r.reason]
      return { text: t(T.failed, { why: reason === undefined ? r.reason : t(reason) }) }
    })
}
