import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, t } from '../core'
import type { BandInput, BandLine, Feature, PaneInput } from '../core'
import { ICONS } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: { en: 'Model indicator', he: 'מחוון מודל', es: 'Indicador de modelo', fr: 'Indicateur de modèle', ru: 'Индикатор модели', zh: '模型指示器', ja: 'モデルインジケーター', pt: 'Indicador de modelo', de: 'Modellanzeige', ko: '모델 표시' },
  description: { en: 'A line above the prompt box: which model and effort level the current turn is running on.', he: 'פס מעל תיבת הכתיבה: באיזה מודל וברמת מאמץ רץ התור הנוכחי.', es: 'Una línea sobre el cuadro de texto: con qué modelo y nivel de esfuerzo se ejecuta el turno actual.', fr: 'Une ligne au-dessus de la zone de saisie : modèle et niveau d\'effort du tour en cours.', ru: 'Строка над полем ввода: на какой модели и с каким уровнем усилий выполняется текущий ход.', zh: '提示框上方的一行：当前回合使用的模型和强度级别。', ja: 'プロンプト欄の上の 1 行: 現在のターンが使っているモデルと effort レベル。', pt: 'Uma linha acima da caixa de prompt: qual modelo e nível de esforço o turno atual está usando.', de: 'Eine Zeile über dem Prompt-Feld: mit welchem Modell und welcher Effort-Stufe der aktuelle Turn läuft.', ko: '프롬프트 입력창 위의 한 줄: 현재 턴이 사용 중인 모델과 effort 수준.' },
  model: { en: 'Model', he: 'מודל', es: 'Modelo', fr: 'Modèle', ru: 'Модель', zh: '模型', ja: 'モデル', pt: 'Modelo', de: 'Modell', ko: '모델' },
  effort: { en: ' · effort ', he: ' · מאמץ ', es: ' · esfuerzo ', fr: ' · effort ', ru: ' · усилие ', zh: ' · 强度 ', ja: ' · effort ', pt: ' · esforço ', de: ' · Effort ', ko: ' · effort' },
} as const

type Current = { model: string; effort: string | null }

const current = atom({ plugin: 'toolkitty', key: 'slot', id: 'model-indicator' } as const, null) as unknown as Atom<Current | null>

export const feature: Feature = {
  id: 'model-indicator',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const c = await read($, current)
  if (c === null) return null

  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      {t(T.model)} <Text mono>{c.model}</Text>
      {c.effort === null ? '' : t(T.effort)}
      {c.effort === null ? null : <Text mono>{c.effort}</Text>}
    </Text>
  )
}

/** What a press on the band line shows: the model and effort, one line. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const c = await read($, current)
  if (c === null) return null

  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      <Text>{`${t(T.model)} ${c.model}${c.effort === null ? '' : `${t(T.effort)}${c.effort}`}`}</Text>
    </Box>
  )
}

export function register(on: On) {
    on('turn.step', async function* ($, e, next) {
      if (e.agentId === undefined && e.index === 0 && (await isOn($, feature))) {
        const effort = e.effort === undefined ? null : String(e.effort)
        await update($, current, () => ({ model: e.model, effort }))
      }
      return yield* next(e)
    })
}

/** The short band form: the model without its vendor prefix and date, plus the effort. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const c = await read($, current)
  if (c === null) return null

  const name = c.model.replace(/^claude-/, '').replace(/-\d{8}$/, '')
  return { text: c.effort === null ? name : `${name} ${c.effort}`, level: 'ok', icon: ICONS.insight }
}
