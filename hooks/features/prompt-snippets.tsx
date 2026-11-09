import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { EngineInterface, On } from 'claude-code'
import type { Feature, Input } from '../core'

const T = {
  title: { en: 'Prompt snippets', he: 'קיצורי פרומפט', es: 'Atajos de prompt', fr: 'Raccourcis de prompt', ru: 'Шаблоны промптов', zh: '提示词片段', ja: 'プロンプトスニペット', pt: 'Snippets de prompt', de: 'Prompt-Bausteine', ko: '프롬프트 스니펫' },
  description: { en: 'Type !fix or !review at the start of a message and it expands into a full prompt; /snippet manages them.', he: 'כותבים !fix או !review בתחילת הודעה והיא מורחבת לפרומפט מלא; /snippet לניהול.', es: 'Escribe !fix o !review al inicio de un mensaje y se expande a un prompt completo; /snippet los gestiona.', fr: 'Tape !fix ou !review au début d’un message et il est développé en prompt complet ; /snippet les gère.', ru: 'Введите !fix или !review в начале сообщения, и оно развернётся в полный промпт; /snippet для управления.', zh: '在消息开头输入 !fix 或 !review，就会展开成完整的提示词；用 /snippet 管理。', ja: 'メッセージの先頭に !fix や !review と入力すると完全なプロンプトに展開されます。/snippet で管理します。', pt: 'Digite !fix ou !review no início de uma mensagem e ela se expande em um prompt completo; /snippet gerencia os snippets.', de: 'Tippe !fix oder !review am Anfang einer Nachricht, dann wird sie zu einem vollständigen Prompt; /snippet verwaltet sie.', ko: '메시지 맨 앞에 !fix나 !review를 입력하면 완전한 프롬프트로 확장됩니다. /snippet으로 관리합니다.' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  cmdDesc: { en: 'Manage prompt snippets: add <name> <text> | list | remove <name>', he: 'ניהול קיצורי פרומפט: add <שם> <טקסט> | list | remove <שם>', es: 'Gestiona atajos de prompt: add <nombre> <texto> | list | remove <nombre>', fr: 'Gère les raccourcis de prompt : add <nom> <texte> | list | remove <nom>', ru: 'Управление шаблонами промптов: add <имя> <текст> | list | remove <имя>', zh: '管理提示词片段：add <名称> <文本> | list | remove <名称>', ja: 'プロンプトスニペットを管理：add <名前> <テキスト> | list | remove <名前>', pt: 'Gerencia snippets de prompt: add <nome> <texto> | list | remove <nome>', de: 'Verwaltet Prompt-Bausteine: add <Name> <Text> | list | remove <Name>', ko: '프롬프트 스니펫 관리: add <이름> <텍스트> | list | remove <이름>' },
  builtinHead: { en: 'Built-in snippets:', he: 'קיצורים מובנים:', es: 'Atajos integrados:', fr: 'Raccourcis intégrés :', ru: 'Встроенные шаблоны:', zh: '内置片段：', ja: '組み込みスニペット：', pt: 'Snippets embutidos:', de: 'Eingebaute Bausteine:', ko: '기본 스니펫:' },
  noCustom: { en: 'No custom snippets.', he: 'אין קיצורים מותאמים אישית.', es: 'No hay atajos personalizados.', fr: 'Aucun raccourci personnalisé.', ru: 'Нет пользовательских шаблонов.', zh: '没有自定义片段。', ja: 'カスタムスニペットはありません。', pt: 'Nenhum snippet personalizado.', de: 'Keine eigenen Bausteine.', ko: '사용자 스니펫이 없습니다.' },
  customHead: { en: 'Custom snippets:', he: 'קיצורים מותאמים אישית:', es: 'Atajos personalizados:', fr: 'Raccourcis personnalisés :', ru: 'Пользовательские шаблоны:', zh: '自定义片段：', ja: 'カスタムスニペット：', pt: 'Snippets personalizados:', de: 'Eigene Bausteine:', ko: '사용자 스니펫:' },
  usage: { en: 'Usage: /snippet add <name> <text> | list | remove <name>', he: 'שימוש: /snippet add <שם> <טקסט> | list | remove <שם>', es: 'Uso: /snippet add <nombre> <texto> | list | remove <nombre>', fr: 'Utilisation : /snippet add <nom> <texte> | list | remove <nom>', ru: 'Использование: /snippet add <имя> <текст> | list | remove <имя>', zh: '用法：/snippet add <名称> <文本> | list | remove <名称>', ja: '使い方：/snippet add <名前> <テキスト> | list | remove <名前>', pt: 'Uso: /snippet add <nome> <texto> | list | remove <nome>', de: 'Verwendung: /snippet add <Name> <Text> | list | remove <Name>', ko: '사용법: /snippet add <이름> <텍스트> | list | remove <이름>' },
  usageAdd: { en: 'Usage: /snippet add <name> <text>', he: 'שימוש: /snippet add <שם> <טקסט>', es: 'Uso: /snippet add <nombre> <texto>', fr: 'Utilisation : /snippet add <nom> <texte>', ru: 'Использование: /snippet add <имя> <текст>', zh: '用法：/snippet add <名称> <文本>', ja: '使い方：/snippet add <名前> <テキスト>', pt: 'Uso: /snippet add <nome> <texto>', de: 'Verwendung: /snippet add <Name> <Text>', ko: '사용법: /snippet add <이름> <텍스트>' },
  limit: { en: 'You have reached the limit of {n} snippets; delete one first.', he: 'הגעת למגבלה של {n} קיצורים; מחק אחד קודם.', es: 'Has alcanzado el límite de {n} atajos; borra uno primero.', fr: 'Tu as atteint la limite de {n} raccourcis ; supprimes-en un d’abord.', ru: 'Достигнут лимит в {n} шаблонов; сначала удалите один.', zh: '已达到 {n} 个片段的上限；请先删除一个。', ja: 'スニペットの上限 {n} 件に達しました。先に 1 件削除してください。', pt: 'Você atingiu o limite de {n} snippets; exclua um primeiro.', de: 'Das Limit von {n} Bausteinen ist erreicht; lösche zuerst einen.', ko: '스니펫 한도 {n}개에 도달했습니다. 먼저 하나를 삭제하세요.' },
  saved: { en: 'Snippet !{name} saved.', he: 'הקיצור !{name} נשמר.', es: 'El atajo !{name} se guardó.', fr: 'Le raccourci !{name} a été enregistré.', ru: 'Шаблон !{name} сохранён.', zh: '片段 !{name} 已保存。', ja: 'スニペット !{name} を保存しました。', pt: 'Snippet !{name} salvo.', de: 'Baustein !{name} gespeichert.', ko: '스니펫 !{name}을(를) 저장했습니다.' },
  noSnippet: { en: 'There is no snippet named !{name}.', he: 'אין קיצור בשם !{name}.', es: 'No existe un atajo llamado !{name}.', fr: 'Il n\'y a pas de raccourci nommé !{name}.', ru: 'Шаблона с именем !{name} нет.', zh: '没有名为 !{name} 的片段。', ja: '!{name} という名前のスニペットはありません。', pt: 'Não há nenhum snippet chamado !{name}.', de: 'Es gibt keinen Baustein namens !{name}.', ko: '!{name}이라는 스니펫이 없습니다.' },
  cantRemoveBuiltin: { en: 'A built-in snippet cannot be deleted.', he: 'אי אפשר למחוק קיצור מובנה.', es: 'No se puede borrar un atajo integrado.', fr: 'Impossible de supprimer un raccourci intégré.', ru: 'Встроенный шаблон нельзя удалить.', zh: '内置片段无法删除。', ja: '組み込みスニペットは削除できません。', pt: 'Um snippet embutido não pode ser excluído.', de: 'Ein eingebauter Baustein kann nicht gelöscht werden.', ko: '기본 스니펫은 삭제할 수 없습니다.' },
  deleted: { en: 'Snippet !{name} deleted.', he: 'הקיצור !{name} נמחק.', es: 'El atajo !{name} se borró.', fr: 'Le raccourci !{name} a été supprimé.', ru: 'Шаблон !{name} удалён.', zh: '片段 !{name} 已删除。', ja: 'スニペット !{name} を削除しました。', pt: 'Snippet !{name} excluído.', de: 'Baustein !{name} gelöscht.', ko: '스니펫 !{name}을(를) 삭제했습니다.' },
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

const COMMAND = 'snippet'
const KEY = 'prompt-snippets:custom'
const MAX_SNIPPETS = 50
const MAX_TEXT = 2000

const BUILTIN: Record<string, string> = {
  fix: 'Find the root cause of the following problem and fix it with the smallest correct change; run the relevant tests after:',
  review:
    'Review the current diff for bugs, missing edge cases and security problems; list findings by severity before changing anything:',
  test: 'Write tests for the following, covering the happy path and the edge cases, then run them:',
  explain: 'Explain the following in simple terms, with a short example:',
  refactor: 'Refactor the following without changing behaviour; keep the diff small and run the tests:',
}

const normalizeName = (raw: string): string => raw.trim().replace(/^!/, '').toLowerCase()

export const feature: Feature = {
  id: 'prompt-snippets',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({
      name: COMMAND,
      description: t(T.cmdDesc),
      argumentHint: 'add|list|remove',
    })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'snippet', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  return
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'>> {
  if (e.command !== undefined || !(await isOn($, feature))) return e

  const match = /^\s*!([\w֐-׿-]+)(?:\s+([\s\S]*))?$/.exec(e.text)
  if (match === null) return e

  const name = (match[1] ?? '').toLowerCase()
  const custom = await storeGet<Record<string, string>>($, KEY, {})
  const expansion = custom[name] ?? BUILTIN[name]
  if (expansion === undefined) return e

  const rest = (match[2] ?? '').trim()
  return { ...e, text: rest === '' ? expansion : `${expansion} ${rest}` }
}

export function register(on: On) {
    on('command.run', { command: COMMAND }, async ($, e) => {
      if (!(await isOn($, feature))) return { text: t(T.off) }

      const args = e.args.trim()
      const [sub = '', ...restParts] = args.split(/\s+/)
      const custom = await storeGet<Record<string, string>>($, KEY, {})

      if (sub === 'list' || sub === '') {
        const lines = [t(T.builtinHead)]
        for (const [k, v] of Object.entries(BUILTIN)) lines.push(`• !${k} — ${v}`)
        const names = Object.keys(custom)
        lines.push('', names.length === 0 ? t(T.noCustom) : t(T.customHead))
        for (const k of names) lines.push(`• !${k} — ${custom[k] ?? ''}`)
        if (sub === '') lines.push('', t(T.usage))
        return { text: lines.join('\n') }
      }

      if (sub === 'add') {
        const name = normalizeName(restParts[0] ?? '')
        const afterName = args.replace(/^add\s+\S+\s*/, '').trim()
        if (!/^[\w֐-׿-]+$/.test(name) || afterName === '') {
          return { text: t(T.usageAdd) }
        }
        if (custom[name] === undefined && Object.keys(custom).length >= MAX_SNIPPETS) {
          return { text: t(T.limit, { n: MAX_SNIPPETS }) }
        }
        await storeSet($, KEY, { ...custom, [name]: afterName.slice(0, MAX_TEXT) })
        return { text: t(T.saved, { name }) }
      }

      if (sub === 'remove') {
        const name = normalizeName(restParts[0] ?? '')
        if (custom[name] === undefined) {
          return { text: BUILTIN[name] === undefined ? t(T.noSnippet, { name }) : t(T.cantRemoveBuiltin) }
        }
        const updated: Record<string, string> = { ...custom }
        delete updated[name]
        await storeSet($, KEY, updated)
        return { text: t(T.deleted, { name }) }
      }

      return { text: t(T.usage) }
    })
}
