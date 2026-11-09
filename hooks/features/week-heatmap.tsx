import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement, RenderInput, RenderSurface } from 'claude-code'

import { isOn, notice, storeGet, storeSet, t } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { saveSvg, shareExport } from '../exports'
import { ICONS, emptyState, paneHeader } from '../ui'

const T = {
  title: { en: 'Week heatmap & Wrapped', he: 'מפת חום ו-Wrapped', es: 'Mapa de calor y Wrapped', fr: 'Carte de chaleur et Wrapped', ru: 'Тепловая карта и Wrapped', zh: '周热力图与 Wrapped', ja: '週間ヒートマップと Wrapped', pt: 'Mapa de calor semanal e Wrapped', de: 'Wochen-Heatmap & Wrapped', ko: '주간 히트맵 & Wrapped' },
  description: {
    en: 'A contributions-style heatmap of your last 12 weeks (/heatmap) and a shareable Wrapped card (/wrapped).',
    he: 'מפת חום בסגנון תרומות ל-12 השבועות האחרונים (/heatmap) וכרטיס Wrapped לשיתוף (/wrapped).',
    es: 'Un mapa de calor estilo contribuciones de tus últimas 12 semanas (/heatmap) y una tarjeta Wrapped para compartir (/wrapped).',
    fr: 'Une carte de chaleur façon contributions de tes 12 dernières semaines (/heatmap) et une carte Wrapped à partager (/wrapped).',
    ru: 'Тепловая карта активности за последние 12 недель (/heatmap) и карточка Wrapped для публикации (/wrapped).',
    zh: '类似贡献图的热力图，展示你最近 12 周（/heatmap），以及可分享的 Wrapped 卡片（/wrapped）。',
    ja: '直近 12 週間のコントリビューション風ヒートマップ（/heatmap）と、共有できる Wrapped カード（/wrapped）。',
    pt: 'Um mapa de calor no estilo de contribuições das suas últimas 12 semanas (/heatmap) e um cartão Wrapped para compartilhar (/wrapped).',
    de: 'Eine Heatmap im Contributions-Stil für deine letzten 12 Wochen (/heatmap) und eine teilbare Wrapped-Karte (/wrapped).',
    ko: '최근 12주를 기여 그래프 스타일의 히트맵(/heatmap)과 공유할 수 있는 Wrapped 카드(/wrapped)로 보여 줍니다.',
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
  heatCmd: {
    en: 'Shows your 12-week activity heatmap',
    he: 'מציג את מפת החום של 12 השבועות',
    es: 'Muestra el mapa de calor de tus últimas 12 semanas',
    fr: 'Affiche la carte de chaleur des 12 dernières semaines',
    ru: 'Показывает тепловую карту за 12 недель',
    zh: '显示你 12 周的活动热力图',
    ja: '12 週間のアクティビティのヒートマップを表示します',
    pt: 'Mostra o seu mapa de calor de atividade de 12 semanas',
    de: 'Zeigt deine 12-Wochen-Aktivitäts-Heatmap',
    ko: '12주 활동 히트맵을 보여 줍니다',
  },
  wrappedCmd: {
    en: 'Shows your shareable Wrapped card',
    he: 'מציג את כרטיס ה-Wrapped לשיתוף',
    es: 'Muestra tu tarjeta Wrapped para compartir',
    fr: 'Affiche ta carte Wrapped à partager',
    ru: 'Показывает карточку Wrapped для публикации',
    zh: '显示可分享的 Wrapped 卡片',
    ja: '共有できる Wrapped カードを表示します',
    pt: 'Mostra o seu cartão Wrapped para compartilhar',
    de: 'Zeigt deine teilbare Wrapped-Karte',
    ko: '공유할 수 있는 Wrapped 카드를 보여 줍니다',
  },
  heatTitle: { en: 'Activity', he: 'פעילות', es: 'Actividad', fr: 'Activité', ru: 'Активность', zh: '活动', ja: 'アクティビティ', pt: 'Atividade', de: 'Aktivität', ko: '활동' },
  wrappedTitle: { en: 'Wrapped', he: 'Wrapped', es: 'Wrapped', fr: 'Wrapped', ru: 'Wrapped', zh: 'Wrapped', ja: 'Wrapped', pt: 'Wrapped', de: 'Wrapped', ko: 'Wrapped' },
  opened: { en: 'Opened.', he: 'נפתח.', es: 'Abierto.', fr: 'Ouvert.', ru: 'Открыто.', zh: '已打开。', ja: '開きました。', pt: 'Aberto.', de: 'Geöffnet.', ko: '열렸습니다.' },
  months: {
    en: 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec',
    he: 'ינו|פבר|מרץ|אפר|מאי|יוני|יולי|אוג|ספט|אוק|נוב|דצמ',
    es: 'ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic',
    fr: 'janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc',
    ru: 'янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек',
    zh: '1月|2月|3月|4月|5月|6月|7月|8月|9月|10月|11月|12月',
    ja: '1月|2月|3月|4月|5月|6月|7月|8月|9月|10月|11月|12月',
    pt: 'jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez',
    de: 'Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez',
    ko: '1월|2월|3월|4월|5월|6월|7월|8월|9월|10월|11월|12월',
  },
  dayLetters: {
    en: 'M|T|W|T|F|S|S',
    he: 'ב|ג|ד|ה|ו|ש|א',
    es: 'L|M|X|J|V|S|D',
    fr: 'L|M|M|J|V|S|D',
    ru: 'П|В|С|Ч|П|С|В',
    zh: '一|二|三|四|五|六|日',
    ja: '月|火|水|木|金|土|日',
    pt: 'S|T|Q|Q|S|S|D',
    de: 'M|D|M|D|F|S|S',
    ko: '월|화|수|목|금|토|일',
  },
  statCurrent: { en: 'Current streak', he: 'רצף נוכחי', es: 'Racha actual', fr: 'Série actuelle', ru: 'Текущая серия', zh: '当前连续天数', ja: '現在の連続日数', pt: 'Sequência atual', de: 'Aktuelle Serie', ko: '현재 연속 기록' },
  statLongest: { en: 'Longest streak', he: 'הרצף הארוך ביותר', es: 'Racha más larga', fr: 'Plus longue série', ru: 'Самая длинная серия', zh: '最长连续天数', ja: '最長の連続日数', pt: 'Maior sequência', de: 'Längste Serie', ko: '최장 연속 기록' },
  statHours: { en: 'Total hours', he: 'סה״כ שעות', es: 'Horas totales', fr: 'Heures totales', ru: 'Всего часов', zh: '总小时数', ja: '合計時間', pt: 'Total de horas', de: 'Gesamtstunden', ko: '총 시간' },
  statTurns: { en: 'Turns', he: 'תורות', es: 'Turnos', fr: 'Tours', ru: 'Ходы', zh: '轮次', ja: 'ターン', pt: 'Turnos', de: 'Runden', ko: '턴' },
  statTokens: { en: 'Tokens', he: 'אסימונים', es: 'Tokens', fr: 'Jetons', ru: 'Токены', zh: 'Token', ja: 'トークン', pt: 'Tokens', de: 'Tokens', ko: '토큰' },
  statCost: { en: 'Cost', he: 'עלות', es: 'Coste', fr: 'Coût', ru: 'Стоимость', zh: '费用', ja: 'コスト', pt: 'Custo', de: 'Kosten', ko: '비용' },
  daysUnit: { en: '{n} days', he: '{n} ימים', es: '{n} días', fr: '{n} jours', ru: '{n} дн.', zh: '{n} 天', ja: '{n} 日', pt: '{n} dias', de: '{n} Tage', ko: '{n}일' },
  less: { en: 'less', he: 'פחות', es: 'menos', fr: 'moins', ru: 'меньше', zh: '少', ja: '少', pt: 'menos', de: 'weniger', ko: '적음' },
  more: { en: 'more', he: 'יותר', es: 'más', fr: 'plus', ru: 'больше', zh: '多', ja: '多', pt: 'mais', de: 'mehr', ko: '많음' },
  openWrapped: { en: 'Open Wrapped card', he: 'פתח כרטיס Wrapped', es: 'Abrir tarjeta Wrapped', fr: 'Ouvrir la carte Wrapped', ru: 'Открыть карточку Wrapped', zh: '打开 Wrapped 卡片', ja: 'Wrapped カードを開く', pt: 'Abrir cartão Wrapped', de: 'Wrapped-Karte öffnen', ko: 'Wrapped 카드 열기' },
  openHeatmap: { en: 'Open heatmap', he: 'פתח מפת חום', es: 'Abrir mapa de calor', fr: 'Ouvrir la carte de chaleur', ru: 'Открыть тепловую карту', zh: '打开热力图', ja: 'ヒートマップを開く', pt: 'Abrir mapa de calor', de: 'Heatmap öffnen', ko: '히트맵 열기' },
  saveSvg: { en: 'save SVG', he: 'שמור SVG', es: 'guardar SVG', fr: 'enregistrer le SVG', ru: 'сохранить SVG', zh: '保存 SVG', ja: 'SVG を保存', pt: 'salvar SVG', de: 'SVG speichern', ko: 'SVG 저장' },
  share: { en: 'share', he: 'שתף', es: 'compartir', fr: 'partager', ru: 'поделиться', zh: '分享', ja: '共有', pt: 'compartilhar', de: 'teilen', ko: '공유' },
  shareText: {
    en: 'This week with Claude Code: {hours}h, {turns} turns, {cost} — made with Toolkitty\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    he: 'השבוע עם Claude Code: {hours} ש׳, {turns} תורות, {cost} — נעשה עם Toolkitty\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    es: 'Esta semana con Claude Code: {hours} h, {turns} turnos, {cost} — hecho con Toolkitty\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    fr: 'Cette semaine avec Claude Code : {hours} h, {turns} tours, {cost} — fait avec Toolkitty\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ru: 'Эта неделя с Claude Code: {hours} ч, ходов {turns}, {cost} — сделано с Toolkitty\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    zh: '本周与 Claude Code：{hours} 小时，{turns} 轮，{cost} — 由 Toolkitty 制作\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ja: '今週の Claude Code：{hours} 時間、{turns} ターン、{cost} — Toolkitty で作成\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    pt: 'Esta semana com o Claude Code: {hours}h, {turns} turnos, {cost} — feito com o Toolkitty\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    de: 'Diese Woche mit Claude Code: {hours} Std., {turns} Runden, {cost} — gemacht mit Toolkitty\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ko: '이번 주 Claude Code: {hours}시간, {turns}턴, {cost} — Toolkitty으로 제작\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty',
  },
  noData: {
    en: 'No data yet: finish a turn and come back.',
    he: 'עדיין אין נתונים: סיים תור וחזור.',
    es: 'Aún no hay datos: termina un turno y vuelve.',
    fr: 'Pas encore de données : termine un tour et reviens.',
    ru: 'Данных пока нет: завершите ход и вернитесь.',
    zh: '暂无数据：完成一轮后再回来。',
    ja: 'まだデータがありません。ターンを 1 つ終えてからまた来てください。',
    pt: 'Ainda sem dados: conclua um turno e volte.',
    de: 'Noch keine Daten: Schließe eine Runde ab und komm wieder.',
    ko: '아직 데이터가 없습니다. 턴을 하나 마치고 다시 오세요.',
  },
  noDataHint: { en: 'Each finished turn adds to it; /heatmap and /wrapped open these panes.', he: 'כל תור שמסתיים מוסיף לה; ‎/heatmap ו-/wrapped פותחים את החלוניות.', es: 'Cada turno terminado la completa; /heatmap y /wrapped abren estos paneles.', fr: "Chaque tour terminé l'enrichit ; /heatmap et /wrapped ouvrent ces panneaux.", ru: 'Каждый завершённый ход пополняет её; /heatmap и /wrapped открывают эти панели.', zh: '每完成一轮都会累计；/heatmap 和 /wrapped 会打开这些面板。', ja: 'ターンが完了するたびに加算されます。/heatmap と /wrapped でこれらのパネルを開けます。', pt: 'Cada turno concluído soma aqui; /heatmap e /wrapped abrem estes painéis.', de: 'Jede abgeschlossene Runde zählt dazu; /heatmap und /wrapped öffnen diese Panels.', ko: '턴이 끝날 때마다 쌓입니다. /heatmap과 /wrapped로 이 패널을 엽니다.' },
  cardTitle: { en: 'CLAUDE CODE WRAPPED', he: 'CLAUDE CODE WRAPPED', es: 'CLAUDE CODE WRAPPED', fr: 'CLAUDE CODE WRAPPED', ru: 'CLAUDE CODE WRAPPED', zh: 'CLAUDE CODE WRAPPED', ja: 'CLAUDE CODE WRAPPED', pt: 'CLAUDE CODE WRAPPED', de: 'CLAUDE CODE WRAPPED', ko: 'CLAUDE CODE WRAPPED' },
  cardHours: { en: 'HOURS', he: 'שעות', es: 'HORAS', fr: 'HEURES', ru: 'ЧАСЫ', zh: '小时', ja: '時間', pt: 'HORAS', de: 'STUNDEN', ko: '시간' },
  cardTurns: { en: 'TURNS', he: 'תורות', es: 'TURNOS', fr: 'TOURS', ru: 'ХОДЫ', zh: '轮次', ja: 'ターン', pt: 'TURNOS', de: 'RUNDEN', ko: '턴' },
  cardTokens: { en: 'TOKENS', he: 'אסימונים', es: 'TOKENS', fr: 'JETONS', ru: 'ТОКЕНЫ', zh: 'TOKEN', ja: 'トークン', pt: 'TOKENS', de: 'TOKENS', ko: '토큰' },
  cardCost: { en: 'COST', he: 'עלות', es: 'COSTE', fr: 'COÛT', ru: 'СТОИМОСТЬ', zh: '费用', ja: 'コスト', pt: 'CUSTO', de: 'KOSTEN', ko: '비용' },
  cardStreak: { en: 'LONGEST STREAK', he: 'הרצף הארוך ביותר', es: 'RACHA MÁS LARGA', fr: 'PLUS LONGUE SÉRIE', ru: 'САМАЯ ДЛИННАЯ СЕРИЯ', zh: '最长连续', ja: '最長連続', pt: 'MAIOR SEQUÊNCIA', de: 'LÄNGSTE SERIE', ko: '최장 연속' },
  cardDays: { en: 'days', he: 'ימים', es: 'días', fr: 'jours', ru: 'дн.', zh: '天', ja: '日', pt: 'dias', de: 'Tage', ko: '일' },
  cardTools: { en: 'TOP TOOLS', he: 'הכלים המובילים', es: 'HERRAMIENTAS TOP', fr: 'OUTILS PRINCIPAUX', ru: 'ТОП ИНСТРУМЕНТОВ', zh: '常用工具', ja: 'よく使うツール', pt: 'FERRAMENTAS MAIS USADAS', de: 'TOP-TOOLS', ko: '인기 도구' },
  cardWeeks: { en: 'LAST 12 WEEKS', he: '12 השבועות האחרונים', es: 'ÚLTIMAS 12 SEMANAS', fr: '12 DERNIÈRES SEMAINES', ru: 'ПОСЛЕДНИЕ 12 НЕДЕЛЬ', zh: '最近 12 周', ja: '直近 12 週間', pt: 'ÚLTIMAS 12 SEMANAS', de: 'LETZTE 12 WOCHEN', ko: '최근 12주' },
  activeDays: { en: '{n} active days', he: '{n} ימים פעילים', es: '{n} días activos', fr: '{n} jours actifs', ru: 'активных дней: {n}', zh: '{n} 个活跃日', ja: 'アクティブ {n} 日', pt: '{n} dias ativos', de: '{n} aktive Tage', ko: '활동일 {n}일' },
  cardAlt: {
    en: 'Claude Code Wrapped card: {hours} hours, {turns} turns, {tokens} tokens, {cost}, longest streak {streak} days, {label}',
    he: 'כרטיס Claude Code Wrapped: {hours} שעות, {turns} תורות, {tokens} אסימונים, {cost}, רצף ארוך {streak} ימים, {label}',
    es: 'Tarjeta Claude Code Wrapped: {hours} horas, {turns} turnos, {tokens} tokens, {cost}, racha más larga {streak} días, {label}',
    fr: 'Carte Claude Code Wrapped : {hours} heures, {turns} tours, {tokens} jetons, {cost}, plus longue série {streak} jours, {label}',
    ru: 'Карточка Claude Code Wrapped: часов {hours}, ходов {turns}, токенов {tokens}, {cost}, самая длинная серия {streak} дн., {label}',
    zh: 'Claude Code Wrapped 卡片：{hours} 小时，{turns} 轮，{tokens} token，{cost}，最长连续 {streak} 天，{label}',
    ja: 'Claude Code Wrapped カード：{hours} 時間、{turns} ターン、{tokens} トークン、{cost}、最長連続 {streak} 日、{label}',
    pt: 'Cartão Claude Code Wrapped: {hours} horas, {turns} turnos, {tokens} tokens, {cost}, maior sequência {streak} dias, {label}',
    de: 'Claude-Code-Wrapped-Karte: {hours} Stunden, {turns} Runden, {tokens} Tokens, {cost}, längste Serie {streak} Tage, {label}',
    ko: 'Claude Code Wrapped 카드: {hours}시간, {turns}턴, {tokens} 토큰, {cost}, 최장 연속 {streak}일, {label}',
  },
  pRefactorer: { en: 'The Refactorer', he: 'משפצר הקוד', es: 'El Refactorizador', fr: 'Le Refactoreur', ru: 'Рефакторщик', zh: '重构者', ja: 'リファクタラー', pt: 'O Refatorador', de: 'Der Refaktorierer', ko: '리팩터러' },
  pRefactorerTag: {
    en: 'You reshape code until it reads like prose.',
    he: 'אתה מעצב את הקוד עד שהוא נקרא כמו פרוזה.',
    es: 'Remodelas el código hasta que se lee como prosa.',
    fr: 'Tu remodèles le code jusqu’à ce qu’il se lise comme de la prose.',
    ru: 'Вы переписываете код, пока он не читается как проза.',
    zh: '你不断重塑代码，直到它读起来像散文。',
    ja: 'コードが文章のように読めるまで形を整えます。',
    pt: 'Você remodela o código até ele ler como prosa.',
    de: 'Du formst Code um, bis er sich wie Prosa liest.',
    ko: '코드가 산문처럼 읽힐 때까지 다듬습니다.',
  },
  pInvestigator: { en: 'The Investigator', he: 'החוקר', es: 'El Investigador', fr: 'L’Enquêteur', ru: 'Следователь', zh: '调查者', ja: '調査員', pt: 'O Investigador', de: 'Der Ermittler', ko: '조사자' },
  pInvestigatorTag: {
    en: 'You read first, ask questions, then act.',
    he: 'קודם קוראים, שואלים, ורק אז פועלים.',
    es: 'Primero lees, preguntas y luego actúas.',
    fr: 'Tu lis d’abord, tu questionnes, puis tu agis.',
    ru: 'Сначала читаете, спрашиваете, потом действуете.',
    zh: '你先阅读、提问，然后再行动。',
    ja: 'まず読み、質問し、それから動きます。',
    pt: 'Você lê primeiro, faz perguntas e só então age.',
    de: 'Du liest zuerst, stellst Fragen und handelst dann.',
    ko: '먼저 읽고, 질문하고, 그다음 행동합니다.',
  },
  pShipper: { en: 'The Shipper', he: 'המשחרר', es: 'El Lanzador', fr: 'Le Livreur', ru: 'Релизёр', zh: '交付者', ja: 'リリーサー', pt: 'O Entregador', de: 'Der Auslieferer', ko: '출시자' },
  pShipperTag: {
    en: 'Run it, test it, ship it.',
    he: 'מריצים, בודקים, משחררים.',
    es: 'Ejecútalo, pruébalo, publícalo.',
    fr: 'Lance, teste, livre.',
    ru: 'Запустить, проверить, выпустить.',
    zh: '运行，测试，发布。',
    ja: '動かして、テストして、出荷。',
    pt: 'Rode, teste, entregue.',
    de: 'Ausführen, testen, ausliefern.',
    ko: '실행하고, 테스트하고, 출시한다.',
  },
  pCollaborator: { en: 'The Collaborator', he: 'השותף', es: 'El Colaborador', fr: 'Le Collaborateur', ru: 'Партнёр', zh: '协作者', ja: 'コラボレーター', pt: 'O Colaborador', de: 'Der Teamplayer', ko: '협업자' },
  pCollaboratorTag: {
    en: 'A balanced mix of reading, editing and running.',
    he: 'תמהיל מאוזן של קריאה, עריכה והרצה.',
    es: 'Un equilibrio entre leer, editar y ejecutar.',
    fr: 'Un bel équilibre entre lire, modifier et exécuter.',
    ru: 'Баланс чтения, правок и запусков.',
    zh: '阅读、编辑和运行的均衡搭配。',
    ja: '読む、編集する、動かすのバランスが取れた組み合わせ。',
    pt: 'Uma mistura equilibrada de leitura, edição e execução.',
    de: 'Eine ausgewogene Mischung aus Lesen, Bearbeiten und Ausführen.',
    ko: '읽기, 편집, 실행이 균형 잡힌 조합.',
  },
  pNewcomer: { en: 'The Newcomer', he: 'המתחיל', es: 'El Recién Llegado', fr: 'Le Nouveau', ru: 'Новичок', zh: '新人', ja: '新入り', pt: 'O Novato', de: 'Der Neuling', ko: '새내기' },
  pNewcomerTag: {
    en: 'Your story has just begun.',
    he: 'הסיפור שלך רק מתחיל.',
    es: 'Tu historia acaba de empezar.',
    fr: 'Ton histoire ne fait que commencer.',
    ru: 'Ваша история только начинается.',
    zh: '你的故事才刚刚开始。',
    ja: 'あなたの物語は始まったばかりです。',
    pt: 'Sua história está apenas começando.',
    de: 'Deine Geschichte hat gerade erst begonnen.',
    ko: '이야기는 이제 막 시작되었습니다.',
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

type Day = { turns: number; ms: number; tokens: number; cost: number }
type Stats = { days: Record<string, Day>; tools: Record<string, number>; longest: number }
type Persona = 'Refactorer' | 'Investigator' | 'Shipper' | 'Collaborator' | 'Newcomer'

const stats = atom({ plugin: 'toolkitty', key: 'slot', id: 'week-heatmap' } as const, { days: {}, tools: {}, longest: 0 } as Stats) as unknown as Atom<Stats>

export const feature: Feature = {
  id: 'week-heatmap',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const WEEKS = 12
const DAY_MS = 86_400_000
const KEEP_DAYS = 400
const GREEN = ['#2d333b', '#0e4429', '#006d32', '#26a641', '#39d353']
const ORANGE = ['#2a2d36', '#5c2f1f', '#9a4a2b', '#d97757', '#ffb38f']

let pendingTools: Record<string, number> = {}
let lastCost: number | null = null

// ---------- dates ----------

const pad2 = (n: number): string => String(n).padStart(2, '0')

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function shift(ms: number, days: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12).getTime()
}

function dayNumber(key: string): number {
  const p = key.split('-')
  return Math.round(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12).getTime() / DAY_MS)
}

function streaks(days: Record<string, Day>, today: number): { current: number; longest: number } {
  const active = Object.keys(days)
    .filter(k => (days[k]?.turns ?? 0) > 0)
    .sort()
  let longest = 0
  let run = 0
  let prev = -Infinity
  for (const k of active) {
    const n = dayNumber(k)
    run = n === prev + 1 ? run + 1 : 1
    prev = n
    longest = Math.max(longest, run)
  }
  let current = 0
  let cursor = (days[dayKey(today)]?.turns ?? 0) > 0 ? today : shift(today, -1)
  while ((days[dayKey(cursor)]?.turns ?? 0) > 0) {
    current++
    cursor = shift(cursor, -1)
  }
  return { current, longest }
}

// ---------- numbers ----------

function compact(n: number): string {
  const fix = (v: number, unit: string): string => `${v.toFixed(1).replace(/\.0$/, '')}${unit}`
  if (n >= 1e9) return fix(n / 1e9, 'B')
  if (n >= 1e6) return fix(n / 1e6, 'M')
  if (n >= 1e3) return fix(n / 1e3, 'K')
  return String(Math.round(n))
}

const hoursOf = (ms: number): string => {
  const hours = ms / 3_600_000
  return hours < 10 ? hours.toFixed(1) : String(Math.round(hours))
}

function totals(s: Stats): { turns: number; ms: number; tokens: number; cost: number } {
  let turns = 0
  let ms = 0
  let tokens = 0
  let cost = 0
  for (const k of Object.keys(s.days)) {
    const d = s.days[k]
    if (d === undefined) continue
    turns += d.turns
    ms += d.ms
    tokens += d.tokens
    cost += d.cost
  }
  return { turns, ms, tokens, cost }
}

function persona(s: Stats): Persona {
  const sum = (names: string[]): number => names.reduce((acc, n) => acc + (s.tools[n] ?? 0), 0)
  const edits = sum(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
  const reads = sum(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'NotebookRead'])
  const bash = sum(['Bash', 'PowerShell'])
  const all = edits + reads + bash
  if (all < 10) return 'Newcomer'
  const best = Math.max(edits, reads, bash)
  if (best / all < 0.4) return 'Collaborator'
  if (best === edits) return 'Refactorer'
  if (best === reads) return 'Investigator'
  return 'Shipper'
}

const personaName = (p: Persona): string => t(T[`p${p}` as const])
const personaTag = (p: Persona): string => t(T[`p${p}Tag` as const])

// ---------- the grid: 12 weeks, Monday first, the last column holds today ----------

type Grid = { levels: number[][]; months: number[]; active: number }

function gridOf(s: Stats, today: number): Grid {
  const todayIdx = (new Date(today).getDay() + 6) % 7
  const start = shift(today, -(todayIdx + 7 * (WEEKS - 1)))
  const lastIndex = 7 * (WEEKS - 1) + todayIdx
  let max = 0
  for (let i = 0; i <= lastIndex; i++) max = Math.max(max, s.days[dayKey(shift(start, i))]?.tokens ?? 0)
  const levels: number[][] = []
  const months: number[] = []
  let active = 0
  for (let w = 0; w < WEEKS; w++) {
    const col: number[] = []
    months.push(new Date(shift(start, w * 7)).getMonth())
    for (let d = 0; d < 7; d++) {
      const i = w * 7 + d
      if (i > lastIndex) {
        col.push(-1)
        continue
      }
      const day = s.days[dayKey(shift(start, i))]
      if (day === undefined || day.turns === 0) {
        col.push(0)
        continue
      }
      active++
      col.push(max <= 0 ? 1 : Math.min(4, Math.max(1, Math.ceil((day.tokens / max) * 4))))
    }
    levels.push(col)
  }
  return { levels, months, active }
}

const escapeXml = (str: string): string => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const projectOf = (cwd: string): string => cwd.split(/[\\/]/).filter(Boolean).pop() ?? ''

// ---------- the Wrapped card ----------

function wrappedSvg(s: Stats, project: string, today: number): string {
  const sum = totals(s)
  const p = persona(s)
  const { longest } = streaks(s.days, today)
  const grid = gridOf(s, today)
  const font = "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif"
  const topTools = Object.keys(s.tools)
    .map(name => ({ name, n: s.tools[name] ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
  const maxTool = topTools[0]?.n ?? 1
  const label = personaName(p)

  let out =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" font-family="${font}">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d0f15"/><stop offset="1" stop-color="#181b26"/></linearGradient>` +
    `<radialGradient id="g1" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d97757" stop-opacity=".30"/><stop offset="1" stop-color="#d97757" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="g2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#4c6fff" stop-opacity=".16"/><stop offset="1" stop-color="#4c6fff" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="1200" height="630" fill="url(#bg)"/><circle cx="1080" cy="40" r="460" fill="url(#g1)"/><circle cx="60" cy="640" r="420" fill="url(#g2)"/>` +
    `<rect x="1.5" y="1.5" width="1197" height="627" fill="none" stroke="#262b3a" stroke-width="3"/>`

  // header
  out += `<g stroke="#d97757" stroke-width="4" stroke-linecap="round" transform="translate(76 68)"><path d="M0 -13V13M-13 0H13M-9 -9L9 9M-9 9L9 -9"/></g>`
  out += `<text x="106" y="75" font-size="20" font-weight="700" letter-spacing="4" fill="#9aa4b2">${escapeXml(t(T.cardTitle))}</text>`

  // personality
  const nameSize = [...label].length > 16 ? 50 : 62
  out += `<text x="60" y="158" font-size="${nameSize}" font-weight="800" fill="#ffffff">${escapeXml(label)}</text>`
  out += `<text x="60" y="198" font-size="24" fill="#d97757">${escapeXml(personaTag(p))}</text>`

  // big numbers
  const tiles: Array<[number, number, string, string]> = [
    [60, 296, hoursOf(sum.ms), t(T.cardHours)],
    [360, 296, String(sum.turns), t(T.cardTurns)],
    [60, 402, compact(sum.tokens), t(T.cardTokens)],
    [360, 402, `$${sum.cost.toFixed(2)}`, t(T.cardCost)],
  ]
  for (const [x, y, value, caption] of tiles) {
    out += `<text x="${x}" y="${y}" font-size="72" font-weight="800" fill="#ffffff">${escapeXml(value)}</text>`
    out += `<text x="${x}" y="${y + 28}" font-size="17" font-weight="600" letter-spacing="3" fill="#8b95a5">${escapeXml(caption)}</text>`
  }

  // streak and tools
  out += `<text x="720" y="122" font-size="17" font-weight="600" letter-spacing="3" fill="#8b95a5">${escapeXml(t(T.cardStreak))}</text>`
  out += `<text x="720" y="196"><tspan font-size="84" font-weight="800" fill="#d97757">${longest}</tspan><tspan font-size="28" fill="#9aa4b2" dx="12">${escapeXml(t(T.cardDays))}</tspan></text>`
  out += `<text x="720" y="262" font-size="17" font-weight="600" letter-spacing="3" fill="#8b95a5">${escapeXml(t(T.cardTools))}</text>`
  topTools.forEach((tool, i) => {
    const y = 312 + i * 56
    const w = Math.max(10, Math.round((420 * tool.n) / maxTool))
    out += `<text x="720" y="${y}" font-size="24" font-weight="600" fill="#ffffff">${escapeXml(tool.name)}</text>`
    out += `<text x="1140" y="${y}" text-anchor="end" font-size="22" fill="#9aa4b2">${compact(tool.n)}</text>`
    out += `<rect x="720" y="${y + 12}" width="420" height="10" rx="5" fill="#262b38"/><rect x="720" y="${y + 12}" width="${w}" height="10" rx="5" fill="#d97757"/>`
  })

  // mini heatmap
  out += `<line x1="60" y1="462" x2="1140" y2="462" stroke="#232836" stroke-width="2"/>`
  out += `<text x="60" y="494" font-size="15" font-weight="600" letter-spacing="3" fill="#8b95a5">${escapeXml(t(T.cardWeeks))}</text>`
  grid.levels.forEach((col, w) => {
    col.forEach((level, d) => {
      if (level < 0) return
      out += `<rect x="${60 + w * 15}" y="${506 + d * 15}" width="12" height="12" rx="2.5" fill="${ORANGE[level] ?? ORANGE[0]}"/>`
    })
  })
  out += `<text x="268" y="556" font-size="22" fill="#c4cbd6">${escapeXml(t(T.activeDays, { n: grid.active }))}</text>`
  ORANGE.forEach((c, i) => {
    out += `<rect x="${268 + i * 17}" y="580" width="12" height="12" rx="2.5" fill="${c}"/>`
  })
  out += `<text x="${268 + 5 * 17 + 6}" y="591" font-size="14" fill="#8b95a5">${escapeXml(t(T.more))}</text>`

  out += `<text x="1140" y="596" text-anchor="end" font-size="22" font-weight="600" fill="#9aa4b2">Claude Code · ${escapeXml(project)}</text>`
  out += `</svg>`
  return out
}

async function saveCard($: EngineInterface): Promise<void> {
  const s = await read($, stats)
  const cwd = await $.session.cwd()
  const now = await $.clock.now()
  await saveSvg($, 'wrapped', wrappedSvg(s, projectOf(cwd), now), feature.id)
}

/** Totals over today and the six days before it. */
function weekTotals(s: Stats, today: number): { turns: number; ms: number; cost: number } {
  let turns = 0
  let ms = 0
  let cost = 0
  for (let i = 0; i < 7; i++) {
    const d = s.days[dayKey(shift(today, -i))]
    if (d === undefined) continue
    turns += d.turns
    ms += d.ms
    cost += d.cost
  }
  return { turns, ms, cost }
}

/** Saves the Wrapped card as a new SVG under toolkitty-exports and copies a post text. */
async function shareCard($: EngineInterface, surface: RenderSurface): Promise<void> {
  const s = await read($, stats)
  const cwd = await $.session.cwd()
  const now = await $.clock.now()
  const week = weekTotals(s, now)
  const text = t(T.shareText, { hours: Math.round(week.ms / 3_600_000), turns: week.turns, cost: `$${Math.round(week.cost)}` })
  await shareExport($, { kind: 'wrapped', svg: wrappedSvg(s, projectOf(cwd), now), share: text, surface, feature: feature.id })
}

// ---------- handlers ----------

/**
 * Reads the stored days, tools and longest turn into memory. Every turn end writes the store right after
 * the state, so nothing is lost; a pane re-reads on open so values another feature wrote to the keys
 * (the demo's synthetic weeks) show without a restart.
 */
async function reloadStats($: EngineInterface): Promise<void> {
  const days = await storeGet<Record<string, Day>>($, 'week-heatmap:days', {})
  const tools = await storeGet<Record<string, number>>($, 'week-heatmap:tools', {})
  const longest = await storeGet<number>($, 'week-heatmap:longest', 0)
  await update($, stats, () => ({ days, tools, longest }))
}

/** Re-reads the store, then opens the heatmap or the Wrapped pane. */
async function openPane($: EngineInterface, which: 'heatmap' | 'wrapped'): Promise<void> {
  await reloadStats($)
  if (which === 'heatmap') await $.ui.open({ id: 'heatmap', title: t(T.heatTitle) })
  else await $.ui.open({ id: 'wrapped', title: t(T.wrappedTitle) })
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'heatmap', description: t(T.heatCmd) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'heatmap', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  try {
    await $.command.register({ name: 'wrapped', description: t(T.wrappedCmd) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'wrapped', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return

  await reloadStats($)
  const usage = await $.session.usage()
  lastCost = usage.cost?.usd ?? null
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (result.deny !== undefined) return result
  const name: string = e.tool
  pendingTools = { ...pendingTools, [name]: (pendingTools[name] ?? 0) + 1 }
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const now = await $.clock.now()
  const key = dayKey(now)
  const cutoff = dayKey(shift(now, -KEEP_DAYS))
  const u = e.usage
  const tokens = u === undefined ? 0 : u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
  const usage = await $.session.usage()
  const costNow = usage.cost?.usd ?? null
  const cost = lastCost !== null && costNow !== null ? Math.max(0, costNow - lastCost) : 0
  lastCost = costNow
  const added = pendingTools
  pendingTools = {}

  await update($, stats, s => {
    const days: Record<string, Day> = {}
    for (const k of Object.keys(s.days)) {
      const d = s.days[k]
      if (d !== undefined && k >= cutoff) days[k] = d
    }
    const prev = days[key] ?? { turns: 0, ms: 0, tokens: 0, cost: 0 }
    days[key] = { turns: prev.turns + 1, ms: prev.ms + e.durationMs, tokens: prev.tokens + tokens, cost: prev.cost + cost }
    const tools = { ...s.tools }
    for (const name of Object.keys(added)) tools[name] = (tools[name] ?? 0) + (added[name] ?? 0)
    return { days, tools, longest: Math.max(s.longest, e.durationMs) }
  })

  const s = await read($, stats)
  await storeSet($, 'week-heatmap:days', s.days)
  await storeSet($, 'week-heatmap:tools', s.tools)
  await storeSet($, 'week-heatmap:longest', s.longest)
}

// ---------- panes ----------

async function drawHeatmap($: EngineInterface, e: RenderInput<'Pane'>): Promise<RenderElement> {
  const { Box, Text } = $.ui.resolve(e)
  const s = await read($, stats)
  const today = await $.clock.now()
  const sum = totals(s)
  if (sum.turns === 0) {
    return (
      <Box flexDirection="column">
        {paneHeader($, e, { title: t(T.heatTitle), icon: ICONS.visual })}
        {emptyState($, e, t(T.noData), t(T.noDataHint))}
      </Box>
    )
  }

  const grid = gridOf(s, today)
  const { current, longest } = streaks(s.days, today)
  const monthNames = t(T.months).split('|')
  const letters = t(T.dayLetters).split('|')

  const label: string[] = Array.from({ length: WEEKS * 3 + 4 }, () => ' ')
  grid.months.forEach((month, w) => {
    if (w > 0 && grid.months[w - 1] === month) return
    const name = monthNames[month] ?? ''
    ;[...name].slice(0, 4).forEach((ch, i) => {
      label[w * 3 + i] = ch
    })
  })

  const rows: RenderElement[] = []
  for (let d = 0; d < 7; d++) {
    rows.push(
      <Box key={`day-${d}`}>
        <Text dimColor>{`${letters[d] ?? ' '} `}</Text>
        {grid.levels.map((col, w) => {
          const level = col[d] ?? -1
          return level < 0 ? (
            <Box key={`c-${w}-${d}`} width={2} height={1} marginRight={1} />
          ) : (
            <Box key={`c-${w}-${d}`} width={2} height={1} marginRight={1} backgroundColor={GREEN[level] ?? GREEN[0]} />
          )
        })}
      </Box>,
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      {paneHeader($, e, {
        title: t(T.heatTitle),
        status: t(T.daysUnit, { n: current }),
        level: current > 0 ? 'info' : 'ok',
        icon: ICONS.visual,
        actions: [
          {
            key: 'open-wrapped',
            label: t(T.openWrapped),
            onPress: () => {
              void openPane($, 'wrapped')
            },
          },
        ],
      })}
      <Box flexDirection="column">
        <Text dimColor>{`  ${label.join('')}`}</Text>
        {rows}
        <Box marginTop={1}>
          <Text dimColor>{`${t(T.less)} `}</Text>
          {GREEN.map((c, i) => (
            <Box key={`lg-${i}`} width={2} height={1} marginRight={1} backgroundColor={c} />
          ))}
          <Text dimColor>{t(T.more)}</Text>
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text>
          {t(T.statCurrent)}: <Text bold color="success">{t(T.daysUnit, { n: current })}</Text>
        </Text>
        <Text>
          {t(T.statLongest)}: <Text bold>{t(T.daysUnit, { n: longest })}</Text>
        </Text>
        <Text>
          {t(T.statHours)}: <Text bold>{hoursOf(sum.ms)}</Text>
          {'  ·  '}
          {t(T.statTurns)}: <Text bold>{sum.turns}</Text>
        </Text>
        <Text dimColor>
          {t(T.statTokens)} {compact(sum.tokens)} · {t(T.statCost)} ${sum.cost.toFixed(2)}
        </Text>
      </Box>
    </Box>
  )
}

async function drawWrapped($: EngineInterface, e: RenderInput<'Pane'>): Promise<RenderElement> {
  const { Box, Text } = $.ui.resolve(e)
  const s = await read($, stats)
  const today = await $.clock.now()
  const cwd = await $.session.cwd()
  const sum = totals(s)
  if (sum.turns === 0) {
    return (
      <Box flexDirection="column">
        {paneHeader($, e, { title: t(T.wrappedTitle), icon: ICONS.visual })}
        {emptyState($, e, t(T.noData), t(T.noDataHint))}
      </Box>
    )
  }

  const p = persona(s)
  const { longest } = streaks(s.days, today)
  const header = paneHeader($, e, {
    title: t(T.wrappedTitle),
    status: personaName(p),
    level: 'info',
    icon: ICONS.visual,
    actions: [
      {
        key: 'save-svg',
        label: t(T.saveSvg),
        onPress: () => {
          void saveCard($)
        },
      },
      {
        key: 'share-wrapped',
        label: t(T.share),
        onPress: () => {
          void shareCard($, e.surface)
        },
      },
      {
        key: 'open-heatmap',
        label: t(T.openHeatmap),
        onPress: () => {
          void openPane($, 'heatmap')
        },
      },
    ],
  })

  if (e.surface === 'desktop') {
    const { Svg } = $.ui.resolve(e)
    const alt = t(T.cardAlt, { hours: hoursOf(sum.ms), turns: sum.turns, tokens: compact(sum.tokens), cost: `$${sum.cost.toFixed(2)}`, streak: longest, label: personaName(p) })
    return (
      <Box flexDirection="column" gap={1}>
        {header}
        <Svg source={wrappedSvg(s, projectOf(cwd), today)} alt={alt} />
      </Box>
    )
  }

  const top = Object.keys(s.tools)
    .map(name => ({ name, n: s.tools[name] ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
  const maxTool = top[0]?.n ?? 1
  return (
    <Box flexDirection="column" gap={1}>
      {header}
      <Box flexDirection="column" borderStyle="round" paddingX={2} width={46}>
        <Text bold color="claude">
          {t(T.cardTitle)}
        </Text>
        <Text bold>{personaName(p)}</Text>
        <Text dimColor>{personaTag(p)}</Text>
        <Text> </Text>
        <Text>
          {t(T.cardHours)} <Text bold>{hoursOf(sum.ms)}</Text> · {t(T.cardTurns)} <Text bold>{sum.turns}</Text>
        </Text>
        <Text>
          {t(T.cardTokens)} <Text bold>{compact(sum.tokens)}</Text> · {t(T.cardCost)} <Text bold>${sum.cost.toFixed(2)}</Text>
        </Text>
        <Text>
          {t(T.cardStreak)} <Text bold>{t(T.daysUnit, { n: longest })}</Text>
        </Text>
        <Text> </Text>
        {top.map(tool => (
          <Text key={`tool-${tool.name}`}>
            {tool.name.padEnd(8)} <Text color="claude">{'█'.repeat(Math.max(1, Math.round((20 * tool.n) / maxTool)))}</Text> {compact(tool.n)}
          </Text>
        ))}
        <Text dimColor>Claude Code · {projectOf(cwd)}</Text>
      </Box>
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'heatmap' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await openPane($, 'heatmap')
    return { text: t(T.opened) }
  })

  on('command.run', { command: 'wrapped' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await openPane($, 'wrapped')
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'heatmap' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.off)}</Text>
    return drawHeatmap($, e)
  })

  on('ui.render', { component: 'Pane', requestId: 'wrapped' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.off)}</Text>
    return drawWrapped($, e)
  })
}
