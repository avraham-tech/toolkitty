import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { clockText, isOn, notice, storeGet, storeSet, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput } from '../core'
import type { Savings } from '../shared'
import { publish, retract, retractAll } from '../signals'
import { ICONS } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: {
    en: 'Subagent guard',
    he: 'שומר סוכני משנה',
    es: 'Guardián de subagentes',
    fr: 'Garde des sous-agents',
    ru: 'Ограничитель субагентов',
    zh: '子代理防护',
    ja: 'サブエージェントガード',
    pt: 'Guarda de subagentes',
    de: 'Subagent-Wächter',
    ko: '서브에이전트 가드',
  },
  description: {
    en: 'Caps how many subagents run at once, how many a session may spawn, and how many tokens they may use.',
    he: 'מגביל כמה סוכני משנה רצים במקביל, כמה אפשר להפעיל בסשן וכמה טוקנים מותר להם לצרוך.',
    es: 'Limita cuántos subagentes se ejecutan a la vez, cuántos puede lanzar una sesión y cuántos tokens pueden usar.',
    fr: 'Plafonne le nombre de sous-agents simultanés, le nombre lancé par session et les tokens qu\'ils peuvent utiliser.',
    ru: 'Ограничивает число одновременных субагентов, число запусков за сессию и расход токенов.',
    zh: '限制同时运行的子代理数量、每个会话可生成的数量，以及它们可使用的 token 数。',
    ja: '同時に実行できるサブエージェントの数、セッションあたりの生成数、使用できるトークン数に上限を設けます。',
    pt: 'Limita quantos subagentes rodam ao mesmo tempo, quantos uma sessão pode criar e quantos tokens podem usar.',
    de: 'Begrenzt, wie viele Subagenten gleichzeitig laufen, wie viele eine Session starten darf und wie viele Tokens sie verbrauchen dürfen.',
    ko: '동시에 실행되는 서브에이전트 수, 세션당 생성 수, 사용할 수 있는 토큰 수를 제한합니다.',
  },
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
    ko: '기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  denyConcurrent: {
    en: 'Toolkitty · Subagent guard: {running} subagents are already running (cap {cap}). Wait for one to finish, or raise the cap with /agent-cap concurrent <n>.',
    he: 'Toolkitty · שומר סוכני משנה: {running} סוכני משנה כבר רצים (מגבלה {cap}). המתן שאחד יסתיים, או הגדל את המגבלה עם /agent-cap concurrent <n>.',
    es: 'Toolkitty · Guardián de subagentes: ya hay {running} subagentes en ejecución (límite {cap}). Espera a que termine uno o sube el límite con /agent-cap concurrent <n>.',
    fr: 'Toolkitty · Garde des sous-agents : {running} sous-agents sont déjà en cours (plafond {cap}). Attends qu’un se termine ou relève le plafond avec /agent-cap concurrent <n>.',
    ru: 'Toolkitty · Ограничитель субагентов: уже работают субагенты: {running} (лимит {cap}). Дождитесь завершения одного или увеличьте лимит командой /agent-cap concurrent <n>.',
    zh: 'Toolkitty · 子代理防护：已有 {running} 个子代理在运行（上限 {cap}）。请等待其中一个完成，或用 /agent-cap concurrent <n> 提高上限。',
    ja: 'Toolkitty · サブエージェントガード：すでに {running} 個のサブエージェントが実行中です（上限 {cap}）。どれかが終わるのを待つか、/agent-cap concurrent <n> で上限を上げてください。',
    pt: 'Toolkitty · Guarda de subagentes: {running} subagentes já estão em execução (limite {cap}). Espere um terminar ou aumente o limite com /agent-cap concurrent <n>.',
    de: 'Toolkitty · Subagent-Wächter: {running} Subagenten laufen bereits (Limit {cap}). Warte, bis einer fertig ist, oder erhöhe das Limit mit /agent-cap concurrent <n>.',
    ko: 'Toolkitty · 서브에이전트 가드: 이미 서브에이전트 {running}개가 실행 중입니다 (한도 {cap}). 하나가 끝날 때까지 기다리거나 /agent-cap concurrent <n>으로 한도를 올리세요.',
  },
  denySession: {
    en: 'Toolkitty · Subagent guard: this session already spawned {spawns} subagents (cap {cap}). Raise the cap with /agent-cap session <n>.',
    he: 'Toolkitty · שומר סוכני משנה: בסשן הזה כבר הופעלו {spawns} סוכני משנה (מגבלה {cap}). הגדל את המגבלה עם /agent-cap session <n>.',
    es: 'Toolkitty · Guardián de subagentes: esta sesión ya lanzó {spawns} subagentes (límite {cap}). Sube el límite con /agent-cap session <n>.',
    fr: 'Toolkitty · Garde des sous-agents : cette session a déjà lancé {spawns} sous-agents (plafond {cap}). Relève le plafond avec /agent-cap session <n>.',
    ru: 'Toolkitty · Ограничитель субагентов: в этой сессии уже запущено субагентов: {spawns} (лимит {cap}). Увеличьте лимит командой /agent-cap session <n>.',
    zh: 'Toolkitty · 子代理防护：本次会话已生成 {spawns} 个子代理（上限 {cap}）。请用 /agent-cap session <n> 提高上限。',
    ja: 'Toolkitty · サブエージェントガード：このセッションではすでに {spawns} 個のサブエージェントを生成しました（上限 {cap}）。/agent-cap session <n> で上限を上げてください。',
    pt: 'Toolkitty · Guarda de subagentes: esta sessão já criou {spawns} subagentes (limite {cap}). Aumente o limite com /agent-cap session <n>.',
    de: 'Toolkitty · Subagent-Wächter: Diese Session hat bereits {spawns} Subagenten gestartet (Limit {cap}). Erhöhe das Limit mit /agent-cap session <n>.',
    ko: 'Toolkitty · 서브에이전트 가드: 이번 세션에서 이미 서브에이전트 {spawns}개를 생성했습니다 (한도 {cap}). /agent-cap session <n>으로 한도를 올리세요.',
  },
  denyTokens: {
    en: 'Toolkitty · Subagent guard: subagents have used {used} tokens this session (cap {cap}). Raise the cap with /agent-cap tokens <n>.',
    he: 'Toolkitty · שומר סוכני משנה: סוכני המשנה צרכו {used} טוקנים בסשן הזה (מגבלה {cap}). הגדל את המגבלה עם /agent-cap tokens <n>.',
    es: 'Toolkitty · Guardián de subagentes: los subagentes han usado {used} tokens en esta sesión (límite {cap}). Sube el límite con /agent-cap tokens <n>.',
    fr: 'Toolkitty · Garde des sous-agents : les sous-agents ont utilisé {used} tokens dans cette session (plafond {cap}). Relève le plafond avec /agent-cap tokens <n>.',
    ru: 'Toolkitty · Ограничитель субагентов: субагенты израсходовали токенов в этой сессии: {used} (лимит {cap}). Увеличьте лимит командой /agent-cap tokens <n>.',
    zh: 'Toolkitty · 子代理防护：子代理在本次会话中已使用 {used} 个 token（上限 {cap}）。请用 /agent-cap tokens <n> 提高上限。',
    ja: 'Toolkitty · サブエージェントガード：このセッションでサブエージェントが {used} トークンを使用しました（上限 {cap}）。/agent-cap tokens <n> で上限を上げてください。',
    pt: 'Toolkitty · Guarda de subagentes: os subagentes usaram {used} tokens nesta sessão (limite {cap}). Aumente o limite com /agent-cap tokens <n>.',
    de: 'Toolkitty · Subagent-Wächter: Subagenten haben in dieser Session {used} Tokens verbraucht (Limit {cap}). Erhöhe das Limit mit /agent-cap tokens <n>.',
    ko: 'Toolkitty · 서브에이전트 가드: 서브에이전트가 이번 세션에서 토큰 {used}개를 사용했습니다 (한도 {cap}). /agent-cap tokens <n>으로 한도를 올리세요.',
  },
  band: {
    en: 'agents {running} running · {spawns} spawned · {tokens} tok',
    he: 'סוכנים: {running} רצים · {spawns} הופעלו · {tokens} טוק׳',
    es: 'agentes: {running} activos · {spawns} lanzados · {tokens} tok',
    fr: 'agents : {running} actifs · {spawns} lancés · {tokens} tok',
    ru: 'агенты: {running} работают · {spawns} запущено · {tokens} ток.',
    zh: '代理 {running} 运行中 · 已生成 {spawns} · {tokens} tok',
    ja: 'エージェント {running} 実行中 · 生成 {spawns} · {tokens} tok',
    pt: 'agentes {running} em execução · {spawns} criados · {tokens} tok',
    de: 'Agenten {running} aktiv · {spawns} gestartet · {tokens} Tok',
    ko: '에이전트 {running} 실행 중 · {spawns} 생성 · {tokens} tok',
  },
  bandDenied: {
    en: '{n} denied',
    he: '{n} נחסמו',
    es: '{n} denegados',
    fr: '{n} refusés',
    ru: 'отклонено: {n}',
    zh: '已拒绝 {n} 个',
    ja: '{n} 件拒否',
    pt: '{n} negados',
    de: '{n} abgelehnt',
    ko: '{n}건 거부',
  },
  cmdDesc: {
    en: 'Shows or sets the subagent caps: concurrent, session, tokens',
    he: 'מציג או קובע את מגבלות סוכני המשנה: concurrent, session, tokens',
    es: 'Muestra o define los límites de subagentes: concurrent, session, tokens',
    fr: 'Affiche ou règle les plafonds des sous-agents : concurrent, session, tokens',
    ru: 'Показывает или задаёт лимиты субагентов: concurrent, session, tokens',
    zh: '显示或设置子代理上限：concurrent、session、tokens',
    ja: 'サブエージェントの上限を表示・設定します：concurrent、session、tokens',
    pt: 'Mostra ou define os limites de subagentes: concurrent, session, tokens',
    de: 'Zeigt oder setzt die Subagent-Limits: concurrent, session, tokens',
    ko: '서브에이전트 한도를 보거나 설정합니다: concurrent, session, tokens',
  },
  cmdHint: {
    en: '[concurrent|session|tokens <n>]',
    he: '[concurrent|session|tokens <n>]',
    es: '[concurrent|session|tokens <n>]',
    fr: '[concurrent|session|tokens <n>]',
    ru: '[concurrent|session|tokens <n>]',
    zh: '[concurrent|session|tokens <n>]',
    ja: '[concurrent|session|tokens <n>]',
    pt: '[concurrent|session|tokens <n>]',
    de: '[concurrent|session|tokens <n>]',
    ko: '[concurrent|session|tokens <n>]',
  },
  caps: {
    en: 'Subagent caps: {concurrent} at once, {session} per session, {tokens} tokens. Change with /agent-cap concurrent|session|tokens <n>.',
    he: 'מגבלות סוכני משנה: {concurrent} במקביל, {session} לסשן, {tokens} טוקנים. לשינוי: /agent-cap concurrent|session|tokens <n>.',
    es: 'Límites de subagentes: {concurrent} a la vez, {session} por sesión, {tokens} tokens. Cambia con /agent-cap concurrent|session|tokens <n>.',
    fr: 'Plafonds des sous-agents : {concurrent} simultanés, {session} par session, {tokens} tokens. Modifie-les avec /agent-cap concurrent|session|tokens <n>.',
    ru: 'Лимиты субагентов: одновременно {concurrent}, за сессию {session}, токенов {tokens}. Изменить: /agent-cap concurrent|session|tokens <n>.',
    zh: '子代理上限：同时 {concurrent} 个，每个会话 {session} 个，{tokens} 个 token。用 /agent-cap concurrent|session|tokens <n> 更改。',
    ja: 'サブエージェントの上限：同時 {concurrent} 個、セッションあたり {session} 個、{tokens} トークン。/agent-cap concurrent|session|tokens <n> で変更できます。',
    pt: 'Limites de subagentes: {concurrent} ao mesmo tempo, {session} por sessão, {tokens} tokens. Altere com /agent-cap concurrent|session|tokens <n>.',
    de: 'Subagent-Limits: {concurrent} gleichzeitig, {session} pro Session, {tokens} Tokens. Ändern mit /agent-cap concurrent|session|tokens <n>.',
    ko: '서브에이전트 한도: 동시 {concurrent}개, 세션당 {session}개, 토큰 {tokens}개. /agent-cap concurrent|session|tokens <n>으로 변경합니다.',
  },
  capSet: {
    en: 'Cap set: {name} = {value}.',
    he: 'המגבלה נקבעה: {name} = {value}.',
    es: 'Límite establecido: {name} = {value}.',
    fr: 'Plafond réglé : {name} = {value}.',
    ru: 'Лимит установлен: {name} = {value}.',
    zh: '上限已设置：{name} = {value}。',
    ja: '上限を設定しました：{name} = {value}。',
    pt: 'Limite definido: {name} = {value}.',
    de: 'Limit gesetzt: {name} = {value}.',
    ko: '한도 설정됨: {name} = {value}.',
  },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  dHead: {
    en: 'Denied subagent spawns (newest first)',
    he: 'הפעלות סוכני משנה שנחסמו (החדשות ראשונות)',
    es: 'Lanzamientos de subagentes denegados (los más recientes primero)',
    fr: 'Lancements de sous-agents refusés (les plus récents d\'abord)',
    ru: 'Отклонённые запуски субагентов (сначала новые)',
    zh: '被拒绝的子代理生成（最新在前）',
    ja: '拒否されたサブエージェントの生成（新しい順）',
    pt: 'Criações de subagentes negadas (mais recentes primeiro)',
    de: 'Abgelehnte Subagent-Starts (neueste zuerst)',
    ko: '거부된 서브에이전트 생성 (최신순)',
  },
  dNone: {
    en: 'Nothing was denied this session.',
    he: 'שום דבר לא נחסם בסשן הזה.',
    es: 'No se denegó nada en esta sesión.',
    fr: 'Rien n\'a été refusé dans cette session.',
    ru: 'В этой сессии ничего не отклонялось.',
    zh: '本次会话没有被拒绝的内容。',
    ja: 'このセッションでは拒否されたものはありません。',
    pt: 'Nada foi negado nesta sessão.',
    de: 'In dieser Session wurde nichts abgelehnt.',
    ko: '이번 세션에서 거부된 것이 없습니다.',
  },
  kindConcurrent: { en: 'concurrent cap', he: 'מגבלת מקביליות', es: 'límite simultáneo', fr: 'plafond simultané', ru: 'лимит одновременных', zh: '并发上限', ja: '同時実行の上限', pt: 'limite simultâneo', de: 'Gleichzeitig-Limit', ko: '동시 실행 한도' },
  kindSession: { en: 'session cap', he: 'מגבלת סשן', es: 'límite por sesión', fr: 'plafond par session', ru: 'лимит за сессию', zh: '会话上限', ja: 'セッションの上限', pt: 'limite por sessão', de: 'Session-Limit', ko: '세션 한도' },
  kindTokens: { en: 'token cap', he: 'מגבלת טוקנים', es: 'límite de tokens', fr: 'plafond de tokens', ru: 'лимит токенов', zh: 'token 上限', ja: 'トークン上限', pt: 'limite de tokens', de: 'Token-Limit', ko: '토큰 한도' },
  whyConcurrent: {
    en: '{value} running, cap {limit}',
    he: '{value} רצים, מגבלה {limit}',
    es: '{value} activos, límite {limit}',
    fr: '{value} actifs, plafond {limit}',
    ru: 'работают {value}, лимит {limit}',
    zh: '运行中 {value}，上限 {limit}',
    ja: '実行中 {value}、上限 {limit}',
    pt: '{value} em execução, limite {limit}',
    de: '{value} aktiv, Limit {limit}',
    ko: '실행 중 {value}, 한도 {limit}',
  },
  whySession: {
    en: '{value} spawned, cap {limit}',
    he: '{value} הופעלו, מגבלה {limit}',
    es: '{value} lanzados, límite {limit}',
    fr: '{value} lancés, plafond {limit}',
    ru: 'запущено {value}, лимит {limit}',
    zh: '已生成 {value}，上限 {limit}',
    ja: '生成 {value}、上限 {limit}',
    pt: '{value} criados, limite {limit}',
    de: '{value} gestartet, Limit {limit}',
    ko: '생성 {value}, 한도 {limit}',
  },
  whyTokens: {
    en: '{value} tokens used, cap {limit}',
    he: '{value} טוקנים נצרכו, מגבלה {limit}',
    es: '{value} tokens usados, límite {limit}',
    fr: '{value} tokens utilisés, plafond {limit}',
    ru: 'израсходовано {value}, лимит {limit}',
    zh: '已用 {value} 个 token，上限 {limit}',
    ja: '{value} トークン使用、上限 {limit}',
    pt: '{value} tokens usados, limite {limit}',
    de: '{value} Tokens verbraucht, Limit {limit}',
    ko: '토큰 {value}개 사용, 한도 {limit}',
  },
  dRunning: { en: 'Running now', he: 'רצים עכשיו', es: 'En ejecución ahora', fr: 'En cours maintenant', ru: 'Работают сейчас', zh: '正在运行', ja: '実行中', pt: 'Em execução agora', de: 'Läuft gerade', ko: '지금 실행 중' },
  chipAgents: { en: '{n} agents', he: '{n} סוכנים', es: '{n} agentes', fr: '{n} agents', ru: 'агентов: {n}', zh: '{n} 个代理', ja: 'エージェント {n} 個', pt: '{n} agentes', de: '{n} Agenten', ko: '에이전트 {n}개' },
  chipDenied: { en: '{n} denied', he: '{n} נדחו', es: '{n} denegados', fr: '{n} refusés', ru: 'отказов: {n}', zh: '已拒绝 {n} 个', ja: '{n} 件拒否', pt: '{n} negados', de: '{n} abgelehnt', ko: '{n}건 거부' },
  dNoRunning: { en: 'No subagents are running.', he: 'אין סוכני משנה רצים.', es: 'No hay subagentes en ejecución.', fr: 'Aucun sous-agent en cours.', ru: 'Субагенты не работают.', zh: '没有正在运行的子代理。', ja: '実行中のサブエージェントはありません。', pt: 'Nenhum subagente em execução.', de: 'Es laufen keine Subagenten.', ko: '실행 중인 서브에이전트가 없습니다.' },
  capInvalid: {
    en: 'Usage: /agent-cap concurrent|session|tokens <n> (a positive whole number; k and m suffixes work).',
    he: 'שימוש: /agent-cap concurrent|session|tokens <n> (מספר שלם חיובי; אפשר להוסיף k או m).',
    es: 'Uso: /agent-cap concurrent|session|tokens <n> (un entero positivo; se admiten los sufijos k y m).',
    fr: 'Utilisation : /agent-cap concurrent|session|tokens <n> (un entier positif ; les suffixes k et m sont acceptés).',
    ru: 'Использование: /agent-cap concurrent|session|tokens <n> (положительное целое; допустимы суффиксы k и m).',
    zh: '用法：/agent-cap concurrent|session|tokens <n>（正整数；可用 k 和 m 后缀）。',
    ja: '使い方：/agent-cap concurrent|session|tokens <n>（正の整数。k と m のサフィックスが使えます）。',
    pt: 'Uso: /agent-cap concurrent|session|tokens <n> (um inteiro positivo; os sufixos k e m funcionam).',
    de: 'Verwendung: /agent-cap concurrent|session|tokens <n> (eine positive ganze Zahl; die Suffixe k und m funktionieren).',
    ko: '사용법: /agent-cap concurrent|session|tokens <n> (양의 정수, k와 m 접미사 사용 가능).',
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

type Caps = { concurrent: number; session: number; tokens: number }
type CapName = keyof Caps
type Denial = { at: number; cap: CapName; value: number; limit: number }
type Guard = { running: number; spawns: number; tokens: number; denied: number; denials: Denial[] }

const DEFAULT_CAPS: Caps = { concurrent: 4, session: 25, tokens: 3_000_000 }
const CAPS_KEY = 'subagent-guard:caps'
const CAP_NAMES: readonly CapName[] = ['concurrent', 'session', 'tokens']

const guard = atom({ plugin: 'toolkitty', key: 'slot', id: 'subagent-guard' } as const, {
  running: 0,
  spawns: 0,
  tokens: 0,
  denied: 0,
  denials: [],
} as Guard) as unknown as Atom<Guard>

const savings = atom({ plugin: 'toolkitty', key: 'slot', id: 'savings' } as const, { tokens: 0, usd: 0, byFeature: {}, leaks: {} } as Savings) as unknown as Atom<Savings>

export const feature: Feature = {
  id: 'subagent-guard',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

/** Agent calls currently inside the tool, so a parallel batch counts before the agents show in the roster. */
let inFlight = 0

const isCapName = (name: string): name is CapName => (CAP_NAMES as readonly string[]).includes(name)
const countText = (n: number): string => n.toLocaleString('en-US')
const shortCount = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

/** "25", "500k", "3m" -> a positive whole number, or null. */
const parseCount = (raw: string): number | null => {
  const m = /^(\d+(?:\.\d+)?)([km])?$/i.exec(raw.trim())
  if (m === null) return null
  const factor = m[2] === undefined ? 1 : m[2].toLowerCase() === 'k' ? 1000 : 1_000_000
  const n = Math.round(Number(m[1]) * factor)
  return n >= 1 ? n : null
}

async function loadCaps($: EngineInterface): Promise<Caps> {
  const saved = await storeGet<Partial<Caps>>($, CAPS_KEY, {})
  const pick = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 1 ? value : fallback
  return {
    concurrent: pick(saved.concurrent, DEFAULT_CAPS.concurrent),
    session: pick(saved.session, DEFAULT_CAPS.session),
    tokens: pick(saved.tokens, DEFAULT_CAPS.tokens),
  }
}

/** Agents that are not finished, from the roster. */
async function countRunning($: EngineInterface): Promise<number> {
  const agents = await $.agent.list()
  return agents.filter(a => a.status !== 'completed' && a.status !== 'failed' && a.status !== 'killed').length
}

/** Tells the signals bus how many agents run and how many were denied; warn when a denial happened in the last 5 minutes. */
async function publishAgents($: EngineInterface): Promise<void> {
  const g = await read($, guard)
  if (g.running === 0 && g.denied === 0) {
    await retract($, 'subagent-guard:agents')
    return
  }
  const now = await $.clock.now()
  const isRecent = (g.denials ?? []).some(d => now - d.at <= 5 * 60 * 1000)
  await publish($, {
    id: 'subagent-guard:agents',
    feature: feature.id,
    kind: 'agents',
    level: isRecent ? 'warn' : 'ok',
    value: g.running,
    text: `${g.running} running · ${g.denied} denied`,
  })
}

async function refreshRunning($: EngineInterface): Promise<void> {
  const running = await countRunning($)
  await update($, guard, g => ({ ...g, running }))
  await publishAgents($)
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'agent-cap', description: t(T.cmdDesc), argumentHint: t(T.cmdHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'agent-cap', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  inFlight = 0
  await update($, guard, () => ({ running: 0, spawns: 0, tokens: 0, denied: 0, denials: [] }))
  await retractAll($, feature.id)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId === undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }
  await refreshRunning($)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId === undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }

  const used = e.usage === undefined ? 0 : e.usage.input_tokens + e.usage.output_tokens
  const running = await countRunning($)
  await update($, guard, g => ({ ...g, running, tokens: g.tokens + used }))
  if (used > 0) {
    // subagent spend is a leak candidate ("if avoided"): it goes to the savings slot's `leaks`, never to its `tokens`
    await update($, savings, s => ({ ...s, leaks: { ...(s.leaks ?? {}), 'agent-spend': (s.leaks?.['agent-spend'] ?? 0) + used } }))
  }
  await publishAgents($)
}

/** The short band form: "2 agents · 1 denied". Quiet while nothing runs and nothing was denied. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const g = await read($, guard)
  if (g.denied === 0 && g.running === 0) return null

  const parts: string[] = []
  if (g.running > 0) parts.push(t(T.chipAgents, { n: g.running }))
  if (g.denied > 0) parts.push(t(T.chipDenied, { n: g.denied }))
  return { text: parts.join(' · '), level: g.denied > 0 ? 'warn' : 'ok', icon: ICONS.quota }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const g = await read($, guard)
  if (g.denied === 0 && g.spawns === 0 && g.running === 0) return null

  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      {t(T.band, { running: g.running, spawns: g.spawns, tokens: shortCount(g.tokens) })}
      {g.denied > 0 ? (
        <Text color="warning">
          {' · '}
          {t(T.bandDenied, { n: g.denied })}
        </Text>
      ) : null}
    </Text>
  )
}

/** What a press on the band line shows: the denied spawns with the numbers at that moment, the caps, the running agents. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const g = await read($, guard)
  const caps = await loadCaps($)
  const live = (await $.agent.list()).filter(a => a.status !== 'completed' && a.status !== 'failed' && a.status !== 'killed')
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)

  const kindOf = (cap: CapName): string =>
    cap === 'tokens' ? t(T.kindTokens) : cap === 'session' ? t(T.kindSession) : t(T.kindConcurrent)
  const whyOf = (d: Denial): string => {
    const vars = { value: countText(d.value), limit: countText(d.limit) }
    return d.cap === 'tokens' ? t(T.whyTokens, vars) : d.cap === 'session' ? t(T.whySession, vars) : t(T.whyConcurrent, vars)
  }

  const denials = (g.denials ?? []).slice(-6).reverse()
  return (
    <Box flexDirection="column">
      <Text bold>{t(T.dHead)}</Text>
      {denials.length === 0 ? <Text dimColor>{t(T.dNone)}</Text> : null}
      {denials.map((d, i) => (
        <Text key={`d${i}`}>{`${t(T.ago, { t: clockText(now - d.at) })} · ${kindOf(d.cap)} · ${whyOf(d)}`}</Text>
      ))}
      <Text dimColor>{t(T.caps, { concurrent: caps.concurrent, session: caps.session, tokens: countText(caps.tokens) })}</Text>
      <Text bold>{t(T.dRunning)}</Text>
      {live.length === 0 ? <Text dimColor>{t(T.dNoRunning)}</Text> : null}
      {live.slice(0, 5).map(a => (
        <Text key={a.id}>{`${a.id.slice(0, 8)} · ${a.type} · ${a.status}`}</Text>
      ))}
    </Box>
  )
}

export function register(on: On) {
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (!(await isOn($, feature))) {
      await retractAll($, feature.id)
      return next(e)
    }

    const caps = await loadCaps($)
    const g = await read($, guard)
    const listed = await countRunning($)

    // Everything from here to the increment runs without an await, so a parallel batch counts itself.
    const running = Math.max(listed, inFlight)
    let deny: string | undefined
    if (g.tokens > caps.tokens) deny = t(T.denyTokens, { used: countText(g.tokens), cap: countText(caps.tokens) })
    else if (g.spawns >= caps.session) deny = t(T.denySession, { spawns: g.spawns, cap: caps.session })
    else if (running >= caps.concurrent) deny = t(T.denyConcurrent, { running, cap: caps.concurrent })

    if (deny !== undefined) {
      const hit: Denial =
        g.tokens > caps.tokens
          ? { at: await $.clock.now(), cap: 'tokens', value: g.tokens, limit: caps.tokens }
          : g.spawns >= caps.session
            ? { at: await $.clock.now(), cap: 'session', value: g.spawns, limit: caps.session }
            : { at: await $.clock.now(), cap: 'concurrent', value: running, limit: caps.concurrent }
      await update($, guard, s => ({ ...s, running, denied: s.denied + 1, denials: [...(s.denials ?? []), hit].slice(-50) }))
      await publishAgents($)
      return { deny }
    }

    inFlight += 1
    await update($, guard, s => ({ ...s, running: running + 1, spawns: s.spawns + 1 }))
    await publishAgents($)
    try {
      return await next(e)
    } finally {
      inFlight = Math.max(0, inFlight - 1)
      await refreshRunning($)
    }
  })

  on('command.run', { command: 'agent-cap' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const caps = await loadCaps($)
    const [name = '', value = ''] = e.args.trim().split(/\s+/)

    if (name === '') {
      return {
        text: t(T.caps, { concurrent: caps.concurrent, session: caps.session, tokens: countText(caps.tokens) }),
      }
    }
    const lower = name.toLowerCase()
    const n = parseCount(value)
    if (!isCapName(lower) || n === null) return { text: t(T.capInvalid) }

    await storeSet($, CAPS_KEY, { ...caps, [lower]: n })
    return { text: t(T.capSet, { name: lower, value: countText(n) }) }
  })
}
