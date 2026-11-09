import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, FsEntry, RenderElement, RenderInput, RenderSurface } from 'claude-code'

import { isRtl, language, notice, storeGet, storeSet, t } from './core'
import { REPO_URL, isPlaceholder } from './credits'
import { INSTALL_CMD } from './sharing'
import { emptyState, listRow, paneHeader } from './ui'

/*
 * One set of Save / Copy / Share actions for every visual Toolkitty draws.
 *   - `exportDir` is the one folder exports go to: the stored `exports:dir` when the person chose one;
 *     in a session with no project folder (cwd under `scratch-workspaces`, `\Temp\` or `/tmp/`, which is
 *     deleted with the session) `<home>/Documents/Toolkitty/exports`; else `<cwd>/toolkitty-exports`.
 *   - `exportPath` names a file `<exportDir>/<kind>-<YYYY-MM-DD>-<HHMM>.<ext>`
 *     and never overwrites: a taken name gets `-2`, `-3`, ...
 *   - `writeExport`, `saveSvg`, `saveText`, `copyText`, `shareExport` do the work and say
 *     what happened through one notice (immediate: it answers a press).
 *   - `exportBar` is the row of plain buttons a pane puts under its picture:
 *     `Save SVG` (desktop with a picture, otherwise `Save text` as .txt), `Copy text`, `Share`, `Print`,
 *     `Open folder` (the platform's file manager on exportDir) and `Copy path`.
 *   - `exportsPane` / `exportsCommand` are the `/exports` pane and command (list, open, change the folder).
 *   - Share saves the picture, copies the text and opens the share sheet (`sharePane`, pane `toolkitty-share`):
 *     the text, the picture's path, and one button per target (WhatsApp, Telegram, X, LinkedIn, Reddit, Email),
 *     each copying the text first and then launching a prefilled link with the platform's opener
 *     (rundll32 on Windows, open on macOS, xdg-open on Linux). Print writes `<kind>-<stamp>.print.html`
 *     (the picture inline, the text under it, a script that opens the print dialog) and launches it the same way.
 * Everything here is a function declaration, as the engine requires for anything `$` is passed to.
 * The file is .tsx (not .ts) because the bar is drawn with JSX.
 */

const U = {
  saveSvg: { en: 'Save SVG', he: 'שמור SVG', es: 'Guardar SVG', fr: 'Enregistrer le SVG', ru: 'Сохранить SVG', zh: '保存 SVG', ja: 'SVG を保存', pt: 'Salvar SVG', de: 'SVG speichern', ko: 'SVG 저장' },
  saveText: { en: 'Save text', he: 'שמור טקסט', es: 'Guardar texto', fr: 'Enregistrer le texte', ru: 'Сохранить текст', zh: '保存文本', ja: 'テキストを保存', pt: 'Salvar texto', de: 'Text speichern', ko: '텍스트 저장' },
  copyText: { en: 'Copy text', he: 'העתק טקסט', es: 'Copiar texto', fr: 'Copier le texte', ru: 'Копировать текст', zh: '复制文本', ja: 'テキストをコピー', pt: 'Copiar texto', de: 'Text kopieren', ko: '텍스트 복사' },
  share: { en: 'Share', he: 'שתף', es: 'Compartir', fr: 'Partager', ru: 'Поделиться', zh: '分享', ja: '共有', pt: 'Compartilhar', de: 'Teilen', ko: '공유' },
  saved: { en: 'Saved {path}', he: 'נשמר {path}', es: 'Guardado {path}', fr: 'Enregistré {path}', ru: 'Сохранено: {path}', zh: '已保存 {path}', ja: '{path} を保存しました', pt: 'Salvo {path}', de: '{path} gespeichert', ko: '{path} 저장됨' },
  savedAsText: {
    en: 'Saved {path} as text (this surface cannot draw images)',
    he: 'נשמר {path} כטקסט (במשטח הזה אי אפשר לצייר תמונות)',
    es: 'Guardado {path} como texto (esta superficie no dibuja imágenes)',
    fr: 'Enregistré {path} en texte (cette surface ne dessine pas d’images)',
    ru: 'Сохранено как текст: {path} (здесь нельзя рисовать изображения)',
    zh: '已将 {path} 保存为文本（此界面无法绘制图像）',
    ja: '{path} をテキストとして保存しました（この画面では画像を描画できません）',
    pt: 'Salvo {path} como texto (esta superfície não desenha imagens)',
    de: '{path} als Text gespeichert (diese Oberfläche zeigt keine Bilder)',
    ko: '{path}을(를) 텍스트로 저장됨(이 화면은 이미지를 그릴 수 없음)',
  },
  saveFailed: { en: 'Could not save the file', he: 'לא ניתן לשמור את הקובץ', es: 'No se pudo guardar el archivo', fr: 'Impossible d’enregistrer le fichier', ru: 'Не удалось сохранить файл', zh: '无法保存文件', ja: 'ファイルを保存できませんでした', pt: 'Não foi possível salvar o arquivo', de: 'Datei konnte nicht gespeichert werden', ko: '파일을 저장할 수 없음' },
  copied: { en: 'Copied', he: 'הועתק', es: 'Copiado', fr: 'Copié', ru: 'Скопировано', zh: '已复制', ja: 'コピーしました', pt: 'Copiado', de: 'Kopiert', ko: '복사됨' },
  copyFailed: { en: 'Could not copy', he: 'ההעתקה נכשלה', es: 'No se pudo copiar', fr: 'Copie impossible', ru: 'Не удалось скопировать', zh: '无法复制', ja: 'コピーできませんでした', pt: 'Não foi possível copiar', de: 'Kopieren fehlgeschlagen', ko: '복사할 수 없음' },
  shareDone: { en: 'Copied + saved {path}', he: 'הועתק + נשמר: {path}', es: 'Copiado + guardado: {path}', fr: 'Copié + enregistré : {path}', ru: 'Скопировано + сохранено: {path}', zh: '已复制并保存 {path}', ja: 'コピーして {path} に保存しました', pt: 'Copiado + salvo {path}', de: 'Kopiert + {path} gespeichert', ko: '복사 + {path} 저장됨' },
  shareCopiedOnly: { en: 'Copied (could not save the SVG)', he: 'הועתק (לא ניתן לשמור את ה-SVG)', es: 'Copiado (no se pudo guardar el SVG)', fr: 'Copié (impossible d’enregistrer le SVG)', ru: 'Скопировано (не удалось сохранить SVG)', zh: '已复制（无法保存 SVG）', ja: 'コピーしました（SVG は保存できませんでした）', pt: 'Copiado (não foi possível salvar o SVG)', de: 'Kopiert (SVG konnte nicht gespeichert werden)', ko: '복사됨(SVG는 저장하지 못함)' },
  shareSavedOnly: { en: 'Saved {path} (could not copy)', he: 'נשמר: {path} (לא ניתן להעתיק)', es: 'Guardado: {path} (no se pudo copiar)', fr: 'Enregistré : {path} (copie impossible)', ru: 'Сохранено: {path} (не удалось скопировать)', zh: '已保存 {path}（无法复制）', ja: '{path} に保存しました（コピーできませんでした）', pt: 'Salvo {path} (não foi possível copiar)', de: '{path} gespeichert (Kopieren fehlgeschlagen)', ko: '{path} 저장됨(복사하지 못함)' },
  shareFailed: { en: 'Could not copy or save', he: 'לא ניתן להעתיק או לשמור', es: 'No se pudo copiar ni guardar', fr: 'Impossible de copier ou d’enregistrer', ru: 'Не удалось скопировать или сохранить', zh: '无法复制或保存', ja: 'コピーも保存もできませんでした', pt: 'Não foi possível copiar nem salvar', de: 'Kopieren und Speichern fehlgeschlagen', ko: '복사도 저장도 할 수 없음' },
  openFolder: { en: 'Open folder', he: 'פתח תיקייה', es: 'Abrir carpeta', fr: 'Ouvrir le dossier', ru: 'Открыть папку', zh: '打开文件夹', ja: 'フォルダーを開く', pt: 'Abrir pasta', de: 'Ordner öffnen', ko: '폴더 열기' },
  copyPath: { en: 'Copy path', he: 'העתק נתיב', es: 'Copiar ruta', fr: 'Copier le chemin', ru: 'Копировать путь', zh: '复制路径', ja: 'パスをコピー', pt: 'Copiar caminho', de: 'Pfad kopieren', ko: '경로 복사' },
  changeFolder: { en: 'Change folder', he: 'שנה תיקייה', es: 'Cambiar carpeta', fr: 'Changer de dossier', ru: 'Сменить папку', zh: '更改文件夹', ja: 'フォルダーを変更', pt: 'Alterar pasta', de: 'Ordner ändern', ko: '폴더 변경' },
  pathCopied: { en: 'Copied {path}', he: 'הועתק: {path}', es: 'Copiado: {path}', fr: 'Copié : {path}', ru: 'Скопировано: {path}', zh: '已复制 {path}', ja: '{path} をコピーしました', pt: 'Copiado: {path}', de: 'Kopiert: {path}', ko: '{path} 복사됨' },
  openFailed: { en: 'Could not open the folder. Path: {path}', he: 'לא ניתן לפתוח את התיקייה. נתיב: {path}', es: 'No se pudo abrir la carpeta. Ruta: {path}', fr: 'Impossible d’ouvrir le dossier. Chemin : {path}', ru: 'Не удалось открыть папку. Путь: {path}', zh: '无法打开文件夹。路径：{path}', ja: 'フォルダーを開けませんでした。パス：{path}', pt: 'Não foi possível abrir a pasta. Caminho: {path}', de: 'Ordner konnte nicht geöffnet werden. Pfad: {path}', ko: '폴더를 열 수 없음. 경로: {path}' },
  noFolder: { en: 'Nothing saved yet: the first Save creates {path}', he: 'עדיין לא נשמר דבר: השמירה הראשונה תיצור את {path}', es: 'Aún no hay nada guardado: el primer Guardar crea {path}', fr: 'Rien d’enregistré pour l’instant : le premier enregistrement crée {path}', ru: 'Пока ничего не сохранено: первое сохранение создаст {path}', zh: '尚未保存任何内容：第一次保存时会创建 {path}', ja: 'まだ何も保存されていません。最初の保存で {path} が作成されます', pt: 'Nada salvo ainda: o primeiro Salvar cria {path}', de: 'Noch nichts gespeichert: das erste Speichern legt {path} an', ko: '아직 저장된 항목 없음: 처음 저장할 때 {path}이(가) 만들어짐' },
  openingFolder: { en: 'Opening {path}', he: 'פותח את {path}', es: 'Abriendo {path}', fr: 'Ouverture de {path}', ru: 'Открываю {path}', zh: '正在打开 {path}', ja: '{path} を開いています', pt: 'Abrindo {path}', de: '{path} wird geöffnet', ko: '{path} 여는 중' },
  paneTitle: { en: 'Exports', he: 'ייצואים', es: 'Exportaciones', fr: 'Exports', ru: 'Экспорт', zh: '导出文件', ja: 'エクスポート', pt: 'Exportações', de: 'Exporte', ko: '내보낸 파일' },
  paneStatus: { en: '{n} files', he: '{n} קבצים', es: '{n} archivos', fr: '{n} fichiers', ru: 'файлов: {n}', zh: '{n} 个文件', ja: '{n} 個のファイル', pt: '{n} arquivos', de: '{n} Dateien', ko: '파일 {n}개' },
  paneOpened: { en: 'Exports pane opened.', he: 'חלונית הייצואים נפתחה.', es: 'Panel de exportaciones abierto.', fr: 'Panneau des exports ouvert.', ru: 'Панель экспорта открыта.', zh: '导出面板已打开。', ja: 'エクスポートパネルを開きました。', pt: 'Painel de exportações aberto.', de: 'Export-Panel geöffnet.', ko: '내보내기 창이 열렸습니다.' },
  emptyMain: { en: 'No exported files yet in {path}', he: 'עדיין אין קבצים מיוצאים ב-{path}', es: 'Aún no hay archivos exportados en {path}', fr: 'Aucun fichier exporté pour l’instant dans {path}', ru: 'В {path} пока нет экспортированных файлов', zh: '{path} 中还没有导出的文件', ja: '{path} にはまだエクスポートしたファイルがありません', pt: 'Ainda não há arquivos exportados em {path}', de: 'Noch keine exportierten Dateien in {path}', ko: '{path}에 아직 내보낸 파일이 없음' },
  emptyHint: {
    en: 'The Save buttons on receipts, cards and charts put files here. With no project folder the session runs in a scratch workspace that is deleted with the session, so files go to Documents/Toolkitty/exports instead and stay.',
    he: 'כפתורי השמירה בקבלות, כרטיסים וגרפים מניחים כאן קבצים. כשאין תיקיית פרויקט, הסשן רץ בסביבת עבודה זמנית שנמחקת עם הסשן, ולכן הקבצים נשמרים ב-Documents/Toolkitty/exports ונשארים.',
    es: 'Los botones Guardar de recibos, tarjetas y gráficos dejan aquí los archivos. Sin carpeta de proyecto la sesión corre en un espacio temporal que se borra con la sesión, así que los archivos van a Documents/Toolkitty/exports y se conservan.',
    fr: 'Les boutons Enregistrer des reçus, cartes et graphiques déposent leurs fichiers ici. Sans dossier de projet, la session tourne dans un espace temporaire supprimé avec la session ; les fichiers vont donc dans Documents/Toolkitty/exports et restent.',
    ru: 'Кнопки сохранения в чеках, карточках и графиках кладут файлы сюда. Без папки проекта сессия работает во временном рабочем пространстве, которое удаляется вместе с сессией, поэтому файлы попадают в Documents/Toolkitty/exports и сохраняются.',
    zh: '回执、卡片和图表上的保存按钮会把文件放在这里。没有项目文件夹时，会话运行在随会话一起删除的临时工作区中，因此文件会保存到 Documents/Toolkitty/exports，不会丢失。',
    ja: 'レシート、カード、グラフの保存ボタンで作られたファイルはここに入ります。プロジェクトフォルダーがないときは、セッションと一緒に削除される一時ワークスペースで動くため、ファイルは Documents/Toolkitty/exports に保存され、残ります。',
    pt: 'Os botões Salvar de recibos, cartões e gráficos colocam os arquivos aqui. Sem pasta de projeto, a sessão roda em um espaço temporário apagado junto com a sessão, então os arquivos vão para Documents/Toolkitty/exports e permanecem.',
    de: 'Die Speichern-Schaltflächen von Belegen, Karten und Diagrammen legen Dateien hier ab. Ohne Projektordner läuft die Session in einem temporären Arbeitsbereich, der mit der Session gelöscht wird; deshalb landen die Dateien in Documents/Toolkitty/exports und bleiben erhalten.',
    ko: '영수증, 카드, 차트의 저장 버튼을 누르면 파일이 여기에 저장됩니다. 프로젝트 폴더가 없으면 세션은 종료 시 함께 삭제되는 임시 작업 공간에서 실행되므로, 파일은 대신 Documents/Toolkitty/exports에 저장되어 남습니다.',
  },
  moreRows: { en: 'Newest 30 of {n} shown', he: 'מוצגים 30 החדשים מתוך {n}', es: 'Se muestran los 30 más recientes de {n}', fr: 'Les 30 plus récents sur {n}', ru: 'Показаны 30 новейших из {n}', zh: '显示最新的 30 个，共 {n} 个', ja: '{n} 件中、新しい 30 件を表示', pt: 'Mostrando os 30 mais recentes de {n}', de: 'Die neuesten 30 von {n} werden gezeigt', ko: '{n}개 중 최신 30개 표시' },
  askPath: { en: 'Where should exported files go? Type the absolute path of an existing folder.', he: 'לאן לשמור קבצים מיוצאים? הקלד נתיב מלא של תיקייה קיימת.', es: '¿Dónde deben guardarse los archivos exportados? Escribe la ruta absoluta de una carpeta existente.', fr: 'Où enregistrer les fichiers exportés ? Saisis le chemin absolu d’un dossier existant.', ru: 'Куда сохранять экспортируемые файлы? Введите абсолютный путь к существующей папке.', zh: '导出的文件应保存到哪里？请输入现有文件夹的绝对路径。', ja: 'エクスポートしたファイルの保存先はどこですか？既存フォルダーの絶対パスを入力してください。', pt: 'Onde salvar os arquivos exportados? Digite o caminho absoluto de uma pasta existente.', de: 'Wohin sollen exportierte Dateien gespeichert werden? Gib den absoluten Pfad eines vorhandenen Ordners ein.', ko: '내보낸 파일을 어디에 저장할까요? 기존 폴더의 절대 경로를 입력하세요.' },
  askHeader: { en: 'Folder', he: 'תיקייה', es: 'Carpeta', fr: 'Dossier', ru: 'Папка', zh: '文件夹', ja: 'フォルダー', pt: 'Pasta', de: 'Ordner', ko: '폴더' },
  optDefault: { en: 'Use the default', he: 'השתמש בברירת המחדל', es: 'Usar la predeterminada', fr: 'Utiliser celui par défaut', ru: 'По умолчанию', zh: '使用默认位置', ja: '既定の場所に戻す', pt: 'Usar o padrão', de: 'Standard verwenden', ko: '기본값 사용' },
  optKeep: { en: 'Keep current', he: 'השאר את הנוכחית', es: 'Mantener la actual', fr: 'Garder l’actuel', ru: 'Оставить текущую', zh: '保持当前', ja: '今のままにする', pt: 'Manter a atual', de: 'Aktuellen behalten', ko: '현재 유지' },
  dirSet: { en: 'Exports now go to {path}', he: 'הייצואים נשמרים מעתה ב-{path}', es: 'Las exportaciones ahora van a {path}', fr: 'Les exports vont désormais dans {path}', ru: 'Экспорт теперь сохраняется в {path}', zh: '导出文件现在保存到 {path}', ja: '今後のエクスポートは {path} に保存されます', pt: 'As exportações agora vão para {path}', de: 'Exporte landen jetzt in {path}', ko: '이제 내보낸 파일은 {path}에 저장됨' },
  dirReset: { en: 'Exports folder reset to the default: {path}', he: 'תיקיית הייצוא אופסה לברירת המחדל: {path}', es: 'Carpeta de exportaciones restablecida: {path}', fr: 'Dossier d’exports réinitialisé : {path}', ru: 'Папка экспорта сброшена на стандартную: {path}', zh: '导出文件夹已恢复默认：{path}', ja: 'エクスポート先を既定に戻しました：{path}', pt: 'Pasta de exportações restaurada ao padrão: {path}', de: 'Exportordner auf Standard zurückgesetzt: {path}', ko: '내보내기 폴더를 기본값으로 되돌림: {path}' },
  dirInvalid: { en: 'Not an existing folder (give an absolute path): {path}', he: 'זו לא תיקייה קיימת (יש לתת נתיב מלא): {path}', es: 'No es una carpeta existente (da una ruta absoluta): {path}', fr: 'Ce n’est pas un dossier existant (donne un chemin absolu) : {path}', ru: 'Такой папки нет (укажите абсолютный путь): {path}', zh: '不是现有文件夹（请提供绝对路径）：{path}', ja: '既存のフォルダーではありません（絶対パスを指定してください）：{path}', pt: 'Não é uma pasta existente (informe um caminho absoluto): {path}', de: 'Kein vorhandener Ordner (absoluten Pfad angeben): {path}', ko: '기존 폴더가 아님(절대 경로를 입력): {path}' },
  dirCurrent: { en: 'Exports go to {path}', he: 'הייצואים נשמרים ב-{path}', es: 'Las exportaciones van a {path}', fr: 'Les exports vont dans {path}', ru: 'Экспорт сохраняется в {path}', zh: '导出文件保存在 {path}', ja: 'エクスポート先：{path}', pt: 'As exportações vão para {path}', de: 'Exporte landen in {path}', ko: '내보낸 파일 저장 위치: {path}' },
  dirUsage: { en: 'Change: /exports dir <path> · reset: /exports dir default', he: 'שינוי: /exports dir <path> · איפוס: /exports dir default', es: 'Cambiar: /exports dir <path> · restablecer: /exports dir default', fr: 'Changer : /exports dir <path> · réinitialiser : /exports dir default', ru: 'Изменить: /exports dir <path> · сбросить: /exports dir default', zh: '更改：/exports dir <path> · 重置：/exports dir default', ja: '変更：/exports dir <path> · リセット：/exports dir default', pt: 'Alterar: /exports dir <path> · restaurar: /exports dir default', de: 'Ändern: /exports dir <path> · zurücksetzen: /exports dir default', ko: '변경: /exports dir <path> · 초기화: /exports dir default' },
  sheetTitle: { en: 'Share', he: 'שיתוף', es: 'Compartir', fr: 'Partager', ru: 'Поделиться', zh: '分享', ja: '共有', pt: 'Compartilhar', de: 'Teilen', ko: '공유' },
  sheetEmpty: { en: 'Nothing to share yet', he: 'עדיין אין מה לשתף', es: 'Aún no hay nada que compartir', fr: 'Rien à partager pour l’instant', ru: 'Пока нечем делиться', zh: '暂时没有可分享的内容', ja: 'まだ共有するものがありません', pt: 'Ainda não há nada para compartilhar', de: 'Noch nichts zu teilen', ko: '아직 공유할 항목 없음' },
  sheetEmptyHint: { en: 'Press Share under a card, receipt or chart to open this sheet.', he: 'לחץ על ״שתף״ מתחת לכרטיס, לקבלה או לגרף כדי לפתוח את גיליון השיתוף.', es: 'Pulsa Compartir bajo una tarjeta, recibo o gráfico para abrir esta hoja.', fr: 'Appuie sur Partager sous une carte, un reçu ou un graphique pour ouvrir cette feuille.', ru: 'Нажмите «Поделиться» под карточкой, чеком или графиком, чтобы открыть этот лист.', zh: '在卡片、回执或图表下方点击“分享”即可打开此面板。', ja: 'カード、レシート、グラフの下にある「共有」を押すと、このシートが開きます。', pt: 'Pressione Compartilhar sob um cartão, recibo ou gráfico para abrir esta tela.', de: 'Drücke unter einer Karte, einem Beleg oder einem Diagramm auf Teilen, um dieses Blatt zu öffnen.', ko: '카드, 영수증, 차트 아래의 공유를 누르면 이 시트가 열립니다.' },
  pictureSaved: { en: 'Picture saved: {path}', he: 'התמונה נשמרה: {path}', es: 'Imagen guardada: {path}', fr: 'Image enregistrée : {path}', ru: 'Картинка сохранена: {path}', zh: '图片已保存：{path}', ja: '画像を保存しました：{path}', pt: 'Imagem salva: {path}', de: 'Bild gespeichert: {path}', ko: '그림 저장됨: {path}' },
  pictureNone: { en: 'The picture was not saved. The text can still be shared.', he: 'התמונה לא נשמרה. עדיין אפשר לשתף את הטקסט.', es: 'La imagen no se guardó. El texto aún se puede compartir.', fr: 'L’image n’a pas été enregistrée. Le texte peut encore être partagé.', ru: 'Картинка не сохранена. Текстом всё равно можно поделиться.', zh: '图片未保存，但仍可分享文本。', ja: '画像は保存されませんでした。テキストは共有できます。', pt: 'A imagem não foi salva. O texto ainda pode ser compartilhado.', de: 'Das Bild wurde nicht gespeichert. Der Text lässt sich weiterhin teilen.', ko: '그림이 저장되지 않았습니다. 텍스트는 계속 공유할 수 있습니다.' },
  targetsTitle: { en: 'Share to', he: 'שיתוף אל', es: 'Compartir en', fr: 'Partager sur', ru: 'Куда поделиться', zh: '分享到', ja: '共有先', pt: 'Compartilhar em', de: 'Teilen mit', ko: '공유 대상' },
  email: { en: 'Email', he: 'אימייל', es: 'Correo', fr: 'E-mail', ru: 'Эл. почта', zh: '电子邮件', ja: 'メール', pt: 'E-mail', de: 'E-Mail', ko: '이메일' },
  print: { en: 'Print', he: 'הדפס', es: 'Imprimir', fr: 'Imprimer', ru: 'Печать', zh: '打印', ja: '印刷', pt: 'Imprimir', de: 'Drucken', ko: '인쇄' },
  targetOpened: { en: '{target} opened, text copied ({detail})', he: '{target} נפתח, הטקסט הועתק ({detail})', es: '{target} abierto, texto copiado ({detail})', fr: '{target} ouvert, texte copié ({detail})', ru: '{target} открыт, текст скопирован ({detail})', zh: '已打开 {target}，文本已复制（{detail}）', ja: '{target} を開き、テキストをコピーしました（{detail}）', pt: '{target} aberto, texto copiado ({detail})', de: '{target} geöffnet, Text kopiert ({detail})', ko: '{target} 열림, 텍스트 복사됨({detail})' },
  targetFailed: { en: 'Could not open {target} ({detail}). The text is on the clipboard.', he: 'לא ניתן לפתוח את {target} ({detail}). הטקסט נמצא בלוח.', es: 'No se pudo abrir {target} ({detail}). El texto está en el portapapeles.', fr: 'Impossible d’ouvrir {target} ({detail}). Le texte est dans le presse-papiers.', ru: 'Не удалось открыть {target} ({detail}). Текст в буфере обмена.', zh: '无法打开 {target}（{detail}）。文本已在剪贴板中。', ja: '{target} を開けませんでした（{detail}）。テキストはクリップボードにあります。', pt: 'Não foi possível abrir {target} ({detail}). O texto está na área de transferência.', de: '{target} konnte nicht geöffnet werden ({detail}). Der Text liegt in der Zwischenablage.', ko: '{target}을(를) 열 수 없음({detail}). 텍스트는 클립보드에 있습니다.' },
  trimmedNote: { en: 'Long text: the links carry a shortened version. Copy text has all of it.', he: 'טקסט ארוך: הקישורים נושאים גרסה מקוצרת. ״העתק טקסט״ מעתיק את כולו.', es: 'Texto largo: los enlaces llevan una versión abreviada. Copiar texto copia todo.', fr: 'Texte long : les liens portent une version abrégée. Copier le texte copie tout.', ru: 'Длинный текст: в ссылки попадает сокращённая версия. «Копировать текст» копирует всё.', zh: '文本较长：链接中带的是缩短版。“复制文本”会复制全部内容。', ja: 'テキストが長いため、リンクには短縮版が入ります。「テキストをコピー」なら全文をコピーできます。', pt: 'Texto longo: os links levam uma versão abreviada. Copiar texto copia tudo.', de: 'Langer Text: Die Links enthalten eine gekürzte Fassung. „Text kopieren“ liefert den ganzen Text.', ko: '긴 텍스트: 링크에는 줄인 버전이 들어갑니다. 텍스트 복사는 전체를 복사합니다.' },
  sheetFootnote: { en: 'Nothing is uploaded. The picture is on disk; attach it in the app you chose.', he: 'שום דבר לא מועלה לרשת. התמונה שמורה בדיסק; צרף אותה באפליקציה שבחרת.', es: 'No se sube nada. La imagen está en el disco; adjúntala en la aplicación que elijas.', fr: 'Rien n’est envoyé en ligne. L’image est sur le disque ; joins-la dans l’application choisie.', ru: 'Ничего не отправляется в сеть. Картинка лежит на диске; приложите её в выбранном приложении.', zh: '不会上传任何内容。图片保存在本地磁盘；请在所选应用中添加为附件。', ja: '何もアップロードされません。画像はディスクにあります。選んだアプリで添付してください。', pt: 'Nada é enviado. A imagem está no disco; anexe-a no aplicativo escolhido.', de: 'Es wird nichts hochgeladen. Das Bild liegt auf der Festplatte; hänge es in der gewählten App an.', ko: '업로드되는 것은 없습니다. 그림은 디스크에 있으니 선택한 앱에서 첨부하세요.' },
  moreLines: { en: '… {n} more lines', he: '… עוד {n} שורות', es: '… {n} líneas más', fr: '… {n} lignes de plus', ru: '… ещё строк: {n}', zh: '… 还有 {n} 行', ja: '… ほか {n} 行', pt: '… mais {n} linhas', de: '… {n} weitere Zeilen', ko: '… {n}줄 더' },
  printOpened: { en: 'Print page opened: {path}', he: 'דף ההדפסה נפתח: {path}', es: 'Página de impresión abierta: {path}', fr: 'Page d’impression ouverte : {path}', ru: 'Страница печати открыта: {path}', zh: '打印页面已打开：{path}', ja: '印刷ページを開きました：{path}', pt: 'Página de impressão aberta: {path}', de: 'Druckseite geöffnet: {path}', ko: '인쇄 페이지 열림: {path}' },
  printFailed: { en: 'Could not open the print page: {path} (exit {code})', he: 'לא ניתן לפתוח את דף ההדפסה: {path} (קוד יציאה {code})', es: 'No se pudo abrir la página de impresión: {path} (código {code})', fr: 'Impossible d’ouvrir la page d’impression : {path} (code {code})', ru: 'Не удалось открыть страницу печати: {path} (код {code})', zh: '无法打开打印页面：{path}（退出码 {code}）', ja: '印刷ページを開けませんでした：{path}（終了コード {code}）', pt: 'Não foi possível abrir a página de impressão: {path} (código {code})', de: 'Druckseite konnte nicht geöffnet werden: {path} (Code {code})', ko: '인쇄 페이지를 열 수 없음: {path}(종료 코드 {code})' },
  printHint: { en: 'The print dialog opens by itself. If it does not, press Ctrl+P.', he: 'חלון ההדפסה נפתח מעצמו. אם לא, לחץ Ctrl+P.', es: 'El diálogo de impresión se abre solo. Si no, pulsa Ctrl+P.', fr: 'La boîte de dialogue d’impression s’ouvre toute seule. Sinon, appuie sur Ctrl+P.', ru: 'Окно печати откроется само. Если нет, нажмите Ctrl+P.', zh: '打印对话框会自动打开。若未打开，请按 Ctrl+P。', ja: '印刷ダイアログは自動で開きます。開かない場合は Ctrl+P を押してください。', pt: 'A caixa de impressão abre sozinha. Se não abrir, pressione Ctrl+P.', de: 'Der Druckdialog öffnet sich von selbst. Falls nicht, drücke Strg+P.', ko: '인쇄 대화상자가 자동으로 열립니다. 열리지 않으면 Ctrl+P를 누르세요.' },
} as const

export type ExportAction = 'save' | 'copy' | 'share' | 'print' | 'open' | 'path'
export type SaveResult = { isSaved: boolean; path: string }
export type CopyResult = { isCopied: boolean }
export type ShareResult = { isSaved: boolean; isCopied: boolean; path: string }

/** Escapes text for an SVG/XML text node or attribute. */
export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The last path segment: what a notice names. */
export function baseName(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return path.slice(cut + 1)
}

const two = (n: number): string => String(n).padStart(2, '0')

/** `YYYY-MM-DD-HHMM` in local time. */
export function stampOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`
}

function slug(kind: string): string {
  const s = kind.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s === '' ? 'export' : s
}

async function isTaken($: EngineInterface, path: string): Promise<boolean> {
  try {
    return await $.fs.exists(path)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------------------------
// Where exports go, and how to show or open that place
// ---------------------------------------------------------------------------------------------

export type Platform = 'windows' | 'mac' | 'linux'

/** The pane `/exports` opens. */
const EXPORTS_PANE_ID = 'toolkitty-exports'
/** How many files the `/exports` pane lists. */
const LIST_LIMIT = 30

/** The platform a path belongs to, read from its shape: `C:\...` or `\\server` is Windows, `/Users/...` macOS, other `/...` Linux. */
export function platformOf(path: string): Platform {
  if (/^[A-Za-z]:[\\/]|^\\\\/.test(path)) return 'windows'
  if (/^\/(Users|Volumes|System|Library|private)\//.test(path)) return 'mac'
  return 'linux'
}

const toSlash = (p: string): string => p.replace(/\\/g, '/')
/** Drops trailing separators (but never turns `C:/` or `/` into something else). */
const trimEnd = (p: string): string => (p.length > 3 ? p.replace(/\/+$/, '') : p)

/** A path as the platform writes it: backslashes on Windows. */
export function nativePath(path: string, platform: Platform): string {
  return platform === 'windows' ? path.replace(/\//g, '\\') : path
}

/** True when the working folder is an app-made scratch space that is deleted with the session. */
export function isScratchCwd(cwd: string): boolean {
  const p = `${toSlash(cwd).toLowerCase()}/`
  return p.includes('scratch-workspaces') || p.includes('/temp/') || p.includes('/tmp/')
}

// The home folder found by asking the shell once (only when the environment names none).
let homeCache = ''

/** The user's home: USERPROFILE / HOME, else asked of the shell once and remembered; '' when unknown. */
async function homeDir($: EngineInterface): Promise<string> {
  // The engine wants literal variable names here, so each is asked by name.
  try {
    const v = await $.env.get('USERPROFILE')
    if (v !== undefined && v.trim() !== '') return trimEnd(toSlash(v.trim()))
  } catch {
    // not readable: try the next
  }
  try {
    const v = await $.env.get('HOME')
    if (v !== undefined && v.trim() !== '') return trimEnd(toSlash(v.trim()))
  } catch {
    // not readable: ask the shell below
  }
  if (homeCache !== '') return homeCache
  const cwd = await $.session.cwd()
  const argv = platformOf(cwd) === 'windows' ? ['cmd.exe', '/c', 'echo %USERPROFILE%'] : ['sh', '-c', 'echo $HOME']
  try {
    const r = await $.process.run(argv, { timeoutMs: 5000 })
    const line = (r.stdout.split(/\r?\n/)[0] ?? '').trim()
    if (r.exitCode === 0 && line !== '' && !line.includes('%') && line !== '$HOME') homeCache = trimEnd(toSlash(line))
  } catch {
    // no shell answer: the caller falls back to the project
  }
  return homeCache
}

/**
 * The one folder exports go to (forward slashes): the stored `exports:dir` when the person chose one; else,
 * when the working folder is a scratch workspace (deleted with the session), `<home>/Documents/Toolkitty/exports`;
 * else `<cwd>/toolkitty-exports`. Without a known home the scratch case falls back to the cwd.
 */
export async function exportDir($: EngineInterface): Promise<string> {
  const stored = await storeGet<string>($, 'exports:dir', '')
  if (typeof stored === 'string' && stored.trim() !== '') return trimEnd(toSlash(stored.trim()))
  const cwd = trimEnd(toSlash(await $.session.cwd()))
  if (isScratchCwd(cwd)) {
    const home = await homeDir($)
    if (home !== '') return `${home}/Documents/Toolkitty/exports`
  }
  return `${cwd}/toolkitty-exports`
}

/** A path the way the person sees it (their platform's separators). */
async function shown($: EngineInterface, path: string): Promise<string> {
  return nativePath(path, platformOf(await $.session.cwd()))
}

/**
 * The path a new export goes to: `<exportDir>/<kind>-<stamp>.<ext>`, or with `isFlat`
 * the fallback `<cwd>/toolkitty-<kind>-<stamp>.<ext>`. A name that exists gets `-2`, `-3`, ...
 * The folder needs no creating: `$.fs.write` makes the directories of the path it writes.
 */
export async function exportPath($: EngineInterface, kind: string, ext: string, isFlat?: boolean): Promise<string> {
  const cwd = (await $.session.cwd()).replace(/[\\/]+$/, '')
  const now = await $.clock.now()
  const k = slug(kind)
  const base = isFlat === true ? `${cwd}/toolkitty-${k}-${stampOf(now)}` : `${await exportDir($)}/${k}-${stampOf(now)}`
  for (let n = 1; n < 1000; n++) {
    const path = `${base}${n === 1 ? '' : `-${n}`}.${ext}`
    if (!(await isTaken($, path))) return path
  }
  return `${base}-${now}.${ext}`
}

/** Writes `content` as a new export file (the folder first, the flat name when that fails); says nothing. */
export async function writeExport($: EngineInterface, kind: string, ext: string, content: string): Promise<SaveResult> {
  const folder = await exportPath($, kind, ext)
  try {
    await $.fs.write(folder, content)
    return { isSaved: true, path: folder }
  } catch {
    // the folder could not be made: try beside the project
  }
  const flat = await exportPath($, kind, ext, true)
  try {
    await $.fs.write(flat, content)
    return { isSaved: true, path: flat }
  } catch {
    return { isSaved: false, path: flat }
  }
}

/** Saves an SVG as a new file and says so: "Saved <full path>" or a warning. */
export async function saveSvg($: EngineInterface, kind: string, svgSource: string, feature?: string): Promise<SaveResult> {
  const r = await writeExport($, kind, 'svg', svgSource)
  if (r.isSaved) await notice($, 'info', t(U.saved, { path: await shown($, r.path) }), feature ?? kind, { immediate: true, toast: true })
  else await notice($, 'warn', t(U.saveFailed), feature ?? kind, { immediate: true, toast: true })
  return r
}

/** Saves text as a new .txt file; `isFallback` says it stands in for a picture the surface cannot draw. */
export async function saveText($: EngineInterface, kind: string, text: string, isFallback?: boolean, feature?: string): Promise<SaveResult> {
  const r = await writeExport($, kind, 'txt', text)
  if (r.isSaved) await notice($, 'info', t(isFallback === true ? U.savedAsText : U.saved, { path: await shown($, r.path) }), feature ?? kind, { immediate: true, toast: true })
  else await notice($, 'warn', t(U.saveFailed), feature ?? kind, { immediate: true, toast: true })
  return r
}

/** Puts text on the clipboard and says so. */
export async function copyText($: EngineInterface, text: string, surface: RenderSurface, feature?: string): Promise<CopyResult> {
  let isCopied = false
  try {
    isCopied = (await $.ui.copy({ text, surface })).isCopied
  } catch {
    isCopied = false
  }
  if (isCopied) await notice($, 'info', t(U.copied), feature ?? 'exports', { immediate: true, toast: true })
  else await notice($, 'warn', t(U.copyFailed), feature ?? 'exports', { immediate: true, toast: true })
  return { isCopied }
}

export type ShareSheet = { kind: string; text: string; path: string; svg: string }

/** What the share sheet shows: the share text, the picture's full path ('' when none was saved) and the picture itself (for Print). */
const shareSheet = atom({ plugin: 'toolkitty', key: 'slot', id: 'share-sheet' } as const, { kind: '', text: '', path: '', svg: '' } as ShareSheet) as unknown as Atom<ShareSheet>

/** The pane the share sheet lives in. */
const SHARE_PANE_ID = 'toolkitty-share'

/** Share: saves the picture, copies the share text, fills the share sheet and opens it. One notice for the save and the copy. */
export async function shareExport(
  $: EngineInterface,
  opts: { kind: string; svg?: string; share: string; surface: RenderSurface; feature?: string },
): Promise<ShareResult> {
  const feature = opts.feature ?? opts.kind
  let saved: SaveResult = { isSaved: false, path: '' }
  if (opts.svg !== undefined) saved = await writeExport($, opts.kind, 'svg', opts.svg)
  let isCopied = false
  try {
    isCopied = (await $.ui.copy({ text: opts.share, surface: opts.surface })).isCopied
  } catch {
    isCopied = false
  }
  const path = saved.isSaved ? await shown($, saved.path) : ''
  await update($, shareSheet, () => ({ kind: opts.kind, text: opts.share, path, svg: opts.svg ?? '' }))
  try {
    await $.ui.open({ id: SHARE_PANE_ID, title: t(U.sheetTitle), focus: true, closeOnEscape: true })
  } catch {
    // no surface to show the sheet on: the copy and the saved file still stand
  }
  const options = { immediate: true, toast: true }
  if (isCopied && saved.isSaved) await notice($, 'info', t(U.shareDone, { path }), feature, options)
  else if (isCopied && opts.svg === undefined) await notice($, 'info', t(U.copied), feature, options)
  else if (isCopied) await notice($, 'info', t(U.shareCopiedOnly), feature, options)
  else if (saved.isSaved) await notice($, 'info', t(U.shareSavedOnly, { path }), feature, options)
  else await notice($, 'warn', t(U.shareFailed), feature, options)
  return { isSaved: saved.isSaved, isCopied, path: saved.path }
}

// ---------------------------------------------------------------------------------------------
// Targets: a prefilled link per app, opened by the platform's opener
// ---------------------------------------------------------------------------------------------

export type ShareTarget = 'whatsapp' | 'telegram' | 'x' | 'linkedin' | 'reddit' | 'email'
export const SHARE_TARGETS: readonly ShareTarget[] = ['whatsapp', 'telegram', 'x', 'linkedin', 'reddit', 'email']
const TARGET_NAMES: Record<ShareTarget, string> = { whatsapp: 'WhatsApp', telegram: 'Telegram', x: 'X', linkedin: 'LinkedIn', reddit: 'Reddit', email: 'Email' }
/** The longest link any target gets: browsers and the shell's URL handler start to refuse past about 2,000 characters. */
export const LINK_MAX = 2000

/** What Telegram links to: the repository once it is real, else the install command. */
function shareLinkTarget(): string {
  return isPlaceholder(REPO_URL) ? INSTALL_CMD : REPO_URL
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').trim()
}

function afterFirstLine(text: string): string {
  const cut = text.indexOf('\n')
  return cut < 0 ? '' : text.slice(cut + 1).trim()
}

function buildLink(target: ShareTarget, text: string): string {
  const enc = encodeURIComponent
  if (target === 'whatsapp') return `https://wa.me/?text=${enc(text)}`
  if (target === 'telegram') return `https://t.me/share/url?url=${enc(shareLinkTarget())}&text=${enc(text)}`
  if (target === 'x') return `https://twitter.com/intent/tweet?text=${enc(text)}`
  if (target === 'linkedin') return `https://www.linkedin.com/feed/?shareActive=true&text=${enc(text)}`
  if (target === 'reddit') return `https://www.reddit.com/submit?title=${enc(firstLine(text))}&text=${enc(afterFirstLine(text))}`
  return `mailto:?subject=${enc(firstLine(text))}&body=${enc(text)}`
}

/** The prefilled link for a target; a text too long for LINK_MAX is cut (with an ellipsis) until the link fits. */
export function shareLink(target: ShareTarget, text: string): { url: string; isTrimmed: boolean } {
  const full = buildLink(target, text)
  if (full.length <= LINK_MAX) return { url: full, isTrimmed: false }
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (buildLink(target, `${text.slice(0, mid).trimEnd()}…`).length <= LINK_MAX) lo = mid
    else hi = mid - 1
  }
  return { url: buildLink(target, `${text.slice(0, lo).trimEnd()}…`), isTrimmed: true }
}

/** The argv that opens a link or file in the default app: rundll32 on Windows (no shell, so `&` and `%` need no escaping), open on macOS, xdg-open elsewhere. */
export function openerArgv(platform: Platform, target: string): string[] {
  if (platform === 'windows') return ['rundll32', 'url.dll,FileProtocolHandler', target]
  if (platform === 'mac') return ['open', target]
  return ['xdg-open', target]
}

type Opened = { isOpened: boolean; detail: string; code: string }

/** Runs the opener on a link or file; `detail` is `<program> → <exit code>` (plus stderr), `code` the exit code or the error. */
async function launchTarget($: EngineInterface, target: string): Promise<Opened> {
  const argv = openerArgv(platformOf(await $.session.cwd()), target)
  try {
    const r = await $.process.run(argv, { timeoutMs: 10_000 })
    const err = r.stderr.trim() === '' ? '' : ` · ${r.stderr.trim().slice(0, 100)}`
    return { isOpened: r.exitCode === 0, detail: `${argv[0]} → ${r.exitCode}${err}`, code: String(r.exitCode) }
  } catch (err) {
    const why = String(err instanceof Error ? err.message : err).slice(0, 120)
    return { isOpened: false, detail: why, code: why }
  }
}

/** A share button: copies the text first (so pasting works where the prefill is lost), then opens the prefilled link and says how it went. */
export async function shareTo($: EngineInterface, target: ShareTarget, text: string, surface: RenderSurface, feature?: string): Promise<boolean> {
  try {
    await $.ui.copy({ text, surface })
  } catch {
    // the link still opens; the text is also in the sheet
  }
  const name = target === 'email' ? t(U.email) : TARGET_NAMES[target]
  const r = await launchTarget($, shareLink(target, text).url)
  const options = { immediate: true, toast: true }
  if (r.isOpened) await notice($, 'info', t(U.targetOpened, { target: name, detail: r.detail }), feature ?? 'exports', options)
  else await notice($, 'warn', t(U.targetFailed, { target: name, detail: r.detail }), feature ?? 'exports', options)
  return r.isOpened
}

// ---------------------------------------------------------------------------------------------
// Print: a self-contained page that opens the browser's print dialog
// ---------------------------------------------------------------------------------------------

/** The print page: the picture inline and centred (the text in a <pre> when there is none), the share text under it, a print sheet that shows nothing else, and a script that opens the print dialog. No network. */
export function printHtml(kind: string, svg: string, text: string): string {
  const picture = svg.replace(/^\s*<\?xml[^>]*\?>\s*/, '').trim()
  const body =
    picture === ''
      ? `<pre class="text">${escapeXml(text)}</pre>`
      : `<div class="picture">${picture}</div>\n<div class="text">${escapeXml(text)}</div>`
  return [
    '<!doctype html>',
    `<html lang="${language()}" dir="${isRtl() ? 'rtl' : 'ltr'}">`,
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeXml(kind)}</title>`,
    '<style>',
    '@page { margin: 12mm }',
    'body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; text-align: center }',
    '.picture { display: flex; justify-content: center }',
    '.picture svg { max-width: 100%; height: auto }',
    '.text { margin-top: 12px; font-size: 11px; white-space: pre-wrap; text-align: center }',
    'pre.text { font-family: ui-monospace, Consolas, monospace; text-align: left; display: inline-block }',
    '.hint { color: #666; font-size: 12px }',
    '@media print { .hint { display: none } body { padding: 0 } }',
    '</style>',
    '</head>',
    '<body>',
    `<p class="hint">${escapeXml(t(U.printHint))}</p>`,
    body,
    "<script>window.addEventListener('load', () => setTimeout(() => window.print(), 300))</script>",
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

/** Print: writes `<kind>-<stamp>.print.html` in the export folder and opens it, so the default browser shows the print dialog. */
export async function printExport($: EngineInterface, opts: { kind: string; svg?: string; text: string; feature?: string }): Promise<boolean> {
  const feature = opts.feature ?? opts.kind
  const options = { immediate: true, toast: true }
  const saved = await writeExport($, opts.kind, 'print.html', printHtml(opts.kind, opts.svg ?? '', opts.text))
  if (!saved.isSaved) {
    await notice($, 'warn', t(U.saveFailed), feature, options)
    return false
  }
  const path = await shown($, saved.path)
  const r = await launchTarget($, path)
  if (r.isOpened) await notice($, 'info', t(U.printOpened, { path }), feature, options)
  else await notice($, 'warn', t(U.printFailed, { path, code: r.code }), feature, options)
  return r.isOpened
}

// ---------------------------------------------------------------------------------------------
// Open the folder, copy its path, change it
// ---------------------------------------------------------------------------------------------

type Launch = { isOpened: boolean; text: string; path: string }

/** Runs the platform's file manager on the export folder; `text` says what happened (the path included). */
async function launchFolder($: EngineInterface): Promise<Launch> {
  const dir = await exportDir($)
  const platform = platformOf(await $.session.cwd())
  const path = nativePath(dir, platform)
  let exists = false
  try {
    exists = await $.fs.exists(dir)
  } catch {
    exists = false
  }
  if (!exists) return { isOpened: false, text: t(U.noFolder, { path }), path }
  // Windows: `start` through cmd detaches the window from the engine's process, which a bare
  // explorer.exe launch does not always do from a host without a console. The exit code and
  // stderr are reported in the notice so a silent failure can be diagnosed from the app.
  const argv =
    platform === 'windows' ? ['cmd.exe', '/c', 'start', '', path] : platform === 'mac' ? ['open', path] : ['xdg-open', path]
  let isOpened = false
  let detail = ''
  try {
    const r = await $.process.run(argv, { timeoutMs: 10_000 })
    isOpened = r.exitCode === 0
    detail = `${argv[0]} → ${r.exitCode}${r.stderr.trim() === '' ? '' : ` · ${r.stderr.trim().slice(0, 100)}`}`
  } catch (err) {
    isOpened = false
    detail = String(err instanceof Error ? err.message : err).slice(0, 120)
  }
  return isOpened
    ? { isOpened, text: `${t(U.openingFolder, { path })} (${detail})`, path }
    : { isOpened, text: `${t(U.openFailed, { path })} (${detail})`, path }
}

/** The Open folder button: opens the export folder in the file manager, or warns with the path to copy. */
export async function openExportFolder($: EngineInterface, feature?: string): Promise<boolean> {
  const r = await launchFolder($)
  await notice($, r.isOpened ? 'info' : 'warn', r.text, feature ?? 'exports', { immediate: true, toast: true })
  return r.isOpened
}

/** The Copy path button: puts the export folder's path on the clipboard. */
export async function copyExportPath($: EngineInterface, surface: RenderSurface, feature?: string): Promise<boolean> {
  const path = await shown($, await exportDir($))
  let isCopied = false
  try {
    isCopied = (await $.ui.copy({ text: path, surface })).isCopied
  } catch {
    isCopied = false
  }
  if (isCopied) await notice($, 'info', t(U.pathCopied, { path }), feature ?? 'exports', { immediate: true, toast: true })
  else await notice($, 'warn', t(U.copyFailed), feature ?? 'exports', { immediate: true, toast: true })
  return isCopied
}

/** Sets the export folder (`default` clears it); the folder must be absolute and exist. `text` is the answer to show. */
export async function setExportDir($: EngineInterface, raw: string): Promise<{ isDone: boolean; text: string }> {
  const input = raw.trim().replace(/^["']|["']$/g, '').trim()
  if (input === '') {
    const path = await shown($, await exportDir($))
    return { isDone: false, text: `${t(U.dirCurrent, { path })}\n${t(U.dirUsage)}` }
  }
  if (/^(default|reset)$/i.test(input)) {
    await storeSet($, 'exports:dir', '')
    $.ui.invalidate('ui.render')
    return { isDone: true, text: t(U.dirReset, { path: await shown($, await exportDir($)) }) }
  }
  const dir = trimEnd(toSlash(input))
  let isFolder = false
  if (/^([A-Za-z]:\/|\/\/|\/)/.test(dir)) {
    try {
      isFolder = (await $.fs.stat(dir)).kind === 'dir'
    } catch {
      isFolder = false
    }
  }
  if (!isFolder) return { isDone: false, text: t(U.dirInvalid, { path: input }) }
  await storeSet($, 'exports:dir', dir)
  $.ui.invalidate('ui.render')
  return { isDone: true, text: t(U.dirSet, { path: await shown($, dir) }) }
}

/** The Change folder button: asks for a path, then sets it. */
export async function changeExportDir($: EngineInterface, feature?: string): Promise<void> {
  const keep = t(U.optKeep)
  const useDefault = t(U.optDefault)
  let answer = ''
  try {
    answer = await $.ui.ask(t(U.askPath), { header: t(U.askHeader), options: [keep, useDefault] })
  } catch {
    return
  }
  if (answer === '' || answer === keep) return
  const r = await setExportDir($, answer === useDefault ? 'default' : answer)
  await notice($, r.isDone ? 'info' : 'warn', r.text, feature ?? 'exports', { immediate: true, toast: true })
}

/** `/exports`: no argument opens the pane; `open` opens the folder; `dir [path|default]` shows or sets it. */
export async function exportsCommand($: EngineInterface, args: string): Promise<string> {
  const a = args.trim()
  if (/^open$/i.test(a)) return (await launchFolder($)).text
  const dir = /^dir(?:\s+([\s\S]*))?$/i.exec(a)
  if (dir !== null) return (await setExportDir($, dir[1] ?? '')).text
  try {
    await $.ui.open({ id: EXPORTS_PANE_ID, title: t(U.paneTitle), focus: true })
  } catch {
    return t(U.dirCurrent, { path: await shown($, await exportDir($)) })
  }
  return t(U.paneOpened)
}

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function dateText(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`
}

/** The `/exports` pane: the folder's files (name, size, date; newest first, up to 30) under Open folder / Copy path / Change folder. */
export async function exportsPane($: EngineInterface, e: RenderInput<'Pane'>): Promise<RenderElement> {
  const { Box, Text } = $.ui.resolve(e)
  const dir = await exportDir($)
  const path = nativePath(dir, platformOf(await $.session.cwd()))
  let files: FsEntry[] = []
  try {
    files = (await $.fs.list(dir)).filter(x => x.kind === 'file')
  } catch {
    files = []
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs)
  const rows = files.slice(0, LIST_LIMIT)
  const surface = e.surface
  return (
    <Box flexDirection="column">
      {paneHeader($, e, {
        title: t(U.paneTitle),
        status: t(U.paneStatus, { n: files.length }),
        actions: [
          { key: 'exports-open', label: t(U.openFolder), onPress: () => void openExportFolder($) },
          { key: 'exports-path', label: t(U.copyPath), onPress: () => void copyExportPath($, surface) },
          { key: 'exports-change', label: t(U.changeFolder), onPress: () => void changeExportDir($) },
        ],
      })}
      <Text dimColor>{path}</Text>
      {rows.length === 0
        ? emptyState($, e, t(U.emptyMain, { path }), t(U.emptyHint))
        : rows.map(f => listRow($, e, { key: `exports-file-${f.name}`, left: dateText(f.mtimeMs), text: f.name, right: sizeText(f.size) }))}
      {files.length > LIST_LIMIT ? (
        <Text dimColor size="footnote">
          {t(U.moreRows, { n: files.length })}
        </Text>
      ) : null}
    </Box>
  )
}

type BarInput = RenderInput<'Pane'> | RenderInput<'Placed'>

/**
 * The row of actions under a visual. `svg` is the picture (the Save button saves it on the desktop;
 * without a picture, or on the terminal, Save writes `text` as .txt); `text` is what Copy puts on the
 * clipboard; `share`, when given, adds Share (copies it and saves the picture when there is one).
 * Open folder and Copy path always follow, so the person can find what Save wrote.
 * `skip` leaves out an action the pane already has elsewhere.
 */
export function exportBar(
  $: EngineInterface,
  e: BarInput,
  opts: { kind: string; svg?: string; text: string; share?: string; skip?: readonly ExportAction[]; feature?: string },
): RenderElement {
  const { Box, Button } = $.ui.resolve(e)
  const surface = e.surface
  const kind = opts.kind
  const skip = opts.skip ?? []
  const svg = opts.svg
  const isPicture = svg !== undefined && surface === 'desktop'
  const share = opts.share
  return (
    <Box gap={2} flexWrap="wrap">
      {skip.includes('save') ? null : (
        <Button
          key={`exp-save-${kind}`}
          plain
          label={t(isPicture ? U.saveSvg : U.saveText)}
          onPress={() => {
            if (svg !== undefined && isPicture) void saveSvg($, kind, svg, opts.feature)
            else void saveText($, kind, opts.text, true, opts.feature)
          }}
        />
      )}
      {skip.includes('copy') ? null : (
        <Button key={`exp-copy-${kind}`} plain label={t(U.copyText)} onPress={() => void copyText($, opts.text, surface, opts.feature)} />
      )}
      {share === undefined || skip.includes('share') ? null : (
        <Button
          key={`exp-share-${kind}`}
          plain
          label={t(U.share)}
          onPress={() => void shareExport($, { kind, svg, share, surface, feature: opts.feature })}
        />
      )}
      {skip.includes('print') ? null : (
        <Button
          key={`exp-print-${kind}`}
          plain
          label={t(U.print)}
          onPress={() => void printExport($, { kind, svg, text: share ?? opts.text, feature: opts.feature })}
        />
      )}
      {skip.includes('open') ? null : (
        <Button key={`exp-open-${kind}`} plain label={t(U.openFolder)} onPress={() => void openExportFolder($, opts.feature ?? kind)} />
      )}
      {skip.includes('path') ? null : (
        <Button key={`exp-path-${kind}`} plain label={t(U.copyPath)} onPress={() => void copyExportPath($, surface, opts.feature ?? kind)} />
      )}
    </Box>
  )
}

/** How many lines of the share text the sheet draws. */
const SHEET_LINES = 8

/** The sheet's Copy path button: the picture's full path (the export folder's when no picture was saved). */
async function copySheetPath($: EngineInterface, path: string, surface: RenderSurface, feature: string): Promise<void> {
  if (path === '') {
    await copyExportPath($, surface, feature)
    return
  }
  let isCopied = false
  try {
    isCopied = (await $.ui.copy({ text: path, surface })).isCopied
  } catch {
    isCopied = false
  }
  if (isCopied) await notice($, 'info', t(U.pathCopied, { path }), feature, { immediate: true, toast: true })
  else await notice($, 'warn', t(U.copyFailed), feature, { immediate: true, toast: true })
}

/** The share sheet (pane `toolkitty-share`): the share text, where the picture is, and a button per target. */
export async function sharePane($: EngineInterface, e: RenderInput<'Pane'>): Promise<RenderElement> {
  const { Box, Text, Button } = $.ui.resolve(e)
  const sheet = await read($, shareSheet)
  const surface = e.surface
  if (sheet.text === '') {
    return (
      <Box flexDirection="column">
        {paneHeader($, e, { title: t(U.sheetTitle) })}
        {emptyState($, e, t(U.sheetEmpty), t(U.sheetEmptyHint))}
      </Box>
    )
  }
  const lines = sheet.text.split('\n')
  const shownLines = lines.slice(0, SHEET_LINES)
  const isTrimmed = SHARE_TARGETS.some(x => shareLink(x, sheet.text).isTrimmed)
  const kind = sheet.kind
  return (
    <Box flexDirection="column" gap={1}>
      {paneHeader($, e, { title: t(U.sheetTitle), status: kind })}
      <Box flexDirection="column">
        {shownLines.map((line, i) => (
          <Text key={`share-line-${i}`}>{line === '' ? ' ' : line}</Text>
        ))}
        {lines.length > SHEET_LINES ? <Text dimColor>{t(U.moreLines, { n: lines.length - SHEET_LINES })}</Text> : null}
      </Box>
      <Box flexDirection="column">
        <Text dimColor>{sheet.path === '' ? t(U.pictureNone) : t(U.pictureSaved, { path: sheet.path })}</Text>
        <Box gap={2} flexWrap="wrap">
          <Button key="share-open" plain label={t(U.openFolder)} onPress={() => void openExportFolder($, kind)} />
          <Button key="share-path" plain label={t(U.copyPath)} onPress={() => void copySheetPath($, sheet.path, surface, kind)} />
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text bold>{t(U.targetsTitle)}</Text>
        <Box gap={2} flexWrap="wrap">
          {SHARE_TARGETS.map(x => (
            <Button key={`share-${x}`} plain label={x === 'email' ? t(U.email) : TARGET_NAMES[x]} onPress={() => void shareTo($, x, sheet.text, surface, kind)} />
          ))}
          <Button key="share-copy" plain label={t(U.copyText)} onPress={() => void copyText($, sheet.text, surface, kind)} />
          <Button
            key={`exp-print-${kind}`}
            plain
            label={t(U.print)}
            onPress={() => void printExport($, { kind, svg: sheet.svg === '' ? undefined : sheet.svg, text: sheet.text, feature: kind })}
          />
        </Box>
        {isTrimmed ? <Text dimColor>{t(U.trimmedNote)}</Text> : null}
      </Box>
      <Text dimColor size="footnote">
        {t(U.sheetFootnote)}
      </Text>
    </Box>
  )
}
