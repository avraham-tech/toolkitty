import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { Incidents } from '../shared'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: {
    en: 'Blast radius',
    he: 'רדיוס הנזק',
    es: 'Radio de impacto',
    fr: "Rayon d'impact",
    ru: 'Радиус поражения',
    zh: '影响范围',
    ja: '影響範囲',
    pt: 'Raio de impacto',
    de: 'Wirkungsradius',
    ko: '영향 범위',
  },
  description: {
    en: 'Before rm -r, git clean, git reset --hard, find -delete and similar, checks what would really be touched and blocks large ones until you allow them.',
    he: 'לפני rm -r, git clean, git reset --hard, find -delete ועוד, בודק מה באמת ייפגע וחוסם פעולות גדולות עד שתאשר אותן.',
    es: 'Antes de rm -r, git clean, git reset --hard, find -delete y similares, comprueba qué se tocaría realmente y bloquea los casos grandes hasta que los permitas.',
    fr: "Avant rm -r, git clean, git reset --hard, find -delete et similaires, vérifie ce qui serait réellement touché et bloque les cas importants jusqu'à ce que vous les autorisiez.",
    ru: 'Перед rm -r, git clean, git reset --hard, find -delete и подобными проверяет, что реально заденет команда, и блокирует крупные, пока вы не разрешите.',
    zh: '在 rm -r、git clean、git reset --hard、find -delete 等命令执行前，检查实际会影响哪些内容，并拦截影响较大的命令，直到你允许。',
    ja: 'rm -r、git clean、git reset --hard、find -delete などの実行前に、実際に影響が及ぶ範囲を調べ、大規模なものはあなたが許可するまでブロックします。',
    pt: 'Antes de rm -r, git clean, git reset --hard, find -delete e similares, verifica o que seria realmente afetado e bloqueia os casos grandes até você permitir.',
    de: 'Vor rm -r, git clean, git reset --hard, find -delete und Ähnlichem wird geprüft, was tatsächlich betroffen wäre, und große Fälle werden blockiert, bis du sie erlaubst.',
    ko: 'rm -r, git clean, git reset --hard, find -delete 등을 실행하기 전에 실제로 영향받는 대상을 확인하고, 규모가 큰 경우 허용할 때까지 차단합니다.',
  },
  off: {
    en: 'This feature is off; turn it on in the /toolkitty panel',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'Esta función está desactivada; actívala en el panel /toolkitty',
    fr: 'Cette fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty',
    ru: 'Функция выключена; включите её на панели /toolkitty',
    zh: '此功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty パネルでオンにしてください',
    pt: 'Este recurso está desativado; ative-o no painel /toolkitty',
    de: 'Diese Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요',
  },
  commandDesc: {
    en: 'Blast radius log; "allow" gives a one-shot pass, "threshold <n>" sets the limit',
    he: 'יומן רדיוס הנזק; "allow" נותן מעבר חד-פעמי, "threshold <n>" קובע את הסף',
    es: 'Registro del radio de impacto; "allow" da un pase único, "threshold <n>" fija el límite',
    fr: 'Journal du rayon d\'impact ; "allow" donne un laissez-passer unique, "threshold <n>" fixe la limite',
    ru: 'Журнал радиуса поражения; "allow" даёт разовый пропуск, "threshold <n>" задаёт порог',
    zh: '影响范围日志；"allow" 授予一次性放行，"threshold <n>" 设置上限',
    ja: '影響範囲のログ。「allow」で一度だけ許可、「threshold <n>」で上限を設定します',
    pt: 'Log do raio de impacto; "allow" dá uma autorização única, "threshold <n>" define o limite',
    de: 'Wirkungsradius-Log; „allow“ gibt eine einmalige Freigabe, „threshold <n>“ setzt die Grenze',
    ko: '영향 범위 로그. "allow"는 1회 허용, "threshold <n>"은 한도를 설정합니다',
  },
  argHint: {
    en: 'allow | threshold <n>',
    he: 'allow | threshold <n>',
    es: 'allow | threshold <n>',
    fr: 'allow | threshold <n>',
    ru: 'allow | threshold <n>',
    zh: 'allow | threshold <n>',
    ja: 'allow | threshold <n>',
    pt: 'allow | threshold <n>',
    de: 'allow | threshold <n>',
    ko: 'allow | threshold <n>',
  },
  denyBody: {
    en: 'Toolkitty · Blast radius: this command ({what}) would affect {total} items (threshold {threshold}). First {shown}:\n{list}\n{more}To run it anyway, the user can type /blast allow and retry.',
    he: 'Toolkitty · רדיוס הנזק: הפקודה ({what}) תשפיע על {total} פריטים (סף {threshold}). {shown} הראשונים:\n{list}\n{more}כדי להריץ אותה בכל זאת, המשתמש יכול להקליד /blast allow ולנסות שוב.',
    es: 'Toolkitty · Radio de impacto: este comando ({what}) afectaría a {total} elementos (umbral {threshold}). Los primeros {shown}:\n{list}\n{more}Para ejecutarlo de todos modos, el usuario puede escribir /blast allow y reintentar.',
    fr: "Toolkitty · Rayon d'impact : cette commande ({what}) affecterait {total} éléments (seuil {threshold}). Les {shown} premiers :\n{list}\n{more}Pour l'exécuter malgré tout, l'utilisateur peut taper /blast allow puis réessayer.",
    ru: 'Toolkitty · Радиус поражения: команда ({what}) затронет элементов: {total} (порог {threshold}). Первые {shown}:\n{list}\n{more}Чтобы всё равно выполнить её, пользователь может ввести /blast allow и повторить.',
    zh: 'Toolkitty · 影响范围：此命令（{what}）将影响 {total} 项（阈值 {threshold}）。前 {shown} 项：\n{list}\n{more}如仍要运行，用户可输入 /blast allow 后重试。',
    ja: 'Toolkitty · 影響範囲: このコマンド（{what}）は {total} 件に影響します（しきい値 {threshold}）。最初の {shown} 件:\n{list}\n{more}それでも実行するには、ユーザーが /blast allow と入力してから再試行してください。',
    pt: 'Toolkitty · Raio de impacto: este comando ({what}) afetaria {total} itens (limite {threshold}). Primeiros {shown}:\n{list}\n{more}Para executá-lo mesmo assim, o usuário pode digitar /blast allow e tentar de novo.',
    de: 'Toolkitty · Wirkungsradius: Dieser Befehl ({what}) würde {total} Elemente betreffen (Schwelle {threshold}). Die ersten {shown}:\n{list}\n{more}Um ihn trotzdem auszuführen, kann der Nutzer /blast allow eingeben und es erneut versuchen.',
    ko: 'Toolkitty · 영향 범위: 이 명령({what})은 {total}개 항목에 영향을 줍니다(임계값 {threshold}). 처음 {shown}개:\n{list}\n{more}그래도 실행하려면 사용자가 /blast allow를 입력한 뒤 다시 시도하세요.',
  },
  more: {
    en: '... and more not shown.\n',
    he: '... ועוד שלא מוצגים.\n',
    es: '... y más que no se muestran.\n',
    fr: '... et d\'autres non affichés.\n',
    ru: '... и другие, не показанные.\n',
    zh: '……以及更多未显示的项。\n',
    ja: '... 他にも表示されていない項目があります。\n',
    pt: '... e mais itens não mostrados.\n',
    de: '... und weitere, nicht angezeigte.\n',
    ko: '... 그 외 표시되지 않은 항목이 더 있습니다.\n',
  },
  allowed: {
    en: 'One-shot pass granted for 10 minutes: the next blocked command will run.',
    he: 'ניתן מעבר חד-פעמי ל-10 דקות: הפקודה החסומה הבאה תרוץ.',
    es: 'Pase único concedido por 10 minutos: se ejecutará el próximo comando bloqueado.',
    fr: 'Laissez-passer unique accordé pour 10 minutes : la prochaine commande bloquée sera exécutée.',
    ru: 'Разовый пропуск выдан на 10 минут: следующая заблокированная команда выполнится.',
    zh: '已授予 10 分钟的一次性放行：下一条被拦截的命令将会运行。',
    ja: '10分間の一度きりの許可を付与しました: 次にブロックされるコマンドが実行されます。',
    pt: 'Autorização única concedida por 10 minutos: o próximo comando bloqueado será executado.',
    de: 'Einmalige Freigabe für 10 Minuten erteilt: Der nächste blockierte Befehl wird ausgeführt.',
    ko: '10분간 1회 허용이 부여되었습니다: 다음에 차단된 명령이 실행됩니다.',
  },
  thresholdSet: {
    en: 'Threshold set to {n} items.',
    he: 'הסף נקבע ל-{n} פריטים.',
    es: 'Umbral fijado en {n} elementos.',
    fr: 'Seuil fixé à {n} éléments.',
    ru: 'Порог установлен: {n}.',
    zh: '阈值已设为 {n} 项。',
    ja: 'しきい値を {n} 件に設定しました。',
    pt: 'Limite definido para {n} itens.',
    de: 'Schwelle auf {n} Elemente gesetzt.',
    ko: '임계값을 {n}개로 설정했습니다.',
  },
  usage: {
    en: 'Usage: /blast, /blast allow, /blast threshold <n>',
    he: 'שימוש: ‎/blast, ‎/blast allow, ‎/blast threshold <n>',
    es: 'Uso: /blast, /blast allow, /blast threshold <n>',
    fr: 'Utilisation : /blast, /blast allow, /blast threshold <n>',
    ru: 'Использование: /blast, /blast allow, /blast threshold <n>',
    zh: '用法：/blast、/blast allow、/blast threshold <n>',
    ja: '使い方: /blast、/blast allow、/blast threshold <n>',
    pt: 'Uso: /blast, /blast allow, /blast threshold <n>',
    de: 'Verwendung: /blast, /blast allow, /blast threshold <n>',
    ko: '사용법: /blast, /blast allow, /blast threshold <n>',
  },
  logHead: {
    en: 'Blast radius: threshold {n} items. Log (newest first):',
    he: 'רדיוס הנזק: סף {n} פריטים. יומן (החדשים ראשונים):',
    es: 'Radio de impacto: umbral {n} elementos. Registro (los más recientes primero):',
    fr: "Rayon d'impact : seuil {n} éléments. Journal (les plus récents d'abord) :",
    ru: 'Радиус поражения: порог {n}. Журнал (сначала новые):',
    zh: '影响范围：阈值 {n} 项。日志（最新在前）：',
    ja: '影響範囲: しきい値 {n} 件。ログ（新しい順）:',
    pt: 'Raio de impacto: limite de {n} itens. Log (mais recente primeiro):',
    de: 'Wirkungsradius: Schwelle {n} Elemente. Log (neueste zuerst):',
    ko: '영향 범위: 임계값 {n}개. 로그(최신순):',
  },
  logEmpty: {
    en: 'No destructive commands checked yet.',
    he: 'עדיין לא נבדקו פקודות הרסניות.',
    es: 'Aún no se ha comprobado ningún comando destructivo.',
    fr: "Aucune commande destructrice vérifiée pour l'instant.",
    ru: 'Опасные команды пока не проверялись.',
    zh: '尚未检查任何破坏性命令。',
    ja: '破壊的なコマンドはまだチェックされていません。',
    pt: 'Nenhum comando destrutivo verificado ainda.',
    de: 'Noch keine destruktiven Befehle geprüft.',
    ko: '아직 검사한 파괴적 명령이 없습니다.',
  },
  logRow: {
    en: '{outcome} · {what} · {count} items · {cmd}',
    he: '{outcome} · {what} · {count} פריטים · {cmd}',
    es: '{outcome} · {what} · {count} elementos · {cmd}',
    fr: '{outcome} · {what} · {count} éléments · {cmd}',
    ru: '{outcome} · {what} · элементов: {count} · {cmd}',
    zh: '{outcome} · {what} · {count} 项 · {cmd}',
    ja: '{outcome} · {what} · {count} 件 · {cmd}',
    pt: '{outcome} · {what} · {count} itens · {cmd}',
    de: '{outcome} · {what} · {count} Elemente · {cmd}',
    ko: '{outcome} · {what} · {count}개 항목 · {cmd}',
  },
  outOk: { en: 'allowed', he: 'הותר', es: 'permitido', fr: 'autorisé', ru: 'разрешено', zh: '已允许', ja: '許可', pt: 'permitido', de: 'erlaubt', ko: '허용됨' },
  outDenied: { en: 'BLOCKED', he: 'נחסם', es: 'BLOQUEADO', fr: 'BLOQUÉ', ru: 'ЗАБЛОКИРОВАНО', zh: '已拦截', ja: 'ブロック', pt: 'BLOQUEADO', de: 'BLOCKIERT', ko: '차단됨' },
  outPassed: { en: 'passed once', he: 'עבר חד-פעמית', es: 'pase único', fr: 'passage unique', ru: 'разовый пропуск', zh: '放行一次', ja: '一度だけ通過', pt: 'passou uma vez', de: 'einmal durchgelassen', ko: '1회 통과' },
} as const

type Outcome = 'ok' | 'denied' | 'passed'
type LogRow = { at: number; cmd: string; what: string; count: number; isTruncated: boolean; outcome: Outcome }
type State = { threshold: number; allowUntil: number; log: LogRow[] }

const DEFAULT_THRESHOLD = 5
const MAX_LOG = 30
const MAX_ENTRIES = 200
const SHOWN = 25
const TIMEOUT_MS = 10_000
const PASS_MS = 10 * 60 * 1000

const state = atom(
  { plugin: 'toolkitty', key: 'slot', id: 'blast-radius' } as const,
  { threshold: DEFAULT_THRESHOLD, allowUntil: 0, log: [] } as State,
) as unknown as Atom<State>

export const feature: Feature = {
  id: 'blast-radius',
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

type Found = { what: string; paths: string[]; isTruncated: boolean }

const unquote = (s: string): string => s.replace(/^["']+|["']+$/g, '')

const isAbsolute = (p: string): boolean => /^([A-Za-z]:[\\/]|[\\/])/.test(p)

const joinPath = (base: string, p: string): string => {
  if (p === '-' || p.startsWith('~') || p.startsWith('$')) return base
  return isAbsolute(p) ? p : `${base.replace(/[\\/]+$/, '')}/${p}`
}

const lines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map(l => l.trimEnd())
    .filter(l => l !== '')

/** Same targets dangerous-commands.tsx blocks outright; this feature leaves them to it. */
const isDangerousRmTarget = (raw: string): boolean => {
  const p = unquote(raw)
  if (p === '/' || p === '~' || p === '*' || p === '.' || p === '..' || p === './' || p === '~/') return true
  if (p === '/*' || p === '~/*' || p === './*' || p === '$HOME' || p === '${HOME}') return true
  if (p.startsWith('/') || p.startsWith('~')) {
    const segments = p.replace(/^~/, '').split('/').filter(s => s !== '' && s !== '*')
    return p.startsWith('/') ? segments.length < 2 : segments.length < 1
  }
  return false
}

const segmentsOf = (command: string): string[] => command.split(/&&|\|\||[;\n|]/)

async function windowsHost($: EngineInterface, cwd: string): Promise<boolean> {
  const os = await $.env.get('OS')
  return os === 'Windows_NT' || /^[A-Za-z]:[\\/]/.test(cwd)
}

async function gitOut($: EngineInterface, cwd: string, args: readonly string[]): Promise<string | null> {
  const r = await $.process.run(['git', ...args], { cwd, timeoutMs: TIMEOUT_MS })
  return r.exitCode === 0 ? r.stdout : null
}

/** Entries matching a glob, from the shell (non-Windows) or `dir` (Windows). */
async function globEntries($: EngineInterface, cwd: string, pattern: string, windows: boolean): Promise<string[]> {
  if (windows) {
    const r = await $.process.run(['cmd', '/c', 'dir', '/s', '/b', pattern.replace(/\//g, '\\')], { cwd, timeoutMs: TIMEOUT_MS })
    return lines(r.stdout).slice(0, MAX_ENTRIES + 1)
  }
  if (!/^[\w@%+=:,./*?[\]~-]+$/.test(pattern)) return []
  const r = await $.process.run(['sh', '-c', `find ${pattern} 2>/dev/null | head -${MAX_ENTRIES + 1}`], { cwd, timeoutMs: TIMEOUT_MS })
  return lines(r.stdout)
}

/** Lists what `rm -r <targets>` would remove: files, recursively, up to MAX_ENTRIES + 1 entries. */
async function listRm($: EngineInterface, cwd: string, targets: readonly string[], windows: boolean): Promise<Found> {
  const out: string[] = []
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? ''

  for (const raw of targets) {
    if (out.length > MAX_ENTRIES) break
    const target = raw.startsWith('~/') && home !== '' ? `${home.replace(/[\\/]+$/, '')}/${raw.slice(2)}` : raw
    if (target.startsWith('~')) continue

    if (/[*?[]/.test(target)) {
      out.push(...(await globEntries($, cwd, target, windows)))
      continue
    }

    const abs = joinPath(cwd, target)
    try {
      const info = await $.fs.stat(abs)
      if (info.kind !== 'dir') {
        out.push(abs)
        continue
      }
    } catch {
      continue
    }

    const stack = [abs]
    while (stack.length > 0 && out.length <= MAX_ENTRIES) {
      const dir = stack.pop() ?? abs
      try {
        for (const entry of await $.fs.list(dir)) {
          const full = `${dir.replace(/[\\/]+$/, '')}/${entry.name}`
          if (entry.kind === 'dir') stack.push(full)
          else out.push(full)
          if (out.length > MAX_ENTRIES) break
        }
      } catch {
        // an unreadable directory adds nothing
      }
    }
  }

  const isTruncated = out.length > MAX_ENTRIES
  return { what: 'rm -r', paths: out.slice(0, MAX_ENTRIES), isTruncated }
}

const trackedChanges = (porcelain: string): string[] =>
  lines(porcelain)
    .filter(l => l.length > 3 && !l.startsWith('??'))
    .map(l => l.slice(3))

/** Words that may stand before the real command: shell keywords, wrappers and `NAME=value` assignments. */
const LEAD_WORDS = new Set(['sudo', 'time', 'command', 'env', 'exec', 'nohup', 'nice', '!', 'then', 'do', 'else', 'elif', '{', '('])

/** The words of a segment from the command itself (so `echo "rm -rf x"` or a commit message that names rm is not an rm). */
function commandWords(segment: string): string[] {
  const words = segment.trim().split(/\s+/).map(unquote).map(w => w.replace(/^[({]+/, '')).filter(x => x !== '')
  let i = 0
  while (i < words.length) {
    const w = words[i] ?? ''
    if (LEAD_WORDS.has(w) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) i += 1
    else if (w === 'timeout') i += 2
    else break
  }
  const rest = words.slice(i)
  if (rest.length > 0) rest[0] = (rest[0] ?? '').split(/[\/]/).pop() ?? ''
  return rest
}

/** The dry run for one command segment, or null when it is not a destructive form this feature knows. */
async function previewSegment($: EngineInterface, cwd: string, segment: string, windows: boolean): Promise<Found | null> {
  const tokens = commandWords(segment)

  const rmAt = tokens[0] === 'rm' ? 0 : -1
  if (rmAt !== -1) {
    const rest = tokens.slice(rmAt + 1)
    const isRecursive = rest.some(x => /^-[a-zA-Z]*[rR][a-zA-Z]*$/.test(x) || x === '--recursive')
    const targets = rest.filter(x => !x.startsWith('-'))
    // A target the shell will expand ($VAR, `cmd`, $(...)) cannot be previewed here: previewing the
    // literal text would list the wrong place (the cwd), so such commands are left alone.
    const isUnexpanded = targets.some(x => /[$`]/.test(x))
    if (isRecursive && targets.length > 0 && !isUnexpanded && !targets.some(isDangerousRmTarget)) return listRm($, cwd, targets, windows)
    return null
  }

  const gitAt = tokens[0] === 'git' ? 0 : -1
  if (gitAt !== -1) {
    let i = gitAt + 1
    let gitCwd = cwd
    while (i < tokens.length && (tokens[i] ?? '').startsWith('-')) {
      if (tokens[i] === '-C') {
        gitCwd = joinPath(gitCwd, tokens[i + 1] ?? '.')
        i += 2
      } else i += 1
    }
    const sub = tokens[i]
    const rest = tokens.slice(i + 1)

    if (sub === 'clean') {
      const isForced = rest.some(x => /^-[a-zA-Z]*f[a-zA-Z]*$/.test(x) || x === '--force')
      if (!isForced) return null
      const dry: string[] = []
      for (const x of rest) {
        if (x === '--force' || x === '--interactive' || x === '--dry-run' || x === '--quiet') continue
        if (/^-[a-zA-Z]+$/.test(x)) {
          const kept = x.replace(/[fniq]/g, '')
          if (kept !== '-') dry.push(kept)
        } else dry.push(x)
      }
      const out = await gitOut($, gitCwd, ['clean', '-n', ...dry])
      if (out === null) return null
      const paths = lines(out).filter(l => l.startsWith('Would remove ')).map(l => l.slice('Would remove '.length))
      return { what: 'git clean', paths, isTruncated: false }
    }

    const dashAt = rest.indexOf('--')
    const isCheckoutAll = sub === 'checkout' && (rest.join(' ') === '.' || (dashAt !== -1 && rest[dashAt + 1] === '.'))
    const isRestoreAll = sub === 'restore' && rest.includes('.') && !rest.includes('--staged') && !rest.includes('-S')
    if (isCheckoutAll || isRestoreAll) {
      const out = await gitOut($, gitCwd, ['status', '--porcelain', '--', '.'])
      return out === null ? null : { what: isCheckoutAll ? 'git checkout -- .' : 'git restore .', paths: trackedChanges(out), isTruncated: false }
    }

    if (sub === 'reset' && rest.includes('--hard')) {
      const out = await gitOut($, gitCwd, ['status', '--porcelain'])
      return out === null ? null : { what: 'git reset --hard', paths: trackedChanges(out), isTruncated: false }
    }

    if (sub === 'stash' && rest[0] === 'drop') {
      const ref = rest[1] !== undefined && !rest[1].startsWith('-') ? [rest[1]] : []
      const out = await gitOut($, gitCwd, ['stash', 'show', '--name-only', ...ref])
      return out === null ? null : { what: 'git stash drop', paths: lines(out), isTruncated: false }
    }
    if (sub === 'stash' && rest[0] === 'clear') {
      const out = await gitOut($, gitCwd, ['stash', 'list'])
      return out === null ? null : { what: 'git stash clear', paths: lines(out), isTruncated: false }
    }
    return null
  }

  if (tokens[0] === 'find' && tokens.includes('-delete')) {
    if (/-exec|-execdir|-ok\b|-okdir|\$\(|`/.test(segment)) return null
    const shellText = segment.trim().replace(/\s-delete\b/g, '')
    const argv = windows ? ['bash', '-c', `${shellText} | head -${MAX_ENTRIES + 1}`] : ['sh', '-c', `${shellText} | head -${MAX_ENTRIES + 1}`]
    const r = await $.process.run(argv, { cwd, timeoutMs: TIMEOUT_MS })
    const found = lines(r.stdout)
    return { what: 'find -delete', paths: found.slice(0, MAX_ENTRIES), isTruncated: found.length > MAX_ENTRIES }
  }

  return null
}

async function previewCommand($: EngineInterface, command: string): Promise<Found[]> {
  let cwd = await $.session.cwd()
  const windows = await windowsHost($, cwd)
  const founds: Found[] = []

  for (const segment of segmentsOf(command)) {
    const words = segment.trim().split(/\s+/).map(unquote)
    if (words[0] === 'cd' && words[1] !== undefined) {
      cwd = joinPath(cwd, words[1])
      continue
    }
    try {
      const found = await previewSegment($, cwd, segment, windows)
      if (found !== null) founds.push(found)
    } catch {
      // a dry run that fails never blocks the command
    }
  }
  return founds
}

const shorten = (text: string, max: number): string => {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'blast', description: t(T.commandDesc), argumentHint: t(T.argHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'blast', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }

  const stored = await storeGet<number>($, 'blast-radius:threshold', DEFAULT_THRESHOLD)
  const threshold = Number.isFinite(stored) && stored >= 0 ? Math.floor(stored) : DEFAULT_THRESHOLD
  await update($, state, s => ({ ...s, threshold }))
}

export async function beforeBashCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined
  if (e.tool !== 'Bash') return undefined
  if (!/\b(rm|clean|checkout|restore|reset|stash|find)\b/.test(e.command)) return undefined

  try {
    const timeout = $.clock.sleep(TIMEOUT_MS + 2000).then(() => null)
    const founds = await Promise.race([previewCommand($, e.command), timeout])
    if (founds === null || founds.length === 0) return undefined

    const paths = founds.flatMap(f => f.paths)
    const isTruncated = founds.some(f => f.isTruncated)
    const total = paths.length
    const what = founds.map(f => f.what).join(' + ')
    const s = await read($, state)
    const now = await $.clock.now()
    const row = { at: now, cmd: shorten(e.command, 80), what, count: total, isTruncated }

    if (total <= s.threshold) {
      await update($, state, cur => ({ ...cur, log: [{ ...row, outcome: 'ok' as Outcome }, ...cur.log].slice(0, MAX_LOG) }))
      return undefined
    }

    if (s.allowUntil > now) {
      await update($, state, cur => ({ ...cur, allowUntil: 0, log: [{ ...row, outcome: 'passed' as Outcome }, ...cur.log].slice(0, MAX_LOG) }))
      return undefined
    }

    await update($, state, cur => ({ ...cur, log: [{ ...row, outcome: 'denied' as Outcome }, ...cur.log].slice(0, MAX_LOG) }))
    await reportIncident($, 'blast-radius', `${what}: ${isTruncated ? `${MAX_ENTRIES}+` : total} files`)
    const shown = paths.slice(0, SHOWN)
    return {
      deny: t(T.denyBody, {
        what,
        total: isTruncated ? `${MAX_ENTRIES}+` : total,
        threshold: s.threshold,
        shown: shown.length,
        list: shown.join('\n'),
        more: paths.length > shown.length || isTruncated ? t(T.more) : '',
      }),
    }
  } catch {
    return undefined
  }
}

export function register(on: On) {
  on('command.run', { command: 'blast' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const args = e.args.trim().split(/\s+/).filter(x => x !== '')
    const s = await read($, state)

    if (args.length === 0) {
      if (s.log.length === 0) return { text: `${t(T.logHead, { n: s.threshold })}\n${t(T.logEmpty)}` }
      const label = (o: Outcome): string => t(o === 'ok' ? T.outOk : o === 'denied' ? T.outDenied : T.outPassed)
      const rows = s.log.map(r =>
        t(T.logRow, { outcome: label(r.outcome), what: r.what, count: r.isTruncated ? `${MAX_ENTRIES}+` : r.count, cmd: r.cmd }),
      )
      return { text: [t(T.logHead, { n: s.threshold }), ...rows].join('\n') }
    }

    if (args[0] === 'allow') {
      const now = await $.clock.now()
      await update($, state, cur => ({ ...cur, allowUntil: now + PASS_MS }))
      return { text: t(T.allowed) }
    }

    if (args[0] === 'threshold') {
      const n = Number(args[1])
      if (args[1] === undefined || !Number.isInteger(n) || n < 0 || n > 100_000) return { text: t(T.usage) }
      await storeSet($, 'blast-radius:threshold', n)
      await update($, state, cur => ({ ...cur, threshold: n }))
      return { text: t(T.thresholdSet, { n }) }
    }

    return { text: t(T.usage) }
  })
}
