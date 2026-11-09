import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, Timer } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { Feature, Input } from '../core'
import { openHandoff } from './handoff'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: {
    en: 'Idle handoff',
    he: 'העברה אחרי חוסר פעילות',
    es: 'Traspaso tras inactividad',
    fr: 'Relais après inactivité',
    ru: 'Сжатие после простоя',
    zh: '空闲交接',
    ja: 'アイドル時の引き継ぎ',
    pt: 'Transferência ociosa',
    de: 'Übergabe bei Inaktivität',
    ko: '유휴 인수인계',
  },
  description: {
    en: 'After a long idle, when the context is large and the cache is cold, suggests /handoff to compact the session cheaply.',
    he: 'אחרי חוסר פעילות ממושך, כשההקשר גדול והמטמון קר, מציע /handoff לדחיסת הסשן בזול.',
    es: 'Tras una inactividad larga, con un contexto grande y la caché fría, sugiere /handoff para compactar la sesión a bajo coste.',
    fr: 'Après une longue inactivité, quand le contexte est grand et le cache froid, suggère /handoff pour compacter la session à moindre coût.',
    ru: 'После долгого простоя, когда контекст велик, а кэш остыл, предлагает /handoff для дешёвого сжатия сессии.',
    zh: '长时间空闲后，如果上下文很大且缓存已冷，会建议用 /handoff 低成本压缩会话。',
    ja: '長時間アイドルが続き、コンテキストが大きくキャッシュも冷えているときに、/handoff で安くセッションを圧縮するよう提案します。',
    pt: 'Após uma longa inatividade, com contexto grande e cache frio, sugere /handoff para compactar a sessão de forma barata.',
    de: 'Schlägt nach langer Inaktivität bei großem Kontext und kaltem Cache /handoff vor, um die Sitzung günstig zu komprimieren.',
    ko: '오래 쉬고 나서 컨텍스트가 크고 캐시가 식었을 때, /handoff로 세션을 저렴하게 압축하도록 제안합니다.',
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
    de: 'Die Funktion ist aus; schalte sie im /toolkitty-Bereich ein',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요',
  },
  idleToast: {
    en: 'Idle for {minutes} min: the prompt cache has gone cold and the context is {percent}% full. /handoff compacts the session cheaply.',
    he: 'לא פעיל {minutes} דקות: מטמון הפרומפט התקרר וההקשר מלא ב-{percent}%. /handoff דוחס את הסשן בזול.',
    es: 'Inactivo {minutes} min: la caché del prompt se ha enfriado y el contexto está al {percent}%. /handoff compacta la sesión a bajo coste.',
    fr: 'Inactif depuis {minutes} min : le cache du prompt est froid et le contexte est plein à {percent} %. /handoff compacte la session à moindre coût.',
    ru: 'Простой {minutes} мин: кэш промпта остыл, контекст заполнен на {percent}%. /handoff дёшево сожмёт сессию.',
    zh: '已空闲 {minutes} 分钟：提示缓存已冷，上下文已占 {percent}%。/handoff 可低成本压缩会话。',
    ja: '{minutes} 分間アイドル: プロンプトキャッシュが冷え、コンテキストは {percent}% 使用中です。/handoff なら安くセッションを圧縮できます。',
    pt: 'Inativo há {minutes} min: o cache do prompt esfriou e o contexto está {percent}% cheio. /handoff compacta a sessão de forma barata.',
    de: '{minutes} Min. inaktiv: Der Prompt-Cache ist kalt und der Kontext ist zu {percent} % voll. /handoff komprimiert die Sitzung günstig.',
    ko: '{minutes}분째 유휴: 프롬프트 캐시가 식었고 컨텍스트가 {percent}% 찼습니다. /handoff로 세션을 저렴하게 압축할 수 있습니다.',
  },
  handoffDesc: {
    en: 'Opens a handoff preview (goal, done, decisions, files, failures, next step); Compact now compacts with exactly that draft',
    he: 'פותח תצוגה מקדימה להעברה (מטרה, הושלם, החלטות, קבצים, כשלים, צעד הבא); דחוס עכשיו דוחס בדיוק לפי הטיוטה',
    es: 'Abre una vista previa del traspaso (objetivo, hecho, decisiones, archivos, fallos, siguiente paso); Compactar ahora compacta con ese borrador',
    fr: 'Ouvre un aperçu du relais (objectif, fait, décisions, fichiers, échecs, suite) ; Compacter maintenant compacte avec ce brouillon',
    ru: 'Открывает предпросмотр передачи (цель, сделано, решения, файлы, сбои, следующий шаг); «Сжать сейчас» сжимает по этому черновику',
    zh: '打开交接预览（目标、已完成、决策、文件、失败、下一步）；「立即压缩」严格按该草稿压缩',
    ja: '引き継ぎプレビュー（目標、完了、決定、ファイル、失敗、次のステップ）を開きます。「今すぐ圧縮」でそのドラフトどおりに圧縮します',
    pt: 'Abre uma prévia da transferência (objetivo, feito, decisões, arquivos, falhas, próximo passo); Compactar agora compacta exatamente com esse rascunho',
    de: 'Öffnet eine Übergabe-Vorschau (Ziel, Erledigtes, Entscheidungen, Dateien, Fehler, nächster Schritt); Jetzt komprimieren komprimiert genau mit diesem Entwurf',
    ko: '인수인계 미리보기(목표, 완료, 결정, 파일, 실패, 다음 단계)를 엽니다. 지금 압축은 정확히 그 초안으로 압축합니다',
  },
  idleDesc: {
    en: 'Sets the idle minutes before the handoff suggestion (default 20)',
    he: 'קובע את דקות חוסר הפעילות לפני הצעת ההעברה (ברירת מחדל 20)',
    es: 'Define los minutos de inactividad antes de sugerir el traspaso (por defecto 20)',
    fr: 'Définit les minutes d\'inactivité avant la suggestion de relais (20 par défaut)',
    ru: 'Задаёт минуты простоя до предложения сжатия (по умолчанию 20)',
    zh: '设置提出交接建议前的空闲分钟数（默认 20）',
    ja: '引き継ぎを提案するまでのアイドル時間（分）を設定します（デフォルト 20）',
    pt: 'Define os minutos de inatividade antes da sugestão de transferência (padrão 20)',
    de: 'Legt die Inaktivitätsminuten vor dem Übergabe-Vorschlag fest (Standard 20)',
    ko: '인수인계를 제안하기 전까지의 유휴 시간(분)을 설정합니다 (기본값 20)',
  },
  minutesHint: { en: '[minutes]', he: '[דקות]', es: '[minutos]', fr: '[minutes]', ru: '[минуты]', zh: '[分钟]', ja: '[分]', pt: '[minutos]', de: '[Minuten]', ko: '[분]' },
  current: {
    en: 'Idle handoff suggests /handoff after {minutes} idle minutes. Change it with /idle-handoff <minutes>.',
    he: 'העברה אחרי חוסר פעילות מציעה /handoff אחרי {minutes} דקות. לשינוי: /idle-handoff <דקות>.',
    es: 'El traspaso por inactividad sugiere /handoff tras {minutes} minutos. Cámbialo con /idle-handoff <minutos>.',
    fr: 'Le relais après inactivité suggère /handoff après {minutes} minutes. Modifiez-le avec /idle-handoff <minutes>.',
    ru: 'Предложение /handoff появляется после {minutes} мин простоя. Изменить: /idle-handoff <минуты>.',
    zh: '空闲交接会在空闲 {minutes} 分钟后建议使用 /handoff。可用 /idle-handoff <minutes> 修改。',
    ja: 'アイドル時の引き継ぎは、{minutes} 分アイドルすると /handoff を提案します。/idle-handoff <minutes> で変更できます。',
    pt: 'A transferência ociosa sugere /handoff após {minutes} minutos de inatividade. Altere com /idle-handoff <minutes>.',
    de: 'Die Übergabe bei Inaktivität schlägt /handoff nach {minutes} Minuten Inaktivität vor. Ändern mit /idle-handoff <minutes>.',
    ko: '유휴 인수인계는 {minutes}분 동안 유휴 상태면 /handoff를 제안합니다. /idle-handoff <minutes>로 변경할 수 있습니다.',
  },
  changed: {
    en: 'Idle handoff set to {minutes} minutes.',
    he: 'ההעברה אחרי חוסר פעילות נקבעה ל-{minutes} דקות.',
    es: 'Traspaso por inactividad establecido en {minutes} minutos.',
    fr: 'Relais après inactivité réglé sur {minutes} minutes.',
    ru: 'Простой до предложения сжатия: {minutes} мин.',
    zh: '空闲交接已设为 {minutes} 分钟。',
    ja: 'アイドル時の引き継ぎを {minutes} 分に設定しました。',
    pt: 'Transferência ociosa definida para {minutes} minutos.',
    de: 'Übergabe bei Inaktivität auf {minutes} Minuten gesetzt.',
    ko: '유휴 인수인계를 {minutes}분으로 설정했습니다.',
  },
  invalid: {
    en: 'Give a whole number of minutes from 1 to 1440.',
    he: 'ציין מספר שלם של דקות בין 1 ל-1440.',
    es: 'Indica un número entero de minutos entre 1 y 1440.',
    fr: 'Indiquez un nombre entier de minutes entre 1 et 1440.',
    ru: 'Укажите целое число минут от 1 до 1440.',
    zh: '请输入 1 到 1440 之间的整数分钟数。',
    ja: '1 から 1440 までの整数で分数を指定してください。',
    pt: 'Informe um número inteiro de minutos de 1 a 1440.',
    de: 'Gib eine ganze Zahl von Minuten zwischen 1 und 1440 an.',
    ko: '1에서 1440 사이의 정수(분)를 입력하세요.',
  },
} as const

type Idle = { minutes: number }

const idle = atom({ plugin: 'toolkitty', key: 'slot', id: 'idle-handoff' } as const, { minutes: 20 } as Idle) as unknown as Atom<Idle>

export const feature: Feature = {
  id: 'idle-handoff',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

const DEFAULT_MINUTES = 20
const MAX_MINUTES = 1440
const MIN_PERCENT = 40
const STORE_KEY = 'idle-handoff:minutes'

let idleTimer: Timer | undefined

/** Fires once, `minutes` after now; a fresh call replaces the pending one. */
async function startIdleTimer($: EngineInterface, minutes: number): Promise<void> {
  idleTimer?.cancel()
  idleTimer = $.clock.after(minutes * 60 * 1000, async () => {
    idleTimer = undefined
    await onIdle($)
  })
}

async function onIdle($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  try {
    const { context } = await $.session.usage()
    const percent = context.percent
    if (percent === undefined || percent <= MIN_PERCENT) return
    const { minutes } = await read($, idle)
    await notice($, 'warn', t(T.idleToast, { minutes, percent: Math.round(percent) }), feature.id)
  } catch {
    // No usage, no toast.
  }
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'handoff', description: t(T.handoffDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'handoff', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  try {
    await $.command.register({ name: 'idle-handoff', description: t(T.idleDesc), argumentHint: t(T.minutesHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'idle-handoff', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  const saved = await storeGet<number>($, STORE_KEY, DEFAULT_MINUTES)
  const minutes = Number.isInteger(saved) && saved >= 1 && saved <= MAX_MINUTES ? saved : DEFAULT_MINUTES
  await update($, idle, () => ({ minutes }))
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined) return
  idleTimer?.cancel()
  idleTimer = undefined
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  const { minutes } = await read($, idle)
  await startIdleTimer($, minutes)
}

export function register(on: On) {
  on('command.run', { command: 'idle-handoff' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const arg = e.args.trim()
    const s = await read($, idle)
    if (arg === '') return { text: t(T.current, { minutes: s.minutes }) }

    const minutes = Number(arg)
    if (!/^\d+$/.test(arg) || minutes < 1 || minutes > MAX_MINUTES) return { text: t(T.invalid) }

    await storeSet($, STORE_KEY, minutes)
    await update($, idle, () => ({ minutes }))
    // A pending idle timer restarts with the new length.
    if (idleTimer !== undefined) await startIdleTimer($, minutes)
    return { text: t(T.changed, { minutes }) }
  })

  on('command.run', { command: 'handoff' }, async $ => {
    // The preview pane and the compaction behind its Compact now button live in handoff.tsx.
    return openHandoff($)
  })
}
