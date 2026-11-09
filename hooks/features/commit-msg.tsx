import { isOn, notice, t } from '../core'
import type { EngineInterface, On } from 'claude-code'
import type { Feature, Input } from '../core'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Commit message', he: 'הודעת קומיט', es: 'Mensaje de commit', fr: 'Message de commit', ru: 'Сообщение коммита', zh: '提交信息', ja: 'コミットメッセージ', pt: 'Mensagem de commit', de: 'Commit-Nachricht', ko: '커밋 메시지' },
  description: { en: '/commitmsg: suggests a commit message from the staged changes and puts it in the prompt box.', he: '/commitmsg: מציע הודעת קומיט מהשינויים שב-stage ומכניס אותה לתיבת הכתיבה.', es: '/commitmsg: sugiere un mensaje de commit a partir de los cambios en stage y lo coloca en el cuadro de texto.', fr: '/commitmsg : propose un message de commit à partir des changements du stage et le place dans la zone de saisie.', ru: '/commitmsg: предлагает сообщение коммита по проиндексированным изменениям и вставляет его в поле ввода.', zh: '/commitmsg：根据已暂存的更改建议提交信息，并放入输入框。', ja: '/commitmsg: ステージ済みの変更からコミットメッセージを提案し、プロンプト欄に入れます。', pt: '/commitmsg: sugere uma mensagem de commit a partir das alterações em stage e a coloca na caixa de prompt.', de: '/commitmsg: schlägt aus den gestageten Änderungen eine Commit-Nachricht vor und legt sie ins Eingabefeld.', ko: '/commitmsg: 스테이징된 변경 사항으로 커밋 메시지를 제안해 입력창에 넣습니다.' },
  cmdDesc: { en: 'Drafts a commit message from the staged changes and puts a git commit command in the prompt box', he: 'מנסח הודעת קומיט מהשינויים שב-stage ומכניס פקודת git commit לתיבה', es: 'Redacta un mensaje de commit a partir de los cambios en stage y coloca un comando git commit en el cuadro de texto', fr: 'Rédige un message de commit à partir des changements du stage et place une commande git commit dans la zone de saisie', ru: 'Составляет сообщение коммита по проиндексированным изменениям и вставляет команду git commit в поле ввода', zh: '根据已暂存的更改起草提交信息，并把 git commit 命令放入输入框', ja: 'ステージ済みの変更からコミットメッセージを下書きし、git commit コマンドをプロンプト欄に入れます', pt: 'Redige uma mensagem de commit a partir das alterações em stage e coloca um comando git commit na caixa de prompt', de: 'Entwirft aus den gestageten Änderungen eine Commit-Nachricht und legt einen git-commit-Befehl ins Eingabefeld', ko: '스테이징된 변경 사항으로 커밋 메시지 초안을 만들고 git commit 명령을 입력창에 넣습니다' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция выключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  noGit: { en: 'Cannot run git here (no repository?).', he: 'לא ניתן להריץ git כאן (אין מאגר?).', es: 'No se puede ejecutar git aquí (¿no hay repositorio?).', fr: 'Impossible d\'exécuter git ici (pas de dépôt ?).', ru: 'Не удаётся запустить git здесь (нет репозитория?).', zh: '无法在此运行 git（没有仓库？）。', ja: 'ここでは git を実行できません（リポジトリがない？）。', pt: 'Não é possível executar o git aqui (sem repositório?).', de: 'git kann hier nicht ausgeführt werden (kein Repository?).', ko: '여기서는 git을 실행할 수 없습니다(저장소가 없나요?).' },
  noStaged: { en: 'No staged changes', he: 'אין שינויים ב-stage', es: 'No hay cambios en stage', fr: 'Aucun changement dans le stage', ru: 'Нет проиндексированных изменений', zh: '没有已暂存的更改', ja: 'ステージ済みの変更はありません', pt: 'Nenhuma alteração em stage', de: 'Keine gestageten Änderungen', ko: '스테이징된 변경 사항 없음' },
  noReply: { en: 'No message received from the model ({reason}).', he: 'לא התקבלה הודעה מהמודל ({reason}).', es: 'No se recibió ningún mensaje del modelo ({reason}).', fr: 'Aucun message reçu du modèle ({reason}).', ru: 'Модель не вернула сообщение ({reason}).', zh: '未收到模型的消息（{reason}）。', ja: 'モデルからメッセージを受け取れませんでした（{reason}）。', pt: 'Nenhuma mensagem recebida do modelo ({reason}).', de: 'Keine Nachricht vom Modell erhalten ({reason}).', ko: '모델로부터 메시지를 받지 못했습니다({reason}).' },
  emptyReply: { en: 'The model returned an empty message.', he: 'המודל החזיר הודעה ריקה.', es: 'El modelo devolvió un mensaje vacío.', fr: 'Le modèle a renvoyé un message vide.', ru: 'Модель вернула пустое сообщение.', zh: '模型返回了空消息。', ja: 'モデルが空のメッセージを返しました。', pt: 'O modelo retornou uma mensagem vazia.', de: 'Das Modell hat eine leere Nachricht zurückgegeben.', ko: '모델이 빈 메시지를 반환했습니다.' },
  filled: { en: 'The message was put in the prompt box; review and send:\n{subject}', he: 'ההודעה הוכנסה לתיבה; בדוק ושלח:\n{subject}', es: 'El mensaje se colocó en el cuadro de texto; revísalo y envíalo:\n{subject}', fr: 'Le message a été placé dans la zone de saisie ; vérifie et envoie :\n{subject}', ru: 'Сообщение вставлено в поле ввода; проверьте и отправьте:\n{subject}', zh: '消息已放入输入框；请检查后发送：\n{subject}', ja: 'メッセージをプロンプト欄に入れました。確認して送信してください：\n{subject}', pt: 'A mensagem foi colocada na caixa de prompt; revise e envie:\n{subject}', de: 'Die Nachricht liegt im Eingabefeld; prüfen und senden:\n{subject}', ko: '메시지를 입력창에 넣었습니다. 확인한 뒤 보내세요:\n{subject}' },
  notFilled: { en: 'Could not fill the prompt box; the suggested command:\n{cmd}', he: 'לא ניתן למלא את התיבה; הפקודה המוצעת:\n{cmd}', es: 'No se pudo rellenar el cuadro de texto; el comando sugerido:\n{cmd}', fr: 'Impossible de remplir la zone de saisie ; la commande proposée :\n{cmd}', ru: 'Не удалось заполнить поле ввода; предлагаемая команда:\n{cmd}', zh: '无法填入输入框；建议的命令：\n{cmd}', ja: 'プロンプト欄に入れられませんでした。提案されたコマンド：\n{cmd}', pt: 'Não foi possível preencher a caixa de prompt; o comando sugerido:\n{cmd}', de: 'Das Eingabefeld konnte nicht gefüllt werden; der vorgeschlagene Befehl:\n{cmd}', ko: '입력창을 채우지 못했습니다. 제안된 명령:\n{cmd}' },
} as const

const OFF_TEXT = T.off
const MAX_DIFF = 12000

const shellQuote = (s: string): string => `"${s.replace(/(["\\$`])/g, '\\$1')}"`

export const feature: Feature = {
  id: 'commit-msg',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({
      name: 'commitmsg',
      description: t(T.cmdDesc),
    })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'commitmsg', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export function register(on: On) {
    on('command.run', { command: 'commitmsg' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(OFF_TEXT) }

      const cwd = await $.session.cwd()
      const run = async (argv: string[]) => {
        try {
          return await $.process.run(argv, { cwd, timeoutMs: 20000 })
        } catch {
          return null
        }
      }

      const stat = await run(['git', 'diff', '--cached', '--stat'])
      if (stat === null || stat.exitCode !== 0) return { text: t(T.noGit) }
      if (stat.stdout.trim() === '') return { text: t(T.noStaged) }

      const diff = await run(['git', 'diff', '--cached'])
      const full = diff !== null && diff.exitCode === 0 ? diff.stdout : ''
      const body = full.length > MAX_DIFF ? `${full.slice(0, MAX_DIFF)}\n...[diff truncated]` : full

      const prompt = [
        'Write a git commit message for the staged changes below, in Conventional Commits style.',
        'Format: first line "<type>(<optional scope>): <subject>" under 72 characters, imperative mood, no trailing period;',
        'then a blank line and a short body (1-4 lines) explaining what and why.',
        'Output ONLY the message, no code fences, no commentary.',
        '',
        '--- git diff --cached --stat ---',
        stat.stdout.trim(),
        '',
        '--- git diff --cached ---',
        body,
      ].join('\n')

      const r = await $.model.complete({ model: 'claude-haiku-5-5', prompt })
      if (!r.isAnswered) return { text: t(T.noReply, { reason: r.reason }) }

      const cleaned = r.text
        .trim()
        .replace(/^```[a-z]*\n?/i, '')
        .replace(/\n?```$/, '')
        .trim()
      const [first = '', ...rest] = cleaned.split(/\r?\n/)
      const subject = first.trim().slice(0, 100)
      const details = rest.join('\n').trim()
      if (subject === '') return { text: t(T.emptyReply) }

      const cmd =
        details === ''
          ? `git commit -m ${shellQuote(subject)}`
          : `git commit -m ${shellQuote(subject)} -m ${shellQuote(details)}`
      const filled = await $.prompt.fill({ text: cmd, mode: 'replace' })

      return {
        text: filled.isFilled
          ? t(T.filled, { subject })
          : t(T.notFilled, { cmd }),
      }
    })
}
