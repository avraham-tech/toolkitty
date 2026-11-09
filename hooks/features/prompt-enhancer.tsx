import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { BandInput, Feature, Input } from '../core'
import { ICONS, emptyState, listRow, paneHeader } from '../ui'
import type { Chip } from '../ui'

/*
 * Prompt enhancer. Scores a prompt with a plain, explainable heuristic (no model), and when the
 * score is low asks the person what to do: send as is, use a suggested rewrite, edit it first, or
 * stop asking. It never rewrites silently. An optional AI rewrite (a cheap model call) replaces the
 * template rewrite. Off by default.
 */

const T = {
  title: { en: 'Prompt enhancer', he: 'משפר פרומפטים', es: 'Mejorador de prompts', fr: 'Améliorateur de prompts', ru: 'Улучшение промптов', zh: '提示词优化', ja: 'プロンプト改善', pt: 'Aprimorador de prompt', de: 'Prompt-Verbesserer', ko: '프롬프트 개선' },
  description: {
    en: 'Scores each prompt for clarity with a simple heuristic and, when it is vague, asks whether to send it as is, use a clearer rewrite, or edit it first. Never rewrites silently.',
    he: 'נותן לכל פרומפט ציון בהירות לפי היוריסטיקה פשוטה, וכשהוא מעורפל שואל אם לשלוח כמו שהוא, להשתמש בניסוח ברור יותר או לערוך קודם. אף פעם לא משכתב בשקט.',
    es: 'Puntúa la claridad de cada prompt con una heurística simple y, si es vago, pregunta si enviarlo tal cual, usar una reescritura más clara o editarlo antes. Nunca reescribe en silencio.',
    fr: 'Note la clarté de chaque prompt avec une heuristique simple et, s\'il est vague, demande s\'il faut l\'envoyer tel quel, utiliser une reformulation plus claire ou le modifier d\'abord. Ne réécrit jamais en silence.',
    ru: 'Оценивает ясность каждого промпта простой эвристикой и, если он расплывчатый, спрашивает: отправить как есть, взять более ясную переформулировку или сначала отредактировать. Никогда не переписывает молча.',
    zh: '用简单的启发式规则为每条提示词的清晰度打分，模糊时会询问是原样发送、使用更清晰的改写，还是先编辑。绝不会悄悄改写。',
    ja: '簡単なヒューリスティックで各プロンプトの明確さを採点し、曖昧なときはそのまま送るか、より明確な書き換えを使うか、先に編集するかを尋ねます。黙って書き換えることはありません。',
    pt: 'Dá uma nota de clareza a cada prompt com uma heurística simples e, quando é vago, pergunta se envia como está, usa uma reescrita mais clara ou edita antes. Nunca reescreve em silêncio.',
    de: 'Bewertet jeden Prompt per einfacher Heuristik auf Klarheit und fragt bei vagen Prompts, ob er unverändert gesendet, durch eine klarere Umformulierung ersetzt oder erst bearbeitet werden soll. Schreibt nie stillschweigend um.',
    ko: '간단한 휴리스틱으로 각 프롬프트의 명확도를 점수화하고, 모호하면 그대로 보낼지, 더 명확한 재작성을 쓸지, 먼저 편집할지 묻습니다. 몰래 고쳐 쓰지는 않습니다.',
  },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty',
    ru: 'Функция отключена; включите её в панели /toolkitty',
    zh: '该功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty ペインでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  cmdDesc: {
    en: 'Prompt enhancer: shows the last clarity score; /enhance ai on|off, mute|unmute, pane',
    he: 'משפר פרומפטים: מציג את ציון הבהירות האחרון; /enhance ai on|off, mute|unmute, pane',
    es: 'Mejorador de prompts: muestra la última puntuación de claridad; /enhance ai on|off, mute|unmute, pane',
    fr: 'Améliorateur de prompts : affiche la dernière note de clarté ; /enhance ai on|off, mute|unmute, pane',
    ru: 'Улучшение промптов: показывает последнюю оценку ясности; /enhance ai on|off, mute|unmute, pane',
    zh: '提示词优化：显示最近一次清晰度得分；/enhance ai on|off、mute|unmute、pane',
    ja: 'プロンプト改善：直近の明確さスコアを表示。/enhance ai on|off、mute|unmute、pane',
    pt: 'Aprimorador de prompt: mostra a última nota de clareza; /enhance ai on|off, mute|unmute, pane',
    de: 'Prompt-Verbesserer: zeigt die letzte Klarheitsbewertung; /enhance ai on|off, mute|unmute, pane',
    ko: '프롬프트 개선: 마지막 명확도 점수를 보여 줍니다. /enhance ai on|off, mute|unmute, pane',
  },
  cmdHint: { en: '[ai on|off|mute|unmute|pane]', he: '[ai on|off|mute|unmute|pane]', es: '[ai on|off|mute|unmute|pane]', fr: '[ai on|off|mute|unmute|pane]', ru: '[ai on|off|mute|unmute|pane]', zh: '[ai on|off|mute|unmute|pane]', ja: '[ai on|off|mute|unmute|pane]', pt: '[ai on|off|mute|unmute|pane]', de: '[ai on|off|mute|unmute|pane]', ko: '[ai on|off|mute|unmute|pane]' },
  usage: {
    en: 'Usage: /enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
    he: 'שימוש: /enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
    es: 'Uso: /enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
    fr: 'Utilisation : /enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
    ru: 'Использование: /enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
    zh: '用法：/enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
    ja: '使い方：/enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
    pt: 'Uso: /enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
    de: 'Verwendung: /enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
    ko: '사용법: /enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane',
  },
  usageAi: {
    en: 'AI rewrite is {state}. Use /enhance ai on or /enhance ai off.',
    he: 'השכתוב בבינה מלאכותית {state}. השתמש ב-/enhance ai on או /enhance ai off.',
    es: 'La reescritura con IA está {state}. Usa /enhance ai on o /enhance ai off.',
    fr: 'La réécriture par IA est {state}. Utilise /enhance ai on ou /enhance ai off.',
    ru: 'Переписывание через ИИ: {state}. Используйте /enhance ai on или /enhance ai off.',
    zh: 'AI 改写当前为{state}。请使用 /enhance ai on 或 /enhance ai off。',
    ja: 'AI 書き換えは現在{state}です。/enhance ai on または /enhance ai off を使ってください。',
    pt: 'A reescrita por IA está {state}. Use /enhance ai on ou /enhance ai off.',
    de: 'Die KI-Umformulierung ist {state}. Nutze /enhance ai on oder /enhance ai off.',
    ko: 'AI 재작성은 현재 {state} 상태입니다. /enhance ai on 또는 /enhance ai off를 쓰세요.',
  },
  wordOn: { en: 'on', he: 'פעיל', es: 'activada', fr: 'activée', ru: 'включено', zh: '开', ja: 'オン', pt: 'on', de: 'an', ko: '켬' },
  wordOff: { en: 'off', he: 'כבוי', es: 'desactivada', fr: 'désactivée', ru: 'выключено', zh: '关', ja: 'オフ', pt: 'off', de: 'aus', ko: '끔' },
  aiOn: {
    en: 'AI rewrite is on: a cheap model call proposes the rewrite (it still only asks, never sends for you).',
    he: 'השכתוב בבינה מלאכותית פעיל: קריאה זולה למודל מציעה את הניסוח (עדיין רק שואל, לא שולח במקומך).',
    es: 'La reescritura con IA está activada: una llamada barata al modelo propone el texto (sigue preguntando, nunca envía por ti).',
    fr: 'La réécriture par IA est activée : un appel peu coûteux au modèle propose le texte (il demande toujours, n’envoie jamais à ta place).',
    ru: 'Переписывание через ИИ включено: недорогой вызов модели предлагает текст (по-прежнему только спрашивает, сам не отправляет).',
    zh: 'AI 改写已开启：由一次低成本的模型调用提出改写建议（仍然只是询问，绝不替你发送）。',
    ja: 'AI 書き換えはオン：低コストのモデル呼び出しが書き換えを提案します（確認するだけで、勝手に送信はしません）。',
    pt: 'A reescrita por IA está ativada: uma chamada barata ao modelo propõe a reescrita (ela só pergunta, nunca envia por você).',
    de: 'Die KI-Umformulierung ist an: Ein günstiger Modellaufruf schlägt die Umformulierung vor (er fragt nur, sendet nie für dich).',
    ko: 'AI 재작성이 켜졌습니다: 저렴한 모델 호출이 재작성을 제안합니다(묻기만 하고 대신 보내지는 않습니다).',
  },
  aiOff: {
    en: 'AI rewrite is off: the rewrite comes from a built-in template, with no model call.',
    he: 'השכתוב בבינה מלאכותית כבוי: הניסוח מגיע מתבנית מובנית, בלי קריאה למודל.',
    es: 'La reescritura con IA está desactivada: el texto sale de una plantilla integrada, sin llamar al modelo.',
    fr: 'La réécriture par IA est désactivée : le texte vient d\'un modèle intégré, sans appel au modèle.',
    ru: 'Переписывание через ИИ выключено: текст берётся из встроенного шаблона, без вызова модели.',
    zh: 'AI 改写已关闭：改写来自内置模板，不调用模型。',
    ja: 'AI 書き換えはオフ：書き換えは組み込みテンプレートで行い、モデルは呼び出しません。',
    pt: 'A reescrita por IA está desativada: a reescrita vem de um template embutido, sem chamada ao modelo.',
    de: 'Die KI-Umformulierung ist aus: Die Umformulierung stammt aus einer eingebauten Vorlage, ohne Modellaufruf.',
    ko: 'AI 재작성이 꺼졌습니다: 재작성은 내장 템플릿에서 나오며 모델을 호출하지 않습니다.',
  },
  muted: {
    en: 'Muted until the next session: prompts are still scored, but nothing will be asked. /enhance unmute to ask again.',
    he: 'מושתק עד הסשן הבא: פרומפטים עדיין מקבלים ציון, אבל לא תהיה שאלה. /enhance unmute כדי לשאול שוב.',
    es: 'Silenciado hasta la próxima sesión: los prompts se siguen puntuando, pero no se preguntará nada. /enhance unmute para volver a preguntar.',
    fr: 'Muet jusqu\'à la prochaine session : les prompts sont toujours notés, mais rien ne sera demandé. /enhance unmute pour redemander.',
    ru: 'Вопросы отключены до следующей сессии: промпты по-прежнему оцениваются, но спрашивать не будут. /enhance unmute, чтобы снова спрашивать.',
    zh: '静音至下次会话：提示词仍会打分，但不会再询问。用 /enhance unmute 恢复询问。',
    ja: '次のセッションまでミュート：プロンプトの採点は続きますが、確認は行いません。/enhance unmute で再び確認します。',
    pt: 'Silenciado até a próxima sessão: os prompts ainda são avaliados, mas nada será perguntado. /enhance unmute volta a perguntar.',
    de: 'Stumm bis zur nächsten Session: Prompts werden weiter bewertet, aber es wird nichts gefragt. /enhance unmute fragt wieder.',
    ko: '다음 세션까지 음소거: 프롬프트는 계속 점수를 매기지만 묻지는 않습니다. /enhance unmute로 다시 묻게 할 수 있습니다.',
  },
  unmuted: {
    en: 'Unmuted: low-scoring prompts will ask again (at most once every 5 minutes).',
    he: 'ההשתקה בוטלה: פרומפטים עם ציון נמוך ישאלו שוב (לכל היותר פעם ב-5 דקות).',
    es: 'Silencio quitado: los prompts con puntuación baja volverán a preguntar (como máximo una vez cada 5 minutos).',
    fr: 'Muet levé : les prompts mal notés redemanderont (au plus une fois toutes les 5 minutes).',
    ru: 'Вопросы снова включены: при низкой оценке промпта будут спрашивать (не чаще раза в 5 минут).',
    zh: '已取消静音：低分提示词会再次询问（最多每 5 分钟一次）。',
    ja: 'ミュート解除：低スコアのプロンプトは再び確認します（5 分に 1 回まで）。',
    pt: 'Silêncio removido: prompts com nota baixa voltam a perguntar (no máximo uma vez a cada 5 minutos).',
    de: 'Stummschaltung aufgehoben: Prompts mit niedriger Bewertung fragen wieder (höchstens alle 5 Minuten).',
    ko: '음소거 해제: 점수가 낮은 프롬프트는 다시 묻습니다(최대 5분에 한 번).',
  },
  paneOpened: { en: 'Opened the prompt enhancer pane.', he: 'חלונית משפר הפרומפטים נפתחה.', es: 'Panel del mejorador de prompts abierto.', fr: 'Panneau de l\'améliorateur de prompts ouvert.', ru: 'Панель улучшения промптов открыта.', zh: '已打开提示词优化面板。', ja: 'プロンプト改善ペインを開きました。', pt: 'Painel do aprimorador de prompt aberto.', de: 'Prompt-Verbesserer-Panel geöffnet.', ko: '프롬프트 개선 창을 열었습니다.' },
  summaryHead: { en: 'Prompt enhancer', he: 'משפר פרומפטים', es: 'Mejorador de prompts', fr: 'Améliorateur de prompts', ru: 'Улучшение промптов', zh: '提示词优化', ja: 'プロンプト改善', pt: 'Aprimorador de prompt', de: 'Prompt-Verbesserer', ko: '프롬프트 개선' },
  modeLine: {
    en: 'Mode: asks when the score is below {threshold} · AI rewrite {ai} · {muted}',
    he: 'מצב: שואל כשהציון מתחת ל-{threshold} · שכתוב בבינה מלאכותית {ai} · {muted}',
    es: 'Modo: pregunta si la puntuación es inferior a {threshold} · reescritura con IA {ai} · {muted}',
    fr: 'Mode : demande si la note est inférieure à {threshold} · réécriture par IA {ai} · {muted}',
    ru: 'Режим: спрашивает при оценке ниже {threshold} · переписывание через ИИ: {ai} · {muted}',
    zh: '模式：得分低于 {threshold} 时询问 · AI 改写 {ai} · {muted}',
    ja: 'モード：スコアが {threshold} 未満なら確認 · AI 書き換え {ai} · {muted}',
    pt: 'Modo: pergunta quando a nota está abaixo de {threshold} · reescrita por IA {ai} · {muted}',
    de: 'Modus: fragt bei Bewertung unter {threshold} · KI-Umformulierung {ai} · {muted}',
    ko: '모드: 점수가 {threshold} 미만이면 묻기 · AI 재작성 {ai} · {muted}',
  },
  mutedYes: { en: 'muted this session', he: 'מושתק בסשן הזה', es: 'silenciado en esta sesión', fr: 'muet pour cette session', ru: 'вопросы отключены на эту сессию', zh: '本次会话已静音', ja: 'このセッションではミュート中', pt: 'silenciado nesta sessão', de: 'in dieser Session stumm', ko: '이번 세션 음소거됨' },
  mutedNo: { en: 'not muted', he: 'לא מושתק', es: 'sin silenciar', fr: 'pas en sourdine', ru: 'вопросы включены', zh: '未静音', ja: 'ミュートなし', pt: 'não silenciado', de: 'nicht stumm', ko: '음소거 아님' },
  lastLine: {
    en: 'Last prompt: {score}/100 (heuristic clarity score)',
    he: 'הפרומפט האחרון: {score}/100 (ציון בהירות היוריסטי)',
    es: 'Último prompt: {score}/100 (puntuación heurística de claridad)',
    fr: 'Dernier prompt : {score}/100 (note de clarté heuristique)',
    ru: 'Последний промпт: {score}/100 (эвристическая оценка ясности)',
    zh: '上一条提示词：{score}/100（启发式清晰度得分）',
    ja: '直近のプロンプト：{score}/100（ヒューリスティックの明確さスコア）',
    pt: 'Último prompt: {score}/100 (nota heurística de clareza)',
    de: 'Letzter Prompt: {score}/100 (heuristische Klarheitsbewertung)',
    ko: '마지막 프롬프트: {score}/100(휴리스틱 명확도 점수)',
  },
  lastNone: {
    en: 'No prompt has been scored yet (only prompts of 4 words or more are scored).',
    he: 'עדיין לא ניתן ציון לאף פרומפט (רק פרומפטים של 4 מילים ומעלה מקבלים ציון).',
    es: 'Aún no se ha puntuado ningún prompt (solo se puntúan los de 4 palabras o más).',
    fr: 'Aucun prompt n\'a encore été noté (seuls les prompts de 4 mots ou plus le sont).',
    ru: 'Пока ни один промпт не оценён (оцениваются только промпты от 4 слов).',
    zh: '尚未给任何提示词打分（只对 4 个词及以上的提示词打分）。',
    ja: 'まだ採点されたプロンプトはありません（4 語以上のプロンプトのみ採点されます）。',
    pt: 'Nenhum prompt foi avaliado ainda (só prompts com 4 palavras ou mais são avaliados).',
    de: 'Noch kein Prompt bewertet (nur Prompts mit mindestens 4 Wörtern werden bewertet).',
    ko: '아직 점수가 매겨진 프롬프트가 없습니다(4단어 이상인 프롬프트만 점수를 매깁니다).',
  },
  lastClear: { en: 'Nothing to improve.', he: 'אין מה לשפר.', es: 'Nada que mejorar.', fr: 'Rien à améliorer.', ru: 'Улучшать нечего.', zh: '无需改进。', ja: '改善点はありません。', pt: 'Nada a melhorar.', de: 'Nichts zu verbessern.', ko: '개선할 점이 없습니다.' },
  sugVerb: {
    en: 'Start with what you want done (fix, add, implement, investigate, refactor, explain).',
    he: 'פתח במה שאתה רוצה שייעשה (תקן, הוסף, ממש, חקור, שכתב, הסבר).',
    es: 'Empieza por lo que quieres que se haga (arreglar, añadir, implementar, investigar, refactorizar, explicar).',
    fr: 'Commence par ce que tu veux obtenir (corriger, ajouter, implémenter, enquêter, refactoriser, expliquer).',
    ru: 'Начните с того, что нужно сделать (исправить, добавить, реализовать, исследовать, отрефакторить, объяснить).',
    zh: '先说明你想做什么（修复、添加、实现、调查、重构、解释）。',
    ja: 'まず何をしたいかを書きましょう（修正、追加、実装、調査、リファクタ、説明）。',
    pt: 'Comece dizendo o que quer fazer (corrigir, adicionar, implementar, investigar, refatorar, explicar).',
    de: 'Beginne damit, was getan werden soll (beheben, hinzufügen, implementieren, untersuchen, refaktorisieren, erklären).',
    ko: '원하는 작업부터 쓰세요(수정, 추가, 구현, 조사, 리팩터링, 설명).',
  },
  sugScope: {
    en: 'Name the place: a file, path, function, module or component.',
    he: 'ציין את המקום: קובץ, נתיב, פונקציה, מודול או רכיב.',
    es: 'Indica el lugar: un archivo, ruta, función, módulo o componente.',
    fr: 'Indique l’endroit : un fichier, chemin, fonction, module ou composant.',
    ru: 'Укажите место: файл, путь, функцию, модуль или компонент.',
    zh: '指明位置：文件、路径、函数、模块或组件。',
    ja: '場所を指定しましょう：ファイル、パス、関数、モジュール、コンポーネント。',
    pt: 'Indique o lugar: um arquivo, caminho, função, módulo ou componente.',
    de: 'Nenne die Stelle: Datei, Pfad, Funktion, Modul oder Komponente.',
    ko: '위치를 밝히세요: 파일, 경로, 함수, 모듈 또는 컴포넌트.',
  },
  sugAccept: {
    en: 'Say how you will know it worked (it should..., so that..., the tests pass).',
    he: 'אמור איך תדע שזה עבד (צריך ש..., כך ש..., הבדיקות עוברות).',
    es: 'Di cómo sabrás que funcionó (debería..., para que..., las pruebas pasan).',
    fr: 'Dis comment tu sauras que ça marche (il doit..., afin que..., les tests passent).',
    ru: 'Скажите, как понять, что получилось (должно..., так чтобы..., тесты проходят).',
    zh: '说明如何判断已经成功（它应该……、使得……、测试通过）。',
    ja: 'うまくいったかどうかの判断基準を書きましょう（〜すること、〜するように、テストが通る）。',
    pt: 'Diga como saberá que funcionou (deve..., para que..., os testes passam).',
    de: 'Sage, woran du erkennst, dass es funktioniert (es soll ..., damit ..., die Tests bestehen).',
    ko: '성공 여부를 어떻게 알 수 있는지 쓰세요(~해야 한다, ~하도록, 테스트 통과).',
  },
  sugVague: {
    en: 'Replace vague words ("bug", "broken", "doesn\'t work") with what exactly happens, and where.',
    he: 'החלף מילים עמומות ("באג", "שבור", "לא עובד") במה בדיוק קורה, ואיפה.',
    es: 'Sustituye las palabras vagas ("bug", "roto", "no funciona") por lo que ocurre exactamente y dónde.',
    fr: 'Remplace les mots vagues (« bug », « cassé », « ne marche pas ») par ce qui se passe exactement, et où.',
    ru: 'Замените расплывчатые слова («баг», «сломано», «не работает») тем, что именно происходит и где.',
    zh: '把含糊的词（“bug”“坏了”“不能用”）换成具体发生了什么，以及在哪里。',
    ja: '曖昧な言葉（「バグ」「壊れた」「動かない」）を、何がどこで起きているかの具体的な説明に置き換えましょう。',
    pt: 'Troque palavras vagas ("bug", "quebrado", "não funciona") pelo que exatamente acontece e onde.',
    de: 'Ersetze vage Wörter („Bug“, „kaputt“, „funktioniert nicht“) durch das, was genau passiert, und wo.',
    ko: '모호한 표현("버그", "고장", "안 됨")을 정확히 무엇이 어디서 일어나는지로 바꾸세요.',
  },
  sugShort: {
    en: 'Add a bit more detail; a very short line leaves a lot to guess.',
    he: 'הוסף עוד קצת פרטים; שורה קצרה מאוד משאירה הרבה לניחוש.',
    es: 'Añade algo más de detalle; una línea muy corta deja mucho por adivinar.',
    fr: 'Ajoute un peu de détail ; une ligne très courte laisse beaucoup à deviner.',
    ru: 'Добавьте деталей: совсем короткая строка оставляет слишком много догадок.',
    zh: '再多补充一些细节；太短的一句话会留下很多需要猜测的地方。',
    ja: 'もう少し詳しく書きましょう。短すぎる一文は推測だらけになります。',
    pt: 'Acrescente mais detalhes; uma linha muito curta deixa muita coisa para adivinhar.',
    de: 'Füge etwas mehr Details hinzu; eine sehr kurze Zeile lässt viel Raum zum Raten.',
    ko: '조금 더 자세히 쓰세요. 너무 짧은 한 줄은 추측할 부분이 많습니다.',
  },
  // The question's header is cut at 12 characters by the engine.
  header: { en: 'Clarity', he: 'בהירות', es: 'Claridad', fr: 'Clarté', ru: 'Ясность', zh: '清晰度', ja: '明確さ', pt: 'Clareza', de: 'Klarheit', ko: '명확도' },
  askQuestion: {
    en: 'Clarity (heuristic): {score}/100. This could be clearer:\n{list}\n\n{head}\n{proposed}\n\nHow should I send it?',
    he: 'בהירות (היוריסטי): {score}/100. אפשר לנסח ברור יותר:\n{list}\n\n{head}\n{proposed}\n\nאיך לשלוח?',
    es: 'Claridad (heurística): {score}/100. Podría ser más claro:\n{list}\n\n{head}\n{proposed}\n\n¿Cómo lo envío?',
    fr: 'Clarté (heuristique) : {score}/100. Ce pourrait être plus clair :\n{list}\n\n{head}\n{proposed}\n\nComment l\'envoyer ?',
    ru: 'Ясность (эвристика): {score}/100. Можно сформулировать яснее:\n{list}\n\n{head}\n{proposed}\n\nКак отправить?',
    zh: '清晰度（启发式）：{score}/100。可以更清晰：\n{list}\n\n{head}\n{proposed}\n\n要如何发送？',
    ja: '明確さ（ヒューリスティック）：{score}/100。もっと明確にできます：\n{list}\n\n{head}\n{proposed}\n\nどのように送信しますか？',
    pt: 'Clareza (heurística): {score}/100. Isto poderia ser mais claro:\n{list}\n\n{head}\n{proposed}\n\nComo devo enviar?',
    de: 'Klarheit (heuristisch): {score}/100. Das könnte klarer sein:\n{list}\n\n{head}\n{proposed}\n\nWie soll ich es senden?',
    ko: '명확도(휴리스틱): {score}/100. 더 명확하게 할 수 있습니다:\n{list}\n\n{head}\n{proposed}\n\n어떻게 보낼까요?',
  },
  rewriteTemplate: { en: 'Suggested rewrite:', he: 'ניסוח מוצע:', es: 'Reescritura sugerida:', fr: 'Reformulation suggérée :', ru: 'Предлагаемая переформулировка:', zh: '建议的改写：', ja: '書き換え案：', pt: 'Reescrita sugerida:', de: 'Vorgeschlagene Umformulierung:', ko: '제안하는 재작성:' },
  rewriteAi: { en: 'Suggested rewrite (AI):', he: 'ניסוח מוצע (בינה מלאכותית):', es: 'Reescritura sugerida (IA):', fr: 'Reformulation suggérée (IA) :', ru: 'Предлагаемая переформулировка (ИИ):', zh: '建议的改写（AI）：', ja: '書き換え案（AI）：', pt: 'Reescrita sugerida (IA):', de: 'Vorgeschlagene Umformulierung (KI):', ko: '제안하는 재작성(AI):' },
  optAsIs: { en: 'Send as is', he: 'שלח כמו שהוא', es: 'Enviar tal cual', fr: 'Envoyer tel quel', ru: 'Отправить как есть', zh: '原样发送', ja: 'そのまま送信', pt: 'Enviar como está', de: 'Unverändert senden', ko: '그대로 보내기' },
  optUse: { en: 'Use suggestion', he: 'השתמש בהצעה', es: 'Usar la sugerencia', fr: 'Utiliser la suggestion', ru: 'Взять предложение', zh: '使用建议', ja: '提案を使う', pt: 'Usar sugestão', de: 'Vorschlag nutzen', ko: '제안 사용' },
  optEdit: { en: 'Edit', he: 'ערוך', es: 'Editar', fr: 'Modifier', ru: 'Править', zh: '编辑', ja: '編集', pt: 'Editar', de: 'Bearbeiten', ko: '편집' },
  optStop: { en: 'Stop asking', he: 'הפסק לשאול', es: 'Dejar de preguntar', fr: 'Ne plus demander', ru: 'Больше не спрашивать', zh: '不再询问', ja: '今後は確認しない', pt: 'Parar de perguntar', de: 'Nicht mehr fragen', ko: '묻지 않기' },
  dropEdit: {
    en: 'Prompt enhancer: the suggestion is in the prompt box. Edit it and send when ready.',
    he: 'משפר הפרומפטים: ההצעה נמצאת בתיבת הכתיבה. ערוך אותה ושלח כשתהיה מוכן.',
    es: 'Mejorador de prompts: la sugerencia está en el cuadro del prompt. Edítala y envíala cuando quieras.',
    fr: 'Améliorateur de prompts : la suggestion est dans la zone de saisie. Modifie-la et envoie quand c’est prêt.',
    ru: 'Улучшение промптов: предложение в поле ввода. Отредактируйте и отправьте, когда будете готовы.',
    zh: '提示词优化：建议已放入输入框。请编辑后在准备好时发送。',
    ja: 'プロンプト改善：提案を入力欄に入れました。編集して、準備ができたら送信してください。',
    pt: 'Aprimorador de prompt: a sugestão está na caixa de prompt. Edite e envie quando estiver pronto.',
    de: 'Prompt-Verbesserer: Der Vorschlag steht im Eingabefeld. Bearbeite ihn und sende, wenn du bereit bist.',
    ko: '프롬프트 개선: 제안이 입력창에 들어갔습니다. 편집한 뒤 준비되면 보내세요.',
  },
  fillFailed: {
    en: 'Prompt enhancer: could not put the suggestion in the prompt box, so your prompt was sent as is.',
    he: 'משפר הפרומפטים: לא ניתן היה להכניס את ההצעה לתיבת הכתיבה, ולכן הפרומפט שלך נשלח כמו שהוא.',
    es: 'Mejorador de prompts: no se pudo poner la sugerencia en el cuadro, así que tu prompt se envió tal cual.',
    fr: 'Améliorateur de prompts : impossible de mettre la suggestion dans la zone de saisie, ton prompt a été envoyé tel quel.',
    ru: 'Улучшение промптов: не удалось поместить предложение в поле ввода, поэтому промпт отправлен как есть.',
    zh: '提示词优化：无法把建议放入输入框，因此已原样发送你的提示词。',
    ja: 'プロンプト改善：提案を入力欄に入れられなかったため、プロンプトはそのまま送信しました。',
    pt: 'Aprimorador de prompt: não foi possível colocar a sugestão na caixa de prompt, então seu prompt foi enviado como está.',
    de: 'Prompt-Verbesserer: Der Vorschlag konnte nicht ins Eingabefeld gesetzt werden, daher wurde dein Prompt unverändert gesendet.',
    ko: '프롬프트 개선: 제안을 입력창에 넣지 못해 프롬프트를 그대로 보냈습니다.',
  },
  stopped: {
    en: 'Prompt enhancer: will not ask again this session (/enhance unmute to undo).',
    he: 'משפר הפרומפטים: לא ישאל שוב בסשן הזה (/enhance unmute לביטול).',
    es: 'Mejorador de prompts: no volverá a preguntar en esta sesión (/enhance unmute para deshacer).',
    fr: 'Améliorateur de prompts : ne redemandera plus durant cette session (/enhance unmute pour annuler).',
    ru: 'Улучшение промптов: в этой сессии больше не спросит (/enhance unmute, чтобы отменить).',
    zh: '提示词优化：本次会话不会再询问（/enhance unmute 可撤销）。',
    ja: 'プロンプト改善：このセッションでは確認しません（/enhance unmute で元に戻せます）。',
    pt: 'Aprimorador de prompt: não perguntará mais nesta sessão (/enhance unmute desfaz).',
    de: 'Prompt-Verbesserer: Fragt in dieser Session nicht mehr (/enhance unmute macht das rückgängig).',
    ko: '프롬프트 개선: 이번 세션에서는 더 묻지 않습니다(/enhance unmute로 되돌릴 수 있습니다).',
  },
  chip: { en: 'prompt {score}', he: 'פרומפט {score}', es: 'prompt {score}', fr: 'prompt {score}', ru: 'промпт {score}', zh: '提示词 {score}', ja: 'プロンプト {score}', pt: 'prompt {score}', de: 'Prompt {score}', ko: '프롬프트 {score}' },
  paneTitle: { en: 'Prompt enhancer', he: 'משפר פרומפטים', es: 'Mejorador de prompts', fr: 'Améliorateur de prompts', ru: 'Улучшение промптов', zh: '提示词优化', ja: 'プロンプト改善', pt: 'Aprimorador de prompt', de: 'Prompt-Verbesserer', ko: '프롬프트 개선' },
  paneHint: {
    en: 'Prompts of 4 words or more are scored here. Write a prompt, or run /enhance.',
    he: 'פרומפטים של 4 מילים ומעלה מקבלים ציון כאן. כתוב פרומפט, או הרץ /enhance.',
    es: 'Aquí se puntúan los prompts de 4 palabras o más. Escribe un prompt o ejecuta /enhance.',
    fr: 'Les prompts de 4 mots ou plus sont notés ici. Écris un prompt ou lance /enhance.',
    ru: 'Здесь оцениваются промпты от 4 слов. Напишите промпт или выполните /enhance.',
    zh: '这里会给 4 个词及以上的提示词打分。写一条提示词，或运行 /enhance。',
    ja: '4 語以上のプロンプトがここで採点されます。プロンプトを書くか、/enhance を実行してください。',
    pt: 'Prompts com 4 palavras ou mais são avaliados aqui. Escreva um prompt ou execute /enhance.',
    de: 'Prompts mit mindestens 4 Wörtern werden hier bewertet. Schreibe einen Prompt oder führe /enhance aus.',
    ko: '4단어 이상인 프롬프트는 여기서 점수를 매깁니다. 프롬프트를 쓰거나 /enhance를 실행하세요.',
  },
  paneEmpty: { en: 'No prompt has been scored yet.', he: 'עדיין לא ניתן ציון לאף פרומפט.', es: 'Aún no se ha puntuado ningún prompt.', fr: 'Aucun prompt noté pour le moment.', ru: 'Пока нет оценённых промптов.', zh: '尚未给任何提示词打分。', ja: 'まだ採点されたプロンプトはありません。', pt: 'Nenhum prompt foi avaliado ainda.', de: 'Noch kein Prompt bewertet.', ko: '아직 점수가 매겨진 프롬프트가 없습니다.' },
  btnAiOn: { en: 'AI on', he: 'AI פעיל', es: 'Activar IA', fr: 'IA oui', ru: 'ИИ вкл', zh: 'AI 开', ja: 'AI オン', pt: 'IA ligada', de: 'KI an', ko: 'AI 켬' },
  btnAiOff: { en: 'AI off', he: 'AI כבוי', es: 'Desactivar IA', fr: 'IA non', ru: 'ИИ выкл', zh: 'AI 关', ja: 'AI オフ', pt: 'IA desligada', de: 'KI aus', ko: 'AI 끔' },
  btnMute: { en: 'Mute', he: 'השתק', es: 'Silenciar', fr: 'Muet', ru: 'Выкл. вопросы', zh: '静音', ja: 'ミュート', pt: 'Silenciar', de: 'Stumm', ko: '음소거' },
  btnUnmute: { en: 'Unmute', he: 'בטל השתקה', es: 'Quitar silencio', fr: 'Réactiver', ru: 'Вкл. вопросы', zh: '取消静音', ja: 'ミュート解除', pt: 'Reativar', de: 'Stumm aus', ko: '음소거 해제' },
  btnClear: { en: 'Clear', he: 'נקה', es: 'Borrar', fr: 'Effacer', ru: 'Очистить', zh: '清除', ja: 'クリア', pt: 'Limpar', de: 'Löschen', ko: '지우기' },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  choiceOk: { en: 'clear enough', he: 'ברור מספיק', es: 'suficientemente claro', fr: 'assez clair', ru: 'достаточно ясно', zh: '足够清晰', ja: '十分に明確', pt: 'claro o bastante', de: 'klar genug', ko: '충분히 명확함' },
  choiceAsIs: { en: 'sent as is', he: 'נשלח כמו שהוא', es: 'enviado tal cual', fr: 'envoyé tel quel', ru: 'отправлено как есть', zh: '已原样发送', ja: 'そのまま送信済み', pt: 'enviado como está', de: 'unverändert gesendet', ko: '그대로 보냄' },
  choiceUsed: { en: 'suggestion used', he: 'נעשה שימוש בהצעה', es: 'sugerencia usada', fr: 'suggestion utilisée', ru: 'взято предложение', zh: '已使用建议', ja: '提案を使用済み', pt: 'sugestão usada', de: 'Vorschlag genutzt', ko: '제안 사용함' },
  choiceEdit: { en: 'edited first', he: 'נערך קודם', es: 'editado antes', fr: 'modifié d\'abord', ru: 'сначала отредактировано', zh: '先编辑了', ja: '先に編集済み', pt: 'editado antes', de: 'zuerst bearbeitet', ko: '먼저 편집함' },
  choiceMute: { en: 'stopped asking', he: 'הפסקת שאלות', es: 'dejó de preguntar', fr: 'ne plus demander', ru: 'вопросы отключены', zh: '已不再询问', ja: '確認を停止済み', pt: 'parou de perguntar', de: 'Fragen beendet', ko: '묻기 중단됨' },
  choiceSkipped: { en: 'not asked', he: 'לא נשאל', es: 'sin preguntar', fr: 'non demandé', ru: 'не спрашивали', zh: '未询问', ja: '確認なし', pt: 'não perguntado', de: 'nicht gefragt', ko: '묻지 않음' },
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

type Missing = 'verb' | 'scope' | 'accept' | 'vague' | 'short'
type Choice = 'ok' | 'asIs' | 'used' | 'edit' | 'mute' | 'skipped'
type Entry = { at: number; score: number; snippet: string; choice: Choice }
type State = {
  muted: boolean
  ai: boolean
  /** Epoch ms of the last question, 0 when none was asked this session. */
  lastAskAt: number
  last: { score: number; missing: Missing[] } | null
  /** True from a low-score prompt sent as is until the turn it started completes. */
  flagged: boolean
  history: Entry[]
}

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'prompt-enhancer' } as const, {
  muted: false,
  ai: false,
  lastAskAt: 0,
  last: null,
  flagged: false,
  history: [],
} as State) as unknown as Atom<State>

export const feature: Feature = {
  id: 'prompt-enhancer',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

const COMMAND = 'enhance'
const PANE = 'prompt-enhancer'
const AI_KEY = 'prompt-enhancer:ai'
const MUTED_KEY = 'prompt-enhancer:muted'
/** A prompt scoring below this triggers the question. */
const THRESHOLD = 60
const MIN_WORDS = 4
const ASK_EVERY_MS = 5 * 60 * 1000
const MAX_HISTORY = 10
const AI_MODEL = 'claude-haiku-5-5'
const AI_MAX_WORDS = 80

// ---------------------------------------------------------------------------
// The heuristic. Pure functions: easy to explain, no model.
// ---------------------------------------------------------------------------

const hasHebrew = (text: string): boolean => /[֐-׿]/.test(text)

const wordsOf = (text: string): string[] => text.trim().split(/\s+/).filter(w => w !== '')

const tokensOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .map(w => w.replace(/^'+|'+$/g, ''))
    .filter(w => w !== '')

/** English verb stems accepted with a simple ending (add, adds, added, adding). */
const FIX_STEMS = 'fix|debug|repair|solv|resolv|patch|troubleshoot'
const ADD_STEMS = 'add|implement|creat|build|writ|generat|introduc|support|insert|enabl'
const REFACTOR_STEMS = 'refactor|rewrit|clean|simplif|renam|migrat|restructur|reorganiz|reorganis|extract|split|merg|dedupl'
const EXPLAIN_STEMS = 'explain|describ|summariz|summaris|document|walk'
const OTHER_STEMS =
  'investigat|test|updat|remov|delet|chang|make|mov|optimiz|optimis|review|convert|replac|improv|upgrad|analyz|analys|check|find|run|show|list|handl|install|deploy|configur|set|verify|audit|trac|log|print|return'
const ENDINGS = '(?:e|es|ed|d|s|ing|ting|ning|ging|ping|ming)?'
const verbRe = (stems: string): RegExp => new RegExp(`^(?:${stems})${ENDINGS}$`)
const FIX_RE = verbRe(FIX_STEMS)
const ADD_RE = verbRe(ADD_STEMS)
const REFACTOR_RE = verbRe(REFACTOR_STEMS)
const EXPLAIN_RE = verbRe(EXPLAIN_STEMS)
const ANY_VERB_RE = verbRe(`${FIX_STEMS}|${ADD_STEMS}|${REFACTOR_STEMS}|${EXPLAIN_STEMS}|${OTHER_STEMS}`)
/** Questions count as an intent: they ask for an explanation. */
const QUESTION_RE = /^(?:why|how|what|where|which)$/

const HE_FIX = ['תקן', 'תתקן', 'תקני', 'דבג', 'פתור', 'תפתור']
const HE_ADD = ['הוסף', 'תוסיף', 'הוסיפי', 'ממש', 'תממש', 'צור', 'תיצור', 'בנה', 'תבנה', 'כתוב', 'תכתוב', 'תכתבי', 'כתבי', 'הוסיף']
const HE_REFACTOR = ['שכתב', 'תשכתב', 'פשט', 'תפשט', 'ארגן', 'תארגן', 'שנה', 'תשנה', 'שנו', 'העבר', 'תעביר']
const HE_EXPLAIN = ['הסבר', 'תסביר', 'תסבירי', 'סכם', 'תסכם', 'תאר', 'תתאר', 'למה', 'איך', 'מה', 'איפה', 'האם']
const HE_OTHER = ['חקור', 'תחקור', 'בדוק', 'תבדוק', 'עדכן', 'תעדכן', 'הסר', 'תסיר', 'מחק', 'תמחק', 'שפר', 'תשפר', 'הרץ', 'תריץ', 'מצא', 'תמצא', 'הצג', 'תציג', 'בדקו', 'נתח', 'תנתח', 'המר', 'תמיר', 'החלף', 'תחליף', 'תבדקי']
const heIn = (word: string, list: readonly string[]): boolean => list.includes(word)

const isVerbWord = (word: string): boolean =>
  ANY_VERB_RE.test(word) ||
  QUESTION_RE.test(word) ||
  heIn(word, HE_FIX) ||
  heIn(word, HE_ADD) ||
  heIn(word, HE_REFACTOR) ||
  heIn(word, HE_EXPLAIN) ||
  heIn(word, HE_OTHER)

const SCOPE_EN = new Set([
  'file', 'files', 'path', 'paths', 'function', 'functions', 'method', 'methods', 'class', 'classes', 'module', 'modules',
  'component', 'components', 'endpoint', 'endpoints', 'route', 'routes', 'api', 'page', 'pages', 'script', 'scripts', 'config',
  'repo', 'repository', 'directory', 'folder', 'service', 'services', 'hook', 'hooks', 'handler', 'handlers', 'table', 'schema',
  'query', 'command', 'pane', 'feature', 'package', 'library', 'readme',
])
const SCOPE_HE = ['קובץ', 'קבצ', 'פונקצי', 'מודול', 'רכיב', 'קומפוננט', 'מחלק', 'תיקי', 'נתיב', 'דף', 'שירות', 'סקריפט', 'ממשק', 'טבלה', 'שאילתה']
const PATH_RE = /[\w.-]+[\\/][\w.\\/-]+/
const FILE_RE = /\b[\w-]+\.(?:tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|json|md|css|scss|html|ya?ml|toml|sh|c|h|cpp|cs|rb|php|sql|vue|svelte)\b/i
const CODE_RE = /`[^`]+`|\b[A-Za-z_$][\w$]*\(\)/

const hasScope = (text: string, tokens: readonly string[]): boolean =>
  PATH_RE.test(text) ||
  FILE_RE.test(text) ||
  CODE_RE.test(text) ||
  tokens.some(w => SCOPE_EN.has(w)) ||
  SCOPE_HE.some(w => text.includes(w))

const ACCEPT_RE =
  /\b(?:should|must|expected|expect|so that|when|then)\b|\btests?\s+(?:pass|passes|passing)\b|\b(?:pass|passing)\s+tests?\b|כך ש|צריך|אמור/i
const VAGUE_EN_RE = /\b(?:bug|bugs|issue|issues|broken|wrong)\b|doesn'?t work|does not work|isn'?t working|not working|\bsomething\b/i
const VAGUE_HE = ['משהו', 'לא עובד', 'באג', 'שבור', 'בעיה']

const hasVerb = (tokens: readonly string[]): boolean => tokens.some(isVerbWord)

export type Score = { score: number; missing: Missing[] }

/** The clarity score of a prompt and which parts are missing, or null when it is too short to judge. */
export function scorePrompt(text: string): Score | null {
  const trimmed = text.trim()
  const count = wordsOf(trimmed).length
  if (count < MIN_WORDS) return null
  const tokens = tokensOf(trimmed)
  const missing: Missing[] = []
  let score = 100
  if (!hasVerb(tokens)) {
    score -= 25
    missing.push('verb')
  }
  const scope = hasScope(trimmed, tokens)
  if (!scope) {
    score -= 20
    missing.push('scope')
  }
  if (!ACCEPT_RE.test(trimmed)) {
    score -= 20
    missing.push('accept')
  }
  const isVague = VAGUE_EN_RE.test(trimmed) || VAGUE_HE.some(w => trimmed.includes(w))
  if (isVague && !scope) {
    score -= 15
    missing.push('vague')
  }
  if (count < 8) {
    score -= 10
    missing.push('short')
  }
  return { score: Math.max(0, score), missing }
}

const SUGGESTION = {
  verb: T.sugVerb,
  scope: T.sugScope,
  accept: T.sugAccept,
  vague: T.sugVague,
  short: T.sugShort,
} as const

const suggestionText = (m: Missing): string => t(SUGGESTION[m])

// ---------------------------------------------------------------------------
// The rewrite: a template (no model), or a cheap model call when AI mode is on.
// ---------------------------------------------------------------------------

type Intent = 'fix' | 'add' | 'refactor' | 'explain'

function intentOf(tokens: readonly string[]): Intent {
  for (const w of tokens) {
    if (FIX_RE.test(w) || heIn(w, HE_FIX)) return 'fix'
    if (ADD_RE.test(w) || heIn(w, HE_ADD)) return 'add'
    if (REFACTOR_RE.test(w) || heIn(w, HE_REFACTOR)) return 'refactor'
    if (EXPLAIN_RE.test(w) || QUESTION_RE.test(w) || heIn(w, HE_EXPLAIN)) return 'explain'
  }
  return 'fix'
}

/** What the prompt is about: the text without its leading verb; the whole text, quoted, when it has none. */
function objectOf(text: string, isHebrew: boolean): string {
  let rest = text.trim().replace(/^(?:please|pls|can you|could you|would you|תוכל|בבקשה)\s+/i, '')
  const first = rest.split(/\s+/)[0] ?? ''
  const firstToken = first.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '')
  let isStripped = false
  if (first !== '' && isVerbWord(firstToken)) {
    rest = rest.slice(first.length).trim()
    isStripped = true
  }
  rest = rest.replace(/^לי\s+/, '').replace(/[\s.!?]+$/, '').replace(/[\s,]+(?:please|pls|בבקשה)$/i, '').replace(/[\s.!?]+$/, '')
  if (isHebrew) rest = rest.replace(/^את\s+/, '')
  if (rest.length > 160) rest = `${rest.slice(0, 157)}...`
  if (rest === '') return isHebrew ? 'הבעיה' : 'the problem'
  return isStripped ? rest : `"${rest}"`
}

// i18n-ignore: the rewrite follows the prompt's own script (Hebrew letters → he, else en), not the UI language.
const TEMPLATE: Record<Intent, { en: string; he: string }> = {
  fix: {
    en: 'Investigate {object}, reproduce it, identify the root cause, implement the smallest safe fix, run the relevant tests, avoid unrelated changes.',
    he: 'חקור את {object}, שחזר אותה, זהה את שורש הבעיה, ממש את התיקון הבטוח הקטן ביותר, הרץ את הבדיקות הרלוונטיות ואל תשנה דברים שלא קשורים.',
  },
  add: {
    en: 'Implement {object}: follow the existing code conventions, keep the change small, cover it with tests, run the relevant tests, avoid unrelated changes.',
    he: 'ממש {object}: עקוב אחר מוסכמות הקוד הקיימות, שמור על שינוי קטן, כסה אותו בבדיקות, הרץ את הבדיקות הרלוונטיות ואל תשנה דברים שלא קשורים.',
  },
  refactor: {
    en: 'Refactor {object} without changing its behaviour: keep the diff small, run the relevant tests before and after, avoid unrelated changes.',
    he: 'שכתב את {object} בלי לשנות את ההתנהגות: שמור על הבדל קטן, הרץ את הבדיקות הרלוונטיות לפני ואחרי ואל תשנה דברים שלא קשורים.',
  },
  explain: {
    en: 'Explain {object} in simple terms: what it does, how the parts fit together, with a short example. Do not change any files.',
    he: 'הסבר את {object} בפשטות: מה זה עושה, איך החלקים מתחברים, עם דוגמה קצרה. אל תשנה אף קובץ.',
  },
}

/** The template rewrite, in the prompt's language (Hebrew when it has Hebrew letters, else English). */
export function templateRewrite(text: string): string {
  const isHebrew = hasHebrew(text)
  const intent = intentOf(tokensOf(text))
  const pattern = TEMPLATE[intent][isHebrew ? 'he' : 'en']
  return pattern.replace('{object}', objectOf(text, isHebrew))
}

function cleanReply(raw: string): string {
  let out = raw.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim()
  const quoted = /^["“«'](.*)["”»']$/s.exec(out)
  if (quoted !== null) out = (quoted[1] ?? '').trim()
  const words = wordsOf(out)
  return words.length > AI_MAX_WORDS ? words.slice(0, AI_MAX_WORDS).join(' ') : words.join(' ')
}

function aiPrompt(text: string): string {
  return [
    'Rewrite the following prompt, written to a coding assistant, so it is clear and actionable.',
    'Preserve the intent exactly. Do not invent file names, requirements or details that are not there; where something is missing, phrase it as something to find out.',
    'Write in the same language as the prompt.',
    `At most ${AI_MAX_WORDS} words. Reply with the rewritten prompt only, no quotes, no commentary.`,
    '',
    'Prompt:',
    text.trim(),
  ].join('\n')
}

async function proposeRewrite($: EngineInterface, text: string, isAi: boolean): Promise<{ text: string; isAi: boolean }> {
  const fallback = { text: templateRewrite(text), isAi: false }
  if (!isAi) return fallback
  try {
    const reply = await $.model.complete({ model: AI_MODEL, prompt: aiPrompt(text), maxTokens: 300, timeoutMs: 20_000 })
    if (!reply.isAnswered) return fallback
    const clean = cleanReply(reply.text)
    return clean === '' ? fallback : { text: clean, isAi: true }
  } catch {
    return fallback
  }
}

// ---------------------------------------------------------------------------
// State changes
// ---------------------------------------------------------------------------

async function record($: EngineInterface, score: Score, text: string, choice: Choice): Promise<void> {
  const at = await $.clock.now()
  const snippet = text.trim().replace(/\s+/g, ' ').slice(0, 60)
  await update($, state, c => ({
    ...c,
    last: { score: score.score, missing: score.missing },
    history: [...c.history, { at, score: score.score, snippet, choice }].slice(-MAX_HISTORY),
  }))
}

async function setAi($: EngineInterface, isAi: boolean): Promise<void> {
  await update($, state, c => ({ ...c, ai: isAi }))
  await $.store.set(AI_KEY, isAi)
}

async function setMuted($: EngineInterface, isMuted: boolean): Promise<void> {
  await update($, state, c => ({ ...c, muted: isMuted }))
  await $.store.set(MUTED_KEY, isMuted)
}

async function clearHistory($: EngineInterface): Promise<void> {
  await update($, state, c => ({ ...c, history: [], last: null, flagged: false }))
}

async function toggleAi($: EngineInterface): Promise<void> {
  const s = await read($, state)
  await setAi($, !s.ai)
}

async function toggleMute($: EngineInterface): Promise<void> {
  const s = await read($, state)
  await setMuted($, !s.muted)
}

async function flag($: EngineInterface): Promise<void> {
  await update($, state, c => ({ ...c, flagged: true }))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: COMMAND, description: t(T.cmdDesc), argumentHint: t(T.cmdHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'enhance', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  // The AI choice lasts; the mute lasts only until the next session.
  const stored = await $.store.get(AI_KEY)
  await update($, state, c => ({ ...c, ai: stored === true, muted: false, lastAskAt: 0, flagged: false }))
  await $.store.set(MUTED_KEY, false)
  return
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) return
  const s = await read($, state)
  if (s.flagged) await update($, state, c => ({ ...c, flagged: false }))
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'> | { drop: string }> {
  if (!(await isOn($, feature))) return e
  const kind = e.origin === undefined ? 'composer' : e.origin.kind
  if (e.command !== undefined || e.isMeta === true || kind === 'plugin') return e
  const trimmed = e.text.trim()
  if (trimmed.startsWith('/') || trimmed.startsWith('!')) return e

  await update($, state, c => (c.flagged ? { ...c, flagged: false } : c))
  const scored = scorePrompt(trimmed)
  if (scored === null) return e

  if (scored.score >= THRESHOLD) {
    await record($, scored, trimmed, 'ok')
    return e
  }

  // Low score: ask, unless muted, capped, or the prompt did not come from a person at the keyboard.
  const s = await read($, state)
  const now = await $.clock.now()
  const isCapped = s.lastAskAt !== 0 && now - s.lastAskAt < ASK_EVERY_MS
  if (s.muted || isCapped || (kind !== 'composer' && kind !== 'bridge')) {
    await record($, scored, trimmed, 'skipped')
    return e
  }

  const proposal = await proposeRewrite($, trimmed, s.ai)
  const list = scored.missing
    .slice(0, 3)
    .map(m => `• ${suggestionText(m)}`)
    .join('\n')
  const question = t(T.askQuestion, {
    score: scored.score,
    list,
    head: t(proposal.isAi ? T.rewriteAi : T.rewriteTemplate),
    proposed: proposal.text,
  })
  await update($, state, c => ({ ...c, lastAskAt: now }))

  let answer: string
  try {
    answer = await $.ui.ask(question, { header: t(T.header), options: [t(T.optAsIs), t(T.optUse), t(T.optEdit), t(T.optStop)] })
  } catch {
    // Dismissed or nobody to ask: the prompt goes as the person wrote it.
    await record($, scored, trimmed, 'skipped')
    return e
  }

  if (answer === t(T.optUse)) {
    await record($, scored, trimmed, 'used')
    return { ...e, text: proposal.text }
  }
  if (answer === t(T.optEdit)) {
    const filled = await $.prompt.fill({ text: proposal.text, mode: 'replace' })
    if (filled.isFilled) {
      await record($, scored, trimmed, 'edit')
      return { drop: t(T.dropEdit) }
    }
    await notice($, 'warn', t(T.fillFailed), feature.id)
    await record($, scored, trimmed, 'asIs')
    await flag($)
    return e
  }
  if (answer === t(T.optStop)) {
    await setMuted($, true)
    await record($, scored, trimmed, 'mute')
    await flag($)
    await notice($, 'info', t(T.stopped), feature.id, { immediate: true })
    return e
  }
  // "Send as is", or anything else (free text typed under "Other"): send it untouched.
  await record($, scored, trimmed, 'asIs')
  await flag($)
  return e
}

/** The short band form: only right after a low-score prompt was sent as is, until its turn completes. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const s = await read($, state)
  if (!s.flagged || s.last === null) return null
  return { text: t(T.chip, { score: s.last.score }), level: 'warn', icon: ICONS.workflow }
}

// ---------------------------------------------------------------------------
// The command and the pane
// ---------------------------------------------------------------------------

const choiceText = (c: Choice): string => {
  if (c === 'ok') return t(T.choiceOk)
  if (c === 'asIs') return t(T.choiceAsIs)
  if (c === 'used') return t(T.choiceUsed)
  if (c === 'edit') return t(T.choiceEdit)
  if (c === 'mute') return t(T.choiceMute)
  return t(T.choiceSkipped)
}

function summaryText(s: State): string {
  const lines = [
    t(T.summaryHead),
    t(T.modeLine, {
      threshold: THRESHOLD,
      ai: s.ai ? t(T.wordOn) : t(T.wordOff),
      muted: s.muted ? t(T.mutedYes) : t(T.mutedNo),
    }),
  ]
  if (s.last === null) {
    lines.push(t(T.lastNone))
    return lines.join('\n')
  }
  lines.push(t(T.lastLine, { score: s.last.score }))
  if (s.last.missing.length === 0) lines.push(t(T.lastClear))
  for (const m of s.last.missing) lines.push(`• ${suggestionText(m)}`)
  return lines.join('\n')
}

export function register(on: On) {
  on('command.run', { command: 'enhance' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const parts = e.args.trim().toLowerCase().split(/\s+/).filter(p => p !== '')
    const sub = parts[0] ?? ''
    const s = await read($, state)

    if (sub === '') return { text: summaryText(s) }
    if (sub === 'ai') {
      const value = parts[1] ?? ''
      if (value === 'on' || value === 'off') {
        await setAi($, value === 'on')
        return { text: t(value === 'on' ? T.aiOn : T.aiOff) }
      }
      return { text: t(T.usageAi, { state: s.ai ? t(T.wordOn) : t(T.wordOff) }) }
    }
    if (sub === 'mute') {
      await setMuted($, true)
      return { text: t(T.muted) }
    }
    if (sub === 'unmute') {
      await setMuted($, false)
      return { text: t(T.unmuted) }
    }
    if (sub === 'pane') {
      await $.ui.open({ id: PANE, title: t(T.paneTitle) })
      return { text: t(T.paneOpened) }
    }
    return { text: t(T.usage) }
  })

  on('ui.render', { component: 'Pane', requestId: 'prompt-enhancer' }, async ($, e) => {
    const { Box } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.workflow })}
          {emptyState($, e, t(T.off))}
        </Box>
      )
    }

    const s = await read($, state)
    const now = await $.clock.now()
    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: s.last === null ? undefined : String(s.last.score),
      level: s.last !== null && s.last.score < THRESHOLD ? 'warn' : 'ok',
      icon: ICONS.workflow,
      actions: [
        { key: 'pe-ai', label: s.ai ? t(T.btnAiOff) : t(T.btnAiOn), onPress: () => void toggleAi($) },
        { key: 'pe-mute', label: s.muted ? t(T.btnUnmute) : t(T.btnMute), onPress: () => void toggleMute($) },
        { key: 'pe-clear', label: t(T.btnClear), onPress: () => void clearHistory($) },
      ],
    })

    if (s.history.length === 0) {
      return (
        <Box flexDirection="column">
          {header}
          {emptyState($, e, t(T.paneEmpty), t(T.paneHint))}
        </Box>
      )
    }

    const rows = [...s.history].reverse()
    return (
      <Box flexDirection="column">
        {header}
        {rows.map((row, i) =>
          listRow($, e, {
            key: `pe-row-${i}`,
            left: t(T.ago, { t: clockText(now - row.at) }),
            text: `${row.score} · ${row.snippet}`,
            right: choiceText(row.choice),
            level: row.score < THRESHOLD ? 'warn' : 'ok',
          }),
        )}
      </Box>
    )
  })
}
