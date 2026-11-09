import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import { isOn } from '../core'
import type { Feature, Input, Output } from '../core'

const T = {
  title: { en: 'Git context', he: 'הקשר git', es: 'Contexto de git', fr: 'Contexte git', ru: 'Контекст git', zh: 'Git 上下文', ja: 'Git コンテキスト', pt: 'Contexto do Git', de: 'Git-Kontext', ko: 'Git 컨텍스트' },
  description: {
    en: 'Injects the branch, changed files and latest commits into the model, refreshed every turn.',
    he: 'מזריק למודל את הענף, הקבצים ששונו והקומיטים האחרונים, ומתרענן בכל תור.',
    es: 'Inyecta en el modelo la rama, los archivos modificados y los últimos commits, y se actualiza en cada turno.',
    fr: 'Injecte dans le modèle la branche, les fichiers modifiés et les derniers commits, et se met à jour à chaque tour.',
    ru: 'Передаёт модели ветку, изменённые файлы и последние коммиты; обновляется каждый ход.',
    zh: '将分支、已更改文件和最新提交注入模型，每轮刷新。',
    ja: 'ブランチ、変更されたファイル、最新のコミットをモデルに渡し、ターンごとに更新します。',
    pt: 'Injeta no modelo o branch, os arquivos alterados e os últimos commits, atualizados a cada turno.',
    de: 'Gibt dem Modell Branch, geänderte Dateien und letzte Commits mit, bei jedem Durchgang aktualisiert.',
    ko: '브랜치, 변경된 파일, 최근 커밋을 모델에 주입하며 매 턴 갱신됩니다.',
  },
} as const

type GitInfo = { cwd: string; text: string }

const info = atom({ plugin: 'toolkitty', key: 'slot', id: 'git-context' } as const, { cwd: '', text: '' }) as unknown as Atom<GitInfo>

const SECTION_ID = 'toolkitty:git-context'
const MAX_TEXT = 3500

async function gather($: EngineInterface, cwd: string): Promise<string> {
  const run = async (argv: string[]) => {
    try {
      return await $.process.run(argv, { cwd, timeoutMs: 10000 })
    } catch {
      return null
    }
  }

  const inside = await run(['git', 'rev-parse', '--is-inside-work-tree'])
  if (inside === null || inside.exitCode !== 0) return ''

  const branchRes = await run(['git', 'branch', '--show-current'])
  let branch = branchRes !== null && branchRes.exitCode === 0 ? branchRes.stdout.trim() : ''
  if (branch === '') {
    const head = await run(['git', 'rev-parse', '--short', 'HEAD'])
    branch = head !== null && head.exitCode === 0 ? `(detached at ${head.stdout.trim()})` : '(no commits yet)'
  }

  const statusRes = await run(['git', 'status', '--porcelain'])
  const entries =
    statusRes !== null && statusRes.exitCode === 0 ? statusRes.stdout.split(/\r?\n/).filter(l => l.trim() !== '') : []
  const untracked = entries.filter(l => l.startsWith('??'))
  const modified = entries.length - untracked.length
  const paths = entries.slice(0, 15).map(l => `  ${l.trim()}`)

  const logRes = await run(['git', 'log', '-5', '--pretty=format:%s'])
  const subjects =
    logRes !== null && logRes.exitCode === 0 ? logRes.stdout.split(/\r?\n/).filter(l => l.trim() !== '') : []

  const lines = [
    '# Git context',
    `Branch: ${branch}`,
    entries.length === 0
      ? 'Working tree: clean'
      : `Working tree: ${modified} modified/staged, ${untracked.length} untracked`,
  ]
  if (paths.length > 0) {
    lines.push(`Changed paths (first ${paths.length} of ${entries.length}):`, ...paths)
  }
  if (subjects.length > 0) lines.push('Recent commits:', ...subjects.map(s => `  - ${s}`))
  return lines.join('\n').slice(0, MAX_TEXT)
}

export const feature: Feature = {
  id: 'git-context',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

async function refresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const text = await gather($, cwd)
  const prev = await read($, info)
  await update($, info, () => ({ cwd, text }))
  if (prev.text !== text) $.ui.invalidate('prompt.section')
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  if (await isOn($, feature)) await refresh($)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await refresh($)
}

export async function onPromptCompose(
  $: EngineInterface,
  _e: Input<'prompt.compose'>,
  result: Output<'prompt.compose'>,
): Promise<Output<'prompt.compose'>> {
  if (!(await isOn($, feature))) return result

  const { text } = await read($, info)
  if (text === '') return result

  return {
    ...result,
    sections: [
      ...result.sections.filter(s => s.id !== SECTION_ID),
      { id: SECTION_ID, text, scope: 'session' as const },
    ],
  }
}
