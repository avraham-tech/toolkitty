import type { Feature, Localized } from '../core'

import { feature as advisor } from './advisor'
import { feature as promptEnhancer } from './prompt-enhancer'
import { feature as taskEta } from './task-eta'
import { feature as sessionReplay } from './session-replay'
import { feature as timeMachine } from './time-machine'
import { feature as missionControl } from './mission-control'
import { feature as about } from './about'
import { feature as doctor } from './doctor'
import { feature as selftest } from './selftest'
import { feature as handoff } from './handoff'
import { feature as errorDetective } from './error-detective'
import { feature as contextDoctor } from './context-doctor'
import { feature as goalTracker } from './goal-tracker'
import { feature as agentsMonitor } from './agents-monitor'
import { feature as autoFormat } from './auto-format'
import { feature as bashLog } from './bash-log'
import { feature as branchLock } from './branch-lock'
import { feature as breakTimer } from './break-timer'
import { feature as commitMsg } from './commit-msg'
import { feature as contextInfo } from './context-info'
import { feature as copyLast } from './copy-last'
import { feature as costMeter } from './cost-meter'
import { feature as dailyTotal } from './daily-total'
import { feature as dangerousCommands } from './dangerous-commands'
import { feature as doneNotify } from './done-notify'
import { feature as editUndo } from './edit-undo'
import { feature as errorCounter } from './error-counter'
import { feature as explainError } from './explain-error'
import { feature as filesTouched } from './files-touched'
import { feature as focusMode } from './focus-mode'
import { feature as gitContext } from './git-context'
import { feature as lintAfterEdit } from './lint-after-edit'
import { feature as longTurnToast } from './long-turn-toast'
import { feature as modelIndicator } from './model-indicator'
import { feature as notes } from './notes'
import { feature as outputTrimmer } from './output-trimmer'
import { feature as pinnedFiles } from './pinned-files'
import { feature as promptHistory } from './prompt-history'
import { feature as promptSnippets } from './prompt-snippets'
import { feature as protectSecrets } from './protect-secrets'
import { feature as secretMask } from './secret-mask'
import { feature as sessionMemory } from './session-memory'
import { feature as standup } from './standup'
import { feature as taskBoard } from './task-board'
import { feature as taskPulse } from './task-pulse'
import { feature as testOnChange } from './test-on-change'
import { feature as tldr } from './tldr'
import { feature as turnHistory } from './turn-history'
import { feature as turnSummary } from './turn-summary'
import { feature as uncommittedReminder } from './uncommitted-reminder'
import { feature as agentProfiler } from './agent-profiler'
import { feature as auroraBackdrop } from './aurora-backdrop'
import { feature as autoContinue } from './auto-continue'
import { feature as blastRadius } from './blast-radius'
import { feature as buddy } from './buddy'
import { feature as cacheCountdown } from './cache-countdown'
import { feature as claimCheck } from './claim-check'
import { feature as contextAquarium } from './context-aquarium'
import { feature as correctionCapture } from './correction-capture'
import { feature as decisionLedger } from './decision-ledger'
import { feature as diffReview } from './diff-review'
import { feature as dupReadDetector } from './dup-read-detector'
import { feature as idleHandoff } from './idle-handoff'
import { feature as injectionTripwire } from './injection-tripwire'
import { feature as liveTicker } from './live-ticker'
import { feature as loopDetective } from './loop-detective'
import { feature as mergeGate } from './merge-gate'
import { feature as outputArchive } from './output-archive'
import { feature as pastedSecretScan } from './pasted-secret-scan'
import { feature as planPace } from './plan-pace'
import { feature as scopeGuard } from './scope-guard'
import { feature as sessionFinder } from './session-finder'
import { feature as subagentGuard } from './subagent-guard'
import { feature as turnReceipt } from './turn-receipt'
import { feature as waitingAlert } from './waiting-alert'
import { feature as weekHeatmap } from './week-heatmap'
import { feature as budgetGuard } from './budget-guard'
import { feature as incidents } from './incidents'
import { feature as mondayReport } from './monday-report'
import { feature as onboarding } from './onboarding'
import { feature as profiles } from './profiles'
import { feature as projectConfig } from './project-config'
import { feature as savings } from './savings'
import { feature as sounds } from './sounds'
import { feature as themes } from './themes'
import { feature as updateCheck } from './update-check'
import { feature as achievements } from './achievements'
import { feature as shareCards } from './share-cards'
import { feature as efficiencyScore } from './efficiency-score'
import { feature as safetyReceipt } from './safety-receipt'
import { feature as demo } from './demo'

export type FeatureGroup = { title: Localized; features: Feature[] }

/** The features by group, in the order the switchboard lists them. */
export const groups: FeatureGroup[] = [
  {
    title: { en: 'Insight & tracking', he: 'מידע ומעקב', es: 'Información y seguimiento', fr: 'Informations et suivi', ru: 'Сведения и учёт', zh: '洞察与跟踪', ja: 'インサイトと記録', pt: 'Insights e acompanhamento', de: 'Einblick & Verfolgung', ko: '인사이트와 추적' },
    features: [advisor, taskPulse, costMeter, modelIndicator, errorCounter, turnSummary, filesTouched, bashLog, turnHistory, efficiencyScore],
  },
  {
    title: { en: 'Alerts', he: 'התרעות', es: 'Alertas', fr: 'Alertes', ru: 'Уведомления', zh: '提醒', ja: 'アラート', pt: 'Alertas', de: 'Hinweise', ko: '알림' },
    features: [doneNotify, longTurnToast, breakTimer],
  },
  {
    title: { en: 'Guardrails', he: 'שומרי סף', es: 'Barreras de seguridad', fr: 'Garde-fous', ru: 'Защита', zh: '防护', ja: 'ガードレール', pt: 'Proteções', de: 'Schutzgeländer', ko: '가드레일' },
    features: [protectSecrets, dangerousCommands, branchLock, secretMask, safetyReceipt],
  },
  {
    title: { en: 'Automation after actions', he: 'אוטומציה אחרי פעולות', es: 'Automatización tras acciones', fr: 'Automatisation après action', ru: 'Автоматизация после действий', zh: '操作后自动化', ja: '操作後の自動化', pt: 'Automação após ações', de: 'Automatik nach Aktionen', ko: '작업 후 자동화' },
    features: [autoFormat, lintAfterEdit, testOnChange, outputTrimmer, editUndo],
  },
  {
    title: { en: 'Workflow & commands', he: 'זרימת עבודה ופקודות', es: 'Flujo de trabajo y comandos', fr: 'Flux de travail et commandes', ru: 'Рабочий процесс и команды', zh: '工作流与命令', ja: 'ワークフローとコマンド', pt: 'Fluxo de trabalho e comandos', de: 'Workflow & Befehle', ko: '워크플로와 명령' },
    features: [standup, commitMsg, contextInfo, promptSnippets, gitContext, sessionMemory, pinnedFiles, promptHistory, promptEnhancer],
  },
  {
    title: { en: 'Panes & comfort', he: 'פאנלים ונוחות', es: 'Paneles y comodidad', fr: 'Panneaux et confort', ru: 'Панели и удобство', zh: '面板与便利', ja: 'ペインと快適さ', pt: 'Painéis e conforto', de: 'Panels & Komfort', ko: '패널과 편의' },
    features: [explainError, tldr, focusMode, taskBoard, agentsMonitor, notes, uncommittedReminder, dailyTotal, copyLast],
  },
  {
    title: { en: 'Quotas & cache', he: 'מכסות ו-cache', es: 'Cuotas y caché', fr: 'Quotas et cache', ru: 'Лимиты и кэш', zh: '配额与缓存', ja: 'クォータとキャッシュ', pt: 'Cotas e cache', de: 'Kontingente & Cache', ko: '할당량과 캐시' },
    features: [planPace, cacheCountdown, autoContinue, subagentGuard, idleHandoff, budgetGuard, savings],
  },
  {
    title: { en: 'Context hygiene', he: 'היגיינת הקשר', es: 'Higiene del contexto', fr: 'Hygiène du contexte', ru: 'Гигиена контекста', zh: '上下文整洁', ja: 'コンテキストの整理', pt: 'Higiene do contexto', de: 'Kontext-Hygiene', ko: '컨텍스트 정리' },
    features: [handoff, contextDoctor, dupReadDetector, outputArchive, correctionCapture],
  },
  {
    title: { en: 'More guardrails', he: 'עוד שומרי סף', es: 'Más barreras', fr: 'Autres garde-fous', ru: 'Ещё защита', zh: '更多防护', ja: 'その他のガード', pt: 'Mais proteções', de: 'Weitere Schutzmaßnahmen', ko: '추가 가드' },
    features: [errorDetective, loopDetective, scopeGuard, claimCheck, pastedSecretScan, mergeGate, injectionTripwire, blastRadius, incidents],
  },
  {
    title: { en: 'Visibility', he: 'נראות', es: 'Visibilidad', fr: 'Visibilité', ru: 'Наглядность', zh: '可见性', ja: '可視化', pt: 'Visibilidade', de: 'Sichtbarkeit', ko: '가시성' },
    features: [goalTracker, liveTicker, waitingAlert, agentProfiler, decisionLedger, diffReview, sessionFinder, mondayReport, missionControl, timeMachine, sessionReplay, taskEta],
  },
  {
    title: { en: 'Eye candy', he: 'ויזואלי', es: 'Visual', fr: 'Visuel', ru: 'Визуальное', zh: '视觉效果', ja: 'ビジュアル', pt: 'Visual', de: 'Optik', ko: '비주얼' },
    features: [buddy, turnReceipt, weekHeatmap, auroraBackdrop, contextAquarium, themes, sounds, achievements, shareCards],
  },
  {
    title: { en: 'Setup & maintenance', he: 'הגדרות ותחזוקה', es: 'Configuración y mantenimiento', fr: 'Configuration et maintenance', ru: 'Настройка и обслуживание', zh: '设置与维护', ja: '設定とメンテナンス', pt: 'Configuração e manutenção', de: 'Einrichtung & Wartung', ko: '설정과 유지보수' },
    features: [profiles, onboarding, projectConfig, updateCheck, selftest, doctor, about, demo],
  },
]

/** Every feature, flat, in listing order. */
export const features: Feature[] = groups.flatMap(g => g.features)
