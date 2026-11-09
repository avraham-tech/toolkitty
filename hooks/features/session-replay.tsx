import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { clockText, isOn, notice, t } from '../core'
import type { BandInput, BandLine, Feature, Input, Output, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { allEvidence } from '../evidence'
import { current } from '../signals'
import { ICONS, emptyState, listRow, paneHeader } from '../ui'
import type { Chip, Level } from '../ui'

/*
 * Session replay. One readable, filterable timeline of the session, kept in
 * this feature's own bounded log (the other logs stay as they are): turns,
 * tool calls, edits, errors, test/build/lint results (read from the evidence
 * layer at the end of a turn), incidents (read from the signals bus at the end
 * of a turn) and approvals. Privacy by construction: a prompt is cut to 60
 * characters, a tool's output to 100, key-like strings are masked, and nothing
 * leaves the session unless the person turns "Keep across sessions" on.
 */

const T = {
  title: { en: 'Session replay', he: 'שחזור הסשן', es: 'Repetición de la sesión', fr: 'Relecture de la session', ru: 'Повтор сессии', zh: '会话回放', ja: 'セッションリプレイ', pt: 'Replay da sessão', de: 'Sitzungswiedergabe', ko: '세션 리플레이' },
  description: {
    en: 'One readable, filterable timeline of the session: turns, tools, edits, errors, checks, incidents and approvals (/replay).',
    he: 'ציר זמן אחד קריא וניתן לסינון של הסשן: תורים, כלים, עריכות, שגיאות, בדיקות, אירועים ואישורים (/replay).',
    es: 'Una línea de tiempo legible y filtrable de la sesión: turnos, herramientas, ediciones, errores, comprobaciones, incidentes y aprobaciones (/replay).',
    fr: 'Une chronologie lisible et filtrable de la session : tours, outils, modifications, erreurs, vérifications, incidents et approbations (/replay).',
    ru: 'Одна читаемая лента сессии с фильтрами: ходы, инструменты, правки, ошибки, проверки, инциденты и подтверждения (/replay).',
    zh: '一条可读、可筛选的会话时间线：轮次、工具、编辑、错误、检查、事件和审批（/replay）。',
    ja: 'セッションの読みやすくフィルタ可能なタイムライン：ターン、ツール、編集、エラー、チェック、インシデント、承認（/replay）。',
    pt: 'Uma linha do tempo legível e filtrável da sessão: turnos, ferramentas, edições, erros, verificações, incidentes e aprovações (/replay).',
    de: 'Eine lesbare, filterbare Zeitleiste der Sitzung: Züge, Tools, Bearbeitungen, Fehler, Prüfungen, Vorfälle und Freigaben (/replay).',
    ko: '세션의 읽기 쉽고 필터링 가능한 타임라인: 턴, 도구, 편집, 오류, 검사, 인시던트, 승인 (/replay).',
  },
  cmdDesc: {
    en: 'Opens the session replay: a timeline of what happened (keep on|off, clear)',
    he: 'פותח את שחזור הסשן: ציר זמן של מה שקרה (keep on|off, clear)',
    es: 'Abre la repetición de la sesión: una línea de tiempo de lo ocurrido (keep on|off, clear)',
    fr: 'Ouvre la relecture de la session : une chronologie de ce qui s’est passé (keep on|off, clear)',
    ru: 'Открывает повтор сессии: ленту событий (keep on|off, clear)',
    zh: '打开会话回放：已发生事件的时间线（keep on|off、clear）',
    ja: 'セッションリプレイを開きます：出来事のタイムライン（keep on|off、clear）',
    pt: 'Abre o replay da sessão: uma linha do tempo do que aconteceu (keep on|off, clear)',
    de: 'Öffnet die Sitzungswiedergabe: eine Zeitleiste des Geschehens (keep on|off, clear)',
    ko: '세션 리플레이를 엽니다: 일어난 일의 타임라인 (keep on|off, clear)',
  },
  off: {
    en: 'The "Session replay" feature is off in the switches panel.',
    he: 'השכלול "שחזור הסשן" כבוי בלוח המתגים.',
    es: 'La función "Repetición de la sesión" está desactivada en el panel de interruptores.',
    fr: 'La fonctionnalité « Relecture de la session » est désactivée dans le panneau des commutateurs.',
    ru: 'Функция «Повтор сессии» выключена на панели переключателей.',
    zh: '“会话回放”功能在开关面板中已关闭。',
    ja: '「セッションリプレイ」機能はスイッチパネルでオフになっています。',
    pt: 'O recurso "Replay da sessão" está desativado no painel de controle.',
    de: 'Die Funktion „Sitzungswiedergabe“ ist im Schalterpanel ausgeschaltet.',
    ko: '"세션 리플레이" 기능은 스위치 패널에서 꺼져 있습니다.',
  },
  paneOff: {
    en: 'The feature is off in the switches panel.',
    he: 'השכלול כבוי בלוח המתגים.',
    es: 'La función está desactivada en el panel de interruptores.',
    fr: 'La fonctionnalité est désactivée dans le panneau des commutateurs.',
    ru: 'Функция выключена на панели переключателей.',
    zh: '该功能在开关面板中已关闭。',
    ja: 'この機能はスイッチパネルでオフになっています。',
    pt: 'O recurso está desativado no painel de controle.',
    de: 'Die Funktion ist im Schalterpanel ausgeschaltet.',
    ko: '이 기능은 스위치 패널에서 꺼져 있습니다.',
  },
  paneTitle: { en: 'Replay', he: 'שחזור', es: 'Repetición', fr: 'Relecture', ru: 'Повтор', zh: '回放', ja: 'リプレイ', pt: 'Replay', de: 'Wiedergabe', ko: '리플레이' },
  opened: { en: 'The session replay is open.', he: 'שחזור הסשן נפתח.', es: 'La repetición de la sesión está abierta.', fr: 'La relecture de la session est ouverte.', ru: 'Повтор сессии открыт.', zh: '会话回放已打开。', ja: 'セッションリプレイを開きました。', pt: 'O replay da sessão está aberto.', de: 'Die Sitzungswiedergabe ist geöffnet.', ko: '세션 리플레이가 열려 있습니다.' },
  usage: {
    en: 'Usage: /replay (open), /replay keep on|off, /replay clear',
    he: 'שימוש: ‎/replay (פתיחה), ‎/replay keep on|off, ‎/replay clear',
    es: 'Uso: /replay (abrir), /replay keep on|off, /replay clear',
    fr: 'Utilisation : /replay (ouvrir), /replay keep on|off, /replay clear',
    ru: 'Использование: /replay (открыть), /replay keep on|off, /replay clear',
    zh: '用法：/replay（打开）、/replay keep on|off、/replay clear',
    ja: '使い方：/replay（開く）、/replay keep on|off、/replay clear',
    pt: 'Uso: /replay (abrir), /replay keep on|off, /replay clear',
    de: 'Verwendung: /replay (öffnen), /replay keep on|off, /replay clear',
    ko: '사용법: /replay (열기), /replay keep on|off, /replay clear',
  },
  status: {
    en: '{n} events · {from}–{to}',
    he: '{n} אירועים · {from}–{to}',
    es: '{n} eventos · {from}–{to}',
    fr: '{n} événements · {from}–{to}',
    ru: 'событий: {n} · {from}–{to}',
    zh: '{n} 个事件 · {from}–{to}',
    ja: 'イベント {n} 件 · {from}–{to}',
    pt: '{n} eventos · {from}–{to}',
    de: '{n} Ereignisse · {from}–{to}',
    ko: '이벤트 {n}개 · {from}–{to}',
  },
  empty: { en: 'Nothing has happened in this session yet.', he: 'עדיין לא קרה דבר בסשן הזה.', es: 'Aún no ha pasado nada en esta sesión.', fr: 'Rien ne s’est encore passé dans cette session.', ru: 'В этой сессии пока ничего не происходило.', zh: '本次会话中还没有发生任何事。', ja: 'このセッションではまだ何も起きていません。', pt: 'Nada aconteceu nesta sessão ainda.', de: 'In dieser Sitzung ist noch nichts passiert.', ko: '이번 세션에서는 아직 아무 일도 없었습니다.' },
  emptyHint: {
    en: 'Turns, tool calls, edits, errors, checks and approvals appear here as they happen.',
    he: 'תורים, קריאות לכלים, עריכות, שגיאות, בדיקות ואישורים יופיעו כאן תוך כדי.',
    es: 'Los turnos, las llamadas a herramientas, las ediciones, los errores, las comprobaciones y las aprobaciones aparecen aquí a medida que ocurren.',
    fr: 'Les tours, appels d’outils, modifications, erreurs, vérifications et approbations apparaissent ici au fil de l’eau.',
    ru: 'Ходы, вызовы инструментов, правки, ошибки, проверки и подтверждения появляются здесь по мере появления.',
    zh: '轮次、工具调用、编辑、错误、检查和审批会在发生时显示在这里。',
    ja: 'ターン、ツール呼び出し、編集、エラー、チェック、承認が発生するたびにここに表示されます。',
    pt: 'Turnos, chamadas de ferramentas, edições, erros, verificações e aprovações aparecem aqui à medida que acontecem.',
    de: 'Züge, Tool-Aufrufe, Bearbeitungen, Fehler, Prüfungen und Freigaben erscheinen hier, sobald sie passieren.',
    ko: '턴, 도구 호출, 편집, 오류, 검사, 승인이 발생하는 대로 여기에 나타납니다.',
  },
  noMatch: { en: 'No event matches the filters.', he: 'אף אירוע לא תואם למסננים.', es: 'Ningún evento coincide con los filtros.', fr: 'Aucun événement ne correspond aux filtres.', ru: 'Ни одно событие не подходит под фильтры.', zh: '没有事件匹配筛选条件。', ja: 'フィルタに一致するイベントはありません。', pt: 'Nenhum evento corresponde aos filtros.', de: 'Kein Ereignis passt zu den Filtern.', ko: '필터와 일치하는 이벤트가 없습니다.' },
  noMatchHint: {
    en: 'Switch a filter back on in the header to see more.',
    he: 'הפעילו מסנן בכותרת כדי לראות עוד.',
    es: 'Vuelve a activar un filtro en la cabecera para ver más.',
    fr: 'Réactivez un filtre dans l’en-tête pour en voir plus.',
    ru: 'Включите фильтр в заголовке, чтобы увидеть больше.',
    zh: '在顶部重新打开某个筛选项以查看更多。',
    ja: 'ヘッダーでフィルタを再度オンにすると、さらに表示されます。',
    pt: 'Reative um filtro no cabeçalho para ver mais.',
    de: 'Schalte oben einen Filter wieder ein, um mehr zu sehen.',
    ko: '더 보려면 상단에서 필터를 다시 켜세요.',
  },
  fTurns: { en: 'Turns', he: 'תורים', es: 'Turnos', fr: 'Tours', ru: 'Ходы', zh: '轮次', ja: 'ターン', pt: 'Turnos', de: 'Züge', ko: '턴' },
  fTools: { en: 'Tools', he: 'כלים', es: 'Herramientas', fr: 'Outils', ru: 'Инструменты', zh: '工具', ja: 'ツール', pt: 'Ferramentas', de: 'Tools', ko: '도구' },
  fEdits: { en: 'Edits', he: 'עריכות', es: 'Ediciones', fr: 'Modifications', ru: 'Правки', zh: '编辑', ja: '編集', pt: 'Edições', de: 'Bearbeitungen', ko: '편집' },
  fErrors: { en: 'Errors', he: 'שגיאות', es: 'Errores', fr: 'Erreurs', ru: 'Ошибки', zh: '错误', ja: 'エラー', pt: 'Erros', de: 'Fehler', ko: '오류' },
  fChecks: { en: 'Checks', he: 'בדיקות', es: 'Comprobaciones', fr: 'Vérifications', ru: 'Проверки', zh: '检查', ja: 'チェック', pt: 'Verificações', de: 'Prüfungen', ko: '검사' },
  fIncidents: { en: 'Incidents', he: 'אירועים', es: 'Incidentes', fr: 'Incidents', ru: 'Инциденты', zh: '事件', ja: 'インシデント', pt: 'Incidentes', de: 'Vorfälle', ko: '인시던트' },
  fApprovals: { en: 'Approvals', he: 'אישורים', es: 'Aprobaciones', fr: 'Approbations', ru: 'Подтверждения', zh: '审批', ja: '承認', pt: 'Aprovações', de: 'Freigaben', ko: '승인' },
  btnCopy: { en: 'Copy', he: 'העתק', es: 'Copiar', fr: 'Copier', ru: 'Копировать', zh: '复制', ja: 'コピー', pt: 'Copiar', de: 'Kopieren', ko: '복사' },
  btnKeep: { en: 'Keep across sessions {state}', he: 'שמירה בין סשנים {state}', es: 'Conservar entre sesiones {state}', fr: 'Conserver entre les sessions {state}', ru: 'Хранить между сессиями {state}', zh: '跨会话保留{state}', ja: 'セッションをまたいで保持{state}', pt: 'Manter entre sessões {state}', de: 'Über Sitzungen behalten {state}', ko: '세션 간 유지 {state}' },
  stateOn: { en: 'on', he: 'פועל', es: 'sí', fr: 'oui', ru: 'вкл', zh: '开', ja: 'オン', pt: 'on', de: 'an', ko: '켬' },
  stateOff: { en: 'off', he: 'כבוי', es: 'no', fr: 'non', ru: 'выкл', zh: '关', ja: 'オフ', pt: 'off', de: 'aus', ko: '끔' },
  btnClear: { en: 'Clear', he: 'נקה', es: 'Borrar', fr: 'Effacer', ru: 'Очистить', zh: '清晰', ja: '明確', pt: 'Claro', de: 'Klar', ko: '명확' },
  older: { en: '+{n} older', he: '+{n} ישנים יותר', es: '+{n} más antiguos', fr: '+{n} plus anciens', ru: 'ещё {n} старых', zh: '另有 +{n} 条较早的', ja: '古いもの +{n} 件', pt: '+{n} mais antigos', de: '+{n} ältere', ko: '이전 +{n}개' },
  footSession: {
    en: 'Retention: this session only. Prompts are cut to 60 characters, tool output to 100, and secrets are masked.',
    he: 'שמירה: הסשן הזה בלבד. הנחיות נחתכות ל-60 תווים, פלט כלים ל-100, וסודות מוסתרים.',
    es: 'Retención: solo esta sesión. Los mensajes se recortan a 60 caracteres, la salida de herramientas a 100, y los secretos se ocultan.',
    fr: 'Conservation : cette session uniquement. Les prompts sont coupés à 60 caractères, la sortie des outils à 100, et les secrets sont masqués.',
    ru: 'Хранение: только эта сессия. Запросы обрезаются до 60 символов, вывод инструментов до 100, секреты скрываются.',
    zh: '保留策略：仅限本次会话。提示词截取到 60 个字符，工具输出截取到 100 个，密钥会被遮蔽。',
    ja: '保持ポリシー：このセッションのみ。プロンプトは 60 文字、ツール出力は 100 文字で切り詰められ、シークレットはマスクされます。',
    pt: 'Retenção: apenas esta sessão. Prompts são cortados em 60 caracteres, saídas de ferramentas em 100, e segredos são mascarados.',
    de: 'Aufbewahrung: nur diese Sitzung. Prompts werden auf 60 Zeichen gekürzt, Tool-Ausgaben auf 100, und Geheimnisse werden maskiert.',
    ko: '보관: 이번 세션에만 해당. 프롬프트는 60자, 도구 출력은 100자로 잘리며 비밀 값은 가려집니다.',
  },
  footKept: {
    en: 'Retention: kept across sessions on this machine. Prompts are cut to 60 characters, tool output to 100, and secrets are masked.',
    he: 'שמירה: נשמר בין סשנים במחשב הזה. הנחיות נחתכות ל-60 תווים, פלט כלים ל-100, וסודות מוסתרים.',
    es: 'Retención: se conserva entre sesiones en este equipo. Los mensajes se recortan a 60 caracteres, la salida de herramientas a 100, y los secretos se ocultan.',
    fr: 'Conservation : gardée entre les sessions sur cette machine. Les prompts sont coupés à 60 caractères, la sortie des outils à 100, et les secrets sont masqués.',
    ru: 'Хранение: сохраняется между сессиями на этом компьютере. Запросы обрезаются до 60 символов, вывод инструментов до 100, секреты скрываются.',
    zh: '保留策略：在此设备上跨会话保留。提示词截取到 60 个字符，工具输出截取到 100 个，密钥会被遮蔽。',
    ja: '保持ポリシー：このマシンでセッションをまたいで保持。プロンプトは 60 文字、ツール出力は 100 文字で切り詰められ、シークレットはマスクされます。',
    pt: 'Retenção: mantido entre sessões nesta máquina. Prompts são cortados em 60 caracteres, saídas de ferramentas em 100, e segredos são mascarados.',
    de: 'Aufbewahrung: auf diesem Rechner über Sitzungen hinweg gespeichert. Prompts werden auf 60 Zeichen gekürzt, Tool-Ausgaben auf 100, und Geheimnisse werden maskiert.',
    ko: '보관: 이 기기에서 세션 간 유지됩니다. 프롬프트는 60자, 도구 출력은 100자로 잘리며 비밀 값은 가려집니다.',
  },
  copied: { en: 'Replay copied.', he: 'השחזור הועתק.', es: 'Repetición copiada.', fr: 'Relecture copiée.', ru: 'Повтор скопирован.', zh: '回放已复制。', ja: 'リプレイをコピーしました。', pt: 'Replay copiado.', de: 'Wiedergabe kopiert.', ko: '리플레이를 복사했습니다.' },
  copyFailed: { en: 'Could not copy the replay: {why}', he: 'לא ניתן להעתיק את השחזור: {why}', es: 'No se pudo copiar la repetición: {why}', fr: 'Impossible de copier la relecture : {why}', ru: 'Не удалось скопировать повтор: {why}', zh: '无法复制回放：{why}', ja: 'リプレイをコピーできませんでした：{why}', pt: 'Não foi possível copiar o replay: {why}', de: 'Die Wiedergabe konnte nicht kopiert werden: {why}', ko: '리플레이를 복사할 수 없습니다: {why}' },
  keepIsOn: { en: 'The replay is kept across sessions.', he: 'השחזור נשמר בין סשנים.', es: 'La repetición se conserva entre sesiones.', fr: 'La relecture est conservée entre les sessions.', ru: 'Повтор сохраняется между сессиями.', zh: '回放会跨会话保留。', ja: 'リプレイはセッションをまたいで保持されます。', pt: 'O replay é mantido entre sessões.', de: 'Die Wiedergabe wird über Sitzungen hinweg behalten.', ko: '리플레이는 세션 간 유지됩니다.' },
  keepIsOff: { en: 'The replay lives in this session only.', he: 'השחזור קיים בסשן הזה בלבד.', es: 'La repetición vive solo en esta sesión.', fr: 'La relecture ne vit que dans cette session.', ru: 'Повтор хранится только в этой сессии.', zh: '回放仅存在于本次会话。', ja: 'リプレイはこのセッション内にのみ存在します。', pt: 'O replay existe apenas nesta sessão.', de: 'Die Wiedergabe gilt nur für diese Sitzung.', ko: '리플레이는 이번 세션에만 존재합니다.' },
  keepNowOn: { en: 'The replay will now be kept across sessions.', he: 'השחזור יישמר מעתה בין סשנים.', es: 'La repetición se conservará ahora entre sesiones.', fr: 'La relecture sera désormais conservée entre les sessions.', ru: 'Теперь повтор будет сохраняться между сессиями.', zh: '回放现在会跨会话保留。', ja: 'リプレイはこれからセッションをまたいで保持されます。', pt: 'O replay agora será mantido entre sessões.', de: 'Die Wiedergabe wird jetzt über Sitzungen hinweg behalten.', ko: '이제 리플레이가 세션 간 유지됩니다.' },
  keepNowOff: { en: 'The replay is back to this session only; the saved copy was removed.', he: 'השחזור חזר להיות בסשן הזה בלבד; העותק השמור הוסר.', es: 'La repetición vuelve a ser solo de esta sesión; se eliminó la copia guardada.', fr: 'La relecture est de nouveau limitée à cette session ; la copie enregistrée a été supprimée.', ru: 'Повтор снова только для этой сессии; сохранённая копия удалена.', zh: '回放已恢复为仅限本次会话；已保存的副本已删除。', ja: 'リプレイはこのセッションのみに戻り、保存済みのコピーは削除されました。', pt: 'O replay voltou a ser só desta sessão; a cópia salva foi removida.', de: 'Die Wiedergabe gilt wieder nur für diese Sitzung; die gespeicherte Kopie wurde entfernt.', ko: '리플레이가 이번 세션 전용으로 돌아갔고 저장된 사본은 삭제되었습니다.' },
  cleared: { en: 'The replay was cleared.', he: 'השחזור נוקה.', es: 'La repetición se borró.', fr: 'La relecture a été effacée.', ru: 'Повтор очищен.', zh: '回放已清除。', ja: 'リプレイをクリアしました。', pt: 'O replay foi limpo.', de: 'Die Wiedergabe wurde geleert.', ko: '리플레이를 지웠습니다.' },
  nothingToCopy: { en: 'There is nothing to copy yet.', he: 'עדיין אין מה להעתיק.', es: 'Todavía no hay nada que copiar.', fr: 'Il n’y a encore rien à copier.', ru: 'Копировать пока нечего.', zh: '暂时没有可复制的内容。', ja: 'コピーできるものはまだありません。', pt: 'Ainda não há nada para copiar.', de: 'Es gibt noch nichts zu kopieren.', ko: '아직 복사할 내용이 없습니다.' },
  exportTitle: { en: 'Session replay · {n} events', he: 'שחזור הסשן · {n} אירועים', es: 'Repetición de la sesión · {n} eventos', fr: 'Relecture de la session · {n} événements', ru: 'Повтор сессии · событий: {n}', zh: '会话回放 · {n} 个事件', ja: 'セッションリプレイ · イベント {n} 件', pt: 'Replay da sessão · {n} eventos', de: 'Sitzungswiedergabe · {n} Ereignisse', ko: '세션 리플레이 · 이벤트 {n}개' },
  turnFallback: { en: 'Turn', he: 'תור', es: 'Turno', fr: 'Tour', ru: 'Ход', zh: '轮次', ja: 'ターン', pt: 'Turno', de: 'Zug', ko: '턴' },
  turnEnded: { en: 'Turn ended · {time}', he: 'התור הסתיים · {time}', es: 'Turno terminado · {time}', fr: 'Tour terminé · {time}', ru: 'Ход завершён · {time}', zh: '轮次结束 · {time}', ja: 'ターン終了 · {time}', pt: 'Turno encerrado · {time}', de: 'Zug beendet · {time}', ko: '턴 종료 · {time}' },
  turnFailed: { en: 'Turn ended with an error · {time}', he: 'התור הסתיים בשגיאה · {time}', es: 'Turno terminado con un error · {time}', fr: 'Tour terminé avec une erreur · {time}', ru: 'Ход завершился ошибкой · {time}', zh: '轮次因错误结束 · {time}', ja: 'ターンがエラーで終了 · {time}', pt: 'Turno encerrado com erro · {time}', de: 'Zug mit Fehler beendet · {time}', ko: '오류로 턴 종료 · {time}' },
  turnStopped: { en: 'Turn stopped · {time}', he: 'התור נעצר · {time}', es: 'Turno detenido · {time}', fr: 'Tour interrompu · {time}', ru: 'Ход остановлен · {time}', zh: '轮次已停止 · {time}', ja: 'ターン停止 · {time}', pt: 'Turno interrompido · {time}', de: 'Zug gestoppt · {time}', ko: '턴 중단 · {time}' },
  toolError: { en: 'Tool error', he: 'שגיאת כלי', es: 'Error de herramienta', fr: 'Erreur d’outil', ru: 'Ошибка инструмента', zh: '工具错误', ja: 'ツールエラー', pt: 'Erro de ferramenta', de: 'Tool-Fehler', ko: '도구 오류' },
  asked: { en: 'Approval requested: {what}', he: 'התבקש אישור: {what}', es: 'Aprobación solicitada: {what}', fr: 'Approbation demandée : {what}', ru: 'Запрошено подтверждение: {what}', zh: '请求审批：{what}', ja: '承認を要求：{what}', pt: 'Aprovação solicitada: {what}', de: 'Freigabe angefordert: {what}', ko: '승인 요청: {what}' },
  approved: { en: 'Approved: {what}', he: 'אושר: {what}', es: 'Aprobado: {what}', fr: 'Approuvé : {what}', ru: 'Подтверждено: {what}', zh: '已批准：{what}', ja: '承認済み：{what}', pt: 'Aprovado: {what}', de: 'Freigegeben: {what}', ko: '승인됨: {what}' },
  denied: { en: 'Denied: {what}', he: 'נדחה: {what}', es: 'Denegado: {what}', fr: 'Refusé : {what}', ru: 'Отклонено: {what}', zh: '已拒绝：{what}', ja: '拒否済み：{what}', pt: 'Negado: {what}', de: 'Abgelehnt: {what}', ko: '거부됨: {what}' },
  cTest: { en: 'Tests', he: 'בדיקות', es: 'Pruebas', fr: 'Tests', ru: 'Тесты', zh: '测试', ja: 'テスト', pt: 'Testes', de: 'Tests', ko: '테스트' },
  cBuild: { en: 'Build', he: 'בנייה', es: 'Compilación', fr: 'Build', ru: 'Сборка', zh: '构建', ja: 'ビルド', pt: 'Build', de: 'Build', ko: '빌드' },
  cLint: { en: 'Lint', he: 'Lint', es: 'Lint', fr: 'Lint', ru: 'Линтер', zh: '代码检查', ja: 'Lint', pt: 'Lint', de: 'Lint', ko: '린트' },
  cTypecheck: { en: 'Types', he: 'טיפוסים', es: 'Tipos', fr: 'Types', ru: 'Типы', zh: '类型', ja: '型', pt: 'Tipos', de: 'Typen', ko: '타입' },
  refLabel: { en: 'ref', he: 'מקור', es: 'ref', fr: 'réf', ru: 'ссылка', zh: '引用', ja: 'ref', pt: 'ref', de: 'Ref.', ko: '참조' },
  turnLabel: { en: 'turn', he: 'תור', es: 'turno', fr: 'tour', ru: 'ход', zh: '轮次', ja: 'ターン', pt: 'turno', de: 'Zug', ko: '턴' },
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

type Kind = 'turn' | 'tool' | 'edit' | 'error' | 'check' | 'incident' | 'decision' | 'approval' | 'notice'
type Ev = { at: number; kind: Kind; text: string; ok?: boolean; ref?: string; turnId?: string }
type FilterId = 'turns' | 'tools' | 'edits' | 'errors' | 'checks' | 'incidents' | 'approvals'

type State = {
  events: Ev[]
  /** Filters switched off. */
  hidden: FilterId[]
  /** The id of the one expanded row ('' when none). */
  open: string
  keep: boolean
  sid: string
  /** The prompt label (first 60 characters) waiting for its turn. */
  prompt: string
  turnAt: number
  turnId: string
  /** Keys of the evidence records and incident signals already logged. */
  seen: string[]
  /** The tool an approval was requested for, until its call arrives. */
  pendingTool: string
  pendingRef: string
}

const replay = atom(
  { plugin: 'toolkitty', key: 'slot', id: 'session-replay' } as const,
  { events: [], hidden: [], open: '', keep: false, sid: '', prompt: '', turnAt: 0, turnId: '', seen: [], pendingTool: '', pendingRef: '' } as State,
) as unknown as Atom<State>

export const feature: Feature = {
  id: 'session-replay',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const MAX = 500
const SHOWN = 60
const PROMPT_MAX = 60
const TEXT_MAX = 100
const REF_MAX = 40
const COLLAPSED = 56
const SEEN_MAX = 200
const PANE = 'session-replay'
const KEEP_KEY = 'session-replay:keep'
const MASK = '[masked]'

const FILTERS: readonly { id: FilterId; kind: Kind; label: (typeof T)[keyof typeof T] }[] = [
  { id: 'turns', kind: 'turn', label: T.fTurns },
  { id: 'tools', kind: 'tool', label: T.fTools },
  { id: 'edits', kind: 'edit', label: T.fEdits },
  { id: 'errors', kind: 'error', label: T.fErrors },
  { id: 'checks', kind: 'check', label: T.fChecks },
  { id: 'incidents', kind: 'incident', label: T.fIncidents },
  { id: 'approvals', kind: 'approval', label: T.fApprovals },
]

const GLYPH: Record<Kind, string> = {
  turn: '▶',
  tool: '·',
  edit: '✎',
  error: '✗',
  check: '✓',
  incident: '⛨',
  decision: '◆',
  approval: '🟡',
  notice: 'ℹ',
}

const KINDS: readonly string[] = ['turn', 'tool', 'edit', 'error', 'check', 'incident', 'decision', 'approval', 'notice']
const EDIT_TOOLS: readonly string[] = ['Edit', 'Write', 'NotebookEdit']
const CHECK_KINDS: readonly string[] = ['test', 'build', 'lint', 'typecheck']
const REF_KEYS: readonly string[] = ['command', 'file_path', 'notebook_path', 'path', 'pattern', 'url', 'query', 'description', 'skill']
const REJECTED = /permission to use .{0,80} has been denied|user (?:rejected|declined|denied)|rejected this tool|doesn't want to proceed/i

/* ---------- privacy: masking and caps ---------- */

// Specific shapes first; `keep` patterns keep their first group (the key) and mask only the value.
const SECRETS: readonly { re: RegExp; keep: boolean }[] = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, keep: false },
  { re: /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}/g, keep: false },
  { re: /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{16,}/g, keep: false },
  { re: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/g, keep: false },
  { re: /xox[baprs]-[A-Za-z0-9-]{8,}/g, keep: false },
  { re: /AIza[0-9A-Za-z_-]{30,}/g, keep: false },
  { re: /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g, keep: false },
  { re: /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, keep: false },
  { re: /(:\/\/[^\s:@/]+:)[^\s@/]+(?=@)/g, keep: true },
  { re: /((?:api[_-]?key|secret|token|passw(?:or)?d|pwd|authorization)[A-Za-z0-9_.-]*\s*[:=]\s*['"]?)[^\s'"&,;]{6,}/gi, keep: true },
  { re: /(?<![A-Za-z0-9])(?=[A-Za-z0-9_-]*[A-Za-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{32,}/g, keep: false },
]

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g

function mask(text: string): string {
  let out = text
  for (const p of SECRETS) out = out.replace(p.re, p.keep ? `$1${MASK}` : MASK)
  return out
}

/** One flat line, secrets masked, at most `max` characters (counted in code points, so Hebrew and emoji are safe). */
function clean(raw: string, max: number): string {
  const flat = raw.slice(0, max * 6).replace(ANSI, '').replace(/\s+/g, ' ').trim()
  return Array.from(mask(flat)).slice(0, max).join('')
}

function clip(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`
}

function clipTail(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length <= max ? text : `…${chars.slice(chars.length - (max - 1)).join('')}`
}

/* ---------- small helpers ---------- */

function two(n: number): string {
  return String(n).padStart(2, '0')
}

function hhmm(ms: number): string {
  const d = new Date(ms)
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}

function hhmmss(ms: number): string {
  const d = new Date(ms)
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

function mk(kind: Kind, text: string, at: number, extra: { ok?: boolean; ref?: string; turnId?: string } = {}): Ev {
  const ev: Ev = { at, kind, text }
  if (extra.ok !== undefined) ev.ok = extra.ok
  if (extra.ref !== undefined && extra.ref !== '') ev.ref = extra.ref
  if (extra.turnId !== undefined && extra.turnId !== '') ev.turnId = extra.turnId
  return ev
}

/** A short, masked reference to what a call is about: the command, the file, the pattern. */
function refOf(fields: Record<string, unknown>): string {
  for (const key of REF_KEYS) {
    const v = fields[key]
    if (typeof v !== 'string' || v.trim() === '') continue
    return clean(key === 'url' ? (v.split('?')[0] ?? '') : v, REF_MAX)
  }
  return ''
}

function fieldsOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function errorOf(result: ToolCallOutput): string {
  if (typeof result.text === 'string' && result.text !== '') return result.text
  const raw = result.result as unknown
  return typeof raw === 'string' ? raw : ''
}

function evId(ev: Ev): string {
  return `${ev.at}|${ev.kind}|${ev.text}`
}

function glyphOf(ev: Ev): string {
  return ev.kind === 'check' && ev.ok === false ? '✗' : GLYPH[ev.kind]
}

function levelOf(ev: Ev): Level {
  if (ev.kind === 'error') return 'alert'
  if (ev.kind === 'check') return ev.ok === false ? 'warn' : 'ok'
  if (ev.kind === 'incident') return 'warn'
  if (ev.kind === 'approval' || ev.kind === 'turn') return 'info'
  return 'ok'
}

/** What a row says: a tool call is its name and what it was about. */
function displayOf(ev: Ev): string {
  return ev.kind === 'tool' && ev.ref !== undefined ? `${ev.text} · ${ev.ref}` : ev.text
}

function filterOf(kind: Kind): FilterId | undefined {
  return FILTERS.find(f => f.kind === kind)?.id
}

/** Newest first; events of the same millisecond keep their reverse order of arrival. */
function newestFirst(events: readonly Ev[]): Ev[] {
  return events
    .map((ev, i) => ({ ev, i }))
    .sort((a, b) => b.ev.at - a.ev.at || b.i - a.i)
    .map(x => x.ev)
}

function visible(events: readonly Ev[], hidden: readonly FilterId[]): Ev[] {
  return newestFirst(events).filter(ev => {
    const f = filterOf(ev.kind)
    return f === undefined || !hidden.includes(f)
  })
}

function checkLabel(kind: string): string {
  if (kind === 'test') return t(T.cTest)
  if (kind === 'build') return t(T.cBuild)
  if (kind === 'lint') return t(T.cLint)
  return t(T.cTypecheck)
}

function rangeOf(events: readonly Ev[]): { from: number; to: number } {
  let from = Number.POSITIVE_INFINITY
  let to = 0
  for (const ev of events) {
    if (ev.at < from) from = ev.at
    if (ev.at > to) to = ev.at
  }
  return { from, to }
}

/** The filtered view as plain text, oldest first. */
function exportText(events: readonly Ev[], hidden: readonly FilterId[]): string {
  const view = visible(events, hidden).reverse()
  const lines = view.map(ev => {
    const extra = ev.ref !== undefined && ev.kind !== 'tool' ? ` [${ev.ref}]` : ''
    return `${hhmmss(ev.at)} ${glyphOf(ev)} ${displayOf(ev)}${extra}`
  })
  return [t(T.exportTitle, { n: view.length }), ...lines].join('\n')
}

function sanitize(raw: unknown): Ev[] {
  if (!Array.isArray(raw)) return []
  const out: Ev[] = []
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const at = r['at']
    const kind = r['kind']
    const text = r['text']
    if (typeof at !== 'number' || typeof kind !== 'string' || !KINDS.includes(kind) || typeof text !== 'string') continue
    const ref = r['ref']
    const turnId = r['turnId']
    out.push(
      mk(kind as Kind, text.slice(0, TEXT_MAX), at, {
        ...(typeof r['ok'] === 'boolean' ? { ok: r['ok'] } : {}),
        ...(typeof ref === 'string' ? { ref } : {}),
        ...(typeof turnId === 'string' ? { turnId } : {}),
      }),
    )
  }
  return out.slice(-MAX)
}

/* ---------- state writes ---------- */

async function sessionKey($: EngineInterface): Promise<string> {
  let sid = (await read($, replay)).sid
  if (sid === '') {
    try {
      sid = await $.session.id()
    } catch {
      sid = ''
    }
    if (sid !== '') await update($, replay, s => ({ ...s, sid }))
  }
  return `${feature.id}:${sid === '' ? 'session' : sid}`
}

async function persist($: EngineInterface): Promise<void> {
  const s = await read($, replay)
  if (!s.keep) return
  try {
    await $.store.set(await sessionKey($), s.events as never)
  } catch {
    // the replay still lives in memory
  }
}

/** Appends events to the ring of 500 (and to the store when "keep" is on), applying `patch` in the same write. */
async function push($: EngineInterface, items: Ev[], patch: Partial<State> = {}): Promise<void> {
  if (items.length === 0 && Object.keys(patch).length === 0) return
  await update($, replay, s => ({ ...s, ...patch, events: [...s.events, ...items].slice(-MAX) }))
  if (items.length > 0) await persist($)
}

async function toggleFilter($: EngineInterface, id: FilterId): Promise<void> {
  await update($, replay, s => ({ ...s, hidden: s.hidden.includes(id) ? s.hidden.filter(x => x !== id) : [...s.hidden, id] }))
}

async function toggleOpen($: EngineInterface, id: string): Promise<void> {
  await update($, replay, s => ({ ...s, open: s.open === id ? '' : id }))
}

async function setKeep($: EngineInterface, on: boolean): Promise<void> {
  await update($, replay, s => ({ ...s, keep: on }))
  try {
    await $.store.set(KEEP_KEY, on)
    if (on) await persist($)
    else await $.store.delete(await sessionKey($))
  } catch {
    // the switch still holds for this session
  }
  await notice($, 'info', t(on ? T.keepNowOn : T.keepNowOff), feature.id, { immediate: true })
}

async function clearAll($: EngineInterface): Promise<void> {
  await update($, replay, s => ({ ...s, events: [], open: '', seen: [] }))
  const s = await read($, replay)
  if (s.keep) {
    try {
      await $.store.set(await sessionKey($), [] as never)
    } catch {
      // nothing more to do
    }
  }
  await notice($, 'info', t(T.cleared), feature.id, { immediate: true })
}

async function copyView($: EngineInterface): Promise<void> {
  const s = await read($, replay)
  const view = visible(s.events, s.hidden)
  if (view.length === 0) {
    await notice($, 'info', t(T.nothingToCopy), feature.id, { immediate: true })
    return
  }
  const r = await $.ui.copy({ text: exportText(s.events, s.hidden) })
  if (r.isCopied) await notice($, 'info', t(T.copied), feature.id, { immediate: true })
  else await notice($, 'warn', t(T.copyFailed, { why: r.reason }), feature.id, { immediate: true })
}

/* ---------- handlers ---------- */

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'replay', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'replay', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  let keep = false
  let sid = ''
  let stored: Ev[] = []
  try {
    keep = (await $.store.get(KEEP_KEY)) === true
    sid = await $.session.id()
    if (keep) stored = sanitize(await $.store.get(`${feature.id}:${sid}`))
  } catch {
    // an unreadable store leaves the replay empty and session-only
  }
  await update($, replay, s => ({ ...s, keep, sid, events: [...stored, ...s.events].slice(-MAX) }))
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'> | { drop: string }> {
  if (!(await isOn($, feature))) return e
  const text = e.text.trim()
  if (text === '' || text.startsWith('/')) return e
  const prompt = clean(text, PROMPT_MAX)
  await update($, replay, s => (s.prompt === prompt ? s : { ...s, prompt }))
  return e
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  const now = await $.clock.now()
  const s = await read($, replay)
  const fromText = e.text.trim().startsWith('/') ? '' : clean(e.text, PROMPT_MAX)
  const label = s.prompt !== '' ? s.prompt : fromText !== '' ? fromText : t(T.turnFallback)
  await push($, [mk('turn', label, now, { turnId: e.turnId })], { prompt: '', turnAt: now, turnId: e.turnId, pendingTool: '', pendingRef: '' })
}

export async function afterToolCheck($: EngineInterface, e: Input<'tool.check'>, verdict: Output<'tool.check'>): Promise<Output<'tool.check'>> {
  if (verdict.decision !== 'ask' || !(await isOn($, feature))) return verdict
  const now = await $.clock.now()
  const s = await read($, replay)
  const ref = refOf(fieldsOf(e.input))
  const what = ref === '' ? e.tool : `${e.tool} · ${ref}`
  await push($, [mk('approval', clean(t(T.asked, { what }), TEXT_MAX), now, { ref, turnId: s.turnId })], { pendingTool: e.tool, pendingRef: ref })
  return verdict
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  const now = await $.clock.now()
  const s = await read($, replay)
  const items: Ev[] = []
  const patch: Partial<State> = {}

  let refused = false
  if (s.pendingTool !== '' && s.pendingTool === e.tool) {
    patch.pendingTool = ''
    patch.pendingRef = ''
    refused = result.deny !== undefined || (result.isError === true && REJECTED.test(errorOf(result)))
    const what = s.pendingRef === '' ? e.tool : `${e.tool} · ${s.pendingRef}`
    items.push(mk('approval', clean(t(refused ? T.denied : T.approved, { what }), TEXT_MAX), now, { ok: !refused, ref: s.pendingRef, turnId: s.turnId }))
  }

  // A call the person refused is logged once, as the denied approval, not again as an error.
  if (result.deny === undefined && !refused) {
    const ref = refOf(fieldsOf(e))
    if (result.isError === true) {
      const raw = errorOf(result)
      const text = clean(raw, TEXT_MAX)
      items.push(mk('error', text === '' ? t(T.toolError) : text, now, { ok: false, ref: ref === '' ? e.tool : `${e.tool} · ${ref}`, turnId: s.turnId }))
    } else if (!EDIT_TOOLS.includes(e.tool)) {
      items.push(mk('tool', e.tool, now, { ok: true, ref, turnId: s.turnId }))
    }
  }

  await push($, items, patch)
  return result
}

export async function afterEditCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  // An errored edit is logged by afterToolCall as an error.
  if (result.deny !== undefined || result.isError === true) return result
  const fields = fieldsOf(e)
  const path = fields['file_path'] ?? fields['notebook_path']
  if (typeof path !== 'string' || path === '') return result
  const now = await $.clock.now()
  const s = await read($, replay)
  await push($, [mk('edit', clean(path, TEXT_MAX), now, { ok: true, ref: e.tool, turnId: s.turnId })])
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  const now = await $.clock.now()
  const s = await read($, replay)
  const items: Ev[] = []
  const keys: string[] = []

  for (const x of await allEvidence($)) {
    if (!CHECK_KINDS.includes(x.kind) || x.at < s.turnAt) continue
    const key = `e|${x.at}|${x.kind}|${x.ref}`
    if (s.seen.includes(key) || keys.includes(key)) continue
    keys.push(key)
    items.push(mk('check', clean(`${checkLabel(x.kind)}: ${x.summary}`, TEXT_MAX), x.at, { ok: x.ok, ref: clean(x.ref, TEXT_MAX), turnId: x.turnId ?? s.turnId }))
  }

  for (const sig of await current($)) {
    if (sig.kind !== 'incident') continue
    const key = `s|${sig.id}|${sig.at}|${sig.value ?? ''}`
    if (s.seen.includes(key) || keys.includes(key)) continue
    keys.push(key)
    const at = sig.at >= s.turnAt && sig.at <= now ? sig.at : now
    items.push(mk('incident', clean(sig.text, TEXT_MAX), at, { ok: false, ref: sig.feature, turnId: s.turnId }))
  }

  const time = clockText(e.durationMs)
  const failed = e.reason === 'error'
  const text = failed ? t(T.turnFailed, { time }) : e.isAborted ? t(T.turnStopped, { time }) : t(T.turnEnded, { time })
  items.push(mk('turn', text, now, { ok: !failed && !e.isAborted, turnId: e.turnId }))

  await push($, items, { seen: [...s.seen, ...keys].slice(-SEEN_MAX), turnAt: 0, pendingTool: '', pendingRef: '' })
}

/** No chip: the replay is a pane, not a band signal. */
export async function renderChip($: EngineInterface, _e: BandInput): Promise<Chip | null> {
  return null
}

/** The last 8 events, newest first. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null
  const { Box } = $.ui.resolve(e)
  const s = await read($, replay)
  const last = newestFirst(s.events).slice(0, 8)
  if (last.length === 0) return emptyState($, e, t(T.empty), t(T.emptyHint))
  return (
    <Box flexDirection="column">
      {last.map((ev, i) =>
        listRow($, e, {
          key: `rp-d-${i}`,
          left: `${hhmmss(ev.at)} ${glyphOf(ev)}`,
          text: clip(displayOf(ev), 80),
          level: levelOf(ev),
        }),
      )}
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'replay' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const args = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
    if (args === '') {
      await $.ui.open({ id: PANE, title: t(T.paneTitle) })
      return { text: t(T.opened) }
    }
    if (args === 'keep') return { text: t((await read($, replay)).keep ? T.keepIsOn : T.keepIsOff) }
    if (args === 'keep on' || args === 'keep off') {
      await setKeep($, args === 'keep on')
      return { text: t(args === 'keep on' ? T.keepNowOn : T.keepNowOff) }
    }
    if (args === 'clear') {
      await clearAll($)
      return { text: t(T.cleared) }
    }
    return { text: t(T.usage) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const s = await read($, replay)
    const view = visible(s.events, s.hidden)
    const range = rangeOf(view)

    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: view.length === 0 ? undefined : t(T.status, { n: view.length, from: hhmm(range.from), to: hhmm(range.to) }),
      icon: ICONS.visibility,
      actions: [
        ...FILTERS.map(f => ({
          key: `rp-f-${f.id}`,
          label: `${s.hidden.includes(f.id) ? '○' : '●'} ${t(f.label)}`,
          onPress: () => void toggleFilter($, f.id),
        })),
        { key: 'rp-copy', label: t(T.btnCopy), onPress: () => void copyView($) },
        { key: 'rp-keep', label: t(T.btnKeep, { state: t(s.keep ? T.stateOn : T.stateOff) }), onPress: () => void setKeep($, !s.keep) },
        { key: 'rp-clear', label: t(T.btnClear), onPress: () => void clearAll($) },
      ],
    })
    const foot = (
      <Text dimColor size="footnote">
        {t(s.keep ? T.footKept : T.footSession)}
      </Text>
    )

    if (s.events.length === 0) {
      return (
        <Box flexDirection="column">
          {header}
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
          {foot}
        </Box>
      )
    }
    if (view.length === 0) {
      return (
        <Box flexDirection="column">
          {header}
          {emptyState($, e, t(T.noMatch), t(T.noMatchHint))}
          {foot}
        </Box>
      )
    }

    const shown = view.slice(0, SHOWN)
    const older = view.length - shown.length
    return (
      <Box flexDirection="column">
        {header}
        {shown.map((ev, i) => {
          const id = evId(ev)
          const isOpen = s.open === id
          const full = displayOf(ev)
          const row = listRow($, e, {
            key: `rp-r-${i}`,
            left: `${hhmmss(ev.at)} ${glyphOf(ev)}`,
            text: isOpen ? full : ev.kind === 'edit' ? clipTail(full, COLLAPSED) : clip(full, COLLAPSED),
            level: levelOf(ev),
            onPress: () => void toggleOpen($, id),
          })
          if (!isOpen) return row
          const refLine = ev.ref !== undefined && ev.kind !== 'tool' ? `${t(T.refLabel)}: ${ev.ref}` : ''
          const turnLine = ev.turnId !== undefined ? `${t(T.turnLabel)}: ${ev.turnId}` : ''
          return (
            <Box key={`rp-x-${i}`} flexDirection="column">
              {row}
              {refLine !== '' ? (
                <Text dimColor size="footnote">
                  {refLine}
                </Text>
              ) : null}
              {turnLine !== '' ? (
                <Text dimColor size="footnote">
                  {turnLine}
                </Text>
              ) : null}
            </Box>
          )
        })}
        {older > 0 ? <Text dimColor>{t(T.older, { n: older })}</Text> : null}
        {foot}
      </Box>
    )
  })
}
