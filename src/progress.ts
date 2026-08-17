/**
 * 수료증·최고기록·스티커 같은 "모으는 것"들. SRS와 달리 한 번 얻으면 안 사라진다.
 * 한자놀이 `src/progress.ts`에서 이식했다 (급수증 → 단계 수료증).
 */
import type { StageId } from './data/types'
import { MAX_STAGE } from './data/types'

const KEY = 'yeongeo-nori.progress.v1'

/**
 * 오늘 날짜 키 (YYYY-MM-DD) — **그 지역의 날짜**로 만든다.
 *
 * `new Date().toISOString()`을 쓰면 UTC 날짜가 나온다. 한국(UTC+9)에서는 아침 9시 이전에
 * 어제 날짜가 찍혀서, 아침에 놀면 "어제 이미 놀았다"가 되고 연속일수도 어긋난다.
 * (실제로 부모 화면이 "연속 0일"로 나오는 것을 브라우저 검증에서 발견했다.)
 */
export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 시험에서 틀린 문제 한 건 (부모 화면에 보여줄 최소 정보만 남긴다) */
export interface ExamMiss {
  answer: string
  chosen: string
  word?: string
}

export interface ExamRecord {
  /** 맞힌 문항 수 */
  score: number
  /** 총 문항 수 */
  total: number
  passed: boolean
  /** 걸린 시간(초) */
  seconds: number
  /** 언제 (epoch ms) */
  at: number
  stage: StageId
  /** 틀린 문제들 (예전 기록에는 없다) */
  misses?: ExamMiss[]
}

/**
 * 한 번 보고 나면 다시 볼 때까지 기다리는 시간.
 *
 * 시험이 곧 게임의 보상 구간이라, 떨어지면 바로 다시 눌러 반복하게 된다.
 * 그러면 문제를 외워서 찍게 되고 복습은 건너뛴다. 사이에 쉬는 시간을 두어
 * "틀린 것부터 다시 보고 오라"는 뜻을 준다. 7세 기준이라 한자놀이(10분)보다 짧게 둔다.
 */
export const EXAM_COOLDOWN_MS = 5 * 60 * 1000

export interface Progress {
  /** 미니게임별 최고 점수 */
  best: Record<string, number>
  /** 단계 시험 기록 (최신이 앞) */
  exams: ExamRecord[]
  /** 획득한 단계 수료증 */
  certificates: StageId[]
  /** 모은 스티커 (하루 한 세션을 끝내면 한 장) */
  stickers: string[]
  /** 세션을 끝낸 날짜들 (YYYY-MM-DD) — 부모 리포트와 연속일수에 쓴다 */
  days: string[]
}

function empty(): Progress {
  return { best: {}, exams: [], certificates: [], stickers: [], days: [] }
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty(), ...JSON.parse(raw) }
  } catch {
    /* 무시 */
  }
  return empty()
}

let p: Progress = load()

export function reload(): void {
  p = load()
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* 사생활 모드 등에서 저장이 막혀도 놀이는 돌아가야 한다 */
  }
}

export function get(): Progress {
  return p
}

/**
 * 최고 점수 갱신 (많을수록 좋은 것: 맞힌 문항 수). 새 기록이면 true.
 *
 * **0점은 기록으로 치지 않는다.** 첫 판에서 0점을 냈을 때 `0 > -1`이라 "최고 기록!"이 떴는데,
 * 아이가 한 문제도 못 맞히고 축하를 받는 것은 말이 안 된다.
 */
export function recordBest(gameId: string, score: number): boolean {
  if (score <= 0) return false
  if (score > (p.best[gameId] ?? -1)) {
    p.best[gameId] = score
    save()
    return true
  }
  return false
}

export function bestOf(gameId: string): number {
  return p.best[gameId] ?? 0
}

/**
 * **적을수록 좋은 기록**(걸린 시간, 뒤집은 횟수)은 따로 다룬다.
 *
 * 처음에는 사천성 기록을 `300 - 걸린초`로 저장해 점수처럼 만들었는데,
 * 저장된 값이 275 같은 숫자여서 **사람이 읽을 수도, 화면에 그대로 쓸 수도 없었다.**
 * 있는 그대로(25초) 저장하고 작은 값이 이기게 한다. 키를 `time:`으로 나눠 예전 값과 섞이지 않게 한다.
 */
export function recordBestTime(gameId: string, value: number): boolean {
  const key = `time:${gameId}`
  const cur = p.best[key]
  if (cur === undefined || value < cur) {
    p.best[key] = value
    save()
    return true
  }
  return false
}

/** 적을수록 좋은 기록. 아직 없으면 null */
export function bestTimeOf(gameId: string): number | null {
  return p.best[`time:${gameId}`] ?? null
}

export function recordExam(r: ExamRecord): void {
  p.exams.unshift(r)
  p.exams = p.exams.slice(0, 20)
  if (r.passed && !p.certificates.includes(r.stage)) p.certificates.push(r.stage)
  save()
}

export function hasCertificate(stage: StageId): boolean {
  return p.certificates.includes(stage)
}

/** 앞 단계에 합격했으면 열린다. 첫 단계는 늘 열려 있다. */
export function isUnlocked(stage: StageId): boolean {
  if (stage <= 0) return true
  return hasCertificate((stage - 1) as StageId)
}

/** 지금까지 연 가장 높은 단계 */
export function topUnlockedStage(): StageId {
  let top: StageId = 0
  for (let s = 0 as StageId; s <= MAX_STAGE; s = (s + 1) as StageId) if (isUnlocked(s)) top = s
  return top
}

/** 그 단계 시험을 다시 볼 수 있을 때까지 남은 시간(ms). 0이면 지금 볼 수 있다. */
export function examCooldownLeft(stage: StageId, now = Date.now()): number {
  const last = p.exams.find((e) => e.stage === stage)
  if (!last) return 0
  return Math.max(0, last.at + EXAM_COOLDOWN_MS - now)
}

/**
 * 오늘 세션을 끝냈다고 기록하고 스티커를 한 장 준다.
 * 하루에 여러 번 놀아도 스티커는 하루 한 장 — 오래 붙잡아 두는 것이 목표가 아니다.
 */
export function finishSession(today: string, sticker: string): boolean {
  if (p.days.includes(today)) return false
  p.days.push(today)
  p.stickers.push(sticker)
  save()
  return true
}

/** 며칠 연속으로 놀았나 */
export function streak(today: string = dayKey()): number {
  const set = new Set(p.days)
  let n = 0
  // 지역 날짜로 하루씩 거슬러 올라간다 (toISOString을 쓰면 UTC로 밀려 첫날부터 끊긴다)
  const d = new Date(`${today}T00:00:00`)
  while (set.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export function resetAll(): void {
  p = empty()
  save()
}
