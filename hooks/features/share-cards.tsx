import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement, RenderInput, RenderSurface } from 'claude-code'

import { isOn, language, notice, storeSet, t } from '../core'
import type { BandInput, Feature, Input } from '../core'
import { ACHIEVEMENTS } from './achievements'
import { CARD_KINDS, cardSvg, containsText, hasData, latestAchievement, minutesWorked, petFromStore, postText, redactReport, safetyFromIncidents, savingsFromDays, summaryText } from '../sharing'
import type { CardDataMap, CardKind, Lang } from '../sharing'
import { BUILTIN_THEMES } from '../themes'
import type { Theme } from '../themes'
import { saveSvg } from '../exports'
import { ICONS, paneHeader, sectionTitle } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: { en: 'Share cards', he: 'כרטיסי שיתוף', es: 'Tarjetas para compartir', fr: 'Cartes à partager', ru: 'Карточки для публикации', zh: '分享卡片', ja: 'シェアカード', pt: 'Cartões de compartilhamento', de: 'Teilen-Karten', ko: '공유 카드' },
  description: {
    en: 'A gallery of four share cards (savings, safety, achievement, companion) with a privacy preview. Cards are made on this machine; nothing is ever uploaded (/cards).',
    he: 'גלריה של ארבעה כרטיסי שיתוף (חיסכון, בטיחות, הישג, מלווה) עם תצוגה מקדימה של הפרטיות. הכרטיסים נוצרים במחשב הזה; שום דבר לא מועלה (/cards).',
    es: 'Una galería de cuatro tarjetas para compartir (ahorro, seguridad, logro, compañero) con vista previa de privacidad. Se crean en este equipo; nunca se sube nada (/cards).',
    fr: 'Une galerie de quatre cartes à partager (économies, sécurité, succès, compagnon) avec aperçu de confidentialité. Elles sont créées sur cette machine ; rien n’est jamais envoyé (/cards).',
    ru: 'Галерея из четырёх карточек (экономия, безопасность, достижение, питомец) с предпросмотром приватности. Карточки создаются на этом компьютере; ничего не загружается (/cards).',
    zh: '包含四张分享卡片（节省、安全、成就、伙伴）的图库，带隐私预览。卡片在本机生成，绝不会上传任何内容（/cards）。',
    ja: '4 種類のシェアカード（節約、安全、実績、コンパニオン）のギャラリーとプライバシープレビュー。カードはこのマシン上で作られ、何もアップロードされません（/cards）。',
    pt: 'Uma galeria de quatro cartões de compartilhamento (economia, segurança, conquista, companheiro) com prévia de privacidade. Os cartões são criados nesta máquina; nada é enviado (/cards).',
    de: 'Eine Galerie mit vier Teilen-Karten (Einsparungen, Sicherheit, Erfolg, Begleiter) mit Datenschutz-Vorschau. Die Karten entstehen auf diesem Rechner; nichts wird je hochgeladen (/cards).',
    ko: '공유 카드 4종(절약, 안전, 업적, 동반자)과 개인정보 미리보기가 있는 갤러리입니다. 카드는 이 기기에서 만들어지며 아무것도 업로드되지 않습니다 (/cards).',
  },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty',
    ru: 'Функция отключена; включите её в панели /toolkitty',
    zh: '该功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty パネルでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; im /toolkitty-Panel einschalten',
    ko: '기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요',
  },
  cmd: { en: 'Opens the share cards gallery', he: 'פותח את גלריית כרטיסי השיתוף', es: 'Abre la galería de tarjetas para compartir', fr: 'Ouvre la galerie de cartes à partager', ru: 'Открывает галерею карточек для публикации', zh: '打开分享卡片图库', ja: 'シェアカードのギャラリーを開きます', pt: 'Abre a galeria de cartões de compartilhamento', de: 'Öffnet die Galerie der Teilen-Karten', ko: '공유 카드 갤러리를 엽니다' },
  opened: { en: 'Share cards opened', he: 'כרטיסי השיתוף נפתחו', es: 'Tarjetas para compartir abiertas', fr: 'Cartes à partager ouvertes', ru: 'Карточки для публикации открыты', zh: '分享卡片已打开', ja: 'シェアカードを開きました', pt: 'Cartões de compartilhamento abertos', de: 'Teilen-Karten geöffnet', ko: '공유 카드를 열었습니다' },
  cmdTaken: {
    en: 'Could not register /{name}: {reason}',
    he: 'לא ניתן לרשום את הפקודה /{name}: {reason}',
    es: 'No se pudo registrar /{name}: {reason}',
    fr: "Impossible d'enregistrer la commande /{name} : {reason}",
    ru: 'Не удалось зарегистрировать команду /{name}: {reason}',
    zh: '无法注册 /{name}：{reason}',
    ja: '/{name} を登録できませんでした：{reason}',
    pt: 'Não foi possível registrar /{name}: {reason}',
    de: '/{name} konnte nicht registriert werden: {reason}',
    ko: '/{name}을(를) 등록할 수 없습니다: {reason}',
  },
  paneTitle: { en: 'Share cards', he: 'כרטיסי שיתוף', es: 'Tarjetas para compartir', fr: 'Cartes à partager', ru: 'Карточки для публикации', zh: '分享卡片', ja: 'シェアカード', pt: 'Cartões de compartilhamento', de: 'Teilen-Karten', ko: '공유 카드' },
  localOnly: { en: 'local only', he: 'מקומי בלבד', es: 'solo local', fr: 'local uniquement', ru: 'только локально', zh: '仅限本地', ja: 'ローカルのみ', pt: 'apenas local', de: 'nur lokal', ko: '로컬 전용' },
  cardSavings: { en: 'Savings card', he: 'כרטיס חיסכון', es: 'Tarjeta de ahorro', fr: 'Carte d’économies', ru: 'Карточка экономии', zh: '节省卡片', ja: '節約カード', pt: 'Cartão de economia', de: 'Spar-Karte', ko: '절약 카드' },
  cardSafety: { en: 'Safety card', he: 'כרטיס בטיחות', es: 'Tarjeta de seguridad', fr: 'Carte de sécurité', ru: 'Карточка безопасности', zh: '安全卡片', ja: 'セーフティカード', pt: 'Cartão de segurança', de: 'Sicherheits-Karte', ko: '안전 카드' },
  cardAchievement: { en: 'Achievement card', he: 'כרטיס הישג', es: 'Tarjeta de logro', fr: 'Carte de succès', ru: 'Карточка достижения', zh: '成就卡片', ja: '実績カード', pt: 'Cartão de conquista', de: 'Erfolgs-Karte', ko: '업적 카드' },
  cardPet: { en: 'Companion card', he: 'כרטיס מלווה', es: 'Tarjeta del compañero', fr: 'Carte du compagnon', ru: 'Карточка питомца', zh: '伙伴卡片', ja: 'コンパニオンカード', pt: 'Cartão do companheiro', de: 'Begleiter-Karte', ko: '동반자 카드' },
  preview: { en: 'Preview', he: 'תצוגה מקדימה', es: 'Vista previa', fr: 'Aperçu', ru: 'Предпросмотр', zh: '预览', ja: 'プレビュー', pt: 'Prévia', de: 'Vorschau', ko: '미리보기' },
  closePreview: { en: 'Hide preview', he: 'הסתר תצוגה', es: 'Ocultar vista previa', fr: 'Masquer l’aperçu', ru: 'Скрыть предпросмотр', zh: '隐藏预览', ja: 'プレビューを隠す', pt: 'Ocultar prévia', de: 'Vorschau ausblenden', ko: '미리보기 숨기기' },
  save: { en: 'Save SVG', he: 'שמור SVG', es: 'Guardar SVG', fr: 'Enregistrer le SVG', ru: 'Сохранить SVG', zh: '保存 SVG', ja: 'SVG を保存', pt: 'Salvar SVG', de: 'SVG speichern', ko: 'SVG 저장' },
  copy: { en: 'Copy post', he: 'העתק פוסט', es: 'Copiar publicación', fr: 'Copier le message', ru: 'Скопировать текст', zh: '复制帖子文本', ja: '投稿文をコピー', pt: 'Copiar texto da postagem', de: 'Beitragstext kopieren', ko: '게시글 복사' },
  projectHidden: { en: 'Project name: hidden', he: 'שם הפרויקט: מוסתר', es: 'Nombre del proyecto: oculto', fr: 'Nom du projet : masqué', ru: 'Имя проекта: скрыто', zh: '项目名称：已隐藏', ja: 'プロジェクト名：非表示', pt: 'Nome do projeto: oculto', de: 'Projektname: ausgeblendet', ko: '프로젝트 이름: 숨김' },
  projectShown: { en: 'Project name: shown', he: 'שם הפרויקט: מוצג', es: 'Nombre del proyecto: visible', fr: 'Nom du projet : affiché', ru: 'Имя проекта: показано', zh: '项目名称：已显示', ja: 'プロジェクト名：表示', pt: 'Nome do projeto: exibido', de: 'Projektname: angezeigt', ko: '프로젝트 이름: 표시' },
  hidden: { en: 'hidden', he: 'מוסתר', es: 'oculto', fr: 'masqué', ru: 'скрыто', zh: '已隐藏', ja: '非表示', pt: 'oculto', de: 'ausgeblendet', ko: '숨김' },
  shown: { en: 'shown', he: 'מוצג', es: 'visible', fr: 'affiché', ru: 'показано', zh: '已显示', ja: '表示', pt: 'exibido', de: 'angezeigt', ko: '표시' },
  privacy: {
    en: 'Privacy: contains {contains}. Redacted: {paths} paths, {secrets} secrets, {projects} project names. Project name: {state}.',
    he: 'פרטיות: מכיל {contains}. הוסתרו: {paths} נתיבים, {secrets} סודות, {projects} שמות פרויקט. שם הפרויקט: {state}.',
    es: 'Privacidad: contiene {contains}. Ocultado: {paths} rutas, {secrets} secretos, {projects} nombres de proyecto. Nombre del proyecto: {state}.',
    fr: 'Confidentialité : contient {contains}. Masqué : {paths} chemins, {secrets} secrets, {projects} noms de projet. Nom du projet : {state}.',
    ru: 'Приватность: содержит {contains}. Скрыто: путей {paths}, секретов {secrets}, имён проекта {projects}. Имя проекта: {state}.',
    zh: '隐私：包含 {contains}。已脱敏：{paths} 个路径、{secrets} 个密钥、{projects} 个项目名称。项目名称：{state}。',
    ja: 'プライバシー：{contains} を含みます。伏せ字：パス {paths} 件、シークレット {secrets} 件、プロジェクト名 {projects} 件。プロジェクト名：{state}。',
    pt: 'Privacidade: contém {contains}. Ocultados: {paths} caminhos, {secrets} segredos, {projects} nomes de projeto. Nome do projeto: {state}.',
    de: 'Datenschutz: enthält {contains}. Geschwärzt: {paths} Pfade, {secrets} Geheimnisse, {projects} Projektnamen. Projektname: {state}.',
    ko: '개인정보: {contains} 포함. 가림 처리: 경로 {paths}개, 비밀 값 {secrets}개, 프로젝트 이름 {projects}개. 프로젝트 이름: {state}.',
  },
  none: { en: 'none yet', he: 'עדיין אין', es: 'aún nada', fr: 'rien encore', ru: 'пока нет', zh: '暂无', ja: 'まだなし', pt: 'nada ainda', de: 'noch nichts', ko: '아직 없음' },
  hintSavings: {
    en: 'It fills as Toolkitty keeps things out of the context.',
    he: 'הוא מתמלא כשהתוכנה מונעת מידע מלהיכנס להקשר.',
    es: 'Se llena a medida que el toolkitty evita que cosas entren al contexto.',
    fr: 'Elle se remplit quand le toolkitty évite des choses dans le contexte.',
    ru: 'Заполняется, когда toolkitty не пускает лишнее в контекст.',
    zh: 'Toolkitty 把内容挡在上下文之外时，它会逐渐填充。',
    ja: 'Toolkitty がコンテキストに入れずに済ませるほど、ここが埋まっていきます。',
    pt: 'Ele se preenche à medida que o toolkitty mantém coisas fora do contexto.',
    de: 'Sie füllt sich, wenn das Toolkitty Dinge aus dem Kontext heraushält.',
    ko: 'Toolkitty이 컨텍스트에서 무언가를 덜어 낼수록 채워집니다.',
  },
  hintSafety: {
    en: 'It fills when a guard blocks something dangerous (see /incidents).',
    he: 'הוא מתמלא כשמגן חוסם משהו מסוכן (ראה /incidents).',
    es: 'Se llena cuando una protección bloquea algo peligroso (ver /incidents).',
    fr: 'Elle se remplit quand une protection bloque quelque chose de dangereux (voir /incidents).',
    ru: 'Заполняется, когда защита блокирует опасное (см. /incidents).',
    zh: '当防护拦截危险操作时它会被填充（见 /incidents）。',
    ja: 'ガードが危険な操作をブロックすると埋まります（/incidents を参照）。',
    pt: 'Ele se preenche quando uma proteção bloqueia algo perigoso (veja /incidents).',
    de: 'Sie füllt sich, wenn ein Wächter etwas Gefährliches blockiert (siehe /incidents).',
    ko: '가드가 위험한 작업을 차단하면 채워집니다 (/incidents 참고).',
  },
  hintAchievement: {
    en: 'It fills when you unlock your first achievement.',
    he: 'הוא מתמלא כשפותחים את ההישג הראשון.',
    es: 'Se llena cuando desbloqueas tu primer logro.',
    fr: 'Elle se remplit quand tu débloques ton premier succès.',
    ru: 'Заполняется, когда вы откроете первое достижение.',
    zh: '解锁你的第一个成就后它会被填充。',
    ja: '最初の実績を解除すると埋まります。',
    pt: 'Ele se preenche quando você desbloqueia sua primeira conquista.',
    de: 'Sie füllt sich, sobald du deinen ersten Erfolg freischaltest.',
    ko: '첫 업적을 달성하면 채워집니다.',
  },
  hintPet: {
    en: 'Run /buddy to meet your companion.',
    he: 'הריצו /buddy כדי להכיר את המלווה שלכם.',
    es: 'Ejecuta /buddy para conocer a tu compañero.',
    fr: 'Lance /buddy pour rencontrer ton compagnon.',
    ru: 'Запустите /buddy, чтобы познакомиться с питомцем.',
    zh: '运行 /buddy 来认识你的伙伴。',
    ja: '/buddy を実行してコンパニオンに会いましょう。',
    pt: 'Execute /buddy para conhecer seu companheiro.',
    de: 'Führe /buddy aus, um deinen Begleiter kennenzulernen.',
    ko: '/buddy를 실행해 동반자를 만나 보세요.',
  },
  footnote: {
    en: 'Nothing is uploaded: cards are drawn here, “Save SVG” writes a file in this folder, “Copy post” puts text on your clipboard. You decide where it goes.',
    he: 'שום דבר לא מועלה: הכרטיסים נוצרים כאן, “שמור SVG” כותב קובץ בתיקייה הזו ו“העתק פוסט” שם טקסט בלוח ההעתקה. אתם מחליטים לאן זה הולך.',
    es: 'No se sube nada: las tarjetas se crean aquí, “Guardar SVG” escribe un archivo en esta carpeta y “Copiar publicación” pone texto en el portapapeles. Tú decides adónde va.',
    fr: 'Rien n’est envoyé : les cartes sont créées ici, « Enregistrer le SVG » écrit un fichier dans ce dossier, « Copier le message » place du texte dans le presse-papiers. Tu décides où il va.',
    ru: 'Ничего не загружается: карточки создаются здесь, «Сохранить SVG» записывает файл в эту папку, «Скопировать текст» кладёт текст в буфер обмена. Куда это пойдёт, решаете вы.',
    zh: '不会上传任何内容：卡片在此绘制，“保存 SVG”会在此文件夹写入文件，“复制帖子文本”会把文字放到剪贴板。去向由你决定。',
    ja: '何もアップロードされません：カードはここで描画され、「SVG を保存」はこのフォルダにファイルを書き出し、「投稿文をコピー」はテキストをクリップボードに入れます。どこに出すかはあなた次第です。',
    pt: 'Nada é enviado: os cartões são desenhados aqui, "Salvar SVG" grava um arquivo nesta pasta e "Copiar texto da postagem" coloca o texto na sua área de transferência. Você decide para onde vai.',
    de: 'Nichts wird hochgeladen: Die Karten werden hier gezeichnet, „SVG speichern“ schreibt eine Datei in diesen Ordner, „Beitragstext kopieren“ legt Text in die Zwischenablage. Du entscheidest, wohin es geht.',
    ko: '아무것도 업로드되지 않습니다. 카드는 여기서 그려지고, "SVG 저장"은 이 폴더에 파일을 쓰며, "게시글 복사"는 텍스트를 클립보드에 넣습니다. 어디에 올릴지는 직접 정하세요.',
  },
  copied: { en: 'Post text copied', he: 'טקסט הפוסט הועתק', es: 'Texto de la publicación copiado', fr: 'Texte du message copié', ru: 'Текст скопирован', zh: '帖子文本已复制', ja: '投稿文をコピーしました', pt: 'Texto da postagem copiado', de: 'Beitragstext kopiert', ko: '게시글 텍스트를 복사했습니다' },
  copyFailed: { en: 'Could not copy', he: 'ההעתקה נכשלה', es: 'No se pudo copiar', fr: 'Copie impossible', ru: 'Не удалось скопировать', zh: '无法复制', ja: 'コピーできませんでした', pt: 'Não foi possível copiar', de: 'Kopieren nicht möglich', ko: '복사할 수 없습니다' },
  nothing: {
    en: 'Nothing to share yet for this card',
    he: 'עדיין אין מה לשתף בכרטיס הזה',
    es: 'Aún no hay nada que compartir en esta tarjeta',
    fr: 'Rien à partager pour le moment sur cette carte',
    ru: 'Пока нечем делиться в этой карточке',
    zh: '这张卡片暂时没有可分享的内容',
    ja: 'このカードにはまだ共有できるものがありません',
    pt: 'Ainda não há nada para compartilhar neste cartão',
    de: 'Für diese Karte gibt es noch nichts zu teilen',
    ko: '이 카드는 아직 공유할 내용이 없습니다',
  },
  previewAlt: { en: 'Share card preview: {title}', he: 'תצוגה מקדימה של כרטיס שיתוף: {title}', es: 'Vista previa de la tarjeta: {title}', fr: 'Aperçu de la carte : {title}', ru: 'Предпросмотр карточки: {title}', zh: '分享卡片预览：{title}', ja: 'シェアカードのプレビュー：{title}', pt: 'Prévia do cartão de compartilhamento: {title}', de: 'Vorschau der Teilen-Karte: {title}', ko: '공유 카드 미리보기: {title}' },
} as const

type State = {
  /** The card whose preview is open ('' = none). */
  preview: string
  allowProject: boolean
  /** Whether allowProject was read from the store yet. */
  loaded: boolean
}

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'share-cards' } as const, { preview: '', allowProject: false, loaded: false } as State) as unknown as Atom<State>

// The shared theme slot, the same ref as in themes.tsx.
const theme = atom({ plugin: 'toolkitty', key: 'slot', id: 'theme' } as const, BUILTIN_THEMES[0] as Theme) as unknown as Atom<Theme>

export const feature: Feature = {
  id: 'share-cards',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const PANE = 'share-cards'
const ALLOW_KEY = 'share-cards:allowProject'

const projectOf = (cwd: string): string => cwd.split(/[\\/]/).filter(Boolean).pop() ?? ''

const cardTitle = (kind: CardKind): string => t(kind === 'savings' ? T.cardSavings : kind === 'safety' ? T.cardSafety : kind === 'achievement' ? T.cardAchievement : T.cardPet)
const cardHint = (kind: CardKind): string => t(kind === 'savings' ? T.hintSavings : kind === 'safety' ? T.hintSafety : kind === 'achievement' ? T.hintAchievement : T.hintPet)

type Counts = { paths: number; secrets: number; projects: number }

type Loaded = {
  data: CardDataMap
  counts: Record<CardKind, Counts>
  cwd: string
  theme: Theme
  allow: boolean
  lang: Lang
}

async function allowProjectOf($: EngineInterface): Promise<boolean> {
  const s = await read($, state)
  if (s.loaded) return s.allowProject
  return (await $.store.get(ALLOW_KEY)) === true
}

/** Everything the gallery shows, built from Toolkitty's own stores. Read-only. */
async function loadAll($: EngineInterface): Promise<Loaded> {
  const now = await $.clock.now()
  const cwd = await $.session.cwd()
  const allow = await allowProjectOf($)
  const th = await read($, theme)

  const savings = savingsFromDays(await $.store.get('savings:days'), now)
  const safety = safetyFromIncidents(await $.store.get(`incidents:${cwd}`), now)
  const latest = latestAchievement(await $.store.get('achievements:unlocked'), ACHIEVEMENTS.map(a => ({ id: a.id, icon: a.icon, title: t(a.title) })))
  const pet = petFromStore(await $.store.get('buddy:seed'), await $.store.get('buddy:stage'), minutesWorked(await $.store.get('week-heatmap:days')))

  // The only free text on a card is the trophy's title: scrub it, project name included unless the person allowed it.
  const none: Counts = { paths: 0, secrets: 0, projects: 0 }
  let achievement = latest
  let achievementCounts = none
  if (latest !== null) {
    const report = redactReport(latest.title, { project: projectOf(cwd), allowProject: allow })
    achievement = { ...latest, title: report.text }
    achievementCounts = { paths: report.paths, secrets: report.secrets, projects: report.projects }
  }

  return {
    data: { savings, safety, achievement, pet },
    counts: { savings: none, safety: none, achievement: achievementCounts, pet: none },
    cwd,
    theme: th,
    allow,
    lang: language() as Lang,
  }
}

async function togglePreview($: EngineInterface, kind: CardKind): Promise<void> {
  await update($, state, s => ({ ...s, preview: s.preview === kind ? '' : kind }))
}

async function toggleProject($: EngineInterface): Promise<void> {
  const flipped = !(await allowProjectOf($))
  await storeSet($, ALLOW_KEY, flipped)
  await update($, state, s => ({ ...s, allowProject: flipped, loaded: true }))
}

async function saveCard($: EngineInterface, kind: CardKind): Promise<void> {
  const all = await loadAll($)
  if (!hasData(kind, all.data[kind] as never)) {
    await notice($, 'info', t(T.nothing), feature.id, { immediate: true })
    return
  }
  await saveSvg($, `card-${kind}`, cardSvg(kind, all.data[kind] as never, all.theme, all.lang), feature.id)
}

async function copyPost($: EngineInterface, kind: CardKind, surface: RenderSurface): Promise<void> {
  const all = await loadAll($)
  if (!hasData(kind, all.data[kind] as never)) {
    await notice($, 'info', t(T.nothing), feature.id, { immediate: true })
    return
  }
  const text = postText(kind, all.data[kind] as never, all.lang)
  let isCopied = false
  try {
    isCopied = (await $.ui.copy({ text, surface })).isCopied
  } catch {
    isCopied = false
  }
  await notice($, isCopied ? 'info' : 'warn', t(isCopied ? T.copied : T.copyFailed), feature.id, { immediate: true })
}

// ---------- handlers ----------

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'cards', description: t(T.cmd) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'cards', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  const allow = (await $.store.get(ALLOW_KEY)) === true
  await update($, state, s => ({ ...s, allowProject: allow, loaded: true }))
}

/** The gallery has nothing to say in the band. */
export async function renderChip($: EngineInterface, _e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature))) return null
  return null
}

// ---------- the pane ----------

async function drawPane($: EngineInterface, e: RenderInput<'Pane'>): Promise<RenderElement> {
  const { Box, Text, Button } = $.ui.resolve(e)
  // Svg exists on the desktop surface only; the terminal gets a text summary.
  const Svg = e.surface === 'desktop' ? $.ui.resolve(e).Svg : null
  const all = await loadAll($)
  const s = await read($, state)

  return (
    <Box flexDirection="column" gap={1}>
      {paneHeader($, e, {
        title: t(T.paneTitle),
        status: t(T.localOnly),
        level: 'ok',
        icon: ICONS.visual,
        actions: [
          {
            key: 'share-allow-project',
            label: t(all.allow ? T.projectShown : T.projectHidden),
            onPress: () => toggleProject($),
          },
        ],
      })}
      {CARD_KINDS.map(kind => {
        const data = all.data[kind] as never
        const filled = hasData(kind, data)
        const c = all.counts[kind]
        const open = s.preview === kind
        const title = cardTitle(kind)
        return (
          <Box key={`card-${kind}`} flexDirection="column">
            {sectionTitle($, e, title)}
            {filled ? (
              <Text>{summaryText(kind, data, all.lang)}</Text>
            ) : (
              <Box flexDirection="column">
                <Text dimColor>{t(T.none)}</Text>
                <Text dimColor size="footnote">
                  {cardHint(kind)}
                </Text>
              </Box>
            )}
            <Box gap={2}>
              <Button
                key={`preview-${kind}`}
                plain
                label={t(open ? T.closePreview : T.preview)}
                onPress={() => togglePreview($, kind)}
              />
              <Button
                key={`save-${kind}`}
                plain
                label={t(T.save)}
                onPress={() => saveCard($, kind)}
              />
              <Button
                key={`copy-${kind}`}
                plain
                label={t(T.copy)}
                onPress={() => copyPost($, kind, e.surface)}
              />
            </Box>
            <Text dimColor size="footnote">
              {t(T.privacy, {
                contains: containsText(kind, all.lang),
                paths: c.paths,
                secrets: c.secrets,
                projects: c.projects,
                state: t(all.allow ? T.shown : T.hidden),
              })}
            </Text>
            {open && Svg !== null ? (
              <Box marginTop={1}>
                <Svg source={cardSvg(kind, data, all.theme, all.lang)} alt={t(T.previewAlt, { title })} width={600} height={315} />
              </Box>
            ) : null}
            {open && Svg === null ? (
              <Box marginTop={1} flexDirection="column" borderStyle="round" paddingX={2}>
                <Text bold color="claude">
                  {title}
                </Text>
                <Text>{summaryText(kind, data, all.lang)}</Text>
                <Text dimColor>Claude Code · Toolkitty</Text>
              </Box>
            ) : null}
          </Box>
        )
      })}
      <Text dimColor size="footnote">
        {t(T.footnote)}
      </Text>
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'cards' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: PANE, title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'share-cards' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.off)}</Text>
    return drawPane($, e)
  })
}
