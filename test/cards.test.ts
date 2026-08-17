/**
 * 글자 카드·보상 규칙 테스트 — `npm test`가 함께 돌린다.
 *
 * 보상은 눈으로 검증하기 어렵다: "합격선만 넘겨도 덤을 거의 다 받는" 종류의 잘못은
 * 화면을 몇 번 봐서는 안 보이고, 아이가 몇 주 놀아 본 뒤에야 "만점을 받아도 똑같다"로 드러난다.
 * 그래서 구간별 지급량을 숫자로 못 박아 둔다.
 */

// 이 파일은 최상위 await를 쓴다 → TS가 모듈로 보게 빈 export를 둔다
export {}

// node에는 localStorage가 없다 — cards/prefs가 저장에 쓰므로 최소한만 흉내낸다
{
  const mem = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  }
}

// **동적 import를 쓰는 이유**: cards/prefs가 모듈을 읽는 순간 localStorage를 만진다 →
// 위 폴리필이 먼저 실행되어야 하므로 정적 import로는 순서를 보장할 수 없다.
const cards = await import('../src/cards')
const { pickRewards, examRewardCount } = await import('../src/reward')
const { cvcWordsUpTo } = await import('../src/phonics')

let pass = 0
const fails: string[] = []

function check(name: string, fn: () => void): void {
  try {
    cards.resetAll()
    fn()
    pass++
    console.log(`  ok  ${name}`)
  } catch (e) {
    fails.push(`${name}: ${(e as Error).message}`)
    console.log(`FAIL  ${name}\n      ${(e as Error).message}`)
  }
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg)
}

console.log('\n글자 카드·보상 검사\n')

// ── 카드 보관과 낱말 완성 ────────────────────────────────────────────────
check('카드를 받으면 장수가 쌓인다', () => {
  cards.add('c')
  cards.add('c')
  cards.addMany(['a', 't'])
  assert(cards.count('c') === 2, `c가 ${cards.count('c')}장`)
  assert(cards.total() === 4, `총 ${cards.total()}장`)
  assert(cards.held().map((h) => h.letter).join('') === 'act', `순서: ${cards.held().map((h) => h.letter).join('')}`)
})

check('카드가 다 있으면 낱말을 만들 수 있고, 만들면 카드가 소모된다', () => {
  cards.addMany(['c', 'a', 't'])
  assert(cards.canComplete('cat'), 'cat을 만들 수 있어야 한다')
  assert(cards.completeWord('cat'), '완성이 되어야 한다')
  assert(cards.total() === 0, `카드가 남았다: ${cards.total()}장`)
  assert(cards.completedWords().join() === 'cat', `단어장: ${cards.completedWords().join()}`)
})

check('같은 글자가 두 번 필요한 낱말은 두 장이 있어야 한다', () => {
  // mum = m·u·m → m이 두 장 필요하다
  cards.addMany(['m', 'u'])
  assert(!cards.canComplete('mum'), 'm 한 장으로는 못 만들어야 한다')
  cards.add('m')
  assert(cards.canComplete('mum'), 'm 두 장이면 만들 수 있어야 한다')
})

check('이미 만든 낱말은 다시 만들지 않는다', () => {
  cards.addMany(['c', 'a', 't'])
  cards.completeWord('cat')
  cards.addMany(['c', 'a', 't'])
  assert(!cards.canComplete('cat'), '이미 만든 낱말이 또 만들어진다')
})

check('모자란 글자를 알려준다', () => {
  cards.addMany(['c'])
  const near = cards.nearlyWords(1, 2).find((x) => x.word.en === 'cat')
  assert(near !== undefined, 'cat이 "조금 모자란" 목록에 있어야 한다')
  assert(near!.missing.sort().join('') === 'at', `모자란 글자: ${near!.missing.join()}`)
})

check('카드 5장을 내면 원하는 글자 1장을 받는다', () => {
  cards.addMany(['x', 'x', 'x', 'x', 'x'])
  assert(cards.exchange(['x', 'x', 'x', 'x', 'x'], 'c'), '교환이 되어야 한다')
  assert(cards.count('c') === 1, 'c를 받아야 한다')
  assert(cards.count('x') === 0, `x가 남았다: ${cards.count('x')}장`)
})

check('5장이 아니면 교환하지 않는다', () => {
  cards.addMany(['x', 'x', 'x'])
  assert(!cards.exchange(['x', 'x', 'x'], 'c'), '3장으로 교환이 됐다')
  assert(cards.count('c') === 0, 'c를 받아 버렸다')
})

check('없는 카드로는 교환하지 않는다', () => {
  cards.addMany(['x', 'x'])
  assert(!cards.exchange(['x', 'x', 'x', 'x', 'x'], 'c'), '없는 카드로 교환이 됐다')
})

// ── 보상 고르기 ─────────────────────────────────────────────────────────
check('n장을 서로 다른 글자로 준다', () => {
  const got = pickRewards(1, 5)
  assert(got.length === 5, `${got.length}장을 줬다`)
  assert(new Set(got).size === 5, `같은 글자가 섞였다: ${got.join()}`)
})

check('0장을 달라고 하면 0장이다', () => {
  assert(pickRewards(1, 0).length === 0, '0장인데 카드가 나왔다')
  assert(pickRewards(1, -1).length === 0, '음수인데 카드가 나왔다')
})

check('보상은 그 단계 낱말에 쓰이는 글자에서 나온다 (카드가 뭉치도록)', () => {
  const letters = new Set(cvcWordsUpTo(1).flatMap((w) => w.en.split('')))
  const got = pickRewards(1, 8)
  const outside = got.filter((c) => !letters.has(c))
  assert(outside.length === 0, `낱말에 없는 글자가 나왔다: ${outside.join()}`)
})

check('거의 다 모은 낱말의 모자란 글자를 먼저 준다', () => {
  // cat에 c만 있다 → a나 t가 먼저 나와야 한다
  cards.addMany(['c'])
  const got = pickRewards(1, 1)
  assert(got.length === 1, `${got.length}장`)
  assert(got[0] === 'a' || got[0] === 't', `${got[0]}를 줬다 (a나 t여야 한다)`)
})

// ── 시험 보상: 합격선~만점 구간에 나눈다 ─────────────────────────────────
check('불합격이면 카드가 없다', () => {
  assert(examRewardCount(13, 20, 14, true) === 0, '떨어졌는데 카드를 줬다')
  assert(examRewardCount(0, 20, 14, true) === 0, '0점인데 카드를 줬다')
})

check('처음 합격은 기본 10장 + 합격선~만점 구간 최대 10장', () => {
  assert(examRewardCount(14, 20, 14, true) === 10, `합격선 딱: ${examRewardCount(14, 20, 14, true)}장 (10장이어야)`)
  assert(examRewardCount(17, 20, 14, true) === 15, `중간: ${examRewardCount(17, 20, 14, true)}장 (15장이어야)`)
  assert(examRewardCount(20, 20, 14, true) === 20, `만점: ${examRewardCount(20, 20, 14, true)}장 (20장이어야)`)
})

check('다시 본 시험은 기본 10장을 빼고 더 맞힌 만큼만 준다', () => {
  assert(examRewardCount(14, 20, 14, false) === 0, `합격선 딱: ${examRewardCount(14, 20, 14, false)}장 (0장이어야)`)
  assert(examRewardCount(20, 20, 14, false) === 10, `만점: ${examRewardCount(20, 20, 14, false)}장 (10장이어야)`)
})

check('보상이 합격선 근처에서 몰리지 않는다 (구간이 고르게 늘어난다)', () => {
  // 한자놀이에서 배운 것: 0점부터 나누면 합격만 해도 덤의 7할을 받아 만점의 의미가 사라진다
  const at = (score: number) => examRewardCount(score, 20, 14, false)
  const steps = [14, 15, 16, 17, 18, 19, 20].map(at)
  assert(steps.join() === '0,1,3,5,6,8,10', `구간 분배: ${steps.join()}`)
  for (let i = 1; i < steps.length; i++) {
    assert((steps[i] ?? 0) >= (steps[i - 1] ?? 0), '점수가 올랐는데 보상이 줄었다')
  }
})

console.log(`\n${pass}개 통과, ${fails.length}개 실패`)
if (fails.length) {
  console.log('\n실패 목록:')
  for (const f of fails) console.log(` - ${f}`)
  process.exit(1)
}
