/**
 * 오답 보기 만들기 — 손으로 적지 않고 계산한다.
 *
 * 아무 낱말이나 섞으면 아이가 **소리를 안 듣고도 그림만 보고 맞힌다**(cat 문제에 monkey·zoo가
 * 보기로 나오면 c 소리를 들을 필요가 없다). 그래서 한 소리만 다른 낱말(minimal pair)을 먼저 고른다:
 * cat ↔ cap·bat·cut. 이게 파닉스 문제를 실제로 소리 문제로 만든다.
 */
import { segment } from './phonics'
import { shuffle } from './rand'
import type { Word } from './data/types'

/** 두 낱말이 그래핌 하나만 다른가 (같은 자리, 같은 개수) */
export function isMinimalPair(a: string, b: string): boolean {
  if (a === b) return false
  const sa = segment(a)
  const sb = segment(b)
  if (!sa || !sb || sa.length !== sb.length) return false
  let diff = 0
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) diff++
  return diff === 1
}

/**
 * 보기 만들기 — 최소대조쌍 → 같은 모음 → 나머지 순으로 채운다.
 * 정답은 포함하지 않는다(부르는 쪽에서 합쳐 섞는다).
 *
 * @param rng 0~1 난수. 테스트에서 고정값을 넣어 결과를 재현할 수 있게 밖에서 받는다.
 */
export function distractors(target: Word, pool: Word[], count: number, rng: () => number = Math.random): Word[] {
  const rest = pool.filter((w) => w.en !== target.en)
  const minimal = rest.filter((w) => isMinimalPair(target.en, w.en))
  const sameVowel = rest.filter((w) => !minimal.includes(w) && w.en[1] === target.en[1])
  const others = rest.filter((w) => !minimal.includes(w) && !sameVowel.includes(w))

  const picked: Word[] = []
  for (const group of [minimal, sameVowel, others]) {
    for (const w of shuffle(group, rng)) {
      if (picked.length >= count) break
      if (!picked.some((p) => p.en === w.en)) picked.push(w)
    }
  }
  return picked
}

/** 정답 하나 + 오답 3개를 섞은 4지선다 보기 */
export function choices(target: Word, pool: Word[], rng: () => number = Math.random): Word[] {
  return shuffle([target, ...distractors(target, pool, 3, rng)], rng)
}

export { shuffle }
