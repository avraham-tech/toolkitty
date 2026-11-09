import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { Feature, Input, Output } from '../core'

const T = {
  title: {
    en: 'Memory across sessions',
    he: 'זיכרון בין סשנים',
    es: 'Memoria entre sesiones',
    fr: 'Mémoire entre sessions',
    ru: 'Память между сессиями',
    zh: '跨会话记忆',
    ja: 'セッションをまたぐメモリ',
    pt: 'Memória entre sessões',
    de: 'Gedächtnis über Sitzungen',
    ko: '세션 간 기억',
  },
  description: {
    en: 'Remembers prompts and notes (/remember) per folder and reminds the model of them in later sessions.',
    he: 'זוכר הודעות והערות (/remember) לכל תיקייה ומזכיר אותן למודל בסשנים הבאים.',
    es: 'Recuerda mensajes y notas (/remember) por carpeta y se los recuerda al modelo en sesiones posteriores.',
    fr: 'Mémorise les messages et notes (/remember) par dossier et les rappelle au modèle lors des sessions suivantes.',
    ru: 'Запоминает сообщения и заметки (/remember) для каждой папки и напоминает о них модели в следующих сессиях.',
    zh: '按文件夹记住提示词和笔记（/remember），并在之后的会话中提醒模型。',
    ja: 'プロンプトとメモ（/remember）をフォルダごとに記憶し、後のセッションでモデルに思い出させます。',
    pt: 'Lembra prompts e notas (/remember) por pasta e lembra o modelo deles em sessões futuras.',
    de: 'Merkt sich Prompts und Notizen (/remember) pro Ordner und erinnert das Modell in späteren Sitzungen daran.',
    ko: '프롬프트와 메모(/remember)를 폴더별로 기억해 이후 세션에서 모델에게 알려 줍니다.',
  },
  off: {
    en: 'This feature is off; turn it on in the /toolkitty panel',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'Esta función está desactivada; actívala en el panel /toolkitty',
    fr: 'Cette fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty',
    ru: 'Функция выключена; включите её на панели /toolkitty',
    zh: '此功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty パネルでオンにしてください',
    pt: 'Este recurso está desativado; ative-o no painel /toolkitty',
    de: 'Diese Funktion ist aus; im /toolkitty-Panel einschalten',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요',
  },
  commandDesc: {
    en: 'Saves a free-form note shown to the model in later sessions in this folder',
    he: 'שומר הערה חופשית שתוצג למודל בסשנים הבאים בתיקייה הזו',
    es: 'Guarda una nota libre que se mostrará al modelo en sesiones posteriores en esta carpeta',
    fr: 'Enregistre une note libre montrée au modèle lors des prochaines sessions dans ce dossier',
    ru: 'Сохраняет заметку, которую увидит модель в следующих сессиях в этой папке',
    zh: '保存一条自由格式的笔记，在此文件夹的后续会话中展示给模型',
    ja: 'このフォルダの後のセッションでモデルに表示される自由形式のメモを保存します',
    pt: 'Salva uma nota livre mostrada ao modelo em sessões futuras nesta pasta',
    de: 'Speichert eine freie Notiz, die dem Modell in späteren Sitzungen in diesem Ordner gezeigt wird',
    ko: '이 폴더의 이후 세션에서 모델에게 보여 줄 자유 형식 메모를 저장합니다',
  },
  usage: {
    en: 'Usage: /remember <note>',
    he: 'שימוש: /remember <הערה>',
    es: 'Uso: /remember <nota>',
    fr: 'Utilisation : /remember <note>',
    ru: 'Использование: /remember <заметка>',
    zh: '用法：/remember <笔记>',
    ja: '使い方：/remember <メモ>',
    pt: 'Uso: /remember <nota>',
    de: 'Verwendung: /remember <Notiz>',
    ko: '사용법: /remember <메모>',
  },
  savedOne: {
    en: 'Saved (1 note in this folder).',
    he: 'נשמרה הערה אחת בתיקייה הזו.',
    es: 'Guardado (1 nota en esta carpeta).',
    fr: 'Enregistré (1 note dans ce dossier).',
    ru: 'Сохранено (заметок в этой папке: 1).',
    zh: '已保存（此文件夹中有 1 条笔记）。',
    ja: '保存しました（このフォルダにメモ 1 件）。',
    pt: 'Salvo (1 nota nesta pasta).',
    de: 'Gespeichert (1 Notiz in diesem Ordner).',
    ko: '저장했습니다 (이 폴더에 메모 1개).',
  },
  saved: {
    en: 'Saved ({n} notes in this folder).',
    he: 'נשמר ({n} הערות בתיקייה הזו).',
    es: 'Guardado ({n} notas en esta carpeta).',
    fr: 'Enregistré ({n} notes dans ce dossier).',
    ru: 'Сохранено (заметок в этой папке: {n}).',
    zh: '已保存（此文件夹中有 {n} 条笔记）。',
    ja: '保存しました（このフォルダにメモ {n} 件）。',
    pt: 'Salvo ({n} notas nesta pasta).',
    de: 'Gespeichert ({n} Notizen in diesem Ordner).',
    ko: '저장했습니다 (이 폴더에 메모 {n}개).',
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

type Entry = { at: number; text: string }
type Memory = { cwd: string; startIndex: number; notes: Entry[]; prompts: Entry[] }

const memory = atom({ plugin: 'toolkitty', key: 'slot', id: 'session-memory' } as const, { cwd: '', startIndex: 0, notes: [], prompts: [] }) as unknown as Atom<Memory>

const COMMAND = 'remember'
const SECTION_ID = 'toolkitty:session-memory'
const KEEP = 30
const SHOW_PROMPTS = 10
const MAX_PROMPT = 200
const MAX_NOTE = 400

const promptsKey = (cwd: string) => `session-memory:${cwd}`
const notesKey = (cwd: string) => `session-memory:notes:${cwd}`

export const feature: Feature = {
  id: 'session-memory',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: COMMAND, description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'remember', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }

  const cwd = await $.session.cwd()
  const prompts = await storeGet<Entry[]>($, promptsKey(cwd), [])
  const notes = await storeGet<Entry[]>($, notesKey(cwd), [])
  await update($, memory, () => ({ cwd, startIndex: prompts.length, notes, prompts }))
  $.ui.invalidate('prompt.section')
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const text = e.text.trim()
  if (text !== '') {
    const cur = await read($, memory)
    if (cur.cwd !== '') {
      const entry: Entry = { at: await $.clock.now(), text: text.slice(0, MAX_PROMPT) }
      const stored = await storeGet<Entry[]>($, promptsKey(cur.cwd), [])
      const all = [...stored, entry]
      const dropped = Math.max(0, all.length - KEEP)
      const kept = all.slice(dropped)
      await storeSet($, promptsKey(cur.cwd), kept)
      await update($, memory, m => ({ ...m, prompts: kept, startIndex: Math.max(0, m.startIndex - dropped) }))
    }
  }
}

type PC = Output<'prompt.compose'>
export async function onPromptCompose($: EngineInterface, e: Input<'prompt.compose'>, result: PC): Promise<PC> {
  if (!(await isOn($, feature))) return result

  const m = await read($, memory)
  const previous = m.prompts.slice(0, m.startIndex).slice(-SHOW_PROMPTS)
  if (m.notes.length === 0 && previous.length === 0) return result

  const lines = ['# Earlier work in this folder']
  if (m.notes.length > 0) lines.push('Notes the user asked to remember:', ...m.notes.map(n => `- ${n.text}`))
  if (previous.length > 0) {
    lines.push('Recent prompts from previous sessions (oldest first):', ...previous.map(p => `- ${p.text}`))
  }
  const text = lines.join('\n').slice(0, 3900)

  return {
    ...result,
    sections: [
      ...result.sections.filter(s => s.id !== SECTION_ID),
      { id: SECTION_ID, text, scope: 'session' as const },
    ],
  }
}

export function register(on: On) {
    on('command.run', { command: COMMAND }, async ($, e) => {
      if (!(await isOn($, feature))) return { text: t(T.off) }

      const note = e.args.trim()
      if (note === '') return { text: t(T.usage) }

      const cur = await read($, memory)
      const cwd = cur.cwd !== '' ? cur.cwd : await $.session.cwd()
      const stored = await storeGet<Entry[]>($, notesKey(cwd), [])
      const notes = [...stored, { at: await $.clock.now(), text: note.slice(0, MAX_NOTE) }].slice(-KEEP)
      await storeSet($, notesKey(cwd), notes)
      await update($, memory, m => ({ ...m, notes }))
      $.ui.invalidate('prompt.section')
      return { text: notes.length === 1 ? t(T.savedOne) : t(T.saved, { n: notes.length }) }
    })
}
