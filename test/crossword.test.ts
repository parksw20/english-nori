/**
 * 가로세로 판 규칙 테스트 — `npm test`가 함께 돌린다.
 *
 * 십자말은 화면으로 검증하기 가장 어렵다: 낱말이 나란히 붙어 버려도 판은 멀쩡해 보이는데
 * 아이는 "cat 옆에 bat"을 catbat으로 읽는다. 그래서 배치 규칙을 숫자로 못 박는다.
 */

export {}

const { build, canPlace, connected, makePuzzle, LEVELS, levelOf } = await import('../src/crossword')
const { picturableUpTo, stageOf } = await import('../src/phonics')
const { WORDS } = await import('../src/data/words')

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

/** 시험용 난수 — 같은 판을 다시 만들 수 있어야 실패를 재현한다 */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function gridOf(rows: string[]): (string | null)[][] {
  return rows.map((r) => [...r].map((c) => (c === '.' ? null : c)))
}

console.log('\n가로세로 판 검사\n')

check('빈 판에는 어디에나 놓을 수 있다', () => {
  const g = gridOf(['.....', '.....', '.....', '.....', '.....'])
  assert(canPlace(g, 'cat', 1, 1, 'across'), '빈 판인데 못 놓는다')
  assert(canPlace(g, 'cat', 1, 1, 'down'), '빈 판인데 세로로 못 놓는다')
})

check('판 밖으로 나가면 못 놓는다', () => {
  const g = gridOf(['.....', '.....', '.....', '.....', '.....'])
  assert(!canPlace(g, 'cat', 1, 3, 'across'), '오른쪽으로 넘치는데 놓였다')
  assert(!canPlace(g, 'cat', 3, 1, 'down'), '아래로 넘치는데 놓였다')
  assert(!canPlace(g, 'cat', 0, -1, 'across'), '왼쪽 밖인데 놓였다')
})

check('같은 글자에서 겹쳐 놓을 수 있다', () => {
  // 가운데 줄에 cat이 놓여 있다 (1,1)~(1,3)
  const g = gridOf(['.....', '.cat.', '.....', '.....', '.....'])
  // a에서 세로로 만나는 bat
  assert(canPlace(g, 'bat', 0, 2, 'down'), 'a에서 세로로 겹쳐 놓을 수 있어야 한다')
})

check('다른 글자 위에는 못 놓는다', () => {
  const g = gridOf(['.....', '.cat.', '.....', '.....', '.....'])
  assert(!canPlace(g, 'dog', 1, 1, 'across'), '다른 글자 위에 덮어썼다')
})

check('낱말 앞뒤가 붙으면 못 놓는다 (catbat 방지)', () => {
  const g = gridOf(['.....', '.cat.', '.....', '.....', '.....'])
  // cat 바로 뒤에 이어 붙는 자리
  assert(!canPlace(g, 'bat', 1, 4, 'across'), 'cat 뒤에 바로 붙었다')
})

check('나란히 옆줄에 붙으면 못 놓는다 (읽히지 않는 덩어리 방지)', () => {
  const g = gridOf(['.....', '.cat.', '.....', '.....', '.....'])
  assert(!canPlace(g, 'bat', 2, 1, 'across'), 'cat 바로 아래에 나란히 놓였다')
  assert(!canPlace(g, 'bat', 0, 1, 'across'), 'cat 바로 위에 나란히 놓였다')
})

check('겹치는 칸의 양옆은 검사하지 않는다 (십자로 지나는 것은 정상)', () => {
  const g = gridOf(['.....', '.cat.', '.....', '.....', '.....'])
  // c에서 세로로 내려가는 cup — c 칸은 겹치는 칸이라 양옆(a)이 있어도 된다
  assert(canPlace(g, 'cup', 1, 1, 'down'), '십자로 지나가는 낱말이 막혔다')
})

check('판을 짜면 낱말이 서로 이어진다 (섬이 없다)', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const p = build(['cat', 'hat', 'sock', 'duck', 'hand', 'milk'], 9, seeded(seed))
    assert(p.words.length >= 2, `seed ${seed}: 낱말이 ${p.words.length}개만 놓였다`)
    assert(connected(p), `seed ${seed}: 떨어진 낱말이 있다`)
  }
})

check('놓인 낱말은 판의 글자와 일치한다', () => {
  const p = build(['sock', 'clock', 'duck', 'hand', 'milk', 'candy'], 11, seeded(7))
  for (const w of p.words) {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.row + (w.dir === 'down' ? i : 0)
      const c = w.col + (w.dir === 'across' ? i : 0)
      assert(p.cells[r]?.[c] === w.word[i], `${w.word}의 ${i}번째 글자가 판과 다르다`)
    }
  }
})

check('빈 테두리는 잘려 있다', () => {
  const p = build(['cat', 'hat', 'sock'], 15, seeded(3))
  const rowFilled = (r: number): boolean => (p.cells[r] ?? []).some((c) => c !== null)
  const colFilled = (c: number): boolean => p.cells.some((row) => row[c] !== null)
  assert(rowFilled(0) && rowFilled(p.rows - 1), '위나 아래에 빈 줄이 남아 있다')
  assert(colFilled(0) && colFilled(p.cols - 1), '왼쪽이나 오른쪽에 빈 줄이 남아 있다')
})

check('같은 칸에서 시작하는 가로·세로는 번호를 같이 쓴다', () => {
  const p = build(['sock', 'clock', 'duck', 'hand', 'milk', 'candy'], 11, seeded(11))
  const byStart = new Map<string, Set<number>>()
  for (const w of p.words) {
    const key = `${w.row},${w.col}`
    byStart.set(key, (byStart.get(key) ?? new Set()).add(w.no))
  }
  for (const [key, nos] of byStart) assert(nos.size === 1, `${key}에서 시작하는 낱말들의 번호가 다르다`)
  // 번호는 왼쪽 위부터 차례로
  const sorted = [...p.words].sort((a, b) => a.row - b.row || a.col - b.col)
  let last = 0
  for (const w of sorted) {
    assert(w.no >= last, '번호가 읽는 순서와 어긋난다')
    last = w.no
  }
})

check('난이도표가 마을·크기·보상 순서대로다', () => {
  assert(LEVELS.length === 3, `난이도가 ${LEVELS.length}개다`)
  const stages = LEVELS.map((l) => l.stage)
  const sizes = LEVELS.map((l) => l.size)
  const rewards = LEVELS.map((l) => l.reward)
  assert(stages.join() === '2,3,4', `열리는 단계: ${stages.join()} (3·4·5번 마을이어야)`)
  assert(rewards.join() === '3,5,8', `보상: ${rewards.join()} (3·5·8장이어야)`)
  for (let i = 1; i < LEVELS.length; i++) {
    assert((sizes[i] ?? 0) > (sizes[i - 1] ?? 0), '난이도가 올라가는데 판이 안 커진다')
    assert((LEVELS[i]?.words ?? 0) > (LEVELS[i - 1]?.words ?? 0), '난이도가 올라가는데 낱말이 안 는다')
  }
  assert(levelOf('easy').label === '초급', 'levelOf가 엉뚱한 난이도를 준다')
})

/** 놀이에 쓰는 낱말 — 그림으로 알아볼 수 있고 **그 단계에서 쓸 수 있는** 것만 */
function poolFor(stage: number): string[] {
  return picturableUpTo(stage as 0)
    .filter((w) => stageOf(w.en) <= stage)
    .map((w) => w.en)
}

check('판에는 **그 마을에서 쓸 수 있는 낱말**만 나온다 (nose 같은 앞선 철자 금지)', () => {
  for (const level of LEVELS) {
    const pool = poolFor(level.stage)
    assert(
      pool.every((w) => stageOf(w) <= level.stage),
      `${level.label}: 아직 못 쓰는 철자의 낱말이 풀에 있다`
    )
    const p = makePuzzle(pool, level, seeded(5))
    assert(p !== null, `${level.label}: 좁힌 풀(${pool.length}개)로는 판을 못 만든다`)
  }
})

check('세 난이도 모두 **실제 낱말**로 판이 만들어진다 (열리는 마을 기준)', () => {
  for (const level of LEVELS) {
    const pool = poolFor(level.stage)
    for (let seed = 1; seed <= 20; seed++) {
      const p = makePuzzle(pool, level, seeded(seed))
      assert(p !== null, `${level.label}(seed ${seed}): 판을 못 만들었다 — 낱말 풀 ${pool.length}개`)
      assert(p!.words.length >= 3, `${level.label}(seed ${seed}): 낱말이 ${p!.words.length}개뿐이다`)
      assert(connected(p!), `${level.label}(seed ${seed}): 떨어진 낱말이 있다`)
      assert(
        p!.words.every((w) => pool.includes(w.word)),
        `${level.label}: 풀에 없는 낱말이 판에 들어갔다`
      )
      assert(p!.rows <= level.size && p!.cols <= level.size, `${level.label}: 판이 ${p!.rows}×${p!.cols}로 넘쳤다`)
    }
  }
})

check('목표 낱말 수를 되도록 채운다 (풀이 넉넉한 고급에서)', () => {
  const hard = levelOf('hard')
  const pool = poolFor(hard.stage)
  const counts = Array.from({ length: 20 }, (_, i) => makePuzzle(pool, hard, seeded(i + 1))?.words.length ?? 0)
  const full = counts.filter((n) => n >= hard.words).length
  assert(full >= 15, `20판 중 ${full}판만 ${hard.words}낱말을 채웠다 (${counts.join(',')})`)
})

check('놀이에 쓰는 낱말은 그림으로 알아볼 수 있는 것뿐이다', () => {
  // 그림이 곧 문제다 — 🐘(big)처럼 그림으로 알 수 없는 낱말이 들어가면 답을 알 방법이 없다
  const abstractOnes = WORDS.filter((w) => w.abstract).map((w) => w.en)
  for (const level of LEVELS) {
    const pool = poolFor(level.stage)
    assert(
      !pool.some((w) => abstractOnes.includes(w)),
      `${level.label}: 그림으로 알 수 없는 낱말이 풀에 있다`
    )
  }
})

console.log(`\n${pass}개 통과, ${fails.length}개 실패`)
if (fails.length) {
  console.log('\n실패 목록:')
  for (const f of fails) console.log(` - ${f}`)
  process.exit(1)
}
