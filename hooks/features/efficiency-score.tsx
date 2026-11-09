import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { BandInput, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { allEvidence, since } from '../evidence'
import { current } from '../signals'
import { ICONS, LEVEL_COLOR, emptyState, paneHeader, sectionTitle } from '../ui'
import type { Chip, Level } from '../ui'

/*
 * Efficiency score: a transparent 0-100 score per session and per week, built
 * only from the person's OWN history (no global ranking). Five dimensions of
 * 0-20 points, each with its formula printed next to it. Nothing rewards
 * consuming tokens and nothing punishes a big or complex task beyond the five
 * dimensions. Opt-in (defaultOn false).
 */

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Efficiency score', he: 'ציון יעילות', es: 'Puntuación de eficiencia', fr: 'Score d’efficacité', ru: 'Оценка эффективности', zh: '效率得分', ja: '効率スコア', pt: 'Pontuação de eficiência', de: 'Effizienz-Score', ko: '효율 점수' },
  description: {
    en: 'A transparent 0-100 score per session and per week from five dimensions, each with its formula shown. Based on your own history only; there is no global ranking. Off by default.',
    he: 'ציון שקוף 0-100 לכל סשן ולכל שבוע מחמישה מדדים, וכל מדד מוצג עם הנוסחה שלו. מבוסס על ההיסטוריה שלך בלבד, בלי דירוג גלובלי. כבוי כברירת מחדל.',
    es: 'Una puntuación transparente de 0 a 100 por sesión y por semana con cinco dimensiones, cada una con su fórmula visible. Se basa solo en tu propio historial; no hay ranking global. Desactivada por defecto.',
    fr: 'Un score transparent de 0 à 100 par session et par semaine, sur cinq dimensions dont la formule est affichée. Basé uniquement sur ton propre historique ; pas de classement global. Désactivé par défaut.',
    ru: 'Прозрачная оценка 0–100 за сессию и за неделю по пяти измерениям, у каждого показана формула. Основана только на вашей собственной истории, без общего рейтинга. По умолчанию выключена.',
    zh: '每个会话和每周的透明 0-100 分，由五个维度得出，并显示各自的计算公式。仅基于你自己的历史记录，没有全球排名。默认关闭。',
    ja: 'セッションごと・週ごとの 0〜100 の透明なスコアで、5 つの指標から算出し、それぞれの計算式を表示します。自分の履歴のみが対象で、世界ランキングはありません。デフォルトではオフです。',
    pt: 'Uma pontuação transparente de 0 a 100 por sessão e por semana, a partir de cinco dimensões, cada uma com sua fórmula visível. Baseada apenas no seu próprio histórico; não há ranking global. Desativada por padrão.',
    de: 'Ein transparenter Score von 0 bis 100 pro Session und pro Woche aus fünf Dimensionen, jeweils mit angezeigter Formel. Basiert nur auf deinem eigenen Verlauf; es gibt kein globales Ranking. Standardmäßig aus.',
    ko: '세션별·주별 0~100점의 투명한 점수로, 다섯 가지 항목에서 산출하며 항목마다 계산식을 보여줍니다. 본인의 기록만 기준으로 하며 전체 순위는 없습니다. 기본값은 꺼짐입니다.',
  },
  cmdDesc: { en: 'Shows your efficiency score and what is behind it', he: 'מציג את ציון היעילות שלך ומה עומד מאחוריו', es: 'Muestra tu puntuación de eficiencia y qué hay detrás', fr: 'Affiche ton score d’efficacité et ce qui le compose', ru: 'Показывает вашу оценку эффективности и из чего она состоит', zh: '显示你的效率得分及其构成', ja: '効率スコアとその内訳を表示します', pt: 'Mostra sua pontuação de eficiência e o que há por trás dela', de: 'Zeigt deinen Effizienz-Score und woraus er sich ergibt', ko: '효율 점수와 그 근거를 보여줍니다' },
  off: { en: 'Efficiency score is off. Turn it on in the /toolkitty pane.', he: 'ציון היעילות כבוי. הפעל אותו בלוח /toolkitty.', es: 'La puntuación de eficiencia está desactivada. Actívala en el panel /toolkitty.', fr: 'Le score d’efficacité est désactivé. Active-le dans le panneau /toolkitty.', ru: 'Оценка эффективности отключена. Включите её в панели /toolkitty.', zh: '效率得分已关闭。请在 /toolkitty 面板中开启。', ja: '効率スコアはオフです。/toolkitty ペインでオンにしてください。', pt: 'A pontuação de eficiência está desativada. Ative no painel /toolkitty.', de: 'Der Effizienz-Score ist aus. Schalte ihn im Panel /toolkitty ein.', ko: '효율 점수가 꺼져 있습니다. /toolkitty 창에서 켜세요.' },
  paneOff: { en: 'Efficiency score is off.', he: 'ציון היעילות כבוי.', es: 'La puntuación de eficiencia está desactivada.', fr: 'Le score d’efficacité est désactivé.', ru: 'Оценка эффективности отключена.', zh: '效率得分已关闭。', ja: '効率スコアはオフです。', pt: 'A pontuação de eficiência está desativada.', de: 'Der Effizienz-Score ist aus.', ko: '효율 점수가 꺼져 있습니다.' },
  opened: { en: 'Opened the efficiency score.', he: 'ציון היעילות נפתח.', es: 'Puntuación de eficiencia abierta.', fr: 'Score d’efficacité ouvert.', ru: 'Оценка эффективности открыта.', zh: '已打开效率得分。', ja: '効率スコアを開きました。', pt: 'Pontuação de eficiência aberta.', de: 'Effizienz-Score geöffnet.', ko: '효율 점수를 열었습니다.' },
  paneTitle: { en: 'Efficiency score', he: 'ציון יעילות', es: 'Puntuación de eficiencia', fr: 'Score d’efficacité', ru: 'Оценка эффективности', zh: '效率得分', ja: '効率スコア', pt: 'Pontuação de eficiência', de: 'Effizienz-Score', ko: '효율 점수' },
  basis: {
    en: 'Based on your own history only. There is no global ranking.',
    he: 'מבוסס על ההיסטוריה שלך בלבד. אין דירוג גלובלי.',
    es: 'Basado solo en tu propio historial. No hay ranking global.',
    fr: 'Basé uniquement sur ton propre historique. Pas de classement global.',
    ru: 'Основано только на вашей собственной истории. Общего рейтинга нет.',
    zh: '仅基于你自己的历史记录，没有全球排名。',
    ja: '自分の履歴のみが対象で、世界ランキングはありません。',
    pt: 'Baseada apenas no seu próprio histórico. Não há ranking global.',
    de: 'Basiert nur auf deinem eigenen Verlauf. Es gibt kein globales Ranking.',
    ko: '본인의 기록만 기준으로 하며 전체 순위는 없습니다.',
  },
  fairness: {
    en: 'Token use and task size are never scored, only the five dimensions below.',
    he: 'צריכת טוקנים וגודל המשימה אינם נספרים, רק חמשת המדדים שלמטה.',
    es: 'El uso de tokens y el tamaño de la tarea nunca puntúan, solo las cinco dimensiones de abajo.',
    fr: 'La consommation de tokens et la taille de la tâche ne comptent jamais, seulement les cinq dimensions ci-dessous.',
    ru: 'Расход токенов и размер задачи не оцениваются, только пять измерений ниже.',
    zh: 'token 用量和任务大小从不计分，只计下面五个维度。',
    ja: 'トークン使用量やタスクの大きさはスコアに含まれず、下の 5 つの指標だけが対象です。',
    pt: 'O uso de tokens e o tamanho da tarefa nunca entram na pontuação, apenas as cinco dimensões abaixo.',
    de: 'Token-Verbrauch und Aufgabengröße werden nie bewertet, nur die fünf Dimensionen unten.',
    ko: '토큰 사용량과 작업 크기는 점수에 반영되지 않으며, 아래 다섯 항목만 평가합니다.',
  },
  sessionTitle: { en: 'This session', he: 'הסשן הנוכחי', es: 'Esta sesión', fr: 'Cette session', ru: 'Эта сессия', zh: '本次会话', ja: 'このセッション', pt: 'Esta sessão', de: 'Diese Session', ko: '이번 세션' },
  weekTitle: { en: 'This week vs last week', he: 'השבוע מול שבוע שעבר', es: 'Esta semana frente a la pasada', fr: 'Cette semaine et la précédente', ru: 'Эта неделя и прошлая', zh: '本周与上周对比', ja: '今週と先週の比較', pt: 'Esta semana vs. semana passada', de: 'Diese Woche vs. letzte Woche', ko: '이번 주 vs 지난주' },
  empty: { en: 'No score yet.', he: 'עדיין אין ציון.', es: 'Aún no hay puntuación.', fr: 'Pas encore de score.', ru: 'Оценки пока нет.', zh: '暂无得分。', ja: 'まだスコアがありません。', pt: 'Ainda sem pontuação.', de: 'Noch kein Score.', ko: '아직 점수가 없습니다.' },
  emptyHint: { en: 'It appears after your first completed turn.', he: 'הוא יופיע אחרי התור הראשון שיסתיים.', es: 'Aparece tras tu primer turno completado.', fr: 'Il apparaît après ton premier tour terminé.', ru: 'Появится после первого завершённого хода.', zh: '完成第一轮对话后显示。', ja: '最初のターンが完了すると表示されます。', pt: 'Aparece após o primeiro turno concluído.', de: 'Erscheint nach deinem ersten abgeschlossenen Durchgang.', ko: '첫 턴이 끝나면 표시됩니다.' },
  // the five dimensions: label, formula (printed), and the facts behind this session's number
  dupLabel: { en: 'Duplicate work', he: 'עבודה כפולה', es: 'Trabajo duplicado', fr: 'Travail en double', ru: 'Повторная работа', zh: '重复工作', ja: '重複作業', pt: 'Trabalho duplicado', de: 'Doppelte Arbeit', ko: '중복 작업' },
  dupFormula: {
    en: 'Formula: 20 × (1 − repeats per 100 calls ÷ 10). 0 per 100 gives 20, 10 or more gives 0 (at least 20 calls counted).',
    he: 'נוסחה: 20 × (1 − חזרות ל-100 קריאות ÷ 10). 0 ל-100 נותן 20, 10 ומעלה נותן 0 (נספרות לפחות 20 קריאות).',
    es: 'Fórmula: 20 × (1 − repeticiones por 100 llamadas ÷ 10). 0 por 100 da 20, 10 o más da 0 (se cuentan al menos 20 llamadas).',
    fr: 'Formule : 20 × (1 − répétitions pour 100 appels ÷ 10). 0 pour 100 donne 20, 10 ou plus donne 0 (au moins 20 appels comptés).',
    ru: 'Формула: 20 × (1 − повторов на 100 вызовов ÷ 10). 0 на 100 даёт 20, 10 и больше даёт 0 (учитывается минимум 20 вызовов).',
    zh: '公式：20 × (1 − 每 100 次调用的重复数 ÷ 10)。每 100 次 0 次得 20 分，10 次及以上得 0 分（至少统计 20 次调用）。',
    ja: '計算式：20 × (1 − 100 回あたりの重複数 ÷ 10)。100 回あたり 0 なら 20、10 以上なら 0（20 回以上の呼び出しが対象）。',
    pt: 'Fórmula: 20 × (1 − repetições por 100 chamadas ÷ 10). 0 por 100 dá 20; 10 ou mais dá 0 (mínimo de 20 chamadas contadas).',
    de: 'Formel: 20 × (1 − Wiederholungen pro 100 Aufrufe ÷ 10). 0 pro 100 ergibt 20, 10 oder mehr ergibt 0 (mindestens 20 Aufrufe gezählt).',
    ko: '공식: 20 × (1 − 100회 호출당 반복 횟수 ÷ 10). 100회당 0이면 20점, 10 이상이면 0점 (호출 20회 이상부터 집계).',
  },
  dupFacts: { en: '{n} repeats in {calls} calls ({rate} per 100)', he: '{n} חזרות ב-{calls} קריאות ({rate} ל-100)', es: '{n} repeticiones en {calls} llamadas ({rate} por 100)', fr: '{n} répétitions en {calls} appels ({rate} pour 100)', ru: 'повторов: {n} за {calls} вызовов ({rate} на 100)', zh: '{calls} 次调用中重复 {n} 次（每 100 次 {rate}）', ja: '{calls} 回の呼び出しで {n} 回重複（100 回あたり {rate}）', pt: '{n} repetições em {calls} chamadas ({rate} por 100)', de: '{n} Wiederholungen bei {calls} Aufrufen ({rate} pro 100)', ko: '호출 {calls}회 중 {n}회 반복 (100회당 {rate})' },
  failLabel: { en: 'Repeated failures', he: 'כשלים חוזרים', es: 'Fallos repetidos', fr: 'Échecs répétés', ru: 'Повторные сбои', zh: '重复失败', ja: '繰り返しの失敗', pt: 'Falhas repetidas', de: 'Wiederholte Fehler', ko: '반복 실패' },
  failFormula: {
    en: 'Formula: 20 − 2 per failed tool call − 5 per loop, never below 0. No failures or loops gives 20.',
    he: 'נוסחה: 20 − 2 לכל קריאת כלי שנכשלה − 5 לכל לולאה, לא פחות מ-0. בלי כשלים ולולאות מקבלים 20.',
    es: 'Fórmula: 20 − 2 por llamada fallida − 5 por bucle, nunca menos de 0. Sin fallos ni bucles da 20.',
    fr: 'Formule : 20 − 2 par appel d’outil échoué − 5 par boucle, jamais sous 0. Sans échec ni boucle : 20.',
    ru: 'Формула: 20 − 2 за каждый неудачный вызов − 5 за каждый цикл, не ниже 0. Без сбоев и циклов даёт 20.',
    zh: '公式：20 − 每次失败的工具调用 2 分 − 每个循环 5 分，最低为 0。没有失败或循环则得 20 分。',
    ja: '計算式：20 − 失敗したツール呼び出し 1 回につき 2 − ループ 1 つにつき 5、下限は 0。失敗もループもなければ 20。',
    pt: 'Fórmula: 20 − 2 por chamada de ferramenta com falha − 5 por loop, nunca abaixo de 0. Sem falhas nem loops, dá 20.',
    de: 'Formel: 20 − 2 pro fehlgeschlagenem Tool-Aufruf − 5 pro Schleife, nie unter 0. Ohne Fehler und Schleifen ergibt das 20.',
    ko: '공식: 20 − 실패한 도구 호출당 2 − 루프당 5, 최소 0. 실패나 루프가 없으면 20점.',
  },
  failFacts: { en: '{f} failed calls, {l} loops', he: '{f} קריאות שנכשלו, {l} לולאות', es: '{f} llamadas fallidas, {l} bucles', fr: '{f} appels échoués, {l} boucles', ru: 'неудачных вызовов: {f}, циклов: {l}', zh: '失败调用 {f} 次，循环 {l} 个', ja: '失敗 {f} 回、ループ {l} 件', pt: '{f} chamadas com falha, {l} loops', de: '{f} fehlgeschlagene Aufrufe, {l} Schleifen', ko: '실패한 호출 {f}회, 루프 {l}개' },
  ctxLabel: { en: 'Context management', he: 'ניהול הקשר', es: 'Gestión del contexto', fr: 'Gestion du contexte', ru: 'Управление контекстом', zh: '上下文管理', ja: 'コンテキスト管理', pt: 'Gestão de contexto', de: 'Kontextverwaltung', ko: '컨텍스트 관리' },
  ctxFormula: {
    en: 'Formula: average context health ÷ 80 × 20. 80 or more gives 20.',
    he: 'נוסחה: ממוצע בריאות ההקשר ÷ 80 × 20. 80 ומעלה נותן 20.',
    es: 'Fórmula: salud media del contexto ÷ 80 × 20. 80 o más da 20.',
    fr: 'Formule : santé moyenne du contexte ÷ 80 × 20. 80 ou plus donne 20.',
    ru: 'Формула: среднее здоровье контекста ÷ 80 × 20. 80 и выше даёт 20.',
    zh: '公式：平均上下文健康度 ÷ 80 × 20。达到 80 及以上得 20 分。',
    ja: '計算式：平均コンテキスト健全度 ÷ 80 × 20。80 以上で 20。',
    pt: 'Fórmula: saúde média do contexto ÷ 80 × 20. 80 ou mais dá 20.',
    de: 'Formel: durchschnittliche Kontextgesundheit ÷ 80 × 20. 80 oder mehr ergibt 20.',
    ko: '공식: 평균 컨텍스트 상태 ÷ 80 × 20. 80 이상이면 20점.',
  },
  ctxFacts: { en: 'average health {n}', he: 'בריאות ממוצעת {n}', es: 'salud media {n}', fr: 'santé moyenne {n}', ru: 'среднее здоровье {n}', zh: '平均健康度 {n}', ja: '平均健全度 {n}', pt: 'saúde média {n}', de: 'Ø Gesundheit {n}', ko: '평균 상태 {n}' },
  ctxNone: { en: 'no health reading yet, full marks', he: 'עדיין אין קריאת בריאות, ציון מלא', es: 'aún sin lectura de salud, nota completa', fr: 'pas encore de mesure, note maximale', ru: 'замеров пока нет, полный балл', zh: '暂无健康度读数，记满分', ja: '健全度の測定値がまだないため満点', pt: 'ainda sem leitura de saúde, nota máxima', de: 'noch kein Gesundheitswert, volle Punktzahl', ko: '상태 측정값이 아직 없어 만점' },
  verLabel: { en: 'Verification', he: 'אימות', es: 'Verificación', fr: 'Vérification', ru: 'Проверка', zh: '验证', ja: '検証', pt: 'Verificação', de: 'Verifizierung', ko: '검증' },
  verFormula: {
    en: 'Formula: 20 × share of file-changing turns with a passing test, build, lint or typecheck. 100% gives 20.',
    he: 'נוסחה: 20 × שיעור התורים ששינו קבצים ושבהם עברו בדיקות, בנייה, lint או typecheck. 100% נותן 20.',
    es: 'Fórmula: 20 × proporción de turnos que cambian archivos con una prueba, compilación, lint o typecheck correctos. 100% da 20.',
    fr: 'Formule : 20 × part des tours modifiant des fichiers avec un test, build, lint ou typecheck réussi. 100 % donne 20.',
    ru: 'Формула: 20 × доля ходов с изменением файлов, где прошли тесты, сборка, lint или typecheck. 100% даёт 20.',
    zh: '公式：20 × 修改文件的轮次中，测试、构建、lint 或类型检查通过的占比。100% 得 20 分。',
    ja: '計算式：20 × ファイルを変更したターンのうち、テスト・ビルド・lint・型チェックが通った割合。100% で 20。',
    pt: 'Fórmula: 20 × proporção de turnos que alteram arquivos com teste, build, lint ou typecheck aprovado. 100% dá 20.',
    de: 'Formel: 20 × Anteil der Durchgänge mit Dateiänderungen, in denen Test, Build, Lint oder Typprüfung bestanden wurde. 100 % ergibt 20.',
    ko: '공식: 20 × 파일을 변경한 턴 중 테스트·빌드·린트·타입 검사를 통과한 비율. 100%이면 20점.',
  },
  verFacts: { en: '{v} of {c} file-changing turns verified', he: '{v} מתוך {c} תורים ששינו קבצים אומתו', es: '{v} de {c} turnos con cambios verificados', fr: '{v} des {c} tours avec modifications vérifiés', ru: 'проверено ходов с изменениями: {v} из {c}', zh: '修改文件的 {c} 轮中已验证 {v} 轮', ja: 'ファイルを変更した {c} ターン中 {v} ターンを検証済み', pt: '{v} de {c} turnos com alteração de arquivos verificados', de: '{v} von {c} Durchgängen mit Dateiänderungen verifiziert', ko: '파일을 변경한 {c}개 턴 중 {v}개 검증됨' },
  verNone: { en: 'no file-changing turns, full marks', he: 'אין תורים ששינו קבצים, ציון מלא', es: 'sin turnos que cambien archivos, nota completa', fr: 'aucun tour modifiant des fichiers, note maximale', ru: 'ходов с изменениями нет, полный балл', zh: '没有修改文件的轮次，记满分', ja: 'ファイルを変更したターンがないため満点', pt: 'nenhum turno alterou arquivos, nota máxima', de: 'keine Durchgänge mit Dateiänderungen, volle Punktzahl', ko: '파일을 변경한 턴이 없어 만점' },
  budLabel: { en: 'Budget awareness', he: 'מודעות לתקציב', es: 'Conciencia del presupuesto', fr: 'Maîtrise du budget', ru: 'Контроль бюджета', zh: '预算意识', ja: '予算の意識', pt: 'Controle de orçamento', de: 'Budgetbewusstsein', ko: '예산 관리' },
  budFormula: {
    en: 'Formula: 20 while the budget stayed at or under 90%, falling to 0 at 100%. A weekly window at 95% or more gives 0.',
    he: 'נוסחה: 20 כל עוד התקציב נשאר עד 90%, יורד ל-0 ב-100%. חלון שבועי ב-95% ומעלה נותן 0.',
    es: 'Fórmula: 20 mientras el presupuesto no pasó del 90%, bajando a 0 en el 100%. Una ventana semanal al 95% o más da 0.',
    fr: 'Formule : 20 tant que le budget reste à 90 % ou moins, jusqu’à 0 à 100 %. Une fenêtre hebdomadaire à 95 % ou plus donne 0.',
    ru: 'Формула: 20, пока бюджет не превышал 90%, снижается до 0 при 100%. Недельное окно от 95% даёт 0.',
    zh: '公式：预算保持在 90% 及以下得 20 分，到 100% 时降为 0。每周额度达到 95% 及以上则得 0 分。',
    ja: '計算式：予算が 90% 以下なら 20、100% に向かって 0 まで下がります。週枠が 95% 以上なら 0。',
    pt: 'Fórmula: 20 enquanto o orçamento ficou em 90% ou menos, caindo a 0 em 100%. Uma janela semanal em 95% ou mais dá 0.',
    de: 'Formel: 20, solange das Budget bei höchstens 90 % blieb, fällt bei 100 % auf 0. Ein Wochenfenster ab 95 % ergibt 0.',
    ko: '공식: 예산이 90% 이하면 20점, 100%에서 0점까지 내려갑니다. 주간 한도가 95% 이상이면 0점.',
  },
  budFacts: { en: 'peak {n}%', he: 'שיא {n}%', es: 'máximo {n}%', fr: 'pic {n} %', ru: 'пик {n}%', zh: '峰值 {n}%', ja: 'ピーク {n}%', pt: 'pico {n}%', de: 'Spitze {n} %', ko: '최고 {n}%' },
  budNone: { en: 'no budget reading, full marks', he: 'אין קריאת תקציב, ציון מלא', es: 'sin lectura de presupuesto, nota completa', fr: 'pas de mesure de budget, note maximale', ru: 'замеров бюджета нет, полный балл', zh: '暂无预算读数，记满分', ja: '予算の測定値がないため満点', pt: 'sem leitura de orçamento, nota máxima', de: 'kein Budgetwert, volle Punktzahl', ko: '예산 측정값이 없어 만점' },
  points: { en: '{n}/20', he: '{n}/20', es: '{n}/20', fr: '{n}/20', ru: '{n}/20', zh: '{n}/20', ja: '{n}/20', pt: '{n}/20', de: '{n}/20', ko: '{n}/20' },
  total: { en: '{n}/100', he: '{n}/100', es: '{n}/100', fr: '{n}/100', ru: '{n}/100', zh: '{n}/100', ja: '{n}/100', pt: '{n}/100', de: '{n}/100', ko: '{n}/100' },
  weekLine: { en: 'This week {a} · last week {b}', he: 'השבוע {a} · שבוע שעבר {b}', es: 'Esta semana {a} · la pasada {b}', fr: 'Cette semaine {a} · la précédente {b}', ru: 'Эта неделя {a} · прошлая {b}', zh: '本周 {a} · 上周 {b}', ja: '今週 {a} · 先週 {b}', pt: 'Esta semana {a} · semana passada {b}', de: 'Diese Woche {a} · letzte Woche {b}', ko: '이번 주 {a} · 지난주 {b}' },
  noData: { en: '–', he: '–', es: '–', fr: '–', ru: '–', zh: '–', ja: '–', pt: '–', de: '–', ko: '–' },
  rankImproving: { en: 'Improving', he: 'משתפר', es: 'Mejorando', fr: 'En progrès', ru: 'Улучшается', zh: '提升中', ja: '向上中', pt: 'Melhorando', de: 'Besser', ko: '상승 중' },
  rankSteady: { en: 'Steady', he: 'יציב', es: 'Estable', fr: 'Stable', ru: 'Стабильно', zh: '稳定', ja: '安定', pt: 'Estável', de: 'Stabil', ko: '유지' },
  rankSlipping: { en: 'Slipping', he: 'בירידה', es: 'Empeorando', fr: 'En recul', ru: 'Снижается', zh: '下滑中', ja: '低下中', pt: 'Piorando', de: 'Schlechter', ko: '하락 중' },
  rankNote: { en: 'Compared with your own last week, by 5 points or more.', he: 'בהשוואה לשבוע שעבר שלך, בהפרש של 5 נקודות ומעלה.', es: 'Comparado con tu propia semana pasada, a partir de 5 puntos.', fr: 'Comparé à ta propre semaine précédente, à partir de 5 points.', ru: 'По сравнению с вашей прошлой неделей, от 5 баллов.', zh: '与你自己的上周相比，相差 5 分及以上。', ja: '自分の先週と比べて 5 ポイント以上の差。', pt: 'Em comparação com a sua semana passada, por 5 pontos ou mais.', de: 'Im Vergleich zu deiner letzten Woche, um 5 Punkte oder mehr.', ko: '본인의 지난주와 비교해 5점 이상 차이.' },
  titlePower: { en: 'Power User', he: 'משתמש־על', es: 'Usuario avanzado', fr: 'Utilisateur expert', ru: 'Опытный пользователь', zh: '高级用户', ja: 'パワーユーザー', pt: 'Usuário avançado', de: 'Power-User', ko: '파워 유저' },
  titleCraft: { en: 'Craftsperson', he: 'ידי זהב', es: 'Artesano', fr: 'Artisan', ru: 'Мастер', zh: '匠人', ja: '職人', pt: 'Artesão', de: 'Handwerkskunst', ko: '장인' },
  titleExplorer: { en: 'Explorer', he: 'חוקר', es: 'Explorador', fr: 'Explorateur', ru: 'Исследователь', zh: '探索者', ja: 'エクスプローラー', pt: 'Explorador', de: 'Entdecker', ko: '탐험가' },
  titleLine: { en: 'Title: {title}', he: 'תואר: {title}', es: 'Título: {title}', fr: 'Titre : {title}', ru: 'Титул: {title}', zh: '称号：{title}', ja: '称号：{title}', pt: 'Título: {title}', de: 'Titel: {title}', ko: '칭호: {title}' },
  chip: { en: '⚡ {n}', he: '⚡ {n}', es: '⚡ {n}', fr: '⚡ {n}', ru: '⚡ {n}', zh: '⚡ {n}', ja: '⚡ {n}', pt: '⚡ {n}', de: '⚡ {n}', ko: '⚡ {n}' },
  copy: { en: 'Copy', he: 'העתק', es: 'Copiar', fr: 'Copier', ru: 'Копировать', zh: '复制', ja: 'コピー', pt: 'Copiar', de: 'Kopieren', ko: '복사' },
  copied: { en: 'Efficiency score copied', he: 'ציון היעילות הועתק', es: 'Puntuación copiada', fr: 'Score copié', ru: 'Оценка скопирована', zh: '已复制效率得分', ja: '効率スコアをコピーしました', pt: 'Pontuação de eficiência copiada', de: 'Effizienz-Score kopiert', ko: '효율 점수를 복사했습니다' },
  copyFailed: { en: 'Could not copy', he: 'ההעתקה נכשלה', es: 'No se pudo copiar', fr: 'Copie impossible', ru: 'Не удалось скопировать', zh: '无法复制', ja: 'コピーできませんでした', pt: 'Não foi possível copiar', de: 'Kopieren nicht möglich', ko: '복사할 수 없습니다' },
  copyHead: { en: 'My efficiency score (from my own history): {n}/100 · {title}', he: 'ציון היעילות שלי (מההיסטוריה שלי): {n}/100 · {title}', es: 'Mi puntuación de eficiencia (de mi propio historial): {n}/100 · {title}', fr: 'Mon score d’efficacité (selon mon historique) : {n}/100 · {title}', ru: 'Моя оценка эффективности (по моей истории): {n}/100 · {title}', zh: '我的效率得分（基于我自己的历史记录）：{n}/100 · {title}', ja: '私の効率スコア（自分の履歴ベース）：{n}/100 · {title}', pt: 'Minha pontuação de eficiência (do meu próprio histórico): {n}/100 · {title}', de: 'Mein Effizienz-Score (aus meinem eigenen Verlauf): {n}/100 · {title}', ko: '내 효율 점수 (내 기록 기준): {n}/100 · {title}' },
} as const

type DimId = 'dup' | 'fail' | 'ctx' | 'ver' | 'bud'
type Days = Record<string, Record<string, number>>
type State = {
  sid: string
  turns: number
  turnAt: number
  turnChanged: boolean
  calls: number
  waste: number
  failures: number
  loops: number
  ctxSum: number
  ctxN: number
  budgetPeak: number | null
  weeklyPeak: number | null
  changed: number
  verified: number
  days: Days
}
type Dim = { id: DimId; points: number; facts: string }
type Rank = 'improving' | 'steady' | 'slipping'

const fresh = (sid: string, days: Days): State => ({
  sid,
  turns: 0,
  turnAt: 0,
  turnChanged: false,
  calls: 0,
  waste: 0,
  failures: 0,
  loops: 0,
  ctxSum: 0,
  ctxN: 0,
  budgetPeak: null,
  weeklyPeak: null,
  changed: 0,
  verified: 0,
  days,
})

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'efficiency-score' } as const, fresh('', {}) as State) as unknown as Atom<State>

type Health = { score: number; at: number }
// The shared slot context-doctor writes (same ref as there).
const health = atom({ plugin: 'toolkitty', key: 'slot', id: 'context-health' } as const, { score: 100, at: 0 } as Health) as unknown as Atom<Health>

export const feature: Feature = {
  id: 'efficiency-score',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

const PANE_ID = 'efficiency'
const DAYS_KEY = 'efficiency-score:days'
const DAY_MS = 86_400_000
const KEEP_DAYS = 28
const KEEP_SESSIONS_PER_DAY = 40
const MIN_CALLS = 20
const BAR = 20
const EDIT_TOOLS: readonly string[] = ['Edit', 'MultiEdit', 'Write', 'NotebookEdit']
const VERIFY_KINDS: readonly string[] = ['test', 'build', 'lint', 'typecheck', 'run']

// ---------- days and weeks ----------

const pad2 = (n: number): string => String(n).padStart(2, '0')

function dayKeyOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function dayIndex(key: string): number {
  const parts = key.split('-').map(Number)
  return Math.floor(Date.UTC(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS)
}

/** Drops days older than four weeks and caps the sessions kept per day. */
function pruneDays(days: Days, now: number): Days {
  const today = dayIndex(dayKeyOf(now))
  const out: Days = {}
  for (const [key, sessions] of Object.entries(days)) {
    if (today - dayIndex(key) >= KEEP_DAYS) continue
    out[key] = Object.fromEntries(Object.entries(sessions).slice(-KEEP_SESSIONS_PER_DAY))
  }
  return out
}

/** The mean of every session score from `from` to `to` days ago (inclusive), or null when there are none. */
function windowMean(days: Days, now: number, from: number, to: number): number | null {
  const today = dayIndex(dayKeyOf(now))
  let sum = 0
  let n = 0
  for (const [key, sessions] of Object.entries(days)) {
    const ago = today - dayIndex(key)
    if (ago < from || ago > to) continue
    for (const score of Object.values(sessions)) {
      sum += score
      n++
    }
  }
  return n === 0 ? null : Math.round(sum / n)
}

function rankOf(week: number | null, last: number | null): Rank {
  if (week === null || last === null) return 'steady'
  if (week - last >= 5) return 'improving'
  if (last - week >= 5) return 'slipping'
  return 'steady'
}

const rankText = (r: Rank): string => t(r === 'improving' ? T.rankImproving : r === 'slipping' ? T.rankSlipping : T.rankSteady)
const titleText = (score: number): string => t(score >= 85 ? T.titlePower : score >= 70 ? T.titleCraft : T.titleExplorer)

// ---------- the score ----------

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

function dimsOf(s: State): Dim[] {
  const rate = (s.waste / Math.max(s.calls, MIN_CALLS)) * 100
  const dup = Math.round(20 * (1 - Math.min(rate, 10) / 10))

  const fail = Math.max(0, 20 - 2 * s.failures - 5 * s.loops)

  const avg = s.ctxN === 0 ? null : s.ctxSum / s.ctxN
  const ctx = avg === null ? 20 : Math.round(avg >= 80 ? 20 : clamp((avg / 80) * 20, 0, 20))

  const ver = s.changed === 0 ? 20 : Math.round(clamp((20 * s.verified) / s.changed, 0, 20))

  const peak = Math.max(s.budgetPeak ?? 0, s.weeklyPeak ?? 0)
  const hasBudget = s.budgetPeak !== null || s.weeklyPeak !== null
  const bud = !hasBudget ? 20 : (s.weeklyPeak ?? 0) >= 95 ? 0 : peak <= 90 ? 20 : Math.round(clamp(20 - 2 * (peak - 90), 0, 20))

  return [
    { id: 'dup', points: dup, facts: t(T.dupFacts, { n: s.waste, calls: s.calls, rate: rate.toFixed(1) }) },
    { id: 'fail', points: fail, facts: t(T.failFacts, { f: s.failures, l: s.loops }) },
    { id: 'ctx', points: ctx, facts: avg === null ? t(T.ctxNone) : t(T.ctxFacts, { n: Math.round(avg) }) },
    { id: 'ver', points: ver, facts: s.changed === 0 ? t(T.verNone) : t(T.verFacts, { v: s.verified, c: s.changed }) },
    { id: 'bud', points: bud, facts: hasBudget ? t(T.budFacts, { n: Math.round(peak) }) : t(T.budNone) },
  ]
}

const totalOf = (dims: readonly Dim[]): number => dims.reduce((a, d) => a + d.points, 0)

const LABELS = { dup: T.dupLabel, fail: T.failLabel, ctx: T.ctxLabel, ver: T.verLabel, bud: T.budLabel } as const
const FORMULAS = { dup: T.dupFormula, fail: T.failFormula, ctx: T.ctxFormula, ver: T.verFormula, bud: T.budFormula } as const

type Summary = { dims: Dim[]; session: number; week: number | null; last: number | null; rank: Rank; headline: number }

function summaryOf(s: State, now: number): Summary {
  const dims = dimsOf(s)
  const session = totalOf(dims)
  const week = windowMean(s.days, now, 0, 6)
  const last = windowMean(s.days, now, 7, 13)
  return { dims, session, week, last, rank: rankOf(week, last), headline: week ?? session }
}

function levelOfPoints(points: number): Level {
  return points >= 16 ? 'info' : points >= 8 ? 'warn' : 'alert'
}

const levelOfTotal = (total: number): Level => (total >= 80 ? 'info' : total >= 50 ? 'warn' : 'alert')

function copyText(sum: Summary): string {
  const lines = [t(T.copyHead, { n: sum.headline, title: titleText(sum.headline) })]
  for (const d of sum.dims) lines.push(`${t(LABELS[d.id])}: ${t(T.points, { n: d.points })} (${d.facts})`)
  lines.push(t(T.weekLine, { a: sum.week ?? t(T.noData), b: sum.last ?? t(T.noData) }) + ` · ${rankText(sum.rank)}`)
  return lines.join('\n')
}

// ---------- drawing ----------

/** The five bars, each with its formula line and the facts behind this session's number. */
function barsOf($: EngineInterface, e: PaneInput, dims: readonly Dim[]): RenderElement {
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      {dims.map(d => (
        <Box key={`eff-${d.id}`} flexDirection="column" marginTop={1}>
          <Box gap={1}>
            <Text bold>{t(LABELS[d.id])}</Text>
            <Text color={LEVEL_COLOR[levelOfPoints(d.points)]}>{'█'.repeat(d.points) + '░'.repeat(BAR - d.points)}</Text>
            <Text>{t(T.points, { n: d.points })}</Text>
          </Box>
          <Text dimColor size="footnote">
            {d.facts}
          </Text>
          <Text dimColor size="footnote">
            {t(FORMULAS[d.id])}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

// ---------- session bookkeeping ----------

async function startSession($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const days = pruneDays(await storeGet<Days>($, DAYS_KEY, {}), now)
  await update($, state, () => fresh(String(now), days))
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'efficiency', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'efficiency', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  await startSession($)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  if ((await read($, state)).sid === '') await startSession($)
  const now = await $.clock.now()
  await update($, state, s => ({ ...s, turns: s.turns + 1, turnAt: now, turnChanged: false }))
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (result.deny !== undefined) return result
  const name: string = e.tool
  const isEdit = EDIT_TOOLS.includes(name) && result.isError !== true
  await update($, state, s => ({ ...s, calls: s.calls + 1, turnChanged: s.turnChanged || isEdit }))
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  const now = await $.clock.now()
  if ((await read($, state)).sid === '') await startSession($)
  const before = await read($, state)

  // what the other features say, as signals
  let waste = 0
  let failed = 0
  let isLooping = false
  let budget: number | null = null
  let weekly: number | null = null
  for (const sg of await current($, now)) {
    if (sg.kind === 'waste') waste += sg.value ?? 0
    else if (sg.kind === 'failure' && sg.at >= before.turnAt) failed = Math.max(failed, sg.value ?? 1)
    else if (sg.kind === 'loop' && sg.at >= before.turnAt) isLooping = true
    else if (sg.kind === 'budget' && sg.value !== undefined) budget = Math.max(budget ?? 0, sg.value)
    else if (sg.kind === 'quota' && sg.value !== undefined && /(^|:)(7d|weekly)/i.test(sg.id)) weekly = Math.max(weekly ?? 0, sg.value)
  }
  const ctx = await read($, health)

  // facts, not claims: a changed-files turn counts as verified only with an ok test/build/lint/typecheck record
  let isVerified = false
  if (before.turnChanged) {
    const records = since(await allEvidence($), before.turnAt)
    isVerified = records.some(r => r.ok && VERIFY_KINDS.includes(r.kind))
  }

  await update($, state, s => ({
    ...s,
    waste: Math.max(s.waste, waste),
    failures: s.failures + failed,
    loops: s.loops + (isLooping ? 1 : 0),
    ctxSum: ctx.at === 0 ? s.ctxSum : s.ctxSum + ctx.score,
    ctxN: ctx.at === 0 ? s.ctxN : s.ctxN + 1,
    budgetPeak: budget === null ? s.budgetPeak : Math.max(s.budgetPeak ?? 0, budget),
    weeklyPeak: weekly === null ? s.weeklyPeak : Math.max(s.weeklyPeak ?? 0, weekly),
    changed: s.changed + (s.turnChanged ? 1 : 0),
    verified: s.verified + (s.turnChanged && isVerified ? 1 : 0),
    turnChanged: false,
  }))

  // the day's record: this session's score replaces its earlier one
  const after = await read($, state)
  const score = totalOf(dimsOf(after))
  const key = dayKeyOf(now)
  const days = pruneDays({ ...after.days, [key]: { ...(after.days[key] ?? {}), [after.sid]: score } }, now)
  await update($, state, s => ({ ...s, days }))
  try {
    await storeSet($, DAYS_KEY, days)
  } catch {
    // the score still lives in memory
  }
}

// ---------- band ----------

/** "⚡ 87", only on the first turn of a session (it goes when the second turn starts). */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const s = await read($, state)
  if (s.turns !== 1) return null
  const sum = summaryOf(s, await $.clock.now())
  return { text: t(T.chip, { n: sum.headline }), level: 'info', icon: ICONS.insight }
}

/** What a press on the chip shows: the five bars with their formulas. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<RenderElement | null> {
  if (!(await isOn($, feature))) return null
  const s = await read($, state)
  const sum = summaryOf(s, await $.clock.now())
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      <Text bold>{`${t(T.total, { n: sum.session })} · ${t(T.sessionTitle)}`}</Text>
      {barsOf($, e, sum.dims)}
      <Text dimColor size="footnote">
        {t(T.basis)}
      </Text>
    </Box>
  )
}

// ---------- pane ----------

export function register(on: On) {
  on('command.run', { command: 'efficiency' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'efficiency' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.insight })}
          {emptyState($, e, t(T.paneOff))}
        </Box>
      )
    }

    const s = await read($, state)
    const now = await $.clock.now()
    const sum = summaryOf(s, now)
    if (s.turns === 0 && sum.week === null) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.insight })}
          <Text dimColor>{t(T.basis)}</Text>
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
        </Box>
      )
    }

    const share = copyText(sum)
    const surface = e.surface
    const isSession = s.turns > 0
    const shownScore = isSession ? sum.session : (sum.week ?? 0)
    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: t(T.total, { n: shownScore }),
          level: levelOfTotal(shownScore),
          icon: ICONS.insight,
          actions: [
            {
              key: 'efficiency-copy',
              label: t(T.copy),
              onPress: () => {
                $.ui.copy({ text: share, surface }).then(
                  r => notice($, r.isCopied ? 'info' : 'warn', r.isCopied ? t(T.copied) : t(T.copyFailed), feature.id, { immediate: true }),
                  () => notice($, 'warn', t(T.copyFailed), feature.id, { immediate: true }),
                )
              },
            },
          ],
        })}
        <Text dimColor>{t(T.basis)}</Text>
        <Text dimColor size="footnote">
          {t(T.fairness)}
        </Text>
        {isSession ? sectionTitle($, e, t(T.sessionTitle)) : null}
        {isSession ? barsOf($, e, sum.dims) : null}
        {sectionTitle($, e, t(T.weekTitle))}
        <Text>{t(T.weekLine, { a: sum.week ?? t(T.noData), b: sum.last ?? t(T.noData) })}</Text>
        <Box gap={1}>
          <Text bold color={sum.rank === 'slipping' ? 'warning' : 'claude'}>
            {rankText(sum.rank)}
          </Text>
          <Text dimColor size="footnote">
            {t(T.rankNote)}
          </Text>
        </Box>
        <Text bold>{t(T.titleLine, { title: titleText(sum.headline) })}</Text>
      </Box>
    )
  })
}
