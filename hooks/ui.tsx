import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import { t } from './core'
import type { Localized } from './core'

/*
 * Toolkitty's small design system. Every pane and band line goes through
 * these so 72 features read as one product:
 *   - `Level` is the one semantic scale: ok (quiet), info (accent), warn
 *     (amber), alert (red). Color means something, so nothing else is colored.
 *   - `Chip` is a feature's short form for the band: a few characters, one
 *     level. The band shows chips in one row; the full lines are behind a toggle.
 *   - `paneHeader`, `emptyState`, `listRow`, `sectionTitle` are the shared
 *     parts of a pane: same places, same weights, same spacing everywhere.
 * Helpers take `$` and `e` (the engine hands the element table per surface);
 * they are function declarations, as the engine requires for anything `$` is
 * passed to.
 */

export type Level = 'ok' | 'info' | 'warn' | 'alert'

/** A feature's short band form. `text` is at most ~16 characters; the icon is the group's. */
export type Chip = { text: string; level?: Level; icon?: string }

/** One icon per group, used by chips and headers so a glance tells the kind of information. */
export const ICONS = {
  insight: '◔',
  alert: '▲',
  guard: '⛨',
  automation: '↻',
  workflow: '›',
  pane: '▤',
  quota: '◐',
  hygiene: '♻',
  visibility: '◉',
  visual: '✦',
  setup: '⚙',
} as const

export const LEVEL_COLOR: Record<Level, 'claude' | 'warning' | 'error' | undefined> = {
  ok: undefined,
  info: 'claude',
  warn: 'warning',
  alert: 'error',
}

const LEVEL_ORDER: Record<Level, number> = { alert: 0, warn: 1, info: 2, ok: 3 }

/** Chips sorted so what needs attention comes first. */
export function sortChips<T extends { chip: Chip }>(items: T[]): T[] {
  return [...items].sort((a, b) => LEVEL_ORDER[a.chip.level ?? 'ok'] - LEVEL_ORDER[b.chip.level ?? 'ok'])
}

const U = {
  nothingYet: { en: 'Nothing here yet.', he: 'עדיין אין כאן כלום.', es: 'Aún no hay nada aquí.', fr: 'Rien ici pour le moment.', ru: 'Здесь пока пусто.', zh: '这里还没有内容。', ja: 'ここにはまだ何もありません。', pt: 'Nada aqui ainda.', de: 'Hier ist noch nichts.', ko: '아직 아무것도 없습니다.' },
} as const

type PaneLike = RenderInput<'Pane'>

export type HeaderAction = { key: string; label: string; onPress: () => unknown; hotkey?: string; primary?: boolean }

/**
 * The top of every pane: title (bold), an optional status word colored by
 * level, and the pane's actions as plain buttons on the right, each with a
 * digit hotkey in order.
 */
export function paneHeader(
  $: EngineInterface,
  e: PaneLike,
  opts: { title: string; status?: string; level?: Level; actions?: HeaderAction[]; icon?: string },
): RenderElement {
  const { Box, Text, Button } = $.ui.resolve(e)
  const actions = opts.actions ?? []
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        {opts.icon !== undefined ? <Text dimColor>{opts.icon}</Text> : null}
        <Text bold>{opts.title}</Text>
        {opts.status !== undefined ? (
          <Text color={LEVEL_COLOR[opts.level ?? 'ok']} dimColor={(opts.level ?? 'ok') === 'ok'}>
            {opts.status}
          </Text>
        ) : null}
      </Box>
      {actions.length > 0 ? (
        <Box gap={2}>
          {actions.map((a, i) => (
            <Button
              key={a.key}
              plain={a.primary ? undefined : true}
              variant={a.primary ? 'primary' : undefined}
              label={a.label}
              hotkey={a.hotkey ?? (i < 9 ? String(i + 1) : undefined)}
              onPress={a.onPress}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

/** A quiet section title inside a pane. */
export function sectionTitle($: EngineInterface, e: PaneLike, text: string): RenderElement {
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box marginTop={1}>
      <Text bold color="claude">
        {text}
      </Text>
    </Box>
  )
}

/**
 * What a pane shows when it has nothing: the fact in one line and, below it,
 * what will fill it (the first time something happens here, the command to
 * run). Never a bare "nothing".
 */
export function emptyState($: EngineInterface, e: PaneLike, text?: string | Localized, hint?: string | Localized): RenderElement {
  const { Box, Text } = $.ui.resolve(e)
  const main = text === undefined ? t(U.nothingYet) : typeof text === 'string' ? text : t(text)
  const sub = hint === undefined ? null : typeof hint === 'string' ? hint : t(hint)
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text dimColor>{main}</Text>
      {sub !== null ? (
        <Text dimColor size="footnote">
          {sub}
        </Text>
      ) : null}
    </Box>
  )
}

/**
 * One row of a list: a dim left column (time, index), the main text, and an
 * optional right-aligned value; pressable when `onPress` is given (then the
 * whole row is one Button, as the surface wants).
 */
export function listRow(
  $: EngineInterface,
  e: PaneLike,
  row: { key: string; left?: string; text: string; right?: string; level?: Level; onPress?: () => unknown },
): RenderElement {
  const { Box, Text, Button } = $.ui.resolve(e)
  const color = LEVEL_COLOR[row.level ?? 'ok']
  const content = (
    <Box gap={1}>
      {row.left !== undefined ? (
        <Text dimColor size="footnote">
          {row.left}
        </Text>
      ) : null}
      <Text color={color}>{row.text}</Text>
      {row.right !== undefined ? <Text dimColor>{row.right}</Text> : null}
    </Box>
  )
  if (row.onPress === undefined) return content
  return (
    <Button key={row.key} plain onPress={row.onPress}>
      {row.left !== undefined ? `${row.left} ` : ''}
      {row.text}
      {row.right !== undefined ? <Text dimColor> {row.right}</Text> : ''}
    </Button>
  )
}

/** m:ss or h:mm:ss, shared by every chip that shows a duration. */
export function short(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hrs = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hrs > 0 ? `${hrs}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 1234 → "1.2k", 1234567 → "1.2M". */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}
