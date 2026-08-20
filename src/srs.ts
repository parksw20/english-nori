/**
 * 간격 반복(SRS) — 낱말 하나가 도감의 카드 한 장.
 *
 * 한자놀이 `src/srs.ts`에서 이식했다(한자 한 글자 → 영어 낱말 하나, 정원 → 도감).
 * 파닉스도 누적형이다: 단모음 마을에 가도 알파벳 소리를 계속 써야 하므로
 * 새로 배우는 것보다 안 잊는 것이 어렵다.
 * SM-2를 아이용으로 줄였다: 등급은 3단계(틀림/맞음/척척)뿐이고 간격 상한을 둔다.
 */

import { shuffle } from './rand'

const KEY = 'yeongeo-nori.srs.v1'
const DAY = 24 * 60 * 60 * 1000

/** 낱말 하나의 학습 상태 */
export interface CardState {
  /** 연속 정답 횟수 (틀리면 0으로) */
  reps: number
  /** 난이도 계수 (1.3 ~ 2.8). 낮을수록 자주 나온다 */
  ease: number
  /** 다음 복습까지 며칠 */
  interval: number
  /** 다음 복습 예정 시각 (epoch ms) */
  due: number
  /** 누적 정답/오답 */
  right: number
  wrong: number
  /**
   * 여태 도달한 가장 긴 복습 간격.
   *
   * 도감 카드의 단계는 **이 값**으로 정한다. interval로 정하면 한 번 틀렸을 때
   * 반짝이던 카드가 흑백으로 되돌아간다 — 아이 입장에서는 모은 것을 빼앗기는 일이라 납득이 안 된다.
   * 모은 것은 그대로 두고, 복습이 밀린 것은 "색이 빠짐"으로 따로 알린다.
   */
  peak?: number
}

export type Answer = 'wrong' | 'right' | 'easy'

/**
 * 도감 카드 단계 — 화면에 보여주는 값.
 * 흑백(gray) → 색이 들어옴(color) → 또렷함(clear) → 반짝임(shiny) → 금카드(gold)
 */
export type CardLevel = 'gray' | 'color' | 'clear' | 'shiny' | 'gold'

/**
 * 아이에게 보여주는 단계 이름 — **씨앗에서 꽃까지**.
 *
 * 색만으로는 "흑백 < 색 < 또렷 < 반짝 < 금"이라는 순서를 아이가 알 수 없다(색에는 순서가 없다).
 * 씨앗→새싹→풀→나무→꽃은 7세가 이미 아는 순서라 설명이 필요 없고, 심어 놓고 기르는 것이라
 * "빼앗기지 않는다"는 규칙(levelOf가 peak를 쓰는 이유)과도 이야기가 맞는다.
 */
export const GROWTH: Record<CardLevel, { icon: string; name: string }> = {
  gray: { icon: '·', name: '씨앗' },
  color: { icon: '🌱', name: '새싹' },
  clear: { icon: '🌿', name: '풀' },
  shiny: { icon: '🌳', name: '나무' },
  gold: { icon: '🌸', name: '꽃' },
}

/** 그 낱말이 지금 어디까지 자랐나 */
export function growthOf(word: string): { icon: string; name: string } {
  return GROWTH[levelOf(word)]
}

type Store = Record<string, CardState>

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function save(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* 사생활 모드 등에서 저장이 막혀도 게임은 돌아가야 한다 */
  }
}

let store: Store = load()

/** 저장소를 다시 읽어 온다 — 기록을 불러온 직후처럼 밖에서 값이 바뀐 경우 */
export function reload(): void {
  store = load()
}

function fresh(): CardState {
  return { reps: 0, ease: 2.5, interval: 0, due: 0, right: 0, wrong: 0, peak: 0 }
}

export function stateOf(word: string): CardState {
  return store[word] ?? fresh()
}

/** 아직 한 번도 본 적 없는 낱말인가 */
export function isNew(word: string): boolean {
  return !store[word]
}

/**
 * 답을 채점해 다음 복습일을 정한다.
 * 아이가 지루해하지 않도록 간격 상한은 60일.
 */
export function review(word: string, answer: Answer, now = Date.now()): CardState {
  const c = { ...stateOf(word) }
  // 지금까지 자란 정도는 **간격을 건드리기 전에** 챙겨 둔다.
  // (peak가 없는 예전 기록은 현재 간격이 곧 자란 정도다 — 나중에 읽으면 0으로 덮인다)
  const grown = Math.max(c.peak ?? 0, c.interval)

  if (answer === 'wrong') {
    c.reps = 0
    c.interval = 0 // 오늘 안에 다시 나온다
    c.ease = Math.max(1.3, c.ease - 0.2)
    c.wrong++
  } else {
    c.reps++
    c.right++
    if (answer === 'easy') c.ease = Math.min(2.8, c.ease + 0.1)
    if (c.reps === 1) c.interval = 1
    else if (c.reps === 2) c.interval = 3
    else c.interval = Math.min(60, Math.round(c.interval * c.ease))
  }

  // 자란 만큼은 남긴다 — 틀렸다고 꽃이 새싹으로 되돌아가지는 않는다
  c.peak = Math.max(grown, c.interval)
  c.due = now + c.interval * DAY
  store[word] = c
  save(store)
  return c
}

/** 오늘 다시 볼 낱말들 (복습 기한이 지난 것) */
export function dueWords(all: string[], now = Date.now()): string[] {
  return all.filter((c) => {
    const s = store[c]
    return s !== undefined && s.due <= now
  })
}

/** 아직 안 배운 낱말들 */
export function newWords(all: string[]): string[] {
  return all.filter((c) => !store[c])
}

/**
 * 도감 카드 단계 — **한 번 올라가면 되돌아가지 않는다.**
 * 지금 간격(interval)이 아니라 여태 도달한 최대 간격(peak)으로 정한다.
 * 틀려서 복습이 앞당겨진 것은 단계 후퇴가 아니라 "색이 빠짐"으로 표시한다(isFaded).
 */
export function levelOf(word: string): CardLevel {
  const s = store[word]
  if (!s) return 'gray'
  const grown = Math.max(s.peak ?? 0, s.interval)
  if (grown < 3) return 'color'
  if (grown < 10) return 'clear'
  if (grown < 30) return 'shiny'
  return 'gold'
}

/** 색이 빠졌나 — 복습 기한이 이틀 넘게 지났으면 */
export function isFaded(word: string, now = Date.now()): boolean {
  const s = store[word]
  return !!s && s.due > 0 && now - s.due > 2 * DAY
}

export interface Summary {
  total: number
  learned: number
  due: number
  mastered: number
}

export function summary(all: string[], now = Date.now()): Summary {
  return {
    total: all.length,
    learned: all.filter((c) => store[c] !== undefined).length,
    due: dueWords(all, now).length,
    mastered: all.filter((c) => (store[c]?.interval ?? 0) >= 10).length,
  }
}

/**
 * 이번 판에 낼 낱말을 고른다.
 * 복습 기한이 지난 것 우선 → 모자라면 새 낱말 → 그래도 모자라면 아무거나.
 * 새 낱말을 한 판에 몰아 넣으면 7세는 5분 만에 지친다 → maxNew로 제한(기본 4개).
 */
export function pickSession(all: string[], count: number, maxNew = 4, now = Date.now()): string[] {
  const due = dueWords(all, now)
  const fresh_ = newWords(all).slice(0, maxNew)
  const picked = [...due, ...fresh_].slice(0, count)

  if (picked.length < count) {
    const rest = all.filter((c) => !picked.includes(c))
    // 덜 익은 것부터 채운다
    rest.sort((a, b) => (store[a]?.interval ?? 0) - (store[b]?.interval ?? 0))
    picked.push(...rest.slice(0, count - picked.length))
  }
  return shuffle(picked)
}

/** 전체 초기화 (설정 화면용) */
export function resetAll(): void {
  store = {}
  save(store)
}
