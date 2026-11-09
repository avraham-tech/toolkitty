import type { Feature, ToolCallInput, ToolCallOutput } from '../core'
import { atom, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'
import { isOn, t } from '../core'
import type { Incidents } from '../shared'

const T = {
  title: { en: 'Secret protection', he: 'הגנת סודות', es: 'Protección de secretos', fr: 'Protection des secrets', ru: 'Защита секретов', zh: '密钥保护', ja: 'シークレット保護', pt: 'Proteção de segredos', de: 'Geheimnisschutz', ko: '비밀 파일 보호' },
  description: { en: 'Blocks writes to secret files (.env, keys, credentials); reading is allowed.', he: 'חוסם כתיבה לקבצי סודות (.env, מפתחות, אישורים); קריאה מותרת.', es: 'Bloquea la escritura en archivos de secretos (.env, claves, credenciales); la lectura está permitida.', fr: 'Bloque l\'écriture dans les fichiers de secrets (.env, clés, identifiants) ; la lecture reste autorisée.', ru: 'Блокирует запись в файлы с секретами (.env, ключи, учётные данные); чтение разрешено.', zh: '阻止写入密钥文件（.env、密钥、凭据）；允许读取。', ja: 'シークレットファイル（.env、鍵、認証情報）への書き込みをブロックします。読み取りは許可されます。', pt: 'Bloqueia gravações em arquivos de segredos (.env, chaves, credenciais); a leitura é permitida.', de: 'Blockiert Schreibzugriffe auf Geheimnisdateien (.env, Schlüssel, Zugangsdaten); Lesen ist erlaubt.', ko: '비밀 파일(.env, 키, 자격 증명)에 대한 쓰기를 차단합니다. 읽기는 허용됩니다.' },
  deny: { en: 'Toolkitty · Secret protection: {what}. You can turn this feature off in the /toolkitty pane.', he: 'Toolkitty · הגנת סודות: {what}. אפשר לכבות את התכונה בחלונית /toolkitty.', es: 'Toolkitty · Protección de secretos: {what}. Puedes desactivar esta función en el panel /toolkitty.', fr: 'Toolkitty · Protection des secrets : {what}. Vous pouvez désactiver cette fonctionnalité dans le panneau /toolkitty.', ru: 'Toolkitty · Защита секретов: {what}. Эту функцию можно отключить в панели /toolkitty.', zh: 'Toolkitty · 密钥保护：{what}。你可以在 /toolkitty 面板中关闭此功能。', ja: 'Toolkitty · シークレット保護：{what}。この機能は /toolkitty パネルでオフにできます。', pt: 'Toolkitty · Proteção de segredos: {what}. Você pode desativar este recurso no painel /toolkitty.', de: 'Toolkitty · Geheimnisschutz: {what}. Du kannst diese Funktion im /toolkitty-Panel ausschalten.', ko: 'Toolkitty · 비밀 파일 보호: {what}. /toolkitty 패널에서 이 기능을 끌 수 있습니다.' },
  protectedFile: { en: '{path} is a secrets file protected from writing', he: '{path} הוא קובץ סודות המוגן מכתיבה', es: '{path} es un archivo de secretos protegido contra escritura', fr: '{path} est un fichier de secrets protégé en écriture', ru: '{path} — файл с секретами, защищённый от записи', zh: '{path} 是受写保护的密钥文件', ja: '{path} は書き込み保護されたシークレットファイルです', pt: '{path} é um arquivo de segredos protegido contra gravação', de: '{path} ist eine schreibgeschützte Geheimnisdatei', ko: '{path}은(는) 쓰기가 보호된 비밀 파일입니다' },
  cmdWrites: { en: 'the command writes to {path}, a secrets file protected from writing', he: 'הפקודה כותבת אל {path}, קובץ סודות המוגן מכתיבה', es: 'el comando escribe en {path}, un archivo de secretos protegido contra escritura', fr: 'la commande écrit dans {path}, un fichier de secrets protégé en écriture', ru: 'команда записывает в {path} — файл с секретами, защищённый от записи', zh: '该命令会写入 {path}，这是受写保护的密钥文件', ja: 'このコマンドは書き込み保護されたシークレットファイル {path} に書き込みます', pt: 'o comando grava em {path}, um arquivo de segredos protegido contra gravação', de: 'der Befehl schreibt in {path}, eine schreibgeschützte Geheimnisdatei', ko: '이 명령은 쓰기가 보호된 비밀 파일 {path}에 씁니다' },
  checkFailed: { en: 'Toolkitty · Secret protection: the check failed, so the action was blocked. You can turn this feature off in the /toolkitty pane.', he: 'Toolkitty · הגנת סודות: הבדיקה נכשלה, לכן הפעולה נחסמה. אפשר לכבות את התכונה בחלונית /toolkitty.', es: 'Toolkitty · Protección de secretos: la comprobación falló, por lo que se bloqueó la acción. Puedes desactivar esta función en el panel /toolkitty.', fr: 'Toolkitty · Protection des secrets : la vérification a échoué, l\'action a donc été bloquée. Vous pouvez désactiver cette fonctionnalité dans le panneau /toolkitty.', ru: 'Toolkitty · Защита секретов: проверка не удалась, поэтому действие заблокировано. Эту функцию можно отключить в панели /toolkitty.', zh: 'Toolkitty · 密钥保护：检查失败，因此该操作已被拦截。你可以在 /toolkitty 面板中关闭此功能。', ja: 'Toolkitty · シークレット保護：チェックに失敗したため、操作をブロックしました。この機能は /toolkitty パネルでオフにできます。', pt: 'Toolkitty · Proteção de segredos: a verificação falhou, então a ação foi bloqueada. Você pode desativar este recurso no painel /toolkitty.', de: 'Toolkitty · Geheimnisschutz: Die Prüfung ist fehlgeschlagen, daher wurde die Aktion blockiert. Du kannst diese Funktion im /toolkitty-Panel ausschalten.', ko: 'Toolkitty · 비밀 파일 보호: 검사에 실패해 작업을 차단했습니다. /toolkitty 패널에서 이 기능을 끌 수 있습니다.' },
} as const

const NAME_PATTERNS: readonly RegExp[] = [
  /^\.env$/i,
  /^\.env\./i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa/i,
  /\.p12$/i,
  /\.pfx$/i,
  /^secrets\./i,
  /^credentials/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
]

/** Template files that hold no real secrets stay editable. */
const TEMPLATE_SUFFIX = /\.(example|sample|template|dist)$/i

const isSecretPath = (path: string): boolean => {
  const base = (path.replace(/^["']|["']$/g, '').split(/[\\/]/).pop() ?? '').trim()
  if (base === '' || TEMPLATE_SUFFIX.test(base)) return false
  return NAME_PATTERNS.some(p => p.test(base))
}

const unquote = (s: string): string => s.replace(/^["']+|["']+$/g, '')

/** The first secret-looking write target in a shell command, or undefined. */
const secretWriteTarget = (command: string): string | undefined => {
  for (const segment of command.split(/&&|\|\||[;\n|]/)) {
    // Redirections: > file, >> file, 1>file (not >&2).
    for (const m of segment.matchAll(/\d?>>?\s*([^\s&<>][^\s<>]*)/g)) {
      const target = unquote(m[1] ?? '')
      if (isSecretPath(target)) return target
    }

    const tokens = segment.trim().split(/\s+/).map(unquote)
    const first = tokens.findIndex(t => t === 'tee' || t === 'cp' || t === 'mv')
    if (first === -1) continue

    const args = tokens.slice(first + 1).filter(t => t !== '' && !t.startsWith('-'))
    if (tokens[first] === 'tee') {
      const hit = args.find(isSecretPath)
      if (hit !== undefined) return hit
    } else {
      const last = args[args.length - 1]
      if (last !== undefined && isSecretPath(last)) return last
    }
  }
  return undefined
}

const deny = (what: string): { deny: string } => ({
  deny: t(T.deny, { what }),
})

export const feature: Feature = {
  id: 'protect-secrets',
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

const baseOf = (path: string): string => path.replace(/^["']|["']$/g, '').split(/[\\/]/).pop() ?? ''

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  try {
    if (!(await isOn($, feature))) return undefined

    if (e.tool === 'Edit' || e.tool === 'Write') {
      if (!isSecretPath(e.file_path)) return undefined
      await reportIncident($, 'secret-file', baseOf(e.file_path))
      return deny(t(T.protectedFile, { path: e.file_path }))
    }
    if (e.tool === 'NotebookEdit') {
      if (!isSecretPath(e.notebook_path)) return undefined
      await reportIncident($, 'secret-file', baseOf(e.notebook_path))
      return deny(t(T.protectedFile, { path: e.notebook_path }))
    }
    if (e.tool === 'Bash') {
      const target = secretWriteTarget(e.command)
      if (target === undefined) return undefined
      await reportIncident($, 'secret-file', baseOf(target))
      return deny(t(T.cmdWrites, { path: target }))
    }

    return undefined
  } catch {
    return { deny: t(T.checkFailed) }
  }
}
