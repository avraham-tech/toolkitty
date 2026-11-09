import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, language, notice, storeGet, storeSet, t } from '../core'
import type { BandInput, Feature, Input } from '../core'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { Chip, Level } from '../ui'

// The catalogue is injected by register.tsx (an import of './index' would be circular).
let features: Feature[] = []

/** Called once by register.tsx before any hook runs. */
export function setCatalog(list: Feature[]): void {
  features = list
}

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Toolkitty Doctor', he: 'רופא ה-Toolkitty', es: 'Doctor del Toolkitty', fr: 'Docteur du Toolkitty', ru: 'Доктор Toolkitty', zh: 'Toolkitty 医生', ja: 'Toolkitty ドクター', pt: 'Toolkitty Doctor', de: 'Toolkitty Doctor', ko: 'Toolkitty 닥터' },
  description: {
    en: '/envcheck checks git, CLAUDE.md, tools, tests, Toolkitty setup and secrets, scores the environment, and offers reversible fixes on a button press',
    he: '/envcheck בודק git, CLAUDE.md, כלים, בדיקות, הגדרות ה-Toolkitty וסודות, נותן ציון לסביבה ומציע תיקונים הפיכים בלחיצת כפתור',
    es: '/envcheck revisa git, CLAUDE.md, herramientas, pruebas, la configuración del Toolkitty y los secretos, puntúa el entorno y ofrece arreglos reversibles al pulsar un botón',
    fr: '/envcheck vérifie git, CLAUDE.md, les outils, les tests, la configuration du Toolkitty et les secrets, note l’environnement et propose des correctifs réversibles sur un clic',
    ru: '/envcheck проверяет git, CLAUDE.md, инструменты, тесты, настройку Toolkitty и секреты, оценивает окружение и предлагает обратимые исправления по нажатию кнопки',
    zh: '/envcheck 会检查 git、CLAUDE.md、工具、测试、Toolkitty 设置和密钥，给环境打分，并提供可撤销的修复，点按钮即可应用',
    ja: '/envcheck は git、CLAUDE.md、ツール、テスト、Toolkitty の設定、シークレットをチェックして環境をスコア化し、ボタン1つで適用できる元に戻せる修正を提案します',
    pt: '/envcheck verifica git, CLAUDE.md, ferramentas, testes, a configuração do Toolkitty e segredos, pontua o ambiente e oferece correções reversíveis com o clique de um botão',
    de: '/envcheck prüft git, CLAUDE.md, Tools, Tests, das Toolkitty-Setup und Geheimnisse, bewertet die Umgebung und bietet per Knopfdruck umkehrbare Korrekturen an',
    ko: '/envcheck는 git, CLAUDE.md, 도구, 테스트, Toolkitty 설정, 비밀 값을 점검해 환경 점수를 매기고, 버튼 한 번으로 적용할 수 있는 되돌릴 수 있는 수정을 제안합니다',
  },
  cmdDesc: { en: 'Checks the environment and shows a health score (/envcheck copy copies the report)', he: 'בודק את הסביבה ומציג ציון בריאות (/envcheck copy מעתיק את הדוח)', es: 'Revisa el entorno y muestra una puntuación de salud (/envcheck copy copia el informe)', fr: 'Vérifie l’environnement et affiche un score de santé (/envcheck copy copie le rapport)', ru: 'Проверяет окружение и показывает оценку состояния (/envcheck copy копирует отчёт)', zh: '检查环境并显示健康分（/envcheck copy 复制报告）', ja: '環境をチェックして健全性スコアを表示します（/envcheck copy でレポートをコピー）', pt: 'Verifica o ambiente e mostra uma pontuação de saúde (/envcheck copy copia o relatório)', de: 'Prüft die Umgebung und zeigt einen Gesundheitswert (/envcheck copy kopiert den Bericht)', ko: '환경을 점검하고 건강 점수를 보여 줍니다(/envcheck copy로 리포트 복사)' },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  paneOff: { en: 'Toolkitty Doctor is off in the switchboard.', he: 'רופא ה-Toolkitty כבוי בלוח המתגים.', es: 'El Doctor del Toolkitty está desactivado en el panel.', fr: 'Le Docteur du Toolkitty est désactivé dans le tableau.', ru: 'Доктор Toolkitty выключен в панели.', zh: 'Toolkitty 医生在开关面板中已关闭。', ja: 'Toolkitty ドクターはスイッチパネルでオフになっています。', pt: 'O Toolkitty Doctor está desativado no painel de opções.', de: 'Toolkitty Doctor ist im Schalter-Panel aus.', ko: 'Toolkitty 닥터가 스위치 패널에서 꺼져 있습니다.' },
  paneTitle: { en: 'Environment health', he: 'בריאות הסביבה', es: 'Salud del entorno', fr: 'Santé de l’environnement', ru: 'Состояние окружения', zh: '环境健康度', ja: '環境の健全性', pt: 'Saúde do ambiente', de: 'Umgebungsgesundheit', ko: '환경 건강도' },
  summary: { en: 'Toolkitty Doctor: {score}/100 ({failed} failed, {warned} warnings). Details are in the Environment health pane.', he: 'רופא ה-Toolkitty: {score}/100 ({failed} נכשלו, {warned} אזהרות). הפרטים בלוח בריאות הסביבה.', es: 'Doctor del Toolkitty: {score}/100 ({failed} fallidas, {warned} avisos). Los detalles están en el panel Salud del entorno.', fr: 'Docteur du Toolkitty : {score}/100 ({failed} échecs, {warned} avertissements). Les détails sont dans le panneau Santé de l’environnement.', ru: 'Доктор Toolkitty: {score}/100 ({failed} сбоев, {warned} предупреждений). Подробности в панели «Состояние окружения».', zh: 'Toolkitty 医生：{score}/100（{failed} 项失败，{warned} 项警告）。详情见“环境健康度”面板。', ja: 'Toolkitty ドクター: {score}/100（失敗 {failed} 件、警告 {warned} 件）。詳細は「環境の健全性」ペインにあります。', pt: 'Toolkitty Doctor: {score}/100 ({failed} falhas, {warned} avisos). Os detalhes estão no painel Saúde do ambiente.', de: 'Toolkitty Doctor: {score}/100 ({failed} fehlgeschlagen, {warned} Warnungen). Details stehen im Panel „Umgebungsgesundheit“.', ko: 'Toolkitty 닥터: {score}/100(실패 {failed}개, 경고 {warned}개). 자세한 내용은 환경 건강도 창에 있습니다.' },
  reportHead: { en: 'Toolkitty Doctor: environment health {score}/100', he: 'רופא ה-Toolkitty: בריאות הסביבה {score}/100', es: 'Doctor del Toolkitty: salud del entorno {score}/100', fr: 'Docteur du Toolkitty : santé de l’environnement {score}/100', ru: 'Доктор Toolkitty: состояние окружения {score}/100', zh: 'Toolkitty 医生：环境健康度 {score}/100', ja: 'Toolkitty ドクター: 環境の健全性 {score}/100', pt: 'Toolkitty Doctor: saúde do ambiente {score}/100', de: 'Toolkitty Doctor: Umgebungsgesundheit {score}/100', ko: 'Toolkitty 닥터: 환경 건강도 {score}/100' },
  formula: { en: 'Score: 100 − 15 × {failed} failed − 5 × {warned} warnings = {score}', he: 'ציון: 100 − 15 × {failed} נכשלו − 5 × {warned} אזהרות = {score}', es: 'Puntuación: 100 − 15 × {failed} fallidas − 5 × {warned} avisos = {score}', fr: 'Score : 100 − 15 × {failed} échecs − 5 × {warned} avertissements = {score}', ru: 'Оценка: 100 − 15 × {failed} сбоев − 5 × {warned} предупреждений = {score}', zh: '分数：100 − 15 × {failed} 项失败 − 5 × {warned} 项警告 = {score}', ja: 'スコア: 100 − 15 × 失敗 {failed} 件 − 5 × 警告 {warned} 件 = {score}', pt: 'Pontuação: 100 − 15 × {failed} falhas − 5 × {warned} avisos = {score}', de: 'Wert: 100 − 15 × {failed} fehlgeschlagen − 5 × {warned} Warnungen = {score}', ko: '점수: 100 − 15 × 실패 {failed}개 − 5 × 경고 {warned}개 = {score}' },
  copied: { en: 'Doctor report copied', he: 'דוח הרופא הועתק', es: 'Informe del doctor copiado', fr: 'Rapport du docteur copié', ru: 'Отчёт доктора скопирован', zh: '已复制检查报告', ja: 'ドクターのレポートをコピーしました', pt: 'Relatório do Doctor copiado', de: 'Doctor-Bericht kopiert', ko: '닥터 리포트를 복사했습니다' },
  copyFailed: { en: 'Could not copy the report', he: 'לא ניתן להעתיק את הדוח', es: 'No se pudo copiar el informe', fr: 'Impossible de copier le rapport', ru: 'Не удалось скопировать отчёт', zh: '无法复制报告', ja: 'レポートをコピーできませんでした', pt: 'Não foi possível copiar o relatório', de: 'Der Bericht konnte nicht kopiert werden', ko: '리포트를 복사할 수 없습니다' },
  runAgain: { en: 'Run again', he: 'הרץ שוב', es: 'Ejecutar de nuevo', fr: 'Relancer', ru: 'Запустить снова', zh: '重新运行', ja: '再実行', pt: 'Executar de novo', de: 'Erneut ausführen', ko: '다시 실행' },
  copyReport: { en: 'Copy report', he: 'העתק דוח', es: 'Copiar informe', fr: 'Copier le rapport', ru: 'Копировать отчёт', zh: '复制报告', ja: 'レポートをコピー', pt: 'Copiar relatório', de: 'Bericht kopieren', ko: '리포트 복사' },
  fixAll: { en: 'Fix recommended', he: 'תקן את המומלצים', es: 'Arreglar lo recomendado', fr: 'Corriger le recommandé', ru: 'Исправить рекомендованное', zh: '应用推荐修复', ja: '推奨の修正を適用', pt: 'Aplicar correção recomendada', de: 'Empfohlene Korrektur anwenden', ko: '권장 수정 적용' },
  fixButton: { en: 'Fix', he: 'תקן', es: 'Arreglar', fr: 'Corriger', ru: 'Исправить', zh: '修复', ja: '修正', pt: 'Corrigir', de: 'Beheben', ko: '수정' },
  notRun: { en: 'No check has run yet.', he: 'עדיין לא הורצה אף בדיקה.', es: 'Aún no se ha ejecutado ninguna comprobación.', fr: 'Aucune vérification n’a encore été lancée.', ru: 'Проверки ещё не запускались.', zh: '还没有运行过检查。', ja: 'まだチェックは実行されていません。', pt: 'Nenhuma verificação rodou ainda.', de: 'Es wurde noch keine Prüfung ausgeführt.', ko: '아직 실행된 점검이 없습니다.' },
  notRunHint: { en: 'Run /envcheck, or press Run again, to check this project.', he: 'הרץ /envcheck, או לחץ על הרץ שוב, כדי לבדוק את הפרויקט.', es: 'Ejecuta /envcheck, o pulsa Ejecutar de nuevo, para revisar este proyecto.', fr: 'Lancez /envcheck, ou appuyez sur Relancer, pour vérifier ce projet.', ru: 'Запустите /envcheck или нажмите «Запустить снова», чтобы проверить проект.', zh: '运行 /envcheck，或点击“重新运行”，来检查此项目。', ja: '/envcheck を実行するか「再実行」を押して、このプロジェクトをチェックします。', pt: 'Execute /envcheck, ou pressione Executar de novo, para verificar este projeto.', de: 'Führe /envcheck aus oder drücke „Erneut ausführen“, um dieses Projekt zu prüfen.', ko: '/envcheck를 실행하거나 "다시 실행"을 눌러 이 프로젝트를 점검하세요.' },
  checksSection: { en: 'Checks', he: 'בדיקות', es: 'Comprobaciones', fr: 'Vérifications', ru: 'Проверки', zh: '检查项', ja: 'チェック項目', pt: 'Verificações', de: 'Prüfungen', ko: '점검 항목' },
  askHeader: { en: 'Doctor', he: 'רופא', es: 'Doctor', fr: 'Docteur', ru: 'Доктор', zh: '医生', ja: 'ドクター', pt: 'Doctor', de: 'Doctor', ko: '닥터' },
  askQuestion: { en: 'Apply {n} reversible fixes? {list}', he: 'להחיל {n} תיקונים הפיכים? {list}', es: '¿Aplicar {n} arreglos reversibles? {list}', fr: 'Appliquer {n} correctifs réversibles ? {list}', ru: 'Применить обратимые исправления ({n})? {list}', zh: '应用 {n} 项可撤销的修复？{list}', ja: '元に戻せる修正を {n} 件適用しますか？ {list}', pt: 'Aplicar {n} correções reversíveis? {list}', de: '{n} umkehrbare Korrekturen anwenden? {list}', ko: '되돌릴 수 있는 수정 {n}개를 적용할까요? {list}' },
  apply: { en: 'Apply', he: 'החל', es: 'Aplicar', fr: 'Appliquer', ru: 'Применить', zh: '应用', ja: '適用', pt: 'Aplicar', de: 'Anwenden', ko: '적용' },
  cancel: { en: 'Cancel', he: 'ביטול', es: 'Cancelar', fr: 'Annuler', ru: 'Отмена', zh: '取消', ja: 'キャンセル', pt: 'Cancelar', de: 'Abbrechen', ko: '취소' },
  cancelled: { en: 'Doctor: nothing was changed', he: 'הרופא: דבר לא שונה', es: 'Doctor: no se cambió nada', fr: 'Docteur : rien n’a été modifié', ru: 'Доктор: ничего не изменено', zh: '医生：未做任何更改', ja: 'ドクター: 何も変更されませんでした', pt: 'Doctor: nada foi alterado', de: 'Doctor: Es wurde nichts geändert', ko: '닥터: 변경된 것이 없습니다' },
  nothingToFix: { en: 'Doctor: there is nothing to fix', he: 'הרופא: אין מה לתקן', es: 'Doctor: no hay nada que arreglar', fr: 'Docteur : rien à corriger', ru: 'Доктор: исправлять нечего', zh: '医生：没有需要修复的内容', ja: 'ドクター: 修正するものはありません', pt: 'Doctor: não há nada para corrigir', de: 'Doctor: Es gibt nichts zu beheben', ko: '닥터: 수정할 것이 없습니다' },
  lblGitignore: { en: 'Create .gitignore with .env', he: 'צור .gitignore עם .env', es: 'Crear .gitignore con .env', fr: 'Créer .gitignore avec .env', ru: 'Создать .gitignore с .env', zh: '创建包含 .env 的 .gitignore', ja: '.env を含む .gitignore を作成', pt: 'Criar .gitignore com .env', de: '.gitignore mit .env anlegen', ko: '.env가 포함된 .gitignore 만들기' },
  lblToolkit: { en: 'Create .claude/toolkitty.json from current settings', he: 'צור .claude/toolkitty.json מההגדרות הנוכחיות', es: 'Crear .claude/toolkitty.json con la configuración actual', fr: 'Créer .claude/toolkitty.json à partir des réglages actuels', ru: 'Создать .claude/toolkitty.json из текущих настроек', zh: '根据当前设置创建 .claude/toolkitty.json', ja: '現在の設定から .claude/toolkitty.json を作成', pt: 'Criar .claude/toolkitty.json a partir das configurações atuais', de: '.claude/toolkitty.json aus den aktuellen Einstellungen anlegen', ko: '현재 설정으로 .claude/toolkitty.json 만들기' },
  lblBudget: { en: 'Turn budget guard on', he: 'הפעל את שומר התקציב', es: 'Activar el guardián de presupuesto', fr: 'Activer le garde-budget', ru: 'Включить защиту бюджета', zh: '开启预算守卫', ja: '予算ガードをオンにする', pt: 'Ativar a guarda de orçamento', de: 'Budget-Wächter einschalten', ko: '예산 가드 켜기' },
  fixGitignore: { en: 'Created {path} with .env', he: 'נוצר {path} עם .env', es: 'Se creó {path} con .env', fr: '{path} créé avec .env', ru: 'Создан {path} с .env', zh: '已创建 {path}，包含 .env', ja: '{path} を作成し、.env を追加しました', pt: '{path} criado com .env', de: '{path} mit .env angelegt', ko: '.env가 포함된 {path}을(를) 만들었습니다' },
  fixToolkit: { en: 'Wrote {path} from the current settings', he: 'נכתב {path} מההגדרות הנוכחיות', es: 'Se escribió {path} con la configuración actual', fr: '{path} écrit à partir des réglages actuels', ru: 'Записан {path} из текущих настроек', zh: '已根据当前设置写入 {path}', ja: '現在の設定から {path} を書き込みました', pt: '{path} gravado a partir das configurações atuais', de: '{path} aus den aktuellen Einstellungen geschrieben', ko: '현재 설정으로 {path}을(를) 작성했습니다' },
  fixBudget: { en: 'Budget guard is on', he: 'שומר התקציב פועל', es: 'El guardián de presupuesto está activado', fr: 'Le garde-budget est activé', ru: 'Защита бюджета включена', zh: '预算守卫已开启', ja: '予算ガードをオンにしました', pt: 'A guarda de orçamento está ativada', de: 'Budget-Wächter ist an', ko: '예산 가드가 켜졌습니다' },
  fixExists: { en: '{path} already exists; left unchanged', he: '{path} כבר קיים; לא שונה', es: '{path} ya existe; no se cambió', fr: '{path} existe déjà ; inchangé', ru: '{path} уже существует; не изменён', zh: '{path} 已存在；保持不变', ja: '{path} はすでに存在します。変更しませんでした', pt: '{path} já existe; mantido sem alterações', de: '{path} existiert bereits; unverändert gelassen', ko: '{path}이(가) 이미 있어 그대로 두었습니다' },
  fixFailed: { en: 'Fix failed: {message}', he: 'התיקון נכשל: {message}', es: 'El arreglo falló: {message}', fr: 'Le correctif a échoué : {message}', ru: 'Исправление не удалось: {message}', zh: '修复失败：{message}', ja: '修正に失敗しました: {message}', pt: 'Falha na correção: {message}', de: 'Korrektur fehlgeschlagen: {message}', ko: '수정 실패: {message}' },
  chip: { en: 'doctor {score}', he: 'רופא {score}', es: 'doctor {score}', fr: 'docteur {score}', ru: 'доктор {score}', zh: '医生 {score}', ja: 'ドクター {score}', pt: 'doctor {score}', de: 'Doctor {score}', ko: '닥터 {score}' },

  // check titles
  tGit: { en: 'Git', he: 'Git', es: 'Git', fr: 'Git', ru: 'Git', zh: 'Git', ja: 'Git', pt: 'Git', de: 'Git', ko: 'Git' },
  tClaudeMd: { en: 'CLAUDE.md', he: 'CLAUDE.md', es: 'CLAUDE.md', fr: 'CLAUDE.md', ru: 'CLAUDE.md', zh: 'CLAUDE.md', ja: 'CLAUDE.md', pt: 'CLAUDE.md', de: 'CLAUDE.md', ko: 'CLAUDE.md' },
  tTools: { en: 'Tools on PATH', he: 'כלים ב-PATH', es: 'Herramientas en el PATH', fr: 'Outils dans le PATH', ru: 'Инструменты в PATH', zh: 'PATH 中的工具', ja: 'PATH 上のツール', pt: 'Ferramentas no PATH', de: 'Tools im PATH', ko: 'PATH의 도구' },
  tTests: { en: 'Tests', he: 'בדיקות', es: 'Pruebas', fr: 'Tests', ru: 'Тесты', zh: '测试', ja: 'テスト', pt: 'Testes', de: 'Tests', ko: '테스트' },
  tConfig: { en: 'Toolkitty config', he: 'הגדרות Toolkitty', es: 'Configuración del Toolkitty', fr: 'Configuration du Toolkitty', ru: 'Настройка Toolkitty', zh: 'Toolkitty 配置', ja: 'Toolkitty の設定', pt: 'Configuração do Toolkitty', de: 'Toolkitty-Konfiguration', ko: 'Toolkitty 설정' },
  tFeatures: { en: 'Features', he: 'שכלולים', es: 'Funciones', fr: 'Fonctions', ru: 'Функции', zh: '功能', ja: '機能', pt: 'Recursos', de: 'Funktionen', ko: '기능' },
  tHooks: { en: 'Hooks and plugins', he: 'הוקים ותוספים', es: 'Hooks y plugins', fr: 'Hooks et plugins', ru: 'Хуки и плагины', zh: '钩子和插件', ja: 'フックとプラグイン', pt: 'Hooks e plugins', de: 'Hooks und Plugins', ko: '훅과 플러그인' },
  tVersion: { en: 'Version', he: 'גרסה', es: 'Versión', fr: 'Version', ru: 'Версия', zh: '版本', ja: 'バージョン', pt: 'Versão', de: 'Version', ko: '버전' },
  tEnv: { en: 'Secrets in git', he: 'סודות ב-git', es: 'Secretos en git', fr: 'Secrets dans git', ru: 'Секреты в git', zh: 'git 中的密钥', ja: 'git 内のシークレット', pt: 'Segredos no git', de: 'Geheimnisse in git', ko: 'git 안의 비밀 값' },
  tIgnore: { en: '.gitignore', he: '.gitignore', es: '.gitignore', fr: '.gitignore', ru: '.gitignore', zh: '.gitignore', ja: '.gitignore', pt: '.gitignore', de: '.gitignore', ko: '.gitignore' },

  // check details
  gitMissing: { en: 'git did not run', he: 'git לא רץ', es: 'git no se ejecutó', fr: 'git ne s’est pas lancé', ru: 'git не запустился', zh: 'git 未能运行', ja: 'git が実行されませんでした', pt: 'o git não rodou', de: 'git wurde nicht ausgeführt', ko: 'git이 실행되지 않았습니다' },
  gitNo: { en: 'not inside a git repository', he: 'לא בתוך מאגר git', es: 'no está dentro de un repositorio git', fr: 'pas dans un dépôt git', ru: 'не внутри репозитория git', zh: '不在 git 仓库内', ja: 'git リポジトリ内ではありません', pt: 'não está dentro de um repositório git', de: 'nicht in einem git-Repository', ko: 'git 저장소 안이 아닙니다' },
  gitDetail: { en: 'branch {branch} · {n} uncommitted · {remote}', he: 'ענף {branch} · {n} לא נשמרו · {remote}', es: 'rama {branch} · {n} sin confirmar · {remote}', fr: 'branche {branch} · {n} non validés · {remote}', ru: 'ветка {branch} · {n} незафиксировано · {remote}', zh: '分支 {branch} · {n} 项未提交 · {remote}', ja: 'ブランチ {branch} · 未コミット {n} 件 · {remote}', pt: 'branch {branch} · {n} não commitados · {remote}', de: 'Branch {branch} · {n} nicht committet · {remote}', ko: '브랜치 {branch} · 미커밋 {n}개 · {remote}' },
  gitRemote: { en: 'remote {name}', he: 'מאגר מרוחק {name}', es: 'remoto {name}', fr: 'distant {name}', ru: 'удалённый {name}', zh: '远程 {name}', ja: 'リモート {name}', pt: 'remoto {name}', de: 'Remote {name}', ko: '리모트 {name}' },
  gitNoRemote: { en: 'no remote', he: 'אין מאגר מרוחק', es: 'sin remoto', fr: 'pas de distant', ru: 'нет удалённого', zh: '无远程', ja: 'リモートなし', pt: 'sem remoto', de: 'kein Remote', ko: '리모트 없음' },
  gitNoBranch: { en: '(none)', he: '(אין)', es: '(ninguna)', fr: '(aucune)', ru: '(нет)', zh: '（无）', ja: '（なし）', pt: '(nenhum)', de: '(keins)', ko: '(없음)' },
  mdNone: { en: 'no CLAUDE.md in the folder, 3 parents or ~/.claude', he: 'אין CLAUDE.md בתיקייה, ב-3 הורים או ב-~/.claude', es: 'no hay CLAUDE.md en la carpeta, 3 superiores ni ~/.claude', fr: 'pas de CLAUDE.md dans le dossier, 3 parents ou ~/.claude', ru: 'нет CLAUDE.md в папке, 3 родительских или ~/.claude', zh: '当前文件夹、上 3 级父目录或 ~/.claude 中没有 CLAUDE.md', ja: 'フォルダー、3階層上までの親、または ~/.claude に CLAUDE.md がありません', pt: 'nenhum CLAUDE.md na pasta, nos 3 pais acima ou em ~/.claude', de: 'keine CLAUDE.md im Ordner, in 3 übergeordneten Ordnern oder in ~/.claude', ko: '폴더, 상위 3단계 또는 ~/.claude에 CLAUDE.md가 없습니다' },
  mdFound: { en: '{path} · {size}', he: '{path} · {size}', es: '{path} · {size}', fr: '{path} · {size}', ru: '{path} · {size}', zh: '{path} · {size}', ja: '{path} · {size}', pt: '{path} · {size}', de: '{path} · {size}', ko: '{path} · {size}' },
  mdLarge: { en: 'large: costs tokens every turn', he: 'גדול: עולה טוקנים בכל תור', es: 'grande: cuesta tokens en cada turno', fr: 'volumineux : coûte des tokens à chaque tour', ru: 'большой: тратит токены каждый ход', zh: '过大：每一轮都会消耗 token', ja: '大きすぎます: 毎ターントークンを消費します', pt: 'grande: custa tokens a cada turno', de: 'groß: kostet in jedem Durchgang Tokens', ko: '큼: 매 턴 토큰을 소모합니다' },
  mdThin: { en: 'thin: little guidance for Claude', he: 'דל: מעט הנחיות ל-Claude', es: 'escaso: poca guía para Claude', fr: 'mince : peu de consignes pour Claude', ru: 'скудный: мало указаний для Claude', zh: '过简：给 Claude 的指引太少', ja: '薄すぎます: Claude への指針がほとんどありません', pt: 'curto: pouca orientação para o Claude', de: 'dünn: wenig Anleitung für Claude', ko: '빈약함: Claude에 대한 안내가 거의 없습니다' },
  mdTests: { en: 'mentions test commands', he: 'מזכיר פקודות בדיקה', es: 'menciona comandos de prueba', fr: 'mentionne des commandes de test', ru: 'упоминает команды тестов', zh: '提到了测试命令', ja: 'テストコマンドに言及しています', pt: 'menciona comandos de teste', de: 'erwähnt Testbefehle', ko: '테스트 명령이 언급되어 있습니다' },
  mdLint: { en: 'mentions lint commands', he: 'מזכיר פקודות lint', es: 'menciona comandos de lint', fr: 'mentionne des commandes de lint', ru: 'упоминает команды линтера', zh: '提到了 lint 命令', ja: 'lint コマンドに言及しています', pt: 'menciona comandos de lint', de: 'erwähnt Lint-Befehle', ko: '린트 명령이 언급되어 있습니다' },
  mdNeither: { en: 'no test or lint commands mentioned', he: 'לא מוזכרות פקודות בדיקה או lint', es: 'no menciona comandos de prueba ni lint', fr: 'aucune commande de test ni de lint', ru: 'команды тестов и линтера не упомянуты', zh: '没有提到测试或 lint 命令', ja: 'テストや lint のコマンドへの言及がありません', pt: 'nenhum comando de teste ou lint mencionado', de: 'keine Test- oder Lint-Befehle erwähnt', ko: '테스트나 린트 명령이 언급되어 있지 않습니다' },
  toolsFound: { en: 'found: {list}', he: 'נמצאו: {list}', es: 'encontradas: {list}', fr: 'trouvés : {list}', ru: 'найдено: {list}', zh: '已找到：{list}', ja: '見つかりました: {list}', pt: 'encontrado: {list}', de: 'gefunden: {list}', ko: '발견됨: {list}' },
  toolsMissing: { en: 'not found: {list}', he: 'לא נמצאו: {list}', es: 'no encontradas: {list}', fr: 'introuvables : {list}', ru: 'не найдено: {list}', zh: '未找到：{list}', ja: '見つかりません: {list}', pt: 'não encontrado: {list}', de: 'nicht gefunden: {list}', ko: '찾지 못함: {list}' },
  toolsNeeded: { en: 'missing but this project needs: {list}', he: 'חסרים אך הפרויקט צריך: {list}', es: 'faltan y este proyecto necesita: {list}', fr: 'manquants mais nécessaires ici : {list}', ru: 'отсутствуют, но нужны проекту: {list}', zh: '缺失，但此项目需要：{list}', ja: '不足していますが、このプロジェクトには必要です: {list}', pt: 'ausente, mas este projeto precisa: {list}', de: 'fehlt, wird aber von diesem Projekt benötigt: {list}', ko: '없지만 이 프로젝트에 필요함: {list}' },
  toolsNone: { en: 'none of the usual tools were found', he: 'אף אחד מהכלים הרגילים לא נמצא', es: 'no se encontró ninguna de las herramientas habituales', fr: 'aucun des outils habituels trouvé', ru: 'ни одного из обычных инструментов не найдено', zh: '没有找到任何常用工具', ja: 'よく使うツールが1つも見つかりませんでした', pt: 'nenhuma das ferramentas usuais foi encontrada', de: 'keines der üblichen Tools gefunden', ko: '일반적인 도구를 하나도 찾지 못했습니다' },
  testsFound: { en: 'found: {list}', he: 'נמצאו: {list}', es: 'encontrado: {list}', fr: 'trouvé : {list}', ru: 'найдено: {list}', zh: '已找到：{list}', ja: '見つかりました: {list}', pt: 'encontrado: {list}', de: 'gefunden: {list}', ko: '발견됨: {list}' },
  testsNone: { en: 'no test command found', he: 'לא נמצאה פקודת בדיקה', es: 'no se encontró ningún comando de prueba', fr: 'aucune commande de test trouvée', ru: 'команда тестов не найдена', zh: '没有找到测试命令', ja: 'テストコマンドが見つかりません', pt: 'nenhum comando de teste encontrado', de: 'kein Testbefehl gefunden', ko: '테스트 명령을 찾지 못했습니다' },
  cfgMissing: { en: 'no .claude/toolkitty.json (optional: it shares the setup with a team)', he: 'אין .claude/toolkitty.json (לא חובה: משתף את ההגדרה עם צוות)', es: 'no hay .claude/toolkitty.json (opcional: comparte la configuración con un equipo)', fr: 'pas de .claude/toolkitty.json (facultatif : partage la configuration avec une équipe)', ru: 'нет .claude/toolkitty.json (необязательно: делится настройкой с командой)', zh: '没有 .claude/toolkitty.json（可选：用于与团队共享设置）', ja: '.claude/toolkitty.json がありません（任意: チームと設定を共有できます）', pt: 'sem .claude/toolkitty.json (opcional: compartilha a configuração com uma equipe)', de: 'keine .claude/toolkitty.json (optional: teilt das Setup mit einem Team)', ko: '.claude/toolkitty.json 없음(선택 사항: 팀과 설정을 공유합니다)' },
  cfgOk: { en: '.claude/toolkitty.json is valid', he: '.claude/toolkitty.json תקין', es: '.claude/toolkitty.json es válido', fr: '.claude/toolkitty.json est valide', ru: '.claude/toolkitty.json корректен', zh: '.claude/toolkitty.json 有效', ja: '.claude/toolkitty.json は有効です', pt: '.claude/toolkitty.json é válido', de: '.claude/toolkitty.json ist gültig', ko: '.claude/toolkitty.json이 유효합니다' },
  cfgProfile: { en: '.claude/toolkitty.json is valid, profile {profile}', he: '.claude/toolkitty.json תקין, פרופיל {profile}', es: '.claude/toolkitty.json es válido, perfil {profile}', fr: '.claude/toolkitty.json est valide, profil {profile}', ru: '.claude/toolkitty.json корректен, профиль {profile}', zh: '.claude/toolkitty.json 有效，配置 {profile}', ja: '.claude/toolkitty.json は有効です。プロファイル {profile}', pt: '.claude/toolkitty.json é válido, perfil {profile}', de: '.claude/toolkitty.json ist gültig, Profil {profile}', ko: '.claude/toolkitty.json이 유효합니다. 프로필 {profile}' },
  cfgInvalid: { en: '.claude/toolkitty.json is not valid JSON', he: '.claude/toolkitty.json אינו JSON תקין', es: '.claude/toolkitty.json no es JSON válido', fr: '.claude/toolkitty.json n’est pas du JSON valide', ru: '.claude/toolkitty.json не является корректным JSON', zh: '.claude/toolkitty.json 不是有效的 JSON', ja: '.claude/toolkitty.json は有効な JSON ではありません', pt: '.claude/toolkitty.json não é um JSON válido', de: '.claude/toolkitty.json ist kein gültiges JSON', ko: '.claude/toolkitty.json이 올바른 JSON이 아닙니다' },
  cfgNotObject: { en: '.claude/toolkitty.json must hold a JSON object', he: '.claude/toolkitty.json חייב להכיל אובייקט JSON', es: '.claude/toolkitty.json debe contener un objeto JSON', fr: '.claude/toolkitty.json doit contenir un objet JSON', ru: '.claude/toolkitty.json должен содержать объект JSON', zh: '.claude/toolkitty.json 必须是 JSON 对象', ja: '.claude/toolkitty.json は JSON オブジェクトである必要があります', pt: '.claude/toolkitty.json deve conter um objeto JSON', de: '.claude/toolkitty.json muss ein JSON-Objekt enthalten', ko: '.claude/toolkitty.json에는 JSON 객체가 들어 있어야 합니다' },
  cfgBadProfile: { en: 'unknown profile "{profile}" in .claude/toolkitty.json', he: 'פרופיל לא מוכר "{profile}" ב-.claude/toolkitty.json', es: 'perfil desconocido "{profile}" en .claude/toolkitty.json', fr: 'profil inconnu « {profile} » dans .claude/toolkitty.json', ru: 'неизвестный профиль «{profile}» в .claude/toolkitty.json', zh: '.claude/toolkitty.json 中有未知的配置“{profile}”', ja: '.claude/toolkitty.json に不明なプロファイル「{profile}」があります', pt: 'perfil desconhecido "{profile}" em .claude/toolkitty.json', de: 'unbekanntes Profil „{profile}“ in .claude/toolkitty.json', ko: '.claude/toolkitty.json에 알 수 없는 프로필 "{profile}"이 있습니다' },
  fOk: { en: 'no conflicting or redundant features', he: 'אין שכלולים מתנגשים או כפולים', es: 'no hay funciones en conflicto ni redundantes', fr: 'aucune fonction en conflit ou redondante', ru: 'конфликтующих или дублирующих функций нет', zh: '没有冲突或冗余的功能', ja: '競合や重複する機能はありません', pt: 'nenhum recurso conflitante ou redundante', de: 'keine widersprüchlichen oder überflüssigen Funktionen', ko: '충돌하거나 중복되는 기능이 없습니다' },
  fOverlap: { en: 'tldr and turn-summary are both on: they overlap', he: 'tldr ו-turn-summary פועלים שניהם: יש ביניהם חפיפה', es: 'tldr y turn-summary están activas: se solapan', fr: 'tldr et turn-summary sont toutes deux actives : elles se recoupent', ru: 'tldr и turn-summary включены вместе: они пересекаются', zh: 'tldr 和 turn-summary 都已开启：功能重叠', ja: 'tldr と turn-summary が両方オンです: 機能が重複しています', pt: 'tldr e turn-summary estão ativos: eles se sobrepõem', de: 'tldr und turn-summary sind beide an: sie überschneiden sich', ko: 'tldr와 turn-summary가 모두 켜져 있습니다: 서로 겹칩니다' },
  fScope: { en: 'scope-guard is on but no scope is set: it has no effect', he: 'scope-guard פועל אך לא הוגדר תחום: אין לו השפעה', es: 'scope-guard está activo pero no hay ámbito: no tiene efecto', fr: 'scope-guard est actif mais aucun périmètre n’est défini : sans effet', ru: 'scope-guard включён, но область не задана: он ничего не делает', zh: 'scope-guard 已开启但未设置范围：不起作用', ja: 'scope-guard はオンですがスコープが未設定です: 効果がありません', pt: 'scope-guard está ativo, mas nenhum escopo foi definido: não tem efeito', de: 'scope-guard ist an, aber es ist kein Scope gesetzt: keine Wirkung', ko: 'scope-guard가 켜져 있지만 범위가 설정되지 않았습니다: 효과가 없습니다' },
  fBudget: { en: 'budget-guard is off: nothing stops spending the last percent', he: 'budget-guard כבוי: דבר לא עוצר הוצאת האחוז האחרון', es: 'budget-guard está desactivado: nada impide gastar el último porcentaje', fr: 'budget-guard est désactivé : rien n’empêche de dépenser le dernier pourcent', ru: 'budget-guard выключен: ничто не остановит трату последнего процента', zh: 'budget-guard 已关闭：没有任何机制阻止用掉最后那一点额度', ja: 'budget-guard がオフです: 最後の数パーセントの消費を止めるものがありません', pt: 'budget-guard está desativado: nada impede de gastar o último por cento', de: 'budget-guard ist aus: nichts verhindert, dass das letzte Prozent verbraucht wird', ko: 'budget-guard가 꺼져 있습니다: 마지막 1%를 쓰는 것을 막는 장치가 없습니다' },
  fContinue: { en: 'auto-continue is on while budget-guard is off: it can keep spending past the limit', he: 'auto-continue פועל בזמן ש-budget-guard כבוי: הוא עלול להמשיך להוציא מעבר למגבלה', es: 'auto-continue está activo con budget-guard desactivado: puede seguir gastando más allá del límite', fr: 'auto-continue est actif alors que budget-guard est désactivé : il peut dépasser la limite', ru: 'auto-continue включён при выключенном budget-guard: он может тратить сверх лимита', zh: 'auto-continue 已开启而 budget-guard 已关闭：可能会一直消耗超出限额', ja: 'auto-continue がオンで budget-guard がオフです: 上限を超えて消費し続ける可能性があります', pt: 'auto-continue está ativo com budget-guard desativado: pode continuar gastando além do limite', de: 'auto-continue ist an, während budget-guard aus ist: es kann über das Limit hinaus weiter verbrauchen', ko: 'auto-continue는 켜져 있고 budget-guard는 꺼져 있습니다: 한도를 넘어 계속 소모할 수 있습니다' },
  hkUnreadable: { en: '~/.claude/settings.json could not be read', he: 'לא ניתן לקרוא את ‎~/.claude/settings.json', es: 'no se pudo leer ~/.claude/settings.json', fr: '~/.claude/settings.json est illisible', ru: 'не удалось прочитать ~/.claude/settings.json', zh: '无法读取 ~/.claude/settings.json', ja: '~/.claude/settings.json を読み取れませんでした', pt: 'Não foi possível ler ~/.claude/settings.json', de: '~/.claude/settings.json konnte nicht gelesen werden', ko: '~/.claude/settings.json을 읽을 수 없습니다' },
  hkInvalid: { en: '~/.claude/settings.json is not valid JSON', he: '‎~/.claude/settings.json אינו JSON תקין', es: '~/.claude/settings.json no es JSON válido', fr: '~/.claude/settings.json n’est pas du JSON valide', ru: '~/.claude/settings.json не является корректным JSON', zh: '~/.claude/settings.json 不是有效的 JSON', ja: '~/.claude/settings.json は有効な JSON ではありません', pt: '~/.claude/settings.json não é um JSON válido', de: '~/.claude/settings.json ist kein gültiges JSON', ko: '~/.claude/settings.json이 올바른 JSON이 아닙니다' },
  hkHooks: { en: 'classic hooks exist alongside Toolkitty', he: 'קיימים הוקים קלאסיים לצד ה-Toolkitty', es: 'hay hooks clásicos junto al toolkitty', fr: 'des hooks classiques coexistent avec le toolkitty', ru: 'рядом с toolkitty есть классические хуки', zh: 'Toolkitty 之外还存在经典钩子', ja: 'Toolkitty のほかに従来のフックがあります', pt: 'há hooks clássicos junto com o toolkitty', de: 'klassische Hooks existieren neben dem Toolkitty', ko: 'Toolkitty 외에 기존 훅이 있습니다' },
  hkNoHooks: { en: 'settings.json readable, no classic hooks', he: 'settings.json נקרא, אין הוקים קלאסיים', es: 'settings.json legible, sin hooks clásicos', fr: 'settings.json lisible, aucun hook classique', ru: 'settings.json читается, классических хуков нет', zh: 'settings.json 可读取，没有经典钩子', ja: 'settings.json は読み取り可能で、従来のフックはありません', pt: 'settings.json legível, sem hooks clássicos', de: 'settings.json lesbar, keine klassischen Hooks', ko: 'settings.json을 읽을 수 있고 기존 훅이 없습니다' },
  hkPlugin: { en: 'toolkitty is listed in enabledPlugins', he: 'toolkitty מופיע ב-enabledPlugins', es: 'toolkitty figura en enabledPlugins', fr: 'toolkitty figure dans enabledPlugins', ru: 'toolkitty указан в enabledPlugins', zh: 'toolkitty 已列在 enabledPlugins 中', ja: 'toolkitty は enabledPlugins に含まれています', pt: 'o toolkitty está listado em enabledPlugins', de: 'toolkitty steht in enabledPlugins', ko: 'toolkitty이 enabledPlugins에 있습니다' },
  hkNoPlugin: { en: 'toolkitty is not in enabledPlugins', he: 'toolkitty לא מופיע ב-enabledPlugins', es: 'toolkitty no figura en enabledPlugins', fr: 'toolkitty ne figure pas dans enabledPlugins', ru: 'toolkitty не указан в enabledPlugins', zh: 'toolkitty 不在 enabledPlugins 中', ja: 'toolkitty は enabledPlugins に含まれていません', pt: 'o toolkitty não está em enabledPlugins', de: 'toolkitty steht nicht in enabledPlugins', ko: 'toolkitty이 enabledPlugins에 없습니다' },
  vNone: { en: 'no release info yet (the update check has not run)', he: 'אין עדיין מידע על גרסאות (בדיקת העדכונים לא רצה)', es: 'aún no hay información de versiones (la búsqueda de actualizaciones no se ha ejecutado)', fr: 'pas encore d’information de version (la vérification n’a pas tourné)', ru: 'данных о версиях пока нет (проверка обновлений не запускалась)', zh: '暂无发布信息（尚未运行更新检查）', ja: 'リリース情報はまだありません（更新チェックが未実行です）', pt: 'ainda sem informações de versão (a verificação de atualização não rodou)', de: 'noch keine Release-Infos (die Update-Prüfung lief noch nicht)', ko: '릴리스 정보가 아직 없습니다(업데이트 확인이 실행되지 않음)' },
  vCurrent: { en: '{cur} is up to date (latest known {latest})', he: '{cur} מעודכנת (האחרונה הידועה {latest})', es: '{cur} está al día (última conocida {latest})', fr: '{cur} est à jour (dernière connue {latest})', ru: '{cur} актуальна (последняя известная {latest})', zh: '{cur} 已是最新（已知最新版本 {latest}）', ja: '{cur} は最新です（既知の最新版 {latest}）', pt: '{cur} está atualizado (mais recente conhecido: {latest})', de: '{cur} ist aktuell (neueste bekannte: {latest})', ko: '{cur}이(가) 최신입니다(알려진 최신 {latest})' },
  vNewer: { en: '{latest} is available (you have {cur})', he: '{latest} זמינה (יש לך {cur})', es: '{latest} está disponible (tienes {cur})', fr: '{latest} est disponible (vous avez {cur})', ru: 'доступна {latest} (у вас {cur})', zh: '有可用的 {latest}（你的版本为 {cur}）', ja: '{latest} が利用可能です（現在は {cur}）', pt: '{latest} está disponível (você tem {cur})', de: '{latest} ist verfügbar (du hast {cur})', ko: '{latest}을(를) 사용할 수 있습니다(현재 {cur})' },
  vUnknownCur: { en: 'latest known {latest}; your version is unknown', he: 'האחרונה הידועה {latest}; הגרסה שלך לא ידועה', es: 'última conocida {latest}; tu versión es desconocida', fr: 'dernière connue {latest} ; votre version est inconnue', ru: 'последняя известная {latest}; ваша версия неизвестна', zh: '已知最新版本 {latest}；你的版本未知', ja: '既知の最新版は {latest}、現在のバージョンは不明です', pt: 'mais recente conhecido: {latest}; sua versão é desconhecida', de: 'neueste bekannte: {latest}; deine Version ist unbekannt', ko: '알려진 최신 {latest}. 현재 버전은 알 수 없습니다' },
  envNoRepo: { en: 'not a git repository, nothing to check', he: 'לא מאגר git, אין מה לבדוק', es: 'no es un repositorio git, nada que revisar', fr: 'pas un dépôt git, rien à vérifier', ru: 'не репозиторий git, проверять нечего', zh: '不是 git 仓库，无需检查', ja: 'git リポジトリではないため、チェックするものはありません', pt: 'não é um repositório git, nada a verificar', de: 'kein git-Repository, nichts zu prüfen', ko: 'git 저장소가 아니므로 점검할 것이 없습니다' },
  envOk: { en: 'no .env file is tracked by git', he: 'אף קובץ .env אינו במעקב git', es: 'git no rastrea ningún archivo .env', fr: 'aucun fichier .env n’est suivi par git', ru: 'git не отслеживает файлы .env', zh: 'git 没有跟踪任何 .env 文件', ja: 'git が追跡している .env ファイルはありません', pt: 'nenhum arquivo .env é rastreado pelo git', de: 'keine .env-Datei wird von git verfolgt', ko: 'git이 추적하는 .env 파일이 없습니다' },
  envTracked: { en: 'tracked by git: {files}; secrets may be in history', he: 'במעקב git: {files}; ייתכן שסודות בהיסטוריה', es: 'rastreado por git: {files}; puede haber secretos en el historial', fr: 'suivi par git : {files} ; des secrets sont peut-être dans l’historique', ru: 'отслеживается git: {files}; секреты могут быть в истории', zh: 'git 正在跟踪：{files}；密钥可能已进入历史记录', ja: 'git が追跡中: {files}。シークレットが履歴に含まれている可能性があります', pt: 'rastreado pelo git: {files}; os segredos podem estar no histórico', de: 'von git verfolgt: {files}; Geheimnisse könnten in der Historie stehen', ko: 'git이 추적 중: {files}. 비밀 값이 기록에 있을 수 있습니다' },
  giOk: { en: '.gitignore present and lists .env', he: '.gitignore קיים ומכיל את .env', es: '.gitignore presente y lista .env', fr: '.gitignore présent et liste .env', ru: '.gitignore есть и содержит .env', zh: '存在 .gitignore 且已列出 .env', ja: '.gitignore があり、.env が含まれています', pt: '.gitignore presente e lista .env', de: '.gitignore vorhanden und listet .env', ko: '.gitignore가 있고 .env가 포함되어 있습니다' },
  giNoEnv: { en: '.gitignore present but does not list .env', he: '.gitignore קיים אך לא מכיל את .env', es: '.gitignore presente pero no lista .env', fr: '.gitignore présent mais sans .env', ru: '.gitignore есть, но .env в нём нет', zh: '存在 .gitignore，但没有列出 .env', ja: '.gitignore はありますが、.env が含まれていません', pt: '.gitignore presente, mas não lista .env', de: '.gitignore vorhanden, listet aber .env nicht', ko: '.gitignore가 있지만 .env가 포함되어 있지 않습니다' },
  giMissing: { en: 'no .gitignore', he: 'אין .gitignore', es: 'no hay .gitignore', fr: 'pas de .gitignore', ru: '.gitignore отсутствует', zh: '没有 .gitignore', ja: '.gitignore がありません', pt: 'sem .gitignore', de: 'keine .gitignore', ko: '.gitignore 없음' },
} as const

const PANE_ID = 'doctor'
const PROFILES = ['minimal', 'productive', 'playful']
const TOOLS = ['node', 'npm', 'python', 'git', 'gh', 'prettier', 'eslint', 'ruff', 'pytest']
const SAFE_ENV = /^\.env\.(example|sample|template|dist|defaults)$/i
const LARGE_BYTES = 12 * 1024
const THIN_BYTES = 200

type Ok = boolean | 'warn' | 'skipped'
type Fix = { id: string; label: string }
type Check = { id: string; ok: Ok; detail: string; fix?: Fix }
type State = { ran: boolean; at: number; score: number; checks: Check[] }
type Out = { exitCode: number; stdout: string; stderr: string }
type Ctx = { cwd: string; rawCwd: string; home: string; isRepo: boolean; pkg: string | null; pyproject: string | null; hasReq: boolean }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'doctor' } as const, { ran: false, at: 0, score: 100, checks: [] } as State) as unknown as Atom<State>
const enabled = atom({ plugin: 'toolkitty', key: 'enabled' } as const, {} as Record<string, boolean>) as unknown as Atom<Record<string, boolean>>
// The same shared slot project-config keeps, so a file written here is not re-applied as if a teammate had changed it.
const configSeen = atom({ plugin: 'toolkitty', key: 'slot', id: 'project-config' } as const, { path: '', mtimeMs: 0 } as { path: string; mtimeMs: number }) as unknown as Atom<{ path: string; mtimeMs: number }>

export const feature: Feature = { id: 'doctor', title: T.title, description: T.description, defaultOn: true }

const FIX_LABELS = { gitignore: T.lblGitignore, 'toolkitty-json': T.lblToolkit, 'budget-on': T.lblBudget } as const
const FALLBACK_ON: Record<string, boolean> = { 'budget-guard': true, 'turn-summary': true, tldr: false, 'scope-guard': false, 'auto-continue': false }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function fixOf(id: keyof typeof FIX_LABELS): Fix {
  return { id, label: t(FIX_LABELS[id]) }
}

function sizeText(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

async function baseOf($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd()
  return cwd.replace(/\\/g, '/').replace(/\/+$/, '')
}

async function sh($: EngineInterface, argv: string[], cwd: string): Promise<Out | null> {
  try {
    const r = await $.process.run(argv, { cwd, timeoutMs: 10000 })
    return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr }
  } catch {
    return null
  }
}

async function readText($: EngineInterface, path: string): Promise<string | null> {
  try {
    return await $.fs.read(path)
  } catch {
    return null
  }
}

async function has($: EngineInterface, path: string): Promise<boolean> {
  try {
    return await $.fs.exists(path)
  } catch {
    return false
  }
}

async function firstExisting($: EngineInterface, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    if (await has($, path)) return path
  }
  return null
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).filter(line => line.trim() !== '')
}

function parentOf(path: string): string | null {
  const i = path.lastIndexOf('/')
  if (i <= 0) return null
  const parent = path.slice(0, i)
  return /^[A-Za-z]:$/.test(parent) ? `${parent}/` : parent
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function numbers(version: string): number[] | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version.trim())
  if (m === null) return null
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)]
}

function isNewer(a: string, b: string): boolean {
  const pa = numbers(a)
  const pb = numbers(b)
  if (pa === null || pb === null) return false
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/* ---------- the checks ---------- */

async function checkGit($: EngineInterface, ctx: Ctx): Promise<Check> {
  const inside = await sh($, ['git', 'rev-parse', '--is-inside-work-tree'], ctx.cwd)
  if (inside === null) return { id: 'git', ok: 'skipped', detail: t(T.gitMissing) }
  if (inside.exitCode !== 0 || inside.stdout.trim() !== 'true') return { id: 'git', ok: 'warn', detail: t(T.gitNo) }
  ctx.isRepo = true
  const status = await sh($, ['git', 'status', '--porcelain'], ctx.cwd)
  const branch = await sh($, ['git', 'branch', '--show-current'], ctx.cwd)
  const remotes = await sh($, ['git', 'remote'], ctx.cwd)
  const changed = status !== null && status.exitCode === 0 ? lines(status.stdout).length : 0
  const name = branch !== null && branch.exitCode === 0 ? branch.stdout.trim() : ''
  const remote = remotes !== null && remotes.exitCode === 0 ? (lines(remotes.stdout)[0] ?? '').trim() : ''
  const detail = t(T.gitDetail, { branch: name === '' ? t(T.gitNoBranch) : name, n: changed, remote: remote === '' ? t(T.gitNoRemote) : t(T.gitRemote, { name: remote }) })
  return { id: 'git', ok: remote === '' ? 'warn' : true, detail }
}

async function checkClaudeMd($: EngineInterface, ctx: Ctx): Promise<Check> {
  const candidates: string[] = []
  let dir: string | null = ctx.cwd
  for (let i = 0; i < 4 && dir !== null; i++) {
    candidates.push(`${dir.replace(/\/+$/, '')}/CLAUDE.md`)
    dir = parentOf(dir)
  }
  if (ctx.home !== '') candidates.push(`${ctx.home}/.claude/CLAUDE.md`)
  const path = await firstExisting($, candidates)
  if (path === null) return { id: 'claude-md', ok: 'warn', detail: t(T.mdNone) }
  const text = (await readText($, path)) ?? ''
  let size = text.length
  try {
    size = (await $.fs.stat(path)).size
  } catch {
    // the text length stands in
  }
  const notes: string[] = [t(T.mdFound, { path, size: sizeText(size) })]
  let ok: Ok = true
  if (size > LARGE_BYTES) {
    ok = 'warn'
    notes.push(t(T.mdLarge))
  } else if (size < THIN_BYTES) {
    ok = 'warn'
    notes.push(t(T.mdThin))
  }
  const tests = /\b(tests?|pytest|vitest|jest|mocha)\b/i.test(text)
  const lint = /\b(lint|eslint|ruff|prettier|flake8)\b/i.test(text)
  if (tests) notes.push(t(T.mdTests))
  if (lint) notes.push(t(T.mdLint))
  if (!tests && !lint) notes.push(t(T.mdNeither))
  return { id: 'claude-md', ok, detail: notes.join(' · ') }
}

async function probeAll($: EngineInterface, names: string[], cwd: string): Promise<(Out | null)[]> {
  const jobs: Promise<Out | null>[] = []
  for (const name of names) jobs.push(sh($, [name, '--version'], cwd))
  return Promise.all(jobs)
}

async function checkTools($: EngineInterface, ctx: Ctx): Promise<Check> {
  const results = await probeAll($, TOOLS, ctx.cwd)
  const needed = new Set<string>()
  if (ctx.pkg !== null) {
    needed.add('node')
    needed.add('npm')
  }
  if (ctx.pyproject !== null || ctx.hasReq) needed.add('python')
  const found: string[] = []
  const missing: string[] = []
  const lacking: string[] = []
  TOOLS.forEach((name, i) => {
    const r = results[i] ?? null
    if (r !== null && r.exitCode === 0) {
      const first = (r.stdout.trim() !== '' ? r.stdout : r.stderr).split(/\r?\n/)[0] ?? ''
      const v = /\d+(?:\.\d+)*/.exec(first)
      found.push(v === null ? name : `${name} ${v[0]}`)
    } else if (needed.has(name)) {
      lacking.push(name)
    } else {
      missing.push(name)
    }
  })
  if (found.length === 0 && lacking.length === 0) return { id: 'tools', ok: 'skipped', detail: t(T.toolsNone) }
  const parts: string[] = []
  if (found.length > 0) parts.push(t(T.toolsFound, { list: found.join(', ') }))
  if (missing.length > 0) parts.push(t(T.toolsMissing, { list: missing.join(', ') }))
  if (lacking.length > 0) parts.push(t(T.toolsNeeded, { list: lacking.join(', ') }))
  return { id: 'tools', ok: lacking.length > 0 ? false : true, detail: parts.join(' · ') }
}

async function checkTests($: EngineInterface, ctx: Ctx): Promise<Check> {
  const found: string[] = []
  let deps = ''
  if (ctx.pkg !== null) {
    const parsed = parseJson(ctx.pkg)
    if (isRecord(parsed)) {
      const scripts = parsed['scripts']
      const script = isRecord(scripts) ? scripts['test'] : undefined
      if (typeof script === 'string' && script.trim() !== '' && !/no test specified/i.test(script)) found.push('scripts.test')
      deps = JSON.stringify({ d: parsed['dependencies'], v: parsed['devDependencies'] })
      if (parsed['jest'] !== undefined && !found.includes('jest')) found.push('jest')
    }
  }
  const vitest = await firstExisting($, ['ts', 'js', 'mjs', 'mts'].map(ext => `${ctx.cwd}/vitest.config.${ext}`))
  if (vitest !== null || /"vitest"/.test(deps)) found.push('vitest')
  const jest = await firstExisting($, ['js', 'ts', 'mjs', 'cjs', 'json'].map(ext => `${ctx.cwd}/jest.config.${ext}`))
  if ((jest !== null || /"jest"/.test(deps)) && !found.includes('jest')) found.push('jest')
  const pytest = await firstExisting($, [`${ctx.cwd}/pytest.ini`, `${ctx.cwd}/conftest.py`])
  if (pytest !== null || (ctx.pyproject !== null && /\[tool\.pytest/.test(ctx.pyproject))) found.push('pytest')
  if (found.length === 0) return { id: 'tests', ok: 'warn', detail: t(T.testsNone) }
  return { id: 'tests', ok: true, detail: t(T.testsFound, { list: found.join(', ') }) }
}

async function checkConfig($: EngineInterface, ctx: Ctx): Promise<Check> {
  const text = await readText($, `${ctx.cwd}/.claude/toolkitty.json`)
  if (text === null) return { id: 'toolkitty-config', ok: 'skipped', detail: t(T.cfgMissing), fix: fixOf('toolkitty-json') }
  const parsed = parseJson(text)
  if (parsed === undefined) return { id: 'toolkitty-config', ok: 'warn', detail: t(T.cfgInvalid) }
  if (!isRecord(parsed)) return { id: 'toolkitty-config', ok: 'warn', detail: t(T.cfgNotObject) }
  const profile = parsed['profile']
  if (profile !== undefined) {
    if (typeof profile !== 'string' || !PROFILES.includes(profile)) return { id: 'toolkitty-config', ok: 'warn', detail: t(T.cfgBadProfile, { profile: String(profile) }) }
    return { id: 'toolkitty-config', ok: true, detail: t(T.cfgProfile, { profile }) }
  }
  return { id: 'toolkitty-config', ok: true, detail: t(T.cfgOk) }
}

async function checkFeatures($: EngineInterface, ctx: Ctx): Promise<Check[]> {
  const map = await read($, enabled)
  const isEnabled = (id: string): boolean => {
    const known = features.find(f => f.id === id)
    return map[id] ?? known?.defaultOn ?? FALLBACK_ON[id] ?? false
  }
  const out: Check[] = []
  if (isEnabled('tldr') && isEnabled('turn-summary')) out.push({ id: 'features-overlap', ok: true, detail: t(T.fOverlap) })
  if (isEnabled('scope-guard')) {
    const globs = await storeGet<string[]>($, `scope-guard:${ctx.rawCwd}`, [])
    if (globs.length === 0) out.push({ id: 'features-scope', ok: 'warn', detail: t(T.fScope) })
  }
  const budgetOn = isEnabled('budget-guard')
  if (!budgetOn) out.push({ id: 'features-budget', ok: 'warn', detail: t(T.fBudget), fix: fixOf('budget-on') })
  if (isEnabled('auto-continue') && !budgetOn) out.push({ id: 'features-continue', ok: 'warn', detail: t(T.fContinue), fix: fixOf('budget-on') })
  if (out.length === 0) out.push({ id: 'features', ok: true, detail: t(T.fOk) })
  return out
}

async function checkHooks($: EngineInterface, ctx: Ctx): Promise<Check> {
  const text = ctx.home === '' ? null : await readText($, `${ctx.home}/.claude/settings.json`)
  if (text === null) return { id: 'hooks', ok: 'skipped', detail: t(T.hkUnreadable) }
  const parsed = parseJson(text)
  if (!isRecord(parsed)) return { id: 'hooks', ok: 'warn', detail: t(T.hkInvalid) }
  const notes: string[] = [parsed['hooks'] !== undefined ? t(T.hkHooks) : t(T.hkNoHooks)]
  const plugins = parsed['enabledPlugins']
  const listed = isRecord(plugins) && Object.keys(plugins).some(key => key.toLowerCase().includes('toolkitty'))
  notes.push(listed ? t(T.hkPlugin) : t(T.hkNoPlugin))
  return { id: 'hooks', ok: true, detail: notes.join(' · ') }
}

async function checkVersion($: EngineInterface): Promise<Check> {
  const latest = await storeGet<{ version?: string } | null>($, 'update-check:latest', null)
  const latestVersion = latest !== null && typeof latest.version === 'string' && latest.version !== '' ? latest.version : null
  if (latestVersion === null) return { id: 'version', ok: 'skipped', detail: t(T.vNone) }
  let current: string | null = null
  const raw = await readText($, `${$.plugin.root}/.claude-plugin/plugin.json`)
  if (raw !== null) {
    const parsed = parseJson(raw)
    if (isRecord(parsed) && typeof parsed['version'] === 'string' && parsed['version'] !== '') current = parsed['version']
  }
  if (current === null) return { id: 'version', ok: true, detail: t(T.vUnknownCur, { latest: latestVersion }) }
  if (isNewer(latestVersion, current)) return { id: 'version', ok: 'warn', detail: t(T.vNewer, { latest: latestVersion, cur: current }) }
  return { id: 'version', ok: true, detail: t(T.vCurrent, { cur: current, latest: latestVersion }) }
}

async function checkEnvTracked($: EngineInterface, ctx: Ctx): Promise<Check> {
  if (!ctx.isRepo) return { id: 'env-tracked', ok: 'skipped', detail: t(T.envNoRepo) }
  const r = await sh($, ['git', 'ls-files', '.env', '.env.*'], ctx.cwd)
  const tracked = r !== null && r.exitCode === 0 ? lines(r.stdout).map(l => l.trim()).filter(l => !SAFE_ENV.test(l)) : []
  if (tracked.length > 0) return { id: 'env-tracked', ok: false, detail: t(T.envTracked, { files: tracked.join(', ') }) }
  return { id: 'env-tracked', ok: true, detail: t(T.envOk) }
}

async function checkGitignore($: EngineInterface, ctx: Ctx): Promise<Check> {
  const text = await readText($, `${ctx.cwd}/.gitignore`)
  if (text === null) return { id: 'gitignore', ok: 'warn', detail: t(T.giMissing), fix: fixOf('gitignore') }
  return { id: 'gitignore', ok: true, detail: /^\s*\/?\.env(\*|\.\*)?\s*$/m.test(text) ? t(T.giOk) : t(T.giNoEnv) }
}

async function collect($: EngineInterface): Promise<Check[]> {
  const rawCwd = await $.session.cwd()
  const cwd = await baseOf($)
  const home = ((await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
  const ctx: Ctx = {
    cwd,
    rawCwd,
    home,
    isRepo: false,
    pkg: await readText($, `${cwd}/package.json`),
    pyproject: await readText($, `${cwd}/pyproject.toml`),
    hasReq: await has($, `${cwd}/requirements.txt`),
  }
  const out: Check[] = []
  out.push(await checkGit($, ctx))
  out.push(await checkClaudeMd($, ctx))
  out.push(await checkTools($, ctx))
  out.push(await checkTests($, ctx))
  out.push(await checkConfig($, ctx))
  out.push(...(await checkFeatures($, ctx)))
  out.push(await checkHooks($, ctx))
  out.push(await checkVersion($))
  out.push(await checkEnvTracked($, ctx))
  out.push(await checkGitignore($, ctx))
  return out
}

/* ---------- scoring, report, state ---------- */

function tally(checks: Check[]): { failed: number; warned: number; score: number } {
  const failed = checks.filter(c => c.ok === false).length
  const warned = checks.filter(c => c.ok === 'warn').length
  return { failed, warned, score: Math.max(0, 100 - 15 * failed - 5 * warned) }
}

function titleOf(id: string): string {
  if (id === 'git') return t(T.tGit)
  if (id === 'claude-md') return t(T.tClaudeMd)
  if (id === 'tools') return t(T.tTools)
  if (id === 'tests') return t(T.tTests)
  if (id === 'toolkitty-config') return t(T.tConfig)
  if (id.startsWith('features')) return t(T.tFeatures)
  if (id === 'hooks') return t(T.tHooks)
  if (id === 'version') return t(T.tVersion)
  if (id === 'env-tracked') return t(T.tEnv)
  return t(T.tIgnore)
}

const glyphOf = (ok: Ok): string => (ok === true ? '✓' : ok === 'warn' ? '⚠' : ok === false ? '✗' : '–')
const levelOf = (ok: Ok): Level => (ok === 'warn' ? 'warn' : ok === false ? 'alert' : 'ok')
const scoreLevel = (score: number): Level => (score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'alert')

function reportText(s: State): string {
  const { failed, warned, score } = tally(s.checks)
  const rows = s.checks.map(c => `${glyphOf(c.ok)} ${titleOf(c.id)}: ${c.detail}`)
  return [t(T.reportHead, { score }), t(T.formula, { failed, warned, score }), ...rows].join('\n')
}

async function runDoctor($: EngineInterface): Promise<State> {
  const checks = await collect($)
  const at = await $.clock.now()
  const result: State = { ran: true, at, score: tally(checks).score, checks }
  await update($, state, () => result)
  return result
}

async function openPane($: EngineInterface): Promise<void> {
  try {
    await $.ui.open({ id: PANE_ID, title: t(T.paneTitle), focus: true, closeOnEscape: true })
  } catch {
    // no surface to draw it
  }
}

async function copyReport($: EngineInterface, s: State): Promise<boolean> {
  try {
    const r = await $.ui.copy({ text: reportText(s) })
    return r.isCopied
  } catch {
    return false
  }
}

/* ---------- fixes: only on a button press, only reversible ---------- */

async function applyFix($: EngineInterface, id: string): Promise<string> {
  const cwd = await baseOf($)
  try {
    if (id === 'gitignore') {
      const path = `${cwd}/.gitignore`
      if (await has($, path)) return t(T.fixExists, { path })
      await $.fs.write(path, '.env\n')
      return t(T.fixGitignore, { path })
    }
    if (id === 'toolkitty-json') {
      const path = `${cwd}/.claude/toolkitty.json`
      if (await has($, path)) return t(T.fixExists, { path })
      const current = await read($, enabled)
      const all: Record<string, boolean> = {}
      for (const f of features) all[f.id] = current[f.id] ?? f.defaultOn
      const scope = await storeGet<string[]>($, `scope-guard:${await $.session.cwd()}`, [])
      const out: { enabled: Record<string, boolean>; language: string; scope?: string[] } = { enabled: all, language: language() }
      if (scope.length > 0) out.scope = scope
      await $.fs.write(path, JSON.stringify(out, null, 2) + '\n')
      try {
        const mtimeMs = (await $.fs.stat(path)).mtimeMs
        await update($, configSeen, () => ({ path, mtimeMs }))
      } catch {
        // project-config will read it once more at most
      }
      return t(T.fixToolkit, { path })
    }
    if (id === 'budget-on') {
      const merged = { ...(await read($, enabled)), 'budget-guard': true }
      await update($, enabled, () => merged)
      await storeSet($, 'enabled', merged)
      return t(T.fixBudget)
    }
    return ''
  } catch (err) {
    return t(T.fixFailed, { message: err instanceof Error ? err.message : String(err) })
  }
}

async function fixOne($: EngineInterface, checkId: string): Promise<void> {
  const s = await read($, state)
  const check = s.checks.find(c => c.id === checkId)
  if (check === undefined || check.fix === undefined) return
  const message = await applyFix($, check.fix.id)
  if (message !== '') await notice($, 'info', message, feature.id, { immediate: true })
  await runDoctor($)
}

async function fixRecommended($: EngineInterface): Promise<void> {
  const s = await read($, state)
  const fixes: Fix[] = []
  for (const c of s.checks) {
    if (c.fix !== undefined && !fixes.some(f => f.id === c.fix?.id)) fixes.push(c.fix)
  }
  if (fixes.length === 0) {
    await notice($, 'info', t(T.nothingToFix), feature.id, { immediate: true })
    return
  }
  let answer = ''
  try {
    answer = await $.ui.ask(t(T.askQuestion, { n: fixes.length, list: fixes.map(f => f.label).join('; ') }), { header: t(T.askHeader), options: [t(T.apply), t(T.cancel)] })
  } catch {
    answer = ''
  }
  if (answer !== t(T.apply)) {
    await notice($, 'info', t(T.cancelled), feature.id, { immediate: true })
    return
  }
  // The exported setup goes last, so the file already holds what the other fixes changed.
  const ordered = [...fixes.filter(f => f.id !== 'toolkitty-json'), ...fixes.filter(f => f.id === 'toolkitty-json')]
  for (const f of ordered) {
    const message = await applyFix($, f.id)
    if (message !== '') await notice($, 'info', message, feature.id, { immediate: true })
  }
  await runDoctor($)
}

async function copyPressed($: EngineInterface): Promise<void> {
  const s = await read($, state)
  const done = await copyReport($, s)
  await notice($, 'info', t(done ? T.copied : T.copyFailed), feature.id, { immediate: true })
}

/* ---------- handlers ---------- */

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  void e
  try {
    await $.command.register({ name: 'envcheck', description: t(T.cmdDesc), argumentHint: 'copy' })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'envcheck', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

/** The short band form: "doctor 76" once the score is below 80; quiet before the first run. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const s = await read($, state)
  if (!s.ran || s.score >= 80) return null
  return { text: t(T.chip, { score: s.score }), level: s.score < 50 ? 'alert' : 'warn', icon: ICONS.setup }
}

export function register(on: On) {
  on('command.run', { command: 'envcheck' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const s = await runDoctor($)
    if (e.args.trim().toLowerCase() === 'copy') {
      const done = await copyReport($, s)
      return { text: t(done ? T.copied : T.copyFailed) }
    }
    await openPane($)
    const { failed, warned, score } = tally(s.checks)
    return { text: t(T.summary, { score, failed, warned }) }
  })

  on('ui.render', { component: 'Pane', requestId: 'doctor' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const s = await read($, state)
    const actions = [
      { key: 'doctor-run', label: t(T.runAgain), onPress: () => runDoctor($) },
      { key: 'doctor-copy', label: t(T.copyReport), onPress: () => copyPressed($) },
      { key: 'doctor-fix-all', label: t(T.fixAll), onPress: () => fixRecommended($) },
    ]
    if (!s.ran) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.setup, actions: actions.slice(0, 1) })}
          {emptyState($, e, t(T.notRun), t(T.notRunHint))}
        </Box>
      )
    }

    const { failed, warned, score } = tally(s.checks)
    return (
      <Box flexDirection="column">
        {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.setup, status: `${score}/100`, level: scoreLevel(score), actions })}
        <Text dimColor size="footnote">
          {t(T.formula, { failed, warned, score })}
        </Text>
        {sectionTitle($, e, t(T.checksSection))}
        {s.checks.map(c => (
          <Box key={`doctor-row-${c.id}`} gap={1}>
            {listRow($, e, { key: `doctor-${c.id}`, left: glyphOf(c.ok), text: `${titleOf(c.id)}: ${c.detail}`, level: levelOf(c.ok) })}
            {c.fix !== undefined ? <Button key={`doctor-fix-${c.id}`} plain label={t(T.fixButton)} onPress={() => fixOne($, c.id)} /> : null}
          </Box>
        ))}
      </Box>
    )
  })
}
