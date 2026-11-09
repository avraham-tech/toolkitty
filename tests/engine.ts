/**
 * Which backdrop API the engine under test has. The plugin speaks both (`hooks/backdrop.ts`), but a
 * test may only register mocks for events its engine knows, and nothing in the test sandbox tells
 * the builds apart, so this is a constant:
 *
 *   'theme'  Claude Code 2.1.319 and later: `theme.set` / `theme.clear`
 *   'ui'     Claude Code up to 2.1.317:     `ui.backdrop`
 *
 * Set it to 'ui' to run the suite with a 2.1.317 CLI (see tests/README.md); commit it as 'theme'.
 */
export const BACKDROP_API: 'theme' | 'ui' = 'theme'

/**
 * Registers the backdrop mock for the engine under test. `set` gets the backdrop a `set` call carries
 * and returns the surface's verdict; `clear` is told the backdrop was cleared.
 */
export function mockBackdrop(on: any, set: (backdrop: unknown) => unknown, clear: () => void): void {
  if (BACKDROP_API === 'theme') {
    on('theme.set', (_: any, e: any) => ({ value: set(e.backdrop) }))
    on('theme.clear', () => {
      clear()
      return { value: { isDrawn: false, reason: 'the theme is cleared' } }
    })
    return
  }
  on('ui.backdrop', (_: any, e: any) => {
    if (e.backdrop === undefined) {
      clear()
      return { value: undefined }
    }
    return { value: set(e.backdrop) }
  })
}
