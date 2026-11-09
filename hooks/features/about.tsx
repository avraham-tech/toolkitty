import type { EngineInterface, On, RenderSurface } from 'claude-code'

import { AUTHOR_NAME, AUTHOR_URL, LICENSE, REPO_URL, isPlaceholder, supportLink } from '../credits'
import { LANGS, LANG_NAMES, isOn, notice, storeGet, storeSet, t } from '../core'
import type { BandInput, Feature, Input } from '../core'
import { ICONS, paneHeader, sectionTitle } from '../ui'
import type { Chip, HeaderAction } from '../ui'

// The catalogue is injected by register.tsx (an import of './index' would be circular).
let catalog: Feature[] = []

/** Called once by register.tsx before any hook runs. */
export function setCatalog(list: Feature[]): void {
  catalog = list
}

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'About & support', he: 'אודות ותמיכה', es: 'Acerca de y apoyo', fr: 'À propos et soutien', ru: 'О проекте и поддержка', zh: '关于与支持', ja: '概要とサポート', pt: 'Sobre e apoio', de: 'Über & Support', ko: '정보 및 후원' },
  description: {
    en: 'Version, credits and links; /about opens it. After many sessions the weekly report may mention an optional symbolic coffee, once, and never again if you dismiss it.',
    he: 'גרסה, קרדיטים וקישורים; /about פותח אותו. אחרי הרבה סשנים הדוח השבועי עשוי להזכיר קפה סמלי אופציונלי, פעם אחת, ולא יחזור אם תסגור אותו.',
    es: 'Versión, créditos y enlaces; /about lo abre. Tras muchas sesiones el informe semanal puede mencionar un café simbólico opcional, una vez, y nunca más si lo descartas.',
    fr: 'Version, crédits et liens ; /about l’ouvre. Après de nombreuses sessions, le rapport hebdomadaire peut mentionner un café symbolique facultatif, une seule fois, et plus jamais si vous le fermez.',
    ru: 'Версия, авторы и ссылки; /about открывает панель. После многих сессий недельный отчёт может упомянуть необязательный символический кофе один раз и больше не вернётся, если его закрыть.',
    zh: '版本、致谢和链接；/about 可打开。使用多个会话后，每周报告可能会提及一次可选的象征性咖啡，关闭后不再出现。',
    ja: 'バージョン、クレジット、リンク。/about で開きます。多くのセッションの後、週次レポートに任意の象徴的なコーヒーの案内が一度だけ表示されることがあり、閉じれば二度と表示されません。',
    pt: 'Versão, créditos e links; /about abre o painel. Depois de muitas sessões, o relatório semanal pode mencionar um café simbólico opcional, uma única vez, e nunca mais se você dispensar.',
    de: 'Version, Credits und Links; /about öffnet das Panel. Nach vielen Sessions kann der Wochenbericht einmal einen freiwilligen symbolischen Kaffee erwähnen, und nie wieder, wenn du ihn schließt.',
    ko: '버전, 크레딧, 링크를 보여 줍니다. /about으로 엽니다. 세션이 많이 쌓이면 주간 리포트에 선택 사항인 상징적 커피 후원 안내가 한 번 나올 수 있으며, 닫으면 다시 나오지 않습니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  cmdDesc: { en: 'Shows the Toolkitty version, credits and support links', he: 'מציג את גרסת Toolkitty, הקרדיטים וקישורי התמיכה', es: 'Muestra la versión, los créditos y los enlaces de apoyo de Toolkitty', fr: 'Affiche la version, les crédits et les liens de soutien de Toolkitty', ru: 'Показывает версию Toolkitty, авторов и ссылки для поддержки', zh: '显示 Toolkitty 版本、致谢和支持链接', ja: 'Toolkitty のバージョン、クレジット、サポートリンクを表示します', pt: 'Mostra a versão, os créditos e os links de apoio do Toolkitty', de: 'Zeigt Version, Credits und Support-Links von Toolkitty', ko: 'Toolkitty 버전, 크레딧, 후원 링크를 보여 줍니다' },
  opened: { en: 'Opened the About pane.', he: 'חלונית האודות נפתחה.', es: 'Panel «Acerca de» abierto.', fr: 'Panneau « À propos » ouvert.', ru: 'Панель «О проекте» открыта.', zh: '已打开“关于”面板。', ja: '「概要」ペインを開きました。', pt: 'Painel Sobre aberto.', de: 'Über-Panel geöffnet.', ko: '정보 창을 열었습니다.' },
  paneTitle: { en: 'About Toolkitty', he: 'אודות Toolkitty', es: 'Acerca de Toolkitty', fr: 'À propos de Toolkitty', ru: 'О Toolkitty', zh: '关于 Toolkitty', ja: 'Toolkitty について', pt: 'Sobre o Toolkitty', de: 'Über Toolkitty', ko: 'Toolkitty 정보' },
  paneOff: { en: 'The About pane is off.', he: 'חלונית האודות כבויה.', es: 'El panel «Acerca de» está desactivado.', fr: 'Le panneau « À propos » est désactivé.', ru: 'Панель «О проекте» выключена.', zh: '“关于”面板已关闭。', ja: '「概要」ペインはオフです。', pt: 'O painel Sobre está desativado.', de: 'Das Über-Panel ist aus.', ko: '정보 창이 꺼져 있습니다.' },
  version: { en: 'Version {v}', he: 'גרסה {v}', es: 'Versión {v}', fr: 'Version {v}', ru: 'Версия {v}', zh: '版本 {v}', ja: 'バージョン {v}', pt: 'Versão {v}', de: 'Version {v}', ko: '버전 {v}' },
  versionUnknown: { en: 'unknown', he: 'לא ידועה', es: 'desconocida', fr: 'inconnue', ru: 'неизвестна', zh: '未知', ja: '不明', pt: 'desconhecida', de: 'unbekannt', ko: '알 수 없음' },
  madeBy: { en: 'Made by {name}', he: 'נוצר על ידי {name}', es: 'Creado por {name}', fr: 'Créé par {name}', ru: 'Автор: {name}', zh: '作者：{name}', ja: '作者: {name}', pt: 'Feito por {name}', de: 'Von {name}', ko: '제작: {name}' },
  featureCount: { en: '{n} features', he: '{n} שכלולים', es: '{n} funciones', fr: '{n} fonctions', ru: 'функций: {n}', zh: '{n} 个功能', ja: '{n} 個の機能', pt: '{n} recursos', de: '{n} Funktionen', ko: '기능 {n}개' },
  languages: { en: 'Languages: {list}', he: 'שפות: {list}', es: 'Idiomas: {list}', fr: 'Langues : {list}', ru: 'Языки: {list}', zh: '语言：{list}', ja: '言語: {list}', pt: 'Idiomas: {list}', de: 'Sprachen: {list}', ko: '언어: {list}' },
  license: { en: 'License: {license}', he: 'רישיון: {license}', es: 'Licencia: {license}', fr: 'Licence : {license}', ru: 'Лицензия: {license}', zh: '许可证：{license}', ja: 'ライセンス: {license}', pt: 'Licença: {license}', de: 'Lizenz: {license}', ko: '라이선스: {license}' },
  author: { en: 'Author: {url}', he: 'מחבר: {url}', es: 'Autor: {url}', fr: 'Auteur : {url}', ru: 'Автор: {url}', zh: '作者：{url}', ja: '作者: {url}', pt: 'Autor: {url}', de: 'Autor: {url}', ko: '작성자: {url}' },
  repo: { en: 'Repository: {url}', he: 'מאגר: {url}', es: 'Repositorio: {url}', fr: 'Dépôt : {url}', ru: 'Репозиторий: {url}', zh: '仓库：{url}', ja: 'リポジトリ: {url}', pt: 'Repositório: {url}', de: 'Repository: {url}', ko: '저장소: {url}' },
  copyRepo: { en: 'Copy repo link', he: 'העתק קישור למאגר', es: 'Copiar enlace del repositorio', fr: 'Copier le lien du dépôt', ru: 'Копировать ссылку на репозиторий', zh: '复制仓库链接', ja: 'リポジトリのリンクをコピー', pt: 'Copiar link do repositório', de: 'Repo-Link kopieren', ko: '저장소 링크 복사' },
  copySupport: { en: 'Copy support link', he: 'העתק קישור לתמיכה', es: 'Copiar enlace de apoyo', fr: 'Copier le lien de soutien', ru: 'Копировать ссылку для поддержки', zh: '复制支持链接', ja: 'サポートリンクをコピー', pt: 'Copiar link de apoio', de: 'Support-Link kopieren', ko: '후원 링크 복사' },
  copyThanks: { en: 'Copy "thanks" post', he: 'העתק פוסט תודה', es: 'Copiar publicación de agradecimiento', fr: 'Copier le message de remerciement', ru: 'Копировать пост с благодарностью', zh: '复制“感谢”帖子', ja: '「ありがとう」の投稿をコピー', pt: 'Copiar post de agradecimento', de: '„Danke“-Post kopieren', ko: '“감사” 게시글 복사' },
  copiedRepo: { en: 'Repo link copied', he: 'הקישור למאגר הועתק', es: 'Enlace del repositorio copiado', fr: 'Lien du dépôt copié', ru: 'Ссылка на репозиторий скопирована', zh: '已复制仓库链接', ja: 'リポジトリのリンクをコピーしました', pt: 'Link do repositório copiado', de: 'Repo-Link kopiert', ko: '저장소 링크를 복사했습니다' },
  copiedSupport: { en: 'Support link copied', he: 'קישור התמיכה הועתק', es: 'Enlace de apoyo copiado', fr: 'Lien de soutien copié', ru: 'Ссылка для поддержки скопирована', zh: '已复制支持链接', ja: 'サポートリンクをコピーしました', pt: 'Link de apoio copiado', de: 'Support-Link kopiert', ko: '후원 링크를 복사했습니다' },
  copiedThanks: { en: 'Post copied, thank you!', he: 'הפוסט הועתק, תודה!', es: 'Publicación copiada, ¡gracias!', fr: 'Message copié, merci !', ru: 'Пост скопирован, спасибо!', zh: '帖子已复制，谢谢！', ja: '投稿をコピーしました。ありがとうございます！', pt: 'Post copiado, obrigado!', de: 'Post kopiert, danke!', ko: '게시글을 복사했습니다. 감사합니다!' },
  copyFailed: { en: 'Could not copy', he: 'לא ניתן להעתיק', es: 'No se pudo copiar', fr: 'Impossible de copier', ru: 'Не удалось скопировать', zh: '无法复制', ja: 'コピーできませんでした', pt: 'Não foi possível copiar', de: 'Kopieren fehlgeschlagen', ko: '복사할 수 없습니다' },
  supportHead: { en: 'Support', he: 'תמיכה', es: 'Apoyo', fr: 'Soutien', ru: 'Поддержка', zh: '支持', ja: 'サポート', pt: 'Apoio', de: 'Support', ko: '후원' },
  supportText: {
    en: 'Toolkitty is free. If it saved you time, a symbolic coffee (1 to 5 dollars) is welcome. There is no obligation and nothing is locked.',
    he: 'Toolkitty חינמי. אם הוא חסך לך זמן, קפה סמלי (1 עד 5 דולרים) יתקבל בברכה. אין שום חובה ושום דבר לא נעול.',
    es: 'Toolkitty es gratis. Si te ahorró tiempo, un café simbólico (de 1 a 5 dólares) es bienvenido. No hay obligación y nada está bloqueado.',
    fr: 'Toolkitty est gratuit. S’il vous a fait gagner du temps, un café symbolique (1 à 5 dollars) est le bienvenu. Aucune obligation, rien n’est verrouillé.',
    ru: 'Toolkitty бесплатен. Если он сэкономил вам время, символический кофе (1–5 долларов) будет приятен. Это ни к чему не обязывает, ничего не заблокировано.',
    zh: 'Toolkitty 免费。如果它为你节省了时间，欢迎请我们喝一杯象征性的咖啡（1 到 5 美元）。没有任何义务，也没有功能被锁定。',
    ja: 'Toolkitty は無料です。時間の節約になったなら、象徴的なコーヒー（1〜5ドル）をいただけると嬉しいです。義務はなく、ロックされる機能もありません。',
    pt: 'O Toolkitty é gratuito. Se ele economizou seu tempo, um café simbólico (1 a 5 dólares) é bem-vindo. Não há obrigação e nada fica bloqueado.',
    de: 'Toolkitty ist kostenlos. Wenn es dir Zeit gespart hat, freuen wir uns über einen symbolischen Kaffee (1 bis 5 Dollar). Keine Verpflichtung, nichts ist gesperrt.',
    ko: 'Toolkitty은 무료입니다. 시간을 아껴 주었다면 상징적인 커피(1~5달러) 한 잔 후원을 환영합니다. 의무는 없으며 잠기는 기능도 없습니다.',
  },
  footer: {
    en: 'If Toolkitty saved you time, a symbolic coffee is welcome: {link}',
    he: 'אם ה-Toolkitty חסך לך זמן, קפה סמלי יתקבל בברכה: {link}',
    es: 'Si el toolkitty te ahorró tiempo, un café simbólico es bienvenido: {link}',
    fr: 'Si le toolkitty vous a fait gagner du temps, un café symbolique est le bienvenu : {link}',
    ru: 'Если Toolkitty сэкономил вам время, символический кофе будет приятен: {link}',
    zh: '如果 Toolkitty 为你节省了时间，欢迎请我们喝一杯象征性的咖啡：{link}',
    ja: 'Toolkitty が時間の節約になったなら、象徴的なコーヒーをいただけると嬉しいです: {link}',
    pt: 'Se o Toolkitty economizou seu tempo, um café simbólico é bem-vindo: {link}',
    de: 'Wenn das Toolkitty dir Zeit gespart hat, freuen wir uns über einen symbolischen Kaffee: {link}',
    ko: 'Toolkitty이 시간을 아껴 주었다면 상징적인 커피 한 잔 후원을 환영합니다: {link}',
  },
  dismiss: { en: 'Dismiss', he: 'סגור', es: 'Descartar', fr: 'Fermer', ru: 'Скрыть', zh: '关闭', ja: '閉じる', pt: 'Dispensar', de: 'Schließen', ko: '닫기' },
} as const

export const feature: Feature = {
  id: 'about',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const PANE_ID = 'about'
const NAME = 'Toolkitty'
const SESSIONS_KEY = 'about:sessions'
const DISMISSED_KEY = 'about:supportDismissed'
/** Sessions with Toolkitty before the weekly report may mention the coffee. */
const REMINDER_AFTER = 30

/** The "thanks" post people can paste anywhere; English on purpose, a post is shared outside the app. */
function thanksPost(): string {
  return `I have been using Toolkitty, a free plugin for Claude Code with dozens of small quality-of-life features: guards against costly mistakes, a weekly report, cost and cache helpers. It has saved me time, and it is open source: ${REPO_URL}`
}

/** The link the weekly report's support line shows; null while there is nothing to show (not yet due, dismissed, off, or no real link). */
let footerLink: string | null = null
/** plugin.json's version, read once. */
let versionCache: string | null = null

/** The weekly report's single support line, or null. Plain function: the report calls it while drawing. */
export function supportFooter(): string | null {
  return footerLink === null ? null : t(T.footer, { link: footerLink })
}

/** The label of the report's Dismiss button, in the language in use. */
export function dismissLabel(): string {
  return t(T.dismiss)
}

/** Dismiss pressed in the weekly report: the line never comes back. */
export async function dismissSupport($: EngineInterface): Promise<void> {
  footerLink = null
  await storeSet($, DISMISSED_KEY, true)
  $.ui.invalidate('ui.render')
}

async function readVersion($: EngineInterface): Promise<string | null> {
  if (versionCache !== null) return versionCache
  try {
    const raw = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object') {
      const v = (parsed as Record<string, unknown>)['version']
      if (typeof v === 'string' && v !== '') {
        versionCache = v
        return v
      }
    }
  } catch {
    // unreadable: unknown version
  }
  return null
}

async function copyOut($: EngineInterface, surface: RenderSurface, text: string, done: string): Promise<void> {
  try {
    const res = await $.ui.copy({ text, surface })
    if (res.isCopied) await notice($, 'info', done, feature.id, { immediate: true })
    else await notice($, 'warn', t(T.copyFailed), feature.id, { immediate: true })
  } catch {
    await notice($, 'warn', t(T.copyFailed), feature.id, { immediate: true })
  }
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  void e
  try {
    await $.command.register({ name: 'about', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'about', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  footerLink = null
  if (!(await isOn($, feature))) return
  const sessions = (await storeGet<number>($, SESSIONS_KEY, 0)) + 1
  await storeSet($, SESSIONS_KEY, sessions)
  const dismissed = await storeGet<boolean>($, DISMISSED_KEY, false)
  footerLink = !dismissed && sessions >= REMINDER_AFTER ? supportLink() : null
}

/** No band chip: this feature never speaks in the band. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  void e
  if (!(await isOn($, feature))) return null
  return null
}

export function register(on: On) {
  on('command.run', { command: 'about' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle), focus: true, closeOnEscape: true })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'about' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const version = await readVersion($)
    const link = supportLink()
    const actions: HeaderAction[] = [{ key: 'about-copy-repo', label: t(T.copyRepo), onPress: () => copyOut($, e.surface, REPO_URL, t(T.copiedRepo)) }]
    if (link !== null) actions.push({ key: 'about-copy-support', label: t(T.copySupport), onPress: () => copyOut($, e.surface, link, t(T.copiedSupport)) })
    actions.push({ key: 'about-copy-thanks', label: t(T.copyThanks), onPress: () => copyOut($, e.surface, thanksPost(), t(T.copiedThanks)) })

    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader($, e, { title: t(T.paneTitle), status: version ?? t(T.versionUnknown), level: 'info', icon: ICONS.setup, actions })}
        <Box flexDirection="column">
          <Text bold>{NAME}</Text>
          <Text>{t(T.version, { v: version ?? t(T.versionUnknown) })}</Text>
          <Text>{t(T.madeBy, { name: AUTHOR_NAME })}</Text>
          {isPlaceholder(AUTHOR_URL) ? null : <Text dimColor>{t(T.author, { url: AUTHOR_URL })}</Text>}
        </Box>
        <Box flexDirection="column">
          <Text>{t(T.featureCount, { n: catalog.length })}</Text>
          <Text>{t(T.languages, { list: LANGS.map(l => LANG_NAMES[l]).join(', ') })}</Text>
          <Text>{t(T.license, { license: LICENSE })}</Text>
          <Text dimColor>{t(T.repo, { url: REPO_URL })}</Text>
        </Box>
        {link === null ? null : (
          <Box flexDirection="column">
            {sectionTitle($, e, t(T.supportHead))}
            <Text>{t(T.supportText)}</Text>
            <Text dimColor>{link}</Text>
          </Box>
        )}
      </Box>
    )
  })
}
