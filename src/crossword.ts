/**
 * 가로세로 퀴즈 — **판을 만드는 규칙만** 여기 둔다(화면 없음).
 *
 * 십자말풀이는 눈으로 검증하기 가장 어려운 종류다: 낱말이 겹쳐 붙어 버리면 판이 그럴듯해 보여도
 * 답이 여러 개가 되거나 아예 못 푸는 판이 된다. 그래서 배치 규칙을 순수 함수로 떼어 테스트로 못 박는다.
 *
 * 배치 규칙(표준 십자말 규칙과 같다):
 * - 놓을 자리의 칸은 **비어 있거나 같은 글자**여야 한다
 * - 낱말의 **앞뒤 한 칸**은 비어 있어야 한다 (cat과 bat이 붙어 catbat이 되면 안 된다)
 * - 겹치는 칸이 아닌 곳의 **양옆(수직 방향)은 비어 있어야 한다** — 나란히 붙으면 읽히지 않는 글자 덩어리가 생긴다
 * - 첫 낱말을 뺀 나머지는 **반드시 기존 낱말과 한 칸 이상 겹쳐야** 한다 (섬처럼 떨어진 낱말 금지)
 */

export type Dir = 'across' | 'down'

export interface Placed {
  word: string
  /** 낱말이 시작하는 칸 */
  row: number
  col: number
  dir: Dir
  /** 화면에 보여줄 번호 (1부터). 같은 칸에서 시작하는 가로·세로는 번호를 같이 쓴다 */
  no: number
}

export interface Puzzle {
  rows: number
  cols: number
  /** 칸에 들어갈 정답 글자. 빈칸은 null */
  cells: (string | null)[][]
  words: Placed[]
}

/** 난이도 — 판 크기와 낱말 수, 쓸 낱말의 길이 범위 */
export interface Level {
  id: 'easy' | 'mid' | 'hard'
  label: string
  /** 이 난이도가 열리는 단계 (마을 번호 - 1) */
  stage: 2 | 3 | 4
  size: number
  words: number
  maxLen: number
  /** 다 풀면 주는 글자 카드 */
  reward: number
}

/**
 * 난이도표.
 *
 * 마을이 올라갈수록 열린다 — 3번 마을(쌍자음)에서 초급, 4번(두글자소리)에서 중급, 5번(마법의 e)에서 고급.
 * 판이 커지는 만큼 낱말도 길어진다: 초급은 3~4글자만 나와서 아이가 판 전체를 한눈에 본다.
 */
export const LEVELS: Level[] = [
  { id: 'easy', label: '초급', stage: 2, size: 7, words: 6, maxLen: 5, reward: 3 },
  { id: 'mid', label: '중급', stage: 3, size: 9, words: 9, maxLen: 6, reward: 5 },
  { id: 'hard', label: '고급', stage: 4, size: 11, words: 12, maxLen: 8, reward: 8 },
]

/*
 * 낱말 수는 **판 크기에 맞춰 실제로 채워지는 값**으로 정했다(tools/cw-fill.mts로 30판씩 재 봤다):
 * 7×7 6개 29/30 · 9×9 9개 24/30 · 11×11 12개 25/30.
 * 처음엔 4·6·8개였는데 7×7에 낱말 4개는 판이 텅 비어 보였다(사용자 지적).
 * 한 개씩 더 올리면(7·10·14) 성공률이 17·6·4/30으로 급락한다 — 겹칠 글자가 모자라서다.
 */

export function levelOf(id: string): Level {
  const l = LEVELS.find((x) => x.id === id)
  if (!l) throw new Error(`없는 난이도: ${id}`)
  return l
}

type Grid = (string | null)[][]

function emptyGrid(n: number): Grid {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => null))
}

function at(g: Grid, r: number, c: number): string | null | undefined {
  return g[r]?.[c]
}

/** 그 자리에 낱말을 놓을 수 있는가 (위 주석의 배치 규칙) */
export function canPlace(g: Grid, word: string, row: number, col: number, dir: Dir): boolean {
  const n = g.length
  const dr = dir === 'down' ? 1 : 0
  const dc = dir === 'across' ? 1 : 0
  const endR = row + dr * (word.length - 1)
  const endC = col + dc * (word.length - 1)
  if (row < 0 || col < 0 || endR >= n || endC >= n) return false

  // 앞뒤 한 칸은 비어 있어야 한다
  if (at(g, row - dr, col - dc)) return false
  if (at(g, endR + dr, endC + dc)) return false

  let crossings = 0
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    const cur = at(g, r, c)
    const ch = word[i] as string
    if (cur === ch) {
      crossings++
      continue
    }
    if (cur) return false // 다른 글자가 이미 있다
    // 빈칸이면 **수직 방향 양옆**이 비어 있어야 한다 (나란히 붙는 것 금지)
    if (dir === 'across') {
      if (at(g, r - 1, c) || at(g, r + 1, c)) return false
    } else {
      if (at(g, r, c - 1) || at(g, r, c + 1)) return false
    }
  }
  return crossings <= word.length - 1 // 낱말이 통째로 겹치는 것(같은 자리 재배치)은 배치가 아니다
}

function put(g: Grid, word: string, row: number, col: number, dir: Dir): void {
  for (let i = 0; i < word.length; i++) {
    const r = row + (dir === 'down' ? i : 0)
    const c = col + (dir === 'across' ? i : 0)
    ;(g[r] as (string | null)[])[c] = word[i] as string
  }
}

/**
 * 낱말들로 판을 짠다. 넣을 수 있는 만큼만 넣고 **실제로 놓인 것만** 돌려준다.
 *
 * 낱말을 다 못 넣는 것은 실패가 아니다 — 겹칠 글자가 없으면 못 놓는 것이 정상이고,
 * 부르는 쪽이 "몇 개 이상이면 판으로 쓴다"를 정한다.
 */
export function build(words: string[], size: number, rng: () => number = Math.random): Puzzle {
  const grid = emptyGrid(size)
  const placed: Omit<Placed, 'no'>[] = []
  const rest = [...words]

  // 첫 낱말은 가운데 가로로
  const first = rest.shift()
  if (!first) return { rows: size, cols: size, cells: grid, words: [] }
  const mid = Math.floor(size / 2)
  const startCol = Math.max(0, Math.floor((size - first.length) / 2))
  put(grid, first, mid, startCol, 'across')
  placed.push({ word: first, row: mid, col: startCol, dir: 'across' })

  for (const word of rest) {
    const spots: { row: number; col: number; dir: Dir }[] = []
    // 이미 놓인 글자와 겹치는 자리를 전부 모은 뒤 하나를 고른다 —
    // 첫 번째로 찾은 자리에 바로 놓으면 판이 늘 같은 모양(계단)이 된다
    for (let i = 0; i < word.length; i++) {
      const ch = word[i] as string
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (at(grid, r, c) !== ch) continue
          const across = { row: r, col: c - i, dir: 'across' as const }
          const down = { row: r - i, col: c, dir: 'down' as const }
          if (canPlace(grid, word, across.row, across.col, 'across')) spots.push(across)
          if (canPlace(grid, word, down.row, down.col, 'down')) spots.push(down)
        }
      }
    }
    if (spots.length === 0) continue
    const pick = spots[Math.floor(rng() * spots.length)] as { row: number; col: number; dir: Dir }
    put(grid, word, pick.row, pick.col, pick.dir)
    placed.push({ word, row: pick.row, col: pick.col, dir: pick.dir })
  }

  return trim({ rows: size, cols: size, cells: grid, words: placed.map((p) => ({ ...p, no: 0 })) })
}

/** 빈 테두리를 잘라내고 번호를 매긴다 — 판이 화면에서 한쪽으로 쏠리지 않게 */
function trim(p: Puzzle): Puzzle {
  let top = p.rows
  let left = p.cols
  let bottom = -1
  let right = -1
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      if (!p.cells[r]?.[c]) continue
      top = Math.min(top, r)
      left = Math.min(left, c)
      bottom = Math.max(bottom, r)
      right = Math.max(right, c)
    }
  }
  if (bottom < 0) return { rows: 0, cols: 0, cells: [], words: [] }

  const cells = p.cells.slice(top, bottom + 1).map((row) => row.slice(left, right + 1))
  const words = p.words.map((w) => ({ ...w, row: w.row - top, col: w.col - left }))
  return number({ rows: bottom - top + 1, cols: right - left + 1, cells, words })
}

/**
 * 번호 매기기 — 왼쪽 위부터 읽어 나가며 낱말이 시작하는 칸에 차례로 번호를 준다.
 * 한 칸에서 가로와 세로가 같이 시작하면 **같은 번호**를 쓴다(십자말의 관례).
 */
function number(p: Puzzle): Puzzle {
  const noAt = new Map<string, number>()
  let next = 1
  for (const w of [...p.words].sort((a, b) => a.row - b.row || a.col - b.col)) {
    const key = `${w.row},${w.col}`
    if (!noAt.has(key)) noAt.set(key, next++)
    w.no = noAt.get(key) as number
  }
  return p
}

/** 판이 놀이로 성립하는가 — 낱말이 충분하고 전부 이어져 있는가 */
export function isPlayable(p: Puzzle, want: number): boolean {
  return p.words.length >= want && connected(p)
}

/** 모든 낱말이 서로 겹쳐 하나로 이어져 있는가 (섬이 있으면 안 된다) */
export function connected(p: Puzzle): boolean {
  if (p.words.length <= 1) return true
  const cellsOf = (w: Placed): string[] =>
    Array.from({ length: w.word.length }, (_, i) => `${w.row + (w.dir === 'down' ? i : 0)},${w.col + (w.dir === 'across' ? i : 0)}`)
  const seen = new Set<number>([0])
  const queue = [0]
  while (queue.length) {
    const i = queue.shift() as number
    const mine = new Set(cellsOf(p.words[i] as Placed))
    p.words.forEach((w, j) => {
      if (seen.has(j)) return
      if (cellsOf(w).some((c) => mine.has(c))) {
        seen.add(j)
        queue.push(j)
      }
    })
  }
  return seen.size === p.words.length
}

/**
 * 놀 만한 판이 나올 때까지 낱말을 바꿔 가며 여러 번 짜 본다.
 *
 * 한 번에 되지 않는 것이 정상이다: 뽑은 낱말들이 서로 겹칠 글자가 없으면 판이 안 만들어진다.
 * 그래서 **낱말을 다시 뽑아** 시도하고, 끝내 안 되면 목표 낱말 수를 하나 줄여 다시 본다
 * (아이를 빈 화면 앞에 세워 두는 것보다 낱말 하나 적은 판이 낫다).
 */
export function makePuzzle(pool: string[], level: Level, rng: () => number = Math.random, tries = 60): Puzzle | null {
  const usable = pool.filter((w) => /^[a-z]+$/.test(w) && w.length >= 3 && w.length <= level.maxLen)
  if (usable.length < 3) return null

  for (let want = level.words; want >= 3; want--) {
    for (let t = 0; t < tries; t++) {
      // 긴 낱말을 먼저 놓아야 겹칠 자리가 많아진다
      const picked = shuffled(usable, rng)
        .slice(0, Math.min(usable.length, want + 4))
        .sort((a, b) => b.length - a.length)
      const p = build(picked, level.size, rng)
      if (isPlayable(p, want)) return p
    }
  }
  return null
}

function shuffled<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j] as T, a[i] as T]
  }
  return a
}
