import type { EngineInterface } from 'claude-code'

/**
 * The session backdrop on either engine API.
 *
 * Claude Code 2.1.319 moved the backdrop from `$.ui.backdrop(args | undefined)`
 * to `$.theme.set({ backdrop })` and `$.theme.clear()`; no build has both. The
 * desktop app (the only surface that draws a backdrop) ships its own engine, so
 * a person cannot pick the build: the plugin has to speak both.
 *
 * A noun of `$` cannot be read as a value, so the API is found by calling it: a
 * missing one throws a TypeError before anything reaches the surface. Whichever
 * answered first is remembered for the session.
 */
export type BackdropArgs = { id: string; glass?: { blur?: number; tint?: string; opacity?: number } | false }
export type BackdropResult = { isDrawn: true; requestId: string } | { isDrawn: false; reason: string }

type ThemeApi = { theme: { set: (theme: { backdrop: BackdropArgs }) => Promise<BackdropResult>; clear: () => Promise<unknown> } }
type UiApi = { ui: { backdrop: (backdrop: BackdropArgs | undefined) => Promise<BackdropResult | undefined> } }

let api: 'theme' | 'ui' | undefined

/** Sets the session's backdrop and returns the surface's verdict. Throws what the engine throws. */
export async function setBackdrop($: EngineInterface, backdrop: BackdropArgs): Promise<BackdropResult> {
  if (api !== 'ui') {
    try {
      const result = await ($ as unknown as ThemeApi).theme.set({ backdrop })
      api = 'theme'
      return result
    } catch (err) {
      // A TypeError before the API ever answered means this build has no $.theme; anything else is the surface's.
      if (api === 'theme' || !(err instanceof TypeError)) throw err
    }
  }
  const result = await ($ as unknown as UiApi).ui.backdrop(backdrop)
  api = 'ui'
  return result ?? { isDrawn: false, reason: 'no answer' }
}

/** Clears the session's backdrop. Throws what the engine throws. */
export async function clearBackdrop($: EngineInterface): Promise<void> {
  if (api !== 'ui') {
    try {
      await ($ as unknown as ThemeApi).theme.clear()
      api = 'theme'
      return
    } catch (err) {
      if (api === 'theme' || !(err instanceof TypeError)) throw err
    }
  }
  await ($ as unknown as UiApi).ui.backdrop(undefined)
  api = 'ui'
}
