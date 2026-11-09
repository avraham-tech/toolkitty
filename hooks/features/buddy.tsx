import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderSurface, Timer } from 'claude-code'

import { isOn, notice, storeGet, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { exportBar, shareExport } from '../exports'
import { ICONS, paneHeader } from '../ui'
import type { Chip, Level } from '../ui'
import { allEvidence } from '../evidence'
import type { Evidence } from '../evidence'
import { current, ofKind } from '../signals'
import type { Signal } from '../signals'
import type { Incidents } from '../shared'
import { BUILTIN_THEMES } from '../themes'
import type { Theme } from '../themes'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Buddy', he: 'חבר', es: 'Compañero', fr: 'Compagnon', ru: 'Питомец', zh: '伙伴', ja: 'バディ', pt: 'Parceiro', de: 'Buddy', ko: '버디' },
  description: {
    en: 'A companion pet that reacts to your session: sleeps when idle, works with you, celebrates green builds, worries about errors.',
    he: 'חיית מחמד שמגיבה לסשן שלך: ישנה כשרגוע, עובדת איתך, חוגגת בנייה מוצלחת ומודאגת משגיאות.',
    es: 'Una mascota que reacciona a tu sesión: duerme cuando no hay actividad, trabaja contigo, celebra las compilaciones verdes y se preocupa por los errores.',
    fr: 'Un compagnon qui réagit à ta session : il dort quand tout est calme, travaille avec toi, fête les builds réussis et s’inquiète des erreurs.',
    ru: 'Питомец, который реагирует на сессию: спит, когда ничего не происходит, работает вместе с вами, радуется успешным сборкам и тревожится из-за ошибок.',
    zh: '一只会对你的会话做出反应的伴侣宠物：空闲时睡觉，和你一起工作，构建通过时庆祝，出错时担心。',
    ja: 'セッションに反応する相棒ペット：待機中は眠り、一緒に作業し、ビルドが通れば祝い、エラーが出れば心配します。',
    pt: 'Um bichinho de companhia que reage à sua sessão: dorme quando está ocioso, trabalha com você, comemora builds verdes e se preocupa com erros.',
    de: 'Ein Begleiter-Haustier, das auf deine Session reagiert: schläft im Leerlauf, arbeitet mit dir, feiert grüne Builds, sorgt sich um Fehler.',
    ko: '세션에 반응하는 반려 펫입니다. 유휴 시 잠을 자고, 함께 일하고, 빌드가 통과하면 축하하고, 오류에는 걱정합니다.',
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
    de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty',
    ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  cmdDesc: {
    en: 'Shows your companion; "/buddy name <name>" renames it',
    he: 'מציג את החבר שלך; "/buddy name <שם>" משנה את שמו',
    es: 'Muestra a tu compañero; "/buddy name <nombre>" le cambia el nombre',
    fr: 'Affiche ton compagnon ; « /buddy name <nom> » le renomme',
    ru: 'Показывает питомца; «/buddy name <имя>» переименовывает его',
    zh: '显示你的伙伴；“/buddy name <name>”可重命名',
    ja: '相棒を表示します。「/buddy name <name>」で名前を変更できます',
    pt: 'Mostra seu parceiro; "/buddy name <name>" o renomeia',
    de: 'Zeigt deinen Begleiter; „/buddy name <name>“ benennt ihn um',
    ko: '내 버디를 보여 줍니다. "/buddy name <name>"으로 이름을 바꿉니다',
  },
  argHint: { en: 'name <name>', he: 'name <שם>', es: 'name <nombre>', fr: 'name <nom>', ru: 'name <имя>', zh: 'name <name>', ja: 'name <name>', pt: 'name <name>', de: 'name <name>', ko: 'name <name>' },
  paneTitle: { en: 'Buddy', he: 'חבר', es: 'Compañero', fr: 'Compagnon', ru: 'Питомец', zh: '伙伴', ja: 'バディ', pt: 'Parceiro', de: 'Buddy', ko: '버디' },
  opened: { en: 'Your buddy is here.', he: 'החבר שלך כאן.', es: 'Tu compañero está aquí.', fr: 'Ton compagnon est là.', ru: 'Ваш питомец здесь.', zh: '你的伙伴在这里。', ja: 'あなたの相棒がここにいます。', pt: 'Seu parceiro está aqui.', de: 'Dein Buddy ist da.', ko: '버디가 여기 있습니다.' },
  usageName: {
    en: 'Usage: /buddy name <name>',
    he: 'שימוש: /buddy name <שם>',
    es: 'Uso: /buddy name <nombre>',
    fr: 'Utilisation : /buddy name <nom>',
    ru: 'Использование: /buddy name <имя>',
    zh: '用法：/buddy name <name>',
    ja: '使い方：/buddy name <name>',
    pt: 'Uso: /buddy name <name>',
    de: 'Verwendung: /buddy name <name>',
    ko: '사용법: /buddy name <name>',
  },
  renamed: {
    en: 'Your buddy is now called {name}.',
    he: 'החבר שלך נקרא עכשיו {name}.',
    es: 'Tu compañero ahora se llama {name}.',
    fr: 'Ton compagnon s’appelle maintenant {name}.',
    ru: 'Теперь питомца зовут {name}.',
    zh: '你的伙伴现在叫 {name}。',
    ja: '相棒の名前は {name} になりました。',
    pt: 'Seu parceiro agora se chama {name}.',
    de: 'Dein Buddy heißt jetzt {name}.',
    ko: '버디의 이름이 이제 {name}입니다.',
  },
  defaultName: { en: 'Buddy', he: 'חבר', es: 'Amigo', fr: 'Copain', ru: 'Дружок', zh: '伙伴', ja: 'バディ', pt: 'Parceiro', de: 'Buddy', ko: '버디' },
  shiny: { en: '✦ shiny', he: '✦ נוצץ', es: '✦ brillante', fr: '✦ chromatique', ru: '✦ шайни', zh: '✦ 闪光', ja: '✦ 色違い', pt: '✦ brilhante', de: '✦ schillernd', ko: '✦ 반짝' },
  alt: {
    en: '{name}, a {rarity} {species}, feeling {mood}',
    he: '{name}, {species} ({rarity}), במצב: {mood}',
    es: '{name}, {species} ({rarity}), estado: {mood}',
    fr: '{name}, {species} ({rarity}), humeur : {mood}',
    ru: '{name}, {species} ({rarity}), настроение: {mood}',
    zh: '{name}，{rarity}{species}，心情：{mood}',
    ja: '{name}（{rarity}の{species}）、気分：{mood}',
    pt: '{name}, {species} ({rarity}), humor: {mood}',
    de: '{name}, {species} ({rarity}), Stimmung: {mood}',
    ko: '{name}, {rarity} {species}, 상태: {mood}',
  },
  // species
  cat: { en: 'Cat', he: 'חתול', es: 'Gato', fr: 'Chat', ru: 'Кот', zh: '猫', ja: 'ネコ', pt: 'Gato', de: 'Katze', ko: '고양이' },
  fox: { en: 'Fox', he: 'שועל', es: 'Zorro', fr: 'Renard', ru: 'Лиса', zh: '狐狸', ja: 'キツネ', pt: 'Raposa', de: 'Fuchs', ko: '여우' },
  owl: { en: 'Owl', he: 'ינשוף', es: 'Búho', fr: 'Hibou', ru: 'Сова', zh: '猫头鹰', ja: 'フクロウ', pt: 'Coruja', de: 'Eule', ko: '올빼미' },
  octopus: { en: 'Octopus', he: 'תמנון', es: 'Pulpo', fr: 'Pieuvre', ru: 'Осьминог', zh: '章鱼', ja: 'タコ', pt: 'Polvo', de: 'Oktopus', ko: '문어' },
  dragon: { en: 'Dragon', he: 'דרקון', es: 'Dragón', fr: 'Dragon', ru: 'Дракон', zh: '龙', ja: 'ドラゴン', pt: 'Dragão', de: 'Drache', ko: '드래곤' },
  axolotl: { en: 'Axolotl', he: 'אקסולוטל', es: 'Ajolote', fr: 'Axolotl', ru: 'Аксолотль', zh: '美西螈', ja: 'ウーパールーパー', pt: 'Axolote', de: 'Axolotl', ko: '우파루파' },
  penguin: { en: 'Penguin', he: 'פינגווין', es: 'Pingüino', fr: 'Pingouin', ru: 'Пингвин', zh: '企鹅', ja: 'ペンギン', pt: 'Pinguim', de: 'Pinguin', ko: '펭귄' },
  capybara: { en: 'Capybara', he: 'קפיברה', es: 'Capibara', fr: 'Capybara', ru: 'Капибара', zh: '水豚', ja: 'カピバラ', pt: 'Capivara', de: 'Capybara', ko: '카피바라' },
  raccoon: { en: 'Raccoon', he: 'דביבון', es: 'Mapache', fr: 'Raton laveur', ru: 'Енот', zh: '浣熊', ja: 'アライグマ', pt: 'Guaxinim', de: 'Waschbär', ko: '라쿤' },
  robot: { en: 'Robot', he: 'רובוט', es: 'Robot', fr: 'Robot', ru: 'Робот', zh: '机器人', ja: 'ロボット', pt: 'Robô', de: 'Roboter', ko: '로봇' },
  ghost: { en: 'Ghost', he: 'רוח רפאים', es: 'Fantasma', fr: 'Fantôme', ru: 'Привидение', zh: '幽灵', ja: 'ゴースト', pt: 'Fantasma', de: 'Geist', ko: '유령' },
  slime: { en: 'Slime', he: 'סליים', es: 'Slime', fr: 'Slime', ru: 'Слайм', zh: '史莱姆', ja: 'スライム', pt: 'Slime', de: 'Schleim', ko: '슬라임' },
  // rarity
  common: { en: 'Common', he: 'נפוץ', es: 'Común', fr: 'Commun', ru: 'Обычный', zh: '普通', ja: 'コモン', pt: 'Comum', de: 'Gewöhnlich', ko: '일반' },
  uncommon: { en: 'Uncommon', he: 'לא נפוץ', es: 'Poco común', fr: 'Peu commun', ru: 'Необычный', zh: '罕见', ja: 'アンコモン', pt: 'Incomum', de: 'Ungewöhnlich', ko: '고급' },
  rare: { en: 'Rare', he: 'נדיר', es: 'Raro', fr: 'Rare', ru: 'Редкий', zh: '稀有', ja: 'レア', pt: 'Raro', de: 'Selten', ko: '희귀' },
  epic: { en: 'Epic', he: 'אפי', es: 'Épico', fr: 'Épique', ru: 'Эпический', zh: '史诗', ja: 'エピック', pt: 'Épico', de: 'Episch', ko: '영웅' },
  legendary: { en: 'Legendary', he: 'אגדי', es: 'Legendario', fr: 'Légendaire', ru: 'Легендарный', zh: '传说', ja: 'レジェンダリー', pt: 'Lendário', de: 'Legendär', ko: '전설' },
  // moods
  idle: { en: 'idle', he: 'רגוע', es: 'tranquilo', fr: 'tranquille', ru: 'отдыхает', zh: '空闲', ja: 'のんびり', pt: 'ocioso', de: 'entspannt', ko: '한가함' },
  working: { en: 'working', he: 'עובד', es: 'trabajando', fr: 'au travail', ru: 'работает', zh: '工作中', ja: '作業中', pt: 'trabalhando', de: 'bei der Arbeit', ko: '일하는 중' },
  celebrating: { en: 'celebrating', he: 'חוגג', es: 'celebrando', fr: 'en fête', ru: 'празднует', zh: '庆祝中', ja: 'お祝い中', pt: 'comemorando', de: 'feiernd', ko: '축하 중' },
  worried: { en: 'worried', he: 'מודאג', es: 'preocupado', fr: 'inquiet', ru: 'тревожится', zh: '担心', ja: '心配', pt: 'preocupado', de: 'besorgt', ko: '걱정됨' },
  sleeping: { en: 'sleeping', he: 'ישן', es: 'durmiendo', fr: 'endormi', ru: 'спит', zh: '睡觉中', ja: '睡眠中', pt: 'dormindo', de: 'schlafend', ko: '자는 중' },
  guarding: { en: 'on guard', he: 'על המשמר', es: 'en guardia', fr: 'en garde', ru: 'на страже', zh: '警戒中', ja: '警戒中', pt: 'de guarda', de: 'auf der Hut', ko: '경계 중' },
  chasing: { en: 'chasing its tail', he: 'רודף אחרי הזנב', es: 'persiguiendo su cola', fr: 'court après sa queue', ru: 'гоняется за хвостом', zh: '追着尾巴转', ja: 'しっぽ追いかけ中', pt: 'correndo atrás do rabo', de: 'jagt den eigenen Schwanz', ko: '꼬리 쫓는 중' },
  // evolution
  stage1: { en: 'hatchling', he: 'גוזל', es: 'cría', fr: 'bébé', ru: 'птенец', zh: '幼崽', ja: 'ひな', pt: 'filhote', de: 'Schlüpfling', ko: '아기' },
  stage2: { en: 'companion', he: 'מלווה', es: 'compañero', fr: 'compagnon', ru: 'спутник', zh: '伙伴', ja: '相棒', pt: 'companheiro', de: 'Gefährte', ko: '동료' },
  stage3: { en: 'veteran', he: 'ותיק', es: 'veterano', fr: 'vétéran', ru: 'ветеран', zh: '老手', ja: 'ベテラン', pt: 'veterano', de: 'Veteran', ko: '베테랑' },
  hoursShort: { en: '{n}h', he: '{n} ש׳', es: '{n} h', fr: '{n} h', ru: '{n} ч', zh: '{n}h', ja: '{n}h', pt: '{n}h', de: '{n}h', ko: '{n}h' },
  xpLine: { en: 'XP {xp} · stage {stage}', he: 'XP {xp} · שלב {stage}', es: 'XP {xp} · etapa {stage}', fr: 'XP {xp} · stade {stage}', ru: 'XP {xp} · этап {stage}', zh: 'XP {xp} · 阶段 {stage}', ja: 'XP {xp} · ステージ {stage}', pt: 'XP {xp} · estágio {stage}', de: 'XP {xp} · Stufe {stage}', ko: 'XP {xp} · 단계 {stage}' },
  xpDetail: {
    en: '+10 per passed test run, +15 per incident prevented, +5 per 10k tokens saved, +20 per achievement, +1 per hour',
    he: '+10 לכל הרצת בדיקות שעברה, +15 לכל אירוע שנמנע, +5 לכל 10k טוקנים שנחסכו, +20 לכל הישג, +1 לכל שעה',
    es: '+10 por ejecución de pruebas superada, +15 por incidente evitado, +5 por cada 10k tokens ahorrados, +20 por logro, +1 por hora',
    fr: '+10 par exécution de tests réussie, +15 par incident évité, +5 par 10k tokens économisés, +20 par succès, +1 par heure',
    ru: '+10 за успешный прогон тестов, +15 за предотвращённый инцидент, +5 за каждые 10k сэкономленных токенов, +20 за достижение, +1 за час',
    zh: '每次测试运行通过 +10，每次避免事故 +15，每节省 1 万 token +5，每个成就 +20，每小时 +1',
    ja: 'テスト実行の成功ごとに +10、防いだインシデントごとに +15、1万トークン節約ごとに +5、実績ごとに +20、1時間ごとに +1',
    pt: '+10 por execução de testes aprovada, +15 por incidente evitado, +5 por 10 mil tokens economizados, +20 por conquista, +1 por hora',
    de: '+10 pro bestandenem Testlauf, +15 pro verhindertem Vorfall, +5 pro 10k gesparter Tokens, +20 pro Erfolg, +1 pro Stunde',
    ko: '테스트 통과마다 +10, 사고 방지마다 +15, 1만 토큰 절약마다 +5, 업적마다 +20, 1시간마다 +1',
  },
  stageLine: { en: '{stage} · {hours}', he: '{stage} · {hours}', es: '{stage} · {hours}', fr: '{stage} · {hours}', ru: '{stage} · {hours}', zh: '{stage} · {hours}', ja: '{stage} · {hours}', pt: '{stage} · {hours}', de: '{stage} · {hours}', ko: '{stage} · {hours}' },
  streakCharm: { en: '⚡ streak', he: '⚡ רצף', es: '⚡ racha', fr: '⚡ série', ru: '⚡ серия', zh: '⚡ 连续', ja: '⚡ 連続', pt: '⚡ sequência', de: '⚡ Serie', ko: '⚡ 연속' },
  evolved: {
    en: '{name} grew into a {stage}!',
    he: '{name} עכשיו {stage}!',
    es: '¡{name} ha evolucionado a {stage}!',
    fr: '{name} a évolué : {stage} !',
    ru: '{name} теперь {stage}!',
    zh: '{name} 长成{stage}了！',
    ja: '{name} が {stage} に成長しました！',
    pt: '{name} evoluiu para: {stage}!',
    de: '{name} ist aufgestiegen: {stage}!',
    ko: '{name}이(가) {stage}(으)로 성장했습니다!',
  },
  // sharing
  share: { en: 'share', he: 'שתף', es: 'compartir', fr: 'partager', ru: 'поделиться', zh: '分享', ja: '共有', pt: 'compartilhar', de: 'teilen', ko: '공유' },
  shareText: {
    en: 'My Claude Code buddy is a {rarity} {species} ({pct}%). Get yours: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    he: 'החבר שלי ב-Claude Code: {species} ({rarity}, {pct}%). קבלו גם אתם: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    es: 'Mi compañero de Claude Code: {species} ({rarity}, {pct}%). Consigue el tuyo: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    fr: 'Mon compagnon Claude Code : {species} ({rarity}, {pct} %). Prends le tien : claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ru: 'Мой питомец в Claude Code: {species} ({rarity}, {pct}%). Получите своего: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    zh: '我的 Claude Code 伙伴是一只{rarity}{species}（{pct}%）。你也来领养：claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ja: '私の Claude Code のバディは {rarity} の {species}（{pct}%）です。あなたも：claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    pt: 'Meu parceiro do Claude Code é {species} ({rarity}, {pct}%). Instale o seu: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    de: 'Mein Claude-Code-Buddy: {species} ({rarity}, {pct} %). Hol dir deinen: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ko: '내 Claude Code 버디는 {rarity} {species}입니다({pct}%). 직접 해 보세요: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
  },
  shareTextShiny: {
    en: 'My Claude Code buddy is a shiny {rarity} {species} ({pct}%). Get yours: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    he: 'החבר שלי ב-Claude Code: {species} נוצץ ({rarity}, {pct}%). קבלו גם אתם: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    es: 'Mi compañero de Claude Code: {species} brillante ({rarity}, {pct}%). Consigue el tuyo: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    fr: 'Mon compagnon Claude Code : {species} chromatique ({rarity}, {pct} %). Prends le tien : claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ru: 'Мой питомец в Claude Code: шайни {species} ({rarity}, {pct}%). Получите своего: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    zh: '我的 Claude Code 伙伴是一只闪光的{rarity}{species}（{pct}%）。你也来领养：claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ja: '私の Claude Code のバディは色違いの {rarity} の {species}（{pct}%）です。あなたも：claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    pt: 'Meu parceiro do Claude Code é {species} brilhante ({rarity}, {pct}%). Instale o seu: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    de: 'Mein Claude-Code-Buddy: {species}, schillernd ({rarity}, {pct} %). Hol dir deinen: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
    ko: '내 Claude Code 버디는 반짝이는 {rarity} {species}입니다({pct}%). 직접 해 보세요: claude plugin install toolkitty --marketplace avraham-tech/toolkitty',
  },
  // five one-liners per mood, split on |
  idleLines: {
    en: "Just vibing next to your cursor.|Got any snacks? Asking for a friend.|I like it here.|Watching the cursor blink.|Take your time, I'm not going anywhere.",
    he: 'סתם נהנה ליד הסמן שלך.|יש חטיפים? שואל בשביל חבר.|טוב לי כאן.|מסתכל על הסמן מהבהב.|קח את הזמן, אני לא הולך לשום מקום.',
    es: 'Solo disfrutando junto a tu cursor.|¿Tienes algo de picar? Lo pregunto por un amigo.|Me gusta estar aquí.|Viendo parpadear el cursor.|Tómate tu tiempo, no me voy a ningún lado.',
    fr: "Je profite, juste à côté de ton curseur.|Un petit snack ? C'est pour un ami.|Je suis bien ici.|Je regarde le curseur clignoter.|Prends ton temps, je ne bouge pas.",
    ru: 'Просто отдыхаю рядом с курсором.|Есть что-нибудь вкусное? Спрашиваю для друга.|Мне здесь нравится.|Смотрю, как мигает курсор.|Не торопись, я никуда не уйду.',
    zh: '就在你的光标旁边发呆。|有零食吗？我替朋友问的。|我喜欢这里。|看着光标闪烁。|慢慢来，我哪儿也不去。',
    ja: 'カーソルのそばでのんびり中。|おやつある？友だちの代わりに聞いてるだけ。|ここ、気に入ってる。|カーソルが点滅するのを眺めてる。|ゆっくりでいいよ、どこにも行かないから。',
    pt: 'Só curtindo ao lado do seu cursor.|Tem algum petisco? Pergunto por um amigo.|Gosto daqui.|Vendo o cursor piscar.|Sem pressa, não vou a lugar nenhum.',
    de: 'Chille einfach neben deinem Cursor.|Hast du Snacks? Frage für einen Freund.|Mir gefällt es hier.|Schaue dem Cursor beim Blinken zu.|Lass dir Zeit, ich gehe nirgendwohin.',
    ko: '커서 옆에서 느긋하게 있는 중.|간식 있어? 친구 대신 물어보는 거야.|여기가 마음에 들어.|커서가 깜박이는 걸 보는 중.|천천히 해, 난 아무 데도 안 가.',
  },
  workingLines: {
    en: "On it. Typing noises.|Crunching away…|Focus mode: engaged.|Don't mind me, just helping.|Tools are flying!",
    he: 'על זה. רעשי הקלדה.|מעבד בשקיקה…|מצב ריכוז: פעיל.|אל תתייחס אליי, רק עוזר.|הכלים עפים!',
    es: 'En ello. Ruido de teclas.|Dándole duro…|Modo concentración: activado.|No me hagas caso, solo ayudo.|¡Las herramientas vuelan!',
    fr: "J'y suis. Bruits de clavier.|Ça turbine…|Mode concentration : activé.|Ne fais pas attention, j'aide.|Les outils volent !",
    ru: 'Работаю. Слышен стук клавиш.|Усердно тружусь…|Режим концентрации: включён.|Не обращай внимания, я помогаю.|Инструменты так и летают!',
    zh: '在忙呢。键盘噼里啪啦。|埋头苦干中……|专注模式：已开启。|别管我，我只是在帮忙。|工具满天飞！',
    ja: '取りかかってるよ。カタカタ音。|ガリガリ処理中…|集中モード：オン。|気にしないで、手伝ってるだけ。|ツールが飛び交ってる！',
    pt: 'Deixa comigo. Barulho de teclas.|Processando a todo vapor…|Modo foco: ativado.|Nem liga, estou só ajudando.|As ferramentas estão voando!',
    de: 'Bin dran. Tippgeräusche.|Rechne fleißig…|Fokusmodus: an.|Beachte mich nicht, ich helfe nur.|Die Tools fliegen!',
    ko: '지금 하는 중. 타닥타닥.|열심히 처리 중…|집중 모드: 켜짐.|신경 쓰지 마, 돕는 중이야.|도구들이 날아다녀!',
  },
  celebratingLines: {
    en: 'Tests are green! Party time!|We did it!|Build passed. Treat time?|Look at that checkmark!|Ship it!',
    he: 'הבדיקות ירוקות! זמן למסיבה!|הצלחנו!|הבנייה עברה. זמן פינוק?|תראה איזה וי!|משחררים גרסה!',
    es: '¡Pruebas en verde! ¡A celebrar!|¡Lo logramos!|Compilación superada. ¿Premio?|¡Mira ese check!|¡A producción!',
    fr: "Tests au vert ! C'est la fête !|On l'a fait !|Build réussi. Une friandise ?|Regarde cette coche !|On livre !",
    ru: 'Тесты зелёные! Праздник!|Получилось!|Сборка прошла. Угощение?|Смотри, какая галочка!|В релиз!',
    zh: '测试全绿！开派对！|我们做到了！|构建通过了。该奖励一下了吧？|看那个对勾！|发布吧！',
    ja: 'テストがグリーン！パーティーだ！|やったね！|ビルド成功。ごほうびタイム？|このチェックマークを見て！|リリースしよう！',
    pt: 'Testes verdes! Hora da festa!|Conseguimos!|Build passou. Hora do petisco?|Olha esse check!|Manda pra produção!',
    de: 'Tests sind grün! Partyzeit!|Geschafft!|Build bestanden. Zeit für eine Belohnung?|Schau dir dieses Häkchen an!|Raus damit!',
    ko: '테스트가 초록색이야! 파티 타임!|해냈다!|빌드 통과. 간식 시간?|저 체크 표시 좀 봐!|배포하자!',
  },
  worriedLines: {
    en: "Uh oh. That did not look right.|Is that supposed to be red?|I'm sure it's fine. Probably.|Deep breaths. We can fix this.|Sweating a little…",
    he: 'אוי. זה לא נראה בסדר.|זה אמור להיות אדום?|אני בטוח שזה בסדר. כנראה.|נשימות עמוקות. אפשר לתקן.|קצת מזיע…',
    es: 'Uy. Eso no tiene buena pinta.|¿Eso debería estar en rojo?|Seguro que está bien. Quizá.|Respira hondo. Esto se arregla.|Sudando un poco…',
    fr: "Oh oh. Ça n'a pas l'air bon.|C'est censé être rouge ?|Je suis sûr que ça va. Peut-être.|Respire. On peut réparer ça.|Je transpire un peu…",
    ru: 'Ой. Это выглядит неправильно.|Это должно быть красным?|Наверняка всё нормально. Наверное.|Дыши глубже. Починим.|Немного потею…',
    zh: '哎呀。看起来不太对。|这个应该是红色的吗？|我肯定没事的。大概吧。|深呼吸。我们能修好。|有点冒汗……',
    ja: 'あれれ。なんだか変だよ。|これ、赤くていいの？|きっと大丈夫。たぶんね。|深呼吸。直せるよ。|ちょっと冷や汗……',
    pt: 'Ih. Isso não parece certo.|Isso devia estar vermelho?|Tenho certeza de que está tudo bem. Talvez.|Respire fundo. A gente conserta.|Suando um pouquinho…',
    de: 'Oje. Das sah nicht richtig aus.|Soll das rot sein?|Bestimmt ist alles gut. Wahrscheinlich.|Tief durchatmen. Wir kriegen das hin.|Schwitze ein bisschen…',
    ko: '어라. 뭔가 이상한데.|저거 빨간색이어도 되는 거야?|분명 괜찮을 거야. 아마도.|심호흡하자. 고칠 수 있어.|식은땀이 나…',
  },
  sleepingLines: {
    en: 'Zzz… wake me for snacks.|Dreaming of green tests.|Shh, nap time.|Zzz… one more minute…|Snoring softly.',
    he: 'זזז… תעיר אותי בשביל חטיפים.|חולם על בדיקות ירוקות.|שששש, שעת תנומה.|זזז… עוד דקה…|נוחר בשקט.',
    es: 'Zzz… despiértame para picar algo.|Soñando con pruebas en verde.|Shh, hora de la siesta.|Zzz… un minuto más…|Roncando suavemente.',
    fr: "Zzz… réveille-moi pour le goûter.|Je rêve de tests verts.|Chut, c'est l'heure de la sieste.|Zzz… encore une minute…|Je ronfle doucement.",
    ru: 'Zzz… разбуди меня ради вкусняшки.|Вижу сны про зелёные тесты.|Тсс, время сна.|Zzz… ещё минутку…|Тихонько сопит.',
    zh: 'Zzz……想吃零食再叫我。|梦见了绿色的测试。|嘘，午睡时间。|Zzz……再睡一分钟……|轻轻打着呼噜。',
    ja: 'Zzz… おやつの時に起こして。|グリーンのテストの夢を見てる。|しーっ、お昼寝タイム。|Zzz… あと1分だけ…|すやすや寝息。',
    pt: 'Zzz… me acorde para o petisco.|Sonhando com testes verdes.|Shh, hora da soneca.|Zzz… só mais um minuto…|Roncando baixinho.',
    de: 'Zzz… weck mich für Snacks.|Träume von grünen Tests.|Pst, Schlafenszeit.|Zzz… noch eine Minute…|Schnarche leise.',
    ko: 'Zzz… 간식 시간에 깨워 줘.|초록색 테스트 꿈을 꾸는 중.|쉿, 낮잠 시간.|Zzz… 1분만 더…|새근새근 코를 골아.',
  },
  guardingLines: {
    en: 'Not on my watch.|Shield up. Nothing gets past me.|That one stays blocked.|I saw that coming.|Guard duty. Carry on.',
    he: 'לא במשמרת שלי.|מגן מורם. שום דבר לא עובר אותי.|זה נשאר חסום.|ראיתי את זה מגיע.|תורנות שמירה. המשך כרגיל.',
    es: 'No mientras yo vigile.|Escudo arriba. Nada pasa de aquí.|Eso se queda bloqueado.|Lo vi venir.|Turno de guardia. Sigue.',
    fr: "Pas sous ma garde.|Bouclier levé. Rien ne passe.|Celui-là reste bloqué.|Je l’ai vu venir.|De garde. Continue.",
    ru: 'Только не в мою смену.|Щит поднят. Мимо меня ничего не пройдёт.|Это останется заблокированным.|Это было предсказуемо.|На страже. Продолжай.',
    zh: '有我在，别想。|盾牌举起。什么都别想过去。|那个继续拦着。|我早看出来了。|站岗中。你们继续。',
    ja: 'ぼくの番では通さないよ。|シールド展開。何も通さない。|あれはブロックのまま。|来ると思ってた。|見張り中。続けてどうぞ。',
    pt: 'Não no meu turno.|Escudo erguido. Nada passa por mim.|Esse fica bloqueado.|Eu vi essa vindo.|De guarda. Pode continuar.',
    de: 'Nicht mit mir.|Schild hoch. Hier kommt nichts durch.|Das bleibt blockiert.|Hab ich kommen sehen.|Wachdienst. Weitermachen.',
    ko: '내가 지키는 동안은 안 돼.|방패 올림. 아무것도 못 지나가.|그건 계속 막아 둘게.|올 줄 알았어.|경비 근무 중. 하던 거 계속해.',
  },
  chasingLines: {
    en: "Round and round we go…|Haven't we been here before?|Same tail, third lap.|Dizzy yet? I am.|Maybe try a different angle?",
    he: 'סיבוב ועוד סיבוב…|לא היינו כאן כבר?|אותו זנב, הקפה שלישית.|כבר מסוחרר? אני כן.|אולי לנסות מזווית אחרת?',
    es: 'Vueltas y más vueltas…|¿No hemos pasado ya por aquí?|La misma cola, tercera vuelta.|¿Ya te mareas? Yo sí.|¿Probamos otro ángulo?',
    fr: "Et on tourne, on tourne…|On n'est pas déjà passés par là ?|Même queue, troisième tour.|Pas encore le tournis ? Moi si.|Et si on changeait d'angle ?",
    ru: 'Кругом, кругом…|Мы тут уже были?|Тот же хвост, третий круг.|Голова ещё не кружится? У меня да.|Может, зайти с другой стороны?',
    zh: '转啊转啊转……|我们是不是来过这儿？|同一条尾巴，第三圈了。|晕了吗？我晕了。|要不换个角度试试？',
    ja: 'ぐるぐるぐる…|ここ、前にも来なかった？|同じしっぽ、三周目。|目が回ってきた？ぼくは回ってる。|別の角度から試してみる？',
    pt: 'Volta e volta e volta…|A gente já não passou por aqui?|Mesmo rabo, terceira volta.|Já deu tontura? Em mim já.|Que tal tentar por outro ângulo?',
    de: 'Immer im Kreis…|Waren wir hier nicht schon mal?|Derselbe Schwanz, dritte Runde.|Schon schwindelig? Mir schon.|Vielleicht mal anders rangehen?',
    ko: '빙글빙글 돌고 또 돌고…|여기 전에 와 본 적 있지 않아?|같은 꼬리, 세 바퀴째.|어지러워? 난 어지러워.|다른 각도로 해 볼까?',
  },
} as const

type Mood = 'idle' | 'working' | 'celebrating' | 'worried' | 'sleeping' | 'guarding' | 'chasing'
type Species = 'cat' | 'fox' | 'owl' | 'octopus' | 'dragon' | 'axolotl' | 'penguin' | 'capybara' | 'raccoon' | 'robot' | 'ghost' | 'slime'
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
type State = { seed: number; name: string; mood: Mood; line: number; ms: number; streak: boolean; xp: number }
type Stage = 1 | 2 | 3

const buddy = atom({ plugin: 'toolkitty', key: 'slot', id: 'buddy' } as const, { seed: 0, name: '', mood: 'idle', line: 0, ms: 0, streak: false, xp: 0 } as State) as unknown as Atom<State>

// The shared incidents slot, the same ref as in incidents.tsx: the live count of what the guards stopped.
const incidents = atom({ plugin: 'toolkitty', key: 'slot', id: 'incidents' } as const, { count: 0, items: [], lastAt: null } as Incidents) as unknown as Atom<Incidents>

// The shared theme slot, the same ref as in themes.tsx; the render hooks read it, so a switch redraws.
const theme = atom({ plugin: 'toolkitty', key: 'slot', id: 'theme' } as const, BUILTIN_THEMES[0] as Theme) as unknown as Atom<Theme>

export const feature: Feature = {
  id: 'buddy',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const SPECIES: readonly Species[] = ['cat', 'fox', 'owl', 'octopus', 'dragon', 'axolotl', 'penguin', 'capybara', 'raccoon', 'robot', 'ghost', 'slime']
const FRAME: Record<Rarity, string> = { common: '#9aa3ad', uncommon: '#4cc38a', rare: '#4c8dff', epic: '#a56bff', legendary: '#ffc83d' }
const STARS: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }
const RARITY_PCT: Record<Rarity, number> = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 }
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const STREAK_DAYS = 7
const SCALE: Record<Stage, number> = { 1: 1, 2: 1.08, 3: 1.16 }
const PROGRESS_EVERY = 60

/** XP per verified event; the hours worked still count, one per hour. */
const XP_HOUR = 1
const XP_TEST = 10
const XP_INCIDENT = 15
const XP_PER_10K_TOKENS = 5
const XP_ACHIEVEMENT = 20
const TOKENS_STEP = 10_000
/** XP needed for stage 2 and stage 3. */
const STAGE_2_XP = 150
const STAGE_3_XP = 600

/** Evolution stage by XP: under 150, under 600, from 600. */
const stageOfXp = (xp: number): Stage => (xp < STAGE_2_XP ? 1 : xp < STAGE_3_XP ? 2 : 3)
const stageName = (g: Stage): string => t(T[`stage${g}` as const])
const hoursText = (ms: number): string => {
  const hrs = ms / HOUR_MS
  return t(T.hoursShort, { n: hrs < 10 ? hrs.toFixed(1) : Math.round(hrs) })
}
/** The frame color: the theme's for common to rare buddies, the rarity color when the theme has none or the buddy is epic or better. */
const frameOf = (r: Rarity, th: Theme): string => (th.buddy.frame === '' || r === 'epic' || r === 'legendary' ? FRAME[r] : th.buddy.frame)
const IDLE_MS = 3 * 60_000
const FLASH_MS = 10_000
const WORKY = /test|build|tsc|lint/

const speciesName = (s: Species): string => t(T[s])
const rarityName = (r: Rarity): string => t(T[r])
const moodName = (m: Mood): string => t(T[m])
const lineFor = (m: Mood, i: number): string => {
  const list = t(T[`${m}Lines` as const]).split('|')
  return list[i % list.length] ?? ''
}

// ---------- the roll: the same seed always gives the same buddy ----------

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = s
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function roll(seed: number): { species: Species; rarity: Rarity; shiny: boolean } {
  const r = rng(seed)
  const species = SPECIES[Math.floor(r() * SPECIES.length)] ?? 'cat'
  const q = r() * 100
  const rarity: Rarity = q < 60 ? 'common' : q < 85 ? 'uncommon' : q < 95 ? 'rare' : q < 99 ? 'epic' : 'legendary'
  const shiny = r() < 0.01
  return { species, rarity, shiny }
}

// ---------- drawing: a flat-vector character in local coordinates, feet at 0,0 ----------

const INK = '#1d1b2e'

type FaceOpts = { ink?: string; r?: number; mouthInk?: string; noMouth?: boolean; mouthDy?: number; noCheeks?: boolean }

function face(m: Mood, y: number, dx: number, o: FaceOpts = {}): string {
  const ink = o.ink ?? INK
  const r = o.r ?? 5
  const mouthInk = o.mouthInk ?? ink
  const l = -dx
  const rt = dx
  const stroke = `fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"`
  let eyes: string
  if (m === 'sleeping') {
    eyes = `<path d="M${l - 6} ${y}q6 6 12 0M${rt - 6} ${y}q6 6 12 0" ${stroke}/>`
  } else if (m === 'celebrating') {
    eyes = `<path d="M${l - 6} ${y + 3}q6 -10 12 0M${rt - 6} ${y + 3}q6 -10 12 0" ${stroke}/>`
  } else {
    eyes =
      `<circle cx="${l}" cy="${y}" r="${r}" fill="${ink}"/><circle cx="${rt}" cy="${y}" r="${r}" fill="${ink}"/>` +
      `<circle cx="${l + 1.8}" cy="${y - 1.8}" r="${r / 3}" fill="#fff"/><circle cx="${rt + 1.8}" cy="${y - 1.8}" r="${r / 3}" fill="#fff"/>`
  }
  let brows = ''
  if (m === 'worried') {
    brows = `<path d="M${l - 7} ${y - 8}L${l + 4} ${y - 14}M${rt + 7} ${y - 8}L${rt - 4} ${y - 14}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>`
  } else if (m === 'working' || m === 'guarding') {
    brows = `<path d="M${l - 6} ${y - 12}L${l + 5} ${y - 8}M${rt + 6} ${y - 12}L${rt - 5} ${y - 8}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>`
  }
  let mouth = ''
  if (o.noMouth !== true) {
    const my = y + (o.mouthDy ?? 10)
    const ms = `fill="none" stroke="${mouthInk}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`
    if (m === 'idle') mouth = `<path d="M-5 ${my}q5 5 10 0" ${ms}/>`
    else if (m === 'working' || m === 'guarding') mouth = `<path d="M-4 ${my + 1}h8" ${ms}/>`
    else if (m === 'chasing') mouth = `<circle cx="0" cy="${my + 1}" r="3" ${ms}/>`
    else if (m === 'celebrating') mouth = `<path d="M-7 ${my - 2}q7 14 14 0z" fill="${mouthInk}"/><path d="M-3 ${my + 6}q3 -3 6 0q-3 2.5 -6 0z" fill="#ff7b8f"/>`
    else if (m === 'worried') mouth = `<path d="M-6 ${my + 2}q3 -4 6 0t6 0" ${ms}/>`
    else mouth = `<path d="M-3 ${my}q3 3 6 0" ${ms}/>`
  }
  const cheeks = o.noCheeks === true ? '' : `<circle cx="${l - 8}" cy="${y + 8}" r="4.5" fill="#ff8fa3" opacity=".35"/><circle cx="${rt + 8}" cy="${y + 8}" r="4.5" fill="#ff8fa3" opacity=".35"/>`
  return cheeks + eyes + brows + mouth
}

const feet = (fill: string): string => `<ellipse cx="-17" cy="-3" rx="11" ry="6" fill="${fill}"/><ellipse cx="17" cy="-3" rx="11" ry="6" fill="${fill}"/>`
const torso = (fill: string, rx = 38, ry = 36, cy = -38): string => `<ellipse cx="0" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`
const pair = (shape: (sign: number) => string): string => shape(-1) + shape(1)

const DRAW: Record<Species, (m: Mood) => string> = {
  cat: m =>
    `<path d="M32 -12q36 -2 28 -36" fill="none" stroke="#e08a3c" stroke-width="9" stroke-linecap="round"/>${feet('#e08a3c')}` +
    pair(s => `<path d="M${32 * s} -60L${36 * s} -90L${12 * s} -74z" fill="#f4a259"/><path d="M${30 * s} -66L${32 * s} -80L${20 * s} -72z" fill="#f7b6b6"/>`) +
    torso('#f4a259') +
    `<ellipse cx="0" cy="-20" rx="20" ry="17" fill="#ffe3c4"/><path d="M-6 -72v9M0 -74v11M6 -72v9" stroke="#e08a3c" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M-3 -43h6l-3 4z" fill="#e8798a"/><path d="M-26 -38l-15 -3M-26 -33l-15 3M26 -38l15 -3M26 -33l15 3" stroke="#6b4a2b" stroke-width="1.5" opacity=".5" stroke-linecap="round"/>` +
    face(m, -48, 15),
  fox: m =>
    `<path d="M30 -14Q72 -8 62 -60Q40 -46 30 -14z" fill="#e8743b"/><path d="M62 -60Q60 -42 52 -34Q68 -38 70 -54Q68 -60 62 -60z" fill="#fff6ec"/>${feet('#3a2a2a')}` +
    pair(s => `<path d="M${34 * s} -58L${34 * s} -94L${10 * s} -70z" fill="#e8743b"/><path d="M${30 * s} -66L${30 * s} -84L${18 * s} -72z" fill="#3a2a2a"/>`) +
    torso('#e8743b') +
    pair(s => `<path d="M${33 * s} -38L${47 * s} -30L${31 * s} -24z" fill="#fff6ec"/><ellipse cx="${14 * s}" cy="-30" rx="15" ry="10" fill="#fff6ec"/>`) +
    `<ellipse cx="0" cy="-41" rx="4.5" ry="3.2" fill="#3a2a2a"/>` +
    face(m, -52, 15),
  owl: m =>
    pair(s => `<ellipse cx="${36 * s}" cy="-36" rx="10" ry="22" fill="#6d4c41" transform="rotate(${-10 * s} ${36 * s} -36)"/>`) +
    feet('#f2b632') +
    pair(s => `<path d="M${30 * s} -64L${35 * s} -90L${13 * s} -74z" fill="#6d4c41"/>`) +
    torso('#8d6e63') +
    `<ellipse cx="0" cy="-22" rx="22" ry="20" fill="#efd9b8"/><path d="M-12 -28l5 4l5 -4M2 -28l5 4l5 -4M-6 -18l5 4l5 -4M-14 -12l5 4l5 -4M4 -12l5 4l5 -4" fill="none" stroke="#c9a77a" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="-15" cy="-52" r="14" fill="#fff6e0" stroke="#c9a227" stroke-width="2.5"/><circle cx="15" cy="-52" r="14" fill="#fff6e0" stroke="#c9a227" stroke-width="2.5"/>` +
    `<path d="M-5 -45h10l-5 11z" fill="#f2b632"/>` +
    face(m, -53, 15, { r: 6, noMouth: true, noCheeks: true }),
  octopus: m => {
    const tent = [-30, -10, 10, 30].map((x, i) => `<path d="M${x} -28q${i % 2 === 0 ? 11 : -11} 15 ${i % 2 === 0 ? -1 : 1} 29" fill="none" stroke="#8a4fd8" stroke-width="12" stroke-linecap="round"/>`).join('')
    return (
      tent +
      `<ellipse cx="0" cy="-52" rx="41" ry="38" fill="#9b5de5"/><circle cx="-22" cy="-74" r="4" fill="#b684f0"/><circle cx="-12" cy="-80" r="2.5" fill="#b684f0"/><circle cx="24" cy="-70" r="3.2" fill="#b684f0"/>` +
      `<path d="M-30 -66Q-24 -78 -10 -80" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>` +
      face(m, -50, 16)
    )
  },
  dragon: m =>
    `<path d="M30 -10Q68 -6 58 -42" fill="none" stroke="#5fb36b" stroke-width="9" stroke-linecap="round"/><path d="M58 -42l9 -6l-3 11z" fill="#3f8f55"/>` +
    pair(s => `<path d="M${30 * s} -54Q${74 * s} -84 ${60 * s} -34Q${46 * s} -46 ${30 * s} -34z" fill="#3f8f55"/>`) +
    feet('#3f8f55') +
    pair(s => `<path d="M${24 * s} -68L${31 * s} -94L${12 * s} -74z" fill="#f2d27a"/>`) +
    torso('#5fb36b') +
    `<path d="M-8 -74l8 -13l8 13z" fill="#3f8f55"/><ellipse cx="0" cy="-20" rx="21" ry="18" fill="#e6f7c9"/><path d="M-14 -26h28M-16 -18h32M-12 -10h24" stroke="#bfe3a3" stroke-width="2"/>` +
    `<ellipse cx="0" cy="-37" rx="16" ry="11" fill="#7ccb86"/><circle cx="-5" cy="-42" r="1.8" fill="#2d6a40"/><circle cx="5" cy="-42" r="1.8" fill="#2d6a40"/>` +
    face(m, -55, 16, { mouthDy: 21, noCheeks: true }),
  axolotl: m =>
    `<path d="M32 -14Q66 -16 58 -38Q42 -30 32 -28z" fill="#f48fb5"/>${feet('#f48fb5')}` +
    pair(s => `<path d="M${35 * s} -54L${55 * s} -64M${36 * s} -46L${59 * s} -46M${35 * s} -38L${55 * s} -28" fill="none" stroke="#ee6f9f" stroke-width="5" stroke-linecap="round"/><circle cx="${57 * s}" cy="-65" r="5" fill="#ff8cb8"/><circle cx="${61 * s}" cy="-46" r="5" fill="#ff8cb8"/><circle cx="${57 * s}" cy="-27" r="5" fill="#ff8cb8"/>`) +
    torso('#f7a8c4', 40, 34, -36) +
    `<circle cx="-22" cy="-20" r="3" fill="#ee6f9f" opacity=".5"/><circle cx="24" cy="-16" r="3.5" fill="#ee6f9f" opacity=".5"/><circle cx="10" cy="-26" r="2.2" fill="#ee6f9f" opacity=".5"/>` +
    face(m, -44, 20),
  penguin: m =>
    pair(s => `<ellipse cx="${36 * s}" cy="-36" rx="8" ry="20" fill="#243040" transform="rotate(${-12 * s} ${36 * s} -36)"/>`) +
    feet('#f59e0b') +
    `<ellipse cx="0" cy="-38" rx="34" ry="38" fill="#2d3a4b"/><ellipse cx="0" cy="-28" rx="23" ry="28" fill="#f1f5f9"/>` +
    `<path d="M-25 -56Q-13 -40 0 -47Q13 -40 25 -56Q13 -74 0 -65Q-13 -74 -25 -56z" fill="#f1f5f9"/><path d="M-6 -46h12l-6 9z" fill="#f59e0b"/>` +
    face(m, -56, 13, { r: 4.5, noMouth: true, noCheeks: true }),
  capybara: m =>
    feet('#8d6642') +
    `<rect x="-46" y="-68" width="92" height="64" rx="30" fill="#a67c52"/>` +
    pair(s => `<circle cx="${28 * s}" cy="-68" r="7" fill="#8d6642"/>`) +
    `<ellipse cx="0" cy="-33" rx="19" ry="12" fill="#8d6642"/><ellipse cx="-6" cy="-37" rx="2.2" ry="3" fill="#4a3320"/><ellipse cx="6" cy="-37" rx="2.2" ry="3" fill="#4a3320"/>` +
    `<circle cx="0" cy="-77" r="9" fill="#ffa62b"/><path d="M0 -86q7 -6 11 -1q-6 5 -11 1z" fill="#4caf50"/>` +
    face(m, -52, 17, { r: 4, mouthDy: 26 }),
  raccoon: m =>
    `<path d="M30 -12Q70 -8 62 -52" fill="none" stroke="#8d99a6" stroke-width="12" stroke-linecap="round"/><path d="M30 -12Q70 -8 62 -52" fill="none" stroke="#3b4252" stroke-width="12" stroke-dasharray="8 9"/>${feet('#3b4252')}` +
    pair(s => `<path d="M${32 * s} -62L${36 * s} -90L${12 * s} -74z" fill="#8d99a6"/><path d="M${30 * s} -66L${32 * s} -80L${20 * s} -72z" fill="#3b4252"/>`) +
    torso('#8d99a6') +
    `<ellipse cx="0" cy="-32" rx="20" ry="16" fill="#e8edf2"/>` +
    pair(s => `<ellipse cx="${16 * s}" cy="-50" rx="15" ry="10" fill="#3b4252" transform="rotate(${12 * s} ${16 * s} -50)"/>`) +
    `<ellipse cx="0" cy="-41" rx="4.5" ry="3.2" fill="#2a2f3a"/>` +
    face(m, -50, 16, { ink: '#ffffff', r: 4.5, mouthInk: INK }),
  robot: m =>
    `<rect x="-22" y="-12" width="14" height="12" rx="3" fill="#6b7f95"/><rect x="8" y="-12" width="14" height="12" rx="3" fill="#6b7f95"/>` +
    pair(s => `<rect x="${s < 0 ? -48 : 36}" y="-54" width="12" height="32" rx="6" fill="#8aa0b8"/>`) +
    `<rect x="-34" y="-78" width="68" height="68" rx="16" fill="#9fb3c8"/>` +
    `<path d="M0 -78V-91" stroke="#6b7f95" stroke-width="3"/><circle cx="0" cy="-94" r="5" fill="#ff6b6b"><animate attributeName="opacity" values="1;.25;1" dur="1.4s" repeatCount="indefinite"/></circle>` +
    `<rect x="-27" y="-70" width="54" height="42" rx="9" fill="#14202e"/><rect x="-14" y="-22" width="28" height="8" rx="4" fill="#6b7f95"/><circle cx="-7" cy="-18" r="1.8" fill="#5ef2ff"/><circle cx="0" cy="-18" r="1.8" fill="#ffd166"/><circle cx="7" cy="-18" r="1.8" fill="#ff6b6b"/>` +
    face(m, -54, 12, { ink: '#5ef2ff', r: 4.5, mouthDy: 14, noCheeks: true }),
  ghost: m =>
    `<path d="M-36 0V-42A36 36 0 0 1 36 -42V0q-9 -9 -18 0q-9 9 -18 0q-9 -9 -18 0q-9 9 -18 0z" fill="#eef2ff" stroke="#c7d2fe" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M20 -70q18 14 14 40" fill="none" stroke="#c7d2fe" stroke-width="4" stroke-linecap="round" opacity=".7"/>` +
    face(m, -46, 14, { r: 5.5 }),
  slime: m =>
    `<ellipse cx="0" cy="1" rx="54" ry="5" fill="#5ad1a8" opacity=".55"/>` +
    `<path d="M-46 0Q-50 -50 -22 -66Q0 -76 22 -66Q50 -50 46 0Q0 6 -46 0z" fill="#5ad1a8"/>` +
    `<ellipse cx="-20" cy="-56" rx="9" ry="5" fill="#fff" opacity=".55" transform="rotate(-30 -20 -56)"/><circle cx="24" cy="-16" r="5" fill="#3fb68b" opacity=".6"/><circle cx="-28" cy="-12" r="3" fill="#3fb68b" opacity=".6"/>` +
    face(m, -34, 15),
}

const CONFETTI = ['#ff6b6b', '#ffd166', '#4cc38a', '#4c8dff', '#a56bff', '#ff8fd0']

function extras(m: Mood): string {
  if (m === 'working') {
    return [104, 120, 136].map((x, i) => `<circle cx="${x}" cy="40" r="4" fill="#9fb4ff"><animate attributeName="opacity" values=".2;1;.2" dur="1.2s" begin="${-i * 0.4}s" repeatCount="indefinite"/><animate attributeName="cy" values="42;36;42" dur="1.2s" begin="${-i * 0.4}s" repeatCount="indefinite"/></circle>`).join('')
  }
  if (m === 'celebrating') {
    let out = ''
    for (let i = 0; i < 18; i++) {
      const x = 12 + i * 12.5
      const c = CONFETTI[i % CONFETTI.length] ?? '#ffd166'
      const dur = 2.2 + (i % 4) * 0.45
      const sway = i % 2 === 0 ? 7 : -7
      out +=
        `<rect x="${x}" y="-10" width="6" height="9" rx="1.5" fill="${c}">` +
        `<animate attributeName="y" from="-12" to="204" dur="${dur}s" begin="${-i * 0.37}s" repeatCount="indefinite"/>` +
        `<animate attributeName="x" values="${x};${x + sway};${x - sway};${x}" dur="${dur}s" begin="${-i * 0.37}s" repeatCount="indefinite"/>` +
        `<animate attributeName="width" values="6;1.5;6" dur="0.7s" begin="${-i * 0.11}s" repeatCount="indefinite"/></rect>`
    }
    return out
  }
  if (m === 'worried') {
    return (
      `<g transform="translate(166 88)"><path d="M0 -10C5 -3 8 1 8 5A8 8 0 0 1 -8 5C-8 1 -5 -3 0 -10z" fill="#7dd3fc" stroke="#e0f2fe" stroke-width="1.2">` +
      `<animateTransform attributeName="transform" type="translate" values="0 0;0 16" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.2;.7;1" dur="1.5s" repeatCount="indefinite"/></path></g>`
    )
  }
  if (m === 'guarding') {
    // a shield held up in front, with a steady glow: the pose of a prevented incident
    return (
      `<g id="shield" transform="translate(178 118)"><path d="M0 -26L24 -17V2C24 16 13 27 0 32C-13 27 -24 16 -24 2V-17Z" fill="#4c8dff" stroke="#e2ecff" stroke-width="2.5">` +
      `<animate attributeName="opacity" values=".85;1;.85" dur="2s" repeatCount="indefinite"/></path>` +
      `<path d="M-10 2L-3 9L11 -7" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`
    )
  }
  if (m === 'chasing') {
    // a ring of motion dots: the loop the buddy is running in
    return [0, 1, 2, 3, 4, 5]
      .map(i => {
        const a = (i * Math.PI) / 3
        return `<circle id="lap-${i}" cx="${Math.round(120 + 70 * Math.cos(a))}" cy="${Math.round(120 + 26 * Math.sin(a))}" r="3.5" fill="#ffd166"><animate attributeName="opacity" values=".15;1;.15" dur="1.6s" begin="${-i * 0.27}s" repeatCount="indefinite"/></circle>`
      })
      .join('')
  }
  if (m === 'sleeping') {
    return [0, 1, 2]
      .map(
        i =>
          `<text x="${152 + i * 14}" y="${78 - i * 18}" font-family="sans-serif" font-weight="700" font-size="${14 + i * 4}" fill="#cbd5ff"><animate attributeName="opacity" values="0;1;0" dur="3s" begin="${i * 0.9}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 6;0 -6" dur="3s" begin="${i * 0.9}s" repeatCount="indefinite"/>Z</text>`,
      )
      .join('')
  }
  return ''
}

function moodAnim(m: Mood): string {
  if (m === 'idle') return `<animateTransform attributeName="transform" type="scale" values="1 1;1.035 1.05;1 1" keyTimes="0;.5;1" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1" dur="3.2s" repeatCount="indefinite"/>`
  if (m === 'sleeping') return `<animateTransform attributeName="transform" type="scale" values="1 1;1.02 1.03;1 1" keyTimes="0;.5;1" dur="5s" repeatCount="indefinite"/>`
  if (m === 'working') return `<animateTransform attributeName="transform" type="translate" values="0 0;0 -8;0 0" dur="0.6s" repeatCount="indefinite"/>`
  if (m === 'celebrating') return `<animateTransform attributeName="transform" type="translate" values="0 0;0 -28;0 0" keyTimes="0;.5;1" calcMode="spline" keySplines=".25 .6 .35 1;.65 0 .75 .4" dur="0.9s" repeatCount="indefinite"/>`
  if (m === 'guarding') return `<animateTransform attributeName="transform" type="scale" values="1 1;1.02 0.98;1 1" keyTimes="0;.5;1" dur="2s" repeatCount="indefinite"/>`
  if (m === 'chasing') return `<animateTransform attributeName="transform" type="rotate" values="-12 0 -40;12 0 -40;-12 0 -40" keyTimes="0;.5;1" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1" dur="1.6s" repeatCount="indefinite"/>`
  return `<animateTransform attributeName="transform" type="translate" values="-1.5 0;1.5 0;-1.5 0" dur="0.16s" repeatCount="indefinite"/>`
}

function sparkles(): string {
  const spots: Array<[number, number]> = [[40, 56], [200, 48], [58, 142], [188, 130], [120, 30], [214, 100]]
  return spots
    .map(
      ([x, y], i) =>
        `<g transform="translate(${x} ${y})"><path d="M0 -8Q1.6 -1.6 8 0Q1.6 1.6 0 8Q-1.6 1.6 -8 0Q-1.6 -1.6 0 -8z" fill="#fff6b0">` +
        `<animateTransform attributeName="transform" type="scale" values="0.2;1.1;0.2" dur="1.9s" begin="${-i * 0.37}s" repeatCount="indefinite"/>` +
        `<animate attributeName="opacity" values=".2;1;.2" dur="1.9s" begin="${-i * 0.37}s" repeatCount="indefinite"/></path></g>`,
    )
    .join('')
}

const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Where the scarf (neck: y, w: half width) and the crown (top: y of the head's top, cx: offset) sit on each species, in the same local coordinates.
const ACC: Record<Species, { neck: number; w: number; top: number; cx: number }> = {
  cat: { neck: -24, w: 30, top: -76, cx: 0 },
  fox: { neck: -24, w: 30, top: -76, cx: 0 },
  owl: { neck: -18, w: 30, top: -76, cx: 0 },
  octopus: { neck: -26, w: 20, top: -88, cx: 0 },
  dragon: { neck: -24, w: 30, top: -78, cx: 0 },
  axolotl: { neck: -20, w: 32, top: -68, cx: 0 },
  penguin: { neck: -38, w: 26, top: -76, cx: 0 },
  capybara: { neck: -22, w: 34, top: -66, cx: -22 },
  raccoon: { neck: -24, w: 30, top: -76, cx: 0 },
  robot: { neck: -12, w: 30, top: -78, cx: -20 },
  ghost: { neck: -26, w: 32, top: -76, cx: 0 },
  slime: { neck: -14, w: 40, top: -68, cx: 0 },
}

function scarf(sp: Species, color: string): string {
  const { neck, w } = ACC[sp]
  const tx = Math.round(w * 0.5)
  return (
    `<path d="M${-w} ${neck}Q0 ${neck + 10} ${w} ${neck}L${w} ${neck + 7}Q0 ${neck + 17} ${-w} ${neck + 7}z" fill="${color}" stroke="#00000033" stroke-width="1"/>` +
    `<path d="M${tx} ${neck + 11}L${tx + 9} ${neck + 27}L${tx + 1} ${neck + 29}L${tx - 4} ${neck + 14}z" fill="${color}" stroke="#00000033" stroke-width="1"/>` +
    `<path d="M${-w * 0.5} ${neck + 4}l3 8M0 ${neck + 6}l3 8M${w * 0.5 - 6} ${neck + 4}l3 8" stroke="#ffffff" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/>`
  )
}

function crown(sp: Species): string {
  const { top, cx } = ACC[sp]
  return (
    `<g transform="translate(${cx} ${top})">` +
    `<path d="M-11 0L-13 -14L-6 -8L0 -17L6 -8L13 -14L11 0z" fill="#ffc83d" stroke="#b8860b" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="0" cy="-17" r="2" fill="#ff5d73"/><circle cx="-13" cy="-14" r="1.6" fill="#fff6b0"/><circle cx="13" cy="-14" r="1.6" fill="#fff6b0"/>` +
    `<rect x="-11" y="-3" width="22" height="3" fill="#e0a82e"/></g>`
  )
}

function charm(color: string): string {
  return (
    `<g transform="translate(192 184)"><rect x="-38" y="-10" width="76" height="20" rx="10" fill="${color}" fill-opacity=".92"/>` +
    `<text x="0" y="4.5" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="12" fill="#fff">${escapeXml(t(T.streakCharm))}</text></g>`
  )
}

function buddySvg(seed: number, mood: Mood, stage: Stage, hasStreak: boolean, th: Theme): string {
  const { species, rarity, shiny } = roll(seed)
  const frame = frameOf(rarity, th)
  const bounce = mood === 'working' || mood === 'celebrating'
  const dur = mood === 'working' ? '0.6s' : '0.9s'
  const glow =
    rarity === 'common' || rarity === 'uncommon'
      ? ''
      : `<radialGradient id="gl"><stop offset="0" stop-color="${frame}" stop-opacity=".28"/><stop offset="1" stop-color="${frame}" stop-opacity="0"/></radialGradient><circle cx="120" cy="108" r="100" fill="url(#gl)"/>`
  const pulse = rarity === 'epic' || rarity === 'legendary' ? `<animate attributeName="stroke-opacity" values="1;.55;1" dur="2.4s" repeatCount="indefinite"/>` : ''
  const worn = (stage >= 2 ? scarf(species, th.buddy.accent) : '') + (stage >= 3 ? crown(species) : '')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2e4d"/><stop offset="1" stop-color="#14162a"/></linearGradient></defs>` +
    `<rect x="3" y="3" width="234" height="194" rx="18" fill="url(#bg)" stroke="${frame}" stroke-width="5">${pulse}</rect>` +
    glow +
    `<text x="16" y="26" font-family="sans-serif" font-size="13" fill="${frame}">${'★'.repeat(STARS[rarity])}</text>` +
    `<ellipse cx="120" cy="176" rx="${Math.round(58 * SCALE[stage])}" ry="9" fill="#000" opacity=".3">${bounce ? `<animate attributeName="rx" values="${Math.round(58 * SCALE[stage])};46;${Math.round(58 * SCALE[stage])}" dur="${dur}" repeatCount="indefinite"/>` : ''}</ellipse>` +
    `<g transform="translate(120 174) scale(${SCALE[stage]})"><g>${moodAnim(mood)}${DRAW[species](mood)}${worn}</g></g>` +
    extras(mood) +
    (shiny ? sparkles() : '') +
    (hasStreak ? charm(th.buddy.accent) : '') +
    `</svg>`
  )
}

const ASCII: Record<Mood, readonly [string, string, string]> = {
  idle: [' /\\_/\\ ', '( o.o )', ' > ^ < '],
  working: [' /\\_/\\ ', '( ò.ó )', ' > ~ < '],
  celebrating: ['\\/\\_/\\/', '( ^o^ )', ' > w < '],
  worried: [' /\\_/\\ ', '( ;.; )', ' > ~ < '],
  sleeping: [' /\\_/\\ ', '( -.- )z', ' > _ < '],
  guarding: [' /\\_/\\ ', '( ò.ó )', '[> ^ <]'],
  chasing: [' /\\_/\\@', '( @.@ )', ' > o < '],
}

// ---------- state ----------

let lastActivity = 0
let isWorking = false
let flash: { mood: 'celebrating' | 'worried'; until: number } | null = null
let ticker: Timer | undefined
let ticks = 0

// ---------- mascot states: what the signals bus says, in order of importance ----------

/** An incident keeps the shield up this long after the guard spoke. */
const INCIDENT_FRESH_MS = 60_000
/** A test, build or lint result changes the face this long after it came in. */
const EVIDENCE_FRESH_MS = FLASH_MS
/** Context fill (percent) from which the buddy worries. */
const CONTEXT_WORRY_PCT = 70
/** Quota use (percent) from which the buddy sleeps to save the rest. */
const QUOTA_SLEEP_PCT = 90

const valueOf = (s: Signal): number => (typeof s.value === 'number' && Number.isFinite(s.value) ? s.value : 0)

/**
 * The pose the live signals ask for, or null when they say nothing: shield on a fresh incident,
 * tail-chasing on a loop, asleep when the quota is nearly used, celebrating or worried on fresh
 * evidence, worried when the context is filling, typing while a tool is working.
 */
function moodFromSignals(items: readonly Signal[], now: number): Mood | null {
  const incident = ofKind(items, 'incident')[0]
  if (incident !== undefined && now - incident.at < INCIDENT_FRESH_MS) return 'guarding'
  if (ofKind(items, 'loop').length > 0) return 'chasing'
  if (ofKind(items, 'quota').some(s => valueOf(s) >= QUOTA_SLEEP_PCT)) return 'sleeping'
  const evidence = ofKind(items, 'evidence')[0]
  if (evidence !== undefined && now - evidence.at < EVIDENCE_FRESH_MS) return valueOf(evidence) >= 1 ? 'celebrating' : 'worried'
  if (ofKind(items, 'context').some(s => valueOf(s) >= CONTEXT_WORRY_PCT)) return 'worried'
  if (ofKind(items, 'working').length > 0) return 'working'
  return null
}

function moodAt(now: number, items: readonly Signal[]): Mood {
  const asked = moodFromSignals(items, now)
  if (asked === 'guarding' || asked === 'chasing') return asked
  if (flash !== null && now < flash.until) return flash.mood
  if (asked !== null) return asked
  if (isWorking) return 'working'
  if (now - lastActivity > IDLE_MS) return 'sleeping'
  return 'idle'
}

/** The Minimal profile keeps the buddy calm: no reactions to the bus (the pose stays the quiet one). */
async function reactsToBus($: EngineInterface): Promise<boolean> {
  return (await $.store.get('profile')) !== 'minimal'
}

/**
 * `afterTool`: a tool call has just ended (ran, failed or was denied). The live ticker's "working"
 * signal is then stale: its after-hook, which retracts it, runs after the buddy's. So that signal
 * is left out, and the turn's own state decides between working and idle.
 */
async function sync($: EngineInterface, afterTool = false): Promise<void> {
  const now = await $.clock.now()
  const all = (await reactsToBus($)) ? await current($, now) : []
  const items = afterTool ? all.filter(s => s.kind !== 'working') : all
  const mood = moodAt(now, items)
  const cur = await read($, buddy)
  if (cur.mood !== mood) {
    await update($, buddy, s => ({ ...s, mood, line: s.line + 1 }))
    // the share card draws the same pose
    await $.store.set('buddy:mood', mood)
  }
}

async function touch($: EngineInterface, afterTool = false): Promise<void> {
  lastActivity = await $.clock.now()
  await sync($, afterTool)
}

async function ensure($: EngineInterface): Promise<void> {
  const cur = await read($, buddy)
  if (cur.seed !== 0) return
  const stored = await $.store.get('buddy:seed')
  let seed = typeof stored === 'number' && stored > 0 ? stored : 0
  if (seed === 0) {
    seed = 1 + Math.floor(Math.random() * 4294967294)
    await $.store.set('buddy:seed', seed)
  }
  const name = await $.store.get('buddy:name')
  await update($, buddy, s => ({ ...s, seed, name: typeof name === 'string' ? name : '' }))
}

const nameOf = (s: State): string => (s.name === '' ? t(T.defaultName) : s.name)

/** Picks up a name written to the store by someone else (the demo's "Pixel", or its removal) when the pane opens. */
async function reloadName($: EngineInterface): Promise<void> {
  const stored = await $.store.get('buddy:name')
  const name = typeof stored === 'string' ? stored : ''
  const cur = await read($, buddy)
  if (cur.name !== name) await update($, buddy, s => ({ ...s, name }))
}

// ---------- evolution: total hours and the streak come from the heatmap's stored days ----------

type DayLog = { turns: number; ms: number }

const pad2 = (n: number): string => String(n).padStart(2, '0')

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function shift(ms: number, days: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12).getTime()
}

/** Consecutive active days ending today, or yesterday when today has no turn yet. */
function runOfDays(days: Record<string, DayLog>, today: number): number {
  const isActive = (ms: number): boolean => (days[dayKey(ms)]?.turns ?? 0) > 0
  let cursor = isActive(today) ? today : shift(today, -1)
  let run = 0
  while (run < 400 && isActive(cursor)) {
    run++
    cursor = shift(cursor, -1)
  }
  return run
}

type TestMark = { at: number; n: number }

/**
 * The test runs in the evidence log that were not yet credited, given the mark of the last credited one
 * (its time and how many test records carry that time, so runs in the same millisecond count once each).
 */
function newTestRuns(items: readonly Evidence[], mark: TestMark): { passed: number; mark: TestMark } {
  let cur: TestMark = { at: mark.at, n: mark.n }
  let passed = 0
  let sameAt = 0
  for (const x of items) {
    if (x.kind !== 'test' || x.at < mark.at) continue
    if (x.at === mark.at) {
      sameAt++
      if (sameAt <= mark.n) continue
    }
    if (x.ok) passed++
    cur = x.at === cur.at ? { at: cur.at, n: cur.n + 1 } : { at: x.at, n: 1 }
  }
  return { passed, mark: cur }
}

const countField = (value: unknown, key: string): number => {
  if (typeof value !== 'object' || value === null) return 0
  const n = (value as Record<string, unknown>)[key]
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/** Passed test runs seen so far, kept across sessions: new evidence is credited once. */
async function creditTests($: EngineInterface): Promise<number> {
  const total = await storeGet<number>($, 'buddy:tests', 0)
  const mark = await storeGet<TestMark>($, 'buddy:tests-mark', { at: 0, n: 0 })
  const found = newTestRuns(await allEvidence($), mark)
  if (found.passed > 0) await $.store.set('buddy:tests', total + found.passed)
  if (found.mark.at !== mark.at || found.mark.n !== mark.n) await $.store.set('buddy:tests-mark', found.mark)
  return total + found.passed
}

/** The XP: hours + 10 per passed test run + 15 per incident prevented + 5 per 10k tokens saved + 20 per achievement. */
async function xpOf($: EngineInterface, ms: number): Promise<number> {
  const tests = await creditTests($)
  const cwd = await $.session.cwd()
  const stored = countField(await $.store.get(`incidents:${cwd}`), 'count')
  const prevented = Math.max(stored, (await read($, incidents)).count)
  const days = await storeGet<Record<string, { tokens?: number }>>($, 'savings:days', {})
  let tokens = 0
  for (const k of Object.keys(days)) tokens += countField(days[k], 'tokens')
  const unlocked = await $.store.get('achievements:unlocked')
  const trophies = typeof unlocked === 'object' && unlocked !== null && !Array.isArray(unlocked) ? Object.keys(unlocked).length : 0
  return (
    Math.floor(ms / HOUR_MS) * XP_HOUR +
    tests * XP_TEST +
    prevented * XP_INCIDENT +
    Math.floor(tokens / TOKENS_STEP) * XP_PER_10K_TOKENS +
    trophies * XP_ACHIEVEMENT
  )
}

/** Reads the heatmap's days and the verified events, updates the hours, streak and XP, and announces a stage newly reached. */
async function refreshProgress($: EngineInterface): Promise<void> {
  const days = await storeGet<Record<string, DayLog>>($, 'week-heatmap:days', {})
  let ms = 0
  for (const k of Object.keys(days)) ms += days[k]?.ms ?? 0
  const streak = runOfDays(days, await $.clock.now()) >= STREAK_DAYS
  const xp = await xpOf($, ms)
  const cur = await read($, buddy)
  if (cur.ms !== ms || cur.streak !== streak || cur.xp !== xp) await update($, buddy, x => ({ ...x, ms, streak, xp }))

  const stage = stageOfXp(xp)
  const seen = await storeGet<number>($, 'buddy:stage', 0)
  if (stage > seen) {
    await $.store.set('buddy:stage', stage)
    if (stage > 1) await notice($, 'info', t(T.evolved, { name: nameOf(await read($, buddy)), stage: stageName(stage) }), feature.id)
  }
}

/** Saves the card as a new SVG under toolkitty-exports and copies a post text. */
async function shareBuddy($: EngineInterface, surface: RenderSurface): Promise<void> {
  const s = await read($, buddy)
  const th = await read($, theme)
  const { species, rarity, shiny } = roll(s.seed)
  const text = t(shiny ? T.shareTextShiny : T.shareText, { rarity: rarityName(rarity).toLowerCase(), species: speciesName(species).toLowerCase(), pct: RARITY_PCT[rarity] })
  await shareExport($, { kind: 'buddy', svg: buddySvg(s.seed, s.mood, stageOfXp(s.xp), s.streak, th), share: text, surface, feature: feature.id })
}

// ---------- handlers ----------

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'buddy', description: t(T.cmdDesc), argumentHint: t(T.argHint) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'buddy', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (!(await isOn($, feature))) return
  await ensure($)
  lastActivity = await $.clock.now()
  await refreshProgress($)
  ticks = 0
  ticker?.cancel()
  ticker = $.clock.every(1000, async () => {
    if (!(await isOn($, feature))) return
    await sync($)
    ticks++
    if (ticks % PROGRESS_EVERY === 0) await refreshProgress($)
  })
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await ensure($)
  isWorking = true
  await touch($)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  isWorking = false
  await touch($)
  await refreshProgress($)
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (result.deny === undefined && result.isError === true) {
    flash = { mood: 'worried', until: (await $.clock.now()) + FLASH_MS }
  }
  await touch($, true)
  return result
}

export async function afterBashCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (e.tool !== 'Bash') return result
  if (result.deny === undefined && result.isError !== true && WORKY.test(e.command)) {
    flash = { mood: 'celebrating', until: (await $.clock.now()) + FLASH_MS }
    await touch($)
  }
  return result
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const s = await read($, buddy)
  if (s.seed === 0) return null
  const { Text } = $.ui.resolve(e)
  return (
    <Text dimColor size="footnote">
      🐾 {nameOf(s)} · {moodName(s.mood)}
    </Text>
  )
}

const moodLevel = (mood: Mood): Level => (mood === 'worried' || mood === 'guarding' || mood === 'chasing' ? 'warn' : mood === 'celebrating' ? 'info' : 'ok')

/** The short band form: the pet's name, only while it has something to show (not idle or asleep). */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const s = await read($, buddy)
  if (s.seed === 0 || s.mood === 'idle' || s.mood === 'sleeping') return null
  return { text: nameOf(s).slice(0, 12), level: moodLevel(s.mood), icon: '🐾' }
}

/** What a press on the band line shows: species, rarity, shiny, mood, stage and the one-liner. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null
  const s = await read($, buddy)
  if (s.seed === 0) return null
  const { species, rarity, shiny } = roll(s.seed)
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      <Text bold>{`${nameOf(s)} · ${speciesName(species)} · ${rarityName(rarity)}${shiny ? ` ${t(T.shiny)}` : ''}`}</Text>
      <Text>{`${moodName(s.mood)} · ${t(T.stageLine, { stage: stageName(stageOfXp(s.xp)), hours: hoursText(s.ms) })}`}</Text>
      <Text>{t(T.xpLine, { xp: s.xp, stage: stageOfXp(s.xp) })}</Text>
      <Text dimColor size="footnote">{t(T.xpDetail)}</Text>
      <Text italic>{`“${lineFor(s.mood, s.line)}”`}</Text>
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'buddy' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await ensure($)
    await reloadName($)
    await refreshProgress($)
    const args = e.args.trim()
    if (/^name(\s|$)/i.test(args)) {
      const name = args.replace(/^name\s*/i, '').trim().slice(0, 24)
      if (name === '') return { text: t(T.usageName) }
      await $.store.set('buddy:name', name)
      await update($, buddy, s => ({ ...s, name }))
      return { text: t(T.renamed, { name }) }
    }
    await $.ui.open({ id: 'buddy', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'buddy' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.off)}</Text>

    const s = await read($, buddy)
    const th = await read($, theme)
    const { species, rarity, shiny } = roll(s.seed)
    const name = nameOf(s)
    const color = frameOf(rarity, th)
    const stage = stageOfXp(s.xp)
    const surface = e.surface
    const caption = (
      <Box flexDirection="column">
        <Text bold size="heading">
          {name}
          {shiny ? ` ${t(T.shiny)}` : ''}
        </Text>
        <Text>
          <Text bold color={color}>
            {rarityName(rarity)}
          </Text>
          {' · '}
          {speciesName(species)} {'★'.repeat(STARS[rarity])}
        </Text>
        <Text dimColor>{moodName(s.mood)}</Text>
        <Text>{t(T.stageLine, { stage: stageName(stage), hours: hoursText(s.ms) })}</Text>
        <Text>{t(T.xpLine, { xp: s.xp, stage })}</Text>
        {s.streak ? (
          <Text bold color="warning">
            {t(T.streakCharm)}
          </Text>
        ) : null}
        <Text italic>“{lineFor(s.mood, s.line)}”</Text>
      </Box>
    )
    const header = paneHeader($, e, {
      title: t(T.paneTitle),
      status: moodName(s.mood),
      level: moodLevel(s.mood),
      icon: ICONS.visual,
      actions: [{ key: 'share-buddy', label: t(T.share), onPress: () => void shareBuddy($, surface) }],
    })

    // Save SVG (the card drawn here) or, on the terminal, the card as text; Share stays in the header.
    const cardText = [
      `${name}${shiny ? ` ${t(T.shiny)}` : ''}`,
      `${rarityName(rarity)} · ${speciesName(species)} ${'★'.repeat(STARS[rarity])}`,
      moodName(s.mood),
      t(T.stageLine, { stage: stageName(stage), hours: hoursText(s.ms) }),
      t(T.xpLine, { xp: s.xp, stage }),
      `“${lineFor(s.mood, s.line)}”`,
    ].join('\n')
    const bar = exportBar($, e, {
      feature: feature.id,
      kind: 'buddy',
      svg: e.surface === 'desktop' ? buddySvg(s.seed, s.mood, stage, s.streak, th) : undefined,
      text: cardText,
      skip: ['copy', 'share'],
    })

    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      const alt = t(T.alt, { name: escapeXml(name), rarity: rarityName(rarity), species: speciesName(species), mood: moodName(s.mood) })
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          <Svg source={buddySvg(s.seed, s.mood, stage, s.streak, th)} alt={alt} width={240} height={200} isInteractive />
          {bar}
          {caption}
        </Box>
      )
    }

    const art = ASCII[s.mood]
    return (
      <Box flexDirection="column" gap={1}>
        {header}
        <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={2} width={22}>
          {stage >= 3 ? (
            <Text key="art-crown" color="warning">
              {'  ♛'}
            </Text>
          ) : null}
          {art.map((row, i) => (
            <Text key={`art-${i}`} color={color}>
              {row}
            </Text>
          ))}
          {stage >= 2 ? (
            <Text key="art-scarf" color={th.buddy.accent}>
              {'=~~~~~=>'}
            </Text>
          ) : null}
        </Box>
        {bar}
        {caption}
      </Box>
    )
  })
}
