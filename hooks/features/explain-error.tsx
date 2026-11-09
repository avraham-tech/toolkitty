import { isOn, notice, t } from '../core'
import type { EngineInterface, On } from 'claude-code'
import type { Feature, Input } from '../core'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Explain error', he: 'הסבר שגיאה', es: 'Explicar error', fr: "Expliquer l'erreur", ru: 'Объяснение ошибки', zh: '解释错误', ja: 'エラーを説明', pt: 'Explicar erro', de: 'Fehler erklären', ko: '오류 설명' },
  description: {
    en: 'The /explain command explains the latest error and what to fix.',
    he: 'הפקודה /explain מסבירה בעברית את השגיאה האחרונה ומה לתקן.',
    es: 'El comando /explain explica el último error y qué corregir.',
    fr: "La commande /explain explique la dernière erreur et ce qu'il faut corriger.",
    ru: 'Команда /explain объясняет последнюю ошибку и что нужно исправить.',
    zh: '/explain 命令会解释最新的错误以及该如何修复。',
    ja: '/explain コマンドは最新のエラーと修正方法を説明します。',
    pt: 'O comando /explain explica o erro mais recente e o que corrigir.',
    de: 'Der Befehl /explain erklärt den neuesten Fehler und was zu beheben ist.',
    ko: '/explain 명령은 최근 오류와 고칠 방법을 설명합니다.',
  },
  commandDesc: {
    en: 'Explains the latest error in the conversation',
    he: 'מסביר בעברית את השגיאה האחרונה בשיחה',
    es: 'Explica el último error de la conversación',
    fr: "Explique la dernière erreur de la conversation",
    ru: 'Объясняет последнюю ошибку в разговоре',
    zh: '解释对话中最新的错误',
    ja: '会話内の最新のエラーを説明します',
    pt: 'Explica o erro mais recente da conversa',
    de: 'Erklärt den neuesten Fehler in der Unterhaltung',
    ko: '대화 속 최근 오류를 설명합니다',
  },
  // the language name, in English, used inside the prompt sent to the model
  promptLang: { en: 'English', he: 'Hebrew', es: 'Spanish', fr: 'French', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', pt: 'Brazilian Portuguese', de: 'German', ko: 'Korean' },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty',
    ru: 'Функция отключена; включите её в панели /toolkitty',
    zh: '该功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  nothingToFork: {
    en: 'There is no conversation to explain from yet.',
    he: 'אין עדיין שיחה להסביר ממנה.',
    es: 'Todavía no hay ninguna conversación que explicar.',
    fr: "Il n'y a pas encore de conversation à expliquer.",
    ru: 'Пока нет разговора, который можно объяснить.',
    zh: '还没有可供解释的对话。',
    ja: '説明できる会話がまだありません。',
    pt: 'Ainda não há conversa para explicar.',
    de: 'Es gibt noch keine Unterhaltung zum Erklären.',
    ko: '설명할 대화가 아직 없습니다.',
  },
  noAnswer: {
    en: 'No answer was received from the model ({reason}).',
    he: 'לא התקבלה תשובה מהמודל ({reason}).',
    es: 'No se recibió respuesta del modelo ({reason}).',
    fr: "Aucune réponse n'a été reçue du modèle ({reason}).",
    ru: 'Ответ от модели не получен ({reason}).',
    zh: '未收到模型的回答（{reason}）。',
    ja: 'モデルから応答がありませんでした（{reason}）。',
    pt: 'Nenhuma resposta foi recebida do modelo ({reason}).',
    de: 'Vom Modell wurde keine Antwort empfangen ({reason}).',
    ko: '모델에서 응답을 받지 못했습니다({reason}).',
  },
  failed: {
    en: 'The explanation failed; try again.',
    he: 'ההסבר נכשל; נסה שוב.',
    es: 'La explicación falló; inténtalo de nuevo.',
    fr: "L’explication a échoué ; réessaie.",
    ru: 'Не удалось получить объяснение; попробуйте ещё раз.',
    zh: '解释失败，请重试。',
    ja: '説明に失敗しました。もう一度お試しください。',
    pt: 'A explicação falhou; tente novamente.',
    de: 'Die Erklärung ist fehlgeschlagen; versuche es erneut.',
    ko: '설명에 실패했습니다. 다시 시도하세요.',
  },
} as const

const buildPrompt = (): string =>
  `Look at the most recent error or failing output in this conversation. Explain in ${t(T.promptLang)}, briefly: what went wrong, the likely root cause, and the concrete next fix. If there is no error, say so.`

export const feature: Feature = {
  id: 'explain-error',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'explain', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'explain', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export function register(on: On) {
    on('command.run', { command: 'explain' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(T.off) }

      try {
        const r = await $.model.fork({ prompt: buildPrompt() })
        if (!r.isAnswered) {
          return {
            text: r.reason === 'nothing-to-fork' ? t(T.nothingToFork) : t(T.noAnswer, { reason: r.reason }),
          }
        }
        return { text: r.text }
      } catch {
        return { text: t(T.failed) }
      }
    })
}
