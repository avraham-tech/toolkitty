import { isOn, t } from '../core'
import type { On } from 'claude-code'
import type { Feature } from '../core'

const T = {
  title: { en: 'Focus mode', he: 'מצב ריכוז', es: 'Modo de concentración', fr: 'Mode concentration', ru: 'Режим фокуса', zh: '专注模式', ja: 'フォーカスモード', pt: 'Modo foco', de: 'Fokusmodus', ko: '집중 모드' },
  description: {
    en: 'Shortens long tool results (over 30 lines) to 10 lines; ctrl+o shows everything.',
    he: 'מקצר תוצאות כלים ארוכות (מעל 30 שורות) ל-10 שורות; ctrl+o מציג הכל.',
    es: 'Acorta los resultados largos de herramientas (más de 30 líneas) a 10 líneas; ctrl+o muestra todo.',
    fr: 'Réduit les longs résultats d\'outils (plus de 30 lignes) à 10 lignes ; ctrl+o affiche tout.',
    ru: 'Сокращает длинные результаты инструментов (более 30 строк) до 10 строк; ctrl+o показывает всё.',
    zh: '将较长的工具结果（超过 30 行）缩短为 10 行；ctrl+o 显示全部。',
    ja: '長いツール結果（30 行超）を 10 行に短縮します。ctrl+o ですべて表示します。',
    pt: 'Encurta resultados longos de ferramentas (mais de 30 linhas) para 10 linhas; ctrl+o mostra tudo.',
    de: 'Kürzt lange Tool-Ergebnisse (über 30 Zeilen) auf 10 Zeilen; ctrl+o zeigt alles.',
    ko: '긴 도구 결과(30줄 초과)를 10줄로 줄입니다. ctrl+o로 전체를 볼 수 있습니다.',
  },
  moreLines: {
    en: '... {n} more lines',
    he: '... {n} שורות נוספות',
    es: '... {n} líneas más',
    fr: '... {n} lignes de plus',
    ru: '... ещё {n} строк',
    zh: '... 另外 {n} 行',
    ja: '... ほか {n} 行',
    pt: '... mais {n} linhas',
    de: '... {n} weitere Zeilen',
    ko: '... {n}줄 더',
  },
} as const

const MAX_LINES = 30
const KEEP_LINES = 10

/**
 * The props of a ToolResult carry `output` as `unknown` (a rewrite must fit the
 * tool's own output schema), so the text cannot be cut in the props. This reads
 * the common text fields only to count lines; the cut itself is a height cap.
 */
const textOf = (output: unknown): string => {
  if (typeof output === 'string') return output
  if (output === null || typeof output !== 'object') return ''
  const record = output as Record<string, unknown>
  for (const key of ['stdout', 'content', 'output', 'text']) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  const file = record['file']
  if (file !== null && typeof file === 'object') {
    const content = (file as Record<string, unknown>)['content']
    if (typeof content === 'string') return content
  }
  return ''
}

export const feature: Feature = {
  id: 'focus-mode',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

export function register(on: On) {
    on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
      if (!(await isOn($, feature))) return next(e)
      if (e.props.isExpanded === true || e.props.isErrored) return next(e)

      const text = textOf(e.props.output)
      if (text === '') return next(e)
      const total = text.split('\n').length
      if (total <= MAX_LINES) return next(e)

      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Box flexDirection="column" height={KEEP_LINES} overflow="hidden">
            {await next(e)}
          </Box>
          <Text dimColor size="footnote">
            {t(T.moreLines, { n: total - KEEP_LINES })}
          </Text>
        </Box>
      )
    })
}
