import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { BandInput, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { allEvidence, recordEvidence, since } from '../evidence'
import type { Evidence } from '../evidence'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip } from '../ui'

/*
 * Time machine: a timeline of file-level checkpoints, one per main-loop turn that changed files.
 * Pull, not push: no chip, no band line. /timeline opens the pane; the detail pane lists the last five.
 * Restore is FILE-LEVEL only (it writes the files of one checkpoint back); it never claims to restore the project.
 * Git restore is a separate, explicit action that runs git commands the person confirms one file at a time.
 * Own snapshots on purpose (edit-undo and diff-review keep theirs): the three overlap and could share one store later.
 */

const T = {
  title: { en: 'Time machine', he: 'מכונת זמן', es: 'Máquina del tiempo', fr: 'Machine à remonter le temps', ru: 'Машина времени', zh: '时光机', ja: 'タイムマシン', pt: 'Máquina do tempo', de: 'Zeitmaschine', ko: '타임머신' },
  description: {
    en: 'Keeps a file-level checkpoint after every turn that changed files; /timeline lets you inspect, compare and restore them.',
    he: 'שומר נקודת ביקורת ברמת הקבצים אחרי כל תור ששינה קבצים; /timeline מאפשר לבדוק, להשוות ולשחזר.',
    es: 'Guarda un punto de control de archivos tras cada turno que cambie archivos; /timeline permite inspeccionar, comparar y restaurar.',
    fr: "Garde un point de contrôle de fichiers après chaque tour qui modifie des fichiers ; /timeline permet d'inspecter, comparer et restaurer.",
    ru: 'Сохраняет контрольную точку файлов после каждого хода с правками; /timeline позволяет смотреть, сравнивать и восстанавливать.',
    zh: '每次修改了文件的轮次结束后保存一个文件级检查点；/timeline 可用来查看、对比和还原。',
    ja: 'ファイルを変更したターンごとにファイル単位のチェックポイントを保存します。/timeline で確認、比較、復元ができます。',
    pt: 'Guarda um checkpoint em nível de arquivo após cada turno que alterou arquivos; /timeline permite inspecionar, comparar e restaurar.',
    de: 'Speichert nach jeder Runde mit Dateiänderungen einen Checkpoint auf Dateiebene; /timeline zeigt, vergleicht und stellt sie wieder her.',
    ko: '파일이 바뀐 턴마다 파일 단위 체크포인트를 저장합니다. /timeline에서 살펴보고, 비교하고, 복원할 수 있습니다.',
  },
  commandDesc: {
    en: 'Opens the timeline of file checkpoints (inspect, compare, restore)',
    he: 'פותח את ציר הזמן של נקודות הביקורת בקבצים (בדיקה, השוואה, שחזור)',
    es: 'Abre la línea de tiempo de puntos de control de archivos (inspeccionar, comparar, restaurar)',
    fr: 'Ouvre la chronologie des points de contrôle de fichiers (inspecter, comparer, restaurer)',
    ru: 'Открывает хронологию контрольных точек файлов (просмотр, сравнение, восстановление)',
    zh: '打开文件检查点时间线（查看、对比、还原）',
    ja: 'ファイルのチェックポイントのタイムラインを開きます（確認、比較、復元）',
    pt: 'Abre a linha do tempo de checkpoints de arquivos (inspecionar, comparar, restaurar)',
    de: 'Öffnet die Zeitleiste der Datei-Checkpoints (ansehen, vergleichen, wiederherstellen)',
    ko: '파일 체크포인트 타임라인을 엽니다(확인, 비교, 복원)',
  },
  off: {
    en: 'Time machine is turned off in the Toolkitty pane.',
    he: 'מכונת הזמן כבויה בלוח ה-Toolkitty.',
    es: 'La máquina del tiempo está desactivada en el panel de Toolkitty.',
    fr: 'La machine à remonter le temps est désactivée dans le panneau Toolkitty.',
    ru: 'Машина времени отключена в панели Toolkitty.',
    zh: '时光机已在 Toolkitty 面板中关闭。',
    ja: 'タイムマシンは Toolkitty パネルでオフになっています。',
    pt: 'A máquina do tempo está desativada no painel do Toolkitty.',
    de: 'Die Zeitmaschine ist im Toolkitty-Panel ausgeschaltet.',
    ko: '타임머신이 Toolkitty 패널에서 꺼져 있습니다.',
  },
  opened: { en: 'Timeline opened.', he: 'ציר הזמן נפתח.', es: 'Línea de tiempo abierta.', fr: 'Chronologie ouverte.', ru: 'Хронология открыта.', zh: '时间线已打开。', ja: 'タイムラインを開きました。', pt: 'Linha do tempo aberta.', de: 'Zeitleiste geöffnet.', ko: '타임라인이 열렸습니다.' },
  paneTitle: { en: 'Timeline', he: 'ציר זמן', es: 'Línea de tiempo', fr: 'Chronologie', ru: 'Хронология', zh: '时间线', ja: 'タイムライン', pt: 'Linha do tempo', de: 'Zeitleiste', ko: '타임라인' },
  paneOff: {
    en: 'Time machine is turned off.',
    he: 'מכונת הזמן כבויה.',
    es: 'La máquina del tiempo está desactivada.',
    fr: 'La machine à remonter le temps est désactivée.',
    ru: 'Машина времени отключена.',
    zh: '时光机已关闭。',
    ja: 'タイムマシンはオフです。',
    pt: 'A máquina do tempo está desativada.',
    de: 'Die Zeitmaschine ist aus.',
    ko: '타임머신이 꺼져 있습니다.',
  },
  oneCp: { en: '1 checkpoint', he: 'נקודת ביקורת אחת', es: '1 punto de control', fr: '1 point de contrôle', ru: '1 контрольная точка', zh: '1 个检查点', ja: 'チェックポイント 1 件', pt: '1 checkpoint', de: '1 Checkpoint', ko: '체크포인트 1개' },
  nCps: { en: '{n} checkpoints', he: '{n} נקודות ביקורת', es: '{n} puntos de control', fr: '{n} points de contrôle', ru: 'контрольных точек: {n}', zh: '{n} 个检查点', ja: 'チェックポイント {n} 件', pt: '{n} checkpoints', de: '{n} Checkpoints', ko: '체크포인트 {n}개' },
  empty: {
    en: 'No checkpoints yet.',
    he: 'עדיין אין נקודות ביקורת.',
    es: 'Aún no hay puntos de control.',
    fr: 'Aucun point de contrôle pour le moment.',
    ru: 'Контрольных точек пока нет.',
    zh: '还没有检查点。',
    ja: 'チェックポイントはまだありません。',
    pt: 'Nenhum checkpoint ainda.',
    de: 'Noch keine Checkpoints.',
    ko: '아직 체크포인트가 없습니다.',
  },
  emptyHint: {
    en: 'After a turn that edits files, a checkpoint appears here to inspect, compare or restore.',
    he: 'אחרי תור שעורך קבצים תופיע כאן נקודת ביקורת לבדיקה, להשוואה או לשחזור.',
    es: 'Tras un turno que edite archivos aparecerá aquí un punto de control para inspeccionar, comparar o restaurar.',
    fr: 'Après un tour qui modifie des fichiers, un point de contrôle apparaît ici pour inspecter, comparer ou restaurer.',
    ru: 'После хода с правками здесь появится контрольная точка: смотреть, сравнивать, восстанавливать.',
    zh: '修改文件的一轮结束后，这里会出现检查点，可查看、对比或还原。',
    ja: 'ファイルを編集したターンの後、ここにチェックポイントが現れ、確認・比較・復元できます。',
    pt: 'Depois de um turno que edita arquivos, um checkpoint aparece aqui para inspecionar, comparar ou restaurar.',
    de: 'Nach einer Runde mit Dateiänderungen erscheint hier ein Checkpoint zum Ansehen, Vergleichen oder Wiederherstellen.',
    ko: '파일을 편집한 턴이 끝나면 여기에 체크포인트가 나타나며, 확인·비교·복원할 수 있습니다.',
  },
  noChanges: {
    en: 'No file changes in the session yet.',
    he: 'עדיין אין שינויי קבצים בסשן.',
    es: 'Aún no hay cambios de archivos en la sesión.',
    fr: 'Aucune modification de fichier dans la session pour le moment.',
    ru: 'В сессии пока нет изменений файлов.',
    zh: '会话中还没有文件变更。',
    ja: 'セッションにファイルの変更はまだありません。',
    pt: 'Ainda não há alterações de arquivos na sessão.',
    de: 'In der Sitzung gibt es noch keine Dateiänderungen.',
    ko: '세션에 아직 파일 변경이 없습니다.',
  },
  inspect: { en: 'Inspect', he: 'בדוק', es: 'Inspeccionar', fr: 'Inspecter', ru: 'Смотреть', zh: '查看', ja: '確認', pt: 'Inspecionar', de: 'Ansehen', ko: '확인' },
  compare: { en: 'Compare', he: 'השווה', es: 'Comparar', fr: 'Comparer', ru: 'Сравнить', zh: '对比', ja: '比較', pt: 'Comparar', de: 'Vergleichen', ko: '비교' },
  restore: { en: 'Restore', he: 'שחזר', es: 'Restaurar', fr: 'Restaurer', ru: 'Восстановить', zh: '还原', ja: '復元', pt: 'Restaurar', de: 'Wiederherstellen', ko: '복원' },
  gitRestore: { en: 'Git restore', he: 'שחזור Git', es: 'Restaurar con Git', fr: 'Restauration Git', ru: 'Откат через Git', zh: 'Git 还原', ja: 'Git で復元', pt: 'Restaurar via Git', de: 'Git-Wiederherstellung', ko: 'Git 복원' },
  copy: { en: 'Copy', he: 'העתק', es: 'Copiar', fr: 'Copier', ru: 'Копировать', zh: '复制', ja: 'コピー', pt: 'Copiar', de: 'Kopieren', ko: '복사' },
  startLabel: { en: 'Session start', he: 'תחילת סשן', es: 'Inicio de sesión', fr: 'Début de session', ru: 'Начало сессии', zh: '会话开始', ja: 'セッション開始', pt: 'Início da sessão', de: 'Sitzungsbeginn', ko: '세션 시작' },
  untitled: { en: '(no prompt)', he: '(ללא בקשה)', es: '(sin petición)', fr: '(sans requête)', ru: '(без запроса)', zh: '（无提示）', ja: '（プロンプトなし）', pt: '(sem prompt)', de: '(kein Prompt)', ko: '(프롬프트 없음)' },
  oneFile: { en: '1 file', he: 'קובץ אחד', es: '1 archivo', fr: '1 fichier', ru: '1 файл', zh: '1 个文件', ja: '1 ファイル', pt: '1 arquivo', de: '1 Datei', ko: '파일 1개' },
  nFiles: { en: '{n} files', he: '{n} קבצים', es: '{n} archivos', fr: '{n} fichiers', ru: 'файлов: {n}', zh: '{n} 个文件', ja: '{n} ファイル', pt: '{n} arquivos', de: '{n} Dateien', ko: '파일 {n}개' },
  testsRow: { en: 'tests {s}', he: 'בדיקות {s}', es: 'pruebas {s}', fr: 'tests {s}', ru: 'тесты {s}', zh: '测试{s}', ja: 'テスト{s}', pt: 'testes {s}', de: 'Tests {s}', ko: '테스트 {s}' },
  passed: { en: 'passed', he: 'עברו', es: 'pasaron', fr: 'réussis', ru: 'пройдены', zh: '通过', ja: '成功', pt: 'passaram', de: 'bestanden', ko: '통과' },
  failed: { en: 'failed', he: 'נכשלו', es: 'fallaron', fr: 'échoués', ru: 'провалены', zh: '失败', ja: '失敗', pt: 'falharam', de: 'fehlgeschlagen', ko: '실패' },
  selected: { en: 'Selected: {label}', he: 'נבחר: {label}', es: 'Seleccionado: {label}', fr: 'Sélectionné : {label}', ru: 'Выбрано: {label}', zh: '已选择：{label}', ja: '選択中：{label}', pt: 'Selecionado: {label}', de: 'Ausgewählt: {label}', ko: '선택됨: {label}' },
  scope: {
    en: 'Restore puts these files back as they were before this turn. File-level only, not the whole project.',
    he: 'שחזור מחזיר את הקבצים האלה למצבם לפני התור הזה. ברמת הקבצים בלבד, לא כל הפרויקט.',
    es: 'Restaurar devuelve estos archivos a como estaban antes de este turno. Solo a nivel de archivo, no todo el proyecto.',
    fr: 'Restaurer remet ces fichiers comme avant ce tour. Au niveau des fichiers seulement, pas tout le projet.',
    ru: 'Восстановление возвращает эти файлы к виду до этого хода. Только на уровне файлов, не весь проект.',
    zh: '还原会把这些文件恢复到本轮之前的样子。仅限文件级，不是整个项目。',
    ja: '復元すると、これらのファイルはこのターンの前の状態に戻ります。ファイル単位のみで、プロジェクト全体ではありません。',
    pt: 'Restaurar devolve estes arquivos ao estado anterior a este turno. Apenas em nível de arquivo, não o projeto inteiro.',
    de: 'Wiederherstellen setzt diese Dateien auf den Stand vor dieser Runde zurück. Nur auf Dateiebene, nicht das ganze Projekt.',
    ko: '복원하면 이 파일들이 이번 턴 이전 상태로 돌아갑니다. 파일 단위일 뿐 프로젝트 전체가 아닙니다.',
  },
  noFiles: { en: 'This checkpoint has no files.', he: 'בנקודת הביקורת הזו אין קבצים.', es: 'Este punto de control no tiene archivos.', fr: "Ce point de contrôle n'a aucun fichier.", ru: 'В этой точке нет файлов.', zh: '此检查点没有文件。', ja: 'このチェックポイントにファイルはありません。', pt: 'Este checkpoint não tem arquivos.', de: 'Dieser Checkpoint enthält keine Dateien.', ko: '이 체크포인트에는 파일이 없습니다.' },
  fileNew: { en: 'new', he: 'חדש', es: 'nuevo', fr: 'nouveau', ru: 'новый', zh: '新建', ja: '新規', pt: 'novo', de: 'neu', ko: '새 파일' },
  fileDropped: { en: 'content dropped', he: 'התוכן הוסר', es: 'contenido descartado', fr: 'contenu abandonné', ru: 'содержимое удалено', zh: '内容已丢弃', ja: '内容を破棄済み', pt: 'conteúdo descartado', de: 'Inhalt verworfen', ko: '내용 삭제됨' },
  inspectTitle: { en: 'Inspect', he: 'בדיקה', es: 'Inspección', fr: 'Inspection', ru: 'Просмотр', zh: '查看', ja: '確認', pt: 'Inspecionar', de: 'Ansehen', ko: '확인' },
  iFile: { en: '{path} (+{a} −{r})', he: '{path} (+{a} −{r})', es: '{path} (+{a} −{r})', fr: '{path} (+{a} −{r})', ru: '{path} (+{a} −{r})', zh: '{path} (+{a} −{r})', ja: '{path} (+{a} −{r})', pt: '{path} (+{a} −{r})', de: '{path} (+{a} −{r})', ko: '{path} (+{a} −{r})' },
  iMore: { en: '… {n} more changed lines', he: '… עוד {n} שורות ששונו', es: '… {n} líneas cambiadas más', fr: '… {n} lignes modifiées de plus', ru: '… ещё изменённых строк: {n}', zh: '… 另有 {n} 行变更', ja: '… ほか {n} 行の変更', pt: '… mais {n} linhas alteradas', de: '… {n} weitere geänderte Zeilen', ko: '… 변경된 줄 {n}개 더' },
  iNone: { en: 'no changed lines', he: 'אין שורות ששונו', es: 'sin líneas cambiadas', fr: 'aucune ligne modifiée', ru: 'нет изменённых строк', zh: '无变更行', ja: '変更行なし', pt: 'nenhuma linha alterada', de: 'keine geänderten Zeilen', ko: '변경된 줄 없음' },
  iDropped: {
    en: 'content before this turn was dropped to save space',
    he: 'התוכן שלפני התור הוסר כדי לחסוך מקום',
    es: 'el contenido anterior a este turno se descartó para ahorrar espacio',
    fr: "le contenu d'avant ce tour a été abandonné pour gagner de la place",
    ru: 'содержимое до этого хода удалено для экономии места',
    zh: '为节省空间，本轮之前的内容已被丢弃',
    ja: '容量節約のため、このターン以前の内容は破棄されました',
    pt: 'o conteúdo anterior a este turno foi descartado para economizar espaço',
    de: 'Inhalt vor dieser Runde wurde zum Platzsparen verworfen',
    ko: '공간을 절약하려고 이번 턴 이전의 내용은 삭제되었습니다',
  },
  compareTitle: { en: 'Compare with previous checkpoint', he: 'השוואה לנקודת הביקורת הקודמת', es: 'Comparar con el punto anterior', fr: 'Comparer au point précédent', ru: 'Сравнение с предыдущей точкой', zh: '与上一个检查点对比', ja: '前のチェックポイントと比較', pt: 'Comparar com o checkpoint anterior', de: 'Mit vorherigem Checkpoint vergleichen', ko: '이전 체크포인트와 비교' },
  cNoPrev: {
    en: 'No earlier checkpoint to compare with.',
    he: 'אין נקודת ביקורת קודמת להשוואה.',
    es: 'No hay un punto de control anterior para comparar.',
    fr: 'Aucun point de contrôle antérieur à comparer.',
    ru: 'Нет предыдущей точки для сравнения.',
    zh: '没有更早的检查点可供对比。',
    ja: '比較できる以前のチェックポイントがありません。',
    pt: 'Não há checkpoint anterior para comparar.',
    de: 'Kein früherer Checkpoint zum Vergleichen.',
    ko: '비교할 이전 체크포인트가 없습니다.',
  },
  cDiffers: { en: 'differs: {path}', he: 'שונה: {path}', es: 'difiere: {path}', fr: 'diffère : {path}', ru: 'отличается: {path}', zh: '不同：{path}', ja: '差異あり：{path}', pt: 'difere: {path}', de: 'abweichend: {path}', ko: '다름: {path}' },
  cSame: { en: 'same: {path}', he: 'זהה: {path}', es: 'igual: {path}', fr: 'identique : {path}', ru: 'совпадает: {path}', zh: '相同：{path}', ja: '同一：{path}', pt: 'igual: {path}', de: 'gleich: {path}', ko: '같음: {path}' },
  cOnlyHere: { en: 'only in this checkpoint: {path}', he: 'רק בנקודה הזו: {path}', es: 'solo en este punto: {path}', fr: 'seulement dans ce point : {path}', ru: 'только в этой точке: {path}', zh: '仅在此检查点中：{path}', ja: 'このチェックポイントのみ：{path}', pt: 'só neste checkpoint: {path}', de: 'nur in diesem Checkpoint: {path}', ko: '이 체크포인트에만 있음: {path}' },
  cOnlyPrev: { en: 'only in the previous one: {path}', he: 'רק בקודמת: {path}', es: 'solo en el anterior: {path}', fr: 'seulement dans le précédent : {path}', ru: 'только в предыдущей: {path}', zh: '仅在上一个中：{path}', ja: '前のチェックポイントのみ：{path}', pt: 'só no anterior: {path}', de: 'nur im vorherigen: {path}', ko: '이전 것에만 있음: {path}' },
  cNote: {
    en: 'Compares what each checkpoint recorded; files neither touched are not listed.',
    he: 'משווה את מה שכל נקודה תיעדה; קבצים ששתיהן לא נגעו בהם לא מופיעים.',
    es: 'Compara lo que registró cada punto; los archivos que ninguno tocó no aparecen.',
    fr: "Compare ce que chaque point a enregistré ; les fichiers qu'aucun n'a touchés ne sont pas listés.",
    ru: 'Сравниваются записи точек; файлы, которых не касалась ни одна, не показаны.',
    zh: '对比各检查点所记录的内容；两者都没改动的文件不会列出。',
    ja: '各チェックポイントが記録した内容を比較します。どちらも触れていないファイルは表示されません。',
    pt: 'Compara o que cada checkpoint registrou; arquivos que nenhum tocou não são listados.',
    de: 'Vergleicht, was jeder Checkpoint aufgezeichnet hat; Dateien, die keiner berührt hat, werden nicht aufgelistet.',
    ko: '각 체크포인트가 기록한 내용을 비교합니다. 둘 다 건드리지 않은 파일은 표시되지 않습니다.',
  },
  restoreTitle: { en: 'Restore (file-level)', he: 'שחזור (ברמת הקבצים)', es: 'Restaurar (por archivo)', fr: 'Restauration (par fichier)', ru: 'Восстановление (файлы)', zh: '还原（文件级）', ja: '復元（ファイル単位）', pt: 'Restaurar (nível de arquivo)', de: 'Wiederherstellen (Dateiebene)', ko: '복원(파일 단위)' },
  askHeader: { en: 'Conflict', he: 'התנגשות', es: 'Conflicto', fr: 'Conflit', ru: 'Конфликт', zh: '冲突', ja: '競合', pt: 'Conflito', de: 'Konflikt', ko: '충돌' },
  askConflict: {
    en: '{path} changed since this checkpoint. Overwrite it with the version from before this turn, or skip it?',
    he: '{path} השתנה מאז נקודת הביקורת הזו. לדרוס אותו בגרסה שלפני התור הזה, או לדלג?',
    es: '{path} cambió desde este punto de control. ¿Sobrescribirlo con la versión de antes de este turno u omitirlo?',
    fr: "{path} a changé depuis ce point de contrôle. L'écraser avec la version d'avant ce tour, ou l'ignorer ?",
    ru: '{path} изменился после этой точки. Перезаписать версией до этого хода или пропустить?',
    zh: '自此检查点以来，{path} 已被更改。是用本轮之前的版本覆盖它，还是跳过？',
    ja: 'このチェックポイント以降に {path} が変更されています。このターン前のバージョンで上書きしますか、それともスキップしますか？',
    pt: '{path} mudou desde este checkpoint. Sobrescrever com a versão de antes deste turno ou pular?',
    de: '{path} wurde seit diesem Checkpoint geändert. Mit der Version von vor dieser Runde überschreiben oder überspringen?',
    ko: '이 체크포인트 이후 {path}이(가) 변경되었습니다. 이번 턴 이전 버전으로 덮어쓸까요, 건너뛸까요?',
  },
  overwrite: { en: 'Overwrite', he: 'דרוס', es: 'Sobrescribir', fr: 'Écraser', ru: 'Перезаписать', zh: '覆盖', ja: '上書き', pt: 'Sobrescrever', de: 'Überschreiben', ko: '덮어쓰기' },
  skip: { en: 'Skip', he: 'דלג', es: 'Omitir', fr: 'Ignorer', ru: 'Пропустить', zh: '跳过', ja: 'スキップ', pt: 'Pular', de: 'Überspringen', ko: '건너뛰기' },
  rDropped: {
    en: '{path}: skipped, its earlier content was dropped to save space',
    he: '{path}: דולג, התוכן הקודם שלו הוסר כדי לחסוך מקום',
    es: '{path}: omitido, su contenido anterior se descartó para ahorrar espacio',
    fr: '{path} : ignoré, son contenu précédent a été abandonné pour gagner de la place',
    ru: '{path}: пропущен, прежнее содержимое удалено для экономии места',
    zh: '{path}：已跳过，其先前内容为节省空间已被丢弃',
    ja: '{path}：スキップしました（以前の内容は容量節約のため破棄済み）',
    pt: '{path}: ignorado, o conteúdo anterior foi descartado para economizar espaço',
    de: '{path}: übersprungen, früherer Inhalt wurde zum Platzsparen verworfen',
    ko: '{path}: 건너뜀, 이전 내용은 공간 절약을 위해 삭제됨',
  },
  rSkipped: { en: '{path}: skipped (changed since)', he: '{path}: דולג (השתנה מאז)', es: '{path}: omitido (cambió después)', fr: '{path} : ignoré (modifié depuis)', ru: '{path}: пропущен (изменён после)', zh: '{path}：已跳过（之后有变更）', ja: '{path}：スキップ（その後変更あり）', pt: '{path}: ignorado (alterado depois)', de: '{path}: übersprungen (seitdem geändert)', ko: '{path}: 건너뜀(이후 변경됨)' },
  rRestored: { en: '{path}: restored', he: '{path}: שוחזר', es: '{path}: restaurado', fr: '{path} : restauré', ru: '{path}: восстановлен', zh: '{path}：已还原', ja: '{path}：復元しました', pt: '{path}: restaurado', de: '{path}: wiederhergestellt', ko: '{path}: 복원됨' },
  rEmptied: {
    en: '{path}: emptied (it did not exist before; the engine cannot delete files)',
    he: '{path}: רוקן (לא היה קיים קודם; המנוע לא יכול למחוק קבצים)',
    es: '{path}: vaciado (no existía antes; el motor no puede borrar archivos)',
    fr: "{path} : vidé (il n'existait pas avant ; le moteur ne peut pas supprimer de fichiers)",
    ru: '{path}: очищен (раньше не существовал; движок не умеет удалять файлы)',
    zh: '{path}：已清空（此前不存在；引擎无法删除文件）',
    ja: '{path}：空にしました（以前は存在せず、エンジンはファイルを削除できません）',
    pt: '{path}: esvaziado (não existia antes; o engine não pode excluir arquivos)',
    de: '{path}: geleert (existierte vorher nicht; die Engine kann keine Dateien löschen)',
    ko: '{path}: 비움(이전에는 없던 파일이며 엔진은 파일을 삭제할 수 없음)',
  },
  rFailed: { en: '{path}: could not write', he: '{path}: הכתיבה נכשלה', es: '{path}: no se pudo escribir', fr: '{path} : écriture impossible', ru: '{path}: не удалось записать', zh: '{path}：无法写入', ja: '{path}：書き込めませんでした', pt: '{path}: não foi possível gravar', de: '{path}: konnte nicht geschrieben werden', ko: '{path}: 쓸 수 없음' },
  rSummary: {
    en: '{n} restored, {m} skipped, {k} failed',
    he: '{n} שוחזרו, {m} דולגו, {k} נכשלו',
    es: '{n} restaurados, {m} omitidos, {k} fallidos',
    fr: '{n} restaurés, {m} ignorés, {k} en échec',
    ru: 'восстановлено: {n}, пропущено: {m}, ошибок: {k}',
    zh: '已还原 {n}，跳过 {m}，失败 {k}',
    ja: '復元 {n}、スキップ {m}、失敗 {k}',
    pt: '{n} restaurados, {m} ignorados, {k} com falha',
    de: '{n} wiederhergestellt, {m} übersprungen, {k} fehlgeschlagen',
    ko: '{n}개 복원, {m}개 건너뜀, {k}개 실패',
  },
  rScope: {
    en: 'File-level rollback of these files only. Other files, deleted files and the rest of the project are untouched. This is not a full project restore.',
    he: 'שחזור ברמת הקבצים לקבצים האלה בלבד. קבצים אחרים, קבצים שנמחקו ושאר הפרויקט לא נגעו. זה לא שחזור מלא של הפרויקט.',
    es: 'Reversión a nivel de archivo solo de estos archivos. Los demás archivos, los borrados y el resto del proyecto no se tocan. No es una restauración completa del proyecto.',
    fr: "Retour en arrière au niveau des fichiers, pour ces fichiers seulement. Les autres fichiers, les fichiers supprimés et le reste du projet ne sont pas touchés. Ce n'est pas une restauration complète du projet.",
    ru: 'Откат только этих файлов. Остальные файлы, удалённые файлы и весь прочий проект не затронуты. Это не полное восстановление проекта.',
    zh: '仅对这些文件做文件级回滚。其他文件、已删除的文件和项目的其余部分均不受影响。这不是整个项目的还原。',
    ja: 'これらのファイルだけをファイル単位でロールバックします。他のファイル、削除済みファイル、プロジェクトの残りには影響しません。プロジェクト全体の復元ではありません。',
    pt: 'Reversão em nível de arquivo apenas destes arquivos. Outros arquivos, arquivos excluídos e o restante do projeto não são afetados. Isto não é uma restauração completa do projeto.',
    de: 'Rollback auf Dateiebene nur für diese Dateien. Andere Dateien, gelöschte Dateien und der Rest des Projekts bleiben unberührt. Das ist keine vollständige Projektwiederherstellung.',
    ko: '이 파일들만 파일 단위로 되돌립니다. 다른 파일, 삭제된 파일, 프로젝트의 나머지는 그대로입니다. 프로젝트 전체 복원이 아닙니다.',
  },
  gitTitle: { en: 'Git restore', he: 'שחזור Git', es: 'Restauración con Git', fr: 'Restauration Git', ru: 'Откат через Git', zh: 'Git 还原', ja: 'Git で復元', pt: 'Restaurar via Git', de: 'Git-Wiederherstellung', ko: 'Git 복원' },
  gNoRepo: {
    en: 'Not a git repository, so Git restore is unavailable. Use Restore for a file-level rollback.',
    he: 'זה לא מאגר git, לכן שחזור Git אינו זמין. השתמש בשחזור לרמת הקבצים.',
    es: 'No es un repositorio git, así que la restauración con Git no está disponible. Usa Restaurar para revertir por archivo.',
    fr: "Ce n'est pas un dépôt git : la restauration Git est indisponible. Utilisez Restaurer pour un retour par fichier.",
    ru: 'Это не git-репозиторий, откат через Git недоступен. Используйте Восстановить для отката файлов.',
    zh: '这不是 git 仓库，因此无法使用 Git 还原。请用“还原”做文件级回滚。',
    ja: 'git リポジトリではないため、Git で復元は使えません。ファイル単位のロールバックには「復元」を使ってください。',
    pt: 'Não é um repositório git, então a restauração via Git não está disponível. Use Restaurar para reverter em nível de arquivo.',
    de: 'Kein Git-Repository, daher ist die Git-Wiederherstellung nicht verfügbar. Nutze Wiederherstellen für ein Rollback auf Dateiebene.',
    ko: 'git 저장소가 아니므로 Git 복원을 사용할 수 없습니다. 파일 단위 롤백에는 복원을 사용하세요.',
  },
  gIntro: {
    en: 'Git restore is separate from Restore: git checkout puts a file back to its staged or committed version, which may be older or newer than this checkpoint, and discards its uncommitted changes.',
    he: 'שחזור Git נפרד מהשחזור: git checkout מחזיר קובץ לגרסה שב-stage או שב-commit, שעשויה להיות ישנה או חדשה מנקודת הביקורת הזו, ומוחק את השינויים שלא נשמרו.',
    es: 'La restauración con Git es distinta de Restaurar: git checkout devuelve un archivo a su versión en stage o confirmada, que puede ser más antigua o más nueva que este punto, y descarta sus cambios sin confirmar.',
    fr: 'La restauration Git est distincte de Restaurer : git checkout remet un fichier à sa version indexée ou validée, plus ancienne ou plus récente que ce point, et abandonne ses modifications non validées.',
    ru: 'Откат через Git отличается от Восстановить: git checkout возвращает файл к версии из индекса или коммита, она может быть старше или новее этой точки, а несохранённые правки теряются.',
    zh: 'Git 还原与“还原”是分开的：git checkout 会把文件恢复到暂存或已提交的版本，这可能比此检查点更旧或更新，并且会丢弃其未提交的更改。',
    ja: 'Git で復元は「復元」とは別物です。git checkout はファイルをステージ済みまたはコミット済みのバージョンに戻します。それはこのチェックポイントより古い場合も新しい場合もあり、未コミットの変更は破棄されます。',
    pt: 'A restauração via Git é separada de Restaurar: git checkout devolve um arquivo à versão em stage ou commitada, que pode ser mais antiga ou mais nova que este checkpoint, e descarta as alterações não commitadas.',
    de: 'Die Git-Wiederherstellung ist getrennt von Wiederherstellen: git checkout setzt eine Datei auf die gestagte oder committete Version zurück, die älter oder neuer als dieser Checkpoint sein kann, und verwirft ihre nicht committeten Änderungen.',
    ko: 'Git 복원은 복원과 별개입니다. git checkout은 파일을 스테이징되었거나 커밋된 버전으로 되돌리며, 그 버전은 이 체크포인트보다 오래되었거나 새로울 수 있고 커밋되지 않은 변경은 버려집니다.',
  },
  gStatFail: { en: 'git diff failed: {why}', he: 'git diff נכשל: {why}', es: 'git diff falló: {why}', fr: 'git diff a échoué : {why}', ru: 'git diff не удался: {why}', zh: 'git diff 失败：{why}', ja: 'git diff に失敗しました：{why}', pt: 'git diff falhou: {why}', de: 'git diff fehlgeschlagen: {why}', ko: 'git diff 실패: {why}' },
  gClean: {
    en: 'git sees no unstaged changes in these files, so there is nothing to check out.',
    he: 'git לא רואה שינויים שלא הועלו ל-stage בקבצים האלה, לכן אין מה לשחזר.',
    es: 'git no ve cambios sin añadir en estos archivos, así que no hay nada que restaurar.',
    fr: 'git ne voit aucune modification non indexée dans ces fichiers, rien à restaurer.',
    ru: 'git не видит неиндексированных изменений в этих файлах, восстанавливать нечего.',
    zh: 'git 在这些文件中看不到未暂存的更改，因此没有可检出的内容。',
    ja: 'git はこれらのファイルにステージされていない変更を認識していないため、チェックアウトするものがありません。',
    pt: 'O git não vê alterações fora do stage nestes arquivos, então não há nada para fazer checkout.',
    de: 'git sieht in diesen Dateien keine ungestagten Änderungen, also gibt es nichts auszuchecken.',
    ko: 'git은 이 파일들에서 스테이징되지 않은 변경을 찾지 못해 체크아웃할 것이 없습니다.',
  },
  gAsk: {
    en: 'Run "git checkout -- {path}"? It discards the uncommitted changes in that file.',
    he: 'להריץ "git checkout -- {path}"? זה מוחק את השינויים שלא נשמרו בקובץ.',
    es: '¿Ejecutar "git checkout -- {path}"? Descarta los cambios sin confirmar de ese archivo.',
    fr: 'Exécuter « git checkout -- {path} » ? Cela abandonne les modifications non validées de ce fichier.',
    ru: 'Выполнить "git checkout -- {path}"? Несохранённые изменения файла будут потеряны.',
    zh: '运行 "git checkout -- {path}"？这会丢弃该文件中未提交的更改。',
    ja: '"git checkout -- {path}" を実行しますか？ そのファイルの未コミットの変更は破棄されます。',
    pt: 'Executar "git checkout -- {path}"? Isso descarta as alterações não commitadas nesse arquivo.',
    de: '"git checkout -- {path}" ausführen? Das verwirft die nicht committeten Änderungen in dieser Datei.',
    ko: '"git checkout -- {path}"를 실행할까요? 해당 파일의 커밋되지 않은 변경이 버려집니다.',
  },
  gHeader: { en: 'Git', he: 'Git', es: 'Git', fr: 'Git', ru: 'Git', zh: 'Git', ja: 'Git', pt: 'Git', de: 'Git', ko: 'Git' },
  gRun: { en: 'Run', he: 'הרץ', es: 'Ejecutar', fr: 'Exécuter', ru: 'Выполнить', zh: '运行', ja: '実行', pt: 'Executar', de: 'Ausführen', ko: '실행' },
  gOk: { en: '{path}: checked out from git', he: '{path}: שוחזר מ-git', es: '{path}: restaurado desde git', fr: '{path} : restauré depuis git', ru: '{path}: восстановлен из git', zh: '{path}：已从 git 检出', ja: '{path}：git からチェックアウトしました', pt: '{path}: restaurado do git', de: '{path}: aus git ausgecheckt', ko: '{path}: git에서 체크아웃함' },
  gFail: { en: '{path}: git checkout failed: {why}', he: '{path}: git checkout נכשל: {why}', es: '{path}: git checkout falló: {why}', fr: '{path} : git checkout a échoué : {why}', ru: '{path}: git checkout не удался: {why}', zh: '{path}：git checkout 失败：{why}', ja: '{path}：git checkout に失敗：{why}', pt: '{path}: git checkout falhou: {why}', de: '{path}: git checkout fehlgeschlagen: {why}', ko: '{path}: git checkout 실패: {why}' },
  restoredNote: { en: 'Restored {n} files', he: 'שוחזרו {n} קבצים', es: 'Se restauraron {n} archivos', fr: '{n} fichiers restaurés', ru: 'Восстановлено файлов: {n}', zh: '已还原 {n} 个文件', ja: '{n} ファイルを復元しました', pt: '{n} arquivos restaurados', de: '{n} Dateien wiederhergestellt', ko: '파일 {n}개 복원됨' },
  noSelection: { en: 'No checkpoint to act on yet.', he: 'עדיין אין נקודת ביקורת לפעולה.', es: 'Aún no hay un punto de control.', fr: 'Aucun point de contrôle pour le moment.', ru: 'Пока нет контрольной точки.', zh: '还没有可操作的检查点。', ja: '操作できるチェックポイントはまだありません。', pt: 'Ainda não há checkpoint para usar.', de: 'Noch kein Checkpoint zum Bearbeiten.', ko: '아직 사용할 체크포인트가 없습니다.' },
  copied: { en: 'Timeline copied', he: 'ציר הזמן הועתק', es: 'Línea de tiempo copiada', fr: 'Chronologie copiée', ru: 'Хронология скопирована', zh: '时间线已复制', ja: 'タイムラインをコピーしました', pt: 'Linha do tempo copiada', de: 'Zeitleiste kopiert', ko: '타임라인을 복사했습니다' },
  copyFailed: { en: 'Could not copy: {why}', he: 'ההעתקה נכשלה: {why}', es: 'No se pudo copiar: {why}', fr: 'Copie impossible : {why}', ru: 'Не удалось скопировать: {why}', zh: '无法复制：{why}', ja: 'コピーできませんでした：{why}', pt: 'Não foi possível copiar: {why}', de: 'Kopieren fehlgeschlagen: {why}', ko: '복사할 수 없습니다: {why}' },
  copyHead: { en: 'Timeline · {n}', he: 'ציר זמן · {n}', es: 'Línea de tiempo · {n}', fr: 'Chronologie · {n}', ru: 'Хронология · {n}', zh: '时间线 · {n}', ja: 'タイムライン · {n}', pt: 'Linha do tempo · {n}', de: 'Zeitleiste · {n}', ko: '타임라인 · {n}' },
  detailEmpty: { en: 'No checkpoints with files yet.', he: 'עדיין אין נקודות ביקורת עם קבצים.', es: 'Aún no hay puntos de control con archivos.', fr: 'Aucun point de contrôle avec fichiers pour le moment.', ru: 'Пока нет точек с файлами.', zh: '还没有包含文件的检查点。', ja: 'ファイルを含むチェックポイントはまだありません。', pt: 'Nenhum checkpoint com arquivos ainda.', de: 'Noch keine Checkpoints mit Dateien.', ko: '아직 파일이 있는 체크포인트가 없습니다.' },
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

type FileCp = {
  path: string
  /** Content before the turn's first change; null when the file did not exist. */
  before: string | null
  /** Content read after the turn. */
  after: string
  added: number
  removed: number
  /** True when `before` was dropped to stay under the byte cap. */
  dropped: boolean
  /** True when `after` was dropped too; the conflict check then always asks. */
  goneAfter: boolean
  /** Bytes held in before / after. */
  bb: number
  ab: number
}
type Ev = { passed: number; failed: number; lines: string[] }
type Checkpoint = { id: number; at: number; turnId: string; label: string; files: FileCp[]; evidence: Ev }
type Report = { title: string; lines: string[] }
type State = {
  cps: Checkpoint[]
  nextId: number
  /** The latest user prompt, collected at submit. */
  prompt: string
  /** The label of the turn in flight. */
  label: string
  turnStartAt: number
  selected: number | null
  report: Report | null
  busy: boolean
}
/** The turn in flight lives in its own slot: the engine caps one state value at 4 MiB, and the checkpoints already use most of it. */
type Turn = {
  /** Content before this turn's first change, by path; null when the file did not exist. */
  snaps: Record<string, string | null>
  /** Paths really changed this turn, in order. */
  changed: string[]
}

const state = atom(
  { plugin: 'toolkitty', key: 'slot', id: 'time-machine' } as const,
  { cps: [], nextId: 0, prompt: '', label: '', turnStartAt: 0, selected: null, report: null, busy: false } as State,
) as unknown as Atom<State>

const turnState = atom({ plugin: 'toolkitty', key: 'slot', id: 'time-machine:turn' } as const, { snaps: {}, changed: [] } as Turn) as unknown as Atom<Turn>

export const feature: Feature = {
  id: 'time-machine',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const MAX_FILE = 1024 * 1024
const MAX_FILES = 40
const MAX_CPS = 30
/**
 * The cap on stored text: 4 MB (decimal). The engine refuses a state value over 4 MiB of JSON characters, so the cap is counted
 * in the larger of UTF-8 bytes and JSON characters, and a last check on the serialized checkpoints keeps the value under the limit.
 */
const MAX_BYTES = 4_000_000
const STATE_SAFE = 4_150_000
/** In-flight snapshots of one turn stay under this many JSON characters. */
const SNAP_BUDGET = 3_500_000
const jsonLen = (text: string): number => JSON.stringify(text).length
const sizeOf = (text: string): number => Math.max(byteLen(text), jsonLen(text))
const INSPECT_LINES = 12
const LINE_CLIP = 160

const pathOf = (e: object): string | undefined => {
  const x = e as Record<string, unknown>
  const p = x['file_path'] ?? x['notebook_path']
  return typeof p === 'string' ? p : undefined
}

const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** A prompt as a one-line label of at most 60 characters, with obvious secrets masked. */
function labelOf(text: string): string {
  const masked = text
    .replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{12,})/g, '[redacted]')
    .replace(/\b(password|passwd|token|secret|api[_-]?key)(\s*[=:]\s*)\S+/gi, '$1$2[redacted]')
  return masked.replace(/\s+/g, ' ').trim().slice(0, 60)
}

const hhmm = (at: number): string => {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** UTF-8 size of a string without Node. */
function byteLen(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4
      i += 1
    } else n += 3
  }
  return n
}

const linesOf = (text: string): string[] => (text === '' ? [] : text.split('\n'))

type DiffLine = { sign: '+' | '−'; text: string }

/** Lines of `after` not in `before` are '+', lines of `before` not in `after` are '−'; in file order, removals first on a tie. */
function diffLines(before: string, after: string): DiffLine[] {
  const old = linesOf(before)
  const now = linesOf(after)
  const poolOld = new Map<string, number>()
  for (const line of old) poolOld.set(line, (poolOld.get(line) ?? 0) + 1)
  const poolNow = new Map<string, number>()
  for (const line of now) poolNow.set(line, (poolNow.get(line) ?? 0) + 1)
  const out: { pos: number; order: number; sign: '+' | '−'; text: string }[] = []
  now.forEach((line, i) => {
    const n = poolOld.get(line) ?? 0
    if (n > 0) poolOld.set(line, n - 1)
    else out.push({ pos: i, order: 1, sign: '+', text: line })
  })
  old.forEach((line, i) => {
    const n = poolNow.get(line) ?? 0
    if (n > 0) poolNow.set(line, n - 1)
    else out.push({ pos: i, order: 0, sign: '−', text: line })
  })
  out.sort((a, b) => a.pos - b.pos || a.order - b.order)
  return out.map(x => ({ sign: x.sign, text: x.text.replace(/\r$/, '') }))
}

function countDiff(before: string, after: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const d of diffLines(before, after)) {
    if (d.sign === '+') added += 1
    else removed += 1
  }
  return { added, removed }
}

/** Keeps the newest checkpoints, then drops the oldest `before` texts, then the oldest `after` texts, until under the byte cap. */
function capStore(cps: readonly Checkpoint[]): Checkpoint[] {
  const kept: Checkpoint[] = cps.slice(-MAX_CPS).map(cp => ({ ...cp, files: cp.files.map(f => ({ ...f })) }))
  let total = 0
  for (const cp of kept) for (const f of cp.files) total += f.bb + f.ab + f.path.length + 150
  for (const cp of kept) total += cp.label.length + 300
  for (const cp of kept) {
    for (const f of cp.files) {
      if (total <= MAX_BYTES) return fitState(kept)
      if (!f.dropped && f.bb > 0) {
        total -= f.bb
        f.bb = 0
        f.before = ''
        f.dropped = true
      }
    }
  }
  for (const cp of kept) {
    for (const f of cp.files) {
      if (total <= MAX_BYTES) return fitState(kept)
      if (!f.goneAfter && f.ab > 0) {
        total -= f.ab
        f.ab = 0
        f.after = ''
        f.goneAfter = true
      }
    }
  }
  return fitState(kept)
}

/** Last guard: the serialized checkpoints must fit the engine's state limit; the oldest go first. */
function fitState(cps: Checkpoint[]): Checkpoint[] {
  let out = cps
  while (out.length > 1 && JSON.stringify(out).length > STATE_SAFE) out = out.slice(1)
  return out
}

/** The evidence records of one turn, as counts and short lines. */
function evidenceOf(items: readonly Evidence[], at: number, turnId: string): Ev {
  const mine = since(items, at).filter(x => (x.turnId === undefined || x.turnId === turnId) && x.kind !== 'diff' && x.kind !== 'git')
  let passed = 0
  let failed = 0
  for (const x of mine) {
    if (x.kind !== 'test') continue
    if (x.ok) passed += 1
    else failed += 1
  }
  return { passed, failed, lines: mine.slice(-6).map(x => clip(x.summary, 120)) }
}

const testsWord = (cp: Checkpoint): string => (cp.evidence.failed > 0 ? t(T.failed) : cp.evidence.passed > 0 ? t(T.passed) : '–')
const filesText = (n: number): string => (n === 1 ? t(T.oneFile) : t(T.nFiles, { n }))
const rowText = (cp: Checkpoint): string => `${hhmm(cp.at)} · ${cp.label} · ${filesText(cp.files.length)} · ${t(T.testsRow, { s: testsWord(cp) })}`

function timelineText(cps: readonly Checkpoint[]): string {
  const head = t(T.copyHead, { n: cps.length === 1 ? t(T.oneCp) : t(T.nCps, { n: cps.length }) })
  const body: string[] = []
  for (const cp of [...cps].reverse()) {
    body.push(rowText(cp))
    for (const f of cp.files) body.push(`  +${f.added} −${f.removed} ${f.path}`)
  }
  return [head, ...body].join('\n')
}

function inspectReport(cp: Checkpoint): Report {
  const lines: string[] = []
  if (cp.files.length === 0) lines.push(t(T.noFiles))
  for (const f of cp.files) {
    lines.push(t(T.iFile, { path: f.path, a: f.added, r: f.removed }))
    if (f.dropped) {
      lines.push(`  (${t(T.iDropped)})`)
      continue
    }
    const diff = diffLines(f.before ?? '', f.after)
    if (diff.length === 0) lines.push(`  (${t(T.iNone)})`)
    for (const d of diff.slice(0, INSPECT_LINES)) lines.push(`${d.sign} ${clip(d.text, LINE_CLIP)}`)
    if (diff.length > INSPECT_LINES) lines.push(`  ${t(T.iMore, { n: diff.length - INSPECT_LINES })}`)
  }
  return { title: t(T.inspectTitle), lines }
}

function compareReport(cp: Checkpoint, prev: Checkpoint | undefined): Report {
  if (prev === undefined) return { title: t(T.compareTitle), lines: [t(T.cNoPrev)] }
  const lines: string[] = []
  const before = new Map<string, FileCp>()
  for (const f of prev.files) before.set(f.path, f)
  const seen = new Set<string>()
  for (const f of cp.files) {
    seen.add(f.path)
    const other = before.get(f.path)
    if (other === undefined) lines.push(t(T.cOnlyHere, { path: f.path }))
    else if (other.after !== f.after || other.goneAfter || f.goneAfter) lines.push(t(T.cDiffers, { path: f.path }))
    else lines.push(t(T.cSame, { path: f.path }))
  }
  for (const f of prev.files) if (!seen.has(f.path)) lines.push(t(T.cOnlyPrev, { path: f.path }))
  if (lines.length === 0) lines.push(t(T.noFiles))
  lines.push(t(T.cNote))
  return { title: t(T.compareTitle), lines }
}

async function setReport($: EngineInterface, report: Report | null): Promise<void> {
  await update($, state, s => ({ ...s, report }))
}

async function setBusy($: EngineInterface, busy: boolean): Promise<void> {
  await update($, state, s => ({ ...s, busy }))
}

/** File-level restore: writes `before` back, asking first for every file that changed since the checkpoint. */
async function restoreCheckpoint($: EngineInterface, cp: Checkpoint): Promise<Report> {
  const lines: string[] = []
  let restored = 0
  let skipped = 0
  let failed = 0
  for (const f of cp.files) {
    if (f.dropped) {
      skipped += 1
      lines.push(t(T.rDropped, { path: f.path }))
      continue
    }
    let current = ''
    try {
      if (await $.fs.exists(f.path)) current = await $.fs.read(f.path)
    } catch {
      failed += 1
      lines.push(t(T.rFailed, { path: f.path }))
      continue
    }
    if (f.goneAfter || current !== f.after) {
      let answer = ''
      try {
        answer = await $.ui.ask(t(T.askConflict, { path: f.path }), { header: t(T.askHeader), options: [t(T.overwrite), t(T.skip)] })
      } catch {
        answer = ''
      }
      if (answer !== t(T.overwrite)) {
        skipped += 1
        lines.push(t(T.rSkipped, { path: f.path }))
        continue
      }
    }
    try {
      await $.fs.write(f.path, f.before ?? '')
      restored += 1
      lines.push(f.before === null ? t(T.rEmptied, { path: f.path }) : t(T.rRestored, { path: f.path }))
    } catch {
      failed += 1
      lines.push(t(T.rFailed, { path: f.path }))
    }
  }
  if (restored > 0) {
    await recordEvidence($, {
      kind: 'diff',
      ok: failed === 0,
      summary: `restored ${restored} ${restored === 1 ? 'file' : 'files'} to ${cp.label}`,
      ref: `checkpoint ${cp.id}`,
      feature: feature.id,
    })
    await notice($, failed === 0 ? 'info' : 'warn', t(T.restoredNote, { n: restored }), feature.id, { immediate: true })
  }
  lines.push(t(T.rSummary, { n: restored, m: skipped, k: failed }))
  lines.push(t(T.rScope))
  return { title: t(T.restoreTitle), lines }
}

const firstLine = (text: string): string => clip(text.trim().split('\n')[0] ?? '', 120)

/** Git restore: shows `git diff --stat` for the files and runs `git checkout -- <file>` for each one the person confirms. */
async function gitRestore($: EngineInterface, cp: Checkpoint): Promise<Report> {
  const title = t(T.gitTitle)
  let cwd = ''
  try {
    cwd = await $.session.cwd()
  } catch {
    cwd = ''
  }
  let isRepo = false
  try {
    const r = await $.process.run(['git', 'rev-parse', '--is-inside-work-tree'], { cwd, timeoutMs: 5000 })
    isRepo = r.exitCode === 0 && r.stdout.trim() === 'true'
  } catch {
    isRepo = false
  }
  if (!isRepo) return { title, lines: [t(T.gNoRepo)] }
  if (cp.files.length === 0) return { title, lines: [t(T.noFiles)] }

  const lines: string[] = [t(T.gIntro)]
  const paths = cp.files.map(f => f.path)
  let stat = ''
  try {
    const r = await $.process.run(['git', 'diff', '--stat=200', '--', ...paths], { cwd, timeoutMs: 10000 })
    if (r.exitCode !== 0) {
      lines.push(t(T.gStatFail, { why: firstLine(r.stderr) }))
      return { title, lines }
    }
    stat = r.stdout
  } catch {
    lines.push(t(T.gStatFail, { why: '?' }))
    return { title, lines }
  }
  const statLines = stat.split('\n').filter(l => l.trim() !== '')
  if (statLines.length === 0) {
    lines.push(t(T.gClean))
    return { title, lines }
  }
  for (const l of statLines.slice(0, 14)) lines.push(l)

  const named = cp.files.filter(f => stat.includes(baseName(f.path)))
  const candidates = named.length > 0 ? named : cp.files
  let ran = 0
  let failed = 0
  for (const f of candidates) {
    let answer = ''
    try {
      answer = await $.ui.ask(t(T.gAsk, { path: f.path }), { header: t(T.gHeader), options: [t(T.gRun), t(T.skip)] })
    } catch {
      answer = ''
    }
    if (answer !== t(T.gRun)) {
      lines.push(t(T.rSkipped, { path: f.path }))
      continue
    }
    try {
      const r = await $.process.run(['git', 'checkout', '--', f.path], { cwd, timeoutMs: 15000 })
      if (r.exitCode === 0) {
        ran += 1
        lines.push(t(T.gOk, { path: f.path }))
      } else {
        failed += 1
        lines.push(t(T.gFail, { path: f.path, why: firstLine(r.stderr) }))
      }
    } catch {
      failed += 1
      lines.push(t(T.gFail, { path: f.path, why: '?' }))
    }
  }
  if (ran + failed > 0) {
    await recordEvidence($, {
      kind: 'git',
      ok: failed === 0,
      summary: `git checkout -- ${ran} ${ran === 1 ? 'file' : 'files'} (${cp.label})`,
      ref: `checkpoint ${cp.id}`,
      feature: feature.id,
    })
  }
  return { title, lines }
}

type Action = 'inspect' | 'compare' | 'restore' | 'git' | 'copy'

/** One header action on the selected checkpoint (the newest when none is selected). */
async function runAction($: EngineInterface, e: PaneInput, action: Action): Promise<void> {
  const s = await read($, state)
  if (s.busy) return
  const found = s.selected === null ? -1 : s.cps.findIndex(c => c.id === s.selected)
  const at = found < 0 ? s.cps.length - 1 : found
  const cp = s.cps[at]

  if (cp === undefined) {
    await notice($, 'info', t(T.noSelection), feature.id, { immediate: true })
    return
  }
  if (action === 'copy') {
    const done = await $.ui.copy({ text: timelineText(s.cps), surface: e.surface })
    if (done.isCopied) await notice($, 'info', t(T.copied), feature.id, { immediate: true })
    else await notice($, 'warn', t(T.copyFailed, { why: done.reason }), feature.id)
    return
  }
  if (action === 'inspect') {
    await setReport($, inspectReport(cp))
    return
  }
  if (action === 'compare') {
    await setReport($, compareReport(cp, at > 0 ? s.cps[at - 1] : undefined))
    return
  }
  await setBusy($, true)
  try {
    const report = action === 'restore' ? await restoreCheckpoint($, cp) : await gitRestore($, cp)
    await setReport($, report)
  } finally {
    await setBusy($, false)
  }
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'timeline', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'timeline', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  const now = await $.clock.now()
  await update($, state, s =>
    s.cps.length > 0
      ? s
      : { ...s, cps: [{ id: 0, at: now, turnId: '', label: t(T.startLabel), files: [], evidence: { passed: 0, failed: 0, lines: [] } }], nextId: 1 },
  )
}

export async function onPromptSubmit($: EngineInterface, e: Input<'prompt.submit'>): Promise<Input<'prompt.submit'> | { drop: string }> {
  if (!(await isOn($, feature))) return e
  const text = e.text
  if (e.origin?.kind === 'plugin' || text.trimStart().startsWith('/')) return e
  const label = labelOf(text)
  if (label !== '') await update($, state, s => ({ ...s, prompt: label }))
  return e
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  const now = await $.clock.now()
  const fallback = e.text.trimStart().startsWith('/') ? '' : labelOf(e.text)
  await update($, state, s => ({ ...s, turnStartAt: now, label: s.prompt !== '' ? s.prompt : fallback, prompt: '' }))
  await update($, turnState, () => ({ snaps: {}, changed: [] }))
}

export async function beforeEditCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return undefined
  if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit') return undefined

  const path = pathOf(e)
  if (path === undefined) return undefined
  const current = await read($, turnState)
  if (path in current.snaps) return undefined

  let snap: string | null = null
  try {
    if (await $.fs.exists(path)) {
      const stat = await $.fs.stat(path)
      if (stat.kind !== 'file' || stat.size > MAX_FILE) return undefined
      snap = await $.fs.read(path)
    }
  } catch {
    return undefined
  }
  let held = 0
  for (const v of Object.values(current.snaps)) held += v === null ? 4 : jsonLen(v)
  if (snap !== null && held + jsonLen(snap) > SNAP_BUDGET) return undefined
  const now = await $.clock.now()
  await update($, turnState, s => (path in s.snaps ? s : { ...s, snaps: { ...s.snaps, [path]: snap } }))
  await update($, state, s => (s.turnStartAt === 0 ? { ...s, turnStartAt: now } : s))
  return undefined
}

export async function afterEditCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return result
  if (result.deny !== undefined || result.isError) return result

  const path = pathOf(e)
  if (path !== undefined) {
    await update($, turnState, s => (s.changed.includes(path) || !(path in s.snaps) ? s : { ...s, changed: [...s.changed, path] }))
  }
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const turn = await read($, turnState)
  const startAt = (await read($, state)).turnStartAt
  const reset = { turnStartAt: 0, label: '' }
  await update($, turnState, () => ({ snaps: {}, changed: [] }))
  if (turn.changed.length === 0) {
    await update($, state, s => ({ ...s, ...reset }))
    return
  }

  const files: FileCp[] = []
  for (const path of turn.changed.slice(0, MAX_FILES)) {
    const before = turn.snaps[path]
    if (before === undefined) continue
    let after = ''
    try {
      if (await $.fs.exists(path)) after = await $.fs.read(path)
    } catch {
      continue
    }
    if (before === after) continue
    const { added, removed } = countDiff(before ?? '', after)
    files.push({ path, before, after, added, removed, dropped: false, goneAfter: false, bb: before === null ? 0 : sizeOf(before), ab: sizeOf(after) })
  }
  if (files.length === 0) {
    await update($, state, s => ({ ...s, ...reset }))
    return
  }

  const now = await $.clock.now()
  const evidence = evidenceOf(await allEvidence($), startAt, e.turnId)
  await update($, state, s => {
    const label = s.label !== '' ? s.label : t(T.untitled)
    const cp: Checkpoint = { id: s.nextId, at: now, turnId: e.turnId, label, files, evidence }
    return { ...s, ...reset, cps: capStore([...s.cps, cp]), nextId: s.nextId + 1, selected: null }
  })
}

/** The timeline is pull, not push: no band chip. */
export async function renderChip($: EngineInterface, _e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature))) return null
  return null
}

/** The last five checkpoints that changed files. */
export async function renderDetail($: EngineInterface, e: PaneInput) {
  if (!(await isOn($, feature))) return null
  const { Box, Text } = $.ui.resolve(e)
  const { cps } = await read($, state)
  const last = cps
    .filter(c => c.files.length > 0)
    .slice(-5)
    .reverse()
  if (last.length === 0) return <Box flexDirection="column">{emptyState($, e, t(T.detailEmpty), t(T.emptyHint))}</Box>
  return (
    <Box flexDirection="column">
      {sectionTitle($, e, t(T.paneTitle))}
      {last.map(cp => listRow($, e, { key: `tm-${cp.id}`, text: rowText(cp), level: cp.evidence.failed > 0 ? 'warn' : 'ok' }))}
      <Text dimColor size="footnote">
        /timeline
      </Text>
    </Box>
  )
}

const lineColor = (line: string): 'success' | 'error' | undefined => (line.startsWith('+ ') ? 'success' : line.startsWith('− ') ? 'error' : undefined)

export function register(on: On) {
  on('command.run', { command: 'timeline' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: 'time-machine', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'time-machine' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const s = await read($, state)
    const cps = s.cps
    const sel = cps.find(c => c.id === s.selected) ?? cps[cps.length - 1]
    const room = Math.max(5, (e.viewport?.rows ?? 25) - 14)
    const rows = [...cps].reverse().slice(0, room)
    const hasFiles = cps.some(c => c.files.length > 0)

    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: cps.length === 1 ? t(T.oneCp) : t(T.nCps, { n: cps.length }),
          level: 'info',
          icon: ICONS.visibility,
          actions: [
            { key: 'tm-inspect', label: t(T.inspect), onPress: () => runAction($, e, 'inspect') },
            { key: 'tm-compare', label: t(T.compare), onPress: () => runAction($, e, 'compare') },
            { key: 'tm-restore', label: t(T.restore), onPress: () => runAction($, e, 'restore') },
            { key: 'tm-git', label: t(T.gitRestore), onPress: () => runAction($, e, 'git') },
            { key: 'tm-copy', label: t(T.copy), onPress: () => runAction($, e, 'copy') },
          ],
        })}
        {cps.length === 0 ? emptyState($, e, t(T.empty), t(T.emptyHint)) : null}
        {rows.map(cp =>
          listRow($, e, {
            key: `cp-${cp.id}`,
            text: rowText(cp),
            right: sel !== undefined && sel.id === cp.id ? '◂' : undefined,
            level: sel !== undefined && sel.id === cp.id ? 'info' : cp.evidence.failed > 0 ? 'warn' : 'ok',
            onPress: () => update($, state, x => ({ ...x, selected: cp.id, report: null })),
          }),
        )}
        {sel !== undefined && hasFiles ? (
          <Box flexDirection="column">
            {sectionTitle($, e, t(T.selected, { label: sel.label }))}
            <Text dimColor size="footnote">
              {t(T.scope)}
            </Text>
            {sel.files.length === 0 ? <Text dimColor>{t(T.noFiles)}</Text> : null}
            {sel.files.map((f, i) => (
              <Box key={`file-${sel.id}-${i}`} gap={1}>
                <Text color="success">{`+${f.added}`}</Text>
                <Text color="error">{`−${f.removed}`}</Text>
                <Text>{f.path}</Text>
                {f.before === null ? <Text dimColor>{`(${t(T.fileNew)})`}</Text> : null}
                {f.dropped ? <Text dimColor>{`(${t(T.fileDropped)})`}</Text> : null}
              </Box>
            ))}
          </Box>
        ) : null}
        {cps.length > 0 && !hasFiles ? emptyState($, e, t(T.noChanges), t(T.emptyHint)) : null}
        {s.report !== null ? (
          <Box flexDirection="column">
            {sectionTitle($, e, s.report.title)}
            {s.report.lines.map((line, i) => (
              <Text key={`rep-${i}`} color={lineColor(line)} dimColor={line.startsWith('  ')}>
                {line}
              </Text>
            ))}
          </Box>
        ) : null}
      </Box>
    )
  })
}
