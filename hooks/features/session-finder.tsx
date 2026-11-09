import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, language, notice, storeSet, t, LANG_ENGLISH_NAMES } from '../core'
import type { Feature, Input } from '../core'
import { ICONS, emptyState, listRow, paneHeader } from '../ui'

const T = {
  title: {
    en: 'Session finder',
    he: 'חיפוש שיחות',
    es: 'Buscador de sesiones',
    fr: 'Recherche de sessions',
    ru: 'Поиск сессий',
    zh: '会话查找',
    ja: 'セッション検索',
    pt: 'Localizador de sessões',
    de: 'Sitzungssuche',
    ko: '세션 찾기',
  },
  description: {
    en: 'Titles each session with a cheap model and keeps an index; /find <term> searches it, /sessions lists the latest. Sends the first prompts to Haiku (your account) to title the session.',
    he: 'נותן כותרת לכל שיחה באמצעות מודל זול ושומר אינדקס; /find <מונח> מחפש בו, /sessions מציג את האחרונות. שולח את ההנחיות הראשונות ל-Haiku (דרך החשבון שלך) כדי לתת כותרת לשיחה.',
    es: 'Titula cada sesión con un modelo barato y guarda un índice; /find <término> lo busca, /sessions lista las últimas. Envía los primeros mensajes a Haiku (tu cuenta) para titular la sesión.',
    fr: 'Titre chaque session avec un modèle économique et garde un index ; /find <terme> le parcourt, /sessions liste les dernières. Envoie les premiers prompts à Haiku (votre compte) pour titrer la session.',
    ru: 'Даёт каждой сессии название с помощью недорогой модели и ведёт индекс; /find <слово> ищет в нём, /sessions показывает последние. Отправляет первые запросы в Haiku (ваш аккаунт), чтобы назвать сессию.',
    zh: '用低成本模型为每个会话起标题并保留索引；/find <词语> 搜索，/sessions 列出最近的会话。 会将最初的提示发送给 Haiku（使用你的账户）以生成会话标题。',
    ja: '低コストのモデルで各セッションにタイトルを付けてインデックスを保持します。/find <語句> で検索、/sessions で最近のセッションを一覧表示。 最初のプロンプトを Haiku に送信して（あなたのアカウント）セッションのタイトルを付けます。',
    pt: 'Dá um título a cada sessão com um modelo barato e mantém um índice; /find <termo> busca nele, /sessions lista as últimas. Envia os primeiros prompts ao Haiku (sua conta) para dar título à sessão.',
    de: 'Vergibt mit einem günstigen Modell Titel für jede Sitzung und führt einen Index; /find <Begriff> durchsucht ihn, /sessions listet die neuesten auf. Sendet die ersten Prompts an Haiku (dein Konto), um die Sitzung zu betiteln.',
    ko: '저렴한 모델로 각 세션에 제목을 붙이고 색인을 유지합니다. /find <검색어>로 검색하고 /sessions로 최근 세션을 나열합니다. 처음 프롬프트를 Haiku(사용자 계정)로 전송해 세션 제목을 만듭니다.',
  },
  findDesc: {
    en: 'Finds past sessions by a word in the title or prompts',
    he: 'מוצא שיחות קודמות לפי מילה בכותרת או בבקשות',
    es: 'Busca sesiones pasadas por una palabra del título o de los mensajes',
    fr: 'Trouve des sessions passées par un mot du titre ou des demandes',
    ru: 'Ищет прошлые сессии по слову в названии или запросах',
    zh: '按标题或提示词中的某个词查找过去的会话',
    ja: 'タイトルまたはプロンプト内の語句から過去のセッションを探します',
    pt: 'Encontra sessões passadas por uma palavra no título ou nos prompts',
    de: 'Findet frühere Sitzungen anhand eines Worts im Titel oder in den Prompts',
    ko: '제목이나 프롬프트의 단어로 지난 세션을 찾습니다',
  },
  findHint: { en: '<term>', he: '<מונח>', es: '<término>', fr: '<terme>', ru: '<слово>', zh: '<词语>', ja: '<語句>', pt: '<termo>', de: '<Begriff>', ko: '<검색어>' },
  sessionsDesc: {
    en: 'Lists the latest sessions; press one to copy its id',
    he: 'מציג את השיחות האחרונות; לחיצה מעתיקה את המזהה',
    es: 'Lista las últimas sesiones; pulsa una para copiar su id',
    fr: "Liste les dernières sessions ; appuyez pour copier l'identifiant",
    ru: 'Список последних сессий; нажмите, чтобы скопировать id',
    zh: '列出最近的会话；点击某条可复制其 id',
    ja: '最近のセッションを一覧表示。クリックすると ID をコピーします',
    pt: 'Lista as últimas sessões; clique em uma para copiar o id',
    de: 'Listet die neuesten Sitzungen; klicke auf eine, um ihre ID zu kopieren',
    ko: '최근 세션을 나열합니다. 하나를 누르면 id가 복사됩니다',
  },
  off: {
    en: 'Session finder is turned off in the Toolkitty pane.',
    he: 'חיפוש השיחות כבוי בלוח ה-Toolkitty.',
    es: 'El buscador de sesiones está desactivado en el panel de Toolkitty.',
    fr: 'La recherche de sessions est désactivée dans le panneau Toolkitty.',
    ru: 'Поиск сессий отключён в панели Toolkitty.',
    zh: '会话查找已在 Toolkitty 面板中关闭。',
    ja: 'セッション検索は Toolkitty パネルでオフになっています。',
    pt: 'O localizador de sessões está desativado no painel do Toolkitty.',
    de: 'Die Sitzungssuche ist im Toolkitty-Panel ausgeschaltet.',
    ko: '세션 찾기는 Toolkitty 패널에서 꺼져 있습니다.',
  },
  usage: {
    en: 'Usage: /find <term>',
    he: 'שימוש: /find <מונח>',
    es: 'Uso: /find <término>',
    fr: 'Usage : /find <terme>',
    ru: 'Использование: /find <слово>',
    zh: '用法：/find <词语>',
    ja: '使い方：/find <語句>',
    pt: 'Uso: /find <termo>',
    de: 'Verwendung: /find <Begriff>',
    ko: '사용법: /find <검색어>',
  },
  noMatch: {
    en: 'No session matches "{term}".',
    he: 'אין שיחה שמתאימה ל-"{term}".',
    es: 'Ninguna sesión coincide con "{term}".',
    fr: 'Aucune session ne correspond à « {term} ».',
    ru: 'Нет сессий, подходящих под «{term}».',
    zh: '没有匹配“{term}”的会话。',
    ja: '「{term}」に一致するセッションはありません。',
    pt: 'Nenhuma sessão corresponde a "{term}".',
    de: 'Keine Sitzung passt zu „{term}“.',
    ko: '"{term}"과(와) 일치하는 세션이 없습니다.',
  },
  found: {
    en: 'Sessions matching "{term}":',
    he: 'שיחות שמתאימות ל-"{term}":',
    es: 'Sesiones que coinciden con "{term}":',
    fr: 'Sessions correspondant à « {term} » :',
    ru: 'Сессии по запросу «{term}»:',
    zh: '匹配“{term}”的会话：',
    ja: '「{term}」に一致するセッション：',
    pt: 'Sessões que correspondem a "{term}":',
    de: 'Sitzungen, die zu „{term}“ passen:',
    ko: '"{term}"과(와) 일치하는 세션:',
  },
  untitled: { en: '(untitled)', he: '(ללא כותרת)', es: '(sin título)', fr: '(sans titre)', ru: '(без названия)', zh: '（无标题）', ja: '（無題）', pt: '(sem título)', de: '(ohne Titel)', ko: '(제목 없음)' },
  opened: { en: 'Sessions pane opened.', he: 'לוח השיחות נפתח.', es: 'Panel de sesiones abierto.', fr: 'Panneau des sessions ouvert.', ru: 'Панель сессий открыта.', zh: '会话面板已打开。', ja: 'セッションパネルを開きました。', pt: 'Painel de sessões aberto.', de: 'Sitzungs-Panel geöffnet.', ko: '세션 패널을 열었습니다.' },
  paneTitle: { en: 'Sessions', he: 'שיחות', es: 'Sesiones', fr: 'Sessions', ru: 'Сессии', zh: '会话', ja: 'セッション', pt: 'Sessões', de: 'Sitzungen', ko: '세션' },
  paneOff: {
    en: 'Session finder is turned off.',
    he: 'חיפוש השיחות כבוי.',
    es: 'El buscador de sesiones está desactivado.',
    fr: 'La recherche de sessions est désactivée.',
    ru: 'Поиск сессий отключён.',
    zh: '会话查找已关闭。',
    ja: 'セッション検索はオフです。',
    pt: 'O localizador de sessões está desativado.',
    de: 'Die Sitzungssuche ist ausgeschaltet.',
    ko: '세션 찾기가 꺼져 있습니다.',
  },
  empty: {
    en: 'No sessions indexed yet.',
    he: 'עוד אין שיחות באינדקס.',
    es: 'Aún no hay sesiones indexadas.',
    fr: "Aucune session indexée pour l'instant.",
    ru: 'В индексе пока нет сессий.',
    zh: '尚无已建立索引的会话。',
    ja: 'インデックス済みのセッションはまだありません。',
    pt: 'Nenhuma sessão indexada ainda.',
    de: 'Noch keine Sitzungen indexiert.',
    ko: '아직 색인된 세션이 없습니다.',
  },
  today: { en: 'today', he: 'היום', es: 'hoy', fr: "aujourd'hui", ru: 'сегодня', zh: '今天', ja: '今日', pt: 'hoje', de: 'heute', ko: '오늘' },
  daysAgo: { en: '{n}d ago', he: 'לפני {n} ימים', es: 'hace {n} d', fr: 'il y a {n} j', ru: '{n} дн. назад', zh: '{n}天前', ja: '{n}日前', pt: 'há {n}d', de: 'vor {n} T.', ko: '{n}일 전' },
  hoursAgo: { en: '{n}h ago', he: 'לפני {n} שעות', es: 'hace {n} h', fr: 'il y a {n} h', ru: '{n} ч назад', zh: '{n}小时前', ja: '{n}時間前', pt: 'há {n}h', de: 'vor {n} Std.', ko: '{n}시간 전' },
  emptyHint: {
    en: 'Sessions are indexed once Claude has answered a few times; /find searches them.',
    he: 'שיחות נוספות לאינדקס אחרי כמה תשובות של Claude; ‎/find מחפש בהן.',
    es: 'Las sesiones se indexan tras unas respuestas de Claude; /find las busca.',
    fr: 'Les sessions sont indexées après quelques réponses de Claude ; /find les recherche.',
    ru: 'Сессии индексируются после нескольких ответов Claude; /find ищет по ним.',
    zh: 'Claude 回答几次后才会为会话建立索引；用 /find 搜索。',
    ja: 'Claude が何度か応答するとセッションがインデックスされます。/find で検索できます。',
    pt: 'As sessões são indexadas depois que o Claude responde algumas vezes; /find busca nelas.',
    de: 'Sitzungen werden indexiert, sobald Claude einige Male geantwortet hat; /find durchsucht sie.',
    ko: 'Claude가 몇 번 응답한 뒤에 세션이 색인됩니다. /find로 검색합니다.',
  },
  statusCount: { en: '{n} sessions', he: '{n} שיחות', es: '{n} sesiones', fr: '{n} sessions', ru: 'сессий: {n}', zh: '{n} 个会话', ja: 'セッション {n} 件', pt: '{n} sessões', de: '{n} Sitzungen', ko: '세션 {n}개' },
  pressHint: { en: 'Press a row to copy its id.', he: 'לחיצה על שורה מעתיקה את המזהה.', es: 'Pulsa una fila para copiar su id.', fr: "Appuyez sur une ligne pour copier son id.", ru: 'Нажмите строку, чтобы скопировать id.', zh: '点击某一行可复制其 id。', ja: '行をクリックすると ID をコピーします。', pt: 'Clique em uma linha para copiar o id.', de: 'Klicke auf eine Zeile, um ihre ID zu kopieren.', ko: '줄을 누르면 id가 복사됩니다.' },
  copied: {
    en: 'Id copied. Resume with: claude --resume {id}',
    he: 'המזהה הועתק. להמשך: claude --resume {id}',
    es: 'Id copiado. Para retomar: claude --resume {id}',
    fr: "Identifiant copié. Pour reprendre : claude --resume {id}",
    ru: 'Id скопирован. Чтобы продолжить: claude --resume {id}',
    zh: '已复制 id。用以下命令恢复：claude --resume {id}',
    ja: 'ID をコピーしました。再開するには：claude --resume {id}',
    pt: 'Id copiado. Retome com: claude --resume {id}',
    de: 'ID kopiert. Fortsetzen mit: claude --resume {id}',
    ko: 'id를 복사했습니다. 다음으로 재개하세요: claude --resume {id}',
  },
  notCopied: {
    en: 'Could not copy. Resume with: claude --resume {id}',
    he: 'ההעתקה נכשלה. להמשך: claude --resume {id}',
    es: 'No se pudo copiar. Para retomar: claude --resume {id}',
    fr: 'Copie impossible. Pour reprendre : claude --resume {id}',
    ru: 'Не удалось скопировать. Чтобы продолжить: claude --resume {id}',
    zh: '无法复制。用以下命令恢复：claude --resume {id}',
    ja: 'コピーできませんでした。再開するには：claude --resume {id}',
    pt: 'Não foi possível copiar. Retome com: claude --resume {id}',
    de: 'Kopieren nicht möglich. Fortsetzen mit: claude --resume {id}',
    ko: '복사할 수 없습니다. 다음으로 재개하세요: claude --resume {id}',
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

type Entry = { id: string; cwd: string; title: string; startedAt: number; updatedAt: number; prompts: string[] }
type State = { prompts: string[]; answered: number; startedAt: number }

const state = atom(
  { plugin: 'toolkitty', key: 'slot', id: 'session-finder' } as const,
  { prompts: [], answered: 0, startedAt: 0 } as State,
) as unknown as Atom<State>

const INDEX_KEY = 'session-finder:index'
const MAX_INDEX = 300
const MAX_PROMPTS = 5
const MAX_PROMPT_CHARS = 300
const MAX_ANSWER = 3000
const LIST_SIZE = 30
const TITLE_AT = [1, 6]


export const feature: Feature = {
  id: 'session-finder',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const folderName = (cwd: string): string => {
  const parts = cwd.split(/[\\/]/).filter(p => p !== '')
  return parts[parts.length - 1] ?? cwd
}

const isEntry = (x: unknown): x is Entry => {
  if (x === null || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return typeof r['id'] === 'string' && typeof r['title'] === 'string' && Array.isArray(r['prompts'])
}

async function loadIndex($: EngineInterface): Promise<Entry[]> {
  const raw: unknown = await $.store.get(INDEX_KEY)
  return Array.isArray(raw) ? raw.filter(isEntry) : []
}

const dateText = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

function relative(ms: number, now: number): string {
  const diff = Math.max(0, now - ms)
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return t(T.today)
  if (hours < 24) return t(T.hoursAgo, { n: hours })
  return t(T.daysAgo, { n: Math.floor(hours / 24) })
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'find', description: t(T.findDesc), argumentHint: t(T.findHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'find', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  try {
    await $.command.register({ name: 'sessions', description: t(T.sessionsDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'sessions', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  const now = await $.clock.now()
  await update($, state, () => ({ prompts: [], answered: 0, startedAt: now }))
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'>> {
  if (!(await isOn($, feature))) return e
  const text = e.text.trim()
  if (text === '' || text.startsWith('/')) return e
  await update($, state, s =>
    s.prompts.length >= MAX_PROMPTS ? s : { ...s, prompts: [...s.prompts, text.slice(0, MAX_PROMPT_CHARS)] },
  )
  return e
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  if (e.reason !== 'answer' || e.answer.trim() === '') return

  const before = await read($, state)
  const answered = before.answered + 1
  await update($, state, s => ({ ...s, answered }))
  if (!TITLE_AT.includes(answered)) return

  const first = before.prompts.slice(0, 3).map((p, i) => `${i + 1}. ${p}`).join('\n')
  const prompt =
    'Write a title for this coding-assistant session in at most 8 words, in ' + LANG_ENGLISH_NAMES[language()] + '. ' +
    'Reply with ONLY the title: no quotes, no trailing period, no explanation.\n\n' +
    "The user's first requests:\n" + (first === '' ? '(unknown)' : first) + '\n\n' +
    'The assistant answer:\n' + e.answer.slice(0, MAX_ANSWER)

  let title = ''
  try {
    const r = await $.model.complete({ model: 'claude-haiku-5-5', prompt })
    if (r.isAnswered) title = (r.text.split('\n')[0] ?? '').trim().replace(/^["'“”«»]+|["'“”«»]+$/g, '').trim().slice(0, 100)
  } catch {
    return
  }
  if (title === '') return

  try {
    const id = await $.session.id()
    const cwd = await $.session.cwd()
    const now = await $.clock.now()
    const index = await loadIndex($)
    const existing = index.find(x => x.id === id)
    const entry: Entry = {
      id,
      cwd,
      title,
      startedAt: existing?.startedAt ?? (before.startedAt > 0 ? before.startedAt : now),
      updatedAt: now,
      prompts: before.prompts.length > 0 ? before.prompts : (existing?.prompts ?? []),
    }
    const updated = [entry, ...index.filter(x => x.id !== id)].slice(0, MAX_INDEX)
    await storeSet($, INDEX_KEY, updated)
    // the /sessions pane reads the store, not a state slot: redraw it when the index changed
    $.ui.invalidate('ui.render')
  } catch {
    // an index write that fails is not worth interrupting the turn
  }
}

export function register(on: On) {
  on('command.run', { command: 'find' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const term = e.args.trim()
    if (term === '') return { text: t(T.usage) }

    const needle = term.toLowerCase()
    const index = await loadIndex($)
    const lines: string[] = []
    for (const entry of index) {
      const snippet = entry.prompts.find(p => p.toLowerCase().includes(needle))
      const inTitle = entry.title.toLowerCase().includes(needle)
      if (!inTitle && snippet === undefined) continue
      const head = `${entry.title === '' ? t(T.untitled) : entry.title} · ${entry.cwd} · ${dateText(entry.updatedAt)} · ${entry.id}`
      lines.push(snippet === undefined ? head : `${head}\n    "${snippet.replace(/\s+/g, ' ').slice(0, 120)}"`)
      if (lines.length >= 15) break
    }
    if (lines.length === 0) return { text: t(T.noMatch, { term }) }
    return { text: t(T.found, { term }) + '\n' + lines.join('\n') }
  })

  on('command.run', { command: 'sessions' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: 'session-finder', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'session-finder' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const index = (await loadIndex($)).slice(0, LIST_SIZE)
    if (index.length === 0) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.workflow })}
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
        </Box>
      )
    }
    const now = await $.clock.now()

    const copyId = async (id: string) => {
      const r = await $.ui.copy({ text: id, surface: e.surface })
      await notice($, r.isCopied ? 'info' : 'warn', t(r.isCopied ? T.copied : T.notCopied, { id }), feature.id)
    }

    const room = Math.max(3, (e.viewport?.rows ?? 25) - 5)
    return (
      <Box flexDirection="column">
        {paneHeader($, e, { title: t(T.paneTitle), status: t(T.statusCount, { n: index.length }), level: 'info', icon: ICONS.workflow })}
        <Text dimColor size="footnote">
          {t(T.pressHint)}
        </Text>
        {index.slice(0, room).map(entry =>
          listRow($, e, {
            key: `session-${entry.id}`,
            text: `${entry.title === '' ? t(T.untitled) : entry.title} · ${folderName(entry.cwd)} · ${relative(entry.updatedAt, now)}`,
            onPress: () => copyId(entry.id),
          }),
        )}
      </Box>
    )
  })
}
