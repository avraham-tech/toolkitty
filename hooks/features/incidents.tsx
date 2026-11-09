import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement, RenderInput } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput } from '../core'
import { escapeXml, exportBar } from '../exports'
import type { Incident, Incidents } from '../shared'
import { publish, retractAll } from '../signals'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Disasters prevented', he: 'אסונות שנמנעו', es: 'Desastres evitados', fr: 'Désastres évités', ru: 'Предотвращённые катастрофы', zh: '避免的灾难', ja: '防いだ事故', pt: 'Desastres evitados', de: 'Verhinderte Pannen', ko: '막은 사고' },
  description: {
    en: 'Counts every time a guard stopped something (secrets, destructive commands, red CI...) and shows a card when it saved the turn.',
    he: 'סופר כל פעם שמנגנון הגנה עצר משהו (סודות, פקודות הרסניות, CI אדום...) ומציג כרטיס כשהוא הציל את התור.',
    es: 'Cuenta cada vez que una protección detuvo algo (secretos, comandos destructivos, CI en rojo...) y muestra una tarjeta cuando salvó el turno.',
    fr: 'Compte chaque fois qu’une protection a bloqué quelque chose (secrets, commandes destructrices, CI rouge...) et affiche une carte quand elle a sauvé le tour.',
    ru: 'Считает каждый случай, когда защита что-то остановила (секреты, разрушительные команды, красный CI...), и показывает карточку, когда ход был спасён.',
    zh: '统计每次防护拦截的情况（密钥、破坏性命令、红色 CI……），并在它挽救了本回合时显示一张卡片。',
    ja: '防御機能が何かを止めた回数（シークレット、破壊的コマンド、赤い CI など）を数え、ターンを救ったときにカードを表示します。',
    pt: 'Conta cada vez que uma proteção barrou algo (segredos, comandos destrutivos, CI vermelho...) e mostra um cartão quando ela salvou o turno.',
    de: 'Zählt jedes Mal, wenn ein Schutz etwas gestoppt hat (Secrets, destruktive Befehle, rote CI ...), und zeigt eine Karte, wenn er den Turn gerettet hat.',
    ko: '보호 장치가 무언가를 막을 때마다(시크릿, 파괴적인 명령, 빨간 CI 등) 횟수를 세고, 턴을 구했을 때 카드를 보여줍니다.',
  },
  commandDesc: {
    en: 'List the disasters Toolkitty prevented in this project',
    he: 'רשימת האסונות ש-Toolkitty מנע בפרויקט הזה',
    es: 'Lista los desastres que Toolkitty evitó en este proyecto',
    fr: 'Liste les désastres que Toolkitty a évités dans ce projet',
    ru: 'Список катастроф, предотвращённых Toolkitty в этом проекте',
    zh: '列出 Toolkitty 在本项目中避免的灾难',
    ja: 'Toolkitty がこのプロジェクトで防いだ事故を一覧表示します',
    pt: 'Lista os desastres que o Toolkitty evitou neste projeto',
    de: 'Listet die Pannen auf, die Toolkitty in diesem Projekt verhindert hat',
    ko: 'Toolkitty이 이 프로젝트에서 막은 사고를 나열합니다',
  },
  off: { en: 'Disasters prevented is off. Turn it on in the /toolkitty pane.', he: 'אסונות שנמנעו כבוי. הפעילו אותו בחלונית /toolkitty.', es: 'Desastres evitados está desactivado. Actívalo en el panel /toolkitty.', fr: 'Désastres évités est désactivé. Activez-le dans le panneau /toolkitty.', ru: 'Предотвращённые катастрофы отключены. Включите функцию в панели /toolkitty.', zh: '「避免的灾难」已关闭。请在 /toolkitty 面板中开启。', ja: '「防いだ事故」はオフです。/toolkitty パネルでオンにしてください。', pt: 'Desastres evitados está desativado. Ative no painel /toolkitty.', de: '„Verhinderte Pannen“ ist aus. Schalte es im /toolkitty-Bereich ein.', ko: '막은 사고 기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요.' },
  opened: { en: 'Opened the incidents pane.', he: 'חלונית האירועים נפתחה.', es: 'Panel de incidentes abierto.', fr: 'Panneau des incidents ouvert.', ru: 'Панель инцидентов открыта.', zh: '已打开事件面板。', ja: 'インシデントパネルを開きました。', pt: 'Painel de incidentes aberto.', de: 'Der Vorfall-Bereich wurde geöffnet.', ko: '사고 패널을 열었습니다.' },
  paneTitle: { en: 'Disasters prevented', he: 'אסונות שנמנעו', es: 'Desastres evitados', fr: 'Désastres évités', ru: 'Предотвращённые катастрофы', zh: '避免的灾难', ja: '防いだ事故', pt: 'Desastres evitados', de: 'Verhinderte Pannen', ko: '막은 사고' },
  paneOff: { en: 'Disasters prevented is off.', he: 'אסונות שנמנעו כבוי.', es: 'Desastres evitados está desactivado.', fr: 'Désastres évités est désactivé.', ru: 'Функция отключена.', zh: '「避免的灾难」已关闭。', ja: '「防いだ事故」はオフです。', pt: 'Desastres evitados está desativado.', de: '„Verhinderte Pannen“ ist aus.', ko: '막은 사고 기능이 꺼져 있습니다.' },
  cardHeader: { en: '🛡 Disaster prevented #{n}', he: '🛡 אסון נמנע #{n}', es: '🛡 Desastre evitado #{n}', fr: '🛡 Désastre évité #{n}', ru: '🛡 Катастрофа предотвращена #{n}', zh: '🛡 已避免灾难 #{n}', ja: '🛡 事故を防ぎました #{n}', pt: '🛡 Desastre evitado #{n}', de: '🛡 Panne verhindert #{n}', ko: '🛡 사고 방지 #{n}' },
  cardFooter: {
    en: 'Toolkitty has prevented {n} incidents in this project',
    he: 'Toolkitty מנע {n} אירועים בפרויקט הזה',
    es: 'Toolkitty ha evitado {n} incidentes en este proyecto',
    fr: 'Toolkitty a évité {n} incidents dans ce projet',
    ru: 'Toolkitty предотвратил инцидентов в этом проекте: {n}',
    zh: 'Toolkitty 在本项目中已阻止 {n} 起事件',
    ja: 'Toolkitty はこのプロジェクトで {n} 件のインシデントを防ぎました',
    pt: 'O Toolkitty evitou {n} incidentes neste projeto',
    de: 'Toolkitty hat in diesem Projekt {n} Vorfälle verhindert',
    ko: 'Toolkitty이 이 프로젝트에서 사고 {n}건을 막았습니다',
  },
  toast: { en: '🛡 Disaster prevented #{n}: {what}', he: '🛡 אסון נמנע #{n}: {what}', es: '🛡 Desastre evitado #{n}: {what}', fr: '🛡 Désastre évité #{n} : {what}', ru: '🛡 Катастрофа предотвращена #{n}: {what}', zh: '🛡 已避免灾难 #{n}：{what}', ja: '🛡 事故を防ぎました #{n}: {what}', pt: '🛡 Desastre evitado #{n}: {what}', de: '🛡 Panne verhindert #{n}: {what}', ko: '🛡 사고 방지 #{n}: {what}' },
  band: { en: '🛡 {n} prevented', he: '🛡 {n} נמנעו', es: '🛡 {n} evitados', fr: '🛡 {n} évités', ru: '🛡 предотвращено: {n}', zh: '🛡 已拦截 {n}', ja: '🛡 {n} 件防止', pt: '🛡 {n} evitados', de: '🛡 {n} verhindert', ko: '🛡 {n}건 방지' },
  allTime: { en: 'All time in this project: {n}', he: 'סך הכול בפרויקט הזה: {n}', es: 'Total en este proyecto: {n}', fr: 'Total dans ce projet : {n}', ru: 'Всего в этом проекте: {n}', zh: '本项目累计：{n}', ja: 'このプロジェクトの累計: {n}', pt: 'Total neste projeto: {n}', de: 'Gesamt in diesem Projekt: {n}', ko: '이 프로젝트 누적: {n}' },
  empty: { en: 'Nothing prevented yet. The guards are on watch.', he: 'עדיין לא נמנע דבר. מנגנוני ההגנה על המשמר.', es: 'Aún no se ha evitado nada. Las protecciones vigilan.', fr: 'Rien d’évité pour l’instant. Les protections veillent.', ru: 'Пока ничего не предотвращено. Защита начеку.', zh: '暂时还没有拦截。防护正在值守。', ja: 'まだ防いだものはありません。防御機能が見張っています。', pt: 'Nada evitado ainda. As proteções estão de vigia.', de: 'Noch nichts verhindert. Die Schutzfunktionen sind auf Posten.', ko: '아직 막은 것이 없습니다. 보호 장치가 지켜보고 있습니다.' },
  chipPrevented: { en: '{n} prevented', he: '{n} נמנעו', es: '{n} evitados', fr: '{n} évités', ru: 'предотвр. {n}', zh: '已拦截 {n}', ja: '{n} 件防止', pt: '{n} evitados', de: '{n} verhindert', ko: '{n}건 방지' },
  emptyHint: {
    en: 'Blocked secrets, destructive commands, red-CI merges and injections are listed here as they happen.',
    he: 'סודות שנחסמו, פקודות הרסניות, מיזוגים על CI אדום והזרקות יופיעו כאן בזמן אמת.',
    es: 'Los secretos bloqueados, comandos destructivos, fusiones con CI en rojo e inyecciones se listan aquí al ocurrir.',
    fr: 'Les secrets bloqués, commandes destructrices, fusions sur CI rouge et injections sont listés ici au fur et à mesure.',
    ru: 'Заблокированные секреты, опасные команды, слияния на красном CI и инъекции появятся здесь по мере событий.',
    zh: '被拦截的密钥、破坏性命令、红色 CI 合并和注入会在发生时列在这里。',
    ja: 'ブロックしたシークレット、破壊的コマンド、赤い CI でのマージ、インジェクションが、発生した時点でここに表示されます。',
    pt: 'Segredos, comandos destrutivos, merges com CI vermelho e injeções bloqueados aparecem aqui conforme acontecem.',
    de: 'Blockierte Secrets, destruktive Befehle, Merges bei roter CI und Injections werden hier aufgelistet, sobald sie auftreten.',
    ko: '차단된 시크릿, 파괴적인 명령, 빨간 CI 상태의 머지, 인젝션이 발생하는 대로 여기에 표시됩니다.',
  },
  copy: { en: 'copy', he: 'העתקה', es: 'copiar', fr: 'copier', ru: 'копировать', zh: '复制', ja: 'コピー', pt: 'copiar', de: 'kopieren', ko: '복사' },
  copied: { en: 'Share text copied', he: 'טקסט השיתוף הועתק', es: 'Texto para compartir copiado', fr: 'Texte à partager copié', ru: 'Текст скопирован', zh: '已复制分享文本', ja: '共有テキストをコピーしました', pt: 'Texto de compartilhamento copiado', de: 'Text zum Teilen kopiert', ko: '공유 텍스트를 복사했습니다' },
  copyFailed: { en: 'Could not copy', he: 'ההעתקה נכשלה', es: 'No se pudo copiar', fr: 'Copie impossible', ru: 'Не удалось скопировать', zh: '无法复制', ja: 'コピーできませんでした', pt: 'Não foi possível copiar', de: 'Kopieren nicht möglich', ko: '복사할 수 없습니다' },
  shareParts: {
    en: 'Toolkitty stopped {n} disasters in my project this month: {parts}',
    he: 'Toolkitty עצר {n} אסונות בפרויקט שלי החודש: {parts}',
    es: 'Toolkitty evitó {n} desastres en mi proyecto este mes: {parts}',
    fr: 'Toolkitty a évité {n} désastres dans mon projet ce mois-ci : {parts}',
    ru: 'Toolkitty остановил {n} катастроф в моём проекте за этот месяц: {parts}',
    zh: 'Toolkitty 本月在我的项目中拦截了 {n} 起灾难：{parts}',
    ja: 'Toolkitty は今月、私のプロジェクトで {n} 件の事故を防ぎました: {parts}',
    pt: 'O Toolkitty evitou {n} desastres no meu projeto este mês: {parts}',
    de: 'Toolkitty hat diesen Monat in meinem Projekt {n} Pannen verhindert: {parts}',
    ko: 'Toolkitty이 이번 달 내 프로젝트에서 사고 {n}건을 막았습니다: {parts}',
  },
  sharePlain: {
    en: 'Toolkitty stopped {n} disasters in my project',
    he: 'Toolkitty עצר {n} אסונות בפרויקט שלי',
    es: 'Toolkitty evitó {n} desastres en mi proyecto',
    fr: 'Toolkitty a évité {n} désastres dans mon projet',
    ru: 'Toolkitty остановил {n} катастроф в моём проекте',
    zh: 'Toolkitty 在我的项目中拦截了 {n} 起灾难',
    ja: 'Toolkitty は私のプロジェクトで {n} 件の事故を防ぎました',
    pt: 'O Toolkitty evitou {n} desastres no meu projeto',
    de: 'Toolkitty hat in meinem Projekt {n} Pannen verhindert',
    ko: 'Toolkitty이 내 프로젝트에서 사고 {n}건을 막았습니다',
  },
  partSecrets: { en: '{n} secrets', he: '{n} סודות', es: '{n} secretos', fr: '{n} secrets', ru: 'секреты: {n}', zh: '{n} 个密钥', ja: 'シークレット {n} 件', pt: '{n} segredos', de: '{n} Secrets', ko: '시크릿 {n}건' },
  partDestructive: { en: '{n} destructive commands', he: '{n} פקודות הרסניות', es: '{n} comandos destructivos', fr: '{n} commandes destructrices', ru: 'разрушительные команды: {n}', zh: '{n} 个破坏性命令', ja: '破壊的コマンド {n} 件', pt: '{n} comandos destrutivos', de: '{n} destruktive Befehle', ko: '파괴적인 명령 {n}건' },
  partEdits: { en: '{n} risky edits', he: '{n} עריכות מסוכנות', es: '{n} ediciones arriesgadas', fr: '{n} modifications risquées', ru: 'рискованные правки: {n}', zh: '{n} 次高风险编辑', ja: '危険な編集 {n} 件', pt: '{n} edições arriscadas', de: '{n} riskante Änderungen', ko: '위험한 편집 {n}건' },
  partCi: { en: '{n} merges on red CI', he: '{n} מיזוגים על CI אדום', es: '{n} fusiones con CI en rojo', fr: '{n} fusions sur CI rouge', ru: 'слияния при красном CI: {n}', zh: '{n} 次红色 CI 合并', ja: '赤い CI でのマージ {n} 件', pt: '{n} merges com CI vermelho', de: '{n} Merges bei roter CI', ko: '빨간 CI 머지 {n}건' },
  partInjection: { en: '{n} prompt injections', he: '{n} הזרקות פרומפט', es: '{n} inyecciones de prompt', fr: '{n} injections de prompt', ru: 'инъекции в промпт: {n}', zh: '{n} 次提示注入', ja: 'プロンプトインジェクション {n} 件', pt: '{n} injeções de prompt', de: '{n} Prompt-Injections', ko: '프롬프트 인젝션 {n}건' },
  agoNow: { en: 'just now', he: 'הרגע', es: 'ahora', fr: 'à l’instant', ru: 'только что', zh: '刚刚', ja: 'たった今', pt: 'agora há pouco', de: 'gerade eben', ko: '방금' },
  agoMin: { en: '{n} min ago', he: 'לפני {n} דק׳', es: 'hace {n} min', fr: 'il y a {n} min', ru: '{n} мин назад', zh: '{n} 分钟前', ja: '{n} 分前', pt: 'há {n} min', de: 'vor {n} Min.', ko: '{n}분 전' },
  agoHour: { en: '{n} h ago', he: 'לפני {n} שע׳', es: 'hace {n} h', fr: 'il y a {n} h', ru: '{n} ч назад', zh: '{n} 小时前', ja: '{n} 時間前', pt: 'há {n} h', de: 'vor {n} Std.', ko: '{n}시간 전' },
  agoDay: { en: '{n} d ago', he: 'לפני {n} ימים', es: 'hace {n} d', fr: 'il y a {n} j', ru: '{n} дн. назад', zh: '{n} 天前', ja: '{n} 日前', pt: 'há {n} d', de: 'vor {n} T.', ko: '{n}일 전' },
  alt: { en: 'Shield badge', he: 'תג מגן', es: 'Insignia de escudo', fr: 'Badge bouclier', ru: 'Значок щита', zh: '盾牌徽章', ja: 'シールドバッジ', pt: 'Selo de escudo', de: 'Schild-Badge', ko: '방패 배지' },
} as const

const incidents = atom({ plugin: 'toolkitty', key: 'slot', id: 'incidents' } as const, { count: 0, items: [], lastAt: null } as Incidents) as unknown as Atom<Incidents>

export const feature: Feature = {
  id: 'incidents',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const KEEP = 100
const MONTH_MS = 30 * 24 * 60 * 60 * 1000
const CARD_ID = 'incident-card'
const PANE_ID = 'incidents'
const SOUND = 'sounds/shield.wav'

// What the last card shows: the count of this turn's incidents. Module-level on purpose; a render never writes state.
let shown = 0
let cardSize = 0

const SHIELD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 72">' +
  '<path d="M32 4 L58 14 V34 C58 50 46 62 32 68 C18 62 6 50 6 34 V14 Z" fill="#e5484d" fill-opacity="0.15" stroke="#e5484d" stroke-width="3" stroke-linejoin="round"/>' +
  '<path d="M20 36 L29 45 L45 26" fill="none" stroke="#e5484d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>'

const storeKey = (cwd: string): string => `incidents:${cwd}`

const featureName = (id: string): string => {
  const spaced = id.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function agoText(now: number, at: number): string {
  const min = Math.floor(Math.max(0, now - at) / 60000)
  if (min < 1) return t(T.agoNow)
  if (min < 60) return t(T.agoMin, { n: min })
  const hours = Math.floor(min / 60)
  if (hours < 48) return t(T.agoHour, { n: hours })
  return t(T.agoDay, { n: Math.floor(hours / 24) })
}

const SECRET_KINDS = ['secret-file', 'pasted-secret', 'commit-secret']
const DESTRUCTIVE_KINDS = ['dangerous-command', 'blast-radius']
const EDIT_KINDS = ['branch-lock', 'scope']

/** The text the copy button shares: this month's counts by family. */
function shareText(s: Incidents, now: number): string {
  const month = s.items.filter(i => now - i.at <= MONTH_MS)
  if (month.length === 0) return t(T.sharePlain, { n: s.count })
  const countOf = (kinds: readonly string[]): number => month.filter(i => kinds.includes(i.kind)).length
  const parts: string[] = []
  const add = (n: number, text: (typeof T)[keyof typeof T]): void => {
    if (n > 0) parts.push(t(text, { n }))
  }
  add(countOf(SECRET_KINDS), T.partSecrets)
  add(countOf(DESTRUCTIVE_KINDS), T.partDestructive)
  add(countOf(EDIT_KINDS), T.partEdits)
  add(countOf(['ci-red']), T.partCi)
  add(countOf(['injection']), T.partInjection)
  return t(T.shareParts, { n: month.length, parts: parts.join(', ') })
}

function lineText(i: Incident): string {
  return `${featureName(i.feature)} · ${i.kind} · ${i.detail}`
}

/** The card as a picture to save: the shield, the header and one line per incident (feature and kind only, no details), the footer. */
function cardSvg(s: Incidents, items: Incident[]): string {
  const lines = items.slice(-12)
  const W = 560
  const H = 92 + lines.length * 26 + 44
  const font = "'Segoe UI','SF Pro Text',Roboto,Arial,sans-serif"
  let body = ''
  lines.forEach((i, n) => {
    body += `<text x="104" y="${96 + n * 26}" font-family="${font}" font-size="16" fill="#e6e1d8">${escapeXml(`${featureName(i.feature)} · ${i.kind}`)}</text>`
  })
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" rx="14" fill="#1c1b19"/>` +
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="13" fill="none" stroke="#e5484d" stroke-width="2"/>` +
    `<g transform="translate(24 24) scale(0.95)">${SHIELD.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>` +
    `<text x="104" y="52" font-family="${font}" font-size="22" font-weight="700" fill="#e5484d">${escapeXml(t(T.cardHeader, { n: s.count }))}</text>` +
    body +
    `<text x="24" y="${H - 18}" font-family="${font}" font-size="13" fill="#8a857c">${escapeXml(t(T.cardFooter, { n: s.count }))}</text>` +
    `</svg>`
  )
}

async function drawCard($: EngineInterface, e: RenderInput<'Pane'>, s: Incidents): Promise<RenderElement> {
  const { Box, Text } = $.ui.resolve(e)
  const items = s.items.slice(-Math.max(1, cardSize))
  const now = await $.clock.now()
  // Save SVG (details left out) and Copy: the redacted share text, counts by family and nothing else.
  const bar = exportBar($, e, {
      feature: feature.id,
    kind: 'incident',
    svg: e.surface === 'desktop' ? cardSvg(s, items) : undefined,
    text: shareText(s, now),
  })
  const body = (
    <Box flexDirection="column" borderStyle="single" borderColor="error" paddingX={1} marginY={1}>
      <Text bold color="error">
        {t(T.cardHeader, { n: s.count })}
      </Text>
      {items.map((i, n) => (
        <Text key={`card-${n}`}>{lineText(i)}</Text>
      ))}
      <Text dimColor>{t(T.cardFooter, { n: s.count })}</Text>
    </Box>
  )
  if (e.surface !== 'desktop') {
    return (
      <Box flexDirection="column">
        {body}
        {bar}
      </Box>
    )
  }
  const { Svg } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      <Box gap={1} alignItems="center">
        <Svg source={SHIELD} alt={t(T.alt)} width={48} height={54} />
        {body}
      </Box>
      {bar}
    </Box>
  )
}

/** What a press on the band line shows: the last 10 incidents, newest first. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const s = await read($, incidents)
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)
  const rows = s.items.slice(-10).reverse()
  return (
    <Box flexDirection="column">
      {rows.length === 0 ? emptyState($, e, t(T.empty), t(T.emptyHint)) : <Text bold>{t(T.allTime, { n: s.count })}</Text>}
      {rows.map((i, n) => (
        <Text key={`inc-${n}`}>{`${agoText(now, i.at)} · ${lineText(i)}`}</Text>
      ))}
    </Box>
  )
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'incidents', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'incidents', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }

  const cwd = await $.session.cwd()
  const stored = await storeGet<Incidents>($, storeKey(cwd), { count: 0, items: [], lastAt: null })
  await update($, incidents, s =>
    s.count >= stored.count ? s : { count: stored.count, items: stored.items.slice(-KEEP), lastAt: stored.lastAt },
  )
  shown = Math.max(shown, (await read($, incidents)).count)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }

  const s = await read($, incidents)
  if (s.count <= shown) return
  const grew = s.count - shown
  shown = s.count
  cardSize = Math.min(grew, KEEP)
  const newest = s.items[s.items.length - 1]
  await publish($, {
    id: 'incidents:last',
    feature: feature.id,
    kind: 'incident',
    level: 'alert',
    value: s.count,
    text: newest === undefined ? 'incident' : newest.kind,
    ttlMs: 15000,
  })

  try {
    const cwd = await $.session.cwd()
    await storeSet($, storeKey(cwd), { count: s.count, items: s.items.slice(-KEEP), lastAt: s.lastAt ?? null })
  } catch {
    // the counter still lives in memory
  }

  const last = s.items[s.items.length - 1]
  let isCarded = false
  try {
    // A fixed id: the Pane draws the latest turn; invalidate so an open card redraws.
    const opened = await $.ui.open({ id: CARD_ID, title: t(T.cardHeader, { n: s.count }) })
    isCarded = opened.isPlaced
    $.ui.invalidate('ui.render')
  } catch {
    // no surface attached
  }
  if (!isCarded) await notice($, 'alert', t(T.toast, { n: s.count, what: last === undefined ? '' : lineText(last) }), feature.id)

  try {
    if (await $.fs.exists(`${$.plugin.root}/${SOUND}`)) await $.audio.play({ asset: SOUND })
  } catch {
    // no player or no sound: stay silent
  }
}

/** The short band form: "3 prevented". Quiet until something was prevented. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const { count } = await read($, incidents)
  if (count <= 0) return null
  return { text: t(T.chipPrevented, { n: count }), level: 'info', icon: ICONS.guard }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const { count } = await read($, incidents)
  if (count <= 0) return null
  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      {t(T.band, { n: count })}
    </Text>
  )
}

export function register(on: On) {
  on('command.run', { command: 'incidents' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'incident-card' }, async ($, e) => {
    if (!(await isOn($, feature))) return emptyState($, e, t(T.paneOff))
    const s = await read($, incidents)
    if (s.count <= 0) return emptyState($, e, t(T.empty), t(T.emptyHint))
    return drawCard($, e, s)
  })

  on('ui.render', { component: 'Pane', requestId: 'incidents' }, async ($, e) => {
    const { Box } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.guard })}
          {emptyState($, e, t(T.paneOff))}
        </Box>
      )
    }

    const s = await read($, incidents)
    if (s.count <= 0) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.guard })}
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
        </Box>
      )
    }

    const now = await $.clock.now()
    const room = Math.max(3, (e.viewport?.rows ?? 25) - 7)
    const rows = [...s.items].reverse().slice(0, room)
    const share = shareText(s, now)

    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: String(s.count),
          level: 'info',
          icon: ICONS.guard,
          actions: [
            {
              key: 'incidents-copy',
              label: t(T.copy),
              onPress: () => {
                $.ui.copy({ text: share, surface: e.surface }).then(
                  r => notice($, r.isCopied ? 'info' : 'warn', r.isCopied ? t(T.copied) : t(T.copyFailed), feature.id),
                  () => notice($, 'warn', t(T.copyFailed), feature.id),
                )
              },
            },
          ],
        })}
        {sectionTitle($, e, t(T.allTime, { n: s.count }))}
        {rows.map((i, n) => listRow($, e, { key: `inc-${n}`, left: agoText(now, i.at), text: lineText(i) }))}
      </Box>
    )
  })
}
