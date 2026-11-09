import { isOn, t } from '../core'
import type { EngineInterface } from 'claude-code'
import type { Feature, Input, Output } from '../core'

const T = {
  title: {
    en: 'Summary',
    he: 'תקציר',
    es: 'Resumen',
    fr: 'Résumé',
    ru: 'Резюме',
    zh: '摘要',
    ja: '要約',
    pt: 'Resumo',
    de: 'Zusammenfassung',
    ko: '요약',
  },
  description: {
    en: 'Adds a short summary in English to long answers (costs tokens).',
    he: 'מוסיף תקציר קצר בעברית לתשובות ארוכות (עולה טוקנים).',
    es: 'Añade un breve resumen en español a las respuestas largas (consume tokens).',
    fr: 'Ajoute un court résumé en français aux réponses longues (consomme des tokens).',
    ru: 'Добавляет краткое резюме на русском к длинным ответам (расходует токены).',
    zh: '为较长的回答添加一段简短的中文摘要（会消耗 token）。',
    ja: '長い回答に日本語の短い要約を追加します（トークンを消費します）。',
    pt: 'Adiciona um breve resumo em português a respostas longas (consome tokens).',
    de: 'Fügt langen Antworten eine kurze Zusammenfassung auf Deutsch hinzu (kostet Tokens).',
    ko: '긴 답변에 한국어 짧은 요약을 추가합니다(토큰을 소비합니다).',
  },
  summaryLanguage: {
    en: 'English',
    he: 'Hebrew',
    es: 'Spanish',
    fr: 'French',
    ru: 'Russian',
    zh: 'Simplified Chinese',
    ja: 'Japanese',
    pt: 'Brazilian Portuguese',
    de: 'German',
    ko: 'Korean',
  },
} as const

const MIN_CHARS = 1500

export const feature: Feature = {
  id: 'tldr',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>, result: Output<'turn.complete'>): Promise<Output<'turn.complete'>> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return result
  if (result.text.length <= MIN_CHARS) return result

  try {
    const r = await $.model.complete({
      model: 'claude-haiku-5-5',
      prompt: 'Summarize the following answer in ' + t(T.summaryLanguage) + ' in at most 3 short bullet points:\n\n' + result.text,
    })
    if (!r.isAnswered || r.text.trim() === '') return result
    return { ...result, text: result.text + '\n\n**TL;DR**\n' + r.text.trim() }
  } catch {
    return result
  }
}
