import { atom, update } from 'claude-code'
import { isOn, t } from '../core'
import type { Atom, EngineInterface } from 'claude-code'
import type { Incidents } from '../shared'
import type { Feature, Localized, ToolCallInput, ToolCallOutput } from '../core'

const T = {
  title: { en: 'Dangerous commands', he: 'פקודות מסוכנות', es: 'Comandos peligrosos', fr: 'Commandes dangereuses', ru: 'Опасные команды', zh: '危险命令', ja: '危険なコマンド', pt: 'Comandos perigosos', de: 'Gefährliche Befehle', ko: '위험한 명령' },
  description: {
    en: 'Blocks destructive commands: broad rm -rf, force push, reset --hard and more.',
    he: 'חוסם פקודות הרסניות: rm -rf רחב, force push, reset --hard ועוד.',
    es: 'Bloquea comandos destructivos: rm -rf amplio, force push, reset --hard y más.',
    fr: 'Bloque les commandes destructrices : rm -rf trop large, force push, reset --hard et plus.',
    ru: 'Блокирует разрушительные команды: rm -rf по слишком широкому пути, force push, reset --hard и другие.',
    zh: '拦截破坏性命令：大范围的 rm -rf、强制推送、reset --hard 等。',
    ja: '破壊的なコマンドをブロックします：広範囲の rm -rf、強制プッシュ、reset --hard など。',
    pt: 'Bloqueia comandos destrutivos: rm -rf amplo, push forçado, reset --hard e mais.',
    de: 'Blockiert zerstörerische Befehle: weitreichendes rm -rf, Force-Push, reset --hard und mehr.',
    ko: '파괴적인 명령을 차단합니다: 광범위한 rm -rf, 강제 푸시, reset --hard 등.',
  },
  ruleRm: {
    en: 'rm -rf on a root or overly broad path (/, ~, *, .)',
    he: 'rm -rf על נתיב שורש או רחב מדי (/, ~, *, .)',
    es: 'rm -rf sobre una ruta raíz o demasiado amplia (/, ~, *, .)',
    fr: 'rm -rf sur un chemin racine ou trop large (/, ~, *, .)',
    ru: 'rm -rf для корневого или слишком широкого пути (/, ~, *, .)',
    zh: '对根目录或过宽路径执行 rm -rf（/、~、*、.）',
    ja: 'ルートや広すぎるパス（/、~、*、.）への rm -rf',
    pt: 'rm -rf em uma raiz ou caminho amplo demais (/, ~, *, .)',
    de: 'rm -rf auf einem Wurzel- oder viel zu weiten Pfad (/, ~, *, .)',
    ko: '루트 또는 지나치게 넓은 경로(/, ~, *, .)에 대한 rm -rf',
  },
  ruleForcePush: {
    en: 'git push --force (without --force-with-lease, or to main/master)',
    he: 'git push --force (ללא --force-with-lease, או לענף main/master)',
    es: 'git push --force (sin --force-with-lease, o hacia main/master)',
    fr: 'git push --force (sans --force-with-lease, ou vers main/master)',
    ru: 'git push --force (без --force-with-lease или в main/master)',
    zh: 'git push --force（没有 --force-with-lease，或推送到 main/master）',
    ja: 'git push --force（--force-with-lease なし、または main/master へ）',
    pt: 'git push --force (sem --force-with-lease, ou para main/master)',
    de: 'git push --force (ohne --force-with-lease oder auf main/master)',
    ko: 'git push --force(--force-with-lease 없이, 또는 main/master로)',
  },
  ruleCurlSh: {
    en: 'Downloading and running a script directly (curl/wget | sh)',
    he: 'הורדה והרצה ישירה של סקריפט (curl/wget | sh)',
    es: 'Descarga y ejecución directa de un script (curl/wget | sh)',
    fr: "Téléchargement et exécution directe d'un script (curl/wget | sh)",
    ru: 'Скачивание и прямой запуск скрипта (curl/wget | sh)',
    zh: '直接下载并运行脚本（curl/wget | sh）',
    ja: 'スクリプトを直接ダウンロードして実行（curl/wget | sh）',
    pt: 'Baixar e executar um script diretamente (curl/wget | sh)',
    de: 'Ein Skript direkt herunterladen und ausführen (curl/wget | sh)',
    ko: '스크립트를 직접 내려받아 실행(curl/wget | sh)',
  },
  ruleMkfs: {
    en: 'mkfs (creating a file system)',
    he: 'mkfs (יצירת מערכת קבצים)',
    es: 'mkfs (crear un sistema de archivos)',
    fr: "mkfs (création d'un système de fichiers)",
    ru: 'mkfs (создание файловой системы)',
    zh: 'mkfs（创建文件系统）',
    ja: 'mkfs（ファイルシステムの作成）',
    pt: 'mkfs (criar um sistema de arquivos)',
    de: 'mkfs (ein Dateisystem anlegen)',
    ko: 'mkfs(파일 시스템 생성)',
  },
  ruleDisk: {
    en: 'Writing directly to a disk device (> /dev/sd*)',
    he: 'כתיבה ישירה להתקן דיסק (> /dev/sd*)',
    es: 'Escritura directa en un dispositivo de disco (> /dev/sd*)',
    fr: 'Écriture directe sur un périphérique disque (> /dev/sd*)',
    ru: 'Прямая запись на дисковое устройство (> /dev/sd*)',
    zh: '直接写入磁盘设备（> /dev/sd*）',
    ja: 'ディスクデバイスへの直接書き込み（> /dev/sd*）',
    pt: 'Gravar diretamente em um dispositivo de disco (> /dev/sd*)',
    de: 'Direktes Schreiben auf ein Datenträgergerät (> /dev/sd*)',
    ko: '디스크 장치에 직접 쓰기(> /dev/sd*)',
  },
  denyHit: {
    en: 'Toolkitty · Dangerous commands: the command was blocked because it matches: {label}. If this is intended, run it manually in the terminal, or turn the feature off in the /toolkitty pane.',
    he: 'Toolkitty · פקודות מסוכנות: הפקודה נחסמה כי היא תואמת: {label}. אם זה מכוון, הרץ אותה ידנית בטרמינל, או כבה את השכלול בלוח /toolkitty.',
    es: 'Toolkitty · Comandos peligrosos: el comando se bloqueó porque coincide con: {label}. Si es intencional, ejecútalo manualmente en la terminal o desactiva la función en el panel /toolkitty.',
    fr: "Toolkitty · Commandes dangereuses : la commande a été bloquée car elle correspond à : {label}. Si c'est voulu, exécutez-la manuellement dans le terminal ou désactivez la fonction dans le panneau /toolkitty.",
    ru: 'Toolkitty · Опасные команды: команда заблокирована, так как она соответствует: {label}. Если это намеренно, запустите её вручную в терминале или отключите функцию в панели /toolkitty.',
    zh: 'Toolkitty · 危险命令：该命令已被拦截，因为它匹配：{label}。如果这是有意为之，请在终端中手动运行，或在 /toolkitty 面板中关闭该功能。',
    ja: 'Toolkitty · 危険なコマンド：次に該当するため、このコマンドをブロックしました：{label}。意図したものなら、ターミナルで手動実行するか、/toolkitty ペインでこの機能をオフにしてください。',
    pt: 'Toolkitty · Comandos perigosos: o comando foi bloqueado porque corresponde a: {label}. Se for intencional, execute-o manualmente no terminal ou desative o recurso no painel /toolkitty.',
    de: 'Toolkitty · Gefährliche Befehle: Der Befehl wurde blockiert, weil er zu Folgendem passt: {label}. Wenn das Absicht ist, führe ihn manuell im Terminal aus oder schalte die Funktion im Panel /toolkitty aus.',
    ko: 'Toolkitty · 위험한 명령: 다음에 해당하여 명령을 차단했습니다: {label}. 의도한 것이라면 터미널에서 직접 실행하거나 /toolkitty 창에서 이 기능을 끄세요.',
  },
  denyFail: {
    en: 'Toolkitty · Dangerous commands: the check failed, so the command was blocked. You can turn the feature off in the /toolkitty pane.',
    he: 'Toolkitty · פקודות מסוכנות: הבדיקה נכשלה, לכן הפקודה נחסמה. אפשר לכבות את השכלול בלוח /toolkitty.',
    es: 'Toolkitty · Comandos peligrosos: la comprobación falló, por lo que el comando se bloqueó. Puedes desactivar la función en el panel /toolkitty.',
    fr: 'Toolkitty · Commandes dangereuses : la vérification a échoué, la commande a donc été bloquée. Vous pouvez désactiver la fonction dans le panneau /toolkitty.',
    ru: 'Toolkitty · Опасные команды: проверка не удалась, поэтому команда заблокирована. Функцию можно отключить в панели /toolkitty.',
    zh: 'Toolkitty · 危险命令：检查失败，因此该命令已被拦截。你可以在 /toolkitty 面板中关闭该功能。',
    ja: 'Toolkitty · 危険なコマンド：チェックに失敗したため、このコマンドをブロックしました。/toolkitty ペインでこの機能をオフにできます。',
    pt: 'Toolkitty · Comandos perigosos: a verificação falhou, então o comando foi bloqueado. Você pode desativar o recurso no painel /toolkitty.',
    de: 'Toolkitty · Gefährliche Befehle: Die Prüfung ist fehlgeschlagen, daher wurde der Befehl blockiert. Du kannst die Funktion im Panel /toolkitty ausschalten.',
    ko: 'Toolkitty · 위험한 명령: 검사에 실패하여 명령을 차단했습니다. /toolkitty 창에서 이 기능을 끌 수 있습니다.',
  },
} as const

type Rule = { label: string | Localized; test: (command: string, raw: string) => boolean }

const unquote = (s: string): string => s.replace(/^["']+|["']+$/g, '')

/** True for a target `rm -r` must never be pointed at. */
const isDangerousRmTarget = (raw: string): boolean => {
  const t = unquote(raw)
  if (t === '/' || t === '~' || t === '*' || t === '.' || t === '..' || t === './' || t === '~/') return true
  if (t === '/*' || t === '~/*' || t === './*' || t === '$HOME' || t === '${HOME}') return true
  // An absolute or home path with fewer than two segments (/usr, ~/Documents is two).
  if (t.startsWith('/') || t.startsWith('~')) {
    const segments = t.replace(/^~/, '').split('/').filter(s => s !== '' && s !== '*')
    return t.startsWith('/') ? segments.length < 2 : segments.length < 1
  }
  return false
}

const segmentsOf = (command: string): string[] => command.split(/&&|\|\||[;\n|]/)

const rmRecursiveOnRoot = (command: string): boolean =>
  segmentsOf(command).some(segment => {
    const tokens = segment.trim().split(/\s+/)
    const at = tokens.findIndex(t => t === 'rm')
    if (at === -1) return false
    const rest = tokens.slice(at + 1)
    const isRecursive = rest.some(t => /^-[a-zA-Z]*[rR][a-zA-Z]*$/.test(t) || t === '--recursive')
    if (!isRecursive) return false
    return rest.filter(t => !t.startsWith('-')).some(isDangerousRmTarget)
  })

const forcePush = (command: string): boolean =>
  segmentsOf(command).some(segment => {
    if (!/\bgit\s+push\b/.test(segment)) return false
    const hasLease = /--force-with-lease/.test(segment)
    // `--force`, `-f`, and a `+ref` refspec (git push origin +main) all force the update.
    const hasPlainForce = /(^|\s)(--force|-[a-zA-Z]*f[a-zA-Z]*)(\s|$)/.test(segment) || /(^|\s)\+\S/.test(segment)
    const targetsMain = /(^|[\s:+])(main|master)(\s|$)/.test(segment)
    if (hasPlainForce) return true
    return hasLease && targetsMain
  })

/**
 * The command without the text that is only data: heredoc bodies and quoted
 * strings. A script piped through a heredoc that merely mentions
 * `git push --force` is not a force push.
 */
const withoutLiterals = (command: string): string => {
  let out = command
  // heredoc bodies: <<EOF ... EOF, <<'EOF', <<"EOF", <<-EOF
  out = out.replace(/<<-?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?[^\n]*\n[\s\S]*?\n\s*\1\s*(?=\n|$)/g, '<<HEREDOC')
  // a quoted single word is the word itself ("/" or "$HOME" as an rm target)
  out = out.replace(/'([^'\s]*)'|"([^"\s]*)"/g, (_m: string, a: string | undefined, b: string | undefined) => a ?? b ?? '')
  // other quoted strings are only data (a lone quote is left alone)
  out = out.replace(/'[^'\n]*'/g, "''").replace(/"[^"\n]*"/g, '""')
  return out
}

const SQL_CLIENT = /\b(psql|mysql|mariadb|sqlite3|sqlcmd|sqlplus|duckdb|clickhouse-client|mongosh?)\b/
const SQL_DESTRUCTIVE = /\b(DROP\s+(TABLE|DATABASE)|TRUNCATE)\b/i

const RULES: readonly Rule[] = [
  { label: T.ruleRm, test: rmRecursiveOnRoot },
  { label: T.ruleForcePush, test: forcePush },
  { label: 'git reset --hard', test: c => /\bgit\s+reset\s+(.*\s)?--hard\b/.test(c) },
  { label: 'git checkout -- .', test: c => /\bgit\s+checkout\s+(.*\s)?--\s+\.(\s|$)/.test(c) },
  { label: 'git clean -fd', test: c => /\bgit\s+clean\s+(.*\s)?-[a-zA-Z]*(fd|df)[a-zA-Z]*/.test(c) },
  // Given to a SQL client the statement sits inside quotes (psql -c "DROP TABLE x"), so with a client the unstripped command is checked.
  { label: 'DROP TABLE / DROP DATABASE / TRUNCATE', test: (c, raw) => SQL_DESTRUCTIVE.test(c) || (SQL_CLIENT.test(raw) && SQL_DESTRUCTIVE.test(raw)) },
  { label: T.ruleCurlSh, test: c => /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(c) },
  { label: 'chmod -R 777', test: c => /\bchmod\s+(-\S*R\S*|--recursive)\s+(\S+\s+)*777\b/.test(c) || /\bchmod\s+777\s+(-\S*R\S*)/.test(c) },
  { label: T.ruleMkfs, test: c => /\bmkfs(\.\w+)?\b/.test(c) },
  { label: 'fork bomb', test: c => /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/.test(c) },
  { label: T.ruleDisk, test: c => />\s*\/dev\/sd[a-z]/.test(c) },
]

export const feature: Feature = {
  id: 'dangerous-commands',
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

export async function beforeBashCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined
  if (e.tool !== 'Bash') return undefined

  try {
    const command = withoutLiterals(e.command)
    const hit = RULES.find(r => r.test(command, e.command))
    if (hit === undefined) return undefined

    await reportIncident($, 'dangerous-command', typeof hit.label === 'string' ? hit.label : hit.label.en)
    return {
      deny: t(T.denyHit, { label: typeof hit.label === 'string' ? hit.label : t(hit.label) }),
    }
  } catch {
    return { deny: t(T.denyFail) }
  }
}
