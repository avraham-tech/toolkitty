import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { BandInput, BandLine, Feature, Input, Output, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import type { Savings } from '../shared'
import { current, publish, retract, retractAll } from '../signals'
import { emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Error detective', he: 'בלש שגיאות', es: 'Detective de errores', fr: "Détective d'erreurs", ru: 'Детектив ошибок', zh: '错误侦探', ja: 'エラー探偵', pt: 'Detetive de erros', de: 'Fehlerdetektiv', ko: '오류 탐정' },
  description: {
    en: 'Groups repeated failures by signature (same command, same error), spots fixes that change nothing and loops, warns you and nudges the model to investigate the cause before editing again. /errors lists the patterns.',
    he: 'מקבץ כשלונות חוזרים לפי חתימה (אותה פקודה, אותה שגיאה), מזהה תיקונים שלא משנים דבר ולולאות, מתריע ודוחף את המודל לחקור את הסיבה לפני עוד עריכה. /errors מציג את הדפוסים.',
    es: 'Agrupa los fallos repetidos por firma (mismo comando, mismo error), detecta arreglos que no cambian nada y bucles, te avisa y empuja al modelo a investigar la causa antes de editar de nuevo. /errors lista los patrones.',
    fr: "Regroupe les échecs répétés par signature (même commande, même erreur), repère les corrections sans effet et les boucles, vous prévient et pousse le modèle à chercher la cause avant de modifier à nouveau. /errors liste les motifs.",
    ru: 'Группирует повторяющиеся сбои по сигнатуре (та же команда, та же ошибка), замечает правки, ничего не меняющие, и зацикливание, предупреждает вас и подталкивает модель искать причину до новой правки. /errors показывает шаблоны.',
    zh: '按签名（相同命令、相同错误）对重复失败分组，发现无效的修复和循环，向你发出警告，并提示模型在再次编辑前先排查原因。/errors 列出这些模式。',
    ja: '繰り返しの失敗をシグネチャ（同じコマンド、同じエラー）ごとにまとめ、効果のない修正やループを検出して警告し、再び編集する前に原因を調べるようモデルに促します。/errors でパターンを一覧表示します。',
    pt: 'Agrupa falhas repetidas por assinatura (mesmo comando, mesmo erro), detecta correções que não mudam nada e loops, avisa você e orienta o modelo a investigar a causa antes de editar de novo. /errors lista os padrões.',
    de: 'Gruppiert wiederholte Fehler nach Signatur (gleicher Befehl, gleicher Fehler), erkennt wirkungslose Fixes und Schleifen, warnt dich und weist das Modell an, die Ursache zu untersuchen, bevor es erneut editiert. /errors listet die Muster auf.',
    ko: '반복되는 실패를 시그니처(같은 명령, 같은 오류)별로 묶고, 효과 없는 수정과 루프를 찾아 경고하며, 다시 편집하기 전에 원인을 먼저 조사하도록 모델을 유도합니다. /errors로 패턴 목록을 볼 수 있습니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty パネルでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; schalte sie im /toolkitty-Bereich ein', ko: '이 기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요' },
  cmdDesc: { en: 'Shows repeated failures and what was tried', he: 'מציג כשלונות חוזרים ומה כבר נוסה', es: 'Muestra los fallos repetidos y lo que se probó', fr: 'Affiche les échecs répétés et ce qui a été essayé', ru: 'Показывает повторяющиеся сбои и что уже пробовали', zh: '显示重复失败以及已尝试的做法', ja: '繰り返しの失敗と試したことを表示します', pt: 'Mostra falhas repetidas e o que foi tentado', de: 'Zeigt wiederholte Fehler und was versucht wurde', ko: '반복된 실패와 시도한 내용을 보여줍니다' },
  opened: { en: 'Opened the error detective.', he: 'בלש השגיאות נפתח.', es: 'Detective de errores abierto.', fr: "Détective d'erreurs ouvert.", ru: 'Детектив ошибок открыт.', zh: '已打开错误侦探。', ja: 'エラー探偵を開きました。', pt: 'Detetive de erros aberto.', de: 'Fehlerdetektiv geöffnet.', ko: '오류 탐정을 열었습니다.' },
  paneTitle: { en: 'Error detective', he: 'בלש שגיאות', es: 'Detective de errores', fr: "Détective d'erreurs", ru: 'Детектив ошибок', zh: '错误侦探', ja: 'エラー探偵', pt: 'Detetive de erros', de: 'Fehlerdetektiv', ko: '오류 탐정' },
  paneOff: { en: 'The error detective is off. Turn it on in the /toolkitty pane.', he: 'בלש השגיאות כבוי. הפעל אותו בלוח /toolkitty.', es: 'El detective de errores está desactivado. Actívalo en el panel /toolkitty.', fr: "Le détective d'erreurs est désactivé. Activez-le dans le panneau /toolkitty.", ru: 'Детектив ошибок отключён. Включите его в панели /toolkitty.', zh: '错误侦探已关闭。请在 /toolkitty 面板中开启。', ja: 'エラー探偵はオフです。/toolkitty パネルでオンにしてください。', pt: 'O detetive de erros está desativado. Ative no painel /toolkitty.', de: 'Der Fehlerdetektiv ist aus. Schalte ihn im /toolkitty-Bereich ein.', ko: '오류 탐정이 꺼져 있습니다. /toolkitty 패널에서 켜세요.' },
  patternsOne: { en: '1 pattern', he: 'דפוס אחד', es: '1 patrón', fr: '1 motif', ru: '1 шаблон', zh: '1 个模式', ja: '1 パターン', pt: '1 padrão', de: '1 Muster', ko: '패턴 1개' },
  patternsMany: { en: '{n} patterns', he: '{n} דפוסים', es: '{n} patrones', fr: '{n} motifs', ru: 'шаблонов: {n}', zh: '{n} 个模式', ja: '{n} パターン', pt: '{n} padrões', de: '{n} Muster', ko: '패턴 {n}개' },
  emptyText: { en: 'No repeated failures in this session.', he: 'אין כשלונות חוזרים בסשן הזה.', es: 'No hay fallos repetidos en esta sesión.', fr: 'Aucun échec répété dans cette session.', ru: 'В этой сессии нет повторяющихся сбоев.', zh: '本会话没有重复失败。', ja: 'このセッションに繰り返しの失敗はありません。', pt: 'Nenhuma falha repetida nesta sessão.', de: 'Keine wiederholten Fehler in dieser Sitzung.', ko: '이번 세션에는 반복된 실패가 없습니다.' },
  emptyHint: {
    en: 'The same error three times, two edits that did not change it, or a call repeated four times will be listed here.',
    he: 'אותה שגיאה שלוש פעמים, שתי עריכות שלא שינו אותה, או קריאה שחזרה ארבע פעמים יופיעו כאן.',
    es: 'Aquí aparecerán el mismo error tres veces, dos ediciones que no lo cambiaron o una llamada repetida cuatro veces.',
    fr: 'La même erreur trois fois, deux modifications sans effet ou un appel répété quatre fois seront listés ici.',
    ru: 'Здесь появятся: одна и та же ошибка три раза, две правки без эффекта или вызов, повторённый четыре раза.',
    zh: '同一错误出现三次、两次编辑都没能改变它，或同一调用重复四次，都会在这里列出。',
    ja: '同じエラーが 3 回、2 回の編集でも変わらなかった場合、または同じ呼び出しが 4 回繰り返された場合に、ここに一覧表示されます。',
    pt: 'O mesmo erro três vezes, duas edições que não o mudaram ou uma chamada repetida quatro vezes serão listados aqui.',
    de: 'Derselbe Fehler dreimal, zwei Änderungen ohne Wirkung oder ein viermal wiederholter Aufruf werden hier aufgelistet.',
    ko: '같은 오류가 세 번 나오거나, 두 번 수정해도 바뀌지 않거나, 같은 호출이 네 번 반복되면 여기에 표시됩니다.',
  },
  statusOpen: { en: 'open', he: 'פתוח', es: 'abierto', fr: 'ouvert', ru: 'открыт', zh: '未解决', ja: '未解決', pt: 'aberto', de: 'offen', ko: '열림' },
  statusResolved: { en: 'resolved', he: 'נפתר', es: 'resuelto', fr: 'résolu', ru: 'решён', zh: '已解决', ja: '解決済み', pt: 'resolvido', de: 'gelöst', ko: '해결됨' },
  patRepeated: { en: 'Repeated failure', he: 'כשלון חוזר', es: 'Fallo repetido', fr: 'Échec répété', ru: 'Повторяющийся сбой', zh: '重复失败', ja: '繰り返しの失敗', pt: 'Falha repetida', de: 'Wiederholter Fehler', ko: '반복 실패' },
  patIneffective: { en: 'Ineffective fixes', he: 'תיקונים לא יעילים', es: 'Arreglos ineficaces', fr: 'Corrections sans effet', ru: 'Правки без эффекта', zh: '无效的修复', ja: '効果のない修正', pt: 'Correções ineficazes', de: 'Wirkungslose Fixes', ko: '효과 없는 수정' },
  patLoop: { en: 'Unproductive loop', he: 'לולאה לא יעילה', es: 'Bucle improductivo', fr: 'Boucle improductive', ru: 'Бесплодный цикл', zh: '无效循环', ja: '非生産的なループ', pt: 'Loop improdutivo', de: 'Unproduktive Schleife', ko: '비생산적 루프' },
  noticeRepeated: {
    en: 'Repeated failure: "{what}" failed {n} times with the same error',
    he: 'כשלון חוזר: "{what}" נכשלה {n} פעמים עם אותה שגיאה',
    es: 'Fallo repetido: "{what}" falló {n} veces con el mismo error',
    fr: 'Échec répété : « {what} » a échoué {n} fois avec la même erreur',
    ru: 'Повторяющийся сбой: «{what}» упала {n} раз с той же ошибкой',
    zh: '重复失败："{what}" 因同一错误失败了 {n} 次',
    ja: '繰り返しの失敗: "{what}" が同じエラーで {n} 回失敗',
    pt: 'Falha repetida: "{what}" falhou {n} vezes com o mesmo erro',
    de: 'Wiederholter Fehler: "{what}" ist {n}-mal mit demselben Fehler fehlgeschlagen',
    ko: '반복 실패: "{what}"이(가) 같은 오류로 {n}번 실패',
  },
  noticeIneffective: {
    en: 'Ineffective fixes: {n} edits did not change the error of "{what}"',
    he: 'תיקונים לא יעילים: {n} עריכות לא שינו את השגיאה של "{what}"',
    es: 'Arreglos ineficaces: {n} ediciones no cambiaron el error de "{what}"',
    fr: "Corrections sans effet : {n} modifications n'ont pas changé l'erreur de « {what} »",
    ru: 'Правки без эффекта: {n} правок не изменили ошибку «{what}»',
    zh: '无效的修复：{n} 次编辑都没有改变 "{what}" 的错误',
    ja: '効果のない修正: {n} 回の編集で "{what}" のエラーは変わりませんでした',
    pt: 'Correções ineficazes: {n} edições não mudaram o erro de "{what}"',
    de: 'Wirkungslose Fixes: {n} Änderungen haben den Fehler von "{what}" nicht verändert',
    ko: '효과 없는 수정: {n}번 수정해도 "{what}"의 오류가 바뀌지 않음',
  },
  noticeLoop: {
    en: 'Unproductive loop: "{what}" repeated {n} times',
    he: 'לולאה לא יעילה: "{what}" חזרה {n} פעמים',
    es: 'Bucle improductivo: "{what}" repetido {n} veces',
    fr: 'Boucle improductive : « {what} » répété {n} fois',
    ru: 'Бесплодный цикл: «{what}» повторено {n} раз',
    zh: '无效循环："{what}" 重复了 {n} 次',
    ja: '非生産的なループ: "{what}" が {n} 回繰り返されました',
    pt: 'Loop improdutivo: "{what}" repetido {n} vezes',
    de: 'Unproduktive Schleife: "{what}" wurde {n}-mal wiederholt',
    ko: '비생산적 루프: "{what}"이(가) {n}번 반복됨',
  },
  chip: { en: '↻ {n}× same error', he: '↻ {n}× אותה שגיאה', es: '↻ {n}× mismo error', fr: '↻ {n}× même erreur', ru: '↻ {n}× та же ошибка', zh: '↻ 同一错误 {n} 次', ja: '↻ 同じエラー {n} 回', pt: '↻ {n}× mesmo erro', de: '↻ {n}× gleicher Fehler', ko: '↻ 같은 오류 {n}회' },
  band: { en: '↻ same error {n}×: {what}', he: '↻ אותה שגיאה {n}×: {what}', es: '↻ mismo error {n}×: {what}', fr: '↻ même erreur {n}× : {what}', ru: '↻ та же ошибка {n}×: {what}', zh: '↻ 同一错误 {n} 次：{what}', ja: '↻ 同じエラー {n} 回: {what}', pt: '↻ mesmo erro {n}×: {what}', de: '↻ gleicher Fehler {n}×: {what}', ko: '↻ 같은 오류 {n}회: {what}' },
  show: { en: 'Show pattern', he: 'הצג דפוס', es: 'Mostrar patrón', fr: 'Afficher le motif', ru: 'Показать шаблон', zh: '显示模式', ja: 'パターンを表示', pt: 'Mostrar padrão', de: 'Muster anzeigen', ko: '패턴 보기' },
  suggest: { en: 'Suggest alternative', he: 'הצע חלופה', es: 'Sugerir alternativa', fr: 'Suggérer une alternative', ru: 'Предложить альтернативу', zh: '建议替代方案', ja: '代替案を提案', pt: 'Sugerir alternativa', de: 'Alternative vorschlagen', ko: '대안 제안' },
  clear: { en: 'Clear', he: 'נקה', es: 'Borrar', fr: 'Effacer', ru: 'Очистить', zh: '清除', ja: 'クリア', pt: 'Limpar', de: 'Löschen', ko: '지우기' },
  cleared: { en: 'Cleared the error patterns.', he: 'דפוסי השגיאות נוקו.', es: 'Patrones de error borrados.', fr: "Motifs d'erreur effacés.", ru: 'Шаблоны ошибок очищены.', zh: '已清除错误模式。', ja: 'エラーパターンをクリアしました。', pt: 'Padrões de erro limpos.', de: 'Fehlermuster gelöscht.', ko: '오류 패턴을 지웠습니다.' },
  copied: { en: 'Copied the pattern summary', he: 'סיכום הדפוס הועתק', es: 'Resumen del patrón copiado', fr: 'Résumé du motif copié', ru: 'Описание шаблона скопировано', zh: '已复制模式摘要', ja: 'パターンの要約をコピーしました', pt: 'Resumo do padrão copiado', de: 'Musterzusammenfassung kopiert', ko: '패턴 요약을 복사했습니다' },
  copyFailed: { en: 'Could not copy', he: 'ההעתקה נכשלה', es: 'No se pudo copiar', fr: 'Copie impossible', ru: 'Не удалось скопировать', zh: '无法复制', ja: 'コピーできませんでした', pt: 'Não foi possível copiar', de: 'Kopieren nicht möglich', ko: '복사할 수 없습니다' },
  nothing: { en: 'No pattern to use yet.', he: 'עדיין אין דפוס לשימוש.', es: 'Aún no hay ningún patrón.', fr: "Aucun motif pour l'instant.", ru: 'Пока нет шаблона.', zh: '暂无可用的模式。', ja: '使えるパターンはまだありません。', pt: 'Ainda não há padrão para usar.', de: 'Noch kein Muster verfügbar.', ko: '아직 사용할 패턴이 없습니다.' },
  filled: { en: 'Put an investigation prompt in the input box.', he: 'הוכנסה בקשת חקירה לתיבת הכתיבה.', es: 'Se puso un prompt de investigación en el cuadro de entrada.', fr: "Une demande d'investigation a été placée dans la zone de saisie.", ru: 'Запрос на расследование помещён в поле ввода.', zh: '已将调查提示放入输入框。', ja: '調査用のプロンプトを入力欄に入れました。', pt: 'Prompt de investigação colocado na caixa de entrada.', de: 'Ein Untersuchungs-Prompt wurde ins Eingabefeld gesetzt.', ko: '조사용 프롬프트를 입력창에 넣었습니다.' },
  notFilled: { en: 'Could not fill the input box.', he: 'לא ניתן למלא את תיבת הכתיבה.', es: 'No se pudo rellenar el cuadro de entrada.', fr: 'Impossible de remplir la zone de saisie.', ru: 'Не удалось заполнить поле ввода.', zh: '无法填充输入框。', ja: '入力欄に入力できませんでした。', pt: 'Não foi possível preencher a caixa de entrada.', de: 'Das Eingabefeld konnte nicht befüllt werden.', ko: '입력창을 채울 수 없습니다.' },
  lCall: { en: 'Call: {call}', he: 'קריאה: {call}', es: 'Llamada: {call}', fr: 'Appel : {call}', ru: 'Вызов: {call}', zh: '调用：{call}', ja: '呼び出し: {call}', pt: 'Chamada: {call}', de: 'Aufruf: {call}', ko: '호출: {call}' },
  lError: { en: 'Error: {error}', he: 'שגיאה: {error}', es: 'Error: {error}', fr: 'Erreur : {error}', ru: 'Ошибка: {error}', zh: '错误：{error}', ja: 'エラー: {error}', pt: 'Erro: {error}', de: 'Fehler: {error}', ko: '오류: {error}' },
  lNoError: { en: '(no error: the same call again and again)', he: '(בלי שגיאה: אותה קריאה שוב ושוב)', es: '(sin error: la misma llamada una y otra vez)', fr: '(pas d\'erreur : le même appel encore et encore)', ru: '(без ошибки: один и тот же вызов снова и снова)', zh: '（无错误：同一调用反复出现）', ja: '（エラーなし: 同じ呼び出しの繰り返し）', pt: '(sem erro: a mesma chamada várias vezes)', de: '(kein Fehler: derselbe Aufruf immer wieder)', ko: '(오류 없음: 같은 호출이 계속 반복됨)' },
  lPatterns: { en: 'Detected: {patterns}', he: 'זוהה: {patterns}', es: 'Detectado: {patterns}', fr: 'Détecté : {patterns}', ru: 'Обнаружено: {patterns}', zh: '检测到：{patterns}', ja: '検出: {patterns}', pt: 'Detectado: {patterns}', de: 'Erkannt: {patterns}', ko: '감지됨: {patterns}' },
  lSeen: { en: 'Seen {n} times, first {first} ago, last {last} ago', he: 'נצפה {n} פעמים, לראשונה לפני {first}, לאחרונה לפני {last}', es: 'Visto {n} veces, la primera hace {first}, la última hace {last}', fr: 'Vu {n} fois, la première il y a {first}, la dernière il y a {last}', ru: 'Замечено {n} раз, впервые {first} назад, в последний раз {last} назад', zh: '出现 {n} 次，首次在 {first}前，最近在 {last}前', ja: '{n} 回発生、初回は {first}前、直近は {last}前', pt: 'Visto {n} vezes, primeira há {first}, última há {last}', de: '{n}-mal aufgetreten, zuerst vor {first}, zuletzt vor {last}', ko: '{n}회 발생, 처음은 {first} 전, 마지막은 {last} 전' },
  lAttempts: { en: 'Edited between failures: {files} ({cycles} edit-then-fail cycles)', he: 'נערכו בין הכשלונות: {files} ({cycles} מחזורי עריכה וכשלון)', es: 'Editado entre fallos: {files} ({cycles} ciclos de editar y fallar)', fr: 'Modifié entre les échecs : {files} ({cycles} cycles modification puis échec)', ru: 'Правки между сбоями: {files} ({cycles} циклов правка-сбой)', zh: '失败之间有过编辑：{files}（{cycles} 次编辑后仍失败的循环）', ja: '失敗の合間に編集: {files}（編集して失敗するサイクル {cycles} 回）', pt: 'Editado entre as falhas: {files} ({cycles} ciclos de edição seguida de falha)', de: 'Zwischen den Fehlern bearbeitet: {files} ({cycles} Zyklen aus Änderung und erneutem Fehler)', ko: '실패 사이에 수정됨: {files} (수정 후 실패 사이클 {cycles}회)' },
  lNoAttempts: { en: 'No edits between failures: it was only retried.', he: 'לא היו עריכות בין הכשלונות: רק ניסו שוב.', es: 'Sin ediciones entre fallos: solo se reintentó.', fr: "Aucune modification entre les échecs : seulement des nouvelles tentatives.", ru: 'Между сбоями правок не было: только повторы.', zh: '失败之间没有编辑：只是重试。', ja: '失敗の合間に編集なし: 再試行のみ。', pt: 'Nenhuma edição entre as falhas: apenas tentou de novo.', de: 'Keine Änderungen zwischen den Fehlern: es wurde nur wiederholt.', ko: '실패 사이에 수정 없음: 재시도만 했습니다.' },
  lRuledOut: { en: 'Ruled out: the same command and the same change.', he: 'נשלל: אותה פקודה ואותו שינוי.', es: 'Descartado: el mismo comando y el mismo cambio.', fr: 'Écarté : la même commande et la même modification.', ru: 'Исключено: та же команда и та же правка.', zh: '已排除：相同的命令和相同的改动。', ja: '除外: 同じコマンドと同じ変更。', pt: 'Descartado: o mesmo comando e a mesma alteração.', de: 'Ausgeschlossen: derselbe Befehl und dieselbe Änderung.', ko: '제외됨: 같은 명령과 같은 변경.' },
  lSuggestion: {
    en: 'Suggestion: investigate the cause before another edit: read the whole error, check what the failing code receives and the environment.',
    he: 'הצעה: חקור את הסיבה לפני עוד עריכה: קרא את כל השגיאה, בדוק מה הקוד שנכשל מקבל ואת הסביבה.',
    es: 'Sugerencia: investiga la causa antes de otra edición: lee el error completo, comprueba qué recibe el código que falla y el entorno.',
    fr: "Suggestion : cherchez la cause avant une autre modification : lisez toute l'erreur, vérifiez ce que reçoit le code en échec et l'environnement.",
    ru: 'Совет: найдите причину до новой правки: прочитайте ошибку целиком, проверьте, что получает падающий код, и окружение.',
    zh: '建议：再次编辑前先排查原因：读完整个错误，检查出错代码收到的内容以及运行环境。',
    ja: '提案: 再び編集する前に原因を調べてください。エラー全文を読み、失敗したコードが受け取る値と環境を確認します。',
    pt: 'Sugestão: investigue a causa antes de editar de novo: leia o erro inteiro, verifique o que o código com falha recebe e o ambiente.',
    de: 'Vorschlag: Untersuche die Ursache, bevor du erneut editierst: lies den ganzen Fehler, prüfe, was der fehlerhafte Code erhält, und die Umgebung.',
    ko: '제안: 다시 수정하기 전에 원인을 조사하세요. 오류 전문을 읽고, 실패한 코드가 받는 값과 환경을 확인하세요.',
  },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  summary: {
    en: 'Pattern: {patterns}\nCall: {call}\nError: {error}\nSeen {n} times (first {first} ago, last {last} ago), {status}\nEdited between failures: {files}',
    he: 'דפוס: {patterns}\nקריאה: {call}\nשגיאה: {error}\nנצפה {n} פעמים (לראשונה לפני {first}, לאחרונה לפני {last}), {status}\nנערכו בין הכשלונות: {files}',
    es: 'Patrón: {patterns}\nLlamada: {call}\nError: {error}\nVisto {n} veces (la primera hace {first}, la última hace {last}), {status}\nEditado entre fallos: {files}',
    fr: 'Motif : {patterns}\nAppel : {call}\nErreur : {error}\nVu {n} fois (la première il y a {first}, la dernière il y a {last}), {status}\nModifié entre les échecs : {files}',
    ru: 'Шаблон: {patterns}\nВызов: {call}\nОшибка: {error}\nЗамечено {n} раз (впервые {first} назад, в последний раз {last} назад), {status}\nПравки между сбоями: {files}',
    zh: '模式：{patterns}\n调用：{call}\n错误：{error}\n出现 {n} 次（首次在 {first}前，最近在 {last}前），{status}\n失败之间的编辑：{files}',
    ja: 'パターン: {patterns}\n呼び出し: {call}\nエラー: {error}\n{n} 回発生（初回は {first}前、直近は {last}前）、{status}\n失敗の合間の編集: {files}',
    pt: 'Padrão: {patterns}\nChamada: {call}\nErro: {error}\nVisto {n} vezes (primeira há {first}, última há {last}), {status}\nEditado entre as falhas: {files}',
    de: 'Muster: {patterns}\nAufruf: {call}\nFehler: {error}\n{n}-mal aufgetreten (zuerst vor {first}, zuletzt vor {last}), {status}\nZwischen den Fehlern bearbeitet: {files}',
    ko: '패턴: {patterns}\n호출: {call}\n오류: {error}\n{n}회 발생 (처음 {first} 전, 마지막 {last} 전), {status}\n실패 사이 수정: {files}',
  },
  none: { en: 'none', he: 'אין', es: 'ninguno', fr: 'aucun', ru: 'нет', zh: '无', ja: 'なし', pt: 'nenhum', de: 'keine', ko: '없음' },
} as const

type Flag = 'repeated' | 'ineffective' | 'loop'

type Rec = {
  id: string
  /** tool + normalized target: what "the same command" means for resolving */
  callKey: string
  /** fingerprint of the exact input, for the identical-call window */
  fp: string
  tool: string
  /** normalized target and error head: the signature */
  target: string
  head: string
  /** as seen, clipped: for the person and the prompt */
  shown: string
  headShown: string
  count: number
  repeats: number
  cycles: number
  first: number
  last: number
  /** order of the last update (the clock can stand still): newest first sorts by it */
  seq: number
  files: string[]
  flags: Flag[]
  resolved: boolean
  tokens: number
  /** when the nudge was last armed (the 10 minute throttle) and whether it is live now */
  armedAt: number
  live: boolean
  noticedAt: number
}

type State = {
  recs: Record<string, Rec>
  tick: number
  pendingEdits: string[]
  sinceEdit: number
  recent: string[]
  expanded: string | null
}

const empty = (): State => ({ recs: {}, tick: 0, pendingEdits: [], sinceEdit: 0, recent: [], expanded: null })

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'error-detective' } as const, empty()) as unknown as Atom<State>

const savings = atom({ plugin: 'toolkitty', key: 'slot', id: 'savings' } as const, { tokens: 0, usd: 0, byFeature: {}, leaks: {} } as Savings) as unknown as Atom<Savings>

export const feature: Feature = {
  id: 'error-detective',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const SECTION_ID = 'toolkitty:error-detective'
const PANE_ID = 'error-detective'
const RECENT = 12
const EDIT_SPAN = 8
const MAX_RECS = 40
const NOTICE_MS = 5 * 60_000
const NUDGE_MS = 10 * 60_000
const EDIT_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit']
const RESERVED = ['tool', 'tool_use_id', 'agentId', 'requestMeta']
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g

function hashOf(text: string): string {
  let acc = 5381
  for (let i = 0; i < text.length; i++) acc = ((acc * 33) ^ text.charCodeAt(i)) >>> 0
  return acc.toString(36)
}

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** Numbers, hashes, UUIDs and temp paths out, so two runs of the same failure compare equal. */
function normalize(text: string): string {
  return clip(text, 2000)
    .replace(ANSI, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/(?:[A-Za-z]:)?[^\s'"]*?[\\/](?:tmp|temp)(?=[\\/\s'"]|$)[^\s'"]*/gi, '<tmp>')
    .replace(/%TEMP%[^\s'"]*|\$TMPDIR[^\s'"]*/g, '<tmp>')
    .replace(/\b[0-9a-f]{7,64}\b/gi, m => (/\d/.test(m) && /[a-f]/i.test(m) ? '<hash>' : m))
    .replace(/\d+/g, 'N')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickText(x: Record<string, unknown>): string {
  for (const key of ['command', 'file_path', 'notebook_path', 'path', 'pattern', 'url', 'query', 'description']) {
    const v = x[key]
    if (typeof v === 'string' && v !== '') return v
  }
  const json = JSON.stringify(x, (name, value: unknown) => (RESERVED.includes(name) ? undefined : value))
  return json ?? ''
}

function inputSig(x: Record<string, unknown>): string {
  const json = JSON.stringify(x, (name, value: unknown) => {
    if (RESERVED.includes(name)) return undefined
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort((p, q) => (p[0] < q[0] ? -1 : 1)))
    }
    return value
  })
  return hashOf(json ?? '')
}

/** The first line that says something: not "Exit code 1", not blank. */
function headOf(text: string): { norm: string; shown: string } {
  const lines = text
    .slice(0, 4000)
    .replace(ANSI, '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l !== '')
  const line = lines.find(l => !/^(exit code\b|command failed with exit code\b|error: command failed\b)/i.test(l)) ?? lines[0] ?? ''
  return { norm: clip(normalize(line), 120), shown: clip(line.replace(/\s+/g, ' '), 160) }
}

function errorText(result: ToolCallOutput): string {
  if (typeof result.text === 'string' && result.text !== '') return result.text
  const raw = result.result as unknown
  if (raw !== null && typeof raw === 'object') {
    const stderr = (raw as Record<string, unknown>)['stderr']
    if (typeof stderr === 'string') return stderr
  }
  return typeof raw === 'string' ? raw : ''
}

function nameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

type Ev = {
  tool: string
  callKey: string
  fp: string
  target: string
  shown: string
  head: string
  headShown: string
  failed: boolean
  tokens: number
}

function eventOf(e: ToolCallInput, failed: boolean, result: ToolCallOutput): Ev {
  const x = e as unknown as Record<string, unknown>
  const tool = String(x['tool'] ?? '')
  const raw = pickText(x)
  const target = clip(normalize(raw), 200)
  const text = failed ? errorText(result) : ''
  const head = failed ? headOf(text) : { norm: '', shown: '' }
  return {
    tool,
    callKey: `${tool}|${target}`,
    fp: `${tool}:${inputSig(x)}`,
    target,
    shown: clip(raw.replace(/\s+/g, ' ').trim(), 160),
    head: head.norm,
    headShown: head.shown,
    failed,
    tokens: Math.ceil(text.length / 4),
  }
}

const FLAG_ORDER: Flag[] = ['repeated', 'ineffective', 'loop']

type Outcome = { changed: string[]; hit: Rec | undefined; notify: boolean }

/** One tool result in: the new state and what changed. Pure, so a retried update gives the same answer. */
function observe(cur: State, ev: Ev, loopActive: boolean, now: number): { state: State; outcome: Outcome } {
  const recs: Record<string, Rec> = { ...cur.recs }
  let pendingEdits = cur.pendingEdits
  const sinceEdit = cur.sinceEdit + 1
  if (sinceEdit > EDIT_SPAN) pendingEdits = []
  let recent = ev.tool === 'TodoWrite' ? cur.recent : [...cur.recent, ev.fp].slice(-RECENT)
  const identical = recent.filter(x => x === ev.fp).length
  const isLoop = ev.tool !== 'TodoWrite' && (identical >= 4 || (loopActive && identical >= 3))
  const tick = (cur.tick ?? 0) + 1
  const changed: string[] = []
  let hit: Rec | undefined
  let notify = false
  let nextSince = sinceEdit

  const arm = (rec: Rec): Rec => {
    let out = rec
    if (rec.flags.length > 0 && (rec.armedAt === 0 || now - rec.armedAt >= NUDGE_MS)) out = { ...out, armedAt: now, live: true }
    if (rec.flags.length > 0 && (rec.noticedAt === 0 || now - rec.noticedAt >= NOTICE_MS)) {
      out = { ...out, noticedAt: now }
      notify = true
    }
    return out
  }

  if (!ev.failed) {
    let resolvedAny = false
    for (const rec of Object.values(recs)) {
      if (rec.callKey === ev.callKey && !rec.resolved && rec.count > 0) {
        recs[rec.id] = { ...rec, resolved: true, live: false }
        changed.push(rec.id)
        resolvedAny = true
      }
    }
    if (resolvedAny) {
      recent = recent.filter(x => x !== ev.fp)
    } else if (isLoop) {
      const id = hashOf(`loop|${ev.callKey}`)
      const prev = recs[id]
      const base: Rec =
        prev !== undefined && !prev.resolved
          ? prev
          : {
              id,
              callKey: ev.callKey,
              fp: ev.fp,
              tool: ev.tool,
              target: ev.target,
              head: '',
              shown: ev.shown,
              headShown: '',
              count: 0,
              repeats: 0,
              cycles: 0,
              first: now,
              last: now,
              seq: tick,
              files: [],
              flags: [],
              resolved: false,
              tokens: 0,
              armedAt: prev?.armedAt ?? 0,
              live: false,
              noticedAt: prev?.noticedAt ?? 0,
            }
      const rec = arm({ ...base, fp: ev.fp, shown: ev.shown, repeats: identical, last: now, seq: tick, flags: base.flags.includes('loop') ? base.flags : [...base.flags, 'loop'] })
      recs[id] = rec
      changed.push(id)
      hit = rec
    }
  } else {
    const id = hashOf(`${ev.tool}|${ev.target}|${ev.head}`)
    const prev = recs[id]
    const fresh = prev === undefined || prev.resolved
    const base: Rec = fresh
      ? {
          id,
          callKey: ev.callKey,
          fp: ev.fp,
          tool: ev.tool,
          target: ev.target,
          head: ev.head,
          shown: ev.shown,
          headShown: ev.headShown,
          count: 0,
          repeats: 0,
          cycles: 0,
          first: now,
          last: now,
          seq: tick,
          files: [],
          flags: [],
          resolved: false,
          tokens: 0,
          armedAt: prev?.armedAt ?? 0,
          live: false,
          noticedAt: prev?.noticedAt ?? 0,
        }
      : prev
    let files = base.files
    let cycles = base.cycles
    if (pendingEdits.length > 0) {
      cycles += 1
      files = [...files, ...pendingEdits.filter(f => !files.includes(f))].slice(-12)
      pendingEdits = []
      nextSince = 0
    }
    const count = base.count + 1
    const flags = new Set<Flag>(base.flags)
    if (count >= 3) flags.add('repeated')
    if (cycles >= 2) flags.add('ineffective')
    if (isLoop) flags.add('loop')
    const rec = arm({
      ...base,
      fp: ev.fp,
      shown: ev.shown,
      headShown: ev.headShown,
      count,
      repeats: identical,
      cycles,
      last: now,
      seq: tick,
      files,
      flags: FLAG_ORDER.filter(f => flags.has(f)),
      tokens: base.tokens + ev.tokens,
    })
    recs[id] = rec
    changed.push(id)
    if (rec.flags.length > 0) hit = rec
  }

  // a loop-only record ends when its call is no longer repeated in the window
  for (const rec of Object.values(recs)) {
    if (rec.count === 0 && !rec.resolved && recent.filter(x => x === rec.fp).length < 2) {
      recs[rec.id] = { ...rec, resolved: true, live: false }
      changed.push(rec.id)
    }
  }

  const ids = Object.keys(recs)
  if (ids.length > MAX_RECS) {
    const doomed = Object.values(recs)
      .sort((a, b) => Number(b.resolved) - Number(a.resolved) || a.seq - b.seq)
      .slice(0, ids.length - MAX_RECS)
    for (const rec of doomed) {
      delete recs[rec.id]
      changed.push(rec.id)
    }
  }

  return { state: { ...cur, recs, tick, pendingEdits, sinceEdit: nextSince, recent }, outcome: { changed, hit, notify } }
}

const strongest = (rec: Rec): Flag => (rec.flags.includes('ineffective') ? 'ineffective' : rec.flags.includes('repeated') ? 'repeated' : 'loop')
const patternName = (flag: Flag): string => t(flag === 'ineffective' ? T.patIneffective : flag === 'repeated' ? T.patRepeated : T.patLoop)
const patternsText = (rec: Rec): string => rec.flags.map(patternName).join(' · ')
const shownCount = (rec: Rec): number => (rec.count > 0 ? rec.count : rec.repeats)
const isOpenRepeated = (rec: Rec): boolean => !rec.resolved && rec.flags.includes('repeated')
const withFlags = (s: State): Rec[] =>
  Object.values(s.recs)
    .filter(r => r.flags.length > 0)
    .sort((a, b) => b.seq - a.seq)

function noticeText(rec: Rec): string {
  const what = clip(rec.shown, 60)
  const flag = strongest(rec)
  if (flag === 'ineffective') return t(T.noticeIneffective, { n: rec.cycles, what })
  if (flag === 'repeated') return t(T.noticeRepeated, { n: rec.count, what })
  return t(T.noticeLoop, { n: rec.repeats, what })
}

/** Tells the signals bus about one record: published while it is an open pattern, retracted otherwise. */
async function syncSignal($: EngineInterface, id: string, rec: Rec | undefined, now: number): Promise<void> {
  if (rec === undefined || rec.resolved || rec.flags.length === 0) {
    await retract($, `error-detective:${id}`)
    return
  }
  await publish($, {
    id: `error-detective:${id}`,
    feature: feature.id,
    kind: 'failure',
    level: 'warn',
    value: shownCount(rec),
    text: rec.count > 0 ? `${rec.tool} failed ${rec.count}x with the same error` : `${rec.tool} repeated ${rec.repeats}x`,
    at: now,
  })
}

async function noteEdit($: EngineInterface, e: ToolCallInput): Promise<void> {
  const x = e as unknown as Record<string, unknown>
  const raw = x['file_path'] ?? x['notebook_path'] ?? x['path']
  const name = typeof raw === 'string' ? nameOf(raw) : ''
  if (name === '') return
  await update($, state, s => ({
    ...s,
    pendingEdits: s.pendingEdits.includes(name) ? s.pendingEdits : [...s.pendingEdits, name].slice(-8),
    sinceEdit: 0,
  }))
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'errors', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'errors', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  await update($, state, () => empty())
  await retractAll($, feature.id)
}

export async function afterEditCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.agentId !== undefined) return result
  if (!(await isOn($, feature))) return result
  if (result.deny !== undefined || result.isError === true) return result
  await noteEdit($, e)
  return result
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.agentId !== undefined) return result
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return result
  }
  if (result.deny !== undefined) return result

  const failed = result.isError === true
  const tool = String((e as unknown as Record<string, unknown>)['tool'] ?? '')
  if (EDIT_TOOLS.includes(tool) && !failed) {
    // a good Edit / Write / NotebookEdit is noted by afterEditCall; MultiEdit has no such hook
    if (tool === 'MultiEdit') await noteEdit($, e)
    return result
  }

  const now = await $.clock.now()
  const loopActive = (await current($, now)).some(s => s.kind === 'loop' && s.feature === 'loop-detective')
  const ev = eventOf(e, failed, result)
  const box: { outcome: Outcome | undefined } = { outcome: undefined }
  await update($, state, cur => {
    const step = observe(cur, ev, loopActive, now)
    box.outcome = step.outcome
    return step.state
  })

  const outcome = box.outcome
  if (outcome === undefined) return result

  const recs = (await read($, state)).recs
  for (const id of outcome.changed) await syncSignal($, id, recs[id], now)
  if (outcome.hit !== undefined && outcome.notify) await notice($, 'warn', noticeText(outcome.hit), feature.id)

  if (failed && ev.tokens > 0) {
    await update($, savings, s => ({
      ...s,
      leaks: { ...(s.leaks ?? {}), 'failed-attempt': (s.leaks?.['failed-attempt'] ?? 0) + ev.tokens },
    }))
  }
  return result
}

function nudgeBlock(rec: Rec): string {
  const lines: string[] = []
  if (rec.count > 0) {
    lines.push(`- ${rec.tool} \`${rec.shown}\` has failed ${rec.count} times with the same error: "${rec.headShown}".`)
    if (rec.files.length > 0) {
      lines.push(`  Tried so far: edited ${rec.files.join(', ')} (${rec.cycles} edit-then-fail cycle${rec.cycles === 1 ? '' : 's'}); those changes did not fix it.`)
    } else {
      lines.push('  Tried so far: only retrying it, with no change in between.')
    }
  } else {
    lines.push(`- ${rec.tool} \`${rec.shown}\` has been called ${rec.repeats} times with identical input and no progress.`)
  }
  lines.push('  Ruled out: repeating the identical command or the same edit.')
  return lines.join('\n')
}

export async function onPromptCompose($: EngineInterface, e: Input<'prompt.compose'>, result: Output<'prompt.compose'>): Promise<Output<'prompt.compose'>> {
  if (!(await isOn($, feature))) return result

  const s = await read($, state)
  const now = await $.clock.now()
  const active = withFlags(s)
    .filter(r => r.live && !r.resolved && now - r.armedAt < NUDGE_MS)
    .slice(0, 3)
  if (active.length === 0) return result

  const text = [
    '# Recurring failure detected',
    ...active.map(nudgeBlock),
    'Before making another edit, investigate the cause: read the complete error, inspect what the failing code actually receives and the environment it runs in. In your next message say what you learned and your hypothesis, then act on it. If you cannot find the cause, ask the user for the missing information instead of trying the same thing again.',
  ].join('\n')

  return {
    ...result,
    sections: [...result.sections.filter(sec => sec.id !== SECTION_ID), { id: SECTION_ID, text, scope: 'session' as const }],
  }
}

/** The short band form: "↻ 3× same error" while an open pattern repeats the same failure. Quiet otherwise. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const open = withFlags(await read($, state)).filter(isOpenRepeated)
  if (open.length === 0) return null
  const n = open.reduce((m, r) => Math.max(m, r.count), 0)
  return { text: t(T.chip, { n }), level: 'alert' }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const open = withFlags(await read($, state)).filter(isOpenRepeated)
  const top = open[0]
  if (top === undefined) return null

  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      {t(T.band, { n: top.count, what: clip(top.shown, 50) })}
    </Text>
  )
}

/** The target of Show pattern / Suggest alternative: the expanded row, else the newest open pattern, else the newest. */
function pickTarget(s: State): Rec | undefined {
  const all = withFlags(s)
  const open = s.expanded === null ? undefined : s.recs[s.expanded]
  return open ?? all.find(r => !r.resolved) ?? all[0]
}

function suggestionPrompt(rec: Rec): string {
  const what = rec.tool === 'Bash' ? `The command \`${rec.shown}\`` : `The ${rec.tool} call on \`${rec.shown}\``
  if (rec.count === 0) {
    return `${what} was repeated ${rec.repeats} times with identical input and made no progress. Before calling it again, stop and say what you expected it to return and why it has not helped. Look for what is missing (another file, another query, another tool) and try that instead of repeating the call.`
  }
  const tried =
    rec.files.length > 0
      ? `The edits to ${rec.files.join(', ')} did not change it.`
      : 'Retrying it without any change did not help.'
  return `${what} failed ${rec.count} times with error: ${rec.headShown}. ${tried} Before editing again, investigate the cause: read the complete error output, check what the failing code receives and the environment it runs in, state a hypothesis and verify it with a read-only check. Do not repeat the same command or the same change.`
}

function summaryText(rec: Rec, now: number): string {
  return t(T.summary, {
    patterns: patternsText(rec),
    call: `${rec.tool} ${rec.shown}`,
    error: rec.headShown === '' ? t(T.none) : rec.headShown,
    n: shownCount(rec),
    first: clockText(now - rec.first),
    last: clockText(now - rec.last),
    status: t(rec.resolved ? T.statusResolved : T.statusOpen),
    files: rec.files.length > 0 ? rec.files.join(', ') : t(T.none),
  })
}

function rowText(rec: Rec): string {
  return `${rec.tool} · ${clip(rec.headShown !== '' ? rec.headShown : rec.shown, 70)}`
}

/** What a pattern shows when its row is open (or always, in the band's detail). */
function patternFacts($: EngineInterface, e: PaneInput, rec: Rec, now: number): RenderElement {
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box key={`facts-${rec.id}`} flexDirection="column" marginLeft={2}>
      <Text dimColor>{t(T.lCall, { call: rec.shown })}</Text>
      <Text dimColor>{rec.headShown === '' ? t(T.lNoError) : t(T.lError, { error: rec.headShown })}</Text>
      <Text dimColor>{t(T.lPatterns, { patterns: patternsText(rec) })}</Text>
      <Text dimColor>{t(T.lSeen, { n: shownCount(rec), first: clockText(now - rec.first), last: clockText(now - rec.last) })}</Text>
      <Text dimColor>{rec.files.length > 0 ? t(T.lAttempts, { files: rec.files.join(', '), cycles: rec.cycles }) : t(T.lNoAttempts)}</Text>
      <Text dimColor>{t(T.lRuledOut)}</Text>
      <Text dimColor>{t(T.lSuggestion)}</Text>
    </Box>
  )
}

/** The pattern list: pressable rows in the pane, plain rows with their facts in the band's detail. */
function patternList($: EngineInterface, e: PaneInput, s: State, now: number, isInteractive: boolean): RenderElement {
  const { Box } = $.ui.resolve(e)
  const rows = withFlags(s)
  return (
    <Box flexDirection="column">
      {rows.map(rec => {
        const open = !isInteractive || s.expanded === rec.id
        const line = listRow($, e, {
          key: `ed-row-${rec.id}`,
          left: `${shownCount(rec)}×`,
          text: rowText(rec),
          right: t(rec.resolved ? T.statusResolved : T.statusOpen),
          level: rec.resolved ? 'ok' : 'warn',
          ...(isInteractive
            ? {
                onPress: async () => {
                  await update($, state, cur => ({ ...cur, expanded: cur.expanded === rec.id ? null : rec.id }))
                },
              }
            : {}),
        })
        return (
          <Box key={`ed-${rec.id}`} flexDirection="column">
            {line}
            {open ? patternFacts($, e, rec, now) : null}
          </Box>
        )
      })}
    </Box>
  )
}

/** What a press on the band line shows: every pattern with its facts. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const s = await read($, state)
  const now = await $.clock.now()
  const { Box } = $.ui.resolve(e)
  if (withFlags(s).length === 0) return <Box flexDirection="column">{emptyState($, e, t(T.emptyText), t(T.emptyHint))}</Box>
  return (
    <Box flexDirection="column">
      {sectionTitle($, e, t(T.paneTitle))}
      {patternList($, e, s, now, false)}
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'errors' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'error-detective' }, async ($, e) => {
    const { Box } = $.ui.resolve(e)
    if (!(await isOn($, feature))) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle) })}
          {emptyState($, e, t(T.paneOff))}
        </Box>
      )
    }

    const s = await read($, state)
    const now = await $.clock.now()
    const rows = withFlags(s)
    const openCount = rows.filter(r => !r.resolved).length

    const showPattern = async () => {
      const rec = pickTarget(await read($, state))
      if (rec === undefined) {
        await notice($, 'info', t(T.nothing), feature.id, { immediate: true })
        return
      }
      const done = await $.ui.copy({ text: summaryText(rec, await $.clock.now()), surface: e.surface })
      await notice($, done.isCopied ? 'info' : 'warn', t(done.isCopied ? T.copied : T.copyFailed), feature.id, { immediate: true })
    }
    const suggest = async () => {
      const rec = pickTarget(await read($, state))
      if (rec === undefined) {
        await notice($, 'info', t(T.nothing), feature.id, { immediate: true })
        return
      }
      const filled = await $.prompt.fill({ text: suggestionPrompt(rec), mode: 'replace' })
      await notice($, filled.isFilled ? 'info' : 'warn', t(filled.isFilled ? T.filled : T.notFilled), feature.id, { immediate: true })
    }
    const clear = async () => {
      await update($, state, () => empty())
      await retractAll($, feature.id)
      await notice($, 'info', t(T.cleared), feature.id, { immediate: true })
    }

    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: t(rows.length === 1 ? T.patternsOne : T.patternsMany, { n: rows.length }),
          level: openCount > 0 ? 'warn' : 'ok',
          actions: [
            { key: 'ed-show', label: t(T.show), onPress: showPattern },
            { key: 'ed-suggest', label: t(T.suggest), onPress: suggest },
            { key: 'ed-clear', label: t(T.clear), onPress: clear },
          ],
        })}
        {rows.length === 0 ? emptyState($, e, t(T.emptyText), t(T.emptyHint)) : patternList($, e, s, now, true)}
      </Box>
    )
  })
}
