import { expect, test } from 'claude-code/testing'
import { CWD, expandBand, mountBand, mountPane, noticesOf, rig, texts, lineOf, unfold } from './_kit'

const ON = { buddy: false }
const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const submit = ($: any, text: string, extra: Record<string, unknown> = {}) => $.prompt.submit({ text, ...extra })

// Fake credentials, built so that no scanner mistakes this file for a leak.
const AWS = 'AKIA' + 'IOSFODNN7' + 'EXAMPLE'
const GH = 'ghp_' + 'Ab1'.repeat(12)
const GH_OAUTH = 'gho_' + 'Zy9'.repeat(13)
const SK = 'sk-' + 'Zz9'.repeat(8)
const SK_ANT = 'sk-ant-api03-' + 'Qq7_'.repeat(10)
const SLACK = 'xoxb-' + '1234567890-abcdefghij'
const GOOGLE = 'AIza' + 'Ab_-9'.repeat(7)
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const PEM = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAxxxxxxxxxxxxxxxxxxxx\nyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\n-----END RSA PRIVATE KEY-----'
const GENERIC = 'abcd1234efgh5678ijkl'
const ALL_VALUES = [AWS, GH, GH_OAUTH, SK, SK_ANT, SLACK, GOOGLE, JWT, 'MIIEowIBAAKCAQEA', GENERIC]

test('every key shape in a prompt is redacted, the rewritten text is exact', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const cases: [string, string, string][] = [
    [`Deploy with ${AWS} please`, 'Deploy with [REDACTED aws] please', 'aws'],
    [`my token is ${GH}.`, 'my token is [REDACTED github].', 'github'],
    [`oauth ${GH_OAUTH} here`, 'oauth [REDACTED github] here', 'github oauth'],
    [`OPENAI_API_KEY=${SK}`, 'OPENAI_API_KEY=[REDACTED api-key]', 'openai'],
    [`ANTHROPIC=${SK_ANT}`, 'ANTHROPIC=[REDACTED api-key]', 'anthropic'],
    [`slack: ${SLACK}`, 'slack: [REDACTED slack]', 'slack'],
    [`maps key ${GOOGLE} ok`, 'maps key [REDACTED google] ok', 'google'],
    [`Authorization: Bearer ${JWT}`, 'Authorization: Bearer [REDACTED jwt]', 'jwt'],
    [`here:\n${PEM}\nwhat is wrong?`, 'here:\n[REDACTED private-key]\nwhat is wrong?', 'pem'],
    [`api_key = "${GENERIC}"`, 'api_key = "[REDACTED generic]"', 'generic key'],
    [`password: ${GENERIC}`, 'password: [REDACTED generic]', 'generic password'],
    [`export SECRET=${GENERIC}`, 'export SECRET=[REDACTED generic]', 'generic secret'],
  ]
  for (const [text, expected, name] of cases) {
    const before = r.entered.length
    const out = await submit($, text)
    expect(out.text, name).toBe(expected)
    expect(r.entered[before]?.text, name).toBe(expected)
  }
  // twelve identical notices inside five minutes are one row with a count; every notice says how many, never what
  expect(unfold((await noticesOf($, 'pasted-secret-scan')).filter(x => x.startsWith('🔑')))).toEqual(Array(12).fill('🔑 Redacted 1 secret(s) from your prompt before sending'))
})

test('several secrets in one prompt are all redacted and counted', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const out = await submit($, `a=${AWS} b=${GH} c=${SK} again ${AWS}`)
  expect(out.text).toBe('a=[REDACTED aws] b=[REDACTED github] c=[REDACTED api-key] again [REDACTED aws]')
  expect((await noticesOf($, 'pasted-secret-scan')).filter(x => x.startsWith('🔑'))).toEqual(['🔑 Redacted 4 secret(s) from your prompt before sending'])
  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'pasted-secret-scan'))).toBe('🔑 4 secrets redacted')
  await ui.unmount()
})

test('prompts without a secret pass untouched (14 inputs)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const fine = [
    'Please refactor the auth module.',
    'Rename the branch to risk-assessment-for-payment-flow-2024',
    'open task-management-refactoring-plan-v2 and summarise',
    'the disk-usage-monitoring-script-v3 is slow',
    'pip install scikit-learn, import sk-learn',
    'password = getPasswordFromEnvironment',
    'token: abc',
    'secret = "shh"',
    'api_key=',
    'AKIA is a prefix',
    'xoxb-short',
    'eyJ alone is not a token',
    'commit 3f786850e387550fdab836ed7e6dc881de23001b fixed it',
    'see https://example.com/docs?page=2&sort=name',
    '',
  ]
  for (const text of fine) {
    const out = await submit($, text)
    expect(out.text, text).toBe(text)
  }
  expect((await noticesOf($, 'pasted-secret-scan')).filter(x => x.startsWith('🔑'))).toEqual([])
  const ui = await mountBand($)
  await expandBand(ui)
  expect(await ui.find({ key: 'band-pasted-secret-scan' })).toBe(undefined)
  await ui.unmount()
})

test('a slash command line is not rewritten here (documented limit)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const line = `/review ${AWS}`
  const out = await submit($, line, { command: { name: 'review', args: AWS } })
  // The engine would not apply a rewrite for a command line; the feature leaves it alone and says nothing.
  expect(out.text).toBe(line)
  expect((await noticesOf($, 'pasted-secret-scan')).filter(x => x.startsWith('🔑'))).toEqual([])
})

test('switched off: the prompt goes through as typed, no band', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: { ...ON, 'pasted-secret-scan': false } })
  await start($)
  const out = await submit($, `key ${AWS}`)
  expect(out.text).toBe(`key ${AWS}`)
  expect((await noticesOf($, 'pasted-secret-scan')).filter(x => x.startsWith('🔑'))).toEqual([])
  const ui = await mountBand($)
  await expandBand(ui)
  expect(await ui.find({ key: 'band-pasted-secret-scan' })).toBe(undefined)
  await ui.unmount()
})

// ---------- git add / git commit --------------------------------------------------------------

type World = { staged?: string; unstaged?: string; untracked?: string[]; fail?: boolean; throws?: boolean }
const diffOf = (file: string, ...added: string[]) => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -0,0 +1,${added.length} @@\n${added.map(l => `+${l}`).join('\n')}\n`

function world(r: { proc: (argv: string[]) => any; files: Record<string, string> }, w: World) {
  r.proc = argv => {
    if (w.throws) return 'throw'
    if (w.fail) return { exitCode: 128, stdout: diffOf('x.ts', `const k = '${AWS}'`), stderr: 'fatal' }
    const joined = argv.join(' ')
    if (argv[1] === 'diff' && argv.includes('--cached')) return { exitCode: 0, stdout: w.staged ?? '', stderr: '' }
    if (argv[1] === 'diff') return { exitCode: 0, stdout: w.unstaged ?? '', stderr: '' }
    if (argv[1] === 'ls-files') return { exitCode: 0, stdout: (w.untracked ?? []).join('\n'), stderr: '' }
    return { exitCode: 0, stdout: '', stderr: joined }
  }
}

const gitDeny = (found: string) =>
  `Toolkitty · Pasted secret scan: the changes about to be added contain what looks like a secret: ${found}. Remove it (use an environment variable or an ignored config file) and try again, or turn the feature off in the /toolkitty pane if this is a false positive.`

test('git commit / add with a secret in the added lines is denied (12 inputs)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const bash = (command: string) => $.tool.call({ tool: 'Bash', command })
  const cases: [string, World, string][] = [
    ['git commit -m "add config"', { staged: diffOf('config.ts', `const k = '${AWS}'`) }, 'config.ts (AWS access key)'],
    ['git add .', { unstaged: diffOf('src/ci.yml', `token: ${GH}`) }, 'src/ci.yml (GitHub token)'],
    ['git add -A', { unstaged: diffOf('env.js', `key = "${SK}"`) }, 'env.js (OpenAI/Anthropic-style API key)'],
    ['git add --all', { unstaged: diffOf('slack.js', `const t = '${SLACK}'`) }, 'slack.js (Slack token)'],
    ['git add src/app.ts', { unstaged: diffOf('src/app.ts', `const g = '${GOOGLE}'`) }, 'src/app.ts (Google API key)'],
    ['git add secrets.txt', { untracked: ['secrets.txt'] }, 'secrets.txt (AWS access key)'],
    ['git commit -am "wip"', { unstaged: diffOf('a.ts', `auth = '${JWT}'`) }, 'a.ts (JWT)'],
    ['git commit --all -m wip', { unstaged: diffOf('a.ts', `-----BEGIN PRIVATE KEY-----`) }, 'a.ts (private key)'],
    ['npm test && git commit -m "ship"', { staged: diffOf('deploy.sh', `password = ${GENERIC}`) }, 'deploy.sh (generic credential)'],
    ['git -C sub commit -m x', { staged: diffOf('sub/k.ts', `x = '${AWS}'`) }, 'sub/k.ts (AWS access key)'],
    ['git add . ; git status', { unstaged: diffOf('k.ts', `x = '${AWS}'`, `y = '${GH}'`) }, 'k.ts (AWS access key); k.ts (GitHub token)'],
    ['git commit -m "two files"', { staged: diffOf('a.ts', `k='${AWS}'`) + diffOf('b.env', `SLACK=${SLACK}`) }, 'a.ts (AWS access key); b.env (Slack token)'],
  ]
  r.files['C:/proj/secrets.txt'] = `first line\nAWS_KEY=${AWS}\n`
  for (const [command, w, found] of cases) {
    world(r, w)
    const res = await bash(command)
    expect(res.deny, command).toBe(gitDeny(found))
    for (const v of ALL_VALUES) expect(String(res.deny), `${command} leaks ${v}`).not.toContain(v)
  }
})

test('git commands that carry no secret in the added lines pass (12 inputs)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const bash = (command: string) => $.tool.call({ tool: 'Bash', command })
  r.files['C:/proj/notes.txt'] = 'just notes\n'
  const cases: [string, World][] = [
    ['git commit -m "clean"', { staged: diffOf('a.ts', 'const a = 1') }],
    ['git add .', { unstaged: diffOf('a.ts', 'const a = 1') }],
    ['git add -n .', { unstaged: diffOf('a.ts', `const k = '${AWS}'`) }],
    ['git add --dry-run .', { unstaged: diffOf('a.ts', `const k = '${AWS}'`) }],
    // removing a secret is the fix, not the leak
    ['git commit -m "remove key"', { staged: `diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-const k = '${AWS}'\n+const k = process.env.K\n` }],
    // an identifier, not a value
    ['git commit -m "x"', { staged: diffOf('a.ts', 'password = getPasswordFromEnvironment') }],
    ['git status', { staged: diffOf('a.ts', `const k = '${AWS}'`) }],
    ['git log --oneline -5', { staged: diffOf('a.ts', `const k = '${AWS}'`) }],
    ['git add notes.txt', { untracked: ['notes.txt'] }],
    ['git add gone.txt', { untracked: ['gone.txt'] }],
    ['git commit -m "git failed"', { fail: true }],
    ['git commit -m "spawn failed"', { throws: true }],
  ]
  for (const [command, w] of cases) {
    world(r, w)
    const res = await bash(command)
    expect(res.deny, command).toBe(undefined)
  }
  // a different tool is none of its business
  world(r, { staged: diffOf('a.ts', `const k = '${AWS}'`) })
  expect((await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })).deny).toBe(undefined)
})

test('git scan switched off: a secret commit goes through', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: { ...ON, 'pasted-secret-scan': false } })
  await start($)
  world(r, { staged: diffOf('a.ts', `const k = '${AWS}'`) })
  expect((await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })).deny).toBe(undefined)
  expect(r.procs.filter(p => p[1] === 'diff' || p[1] === 'ls-files')).toEqual([])
})

test('the git scan runs in the session directory', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  world(r, { staged: '' })
  r.procs.length = 0
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  expect(r.procs.filter(p => p[1] === 'diff')).toEqual([['git', 'diff', '--cached', '-U0']])
})

// ---------- band and detail pane --------------------------------------------------------------

test('band line and detail pane list redactions and blocks by kind and place, never a value', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  await submit($, `key ${AWS} and ${GH}`)
  world(r, { staged: diffOf('config.ts', `const k = '${AWS}'`) })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  await r.clock.advance(125_000)
  await submit($, `slack ${SLACK}`)

  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'pasted-secret-scan'))).toBe('🔑 3 secrets redacted')
  await ui.press({ key: 'band-pasted-secret-scan' })
  expect(r.opened).toContain('toolkitty-detail')

  const detail = await mountPane($, 'toolkitty-detail')
  const all = await texts(detail)
  expect(all).toContain('Pasted secret scan')
  expect(all).toContain('Redacted or blocked secrets (newest first; values are never shown)')
  const rows = all.split('\n').filter(x => x.includes(' ago · '))
  expect(rows).toEqual([
    '0:00 ago · your prompt · Slack token ×1',
    '2:05 ago · git add/commit · AWS access key ×1 · config.ts',
    '2:05 ago · your prompt · AWS access key, GitHub token ×2',
  ])
  expect((await detail.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['detail-toggle', 'detail-close'])

  // values never appear: not in the prompt that entered, toasts, band, detail, processes
  const incidentsPane = await mountPane($, 'incidents')
  const everything = JSON.stringify([r.entered, r.seen(), all, await texts(incidentsPane), await ui.drawn()])
  for (const v of ALL_VALUES) expect(everything, `leaked ${v}`).not.toContain(v)

  await detail.press({ key: 'detail-toggle' })
  expect(await ui.find({ key: 'band-pasted-secret-scan' })).toBe(undefined)
  await ui.unmount()
  await detail.unmount()
  await incidentsPane.unmount()
})

test('a survey holding the band hides the line', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON })
  await start($)
  await submit($, `key ${AWS}`)
  const ui = await mountBand($, { hasSurvey: true })
  await expandBand(ui)
  expect(await ui.find({ key: 'band-pasted-secret-scan' })).toBe(undefined)
  await ui.unmount()
})

test('each redaction and block counts as an incident', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  await submit($, `key ${AWS}`)
  world(r, { staged: diffOf('config.ts', `const k = '${AWS}'`) })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'incidents'))).toBe('🛡 2 prevented')
  await ui.unmount()
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON, lang: 'he' })
  await start($)
  const out = await submit($, `key ${AWS}`)
  expect(out.text).toBe('key [REDACTED aws]')
  expect((await noticesOf($, 'pasted-secret-scan')).filter(x => x.startsWith('🔑'))).toEqual(['🔑 1 סודות הוסתרו מההודעה לפני השליחה'])
  world(r, { staged: diffOf('config.ts', `const k = '${AWS}'`) })
  const res = await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  expect(res.deny).toContain('סריקת סודות')
  expect(res.deny).toContain('config.ts (מפתח גישה של AWS)')
  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'pasted-secret-scan'))).toBe('🔑 1 סודות הוסתרו')
  await ui.press({ key: 'band-pasted-secret-scan' })
  const detail = await mountPane($, 'toolkitty-detail')
  const all = await texts(detail)
  expect(all).toContain('סריקת סודות מודבקים')
  expect(all).toContain('לפני 0:00 · git add/commit · מפתח גישה של AWS ×1 · config.ts')
  expect(all).toContain('לפני 0:00 · ההודעה שלך · מפתח גישה של AWS ×1')
  await ui.unmount()
  await detail.unmount()
})
