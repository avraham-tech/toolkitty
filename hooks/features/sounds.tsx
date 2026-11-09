import type { EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { Feature, Input } from '../core'

const T = {
  title: { en: 'Sounds', he: 'צלילים', es: 'Sonidos', fr: 'Sons', ru: 'Звуки', zh: '声音', ja: 'サウンド', pt: 'Sons', de: 'Töne', ko: '소리' },
  description: {
    en: 'Plays a soft chime when a long turn (over 30 seconds) finishes. Off by default; try the four sounds with /sounds test.',
    he: 'משמיע צליל עדין כשתור ארוך (מעל 30 שניות) מסתיים. כבוי כברירת מחדל; אפשר לשמוע את ארבעת הצלילים עם /sounds test.',
    es: 'Reproduce un sonido suave cuando termina un turno largo (más de 30 segundos). Desactivado por defecto; prueba los cuatro sonidos con /sounds test.',
    fr: 'Joue un carillon discret quand un tour long (plus de 30 secondes) se termine. Désactivé par défaut ; essayez les quatre sons avec /sounds test.',
    ru: 'Тихо звенит, когда долгий ход (более 30 секунд) завершён. По умолчанию выключено; проверьте четыре звука командой /sounds test.',
    zh: '长时间轮次（超过 30 秒）结束时播放轻柔的提示音。默认关闭；用 /sounds test 试听四种声音。',
    ja: '長いターン（30 秒超）の終了時にやさしいチャイムを鳴らします。デフォルトはオフ。/sounds test で 4 種類の音を試せます。',
    pt: 'Toca um sino suave quando um turno longo (mais de 30 segundos) termina. Desativado por padrão; teste os quatro sons com /sounds test.',
    de: 'Spielt einen sanften Gong, wenn ein langer Zug (über 30 Sekunden) endet. Standardmäßig aus; die vier Töne probierst du mit /sounds test aus.',
    ko: '긴 턴(30초 초과)이 끝나면 부드러운 알림음을 냅니다. 기본값은 꺼짐이며, /sounds test로 네 가지 소리를 들어 볼 수 있습니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; activez-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty パネルでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; im /toolkitty-Panel einschalten', ko: '기능이 꺼져 있습니다. /toolkitty 패널에서 켜세요' },
  cmdDesc: { en: 'Sounds: "/sounds test" plays the four sounds in turn', he: 'צלילים: "/sounds test" משמיע את ארבעת הצלילים בזה אחר זה', es: 'Sonidos: "/sounds test" reproduce los cuatro sonidos en orden', fr: 'Sons : « /sounds test » joue les quatre sons à la suite', ru: 'Звуки: «/sounds test» проигрывает четыре звука по очереди', zh: '声音："/sounds test" 依次播放四种声音', ja: 'サウンド：「/sounds test」で 4 種類の音を順に再生します', pt: 'Sons: "/sounds test" toca os quatro sons em sequência', de: 'Töne: „/sounds test“ spielt die vier Töne nacheinander ab', ko: '소리: "/sounds test"는 네 가지 소리를 차례로 재생합니다' },
  usage: { en: 'Usage: /sounds test', he: 'שימוש: /sounds test', es: 'Uso: /sounds test', fr: 'Utilisation : /sounds test', ru: 'Использование: /sounds test', zh: '用法：/sounds test', ja: '使い方：/sounds test', pt: 'Uso: /sounds test', de: 'Verwendung: /sounds test', ko: '사용법: /sounds test' },
  nameDone: { en: 'Turn finished', he: 'התור הסתיים', es: 'Turno terminado', fr: 'Tour terminé', ru: 'Ход завершён', zh: '轮次已结束', ja: 'ターン終了', pt: 'Turno concluído', de: 'Zug beendet', ko: '턴 종료' },
  nameShield: { en: 'Shield stopped something', he: 'המגן עצר משהו', es: 'El escudo detuvo algo', fr: 'Le bouclier a bloqué quelque chose', ru: 'Щит что-то остановил', zh: '防护拦截了某些内容', ja: 'ガードが何かを止めました', pt: 'A proteção barrou algo', de: 'Wächter hat etwas gestoppt', ko: '가드가 무언가를 막음' },
  nameLimit: { en: 'Limit reached', he: 'הגעת למגבלה', es: 'Límite alcanzado', fr: 'Limite atteinte', ru: 'Лимит достигнут', zh: '已达上限', ja: '上限に到達', pt: 'Limite atingido', de: 'Limit erreicht', ko: '한도 도달' },
  nameBuddy: { en: 'Buddy chirp', he: 'ציוץ החבר', es: 'Piar del compañero', fr: 'Pépiement du compagnon', ru: 'Щебет друга', zh: 'Buddy 的啁啾', ja: 'Buddy のさえずり', pt: 'Pio do Buddy', de: 'Buddy-Zwitschern', ko: 'Buddy 지저귐' },
  playing: { en: 'Playing: {name}', he: 'מנגן: {name}', es: 'Reproduciendo: {name}', fr: 'Lecture : {name}', ru: 'Играет: {name}', zh: '正在播放：{name}', ja: '再生中：{name}', pt: 'Tocando: {name}', de: 'Wiedergabe: {name}', ko: '재생 중: {name}' },
  testDone: { en: 'Played all four sounds.', he: 'ארבעת הצלילים הושמעו.', es: 'Se reprodujeron los cuatro sonidos.', fr: 'Les quatre sons ont été joués.', ru: 'Все четыре звука проиграны.', zh: '四种声音都已播放。', ja: '4 種類のサウンドをすべて再生しました。', pt: 'Todos os quatro sons foram tocados.', de: 'Alle vier Töne wurden abgespielt.', ko: '네 가지 소리를 모두 재생했습니다.' },
  noPlayer: { en: 'Could not play the sounds on this machine (no audio player available).', he: 'לא ניתן להשמיע צלילים במחשב הזה (אין נגן שמע).', es: 'No se pudieron reproducir los sonidos en este equipo (no hay reproductor de audio).', fr: 'Impossible de jouer les sons sur cette machine (aucun lecteur audio).', ru: 'Не удалось проиграть звуки на этом компьютере (нет аудиоплеера).', zh: '无法在此设备上播放声音（没有可用的音频播放器）。', ja: 'このマシンではサウンドを再生できません（利用可能なオーディオプレーヤーがありません）。', pt: 'Não foi possível tocar os sons nesta máquina (nenhum player de áudio disponível).', de: 'Die Töne können auf diesem Rechner nicht abgespielt werden (kein Audioplayer verfügbar).', ko: '이 기기에서는 소리를 재생할 수 없습니다 (사용 가능한 오디오 플레이어 없음).' },
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

export const feature: Feature = {
  id: 'sounds',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

const LONG_TURN_MS = 30_000

/** Whether the Sounds feature is on, for other features that want to play a sound. */
export async function isSoundOn($: EngineInterface): Promise<boolean> {
  return isOn($, feature)
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  void e
  try {
    await $.command.register({ name: 'sounds', description: t(T.cmdDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'sounds', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  if (e.durationMs <= LONG_TURN_MS) return
  try {
    await $.audio.play({ asset: 'sounds/done.wav' })
  } catch {
    // no player or no file: stay silent
  }
}

export function register(on: On) {
  on('command.run', { command: 'sounds' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    if (e.args.trim().toLowerCase() !== 'test') return { text: t(T.usage) }
    const clips = [
      { asset: 'sounds/done.wav', name: T.nameDone },
      { asset: 'sounds/shield.wav', name: T.nameShield },
      { asset: 'sounds/limit.wav', name: T.nameLimit },
      { asset: 'sounds/buddy.wav', name: T.nameBuddy },
    ] as const
    try {
      for (const clip of clips) {
        await notice($, 'info', t(T.playing, { name: t(clip.name) }), feature.id, { immediate: true })
        await $.audio.play({ asset: clip.asset })
      }
    } catch {
      return { text: t(T.noPlayer) }
    }
    return { text: t(T.testDone) }
  })
}
