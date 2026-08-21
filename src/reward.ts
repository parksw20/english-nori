/**
 * 글자 카드 보상 고르기 — 한자놀이 `reward.ts`의 규칙을 그대로 옮겼다.
 *
 * 알파벳에서 균등하게 뽑으면 카드가 흩어져 낱말이 영영 안 모인다.
 * **낱말을 먼저 고르고 그 안의 한 글자**를 주면 카드가 저절로 낱말 주위에 뭉친다.
 * 여러 장을 줄 때는 서로 다른 글자로 준다 — 같은 글자만 잔뜩 나오면 받은 느낌이 안 난다.
 *
 * 그리고 **지금 조금만 더 모으면 완성되는 낱말**을 먼저 본다. 그러면 받은 카드가
 * 바로 낱말이 되는 경험으로 이어져 "모으는 재미"가 실제로 굴러간다.
 */
import * as cards from './cards'
import type { StageId } from './data/types'
import { shuffle } from './rand'

/**
 * n장을 **서로 다른 글자로** 뽑는다.
 *
 * 순서: ①거의 완성된 낱말에 모자란 글자 → ②그 단계 낱말에서 아무 글자 → ③알파벳에서
 * (①이 없으면 ②로 넘어가고, 낱말이 모자라면 ③으로 채운다)
 */
export function pickRewards(stage: StageId, n: number, rng: () => number = Math.random): string[] {
  // 0장을 달라고 하면 0장이어야 한다 (합격선에 딱 걸친 재응시가 실제로 0장을 요청한다)
  if (n <= 0) return []
  const picked: string[] = []
  const seen = new Set<string>()

  const take = (letter: string): boolean => {
    if (seen.has(letter)) return false
    seen.add(letter)
    picked.push(letter)
    return picked.length >= n
  }

  // ① 거의 다 모은 낱말에 모자란 글자부터 (받은 카드가 바로 낱말이 되게)
  for (const { missing } of cards.nearlyWords(stage, 2)) {
    for (const c of missing) if (take(c)) return picked
  }

  // ② 그 단계 낱말 안의 글자 (카드가 낱말 주위에 뭉치도록)
  for (const w of shuffle(cards.buildableTargets(stage), rng)) {
    for (const c of shuffle([...w.en], rng)) if (take(c)) return picked
  }

  // ③ 그래도 모자라면 알파벳에서
  for (const c of shuffle('abcdefghijklmnopqrstuvwxyz'.split(''), rng)) {
    if (take(c)) break
  }
  return picked
}

/**
 * 시험 보상 — **합격선부터 만점까지**를 나눠 준다.
 *
 * 한자놀이에서 배운 것: 성과 비례 보상을 0점부터 나누면 합격선만 넘겨도 덤의 7할을 받아 버려,
 * 정작 아이가 애쓰는 구간(합격선~만점)에서 차이가 안 난다.
 *
 * @param first 이 단계 시험을 **처음** 합격했는가 (처음이면 기본 보상을 얹는다)
 */
export function examRewardCount(score: number, total: number, pass: number, first: boolean): number {
  if (score < pass) return 0
  const base = first ? 10 : 0
  const span = total - pass
  const extra = span <= 0 ? 10 : Math.floor(((score - pass) / span) * 10)
  return base + extra
}

/**
 * 사천성 보상 — **남은 하트(기회)로만** 정한다.
 *
 *   하트 5개 → 3장 · 3~4개 → 2장 · 1~2개 → 1장 · 0개 → 없음
 *
 * 판 크기로 주던 것을 바꿨다. 큰 판을 고르는 것은 아이가 잘해서가 아니라 그냥 고른 것이라
 * 노력과 보상이 어긋났다. 하트는 **틀린 짝을 고를 때만** 줄어드니 "조심해서 잘 골랐다"와 정확히 같은 값이고,
 * 하트가 화면 위에 내내 떠 있어서 아이가 보상이 줄어드는 것을 실시간으로 본다.
 */
export function shisenRewardCount(hearts: number): number {
  if (hearts >= 5) return 3
  if (hearts >= 3) return 2
  if (hearts >= 1) return 1
  return 0
}
