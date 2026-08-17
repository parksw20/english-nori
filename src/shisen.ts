/**
 * 사천성 규칙 — **순수 함수로만** 만든다(화면·소리 없음).
 *
 * 이렇게 떼어 놓는 이유는 퍼즐 규칙은 눈으로 검증할 수 없기 때문이다:
 * 한자놀이 블록굴리기에서 배운 것 — "손으로 만든 판에는 못 깨는 판이 섞인다".
 * 그래서 규칙(canConnect·hasMove)을 node에서 돌릴 수 있게 두고, 테스트가 판을 실제로 끝까지 풀어 본다.
 *
 * 규칙: 낱말 타일과 그림 타일이 **빈 칸을 지나 꺾임 2번 이내(선분 3개)**로 이어지면 둘이 사라진다.
 * 판 바깥으로 한 칸 돌아가는 길도 허용한다(사천성 표준) — 그래야 벽에 붙은 타일이 갇히지 않는다.
 */

export interface Tile {
  id: number
  /** 어떤 낱말의 타일인가 */
  word: string
  /** 글자 타일인가 그림 타일인가 — 짝은 반드시 글자↔그림이다 */
  kind: 'word' | 'emoji'
}

/** 판. null은 이미 없앤 칸 */
export type Board = (Tile | null)[][]
export type Pos = readonly [number, number]

export function rows(b: Board): number {
  return b.length
}

export function cols(b: Board): number {
  return b[0]?.length ?? 0
}

export function at(b: Board, [r, c]: Pos): Tile | null {
  return b[r]?.[c] ?? null
}

/** 지나갈 수 있는 칸인가. 판 바깥은 언제나 지나갈 수 있다(테두리 한 바퀴 돌기) */
function free(b: Board, r: number, c: number): boolean {
  if (r < -1 || c < -1 || r > rows(b) || c > cols(b)) return false
  if (r === -1 || c === -1 || r === rows(b) || c === cols(b)) return true
  return b[r]?.[c] == null
}

/** 짝이 될 수 있는 두 타일인가 — 같은 낱말의 글자 타일과 그림 타일 */
export function isPair(a: Tile, b: Tile): boolean {
  return a.id !== b.id && a.word === b.word && a.kind !== b.kind
}

const DIRS: Pos[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/**
 * 두 타일을 이을 수 있으면 지나가는 칸들을 돌려준다(양 끝 포함). 못 이으면 null.
 *
 * 꺾임 2번까지 허용. 상태에 **방향**을 넣어 BFS를 돌린다 — 같은 칸이라도 어느 방향으로
 * 들어왔는지에 따라 남은 꺾임 수가 달라지기 때문이다.
 */
export function findPath(board: Board, from: Pos, to: Pos): Pos[] | null {
  const a = at(board, from)
  const b = at(board, to)
  if (!a || !b || !isPair(a, b)) return null

  interface State {
    r: number
    c: number
    dir: number
    turns: number
    prev: State | null
  }
  const seen = new Map<string, number>()
  const queue: State[] = []
  for (let d = 0; d < DIRS.length; d++) {
    queue.push({ r: from[0], c: from[1], dir: d, turns: 0, prev: null })
  }

  while (queue.length > 0) {
    const s = queue.shift() as State
    const [dr, dc] = DIRS[s.dir] as Pos
    const nr = s.r + dr
    const nc = s.c + dc

    // 목표에 닿았다 — 지나온 길을 되짚어 돌려준다
    if (nr === to[0] && nc === to[1]) {
      const path: Pos[] = [[nr, nc]]
      for (let p: State | null = s; p; p = p.prev) path.push([p.r, p.c])
      return path.reverse()
    }
    if (!free(board, nr, nc)) continue

    const key = `${nr},${nc},${s.dir}`
    const best = seen.get(key)
    if (best !== undefined && best <= s.turns) continue
    seen.set(key, s.turns)

    // 같은 방향으로 계속 (꺾임 그대로)
    queue.push({ r: nr, c: nc, dir: s.dir, turns: s.turns, prev: s })
    // 방향 바꾸기 (꺾임 +1, 2번까지)
    if (s.turns < 2) {
      for (let d = 0; d < DIRS.length; d++) {
        if (d === s.dir) continue
        // 되돌아가는 방향은 의미가 없다
        const [er, ec] = DIRS[d] as Pos
        if (er === -dr && ec === -dc) continue
        queue.push({ r: nr, c: nc, dir: d, turns: s.turns + 1, prev: s })
      }
    }
  }
  return null
}

export function canConnect(board: Board, from: Pos, to: Pos): boolean {
  return findPath(board, from, to) !== null
}

/** 남은 타일들의 좌표 */
export function remaining(board: Board): Pos[] {
  const out: Pos[] = []
  for (let r = 0; r < rows(board); r++) {
    for (let c = 0; c < cols(board); c++) if (board[r]?.[c]) out.push([r, c])
  }
  return out
}

export function isCleared(board: Board): boolean {
  return remaining(board).length === 0
}

/**
 * 지금 없앨 수 있는 짝 하나. 없으면 null — **막힌 판**이라는 뜻이다.
 * 사천성은 남은 타일이 있어도 길이 다 막힐 수 있으므로 이 검사가 반드시 필요하다.
 */
export function findMove(board: Board): [Pos, Pos] | null {
  const ps = remaining(board)
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i] as Pos
      const b = ps[j] as Pos
      if (canConnect(board, a, b)) return [a, b]
    }
  }
  return null
}

export function removePair(board: Board, a: Pos, b: Pos): void {
  const rowA = board[a[0]]
  const rowB = board[b[0]]
  if (rowA) rowA[a[1]] = null
  if (rowB) rowB[b[1]] = null
}

/**
 * 남은 타일을 섞어 다시 뿌린다 — 막혔을 때 쓴다.
 * **섞은 뒤에도 막혀 있으면 다시 섞는다**(길이 생길 때까지). 못 찾으면 있는 대로 둔다.
 */
export function reshuffle(board: Board, rng: () => number = Math.random): boolean {
  const ps = remaining(board)
  for (let attempt = 0; attempt < 50; attempt++) {
    const tiles = ps.map((p) => at(board, p) as Tile)
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const ti = tiles[i] as Tile
      tiles[i] = tiles[j] as Tile
      tiles[j] = ti
    }
    ps.forEach((p, k) => {
      const row = board[p[0]]
      if (row) row[p[1]] = tiles[k] as Tile
    })
    if (findMove(board)) return true
  }
  return false
}

/**
 * 판 만들기 — 낱말 하나가 **글자 타일 + 그림 타일 두 장**이다.
 *
 * 같은 낱말을 여러 쌍 넣는다(`copies`). 낱말 수를 적게 쓰면서 판을 채울 수 있고,
 * 같은 낱말의 그림 타일이 여러 개라 아이가 이을 곳을 찾기 쉬워진다.
 */
export function makeBoard(words: string[], r: number, c: number, rng: () => number = Math.random): Board {
  const cells = r * c
  if (cells % 2 !== 0) throw new Error('칸 수가 짝수여야 한다')
  const pairs = cells / 2
  if (words.length === 0) throw new Error('낱말이 없다')

  const tiles: Tile[] = []
  let id = 0
  for (let k = 0; k < pairs; k++) {
    const w = words[k % words.length] as string
    tiles.push({ id: id++, word: w, kind: 'word' })
    tiles.push({ id: id++, word: w, kind: 'emoji' })
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const ti = tiles[i] as Tile
    tiles[i] = tiles[j] as Tile
    tiles[j] = ti
  }

  const board: Board = Array.from({ length: r }, (_, ri) =>
    Array.from({ length: c }, (_, ci) => tiles[ri * c + ci] ?? null)
  )
  // 처음부터 막힌 판을 아이에게 주지 않는다
  if (!findMove(board)) reshuffle(board, rng)
  return board
}

/**
 * 판이 끝까지 풀리는지 확인한다 (테스트용).
 * 막히면 섞고 이어 간다 — 실제 놀이와 같은 규칙. 섞어도 길이 없으면 실패로 돌려준다.
 */
export function playOut(board: Board, rng: () => number = Math.random): { cleared: boolean; moves: number; shuffles: number } {
  let moves = 0
  let shuffles = 0
  while (!isCleared(board)) {
    const mv = findMove(board)
    if (mv) {
      removePair(board, mv[0], mv[1])
      moves++
      continue
    }
    if (shuffles >= 30 || !reshuffle(board, rng)) return { cleared: false, moves, shuffles }
    shuffles++
  }
  return { cleared: true, moves, shuffles }
}
