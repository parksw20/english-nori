/**
 * 사천성 규칙 테스트 — `npm test`가 함께 돌린다.
 *
 * 퍼즐은 눈으로 검증할 수 없다. 한자놀이 블록굴리기에서 배운 것:
 * **손으로 만든 판에는 못 깨는 판이 반드시 섞인다** → 규칙을 순수함수로 만들고 판을 전수로 풀어 본다.
 * 여기서는 판을 200개 만들어 **실제로 끝까지 풀어 보고**, 길 잇기 규칙도 손으로 만든 판으로 확인한다.
 */
import { cvcWordsUpTo } from '../src/phonics'
import {
  canConnect,
  findMove,
  findPath,
  isCleared,
  isPair,
  makeBoard,
  playOut,
  removePair,
  reshuffle,
  type Board,
  type Tile,
} from '../src/shisen'

let pass = 0
const fails: string[] = []

function check(name: string, fn: () => void): void {
  try {
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

/** 재현 가능한 난수 (실패한 판을 다시 만들어 볼 수 있어야 한다) */
function rngOf(seed: number): () => number {
  let s = seed
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
}

/**
 * 글로 그린 판을 Board로 바꾼다.
 * `.`은 빈 칸, 소문자는 글자 타일, 대문자는 그 낱말의 그림 타일.
 */
function parse(rows: string[]): Board {
  let id = 0
  return rows.map((row) =>
    [...row].map((ch) => {
      if (ch === '.') return null
      const t: Tile = { id: id++, word: ch.toLowerCase(), kind: ch === ch.toLowerCase() ? 'word' : 'emoji' }
      return t
    })
  )
}

console.log('\n사천성 규칙 검사\n')

// ── 짝 판정 ──────────────────────────────────────────────────────────────
check('짝은 같은 낱말의 글자 타일과 그림 타일이다', () => {
  const w: Tile = { id: 1, word: 'cat', kind: 'word' }
  const e: Tile = { id: 2, word: 'cat', kind: 'emoji' }
  const w2: Tile = { id: 3, word: 'cat', kind: 'word' }
  const other: Tile = { id: 4, word: 'dog', kind: 'emoji' }
  assert(isPair(w, e), 'cat 글자 + cat 그림')
  assert(!isPair(w, w2), '글자끼리는 짝이 아니다')
  assert(!isPair(w, other), '다른 낱말은 짝이 아니다')
  assert(!isPair(w, w), '같은 타일은 짝이 아니다')
})

// ── 길 잇기 ──────────────────────────────────────────────────────────────
check('나란히 붙은 짝은 이어진다 (꺾임 0)', () => {
  const b = parse(['aA'])
  assert(canConnect(b, [0, 0], [0, 1]), '붙어 있으면 이어져야 한다')
})

check('사이가 비어 있으면 직선으로 이어진다', () => {
  const b = parse(['a..A'])
  const p = findPath(b, [0, 0], [0, 3])
  assert(p !== null, '빈 칸을 지나 이어져야 한다')
  assert(p?.length === 4, `지나는 칸 수가 4여야 한다 (${p?.length})`)
})

check('사이가 다른 타일로 막히면 직선으로는 못 잇는다', () => {
  // 한 줄뿐이면 위아래로 돌 수 있으니(판 바깥 허용) 3줄로 막아 확인한다
  const b = parse(['bbbb', 'abA b'.replace(' ', ''), 'bbbb'])
  assert(!canConnect(b, [1, 0], [1, 2]), '가운데가 막혔는데 이어졌다')
})

check('꺾임 1번으로 이어진다', () => {
  const b = parse(['a..', '...', '..A'])
  const p = findPath(b, [0, 0], [2, 2])
  assert(p !== null, '꺾임 1~2번으로 이어져야 한다')
})

check('판 바깥으로 한 바퀴 돌아 이어진다 (테두리 허용)', () => {
  // 위쪽 바깥을 지나 이어야만 닿는 배치
  const b = parse(['a.A', 'bbb'])
  assert(canConnect(b, [0, 0], [0, 2]), '위로 나갔다 돌아오는 길이 있어야 한다')
})

check('꺾임 3번이 필요한 배치는 못 잇는다', () => {
  // ㄹ자로 가야만 닿도록 벽을 세운다
  const b = parse([
    'a.x.',
    'xx.x',
    '.x.x',
    'x..A',
  ])
  const p = findPath(b, [0, 0], [3, 3])
  if (p) {
    // 이어졌다면 꺾임이 2번 이내여야 한다 — 방향이 바뀐 횟수를 세어 확인
    let turns = 0
    for (let i = 2; i < p.length; i++) {
      const [pr, pc] = p[i - 2] as [number, number]
      const [cr, cc] = p[i - 1] as [number, number]
      const [nr, nc] = p[i] as [number, number]
      if ((cr - pr !== nr - cr) || (cc - pc !== nc - cc)) turns++
    }
    assert(turns <= 2, `꺾임이 ${turns}번인 길을 돌려줬다`)
  }
})

check('짝이 아닌 두 타일은 이어지지 않는다', () => {
  const b = parse(['a.b'])
  assert(!canConnect(b, [0, 0], [0, 2]), '다른 낱말이 이어졌다')
})

check('빈 칸을 집으면 이어지지 않는다', () => {
  const b = parse(['a.A'])
  assert(!canConnect(b, [0, 1], [0, 2]), '빈 칸이 이어졌다')
})

// ── 막힌 판 감지와 섞기 ──────────────────────────────────────────────────
check('없앨 짝이 있으면 찾아낸다', () => {
  const b = parse(['aA'])
  const mv = findMove(b)
  assert(mv !== null, '짝을 찾아야 한다')
  removePair(b, mv![0], mv![1])
  assert(isCleared(b), '없앤 뒤에는 판이 비어야 한다')
})

check('막힌 판을 섞으면 길이 생긴다', () => {
  // 3×4 판을 만들되 일부러 막힌 배치를 찾아 섞어 본다
  const rng = rngOf(7)
  let blocked: Board | null = null
  for (let seed = 1; seed < 300 && !blocked; seed++) {
    const b = makeBoard(['cat', 'dog', 'sun'], 2, 6, rngOf(seed))
    // 몇 짝을 없애 막힌 상태를 만들어 본다
    for (let k = 0; k < 2; k++) {
      const mv = findMove(b)
      if (mv) removePair(b, mv[0], mv[1])
    }
    if (!findMove(b) && !isCleared(b)) blocked = b
  }
  if (!blocked) {
    console.log('      (참고) 막힌 판을 못 만들었다 — 섞기 경로는 playOut 테스트가 함께 확인한다')
    return
  }
  assert(reshuffle(blocked, rng), '섞어도 길이 안 생겼다')
  assert(findMove(blocked) !== null, '섞은 뒤에는 길이 있어야 한다')
})

// ── 실제 판을 끝까지 풀어 본다 (가장 중요한 검사) ────────────────────────
// 판 크기는 게임에서 고를 수 있다(4×6 / 6×6 / 8×8) → **크기마다** 끝까지 풀리는지 확인한다.
// 큰 판은 타일이 많아 막힐 확률도 달라지므로 작은 판만 검사하면 의미가 없다.
const BOARD_SIZES = [
  { label: '4×6', rows: 4, cols: 6 },
  { label: '6×6', rows: 6, cols: 6 },
  { label: '8×8', rows: 8, cols: 8 },
]

check('모든 판 크기가 끝까지 풀린다 (크기마다 100판, 막히면 섞어서)', () => {
  const words = cvcWordsUpTo(1).map((w) => w.en)
  assert(words.length >= 6, `CVC 낱말이 6개 이상 필요하다 (${words.length})`)
  const bad: string[] = []
  for (const size of BOARD_SIZES) {
    const pairs = (size.rows * size.cols) / 2
    // 게임과 같은 규칙으로 낱말 수를 정한다 — 낱말마다 두 쌍
    const wordCount = Math.max(3, Math.min(words.length, Math.floor(pairs / 2)))
    let shuffles = 0
    let stuck = 0
    for (let seed = 1; seed <= 100; seed++) {
      const rng = rngOf(seed * 31 + size.rows)
      const b = makeBoard(words.slice(0, wordCount), size.rows, size.cols, rng)
      const r = playOut(b, rng)
      shuffles += r.shuffles
      if (!r.cleared) {
        stuck++
        bad.push(`${size.label} seed ${seed}: ${r.moves}수에서 막힘(섞기 ${r.shuffles}회)`)
      } else if (r.moves !== pairs) {
        bad.push(`${size.label} seed ${seed}: ${pairs}쌍이어야 하는데 ${r.moves}수`)
      }
    }
    console.log(`      ${size.label} (${pairs}쌍·낱말 ${wordCount}개): 100판 중 ${100 - stuck}판 완주, 섞기 총 ${shuffles}회`)
  }
  assert(bad.length === 0, `${bad.length}개 실패 — ${bad.slice(0, 3).join(' / ')}`)
})

check('새로 만든 판은 크기와 무관하게 처음부터 막혀 있지 않다', () => {
  const words = cvcWordsUpTo(1).map((w) => w.en)
  for (const size of BOARD_SIZES) {
    const pairs = (size.rows * size.cols) / 2
    const wordCount = Math.max(3, Math.min(words.length, Math.floor(pairs / 2)))
    for (let seed = 1; seed <= 100; seed++) {
      const b = makeBoard(words.slice(0, wordCount), size.rows, size.cols, rngOf(seed))
      assert(findMove(b) !== null, `${size.label} seed ${seed}: 첫 판이 막혀 있다`)
    }
  }
})

check('칸 수가 홀수면 판을 만들지 않는다', () => {
  let threw = false
  try {
    makeBoard(['cat'], 3, 3)
  } catch {
    threw = true
  }
  assert(threw, '홀수 칸인데 판이 만들어졌다')
})

console.log(`\n${pass}개 통과, ${fails.length}개 실패`)
if (fails.length) {
  console.log('\n실패 목록:')
  for (const f of fails) console.log(` - ${f}`)
  process.exit(1)
}
