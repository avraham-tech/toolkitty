import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement, Timer } from 'claude-code'

import { clockText, isOn, notice, storeGet, storeSet, t } from '../core'
import type { BandInput, BandLine, Feature, Input, Localized, PaneInput } from '../core'
import { current, ofKind } from '../signals'
import type { Signal, SignalKind } from '../signals'
import { ICONS, LEVEL_COLOR, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip, Level } from '../ui'

/*
 * The Smart Advisor. Deterministic, no model calls. It only reads the signals
 * bus (`current`) and says two things:
 *   - the HEADLINE chip of the band: one state at a time, by priority;
 *   - up to three recommendations (rules over the signals), as cards with
 *     real actions, in the /smart pane and in the band's detail pane.
 * Actions are named references: `open:<pane-id>` opens a pane,
 * `detail:<feature-id>` opens Toolkitty detail pane on that feature,
 * `notice:<key>` posts a notice.
 */

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Smart Advisor', he: 'יועץ חכם', es: 'Asesor inteligente', fr: 'Conseiller intelligent', ru: 'Умный советник', zh: '智能顾问', ja: 'スマートアドバイザー', pt: 'Consultor Inteligente', de: 'Smart-Berater', ko: '스마트 어드바이저' },
  description: {
    en: 'The band headline and a few recommendations, worked out from what the other features see. No model calls.',
    he: 'הכותרת של הרצועה ומספר המלצות, שמחושבות ממה שהשכלולים האחרים רואים. בלי קריאות למודל.',
    es: 'El titular de la barra y unas pocas recomendaciones, deducidas de lo que ven las demás funciones. Sin llamadas al modelo.',
    fr: 'Le titre de la bande et quelques recommandations, déduits de ce que voient les autres fonctions. Aucun appel au modèle.',
    ru: 'Заголовок панели и несколько рекомендаций, выведенных из данных других функций. Без обращений к модели.',
    zh: '横幅标题和几条建议，根据其他功能观察到的信息得出。不调用模型。',
    ja: 'バンドの見出しといくつかの提案。他の機能が見ている情報から導き出します。モデル呼び出しはありません。',
    pt: 'O título da faixa e algumas recomendações, calculados a partir do que os outros recursos observam. Sem chamadas ao modelo.',
    de: 'Die Schlagzeile des Bands und einige Empfehlungen, abgeleitet aus dem, was die anderen Funktionen sehen. Keine Modellaufrufe.',
    ko: '다른 기능들이 관찰한 내용을 바탕으로 밴드 헤드라인과 몇 가지 권장 사항을 만듭니다. 모델 호출은 없습니다.',
  },
  commandDesc: {
    en: 'Open the Smart Advisor: what needs attention and what to do about it',
    he: 'פותח את היועץ החכם: מה דורש תשומת לב ומה לעשות',
    es: 'Abre el asesor inteligente: qué requiere atención y qué hacer',
    fr: 'Ouvre le conseiller intelligent : ce qui demande de l’attention et quoi faire',
    ru: 'Открыть умного советника: что требует внимания и что делать',
    zh: '打开智能顾问：哪些事需要关注，以及该怎么做',
    ja: 'スマートアドバイザーを開きます：注意が必要なことと対処法',
    pt: 'Abre o Consultor Inteligente: o que precisa de atenção e o que fazer',
    de: 'Öffnet den Smart-Berater: was Aufmerksamkeit braucht und was zu tun ist',
    ko: '스마트 어드바이저를 엽니다: 주의가 필요한 항목과 대처 방법',
  },
  off: {
    en: 'The Smart Advisor is off. Turn it on in the /toolkitty pane.',
    he: 'היועץ החכם כבוי. הפעל אותו בלוח /toolkitty.',
    es: 'El asesor inteligente está desactivado. Actívalo en el panel /toolkitty.',
    fr: 'Le conseiller intelligent est désactivé. Active-le dans le panneau /toolkitty.',
    ru: 'Умный советник отключён. Включите его в панели /toolkitty.',
    zh: '智能顾问已关闭。请在 /toolkitty 面板中开启。',
    ja: 'スマートアドバイザーはオフです。/toolkitty ペインでオンにしてください。',
    pt: 'O Consultor Inteligente está desativado. Ative-o no painel /toolkitty.',
    de: 'Der Smart-Berater ist aus. Schalte ihn im Panel /toolkitty ein.',
    ko: '스마트 어드바이저가 꺼져 있습니다. /toolkitty 창에서 켜세요.',
  },
  opened: { en: 'Opened the Advisor.', he: 'היועץ נפתח.', es: 'Asesor abierto.', fr: 'Conseiller ouvert.', ru: 'Советник открыт.', zh: '已打开顾问。', ja: 'アドバイザーを開きました。', pt: 'Consultor aberto.', de: 'Berater geöffnet.', ko: '어드바이저를 열었습니다.' },
  paneTitle: { en: 'Advisor', he: 'יועץ', es: 'Asesor', fr: 'Conseiller', ru: 'Советник', zh: '顾问', ja: 'アドバイザー', pt: 'Consultor', de: 'Berater', ko: '어드바이저' },
  paneOff: { en: 'The Smart Advisor is off.', he: 'היועץ החכם כבוי.', es: 'El asesor inteligente está desactivado.', fr: 'Le conseiller intelligent est désactivé.', ru: 'Умный советник отключён.', zh: '智能顾问已关闭。', ja: 'スマートアドバイザーはオフです。', pt: 'O Consultor Inteligente está desativado.', de: 'Der Smart-Berater ist aus.', ko: '스마트 어드바이저가 꺼져 있습니다.' },
  signalsNow: { en: 'Signals now', he: 'אותות עכשיו', es: 'Señales ahora', fr: 'Signaux en ce moment', ru: 'Сигналы сейчас', zh: '当前信号', ja: '現在のシグナル', pt: 'Sinais agora', de: 'Aktuelle Signale', ko: '현재 신호' },
  empty: {
    en: 'Nothing to recommend.',
    he: 'אין מה להמליץ כרגע.',
    es: 'Nada que recomendar.',
    fr: 'Rien à recommander.',
    ru: 'Рекомендаций нет.',
    zh: '没有可推荐的内容。',
    ja: '提案はありません。',
    pt: 'Nada a recomendar.',
    de: 'Nichts zu empfehlen.',
    ko: '권장할 항목이 없습니다.',
  },
  emptyHint: {
    en: 'Signals appear as the session runs.',
    he: 'האותות יופיעו תוך כדי הסשן.',
    es: 'Las señales aparecen a medida que avanza la sesión.',
    fr: 'Les signaux apparaissent au fil de la session.',
    ru: 'Сигналы появятся по ходу сессии.',
    zh: '信号会随会话运行逐渐出现。',
    ja: 'シグナルはセッションの進行に合わせて表示されます。',
    pt: 'Os sinais aparecem conforme a sessão avança.',
    de: 'Signale erscheinen, während die Session läuft.',
    ko: '세션이 진행되면 신호가 나타납니다.',
  },
  ignore: { en: 'Ignore', he: 'התעלם', es: 'Ignorar', fr: 'Ignorer', ru: 'Игнорировать', zh: '忽略', ja: '無視', pt: 'Ignorar', de: 'Ignorieren', ko: '무시' },
  ignoreToday: { en: 'Ignore for today', he: 'התעלם להיום', es: 'Ignorar por hoy', fr: 'Ignorer pour aujourd’hui', ru: 'Игнорировать сегодня', zh: '今天忽略', ja: '今日は無視', pt: 'Ignorar por hoje', de: 'Für heute ignorieren', ko: '오늘은 무시' },
  ignoredRow: {
    en: 'Ignored for 30 min: {title}',
    he: 'מתעלם ל-30 דקות: {title}',
    es: 'Ignorado 30 min: {title}',
    fr: 'Ignoré 30 min : {title}',
    ru: 'Игнорируется 30 мин: {title}',
    zh: '已忽略 30 分钟：{title}',
    ja: '30分間無視しました：{title}',
    pt: 'Ignorado por 30 min: {title}',
    de: '30 Min. ignoriert: {title}',
    ko: '30분간 무시함: {title}',
  },
  openPane: { en: 'Open the Advisor', he: 'פתח את היועץ', es: 'Abrir el asesor', fr: 'Ouvrir le conseiller', ru: 'Открыть советник', zh: '打开顾问', ja: 'アドバイザーを開く', pt: 'Abrir o Consultor', de: 'Berater öffnen', ko: '어드바이저 열기' },

  // Headline states (the word in the pane header).
  stateError: { en: 'failing', he: 'נכשל', es: 'con fallos', fr: 'en échec', ru: 'сбои', zh: '失败', ja: '失敗', pt: 'falhando', de: 'Fehler', ko: '실패' },
  stateSecurity: { en: 'blocked', he: 'נחסם', es: 'bloqueado', fr: 'bloqué', ru: 'заблокировано', zh: '已拦截', ja: 'ブロック', pt: 'bloqueado', de: 'blockiert', ko: '차단됨' },
  stateWaiting: { en: 'waiting', he: 'ממתין', es: 'esperando', fr: 'en attente', ru: 'ожидание', zh: '等待中', ja: '待機中', pt: 'aguardando', de: 'wartet', ko: '대기' },
  stateResource: { en: 'running low', he: 'משאבים אוזלים', es: 'recursos bajos', fr: 'faible', ru: 'на исходе', zh: '即将不足', ja: '残りわずか', pt: 'acabando', de: 'knapp', ko: '부족' },
  stateWorking: { en: 'working', he: 'עובד', es: 'trabajando', fr: 'au travail', ru: 'работает', zh: '工作中', ja: '作業中', pt: 'trabalhando', de: 'aktiv', ko: '작업 중' },
  stateDone: { en: 'done', he: 'הסתיים', es: 'terminado', fr: 'terminé', ru: 'готово', zh: '完成', ja: '完了', pt: 'concluído', de: 'fertig', ko: '완료' },
  stateReady: { en: 'ready', he: 'מוכן', es: 'listo', fr: 'prêt', ru: 'готов', zh: '就绪', ja: '準備完了', pt: 'pronto', de: 'bereit', ko: '준비됨' },

  // Headline chip texts.
  headError: { en: '🔴 {n} repeated failures', he: '🔴 {n} כשלים חוזרים', es: '🔴 {n} fallos repetidos', fr: '🔴 {n} échecs répétés', ru: '🔴 повторных сбоев: {n}', zh: '🔴 {n} 次重复失败', ja: '🔴 {n} 回の連続失敗', pt: '🔴 {n} falhas repetidas', de: '🔴 {n} Fehler in Folge', ko: '🔴 반복 실패 {n}회' },
  headLoop: { en: '🔴 looping', he: '🔴 לולאה', es: '🔴 en bucle', fr: '🔴 boucle', ru: '🔴 зацикливание', zh: '🔴 循环中', ja: '🔴 ループ中', pt: '🔴 em loop', de: '🔴 Schleife', ko: '🔴 루프 중' },
  headBlocked: { en: '🔴 blocked: {kind}', he: '🔴 נחסם: {kind}', es: '🔴 bloqueado: {kind}', fr: '🔴 bloqué : {kind}', ru: '🔴 заблокировано: {kind}', zh: '🔴 已拦截：{kind}', ja: '🔴 ブロック：{kind}', pt: '🔴 bloqueado: {kind}', de: '🔴 blockiert: {kind}', ko: '🔴 차단됨: {kind}' },
  headWaiting: { en: '🟡 approval needed', he: '🟡 נדרש אישור', es: '🟡 se necesita aprobación', fr: '🟡 approbation requise', ru: '🟡 нужно подтверждение', zh: '🟡 需要批准', ja: '🟡 承認が必要', pt: '🟡 aprovação necessária', de: '🟡 Freigabe nötig', ko: '🟡 승인 필요' },
  headResource: { en: '🟠 {what} {pct}%', he: '🟠 {what} {pct}%', es: '🟠 {what} {pct}%', fr: '🟠 {what} {pct} %', ru: '🟠 {what} {pct}%', zh: '🟠 {what} {pct}%', ja: '🟠 {what} {pct}%', pt: '🟠 {what} {pct}%', de: '🟠 {what} {pct}%', ko: '🟠 {what} {pct}%' },
  headResourceBare: { en: '🟠 {what}', he: '🟠 {what}', es: '🟠 {what}', fr: '🟠 {what}', ru: '🟠 {what}', zh: '🟠 {what}', ja: '🟠 {what}', pt: '🟠 {what}', de: '🟠 {what}', ko: '🟠 {what}' },
  headWorking: { en: '⚡ {what} · {time}', he: '⚡ {what} · {time}', es: '⚡ {what} · {time}', fr: '⚡ {what} · {time}', ru: '⚡ {what} · {time}', zh: '⚡ {what} · {time}', ja: '⚡ {what} · {time}', pt: '⚡ {what} · {time}', de: '⚡ {what} · {time}', ko: '⚡ {what} · {time}' },
  headDone: {
    en: '✅ done · {files} · tests {tests}',
    he: '✅ הושלם · {files} · בדיקות: {tests}',
    es: '✅ listo · {files} · pruebas: {tests}',
    fr: '✅ terminé · {files} · tests : {tests}',
    ru: '✅ готово · {files} · тесты: {tests}',
    zh: '✅ 完成 · {files} · 测试 {tests}',
    ja: '✅ 完了 · {files} · テスト {tests}',
    pt: '✅ concluído · {files} · testes {tests}',
    de: '✅ fertig · {files} · Tests {tests}',
    ko: '✅ 완료 · {files} · 테스트 {tests}',
  },
  headReady: { en: '🟢 ready · ctx {n}%', he: '🟢 מוכן · הקשר {n}%', es: '🟢 listo · ctx {n}%', fr: '🟢 prêt · ctx {n} %', ru: '🟢 готов · ctx {n}%', zh: '🟢 就绪 · 上下文 {n}%', ja: '🟢 準備完了 · ctx {n}%', pt: '🟢 pronto · ctx {n}%', de: '🟢 bereit · Ktx {n}%', ko: '🟢 준비됨 · ctx {n}%' },
  headReadyBare: { en: '🟢 ready', he: '🟢 מוכן', es: '🟢 listo', fr: '🟢 prêt', ru: '🟢 готов', zh: '🟢 就绪', ja: '🟢 準備完了', pt: '🟢 pronto', de: '🟢 bereit', ko: '🟢 준비됨' },
  filesOne: { en: '1 file', he: 'קובץ אחד', es: '1 archivo', fr: '1 fichier', ru: '1 файл', zh: '1 个文件', ja: '1 ファイル', pt: '1 arquivo', de: '1 Datei', ko: '파일 1개' },
  filesMany: { en: '{n} files', he: '{n} קבצים', es: '{n} archivos', fr: '{n} fichiers', ru: 'файлов: {n}', zh: '{n} 个文件', ja: '{n} ファイル', pt: '{n} arquivos', de: '{n} Dateien', ko: '파일 {n}개' },
  testsPassed: { en: 'passed', he: 'עברו', es: 'pasaron', fr: 'réussis', ru: 'пройдены', zh: '通过', ja: '成功', pt: 'passou', de: 'bestanden', ko: '통과' },
  testsFailed: { en: 'failed', he: 'נכשלו', es: 'fallaron', fr: 'échoués', ru: 'провалены', zh: '失败', ja: '失敗', pt: 'falhou', de: 'fehlgeschl.', ko: '실패' },
  testsNotRun: { en: 'not run', he: 'לא הורצו', es: 'sin ejecutar', fr: 'non lancés', ru: 'не запускались', zh: '未运行', ja: '未実行', pt: 'não rodou', de: 'nicht gelaufen', ko: '미실행' },
  lblContext: { en: 'context', he: 'הקשר', es: 'contexto', fr: 'contexte', ru: 'контекст', zh: '上下文', ja: 'コンテキスト', pt: 'contexto', de: 'Kontext', ko: '컨텍스트' },
  lblWeekly: { en: 'weekly', he: 'שבועי', es: 'semanal', fr: 'hebdo', ru: 'неделя', zh: '每周', ja: '週間', pt: 'semanal', de: 'Woche', ko: '주간' },
  lblFiveHour: { en: '5h', he: '5 שעות', es: '5 h', fr: '5 h', ru: '5 ч', zh: '5 小时', ja: '5時間', pt: '5h', de: '5 Std.', ko: '5시간' },
  lblBudget: { en: 'budget', he: 'תקציב', es: 'presupuesto', fr: 'budget', ru: 'бюджет', zh: '预算', ja: '予算', pt: 'orçamento', de: 'Budget', ko: '예산' },
  lblQuota: { en: 'quota', he: 'מכסה', es: 'cuota', fr: 'quota', ru: 'лимит', zh: '配额', ja: 'クォータ', pt: 'cota', de: 'Kontingent', ko: '할당량' },
  levelOk: { en: 'ok', he: 'תקין', es: 'ok', fr: 'ok', ru: 'ок', zh: '正常', ja: 'OK', pt: 'ok', de: 'ok', ko: '정상' },
  levelInfo: { en: 'info', he: 'מידע', es: 'info', fr: 'info', ru: 'инфо', zh: '提示', ja: '情報', pt: 'info', de: 'Info', ko: '정보' },
  levelWarn: { en: 'warning', he: 'אזהרה', es: 'aviso', fr: 'attention', ru: 'внимание', zh: '警告', ja: '警告', pt: 'aviso', de: 'Warnung', ko: '경고' },
  levelAlert: { en: 'alert', he: 'התראה', es: 'alerta', fr: 'alerte', ru: 'тревога', zh: '警报', ja: 'アラート', pt: 'alerta', de: 'Alarm', ko: '경보' },

  // Rules.
  pressureTitle: {
    en: 'Repeated work and context pressure',
    he: 'עבודה חוזרת ולחץ על ההקשר',
    es: 'Trabajo repetido y presión de contexto',
    fr: 'Travail répété et pression sur le contexte',
    ru: 'Повторная работа и нехватка контекста',
    zh: '重复工作与上下文压力',
    ja: '重複作業とコンテキストの圧迫',
    pt: 'Trabalho repetido e pressão no contexto',
    de: 'Wiederholte Arbeit und Kontextdruck',
    ko: '반복 작업과 컨텍스트 압박',
  },
  pressureBody: {
    en: 'context {ctx}% · {waste} repeated reads · {fail} failures',
    he: 'הקשר {ctx}% · {waste} קריאות כפולות · {fail} כשלים',
    es: 'contexto {ctx}% · {waste} lecturas repetidas · {fail} fallos',
    fr: 'contexte {ctx} % · {waste} lectures répétées · {fail} échecs',
    ru: 'контекст {ctx}% · повторных чтений: {waste} · сбоев: {fail}',
    zh: '上下文 {ctx}% · {waste} 次重复读取 · {fail} 次失败',
    ja: 'コンテキスト {ctx}% · 重複読み取り {waste} 回 · 失敗 {fail} 回',
    pt: 'contexto {ctx}% · {waste} leituras repetidas · {fail} falhas',
    de: 'Kontext {ctx}% · {waste} wiederholte Lesevorgänge · {fail} Fehler',
    ko: '컨텍스트 {ctx}% · 중복 읽기 {waste}회 · 실패 {fail}회',
  },
  paceTitle: { en: 'Usage ahead of pace', he: 'השימוש מקדים את הקצב', es: 'Uso por encima del ritmo', fr: 'Consommation en avance sur le rythme', ru: 'Расход опережает темп', zh: '用量超出节奏', ja: '使用量がペースを超過', pt: 'Uso acima do ritmo', de: 'Verbrauch schneller als geplant', ko: '사용량이 페이스를 초과' },
  signalsBody: { en: 'Signals: {what}', he: 'אותות: {what}', es: 'Señales: {what}', fr: 'Signaux : {what}', ru: 'Сигналы: {what}', zh: '信号：{what}', ja: 'シグナル：{what}', pt: 'Sinais: {what}', de: 'Signale: {what}', ko: '신호: {what}' },
  loopTitle: { en: 'Claude is looping', he: 'Claude תקוע בלולאה', es: 'Claude está en bucle', fr: 'Claude tourne en boucle', ru: 'Claude зациклился', zh: 'Claude 陷入了循环', ja: 'Claude がループしています', pt: 'O Claude está em loop', de: 'Claude dreht sich im Kreis', ko: 'Claude가 루프에 빠졌습니다' },
  loopBody: { en: 'Loop signal: {what}', he: 'אות לולאה: {what}', es: 'Señal de bucle: {what}', fr: 'Signal de boucle : {what}', ru: 'Сигнал цикла: {what}', zh: '循环信号：{what}', ja: 'ループのシグナル：{what}', pt: 'Sinal de loop: {what}', de: 'Schleifensignal: {what}', ko: '루프 신호: {what}' },
  dupsTitle: { en: 'Duplicate reads', he: 'קריאות כפולות', es: 'Lecturas duplicadas', fr: 'Lectures en double', ru: 'Повторные чтения', zh: '重复读取', ja: '重複読み取り', pt: 'Leituras duplicadas', de: 'Doppelte Lesevorgänge', ko: '중복 읽기' },
  dupsBody: {
    en: '{n} repeated reads in this session',
    he: '{n} קריאות חוזרות בסשן הזה',
    es: '{n} lecturas repetidas en esta sesión',
    fr: '{n} lectures répétées dans cette session',
    ru: 'повторных чтений в сессии: {n}',
    zh: '本次会话中有 {n} 次重复读取',
    ja: 'このセッションで {n} 回の重複読み取り',
    pt: '{n} leituras repetidas nesta sessão',
    de: '{n} wiederholte Lesevorgänge in dieser Session',
    ko: '이 세션에서 중복 읽기 {n}회',
  },
  cacheTitle: {
    en: 'Cold cache: the next send re-reads everything',
    he: 'המטמון קר: השליחה הבאה תקרא הכול מחדש',
    es: 'Caché fría: el próximo envío vuelve a leerlo todo',
    fr: 'Cache froid : le prochain envoi relit tout',
    ru: 'Кэш остыл: следующая отправка перечитает всё',
    zh: '缓存已冷：下次发送会重新读取全部内容',
    ja: 'キャッシュ切れ：次の送信ですべて再読み込みされます',
    pt: 'Cache frio: o próximo envio relê tudo',
    de: 'Cache kalt: Beim nächsten Senden wird alles neu gelesen',
    ko: '캐시가 식었습니다: 다음 전송 때 모든 것을 다시 읽습니다',
  },
  cacheBody: { en: 'cache cold · context {ctx}%', he: 'מטמון קר · הקשר {ctx}%', es: 'caché fría · contexto {ctx}%', fr: 'cache froid · contexte {ctx} %', ru: 'кэш остыл · контекст {ctx}%', zh: '缓存已冷 · 上下文 {ctx}%', ja: 'キャッシュ切れ · コンテキスト {ctx}%', pt: 'cache frio · contexto {ctx}%', de: 'Cache kalt · Kontext {ctx}%', ko: '캐시 식음 · 컨텍스트 {ctx}%' },
  guardTitle: { en: 'A guard blocked something', he: 'מנגנון הגנה חסם משהו', es: 'Una protección bloqueó algo', fr: 'Une protection a bloqué quelque chose', ru: 'Защита что-то заблокировала', zh: '有防护拦截了某项操作', ja: 'ガードが何かをブロックしました', pt: 'Uma proteção bloqueou algo', de: 'Ein Guard hat etwas blockiert', ko: '가드가 무언가를 차단했습니다' },
  guardBody: { en: '{kind} · {what}', he: '{kind} · {what}', es: '{kind} · {what}', fr: '{kind} · {what}', ru: '{kind} · {what}', zh: '{kind} · {what}', ja: '{kind} · {what}', pt: '{kind} · {what}', de: '{kind} · {what}', ko: '{kind} · {what}' },
  agentsTitle: {
    en: 'Subagent requests were denied',
    he: 'בקשות לסוכני משנה נדחו',
    es: 'Se denegaron solicitudes de subagentes',
    fr: 'Des demandes de sous-agents ont été refusées',
    ru: 'Запросы субагентов отклонены',
    zh: '子代理的请求被拒绝',
    ja: 'サブエージェントのリクエストが拒否されました',
    pt: 'Solicitações de subagentes foram negadas',
    de: 'Anfragen von Subagenten wurden abgelehnt',
    ko: '서브에이전트 요청이 거부되었습니다',
  },
  waitTitle: { en: 'Claude is waiting for you', he: 'Claude מחכה לך', es: 'Claude te está esperando', fr: 'Claude t’attend', ru: 'Claude ждёт вас', zh: 'Claude 正在等你', ja: 'Claude があなたを待っています', pt: 'O Claude está esperando por você', de: 'Claude wartet auf dich', ko: 'Claude가 기다리고 있습니다' },
  waitBody: {
    en: 'waiting for your approval for {time}',
    he: 'ממתין לאישור שלך כבר {time}',
    es: 'esperando tu aprobación desde hace {time}',
    fr: 'en attente de ton approbation depuis {time}',
    ru: 'ожидает вашего подтверждения уже {time}',
    zh: '已等待你批准 {time}',
    ja: '{time} 承認待ち',
    pt: 'aguardando sua aprovação há {time}',
    de: 'wartet seit {time} auf deine Freigabe',
    ko: '{time} 동안 승인 대기 중',
  },
} as const

/** The label of each action reference. */
const ACTION_LABELS: Readonly<Record<string, Localized>> = {
  'detail:idle-handoff': { en: 'Prepare handoff', he: 'הכנת העברה', es: 'Preparar traspaso', fr: 'Préparer le relais', ru: 'Подготовить передачу', zh: '准备交接', ja: '引き継ぎを準備', pt: 'Preparar a transferência', de: 'Übergabe vorbereiten', ko: '인수인계 준비' },
  'notice:handoffTip': { en: 'How to hand off', he: 'איך מעבירים', es: 'Cómo traspasar', fr: 'Comment passer le relais', ru: 'Как передать', zh: '如何交接', ja: '引き継ぎ方法', pt: 'Como transferir', de: 'So übergibst du', ko: '인수인계 방법' },
  'detail:plan-pace': { en: 'See plan pace', he: 'קצב התוכנית', es: 'Ver el ritmo del plan', fr: 'Voir le rythme du forfait', ru: 'Темп тарифа', zh: '查看计划进度', ja: 'プランのペースを見る', pt: 'Ver ritmo do plano', de: 'Plan-Tempo ansehen', ko: '플랜 페이스 보기' },
  'detail:budget-guard': { en: 'See budget', he: 'ראה תקציב', es: 'Ver presupuesto', fr: 'Voir le budget', ru: 'Бюджет', zh: '查看预算', ja: '予算を見る', pt: 'Ver orçamento', de: 'Budget ansehen', ko: '예산 보기' },
  'detail:loop-detective': { en: 'See the loop', he: 'ראה את הלולאה', es: 'Ver el bucle', fr: 'Voir la boucle', ru: 'Показать цикл', zh: '查看循环', ja: 'ループを見る', pt: 'Ver o loop', de: 'Schleife ansehen', ko: '루프 보기' },
  'open:toolkitty-notices': { en: 'Open notices', he: 'פתח התראות', es: 'Abrir avisos', fr: 'Ouvrir les notifications', ru: 'Открыть уведомления', zh: '打开通知', ja: '通知を開く', pt: 'Abrir avisos', de: 'Hinweise öffnen', ko: '알림 열기' },
  'detail:dup-read-detector': { en: 'See duplicate reads', he: 'ראה קריאות כפולות', es: 'Ver lecturas duplicadas', fr: 'Voir les lectures en double', ru: 'Повторные чтения', zh: '查看重复读取', ja: '重複読み取りを見る', pt: 'Ver leituras duplicadas', de: 'Doppelte Lesevorgänge ansehen', ko: '중복 읽기 보기' },
  'detail:cache-countdown': { en: 'See cache timer', he: 'ראה טיימר מטמון', es: 'Ver temporizador de caché', fr: 'Voir le minuteur du cache', ru: 'Таймер кэша', zh: '查看缓存计时器', ja: 'キャッシュタイマーを見る', pt: 'Ver timer do cache', de: 'Cache-Timer ansehen', ko: '캐시 타이머 보기' },
  'open:incidents': { en: 'Open incidents', he: 'פתח אירועים', es: 'Abrir incidentes', fr: 'Ouvrir les incidents', ru: 'Открыть инциденты', zh: '打开事件记录', ja: 'インシデントを開く', pt: 'Abrir incidentes', de: 'Vorfälle öffnen', ko: '막아낸 사고 열기' },
  'detail:subagent-guard': { en: 'See subagents', he: 'ראה סוכני משנה', es: 'Ver subagentes', fr: 'Voir les sous-agents', ru: 'Субагенты', zh: '查看子代理', ja: 'サブエージェントを見る', pt: 'Ver subagentes', de: 'Subagenten ansehen', ko: '서브에이전트 보기' },
}

/** Notices an action can post. */
const NOTICE_TEXTS: Readonly<Record<string, Localized>> = {
  handoffTip: {
    en: 'Run /handoff to save a summary, then continue in a fresh session.',
    he: 'הרץ /handoff כדי לשמור סיכום, ואז המשך בסשן חדש.',
    es: 'Ejecuta /handoff para guardar un resumen y continúa en una sesión nueva.',
    fr: 'Lance /handoff pour enregistrer un résumé, puis continue dans une nouvelle session.',
    ru: 'Выполните /handoff, чтобы сохранить сводку, и продолжите в новой сессии.',
    zh: '运行 /handoff 保存摘要，然后在新会话中继续。',
    ja: '/handoff を実行して要約を保存し、新しいセッションで続けましょう。',
    pt: 'Execute /handoff para salvar um resumo e continue em uma sessão nova.',
    de: 'Führe /handoff aus, um eine Zusammenfassung zu speichern, und mach in einer neuen Session weiter.',
    ko: '/handoff를 실행해 요약을 저장한 뒤 새 세션에서 이어가세요.',
  },
}

/** Titles of the panes an `open:` action can open (anything else is titled Toolkitty). */
const PANE_TITLES: Readonly<Record<string, Localized>> = {
  incidents: { en: 'Disasters prevented', he: 'אסונות שנמנעו', es: 'Desastres evitados', fr: 'Désastres évités', ru: 'Предотвращённые катастрофы', zh: '已避免的灾难', ja: '防いだ事故', pt: 'Desastres evitados', de: 'Verhinderte Katastrophen', ko: '막아낸 사고' },
  'toolkitty-notices': { en: 'Notices', he: 'התראות', es: 'Avisos', fr: 'Notifications', ru: 'Уведомления', zh: '通知', ja: '通知', pt: 'Avisos', de: 'Hinweise', ko: '알림' },
}

const LEVEL_WORDS: Readonly<Record<Level, Localized>> = {
  ok: T.levelOk,
  info: T.levelInfo,
  warn: T.levelWarn,
  alert: T.levelAlert,
}

export const feature: Feature = { id: 'advisor', title: T.title, description: T.description, defaultOn: true }

const PANE_ID = 'advisor'
const DETAIL_PANE_ID = 'toolkitty-detail'
const FRESH_MS = 10_000
const COOLDOWN_MS = 30 * 60_000
const SECOND_PRESS_MS = 10 * 60_000
const WAIT_MS = 60_000
const MAX_CARDS = 3

type HeadState = 'error' | 'security' | 'waiting' | 'resource' | 'working' | 'done' | 'ready'
type Head = { state: HeadState; text: string; level: Level }
type Rec = { id: string; level: Level; at: number; title: string; body: string; actions: string[] }
/** A dismissed rule: hidden until `until`; `at` is the press; `day` when it was pressed twice (rest of today). */
type Mark = { until: number; at: number; day: boolean }
type Dismissed = { rules: Record<string, Mark> }
type View = { now: number; items: Signal[]; head: Head; recs: Rec[]; ignored: Rec[] }

const dismissed = atom({ plugin: 'toolkitty', key: 'slot', id: 'advisor' } as const, { rules: {} } as Dismissed) as unknown as Atom<Dismissed>
/** Written once a second only when what the advisor says changed: it redraws every drawing that reads it. */
const tick = atom({ plugin: 'toolkitty', key: 'slot', id: 'advisor-tick' } as const, { key: '' } as { key: string }) as unknown as Atom<{ key: string }>
/** Toolkitty's detail pane shows the feature in this slot (the same ref register.tsx declares). */
const detailFeature = atom({ plugin: 'toolkitty', key: 'slot', id: 'detail-feature' } as const, null as string | null) as unknown as Atom<string | null>

let ticker: Timer | undefined

const RANK: Record<Level, number> = { alert: 3, warn: 2, info: 1, ok: 0 }

function peak(items: readonly Signal[], kind: SignalKind): number {
  let best = 0
  for (const s of ofKind(items, kind)) if ((s.value ?? 0) > best) best = s.value ?? 0
  return best
}

function newestAt(items: readonly Signal[], kinds: readonly SignalKind[]): number {
  let at = 0
  for (const s of items) if (kinds.includes(s.kind) && s.at > at) at = s.at
  return at
}

function endOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(24, 0, 0, 0)
  return d.getTime()
}

/** The kind of an incident signal: the part of its id after the feature, else its text. */
function incidentKind(s: Signal): string {
  const i = s.id.indexOf(':')
  const tail = i >= 0 ? s.id.slice(i + 1) : ''
  return tail !== '' ? tail : s.text
}

function resourceLabel(s: Signal): string {
  const probe = `${s.id} ${s.text}`.toLowerCase()
  if (/week|7d/.test(probe)) return t(T.lblWeekly)
  if (/5h|5-hour|session/.test(probe)) return t(T.lblFiveHour)
  return s.kind === 'budget' ? t(T.lblBudget) : t(T.lblQuota)
}

type Pressure = { label: string; pct: number | undefined; level: Level }

/** Quota and budget signals that are past warn, worst first. */
function usagePressures(items: readonly Signal[]): Pressure[] {
  const out: Pressure[] = []
  for (const s of [...ofKind(items, 'quota'), ...ofKind(items, 'budget')]) {
    if (s.level !== 'warn' && s.level !== 'alert') continue
    const pct = s.value === undefined ? undefined : Math.round(s.value)
    const level: Level = s.level === 'alert' || (pct !== undefined && pct >= 90) ? 'alert' : 'warn'
    out.push({ label: resourceLabel(s), pct, level })
  }
  return out.sort((a, b) => RANK[b.level] - RANK[a.level] || (b.pct ?? 0) - (a.pct ?? 0))
}

/** The one headline of the band, by priority. */
function headlineOf(items: readonly Signal[], now: number): Head {
  // Error
  const fail = peak(items, 'failure')
  const loops = ofKind(items, 'loop')
  if (fail >= 3 || loops.length > 0) {
    const n = Math.round(Math.max(fail, loops[0]?.value ?? 0))
    // Three or more identical failures read as repeated failures; a loop pattern with fewer reads as looping.
    return { state: 'error', text: fail >= 3 ? t(T.headError, { n }) : t(T.headLoop), level: 'alert' }
  }
  // Security
  const fresh = ofKind(items, 'incident').find(s => now - s.at < FRESH_MS)
  if (fresh !== undefined) return { state: 'security', text: t(T.headBlocked, { kind: incidentKind(fresh) }), level: 'alert' }
  // Waiting
  if (ofKind(items, 'waiting').length > 0) return { state: 'waiting', text: t(T.headWaiting), level: 'warn' }
  // Resource
  const ctx = peak(items, 'context')
  const pressures = usagePressures(items)
  if (ctx >= 80) pressures.push({ label: t(T.lblContext), pct: Math.round(ctx), level: ctx >= 90 ? 'alert' : 'warn' })
  pressures.sort((a, b) => RANK[b.level] - RANK[a.level] || (b.pct ?? 0) - (a.pct ?? 0))
  const worst = pressures[0]
  if (worst !== undefined) {
    const text = worst.pct === undefined ? t(T.headResourceBare, { what: worst.label }) : t(T.headResource, { what: worst.label, pct: worst.pct })
    return { state: 'resource', text, level: worst.level }
  }
  // Working
  const working = ofKind(items, 'working')[0]
  if (working !== undefined) {
    const what = working.text.length > 24 ? `${working.text.slice(0, 23)}…` : working.text
    return { state: 'working', text: t(T.headWorking, { what, time: clockText(now - working.at) }), level: 'info' }
  }
  // Done: the tests word comes only from an evidence signal.
  const done = ofKind(items, 'done').find(s => now - s.at < FRESH_MS)
  if (done !== undefined) {
    const evidence = ofKind(items, 'evidence')[0]
    const verdict = evidence?.value === 1 ? 'passed' : evidence?.value === 0 ? 'failed' : 'none'
    const tests = verdict === 'passed' ? t(T.testsPassed) : verdict === 'failed' ? t(T.testsFailed) : t(T.testsNotRun)
    const n = Math.round(done.value ?? 0)
    const files = n === 1 ? t(T.filesOne) : t(T.filesMany, { n })
    return { state: 'done', text: t(T.headDone, { files, tests }), level: verdict === 'passed' ? 'ok' : 'info' }
  }
  // Ready
  const text = ofKind(items, 'context').length > 0 ? t(T.headReady, { n: Math.round(ctx) }) : t(T.headReadyBare)
  return { state: 'ready', text, level: 'ok' }
}

/** Every rule that fires now, before cooldowns, ordered by level then recency. */
function recommend(items: readonly Signal[], now: number): Rec[] {
  const out: Rec[] = []
  const ctx = peak(items, 'context')
  const waste = peak(items, 'waste')
  const fail = peak(items, 'failure')

  if (ctx >= 80 && (waste >= 3 || fail >= 3)) {
    out.push({
      id: 'pressure',
      level: ctx >= 90 ? 'alert' : 'warn',
      at: newestAt(items, ['context', 'waste', 'failure']),
      title: t(T.pressureTitle),
      body: t(T.pressureBody, { ctx: Math.round(ctx), waste: Math.round(waste), fail: Math.round(fail) }),
      actions: ['detail:idle-handoff', 'notice:handoffTip'],
    })
  }

  const usage = usagePressures(items)
  if (usage.length > 0) {
    const what = usage.map(p => (p.pct === undefined ? p.label : `${p.label} ${p.pct}%`)).join(' · ')
    out.push({
      id: 'pace',
      level: usage[0]?.level ?? 'warn',
      at: newestAt(items, ['quota', 'budget']),
      title: t(T.paceTitle),
      body: t(T.signalsBody, { what }),
      actions: ['detail:plan-pace', 'detail:budget-guard'],
    })
  }

  const loop = ofKind(items, 'loop')[0]
  if (loop !== undefined) {
    out.push({
      id: 'loop',
      level: 'alert',
      at: loop.at,
      title: t(T.loopTitle),
      body: t(T.loopBody, { what: loop.text }),
      actions: ['detail:loop-detective', 'open:toolkitty-notices'],
    })
  }

  if (waste >= 5) {
    out.push({
      id: 'dups',
      level: 'warn',
      at: newestAt(items, ['waste']),
      title: t(T.dupsTitle),
      body: t(T.dupsBody, { n: Math.round(waste) }),
      actions: ['detail:dup-read-detector'],
    })
  }

  const cold = ofKind(items, 'cache').find(s => (s.value !== undefined && s.value <= 0) || /cold/i.test(s.text))
  if (cold !== undefined && ctx >= 40) {
    out.push({
      id: 'cache',
      level: 'info',
      at: cold.at,
      title: t(T.cacheTitle),
      body: t(T.cacheBody, { ctx: Math.round(ctx) }),
      actions: ['detail:cache-countdown'],
    })
  }

  const incident = ofKind(items, 'incident')[0]
  if (incident !== undefined) {
    out.push({
      id: 'guard',
      level: 'warn',
      at: incident.at,
      title: t(T.guardTitle),
      body: t(T.guardBody, { kind: incidentKind(incident), what: incident.text }),
      actions: ['open:incidents'],
    })
  }

  const denied = ofKind(items, 'agents').find(s => /denied/i.test(s.text) || s.level === 'warn' || s.level === 'alert')
  if (denied !== undefined) {
    out.push({
      id: 'agents',
      level: 'warn',
      at: denied.at,
      title: t(T.agentsTitle),
      body: t(T.signalsBody, { what: denied.text }),
      actions: ['detail:subagent-guard'],
    })
  }

  const waiting = ofKind(items, 'waiting')[0]
  if (waiting !== undefined && now - waiting.at > WAIT_MS) {
    out.push({
      id: 'waiting',
      level: 'warn',
      at: waiting.at,
      title: t(T.waitTitle),
      body: t(T.waitBody, { time: clockText(now - waiting.at) }),
      actions: [],
    })
  }

  return out.sort((a, b) => RANK[b.level] - RANK[a.level] || b.at - a.at)
}

/** What the drawings show now. Inside a render hook the reads subscribe the drawing. */
async function snapshot($: EngineInterface): Promise<View> {
  const now = await $.clock.now()
  await read($, tick)
  const items = await current($, now)
  const dis = await read($, dismissed)
  const all = recommend(items, now)
  const recs: Rec[] = []
  const ignored: Rec[] = []
  for (const r of all) {
    const mark = dis.rules[r.id]
    if (mark === undefined || mark.until <= now) {
      if (recs.length < MAX_CARDS) recs.push(r)
    } else if (!mark.day && now - mark.at < SECOND_PRESS_MS) {
      ignored.push(r)
    }
  }
  return { now, items, head: headlineOf(items, now), recs, ignored }
}

/** Once a second: redraw the advisor's drawings only when what they say changed. */
async function pulse($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  const view = await snapshot($)
  const key = [view.head.text, view.recs.map(r => r.id).join(','), view.ignored.map(r => r.id).join(',')].join('|')
  // `update` always writes, so compare first: nothing changed, nothing redraws.
  const last = await read($, tick)
  if (last.key !== key) await update($, tick, () => ({ key }))
}

function cleanDismissed(value: unknown): Dismissed {
  const rules: Record<string, Mark> = {}
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const raw = (value as Record<string, unknown>)['rules']
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [id, m] of Object.entries(raw as Record<string, unknown>)) {
        if (m === null || typeof m !== 'object') continue
        const o = m as Record<string, unknown>
        const until = o['until']
        const at = o['at']
        if (typeof until === 'number' && typeof at === 'number') rules[id] = { until, at, day: o['day'] === true }
      }
    }
  }
  return { rules }
}

/** Ignore: 30 minutes; a second press within 10 minutes: the rest of today. Kept in the store. */
async function ignoreRule($: EngineInterface, id: string): Promise<void> {
  const now = await $.clock.now()
  await update($, dismissed, d => {
    const prev = d.rules[id]
    const second = prev !== undefined && prev.until > now && now - prev.at < SECOND_PRESS_MS
    const mark: Mark = second ? { until: endOfDay(now), at: now, day: true } : { until: now + COOLDOWN_MS, at: now, day: false }
    const rules: Record<string, Mark> = {}
    for (const [key, m] of Object.entries(d.rules)) if (m.until > now) rules[key] = m
    rules[id] = mark
    return { rules }
  })
  const saved = await read($, dismissed)
  await storeSet($, 'advisor:dismissed', saved)
}

/** Runs an action reference: `open:<pane>`, `detail:<feature>` or `notice:<key>`. */
async function runAction($: EngineInterface, ref: string): Promise<void> {
  const i = ref.indexOf(':')
  const kind = ref.slice(0, i)
  const arg = ref.slice(i + 1)
  if (kind === 'open') {
    const title = PANE_TITLES[arg]
    try {
      await $.ui.open({ id: arg, title: title === undefined ? 'Toolkitty' : t(title), focus: true, closeOnEscape: true })
    } catch {
      // no surface to draw it
    }
  } else if (kind === 'detail') {
    await update($, detailFeature, () => arg)
    try {
      await $.ui.open({ id: DETAIL_PANE_ID, title: 'Toolkitty', focus: true, closeOnEscape: true })
    } catch {
      // no surface to draw it
    }
  } else if (kind === 'notice') {
    const text = NOTICE_TEXTS[arg]
    if (text !== undefined) await notice($, 'info', t(text), feature.id)
  }
}

/** Opens the /smart pane (also what the command does). */
export async function openAdvisor($: EngineInterface): Promise<void> {
  try {
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle), focus: true, closeOnEscape: true })
  } catch {
    // no surface to draw it
  }
}

/** The recommendation cards: title, one line of reasoning, the actions and Ignore. */
function cards($: EngineInterface, e: PaneInput, view: View, hotkeys: boolean): RenderElement {
  const { Box, Text, Button } = $.ui.resolve(e)
  let digit = 0
  return (
    <Box flexDirection="column">
      {view.recs.map(r => (
        <Box key={`adv-card-${r.id}`} flexDirection="column" marginBottom={1}>
          <Text bold color={LEVEL_COLOR[r.level]}>
            {r.title}
          </Text>
          <Text dimColor>{r.body}</Text>
          <Box gap={2}>
            {r.actions.map((ref, n) => {
              const label = ACTION_LABELS[ref]
              const hotkey = hotkeys && digit < 9 ? String(++digit) : undefined
              return (
                <Button
                  key={`adv-${r.id}-${n + 1}`}
                  plain={n === 0 ? undefined : true}
                  variant={n === 0 ? 'primary' : undefined}
                  label={label === undefined ? ref : t(label)}
                  hotkey={hotkey}
                  onPress={() => runAction($, ref)}
                />
              )
            })}
            <Button key={`adv-${r.id}-ignore`} plain label={t(T.ignore)} onPress={() => ignoreRule($, r.id)} />
          </Box>
        </Box>
      ))}
      {view.ignored.map(r => (
        <Box key={`adv-ignored-${r.id}`} gap={2}>
          <Text dimColor>{t(T.ignoredRow, { title: r.title })}</Text>
          <Button key={`adv-${r.id}-ignore`} plain label={t(T.ignoreToday)} onPress={() => ignoreRule($, r.id)} />
        </Box>
      ))}
    </Box>
  )
}

function stateWord(state: HeadState): string {
  if (state === 'error') return t(T.stateError)
  if (state === 'security') return t(T.stateSecurity)
  if (state === 'waiting') return t(T.stateWaiting)
  if (state === 'resource') return t(T.stateResource)
  if (state === 'working') return t(T.stateWorking)
  if (state === 'done') return t(T.stateDone)
  return t(T.stateReady)
}

/** THE HEADLINE of the band: the advisor's chip is always drawn first. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature))) return null
  await read($, tick)
  const now = await $.clock.now()
  const head = headlineOf(await current($, now), now)
  return { text: head.text, level: head.level }
}

/** What a press on the headline shows in the detail pane: the same cards. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null
  const { Box, Button } = $.ui.resolve(e)
  const view = await snapshot($)
  return (
    <Box flexDirection="column">
      {view.recs.length === 0 && view.ignored.length === 0 ? emptyState($, e, t(T.empty), t(T.emptyHint)) : cards($, e, view, false)}
      <Button key="adv-open" plain label={t(T.openPane)} onPress={() => openAdvisor($)} />
    </Box>
  )
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'smart', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'smart', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return

  const stored = cleanDismissed(await storeGet<Dismissed>($, 'advisor:dismissed', { rules: {} }))
  await update($, dismissed, d => ({ rules: { ...stored.rules, ...d.rules } }))

  ticker?.cancel()
  ticker = $.clock.every(1000, async () => {
    await pulse($)
  })
}

export function register(on: On) {
  on('command.run', { command: 'smart' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await openAdvisor($)
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const view = await snapshot($)
    const nothing = view.recs.length === 0 && view.ignored.length === 0
    return (
      <Box flexDirection="column">
        {paneHeader($, e, { title: t(T.paneTitle), status: stateWord(view.head.state), level: view.head.level, icon: ICONS.insight })}
        {nothing ? emptyState($, e, t(T.empty), t(T.emptyHint)) : cards($, e, view, true)}
        {view.items.length > 0 ? sectionTitle($, e, t(T.signalsNow)) : null}
        {view.items.map(s =>
          listRow($, e, { key: `adv-sig-${s.id}`, left: s.feature, text: s.text, right: t(LEVEL_WORDS[s.level]), level: s.level }),
        )}
      </Box>
    )
  })
}
