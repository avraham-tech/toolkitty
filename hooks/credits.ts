/*
 * Credits and support links of Toolkitty: the ONE place the author fills in
 * before publishing. Plain constants, no engine access.
 *
 * Every URL that still contains the literal OWNER is a placeholder: the about
 * pane hides the support button and the weekly report shows no support line
 * until a real link is here. SUPPORT_URL and SPONSORS_URL are optional.
 */

export const AUTHOR_NAME = 'Avraham Shemesh'
export const AUTHOR_URL = 'https://github.com/avraham-tech'
export const REPO_URL = 'https://github.com/avraham-tech/toolkitty'
export const SUPPORT_URL = 'https://ko-fi.com/toolkitty'
export const SPONSORS_URL = 'https://github.com/sponsors/avraham-tech'
export const LICENSE = 'MIT'

/** Whether a URL is still the template one (it contains the literal OWNER). */
export function isPlaceholder(url: string): boolean {
  return url.includes('OWNER')
}

/** The link a person can use to support the author: SUPPORT_URL, else SPONSORS_URL; null while both are placeholders. */
export function supportLink(): string | null {
  if (!isPlaceholder(SUPPORT_URL)) return SUPPORT_URL
  if (!isPlaceholder(SPONSORS_URL)) return SPONSORS_URL
  return null
}
