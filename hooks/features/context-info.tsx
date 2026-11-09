import { LOCALES, isOn, language, notice, t } from '../core'
import type { EngineInterface, On } from 'claude-code'
import type { Feature, Input } from '../core'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Context info', he: 'מידע על ההקשר', es: 'Información del contexto', fr: 'Infos sur le contexte', ru: 'Информация о контексте', zh: '上下文信息', ja: 'コンテキスト情報', pt: 'Info do contexto', de: 'Kontext-Info', ko: '컨텍스트 정보' },
  description: { en: '/ctx: context fill percentage, tokens, cost and usage limits.', he: '/ctx: אחוז מילוי ההקשר, טוקנים, עלות ומגבלות שימוש.', es: '/ctx: porcentaje de contexto usado, tokens, coste y límites de uso.', fr: '/ctx : pourcentage de contexte rempli, tokens, coût et limites d\'utilisation.', ru: '/ctx: заполненность контекста, токены, стоимость и лимиты использования.', zh: '/ctx：上下文占用百分比、token、费用和用量限额。', ja: '/ctx: コンテキストの使用率、トークン、コスト、使用量の上限。', pt: '/ctx: porcentagem de preenchimento do contexto, tokens, custo e limites de uso.', de: '/ctx: Kontextfüllung in Prozent, Tokens, Kosten und Nutzungslimits.', ko: '/ctx: 컨텍스트 사용률, 토큰, 비용, 사용량 한도.' },
  cmdDesc: { en: 'Shows context fill, tokens, cost and usage limits', he: 'מציג מילוי הקשר, טוקנים, עלות ומגבלות שימוש', es: 'Muestra el contexto usado, tokens, coste y límites de uso', fr: 'Affiche le remplissage du contexte, les tokens, le coût et les limites d\'utilisation', ru: 'Показывает заполненность контекста, токены, стоимость и лимиты использования', zh: '显示上下文占用、token、费用和用量限额', ja: 'コンテキストの使用率、トークン、コスト、使用量の上限を表示します', pt: 'Mostra o preenchimento do contexto, tokens, custo e limites de uso', de: 'Zeigt Kontextfüllung, Tokens, Kosten und Nutzungslimits', ko: '컨텍스트 사용률, 토큰, 비용, 사용량 한도를 보여 줍니다' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция выключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  header: { en: 'Session status:', he: 'מצב הסשן:', es: 'Estado de la sesión:', fr: 'État de la session :', ru: 'Состояние сессии:', zh: '会话状态：', ja: 'セッションの状態:', pt: 'Status da sessão:', de: 'Session-Status:', ko: '세션 상태:' },
  unknown: { en: 'not known yet', he: 'לא ידוע עדיין', es: 'aún no se sabe', fr: 'pas encore connu', ru: 'пока неизвестно', zh: '暂时未知', ja: 'まだ不明', pt: 'ainda não se sabe', de: 'noch nicht bekannt', ko: '아직 알 수 없음' },
  contextLine: { en: '• Context: {pct} ({tokens} of {window} tokens)', he: '• הקשר: {pct} ({tokens} מתוך {window} טוקנים)', es: '• Contexto: {pct} ({tokens} de {window} tokens)', fr: '• Contexte : {pct} ({tokens} sur {window} tokens)', ru: '• Контекст: {pct} ({tokens} из {window} токенов)', zh: '• 上下文：{pct}（{window} 个 token 中的 {tokens} 个）', ja: '• コンテキスト: {pct}（{window} トークン中 {tokens}）', pt: '• Contexto: {pct} ({tokens} de {window} tokens)', de: '• Kontext: {pct} ({tokens} von {window} Tokens)', ko: '• 컨텍스트: {pct}({window} 토큰 중 {tokens})' },
  costLine: { en: '• Cost so far: ${usd}', he: '• עלות עד כה: ${usd}', es: '• Coste hasta ahora: ${usd}', fr: '• Coût à ce jour : ${usd}', ru: '• Стоимость на данный момент: ${usd}', zh: '• 目前费用：${usd}', ja: '• これまでのコスト: ${usd}', pt: '• Custo até agora: ${usd}', de: '• Bisherige Kosten: ${usd}', ko: '• 지금까지의 비용: ${usd}' },
  noLimits: { en: '• Usage limits: no data', he: '• מגבלות שימוש: אין נתונים', es: '• Límites de uso: sin datos', fr: '• Limites d\'utilisation : aucune donnée', ru: '• Лимиты использования: нет данных', zh: '• 用量限额：无数据', ja: '• 使用量の上限: データなし', pt: '• Limites de uso: sem dados', de: '• Nutzungslimits: keine Daten', ko: '• 사용량 한도: 데이터 없음' },
  resets: { en: 'resets {when}', he: 'מתאפס {when}', es: 'se restablece {when}', fr: 'se réinitialise {when}', ru: 'сбросится {when}', zh: '{when}重置', ja: '{when}にリセット', pt: 'reinicia {when}', de: 'Reset {when}', ko: '{when} 초기화' },
  win5h: { en: '5-hour window', he: 'חלון 5 שעות', es: 'ventana de 5 horas', fr: 'fenêtre de 5 heures', ru: 'окно 5 часов', zh: '5 小时窗口', ja: '5時間ウィンドウ', pt: 'Janela de 5 horas', de: '5-Stunden-Fenster', ko: '5시간 창' },
  win7d: { en: '7-day window', he: 'חלון 7 ימים', es: 'ventana de 7 días', fr: 'fenêtre de 7 jours', ru: 'окно 7 дней', zh: '7 天窗口', ja: '7日間ウィンドウ', pt: 'Janela de 7 dias', de: '7-Tage-Fenster', ko: '7일 창' },
  winSpend: { en: 'Spend limit', he: 'מגבלת הוצאה', es: 'Límite de gasto', fr: 'Limite de dépenses', ru: 'Лимит расходов', zh: '支出上限', ja: '支出上限', pt: 'Limite de gastos', de: 'Ausgabenlimit', ko: '지출 한도' },
} as const


const OFF_TEXT = T.off

const windowName = (kind: string): string =>
  kind === 'five_hour' ? t(T.win5h) : kind === 'seven_day' ? t(T.win7d) : kind === 'spend_limit' ? t(T.winSpend) : kind

export const feature: Feature = {
  id: 'context-info',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'ctx', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'ctx', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export function register(on: On) {
    on('command.run', { command: 'ctx' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(OFF_TEXT) }

      const usage = await $.session.usage()
      const { context, cost, rateLimits } = usage
      const lines: string[] = [t(T.header)]

      const pct = context.percent === undefined ? t(T.unknown) : `${context.percent}%`
      const tokens = context.tokens === undefined ? '—' : context.tokens.toLocaleString('en-US')
      lines.push(t(T.contextLine, { pct, tokens, window: context.window.toLocaleString('en-US') }))

      if (cost !== undefined) lines.push(t(T.costLine, { usd: cost.usd.toFixed(2) }))

      if (rateLimits.length === 0) lines.push(t(T.noLimits))
      else
        for (const w of rateLimits) {
          const reset = w.resetsAt === undefined ? '' : ` (${t(T.resets, { when: new Date(w.resetsAt).toLocaleString(LOCALES[language()]) })})`
          lines.push(`• ${windowName(w.kind)}: ${w.percentUsed}%${reset}`)
        }

      return { text: lines.join('\n') }
    })
}
