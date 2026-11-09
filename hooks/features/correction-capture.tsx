import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, language, notice, storeGet, storeSet, t, LANG_ENGLISH_NAMES } from '../core'
import type { Feature, Input, Output } from '../core'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'


const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Correction capture', he: 'לכידת תיקונים', es: 'Captura de correcciones', fr: 'Capture des corrections', ru: 'Запоминание поправок', zh: '纠正记录', ja: '訂正キャプチャ', pt: 'Captura de correções', de: 'Korrektur-Erfassung', ko: '수정 학습' },
  description: {
    en: 'Learns from your corrections: turns "no, not like that" into a lasting rule for this project and gives it to the model every turn. /rules manages them. Sends the correction text to Haiku (your account).',
    he: 'לומד מהתיקונים שלך: הופך "לא, לא ככה" לכלל קבוע לפרויקט הזה ומעביר אותו למודל בכל תור. /rules מנהל אותם. שולח את טקסט התיקון ל-Haiku (דרך החשבון שלך).',
    es: 'Aprende de tus correcciones: convierte "no, así no" en una regla duradera para este proyecto y se la da al modelo en cada turno. /rules las gestiona. Envía el texto de la corrección a Haiku (tu cuenta).',
    fr: 'Apprend de tes corrections : transforme « non, pas comme ça » en règle durable pour ce projet et la donne au modèle à chaque tour. /rules les gère. Envoie le texte de la correction à Haiku (ton compte).',
    ru: 'Учится на ваших поправках: превращает «нет, не так» в постоянное правило проекта и передаёт его модели в каждом ходу. /rules управляет правилами. Отправляет текст поправки в Haiku (ваш аккаунт).',
    zh: '从你的纠正中学习：把“不，不是这样”变成本项目的长期规则，并在每一轮交给模型。/rules 用于管理这些规则。会将纠正文本发送给 Haiku（使用你的账户）。',
    ja: 'あなたの訂正から学習します：「いや、そうじゃない」をこのプロジェクトの恒久ルールにして、毎ターンモデルに渡します。/rules で管理できます。訂正のテキストを Haiku に送信します（あなたのアカウント）。',
    pt: 'Aprende com suas correções: transforma "não, assim não" em uma regra duradoura para este projeto e a entrega ao modelo a cada turno. /rules gerencia as regras. Envia o texto da correção ao Haiku (sua conta).',
    de: 'Lernt aus deinen Korrekturen: macht aus „nein, nicht so“ eine dauerhafte Regel für dieses Projekt und gibt sie dem Modell in jedem Durchgang mit. /rules verwaltet sie. Sendet den Korrekturtext an Haiku (dein Konto).',
    ko: '사용자의 수정에서 배웁니다. "아니, 그렇게 말고"를 이 프로젝트의 지속적인 규칙으로 만들어 매 턴 모델에 전달합니다. /rules로 관리합니다. 수정 텍스트를 Haiku로 전송합니다(사용자 계정).',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  commandDesc: { en: 'Opens a pane with the rules learned from your corrections', he: 'פותח חלונית עם הכללים שנלמדו מהתיקונים שלך', es: 'Abre un panel con las reglas aprendidas de tus correcciones', fr: 'Ouvre un panneau avec les règles apprises de tes corrections', ru: 'Открывает панель с правилами, выученными из ваших поправок', zh: '打开显示从你的纠正中学到的规则的面板', ja: '訂正から学んだルールを表示するペインを開きます', pt: 'Abre um painel com as regras aprendidas com suas correções', de: 'Öffnet ein Panel mit den aus deinen Korrekturen gelernten Regeln', ko: '수정에서 배운 규칙을 보여 주는 창을 엽니다' },
  opened: { en: 'Opened the rules pane.', he: 'חלונית הכללים נפתחה.', es: 'Panel de reglas abierto.', fr: 'Panneau des règles ouvert.', ru: 'Панель правил открыта.', zh: '已打开规则面板。', ja: 'ルールペインを開きました。', pt: 'Painel de regras aberto.', de: 'Regel-Panel geöffnet.', ko: '규칙 창을 열었습니다.' },
  paneTitle: { en: 'Learned rules', he: 'כללים שנלמדו', es: 'Reglas aprendidas', fr: 'Règles apprises', ru: 'Выученные правила', zh: '已学到的规则', ja: '学習したルール', pt: 'Regras aprendidas', de: 'Gelernte Regeln', ko: '학습된 규칙' },
  paneOff: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  empty: { en: 'No rules yet. When you correct me, a lasting rule appears here.', he: 'עדיין אין כללים. כשתתקן אותי, כלל קבוע יופיע כאן.', es: 'Aún no hay reglas. Cuando me corrijas, aparecerá aquí una regla duradera.', fr: 'Aucune règle pour l’instant. Quand tu me corriges, une règle durable apparaît ici.', ru: 'Правил пока нет. Когда вы меня поправите, здесь появится постоянное правило.', zh: '还没有规则。当你纠正我时，这里会出现一条长期规则。', ja: 'まだルールはありません。あなたが訂正すると、ここに恒久ルールが表示されます。', pt: 'Ainda não há regras. Quando você me corrigir, uma regra duradoura aparecerá aqui.', de: 'Noch keine Regeln. Wenn du mich korrigierst, erscheint hier eine dauerhafte Regel.', ko: '아직 규칙이 없습니다. 저를 바로잡아 주시면 여기에 지속 규칙이 생깁니다.' },
  emptyHint: {
    en: 'Correct me once ("no, always use X") and the rule is learned here; /rules shows them.',
    he: 'תקן אותי פעם אחת ("לא, תמיד השתמש ב-X") והכלל יילמד כאן; /rules מציג אותם.',
    es: 'Corrígeme una vez («no, usa siempre X») y la regla se aprende aquí; /rules las muestra.',
    fr: 'Corrige-moi une fois (« non, utilise toujours X ») et la règle est apprise ici ; /rules les affiche.',
    ru: 'Поправьте меня один раз («нет, всегда используй X») — правило появится здесь; /rules их показывает.',
    zh: '纠正我一次（“不，总是用 X”），规则就会在这里学到；/rules 可查看。',
    ja: '一度訂正してください（「いや、いつも X を使って」）。ルールがここに学習されます。/rules で確認できます。',
    pt: 'Corrija-me uma vez ("não, use sempre X") e a regra é aprendida aqui; /rules mostra as regras.',
    de: 'Korrigiere mich einmal („nein, nimm immer X“), und die Regel wird hier gelernt; /rules zeigt sie an.',
    ko: '한 번만 바로잡아 주세요("아니, 항상 X를 써"). 그러면 규칙이 여기에 학습되고 /rules로 볼 수 있습니다.',
  },
  header: { en: 'Rules for this project ({n}). Press a rule to delete it.', he: 'כללים לפרויקט הזה ({n}). לחץ על כלל כדי למחוק אותו.', es: 'Reglas de este proyecto ({n}). Pulsa una regla para borrarla.', fr: 'Règles de ce projet ({n}). Appuie sur une règle pour la supprimer.', ru: 'Правила проекта ({n}). Нажмите на правило, чтобы удалить его.', zh: '本项目的规则（{n} 条）。点击规则可删除。', ja: 'このプロジェクトのルール（{n} 件）。ルールを押すと削除します。', pt: 'Regras deste projeto ({n}). Pressione uma regra para excluí-la.', de: 'Regeln für dieses Projekt ({n}). Drücke auf eine Regel, um sie zu löschen.', ko: '이 프로젝트의 규칙({n}개). 규칙을 누르면 삭제됩니다.' },
  clearAll: { en: 'clear all', he: 'נקה הכול', es: 'borrar todo', fr: 'tout effacer', ru: 'очистить всё', zh: '全部清除', ja: 'すべて消去', pt: 'limpar tudo', de: 'alle löschen', ko: '모두 지우기' },
  learned: { en: 'Rule learned: {rule}', he: 'כלל נלמד: {rule}', es: 'Regla aprendida: {rule}', fr: 'Règle apprise : {rule}', ru: 'Правило выучено: {rule}', zh: '已学到规则：{rule}', ja: 'ルールを学習しました：{rule}', pt: 'Regra aprendida: {rule}', de: 'Regel gelernt: {rule}', ko: '규칙 학습됨: {rule}' },
} as const

type State = { cwd: string; rules: string[]; pending: string[] }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'correction-capture' } as const, { cwd: '', rules: [], pending: [] } as State) as unknown as Atom<State>

const SECTION_ID = 'toolkitty:correction-capture'
const MAX_RULES = 30
const MAX_WORDS = 20
const MAX_PENDING = 5
const MAX_PROMPT_CHARS = 800

const CORRECTION: readonly RegExp[] = [
  // English
  /^\s*(no|nope|don't|do not|stop|never|not what i|wrong|that's not|that is not)(?![a-z])/i,
  /\binstead\b|\bi said\b/i,
  // Hebrew
  /^\s*(לא|אל ת|תפסיק|לא ביקשתי|זה לא מה)/,
  /במקום|אמרתי/,
  // Spanish
  /^\s*(no(?![a-záéíóúñ])|nunca|deja de|para de|eso no|esto no|incorrecto|mal\b)/i,
  /\ben vez de\b|\ben lugar de\b|\bte dije\b|\bya dije\b/i,
  // French
  /^\s*(non(?![a-zéèêàç])|arrête|arrete|jamais|ce n'est pas|c'est pas|pas comme ça|ne fais pas|ne fais plus|faux)/i,
  /\bau lieu de\b|\bje t'ai dit\b|\bj'ai dit\b/i,
  // Russian
  /^\s*(нет(?![а-яё])|не надо|не нужно|не делай|перестань|хватит|никогда|это не то|неправильно|не так)/i,
  /вместо|я сказал|я же сказал|я говорил/i,
]

const isCorrection = (text: string): boolean => CORRECTION.some(re => re.test(text))

const rulesKey = (cwd: string) => `correction-capture:rules:${cwd}`

export const feature: Feature = {
  id: 'correction-capture',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

/** Loads this project's rules from the store into the atom. */
async function loadRules($: EngineInterface): Promise<void> {
  const cwd = await $.session.cwd()
  const stored = await storeGet<string[]>($, rulesKey(cwd), [])
  const rules = Array.isArray(stored) ? stored.filter(r => typeof r === 'string') : []
  const prev = await read($, state)
  await update($, state, s => ({ ...s, cwd, rules }))
  if (JSON.stringify(prev.rules) !== JSON.stringify(rules)) $.ui.invalidate('prompt.section')
}

/** Keeps the rules in the store and the atom, and tells the prompt to recompose. */
async function saveRules($: EngineInterface, cwd: string, rules: string[]): Promise<void> {
  await storeSet($, rulesKey(cwd), rules)
  await update($, state, s => ({ ...s, cwd, rules }))
  $.ui.invalidate('prompt.section')
}

/** A model reply cleaned into one rule of at most MAX_WORDS words, or undefined for NONE or junk. */
const cleanRule = (reply: string): string | undefined => {
  const first = reply.split('\n').map(l => l.trim()).find(l => l !== '') ?? ''
  const bare = first.replace(/^(rule\s*:\s*|[-*•]\s*|\d+[.)]\s*)/i, '').replace(/^["'`]+|["'`]+$/g, '').trim()
  if (bare === '' || /^none\b/i.test(bare)) return undefined
  const words = bare.split(/\s+/)
  const rule = words.slice(0, MAX_WORDS).join(' ')
  return rule.length < 3 ? undefined : rule
}

const sameRule = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'rules', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'rules', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (await isOn($, feature)) await loadRules($)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await loadRules($)
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'>> {
  if (!(await isOn($, feature))) return e
  if (e.command !== undefined || e.isMeta === true) return e

  const text = e.text.trim()
  if (text === '' || text.startsWith('/') || !isCorrection(text)) return e

  await update($, state, s => ({ ...s, pending: [...s.pending, text.slice(0, MAX_PROMPT_CHARS)].slice(-MAX_PENDING) }))
  return e
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const { pending } = await read($, state)
  if (pending.length === 0) return
  await update($, state, s => ({ ...s, pending: [] }))

  for (const text of pending) {
    const prompt = [
      'A user of a coding assistant sent the message below, which looks like a correction of what the assistant did.',
      'Distill it into ONE durable rule the assistant should follow in this project from now on.',
      `Write the rule in ${LANG_ENGLISH_NAMES[language()]}, imperative, at most ${MAX_WORDS} words, with no quotes or preamble.`,
      'If the message is only a one-off about the current task and not a lasting preference or convention, answer exactly NONE.',
      '',
      'Message:',
      text,
    ].join('\n')

    let reply: string | undefined
    try {
      const out = await $.model.complete({ model: 'claude-haiku-5-5', prompt })
      reply = out.isAnswered ? out.text : undefined
    } catch {
      reply = undefined
    }
    if (reply === undefined) continue

    const rule = cleanRule(reply)
    if (rule === undefined) continue

    const cwd = await $.session.cwd()
    const stored = await storeGet<string[]>($, rulesKey(cwd), [])
    const current = Array.isArray(stored) ? stored : []
    if (current.some(r => sameRule(r, rule))) continue

    await saveRules($, cwd, [...current, rule].slice(-MAX_RULES))
    await notice($, 'info', t(T.learned, { rule }), feature.id)
  }
}

export async function onPromptCompose(
  $: EngineInterface,
  _e: Input<'prompt.compose'>,
  result: Output<'prompt.compose'>,
): Promise<Output<'prompt.compose'>> {
  if (!(await isOn($, feature))) return result

  const { rules } = await read($, state)
  if (rules.length === 0) return result

  const text = ["# Rules learned from the user's corrections", ...rules.map(r => `- ${r}`)].join('\n')
  return {
    ...result,
    sections: [...result.sections.filter(s => s.id !== SECTION_ID), { id: SECTION_ID, text, scope: 'session' as const }],
  }
}

export function register(on: On) {
  on('command.run', { command: 'rules' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await loadRules($)
    await $.ui.open({ id: 'correction-rules', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'correction-rules' }, async ($, e) => {
    const { Box } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.hygiene })}
          {emptyState($, e, t(T.paneOff))}
        </Box>
      )
    }

    const { cwd, rules } = await read($, state)
    if (rules.length === 0) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.hygiene })}
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
        </Box>
      )
    }

    const remove = async (index: number) => {
      const current = (await read($, state)).rules
      await saveRules($, cwd, current.filter((_r, i) => i !== index))
    }

    const clearAll = async () => {
      await saveRules($, cwd, [])
    }

    const room = Math.max(3, (e.viewport?.rows ?? 25) - 6)

    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: String(rules.length),
          level: 'info',
          icon: ICONS.hygiene,
          actions: [{ key: 'rules-clear-all', label: t(T.clearAll), onPress: () => clearAll() }],
        })}
        {sectionTitle($, e, t(T.header, { n: rules.length }))}
        {rules.slice(0, room).map((rule, i) => listRow($, e, { key: `rule-${i}`, left: '✕', text: rule, onPress: () => remove(i) }))}
      </Box>
    )
  })
}
