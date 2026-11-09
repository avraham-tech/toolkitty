import { test } from 'claude-code/testing'
import { BAND, DAY, NOON, PANE, dayKey, start, turnDone, turnStart, world } from './harness'

type Drawing = { name: string; surface: string; tree?: unknown; error?: string }

// Every pane the plugin registers (grep `requestId: '` in hooks/), with the command that fills it.
const PANES: { id: string; cmd?: string; args?: string }[] = [
  { id: 'toolkitty' },
  { id: 'agent-profiler', cmd: 'profile' },
  { id: 'agents-monitor', cmd: 'agents' },
  { id: 'bash-log', cmd: 'bash-log' },
  { id: 'buddy', cmd: 'buddy' },
  { id: 'budget-guard', cmd: 'budget' },
  { id: 'aquarium', cmd: 'aquarium' },
  { id: 'correction-rules', cmd: 'rules' },
  { id: 'decision-ledger', cmd: 'decisions' },
  { id: 'diff-review', cmd: 'review' },
  { id: 'files-touched', cmd: 'files-touched' },
  { id: 'incident-card' },
  { id: 'incidents', cmd: 'incidents' },
  { id: 'monday-report', cmd: 'report' },
  { id: 'notes', cmd: 'notes' },
  { id: 'onboarding', cmd: 'welcome' },
  { id: 'savings', cmd: 'savings' },
  { id: 'session-finder', cmd: 'sessions' },
  { id: 'task-board', cmd: 'tasks' },
  { id: 'themes', cmd: 'theme' },
  { id: 'turn-history', cmd: 'turn-history' },
  { id: 'receipt' },
  { id: 'heatmap', cmd: 'heatmap' },
  { id: 'wrapped', cmd: 'wrapped' },
  { id: 'toolkitty-notices', cmd: 'notices' },
  { id: 'toolkitty-home', cmd: 'home' },
  { id: 'advisor', cmd: 'advisor' },
  { id: 'profiles', cmd: 'profiles', args: 'pane' },
  { id: 'goal-tracker', cmd: 'goals' },
  { id: 'context-doctor', cmd: 'context-doctor' },
  { id: 'error-detective', cmd: 'errors' },
  { id: 'handoff', cmd: 'handoff' },
  { id: 'selftest' },
  { id: 'doctor' },
  { id: 'about', cmd: 'about' },
  { id: 'mission-control', cmd: 'mission' },
  { id: 'time-machine', cmd: 'timeline' },
  { id: 'session-replay', cmd: 'replay' },
  { id: 'prompt-enhancer', cmd: 'enhance', args: 'pane' },
]

const plain = (x: unknown): unknown => JSON.parse(JSON.stringify(x, (_k, v) => (typeof v === 'function' ? undefined : v)))
const msg = (e: unknown): string => String((e as Error)?.message ?? e)

async function run($: any, on: any, surface: 'desktop' | 'terminal') {
  const days: Record<string, unknown> = {}
  for (let i = 0; i < 70; i++) {
    const n = (i * 7) % 11
    if (n > 2) days[dayKey(NOON - i * DAY)] = { turns: n * 3, ms: n * 240_000, tokens: n * 41_000, cost: n * 0.37 }
  }
  const sav: Record<string, unknown> = {}
  for (let i = 0; i < 14; i++) sav[dayKey(NOON - i * DAY)] = { tokens: 3000 + i * 900, usd: 0.4 + i * 0.11 }
  const w = world(on, {
    surfaces: [surface],
    store: {
      language: 'en',
      'buddy:seed': 4242,
      'buddy:name': 'Pixel',
      'week-heatmap:days': days,
      'week-heatmap:tools': { Bash: 120, Edit: 80, Read: 200, Grep: 60, Write: 25 },
      'week-heatmap:longest': 1_800_000,
      'savings:days': sav,
      'savings:mark': { started: NOON - 3600_000, tokens: 5000, usd: 0.5 },
      'incidents:C:/proj': {
        count: 3,
        lastAt: NOON - 600_000,
        items: [
          { at: NOON - 5_000_000, feature: 'protect-secrets', kind: 'env file', detail: '.env.local' },
          { at: NOON - 3_000_000, feature: 'secret-mask', kind: 'aws key', detail: 'prompt' },
          { at: NOON - 600_000, feature: 'dangerous-commands', kind: 'rm -rf', detail: 'rm -rf /' },
        ],
      },
      'session-finder:index': [
        { id: 'sess-aaaa1111', cwd: 'C:/proj', title: 'Fix the parser bug', startedAt: NOON - 2 * DAY, updatedAt: NOON - 2 * DAY + 3_600_000, prompts: ['fix the parser', 'add tests'] },
        { id: 'sess-bbbb2222', cwd: 'C:/other', title: 'Write the migration', startedAt: NOON - 5 * DAY, updatedAt: NOON - 5 * DAY + 1_800_000, prompts: ['write a migration'] },
        { id: 'sess-cccc3333', cwd: 'C:/proj', title: 'Refactor Toolkitty band', startedAt: NOON - 9 * DAY, updatedAt: NOON - 9 * DAY + 900_000, prompts: ['refactor band'] },
      ],
      'notes:C:/proj': [
        { id: 1, text: 'Remember to bump the version' },
        { id: 2, text: 'Ask about the staging database' },
        { id: 3, text: 'Parser: handle empty input' },
      ],
    },
  })
  w.limits = [
    { kind: 'five_hour', percentUsed: 91, resetsAt: new Date(2026, 10, 8, 15).toISOString() },
    { kind: 'seven_day', percentUsed: 42, resetsAt: new Date(2026, 10, 12).toISOString() },
  ]
  w.usage = { percent: 63, usd: 3.2 }

  const out: Drawing[] = []
  const grab = async (name: string, spec: any) => {
    try {
      const ui = await $.ui.mount(spec)
      out.push({ name, surface, tree: plain(await ui.drawn()) })
      return ui
    } catch (e) {
      out.push({ name, surface, error: msg(e) })
      return undefined
    }
  }

  await start($, surface)
  await $.session.measure({ context: { window: 200000, percent: 63 }, rateLimits: w.limits, changed: ['rateLimits'] })
  // a few turns and tool calls
  for (let i = 0; i < 3; i++) {
    await turnStart($, { text: `task number ${i + 1}` })
    w.toolResult = { result: {} }
    await $.tool.call({
      tool: 'TodoWrite',
      todos: [
        { content: 'Read the parser', status: 'completed' },
        { content: 'Fix the empty-input crash', status: 'in_progress' },
        { content: 'Add regression tests', status: 'pending' },
      ],
    })
    await $.tool.call({ tool: 'Read', file_path: 'C:/proj/src/parser.ts' })
    await $.tool.call({ tool: 'Edit', file_path: 'C:/proj/src/parser.ts', old_string: 'a', new_string: 'b' })
    w.toolResult = { isError: true, result: 'boom' }
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    w.toolResult = { result: {} }
    await turnDone($, 4000 + i * 2500)
  }
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /' }) // denied

  // the band, compact and open
  const band = await grab('band (compact)', { ...BAND(surface), requestId: 'band' })
  if (band !== undefined) {
    try {
      await band.press({ key: 'toolkitty-band-toggle' })
      out.push({ name: 'band (expanded)', surface, tree: plain(await band.drawn()) })
    } catch (e) {
      out.push({ name: 'band (expanded)', surface, error: msg(e) })
    }
    for (const slug of ['task-pulse', 'incidents', 'plan-pace']) {
      try {
        await band.press({ key: `band-${slug}` })
        const d = await $.ui.mount({ ...PANE('toolkitty-detail'), surface })
        out.push({ name: `detail: ${slug}`, surface, tree: plain(await d.drawn()) })
        await d.unmount()
      } catch (e) {
        out.push({ name: `detail: ${slug}`, surface, error: msg(e) })
      }
    }
    await band.unmount()
  }

  // every pane
  for (const p of PANES) {
    if (p.cmd !== undefined) {
      try {
        await $.command.run({ command: p.cmd, args: p.args ?? '' })
      } catch (e) {
        out.push({ name: `pane: ${p.id}`, surface, error: 'command /' + p.cmd + ' failed: ' + msg(e) })
        continue
      }
    }
    const ui = await grab(`pane: ${p.id}`, { ...PANE(p.id), surface })
    if (ui !== undefined) await ui.unmount()
  }

  console.log('<<<PREVIEW' + JSON.stringify(out) + 'PREVIEW>>>')
}

test('preview desktop', { timeoutMs: 120_000 }, async ($, on) => {
  await run($, on, 'desktop')
})

test('preview terminal', { timeoutMs: 120_000 }, async ($, on) => {
  await run($, on, 'terminal')
})
