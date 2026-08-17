/**
 * 글자 카드 — 놀이를 하면 한 장씩 나온다. 한자놀이의 「한자 카드」를 옮긴 것.
 *
 * 한자놀이는 한자 카드로 한자어(外國)를 만들었다. 영어에서는 **글자 카드로 낱말을 만든다**:
 * `c` + `a` + `t` → cat. 그래서 이 보상 자체가 **스펠링 연습**이 된다 —
 * 소리를 아는 낱말을 글자로 조립해 봐야 쓰기로 넘어갈 수 있다.
 *
 * 카드는 두 가지로 쓴다:
 *   1. **낱말 완성** — c 2장·a 1장·t 1장이면 cat과 act… 는 아니고 cat을 만든다. 만들면 카드는 소모된다.
 *   2. **교환** — 쓸 데 없는 카드가 5장 모이면 원하는 글자 1장으로 바꾼다.
 *      (같은 글자 5장이든 서로 다른 5장이든 상관없다 — 아이가 "이건 못 쓰는 카드"에 막히지 않게)
 */
import type { StageId, Word } from './data/types'
import { cvcWordsUpTo } from './phonics'

const KEY = 'yeongeo-nori.cards.v1'

/** 카드 5장이면 원하는 카드 1장과 바꾼다 */
export const EXCHANGE_COST = 5

interface Store {
  /** 글자 → 가진 장수 */
  cards: Record<string, number>
  /** 완성한 낱말 */
  words: string[]
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { cards: {}, words: [], ...JSON.parse(raw) }
  } catch {
    /* 무시 */
  }
  return { cards: {}, words: [] }
}

let store: Store = load()

/** 저장소를 다시 읽어 온다 — 기록을 불러온 직후처럼 밖에서 값이 바뀐 경우 */
export function reload(): void {
  store = load()
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* 저장이 막혀도 이번 판은 돌아간다 */
  }
}

export function count(letter: string): number {
  return store.cards[letter] ?? 0
}

/** 가진 카드 총 장수 */
export function total(): number {
  return Object.values(store.cards).reduce((a, b) => a + b, 0)
}

/** 가진 카드를 알파벳 순서로 */
export function held(): { letter: string; n: number }[] {
  return Object.entries(store.cards)
    .filter(([, n]) => n > 0)
    .map(([letter, n]) => ({ letter, n }))
    .sort((a, b) => a.letter.localeCompare(b.letter))
}

export function add(letter: string, n = 1): void {
  store.cards[letter] = count(letter) + n
  save()
}

/** 여러 장을 한 번에 (저장은 한 번만 한다) */
export function addMany(letters: string[]): void {
  for (const c of letters) store.cards[c] = (store.cards[c] ?? 0) + 1
  save()
}

/** 낱말에 필요한 글자별 장수 */
export function need(word: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of word) m.set(c, (m.get(c) ?? 0) + 1)
  return m
}

export function canComplete(word: string): boolean {
  if (store.words.includes(word)) return false // 이미 만든 낱말은 다시 안 만든다
  for (const [c, n] of need(word)) if (count(c) < n) return false
  return true
}

/** 낱말을 만든다 — 카드를 소모하고 단어장에 넣는다 */
export function completeWord(word: string): boolean {
  if (!canComplete(word)) return false
  for (const [c, n] of need(word)) {
    store.cards[c] = count(c) - n
    if ((store.cards[c] ?? 0) <= 0) delete store.cards[c]
  }
  store.words.push(word)
  save()
  return true
}

export function completedWords(): string[] {
  return store.words
}

export function hasWord(word: string): boolean {
  return store.words.includes(word)
}

/**
 * 카드 5장을 내고 원하는 글자 1장을 받는다.
 * `give`는 낼 카드 목록(같은 글자가 여러 번 들어올 수 있다).
 */
export function exchange(give: string[], want: string): boolean {
  if (give.length !== EXCHANGE_COST) return false

  const spend = new Map<string, number>()
  for (const c of give) spend.set(c, (spend.get(c) ?? 0) + 1)
  for (const [c, n] of spend) if (count(c) < n) return false

  for (const [c, n] of spend) {
    store.cards[c] = count(c) - n
    if ((store.cards[c] ?? 0) <= 0) delete store.cards[c]
  }
  add(want, 1) // add가 save까지 한다
  return true
}

/**
 * 카드로 만들 수 있는 낱말의 대상.
 *
 * **읽을 수 있는 낱말(CVC)만** 대상으로 둔다 — 아직 읽지 못하는 umbrella를 글자로 조립하라는 것은
 * 소리와 글자를 잇는 연습이 아니라 그림 맞추기가 된다.
 */
export function buildableTargets(stage: StageId): Word[] {
  return cvcWordsUpTo(stage)
}

/** 지금 만들 수 있는 낱말들 */
export function completableWords(stage: StageId): Word[] {
  return buildableTargets(stage).filter((w) => canComplete(w.en))
}

/** 카드가 조금 모자란 낱말들 — "무엇을 더 모으면 되는지" 보여 주려고 */
export function nearlyWords(stage: StageId, maxMissing = 2): { word: Word; missing: string[] }[] {
  return buildableTargets(stage)
    .filter((w) => !hasWord(w.en) && !canComplete(w.en))
    .map((w) => {
      const missing: string[] = []
      for (const [c, n] of need(w.en)) {
        for (let i = count(c); i < n; i++) missing.push(c)
      }
      return { word: w, missing }
    })
    .filter((x) => x.missing.length > 0 && x.missing.length <= maxMissing)
    .sort((a, b) => a.missing.length - b.missing.length)
}

export function resetAll(): void {
  store = { cards: {}, words: [] }
  save()
}
