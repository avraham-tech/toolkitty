import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, Timer } from 'claude-code'

import { isOn, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput } from '../core'
import { emptyState, ICONS, listRow, sectionTitle } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: {
    en: 'Commit reminder',
    he: 'תזכורת קומיט',
    es: 'Recordatorio de commit',
    fr: 'Rappel de commit',
    ru: 'Напоминание о коммите',
    zh: '提交提醒',
    ja: 'コミットのリマインダー',
    pt: 'Lembrete de commit',
    de: 'Commit-Erinnerung',
    ko: '커밋 알림',
  },
  description: {
    en: 'A line above the prompt box when 10 or more files are uncommitted.',
    he: 'שורה מעל תיבת הכתיבה כשיש 10 קבצים או יותר שלא קומטו.',
    es: 'Una línea sobre el cuadro de texto cuando hay 10 o más archivos sin commit.',
    fr: 'Une ligne au-dessus de la zone de saisie lorsque 10 fichiers ou plus ne sont pas commités.',
    ru: 'Строка над полем ввода, когда не закоммичено 10 файлов или больше.',
    zh: '当有 10 个或更多文件未提交时，在输入框上方显示一行。',
    ja: '未コミットのファイルが 10 個以上あると、プロンプト欄の上に 1 行表示されます。',
    pt: 'Uma linha acima da caixa de prompt quando 10 ou mais arquivos não foram commitados.',
    de: 'Eine Zeile über dem Eingabefeld, wenn 10 oder mehr Dateien nicht committet sind.',
    ko: '커밋되지 않은 파일이 10개 이상이면 프롬프트 입력창 위에 한 줄을 표시합니다.',
  },
  band: {
    en: '⚠ {n} uncommitted files',
    he: '⚠ {n} קבצים לא מקומטים',
    es: '⚠ {n} archivos sin commit',
    fr: '⚠ {n} fichiers non commités',
    ru: '⚠ Не закоммичено файлов: {n}',
    zh: '⚠ {n} 个未提交文件',
    ja: '⚠ 未コミット {n} 件',
    pt: '⚠ {n} arquivos sem commit',
    de: '⚠ {n} Dateien ohne Commit',
    ko: '⚠ 미커밋 파일 {n}개',
  },
  dHead: { en: 'Uncommitted files: {n}', he: 'קבצים שלא נשמרו ב-commit: {n}', es: 'Archivos sin confirmar: {n}', fr: 'Fichiers non validés : {n}', ru: 'Незафиксированные файлы: {n}', zh: '未提交文件：{n}', ja: '未コミットのファイル：{n}', pt: 'Arquivos sem commit: {n}', de: 'Dateien ohne Commit: {n}', ko: '커밋되지 않은 파일: {n}' },
  chip: { en: '{n} uncommitted', he: '{n} לא מקומטים', es: '{n} sin commit', fr: '{n} non commités', ru: '{n} не в коммите', zh: '{n} 个未提交', ja: '未コミット {n}', pt: '{n} sem commit', de: '{n} ohne Commit', ko: '미커밋 {n}' },
  dCleanHint: { en: 'Files Claude edits show up here until they are committed.', he: 'קבצים ש-Claude עורך יופיעו כאן עד שיקומטו.', es: 'Los archivos que Claude edita aparecen aquí hasta que se confirman.', fr: 'Les fichiers que Claude modifie apparaissent ici jusqu\'au commit.', ru: 'Файлы, которые правит Claude, будут здесь, пока их не закоммитят.', zh: 'Claude 编辑的文件会一直显示在这里，直到被提交。', ja: 'Claude が編集したファイルは、コミットされるまでここに表示されます。', pt: 'Os arquivos que o Claude edita aparecem aqui até serem commitados.', de: 'Von Claude bearbeitete Dateien erscheinen hier, bis sie committet sind.', ko: 'Claude가 편집한 파일은 커밋될 때까지 여기에 표시됩니다.' },
  dFailHint: { en: 'Open the session in a folder that is a git repository.', he: 'פתחו את הסשן בתיקייה שהיא מאגר git.', es: 'Abre la sesión en una carpeta que sea un repositorio git.', fr: 'Ouvrez la session dans un dossier qui est un dépôt git.', ru: 'Откройте сессию в папке, которая является репозиторием git.', zh: '请在一个 git 仓库文件夹中打开会话。', ja: 'git リポジトリのフォルダーでセッションを開いてください。', pt: 'Abra a sessão em uma pasta que seja um repositório git.', de: 'Öffne die Sitzung in einem Ordner, der ein Git-Repository ist.', ko: 'git 저장소인 폴더에서 세션을 여세요.' },
  dMore: { en: '+{n} more', he: '+{n} נוספים', es: '+{n} más', fr: '+{n} de plus', ru: 'и ещё {n}', zh: '+{n} 个', ja: '+{n} 件', pt: '+{n} mais', de: '+{n} weitere', ko: '+{n}개 더' },
  dClean: { en: 'The working tree is clean.', he: 'עץ העבודה נקי.', es: 'El árbol de trabajo está limpio.', fr: 'L\'arbre de travail est propre.', ru: 'Рабочее дерево чистое.', zh: '工作区是干净的。', ja: '作業ツリーはクリーンです。', pt: 'A árvore de trabalho está limpa.', de: 'Der Arbeitsbaum ist sauber.', ko: '작업 트리가 깨끗합니다.' },
  dFail: { en: 'Could not run git status (not a repository, or git is missing).', he: 'לא ניתן להריץ git status (לא מאגר, או ש-git חסר).', es: 'No se pudo ejecutar git status (no es un repositorio o falta git).', fr: 'Impossible d\'exécuter git status (pas un dépôt, ou git est absent).', ru: 'Не удалось выполнить git status (не репозиторий или нет git).', zh: '无法运行 git status（不是仓库，或未安装 git）。', ja: 'git status を実行できませんでした（リポジトリではないか、git がありません）。', pt: 'Não foi possível executar git status (não é um repositório ou o git não está instalado).', de: 'git status konnte nicht ausgeführt werden (kein Repository, oder git fehlt).', ko: 'git status를 실행할 수 없습니다(저장소가 아니거나 git이 없음).' },
} as const

type Git = { running: boolean; count: number }

const git = atom({ plugin: 'toolkitty', key: 'slot', id: 'uncommitted-reminder' } as const, { running: false, count: 0 }) as unknown as Atom<Git>

const THRESHOLD = 10

let ticker: Timer | undefined

async function check($: EngineInterface): Promise<void> {
  try {
    if (!(await isOn($, feature))) return
    const state = await read($, git)
    if (state.running) return

    const cwd = await $.session.cwd()
    const r = await $.process.run(['git', 'status', '--porcelain'], { cwd, timeoutMs: 10000 })
    const count = r.exitCode === 0 ? r.stdout.split('\n').filter(line => line.trim() !== '').length : 0

    if (count !== state.count) {
      await update($, git, s => ({ ...s, count }))
    }
  } catch {
    // not a git repo or git missing: stay silent
  }
}

export const feature: Feature = {
  id: 'uncommitted-reminder',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  ticker?.cancel()
  ticker = $.clock.every(30000, () => {
    void check($)
  })
  void check($)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await update($, git, s => ({ ...s, running: true }))
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  await update($, git, s => ({ ...s, running: false }))
  void check($)
}

/** What a press on the band line shows: the uncommitted files, from `git status --porcelain` run now. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const { Box, Text } = $.ui.resolve(e)
  let lines: string[] | null = null
  try {
    const cwd = await $.session.cwd()
    const r = await $.process.run(['git', 'status', '--porcelain'], { cwd, timeoutMs: 5000 })
    if (r.exitCode === 0) lines = r.stdout.split('\n').map(line => line.trimEnd()).filter(line => line.trim() !== '')
  } catch {
    // not a git repo or git missing: shown below
  }

  return (
    <Box flexDirection="column">
      {lines === null ? emptyState($, e, t(T.dFail), t(T.dFailHint)) : null}
      {lines !== null && lines.length === 0 ? emptyState($, e, t(T.dClean), t(T.dCleanHint)) : null}
      {lines !== null && lines.length > 0 ? sectionTitle($, e, t(T.dHead, { n: lines.length })) : null}
      {(lines ?? []).slice(0, 13).map((line, i) => listRow($, e, { key: `u${i}`, text: line }))}
      {lines !== null && lines.length > 13 ? <Text dimColor>{t(T.dMore, { n: lines.length - 13 })}</Text> : null}
    </Box>
  )
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const { count } = await read($, git)
  if (count < THRESHOLD) return null

  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      {t(T.band, { n: count })}
    </Text>
  )
}

/** The short band form: how many files are uncommitted; amber from the threshold, quiet at none. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const { count } = await read($, git)
  if (count === 0) return null

  return { text: t(T.chip, { n: count }), level: count >= THRESHOLD ? 'warn' : 'ok', icon: ICONS.guard }
}
