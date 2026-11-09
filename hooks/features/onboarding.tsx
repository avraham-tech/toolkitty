import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { LANGS, LANG_NAMES, isOn, notice, pick, setLanguage, setNoticePrefs, storeSet, t } from '../core'
import type { Feature, Input, Lang } from '../core'
import { ICONS, listRow, paneHeader } from '../ui'
import type { HeaderAction } from '../ui'
import { PROFILE_DESCS, PROFILE_NAMES, PROFILE_TITLES, buildProfileMap } from './profiles'
import type { ProfileName, ProfileState } from './profiles'
// The catalogue is injected by register.tsx (an import of './index' would be circular).
let features: Feature[] = []

/** Called once by register.tsx before any hook runs. */
export function setCatalog(list: Feature[]): void {
  features = list
}

const T = {
  title: { en: 'Welcome wizard', he: 'אשף הפתיחה', es: 'Asistente de bienvenida', fr: 'Assistant de bienvenue', ru: 'Мастер приветствия', zh: '欢迎向导', ja: 'ウェルカムウィザード', pt: 'Assistente de boas-vindas', de: 'Willkommensassistent', ko: '시작 마법사' },
  description: {
    en: 'A short first-run wizard: pick a language and a profile, then meet your companion. /welcome reopens it',
    he: 'אשף קצר בהרצה הראשונה: בחירת שפה ופרופיל, ואז היכרות עם החבר שלך. /welcome פותח אותו מחדש',
    es: 'Un asistente breve para la primera vez: elige idioma y perfil, y conoce a tu compañero. /welcome lo reabre',
    fr: 'Un court assistant de premier lancement : langue et profil, puis rencontre avec ton compagnon. /welcome le rouvre',
    ru: 'Короткий мастер первого запуска: язык и профиль, затем знакомство с питомцем. /welcome открывает его снова',
    zh: '简短的首次运行向导：选择语言和配置，然后认识你的伙伴。/welcome 可重新打开',
    ja: '初回起動用の短いウィザード：言語とプロファイルを選び、相棒に会います。/welcome で再度開けます',
    pt: 'Um assistente curto de primeira execução: escolha um idioma e um perfil e conheça seu companheiro. /welcome o reabre',
    de: 'Ein kurzer Assistent für den ersten Start: Sprache und Profil wählen, dann den Begleiter kennenlernen. /welcome öffnet ihn erneut',
    ko: '짧은 첫 실행 마법사: 언어와 프로필을 고른 뒤 버디를 만납니다. /welcome으로 다시 열 수 있습니다',
  },
  cmdDesc: { en: 'Reopens the Toolkitty welcome wizard', he: 'פותח מחדש את אשף הפתיחה של Toolkitty', es: 'Reabre el asistente de bienvenida de Toolkitty', fr: 'Rouvre l’assistant de bienvenue de Toolkitty', ru: 'Снова открывает мастер приветствия Toolkitty', zh: '重新打开 Toolkitty 欢迎向导', ja: 'Toolkitty のウェルカムウィザードを再度開きます', pt: 'Reabre o assistente de boas-vindas do Toolkitty', de: 'Öffnet den Toolkitty-Willkommensassistenten erneut', ko: 'Toolkitty 시작 마법사를 다시 엽니다' },
  off: { en: 'The welcome wizard is turned off in the switchboard.', he: 'אשף הפתיחה כבוי בלוח המתגים.', es: 'El asistente de bienvenida está desactivado en el panel.', fr: 'L’assistant de bienvenue est désactivé dans le panneau des interrupteurs.', ru: 'Мастер приветствия выключен в панели.', zh: '欢迎向导已在开关面板中关闭。', ja: 'ウェルカムウィザードはスイッチパネルでオフになっています。', pt: 'O assistente de boas-vindas está desativado no painel de controle.', de: 'Der Willkommensassistent ist in der Schaltzentrale aus.', ko: '시작 마법사는 스위치 패널에서 꺼져 있습니다.' },
  opened: { en: 'Welcome wizard opened.', he: 'אשף הפתיחה נפתח.', es: 'Asistente de bienvenida abierto.', fr: 'Assistant de bienvenue ouvert.', ru: 'Мастер приветствия открыт.', zh: '欢迎向导已打开。', ja: 'ウェルカムウィザードを開きました。', pt: 'Assistente de boas-vindas aberto.', de: 'Willkommensassistent geöffnet.', ko: '시작 마법사를 열었습니다.' },
  paneTitle: { en: 'Toolkitty', he: 'Toolkitty', es: 'Toolkitty', fr: 'Toolkitty', ru: 'Toolkitty', zh: 'Toolkitty', ja: 'Toolkitty', pt: 'Toolkitty', de: 'Toolkitty', ko: 'Toolkitty' },
  stepOf: { en: 'Step {n} of 3', he: 'שלב {n} מתוך 3', es: 'Paso {n} de 3', fr: 'Étape {n} sur 3', ru: 'Шаг {n} из 3', zh: '第 {n} 步，共 3 步', ja: 'ステップ {n}/3', pt: 'Etapa {n} de 3', de: 'Schritt {n} von 3', ko: '{n}/3단계' },
  skip: { en: 'skip', he: 'דלג', es: 'omitir', fr: 'passer', ru: 'пропустить', zh: '跳过', ja: 'スキップ', pt: 'pular', de: 'überspringen', ko: '건너뛰기' },
  // step 1 is shown in every language at once, since the language is not known yet
  chooseLang: {
    en: 'Choose your language',
    he: 'בחר את השפה שלך',
    es: 'Elige tu idioma',
    fr: 'Choisis ta langue',
    ru: 'Выберите язык',
    zh: '选择语言',
    ja: '言語を選択',
    pt: 'Escolha seu idioma',
    de: 'Sprache wählen',
    ko: '언어 선택',
  },
  profileHeader: { en: 'Pick a profile', he: 'בחר פרופיל', es: 'Elige un perfil', fr: 'Choisis un profil', ru: 'Выберите профиль', zh: '选择配置', ja: 'プロファイルを選択', pt: 'Escolha um perfil', de: 'Profil wählen', ko: '프로필 선택' },
  profileHint: {
    en: 'You can change any single feature later in the switchboard (/toolkitty).',
    he: 'אפשר לשנות כל שכלול בנפרד אחר כך בלוח המתגים (/toolkitty).',
    es: 'Podrás cambiar cualquier función después en el panel (/toolkitty).',
    fr: 'Tu pourras modifier chaque fonction plus tard dans le panneau des interrupteurs (/toolkitty).',
    ru: 'Любую функцию можно потом изменить в панели (/toolkitty).',
    zh: '之后可以在开关面板（/toolkitty）中单独更改任何功能。',
    ja: '各機能は後でスイッチパネル（/toolkitty）から個別に変更できます。',
    pt: 'Você pode alterar qualquer recurso depois, no painel de controle (/toolkitty).',
    de: 'Jede einzelne Funktion lässt sich später in der Schaltzentrale (/toolkitty) ändern.',
    ko: '각 기능은 나중에 스위치 패널(/toolkitty)에서 개별적으로 바꿀 수 있습니다.',
  },
  revealHeader: { en: 'Meet your companion', he: 'הכר את החבר שלך', es: 'Conoce a tu compañero', fr: 'Rencontre ton compagnon', ru: 'Познакомьтесь с питомцем', zh: '认识你的伙伴', ja: '相棒に会おう', pt: 'Conheça seu companheiro', de: 'Lerne deinen Begleiter kennen', ko: '버디 만나기' },
  reveal: { en: 'Your companion is a {rarity} {species}!', he: 'החבר שלך הוא {species} ({rarity})!', es: '¡Tu compañero es un {species} {rarity}!', fr: 'Ton compagnon : {species} ({rarity}) !', ru: 'Ваш питомец: {species} ({rarity})!', zh: '你的伙伴是{rarity}的{species}！', ja: 'あなたの相棒は{rarity}の{species}です！', pt: 'Seu companheiro é {species} ({rarity})!', de: 'Dein Begleiter: {species} ({rarity})!', ko: '내 버디는 {rarity} {species}입니다!' },
  revealName: { en: 'Name: {name}', he: 'שם: {name}', es: 'Nombre: {name}', fr: 'Nom : {name}', ru: 'Имя: {name}', zh: '名字：{name}', ja: '名前：{name}', pt: 'Nome: {name}', de: 'Name: {name}', ko: '이름: {name}' },
  shiny: { en: '✦ shiny', he: '✦ נוצץ', es: '✦ brillante', fr: '✦ chromatique', ru: '✦ шайни', zh: '✦ 闪光', ja: '✦ 色違い', pt: '✦ brilhante', de: '✦ schillernd', ko: '✦ 반짝' },
  revealNone: {
    en: 'Your companion is still waking up: type /buddy to meet it.',
    he: 'החבר שלך עוד מתעורר: הקלד /buddy כדי להכיר אותו.',
    es: 'Tu compañero aún se está despertando: escribe /buddy para conocerlo.',
    fr: 'Ton compagnon se réveille encore : tape /buddy pour le rencontrer.',
    ru: 'Питомец ещё просыпается: введите /buddy, чтобы познакомиться.',
    zh: '你的伙伴还在苏醒：输入 /buddy 来认识它。',
    ja: '相棒はまだ目覚めていません。/buddy で会いに行きましょう。',
    pt: 'Seu companheiro ainda está acordando: digite /buddy para conhecê-lo.',
    de: 'Dein Begleiter wacht noch auf: Tippe /buddy, um ihn kennenzulernen.',
    ko: '버디가 아직 깨어나는 중입니다. /buddy를 입력해 만나 보세요.',
  },
  revealOff: {
    en: 'The companion is off in this profile: turn on "Buddy" in the switchboard to meet it.',
    he: 'החבר כבוי בפרופיל הזה: הפעל את "חבר" בלוח המתגים כדי להכיר אותו.',
    es: 'El compañero está desactivado en este perfil: activa "Compañero" en el panel para conocerlo.',
    fr: 'Le compagnon est désactivé dans ce profil : active « Compagnon » dans le panneau des interrupteurs pour le rencontrer.',
    ru: 'В этом профиле питомец выключен: включите «Питомец» в панели, чтобы познакомиться.',
    zh: '此配置中伙伴已关闭：请在开关面板中开启“伙伴”来认识它。',
    ja: 'このプロファイルでは相棒がオフです。スイッチパネルで「バディ」をオンにして会いましょう。',
    pt: 'O companheiro está desativado neste perfil: ative "Parceiro" no painel de controle para conhecê-lo.',
    de: 'Der Begleiter ist in diesem Profil aus: Schalte „Buddy“ in der Schaltzentrale ein, um ihn kennenzulernen.',
    ko: '이 프로필에서는 버디가 꺼져 있습니다. 스위치 패널에서 "버디"를 켜서 만나 보세요.',
  },
  openBoard: { en: 'Open the switchboard', he: 'פתח את לוח המתגים', es: 'Abrir el panel', fr: 'Ouvrir les interrupteurs', ru: 'Открыть панель', zh: '打开开关面板', ja: 'スイッチパネルを開く', pt: 'Abrir o painel de controle', de: 'Schaltzentrale öffnen', ko: '스위치 패널 열기' },
  done: { en: 'Done', he: 'סיום', es: 'Listo', fr: 'Terminer', ru: 'Готово', zh: '完成', ja: '完了', pt: 'Concluir', de: 'Fertig', ko: '완료' },
  ready: {
    en: 'Toolkitty is ready · /toolkitty opens the switchboard, /toolkitty help <question> answers questions',
    he: 'Toolkitty מוכן · /toolkitty פותח את לוח המתגים, /toolkitty help <שאלה> עונה על שאלות',
    es: 'Toolkitty está listo · /toolkitty abre el panel, /toolkitty help <pregunta> responde dudas',
    fr: 'Toolkitty est prêt · /toolkitty ouvre le panneau des interrupteurs, /toolkitty help <question> répond aux questions',
    ru: 'Toolkitty готов · /toolkitty открывает панель, /toolkitty help <вопрос> отвечает на вопросы',
    zh: 'Toolkitty 已就绪 · /toolkitty 打开开关面板，/toolkitty help <问题> 回答问题',
    ja: 'Toolkitty の準備ができました · /toolkitty でスイッチパネルを開き、/toolkitty help <質問> で質問に答えます',
    pt: 'O Toolkitty está pronto · /toolkitty abre o painel de controle, /toolkitty help <pergunta> responde dúvidas',
    de: 'Toolkitty ist bereit · /toolkitty öffnet die Schaltzentrale, /toolkitty help <Frage> beantwortet Fragen',
    ko: 'Toolkitty 준비 완료 · /toolkitty는 스위치 패널을 열고, /toolkitty help <질문>은 질문에 답합니다',
  },
  // buddy species and rarity names (same words as the buddy feature)
  cat: { en: 'Cat', he: 'חתול', es: 'Gato', fr: 'Chat', ru: 'Кот', zh: '猫', ja: 'ネコ', pt: 'Gato', de: 'Katze', ko: '고양이' },
  fox: { en: 'Fox', he: 'שועל', es: 'Zorro', fr: 'Renard', ru: 'Лиса', zh: '狐狸', ja: 'キツネ', pt: 'Raposa', de: 'Fuchs', ko: '여우' },
  owl: { en: 'Owl', he: 'ינשוף', es: 'Búho', fr: 'Hibou', ru: 'Сова', zh: '猫头鹰', ja: 'フクロウ', pt: 'Coruja', de: 'Eule', ko: '올빼미' },
  octopus: { en: 'Octopus', he: 'תמנון', es: 'Pulpo', fr: 'Pieuvre', ru: 'Осьминог', zh: '章鱼', ja: 'タコ', pt: 'Polvo', de: 'Oktopus', ko: '문어' },
  dragon: { en: 'Dragon', he: 'דרקון', es: 'Dragón', fr: 'Dragon', ru: 'Дракон', zh: '龙', ja: 'ドラゴン', pt: 'Dragão', de: 'Drache', ko: '드래곤' },
  axolotl: { en: 'Axolotl', he: 'אקסולוטל', es: 'Ajolote', fr: 'Axolotl', ru: 'Аксолотль', zh: '美西螈', ja: 'ウーパールーパー', pt: 'Axolote', de: 'Axolotl', ko: '우파루파' },
  penguin: { en: 'Penguin', he: 'פינגווין', es: 'Pingüino', fr: 'Pingouin', ru: 'Пингвин', zh: '企鹅', ja: 'ペンギン', pt: 'Pinguim', de: 'Pinguin', ko: '펭귄' },
  capybara: { en: 'Capybara', he: 'קפיברה', es: 'Capibara', fr: 'Capybara', ru: 'Капибара', zh: '水豚', ja: 'カピバラ', pt: 'Capivara', de: 'Capybara', ko: '카피바라' },
  raccoon: { en: 'Raccoon', he: 'דביבון', es: 'Mapache', fr: 'Raton laveur', ru: 'Енот', zh: '浣熊', ja: 'アライグマ', pt: 'Guaxinim', de: 'Waschbär', ko: '라쿤' },
  robot: { en: 'Robot', he: 'רובוט', es: 'Robot', fr: 'Robot', ru: 'Робот', zh: '机器人', ja: 'ロボット', pt: 'Robô', de: 'Roboter', ko: '로봇' },
  ghost: { en: 'Ghost', he: 'רוח רפאים', es: 'Fantasma', fr: 'Fantôme', ru: 'Привидение', zh: '幽灵', ja: 'ゴースト', pt: 'Fantasma', de: 'Geist', ko: '유령' },
  slime: { en: 'Slime', he: 'סליים', es: 'Slime', fr: 'Slime', ru: 'Слайм', zh: '史莱姆', ja: 'スライム', pt: 'Slime', de: 'Schleim', ko: '슬라임' },
  common: { en: 'Common', he: 'נפוץ', es: 'Común', fr: 'Commun', ru: 'Обычный', zh: '普通', ja: 'コモン', pt: 'Comum', de: 'Gewöhnlich', ko: '일반' },
  uncommon: { en: 'Uncommon', he: 'לא נפוץ', es: 'Poco común', fr: 'Peu commun', ru: 'Необычный', zh: '罕见', ja: 'アンコモン', pt: 'Incomum', de: 'Ungewöhnlich', ko: '고급' },
  rare: { en: 'Rare', he: 'נדיר', es: 'Raro', fr: 'Rare', ru: 'Редкий', zh: '稀有', ja: 'レア', pt: 'Raro', de: 'Selten', ko: '희귀' },
  epic: { en: 'Epic', he: 'אפי', es: 'Épico', fr: 'Épique', ru: 'Эпический', zh: '史诗', ja: 'エピック', pt: 'Épico', de: 'Episch', ko: '영웅' },
  legendary: { en: 'Legendary', he: 'אגדי', es: 'Legendario', fr: 'Légendaire', ru: 'Легендарный', zh: '传说', ja: 'レジェンダリー', pt: 'Lendário', de: 'Legendär', ko: '전설' },
  defaultName: { en: 'Buddy', he: 'חבר', es: 'Amigo', fr: 'Copain', ru: 'Дружок', zh: '伙伴', ja: 'バディ', pt: 'Parceiro', de: 'Buddy', ko: '버디' },
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

type Step = 1 | 2 | 3
type State = { step: Step }
type Species = 'cat' | 'fox' | 'owl' | 'octopus' | 'dragon' | 'axolotl' | 'penguin' | 'capybara' | 'raccoon' | 'robot' | 'ghost' | 'slime'
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'onboarding' } as const, { step: 1 } as State) as unknown as Atom<State>
const enabled = atom({ plugin: 'toolkitty', key: 'enabled' } as const, {} as Record<string, boolean>) as unknown as Atom<Record<string, boolean>>
// The same shared slot profiles.tsx keeps: which display profile is applied, and the map it set.
const profileState = atom({ plugin: 'toolkitty', key: 'slot', id: 'profiles' } as const, { profile: null, applied: {} } as ProfileState) as unknown as Atom<ProfileState>

export const feature: Feature = { id: 'onboarding', title: T.title, description: T.description, defaultOn: true }

const PANE = 'onboarding'
const SPECIES: readonly Species[] = ['cat', 'fox', 'owl', 'octopus', 'dragon', 'axolotl', 'penguin', 'capybara', 'raccoon', 'robot', 'ghost', 'slime']

/** Set after a first-run attempt found no surface; the next turn start tries once more. */
let retryWanted = false

// The same roll as the buddy feature: the same seed always gives the same buddy.
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = s
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function roll(seed: number): { species: Species; rarity: Rarity; shiny: boolean } {
  const r = rng(seed)
  const species = SPECIES[Math.floor(r() * SPECIES.length)] ?? 'cat'
  const q = r() * 100
  const rarity: Rarity = q < 60 ? 'common' : q < 85 ? 'uncommon' : q < 95 ? 'rare' : q < 99 ? 'epic' : 'legendary'
  const shiny = r() < 0.01
  return { species, rarity, shiny }
}

async function markDone($: EngineInterface): Promise<void> {
  await $.store.set('onboarding:done', true)
}

async function openWizard($: EngineInterface): Promise<void> {
  await update($, state, () => ({ step: 1 as Step }))
  await $.ui.open({ id: PANE, title: t(T.paneTitle), focus: true, closeOnEscape: true })
}

/** First run only: opens the wizard once a surface can draw it; false when none is attached yet. */
async function tryFirstRun($: EngineInterface): Promise<boolean> {
  if ((await $.session.surfaces()).length === 0) return false
  await openWizard($)
  return true
}

async function chooseLang($: EngineInterface, lang: Lang): Promise<void> {
  await setLanguage($, lang)
  await update($, state, () => ({ step: 2 as Step }))
}

async function chooseProfile($: EngineInterface, profile: ProfileName): Promise<void> {
  // The sets live in profiles.tsx; this applies the same map and records what profiles.tsx needs to track hand changes.
  const map = buildProfileMap(profile, features, await read($, enabled))
  await $.store.set('profile', profile)
  await $.store.set('profiles:applied', { profile, map })
  await $.store.set('profiles:overrides', {})
  await update($, profileState, () => ({ profile, applied: map }))
  if (profile === 'minimal') await setNoticePrefs($, { quiet: true })
  await update($, enabled, () => map)
  await storeSet($, 'enabled', map)
  await markDone($)
  await update($, state, () => ({ step: 3 as Step }))
}

async function skip($: EngineInterface): Promise<void> {
  await markDone($)
  await $.ui.close({ id: PANE })
}

async function finish($: EngineInterface): Promise<void> {
  await markDone($)
  await $.ui.close({ id: PANE })
  await notice($, 'info', t(T.ready), feature.id)
}

async function openBoard($: EngineInterface): Promise<void> {
  await markDone($)
  await $.ui.open({ id: 'toolkitty', title: 'Toolkitty', focus: true })
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'welcome', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'welcome', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  // First run ignores `isOn`: nothing has been configured yet.
  if ((await $.store.get('onboarding:done')) === true) return
  retryWanted = !(await tryFirstRun($))
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (!retryWanted) return
  retryWanted = false
  if ((await $.store.get('onboarding:done')) === true) return
  await tryFirstRun($)
}

export function register(on: On) {
  on('command.run', { command: 'welcome' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await openWizard($)
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'onboarding' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { step } = await read($, state)
    const map = await read($, enabled)

    const skipAction: HeaderAction = { key: 'skip', label: t(T.skip), onPress: () => skip($) }

    if (step === 1) {
      return (
        <Box flexDirection="column" gap={1}>
          {paneHeader($, e, { title: t(T.paneTitle), status: t(T.stepOf, { n: 1 }), level: 'info', icon: ICONS.setup, actions: [skipAction] })}
          <Box flexDirection="column">
            {LANGS.map(l => (
              <Text key={`l-${l}`}>{pick(T.chooseLang, l)}</Text>
            ))}
          </Box>
          <Box flexDirection="column">
            {LANGS.map(l => listRow($, e, { key: `pick-${l}`, text: LANG_NAMES[l], onPress: () => chooseLang($, l) }))}
          </Box>
        </Box>
      )
    }

    if (step === 2) {
      return (
        <Box flexDirection="column" gap={1}>
          {paneHeader($, e, { title: t(T.profileHeader), status: t(T.stepOf, { n: 2 }), level: 'info', icon: ICONS.setup, actions: [skipAction] })}
          {PROFILE_NAMES.map(p => (
            <Box key={`p-${p}`} flexDirection="column">
              {listRow($, e, { key: `pick-${p}`, text: t(PROFILE_TITLES[p]), onPress: () => chooseProfile($, p) })}
              <Text dimColor size="footnote">{t(PROFILE_DESCS[p])}</Text>
            </Box>
          ))}
          <Text dimColor size="footnote">{t(T.profileHint)}</Text>
        </Box>
      )
    }

    // Step 3: the reveal.
    const buddyOn = map['buddy'] ?? true
    const seed = await $.store.get('buddy:seed')
    const storedName = await $.store.get('buddy:name')
    let reveal: string = t(T.revealNone)
    let nameLine = ''
    let shiny = false
    if (!buddyOn) {
      reveal = t(T.revealOff)
    } else if (typeof seed === 'number' && seed > 0) {
      const rolled = roll(seed)
      reveal = t(T.reveal, { rarity: t(T[rolled.rarity]).toLowerCase(), species: t(T[rolled.species]).toLowerCase() })
      nameLine = t(T.revealName, { name: typeof storedName === 'string' && storedName !== '' ? storedName : t(T.defaultName) })
      shiny = rolled.shiny
    }
    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader($, e, {
          title: t(T.revealHeader),
          status: t(T.stepOf, { n: 3 }),
          level: 'info',
          icon: ICONS.setup,
          actions: [
            { key: 'board', label: t(T.openBoard), onPress: () => openBoard($) },
            { key: 'done', label: t(T.done), onPress: () => finish($), primary: true },
            skipAction,
          ],
        })}
        <Box flexDirection="column">
          <Text bold>{reveal}</Text>
          {nameLine !== '' ? <Text>{nameLine}</Text> : null}
          {shiny ? <Text color="warning">{t(T.shiny)}</Text> : null}
        </Box>
      </Box>
    )
  })
}
