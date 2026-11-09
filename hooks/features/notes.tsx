import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { Feature, Input } from '../core'
import { emptyState, paneHeader } from '../ui'

const T = {
  title: { en: 'Notes', he: 'הערות', es: 'Notas', fr: 'Notes', ru: 'Заметки', zh: '笔记', ja: 'ノート', pt: 'Notas', de: 'Notizen', ko: '노트' },
  description: { en: 'A notepad per folder, kept across sessions (/notes).', he: 'פנקס הערות לכל תיקייה, נשמר בין סשנים (/notes).', es: 'Un bloc de notas por carpeta, conservado entre sesiones (/notes).', fr: 'Un bloc-notes par dossier, conservé entre les sessions (/notes).', ru: 'Блокнот для каждой папки, сохраняется между сессиями (/notes).', zh: '每个文件夹一个记事本，跨会话保留（/notes）。', ja: 'フォルダごとのメモ帳。セッションをまたいで保持されます（/notes）。', pt: 'Um bloco de notas por pasta, mantido entre sessões (/notes).', de: 'Ein Notizblock pro Ordner, über Sitzungen hinweg gespeichert (/notes).', ko: '폴더마다 메모장 하나, 세션이 바뀌어도 유지됩니다 (/notes).' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty パネルでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; im /toolkitty-Panel einschalten', ko: '기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요' },
  cmdDesc: { en: 'Opens a notepad for the current folder', he: 'פותח פנקס הערות לתיקייה הנוכחית', es: 'Abre un bloc de notas para la carpeta actual', fr: 'Ouvre un bloc-notes pour le dossier courant', ru: 'Открывает блокнот для текущей папки', zh: '打开当前文件夹的记事本', ja: '現在のフォルダのメモ帳を開きます', pt: 'Abre um bloco de notas para a pasta atual', de: 'Öffnet einen Notizblock für den aktuellen Ordner', ko: '현재 폴더의 메모장을 엽니다' },
  paneTitle: { en: 'Notes', he: 'הערות', es: 'Notas', fr: 'Notes', ru: 'Заметки', zh: '笔记', ja: 'ノート', pt: 'Notas', de: 'Notizen', ko: '노트' },
  opened: { en: 'The notepad is open.', he: 'פנקס ההערות נפתח.', es: 'El bloc de notas está abierto.', fr: 'Le bloc-notes est ouvert.', ru: 'Блокнот открыт.', zh: '记事本已打开。', ja: 'メモ帳を開きました。', pt: 'O bloco de notas está aberto.', de: 'Der Notizblock ist geöffnet.', ko: '메모장이 열렸습니다.' },
  noMobile: { en: 'The notepad is not available on mobile.', he: 'פנקס ההערות אינו זמין בנייד.', es: 'El bloc de notas no está disponible en móvil.', fr: 'Le bloc-notes n\'est pas disponible sur mobile.', ru: 'Блокнот недоступен на мобильных устройствах.', zh: '移动端无法使用记事本。', ja: 'モバイルではメモ帳を利用できません。', pt: 'O bloco de notas não está disponível no celular.', de: 'Der Notizblock ist auf Mobilgeräten nicht verfügbar.', ko: '모바일에서는 메모장을 사용할 수 없습니다.' },
  offPane: { en: 'The feature is off in the switchboard.', he: 'השכלול כבוי בלוח המתגים.', es: 'La función está desactivada en el panel de interruptores.', fr: 'La fonctionnalité est désactivée dans le tableau des commutateurs.', ru: 'Функция отключена в панели переключателей.', zh: '该功能在开关面板中已关闭。', ja: 'この機能はスイッチボードでオフになっています。', pt: 'O recurso está desativado no painel de controle.', de: 'Die Funktion ist im Schaltpult ausgeschaltet.', ko: '이 기능은 스위치보드에서 꺼져 있습니다.' },
  placeholder: { en: 'New note…', he: 'הערה חדשה…', es: 'Nueva nota…', fr: 'Nouvelle note…', ru: 'Новая заметка…', zh: '新笔记…', ja: '新しいノート…', pt: 'Nova nota…', de: 'Neue Notiz…', ko: '새 노트…' },
  status: { en: '{n} notes', he: '{n} הערות', es: '{n} notas', fr: '{n} notes', ru: 'заметок: {n}', zh: '{n} 条笔记', ja: 'ノート {n} 件', pt: '{n} notas', de: '{n} Notizen', ko: '노트 {n}개' },
  noneHint: { en: 'Type a note above and press Enter; notes are kept per folder across sessions.', he: 'כתבו הערה למעלה ולחצו Enter; ההערות נשמרות לכל תיקייה בין סשנים.', es: 'Escribe una nota arriba y pulsa Enter; las notas se guardan por carpeta entre sesiones.', fr: 'Saisissez une note ci-dessus et appuyez sur Entrée ; les notes sont conservées par dossier entre les sessions.', ru: 'Введите заметку выше и нажмите Enter; заметки хранятся для каждой папки между сессиями.', zh: '在上方输入笔记并按 Enter；笔记按文件夹保存，跨会话保留。', ja: '上にノートを入力して Enter を押してください。ノートはフォルダごとに保存され、セッションをまたいで保持されます。', pt: 'Digite uma nota acima e pressione Enter; as notas são mantidas por pasta entre sessões.', de: 'Tippe oben eine Notiz ein und drücke Enter; Notizen werden pro Ordner über Sitzungen hinweg gespeichert.', ko: '위에 노트를 입력하고 Enter를 누르세요. 노트는 폴더별로 저장되어 세션이 바뀌어도 유지됩니다.' },
  none: { en: 'No notes in this folder.', he: 'אין הערות בתיקייה הזו.', es: 'No hay notas en esta carpeta.', fr: 'Aucune note dans ce dossier.', ru: 'В этой папке нет заметок.', zh: '此文件夹中没有笔记。', ja: 'このフォルダにはノートがありません。', pt: 'Nenhuma nota nesta pasta.', de: 'Keine Notizen in diesem Ordner.', ko: '이 폴더에 노트가 없습니다.' },
  more: { en: '... and {n} more older notes', he: '... ועוד {n} הערות ישנות', es: '... y {n} notas más antiguas', fr: '... et {n} notes plus anciennes', ru: '... и ещё {n} старых заметок', zh: '……以及另外 {n} 条较早的笔记', ja: '…ほか古いノート {n} 件', pt: '... e mais {n} notas mais antigas', de: '... und {n} weitere ältere Notizen', ko: '... 그 외 이전 노트 {n}개' },
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

type Note = { id: number; text: string }
type Notes = { cwd: string; notes: Note[] }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'notes' } as const, { cwd: '', notes: [] }) as unknown as Atom<Notes>

const MAX_NOTES = 50

const keyOf = (cwd: string): string => `notes:${cwd}`

export const feature: Feature = {
  id: 'notes',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'notes', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'notes', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  return
}

export function register(on: On) {
    on('command.run', { command: 'notes' }, async $ => {
      if (!(await isOn($, feature))) return { text: t(T.off) }

      const cwd = await $.session.cwd()
      const notes = await storeGet<Note[]>($, keyOf(cwd), [])
      await update($, state, () => ({ cwd, notes }))
      await $.ui.open({ id: 'notes', title: t(T.paneTitle) })
      return { text: t(T.opened) }
    })

    on('ui.render', { component: 'Pane', requestId: 'notes' }, async ($, e) => {
      if (e.surface === 'mobile') {
        const { Text } = $.ui.resolve(e)
        return <Text dimColor>{t(T.noMobile)}</Text>
      }
      const { Box, Button, Input, Text } = $.ui.resolve(e)
      if (!(await isOn($, feature))) return <Text dimColor>{t(T.offPane)}</Text>

      const { cwd, notes } = await read($, state)

      const save = async (list: Note[]) => {
        await update($, state, s => ({ ...s, notes: list }))
        await storeSet($, keyOf(cwd), list)
      }

      const add = async (value: string) => {
        const text = value.trim()
        if (text === '' || cwd === '') return
        const current = (await read($, state)).notes
        const id = current.reduce((m, n) => Math.max(m, n.id), 0) + 1
        await save([...current, { id, text }].slice(-MAX_NOTES))
      }

      const remove = async (id: number) => {
        const current = (await read($, state)).notes
        await save(current.filter(n => n.id !== id))
      }

      const room = Math.max(3, (e.viewport?.rows ?? 25) - 5)
      const shown = [...notes].reverse().slice(0, room)

      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), status: t(T.status, { n: notes.length }) })}
          <Input key="note-input" placeholder={t(T.placeholder)} onSubmit={value => add(value)} />
          {notes.length === 0 ? emptyState($, e, t(T.none), t(T.noneHint)) : null}
          {shown.map(n => (
            <Box key={`note-${n.id}`} gap={1}>
              <Button key={`del-${n.id}`} label="✕" plain onPress={() => remove(n.id)} />
              <Text>{n.text}</Text>
            </Box>
          ))}
          {notes.length > room ? <Text dimColor>{t(T.more, { n: notes.length - room })}</Text> : null}
        </Box>
      )
    })
}
