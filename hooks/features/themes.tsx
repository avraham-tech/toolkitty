import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input } from '../core'
import { ICONS, paneHeader } from '../ui'
import { BUILTIN_THEMES, parseTheme } from '../themes'
import type { Theme } from '../themes'

const T = {
  title: { en: 'Theme packs', he: 'חבילות עיצוב', es: 'Paquetes de temas', fr: 'Packs de thèmes', ru: 'Наборы тем', zh: '主题包', ja: 'テーマパック', pt: 'Pacotes de temas', de: 'Themenpakete', ko: '테마 팩' },
  description: {
    en: 'Colors for the aurora backdrop, the turn receipt and the buddy. Four built-in themes (/themes); add your own as JSON in ~/.claude/toolkitty-themes/.',
    he: 'צבעים לרקע האורורה, לקבלת התור ולחבר. ארבע ערכות מובנות (/themes); הוסף משלך כקובץ JSON ב-~/.claude/toolkitty-themes/.',
    es: 'Colores para el fondo aurora, el recibo del turno y el compañero. Cuatro temas incluidos (/themes); añade los tuyos como JSON en ~/.claude/toolkitty-themes/.',
    fr: 'Couleurs du fond aurore, du reçu du tour et du compagnon. Quatre thèmes intégrés (/themes) ; ajoute les tiens en JSON dans ~/.claude/toolkitty-themes/.',
    ru: 'Цвета для фона «Аврора», чека за ход и питомца. Четыре встроенные темы (/themes); свои добавляйте как JSON в ~/.claude/toolkitty-themes/.',
    zh: '极光背景、轮次小票和伙伴的配色。内置四套主题（/themes）；也可以在 ~/.claude/toolkitty-themes/ 里以 JSON 添加自己的主题。',
    ja: 'オーロラ背景、ターンのレシート、バディの配色です。組み込みテーマは 4 つ（/themes）。~/.claude/toolkitty-themes/ に JSON で自作も追加できます。',
    pt: 'Cores do fundo aurora, do recibo do turno e do buddy. Quatro temas embutidos (/themes); adicione os seus como JSON em ~/.claude/toolkitty-themes/.',
    de: 'Farben für den Aurora-Hintergrund, den Runden-Beleg und den Buddy. Vier eingebaute Themes (/themes); eigene als JSON in ~/.claude/toolkitty-themes/ ablegen.',
    ko: '오로라 배경, 턴 영수증, 버디의 색상입니다. 기본 테마 4개(/themes)가 있으며, ~/.claude/toolkitty-themes/에 JSON으로 직접 추가할 수 있습니다.',
  },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty',
    ru: 'Функция отключена; включите её в панели /toolkitty',
    zh: '此功能已关闭，请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty パネルでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; schalte sie im /toolkitty-Panel ein',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요',
  },
  cmdDesc: {
    en: 'Lists the themes; "/themes <id>" picks one',
    he: 'מציג את העיצובים; "/themes <id>" בוחר אחד',
    es: 'Lista los temas; "/themes <id>" elige uno',
    fr: 'Liste les thèmes ; « /themes <id> » en choisit un',
    ru: 'Показывает темы; «/themes <id>» выбирает одну',
    zh: '列出主题；"/themes <id>" 选择其一',
    ja: 'テーマを一覧表示します。"/themes <id>" で選択',
    pt: 'Lista os temas; "/themes <id>" escolhe um',
    de: 'Listet die Themes; "/themes <id>" wählt eines aus',
    ko: '테마 목록을 보여 줍니다. "/themes <id>"로 하나를 선택',
  },
  argHint: { en: '<id>', he: '<id>', es: '<id>', fr: '<id>', ru: '<id>', zh: '<id>', ja: '<id>', pt: '<id>', de: '<id>', ko: '<id>' },
  paneTitle: { en: 'Themes', he: 'עיצובים', es: 'Temas', fr: 'Thèmes', ru: 'Темы', zh: '主题', ja: 'テーマ', pt: 'Temas', de: 'Themes', ko: '테마' },
  listHead: { en: 'Themes (current marked with *):', he: 'עיצובים (הנוכחי מסומן ב-*):', es: 'Temas (el actual lleva *):', fr: 'Thèmes (l’actuel est marqué *) :', ru: 'Темы (текущая отмечена *):', zh: '主题（当前项以 * 标记）：', ja: 'テーマ（現在のものに * を付けています）：', pt: 'Temas (o atual marcado com *):', de: 'Themes (aktuelles mit * markiert):', ko: '테마(현재 항목에 * 표시):' },
  hint: {
    en: 'Add your own: drop a JSON file in ~/.claude/toolkitty-themes/',
    he: 'להוספת עיצוב משלך: שים קובץ JSON ב-~/.claude/toolkitty-themes/',
    es: 'Añade el tuyo: guarda un archivo JSON en ~/.claude/toolkitty-themes/',
    fr: 'Ajoute le tien : dépose un fichier JSON dans ~/.claude/toolkitty-themes/',
    ru: 'Свою тему добавьте файлом JSON в ~/.claude/toolkitty-themes/',
    zh: '添加自己的主题：把 JSON 文件放进 ~/.claude/toolkitty-themes/',
    ja: '自作テーマの追加：JSON ファイルを ~/.claude/toolkitty-themes/ に置いてください',
    pt: 'Adicione os seus: coloque um arquivo JSON em ~/.claude/toolkitty-themes/',
    de: 'Eigene hinzufügen: JSON-Datei in ~/.claude/toolkitty-themes/ ablegen',
    ko: '직접 추가하기: ~/.claude/toolkitty-themes/에 JSON 파일을 넣으세요',
  },
  select: { en: 'select', he: 'בחר', es: 'elegir', fr: 'choisir', ru: 'выбрать', zh: '选择', ja: '選択', pt: 'escolher', de: 'wählen', ko: '선택' },
  selected: { en: 'Theme: {name}', he: 'עיצוב: {name}', es: 'Tema: {name}', fr: 'Thème : {name}', ru: 'Тема: {name}', zh: '主题：{name}', ja: 'テーマ：{name}', pt: 'Tema: {name}', de: 'Theme: {name}', ko: '테마: {name}' },
  unknown: {
    en: 'No theme "{id}". Run /themes to see the list.',
    he: 'אין עיצוב "{id}". הרץ /themes לרשימה.',
    es: 'No existe el tema "{id}". Ejecuta /themes para ver la lista.',
    fr: 'Pas de thème « {id} ». Lance /themes pour voir la liste.',
    ru: 'Темы «{id}» нет. Выполните /themes, чтобы увидеть список.',
    zh: '没有名为 "{id}" 的主题。运行 /themes 查看列表。',
    ja: 'テーマ "{id}" はありません。/themes で一覧を確認してください。',
    pt: 'Não há tema "{id}". Execute /themes para ver a lista.',
    de: 'Kein Theme "{id}". Mit /themes siehst du die Liste.',
    ko: '"{id}" 테마가 없습니다. /themes를 실행해 목록을 확인하세요.',
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

// Shared slot: the current theme. The same ref is written in the files that read it.
const theme = atom({ plugin: 'toolkitty', key: 'slot', id: 'theme' } as const, BUILTIN_THEMES[0] as Theme) as unknown as Atom<Theme>

export const feature: Feature = {
  id: 'themes',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

let known: Theme[] = BUILTIN_THEMES

/** The built-in themes plus the valid JSON files in ~/.claude/toolkitty-themes/; a user file replaces a built-in of the same id. */
async function loadThemes($: EngineInterface): Promise<void> {
  const list: Theme[] = [...BUILTIN_THEMES]
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  if (home !== undefined && home !== '') {
    const dir = `${home.replace(/[\\/]+$/, '')}/.claude/toolkitty-themes`
    try {
      const entries = [...(await $.fs.list(dir))].sort((a, b) => a.name.localeCompare(b.name))
      for (const entry of entries) {
        if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.json')) continue
        try {
          const parsed = parseTheme(JSON.parse(await $.fs.read(`${dir}/${entry.name}`)))
          if (parsed === undefined) continue
          const at = list.findIndex(one => one.id === parsed.id)
          if (at >= 0) list[at] = parsed
          else list.push(parsed)
        } catch {
          // unreadable or not JSON: skip the file
        }
      }
    } catch {
      // no such folder: only the built-in themes
    }
  }
  known = list
}

async function pick($: EngineInterface, id: string): Promise<boolean> {
  const found = known.find(one => one.id === id)
  if (found === undefined) return false
  await $.store.set('themes:current', found.id)
  await update($, theme, () => found)
  await notice($, 'info', t(T.selected, { name: found.name }), feature.id)
  return true
}

const swatches = (th: Theme): string[] => [...th.aurora.idle, th.aurora.working[0], th.receipt.accent, th.buddy.accent]

function listText(current: Theme): string {
  const lines = known.map(one => `${one.id === current.id ? '*' : ' '} ${one.id} - ${one.name}`)
  return [t(T.listHead), ...lines, '', t(T.hint)].join('\n')
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'themes', description: t(T.cmdDesc), argumentHint: t(T.argHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'themes', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  await loadThemes($)
  const stored = await $.store.get('themes:current')
  const found = typeof stored === 'string' ? known.find(one => one.id === stored) : undefined
  if (found !== undefined) await update($, theme, () => found)
}

export function register(on: On) {
  on('command.run', { command: 'themes' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await loadThemes($)
    const arg = e.args.trim()
    if (arg === '') {
      await $.ui.open({ id: 'themes', title: t(T.paneTitle) })
      return { text: listText(await read($, theme)) }
    }
    const wanted = arg.toLowerCase()
    const found = known.find(one => one.id.toLowerCase() === wanted || one.name.toLowerCase() === wanted)
    if (found === undefined) return { text: t(T.unknown, { id: arg }) }
    await pick($, found.id)
    return { text: t(T.selected, { name: found.name }) }
  })

  on('ui.render', { component: 'Pane', requestId: 'themes' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.off)}</Text>
    const current = await read($, theme)
    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader($, e, { title: t(T.paneTitle), status: current.name, level: 'info', icon: ICONS.visual })}
        {known.map(th => {
          const isCurrent = th.id === current.id
          return (
            <Box key={`theme-${th.id}`} gap={1}>
              <Box width={20}>
                <Text bold={isCurrent}>{isCurrent ? `${th.name} *` : th.name}</Text>
              </Box>
              {swatches(th).map((color, i) => (
                <Box key={`sw-${th.id}-${i}`} width={3} height={1} backgroundColor={color} />
              ))}
              <Button
                key={`pick-${th.id}`}
                label={t(T.select)}
                plain
                onPress={() => {
                  void pick($, th.id)
                }}
              />
            </Box>
          )
        })}
        <Text dimColor>{t(T.hint)}</Text>
      </Box>
    )
  })
}
