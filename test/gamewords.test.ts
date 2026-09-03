/**
 * 마을별 놀이 낱말 섞기 테스트 — `npm test`가 함께 돌린다.
 *
 * "7번 마을에서도 cat·dog만 나온다"는 눈으로는 몇 판을 봐야 드러난다.
 * 비율(지금 마을 5 · 앞 마을 3 · 전전 마을 2)을 숫자로 못 박는다.
 */

export {}

const { gameWordsFor, stageOf } = await import('../src/phonics')

let pass = 0
const fails: string[] = []

function check(name: string, fn: () => void): void {
  try {
    fn()
    pass++
    console.log(`  ok  ${name}`)
  } catch (e) {
    fails.push(`${name}: ${(e as Error).message}`)
    console.log(`  FAIL ${name} — ${(e as Error).message}`)
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

console.log('\n마을별 놀이 낱말 검사\n')

check('7번 마을(단계 6)의 낱말은 지금 5 · 앞 3 · 전전 2 비율로 섞인다', () => {
  const pool = gameWordsFor(6, { count: 20, rng: seeded(1) })
  const by = (s: number) => pool.filter((w) => w.stage === s).length
  assert(pool.length === 20, `낱말 ${pool.length}개 (20개여야)`)
  assert(by(6) === 10, `지금 마을 ${by(6)}개 (10개여야)`)
  assert(by(5) === 6, `앞 마을 ${by(5)}개 (6개여야)`)
  assert(by(4) === 4, `전전 마을 ${by(4)}개 (4개여야)`)
})

check('3번 마을(단계 2)은 전전 마을이 알파벳 마을 — 비율을 있는 쪽에 다시 나눈다', () => {
  const pool = gameWordsFor(2, { count: 20, rng: seeded(2) })
  const by = (s: number) => pool.filter((w) => w.stage === s).length
  assert(by(2) >= 9, `지금 마을 ${by(2)}개 (절반은 돼야)`)
  assert(by(1) + by(0) >= 8, `앞 마을들 ${by(1) + by(0)}개`)
  assert(pool.every((w) => w.stage <= 2), '뒤 마을 낱말이 섞였다')
})

check('그림 놀이용은 그림으로 알아볼 수 있고, 그 단계에서 읽을 수 있는 낱말만이다', () => {
  for (const stage of [2, 4, 6, 9] as const) {
    const pool = gameWordsFor(stage, { picturable: true, maxLen: 6, count: 24, rng: seeded(stage) })
    assert(pool.every((w) => !w.abstract), `단계 ${stage}: 그림으로 알 수 없는 낱말이 있다`)
    assert(pool.every((w) => stageOf(w.en) <= stage), `단계 ${stage}: 아직 못 읽는 낱말이 있다`)
    assert(pool.every((w) => w.en.length <= 6 && !w.en.includes(' ')), `단계 ${stage}: 6글자를 넘는 낱말이 있다`)
    assert(new Set(pool.map((w) => w.en)).size === pool.length, `단계 ${stage}: 낱말이 겹친다`)
  }
})

check('판마다 다른 낱말이 나온다 (같은 마을에서 여러 판)', () => {
  const a = gameWordsFor(5, { count: 12, rng: seeded(10) }).map((w) => w.en).join()
  const b = gameWordsFor(5, { count: 12, rng: seeded(11) }).map((w) => w.en).join()
  assert(a !== b, '두 판의 낱말이 똑같다')
})

check('all은 세 마을의 낱말을 섞지 않고 전부 준다 (단어장 목록용)', () => {
  const x = gameWordsFor(6, { all: true }).map((w) => w.en).join()
  const y = gameWordsFor(6, { all: true }).map((w) => w.en).join()
  assert(x === y, '열 때마다 순서가 바뀐다')
  assert(gameWordsFor(6, { all: true }).every((w) => w.stage >= 4 && w.stage <= 6), '세 마을 밖의 낱말이 있다')
})

console.log(`\n${pass}개 통과, ${fails.length}개 실패`)
if (fails.length) {
  console.log('\n실패 목록:')
  for (const f of fails) console.log(` - ${f}`)
  process.exit(1)
}
