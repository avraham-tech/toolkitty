import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import { isOn, t } from '../core'
import type { Incidents } from '../shared'
import type { Feature, ToolCallInput, ToolCallOutput } from '../core'

const T = {
  title: { en: 'Branch lock', he: 'נעילת ענף', es: 'Bloqueo de rama', fr: 'Verrouillage de branche', ru: 'Блокировка ветки', zh: '分支锁', ja: 'ブランチロック', pt: 'Trava de branch', de: 'Branch-Sperre', ko: '브랜치 잠금' },
  description: { en: 'Blocks file edits while on main or master.', he: 'חוסם עריכת קבצים כשנמצאים על main או master.', es: 'Bloquea la edición de archivos mientras estás en main o master.', fr: 'Bloque la modification de fichiers quand tu es sur main ou master.', ru: 'Блокирует редактирование файлов, пока вы на main или master.', zh: '在 main 或 master 分支上时禁止编辑文件。', ja: 'main または master ブランチにいる間はファイル編集をブロックします。', pt: 'Bloqueia edições de arquivos enquanto você está em main ou master.', de: 'Blockiert Dateibearbeitungen, solange du auf main oder master bist.', ko: 'main 또는 master 브랜치에 있는 동안 파일 편집을 차단합니다.' },
  deny: { en: 'Toolkitty · Branch lock: you are on the {branch} branch, so file edits were blocked. Create a working branch (git switch -c <name>) and continue from there, or turn the feature off in the /toolkitty pane.', he: 'Toolkitty · נעילת ענף: אתה על הענף {branch}, ולכן עריכת קבצים נחסמה. צור ענף עבודה (git switch -c <שם>) והמשך משם, או כבה את השכלול בלוח /toolkitty.', es: 'Toolkitty · Bloqueo de rama: estás en la rama {branch}, así que se bloqueó la edición de archivos. Crea una rama de trabajo (git switch -c <nombre>) y continúa desde ahí, o desactiva la función en el panel /toolkitty.', fr: 'Toolkitty · Verrouillage de branche : vous êtes sur la branche {branch}, la modification de fichiers a donc été bloquée. Créez une branche de travail (git switch -c <nom>) et continuez depuis celle-ci, ou désactivez la fonctionnalité dans le panneau /toolkitty.', ru: 'Toolkitty · Блокировка ветки: вы на ветке {branch}, поэтому редактирование файлов заблокировано. Создайте рабочую ветку (git switch -c <имя>) и продолжайте в ней или выключите функцию в панели /toolkitty.', zh: 'Toolkitty · 分支锁：你当前在 {branch} 分支，因此文件编辑已被拦截。请创建一个工作分支（git switch -c <name>）并在其上继续，或在 /toolkitty 面板中关闭该功能。', ja: 'Toolkitty · ブランチロック：現在 {branch} ブランチにいるため、ファイル編集をブロックしました。作業用ブランチを作成して（git switch -c <name>）そこで続けるか、/toolkitty ペインでこの機能をオフにしてください。', pt: 'Toolkitty · Trava de branch: você está no branch {branch}, então as edições de arquivos foram bloqueadas. Crie um branch de trabalho (git switch -c <name>) e continue nele, ou desative o recurso no painel /toolkitty.', de: 'Toolkitty · Branch-Sperre: Du bist auf dem Branch {branch}, daher wurden Dateibearbeitungen blockiert. Erstelle einen Arbeits-Branch (git switch -c <name>) und mach dort weiter, oder schalte die Funktion im Panel /toolkitty aus.', ko: 'Toolkitty · 브랜치 잠금: 현재 {branch} 브랜치에 있어 파일 편집이 차단되었습니다. 작업용 브랜치를 만들어(git switch -c <name>) 이어가거나, /toolkitty 창에서 이 기능을 끄세요.' },
} as const

type State = { cwd: string; branch: string | null; checkedAt: number }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'branch-lock' } as const, { cwd: '', branch: null, checkedAt: 0 }) as unknown as Atom<State>

const CACHE_MS = 10_000

export const feature: Feature = {
  id: 'branch-lock',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

const incidents = atom({ plugin: 'toolkitty', key: 'slot', id: 'incidents' } as const, { count: 0, items: [], lastAt: null } as Incidents) as unknown as Atom<Incidents>

/** Reports a block or redaction to "Disasters prevented": kind and file name only, never a secret value. */
async function reportIncident($: EngineInterface, kind: string, detail: string): Promise<void> {
  try {
    const at = await $.clock.now()
    await update($, incidents, s => ({ count: s.count + 1, lastAt: at, items: [...s.items.slice(-99), { at, feature: feature.id, kind, detail }] }))
  } catch {
    // reporting never changes what the guard does
  }
}

export async function beforeEditCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined
  if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit') return undefined

  const cwd = await $.session.cwd()
  const now = await $.clock.now()
  const cached = await read($, state)

  let branch: string | null
  if (cached.cwd === cwd && now - cached.checkedAt < CACHE_MS) {
    branch = cached.branch
  } else {
    try {
      const out = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd, timeoutMs: 5000 })
      branch = out.exitCode === 0 ? out.stdout.trim() : null
    } catch {
      branch = null
    }
    await update($, state, () => ({ cwd, branch, checkedAt: now }))
  }

  if (branch !== 'main' && branch !== 'master') return undefined

  await reportIncident($, 'branch-lock', `edit on ${branch}`)
  return {
    deny: t(T.deny, { branch }),
  }
}
