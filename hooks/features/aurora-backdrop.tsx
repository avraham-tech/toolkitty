import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input } from '../core'
import { BUILTIN_THEMES } from '../themes'
import type { Theme } from '../themes'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Aurora backdrop', he: 'רקע אורורה', es: 'Fondo aurora', fr: 'Fond aurore', ru: 'Фон «Аврора»', zh: '极光背景', ja: 'オーロラ背景', pt: 'Fundo de aurora', de: 'Aurora-Hintergrund', ko: '오로라 배경' },
  description: {
    en: 'Desktop only: a slowly drifting aurora behind the window. Blue and teal when idle, violet while working, amber past 70% context, red past 90%.',
    he: 'שולחן עבודה בלבד: זוהר צפוני שנע לאט ברקע החלון. כחול-טורקיז במנוחה, סגול בעבודה, ענבר מעל 70% הקשר, אדום מעל 90%.',
    es: 'Solo escritorio: una aurora que se desplaza despacio tras la ventana. Azul y turquesa en reposo, violeta al trabajar, ámbar sobre 70% de contexto, rojo sobre 90%.',
    fr: 'Bureau uniquement : une aurore qui dérive lentement derrière la fenêtre. Bleu et turquoise au repos, violet au travail, ambre au-delà de 70 % de contexte, rouge au-delà de 90 %.',
    ru: 'Только для десктопа: медленно плывущее северное сияние за окном. Сине-бирюзовое в покое, фиолетовое в работе, янтарное при контексте выше 70%, красное выше 90%.',
    zh: '仅限桌面版：窗口后方缓缓飘动的极光。空闲时为蓝色和青色，工作时为紫色，上下文超过 70% 为琥珀色，超过 90% 为红色。',
    ja: 'デスクトップ専用: ウィンドウの背後でゆっくり漂うオーロラ。待機中は青とティール、作業中は紫、コンテキストが70%を超えると琥珀色、90%を超えると赤になります。',
    pt: 'Somente no desktop: uma aurora que se move devagar atrás da janela. Azul e verde-azulado em repouso, violeta enquanto trabalha, âmbar acima de 70% de contexto, vermelho acima de 90%.',
    de: 'Nur Desktop: ein langsam driftendes Polarlicht hinter dem Fenster. Blau und Türkis im Leerlauf, Violett bei der Arbeit, Bernstein ab 70 % Kontext, Rot ab 90 %.',
    ko: '데스크톱 전용: 창 뒤에서 천천히 흐르는 오로라. 유휴 시 파랑·청록, 작업 중 보라, 컨텍스트 70% 초과 시 호박색, 90% 초과 시 빨강입니다.',
  },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty',
    ru: 'Функция отключена; включите её в панели /toolkitty',
    zh: '该功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  cmdDesc: {
    en: 'Turns the aurora backdrop on or off for this session (desktop only)',
    he: 'מדליק או מכבה את רקע האורורה בסשן הזה (שולחן עבודה בלבד)',
    es: 'Activa o desactiva el fondo aurora en esta sesión (solo escritorio)',
    fr: 'Active ou désactive le fond aurore pour cette session (bureau uniquement)',
    ru: 'Включает или выключает фон «Аврора» в этой сессии (только десктоп)',
    zh: '为本次会话开启或关闭极光背景（仅限桌面版）',
    ja: 'このセッションのオーロラ背景をオン/オフします（デスクトップ専用）',
    pt: 'Liga ou desliga o fundo de aurora nesta sessão (somente desktop)',
    de: 'Schaltet den Aurora-Hintergrund für diese Session an oder aus (nur Desktop)',
    ko: '이 세션의 오로라 배경을 켜거나 끕니다(데스크톱 전용)',
  },
  notDrawn: { en: 'Aurora: the surface did not draw the backdrop ({reason}).', he: 'Aurora: המשטח לא צייר את הרקע ({reason}).', es: 'Aurora: la superficie no dibujó el fondo ({reason}).', fr: 'Aurora : la surface n’a pas dessiné l’arrière-plan ({reason}).', ru: 'Aurora: поверхность не нарисовала фон ({reason}).', zh: '极光：当前界面未绘制背景（{reason}）。', ja: 'オーロラ: この画面では背景が描画されませんでした（{reason}）。', pt: 'Aurora: a interface não desenhou o fundo ({reason}).', de: 'Aurora: Die Oberfläche hat den Hintergrund nicht gezeichnet ({reason}).', ko: '오로라: 이 화면에서 배경을 그리지 못했습니다({reason}).' },
  lastResult: { en: 'last attempt: {result}', he: 'ניסיון אחרון: {result}', es: 'último intento: {result}', fr: 'dernière tentative : {result}', ru: 'последняя попытка: {result}', zh: '上次尝试：{result}', ja: '前回の試行: {result}', pt: 'última tentativa: {result}', de: 'letzter Versuch: {result}', ko: '마지막 시도: {result}' },
  desktopOnly: {
    en: 'The aurora backdrop works in the desktop app only; this terminal cannot draw it.',
    he: 'רקע האורורה עובד באפליקציית שולחן העבודה בלבד; הטרמינל הזה לא יכול לצייר אותו.',
    es: 'El fondo aurora solo funciona en la aplicación de escritorio; este terminal no puede dibujarlo.',
    fr: 'Le fond aurore ne fonctionne que dans l’application de bureau ; ce terminal ne peut pas le dessiner.',
    ru: 'Фон «Аврора» работает только в десктопном приложении; этот терминал не может его нарисовать.',
    zh: '极光背景仅在桌面应用中可用；此终端无法绘制。',
    ja: 'オーロラ背景はデスクトップアプリでのみ動作します。このターミナルでは描画できません。',
    pt: 'O fundo de aurora só funciona no app desktop; este terminal não consegue desenhá-lo.',
    de: 'Der Aurora-Hintergrund funktioniert nur in der Desktop-App; dieses Terminal kann ihn nicht zeichnen.',
    ko: '오로라 배경은 데스크톱 앱에서만 작동합니다. 이 터미널에서는 그릴 수 없습니다.',
  },
  enabled: { en: 'Aurora backdrop on.', he: 'רקע האורורה פועל.', es: 'Fondo aurora activado.', fr: 'Fond aurore activé.', ru: 'Фон «Аврора» включён.', zh: '极光背景已开启。', ja: 'オーロラ背景をオンにしました。', pt: 'Fundo de aurora ativado.', de: 'Aurora-Hintergrund an.', ko: '오로라 배경이 켜졌습니다.' },
  disabled: { en: 'Aurora backdrop off.', he: 'רקע האורורה כבוי.', es: 'Fondo aurora desactivado.', fr: 'Fond aurore désactivé.', ru: 'Фон «Аврора» выключен.', zh: '极光背景已关闭。', ja: 'オーロラ背景をオフにしました。', pt: 'Fundo de aurora desativado.', de: 'Aurora-Hintergrund aus.', ko: '오로라 배경이 꺼졌습니다.' },
  alt: {
    en: 'A slowly drifting aurora of blurred color',
    he: 'זוהר צפוני מטושטש שנע לאט',
    es: 'Una aurora de color difuminado que se desplaza despacio',
    fr: 'Une aurore de couleurs floues qui dérive lentement',
    ru: 'Медленно плывущее размытое цветное сияние',
    zh: '缓缓飘动的模糊色彩极光',
    ja: 'ぼかした色がゆっくり漂うオーロラ',
    pt: 'Uma aurora de cores desfocadas que se move devagar',
    de: 'Ein langsam driftendes Polarlicht aus verschwommenen Farben',
    ko: '흐릿한 색이 천천히 흐르는 오로라',
  },
} as const

type Level = 'ok' | 'warn' | 'hot'
type State = { wanted: boolean; working: boolean; level: Level; lastResult?: string }

const aurora = atom({ plugin: 'toolkitty', key: 'slot', id: 'aurora-backdrop' } as const, { wanted: true, working: false, level: 'ok' } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'aurora-backdrop',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

type Palette = { bg: [string, string]; blobs: [string, string, string]; speed: [number, number, number] }
type Mode = 'idle' | 'working' | 'warn' | 'hot'

// The classic theme keeps its hand-picked backgrounds; any other theme darkens its own blob colors.
const SPEEDS: Record<Mode, [number, number, number]> = { idle: [38, 31, 26], working: [19, 15, 12], warn: [34, 28, 23], hot: [24, 19, 15] }
const CLASSIC_BG: Record<Mode, [string, string]> = {
  idle: ['#040a18', '#071c2e'],
  working: ['#0a0418', '#1a0a32'],
  warn: ['#150b02', '#261303'],
  hot: ['#150409', '#260709'],
}

// The shared theme slot, the same ref as in themes.tsx; the Backdrop hook reads it, so a switch redraws.
const theme = atom({ plugin: 'toolkitty', key: 'slot', id: 'theme' } as const, BUILTIN_THEMES[0] as Theme) as unknown as Atom<Theme>

let isUp = false

const levelOf = (percent: number | undefined): Level => (percent === undefined ? 'ok' : percent > 90 ? 'hot' : percent > 70 ? 'warn' : 'ok')

/** `hex` (#rrggbb) with each channel scaled by `f`; a near-black fallback for anything else. */
function shade(hex: string, f: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#05070f'
  const ch = (i: number): string =>
    Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * f)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(0)}${ch(1)}${ch(2)}`
}

function paletteOf(s: State, th: Theme): Palette {
  const mode: Mode = s.level === 'hot' ? 'hot' : s.level === 'warn' ? 'warn' : s.working ? 'working' : 'idle'
  const blobs = th.aurora[mode === 'hot' ? 'danger' : mode]
  const bg: [string, string] = th.id === 'classic' ? CLASSIC_BG[mode] : [shade(blobs[0], 0.1), shade(blobs[1], 0.18)]
  return { bg, blobs, speed: SPEEDS[mode] }
}

const SPLINE = '.45 0 .55 1;.45 0 .55 1;.45 0 .55 1'

function drift(attr: 'cx' | 'cy', values: number[], dur: number, begin: number): string {
  return `<animate attributeName="${attr}" values="${values.join(';')}" keyTimes="0;.33;.66;1" calcMode="spline" keySplines="${SPLINE}" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite"/>`
}

function auroraSvg(s: State, th: Theme): string {
  const p = paletteOf(s, th)
  const [c0, c1, c2] = p.blobs
  const [d0, d1, d2] = p.speed
  const grad = (id: string, c: string): string =>
    `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".85"/><stop offset=".5" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
  const ribbon = (dFrom: string, dTo: string, c: string, dur: number, begin: number): string =>
    `<path d="${dFrom}" fill="none" stroke="${c}" stroke-width="130" stroke-linecap="round" opacity=".22">` +
    `<animate attributeName="d" values="${dFrom};${dTo};${dFrom}" dur="${dur}s" begin="${-begin}s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/></path>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></linearGradient>` +
    grad('a', c0) +
    grad('b', c1) +
    grad('c', c2) +
    `<radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>` +
    `<filter id="bl" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="38"/></filter></defs>` +
    `<rect width="1600" height="900" fill="url(#bg)"/>` +
    `<circle cx="300" cy="250" r="680" fill="url(#a)">${drift('cx', [300, 1050, 650, 300], d0, 0)}${drift('cy', [250, 520, 120, 250], d0 * 1.2, 4)}</circle>` +
    `<circle cx="1200" cy="650" r="620" fill="url(#b)">${drift('cx', [1200, 500, 900, 1200], d1, 7)}${drift('cy', [650, 300, 760, 650], d1 * 1.1, 2)}</circle>` +
    `<circle cx="820" cy="780" r="720" fill="url(#c)">${drift('cx', [820, 1350, 260, 820], d2, 11)}${drift('cy', [780, 620, 840, 780], d2 * 1.3, 5)}</circle>` +
    `<g filter="url(#bl)">` +
    ribbon('M-100 520C300 380 600 680 900 480S1400 380 1700 520', 'M-100 420C300 600 600 360 900 560S1400 560 1700 400', c1, d0 * 0.9, 3) +
    ribbon('M-100 300C250 200 650 420 950 280S1450 200 1700 320', 'M-100 380C250 300 650 200 950 360S1450 420 1700 260', c0, d1 * 1.1, 9) +
    `</g>` +
    `<rect width="1600" height="900" fill="url(#v)"/>` +
    `</svg>`
  )
}

// ---------- keeping the backdrop up or down ----------

async function sync($: EngineInterface): Promise<void> {
  const active = await isOn($, feature)
  const s = await read($, aurora)
  if (active && s.wanted) {
    if (isUp) return
    try {
      if (!(await $.session.surfaces()).includes('desktop')) return
      const result = await $.ui.backdrop({ id: 'aurora', glass: { blur: 18, opacity: 0.5 } })
      if (result.isDrawn) {
        isUp = true
        await update($, aurora, cur => ({ ...cur, lastResult: 'drawn' }))
      } else {
        // The surface refused or cannot draw backdrops: say why once, and try again next turn.
        const reason = result.reason
        if (s.lastResult !== reason) {
          await update($, aurora, cur => ({ ...cur, lastResult: reason }))
          await notice($, 'warn', t(T.notDrawn, { reason }), feature.id)
        }
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      if (s.lastResult !== reason) {
        await update($, aurora, cur => ({ ...cur, lastResult: reason }))
        await notice($, 'warn', t(T.notDrawn, { reason }), feature.id)
      }
    }
    return
  }
  if (isUp) {
    isUp = false
    try {
      await $.ui.backdrop(undefined)
    } catch {
      // the surface went away
    }
  }
}

async function setWorking($: EngineInterface, working: boolean): Promise<void> {
  const s = await read($, aurora)
  if (s.working !== working) await update($, aurora, cur => ({ ...cur, working }))
}

async function setLevel($: EngineInterface, percent: number | undefined): Promise<void> {
  const level = levelOf(percent)
  const s = await read($, aurora)
  if (s.level !== level) await update($, aurora, cur => ({ ...cur, level }))
}

// ---------- handlers ----------

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'aurora', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'aurora', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  await sync($)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (await isOn($, feature)) await setWorking($, true)
  await sync($)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (await isOn($, feature)) {
    await setWorking($, false)
    const usage = await $.session.usage()
    await setLevel($, usage.context.percent)
  }
  await sync($)
}

export async function onMeasure($: EngineInterface, e: Input<'session.measure'>): Promise<void> {
  if (!(await isOn($, feature))) return
  await setLevel($, e.context.percent)
}

export function register(on: On) {
  on('command.run', { command: 'aurora' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    let hasDesktop = false
    try {
      hasDesktop = (await $.session.surfaces()).includes('desktop')
    } catch {
      hasDesktop = false
    }
    if (!hasDesktop) return { text: t(T.desktopOnly) }
    const wanted = !(await read($, aurora)).wanted
    await update($, aurora, cur => ({ ...cur, wanted }))
    await sync($)
    const last = (await read($, aurora)).lastResult
    return { text: (wanted ? t(T.enabled) : t(T.disabled)) + (last !== undefined ? ` · ${t(T.lastResult, { result: last })}` : '') }
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (!(await isOn($, feature))) return next(e)
    if (e.props.id !== 'aurora') return next(e)
    if (e.surface !== 'desktop') return next(e)
    const s = await read($, aurora)
    if (!s.wanted) return next(e)
    const th = await read($, theme)
    const { Svg } = $.ui.resolve(e)
    return <Svg source={auroraSvg(s, th)} alt={t(T.alt)} isInteractive />
  })
}
