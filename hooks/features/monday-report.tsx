import { atom, read } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement } from 'claude-code'

import { clockText, isOn, notice, storeGet, storeSet, t } from '../core'
import type { Feature, Input, PaneInput } from '../core'
import { ICONS, emptyState, paneHeader, sectionTitle } from '../ui'
import type { Incident } from '../shared'
import { dismissLabel, dismissSupport, supportFooter } from './about'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Weekly report', he: 'דוח שבועי', es: 'Informe semanal', fr: 'Rapport hebdomadaire', ru: 'Недельный отчёт', zh: '每周报告', ja: '週次レポート', pt: 'Relatório semanal', de: 'Wochenbericht', ko: '주간 보고서' },
  description: {
    en: 'A weekly recap that reads like a letter: hours, turns, cost, what Toolkitty saved and stopped. Opens once a week; /report shows it any time.',
    he: 'סיכום שבועי שנקרא כמו מכתב: שעות, תורים, עלות, ומה Toolkitty חסך ועצר. נפתח פעם בשבוע; /report מציג אותו בכל עת.',
    es: 'Un resumen semanal que se lee como una carta: horas, turnos, costo y lo que Toolkitty ahorró y evitó. Se abre una vez por semana; /report lo muestra cuando quieras.',
    fr: 'Un bilan hebdomadaire qui se lit comme une lettre : heures, tours, coût, ce que Toolkitty a économisé et évité. S\'ouvre une fois par semaine ; /report l\'affiche à tout moment.',
    ru: 'Недельный итог в форме письма: часы, ходы, стоимость, что Toolkitty сэкономил и предотвратил. Открывается раз в неделю; /report показывает его в любой момент.',
    zh: '像一封信一样的每周回顾：时长、轮数、花费，以及 Toolkitty 帮你节省和拦截了什么。每周打开一次；随时可用 /report 查看。',
    ja: '手紙のように読める週次の振り返り：時間、ターン数、コスト、Toolkitty が節約したことと防いだこと。週に 1 回開き、/report でいつでも表示できます。',
    pt: 'Um resumo semanal escrito como uma carta: horas, turnos, custo, o que o Toolkitty economizou e barrou. Abre uma vez por semana; /report mostra a qualquer momento.',
    de: 'Ein Wochenrückblick, der sich wie ein Brief liest: Stunden, Durchgänge, Kosten, was Toolkitty gespart und gestoppt hat. Öffnet sich einmal pro Woche; /report zeigt ihn jederzeit.',
    ko: '편지처럼 읽히는 주간 요약: 시간, 턴 수, 비용, Toolkitty가 아끼고 막은 것. 주 1회 열리며 /report로 언제든 볼 수 있습니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  cmdDesc: { en: 'Opens your report for the last 7 days', he: 'פותח את הדוח שלך ל-7 הימים האחרונים', es: 'Abre tu informe de los últimos 7 días', fr: 'Ouvre ton rapport des 7 derniers jours', ru: 'Открывает ваш отчёт за последние 7 дней', zh: '打开你最近 7 天的报告', ja: '過去 7 日間のレポートを開きます', pt: 'Abre seu relatório dos últimos 7 dias', de: 'Öffnet deinen Bericht für die letzten 7 Tage', ko: '최근 7일 보고서를 엽니다' },
  opened: { en: 'Opened your weekly report.', he: 'הדוח השבועי נפתח.', es: 'Informe semanal abierto.', fr: 'Rapport hebdomadaire ouvert.', ru: 'Недельный отчёт открыт.', zh: '已打开你的每周报告。', ja: '週次レポートを開きました。', pt: 'Relatório semanal aberto.', de: 'Dein Wochenbericht wurde geöffnet.', ko: '주간 보고서를 열었습니다.' },
  paneTitle: { en: 'Your week with Toolkitty', he: 'השבוע שלך עם Toolkitty', es: 'Tu semana con Toolkitty', fr: 'Ta semaine avec Toolkitty', ru: 'Ваша неделя с Toolkitty', zh: '你与 Toolkitty 的一周', ja: 'Toolkitty と過ごした今週', pt: 'Sua semana com o Toolkitty', de: 'Deine Woche mit Toolkitty', ko: 'Toolkitty와 함께한 한 주' },
  paneOff: { en: 'The weekly report is off.', he: 'הדוח השבועי כבוי.', es: 'El informe semanal está desactivado.', fr: 'Le rapport hebdomadaire est désactivé.', ru: 'Недельный отчёт выключен.', zh: '每周报告已关闭。', ja: '週次レポートはオフです。', pt: 'O relatório semanal está desativado.', de: 'Der Wochenbericht ist aus.', ko: '주간 보고서가 꺼져 있습니다.' },
  empty: { en: 'No activity recorded in the last 7 days yet. Come back after a few sessions.', he: 'עדיין לא נרשמה פעילות ב-7 הימים האחרונים. חזור אחרי כמה סשנים.', es: 'Aún no hay actividad en los últimos 7 días. Vuelve tras unas cuantas sesiones.', fr: 'Aucune activité enregistrée ces 7 derniers jours. Reviens après quelques sessions.', ru: 'За последние 7 дней активности пока нет. Загляните после нескольких сессий.', zh: '最近 7 天还没有记录到任何活动。几次会话之后再来看看。', ja: '過去 7 日間の記録はまだありません。数セッション後にまた見に来てください。', pt: 'Nenhuma atividade registrada nos últimos 7 dias. Volte depois de algumas sessões.', de: 'In den letzten 7 Tagen wurde noch keine Aktivität erfasst. Komm nach ein paar Sessions wieder.', ko: '최근 7일간 기록된 활동이 아직 없습니다. 몇 번 작업한 뒤에 다시 오세요.' },
  emptyHint: { en: 'Work in a few sessions and the report fills in; /report opens it any time.', he: 'עבוד בכמה סשנים והדוח יתמלא; ‎/report פותח אותו בכל עת.', es: 'Trabaja en unas sesiones y el informe se llenará; /report lo abre cuando quieras.', fr: "Travaille quelques sessions et le rapport se remplira ; /report l’ouvre à tout moment.", ru: 'Поработайте несколько сессий, и отчёт заполнится; /report открывает его в любой момент.', zh: '在几个会话中工作后，报告就会充实起来；随时可用 /report 打开。', ja: '数セッション作業するとレポートが埋まっていきます。/report でいつでも開けます。', pt: 'Trabalhe em algumas sessões e o relatório se preenche; /report abre a qualquer momento.', de: 'Arbeite in ein paar Sessions, dann füllt sich der Bericht; /report öffnet ihn jederzeit.', ko: '몇 번 작업하면 보고서가 채워집니다. /report로 언제든 열 수 있습니다.' },
  copy: { en: 'Copy', he: 'העתק', es: 'Copiar', fr: 'Copier', ru: 'Копировать', zh: '复制', ja: 'コピー', pt: 'Copiar', de: 'Kopieren', ko: '복사' },
  copied: { en: 'Report copied', he: 'הדוח הועתק', es: 'Informe copiado', fr: 'Rapport copié', ru: 'Отчёт скопирован', zh: '已复制报告', ja: 'レポートをコピーしました', pt: 'Relatório copiado', de: 'Bericht kopiert', ko: '보고서를 복사했습니다' },
  copyFailed: { en: 'Could not copy the report', he: 'לא ניתן להעתיק את הדוח', es: 'No se pudo copiar el informe', fr: 'Impossible de copier le rapport', ru: 'Не удалось скопировать отчёт', zh: '无法复制报告', ja: 'レポートをコピーできませんでした', pt: 'Não foi possível copiar o relatório', de: 'Der Bericht konnte nicht kopiert werden', ko: '보고서를 복사할 수 없습니다' },
  toastReady: { en: 'Your weekly Toolkitty report is ready: /report', he: 'הדוח השבועי של Toolkitty מוכן: /report', es: 'Tu informe semanal de Toolkitty está listo: /report', fr: 'Ton rapport hebdomadaire Toolkitty est prêt : /report', ru: 'Недельный отчёт Toolkitty готов: /report', zh: '你的 Toolkitty 每周报告已准备好：/report', ja: 'Toolkitty の週次レポートの準備ができました：/report', pt: 'Seu relatório semanal do Toolkitty está pronto: /report', de: 'Dein Toolkitty-Wochenbericht ist fertig: /report', ko: 'Toolkitty 주간 보고서가 준비되었습니다: /report' },
  dows: { en: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat', he: 'א׳,ב׳,ג׳,ד׳,ה׳,ו׳,ש׳', es: 'dom,lun,mar,mié,jue,vie,sáb', fr: 'dim,lun,mar,mer,jeu,ven,sam', ru: 'вс,пн,вт,ср,чт,пт,сб', zh: '周日,周一,周二,周三,周四,周五,周六', ja: '日,月,火,水,木,金,土', pt: 'dom,seg,ter,qua,qui,sex,sáb', de: 'So,Mo,Di,Mi,Do,Fr,Sa', ko: '일,월,화,수,목,금,토' },
  bigHours: { en: 'hours', he: 'שעות', es: 'horas', fr: 'heures', ru: 'часов', zh: '小时', ja: '時間', pt: 'horas', de: 'Stunden', ko: '시간' },
  bigTurns: { en: 'turns', he: 'תורים', es: 'turnos', fr: 'tours', ru: 'ходов', zh: '轮', ja: 'ターン', pt: 'turnos', de: 'Durchgänge', ko: '턴' },
  bigTokens: { en: 'tokens', he: 'טוקנים', es: 'tokens', fr: 'tokens', ru: 'токенов', zh: 'token', ja: 'トークン', pt: 'tokens', de: 'Tokens', ko: '토큰' },
  bigCost: { en: 'spent', he: 'עלות', es: 'gastado', fr: 'dépensé', ru: 'потрачено', zh: '花费', ja: 'コスト', pt: 'gasto', de: 'ausgegeben', ko: '사용 비용' },
  doneHead: { en: 'What Toolkitty did for you', he: 'מה Toolkitty עשה בשבילך', es: 'Lo que Toolkitty hizo por ti', fr: 'Ce que Toolkitty a fait pour toi', ru: 'Что Toolkitty сделал для вас', zh: 'Toolkitty 为你做了什么', ja: 'Toolkitty があなたのためにしたこと', pt: 'O que o Toolkitty fez por você', de: 'Was Toolkitty für dich getan hat', ko: 'Toolkitty가 해 준 일' },
  doneNothing: { en: 'Nothing to report yet, which is also fine.', he: 'אין עדיין מה לדווח, וגם זה בסדר.', es: 'Nada que informar todavía, y eso también está bien.', fr: 'Rien à signaler pour l\'instant, et c\'est très bien.', ru: 'Пока сообщать нечего, и это тоже хорошо.', zh: '暂时没有可报告的内容，这也没关系。', ja: 'まだ報告することはありません。それも問題ありません。', pt: 'Nada a reportar ainda, e tudo bem.', de: 'Noch nichts zu berichten, das ist auch in Ordnung.', ko: '아직 보고할 내용이 없습니다. 그것도 괜찮습니다.' },
  doneSaved: { en: 'Kept about {tokens} tokens ({usd}) out of the context', he: 'הרחיק בערך {tokens} טוקנים ({usd}) מההקשר', es: 'Mantuvo unos {tokens} tokens ({usd}) fuera del contexto', fr: 'A gardé environ {tokens} tokens ({usd}) hors du contexte', ru: 'Не пустил в контекст около {tokens} токенов ({usd})', zh: '让约 {tokens} 个 token（{usd}）没有进入上下文', ja: '約 {tokens} トークン（{usd}）をコンテキストに入れずに済ませました', pt: 'Manteve cerca de {tokens} tokens ({usd}) fora do contexto', de: 'Hat etwa {tokens} Tokens ({usd}) aus dem Kontext herausgehalten', ko: '약 {tokens} 토큰({usd})을 컨텍스트에 넣지 않았습니다' },
  doneIncidents: { en: 'Stopped {n} incidents: {parts}', he: 'עצר {n} אירועים: {parts}', es: 'Evitó {n} incidentes: {parts}', fr: 'A évité {n} incidents : {parts}', ru: 'Предотвратил инцидентов: {n} ({parts})', zh: '拦截了 {n} 起事件：{parts}', ja: '{n} 件のインシデントを防ぎました：{parts}', pt: 'Barrou {n} incidentes: {parts}', de: 'Hat {n} Vorfälle gestoppt: {parts}', ko: '사고 {n}건을 막았습니다: {parts}' },
  doneLoops: { en: 'Caught {n} loops before they ate your budget', he: 'תפס {n} לולאות לפני שאכלו לך את התקציב', es: 'Detectó {n} bucles antes de que se comieran tu presupuesto', fr: 'A repéré {n} boucles avant qu’elles ne mangent ton budget', ru: 'Поймал зацикливаний: {n}, пока они не съели бюджет', zh: '抓住了 {n} 个循环，没让它们吃掉你的预算', ja: '予算を食いつぶす前に {n} 件のループを検出しました', pt: 'Pegou {n} loops antes que consumissem seu orçamento', de: 'Hat {n} Schleifen erkannt, bevor sie dein Budget aufgefressen haben', ko: '예산을 갉아먹기 전에 루프 {n}건을 잡아냈습니다' },
  partSecrets: { en: '{n} secrets', he: '{n} סודות', es: '{n} secretos', fr: '{n} secrets', ru: 'секреты: {n}', zh: '{n} 个密钥', ja: 'シークレット {n} 件', pt: '{n} segredos', de: '{n} Secrets', ko: '시크릿 {n}건' },
  partDestructive: { en: '{n} destructive commands', he: '{n} פקודות הרסניות', es: '{n} comandos destructivos', fr: '{n} commandes destructrices', ru: 'разрушительные команды: {n}', zh: '{n} 个破坏性命令', ja: '破壊的コマンド {n} 件', pt: '{n} comandos destrutivos', de: '{n} destruktive Befehle', ko: '파괴적인 명령 {n}건' },
  partEdits: { en: '{n} risky edits', he: '{n} עריכות מסוכנות', es: '{n} ediciones arriesgadas', fr: '{n} modifications risquées', ru: 'рискованные правки: {n}', zh: '{n} 次高风险编辑', ja: '危険な編集 {n} 件', pt: '{n} edições arriscadas', de: '{n} riskante Änderungen', ko: '위험한 편집 {n}건' },
  partCi: { en: '{n} merges on red CI', he: '{n} מיזוגים על CI אדום', es: '{n} fusiones con CI en rojo', fr: '{n} fusions sur CI rouge', ru: 'слияния при красном CI: {n}', zh: '{n} 次红色 CI 合并', ja: '赤い CI でのマージ {n} 件', pt: '{n} merges com CI vermelho', de: '{n} Merges bei roter CI', ko: '빨간 CI 머지 {n}건' },
  partInjection: { en: '{n} prompt injections', he: '{n} הזרקות פרומפט', es: '{n} inyecciones de prompt', fr: '{n} injections de prompt', ru: 'инъекции в промпт: {n}', zh: '{n} 次提示注入', ja: 'プロンプトインジェクション {n} 件', pt: '{n} injeções de prompt', de: '{n} Prompt-Injections', ko: '프롬프트 인젝션 {n}건' },
  partOther: { en: '{n} other', he: '{n} אחרים', es: '{n} otros', fr: '{n} autres', ru: 'прочее: {n}', zh: '其他 {n}', ja: 'その他 {n}', pt: '{n} outros', de: '{n} weitere', ko: '기타 {n}건' },
  busiest: { en: 'Busiest day', he: 'היום העמוס ביותר', es: 'Día más activo', fr: 'Jour le plus chargé', ru: 'Самый загруженный день', zh: '最忙的一天', ja: '最も忙しかった日', pt: 'Dia mais movimentado', de: 'Aktivster Tag', ko: '가장 바빴던 날' },
  busiestVal: { en: '{day}, {n} turns', he: '{day}, {n} תורים', es: '{day}, {n} turnos', fr: '{day}, {n} tours', ru: '{day}, ходов: {n}', zh: '{day}，{n} 轮', ja: '{day}、{n} ターン', pt: '{day}, {n} turnos', de: '{day}, {n} Durchgänge', ko: '{day}, {n}턴' },
  topTools: { en: 'Top tools', he: 'הכלים המובילים', es: 'Herramientas más usadas', fr: 'Outils les plus utilisés', ru: 'Главные инструменты', zh: '最常用工具', ja: 'よく使ったツール', pt: 'Ferramentas mais usadas', de: 'Meistgenutzte Tools', ko: '가장 많이 쓴 도구' },
  longest: { en: 'Longest turn', he: 'התור הארוך ביותר', es: 'Turno más largo', fr: 'Tour le plus long', ru: 'Самый долгий ход', zh: '最长的一轮', ja: '最長のターン', pt: 'Turno mais longo', de: 'Längster Durchgang', ko: '가장 긴 턴' },
  perDay: { en: 'Turns per day', he: 'תורים ליום', es: 'Turnos por día', fr: 'Tours par jour', ru: 'Ходов по дням', zh: '每天轮数', ja: '1 日あたりのターン数', pt: 'Turnos por dia', de: 'Durchgänge pro Tag', ko: '하루당 턴 수' },
  none: { en: 'none', he: 'אין', es: 'ninguna', fr: 'aucun', ru: 'нет', zh: '无', ja: 'なし', pt: 'nenhum', de: 'keine', ko: '없음' },
  letter: {
    en: 'Hi,\n\nHere is your week with Toolkitty ({from} to {to}).\n\nYou worked about {hours} hours across {turns} turns, using {tokens} tokens ({cost}). Your busiest day was {busiest}, and your longest turn took {longest}. Most used tools: {tools}.\n\nWhat Toolkitty did for you:\n{list}',
    he: 'שלום,\n\nהנה השבוע שלך עם Toolkitty ({from} עד {to}).\n\nעבדת בערך {hours} שעות ב-{turns} תורים, עם {tokens} טוקנים ({cost}). היום העמוס ביותר היה {busiest}, והתור הארוך ביותר נמשך {longest}. הכלים הנפוצים ביותר: {tools}.\n\nמה Toolkitty עשה בשבילך:\n{list}',
    es: 'Hola:\n\nAquí está tu semana con Toolkitty ({from} a {to}).\n\nTrabajaste unas {hours} horas en {turns} turnos, con {tokens} tokens ({cost}). Tu día más activo fue {busiest}, y tu turno más largo duró {longest}. Herramientas más usadas: {tools}.\n\nLo que Toolkitty hizo por ti:\n{list}',
    fr: 'Bonjour,\n\nVoici ta semaine avec Toolkitty ({from} au {to}).\n\nTu as travaillé environ {hours} heures sur {turns} tours, avec {tokens} tokens ({cost}). Ton jour le plus chargé était {busiest}, et ton tour le plus long a duré {longest}. Outils les plus utilisés : {tools}.\n\nCe que Toolkitty a fait pour toi :\n{list}',
    ru: 'Здравствуйте!\n\nВот ваша неделя с Toolkitty (с {from} по {to}).\n\nВы работали около {hours} ч, ходов: {turns}, токенов: {tokens} ({cost}). Самый загруженный день: {busiest}, самый долгий ход длился {longest}. Чаще всего использовались: {tools}.\n\nЧто Toolkitty сделал для вас:\n{list}',
    zh: '你好，\n\n这是你与 Toolkitty 的一周（{from} 至 {to}）。\n\n你在 {turns} 轮中工作了约 {hours} 小时，使用了 {tokens} 个 token（{cost}）。最忙的一天是 {busiest}，最长的一轮用了 {longest}。最常用的工具：{tools}。\n\nToolkitty 为你做了什么：\n{list}',
    ja: 'こんにちは。\n\nToolkitty と過ごした今週（{from} 〜 {to}）です。\n\n{turns} ターンで約 {hours} 時間作業し、{tokens} トークン（{cost}）を使いました。最も忙しかった日は {busiest}、最長のターンは {longest} でした。よく使ったツール：{tools}。\n\nToolkitty があなたのためにしたこと：\n{list}',
    pt: 'Olá,\n\nEsta é a sua semana com o Toolkitty ({from} a {to}).\n\nVocê trabalhou cerca de {hours} horas em {turns} turnos, usando {tokens} tokens ({cost}). Seu dia mais movimentado foi {busiest}, e seu turno mais longo levou {longest}. Ferramentas mais usadas: {tools}.\n\nO que o Toolkitty fez por você:\n{list}',
    de: 'Hallo,\n\nhier ist deine Woche mit Toolkitty ({from} bis {to}).\n\nDu hast etwa {hours} Stunden in {turns} Turns gearbeitet und {tokens} Token ({cost}) verbraucht. Dein aktivster Tag war {busiest}, und dein längster Turn dauerte {longest}. Meistgenutzte Tools: {tools}.\n\nWas Toolkitty für dich getan hat:\n{list}',
    ko: '안녕하세요,\n\nToolkitty와 함께한 한 주입니다({from} ~ {to}).\n\n{turns}턴 동안 약 {hours}시간 작업했고, {tokens} 토큰({cost})을 사용했습니다. 가장 바빴던 날은 {busiest}, 가장 긴 턴은 {longest}가 걸렸습니다. 가장 많이 쓴 도구: {tools}.\n\nToolkitty가 해 준 일:\n{list}',
  },
} as const

export const feature: Feature = {
  id: 'monday-report',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

// The same slot loop-detective writes (ref and initial value are the same literal); only `caught` is read here.
type LoopCaught = { kind: string; desc: string; at: number }
type LoopState = { caught: LoopCaught[] }
const loops = atom({ plugin: 'toolkitty', key: 'slot', id: 'loop-detective' } as const, { window: [], nudge: null, caught: [], toasted: {} } as LoopState) as unknown as Atom<LoopState>

type Day = { turns: number; ms: number; tokens: number; cost: number }
type Money = { tokens: number; usd: number }
type Extra = {
  loops: Record<string, number>
  longest: Record<string, number>
  tools: Record<string, Record<string, number>>
  loopsAt: number
}
type Family = 'secrets' | 'destructive' | 'edits' | 'ci' | 'injection' | 'other'
type Report = {
  from: string
  to: string
  labels: string[]
  hours: number
  turns: number
  tokens: number
  cost: number
  savedTokens: number
  savedUsd: number
  incidentTotal: number
  incidents: Record<Family, number>
  loops: number
  daily: number[]
  busiest: { label: string; turns: number } | null
  tools: { name: string; n: number }[]
  longestMs: number
}

const PANE_ID = 'monday-report'
const EXTRA_KEY = 'monday-report:extra'
const LAST_SHOWN_KEY = 'monday-report:lastShown'
const DAY_MS = 86_400_000
const KEEP_DAYS = 21
const INSTALL_LINE = 'claude plugin install toolkitty --marketplace avraham-tech/toolkitty'
const FAMILIES: readonly Family[] = ['secrets', 'destructive', 'edits', 'ci', 'injection', 'other']
const FAMILY_TEXT = {
  secrets: T.partSecrets,
  destructive: T.partDestructive,
  edits: T.partEdits,
  ci: T.partCi,
  injection: T.partInjection,
  other: T.partOther,
} as const
const CHART_ROWS = 6

const EMPTY_EXTRA: Extra = { loops: {}, longest: {}, tools: {}, loopsAt: 0 }

const pad2 = (n: number): string => String(n).padStart(2, '0')

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** `ms` moved by `days` calendar days, kept at noon so daylight saving cannot shift the date. */
function shift(ms: number, days: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12).getTime()
}

/** The ISO 8601 week of `ms`, as "2026-W45". */
function isoWeek(ms: number): string {
  const d = new Date(ms)
  const day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dow = day.getUTCDay() === 0 ? 7 : day.getUTCDay()
  day.setUTCDate(day.getUTCDate() + 4 - dow)
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((day.getTime() - yearStart) / DAY_MS + 1) / 7)
  return `${day.getUTCFullYear()}-W${pad2(week)}`
}

function compact(n: number): string {
  const fix = (v: number, unit: string): string => `${v.toFixed(1).replace(/\.0$/, '')}${unit}`
  if (n >= 1e9) return fix(n / 1e9, 'B')
  if (n >= 1e6) return fix(n / 1e6, 'M')
  if (n >= 1e3) return fix(n / 1e3, 'K')
  return String(Math.round(n))
}

const money = (usd: number): string => `$${usd.toFixed(2)}`
const hoursText = (ms: number): string => (ms / 3_600_000).toFixed(1).replace(/\.0$/, '')

function familyOf(kind: string): Family {
  if (['secret-file', 'pasted-secret', 'commit-secret'].includes(kind)) return 'secrets'
  if (['dangerous-command', 'blast-radius'].includes(kind)) return 'destructive'
  if (['branch-lock', 'scope'].includes(kind)) return 'edits'
  if (kind === 'ci-red') return 'ci'
  if (kind === 'injection') return 'injection'
  return 'other'
}

function incidentParts(r: Report): string {
  return FAMILIES.filter(f => r.incidents[f] > 0)
    .map(f => t(FAMILY_TEXT[f], { n: r.incidents[f] }))
    .join(', ')
}

/** Everything the report says, from the stores the other features keep. */
async function gather($: EngineInterface): Promise<Report> {
  const now = await $.clock.now()
  const keys: string[] = []
  for (let i = 6; i >= 0; i--) keys.push(dayKey(shift(now, -i)))
  const startKey = keys[0] ?? dayKey(now)
  const dows = t(T.dows).split(',')
  const labels = keys.map((_k, i) => dows[new Date(shift(now, i - 6)).getDay()] ?? '')

  const days = await storeGet<Record<string, Day>>($, 'week-heatmap:days', {})
  const tools = await storeGet<Record<string, number>>($, 'week-heatmap:tools', {})
  const saved = await storeGet<Record<string, Money>>($, 'savings:days', {})
  const extra = await storeGet<Extra>($, EXTRA_KEY, EMPTY_EXTRA)

  let ms = 0
  let turns = 0
  let tokens = 0
  let cost = 0
  let savedTokens = 0
  let savedUsd = 0
  let longestMs = 0
  let loopCount = 0
  const daily: number[] = []
  for (const k of keys) {
    const d = days[k]
    const turnsToday = d?.turns ?? 0
    daily.push(turnsToday)
    ms += d?.ms ?? 0
    turns += turnsToday
    tokens += d?.tokens ?? 0
    cost += d?.cost ?? 0
    savedTokens += saved[k]?.tokens ?? 0
    savedUsd += saved[k]?.usd ?? 0
    longestMs = Math.max(longestMs, extra.longest[k] ?? 0)
    loopCount += extra.loops[k] ?? 0
  }

  // The heatmap keeps all-time tool counts; the week's are the counts now minus the last snapshot from before the week.
  const before = Object.keys(extra.tools)
    .filter(k => k < startKey)
    .sort()
    .pop()
  const base = before === undefined ? {} : (extra.tools[before] ?? {})
  const topTools = Object.keys(tools)
    .map(name => ({ name, n: (tools[name] ?? 0) - (base[name] ?? 0) }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)

  const incidents: Record<Family, number> = { secrets: 0, destructive: 0, edits: 0, ci: 0, injection: 0, other: 0 }
  let incidentTotal = 0
  try {
    const cwd = await $.session.cwd()
    const stored = await storeGet<{ count: number; items: Incident[] }>($, `incidents:${cwd}`, { count: 0, items: [] })
    for (const i of stored.items) {
      if (now - i.at > 7 * DAY_MS) continue
      incidents[familyOf(i.kind)]++
      incidentTotal++
    }
  } catch {
    // no working directory: no incidents to count
  }

  let busiest: Report['busiest'] = null
  for (let i = 0; i < daily.length; i++) {
    const n = daily[i] ?? 0
    if (n > 0 && (busiest === null || n > busiest.turns)) busiest = { label: labels[i] ?? '', turns: n }
  }

  return {
    from: startKey,
    to: dayKey(now),
    labels,
    hours: ms,
    turns,
    tokens,
    cost,
    savedTokens,
    savedUsd,
    incidentTotal,
    incidents,
    loops: loopCount,
    daily,
    busiest,
    tools: topTools,
    longestMs,
  }
}

/** The "what Toolkitty did for you" lines, in the language in use. */
function doneLines(r: Report): string[] {
  const out: string[] = []
  if (r.savedTokens > 0) out.push(t(T.doneSaved, { tokens: compact(r.savedTokens), usd: money(r.savedUsd) }))
  if (r.incidentTotal > 0) out.push(t(T.doneIncidents, { n: r.incidentTotal, parts: incidentParts(r) }))
  if (r.loops > 0) out.push(t(T.doneLoops, { n: r.loops }))
  return out
}

const busiestText = (r: Report): string => (r.busiest === null ? t(T.none) : t(T.busiestVal, { day: r.busiest.label, n: r.busiest.turns }))
const toolsText = (r: Report): string => (r.tools.length === 0 ? t(T.none) : r.tools.map(x => `${x.name} (${x.n})`).join(', '))

/** The plain-text letter, also what the Copy button shares and the terminal shows. */
function letterText(r: Report): string {
  if (r.turns === 0) return `${t(T.empty)}\n\n${INSTALL_LINE}`
  const lines = doneLines(r)
  const body = t(T.letter, {
    from: r.from,
    to: r.to,
    hours: hoursText(r.hours),
    turns: r.turns,
    tokens: compact(r.tokens),
    cost: money(r.cost),
    busiest: busiestText(r),
    longest: r.longestMs > 0 ? clockText(r.longestMs) : t(T.none),
    tools: toolsText(r),
    list: (lines.length === 0 ? [t(T.doneNothing)] : lines).map(l => `- ${l}`).join('\n'),
  })
  return `${body}\n\n${INSTALL_LINE}`
}

/** The one optional support line (only once the About feature says it is due): dim text and a Dismiss button. */
function supportLine($: EngineInterface, e: PaneInput): RenderElement | null {
  const text = supportFooter()
  if (text === null) return null
  const { Box, Text, Button } = $.ui.resolve(e)
  return (
    <Box gap={2}>
      <Text dimColor size="footnote">
        {text}
      </Text>
      <Button key="about-dismiss-support" plain label={dismissLabel()} onPress={() => dismissSupport($)} />
    </Box>
  )
}

/** Opens the report pane on its own; true once it is open (placed or waiting for a surface). */
async function openReport($: EngineInterface, isAsked: boolean): Promise<boolean> {
  try {
    await $.ui.open(isAsked ? { id: PANE_ID, title: t(T.paneTitle) } : { id: PANE_ID, title: t(T.paneTitle), focus: true, closeOnEscape: true })
    return true
  } catch {
    return false
  }
}

/** Once per ISO week: opens the report and remembers the week. */
async function showWeekly($: EngineInterface): Promise<void> {
  const week = isoWeek(await $.clock.now())
  if ((await storeGet<string>($, LAST_SHOWN_KEY, '')) === week) return
  if (!(await openReport($, false))) return
  await storeSet($, LAST_SHOWN_KEY, week)
  await notice($, 'info', t(T.toastReady), feature.id)
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  void e
  try {
    await $.command.register({ name: 'report', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'report', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  if ((await $.session.surfaces()).length === 0) return
  await showWeekly($)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await showWeekly($)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  try {
    const now = await $.clock.now()
    const key = dayKey(now)
    const cutoff = dayKey(shift(now, -KEEP_DAYS))
    const extra = await storeGet<Extra>($, EXTRA_KEY, EMPTY_EXTRA)
    const caught = (await read($, loops)).caught.filter(c => c.at > extra.loopsAt)

    const merged: Extra = { loops: {}, longest: {}, tools: {}, loopsAt: caught.reduce((m, c) => Math.max(m, c.at), extra.loopsAt) }
    for (const k of Object.keys(extra.loops)) if (k >= cutoff) merged.loops[k] = extra.loops[k] ?? 0
    for (const k of Object.keys(extra.longest)) if (k >= cutoff) merged.longest[k] = extra.longest[k] ?? 0
    for (const k of Object.keys(extra.tools)) if (k >= cutoff) merged.tools[k] = extra.tools[k] ?? {}
    merged.loops[key] = (merged.loops[key] ?? 0) + caught.length
    merged.longest[key] = Math.max(merged.longest[key] ?? 0, e.durationMs)
    merged.tools[key] = await storeGet<Record<string, number>>($, 'week-heatmap:tools', {})
    await storeSet($, EXTRA_KEY, merged)
  } catch {
    // the report is a convenience; never break the turn over it
  }
}

export function register(on: On) {
  on('command.run', { command: 'report' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle), focus: true, closeOnEscape: true })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'monday-report' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const r = await gather($)
    const plain = letterText(r)
    if (r.turns === 0) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.insight })}
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
        </Box>
      )
    }

    const copyReport = async () => {
      try {
        const res = await $.ui.copy({ text: plain, surface: e.surface })
        await notice($, res.isCopied ? 'info' : 'warn', res.isCopied ? t(T.copied) : t(T.copyFailed), feature.id)
      } catch {
        await notice($, 'warn', t(T.copyFailed), feature.id)
      }
    }
    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: `${r.from} - ${r.to}`,
      level: 'info',
      icon: ICONS.insight,
      actions: [{ key: 'report-copy', label: t(T.copy), onPress: () => copyReport() }],
    })

    if (e.surface !== 'desktop') {
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          <Box flexDirection="column" borderStyle="round" paddingX={1}>
            <Text>{plain}</Text>
          </Box>
          {supportLine($, e)}
        </Box>
      )
    }

    const big = (value: string, label: string, key: string): RenderElement => (
      <Box key={key} flexDirection="column">
        <Text bold size="title">
          {value}
        </Text>
        <Text dimColor size="footnote">
          {label}
        </Text>
      </Box>
    )
    const peak = Math.max(1, ...r.daily)
    const lines = doneLines(r)

    return (
      <Box flexDirection="column" gap={1}>
        {header}
        <Box gap={6}>
          <Box flexDirection="column" gap={1}>
            {big(hoursText(r.hours), t(T.bigHours), 'big-hours')}
            {big(String(r.turns), t(T.bigTurns), 'big-turns')}
            {big(compact(r.tokens), t(T.bigTokens), 'big-tokens')}
            {big(money(r.cost), t(T.bigCost), 'big-cost')}
          </Box>
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
              {sectionTitle($, e, t(T.doneHead))}
              {lines.length === 0 ? (
                <Text dimColor>{t(T.doneNothing)}</Text>
              ) : (
                lines.map((l, i) => (
                  <Text key={`done-${i}`} color="success">
                    + {l}
                  </Text>
                ))
              )}
            </Box>
            <Box flexDirection="column">
              {sectionTitle($, e, t(T.perDay))}
              <Box gap={1} alignItems="flex-end">
                {r.daily.map((n, i) => {
                  const barHeight = n <= 0 ? 0 : Math.max(1, Math.round((n / peak) * CHART_ROWS))
                  return (
                    <Box key={`bar-${i}`} flexDirection="column" alignItems="center" justifyContent="flex-end" height={CHART_ROWS + 2} width={5}>
                      <Text dimColor size="footnote">
                        {n > 0 ? String(n) : ''}
                      </Text>
                      {barHeight > 0 ? <Box height={barHeight} width={3} backgroundColor="claude" /> : <Box height={1} width={3} />}
                      <Text dimColor size="footnote">
                        {r.labels[i] ?? ''}
                      </Text>
                    </Box>
                  )
                })}
              </Box>
            </Box>
            <Box flexDirection="column">
              <Text>
                <Text dimColor>{t(T.busiest)}: </Text>
                <Text bold>{busiestText(r)}</Text>
              </Text>
              <Text>
                <Text dimColor>{t(T.topTools)}: </Text>
                <Text bold>{toolsText(r)}</Text>
              </Text>
              <Text>
                <Text dimColor>{t(T.longest)}: </Text>
                <Text bold>{r.longestMs > 0 ? clockText(r.longestMs) : t(T.none)}</Text>
              </Text>
            </Box>
          </Box>
        </Box>
        {supportLine($, e)}
      </Box>
    )
  })
}
