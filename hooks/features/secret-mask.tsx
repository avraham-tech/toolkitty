import { atom, update } from 'claude-code'
import type { Atom, EngineInterface, ToolCallResult } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, ToolCallInput, ToolCallOutput } from '../core'

const T = {
  title: {
    en: 'Secret masking',
    he: 'הסתרת סודות',
    es: 'Ocultar secretos',
    fr: 'Masquage des secrets',
    ru: 'Скрытие секретов',
    zh: '密钥遮蔽',
    ja: 'シークレットのマスク',
    pt: 'Mascaramento de segredos',
    de: 'Geheimnis-Maskierung',
    ko: '비밀 값 가리기',
  },
  description: {
    en: 'Hides keys and passwords in command output before the model sees it.',
    he: 'מסתיר מפתחות וסיסמאות בפלט פקודות לפני שהמודל רואה אותו.',
    es: 'Oculta claves y contraseñas en la salida de los comandos antes de que el modelo la vea.',
    fr: 'Masque les clés et mots de passe dans la sortie des commandes avant que le modèle ne la voie.',
    ru: 'Скрывает ключи и пароли в выводе команд, прежде чем его увидит модель.',
    zh: '在模型看到之前，隐藏命令输出中的密钥和密码。',
    ja: 'モデルが見る前に、コマンド出力中のキーやパスワードを隠します。',
    pt: 'Oculta chaves e senhas na saída de comandos antes que o modelo as veja.',
    de: 'Verbirgt Schlüssel und Passwörter in der Befehlsausgabe, bevor das Modell sie sieht.',
    ko: '모델이 보기 전에 명령 출력의 키와 비밀번호를 숨깁니다.',
  },
  mask: {
    en: '[redacted]',
    he: '[הוסתר]',
    es: '[oculto]',
    fr: '[masqué]',
    ru: '[скрыто]',
    zh: '[已隐去]',
    ja: '[伏せ字]',
    pt: '[ocultado]',
    de: '[geschwärzt]',
    ko: '[가림]',
  },
  toast: {
    en: '{n} secrets masked in command output',
    he: 'הוסתרו {n} סודות מפלט הפקודה',
    es: 'Se ocultaron {n} secretos en la salida del comando',
    fr: '{n} secrets masqués dans la sortie de la commande',
    ru: 'Скрыто секретов в выводе команды: {n}',
    zh: '已遮蔽命令输出中的 {n} 个密钥',
    ja: 'コマンド出力中のシークレット {n} 件をマスクしました',
    pt: '{n} segredos mascarados na saída do comando',
    de: '{n} Geheimnisse in der Befehlsausgabe maskiert',
    ko: '명령 출력에서 비밀 값 {n}개를 가렸습니다',
  },
} as const

type State = { masked: number }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'secret-mask' } as const, { masked: 0 }) as unknown as Atom<State>

/** Replaces every secret-looking string in `text`; returns the new text and the count. */
const mask = (text: string): { text: string; count: number } => {
  const MASK = t(T.mask)
  let count = 0
  const swap = (re: RegExp, to: string | ((...m: string[]) => string)) => {
    text = text.replace(re, (...m: string[]) => {
      const out = typeof to === 'string' ? to : to(...m)
      if (out !== m[0]) count += 1
      return out
    })
  }

  swap(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, MASK)
  swap(/\bsk-[A-Za-z0-9]{20,}/g, MASK)
  swap(/\bghp_[A-Za-z0-9]{30,}/g, MASK)
  swap(/\bAKIA[0-9A-Z]{16}\b/g, MASK)
  swap(/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, MASK)
  swap(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, MASK)
  // `name = value` where the name holds a secret word: password, DB_PASSWORD, GITHUB_TOKEN, AWS_SECRET_ACCESS_KEY, "password": "x".
  // The lookbehind starts a name at the beginning of a word run (and keeps a very long run linear).
  swap(/(?<![A-Za-z0-9_-])([A-Za-z0-9_-]*(?:password|passwd|secret|token|api[_-]?key)(?:[_-]?(?:access[_-]?)?key)?)(["']?\s*[=:]\s*)(\S+)/gi, (whole, key = '', sep = '', value = '') =>
    value === MASK ? whole : key + sep + MASK,
  )

  return { text, count }
}

export const feature: Feature = {
  id: 'secret-mask',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function afterBashCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (e.tool !== 'Bash') return result

  const ran = result as ToolCallResult<'Bash'>
  if (ran.deny !== undefined) return ran

  let total = 0
  const run = (s: string): string => {
    const m = mask(s)
    total += m.count
    return m.text
  }

  let out: typeof ran
  if (ran.isError === true) {
    // An errored call keeps no typed record; only the text the model reads can be masked.
    out = ran.text === undefined ? ran : { ...ran, text: run(ran.text) }
  } else {
    const result = ran.result
    out = { ...ran, result: { ...result, stdout: run(result.stdout), stderr: run(result.stderr) } }
    if (ran.text !== undefined) out = { ...out, text: run(ran.text) }
  }

  if (total > 0) {
    await update($, state, s => ({ masked: s.masked + total }))
    await notice($, 'warn', t(T.toast, { n: total }), feature.id)
  }

  return out
}
