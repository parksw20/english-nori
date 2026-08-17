/**
 * 섞기 — SRS와 문제 생성 양쪽에서 쓴다.
 *
 * rng를 밖에서 받는 것은 **테스트가 같은 결과를 재현할 수 있어야** 하기 때문이다.
 * (시험 생성 테스트가 난수를 고정해 같은 시험을 다시 만든다)
 */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const ai = a[i] as T
    const aj = a[j] as T
    a[i] = aj
    a[j] = ai
  }
  return a
}
