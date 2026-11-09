import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, setNoticePrefs, storeSet, t } from '../core'
import type { Feature, Input, Localized } from '../core'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'
import type { HeaderAction } from '../ui'
// The catalogue is injected by register.tsx (an import of './index' would be circular).
let features: Feature[] = []

/** Called once by register.tsx before any hook runs. */
export function setCatalog(list: Feature[]): void {
  features = list
}

const T = {
  title: { en: 'Display profiles', he: 'פרופילי תצוגה', es: 'Perfiles de visualización', fr: 'Profils d’affichage', ru: 'Профили отображения', zh: '显示配置', ja: '表示プロファイル', pt: 'Perfis de exibição', de: 'Anzeigeprofile', ko: '표시 프로필' },
  description: {
    en: 'Three ready-made setups (Minimal, Productive, Playful) for how much Toolkitty shows; safety guards stay on in all of them. /profiles shows and switches',
    he: 'שלוש הגדרות מוכנות (מינימלי, פרודוקטיבי, שובב) לכמה Toolkitty מציג; שומרי הבטיחות נשארים פעילים בכולן. /profiles מציג ומחליף',
    es: 'Tres configuraciones listas (Mínimo, Productivo, Divertido) para cuánto muestra Toolkitty; las protecciones siguen activas en todas. /profiles muestra y cambia',
    fr: 'Trois réglages prêts (Minimal, Productif, Ludique) pour ce que Toolkitty affiche ; les garde-fous restent actifs partout. /profiles affiche et change',
    ru: 'Три готовых набора (Минимальный, Продуктивный, Игровой) для того, сколько показывает Toolkitty; защита включена во всех. /profiles показывает и переключает',
    zh: '三种现成方案（极简、高效、趣味），控制 Toolkitty 显示多少内容；安全防护在所有方案中都保持开启。/profiles 可查看和切换',
    ja: 'Toolkitty の表示量を決める 3 つの既成セットアップ（ミニマル、プロダクティブ、プレイフル）。安全ガードはすべてオンのままです。/profiles で確認・切り替え',
    pt: 'Três configurações prontas (Mínimo, Produtivo, Divertido) para o quanto o Toolkitty mostra; as proteções de segurança ficam ativas em todas. /profiles mostra e alterna',
    de: 'Drei fertige Setups (Minimal, Produktiv, Verspielt) dafür, wie viel Toolkitty anzeigt; Sicherheitswächter bleiben in allen aktiv. /profiles zeigt und wechselt',
    ko: 'Toolkitty이 얼마나 보여 줄지 정하는 기본 구성 3가지(최소, 생산, 놀이). 안전 가드는 모두 켜져 있습니다. /profiles로 확인·전환합니다',
  },
  cmdDesc: { en: 'Shows or switches the display profile (minimal, productive, playful)', he: 'מציג או מחליף את פרופיל התצוגה (minimal, productive, playful)', es: 'Muestra o cambia el perfil de visualización (minimal, productive, playful)', fr: 'Affiche ou change le profil d’affichage (minimal, productive, playful)', ru: 'Показывает или переключает профиль отображения (minimal, productive, playful)', zh: '显示或切换显示配置（minimal、productive、playful）', ja: '表示プロファイルを表示・切り替えます（minimal、productive、playful）', pt: 'Mostra ou alterna o perfil de exibição (minimal, productive, playful)', de: 'Zeigt oder wechselt das Anzeigeprofil (minimal, productive, playful)', ko: '표시 프로필을 보거나 전환합니다 (minimal, productive, playful)' },
  off: { en: 'Display profiles are turned off in the switchboard.', he: 'פרופילי התצוגה כבויים בלוח המתגים.', es: 'Los perfiles de visualización están desactivados en el panel.', fr: 'Les profils d’affichage sont désactivés dans le tableau.', ru: 'Профили отображения выключены в панели.', zh: '显示配置已在开关面板中关闭。', ja: '表示プロファイルはスイッチボードでオフになっています。', pt: 'Os perfis de exibição estão desativados no painel de controle.', de: 'Anzeigeprofile sind im Schaltpult ausgeschaltet.', ko: '표시 프로필은 스위치보드에서 꺼져 있습니다.' },
  paneTitle: { en: 'Display profiles', he: 'פרופילי תצוגה', es: 'Perfiles de visualización', fr: 'Profils d’affichage', ru: 'Профили отображения', zh: '显示配置', ja: '表示プロファイル', pt: 'Perfis de exibição', de: 'Anzeigeprofile', ko: '표시 프로필' },
  // the three profiles (one definition, onboarding uses the same words)
  minimal: { en: 'Minimal', he: 'מינימלי', es: 'Mínimo', fr: 'Minimal', ru: 'Минимальный', zh: '极简', ja: 'ミニマル', pt: 'Mínimo', de: 'Minimal', ko: '최소' },
  minimalDesc: {
    en: 'The headline and the bell only; quiet notices, no visuals.',
    he: 'רק הכותרת והפעמון; התראות שקטות, בלי ויזואלי.',
    es: 'Solo el titular y la campana; avisos silenciosos, sin visuales.',
    fr: 'Seulement le titre et la cloche ; avis discrets, sans visuel.',
    ru: 'Только заголовок и колокольчик; тихие уведомления, без визуальных.',
    zh: '只有标题和提示铃；通知安静，无视觉效果。',
    ja: '見出しとベルのみ。静かな通知で、ビジュアルなし。',
    pt: 'Só o título e o sino; avisos discretos, sem visuais.',
    de: 'Nur die Überschrift und die Glocke; leise Hinweise, keine Grafiken.',
    ko: '제목과 알림음만; 조용한 알림, 시각 효과 없음.',
  },
  productive: { en: 'Productive', he: 'פרודוקטיבי', es: 'Productivo', fr: 'Productif', ru: 'Продуктивный', zh: '高效', ja: 'プロダクティブ', pt: 'Produtivo', de: 'Produktiv', ko: '생산' },
  productiveDesc: {
    en: 'Minimal plus the working tools: pace, cache, loops, review, reports.',
    he: 'מינימלי ועוד כלי העבודה: קצב, cache, לולאות, סקירה, דוחות.',
    es: 'Mínimo más las herramientas de trabajo: ritmo, caché, bucles, revisión, informes.',
    fr: 'Minimal plus les outils de travail : rythme, cache, boucles, revue, rapports.',
    ru: 'Минимальный плюс рабочие инструменты: темп, кэш, циклы, ревью, отчёты.',
    zh: '极简加上工作工具：进度、缓存、循环、审查、报告。',
    ja: 'ミニマルに作業ツールを追加：ペース、キャッシュ、ループ、レビュー、レポート。',
    pt: 'Mínimo mais as ferramentas de trabalho: ritmo, cache, loops, revisão, relatórios.',
    de: 'Minimal plus die Arbeitswerkzeuge: Tempo, Cache, Schleifen, Review, Berichte.',
    ko: '최소에 작업 도구를 더함: 속도, 캐시, 루프, 리뷰, 리포트.',
  },
  playful: { en: 'Playful', he: 'שובב', es: 'Divertido', fr: 'Ludique', ru: 'Игровой', zh: '趣味', ja: 'プレイフル', pt: 'Divertido', de: 'Verspielt', ko: '놀이' },
  playfulDesc: {
    en: 'Every default feature, companion, aquarium and animations included.',
    he: 'כל שכלולי ברירת המחדל, כולל החבר, האקווריום והאנימציות.',
    es: 'Todas las funciones por defecto, con compañero, acuario y animaciones.',
    fr: 'Toutes les fonctions par défaut, compagnon, aquarium et animations compris.',
    ru: 'Все функции по умолчанию, включая питомца, аквариум и анимации.',
    zh: '所有默认功能，包括伙伴、水族箱和动画。',
    ja: 'コンパニオン、水族館、アニメーションを含むすべてのデフォルト機能。',
    pt: 'Todos os recursos padrão, incluindo companheiro, aquário e animações.',
    de: 'Alle Standardfunktionen, einschließlich Begleiter, Aquarium und Animationen.',
    ko: '동반자, 수족관, 애니메이션을 포함한 모든 기본 기능.',
  },
  // the /profiles text
  current: { en: 'Display profile: {name} · {count} features on', he: 'פרופיל תצוגה: {name} · {count} שכלולים פעילים', es: 'Perfil de visualización: {name} · {count} funciones activas', fr: 'Profil d’affichage : {name} · {count} fonctions actives', ru: 'Профиль отображения: {name} · включено функций: {count}', zh: '显示配置：{name} · 已开启 {count} 个功能', ja: '表示プロファイル：{name} · {count} 機能オン', pt: 'Perfil de exibição: {name} · {count} recursos ativos', de: 'Anzeigeprofil: {name} · {count} Funktionen an', ko: '표시 프로필: {name} · 기능 {count}개 켜짐' },
  currentNone: { en: 'Display profile: none applied yet · {count} features on', he: 'פרופיל תצוגה: עדיין לא הוחל · {count} שכלולים פעילים', es: 'Perfil de visualización: ninguno aplicado aún · {count} funciones activas', fr: 'Profil d’affichage : aucun appliqué pour l’instant · {count} fonctions actives', ru: 'Профиль отображения: ещё не выбран · включено функций: {count}', zh: '显示配置：尚未应用 · 已开启 {count} 个功能', ja: '表示プロファイル：未適用 · {count} 機能オン', pt: 'Perfil de exibição: nenhum aplicado ainda · {count} recursos ativos', de: 'Anzeigeprofil: noch keins angewendet · {count} Funktionen an', ko: '표시 프로필: 아직 적용 안 됨 · 기능 {count}개 켜짐' },
  byHand: { en: 'Changed by hand ({n}): {list}', he: 'שונו ידנית ({n}): {list}', es: 'Cambiadas a mano ({n}): {list}', fr: 'Modifiées à la main ({n}) : {list}', ru: 'Изменено вручную ({n}): {list}', zh: '手动更改（{n}）：{list}', ja: '手動で変更（{n}）：{list}', pt: 'Alterado manualmente ({n}): {list}', de: 'Von Hand geändert ({n}): {list}', ko: '수동 변경 ({n}): {list}' },
  choiceLine: { en: '· {id} ({name}): {desc} {n} on', he: '· {id} ({name}): {desc} {n} פעילים', es: '· {id} ({name}): {desc} {n} activas', fr: '· {id} ({name}) : {desc} {n} actives', ru: '· {id} ({name}): {desc} включено: {n}', zh: '· {id}（{name}）：{desc} 已开启 {n} 个', ja: '· {id}（{name}）：{desc} {n} 機能オン', pt: '· {id} ({name}): {desc} {n} ativos', de: '· {id} ({name}): {desc} {n} an', ko: '· {id} ({name}): {desc} {n}개 켜짐' },
  howTo: { en: 'Switch with /profiles <name>; /profiles pane opens the cards.', he: 'להחלפה: /profiles <שם>; /profiles pane פותח את הכרטיסים.', es: 'Cambia con /profiles <nombre>; /profiles pane abre las tarjetas.', fr: 'Change avec /profiles <nom> ; /profiles pane ouvre les cartes.', ru: 'Переключение: /profiles <имя>; /profiles pane открывает карточки.', zh: '用 /profiles <名称> 切换；/profiles pane 打开卡片。', ja: '/profiles <名前> で切り替え、/profiles pane でカードを開きます。', pt: 'Alterne com /profiles <nome>; /profiles pane abre os cartões.', de: 'Wechsle mit /profiles <Name>; /profiles pane öffnet die Karten.', ko: '/profiles <이름>으로 전환하고, /profiles pane으로 카드를 엽니다.' },
  paneOpened: { en: 'Display profiles opened.', he: 'פרופילי התצוגה נפתחו.', es: 'Perfiles de visualización abiertos.', fr: 'Profils d’affichage ouverts.', ru: 'Профили отображения открыты.', zh: '显示配置已打开。', ja: '表示プロファイルを開きました。', pt: 'Perfis de exibição abertos.', de: 'Anzeigeprofile geöffnet.', ko: '표시 프로필을 열었습니다.' },
  unknown: { en: 'Unknown profile "{name}". Choose minimal, productive or playful.', he: 'פרופיל לא מוכר "{name}". בחר minimal, productive או playful.', es: 'Perfil desconocido "{name}". Elige minimal, productive o playful.', fr: 'Profil inconnu « {name} ». Choisis minimal, productive ou playful.', ru: 'Неизвестный профиль «{name}». Выберите minimal, productive или playful.', zh: '未知的配置“{name}”。请选择 minimal、productive 或 playful。', ja: '不明なプロファイル「{name}」です。minimal、productive、playful から選んでください。', pt: 'Perfil desconhecido "{name}". Escolha minimal, productive ou playful.', de: 'Unbekanntes Profil „{name}“. Wähle minimal, productive oder playful.', ko: '알 수 없는 프로필 "{name}"입니다. minimal, productive, playful 중에서 고르세요.' },
  // the preview and the result
  askHeader: { en: 'Profile', he: 'פרופיל', es: 'Perfil', fr: 'Profil', ru: 'Профиль', zh: '配置', ja: 'プロファイル', pt: 'Perfil', de: 'Profil', ko: '프로필' },
  askQuestion: {
    en: 'Switch to the {name} profile? This turns off {n}: {list}. Safety guards stay on.',
    he: 'לעבור לפרופיל {name}? זה יכבה {n}: {list}. שומרי הבטיחות נשארים פעילים.',
    es: '¿Cambiar al perfil {name}? Se desactivarán {n}: {list}. Las protecciones siguen activas.',
    fr: 'Passer au profil {name} ? Cela désactive {n} : {list}. Les garde-fous restent actifs.',
    ru: 'Перейти на профиль {name}? Будет выключено {n}: {list}. Защита остаётся включённой.',
    zh: '切换到 {name} 配置？这会关闭 {n} 项：{list}。安全防护保持开启。',
    ja: '{name} プロファイルに切り替えますか？{n} 件がオフになります：{list}。安全ガードはオンのままです。',
    pt: 'Alternar para o perfil {name}? Isso desativa {n}: {list}. As proteções de segurança continuam ativas.',
    de: 'Zum Profil {name} wechseln? Das schaltet {n} aus: {list}. Sicherheitswächter bleiben an.',
    ko: '{name} 프로필로 전환할까요? {n}개가 꺼집니다: {list}. 안전 가드는 계속 켜져 있습니다.',
  },
  more: { en: '… +{n} more', he: '… ועוד {n}', es: '… y {n} más', fr: '… +{n} de plus', ru: '… и ещё {n}', zh: '…… 另有 {n} 项', ja: '… 他 {n} 件', pt: '… +{n} mais', de: '… +{n} weitere', ko: '… 외 {n}개' },
  apply: { en: 'Apply', he: 'החל', es: 'Aplicar', fr: 'Appliquer', ru: 'Применить', zh: '应用', ja: '適用', pt: 'Aplicar', de: 'Anwenden', ko: '적용' },
  cancel: { en: 'Cancel', he: 'ביטול', es: 'Cancelar', fr: 'Annuler', ru: 'Отмена', zh: '取消', ja: 'キャンセル', pt: 'Cancelar', de: 'Abbrechen', ko: '취소' },
  cancelled: { en: 'Profile unchanged.', he: 'הפרופיל לא השתנה.', es: 'Perfil sin cambios.', fr: 'Profil inchangé.', ru: 'Профиль не изменён.', zh: '配置未更改。', ja: 'プロファイルは変更されていません。', pt: 'Perfil não alterado.', de: 'Profil unverändert.', ko: '프로필이 바뀌지 않았습니다.' },
  applied: { en: 'Profile {name} applied: {count} features on, {off} off.', he: 'הפרופיל {name} הוחל: {count} שכלולים פעילים, {off} כבויים.', es: 'Perfil {name} aplicado: {count} funciones activas, {off} desactivadas.', fr: 'Profil {name} appliqué : {count} fonctions actives, {off} désactivées.', ru: 'Профиль {name} применён: включено {count}, выключено {off}.', zh: '已应用配置 {name}：开启 {count} 项功能，关闭 {off} 项。', ja: 'プロファイル {name} を適用しました：{count} 機能オン、{off} 機能オフ。', pt: 'Perfil {name} aplicado: {count} recursos ativos, {off} desativados.', de: 'Profil {name} angewendet: {count} Funktionen an, {off} aus.', ko: '프로필 {name} 적용됨: 기능 {count}개 켜짐, {off}개 꺼짐.' },
  keptHand: { en: '{n} of your own changes were kept on top.', he: '{n} מהשינויים שלך נשמרו מעל.', es: 'Se conservaron {n} de tus cambios encima.', fr: '{n} de tes changements ont été conservés par-dessus.', ru: 'Сохранено ваших изменений поверх: {n}.', zh: '你自己做的 {n} 项更改已保留。', ja: 'あなた自身の変更 {n} 件は維持されました。', pt: '{n} das suas próprias alterações foram mantidas por cima.', de: '{n} deiner eigenen Änderungen wurden beibehalten.', ko: '직접 바꾼 {n}개는 그대로 유지되었습니다.' },
  // the pane
  statusNone: { en: 'none applied', he: 'לא הוחל', es: 'ninguno aplicado', fr: 'aucun appliqué', ru: 'не выбран', zh: '未应用', ja: '未適用', pt: 'nenhum aplicado', de: 'keins angewendet', ko: '적용 안 됨' },
  currentMark: { en: '✓ current', he: '✓ נוכחי', es: '✓ actual', fr: '✓ actuel', ru: '✓ текущий', zh: '✓ 当前', ja: '✓ 現在', pt: '✓ atual', de: '✓ aktuell', ko: '✓ 현재' },
  featuresOn: { en: '{n} features on', he: '{n} שכלולים פעילים', es: '{n} funciones activas', fr: '{n} fonctions actives', ru: 'включено функций: {n}', zh: '已开启 {n} 个功能', ja: '{n} 機能オン', pt: '{n} recursos ativos', de: '{n} Funktionen an', ko: '기능 {n}개 켜짐' },
  select: { en: 'Select', he: 'בחר', es: 'Elegir', fr: 'Choisir', ru: 'Выбрать', zh: '选择', ja: '選択', pt: 'Selecionar', de: 'Auswählen', ko: '선택' },
  overridesTitle: { en: 'Your changes on top', he: 'השינויים שלך מעל', es: 'Tus cambios encima', fr: 'Tes changements par-dessus', ru: 'Ваши изменения поверх', zh: '你额外的更改', ja: '追加であなたが変更した項目', pt: 'Suas alterações por cima', de: 'Deine Änderungen obendrauf', ko: '추가로 바꾼 항목' },
  overrideOn: { en: 'on', he: 'פעיל', es: 'activa', fr: 'activée', ru: 'вкл', zh: '开', ja: 'オン', pt: 'on', de: 'an', ko: '켬' },
  overrideOff: { en: 'off', he: 'כבוי', es: 'desactivada', fr: 'désactivée', ru: 'выкл', zh: '关', ja: 'オフ', pt: 'off', de: 'aus', ko: '끔' },
  emptyOverrides: { en: 'No changes by hand since a profile was applied.', he: 'אין שינויים ידניים מאז שהוחל פרופיל.', es: 'Sin cambios a mano desde que se aplicó un perfil.', fr: 'Aucun changement à la main depuis l’application d’un profil.', ru: 'С момента выбора профиля ручных изменений нет.', zh: '应用配置后没有手动更改。', ja: 'プロファイル適用後の手動変更はありません。', pt: 'Nenhuma alteração manual desde que um perfil foi aplicado.', de: 'Seit dem Anwenden eines Profils keine Änderungen von Hand.', ko: '프로필을 적용한 뒤 수동으로 바꾼 것이 없습니다.' },
  emptyOverridesHint: { en: 'Toggle a feature in /toolkitty and it shows up here; applying a profile again keeps it.', he: 'שנה שכלול ב-/toolkitty והוא יופיע כאן; החלה חוזרת של פרופיל שומרת אותו.', es: 'Cambia una función en /toolkitty y aparece aquí; aplicar un perfil de nuevo la conserva.', fr: 'Modifie une fonction dans /toolkitty et elle apparaît ici ; réappliquer un profil la conserve.', ru: 'Переключите функцию в /toolkitty, и она появится здесь; повторное применение профиля её сохраняет.', zh: '在 /toolkitty 中切换某个功能后会显示在这里；再次应用配置时会保留它。', ja: '/toolkitty で機能を切り替えるとここに表示されます。プロファイルを再適用しても維持されます。', pt: 'Altere um recurso em /toolkitty e ele aparece aqui; aplicar um perfil de novo o mantém.', de: 'Schalte eine Funktion in /toolkitty um, dann erscheint sie hier; erneutes Anwenden eines Profils behält sie bei.', ko: '/toolkitty에서 기능을 바꾸면 여기에 나타나며, 프로필을 다시 적용해도 유지됩니다.' },
  reset: { en: 'Reset changes', he: 'אפס שינויים', es: 'Restablecer cambios', fr: 'Réinitialiser les changements', ru: 'Сбросить изменения', zh: '重置更改', ja: '変更をリセット', pt: 'Redefinir alterações', de: 'Änderungen zurücksetzen', ko: '변경 초기화' },
  footnote: { en: 'Safety guards are never turned off by a profile.', he: 'פרופיל אף פעם לא מכבה את שומרי הבטיחות.', es: 'Un perfil nunca desactiva las protecciones.', fr: 'Un profil ne désactive jamais les garde-fous.', ru: 'Профиль никогда не выключает защиту.', zh: '安全防护绝不会被配置关闭。', ja: '安全ガードがプロファイルによってオフになることはありません。', pt: 'As proteções de segurança nunca são desativadas por um perfil.', de: 'Sicherheitswächter werden von einem Profil nie ausgeschaltet.', ko: '안전 가드는 프로필로 꺼지지 않습니다.' },
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

export const PROFILE_NAMES = ['minimal', 'productive', 'playful'] as const
export type ProfileName = (typeof PROFILE_NAMES)[number]
export const isProfileName = (value: unknown): value is ProfileName => typeof value === 'string' && (PROFILE_NAMES as readonly string[]).includes(value)

/** The names and one-line descriptions, shared with the welcome wizard. */
export const PROFILE_TITLES: Readonly<Record<ProfileName, Localized>> = { minimal: T.minimal, productive: T.productive, playful: T.playful }
export const PROFILE_DESCS: Readonly<Record<ProfileName, Localized>> = { minimal: T.minimalDesc, productive: T.productiveDesc, playful: T.playfulDesc }

/** Guards are never turned off by a profile; applying one switches them on (unless they default to off and are off). */
export const GUARDS: readonly string[] = ['dangerous-commands', 'protect-secrets', 'secret-mask', 'pasted-secret-scan', 'budget-guard', 'incidents', 'injection-tripwire', 'blast-radius']
/** The wizard, the profile switcher and the team-config loader stay on in every profile. */
export const KEEP: readonly string[] = ['onboarding', 'project-config', 'profiles']
/** Minimal: guards, the advisor (the headline), the band's own numbers and the notices. */
export const MINIMAL_SET: readonly string[] = [...GUARDS, 'advisor', 'task-pulse', 'cost-meter', 'budget-guard', 'savings', 'incidents', 'notices']
/** Productive: Minimal plus the working tools. */
export const PRODUCTIVE_SET: readonly string[] = [
  ...MINIMAL_SET,
  'plan-pace',
  'cache-countdown',
  'dup-read-detector',
  'output-archive',
  'error-counter',
  'loop-detective',
  'claim-check',
  'live-ticker',
  'waiting-alert',
  'diff-review',
  'session-finder',
  'monday-report',
  'correction-capture',
  'agent-profiler',
  'uncommitted-reminder',
  'git-context',
  'done-notify',
]

/**
 * The enabled map a profile stands for, over `catalog`. Playful is every default-on feature;
 * Minimal and Productive are exactly their set (a listed feature is on even if it defaults off,
 * e.g. claim-check). Guards are on, and so are the KEEP features. `current` only matters for a
 * guard that defaults off.
 */
export function buildProfileMap(profile: ProfileName, catalog: readonly Feature[], current: Readonly<Record<string, boolean>>): Record<string, boolean> {
  const set = profile === 'minimal' ? MINIMAL_SET : PRODUCTIVE_SET
  const map: Record<string, boolean> = {}
  for (const f of catalog) {
    let isActive: boolean
    if (GUARDS.includes(f.id)) isActive = f.defaultOn ? true : (current[f.id] ?? false)
    else if (KEEP.includes(f.id)) isActive = true
    else if (profile === 'playful') isActive = f.defaultOn
    else isActive = set.includes(f.id)
    map[f.id] = isActive
  }
  return map
}

/** What the three files share: which profile is applied and the map it set (before the person's own changes). */
export type ProfileState = { profile: ProfileName | null; applied: Record<string, boolean> }

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'profiles' } as const, { profile: null, applied: {} } as ProfileState) as unknown as Atom<ProfileState>
const enabled = atom({ plugin: 'toolkitty', key: 'enabled' } as const, {} as Record<string, boolean>) as unknown as Atom<Record<string, boolean>>

export const feature: Feature = { id: 'profiles', title: T.title, description: T.description, defaultOn: true }

const PANE = 'profiles'
const MAX_LISTED = 10

/** The overrides last written to the store (as JSON), so a sync writes only on change. */
let lastSynced = ''

type Plan = { result: Record<string, boolean>; pure: Record<string, boolean>; kept: Record<string, boolean>; off: Feature[]; count: number }

const isBoolMap = (value: unknown): value is Record<string, boolean> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(v => typeof v === 'boolean')

const titleOf = (id: string): string => {
  const f = features.find(x => x.id === id)
  return f === undefined ? id : t(f.title)
}

/** Whether a feature is on in `map`, with its default for what the map does not mention. */
const isActiveIn = (map: Readonly<Record<string, boolean>>, f: Feature): boolean => map[f.id] ?? f.defaultOn

/** The features whose state differs from what the applied profile set: what the person changed by hand. */
async function computeOverrides($: EngineInterface): Promise<Record<string, boolean>> {
  const s = await read($, state)
  const map = await read($, enabled)
  const out: Record<string, boolean> = {}
  for (const f of features) {
    const base = s.applied[f.id]
    if (base === undefined) continue
    const now = isActiveIn(map, f)
    if (now !== base) out[f.id] = now
  }
  return out
}

/** Writes the overrides to the store (`profiles:overrides`) when they changed. */
async function syncOverrides($: EngineInterface): Promise<Record<string, boolean>> {
  const overrides = await computeOverrides($)
  const text = JSON.stringify(overrides)
  if (text !== lastSynced) {
    lastSynced = text
    await storeSet($, 'profiles:overrides', overrides)
  }
  return overrides
}

/** Loads the applied profile and its map from the store into the shared state. */
async function hydrate($: EngineInterface): Promise<void> {
  const name = await $.store.get('profile')
  if (!isProfileName(name)) return
  const stored = await $.store.get('profiles:applied')
  let applied: Record<string, boolean> = {}
  if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
    const map = (stored as Record<string, unknown>)['map']
    if (isBoolMap(map)) applied = map
  }
  await update($, state, () => ({ profile: name, applied }))
}

/** What applying `profile` would do now: the map, the overrides kept on top, and what goes off. */
async function planProfile($: EngineInterface, profile: ProfileName): Promise<Plan> {
  const overrides = await computeOverrides($)
  const current = await read($, enabled)
  const pure = buildProfileMap(profile, features, current)
  const map = { ...pure }
  const kept: Record<string, boolean> = {}
  for (const [id, value] of Object.entries(overrides)) {
    if (pure[id] !== undefined && pure[id] !== value) {
      map[id] = value
      kept[id] = value
    }
  }
  const off = features.filter(f => isActiveIn(current, f) && map[f.id] === false)
  const count = features.filter(f => map[f.id] === true).length
  return { result: { ...current, ...map }, pure, kept, off, count }
}

async function applyPlan($: EngineInterface, profile: ProfileName, plan: Plan): Promise<string> {
  const before = await $.store.get('profile')
  await $.store.set('profile', profile)
  await $.store.set('profiles:applied', { profile, map: plan.pure })
  lastSynced = JSON.stringify(plan.kept)
  await $.store.set('profiles:overrides', plan.kept)
  await update($, state, () => ({ profile, applied: plan.pure }))
  // Minimal also quiets the notices; leaving Minimal gives them back.
  if (profile === 'minimal') await setNoticePrefs($, { quiet: true })
  else if (before === 'minimal') await setNoticePrefs($, { quiet: false })
  await update($, enabled, () => plan.result)
  await storeSet($, 'enabled', plan.result)
  const kept = Object.keys(plan.kept).length
  const off = features.length - plan.count
  let text = t(T.applied, { name: t(PROFILE_TITLES[profile]), count: plan.count, off })
  if (kept > 0) text += ' ' + t(T.keptHand, { n: kept })
  await notice($, 'info', text, feature.id)
  return text
}

/** Shows what will be turned off and applies after "Apply"; with nothing to turn off it applies at once. */
async function requestProfile($: EngineInterface, profile: ProfileName): Promise<string> {
  const plan = await planProfile($, profile)
  if (plan.off.length > 0) {
    const names = plan.off.slice(0, MAX_LISTED).map(f => t(f.title))
    const list = names.join(', ') + (plan.off.length > MAX_LISTED ? ' ' + t(T.more, { n: plan.off.length - MAX_LISTED }) : '')
    let answer = ''
    try {
      answer = await $.ui.ask(t(T.askQuestion, { name: t(PROFILE_TITLES[profile]), n: plan.off.length, list }), { header: t(T.askHeader), options: [t(T.apply), t(T.cancel)] })
    } catch {
      answer = ''
    }
    if (answer !== t(T.apply)) return t(T.cancelled)
  }
  return applyPlan($, profile, plan)
}

async function select($: EngineInterface, profile: ProfileName): Promise<void> {
  await requestProfile($, profile)
}

/** Puts every hand-changed feature back to what the applied profile set. */
async function resetOverrides($: EngineInterface): Promise<void> {
  const overrides = await computeOverrides($)
  const s = await read($, state)
  const current = await read($, enabled)
  const restored = { ...current }
  for (const id of Object.keys(overrides)) {
    const base = s.applied[id]
    if (base !== undefined) restored[id] = base
  }
  lastSynced = '{}'
  await $.store.set('profiles:overrides', {})
  await update($, enabled, () => restored)
  await storeSet($, 'enabled', restored)
}

async function summary($: EngineInterface): Promise<string> {
  const s = await read($, state)
  const map = await read($, enabled)
  const count = features.filter(f => isActiveIn(map, f)).length
  const lines: string[] = []
  lines.push(s.profile === null ? t(T.currentNone, { count }) : t(T.current, { name: t(PROFILE_TITLES[s.profile]), count }))
  const overrides = Object.keys(await computeOverrides($))
  if (overrides.length > 0) lines.push(t(T.byHand, { n: overrides.length, list: overrides.map(id => titleOf(id)).join(', ') }))
  for (const p of PROFILE_NAMES) {
    const n = Object.values(buildProfileMap(p, features, map)).filter(Boolean).length
    lines.push(t(T.choiceLine, { id: p, name: t(PROFILE_TITLES[p]), desc: t(PROFILE_DESCS[p]), n }))
  }
  lines.push(t(T.howTo))
  return lines.join('\n')
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'profiles', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'profiles', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  await hydrate($)
  await syncOverrides($)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (!(await isOn($, feature))) return
  await syncOverrides($)
}

export function register(on: On) {
  on('command.run', { command: 'profiles' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    const arg = e.args.trim()
    if (arg === '') return { text: await summary($) }
    const name = arg.toLowerCase()
    if (name === 'pane') {
      await $.ui.open({ id: PANE, title: t(T.paneTitle), focus: true, closeOnEscape: true })
      return { text: t(T.paneOpened) }
    }
    if (!isProfileName(name)) return { text: t(T.unknown, { name: arg }) }
    return { text: await requestProfile($, name) }
  })

  on('ui.render', { component: 'Pane', requestId: 'profiles' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.off)}</Text>

    const s = await read($, state)
    const map = await read($, enabled)
    const flags = await computeOverrides($)
    const overrides = Object.keys(flags)

    const actions: HeaderAction[] = overrides.length > 0 ? [{ key: 'reset', label: t(T.reset), onPress: () => resetOverrides($) }] : []
    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: s.profile === null ? t(T.statusNone) : t(PROFILE_TITLES[s.profile]),
          level: s.profile === null ? 'ok' : 'info',
          icon: ICONS.setup,
          actions,
        })}
        {PROFILE_NAMES.map(p => {
          const n = Object.values(buildProfileMap(p, features, map)).filter(Boolean).length
          return (
            <Box key={`card-${p}`} flexDirection="column">
              <Box gap={1}>
                <Text bold>{t(PROFILE_TITLES[p])}</Text>
                {s.profile === p ? <Text color="claude">{t(T.currentMark)}</Text> : null}
              </Box>
              <Text dimColor size="footnote">{t(PROFILE_DESCS[p])}</Text>
              <Text>{t(T.featuresOn, { n })}</Text>
              <Button key={`select-${p}`} plain label={t(T.select)} onPress={() => select($, p)} />
            </Box>
          )
        })}
        <Box flexDirection="column">
          {sectionTitle($, e, t(T.overridesTitle))}
          {overrides.length === 0
            ? emptyState($, e, T.emptyOverrides, T.emptyOverridesHint)
            : overrides.map(id => listRow($, e, { key: `override-${id}`, text: titleOf(id), right: flags[id] === true ? t(T.overrideOn) : t(T.overrideOff), level: 'info' }))}
        </Box>
        <Text dimColor size="footnote">{t(T.footnote)}</Text>
      </Box>
    )
  })
}
