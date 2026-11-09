// The contract is self-contained (the validator refuses imports): `StateFamily` resolves inside the
// `declare module 'claude-code'` block below, where it is already in scope.
/** Plain JSON data, what `$.state` and `$.store` hold. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

declare module 'claude-code' {
  interface PluginState {
    toolkitty: {
      /** Which features are on, by feature id; a missing id means its default. */
      enabled: Record<string, boolean>
      /** One free slot per feature id: whatever state that feature keeps. */
      slot: StateFamily<Json>
    }
  }
}
