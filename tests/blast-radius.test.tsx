import { expect, test } from 'claude-code/testing'
import { CWD, expandBand, lineOf, mountBand, rig } from './_kit'

const ON = { buddy: false, 'dangerous-commands': false }
const OFF_TEXT = 'This feature is off; turn it on in the /toolkitty panel'
const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const bash = ($: any, command: string) => $.tool.call({ tool: 'Bash', command })
const blast = ($: any, args: string) => $.command.run({ command: 'blast', args })
const USAGE = 'Usage: /blast, /blast allow, /blast threshold <n>'
const SUFFIX = 'To run it anyway, the user can type /blast allow and retry.'

const names = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`)
const entries = (list: string[]) => list.map(name => ({ name, kind: 'file' as const }))

/** A directory of flat files under the project. */
function dirOf(r: { dirs: Record<string, any[]> }, path: string, n: number, prefix = 'f') {
  r.dirs[path] = entries(names(prefix, n))
}

const denyOf = (what: string, total: string | number, threshold: number, list: string[], more = '') =>
  `Toolkitty · Blast radius: this command (${what}) would affect ${total} items (threshold ${threshold}). First ${list.length}:\n${list.join('\n')}\n${more}${SUFFIX}`

/** git answers by subcommand. */
function git(r: { proc: (argv: string[]) => any }, o: { clean?: string[]; status?: string; stash?: string[]; stashShow?: string[]; fail?: boolean; throws?: boolean }) {
  r.proc = argv => {
    if (o.throws) return 'throw'
    if (o.fail) return { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' }
    if (argv[0] !== 'git') return { exitCode: 0, stdout: '', stderr: '' }
    if (argv[1] === 'clean') return { exitCode: 0, stdout: (o.clean ?? []).map(p => `Would remove ${p}`).join('\n'), stderr: '' }
    if (argv[1] === 'status') return { exitCode: 0, stdout: o.status ?? '', stderr: '' }
    if (argv[1] === 'stash' && argv[2] === 'list') return { exitCode: 0, stdout: (o.stash ?? []).join('\n'), stderr: '' }
    if (argv[1] === 'stash' && argv[2] === 'show') return { exitCode: 0, stdout: (o.stashShow ?? []).join('\n'), stderr: '' }
    return { exitCode: 0, stdout: '', stderr: '' }
  }
}
const porcelain = (n: number) => names('m', n).map(x => ` M src/${x}.ts`).join('\n') + '\n?? scratch.txt\n'

test('registers /blast; the log starts empty with the default threshold', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  expect(r.regs).toContain('blast')
  expect((await blast($, '')).text).toBe('Blast radius: threshold 5 items. Log (newest first):\nNo destructive commands checked yet.')
})

test('rm -r over the threshold is denied with the list and the exact text', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  dirOf(r, 'C:/proj/build', 8)
  const res = await bash($, 'rm -rf build')
  expect(res.deny).toBe(denyOf('rm -r', 8, 5, names('f', 8).map(x => `C:/proj/build/${x}`)))
  // nested directories are walked
  r.dirs['C:/proj/cache'] = [{ name: 'sub', kind: 'dir' }, { name: 'top.txt', kind: 'file' }]
  r.dirs['C:/proj/cache/sub'] = entries(names('deep', 6))
  const nested = await bash($, 'rm -rf cache')
  expect(nested.deny).toContain('would affect 7 items')
  expect(nested.deny).toContain('C:/proj/cache/top.txt')
  expect(nested.deny).toContain('C:/proj/cache/sub/deep5')
})

test('every destructive form is measured (12 inputs)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  dirOf(r, 'C:/proj/build', 6)
  dirOf(r, 'C:/proj/dist', 4, 'd')
  dirOf(r, 'C:/proj/tmp', 4, 't')
  const lst = (dir: string, prefix: string, n: number) => names(prefix, n).map(x => `${dir}/${x}`)

  // rm -r in its spellings
  for (const command of ['rm -rf build', 'rm -r build', 'rm -fr build', 'rm -R build', 'rm --recursive --force build', 'sudo rm -rf build', 'cd C:/proj && rm -rf build']) {
    expect((await bash($, command)).deny, command).toBe(denyOf('rm -r', 6, 5, lst('C:/proj/build', 'f', 6)))
  }
  // several targets add up
  expect((await bash($, 'rm -rf dist tmp')).deny).toBe(denyOf('rm -r', 8, 5, [...lst('C:/proj/dist', 'd', 4), ...lst('C:/proj/tmp', 't', 4)]))
  // a cd moves the measuring
  dirOf(r, 'C:/proj/sub/out', 7, 'o')
  expect((await bash($, 'cd sub && rm -rf out')).deny).toBe(denyOf('rm -r', 7, 5, lst('C:/proj/sub/out', 'o', 7)))

  // git clean
  git(r, { clean: names('junk', 7) })
  expect((await bash($, 'git clean -fd')).deny).toBe(denyOf('git clean', 7, 5, names('junk', 7)))
  expect(r.procs.filter(p => p[1] === 'clean').pop()).toEqual(['git', 'clean', '-n', '-d'])
  expect((await bash($, 'git clean -fdx')).deny).toContain('git clean')
  expect(r.procs.filter(p => p[1] === 'clean').pop()).toEqual(['git', 'clean', '-n', '-dx'])
  // git reset --hard counts tracked changes, not untracked files
  git(r, { status: porcelain(6) })
  expect((await bash($, 'git reset --hard')).deny).toBe(denyOf('git reset --hard', 6, 5, names('m', 6).map(x => `src/${x}.ts`)))
  expect((await bash($, 'git reset --hard HEAD~1')).deny).toContain('git reset --hard')
  // checkout . / restore .
  expect((await bash($, 'git checkout .')).deny).toContain('git checkout -- .')
  expect((await bash($, 'git checkout -- .')).deny).toContain('git checkout -- .')
  expect((await bash($, 'git restore .')).deny).toContain('git restore .')
  // stashes
  git(r, { stash: names('stash@{', 6).map(x => `${x}}: WIP`), stashShow: names('s', 7).map(x => `${x}.ts`) })
  expect((await bash($, 'git stash clear')).deny).toContain('git stash clear')
  expect((await bash($, 'git stash drop')).deny).toContain('git stash drop')
  expect(r.procs.filter(p => p[1] === 'stash').pop()).toEqual(['git', 'stash', 'show', '--name-only'])
  expect((await bash($, 'git stash drop stash@{2}')).deny).toContain('would affect 7 items')
  expect(r.procs.filter(p => p[1] === 'stash').pop()).toEqual(['git', 'stash', 'show', '--name-only', 'stash@{2}'])
  // a combination names both
  git(r, { clean: names('junk', 3), status: porcelain(3) })
  expect((await bash($, 'git clean -fd && git reset --hard')).deny).toContain('(git clean + git reset --hard) would affect 6 items')
})

test('find -delete and shell globs are measured on a Windows host', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  r.proc = argv => {
    if (argv[0] === 'bash') return { exitCode: 0, stdout: names('./a/old', 7).map(x => `${x}.log`).join('\n'), stderr: '' }
    if (argv[0] === 'cmd') return { exitCode: 0, stdout: names('C:\\proj\\dist\\g', 9).join('\r\n') + '\r\n', stderr: '' }
    return { exitCode: 0, stdout: '', stderr: '' }
  }
  const found = await bash($, 'find . -name "*.log" -delete')
  expect(found.deny).toContain('(find -delete) would affect 7 items (threshold 5)')
  expect(found.deny).toContain('./a/old0.log')
  expect(r.procs.filter(p => p[0] === 'bash').pop()).toEqual(['bash', '-c', 'find . -name "*.log" | head -201'])
  const glob = await bash($, 'rm -rf dist/*')
  expect(glob.deny).toContain('(rm -r) would affect 9 items')
  expect(r.procs.filter(p => p[0] === 'cmd').pop()).toEqual(['cmd', '/c', 'dir', '/s', '/b', 'dist\\*'])
  // find with -exec is not previewed
  r.procs.length = 0
  expect((await bash($, 'find . -name "*.tmp" -exec rm {} \\; -delete')).deny).toBe(undefined)
})

test('on a Unix host find and globs go through sh', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON, cwd: '/home/u/proj', os: '' })
  await $.session.start({ cwd: '/home/u/proj', surface: 'terminal', isInteractive: true })
  r.proc = argv => ({ exitCode: 0, stdout: argv[0] === 'sh' ? names('/home/u/proj/out/x', 8).join('\n') : '', stderr: '' })
  expect((await bash($, 'rm -rf out/*.o')).deny).toContain('would affect 8 items')
  expect(r.procs.filter(p => p[0] === 'sh').pop()).toEqual(['sh', '-c', 'find out/*.o 2>/dev/null | head -201'])
  expect((await bash($, 'find /home/u/proj/out -type f -delete')).deny).toContain('(find -delete) would affect 8 items')
  expect(r.procs.filter(p => p[0] === 'sh').pop()).toEqual(['sh', '-c', 'find /home/u/proj/out -type f | head -201'])
})

test('at or under the threshold passes, and is logged as allowed', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  dirOf(r, 'C:/proj/five', 5)
  dirOf(r, 'C:/proj/six', 6)
  expect((await bash($, 'rm -rf five')).deny).toBe(undefined)
  expect((await bash($, 'rm -rf six')).deny).toContain('would affect 6 items')
  git(r, { status: porcelain(2) })
  expect((await bash($, 'git reset --hard')).deny).toBe(undefined)
  expect((await blast($, '')).text).toBe(
    [
      'Blast radius: threshold 5 items. Log (newest first):',
      'allowed · git reset --hard · 2 items · git reset --hard',
      'BLOCKED · rm -r · 6 items · rm -rf six',
      'allowed · rm -r · 5 items · rm -rf five',
    ].join('\n'),
  )
})

test('things that are not a measurable destructive command pass (14 inputs)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  dirOf(r, 'C:/proj/build', 30)
  git(r, { clean: names('junk', 20), status: porcelain(20), stash: names('st', 9) })
  const fine = [
    'rm build/f1',
    'rm -f build/f1 build/f2',
    'rm -rf nonexistent-dir',
    'git clean -n -d',
    'git clean -d',
    'git status',
    'git stash list',
    'git stash',
    'git checkout main',
    'git restore --staged .',
    'ls build',
    'find . -name "*.log"',
    'npm run clean',
    'echo "step: rm -rf build"',
    'git commit -m "docs: explain rm -rf build"',
    'grep -rn "git reset --hard" docs',
    'cat notes.txt | grep clean',
  ]
  for (const command of fine) expect((await bash($, command)).deny, command).toBe(undefined)
  expect((await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })).deny).toBe(undefined)
})

test('a failing or throwing dry run never blocks the command', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  git(r, { fail: true })
  expect((await bash($, 'git clean -fd')).deny).toBe(undefined)
  expect((await bash($, 'git reset --hard')).deny).toBe(undefined)
  git(r, { throws: true })
  expect((await bash($, 'git clean -fd')).deny).toBe(undefined)
  expect((await bash($, 'git stash clear')).deny).toBe(undefined)
  r.proc = () => 'throw'
  expect((await bash($, 'find . -name "*.log" -delete')).deny).toBe(undefined)
})

test('more than 25 entries show 25 and say so; more than 200 read as "200+"', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  dirOf(r, 'C:/proj/big', 40)
  const res = await bash($, 'rm -rf big')
  expect(res.deny).toBe(denyOf('rm -r', 40, 5, names('f', 25).map(x => `C:/proj/big/${x}`), '... and more not shown.\n'))
  dirOf(r, 'C:/proj/huge', 250)
  const huge = await bash($, 'rm -rf huge')
  expect(huge.deny).toContain('would affect 200+ items (threshold 5). First 25:')
  expect(huge.deny).toContain('... and more not shown.')
  expect((await blast($, '')).text).toContain('BLOCKED · rm -r · 200+ items · rm -rf huge')
})

test('/blast allow: one pass for the next blocked command, ten minutes at most', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  dirOf(r, 'C:/proj/build', 8)
  expect((await bash($, 'rm -rf build')).deny).toContain('would affect 8 items')
  expect((await blast($, 'allow')).text).toBe('One-shot pass granted for 10 minutes: the next blocked command will run.')
  expect((await bash($, 'rm -rf build')).deny).toBe(undefined)
  expect((await blast($, '')).text.split('\n')[1]).toBe('passed once · rm -r · 8 items · rm -rf build')
  expect((await bash($, 'rm -rf build')).deny).toContain('would affect 8 items')
  // the pass is not spent by a small command
  await blast($, 'allow')
  dirOf(r, 'C:/proj/small', 2)
  expect((await bash($, 'rm -rf small')).deny).toBe(undefined)
  expect((await bash($, 'rm -rf build')).deny).toBe(undefined)
  // and it runs out
  await blast($, 'allow')
  await r.clock.advance(11 * 60_000)
  expect((await bash($, 'rm -rf build')).deny).toContain('would affect 8 items')
  await blast($, 'allow')
  await r.clock.advance(9 * 60_000)
  expect((await bash($, 'rm -rf build')).deny).toBe(undefined)
})

test('/blast threshold: every argument form, kept in the store', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  for (const bad of ['threshold', 'threshold abc', 'threshold -1', 'threshold 1.5', 'threshold 100001', 'bogus', 'ALLOW']) {
    expect((await blast($, bad)).text, bad).toBe(USAGE)
  }
  dirOf(r, 'C:/proj/build', 8)
  expect((await blast($, 'threshold 20')).text).toBe('Threshold set to 20 items.')
  expect((await bash($, 'rm -rf build')).deny).toBe(undefined)
  expect((await blast($, '')).text.split('\n')[0]).toBe('Blast radius: threshold 20 items. Log (newest first):')
  expect((await blast($, 'threshold 7')).text).toBe('Threshold set to 7 items.')
  expect((await bash($, 'rm -rf build')).deny).toContain('would affect 8 items (threshold 7)')
  expect((await blast($, 'threshold 0')).text).toBe('Threshold set to 0 items.')
  dirOf(r, 'C:/proj/one', 1)
  expect((await bash($, 'rm -rf one')).deny).toContain('would affect 1 items (threshold 0)')
  expect((await blast($, 'threshold 100000')).text).toBe('Threshold set to 100000 items.')
})

test('the threshold survives a new session; a bad stored value falls back to 5', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON, store: { 'blast-radius:threshold': 12 } })
  await start($)
  expect((await blast($, '')).text.split('\n')[0]).toBe('Blast radius: threshold 12 items. Log (newest first):')
})

test('a bad stored threshold is ignored', { timeoutMs: 30_000 }, async ($, on) => {
  rig(on, { enabled: ON, store: { 'blast-radius:threshold': -4 } })
  await start($)
  expect((await blast($, '')).text.split('\n')[0]).toBe('Blast radius: threshold 5 items. Log (newest first):')
})

test('the log keeps thirty rows and shortens long commands', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  dirOf(r, 'C:/proj/one', 1)
  for (let i = 0; i < 33; i++) await bash($, `rm -rf one # run ${i}`)
  const lines = (await blast($, '')).text.split('\n')
  expect(lines).toHaveLength(31)
  expect(lines[1]).toBe('allowed · rm -r · 1 items · rm -rf one # run 32')
  const long = `rm -rf one # ${'x'.repeat(120)}`
  await bash($, long)
  const row = (await blast($, '')).text.split('\n')[1] ?? ''
  expect(row.endsWith('…')).toBe(true)
  expect(row).toBe(`allowed · rm -r · 1 items · ${long.slice(0, 79)}…`)
})

test('a block counts as an incident; an allowed or passed command does not', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  dirOf(r, 'C:/proj/build', 8)
  dirOf(r, 'C:/proj/one', 1)
  await bash($, 'rm -rf one')
  await bash($, 'rm -rf build')
  await blast($, 'allow')
  await bash($, 'rm -rf build')
  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'incidents'))).toBe('🛡 1 prevented')
  await ui.unmount()
})

test('off switch: nothing is measured, the command says off', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: { ...ON, 'blast-radius': false } })
  await start($)
  dirOf(r, 'C:/proj/build', 30)
  r.procs.length = 0
  expect((await bash($, 'rm -rf build')).deny).toBe(undefined)
  expect(r.procs).toEqual([])
  expect((await blast($, '')).text).toBe(OFF_TEXT)
  expect((await blast($, 'allow')).text).toBe(OFF_TEXT)
  expect((await blast($, 'threshold 3')).text).toBe(OFF_TEXT)
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON, lang: 'he' })
  await start($)
  expect((await blast($, '')).text).toBe('רדיוס הנזק: סף 5 פריטים. יומן (החדשים ראשונים):\nעדיין לא נבדקו פקודות הרסניות.')
  expect((await blast($, 'x')).text).toBe('שימוש: \u200E/blast, \u200E/blast allow, \u200E/blast threshold <n>')
  dirOf(r, 'C:/proj/build', 6)
  const res = await bash($, 'rm -rf build')
  expect(res.deny).toBe(
    'Toolkitty · רדיוס הנזק: הפקודה (rm -r) תשפיע על 6 פריטים (סף 5). 6 הראשונים:\n' +
      names('f', 6).map(x => `C:/proj/build/${x}`).join('\n') +
      '\nכדי להריץ אותה בכל זאת, המשתמש יכול להקליד /blast allow ולנסות שוב.',
  )
  expect((await blast($, 'allow')).text).toBe('ניתן מעבר חד-פעמי ל-10 דקות: הפקודה החסומה הבאה תרוץ.')
  expect((await blast($, 'threshold 9')).text).toBe('הסף נקבע ל-9 פריטים.')
  expect((await blast($, '')).text.split('\n')[1]).toBe('נחסם · rm -r · 6 פריטים · rm -rf build')
})

test('a dry run that takes longer than twelve seconds lets the command through, unlogged', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  r.proc = async argv => {
    if (argv[1] === 'clean') {
      await r.clock.advance(13_000)
      return { exitCode: 0, stdout: names('Would remove junk', 20).join('\n'), stderr: '' }
    }
    return { exitCode: 0, stdout: '', stderr: '' }
  }
  expect((await bash($, 'git clean -fd')).deny).toBe(undefined)
  expect((await blast($, '')).text).toBe('Blast radius: threshold 5 items. Log (newest first):\nNo destructive commands checked yet.')
})
