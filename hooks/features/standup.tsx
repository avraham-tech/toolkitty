import { isOn, notice, t } from '../core'
import type { EngineInterface, On } from 'claude-code'
import type { Feature, Input } from '../core'

const T = {
  title: {
    en: 'Standup',
    he: 'סיכום יומי',
    es: 'Standup',
    fr: 'Standup',
    ru: 'Стендап',
    zh: '站会',
    ja: 'スタンドアップ',
    pt: 'Standup',
    de: 'Standup',
    ko: '스탠드업',
  },
  description: {
    en: '/daily-standup: what was done today, based on commits and change stats.',
    he: '/daily-standup: מה נעשה היום לפי קומיטים וסטטיסטיקת שינויים.',
    es: '/daily-standup: qué se hizo hoy, según los commits y las estadísticas de cambios.',
    fr: "/daily-standup : ce qui a été fait aujourd'hui, d'après les commits et les statistiques de modifications.",
    ru: '/daily-standup: что сделано сегодня, по коммитам и статистике изменений.',
    zh: '/daily-standup：根据提交和变更统计，列出今天做了什么。',
    ja: '/daily-standup：コミットと変更統計から、今日やったことをまとめます。',
    pt: '/daily-standup: o que foi feito hoje, com base em commits e estatísticas de alterações.',
    de: '/daily-standup: was heute erledigt wurde, basierend auf Commits und Änderungsstatistiken.',
    ko: '/daily-standup: 커밋과 변경 통계를 바탕으로 오늘 한 일을 정리합니다.',
  },
  off: {
    en: 'This feature is off; turn it on in the /toolkitty panel',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'Esta función está desactivada; actívala en el panel /toolkitty',
    fr: 'Cette fonctionnalité est désactivée ; active-la dans le panneau /toolkitty',
    ru: 'Функция выключена; включите её на панели /toolkitty',
    zh: '此功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'Este recurso está desativado; ative-o no painel /toolkitty',
    de: 'Diese Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  commandDesc: {
    en: 'Summary of what was done today in git: commits and changes',
    he: 'סיכום מה נעשה היום ב-git: קומיטים ושינויים',
    es: 'Resumen de lo que se hizo hoy en git: commits y cambios',
    fr: "Résumé de ce qui a été fait aujourd'hui dans git : commits et modifications",
    ru: 'Сводка того, что сделано сегодня в git: коммиты и изменения',
    zh: '今天在 git 中完成工作的摘要：提交和变更',
    ja: '今日 git で行った作業の要約：コミットと変更',
    pt: 'Resumo do que foi feito hoje no git: commits e alterações',
    de: 'Zusammenfassung dessen, was heute in git erledigt wurde: Commits und Änderungen',
    ko: '오늘 git에서 한 일 요약: 커밋과 변경 사항',
  },
  heading: {
    en: 'What was done today:',
    he: 'מה נעשה היום:',
    es: 'Qué se hizo hoy:',
    fr: "Ce qui a été fait aujourd'hui :",
    ru: 'Что сделано сегодня:',
    zh: '今天完成的工作：',
    ja: '今日やったこと：',
    pt: 'O que foi feito hoje:',
    de: 'Heute erledigt:',
    ko: '오늘 한 일:',
  },
  notRepo: {
    en: 'The folder is not a git repository.',
    he: 'התיקייה אינה מאגר git.',
    es: 'La carpeta no es un repositorio git.',
    fr: "Le dossier n'est pas un dépôt git.",
    ru: 'Эта папка не является репозиторием git.',
    zh: '该文件夹不是 git 仓库。',
    ja: 'このフォルダは git リポジトリではありません。',
    pt: 'A pasta não é um repositório git.',
    de: 'Der Ordner ist kein Git-Repository.',
    ko: '이 폴더는 git 저장소가 아닙니다.',
  },
  noCommits: {
    en: 'No commits today.',
    he: 'אין קומיטים מהיום.',
    es: 'No hay commits de hoy.',
    fr: "Aucun commit aujourd'hui.",
    ru: 'Сегодня коммитов нет.',
    zh: '今天没有提交。',
    ja: '今日のコミットはありません。',
    pt: 'Nenhum commit hoje.',
    de: 'Heute keine Commits.',
    ko: '오늘 커밋이 없습니다.',
  },
  uncommitted: {
    en: 'uncommitted changes',
    he: 'שינויים שטרם נכנסו לקומיט',
    es: 'cambios sin confirmar',
    fr: 'modifications non validées',
    ru: 'незакоммиченные изменения',
    zh: '未提交的更改',
    ja: '未コミットの変更',
    pt: 'alterações não commitadas',
    de: 'nicht committete Änderungen',
    ko: '커밋되지 않은 변경 사항',
  },
  cmdTaken: {
    en: 'The command /{name} could not be registered: {reason}',
    he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}',
    es: 'No se pudo registrar el comando /{name}: {reason}',
    fr: "Impossible d'enregistrer la commande /{name} : {reason}",
    ru: 'Не удалось зарегистрировать команду /{name}: {reason}',
    zh: '无法注册命令 /{name}：{reason}',
    ja: 'コマンド /{name} を登録できませんでした：{reason}',
    pt: 'Não foi possível registrar o comando /{name}: {reason}',
    de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}',
    ko: '/{name} 명령을 등록할 수 없습니다: {reason}',
  },
} as const

const COMMAND = 'daily-standup'

export const feature: Feature = {
  id: 'standup',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: COMMAND, description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'daily-standup', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  return
}

export function register(on: On) {
    on('command.run', { command: COMMAND }, async $ => {
      if (!(await isOn($, feature))) return { text: t(T.off) }

      const cwd = await $.session.cwd()
      const run = async (argv: string[]) => {
        try {
          return await $.process.run(argv, { cwd, timeoutMs: 15000 })
        } catch {
          return null
        }
      }

      const inside = await run(['git', 'rev-parse', '--is-inside-work-tree'])
      if (inside === null || inside.exitCode !== 0) return { text: t(T.heading) + '\n' + t(T.notRepo) }

      const nameRes = await run(['git', 'config', 'user.name'])
      const author = nameRes !== null && nameRes.exitCode === 0 ? nameRes.stdout.trim() : ''

      const logArgs = ['git', 'log', '--since=midnight', '--pretty=format:%s']
      if (author !== '') logArgs.push(`--author=${author}`)
      const log = await run(logArgs)
      const subjects =
        log !== null && log.exitCode === 0
          ? log.stdout
              .split(/\r?\n/)
              .map(s => s.trim())
              .filter(s => s !== '')
          : []

      let stat = ''
      const diff = await run(['git', 'diff', '--shortstat', 'HEAD@{midnight}'])
      if (diff !== null && diff.exitCode === 0) stat = diff.stdout.trim()
      if (stat === '') {
        // Fallback: uncommitted work against HEAD.
        const work = await run(['git', 'diff', '--shortstat', 'HEAD'])
        if (work !== null && work.exitCode === 0 && work.stdout.trim() !== '') {
          stat = `${work.stdout.trim()} (${t(T.uncommitted)})`
        }
      }

      if (subjects.length === 0 && stat === '') return { text: t(T.heading) + '\n' + t(T.noCommits) }

      const lines = [t(T.heading)]
      if (subjects.length === 0) lines.push(t(T.noCommits))
      else for (const s of subjects.slice(0, 40)) lines.push(`• ${s}`)
      if (stat !== '') lines.push('', stat)
      return { text: lines.join('\n') }
    })
}
