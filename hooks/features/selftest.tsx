import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement } from 'claude-code'

import { clearBackdrop, setBackdrop } from '../backdrop'
import { isOn, notice, t } from '../core'
import type { BandInput, Feature, Input, Notices } from '../core'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip, HeaderAction } from '../ui'

/*
 * Self-test: a live check of every capability the plugin relies on, run INSIDE the real app.
 * `/selftest` opens a report pane and runs the checks one after the other; each ends as
 * ✓ (worked), ✗ (the engine refused or threw: its own reason is shown verbatim) or – (skipped).
 * `/selftest model` adds one tiny paid model call; `/selftest copy` copies the last report as text.
 * A check that throws is a ✗ with the message, never a crash; the whole run stays under ~10 s.
 */

const T = {
  title: { en: 'Self-test', he: 'בדיקה עצמית', es: 'Autotest', fr: 'Auto-test', ru: 'Самотест', zh: '自检', ja: 'セルフテスト', pt: 'Autoteste', de: 'Selbsttest', ko: '자가 점검' },
  description: {
    en: 'Runs every capability of the plugin live inside the real app (panes, backdrop, sound, clipboard, store, clock, processes, feature health) and shows what actually worked. /selftest runs it; /selftest model adds one paid model call.',
    he: 'מריץ בתוך האפליקציה האמיתית כל יכולת של התוסף (לוחות, רקע, צליל, לוח גזירים, אחסון, שעון, תהליכים, בריאות השכלולים) ומראה מה באמת עבד. /selftest מריץ; /selftest model מוסיף קריאת מודל בתשלום.',
    es: 'Ejecuta en vivo, dentro de la aplicación real, cada capacidad del plugin (paneles, fondo, sonido, portapapeles, almacén, reloj, procesos, estado de las funciones) y muestra lo que realmente funcionó. /selftest lo ejecuta; /selftest model añade una llamada de pago al modelo.',
    fr: 'Exécute en direct, dans la vraie application, chaque capacité du plugin (panneaux, arrière-plan, son, presse-papiers, stockage, horloge, processus, état des fonctions) et montre ce qui a vraiment fonctionné. /selftest le lance ; /selftest model ajoute un appel payant au modèle.',
    ru: 'Вживую, внутри настоящего приложения, проверяет каждую возможность плагина (панели, фон, звук, буфер обмена, хранилище, часы, процессы, состояние функций) и показывает, что реально сработало. /selftest запускает проверку; /selftest model добавляет один платный вызов модели.',
    zh: '在真实应用内实时运行插件的所有能力（面板、背景、声音、剪贴板、存储、时钟、进程、功能健康），并显示实际有效的部分。/selftest 运行；/selftest model 会额外调用一次付费模型。',
    ja: 'プラグインのすべての機能（パネル、背景、サウンド、クリップボード、ストア、クロック、プロセス、機能の健全性）を実際のアプリ内でライブ実行し、実際に動いたものを表示します。/selftest で実行、/selftest model は有料のモデル呼び出しを 1 回追加します。',
    pt: 'Executa ao vivo todas as capacidades do plugin dentro do app real (painéis, fundo, som, área de transferência, armazenamento, relógio, processos, saúde dos recursos) e mostra o que realmente funcionou. /selftest executa; /selftest model acrescenta uma chamada paga ao modelo.',
    de: 'Führt alle Fähigkeiten des Plugins live in der echten App aus (Panels, Hintergrund, Ton, Zwischenablage, Speicher, Uhr, Prozesse, Funktionszustand) und zeigt, was tatsächlich funktioniert hat. /selftest startet ihn; /selftest model fügt einen kostenpflichtigen Modellaufruf hinzu.',
    ko: '플러그인의 모든 기능(패널, 배경, 소리, 클립보드, 저장소, 시계, 프로세스, 기능 상태)을 실제 앱 안에서 직접 실행하고 실제로 동작한 것을 보여 줍니다. /selftest로 실행하고, /selftest model은 유료 모델 호출을 한 번 추가합니다.',
  },
  off: {
    en: 'The feature is off; turn it on in the /toolkitty pane',
    he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty',
    es: 'La función está desactivada; actívala en el panel /toolkitty',
    fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty',
    ru: 'Функция отключена; включите её в панели /toolkitty',
    zh: '该功能已关闭；请在 /toolkitty 面板中开启',
    ja: 'この機能はオフです。/toolkitty パネルでオンにしてください',
    pt: 'O recurso está desativado; ative-o no painel /toolkitty',
    de: 'Die Funktion ist aus; im /toolkitty-Panel einschalten',
    ko: '기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요',
  },
  cmd: {
    en: 'Runs a live self-test of Toolkitty inside this app (/selftest model, /selftest copy)',
    he: 'מריץ בדיקה עצמית חיה של ה-Toolkitty בתוך האפליקציה (/selftest model, /selftest copy)',
    es: 'Ejecuta un autotest en vivo del toolkitty dentro de esta aplicación (/selftest model, /selftest copy)',
    fr: 'Lance un auto-test en direct du toolkitty dans cette application (/selftest model, /selftest copy)',
    ru: 'Запускает живой самотест toolkitty внутри этого приложения (/selftest model, /selftest copy)',
    zh: '在此应用内对 Toolkitty 运行实时自检（/selftest model、/selftest copy）',
    ja: 'このアプリ内で Toolkitty のライブセルフテストを実行します（/selftest model、/selftest copy）',
    pt: 'Executa um autoteste ao vivo do toolkitty neste app (/selftest model, /selftest copy)',
    de: 'Führt einen Live-Selbsttest des Toolkittys in dieser App aus (/selftest model, /selftest copy)',
    ko: '이 앱 안에서 Toolkitty 자가 점검을 실시간으로 실행합니다 (/selftest model, /selftest copy)',
  },
  usage: {
    en: 'Usage: /selftest runs the checks, /selftest model adds one paid model call, /selftest copy copies the last report.',
    he: 'שימוש: /selftest מריץ את הבדיקות, /selftest model מוסיף קריאת מודל בתשלום, /selftest copy מעתיק את הדוח האחרון.',
    es: 'Uso: /selftest ejecuta las comprobaciones, /selftest model añade una llamada de pago al modelo, /selftest copy copia el último informe.',
    fr: 'Usage : /selftest lance les vérifications, /selftest model ajoute un appel payant au modèle, /selftest copy copie le dernier rapport.',
    ru: 'Использование: /selftest запускает проверки, /selftest model добавляет один платный вызов модели, /selftest copy копирует последний отчёт.',
    zh: '用法：/selftest 运行检查，/selftest model 额外调用一次付费模型，/selftest copy 复制最近一份报告。',
    ja: '使い方：/selftest でチェックを実行、/selftest model で有料のモデル呼び出しを 1 回追加、/selftest copy で直近のレポートをコピー。',
    pt: 'Uso: /selftest executa as verificações, /selftest model acrescenta uma chamada paga ao modelo, /selftest copy copia o último relatório.',
    de: 'Verwendung: /selftest führt die Prüfungen aus, /selftest model fügt einen kostenpflichtigen Modellaufruf hinzu, /selftest copy kopiert den letzten Bericht.',
    ko: '사용법: /selftest는 점검을 실행하고, /selftest model은 유료 모델 호출을 한 번 추가하며, /selftest copy는 마지막 리포트를 복사합니다.',
  },
  reportTitle: { en: 'Toolkitty self-test', he: 'בדיקה עצמית של Toolkitty', es: 'Autotest del Toolkitty', fr: 'Auto-test du Toolkitty', ru: 'Самотест Toolkitty', zh: 'Toolkitty 自检', ja: 'Toolkitty セルフテスト', pt: 'Autoteste do Toolkitty', de: 'Toolkitty-Selbsttest', ko: 'Toolkitty 자가 점검' },
  counts: {
    en: '{ok} ok · {failed} failed · {skipped} skipped',
    he: '{ok} תקינים · {failed} נכשלו · {skipped} דולגו',
    es: '{ok} correctas · {failed} fallidas · {skipped} omitidas',
    fr: '{ok} réussies · {failed} échouées · {skipped} ignorées',
    ru: '{ok} успешно · {failed} с ошибкой · {skipped} пропущено',
    zh: '{ok} 通过 · {failed} 失败 · {skipped} 跳过',
    ja: '{ok} 成功 · {failed} 失敗 · {skipped} スキップ',
    pt: '{ok} ok · {failed} com falha · {skipped} ignorados',
    de: '{ok} ok · {failed} fehlgeschlagen · {skipped} übersprungen',
    ko: '{ok} 성공 · {failed} 실패 · {skipped} 건너뜀',
  },
  running: { en: 'running…', he: 'רץ…', es: 'ejecutando…', fr: 'en cours…', ru: 'идёт проверка…', zh: '运行中…', ja: '実行中…', pt: 'executando…', de: 'läuft…', ko: '실행 중…' },
  actRun: { en: 'Run again', he: 'הרץ שוב', es: 'Ejecutar de nuevo', fr: 'Relancer', ru: 'Запустить снова', zh: '再次运行', ja: '再実行', pt: 'Executar de novo', de: 'Erneut ausführen', ko: '다시 실행' },
  actCopy: { en: 'Copy report', he: 'העתק דוח', es: 'Copiar informe', fr: 'Copier le rapport', ru: 'Копировать отчёт', zh: '复制报告', ja: 'レポートをコピー', pt: 'Copiar relatório', de: 'Bericht kopieren', ko: '리포트 복사' },
  actModel: { en: 'Run with model', he: 'הרץ עם מודל', es: 'Ejecutar con modelo', fr: 'Lancer avec le modèle', ru: 'Запустить с моделью', zh: '用模型运行', ja: 'モデル付きで実行', pt: 'Executar com modelo', de: 'Mit Modell ausführen', ko: '모델과 함께 실행' },
  sEngine: { en: 'Engine calls', he: 'קריאות מנוע', es: 'Llamadas al motor', fr: 'Appels au moteur', ru: 'Вызовы движка', zh: '引擎调用', ja: 'エンジン呼び出し', pt: 'Chamadas do motor', de: 'Engine-Aufrufe', ko: '엔진 호출' },
  sPanes: { en: 'Panes', he: 'לוחות', es: 'Paneles', fr: 'Panneaux', ru: 'Панели', zh: '面板', ja: 'パネル', pt: 'Painéis', de: 'Panels', ko: '패널' },
  emptyText: { en: 'No report yet.', he: 'עדיין אין דוח.', es: 'Aún no hay informe.', fr: 'Pas encore de rapport.', ru: 'Отчёта пока нет.', zh: '还没有报告。', ja: 'レポートはまだありません。', pt: 'Ainda não há relatório.', de: 'Noch kein Bericht.', ko: '아직 리포트가 없습니다.' },
  emptyHint: {
    en: 'Run /selftest to try every capability live; /selftest copy copies the report.',
    he: 'הרץ /selftest כדי לנסות כל יכולת בשידור חי; /selftest copy מעתיק את הדוח.',
    es: 'Ejecuta /selftest para probar cada capacidad en vivo; /selftest copy copia el informe.',
    fr: 'Lancez /selftest pour tester chaque capacité en direct ; /selftest copy copie le rapport.',
    ru: 'Запустите /selftest, чтобы проверить каждую возможность вживую; /selftest copy копирует отчёт.',
    zh: '运行 /selftest 实时试用所有能力；/selftest copy 复制报告。',
    ja: '/selftest ですべての機能をライブで試せます。/selftest copy でレポートをコピーします。',
    pt: 'Execute /selftest para testar todas as capacidades ao vivo; /selftest copy copia o relatório.',
    de: 'Führe /selftest aus, um alle Fähigkeiten live zu testen; /selftest copy kopiert den Bericht.',
    ko: '/selftest를 실행하면 모든 기능을 실시간으로 시험하고, /selftest copy로 리포트를 복사합니다.',
  },
  hint: {
    en: 'Reasons are the engine’s own words. Panes that were already open are left as they are.',
    he: 'הסיבות הן המילים של המנוע עצמו. לוחות שכבר היו פתוחים נשארים כמות שהם.',
    es: 'Los motivos son las palabras del propio motor. Los paneles que ya estaban abiertos se dejan como están.',
    fr: 'Les motifs sont les mots du moteur lui-même. Les panneaux déjà ouverts sont laissés tels quels.',
    ru: 'Причины приведены словами самого движка. Уже открытые панели остаются как есть.',
    zh: '原因均为引擎自己的描述。已经打开的面板保持原样。',
    ja: '理由はエンジン自身の記述です。すでに開いているパネルはそのままにします。',
    pt: 'Os motivos são as palavras do próprio motor. Painéis que já estavam abertos ficam como estão.',
    de: 'Die Gründe sind die eigenen Worte der Engine. Bereits geöffnete Panels bleiben unverändert.',
    ko: '사유는 엔진이 직접 남긴 문구입니다. 이미 열려 있던 패널은 그대로 둡니다.',
  },
  noReport: {
    en: 'No report yet; run /selftest first.',
    he: 'עדיין אין דוח; הרץ קודם /selftest.',
    es: 'Aún no hay informe; ejecuta primero /selftest.',
    fr: 'Pas encore de rapport ; lancez d’abord /selftest.',
    ru: 'Отчёта пока нет; сначала запустите /selftest.',
    zh: '还没有报告；请先运行 /selftest。',
    ja: 'レポートはまだありません。先に /selftest を実行してください。',
    pt: 'Ainda não há relatório; execute /selftest primeiro.',
    de: 'Noch kein Bericht; führe zuerst /selftest aus.',
    ko: '아직 리포트가 없습니다. 먼저 /selftest를 실행하세요.',
  },
  copied: { en: 'Self-test report copied.', he: 'דוח הבדיקה העצמית הועתק.', es: 'Informe del autotest copiado.', fr: 'Rapport de l’auto-test copié.', ru: 'Отчёт самотеста скопирован.', zh: '自检报告已复制。', ja: 'セルフテストのレポートをコピーしました。', pt: 'Relatório do autoteste copiado.', de: 'Selbsttest-Bericht kopiert.', ko: '자가 점검 리포트를 복사했습니다.' },
  copyFail: { en: 'Could not copy the report: {reason}', he: 'לא ניתן להעתיק את הדוח: {reason}', es: 'No se pudo copiar el informe: {reason}', fr: 'Impossible de copier le rapport : {reason}', ru: 'Не удалось скопировать отчёт: {reason}', zh: '无法复制报告：{reason}', ja: 'レポートをコピーできませんでした：{reason}', pt: 'Não foi possível copiar o relatório: {reason}', de: 'Der Bericht konnte nicht kopiert werden: {reason}', ko: '리포트를 복사할 수 없습니다: {reason}' },
  summary: { en: 'Self-test: {counts}.', he: 'בדיקה עצמית: {counts}.', es: 'Autotest: {counts}.', fr: 'Auto-test : {counts}.', ru: 'Самотест: {counts}.', zh: '自检：{counts}。', ja: 'セルフテスト：{counts}。', pt: 'Autoteste: {counts}.', de: 'Selbsttest: {counts}.', ko: '자가 점검: {counts}.' },
  failedList: { en: ' Failed: {list}.', he: ' נכשלו: {list}.', es: ' Fallaron: {list}.', fr: ' Échecs : {list}.', ru: ' С ошибкой: {list}.', zh: ' 失败：{list}。', ja: ' 失敗：{list}。', pt: ' Falhas: {list}.', de: ' Fehlgeschlagen: {list}.', ko: ' 실패: {list}.' },
  chip: { en: 'selftest ✗ {n}', he: 'selftest ✗ {n}', es: 'selftest ✗ {n}', fr: 'selftest ✗ {n}', ru: 'selftest ✗ {n}', zh: '自检 ✗ {n}', ja: 'セルフテスト ✗ {n}', pt: 'autoteste ✗ {n}', de: 'Selbsttest ✗ {n}', ko: '자가 점검 ✗ {n}' },

  // Names of the checks (drawn from the stored row, so a language switch re-translates old reports).
  nSurfaces: { en: 'Surfaces', he: 'משטחים', es: 'Superficies', fr: 'Surfaces', ru: 'Поверхности', zh: '界面', ja: 'サーフェス', pt: 'Superfícies', de: 'Oberflächen', ko: '화면 요소' },
  nPane: { en: 'Pane {id}', he: 'לוח {id}', es: 'Panel {id}', fr: 'Panneau {id}', ru: 'Панель {id}', zh: '面板 {id}', ja: 'パネル {id}', pt: 'Painel {id}', de: 'Panel {id}', ko: '패널 {id}' },
  nBackdrop: { en: 'Backdrop', he: 'רקע חלון', es: 'Fondo de ventana', fr: 'Arrière-plan', ru: 'Фон окна', zh: '背景', ja: '背景', pt: 'Fundo', de: 'Hintergrund', ko: '배경' },
  nPlace: { en: 'Placed row', he: 'שורה מוצבת', es: 'Fila colocada', fr: 'Ligne placée', ru: 'Размещённая строка', zh: '放置行', ja: '配置行', pt: 'Linha posicionada', de: 'Platzierte Zeile', ko: '배치된 줄' },
  nNotify: { en: 'Notification', he: 'התראת מערכת', es: 'Notificación', fr: 'Notification', ru: 'Уведомление', zh: '通知', ja: '通知', pt: 'Notificação', de: 'Benachrichtigung', ko: '알림' },
  nToast: { en: 'Toast', he: 'הודעה קופצת', es: 'Aviso emergente', fr: 'Toast', ru: 'Всплывающее сообщение', zh: '提示条', ja: 'トースト', pt: 'Toast', de: 'Toast', ko: '토스트' },
  nAudio: { en: 'Sound', he: 'צליל', es: 'Sonido', fr: 'Son', ru: 'Звук', zh: '声音', ja: 'サウンド', pt: 'Som', de: 'Ton', ko: '소리' },
  nPrompt: { en: 'Prompt box', he: 'תיבת הפרומפט', es: 'Cuadro del prompt', fr: 'Zone de saisie', ru: 'Поле ввода', zh: '输入框', ja: 'プロンプト欄', pt: 'Caixa de prompt', de: 'Eingabefeld', ko: '입력창' },
  nCopy: { en: 'Clipboard', he: 'לוח גזירים', es: 'Portapapeles', fr: 'Presse-papiers', ru: 'Буфер обмена', zh: '剪贴板', ja: 'クリップボード', pt: 'Área de transferência', de: 'Zwischenablage', ko: '클립보드' },
  nStore: { en: 'Store', he: 'אחסון', es: 'Almacén', fr: 'Stockage', ru: 'Хранилище', zh: '存储', ja: 'ストア', pt: 'Armazenamento', de: 'Speicher', ko: '저장소' },
  nClock: { en: 'Clock', he: 'שעון', es: 'Reloj', fr: 'Horloge', ru: 'Часы', zh: '时钟', ja: 'クロック', pt: 'Relógio', de: 'Uhr', ko: '시계' },
  nProc: { en: 'Process: {cmd}', he: 'תהליך: {cmd}', es: 'Proceso: {cmd}', fr: 'Processus : {cmd}', ru: 'Процесс: {cmd}', zh: '进程：{cmd}', ja: 'プロセス：{cmd}', pt: 'Processo: {cmd}', de: 'Prozess: {cmd}', ko: '프로세스: {cmd}' },
  nModel: { en: 'Model', he: 'מודל', es: 'Modelo', fr: 'Modèle', ru: 'Модель', zh: '模型', ja: 'モデル', pt: 'Modelo', de: 'Modell', ko: '모델' },
  nFeatures: { en: 'Feature health', he: 'בריאות השכלולים', es: 'Estado de las funciones', fr: 'État des fonctions', ru: 'Состояние функций', zh: '功能健康', ja: '機能の健全性', pt: 'Saúde dos recursos', de: 'Funktionszustand', ko: '기능 상태' },
  nCommands: { en: 'Commands', he: 'פקודות', es: 'Comandos', fr: 'Commandes', ru: 'Команды', zh: '命令', ja: 'コマンド', pt: 'Comandos', de: 'Befehle', ko: '명령' },

  // Details written by this feature (an engine's reason is always shown as given).
  dNoSurface: { en: 'no surface attached', he: 'אין משטח מחובר', es: 'ninguna superficie conectada', fr: 'aucune surface connectée', ru: 'нет подключённой поверхности', zh: '未附加界面', ja: 'サーフェス未接続', pt: 'nenhuma superfície conectada', de: 'keine Oberfläche angebunden', ko: '연결된 화면 요소 없음' },
  dDrawn: { en: 'drawn', he: 'צויר', es: 'dibujado', fr: 'affiché', ru: 'показана', zh: '已绘制', ja: '描画済み', pt: 'desenhado', de: 'gezeichnet', ko: '그려짐' },
  dAlreadyOpen: { en: 'already open and drawn; left alone', he: 'כבר פתוח ומצויר; לא נגעתי', es: 'ya abierto y dibujado; sin tocar', fr: 'déjà ouvert et affiché ; laissé tel quel', ru: 'уже открыта и показана; не трогаю', zh: '已打开并已绘制；保持原样', ja: 'すでに開いて描画済み。そのままにしました', pt: 'já aberto e desenhado; deixado como está', de: 'bereits offen und gezeichnet; unverändert gelassen', ko: '이미 열려 있고 그려져 있어 그대로 둠' },
  dOpenUndrawn: { en: 'open but not drawn', he: 'פתוח אבל לא מצויר', es: 'abierto pero sin dibujar', fr: 'ouvert mais non affiché', ru: 'открыта, но не показана', zh: '已打开但未绘制', ja: '開いているが未描画', pt: 'aberto, mas não desenhado', de: 'offen, aber nicht gezeichnet', ko: '열려 있지만 그려지지 않음' },
  dNoReason: { en: 'no reason given', he: 'לא ניתנה סיבה', es: 'sin motivo', fr: 'aucun motif donné', ru: 'причина не указана', zh: '未给出原因', ja: '理由なし', pt: 'nenhum motivo informado', de: 'kein Grund angegeben', ko: '사유 없음' },
  dNoAnswer: { en: 'no answer within {s} s', he: 'אין תשובה תוך {s} שניות', es: 'sin respuesta en {s} s', fr: 'pas de réponse en {s} s', ru: 'нет ответа за {s} с', zh: '{s} 秒内无响应', ja: '{s} 秒以内に応答なし', pt: 'sem resposta em {s} s', de: 'keine Antwort innerhalb von {s} s', ko: '{s}초 내 응답 없음' },
  dBudget: { en: 'time budget of {s} s used up', he: 'תקציב הזמן של {s} שניות נגמר', es: 'presupuesto de {s} s agotado', fr: 'budget de {s} s épuisé', ru: 'лимит времени {s} с исчерпан', zh: '{s} 秒的时间预算已用尽', ja: '{s} 秒の時間予算を使い切りました', pt: 'orçamento de tempo de {s} s esgotado', de: 'Zeitbudget von {s} s aufgebraucht', ko: '{s}초의 시간 예산을 모두 사용함' },
  dAurora: {
    en: 'aurora active; its own report applies',
    he: 'האורורה פעילה; הדוח שלה חל',
    es: 'aurora activa; rige su propio informe',
    fr: 'aurore active ; son propre rapport s’applique',
    ru: '«Аврора» активна; действует её собственный отчёт',
    zh: '极光已启用；以它自己的报告为准',
    ja: 'オーロラ有効。そのレポートが優先されます',
    pt: 'aurora ativa; vale o relatório dela',
    de: 'Aurora aktiv; deren eigener Bericht gilt',
    ko: '오로라 활성; 자체 리포트가 우선함',
  },
  dDesktopOnly: { en: 'desktop only; no desktop surface attached', he: 'שולחן עבודה בלבד; אין משטח שולחן עבודה מחובר', es: 'solo escritorio; sin superficie de escritorio', fr: 'bureau uniquement ; aucune surface de bureau', ru: 'только десктоп; десктоп-поверхность не подключена', zh: '仅桌面端；未附加桌面界面', ja: 'デスクトップ専用。デスクトップのサーフェスが未接続です', pt: 'apenas desktop; nenhuma superfície de desktop conectada', de: 'nur Desktop; keine Desktop-Oberfläche angebunden', ko: '데스크톱 전용; 데스크톱 화면 요소가 연결되지 않음' },
  dPlaced: { en: 'placed (the row itself draws nothing)', he: 'הוצבה (השורה עצמה לא מציירת כלום)', es: 'colocada (la fila no dibuja nada)', fr: 'placée (la ligne ne dessine rien)', ru: 'размещена (сама строка ничего не рисует)', zh: '已放置（该行本身不绘制任何内容）', ja: '配置済み（行自体は何も描画しません）', pt: 'posicionado (a linha em si não desenha nada)', de: 'platziert (die Zeile selbst zeichnet nichts)', ko: '배치됨 (줄 자체는 아무것도 그리지 않음)' },
  dSent: { en: 'sent via {channel}', he: 'נשלח דרך {channel}', es: 'enviada por {channel}', fr: 'envoyée via {channel}', ru: 'отправлено через {channel}', zh: '已通过 {channel} 发送', ja: '{channel} 経由で送信しました', pt: 'enviado via {channel}', de: 'gesendet über {channel}', ko: '{channel}(으)로 전송됨' },
  dToast: { en: 'shown (look at the corner of the window)', he: 'הוצגה (הסתכל בפינת החלון)', es: 'mostrado (mira la esquina de la ventana)', fr: 'affiché (regardez le coin de la fenêtre)', ru: 'показано (посмотрите в угол окна)', zh: '已显示（请看窗口一角）', ja: '表示しました（ウィンドウの隅を見てください）', pt: 'exibido (veja o canto da janela)', de: 'angezeigt (schau in die Fensterecke)', ko: '표시됨 (창 모서리를 확인하세요)' },
  dAudio: { en: 'call resolved (a machine without a player stays silent)', he: 'הקריאה הסתיימה (מחשב בלי נגן נשאר שקט)', es: 'llamada resuelta (sin reproductor no suena)', fr: 'appel terminé (sans lecteur, aucun son)', ru: 'вызов завершён (без проигрывателя звука не будет)', zh: '调用已完成（没有播放器的机器会保持静音）', ja: '呼び出し完了（プレーヤーのないマシンでは無音になります）', pt: 'chamada concluída (uma máquina sem player fica em silêncio)', de: 'Aufruf abgeschlossen (ohne Player bleibt es still)', ko: '호출 완료 (플레이어가 없는 기기는 무음)' },
  dPromptSkip: { en: 'not exercised (would change your prompt box)', he: 'לא נבדק (היה משנה את תיבת הפרומפט שלך)', es: 'no probado (cambiaría tu cuadro de prompt)', fr: 'non testé (cela modifierait votre zone de saisie)', ru: 'не проверялось (изменило бы ваше поле ввода)', zh: '未执行（会改变你的输入框）', ja: '未実行（プロンプト欄が変わってしまうため）', pt: 'não executado (alteraria sua caixa de prompt)', de: 'nicht ausgeführt (würde dein Eingabefeld ändern)', ko: '실행 안 함 (입력창이 바뀌게 됨)' },
  dCopied: { en: 'copied a short test text to the clipboard', he: 'הועתק טקסט בדיקה קצר ללוח הגזירים', es: 'texto de prueba copiado al portapapeles', fr: 'court texte de test copié dans le presse-papiers', ru: 'короткий тестовый текст скопирован в буфер', zh: '已把一小段测试文本复制到剪贴板', ja: '短いテストテキストをクリップボードにコピーしました', pt: 'copiou um texto de teste curto para a área de transferência', de: 'kurzen Testtext in die Zwischenablage kopiert', ko: '짧은 테스트 텍스트를 클립보드에 복사함' },
  dStoreOk: { en: 'wrote and read back {value}', he: 'נכתב ונקרא בחזרה: {value}', es: 'escrito y leído de vuelta: {value}', fr: 'écrit puis relu : {value}', ru: 'записано и прочитано обратно: {value}', zh: '已写入并读回 {value}', ja: '{value} を書き込み、読み戻しました', pt: 'gravou e leu de volta {value}', de: '{value} geschrieben und zurückgelesen', ko: '{value}을(를) 쓰고 다시 읽음' },
  dStoreBad: { en: 'wrote {sent}, read back {got}', he: 'נכתב {sent}, נקרא {got}', es: 'escrito {sent}, leído {got}', fr: 'écrit {sent}, relu {got}', ru: 'записано {sent}, прочитано {got}', zh: '写入 {sent}，读回 {got}', ja: '{sent} を書き込み、{got} を読み戻しました', pt: 'gravou {sent}, leu de volta {got}', de: '{sent} geschrieben, {got} zurückgelesen', ko: '{sent}을(를) 썼고 {got}을(를) 읽음' },
  dClockOk: { en: 'now {iso}; a 10 ms timer fired', he: 'עכשיו {iso}; טיימר של 10 מילישניות הופעל', es: 'ahora {iso}; un temporizador de 10 ms se disparó', fr: 'maintenant {iso} ; un minuteur de 10 ms s’est déclenché', ru: 'сейчас {iso}; таймер на 10 мс сработал', zh: '现在 {iso}；10 毫秒定时器已触发', ja: '現在 {iso}。10 ms のタイマーが作動しました', pt: 'agora {iso}; um timer de 10 ms disparou', de: 'jetzt {iso}; ein 10-ms-Timer hat ausgelöst', ko: '현재 {iso}; 10ms 타이머가 작동함' },
  dClockBad: { en: 'implausible time {now}', he: 'זמן לא סביר {now}', es: 'hora inverosímil {now}', fr: 'heure invraisemblable {now}', ru: 'неправдоподобное время {now}', zh: '时间不合理：{now}', ja: '不正な時刻：{now}', pt: 'horário implausível {now}', de: 'unplausible Zeit {now}', ko: '비정상적인 시간 {now}' },
  dClockLate: { en: 'a 10 ms timer did not fire within 2 s', he: 'טיימר של 10 מילישניות לא הופעל תוך 2 שניות', es: 'un temporizador de 10 ms no se disparó en 2 s', fr: 'un minuteur de 10 ms ne s’est pas déclenché en 2 s', ru: 'таймер на 10 мс не сработал за 2 с', zh: '10 毫秒定时器在 2 秒内未触发', ja: '10 ms のタイマーが 2 秒以内に作動しませんでした', pt: 'um timer de 10 ms não disparou em 2 s', de: 'ein 10-ms-Timer hat nicht innerhalb von 2 s ausgelöst', ko: '10ms 타이머가 2초 내에 작동하지 않음' },
  dMissing: { en: 'not installed', he: 'לא מותקן', es: 'no instalado', fr: 'non installé', ru: 'не установлен', zh: '未安装', ja: '未インストール', pt: 'não instalado', de: 'nicht installiert', ko: '설치되지 않음' },
  dExit: { en: 'exit {code}: {err}', he: 'קוד יציאה {code}: {err}', es: 'salida {code}: {err}', fr: 'sortie {code} : {err}', ru: 'код выхода {code}: {err}', zh: '退出码 {code}：{err}', ja: '終了コード {code}：{err}', pt: 'saída {code}: {err}', de: 'Exit {code}: {err}', ko: '종료 {code}: {err}' },
  dModelSkip: { en: 'skipped: costs money; run /selftest model', he: 'דולג: עולה כסף; הרץ /selftest model', es: 'omitido: cuesta dinero; ejecuta /selftest model', fr: 'ignoré : payant ; lancez /selftest model', ru: 'пропущено: платный вызов; запустите /selftest model', zh: '已跳过：会产生费用；请运行 /selftest model', ja: 'スキップ：費用がかかります。/selftest model を実行してください', pt: 'ignorado: custa dinheiro; execute /selftest model', de: 'übersprungen: kostet Geld; führe /selftest model aus', ko: '건너뜀: 비용이 발생합니다. /selftest model을 실행하세요' },
  dModelOk: { en: 'answered: {text}', he: 'ענה: {text}', es: 'respondió: {text}', fr: 'a répondu : {text}', ru: 'ответил: {text}', zh: '已回答：{text}', ja: '応答あり：{text}', pt: 'respondeu: {text}', de: 'beantwortet: {text}', ko: '응답함: {text}' },
  dModelNo: { en: 'not answered: {reason}', he: 'לא ענה: {reason}', es: 'sin respuesta: {reason}', fr: 'pas de réponse : {reason}', ru: 'нет ответа: {reason}', zh: '未回答：{reason}', ja: '応答なし：{reason}', pt: 'sem resposta: {reason}', de: 'nicht beantwortet: {reason}', ko: '응답 없음: {reason}' },
  dNoCatalog: { en: 'the feature catalogue is not loaded', he: 'קטלוג השכלולים לא נטען', es: 'el catálogo de funciones no está cargado', fr: 'le catalogue des fonctions n’est pas chargé', ru: 'каталог функций не загружен', zh: '功能目录未加载', ja: '機能カタログが読み込まれていません', pt: 'o catálogo de recursos não está carregado', de: 'der Funktionskatalog ist nicht geladen', ko: '기능 카탈로그가 로드되지 않음' },
  dFeaturesOk: { en: '{count} of {all} features on; no failure notice this session', he: '{count} מתוך {all} שכלולים פעילים; אין התראת כשל בסשן הזה', es: '{count} de {all} funciones activas; ningún aviso de fallo en esta sesión', fr: '{count} fonctions sur {all} actives ; aucun avis d’échec dans cette session', ru: 'включено {count} из {all} функций; уведомлений о сбоях в этой сессии нет', zh: '已开启 {count}/{all} 个功能；本次会话无失败通知', ja: '{count}/{all} 機能オン。このセッションでは失敗通知なし', pt: '{count} de {all} recursos ativos; nenhum aviso de falha nesta sessão', de: '{count} von {all} Funktionen an; keine Fehlermeldung in dieser Sitzung', ko: '기능 {all}개 중 {count}개 켜짐; 이번 세션에 실패 알림 없음' },
  dFeaturesBad: { en: '{count} of {all} features on; failed this session: {ids}', he: '{count} מתוך {all} שכלולים פעילים; נכשלו בסשן הזה: {ids}', es: '{count} de {all} funciones activas; fallaron en esta sesión: {ids}', fr: '{count} fonctions sur {all} actives ; en échec dans cette session : {ids}', ru: 'включено {count} из {all} функций; сбой в этой сессии: {ids}', zh: '已开启 {count}/{all} 个功能；本次会话失败：{ids}', ja: '{count}/{all} 機能オン。このセッションで失敗：{ids}', pt: '{count} de {all} recursos ativos; falharam nesta sessão: {ids}', de: '{count} von {all} Funktionen an; in dieser Sitzung fehlgeschlagen: {ids}', ko: '기능 {all}개 중 {count}개 켜짐; 이번 세션에서 실패: {ids}' },
  dCommands: { en: 'not listable from a plugin; see /toolkitty', he: 'לא ניתן לרשימה מתוך תוסף; ראה /toolkitty', es: 'no se puede listar desde un plugin; mira /toolkitty', fr: 'non listable depuis un plugin ; voir /toolkitty', ru: 'из плагина список недоступен; смотрите /toolkitty', zh: '插件无法列出；请见 /toolkitty', ja: 'プラグインからは一覧できません。/toolkitty を参照してください', pt: 'não listável a partir de um plugin; veja /toolkitty', de: 'von einem Plugin aus nicht auflistbar; siehe /toolkitty', ko: '플러그인에서는 나열할 수 없음; /toolkitty 참고' },
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

type Ok = boolean | 'skipped'
type Row = { id: string; arg?: string; ok: Ok; detail: string }
type Outcome = { ok: Ok; detail: string }
type State = { rows: Row[]; running: boolean; withModel: boolean }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'selftest' } as const, { rows: [], running: false, withModel: false } as State) as unknown as Atom<State>

/** The notification centre's value: the same ref core.ts writes through notice(); read here for failure notices. */
const notices = atom({ plugin: 'toolkitty', key: 'slot', id: 'notices' } as const, { items: [], unread: 0 } as Notices) as unknown as Atom<Notices>

export const feature: Feature = { id: 'selftest', title: T.title, description: T.description, defaultOn: true }

const PANE = 'selftest'
const AURORA_ID = 'aurora-backdrop'
/** Aurora's own slot, read for `wanted`: /aurora turns the backdrop off for the session while the switch stays on. */
const auroraSlot = atom({ plugin: 'toolkitty', key: 'slot', id: AURORA_ID } as const, { wanted: true } as { wanted: boolean }) as unknown as Atom<{ wanted: boolean }>
/** When this module was loaded: failure notices from before a reload are not this build's. */
const loadedAt = Date.now()

/*
 * Every pane the plugin registers. REFRESH it when a feature gains or loses a pane, from the hooks folder:
 *   grep -rhn "component: 'Pane', requestId:" features/*.tsx register.tsx
 * and resolve any constant (`requestId: PANE`) to its `const PANE = '...'` in the same file.
 * The four toolkitty-* ids come from register.tsx (the switchboard, detail, notices and home panes).
 */
const PANES: readonly string[] = [
  'toolkitty',
  'toolkitty-detail',
  'toolkitty-notices',
  'toolkitty-home',
  'advisor',
  'agent-profiler',
  'agents-monitor',
  'aquarium',
  'bash-log',
  'buddy',
  'budget-guard',
  'context-doctor',
  'correction-rules',
  'decision-ledger',
  'diff-review',
  'error-detective',
  'files-touched',
  'goal-tracker',
  'handoff',
  'heatmap',
  'incident-card',
  'incidents',
  'monday-report',
  'notes',
  'onboarding',
  'profiles',
  'receipt',
  'savings',
  'session-finder',
  'task-board',
  'themes',
  'turn-history',
  'wrapped',
  'achievements',
  'share-cards',
  'efficiency',
  'safety-receipt',
  'demo',
  'toolkitty-perf',
  'toolkitty-exports',
  'toolkitty-share',
  PANE,
]

/** The whole run should stay near 10 s: past this many ms into it, the remaining checks are skipped. */
const BUDGET_MS = 9000
/** How long one pane open (or close) may take before it counts as no answer. */
const PANE_CAP_MS = 1500
/** How long any other check may take. */
const STEP_CAP_MS = 3000
const PROC_TIMEOUT_MS = 5000
const MODEL_CAP_MS = 15000

/** Words (in the five languages) of the "feature failed" notice register.tsx words as "Toolkitty: feature X failed: ...". */
const FAIL_WORDS = /failed|נכשל|falló|échoué|сбой/i
const MISSING = /ENOENT|not found|not recognized|cannot find|no such file|is not installed/i

/** The catalogue of features, given by register.tsx at load (this file cannot import index.ts: that would be circular). */
let catalog: Feature[] = []

export function setCatalog(list: Feature[]): void {
  catalog = list
}

// ---------- small helpers ----------

function errorText(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return text.slice(0, 200)
}

/** The engine's reason, verbatim; a fixed phrase when it gave none. */
function reasonOf(value: unknown): string {
  return typeof value === 'string' && value !== '' ? value : t(T.dNoReason)
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').trim().slice(0, 120)
}

function tally(rows: readonly Row[]): { ok: number; failed: number; skipped: number } {
  let ok = 0
  let failed = 0
  let skipped = 0
  for (const row of rows) {
    if (row.ok === true) ok += 1
    else if (row.ok === false) failed += 1
    else skipped += 1
  }
  return { ok, failed, skipped }
}

function countsText(rows: readonly Row[]): string {
  const c = tally(rows)
  return t(T.counts, { ok: c.ok, failed: c.failed, skipped: c.skipped })
}

function nameOf(row: Row): string {
  const arg = row.arg ?? ''
  switch (row.id) {
    case 'surfaces':
      return t(T.nSurfaces)
    case 'pane':
      return t(T.nPane, { id: arg })
    case 'backdrop':
      return t(T.nBackdrop)
    case 'place':
      return t(T.nPlace)
    case 'notify':
      return t(T.nNotify)
    case 'toast':
      return t(T.nToast)
    case 'audio':
      return t(T.nAudio)
    case 'prompt':
      return t(T.nPrompt)
    case 'copy':
      return t(T.nCopy)
    case 'store':
      return t(T.nStore)
    case 'clock':
      return t(T.nClock)
    case 'proc':
      return t(T.nProc, { cmd: arg })
    case 'model':
      return t(T.nModel)
    case 'features':
      return t(T.nFeatures)
    case 'commands':
      return t(T.nCommands)
    default:
      return t(T.title)
  }
}

const mark = (ok: Ok): string => (ok === true ? '✓' : ok === false ? '✗' : '–')

/** The report as plain text: one line per check. */
function reportText(rows: readonly Row[]): string {
  const lines = rows.map(row => `${mark(row.ok)} ${nameOf(row)} — ${row.detail}`)
  return [`${t(T.reportTitle)}: ${countsText(rows)}`, ...lines].join('\n')
}

/**
 * Waits for `work`, but no longer than `ms`: the cap is a `$.clock.after` timer raced against it, cancelled afterwards.
 * A rejection of `work` is rethrown; one that comes after the cap is swallowed.
 */
async function capped<V>($: EngineInterface, work: Promise<V>, ms: number): Promise<{ done: true; value: V } | { done: false }> {
  const held: { timer?: { cancel: () => void } } = {}
  const limit = new Promise<{ done: false }>(resolve => {
    held.timer = $.clock.after(ms, () => resolve({ done: false }))
  })
  const finished = work.then(value => ({ done: true as const, value }))
  finished.catch(() => undefined)
  try {
    return await Promise.race([finished, limit])
  } finally {
    held.timer?.cancel()
  }
}

// ---------- the run ----------

type Ctx = {
  rows: Row[]
  startedAt: number
  surfaces: string[]
  /** Panes open before the run, by id, with whether they are drawn. */
  openPanes: Map<string, boolean>
}

/** Runs one check: capped, never throwing, then appended to the report (which redraws as it fills). */
async function step(
  $: EngineInterface,
  ctx: Ctx,
  id: string,
  arg: string | undefined,
  capMs: number,
  run: () => Promise<Outcome>,
): Promise<void> {
  let out: Outcome
  try {
    const used = (await $.clock.now()) - ctx.startedAt
    if (id !== 'model' && used > BUDGET_MS) {
      out = { ok: 'skipped', detail: t(T.dBudget, { s: BUDGET_MS / 1000 }) }
    } else {
      const r = await capped($, run(), capMs)
      out = r.done ? r.value : { ok: false, detail: t(T.dNoAnswer, { s: capMs / 1000 }) }
    }
  } catch (err) {
    out = { ok: false, detail: errorText(err) }
  }
  ctx.rows.push(arg === undefined ? { id, ok: out.ok, detail: out.detail } : { id, arg, ok: out.ok, detail: out.detail })
  const snapshot = ctx.rows.slice()
  await update($, state, s => ({ ...s, rows: snapshot }))
}

async function checkSurfaces($: EngineInterface, ctx: Ctx): Promise<Outcome> {
  const list = await $.session.surfaces()
  ctx.surfaces = [...list]
  if (list.length === 0) return { ok: false, detail: t(T.dNoSurface) }
  return { ok: true, detail: list.join(', ') }
}

async function checkPane($: EngineInterface, ctx: Ctx, id: string): Promise<Outcome> {
  const known = ctx.openPanes.get(id)
  // Opening again would retitle a pane the person has open: report it from the list instead.
  if (known !== undefined) return known ? { ok: true, detail: t(T.dAlreadyOpen) } : { ok: false, detail: t(T.dOpenUndrawn) }
  let outcome: Outcome
  try {
    const r = await capped($, $.ui.open({ id, title: t(T.reportTitle) }), PANE_CAP_MS)
    if (!r.done) outcome = { ok: false, detail: t(T.dNoAnswer, { s: PANE_CAP_MS / 1000 }) }
    else if (r.value.isPlaced) outcome = { ok: true, detail: t(T.dDrawn) }
    else outcome = { ok: false, detail: reasonOf(r.value.reason) }
  } catch (err) {
    outcome = { ok: false, detail: errorText(err) }
  }
  try {
    await capped($, $.ui.close({ id }), PANE_CAP_MS)
  } catch {
    // nothing left to close
  }
  return outcome
}

async function checkBackdrop($: EngineInterface, ctx: Ctx): Promise<Outcome> {
  if (!ctx.surfaces.includes('desktop')) return { ok: 'skipped', detail: t(T.dDesktopOnly) }
  const aurora = catalog.find(f => f.id === AURORA_ID)
  if (aurora !== undefined && (await isOn($, aurora)) && (await read($, auroraSlot)).wanted) {
    // Aurora is up (or trying): re-issue its own backdrop and report the surface's verdict without clearing it.
    const r = await setBackdrop($, { id: 'aurora', glass: { blur: 18, opacity: 0.5 } })
    return r.isDrawn ? { ok: true, detail: t(T.dDrawn) } : { ok: false, detail: reasonOf(r.reason) }
  }
  try {
    const r = await setBackdrop($, { id: 'selftest' })
    return r.isDrawn ? { ok: true, detail: t(T.dDrawn) } : { ok: false, detail: reasonOf(r.reason) }
  } finally {
    // Only reached when aurora is off or turned off by /aurora, so clearing leaves nothing of the person's behind.
    try {
      await clearBackdrop($)
    } catch {
      // the surface went away
    }
  }
}

async function checkPlace($: EngineInterface): Promise<Outcome> {
  const r = await $.ui.place({ id: 'selftest-row' })
  return r.isPlaced ? { ok: true, detail: t(T.dPlaced) } : { ok: false, detail: reasonOf(r.reason) }
}

async function checkNotify($: EngineInterface): Promise<Outcome> {
  const r = await $.ui.notify('Toolkitty self-test', { title: 'Toolkitty' })
  if (r.isSent) return { ok: true, detail: t(T.dSent, { channel: r.channel }) }
  const reason = reasonOf(r.reason)
  // A terminal notification channel is not there on the desktop or under -p: that is the setup, not a defect.
  const environmental = reason === 'disabled' || reason === 'no-channel' || reason === 'no-surface'
  return { ok: environmental ? 'skipped' : false, detail: reason }
}

async function checkToast($: EngineInterface): Promise<Outcome> {
  $.ui.toast('Toolkitty self-test')
  return { ok: true, detail: t(T.dToast) }
}

async function checkAudio($: EngineInterface): Promise<Outcome> {
  await $.audio.play({ asset: 'sounds/done.wav' })
  return { ok: true, detail: t(T.dAudio) }
}

async function checkCopy($: EngineInterface): Promise<Outcome> {
  const r = await $.ui.copy({ text: 'toolkitty selftest' })
  return r.isCopied ? { ok: true, detail: t(T.dCopied) } : { ok: false, detail: reasonOf(r.reason) }
}

async function checkStore($: EngineInterface): Promise<Outcome> {
  const stamp = await $.clock.now()
  await $.store.set('selftest:ping', stamp)
  const back = await $.store.get('selftest:ping')
  if (back === stamp) return { ok: true, detail: t(T.dStoreOk, { value: stamp }) }
  return { ok: false, detail: t(T.dStoreBad, { sent: stamp, got: String(back) }) }
}

async function checkClock($: EngineInterface): Promise<Outcome> {
  const first = await $.clock.now()
  const second = await $.clock.now()
  if (typeof first !== 'number' || !Number.isFinite(first) || first <= 0 || second < first) {
    return { ok: false, detail: t(T.dClockBad, { now: String(first) }) }
  }
  const fired = new Promise<boolean>(resolve => {
    $.clock.after(10, () => resolve(true))
  })
  const r = await capped($, fired, 2000)
  if (!r.done) return { ok: false, detail: t(T.dClockLate) }
  return { ok: true, detail: t(T.dClockOk, { iso: new Date(first).toISOString() }) }
}

async function checkProc($: EngineInterface, argv: string[]): Promise<Outcome> {
  try {
    const r = await $.process.run(argv, { timeoutMs: PROC_TIMEOUT_MS })
    if (r.exitCode === 0) return { ok: true, detail: firstLine(r.stdout) || firstLine(r.stderr) || 'exit 0' }
    if (r.exitCode === 127 || r.exitCode === 9009) return { ok: 'skipped', detail: t(T.dMissing) }
    return { ok: false, detail: t(T.dExit, { code: r.exitCode, err: firstLine(r.stderr) || firstLine(r.stdout) }) }
  } catch (err) {
    const message = errorText(err)
    // A missing program is the machine's setup, not a defect of the plugin.
    if (MISSING.test(message)) return { ok: 'skipped', detail: `${t(T.dMissing)} (${message})` }
    return { ok: false, detail: message }
  }
}

async function checkModel($: EngineInterface, withModel: boolean): Promise<Outcome> {
  if (!withModel) return { ok: 'skipped', detail: t(T.dModelSkip) }
  const r = await $.model.complete({ model: 'claude-haiku-5-5', prompt: 'Reply with the single word: ok', maxTokens: 16, timeoutMs: 12000 })
  if (r.isAnswered) return { ok: true, detail: t(T.dModelOk, { text: firstLine(r.text) }) }
  return { ok: false, detail: t(T.dModelNo, { reason: reasonOf(r.reason) }) }
}

async function checkFeatures($: EngineInterface): Promise<Outcome> {
  if (catalog.length === 0) return { ok: 'skipped', detail: t(T.dNoCatalog) }
  let active = 0
  for (const f of catalog) {
    if (await isOn($, f)) active += 1
  }
  // A feature failure is worded "Toolkitty: feature <id> failed: ..." in every language; match the id as a word.
  const failed: string[] = []
  const messages: string[] = []
  const n = await read($, notices)
  for (const item of n.items) {
    if (item.at < loadedAt) continue
    if (!/^Toolkitty\s?:/.test(item.text) || !FAIL_WORDS.test(item.text)) continue
    // The failing feature is the one the notice was filed under; the text may name others.
    const id = item.feature
    if (id !== undefined && !failed.includes(id)) failed.push(id)
    const line = item.text.replace(/^Toolkitty\s?:\s*/, '').slice(0, 160)
    if (!messages.includes(line)) messages.push(line)
  }
  if (failed.length > 0) {
    const ids = failed.join(', ') + ' — ' + messages.slice(0, 12).join(' | ')
    return { ok: false, detail: t(T.dFeaturesBad, { count: active, all: catalog.length, ids }) }
  }
  return { ok: true, detail: t(T.dFeaturesOk, { count: active, all: catalog.length }) }
}

async function runChecks($: EngineInterface, ctx: Ctx, withModel: boolean): Promise<void> {
  await step($, ctx, 'surfaces', undefined, STEP_CAP_MS, () => checkSurfaces($, ctx))

  let listed: readonly { id: string; isPlaced: boolean }[] = []
  try {
    listed = await $.ui.panes()
  } catch {
    listed = []
  }
  for (const pane of listed) ctx.openPanes.set(pane.id, pane.isPlaced)
  for (const id of PANES) {
    await step($, ctx, 'pane', id, 2 * PANE_CAP_MS + 500, () => checkPane($, ctx, id))
  }

  await step($, ctx, 'backdrop', undefined, STEP_CAP_MS, () => checkBackdrop($, ctx))
  await step($, ctx, 'place', undefined, STEP_CAP_MS, () => checkPlace($))
  await step($, ctx, 'notify', undefined, STEP_CAP_MS, () => checkNotify($))
  await step($, ctx, 'toast', undefined, STEP_CAP_MS, () => checkToast($))
  await step($, ctx, 'audio', undefined, STEP_CAP_MS, () => checkAudio($))
  await step($, ctx, 'prompt', undefined, STEP_CAP_MS, async () => ({ ok: 'skipped', detail: t(T.dPromptSkip) }))
  await step($, ctx, 'copy', undefined, STEP_CAP_MS, () => checkCopy($))
  await step($, ctx, 'store', undefined, STEP_CAP_MS, () => checkStore($))
  await step($, ctx, 'clock', undefined, STEP_CAP_MS, () => checkClock($))
  await step($, ctx, 'proc', 'git --version', PROC_TIMEOUT_MS + 500, () => checkProc($, ['git', '--version']))
  await step($, ctx, 'proc', 'node --version', PROC_TIMEOUT_MS + 500, () => checkProc($, ['node', '--version']))
  await step($, ctx, 'proc', 'gh --version', PROC_TIMEOUT_MS + 500, () => checkProc($, ['gh', '--version']))
  await step($, ctx, 'model', undefined, MODEL_CAP_MS, () => checkModel($, withModel))
  await step($, ctx, 'features', undefined, STEP_CAP_MS, () => checkFeatures($))
  await step($, ctx, 'commands', undefined, STEP_CAP_MS, async () => ({ ok: 'skipped', detail: t(T.dCommands) }))
}

/** Opens (or brings back) the report pane. */
async function showPane($: EngineInterface): Promise<void> {
  try {
    await $.ui.open({ id: PANE, title: t(T.reportTitle), focus: true, closeOnEscape: true })
  } catch {
    // no surface to draw it
  }
}

/** Runs the whole suite; a run already going is not started twice. Returns the finished rows. */
async function runSuite($: EngineInterface, withModel: boolean): Promise<Row[]> {
  const before = await read($, state)
  if (before.running) return before.rows
  const startedAt = await $.clock.now()
  await update($, state, () => ({ rows: [], running: true, withModel }))
  const ctx: Ctx = { rows: [], startedAt, surfaces: [], openPanes: new Map() }
  try {
    await runChecks($, ctx, withModel)
  } catch (err) {
    ctx.rows.push({ id: 'internal', ok: false, detail: errorText(err) })
  }
  const finished = ctx.rows.slice()
  await update($, state, () => ({ rows: finished, running: false, withModel }))
  // Opening and closing the other panes may have moved the person's tab: bring the report back.
  await showPane($)
  return finished
}

async function copyReport($: EngineInterface): Promise<string> {
  const s = await read($, state)
  if (s.rows.length === 0) return t(T.noReport)
  try {
    const r = await $.ui.copy({ text: reportText(s.rows) })
    return r.isCopied ? t(T.copied) : t(T.copyFail, { reason: reasonOf(r.reason) })
  } catch (err) {
    return t(T.copyFail, { reason: errorText(err) })
  }
}

async function pressCopy($: EngineInterface): Promise<void> {
  const text = await copyReport($)
  await notice($, 'info', text, feature.id, { immediate: true })
}

// ---------- handlers ----------

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'selftest', description: t(T.cmd) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'selftest', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

/** The band chip: only after a run with failures. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const s = await read($, state)
  if (s.running) return null
  const failed = tally(s.rows).failed
  if (failed === 0) return null
  return { text: t(T.chip, { n: failed }), level: 'warn', icon: ICONS.setup }
}

export function register(on: On) {
  on('command.run', { command: 'selftest' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const arg = (e.args ?? '').trim().toLowerCase()
    if (arg === 'copy') return { text: await copyReport($) }
    if (arg !== '' && arg !== 'model') return { text: t(T.usage) }
    await showPane($)
    const rows = await runSuite($, arg === 'model')
    const failedNames = rows.filter(row => row.ok === false).map(row => nameOf(row))
    const list = failedNames.slice(0, 5).join(', ') + (failedNames.length > 5 ? ', …' : '')
    return { text: t(T.summary, { counts: countsText(rows) }) + (failedNames.length > 0 ? t(T.failedList, { list }) : '') }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Box flexDirection="column">{emptyState($, e, t(T.off))}</Box>
    const s = await read($, state)
    const failed = tally(s.rows).failed
    const actions: HeaderAction[] = [
      { key: 'run', label: t(T.actRun), onPress: () => runSuite($, false) },
      { key: 'copy', label: t(T.actCopy), onPress: () => pressCopy($) },
      { key: 'model', label: t(T.actModel), onPress: () => runSuite($, true) },
    ]
    const header = paneHeader($, e, {
      title: t(T.title),
      status: s.running ? t(T.running) : countsText(s.rows),
      level: failed > 0 ? 'warn' : 'ok',
      icon: ICONS.setup,
      actions,
    })
    if (s.rows.length === 0 && !s.running) {
      return (
        <Box flexDirection="column">
          {header}
          {emptyState($, e, T.emptyText, T.emptyHint)}
        </Box>
      )
    }
    const body: RenderElement[] = []
    let group = ''
    for (let i = 0; i < s.rows.length; i += 1) {
      const row = s.rows[i]
      if (row === undefined) continue
      const g = row.id === 'pane' ? 'panes' : 'engine'
      if (g !== group) {
        group = g
        body.push(<Box key={`s-${i}`}>{sectionTitle($, e, t(g === 'panes' ? T.sPanes : T.sEngine))}</Box>)
      }
      body.push(
        <Box key={`r-${i}`}>
          {listRow($, e, { key: `row-${i}`, left: mark(row.ok), text: nameOf(row), right: row.detail, level: row.ok === false ? 'alert' : 'ok' })}
        </Box>,
      )
    }
    return (
      <Box flexDirection="column">
        {header}
        {body}
        <Box marginTop={1}>
          <Text dimColor size="footnote">
            {t(T.hint)}
          </Text>
        </Box>
      </Box>
    )
  })
}
