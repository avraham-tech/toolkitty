import { atom, update } from 'claude-code'
import { isOn, t } from '../core'
import type { Feature, ToolCallInput, ToolCallOutput } from '../core'
import type { Atom, EngineInterface, ToolCallResult } from 'claude-code'
import type { Savings } from '../shared'

const T = {
  title: { en: 'Output trimming', he: 'קיצור פלט', es: 'Recorte de salida', fr: 'Réduction de la sortie', ru: 'Сокращение вывода', zh: '输出精简', ja: '出力のトリミング', pt: 'Corte de saída', de: 'Ausgabe kürzen', ko: '출력 줄이기' },
  description: { en: 'Shortens long Bash output (over 200 lines) and keeps the beginning and the end.', he: 'מקצר פלט ארוך של Bash (מעל 200 שורות) ומשאיר את ההתחלה והסוף.', es: 'Acorta la salida larga de Bash (más de 200 líneas) y conserva el principio y el final.', fr: 'Raccourcit les longues sorties de Bash (plus de 200 lignes) et garde le début et la fin.', ru: 'Сокращает длинный вывод Bash (более 200 строк), оставляя начало и конец.', zh: '缩短过长的 Bash 输出（超过 200 行），保留开头和结尾。', ja: '長い Bash 出力（200 行超）を短縮し、先頭と末尾を残します。', pt: 'Encurta saídas longas do Bash (mais de 200 linhas) e mantém o início e o fim.', de: 'Kürzt lange Bash-Ausgaben (über 200 Zeilen) und behält Anfang und Ende.', ko: '긴 Bash 출력(200줄 초과)을 줄이고 처음과 끝을 남깁니다.' },
  cut: { en: '... [Toolkitty trimmed {n} lines from the middle] ...', he: '... [Toolkitty קיצר {n} שורות מהאמצע] ...', es: '... [Toolkitty recortó {n} líneas del medio] ...', fr: '... [Toolkitty a supprimé {n} lignes au milieu] ...', ru: '... [Toolkitty сократил {n} строк из середины] ...', zh: '……[Toolkitty 已从中间裁剪 {n} 行]……', ja: '… [Toolkitty が中間の {n} 行をトリミングしました] …', pt: '... [o Toolkitty cortou {n} linhas do meio] ...', de: '... [Toolkitty hat {n} Zeilen aus der Mitte gekürzt] ...', ko: '... [Toolkitty가 중간 {n}줄을 잘라냈습니다] ...' },
} as const

const savings = atom({ plugin: 'toolkitty', key: 'slot', id: 'savings' } as const, { tokens: 0, usd: 0, byFeature: {}, leaks: {} } as Savings) as unknown as Atom<Savings>

const MAX_LINES = 200
const HEAD = 60
const TAIL = 100

const trim = (text: string): string | undefined => {
  const lines = text.split('\n')
  if (lines.length <= MAX_LINES) return undefined
  const cut = lines.length - HEAD - TAIL
  return [...lines.slice(0, HEAD), t(T.cut, { n: cut }), ...lines.slice(-TAIL)].join('\n')
}

export const feature: Feature = {
  id: 'output-trimmer',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function afterBashCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (e.tool !== 'Bash') return result

  const ran = result as ToolCallResult<'Bash'>
  if (ran.deny !== undefined || ran.isError) return ran

  // stdout and stderr are each cut on their own: a short stdout can come with a huge stderr.
  const stdout = ran.result.stdout
  const stderr = ran.result.stderr
  const trimmedOut = trim(stdout)
  const trimmedErr = typeof stderr === 'string' ? trim(stderr) : undefined
  const trimmedText = ran.text !== undefined ? trim(ran.text) : undefined
  if (trimmedOut === undefined && trimmedErr === undefined && trimmedText === undefined) return ran

  const lost = (before: string, after: string | undefined): number => (after === undefined ? 0 : Math.max(0, before.length - after.length))
  const saved = Math.ceil((lost(stdout, trimmedOut) + lost(stderr ?? '', trimmedErr)) / 4)
  if (saved > 0) {
    await update($, savings, s => ({
      ...s,
      tokens: s.tokens + saved,
      usd: s.usd + saved * 0.000003,
      byFeature: { ...s.byFeature, 'output-trimmer': (s.byFeature['output-trimmer'] ?? 0) + saved },
    }))
  }

  return {
    ...ran,
    result: { ...ran.result, stdout: trimmedOut ?? stdout, ...(trimmedErr !== undefined ? { stderr: trimmedErr } : {}) },
    ...(trimmedText !== undefined ? { text: trimmedText } : {}),
  }
}
