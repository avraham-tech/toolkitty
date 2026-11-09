import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, storeGet, t } from '../core'
import type { BandLine, Feature, Input, Localized, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { allEvidence } from '../evidence'
import { current } from '../signals'
import { emptyState, listRow, paneHeader, sectionTitle } from '../ui'

/*
 * One-click handoff. `/handoff` (registered by idle-handoff, which calls
 * `openHandoff` below) opens a preview pane with a draft of what the session
 * knows: the objective, what is done, the decisions, the files, the known
 * failures, what was verified, the constraints and the next step. The person
 * can add notes, copy the draft, refresh it, and press "Compact now"; only
 * that press compacts, and the compaction instructions are the draft itself.
 * The draft is assembled from what was observed (prompts, TodoWrite, edits,
 * evidence, signals) and from the store, never from the model's own claims.
 */

// Sent to the model, so it stays English in every language.
const HEAD =
  'Compact the conversation so that it keeps the handoff below and nothing it leaves out matters. Keep every item of it (the objective, what is done, the decisions and why, the files with what changed, the known failures, what was verified, the constraints and the next step) and the extra notes. Drop exploratory dead ends, raw tool output and anything already resolved.'

const T = {
  title: {
    en: 'Handoff preview',
    he: 'תצוגה מקדימה להעברה',
    es: 'Vista previa del traspaso',
    fr: 'Aperçu du relais',
    ru: 'Предпросмотр передачи',
    zh: '交接预览',
    ja: '引き継ぎプレビュー',
    pt: 'Prévia da transferência',
    de: 'Übergabe-Vorschau',
    ko: '인수인계 미리보기',
  },
  description: {
    en: '/handoff shows a draft of the goal, what is done, decisions, files, failures and next step, lets you add notes, and compacts the session with exactly that draft when you press Compact now.',
    he: '/handoff מציג טיוטה של המטרה, מה הושלם, החלטות, קבצים, כשלים והצעד הבא, מאפשר להוסיף הערות, ודוחס את הסשן בדיוק לפי הטיוטה כשלוחצים על דחוס עכשיו.',
    es: '/handoff muestra un borrador del objetivo, lo hecho, las decisiones, los archivos, los fallos y el siguiente paso, permite añadir notas y compacta la sesión con ese borrador al pulsar Compactar ahora.',
    fr: '/handoff affiche un brouillon de l’objectif, du travail fait, des décisions, des fichiers, des échecs et de la suite, permet d’ajouter des notes et compacte la session avec ce brouillon quand tu appuies sur Compacter maintenant.',
    ru: '/handoff показывает черновик цели, сделанного, решений, файлов, сбоев и следующего шага, позволяет добавить заметки и сжимает сессию именно по этому черновику после нажатия «Сжать сейчас».',
    zh: '/handoff 会显示一份草稿，包含目标、已完成的内容、决策、文件、失败和下一步，可以添加备注，并在你按下“立即压缩”时严格按该草稿压缩会话。',
    ja: '/handoff は目標、完了した内容、決定事項、ファイル、失敗、次のステップのドラフトを表示し、メモを追加でき、「今すぐ圧縮」を押すとそのドラフトどおりにセッションを圧縮します。',
    pt: '/handoff mostra um rascunho com o objetivo, o que foi feito, decisões, arquivos, falhas e próximo passo, permite adicionar notas e compacta a sessão exatamente com esse rascunho quando você pressiona Compactar agora.',
    de: '/handoff zeigt einen Entwurf mit Ziel, Erledigtem, Entscheidungen, Dateien, Fehlern und nächstem Schritt, lässt dich Notizen ergänzen und komprimiert die Session genau mit diesem Entwurf, wenn du auf „Jetzt komprimieren“ drückst.',
    ko: '/handoff는 목표, 완료된 일, 결정 사항, 파일, 실패, 다음 단계의 초안을 보여주고, 메모를 추가할 수 있으며, 지금 압축을 누르면 정확히 그 초안으로 세션을 압축합니다.',
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
    de: 'Die Funktion ist aus; schalte sie im /toolkitty-Bereich ein',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  opened: {
    en: 'The handoff preview is open. Nothing is compacted until you press Compact now.',
    he: 'התצוגה המקדימה להעברה נפתחה. שום דבר לא נדחס עד שתלחץ על דחוס עכשיו.',
    es: 'La vista previa del traspaso está abierta. No se compacta nada hasta que pulses Compactar ahora.',
    fr: 'L’aperçu du relais est ouvert. Rien n’est compacté avant que tu appuies sur Compacter maintenant.',
    ru: 'Предпросмотр передачи открыт. Ничего не сжимается, пока вы не нажмёте «Сжать сейчас».',
    zh: '交接预览已打开。在你点击“立即压缩”之前不会压缩任何内容。',
    ja: '引き継ぎプレビューを開きました。「今すぐ圧縮」を押すまで何も圧縮されません。',
    pt: 'A prévia da transferência está aberta. Nada é compactado até você pressionar Compactar agora.',
    de: 'Die Übergabe-Vorschau ist geöffnet. Nichts wird komprimiert, bis du auf „Jetzt komprimieren“ drückst.',
    ko: '인수인계 미리보기가 열려 있습니다. 지금 압축을 누르기 전에는 아무것도 압축되지 않습니다.',
  },
  paneTitle: { en: 'Handoff', he: 'העברה', es: 'Traspaso', fr: 'Relais', ru: 'Передача', zh: '交接', ja: '引き継ぎ', pt: 'Transferência', de: 'Übergabe', ko: '인수인계' },
  paneOff: {
    en: 'The handoff preview is off.',
    he: 'התצוגה המקדימה להעברה כבויה.',
    es: 'La vista previa del traspaso está desactivada.',
    fr: 'L\'aperçu du relais est désactivé.',
    ru: 'Предпросмотр передачи отключён.',
    zh: '交接预览已关闭。',
    ja: '引き継ぎプレビューはオフです。',
    pt: 'A prévia da transferência está desativada.',
    de: 'Die Übergabe-Vorschau ist aus.',
    ko: '인수인계 미리보기가 꺼져 있습니다.',
  },
  noMobile: {
    en: 'The handoff preview is not available on this screen; use the desktop or the terminal.',
    he: 'התצוגה המקדימה להעברה אינה זמינה במסך הזה; השתמש בשולחן העבודה או בטרמינל.',
    es: 'La vista previa del traspaso no está disponible en esta pantalla; usa el escritorio o la terminal.',
    fr: "L’aperçu du relais n’est pas disponible sur cet écran ; utilise le bureau ou le terminal.",
    ru: 'Предпросмотр передачи недоступен на этом экране; используйте компьютер или терминал.',
    zh: '此界面不支持交接预览；请使用桌面端或终端。',
    ja: 'この画面では引き継ぎプレビューを使えません。デスクトップ版またはターミナルを使ってください。',
    pt: 'A prévia da transferência não está disponível nesta tela; use o desktop ou o terminal.',
    de: 'Die Übergabe-Vorschau ist auf diesem Bildschirm nicht verfügbar; nutze den Desktop oder das Terminal.',
    ko: '이 화면에서는 인수인계 미리보기를 사용할 수 없습니다. 데스크톱 앱이나 터미널을 사용하세요.',
  },
  statusDraft: { en: 'draft', he: 'טיוטה', es: 'borrador', fr: 'brouillon', ru: 'черновик', zh: '草稿', ja: 'ドラフト', pt: 'rascunho', de: 'Entwurf', ko: '초안' },
  statusBusy: { en: 'compacting', he: 'דוחס', es: 'compactando', fr: 'compactage', ru: 'сжатие', zh: '压缩中', ja: '圧縮中', pt: 'compactando', de: 'wird komprimiert', ko: '압축 중' },
  warning: {
    en: 'Compaction keeps only what this draft says; everything else is dropped.',
    he: 'הדחיסה שומרת רק את מה שהטיוטה הזו אומרת; כל השאר נזרק.',
    es: 'La compactación conserva solo lo que dice este borrador; todo lo demás se descarta.',
    fr: 'Le compactage ne garde que ce que dit ce brouillon ; tout le reste est abandonné.',
    ru: 'Сжатие сохранит только то, что сказано в этом черновике; всё остальное будет отброшено.',
    zh: '压缩只保留此草稿中的内容；其余全部丢弃。',
    ja: '圧縮ではこのドラフトの内容だけが残り、それ以外は破棄されます。',
    pt: 'A compactação mantém apenas o que este rascunho diz; todo o resto é descartado.',
    de: 'Die Komprimierung behält nur, was in diesem Entwurf steht; alles andere wird verworfen.',
    ko: '압축하면 이 초안에 적힌 내용만 남고 나머지는 모두 버려집니다.',
  },
  empty: {
    en: 'No handoff draft yet.',
    he: 'עדיין אין טיוטת העברה.',
    es: 'Aún no hay borrador de traspaso.',
    fr: 'Pas encore de brouillon de relais.',
    ru: 'Черновика передачи пока нет.',
    zh: '还没有交接草稿。',
    ja: '引き継ぎのドラフトはまだありません。',
    pt: 'Ainda sem rascunho de transferência.',
    de: 'Noch kein Übergabe-Entwurf.',
    ko: '아직 인수인계 초안이 없습니다.',
  },
  emptyHint: {
    en: 'Run /handoff to build one from this session.',
    he: 'הרץ /handoff כדי לבנות אחת מהסשן הזה.',
    es: 'Ejecuta /handoff para crear uno a partir de esta sesión.',
    fr: 'Lance /handoff pour en créer un à partir de cette session.',
    ru: 'Запустите /handoff, чтобы собрать его из этой сессии.',
    zh: '运行 /handoff，根据本会话生成一份。',
    ja: '/handoff を実行すると、このセッションから作成できます。',
    pt: 'Execute /handoff para criar um a partir desta sessão.',
    de: 'Führe /handoff aus, um einen aus dieser Session zu erstellen.',
    ko: '/handoff를 실행해 이 세션에서 초안을 만드세요.',
  },
  compact: { en: 'Compact now', he: 'דחוס עכשיו', es: 'Compactar ahora', fr: 'Compacter maintenant', ru: 'Сжать сейчас', zh: '立即压缩', ja: '今すぐ圧縮', pt: 'Compactar agora', de: 'Jetzt komprimieren', ko: '지금 압축' },
  copy: { en: 'Copy', he: 'העתק', es: 'Copiar', fr: 'Copier', ru: 'Копировать', zh: '复制', ja: 'コピー', pt: 'Copiar', de: 'Kopieren', ko: '복사' },
  refresh: { en: 'Refresh', he: 'רענן', es: 'Actualizar', fr: 'Actualiser', ru: 'Обновить', zh: '刷新', ja: '更新', pt: 'Atualizar', de: 'Aktualisieren', ko: '새로고침' },
  cancel: { en: 'Cancel', he: 'ביטול', es: 'Cancelar', fr: 'Annuler', ru: 'Отмена', zh: '取消', ja: 'キャンセル', pt: 'Cancelar', de: 'Abbrechen', ko: '취소' },
  notesLabel: { en: 'Extra notes', he: 'הערות נוספות', es: 'Notas adicionales', fr: 'Notes supplémentaires', ru: 'Дополнительные заметки', zh: '附加备注', ja: '追加メモ', pt: 'Notas extras', de: 'Zusätzliche Notizen', ko: '추가 메모' },
  notesPlaceholder: {
    en: 'Anything else the next context must know',
    he: 'כל דבר נוסף שההקשר הבא חייב לדעת',
    es: 'Cualquier otra cosa que el siguiente contexto deba saber',
    fr: 'Tout ce que le prochain contexte doit savoir',
    ru: 'Всё, что должен знать следующий контекст',
    zh: '下一个上下文还必须知道的其他信息',
    ja: '次のコンテキストが知っておくべきその他の事項',
    pt: 'Qualquer outra coisa que o próximo contexto precise saber',
    de: 'Alles andere, was der nächste Kontext wissen muss',
    ko: '다음 컨텍스트가 꼭 알아야 할 다른 내용',
  },
  secObjective: { en: 'Objective', he: 'מטרה', es: 'Objetivo', fr: 'Objectif', ru: 'Цель', zh: '目的', ja: '目的', pt: 'Objetivo', de: 'Ziel', ko: '목표' },
  secDone: { en: 'Done', he: 'הושלם', es: 'Hecho', fr: 'Fait', ru: 'Сделано', zh: '已完成', ja: '完了', pt: 'Concluído', de: 'Erledigt', ko: '완료' },
  secDecisions: { en: 'Decisions', he: 'החלטות', es: 'Decisiones', fr: 'Décisions', ru: 'Решения', zh: '决策', ja: '決定事項', pt: 'Decisões', de: 'Entscheidungen', ko: '결정 사항' },
  secFiles: { en: 'Files', he: 'קבצים', es: 'Archivos', fr: 'Fichiers', ru: 'Файлы', zh: '文件', ja: 'ファイル', pt: 'Arquivos', de: 'Dateien', ko: '파일' },
  secFailures: { en: 'Known failures', he: 'כשלים ידועים', es: 'Fallos conocidos', fr: 'Échecs connus', ru: 'Известные сбои', zh: '已知失败', ja: '既知の失敗', pt: 'Falhas conhecidas', de: 'Bekannte Fehler', ko: '알려진 실패' },
  secVerified: { en: 'Verified results', he: 'תוצאות מאומתות', es: 'Resultados verificados', fr: 'Résultats vérifiés', ru: 'Проверенные результаты', zh: '已验证的结果', ja: '検証済みの結果', pt: 'Resultados verificados', de: 'Verifizierte Ergebnisse', ko: '검증된 결과' },
  secConstraints: { en: 'Constraints', he: 'אילוצים', es: 'Restricciones', fr: 'Contraintes', ru: 'Ограничения', zh: '约束', ja: '制約', pt: 'Restrições', de: 'Einschränkungen', ko: '제약 사항' },
  secNext: { en: 'Next recommended action', he: 'הפעולה המומלצת הבאה', es: 'Siguiente acción recomendada', fr: 'Prochaine action recommandée', ru: 'Следующее рекомендуемое действие', zh: '建议的下一步操作', ja: '次に推奨するアクション', pt: 'Próxima ação recomendada', de: 'Empfohlene nächste Aktion', ko: '다음 권장 작업' },
  secNotes: { en: 'Extra notes', he: 'הערות נוספות', es: 'Notas adicionales', fr: 'Notes supplémentaires', ru: 'Дополнительные заметки', zh: '附加备注', ja: '追加メモ', pt: 'Notas extras', de: 'Zusätzliche Notizen', ko: '추가 메모' },
  none: { en: 'none', he: 'אין', es: 'ninguno', fr: 'aucun', ru: 'нет', zh: '无', ja: 'なし', pt: 'nenhum', de: 'keine', ko: '없음' },
  thenPrompt: { en: 'Then: {text}', he: 'אחר כך: {text}', es: 'Después: {text}', fr: 'Ensuite : {text}', ru: 'Затем: {text}', zh: '然后：{text}', ja: 'その後：{text}', pt: 'Depois: {text}', de: 'Danach: {text}', ko: '그다음: {text}' },
  remaining: { en: 'Remaining: {text}', he: 'נותר: {text}', es: 'Pendiente: {text}', fr: 'Restant : {text}', ru: 'Осталось: {text}', zh: '剩余：{text}', ja: '残り：{text}', pt: 'Restante: {text}', de: 'Verbleibend: {text}', ko: '남은 작업: {text}' },
  filesChanged: { en: 'Files changed: {n}', he: 'קבצים ששונו: {n}', es: 'Archivos cambiados: {n}', fr: 'Fichiers modifiés : {n}', ru: 'Изменено файлов: {n}', zh: '已更改文件：{n}', ja: '変更したファイル：{n}', pt: 'Arquivos alterados: {n}', de: 'Geänderte Dateien: {n}', ko: '변경된 파일: {n}' },
  more: { en: '... and {n} more', he: '... ועוד {n}', es: '... y {n} más', fr: '... et {n} de plus', ru: '... и ещё {n}', zh: '……以及另外 {n} 项', ja: '… ほか {n} 件', pt: '... e mais {n}', de: '... und {n} weitere', ko: '... 외 {n}개' },
  nextTodo: { en: 'Continue with: {text}', he: 'המשך עם: {text}', es: 'Continuar con: {text}', fr: 'Poursuivre avec : {text}', ru: 'Продолжить: {text}', zh: '继续：{text}', ja: '続き：{text}', pt: 'Continue com: {text}', de: 'Weiter mit: {text}', ko: '다음으로 계속: {text}' },
  nextFailure: {
    en: 'Continue from the last failure: {text}',
    he: 'המשך מהכשל האחרון: {text}',
    es: 'Continuar desde el último fallo: {text}',
    fr: 'Reprendre au dernier échec : {text}',
    ru: 'Продолжить с последнего сбоя: {text}',
    zh: '从上一次失败处继续：{text}',
    ja: '直近の失敗から再開：{text}',
    pt: 'Continue a partir da última falha: {text}',
    de: 'Weiter ab dem letzten Fehler: {text}',
    ko: '마지막 실패부터 계속: {text}',
  },
  nextNone: {
    en: 'No open item is recorded; confirm the next step first.',
    he: 'לא נרשם פריט פתוח; אשר קודם את הצעד הבא.',
    es: 'No hay ningún pendiente registrado; confirma primero el siguiente paso.',
    fr: 'Aucun point ouvert n’est enregistré ; confirme d’abord la suite.',
    ru: 'Открытых пунктов нет; сначала уточните следующий шаг.',
    zh: '没有记录未完成事项；请先确认下一步。',
    ja: '未完了の項目は記録されていません。まず次のステップを確認してください。',
    pt: 'Nenhum item em aberto registrado; confirme primeiro o próximo passo.',
    de: 'Kein offener Punkt erfasst; bestätige zuerst den nächsten Schritt.',
    ko: '열린 항목이 기록되어 있지 않습니다. 먼저 다음 단계를 확인하세요.',
  },
  copied: { en: 'Handoff draft copied.', he: 'טיוטת ההעברה הועתקה.', es: 'Borrador del traspaso copiado.', fr: 'Brouillon du relais copié.', ru: 'Черновик передачи скопирован.', zh: '已复制交接草稿。', ja: '引き継ぎドラフトをコピーしました。', pt: 'Rascunho de transferência copiado.', de: 'Übergabe-Entwurf kopiert.', ko: '인수인계 초안을 복사했습니다.' },
  copyFailed: {
    en: 'Could not copy the handoff draft.',
    he: 'לא ניתן להעתיק את טיוטת ההעברה.',
    es: 'No se pudo copiar el borrador del traspaso.',
    fr: 'Impossible de copier le brouillon du relais.',
    ru: 'Не удалось скопировать черновик передачи.',
    zh: '无法复制交接草稿。',
    ja: '引き継ぎドラフトをコピーできませんでした。',
    pt: 'Não foi possível copiar o rascunho de transferência.',
    de: 'Der Übergabe-Entwurf konnte nicht kopiert werden.',
    ko: '인수인계 초안을 복사할 수 없습니다.',
  },
  compacted: {
    en: 'Session compacted. Context: {before} -> {after} tokens.',
    he: 'הסשן נדחס. הקשר: {before} -> {after} טוקנים.',
    es: 'Sesión compactada. Contexto: {before} -> {after} tokens.',
    fr: 'Session compactée. Contexte : {before} -> {after} tokens.',
    ru: 'Сессия сжата. Контекст: {before} -> {after} токенов.',
    zh: '会话已压缩。上下文：{before} → {after} token。',
    ja: 'セッションを圧縮しました。コンテキスト：{before} → {after} トークン。',
    pt: 'Sessão compactada. Contexto: {before} -> {after} tokens.',
    de: 'Session komprimiert. Kontext: {before} -> {after} Tokens.',
    ko: '세션을 압축했습니다. 컨텍스트: {before} -> {after} 토큰.',
  },
  compactedPlain: {
    en: 'Session compacted with the handoff draft.',
    he: 'הסשן נדחס לפי טיוטת ההעברה.',
    es: 'Sesión compactada con el borrador del traspaso.',
    fr: 'Session compactée avec le brouillon du relais.',
    ru: 'Сессия сжата по черновику передачи.',
    zh: '已按交接草稿压缩会话。',
    ja: '引き継ぎドラフトでセッションを圧縮しました。',
    pt: 'Sessão compactada com o rascunho de transferência.',
    de: 'Session mit dem Übergabe-Entwurf komprimiert.',
    ko: '인수인계 초안으로 세션을 압축했습니다.',
  },
  skipped: {
    en: 'Nothing was compacted: {reason}',
    he: 'לא נדחס דבר: {reason}',
    es: 'No se compactó nada: {reason}',
    fr: 'Rien n\'a été compacté : {reason}',
    ru: 'Ничего не сжато: {reason}',
    zh: '未压缩任何内容：{reason}',
    ja: '何も圧縮されませんでした：{reason}',
    pt: 'Nada foi compactado: {reason}',
    de: 'Es wurde nichts komprimiert: {reason}',
    ko: '압축된 항목 없음: {reason}',
  },
  failed: {
    en: 'Compaction failed. Try again, or use the built-in /compact.',
    he: 'הדחיסה נכשלה. נסה שוב, או השתמש ב-/compact המובנה.',
    es: 'La compactación falló. Inténtalo de nuevo o usa el /compact integrado.',
    fr: 'Le compactage a échoué. Réessaie ou utilise le /compact intégré.',
    ru: 'Не удалось сжать сессию. Повторите попытку или используйте встроенный /compact.',
    zh: '压缩失败。请重试，或使用内置的 /compact。',
    ja: '圧縮に失敗しました。もう一度試すか、組み込みの /compact を使ってください。',
    pt: 'Falha na compactação. Tente novamente ou use o /compact integrado.',
    de: 'Komprimierung fehlgeschlagen. Versuche es erneut oder nutze das eingebaute /compact.',
    ko: '압축에 실패했습니다. 다시 시도하거나 내장 /compact를 사용하세요.',
  },
} as const

type Todo = { content: string; status: 'pending' | 'in_progress' | 'completed' }
type NextStep = { kind: 'todo' | 'failure' | 'none'; text: string }
type Draft = {
  at: number
  prompts: string[]
  remaining: string[]
  completed: string[]
  decisions: string[]
  files: string[]
  failures: string[]
  verified: string[]
  constraints: string[]
  nextStep: NextStep
}
type State = { prompts: string[]; todos: Todo[]; files: string[]; draft: Draft | null; notes: string; busy: boolean }

const state = atom(
  { plugin: 'toolkitty', key: 'slot', id: 'handoff' } as const,
  { prompts: [], todos: [], files: [], draft: null, notes: '', busy: false } as State,
) as unknown as Atom<State>

export const feature: Feature = {
  id: 'handoff',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const PANE = 'handoff'
const MAX_PROMPTS = 3
const MAX_PROMPT = 300
const MAX_FILES = 200
const MAX_LINE = 220
const ROWS = 10

/** `text` in the language in use, or in English for what is sent to the model or copied. */
function say(text: Localized, english: boolean, vars?: Readonly<Record<string, string | number>>): string {
  if (!english) return t(text, vars)
  let out = text.en
  if (vars !== undefined) {
    for (const [key, value] of Object.entries(vars)) out = out.split(`{${key}}`).join(String(value))
  }
  return out
}

const clip = (text: string, max: number): string => {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`
}

const unique = (items: string[]): string[] => items.filter((x, i) => items.indexOf(x) === i)

/** Strings from a stored list of strings or of `{ text }` entries; anything else is ignored. */
function textsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string') out.push(item)
    else if (item !== null && typeof item === 'object' && typeof (item as Record<string, unknown>)['text'] === 'string') {
      out.push((item as Record<string, unknown>)['text'] as string)
    }
  }
  return out.map(x => clip(x, MAX_LINE)).filter(x => x !== '')
}

/** The todo items of a TodoWrite input, or null when the input holds none. */
function todosOf(args: Record<string, unknown>): Todo[] | null {
  const raw = args['todos']
  if (!Array.isArray(raw)) return null
  const out: Todo[] = []
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const content = r['content']
    if (typeof content !== 'string' || content.trim() === '') continue
    const status = r['status']
    out.push({ content: clip(content, MAX_LINE), status: status === 'completed' ? 'completed' : status === 'in_progress' ? 'in_progress' : 'pending' })
  }
  return out
}

function relative(path: string, cwd: string): string {
  const p = path.split('\\').join('/')
  const c = cwd.split('\\').join('/').replace(/\/+$/, '')
  return c !== '' && p.toLowerCase().startsWith(`${c.toLowerCase()}/`) ? p.slice(c.length + 1) : p
}

/** Builds a fresh draft from what was observed and from the store. Reads only; the caller saves it. */
async function assemble($: EngineInterface): Promise<Draft> {
  const s = await read($, state)
  const cwd = await $.session.cwd()
  const now = await $.clock.now()

  const decisions = textsOf(await $.store.get(`session-memory:notes:${cwd}`)).slice(-8)
  const constraints = textsOf(await $.store.get(`correction-capture:rules:${cwd}`)).slice(0, 8)

  const live = await current($, now)
  const fromSignals = live.filter(x => x.kind === 'failure' || x.kind === 'loop').map(x => clip(x.text, MAX_LINE))
  const log = await allEvidence($)
  // A failed check counts as known only until the same check passes again.
  const failedChecks = log
    .filter((x, i) => !x.ok && !log.slice(i + 1).some(y => y.ok && y.kind === x.kind && y.ref === x.ref))
    .slice(-5)
    .reverse()
    .map(x => clip(`${x.kind}: ${x.summary}`, MAX_LINE))
  const failures = unique([...fromSignals, ...failedChecks]).slice(0, 8)
  const verified = log
    .filter(x => x.ok)
    .slice(-5)
    .reverse()
    .map(x => clip(`${x.kind}: ${x.summary}`, MAX_LINE))

  const open = [...s.todos.filter(x => x.status === 'in_progress'), ...s.todos.filter(x => x.status === 'pending')]
  const remaining = open.map(x => x.content)
  const completed = s.todos.filter(x => x.status === 'completed').map(x => x.content)
  const first = open[0]
  const last = failures[0]
  const nextStep: NextStep =
    first !== undefined ? { kind: 'todo', text: first.content } : last !== undefined ? { kind: 'failure', text: last } : { kind: 'none', text: '' }

  return {
    at: now,
    prompts: s.prompts,
    remaining,
    completed,
    decisions,
    files: s.files.map(x => relative(x, cwd)),
    failures,
    verified,
    constraints,
    nextStep,
  }
}

type SectionId = 'objective' | 'done' | 'decisions' | 'files' | 'failures' | 'verified' | 'constraints' | 'next' | 'notes'
type Section = { id: SectionId; title: string; rows: string[] }

function capped(items: string[], english: boolean): string[] {
  if (items.length <= ROWS) return items
  return [...items.slice(0, ROWS), say(T.more, english, { n: items.length - ROWS })]
}

/** The draft as sections of rows; `english` for the text that is copied or sent to the model. */
function sectionsOf(d: Draft, notes: string, english: boolean): Section[] {
  const objective = [
    ...d.prompts.map((p, i) => (i === 0 ? p : say(T.thenPrompt, english, { text: p }))),
    ...capped(
      d.remaining.map(x => say(T.remaining, english, { text: x })),
      english,
    ),
  ]
  const done = [...capped(d.completed, english), ...(d.files.length > 0 ? [say(T.filesChanged, english, { n: d.files.length })] : [])]
  const nextRow =
    d.nextStep.kind === 'todo'
      ? say(T.nextTodo, english, { text: d.nextStep.text })
      : d.nextStep.kind === 'failure'
        ? say(T.nextFailure, english, { text: d.nextStep.text })
        : say(T.nextNone, english)
  const out: Section[] = [
    { id: 'objective', title: say(T.secObjective, english), rows: objective },
    { id: 'done', title: say(T.secDone, english), rows: done },
    { id: 'decisions', title: say(T.secDecisions, english), rows: d.decisions },
    { id: 'files', title: say(T.secFiles, english), rows: capped(d.files, english) },
    { id: 'failures', title: say(T.secFailures, english), rows: d.failures },
    { id: 'verified', title: say(T.secVerified, english), rows: d.verified },
    { id: 'constraints', title: say(T.secConstraints, english), rows: d.constraints },
    { id: 'next', title: say(T.secNext, english), rows: [nextRow] },
  ]
  const extra = notes
    .split('\n')
    .map(x => x.trim())
    .filter(x => x !== '')
  if (extra.length > 0) out.push({ id: 'notes', title: say(T.secNotes, english), rows: extra })
  return out
}

/** The draft as plain English text: what Copy puts on the clipboard and what the compaction is told. */
function draftText(d: Draft, notes: string): string {
  const none = say(T.none, true)
  const blocks = sectionsOf(d, notes, true).map(sec => `## ${sec.title}\n${(sec.rows.length === 0 ? [none] : sec.rows).map(r => `- ${r}`).join('\n')}`)
  return `# Handoff\n\n${blocks.join('\n\n')}`
}

/** The sections as pane rows. */
function sectionsView($: EngineInterface, e: PaneInput, list: Section[]): BandLine {
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      {list.map(sec => (
        <Box key={`sec-${sec.id}`} flexDirection="column">
          {sectionTitle($, e, sec.title)}
          {sec.rows.length === 0 ? (
            <Text dimColor>{t(T.none)}</Text>
          ) : (
            sec.rows.map((row, i) => listRow($, e, { key: `row-${sec.id}-${i}`, text: row }))
          )}
        </Box>
      ))}
    </Box>
  )
}

async function refreshDraft($: EngineInterface): Promise<void> {
  const d = await assemble($)
  await update($, state, s => ({ ...s, draft: d }))
}

async function setNotes($: EngineInterface, value: string): Promise<void> {
  await update($, state, s => (s.notes === value ? s : { ...s, notes: value }))
}

async function closePane($: EngineInterface): Promise<void> {
  await $.ui.close({ id: PANE })
}

async function copyDraft($: EngineInterface, e: PaneInput): Promise<void> {
  if (!(await isOn($, feature))) return
  const s = await read($, state)
  const d = s.draft ?? (await assemble($))
  let isCopied = false
  try {
    isCopied = (await $.ui.copy({ text: draftText(d, s.notes), surface: e.surface })).isCopied
  } catch {
    isCopied = false
  }
  if (isCopied) await notice($, 'info', t(T.copied), feature.id, { immediate: true })
  else await notice($, 'warn', t(T.copyFailed), feature.id, { immediate: true })
}

const tokensText = (n: number | undefined): string => (n === undefined ? '?' : n.toLocaleString('en-US'))

/** Compacts with the draft as instructions and tells the person what happened. Runs from a timer, never inside a command or press hook. */
async function runCompact($: EngineInterface, instructions: string): Promise<void> {
  if (!(await isOn($, feature))) {
    await update($, state, s => ({ ...s, busy: false }))
    return
  }
  let failed = false
  try {
    const result = await $.session.compact({ instructions })
    if (result.skip !== undefined) {
      await notice($, 'info', t(T.skipped, { reason: result.skip }), feature.id, { immediate: true })
    } else if (result.tokensBefore !== undefined && result.tokensAfter !== undefined) {
      await notice($, 'info', t(T.compacted, { before: tokensText(result.tokensBefore), after: tokensText(result.tokensAfter) }), feature.id, { immediate: true })
    } else {
      await notice($, 'info', t(T.compactedPlain), feature.id, { immediate: true })
    }
  } catch {
    failed = true
    await notice($, 'alert', t(T.failed), feature.id, { immediate: true })
  }
  await update($, state, s => ({ ...s, busy: false }))
  if (!failed) await closePane($)
}

/** The press on Compact now: the only way a compaction starts. */
async function compactNow($: EngineInterface): Promise<void> {
  if (!(await isOn($, feature))) return
  const s = await read($, state)
  if (s.busy) return
  const d = s.draft ?? (await assemble($))
  const instructions = `${HEAD}\n\n${draftText(d, s.notes)}`
  await update($, state, x => ({ ...x, busy: true }))
  // The engine refuses a compaction started inside a hook that holds the turn, so a timer starts it.
  $.clock.after(50, async () => {
    await runCompact($, instructions)
  })
}

/** Opens the preview pane with a fresh draft. Called by the `/handoff` command (registered in idle-handoff). */
export async function openHandoff($: EngineInterface): Promise<{ text: string }> {
  if (!(await isOn($, feature))) return { text: t(T.off) }
  await refreshDraft($)
  await $.ui.open({ id: PANE, title: t(T.paneTitle), focus: true, closeOnEscape: true })
  return { text: t(T.opened) }
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  await update($, state, () => ({ prompts: [], todos: [], files: [], draft: null, notes: '', busy: false }))
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'> | { drop: string }> {
  if (!(await isOn($, feature))) return e
  if (e.command !== undefined || e.isMeta === true || e.origin.kind === 'plugin') return e
  const text = e.text.trim()
  if (text === '' || text.startsWith('/')) return e
  await update($, state, s => (s.prompts.length >= MAX_PROMPTS ? s : { ...s, prompts: [...s.prompts, text.slice(0, MAX_PROMPT)] }))
  return e
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  const name: string = e.tool
  if (name !== 'TodoWrite' || e.agentId !== undefined) return result
  if (result.deny !== undefined || result.isError) return result
  const todos = todosOf(e as unknown as Record<string, unknown>)
  if (todos !== null) await update($, state, s => ({ ...s, todos }))
  return result
}

export async function afterEditCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (result.deny !== undefined || result.isError) return result
  const args = e as unknown as Record<string, unknown>
  const path = args['file_path'] ?? args['notebook_path']
  if (typeof path === 'string' && path !== '') {
    await update($, state, s => (s.files.includes(path) ? s : { ...s, files: [...s.files, path].slice(-MAX_FILES) }))
  }
  return result
}

/** What a press on the handoff's detail shows: the saved draft's sections. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null
  const { Box } = $.ui.resolve(e)
  const s = await read($, state)
  if (s.draft === null) return <Box flexDirection="column">{emptyState($, e, t(T.empty), t(T.emptyHint))}</Box>
  return sectionsView($, e, sectionsOf(s.draft, s.notes, false))
}

export function register(on: On) {
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>{t(T.noMobile)}</Text>
    }
    const { Box, Text, Input } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const s = await read($, state)
    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: s.busy ? t(T.statusBusy) : t(T.statusDraft),
      level: 'info',
      actions: [
        { key: 'handoff-compact', label: t(T.compact), primary: true, onPress: () => compactNow($) },
        { key: 'handoff-copy', label: t(T.copy), onPress: () => copyDraft($, e) },
        { key: 'handoff-refresh', label: t(T.refresh), onPress: () => refreshDraft($) },
        { key: 'handoff-cancel', label: t(T.cancel), onPress: () => closePane($) },
      ],
    })
    if (s.draft === null) {
      return (
        <Box flexDirection="column">
          {header}
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {header}
        <Text color="warning">{t(T.warning)}</Text>
        {sectionsView($, e, sectionsOf(s.draft, '', false))}
        <Box marginTop={1}>
          <Input
            key="handoff-notes"
            label={t(T.notesLabel)}
            placeholder={t(T.notesPlaceholder)}
            value={s.notes}
            rows={3}
            onInput={value => setNotes($, value)}
            onSubmit={value => setNotes($, value)}
          />
        </Box>
      </Box>
    )
  })
}
