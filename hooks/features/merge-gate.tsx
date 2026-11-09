import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Incidents } from '../shared'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Merge gate', he: 'שער מיזוג', es: 'Puerta de fusión', fr: 'Barrière de fusion', ru: 'Шлюз слияния', zh: '合并关卡', ja: 'マージゲート', pt: 'Portão de merge', de: 'Merge-Gate', ko: '머지 게이트' },
  description: { en: 'Holds git push and gh pr merge until the pull request\'s CI checks are green. /merge-gate allow grants a one-time pass.', he: 'מעכב git push ו-gh pr merge עד שבדיקות ה-CI של ה-pull request ירוקות. /merge-gate allow נותן מעבר חד-פעמי.', es: 'Retiene git push y gh pr merge hasta que las comprobaciones de CI del pull request estén en verde. /merge-gate allow concede un pase de una sola vez.', fr: 'Retient git push et gh pr merge tant que les vérifications CI de la pull request ne sont pas vertes. /merge-gate allow accorde un laissez-passer unique.', ru: 'Задерживает git push и gh pr merge, пока проверки CI у pull request не станут зелёными. /merge-gate allow даёт разовый пропуск.', zh: '在拉取请求的 CI 检查变绿之前，拦住 git push 和 gh pr merge。/merge-gate allow 可放行一次。', ja: 'プルリクエストの CI チェックが通るまで git push と gh pr merge を止めます。/merge-gate allow で 1 回だけ通せます。', pt: 'Segura git push e gh pr merge até que as verificações de CI do pull request estejam verdes. /merge-gate allow concede uma liberação única.', de: 'Hält git push und gh pr merge zurück, bis die CI-Checks des Pull Requests grün sind. /merge-gate allow erteilt eine einmalige Freigabe.', ko: '풀 리퀘스트의 CI 검사가 통과될 때까지 git push와 gh pr merge를 막습니다. /merge-gate allow로 한 번만 통과시킬 수 있습니다.' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  cmdDesc: { en: 'Shows the last CI verdict; "/merge-gate allow" lets the next push or merge through once', he: 'מציג את תוצאת ה-CI האחרונה; "/merge-gate allow" מאפשר לדחיפה או למיזוג הבאים לעבור פעם אחת', es: 'Muestra el último veredicto de CI; "/merge-gate allow" deja pasar el siguiente push o fusión una vez', fr: 'Affiche le dernier verdict CI ; « /merge-gate allow » laisse passer le prochain push ou la prochaine fusion une fois', ru: 'Показывает последний вердикт CI; «/merge-gate allow» один раз пропускает следующий push или слияние', zh: '显示最近一次 CI 结论；“/merge-gate allow”可让下一次推送或合并放行一次', ja: '直近の CI 判定を表示します。「/merge-gate allow」で次の push またはマージを 1 回だけ通します', pt: 'Mostra o último veredito do CI; "/merge-gate allow" libera o próximo push ou merge uma vez', de: 'Zeigt das letzte CI-Ergebnis; „/merge-gate allow“ lässt den nächsten Push oder Merge einmal durch', ko: '마지막 CI 판정을 보여줍니다. "/merge-gate allow"는 다음 push나 머지를 한 번 통과시킵니다' },
  argHint: { en: '[allow]', he: '[allow]', es: '[allow]', fr: '[allow]', ru: '[allow]', zh: '[allow]', ja: '[allow]', pt: '[allow]', de: '[allow]', ko: '[allow]' },
  denyFail: { en: 'Toolkitty · Merge gate: CI is failing on {branch}: {names}. Fix the failing checks first. If the person wants to go ahead anyway, they can run /merge-gate allow for a one-time pass.', he: 'Toolkitty · שער מיזוג: ה-CI נכשל בענף {branch}: {names}. תקן קודם את הבדיקות שנכשלו. אם המשתמש רוצה להמשיך בכל זאת, הוא יכול להריץ /merge-gate allow למעבר חד-פעמי.', es: 'Toolkitty · Puerta de fusión: el CI está fallando en {branch}: {names}. Corrige primero las comprobaciones fallidas. Si la persona quiere continuar de todos modos, puede ejecutar /merge-gate allow para un pase de una sola vez.', fr: 'Toolkitty · Barrière de fusion : le CI échoue sur {branch} : {names}. Corrigez d\'abord les vérifications en échec. Si la personne veut continuer malgré tout, elle peut exécuter /merge-gate allow pour un laissez-passer unique.', ru: 'Toolkitty · Шлюз слияния: CI падает на {branch}: {names}. Сначала исправьте упавшие проверки. Если человек хочет продолжить всё равно, он может выполнить /merge-gate allow для разового пропуска.', zh: 'Toolkitty · 合并关卡：{branch} 上的 CI 失败：{names}。请先修复失败的检查。如果用户仍想继续，可以运行 /merge-gate allow 放行一次。', ja: 'Toolkitty · マージゲート：{branch} の CI が失敗しています：{names}。まず失敗しているチェックを直してください。それでも進めたい場合は、/merge-gate allow で 1 回だけ通せます。', pt: 'Toolkitty · Portão de merge: o CI está falhando em {branch}: {names}. Corrija primeiro as verificações com falha. Se a pessoa quiser prosseguir mesmo assim, pode executar /merge-gate allow para uma liberação única.', de: 'Toolkitty · Merge-Gate: Die CI schlägt auf {branch} fehl: {names}. Behebe zuerst die fehlgeschlagenen Checks. Wenn die Person trotzdem fortfahren will, kann sie /merge-gate allow für eine einmalige Freigabe ausführen.', ko: 'Toolkitty · 머지 게이트: {branch}의 CI가 실패하고 있습니다: {names}. 먼저 실패한 검사를 고치세요. 그래도 진행하려면 /merge-gate allow로 한 번만 통과시킬 수 있습니다.' },
  denyPending: { en: 'Toolkitty · Merge gate: CI still running ({n} pending) on {branch}: {names}. Wait for the checks to finish and try again. If the person wants to go ahead anyway, they can run /merge-gate allow for a one-time pass.', he: 'Toolkitty · שער מיזוג: ה-CI עדיין רץ ({n} ממתינות) בענף {branch}: {names}. המתן לסיום הבדיקות ונסה שוב. אם המשתמש רוצה להמשיך בכל זאת, הוא יכול להריץ /merge-gate allow למעבר חד-פעמי.', es: 'Toolkitty · Puerta de fusión: el CI sigue en ejecución ({n} pendientes) en {branch}: {names}. Espera a que terminen las comprobaciones e inténtalo de nuevo. Si la persona quiere continuar de todos modos, puede ejecutar /merge-gate allow para un pase de una sola vez.', fr: 'Toolkitty · Barrière de fusion : le CI est encore en cours ({n} en attente) sur {branch} : {names}. Attendez la fin des vérifications et réessayez. Si la personne veut continuer malgré tout, elle peut exécuter /merge-gate allow pour un laissez-passer unique.', ru: 'Toolkitty · Шлюз слияния: CI ещё выполняется (ожидают: {n}) на {branch}: {names}. Дождитесь завершения проверок и повторите. Если человек хочет продолжить всё равно, он может выполнить /merge-gate allow для разового пропуска.', zh: 'Toolkitty · 合并关卡：{branch} 上的 CI 仍在运行（{n} 项待完成）：{names}。请等待检查完成后再试。如果用户仍想继续，可以运行 /merge-gate allow 放行一次。', ja: 'Toolkitty · マージゲート：{branch} の CI がまだ実行中です（保留 {n} 件）：{names}。チェックが終わるのを待ってから再試行してください。それでも進めたい場合は、/merge-gate allow で 1 回だけ通せます。', pt: 'Toolkitty · Portão de merge: o CI ainda está em execução ({n} pendentes) em {branch}: {names}. Espere as verificações terminarem e tente de novo. Se a pessoa quiser prosseguir mesmo assim, pode executar /merge-gate allow para uma liberação única.', de: 'Toolkitty · Merge-Gate: Die CI läuft noch ({n} ausstehend) auf {branch}: {names}. Warte, bis die Checks fertig sind, und versuche es erneut. Wenn die Person trotzdem fortfahren will, kann sie /merge-gate allow für eine einmalige Freigabe ausführen.', ko: 'Toolkitty · 머지 게이트: {branch}의 CI가 아직 실행 중입니다(대기 {n}건): {names}. 검사가 끝날 때까지 기다렸다가 다시 시도하세요. 그래도 진행하려면 /merge-gate allow로 한 번만 통과시킬 수 있습니다.' },
  toastTimeout: { en: 'Merge gate: the CI check took longer than 15 seconds, so the command was allowed', he: 'שער מיזוג: בדיקת ה-CI ארכה יותר מ-15 שניות, ולכן הפקודה הותרה', es: 'Puerta de fusión: la comprobación de CI tardó más de 15 segundos, así que se permitió el comando', fr: 'Barrière de fusion : la vérification CI a pris plus de 15 secondes, la commande a donc été autorisée', ru: 'Шлюз слияния: проверка CI заняла больше 15 секунд, поэтому команда разрешена', zh: '合并关卡：CI 检查耗时超过 15 秒，因此该命令已放行', ja: 'マージゲート：CI チェックが 15 秒を超えたため、コマンドを許可しました', pt: 'Portão de merge: a verificação de CI levou mais de 15 segundos, então o comando foi permitido', de: 'Merge-Gate: Der CI-Check dauerte länger als 15 Sekunden, daher wurde der Befehl zugelassen', ko: '머지 게이트: CI 검사가 15초 넘게 걸려 명령을 허용했습니다' },
  allowed: { en: 'One-time pass granted: the next git push or gh pr merge goes through without a CI check.', he: 'ניתן מעבר חד-פעמי: פקודת git push או gh pr merge הבאה תעבור בלי בדיקת CI.', es: 'Pase de una sola vez concedido: el siguiente git push o gh pr merge pasará sin comprobar el CI.', fr: 'Laissez-passer unique accordé : le prochain git push ou gh pr merge passera sans vérification CI.', ru: 'Разовый пропуск выдан: следующий git push или gh pr merge пройдёт без проверки CI.', zh: '已授予一次放行：下一次 git push 或 gh pr merge 将不经 CI 检查直接通过。', ja: '1 回限りの許可を付与しました。次の git push または gh pr merge は CI チェックなしで通ります。', pt: 'Liberação única concedida: o próximo git push ou gh pr merge passa sem verificação de CI.', de: 'Einmalige Freigabe erteilt: Der nächste git push oder gh pr merge geht ohne CI-Check durch.', ko: '한 번만 통과 허용: 다음 git push 또는 gh pr merge는 CI 검사 없이 진행됩니다.' },
  usage: { en: 'Usage: /merge-gate (last verdict) or /merge-gate allow (one-time pass)', he: 'שימוש: /merge-gate (התוצאה האחרונה) או /merge-gate allow (מעבר חד-פעמי)', es: 'Uso: /merge-gate (último veredicto) o /merge-gate allow (pase de una sola vez)', fr: 'Utilisation : /merge-gate (dernier verdict) ou /merge-gate allow (laissez-passer unique)', ru: 'Использование: /merge-gate (последний вердикт) или /merge-gate allow (разовый пропуск)', zh: '用法：/merge-gate（最近结论）或 /merge-gate allow（放行一次）', ja: '使い方：/merge-gate（直近の判定）または /merge-gate allow（1 回限りの許可）', pt: 'Uso: /merge-gate (último veredito) ou /merge-gate allow (liberação única)', de: 'Verwendung: /merge-gate (letztes Ergebnis) oder /merge-gate allow (einmalige Freigabe)', ko: '사용법: /merge-gate(마지막 판정) 또는 /merge-gate allow(한 번만 통과)' },
  noVerdict: { en: 'No push or merge has been checked yet in this session.', he: 'עדיין לא נבדקו דחיפה או מיזוג בסשן הזה.', es: 'Aún no se ha comprobado ningún push ni fusión en esta sesión.', fr: 'Aucun push ni fusion n\'a encore été vérifié dans cette session.', ru: 'В этой сессии ещё не проверялся ни один push или слияние.', zh: '本会话中还没有检查过任何推送或合并。', ja: 'このセッションでは、まだ push もマージもチェックされていません。', pt: 'Nenhum push ou merge foi verificado ainda nesta sessão.', de: 'In dieser Session wurde noch kein Push oder Merge geprüft.', ko: '이번 세션에서는 아직 검사한 push나 머지가 없습니다.' },
  passWaiting: { en: 'A one-time pass is waiting for the next push or merge.', he: 'מעבר חד-פעמי ממתין לדחיפה או למיזוג הבאים.', es: 'Hay un pase de una sola vez esperando al próximo push o fusión.', fr: 'Un laissez-passer unique attend le prochain push ou la prochaine fusion.', ru: 'Разовый пропуск ожидает следующего push или слияния.', zh: '一次放行正等待下一次推送或合并。', ja: '1 回限りの許可が、次の push またはマージを待っています。', pt: 'Uma liberação única aguarda o próximo push ou merge.', de: 'Eine einmalige Freigabe wartet auf den nächsten Push oder Merge.', ko: '한 번만 통과 허용이 다음 push나 머지를 기다리고 있습니다.' },
  last: { en: 'Last verdict ({ago} min ago) for "{command}": {state}. {detail}', he: 'התוצאה האחרונה (לפני {ago} דקות) עבור "{command}": {state}. {detail}', es: 'Último veredicto (hace {ago} min) para "{command}": {state}. {detail}', fr: 'Dernier verdict (il y a {ago} min) pour « {command} » : {state}. {detail}', ru: 'Последний вердикт ({ago} мин назад) для «{command}»: {state}. {detail}', zh: '“{command}”的最近结论（{ago} 分钟前）：{state}。{detail}', ja: '「{command}」の直近の判定（{ago} 分前）：{state}。{detail}', pt: 'Último veredito (há {ago} min) para "{command}": {state}. {detail}', de: 'Letztes Ergebnis (vor {ago} Min.) für „{command}“: {state}. {detail}', ko: '"{command}"의 마지막 판정({ago}분 전): {state}. {detail}' },
  stBlockedFail: { en: 'blocked, CI failing', he: 'נחסם, ה-CI נכשל', es: 'bloqueado, CI fallando', fr: 'bloqué, CI en échec', ru: 'заблокировано, CI падает', zh: '已拦截，CI 失败', ja: 'ブロック、CI 失敗', pt: 'bloqueado, CI falhando', de: 'blockiert, CI schlägt fehl', ko: '차단됨, CI 실패' },
  stBlockedPending: { en: 'blocked, CI still running', he: 'נחסם, ה-CI עדיין רץ', es: 'bloqueado, CI en ejecución', fr: 'bloqué, CI en cours', ru: 'заблокировано, CI выполняется', zh: '已拦截，CI 仍在运行', ja: 'ブロック、CI 実行中', pt: 'bloqueado, CI ainda em execução', de: 'blockiert, CI läuft noch', ko: '차단됨, CI 실행 중' },
  stGreen: { en: 'allowed, CI green', he: 'הותר, ה-CI ירוק', es: 'permitido, CI en verde', fr: 'autorisé, CI vert', ru: 'разрешено, CI зелёный', zh: '已放行，CI 通过', ja: '許可、CI 成功', pt: 'permitido, CI verde', de: 'zugelassen, CI grün', ko: '허용됨, CI 통과' },
  stSkipped: { en: 'allowed, no CI to check', he: 'הותר, אין CI לבדיקה', es: 'permitido, sin CI que comprobar', fr: 'autorisé, pas de CI à vérifier', ru: 'разрешено, CI для проверки нет', zh: '已放行，无 CI 可检查', ja: '許可、チェックする CI なし', pt: 'permitido, sem CI para verificar', de: 'zugelassen, keine CI zum Prüfen', ko: '허용됨, 검사할 CI 없음' },
  stTimeout: { en: 'allowed, check timed out', he: 'הותר, הבדיקה חרגה מהזמן', es: 'permitido, la comprobación agotó el tiempo', fr: 'autorisé, la vérification a expiré', ru: 'разрешено, время проверки истекло', zh: '已放行，检查超时', ja: '許可、チェックがタイムアウト', pt: 'permitido, verificação expirou', de: 'zugelassen, Check-Zeitüberschreitung', ko: '허용됨, 검사 시간 초과' },
  stPass: { en: 'allowed by one-time pass', he: 'הותר במעבר חד-פעמי', es: 'permitido con pase de una sola vez', fr: 'autorisé par laissez-passer unique', ru: 'разрешено разовым пропуском', zh: '已凭一次放行通过', ja: '1 回限りの許可で通過', pt: 'permitido por liberação única', de: 'durch einmalige Freigabe zugelassen', ko: '1회 통과로 허용됨' },
} as const

type Verdict = { kind: 'fail' | 'pending' | 'green' | 'skipped' | 'timeout' | 'pass'; detail: string; command: string; at: number }
type State = { verdict: Verdict | null; pass: boolean }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'merge-gate' } as const, { verdict: null, pass: false } as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'merge-gate',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const incidents = atom({ plugin: 'toolkitty', key: 'slot', id: 'incidents' } as const, { count: 0, items: [], lastAt: null } as Incidents) as unknown as Atom<Incidents>

/** Reports a block or redaction to "Disasters prevented": kind and file name only, never a secret value. */
async function reportIncident($: EngineInterface, kind: string, detail: string): Promise<void> {
  try {
    const at = await $.clock.now()
    await update($, incidents, s => ({ count: s.count + 1, lastAt: at, items: [...s.items.slice(-99), { at, feature: feature.id, kind, detail }] }))
  } catch {
    // reporting never changes what the guard does
  }
}

const BUDGET_MS = 15000
const MAX_NAMES = 6

type Target = { kind: 'merge' | 'push'; prNumber: string }

function splitSegments(command: string): string[] {
  return command.split(/&&|\|\||;|\||\r?\n/).map(s => s.trim()).filter(s => s !== '')
}

/** Words that may stand before the real command: shell keywords, wrappers and `NAME=value` assignments. */
const LEAD_WORDS = new Set(['sudo', 'time', 'command', 'env', 'exec', 'nohup', 'nice', '!', 'then', 'do', 'else', 'elif', '{', '('])
/** `gh pr merge` flags that take a value, so the value is not mistaken for the PR. */
const VALUE_FLAGS = new Set(['-t', '--subject', '-b', '--body', '-F', '--body-file', '-A', '--author-email', '--match-head-commit', '-R', '--repo'])

/** The words of one command segment, from the command itself: wrappers, assignments and grouping marks dropped. */
function wordsOf(segment: string): string[] {
  const raw = segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  const words = raw.map(w => (/^["']/.test(w) ? w.replace(/^["']|["']$/g, '') : w.replace(/^[({]+/, '').replace(/[)}]+$/, '')))
  let i = 0
  while (i < words.length) {
    const w = words[i] ?? ''
    if (w === '' || LEAD_WORDS.has(w) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) i += 1
    else if (w === 'timeout') i += 2
    else break
  }
  return words.slice(i)
}

const baseName = (word: string): string => (word.split(/[\/]/).pop() ?? '').replace(/\.exe$/i, '')

function targetOf(segment: string): Target | null {
  const words = wordsOf(segment)
  const first = baseName(words[0] ?? '')

  if (first === 'gh' && words[1] === 'pr' && words[2] === 'merge') {
    let prNumber = ''
    for (let i = 3; i < words.length; i += 1) {
      const w = words[i] ?? ''
      if (w.startsWith('-')) {
        if (VALUE_FLAGS.has(w)) i += 1
        continue
      }
      prNumber = w
      break
    }
    return { kind: 'merge', prNumber }
  }

  if (first === 'git') {
    let i = 1
    while (i < words.length && (words[i] ?? '').startsWith('-')) i += words[i] === '-C' || words[i] === '-c' ? 2 : 1
    if (words[i] !== 'push') return null
    const rest = words.slice(i + 1)
    if (rest.some(w => w === '--dry-run' || w === '-n')) return null
    return { kind: 'push', prNumber: '' }
  }
  return null
}

type Check = { name: string; bucket: string }

function checksFromJson(stdout: string): Check[] | null {
  try {
    const parsed: unknown = JSON.parse(stdout)
    if (!Array.isArray(parsed)) return null
    return parsed.map((row: unknown) => {
      const r = (row ?? {}) as Record<string, unknown>
      const rowState = String(r['state'] ?? '').toLowerCase()
      let bucket = String(r['bucket'] ?? '').toLowerCase()
      if (bucket === '') {
        if (['failure', 'error', 'timed_out', 'startup_failure', 'action_required'].includes(rowState)) bucket = 'fail'
        else if (['pending', 'queued', 'in_progress', 'waiting', 'expected'].includes(rowState)) bucket = 'pending'
        else bucket = 'pass'
      }
      return { name: String(r['name'] ?? '?'), bucket }
    })
  } catch {
    return null
  }
}

/** The text form of `gh pr checks`: name, status (pass / fail / pending / skipping), elapsed, link; tab separated. */
function checksFromText(stdout: string): Check[] {
  const rows: Check[] = []
  for (const line of stdout.split('\n')) {
    const cols = line.split('\t')
    if (cols.length < 2) continue
    rows.push({ name: (cols[0] ?? '?').trim(), bucket: (cols[1] ?? '').trim().toLowerCase() })
  }
  return rows
}

type Ran = { out: { exitCode: number; stdout: string; stderr: string } | null; timedOut: boolean }

async function runShell($: EngineInterface, argv: string[], cwd: string, startedAt: number): Promise<Ran> {
  const begun = await $.clock.now()
  const left = Math.max(1000, BUDGET_MS - (begun - startedAt))
  try {
    const out = await $.process.run(argv, { cwd, timeoutMs: left })
    return { out, timedOut: false }
  } catch {
    const ended = await $.clock.now()
    return { out: null, timedOut: ended - begun >= left - 250 }
  }
}

async function record($: EngineInterface, kind: Verdict['kind'], detail: string, command: string): Promise<void> {
  const at = await $.clock.now()
  await update($, state, s => ({ ...s, verdict: { kind, detail, command, at } }))
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'merge-gate', description: t(T.cmdDesc), argumentHint: t(T.argHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'merge-gate', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function beforeBashCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined
  if (e.tool !== 'Bash') return undefined

  const target = splitSegments(e.command).map(targetOf).find((x): x is Target => x !== null)
  if (target === undefined) return undefined

  const startedAt = await $.clock.now()
  const command = e.command.replace(/\s+/g, ' ').trim().slice(0, 80)

  const { pass } = await read($, state)
  if (pass) {
    await update($, state, s => ({ ...s, pass: false }))
    await record($, 'pass', '', command)
    return undefined
  }

  const cwd = await $.session.cwd()

  const head = await runShell($, ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd, startedAt)
  if (head.timedOut) {
    await notice($, 'warn', t(T.toastTimeout), feature.id)
    await record($, 'timeout', 'git rev-parse', command)
    return undefined
  }
  const branch = head.out !== null && head.out.exitCode === 0 ? head.out.stdout.trim() : ''
  if (head.out === null || branch === '') {
    await record($, 'skipped', 'no git branch', command)
    return undefined
  }
  if (target.kind === 'push' && branch === 'HEAD') {
    await record($, 'skipped', 'detached HEAD', command)
    return undefined
  }

  const subject = target.prNumber !== '' ? target.prNumber : branch
  let checks: Check[] | null = null

  const asJson = await runShell($, ['gh', 'pr', 'checks', subject, '--json', 'name,state,bucket'], cwd, startedAt)
  if (asJson.timedOut) {
    await notice($, 'warn', t(T.toastTimeout), feature.id)
    await record($, 'timeout', 'gh pr checks', command)
    return undefined
  }
  if (asJson.out === null) {
    await record($, 'skipped', 'gh not available', command)
    return undefined
  }
  checks = checksFromJson(asJson.out.stdout)

  if (checks === null) {
    if (/no pull requests? found/i.test(asJson.out.stderr)) {
      await record($, 'skipped', 'no pull request', command)
      return undefined
    }
    // An older gh without --json, or another failure: fall back to the text form.
    const asText = await runShell($, ['gh', 'pr', 'checks', subject], cwd, startedAt)
    if (asText.timedOut) {
      await notice($, 'warn', t(T.toastTimeout), feature.id)
      await record($, 'timeout', 'gh pr checks', command)
      return undefined
    }
    if (asText.out === null || /no pull requests? found/i.test(asText.out.stderr)) {
      await record($, 'skipped', 'no pull request', command)
      return undefined
    }
    checks = checksFromText(asText.out.stdout)
  }

  if (checks.length === 0) {
    await record($, 'skipped', 'no checks reported', command)
    return undefined
  }

  const failing = checks.filter(c => c.bucket === 'fail')
  const pending = checks.filter(c => c.bucket === 'pending')
  const list = (rows: Check[]) => rows.slice(0, MAX_NAMES).map(c => c.name).join(', ') + (rows.length > MAX_NAMES ? ` +${rows.length - MAX_NAMES}` : '')

  // A push may be the fix for the failing CI: warn, never block. Only a merge is held.
  if (failing.length > 0) {
    await record($, 'fail', list(failing), command)
    if (target.kind === 'push') {
      await notice($, 'warn', t(T.denyFail, { branch, names: list(failing) }).slice(0, 160), feature.id)
      return undefined
    }
    await reportIncident($, 'ci-red', `failing: ${list(failing)}`)
    return { deny: t(T.denyFail, { branch, names: list(failing) }) }
  }
  if (pending.length > 0) {
    await record($, 'pending', list(pending), command)
    if (target.kind === 'push') return undefined
    await reportIncident($, 'ci-red', `pending: ${list(pending)}`)
    return { deny: t(T.denyPending, { n: pending.length, branch, names: list(pending) }) }
  }

  await record($, 'green', `${checks.length} checks`, command)
  return undefined
}

function stateText(kind: Verdict['kind']): string {
  if (kind === 'fail') return t(T.stBlockedFail)
  if (kind === 'pending') return t(T.stBlockedPending)
  if (kind === 'green') return t(T.stGreen)
  if (kind === 'timeout') return t(T.stTimeout)
  if (kind === 'pass') return t(T.stPass)
  return t(T.stSkipped)
}

export function register(on: On) {
  on('command.run', { command: 'merge-gate' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const arg = e.args.trim().toLowerCase()
    if (arg === 'allow') {
      await update($, state, s => ({ ...s, pass: true }))
      return { text: t(T.allowed) }
    }
    if (arg !== '' && arg !== 'status') return { text: t(T.usage) }

    const s = await read($, state)
    const lines: string[] = []
    if (s.verdict === null) {
      lines.push(t(T.noVerdict))
    } else {
      const now = await $.clock.now()
      lines.push(
        t(T.last, {
          ago: Math.max(0, Math.round((now - s.verdict.at) / 60000)),
          command: s.verdict.command,
          state: stateText(s.verdict.kind),
          detail: s.verdict.detail,
        }).trim(),
      )
    }
    if (s.pass) lines.push(t(T.passWaiting))
    return { text: lines.join('\n') }
  })
}
