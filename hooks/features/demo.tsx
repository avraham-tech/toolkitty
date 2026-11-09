import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, Timer } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { BandInput, Feature, Input, Localized } from '../core'
import { recordEvidence } from '../evidence'
import { publish, retractAll } from '../signals'
import type { SignalKind } from '../signals'
import { ICONS, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip, HeaderAction, Level } from '../ui'

/*
 * Demo mode: a believable, clearly labelled scene for screenshots and GIFs.
 * It speaks through the same channels the real features use (signals, notices,
 * evidence) and writes the stores that read-only panes draw from under their
 * real keys, after copying each one to `demo:backup:<key>`. `/demo off`
 * restores every key and retracts the signals. Every synthetic text says DEMO.
 */

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Demo mode', he: 'מצב הדגמה', es: 'Modo demo', fr: 'Mode démo', ru: 'Демо-режим', zh: '演示模式', ja: 'デモモード', pt: 'Modo demo', de: 'Demo-Modus', ko: '데모 모드' },
  description: {
    en: 'Fills the panes and the band with clearly labelled synthetic data for screenshots and GIFs, then restores your real data. /demo on, /demo off, /demo scene calm|busy|rescue.',
    he: 'ממלא את החלוניות והרצועה בנתונים סינתטיים מסומנים בבירור לצילומי מסך ו-GIF, ואז משחזר את הנתונים האמיתיים שלך. /demo on, /demo off, /demo scene calm|busy|rescue.',
    es: 'Llena los paneles y la barra con datos sintéticos claramente etiquetados para capturas y GIF, y luego restaura tus datos reales. /demo on, /demo off, /demo scene calm|busy|rescue.',
    fr: 'Remplit les panneaux et la barre de données synthétiques clairement étiquetées pour les captures et les GIF, puis restaure tes vraies données. /demo on, /demo off, /demo scene calm|busy|rescue.',
    ru: 'Заполняет панели и полосу чётко помеченными синтетическими данными для скриншотов и GIF, затем возвращает ваши настоящие данные. /demo on, /demo off, /demo scene calm|busy|rescue.',
    zh: '用带有明确标注的合成数据填充面板和横幅，用于截图和 GIF，然后恢复你的真实数据。/demo on、/demo off、/demo scene calm|busy|rescue。',
    ja: 'スクリーンショットや GIF 用に、明確にラベル付けされた合成データでペインとバンドを埋め、その後あなたの実データを復元します。/demo on、/demo off、/demo scene calm|busy|rescue。',
    pt: 'Preenche os painéis e a faixa com dados sintéticos claramente identificados, para capturas de tela e GIFs, e depois restaura seus dados reais. /demo on, /demo off, /demo scene calm|busy|rescue.',
    de: 'Füllt die Panels und das Band mit eindeutig gekennzeichneten synthetischen Daten für Screenshots und GIFs und stellt danach deine echten Daten wieder her. /demo on, /demo off, /demo scene calm|busy|rescue.',
    ko: '스크린샷과 GIF용으로 명확히 표시된 합성 데이터로 창과 밴드를 채운 뒤 실제 데이터를 복원합니다. /demo on, /demo off, /demo scene calm|busy|rescue.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  cmdDesc: { en: 'Demo mode: synthetic, labelled data for screenshots (on, off, scene)', he: 'מצב הדגמה: נתונים סינתטיים מסומנים לצילומי מסך (on, off, scene)', es: 'Modo demo: datos sintéticos etiquetados para capturas (on, off, scene)', fr: 'Mode démo : données synthétiques étiquetées pour les captures (on, off, scene)', ru: 'Демо-режим: синтетические помеченные данные для скриншотов (on, off, scene)', zh: '演示模式：用于截图的带标注合成数据（on、off、scene）', ja: 'デモモード：スクリーンショット用のラベル付き合成データ（on、off、scene）', pt: 'Modo demo: dados sintéticos identificados para capturas de tela (on, off, scene)', de: 'Demo-Modus: gekennzeichnete synthetische Daten für Screenshots (on, off, scene)', ko: '데모 모드: 스크린샷용으로 표시된 합성 데이터(on, off, scene)' },
  cmdHint: { en: 'on [scene] | off | scene calm|busy|rescue', he: 'on [scene] | off | scene calm|busy|rescue', es: 'on [scene] | off | scene calm|busy|rescue', fr: 'on [scene] | off | scene calm|busy|rescue', ru: 'on [scene] | off | scene calm|busy|rescue', zh: 'on [scene] | off | scene calm|busy|rescue', ja: 'on [scene] | off | scene calm|busy|rescue', pt: 'on [scene] | off | scene calm|busy|rescue', de: 'on [scene] | off | scene calm|busy|rescue', ko: 'on [scene] | off | scene calm|busy|rescue' },
  opened: { en: 'Opened the Demo mode pane.', he: 'חלונית מצב ההדגמה נפתחה.', es: 'Panel del modo demo abierto.', fr: 'Panneau du mode démo ouvert.', ru: 'Панель демо-режима открыта.', zh: '已打开演示模式面板。', ja: 'デモモードのペインを開きました。', pt: 'Painel do Modo demo aberto.', de: 'Demo-Modus-Panel geöffnet.', ko: '데모 모드 창을 열었습니다.' },
  started: {
    en: 'Demo mode is on (scene: {scene}). Everything shown is synthetic and labelled DEMO. Restore your data with /demo off.',
    he: 'מצב ההדגמה פועל (סצנה: {scene}). כל מה שמוצג סינתטי ומסומן DEMO. שחזר את הנתונים שלך עם /demo off.',
    es: 'El modo demo está activado (escena: {scene}). Todo lo que se muestra es sintético y está etiquetado DEMO. Restaura tus datos con /demo off.',
    fr: 'Le mode démo est activé (scène : {scene}). Tout ce qui s’affiche est synthétique et étiqueté DEMO. Restaure tes données avec /demo off.',
    ru: 'Демо-режим включён (сцена: {scene}). Всё показанное синтетическое и помечено DEMO. Верните свои данные командой /demo off.',
    zh: '演示模式已开启（场景：{scene}）。显示的一切都是合成数据，并标注为 DEMO。用 /demo off 恢复你的数据。',
    ja: 'デモモードがオンです（シーン：{scene}）。表示されているものはすべて合成データで、DEMO と表示されます。/demo off で実データを復元できます。',
    pt: 'O Modo demo está ativado (cena: {scene}). Tudo o que aparece é sintético e marcado como DEMO. Restaure seus dados com /demo off.',
    de: 'Der Demo-Modus ist an (Szene: {scene}). Alles Angezeigte ist synthetisch und mit DEMO gekennzeichnet. Stelle deine Daten mit /demo off wieder her.',
    ko: '데모 모드가 켜져 있습니다(장면: {scene}). 표시되는 모든 것은 합성 데이터이며 DEMO로 표시됩니다. /demo off로 실제 데이터를 복원하세요.',
  },
  stopped: { en: 'Demo mode is off; your data is back.', he: 'מצב ההדגמה כבוי; הנתונים שלך חזרו.', es: 'El modo demo está desactivado; tus datos han vuelto.', fr: 'Le mode démo est désactivé ; tes données sont de retour.', ru: 'Демо-режим выключен; ваши данные на месте.', zh: '演示模式已关闭；你的数据已恢复。', ja: 'デモモードはオフです。あなたのデータが戻りました。', pt: 'O Modo demo está desativado; seus dados voltaram.', de: 'Der Demo-Modus ist aus; deine Daten sind zurück.', ko: '데모 모드가 꺼졌습니다. 데이터가 복원되었습니다.' },
  notOn: { en: 'Demo mode is not on. Start it with /demo on.', he: 'מצב ההדגמה לא פועל. הפעל אותו עם /demo on.', es: 'El modo demo no está activado. Inícialo con /demo on.', fr: 'Le mode démo n’est pas activé. Lance-le avec /demo on.', ru: 'Демо-режим не включён. Запустите его командой /demo on.', zh: '演示模式未开启。用 /demo on 启动。', ja: 'デモモードはオンになっていません。/demo on で開始してください。', pt: 'O Modo demo não está ativado. Inicie com /demo on.', de: 'Der Demo-Modus ist nicht an. Starte ihn mit /demo on.', ko: '데모 모드가 켜져 있지 않습니다. /demo on으로 시작하세요.' },
  badScene: {
    en: 'Unknown scene "{name}". The scenes are calm, busy and rescue.',
    he: 'סצנה לא מוכרת "{name}". הסצנות הן calm, busy ו-rescue.',
    es: 'Escena desconocida «{name}». Las escenas son calm, busy y rescue.',
    fr: 'Scène inconnue « {name} ». Les scènes sont calm, busy et rescue.',
    ru: 'Неизвестная сцена «{name}». Доступны calm, busy и rescue.',
    zh: '未知场景“{name}”。可用场景有 calm、busy 和 rescue。',
    ja: '不明なシーン「{name}」です。シーンは calm、busy、rescue です。',
    pt: 'Cena desconhecida "{name}". As cenas são calm, busy e rescue.',
    de: 'Unbekannte Szene „{name}“. Die Szenen sind calm, busy und rescue.',
    ko: '알 수 없는 장면 "{name}"입니다. 장면은 calm, busy, rescue입니다.',
  },
  usage: {
    en: 'Usage: /demo (open the pane), /demo on [scene], /demo off, /demo scene calm|busy|rescue',
    he: 'שימוש: /demo (פותח את החלונית), /demo on [scene], /demo off, /demo scene calm|busy|rescue',
    es: 'Uso: /demo (abre el panel), /demo on [scene], /demo off, /demo scene calm|busy|rescue',
    fr: 'Usage : /demo (ouvre le panneau), /demo on [scene], /demo off, /demo scene calm|busy|rescue',
    ru: 'Использование: /demo (открыть панель), /demo on [scene], /demo off, /demo scene calm|busy|rescue',
    zh: '用法：/demo（打开面板）、/demo on [scene]、/demo off、/demo scene calm|busy|rescue',
    ja: '使い方：/demo（ペインを開く）、/demo on [scene]、/demo off、/demo scene calm|busy|rescue',
    pt: 'Uso: /demo (abre o painel), /demo on [scene], /demo off, /demo scene calm|busy|rescue',
    de: 'Verwendung: /demo (öffnet das Panel), /demo on [scene], /demo off, /demo scene calm|busy|rescue',
    ko: '사용법: /demo(창 열기), /demo on [scene], /demo off, /demo scene calm|busy|rescue',
  },
  sceneSwitched: { en: '[DEMO] Scene changed to {scene}', he: '[DEMO] הסצנה הוחלפה ל-{scene}', es: '[DEMO] Escena cambiada a {scene}', fr: '[DEMO] Scène changée en {scene}', ru: '[DEMO] Сцена изменена на {scene}', zh: '[DEMO] 场景已切换为 {scene}', ja: '[DEMO] シーンを {scene} に変更しました', pt: '[DEMO] Cena alterada para {scene}', de: '[DEMO] Szene gewechselt zu {scene}', ko: '[DEMO] 장면이 {scene}(으)로 바뀌었습니다' },
  ended: { en: 'Demo mode ended: your real data is back.', he: 'מצב ההדגמה הסתיים: הנתונים האמיתיים שלך חזרו.', es: 'El modo demo terminó: tus datos reales han vuelto.', fr: 'Le mode démo est terminé : tes vraies données sont de retour.', ru: 'Демо-режим завершён: ваши настоящие данные на месте.', zh: '演示模式已结束：你的真实数据已恢复。', ja: 'デモモードを終了しました。あなたの実データが戻りました。', pt: 'Modo demo encerrado: seus dados reais voltaram.', de: 'Demo-Modus beendet: Deine echten Daten sind zurück.', ko: '데모 모드가 종료되었습니다. 실제 데이터가 복원되었습니다.' },
  leftover: {
    en: 'A demo left over from the last session was cleaned up; your real data is back.',
    he: 'הדגמה שנשארה מהסשן הקודם נוקתה; הנתונים האמיתיים שלך חזרו.',
    es: 'Se limpió una demo que quedó de la sesión anterior; tus datos reales han vuelto.',
    fr: 'Une démo restée de la session précédente a été nettoyée ; tes vraies données sont de retour.',
    ru: 'Демо, оставшееся с прошлой сессии, убрано; ваши настоящие данные на месте.',
    zh: '已清理上一次会话遗留的演示；你的真实数据已恢复。',
    ja: '前回のセッションから残っていたデモを片付けました。あなたの実データが戻りました。',
    pt: 'Uma demo deixada pela sessão anterior foi limpa; seus dados reais voltaram.',
    de: 'Eine Demo aus der letzten Session wurde bereinigt; deine echten Daten sind zurück.',
    ko: '지난 세션에서 남은 데모를 정리했습니다. 실제 데이터가 복원되었습니다.',
  },
  chip: { en: '🎬 DEMO', he: '🎬 DEMO', es: '🎬 DEMO', fr: '🎬 DEMO', ru: '🎬 DEMO', zh: '🎬 DEMO', ja: '🎬 DEMO', pt: '🎬 DEMO', de: '🎬 DEMO', ko: '🎬 DEMO' },

  paneTitle: { en: 'Demo mode', he: 'מצב הדגמה', es: 'Modo demo', fr: 'Mode démo', ru: 'Демо-режим', zh: '演示模式', ja: 'デモモード', pt: 'Modo demo', de: 'Demo-Modus', ko: '데모 모드' },
  paneOff: { en: 'Demo mode is off in the /toolkitty pane.', he: 'מצב ההדגמה כבוי בלוח /toolkitty.', es: 'El modo demo está desactivado en el panel /toolkitty.', fr: 'Le mode démo est désactivé dans le panneau /toolkitty.', ru: 'Демо-режим отключён в панели /toolkitty.', zh: '演示模式在 /toolkitty 面板中已关闭。', ja: 'デモモードは /toolkitty ペインでオフになっています。', pt: 'O Modo demo está desativado no painel /toolkitty.', de: 'Der Demo-Modus ist im Panel /toolkitty aus.', ko: '데모 모드가 /toolkitty 창에서 꺼져 있습니다.' },
  statusOn: { en: 'ON · {scene}', he: 'פועל · {scene}', es: 'ACTIVO · {scene}', fr: 'ACTIF · {scene}', ru: 'ВКЛ · {scene}', zh: '开 · {scene}', ja: 'オン · {scene}', pt: 'ON · {scene}', de: 'AN · {scene}', ko: 'ON · {scene}' },
  statusOff: { en: 'off', he: 'כבוי', es: 'apagado', fr: 'désactivé', ru: 'выкл', zh: '关', ja: 'オフ', pt: 'off', de: 'aus', ko: 'off' },
  btnOn: { en: 'Start demo', he: 'התחל הדגמה', es: 'Iniciar demo', fr: 'Lancer la démo', ru: 'Запустить демо', zh: '开始演示', ja: 'デモを開始', pt: 'Iniciar demo', de: 'Demo starten', ko: '데모 시작' },
  btnOff: { en: 'Stop and restore', he: 'עצור ושחזר', es: 'Detener y restaurar', fr: 'Arrêter et restaurer', ru: 'Остановить и вернуть', zh: '停止并恢复', ja: '停止して復元', pt: 'Parar e restaurar', de: 'Stoppen und wiederherstellen', ko: '중지 후 복원' },
  secScenes: { en: 'Scenes', he: 'סצנות', es: 'Escenas', fr: 'Scènes', ru: 'Сцены', zh: '场景', ja: 'シーン', pt: 'Cenas', de: 'Szenen', ko: '장면' },
  secReplaced: { en: 'Replaced while the demo is on', he: 'מוחלף כל עוד ההדגמה פועלת', es: 'Se reemplaza mientras la demo está activa', fr: 'Remplacé tant que la démo est active', ru: 'Заменяется, пока демо включено', zh: '演示开启期间被替换的内容', ja: 'デモ中に置き換えられるもの', pt: 'Substituído enquanto a demo está ativa', de: 'Ersetzt, solange die Demo läuft', ko: '데모가 켜져 있는 동안 대체되는 항목' },
  secWillReplace: { en: 'Replaced when the demo starts (a backup of each is kept)', he: 'יוחלף עם תחילת ההדגמה (גיבוי של כל אחד נשמר)', es: 'Se reemplaza al iniciar la demo (se guarda una copia de cada uno)', fr: 'Remplacé au lancement de la démo (une sauvegarde de chacun est conservée)', ru: 'Заменяется при запуске демо (копия каждого сохраняется)', zh: '演示开始时被替换（每项都会保留备份）', ja: 'デモ開始時に置き換えられます（それぞれバックアップが保持されます）', pt: 'Substituído quando a demo começa (um backup de cada é mantido)', de: 'Wird beim Start der Demo ersetzt (von jedem wird ein Backup aufbewahrt)', ko: '데모가 시작될 때 대체됩니다(각각 백업이 보관됨)' },
  sceneName: {
    calm: { en: 'calm', he: 'רגועה', es: 'calma', fr: 'calme', ru: 'спокойная', zh: '平静', ja: '穏やか', pt: 'calma', de: 'ruhig', ko: '평온' },
    busy: { en: 'busy', he: 'עמוסה', es: 'ocupada', fr: 'chargée', ru: 'загруженная', zh: '繁忙', ja: '多忙', pt: 'agitada', de: 'belebt', ko: '바쁨' },
    rescue: { en: 'rescue', he: 'הצלה', es: 'rescate', fr: 'sauvetage', ru: 'спасение', zh: '救援', ja: '救出', pt: 'resgate', de: 'Rettung', ko: '구조' },
  },
  sceneDesc: {
    calm: { en: 'all green, low numbers', he: 'הכול ירוק, מספרים נמוכים', es: 'todo en verde, cifras bajas', fr: 'tout est vert, chiffres bas', ru: 'всё зелёное, малые числа', zh: '全部绿灯，数字很低', ja: 'すべてグリーン、数値は低め', pt: 'tudo verde, números baixos', de: 'alles grün, niedrige Werte', ko: '모두 초록색, 낮은 수치' },
    busy: { en: 'the mixed scene: warnings, a loop, 30 notices', he: 'הסצנה המעורבת: אזהרות, לולאה, 30 התראות', es: 'la escena mixta: advertencias, un bucle, 30 avisos', fr: 'la scène mixte : alertes, une boucle, 30 notifications', ru: 'смешанная сцена: предупреждения, цикл, 30 уведомлений', zh: '混合场景：警告、一个循环、30 条通知', ja: 'ミックスシーン：警告、ループ、30件の通知', pt: 'a cena mista: alertas, um loop, 30 avisos', de: 'die gemischte Szene: Warnungen, eine Schleife, 30 Hinweise', ko: '혼합 장면: 경고, 루프 하나, 알림 30개' },
    rescue: { en: 'an incident just blocked, red headline', he: 'אירוע שהרגע נחסם, כותרת אדומה', es: 'un incidente recién bloqueado, titular rojo', fr: 'un incident vient d’être bloqué, titre rouge', ru: 'только что заблокирован инцидент, красный заголовок', zh: '刚刚拦截了一起事故，红色标题', ja: 'インシデントをブロックした直後、赤い見出し', pt: 'um incidente acabou de ser bloqueado, título vermelho', de: 'ein Vorfall wurde gerade blockiert, rote Schlagzeile', ko: '방금 막아낸 사고, 빨간 헤드라인' },
  },
  lblHeatmap: { en: 'activity heatmap (12 weeks)', he: 'מפת חום של פעילות (12 שבועות)', es: 'mapa de calor de actividad (12 semanas)', fr: 'carte de chaleur d’activité (12 semaines)', ru: 'тепловая карта активности (12 недель)', zh: '活动热力图（12 周）', ja: 'アクティビティヒートマップ（12週間）', pt: 'mapa de calor de atividade (12 semanas)', de: 'Aktivitäts-Heatmap (12 Wochen)', ko: '활동 히트맵(12주)' },
  lblSavings: { en: 'savings history', he: 'היסטוריית חיסכון', es: 'historial de ahorro', fr: 'historique des économies', ru: 'история экономии', zh: '节省历史', ja: '節約の履歴', pt: 'histórico de economia', de: 'Spar-Verlauf', ko: '절약 기록' },
  lblIncidents: { en: 'incidents of this folder', he: 'אירועי התיקייה הזו', es: 'incidentes de esta carpeta', fr: 'incidents de ce dossier', ru: 'инциденты этой папки', zh: '此文件夹的事件', ja: 'このフォルダーのインシデント', pt: 'incidentes desta pasta', de: 'Vorfälle dieses Ordners', ko: '이 폴더의 사고 기록' },
  lblAchievements: { en: 'unlocked achievements', he: 'הישגים שנפתחו', es: 'logros desbloqueados', fr: 'succès débloqués', ru: 'открытые достижения', zh: '已解锁的成就', ja: '獲得済みの実績', pt: 'conquistas desbloqueadas', de: 'freigeschaltete Erfolge', ko: '달성한 업적' },
  lblSessions: { en: 'session list', he: 'רשימת הסשנים', es: 'lista de sesiones', fr: 'liste des sessions', ru: 'список сессий', zh: '会话列表', ja: 'セッション一覧', pt: 'lista de sessões', de: 'Session-Liste', ko: '세션 목록' },
  lblBuddy: { en: 'companion name (the seed stays)', he: 'שם החבר (הזרע נשאר)', es: 'nombre del compañero (la semilla se queda)', fr: 'nom du compagnon (la graine reste)', ru: 'имя питомца (seed не меняется)', zh: '伙伴名称（种子保持不变）', ja: '相棒の名前（シードはそのまま）', pt: 'nome do parceiro (a semente permanece)', de: 'Name des Begleiters (der Seed bleibt)', ko: '버디 이름(시드는 유지됨)' },
  footOn: {
    en: 'Notices and evidence records posted by the demo stay in this session’s logs, labelled DEMO, until the session ends. The band chip 🎬 DEMO shows while it runs.',
    he: 'התראות ורשומות ראיות שההדגמה פרסמה נשארות ביומני הסשן, מסומנות DEMO, עד סוף הסשן. שבב הרצועה 🎬 DEMO מוצג כל עוד היא פועלת.',
    es: 'Los avisos y registros de evidencia que publicó la demo quedan en los registros de esta sesión, etiquetados DEMO, hasta que termine. El chip 🎬 DEMO de la barra se muestra mientras la demo está activa.',
    fr: 'Les notifications et preuves publiées par la démo restent dans les journaux de cette session, étiquetées DEMO, jusqu’à sa fin. La pastille 🎬 DEMO de la barre s’affiche pendant son exécution.',
    ru: 'Уведомления и записи доказательств, опубликованные демо, остаются в журналах этой сессии с пометкой DEMO до её конца. Значок 🎬 DEMO в полосе виден, пока демо работает.',
    zh: '演示发布的通知和证据记录会保留在本会话的日志中，标注为 DEMO，直到会话结束。演示运行期间横幅会显示 🎬 DEMO 标签。',
    ja: 'デモが投稿した通知と証拠レコードは、セッションが終わるまでこのセッションのログに DEMO のラベル付きで残ります。実行中はバンドに 🎬 DEMO チップが表示されます。',
    pt: 'Os avisos e registros de evidência postados pela demo permanecem nos logs desta sessão, marcados como DEMO, até a sessão terminar. O chip 🎬 DEMO da faixa aparece enquanto ela roda.',
    de: 'Von der Demo gesendete Hinweise und Belegeinträge bleiben in den Logs dieser Session, gekennzeichnet mit DEMO, bis die Session endet. Der Band-Chip 🎬 DEMO erscheint, solange sie läuft.',
    ko: '데모가 게시한 알림과 증거 기록은 세션이 끝날 때까지 이 세션의 로그에 DEMO 표시와 함께 남습니다. 실행 중에는 밴드에 🎬 DEMO 칩이 표시됩니다.',
  },
  footOff: {
    en: 'Nothing synthetic is shown now. Every text the demo writes carries the word DEMO, so no screenshot can pass as real usage.',
    he: 'כרגע לא מוצג דבר סינתטי. כל טקסט שההדגמה כותבת נושא את המילה DEMO, כך ששום צילום מסך לא יכול להיחשב כשימוש אמיתי.',
    es: 'Ahora no se muestra nada sintético. Todo texto que escribe la demo lleva la palabra DEMO, así que ninguna captura puede pasar por uso real.',
    fr: 'Rien de synthétique n’est affiché pour l’instant. Chaque texte écrit par la démo porte le mot DEMO : aucune capture ne peut passer pour un usage réel.',
    ru: 'Сейчас ничего синтетического не показано. Каждый текст, который пишет демо, содержит слово DEMO, поэтому скриншот нельзя выдать за реальное использование.',
    zh: '目前没有显示任何合成内容。演示写入的每段文字都带有 DEMO 字样，因此任何截图都无法冒充真实用量。',
    ja: '現在、合成データは表示されていません。デモが書き込むすべてのテキストに DEMO の文字が付くため、どのスクリーンショットも実際の使用状況として通用しません。',
    pt: 'Nada sintético é mostrado agora. Todo texto que a demo escreve leva a palavra DEMO, então nenhuma captura de tela pode passar por uso real.',
    de: 'Im Moment wird nichts Synthetisches angezeigt. Jeder Text der Demo trägt das Wort DEMO, sodass kein Screenshot als echte Nutzung durchgehen kann.',
    ko: '지금은 합성 데이터가 표시되지 않습니다. 데모가 쓰는 모든 텍스트에는 DEMO라는 단어가 붙으므로 어떤 스크린샷도 실제 사용 내역으로 오인될 수 없습니다.',
  },
  restore: { en: 'To restore everything, run: /demo off', he: 'כדי לשחזר הכול, הרץ: /demo off', es: 'Para restaurarlo todo, ejecuta: /demo off', fr: 'Pour tout restaurer, lance : /demo off', ru: 'Чтобы всё вернуть, выполните: /demo off', zh: '要恢复所有内容，请运行：/demo off', ja: 'すべてを復元するには次を実行してください：/demo off', pt: 'Para restaurar tudo, execute: /demo off', de: 'Um alles wiederherzustellen, führe aus: /demo off', ko: '모두 복원하려면 다음을 실행하세요: /demo off' },
  restoreAfter: { en: 'Starting the demo replaces them; to restore: /demo off', he: 'התחלת ההדגמה מחליפה אותם; לשחזור: /demo off', es: 'Iniciar la demo los reemplaza; para restaurar: /demo off', fr: 'Lancer la démo les remplace ; pour restaurer : /demo off', ru: 'Запуск демо заменяет их; чтобы вернуть: /demo off', zh: '启动演示会替换它们；如需恢复：/demo off', ja: 'デモを開始するとこれらが置き換えられます。復元するには：/demo off', pt: 'Iniciar a demo os substitui; para restaurar: /demo off', de: 'Das Starten der Demo ersetzt sie; zum Wiederherstellen: /demo off', ko: '데모를 시작하면 위 항목이 대체됩니다. 복원하려면: /demo off' },

  // notices (30 per start). {n} is unique per notice so none folds into another.
  nFormatted: { en: '[DEMO] Formatted {file} ({n} lines)', he: '[DEMO] עוצב {file} ({n} שורות)', es: '[DEMO] Se formateó {file} ({n} líneas)', fr: '[DEMO] {file} formaté ({n} lignes)', ru: '[DEMO] Отформатирован {file} (строк: {n})', zh: '[DEMO] 已格式化 {file}（{n} 行）', ja: '[DEMO] {file} をフォーマットしました（{n} 行）', pt: '[DEMO] {file} formatado ({n} linhas)', de: '[DEMO] {file} formatiert ({n} Zeilen)', ko: '[DEMO] {file} 포맷 완료({n}줄)' },
  nKept: { en: '[DEMO] Kept {n}k tokens out of the context', he: '[DEMO] {n}k טוקנים נשארו מחוץ להקשר', es: '[DEMO] Se mantuvieron {n}k tokens fuera del contexto', fr: '[DEMO] {n}k tokens gardés hors du contexte', ru: '[DEMO] Вне контекста осталось токенов: {n}k', zh: '[DEMO] 让 {n}k token 不进入上下文', ja: '[DEMO] {n}k トークンをコンテキストに入れずに済みました', pt: '[DEMO] {n}k tokens mantidos fora do contexto', de: '[DEMO] {n}k Tokens aus dem Kontext herausgehalten', ko: '[DEMO] {n}k 토큰을 컨텍스트 밖에 두었습니다' },
  nTests: { en: '[DEMO] Tests passed: {n} ok', he: '[DEMO] הבדיקות עברו: {n} תקינות', es: '[DEMO] Pruebas superadas: {n} correctas', fr: '[DEMO] Tests réussis : {n} ok', ru: '[DEMO] Тесты пройдены: {n}', zh: '[DEMO] 测试通过：{n} 项通过', ja: '[DEMO] テスト合格：{n} 件 OK', pt: '[DEMO] Testes aprovados: {n} ok', de: '[DEMO] Tests bestanden: {n} ok', ko: '[DEMO] 테스트 통과: {n}개 정상' },
  nTurn: { en: '[DEMO] Turn finished in {n} s', he: '[DEMO] התור הסתיים תוך {n} שנ׳', es: '[DEMO] Turno terminado en {n} s', fr: '[DEMO] Tour terminé en {n} s', ru: '[DEMO] Ход завершён за {n} с', zh: '[DEMO] 本轮耗时 {n} 秒', ja: '[DEMO] ターンが {n} 秒で終了しました', pt: '[DEMO] Turno concluído em {n} s', de: '[DEMO] Durchgang in {n} s beendet', ko: '[DEMO] 턴이 {n}초 만에 끝났습니다' },
  nCopied: { en: '[DEMO] Copied {n} lines to the clipboard', he: '[DEMO] הועתקו {n} שורות ללוח', es: '[DEMO] Se copiaron {n} líneas al portapapeles', fr: '[DEMO] {n} lignes copiées dans le presse-papiers', ru: '[DEMO] Скопировано строк: {n}', zh: '[DEMO] 已将 {n} 行复制到剪贴板', ja: '[DEMO] {n} 行をクリップボードにコピーしました', pt: '[DEMO] {n} linhas copiadas para a área de transferência', de: '[DEMO] {n} Zeilen in die Zwischenablage kopiert', ko: '[DEMO] {n}줄을 클립보드에 복사했습니다' },
  nCheckpoint: { en: '[DEMO] Checkpoint {n} saved for {file}', he: '[DEMO] נשמרה נקודת שחזור {n} עבור {file}', es: '[DEMO] Punto de control {n} guardado para {file}', fr: '[DEMO] Point de contrôle {n} enregistré pour {file}', ru: '[DEMO] Контрольная точка {n} сохранена для {file}', zh: '[DEMO] 已为 {file} 保存检查点 {n}', ja: '[DEMO] {file} のチェックポイント {n} を保存しました', pt: '[DEMO] Checkpoint {n} salvo para {file}', de: '[DEMO] Checkpoint {n} für {file} gespeichert', ko: '[DEMO] {file}의 체크포인트 {n}을(를) 저장했습니다' },
  nQuota: { en: '[DEMO] Weekly quota at {n}%', he: '[DEMO] מכסה שבועית ב-{n}%', es: '[DEMO] Cuota semanal al {n}%', fr: '[DEMO] Quota hebdomadaire à {n} %', ru: '[DEMO] Недельная квота: {n}%', zh: '[DEMO] 每周配额已达 {n}%', ja: '[DEMO] 週間クォータが {n}% です', pt: '[DEMO] Cota semanal em {n}%', de: '[DEMO] Wochenkontingent bei {n} %', ko: '[DEMO] 주간 할당량 {n}%' },
  nReread: { en: '[DEMO] {file} was read {n} times', he: '[DEMO] הקובץ {file} נקרא {n} פעמים', es: '[DEMO] {file} se leyó {n} veces', fr: '[DEMO] {file} lu {n} fois', ru: '[DEMO] {file} прочитан раз: {n}', zh: '[DEMO] {file} 已被读取 {n} 次', ja: '[DEMO] {file} が {n} 回読み取られました', pt: '[DEMO] {file} foi lido {n} vezes', de: '[DEMO] {file} wurde {n}-mal gelesen', ko: '[DEMO] {file}을(를) {n}번 읽었습니다' },
  nCache: { en: '[DEMO] Prompt cache goes cold in {n} min', he: '[DEMO] מטמון הפרומפט יתקרר בעוד {n} דק׳', es: '[DEMO] La caché del prompt se enfría en {n} min', fr: '[DEMO] Le cache du prompt refroidit dans {n} min', ru: '[DEMO] Кэш промпта остынет через {n} мин', zh: '[DEMO] 提示缓存将在 {n} 分钟后变冷', ja: '[DEMO] プロンプトキャッシュは {n} 分後に切れます', pt: '[DEMO] O cache do prompt esfria em {n} min', de: '[DEMO] Der Prompt-Cache wird in {n} Min. kalt', ko: '[DEMO] 프롬프트 캐시가 {n}분 후 식습니다' },
  nBudget: { en: '[DEMO] Budget at {n}% of today’s limit', he: '[DEMO] התקציב ב-{n}% ממגבלת היום', es: '[DEMO] Presupuesto al {n}% del límite de hoy', fr: '[DEMO] Budget à {n} % de la limite du jour', ru: '[DEMO] Бюджет: {n}% дневного лимита', zh: '[DEMO] 预算已达今日上限的 {n}%', ja: '[DEMO] 予算が今日の上限の {n}% です', pt: '[DEMO] Orçamento em {n}% do limite de hoje', de: '[DEMO] Budget bei {n} % des heutigen Limits', ko: '[DEMO] 예산이 오늘 한도의 {n}%입니다' },
  nRm: { en: '[DEMO] Blocked rm -rf outside the project (#{n})', he: '[DEMO] נחסם rm -rf מחוץ לפרויקט (#{n})', es: '[DEMO] Bloqueado rm -rf fuera del proyecto (#{n})', fr: '[DEMO] rm -rf bloqué hors du projet (#{n})', ru: '[DEMO] Заблокирован rm -rf вне проекта (#{n})', zh: '[DEMO] 拦截了项目外的 rm -rf（#{n}）', ja: '[DEMO] プロジェクト外の rm -rf をブロックしました（#{n}）', pt: '[DEMO] rm -rf fora do projeto bloqueado (#{n})', de: '[DEMO] rm -rf außerhalb des Projekts blockiert (#{n})', ko: '[DEMO] 프로젝트 밖의 rm -rf를 차단했습니다(#{n})' },
  nSecret: { en: '[DEMO] A secret was masked in your prompt (#{n})', he: '[DEMO] סוד הוסתר בפרומפט שלך (#{n})', es: '[DEMO] Se ocultó un secreto en tu prompt (#{n})', fr: '[DEMO] Un secret a été masqué dans ton prompt (#{n})', ru: '[DEMO] Секрет скрыт в вашем промпте (#{n})', zh: '[DEMO] 你的提示中的一个密钥已被遮盖（#{n}）', ja: '[DEMO] プロンプト内のシークレットをマスクしました（#{n}）', pt: '[DEMO] Um segredo foi mascarado no seu prompt (#{n})', de: '[DEMO] Ein Geheimnis in deinem Prompt wurde maskiert (#{n})', ko: '[DEMO] 프롬프트의 비밀 값을 가렸습니다(#{n})' },
  nForce: { en: '[DEMO] Stopped a force push to main (#{n})', he: '[DEMO] נעצרה דחיפה בכוח ל-main (#{n})', es: '[DEMO] Se detuvo un force push a main (#{n})', fr: '[DEMO] Force push vers main arrêté (#{n})', ru: '[DEMO] Остановлен force push в main (#{n})', zh: '[DEMO] 阻止了对 main 的强制推送（#{n}）', ja: '[DEMO] main への強制プッシュを止めました（#{n}）', pt: '[DEMO] Push forçado para main interrompido (#{n})', de: '[DEMO] Force-Push auf main gestoppt (#{n})', ko: '[DEMO] main으로의 강제 푸시를 막았습니다(#{n})' },

  // evidence summaries
  evPassed: { en: '[DEMO] {cmd} · {n} passed', he: '[DEMO] {cmd} · {n} עברו', es: '[DEMO] {cmd} · {n} correctas', fr: '[DEMO] {cmd} · {n} réussis', ru: '[DEMO] {cmd} · пройдено: {n}', zh: '[DEMO] {cmd} · {n} 项通过', ja: '[DEMO] {cmd} · {n} 件成功', pt: '[DEMO] {cmd} · {n} aprovados', de: '[DEMO] {cmd} · {n} bestanden', ko: '[DEMO] {cmd} · {n}개 통과' },
  evFailed: { en: '[DEMO] {cmd} · {n} failed', he: '[DEMO] {cmd} · {n} נכשלו', es: '[DEMO] {cmd} · {n} fallidas', fr: '[DEMO] {cmd} · {n} échoués', ru: '[DEMO] {cmd} · провалено: {n}', zh: '[DEMO] {cmd} · {n} 项失败', ja: '[DEMO] {cmd} · {n} 件失敗', pt: '[DEMO] {cmd} · {n} falharam', de: '[DEMO] {cmd} · {n} fehlgeschlagen', ko: '[DEMO] {cmd} · {n}개 실패' },
  evOk: { en: '[DEMO] {cmd} · ok', he: '[DEMO] {cmd} · תקין', es: '[DEMO] {cmd} · correcto', fr: '[DEMO] {cmd} · ok', ru: '[DEMO] {cmd} · успешно', zh: '[DEMO] {cmd} · 正常', ja: '[DEMO] {cmd} · OK', pt: '[DEMO] {cmd} · ok', de: '[DEMO] {cmd} · ok', ko: '[DEMO] {cmd} · 정상' },

  // incidents
  iEnv: { en: '[DEMO] Blocked a read of .env.production', he: '[DEMO] נחסמה קריאה של .env.production', es: '[DEMO] Se bloqueó la lectura de .env.production', fr: '[DEMO] Lecture de .env.production bloquée', ru: '[DEMO] Заблокировано чтение .env.production', zh: '[DEMO] 拦截了对 .env.production 的读取', ja: '[DEMO] .env.production の読み取りをブロックしました', pt: '[DEMO] Leitura de .env.production bloqueada', de: '[DEMO] Lesezugriff auf .env.production blockiert', ko: '[DEMO] .env.production 읽기를 차단했습니다' },
  iKey: { en: '[DEMO] Masked a cloud key in a prompt', he: '[DEMO] מפתח ענן הוסתר בפרומפט', es: '[DEMO] Se ocultó una clave de la nube en un prompt', fr: '[DEMO] Clé cloud masquée dans un prompt', ru: '[DEMO] Облачный ключ скрыт в промпте', zh: '[DEMO] 遮盖了提示中的云密钥', ja: '[DEMO] プロンプト内のクラウドキーをマスクしました', pt: '[DEMO] Chave de nuvem mascarada em um prompt', de: '[DEMO] Cloud-Schlüssel in einem Prompt maskiert', ko: '[DEMO] 프롬프트의 클라우드 키를 가렸습니다' },
  iRm: { en: '[DEMO] Blocked rm -rf outside the project', he: '[DEMO] נחסם rm -rf מחוץ לפרויקט', es: '[DEMO] Bloqueado rm -rf fuera del proyecto', fr: '[DEMO] rm -rf bloqué hors du projet', ru: '[DEMO] Заблокирован rm -rf вне проекта', zh: '[DEMO] 拦截了项目外的 rm -rf', ja: '[DEMO] プロジェクト外の rm -rf をブロックしました', pt: '[DEMO] rm -rf fora do projeto bloqueado', de: '[DEMO] rm -rf außerhalb des Projekts blockiert', ko: '[DEMO] 프로젝트 밖의 rm -rf를 차단했습니다' },
  iForce: { en: '[DEMO] Stopped a force push to main', he: '[DEMO] נעצרה דחיפה בכוח ל-main', es: '[DEMO] Se detuvo un force push a main', fr: '[DEMO] Force push vers main arrêté', ru: '[DEMO] Остановлен force push в main', zh: '[DEMO] 阻止了对 main 的强制推送', ja: '[DEMO] main への強制プッシュを止めました', pt: '[DEMO] Push forçado para main interrompido', de: '[DEMO] Force-Push auf main gestoppt', ko: '[DEMO] main으로의 강제 푸시를 막았습니다' },
  iInject: { en: '[DEMO] Flagged instructions hidden in a web page', he: '[DEMO] סומנו הוראות חבויות בדף אינטרנט', es: '[DEMO] Se marcaron instrucciones ocultas en una página web', fr: '[DEMO] Instructions cachées dans une page web signalées', ru: '[DEMO] Замечены скрытые инструкции на веб-странице', zh: '[DEMO] 标记了网页中隐藏的指令', ja: '[DEMO] Web ページに隠された指示にフラグを立てました', pt: '[DEMO] Instruções ocultas em uma página web foram sinalizadas', de: '[DEMO] In einer Webseite versteckte Anweisungen markiert', ko: '[DEMO] 웹 페이지에 숨겨진 지시를 표시했습니다' },

  // achievements
  aRescue: { en: '[DEMO] First rescue', he: '[DEMO] ההצלה הראשונה', es: '[DEMO] Primer rescate', fr: '[DEMO] Premier sauvetage', ru: '[DEMO] Первое спасение', zh: '[DEMO] 首次获救', ja: '[DEMO] 初めての救出', pt: '[DEMO] Primeiro resgate', de: '[DEMO] Erste Rettung', ko: '[DEMO] 첫 구출' },
  aStreak: { en: '[DEMO] Seven-day streak', he: '[DEMO] רצף של שבעה ימים', es: '[DEMO] Racha de siete días', fr: '[DEMO] Série de sept jours', ru: '[DEMO] Серия из семи дней', zh: '[DEMO] 连续七天', ja: '[DEMO] 7日連続', pt: '[DEMO] Sequência de sete dias', de: '[DEMO] Sieben-Tage-Serie', ko: '[DEMO] 7일 연속' },
  aSaver: { en: '[DEMO] 100k tokens kept out', he: '[DEMO] 100k טוקנים נשארו בחוץ', es: '[DEMO] 100k tokens evitados', fr: '[DEMO] 100k tokens évités', ru: '[DEMO] 100k токенов не попали в контекст', zh: '[DEMO] 10 万 token 未进入上下文', ja: '[DEMO] 10万トークンをコンテキスト外に維持', pt: '[DEMO] 100 mil tokens mantidos fora', de: '[DEMO] 100k Tokens herausgehalten', ko: '[DEMO] 10만 토큰을 컨텍스트 밖에 둠' },

  // sessions
  s1: { en: '[DEMO] Fix the parser crash on empty input', he: '[DEMO] תיקון קריסת המפרש על קלט ריק', es: '[DEMO] Arreglar el fallo del parser con entrada vacía', fr: '[DEMO] Corriger le plantage du parseur sur entrée vide', ru: '[DEMO] Исправить падение парсера на пустом вводе', zh: '[DEMO] 修复解析器在空输入时崩溃的问题', ja: '[DEMO] 空の入力でパーサーがクラッシュする問題を修正', pt: '[DEMO] Corrigir a falha do parser com entrada vazia', de: '[DEMO] Parser-Absturz bei leerer Eingabe beheben', ko: '[DEMO] 빈 입력에서 파서가 충돌하는 문제 수정' },
  s2: { en: '[DEMO] Write the database migration', he: '[DEMO] כתיבת מיגרציית מסד הנתונים', es: '[DEMO] Escribir la migración de la base de datos', fr: '[DEMO] Écrire la migration de la base de données', ru: '[DEMO] Написать миграцию базы данных', zh: '[DEMO] 编写数据库迁移', ja: '[DEMO] データベースマイグレーションを書く', pt: '[DEMO] Escrever a migração do banco de dados', de: '[DEMO] Datenbankmigration schreiben', ko: '[DEMO] 데이터베이스 마이그레이션 작성' },
  s3: { en: '[DEMO] Refactor Toolkitty band', he: '[DEMO] ארגון מחדש של רצועת Toolkitty', es: '[DEMO] Refactorizar la barra de Toolkitty', fr: '[DEMO] Refactoriser la barre Toolkitty', ru: '[DEMO] Рефакторинг полосы Toolkitty', zh: '[DEMO] 重构 Toolkitty 横幅', ja: '[DEMO] Toolkitty のバンドをリファクタリング', pt: '[DEMO] Refatorar a faixa do Toolkitty', de: '[DEMO] Toolkitty-Band refaktorisieren', ko: '[DEMO] Toolkitty 밴드 리팩터링' },
  s4: { en: '[DEMO] Add dark mode to the settings page', he: '[DEMO] הוספת מצב כהה לדף ההגדרות', es: '[DEMO] Añadir modo oscuro a la página de ajustes', fr: '[DEMO] Ajouter le mode sombre à la page des réglages', ru: '[DEMO] Добавить тёмную тему на страницу настроек', zh: '[DEMO] 为设置页面添加深色模式', ja: '[DEMO] 設定ページにダークモードを追加', pt: '[DEMO] Adicionar modo escuro à página de configurações', de: '[DEMO] Dunkelmodus zur Einstellungsseite hinzufügen', ko: '[DEMO] 설정 페이지에 다크 모드 추가' },
  s5: { en: '[DEMO] Speed up the nightly build', he: '[DEMO] האצת הבנייה הלילית', es: '[DEMO] Acelerar la compilación nocturna', fr: '[DEMO] Accélérer le build de nuit', ru: '[DEMO] Ускорить ночную сборку', zh: '[DEMO] 加快夜间构建速度', ja: '[DEMO] ナイトリービルドを高速化', pt: '[DEMO] Acelerar o build noturno', de: '[DEMO] Nightly-Build beschleunigen', ko: '[DEMO] 야간 빌드 속도 개선' },
  s6: { en: '[DEMO] Review the onboarding copy', he: '[DEMO] סקירת טקסטי ההדרכה', es: '[DEMO] Revisar los textos de bienvenida', fr: '[DEMO] Relire les textes d’accueil', ru: '[DEMO] Проверить тексты приветствия', zh: '[DEMO] 审阅新手引导文案', ja: '[DEMO] オンボーディングの文言をレビュー', pt: '[DEMO] Revisar o texto de onboarding', de: '[DEMO] Onboarding-Texte prüfen', ko: '[DEMO] 온보딩 문구 검토' },
} as const

type Scene = 'calm' | 'busy' | 'rescue'
const SCENES: readonly Scene[] = ['calm', 'busy', 'rescue']
const isScene = (x: unknown): x is Scene => x === 'calm' || x === 'busy' || x === 'rescue'

type State = { active: boolean; scene: Scene; startedAt: number; keys: string[] }
const OFF_STATE: State = { active: false, scene: 'busy', startedAt: 0, keys: [] }
const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'demo' } as const, OFF_STATE) as unknown as Atom<State>

export const feature: Feature = {
  id: 'demo',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const PANE_ID = 'demo'
const STATE_KEY = 'demo:state'
const BACKUP = 'demo:backup:'
const DAY_MS = 86_400_000
const WORKING_HEAD_START_MS = 47_000

let ticker: Timer | undefined
let isStarting = false

/** What the person's real values are replaced by, under their real keys. */
const baseKeys = (cwd: string): string[] => [
  'week-heatmap:days',
  'savings:days',
  `incidents:${cwd}`,
  'achievements:unlocked',
  'session-finder:index',
  'buddy:name',
]

const labelOf = (key: string): string => {
  if (key.startsWith('week-heatmap:')) return t(T.lblHeatmap)
  if (key.startsWith('savings:')) return t(T.lblSavings)
  if (key.startsWith('incidents:')) return t(T.lblIncidents)
  if (key.startsWith('achievements:')) return t(T.lblAchievements)
  if (key.startsWith('session-finder:')) return t(T.lblSessions)
  return t(T.lblBuddy)
}

// ---------- deterministic synthetic data ----------

/** A repeatable pseudo-random number in [0, 1) for (i, salt). */
function frac(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const pad2 = (n: number): string => String(n).padStart(2, '0')
function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const SCALE: Record<Scene, number> = { calm: 0.5, busy: 1, rescue: 1.2 }

type HeatDay = { turns: number; ms: number; tokens: number; cost: number }
/** Twelve weeks of plausible activity: busy weekdays, quiet weekends, a few days off. */
function heatmapDays(now: number, scene: Scene): Record<string, HeatDay> {
  const out: Record<string, HeatDay> = {}
  for (let i = 0; i < 84; i++) {
    const at = now - i * DAY_MS
    const weekend = new Date(at).getDay() === 0 || new Date(at).getDay() === 6
    if (frac(i, 1) < (weekend ? 0.55 : 0.1)) continue
    const turns = Math.max(1, Math.round((weekend ? 3 + frac(i, 2) * 8 : 8 + frac(i, 2) * 26) * SCALE[scene]))
    const ms = Math.round(turns * (90_000 + frac(i, 3) * 150_000))
    const tokens = Math.round(turns * (14_000 + frac(i, 4) * 30_000))
    const cost = Math.round(turns * (0.12 + frac(i, 5) * 0.3) * 100) / 100
    out[dayKey(at)] = { turns, ms, tokens, cost }
  }
  return out
}

function savingsDays(now: number, scene: Scene): Record<string, { tokens: number; usd: number }> {
  const out: Record<string, { tokens: number; usd: number }> = {}
  for (let i = 0; i < 30; i++) {
    const tokens = Math.round((6_000 + frac(i, 6) * 60_000) * SCALE[scene])
    out[dayKey(now - i * DAY_MS)] = { tokens, usd: Math.round(tokens * 0.000015 * 100) / 100 }
  }
  return out
}

type IncidentItem = { at: number; feature: string; kind: string; detail: string }
function incidentStore(now: number, scene: Scene): { count: number; items: IncidentItem[]; lastAt: number } {
  const lastAge = scene === 'rescue' ? 3_000 : 6 * 3_600_000
  const items: IncidentItem[] = [
    { at: now - 9 * DAY_MS, feature: 'protect-secrets', kind: 'env file', detail: t(T.iEnv) },
    { at: now - 6 * DAY_MS, feature: 'secret-mask', kind: 'aws key', detail: t(T.iKey) },
    { at: now - 3 * DAY_MS, feature: 'dangerous-commands', kind: 'rm -rf', detail: t(T.iRm) },
    { at: now - 26 * 3_600_000, feature: 'branch-lock', kind: 'force push', detail: t(T.iForce) },
    { at: now - lastAge, feature: 'injection-tripwire', kind: 'prompt injection', detail: t(T.iInject) },
  ]
  return { count: items.length, items, lastAt: now - lastAge }
}

function achievements(now: number): { id: string; at: number; title: string }[] {
  return [
    { id: 'first-rescue', at: now - 9 * DAY_MS, title: t(T.aRescue) },
    { id: 'week-streak', at: now - 4 * DAY_MS, title: t(T.aStreak) },
    { id: 'saver-100k', at: now - 2 * DAY_MS, title: t(T.aSaver) },
  ]
}

function sessionIndex(now: number): { id: string; cwd: string; title: string; startedAt: number; updatedAt: number; prompts: string[] }[] {
  const rows: [string, string, number, number][] = [
    ['parser', t(T.s1), 1, 70],
    ['api', t(T.s2), 2, 45],
    ['toolkitty', t(T.s3), 4, 95],
    ['web', t(T.s4), 6, 38],
    ['ci', t(T.s5), 9, 52],
    ['docs', t(T.s6), 13, 24],
  ]
  return rows.map(([project, title, days, minutes], i) => ({
    id: `demo-session-${i + 1}`,
    cwd: `C:/demo/${project}`,
    title,
    startedAt: now - days * DAY_MS,
    updatedAt: now - days * DAY_MS + minutes * 60_000,
    prompts: [title],
  }))
}

// ---------- notices and evidence ----------

type Tpl = { text: Localized; feature: string; hasFile: boolean }
const INFO_TPLS: readonly Tpl[] = [
  { text: T.nFormatted, feature: 'auto-format', hasFile: true },
  { text: T.nKept, feature: 'savings', hasFile: false },
  { text: T.nTests, feature: 'test-on-change', hasFile: false },
  { text: T.nTurn, feature: 'turn-receipt', hasFile: false },
  { text: T.nCopied, feature: 'copy-last', hasFile: false },
  { text: T.nCheckpoint, feature: 'edit-undo', hasFile: true },
]
const WARN_TPLS: readonly Tpl[] = [
  { text: T.nQuota, feature: 'plan-pace', hasFile: false },
  { text: T.nReread, feature: 'dup-read-detector', hasFile: true },
  { text: T.nCache, feature: 'cache-countdown', hasFile: false },
  { text: T.nBudget, feature: 'budget-guard', hasFile: false },
]
const ALERT_TPLS: readonly Tpl[] = [
  { text: T.nRm, feature: 'dangerous-commands', hasFile: false },
  { text: T.nSecret, feature: 'secret-mask', hasFile: false },
  { text: T.nForce, feature: 'branch-lock', hasFile: false },
]
const FILES = ['src/parser.ts', 'src/band.tsx', 'lib/cache.ts', 'api/routes.ts', 'README.md', 'tests/parser.test.ts'] as const

/** How many notices of each level a scene posts (30 in all). */
const MIX: Record<Scene, { info: number; warn: number; alert: number }> = {
  calm: { info: 28, warn: 2, alert: 0 },
  busy: { info: 18, warn: 9, alert: 3 },
  rescue: { info: 17, warn: 9, alert: 4 },
}

type Planned = { level: 'info' | 'warn' | 'alert'; text: string; feature: string }
/** The 30 notices, levels spread evenly through the list, every text unique. */
export function plannedNotices(scene: Scene): Planned[] {
  const mix = MIX[scene]
  const slots: { pos: number; rank: number; level: 'info' | 'warn' | 'alert'; j: number }[] = []
  const add = (level: 'info' | 'warn' | 'alert', count: number, rank: number): void => {
    for (let j = 0; j < count; j++) slots.push({ pos: (j + 0.5) / count, rank, level, j })
  }
  add('info', mix.info, 0)
  add('warn', mix.warn, 1)
  add('alert', mix.alert, 2)
  slots.sort((a, b) => a.pos - b.pos || a.rank - b.rank)
  return slots.map((s, i) => {
    const pool = s.level === 'info' ? INFO_TPLS : s.level === 'warn' ? WARN_TPLS : ALERT_TPLS
    const tpl = pool[s.j % pool.length] ?? INFO_TPLS[0]
    const n = 3 + ((i * 7) % 90)
    const file = FILES[(i * 5 + s.j) % FILES.length] ?? FILES[0]
    return {
      level: s.level,
      text: t(tpl?.text ?? T.nTurn, { n, file }),
      feature: tpl?.feature ?? 'turn-receipt',
    }
  })
}

type PlannedEvidence = { kind: 'test' | 'build' | 'lint' | 'typecheck' | 'diff' | 'git' | 'run'; ok: boolean; summary: string; ref: string }
export function plannedEvidence(scene: Scene): PlannedEvidence[] {
  const failedFirst = scene !== 'calm'
  return [
    failedFirst
      ? { kind: 'test', ok: false, ref: 'npm test', summary: t(T.evFailed, { cmd: 'npm test', n: 3 }) }
      : { kind: 'test', ok: true, ref: 'npm test', summary: t(T.evPassed, { cmd: 'npm test', n: 38 }) },
    { kind: 'build', ok: true, ref: 'npm run build', summary: t(T.evOk, { cmd: 'npm run build' }) },
    { kind: 'lint', ok: true, ref: 'npm run lint', summary: t(T.evOk, { cmd: 'npm run lint' }) },
    { kind: 'typecheck', ok: true, ref: 'tsc --noEmit', summary: t(T.evOk, { cmd: 'tsc --noEmit' }) },
    { kind: 'diff', ok: true, ref: 'src/parser.ts', summary: t(T.evOk, { cmd: 'src/parser.ts' }) },
    { kind: 'git', ok: true, ref: 'git status', summary: t(T.evOk, { cmd: 'git status' }) },
    { kind: 'run', ok: true, ref: 'node scripts/seed.js', summary: t(T.evOk, { cmd: 'node scripts/seed.js' }) },
    { kind: 'test', ok: true, ref: 'npm test', summary: t(T.evPassed, { cmd: 'npm test', n: 42 }) },
  ]
}

// ---------- signals ----------

type Sig = { id: string; kind: SignalKind; level: Level; text: string; value?: number; ttlMs?: number; ageMs?: number }

/** The signals a scene publishes. Texts are protocol data (the advisor reads them), so they stay English. */
export function plannedSignals(scene: Scene): Sig[] {
  if (scene === 'calm') {
    return [
      { id: 'demo:context', kind: 'context', level: 'ok', text: 'context 31%', value: 31 },
      { id: 'demo:quota', kind: 'quota', level: 'ok', text: 'weekly 12%', value: 12 },
      { id: 'demo:budget', kind: 'budget', level: 'ok', text: 'budget 18%', value: 18 },
      { id: 'demo:saving', kind: 'saving', level: 'ok', text: 'saved 41k tokens', value: 41_000 },
      { id: 'demo:working', kind: 'working', level: 'ok', text: 'npm test', value: 0 },
      { id: 'demo:agents', kind: 'agents', level: 'ok', text: '1 running', value: 1 },
      { id: 'demo:evidence', kind: 'evidence', level: 'ok', text: 'tests passed', value: 1 },
    ]
  }
  if (scene === 'rescue') {
    return [
      { id: 'demo:context', kind: 'context', level: 'info', text: 'context 71%', value: 71 },
      { id: 'demo:quota', kind: 'quota', level: 'info', text: 'weekly 63%', value: 63 },
      { id: 'demo:budget', kind: 'budget', level: 'info', text: 'budget 74%', value: 74 },
      { id: 'demo:failure', kind: 'failure', level: 'info', text: 'failures 1', value: 1 },
      { id: 'demo:waste', kind: 'waste', level: 'ok', text: 'duplicate reads 2', value: 2 },
      { id: 'demo:saving', kind: 'saving', level: 'info', text: 'saved 254k tokens', value: 254_000 },
      { id: 'demo:rm -rf', kind: 'incident', level: 'alert', text: 'rm -rf', value: 1, ttlMs: 60_000, ageMs: 3_000 },
      { id: 'demo:working', kind: 'working', level: 'ok', text: 'npm test', value: 0 },
      { id: 'demo:agents', kind: 'agents', level: 'warn', text: '1 running · 1 denied', value: 1 },
      { id: 'demo:evidence', kind: 'evidence', level: 'ok', text: 'tests passed', value: 1 },
    ]
  }
  return [
    { id: 'demo:context', kind: 'context', level: 'warn', text: 'context 83%', value: 83 },
    { id: 'demo:quota', kind: 'quota', level: 'warn', text: 'weekly 46%', value: 46 },
    { id: 'demo:budget', kind: 'budget', level: 'warn', text: 'budget 91%', value: 91 },
    { id: 'demo:failure', kind: 'failure', level: 'warn', text: 'failures 3', value: 3 },
    { id: 'demo:loop', kind: 'loop', level: 'warn', text: 'same command repeated', value: 3 },
    { id: 'demo:waste', kind: 'waste', level: 'info', text: 'duplicate reads 6', value: 6 },
    { id: 'demo:saving', kind: 'saving', level: 'info', text: 'saved 254k tokens', value: 254_000 },
    { id: 'demo:incident', kind: 'incident', level: 'alert', text: 'rm -rf', value: 1, ttlMs: 60_000, ageMs: 40_000 },
    { id: 'demo:working', kind: 'working', level: 'ok', text: 'npm test', value: 0 },
    { id: 'demo:agents', kind: 'agents', level: 'warn', text: '2 running · 1 denied', value: 2 },
    { id: 'demo:evidence', kind: 'evidence', level: 'ok', text: 'tests passed', value: 1 },
  ]
}

async function publishSignal($: EngineInterface, s: Sig, now: number, startedAt: number): Promise<void> {
  const isWorking = s.kind === 'working'
  const at = isWorking ? startedAt - WORKING_HEAD_START_MS : now - (s.ageMs ?? 0)
  const value = isWorking ? Math.max(0, Math.floor((now - at) / 1000)) : s.value
  await publish($, {
    id: s.id,
    feature: feature.id,
    kind: s.kind,
    level: s.level,
    text: s.text,
    at,
    ...(value === undefined ? {} : { value }),
    ...(s.ttlMs === undefined ? {} : { ttlMs: s.ttlMs }),
  })
}

/** Once a second: the working signal's elapsed seconds move, and a fresh incident stays fresh. */
async function tickOnce($: EngineInterface): Promise<void> {
  try {
    if (!(await isOn($, feature))) {
      await stopDemo($, false)
      return
    }
    const s = await read($, state)
    if (!s.active) {
      ticker?.cancel()
      ticker = undefined
      return
    }
    const now = await $.clock.now()
    for (const sig of plannedSignals(s.scene)) {
      if (sig.kind === 'working' || sig.kind === 'incident') await publishSignal($, sig, now, s.startedAt)
    }
  } catch {
    // a missed tick only freezes the seconds for a moment
  }
}

// ---------- the store: backup, write, restore ----------

type Saved = { active: boolean; scene: Scene; keys: string[]; at: number }
async function readSaved($: EngineInterface): Promise<Saved | null> {
  const raw: unknown = await $.store.get(STATE_KEY)
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const keys = Array.isArray(o['keys']) ? o['keys'].filter((k): k is string => typeof k === 'string') : []
  return { active: o['active'] === true, scene: isScene(o['scene']) ? o['scene'] : 'busy', keys, at: typeof o['at'] === 'number' ? o['at'] : 0 }
}

async function backUp($: EngineInterface, key: string): Promise<void> {
  const existing = await $.store.get(BACKUP + key)
  if (existing !== undefined) return // an older backup is the real original
  const current = await $.store.get(key)
  await $.store.set(BACKUP + key, current === undefined ? { had: false } : { had: true, value: current })
}

async function restoreKeys($: EngineInterface, keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    const raw: unknown = await $.store.get(BACKUP + key)
    if (raw === null || typeof raw !== 'object') continue
    const b = raw as Record<string, unknown>
    if (b['had'] === true) await $.store.set(key, b['value'] ?? null)
    else await $.store.delete(key)
    await $.store.delete(BACKUP + key)
  }
  await $.store.delete(STATE_KEY)
}

async function writeScene($: EngineInterface, keys: readonly string[], now: number, scene: Scene): Promise<void> {
  for (const key of keys) {
    if (key === 'week-heatmap:days') await $.store.set(key, heatmapDays(now, scene))
    else if (key === 'savings:days') await $.store.set(key, savingsDays(now, scene))
    else if (key.startsWith('incidents:')) await $.store.set(key, incidentStore(now, scene))
    else if (key === 'achievements:unlocked') await $.store.set(key, achievements(now))
    else if (key === 'session-finder:index') await $.store.set(key, sessionIndex(now))
    else if (key === 'buddy:name') await $.store.set(key, 'Pixel')
  }
}

// ---------- start and stop ----------

async function cwdOf($: EngineInterface): Promise<string> {
  try {
    return await $.session.cwd()
  } catch {
    return ''
  }
}

async function startDemo($: EngineInterface, scene: Scene): Promise<void> {
  if (isStarting) return
  isStarting = true
  try {
    const now = await $.clock.now()
    const saved = await readSaved($)
    const fresh = saved === null || !saved.active
    const keys = fresh ? baseKeys(await cwdOf($)) : saved.keys
    if (fresh) for (const key of keys) await backUp($, key)
    await $.store.set(STATE_KEY, { active: true, scene, keys, at: now })
    await writeScene($, keys, now, scene)

    await retractAll($, feature.id)
    await update($, state, () => ({ active: true, scene, startedAt: now, keys }))
    for (const sig of plannedSignals(scene)) await publishSignal($, sig, now, now)

    if (fresh) {
      for (const n of plannedNotices(scene)) await notice($, n.level, n.text, n.feature, { immediate: true })
      const items = plannedEvidence(scene)
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item !== undefined) await recordEvidence($, { ...item, feature: feature.id, at: now - (items.length - i) * 90_000 })
      }
    } else {
      await notice($, 'info', t(T.sceneSwitched, { scene }), feature.id, { immediate: true })
    }

    ticker?.cancel()
    ticker = $.clock.every(1000, () => tickOnce($))
  } finally {
    isStarting = false
  }
}

/** Ends the demo and restores every key. Returns false when no demo was on. */
async function stopDemo($: EngineInterface, announce: boolean): Promise<boolean> {
  ticker?.cancel()
  ticker = undefined
  const saved = await readSaved($)
  const cur = await read($, state)
  if (!cur.active && saved === null) return false
  await retractAll($, feature.id)
  await restoreKeys($, saved === null ? cur.keys : saved.keys)
  await update($, state, () => OFF_STATE)
  if (announce) await notice($, 'info', t(T.ended), feature.id, { immediate: true })
  return true
}

// ---------- handlers ----------

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  void e
  try {
    await $.command.register({ name: 'demo', description: t(T.cmdDesc), argumentHint: t(T.cmdHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'demo', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  ticker?.cancel()
  ticker = undefined
  isStarting = false
  // A demo that outlived its session must not leak fake numbers into real files: put the real data back.
  const saved = await readSaved($)
  if (saved !== null && saved.active) {
    await restoreKeys($, saved.keys)
    await update($, state, () => OFF_STATE)
    if (await isOn($, feature)) await notice($, 'info', t(T.leftover), feature.id, { immediate: true })
  } else {
    await update($, state, () => OFF_STATE)
  }
}

export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  void e
  if (!(await isOn($, feature))) return null
  const s = await read($, state)
  if (!s.active) return null
  return { text: t(T.chip), level: 'warn' }
}

export function register(on: On) {
  on('command.run', { command: 'demo' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const parts = e.args.trim().toLowerCase().split(/\s+/).filter(p => p !== '')
    const verb = parts[0]
    const arg = parts[1]
    if (verb === undefined) {
      await $.ui.open({ id: PANE_ID, title: t(T.paneTitle), focus: true, closeOnEscape: true })
      return { text: t(T.opened) }
    }
    if (verb === 'on' || verb === 'scene') {
      if (verb === 'scene' && arg === undefined) return { text: t(T.usage) }
      if (arg !== undefined && !isScene(arg)) return { text: t(T.badScene, { name: arg }) }
      const scene: Scene = isScene(arg) ? arg : (await read($, state)).scene
      await startDemo($, scene)
      return { text: t(T.started, { scene }) }
    }
    if (verb === 'off') {
      const was = await stopDemo($, true)
      return { text: was ? t(T.stopped) : t(T.notOn) }
    }
    return { text: t(T.usage) }
  })

  on('ui.render', { component: 'Pane', requestId: 'demo' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>
    const s = await read($, state)
    const keys = s.active ? s.keys : baseKeys('<cwd>')
    const actions: HeaderAction[] = [
      s.active
        ? { key: 'demo-off', label: t(T.btnOff), primary: true, onPress: () => stopDemo($, true) }
        : { key: 'demo-on', label: t(T.btnOn), primary: true, onPress: () => startDemo($, s.scene) },
      ...SCENES.map(sc => ({ key: `demo-scene-${sc}`, label: t(T.sceneName[sc]), onPress: () => startDemo($, sc) })),
    ]
    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: s.active ? t(T.statusOn, { scene: t(T.sceneName[s.scene]) }) : t(T.statusOff),
          level: s.active ? 'warn' : 'ok',
          icon: ICONS.setup,
          actions,
        })}
        <Box flexDirection="column">
          {sectionTitle($, e, t(T.secScenes))}
          {SCENES.map(sc => (
            <Box key={`row-${sc}`}>
              {listRow($, e, {
                key: `demo-row-${sc}`,
                left: s.active && s.scene === sc ? '●' : '○',
                text: t(T.sceneName[sc]),
                right: t(T.sceneDesc[sc]),
                level: s.active && s.scene === sc ? 'warn' : 'ok',
              })}
            </Box>
          ))}
        </Box>
        <Box flexDirection="column">
          {sectionTitle($, e, s.active ? t(T.secReplaced) : t(T.secWillReplace))}
          {keys.map(key => (
            <Box key={`key-${key}`}>{listRow($, e, { key: `demo-key-${key}`, left: key, text: labelOf(key) })}</Box>
          ))}
        </Box>
        <Box flexDirection="column">
          <Text dimColor size="footnote">
            {s.active ? t(T.footOn) : t(T.footOff)}
          </Text>
          <Text dimColor size="footnote">
            {s.active ? t(T.restore) : t(T.restoreAfter)}
          </Text>
        </Box>
      </Box>
    )
  })
}
