import { expect, test } from 'claude-code/testing'
import { noticeTexts, refusal, start, world } from './harness'

/*
 * The engine refuses $.command.register for a name a built-in or another plugin owns. A refusal (a { deny } answer
 * or a throw) must never abort the rest of a feature's onSessionStart nor Toolkitty's session.start: the person
 * gets one warn notice naming the command, everything else keeps registering.
 */

// every command registered by the features whose file names start with a..m
const MINE = [
  'about', 'smart', 'profile', 'subagents', 'aurora', 'auto-continue', 'bash-log', 'blast', 'buddy', 'budget',
  'cache-ttl', 'claims', 'commitmsg', 'aquarium', 'context-doctor', 'ctx', 'copy-last', 'rules', 'decisions',
  'diff-review', 'envcheck', 'waste', 'edit-undo', 'errors', 'explain', 'files-touched', 'goals', 'handoff',
  'idle-handoff', 'incidents', 'tripwire', 'repeats', 'merge-gate', 'mission', 'report',
]
// the names that used to collide with a built-in; none of them may be registered any more
const OLD = ['advisor', 'agents', 'context', 'copy', 'review', 'doctor', 'undo', 'goal']

test('the old colliding names are gone and the new ones are registered', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  for (const name of MINE) expect(w.cmds).toContain(name)
  for (const name of OLD) expect(w.cmds).not.toContain(name)
})

for (const how of ['throw', 'deny'] as const) {
  test(`every command refused (${how}): one warn per command, the rest of session start still runs`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = world(on)
    refusal.how = how
    for (const name of MINE) refusal.names.add(name)
    await start($)
    for (const name of MINE) expect(w.cmds).not.toContain(name)
    // Toolkitty's own commands and the other half of the features (registered after these) still came through
    expect(w.cmds).toEqual(expect.arrayContaining(['toolkitty', 'notices', 'home']))
    expect(w.cmds.length).toBeGreaterThan(5)
    const all = (await noticeTexts($)).join('\n')
    for (const name of MINE) expect(all).toContain(`The command /${name} could not be registered: `)
  })
}

test('one refused command does not stop the next feature in the same handler (idle-handoff after handoff)', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  refusal.names.add('handoff')
  await start($)
  expect(w.cmds).not.toContain('handoff')
  expect(w.cmds).toContain('idle-handoff')
  const all = (await noticeTexts($)).join('\n')
  expect(all).toContain('The command /handoff could not be registered: ')
  expect(all).not.toContain('The command /idle-handoff could not be registered')
})

test('the warn notice is localized (Hebrew)', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  refusal.names.add('envcheck')
  await start($)
  expect(w.cmds).not.toContain('envcheck')
  expect((await noticeTexts($)).join('\n')).toContain('לא ניתן היה לרשום את הפקודה /envcheck: ')
})
