/**
 * 사천성 — 낱말 타일과 그림 타일을 **길로 이어 없앤다.**
 *
 * 짝맞추기(기억력)와 다른 재미: 판이 눈에 다 보이고, 어디를 없애면 길이 열리는지 **머리로 계획**하게 된다.
 * 7세에게 맞춘 것:
 * - **시간 제한이 없다.** 남은 짝 수만 보여준다(초읽기는 아이를 굳게 만든다).
 * - **기회는 5번.** 무엇으로 줄어드는지가 중요하다: 줄어드는 것은 **짝이 아닌 것을 고른 때**뿐이다
 *   (cat 글자에 🐶를 고른 것 = 낱말을 잘못 읽은 것). 길이 막힌 것은 낱말은 맞게 골랐으니 차감하지 않고,
 *   판이 다 막혀 자동으로 섞는 것도 아이 잘못이 아니라 차감하지 않는다.
 * - 짝이 아니거나 길이 막혔을 때 벌이 없다. 대신 **누른 낱말을 읽어 준다** — 헛클릭도 듣기 연습이 된다.
 * - 길이 다 막히면 **안내창을 띄우고 알아서 섞는다.** 아이가 막힌 판 앞에서 "왜 안 되지" 하고 포기하지 않게.
 *   작은 글씨 한 줄로는 못 알아채기 때문에 화면 가운데에 띄우고, 아무것도 누르지 않아도 저절로 닫힌다.
 * - 이은 길을 선으로 잠깐 보여준다 — 왜 그 짝이 됐는지 눈으로 알 수 있게.
 *
 * 규칙 자체는 `src/shisen.ts`에 순수 함수로 있고, 판이 끝까지 풀리는지는 테스트가 200판으로 확인한다.
 */
import { picturableCvcUpTo, picturableUpTo } from '../phonics'
import type { StageId, Word } from '../data/types'
import { shuffle } from '../rand'
import * as sfx from '../sfx'
import {
  findMove,
  findPath,
  isCleared,
  isPair,
  makeBoard,
  removePair,
  reshuffle,
  type Board,
  type Pos,
  type Tile,
} from '../shisen'
import * as tts from '../tts'
import { el, notice, render, top } from '../ui'

/**
 * 판 크기 — 아이가 고른다. 마지막에 고른 것을 기억한다.
 *
 * 큰 판(8×8=64칸)은 타일이 작아지므로 폰에서는 손가락에 빡빡하다 → 화면 너비를 보고
 * 타일이 너무 작아지면 안내만 하고 그대로 진행한다(고른 것을 막지는 않는다).
 * 작은 판은 좁은 화면에서 세로로 세워(4열 × 6행) 타일을 크게 유지한다.
 */
/** 짝을 잘못 고를 수 있는 횟수 */
const CHANCES = 5

/**
 * 섞기 횟수 제한.
 *
 * 무제한이면 아이가 **찾는 대신 섞는다** — 막히면 눈으로 훑기 전에 섞기를 누르는 것이 늘 더 싸다.
 * 5번이면 답답할 때 쓰기에 충분하고, 습관이 될 만큼 넉넉하지도 않다.
 *
 * **길이 다 막혀 저절로 섞이는 것은 세지 않는다.** 그건 아이가 고른 것이 아니라 판이 만든 사정이고,
 * 여기에 값을 매기면 잘 골라서 판이 막힌 아이가 벌을 받는 꼴이 된다.
 */
const MAX_SHUFFLES = 5

export const SIZES = [
  { id: 's', label: '작은 판', rows: 4, cols: 6, tiles: 24 },
  { id: 'm', label: '중간 판', rows: 6, cols: 6, tiles: 36 },
  { id: 'l', label: '큰 판', rows: 8, cols: 8, tiles: 64 },
] as const

type SizeId = (typeof SIZES)[number]['id']
const SIZE_KEY = 'yeongeo-nori.shisen.size'

function savedSize(): SizeId {
  try {
    const v = localStorage.getItem(SIZE_KEY)
    if (SIZES.some((s) => s.id === v)) return v as SizeId
  } catch {
    /* 저장소가 막혀도 기본 크기로 논다 */
  }
  return 's'
}

function saveSize(id: SizeId): void {
  try {
    localStorage.setItem(SIZE_KEY, id)
  } catch {
    /* 무시 */
  }
}

/**
 * 판에 쓸 낱말 수 — **낱말마다 두 쌍**이 되도록 칸 수에서 계산한다.
 * 낱말이 모자라면(단계 0은 8개뿐) 한 낱말이 더 여러 쌍을 맡는다.
 */
function wordCountFor(pairs: number, poolSize: number): number {
  return Math.max(3, Math.min(poolSize, Math.floor(pairs / 2)))
}

export interface ShisenResult {
  seconds: number
  /** 판의 전체 쌍 수 */
  pairs: number
  /** 없앤 쌍 수 */
  cleared: number
  /** 판을 다 비웠는가 (기회를 다 써서 끝난 것과 구별한다) */
  allCleared: boolean
  shuffles: number
  /** 남은 하트 — 보상 카드 장수가 이 값으로 정해진다 */
  hearts: number
  /**
   * 판이 왜 끝났나. 하트가 남았는데 섞기가 막혀 끝난 판을 "기회를 다 썼어요"라고 하면
   * 아이가 자기가 뭘 잘못했는지 잘못 배운다 — 그건 판 사정이지 아이 잘못이 아니다.
   */
  reason: 'cleared' | 'noHearts' | 'blocked'
  words: string[]
}

export function runShisen(stage: StageId, onQuit: () => void, onDone: (r: ShisenResult) => void, sizeId: SizeId = savedSize()): void {
  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0]
  saveSize(size.id)

  // 낱말 타일과 그림 타일을 짝지어야 하므로 **그림으로 알아볼 수 있는 낱말만** 쓴다.
  // 타일에 들어갈 낱말은 짧아야 한다 — 작은 칸에 umbrella는 안 들어간다.
  const pool = (picturableCvcUpTo(stage).length >= 4 ? picturableCvcUpTo(stage) : picturableUpTo(stage)).filter(
    (w) => !w.en.includes(' ') && w.en.length <= 5
  )
  const TILES = size.tiles
  const chosen = shuffle(pool).slice(0, wordCountFor(TILES / 2, pool.length))
  const emojiOf = new Map(chosen.map((w: Word) => [w.en, w.emoji]))

  // 작은 판만 좁은 화면에서 세로로 세운다(4열 × 6행). 중간·큰 판은 정사각형이라 그대로 쓴다.
  const narrow = window.innerWidth < 560
  const cols = size.id === 's' && narrow ? 4 : size.cols
  const rows = TILES / cols
  const board: Board = makeBoard(
    chosen.map((w) => w.en),
    rows,
    cols
  )

  const started = Date.now()
  let selected: Pos | null = null
  let shuffles = 0
  let shufflesLeft = MAX_SHUFFLES
  let busy = false
  let chances = CHANCES
  /**
   * 길 선을 지우는 타이머 하나만 살려 둔다.
   * 처음에는 없앨 때마다 새 타이머를 걸었는데, 아이가 빠르게 이어 없애면 **앞 타이머가 방금 그린 선을 지웠다**
   * (브라우저 검증에서 12번 중 1번만 선이 보였다).
   */
  let lineTimer: number | undefined

  /** 판을 바꾸거나 떠날 때 도는 것들을 멈춘다 */
  function stopAll(): void {
    busy = true
    clearTimeout(lineTimer)
    tts.stop()
  }

  const wrap = el('div', { class: 'en-shisen-wrap' })
  const grid = el('div', { class: 'en-shisen-grid' })
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  lines.setAttribute('class', 'en-shisen-lines')
  const say = el('p', { class: 'en-q-say' })
  const left = el('p', { class: 'en-q-ask' })
  const chancesEl = el('span', { class: 'en-icpt-lives', text: '❤️'.repeat(CHANCES) })
  const pairsEl = el('span', { class: 'en-icpt-score' })
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
  wrap.append(grid, lines)

  function samePos(a: Pos | null, b: Pos): boolean {
    return !!a && a[0] === b[0] && a[1] === b[1]
  }

  function pairsLeft(): number {
    let n = 0
    for (const row of board) for (const t of row) if (t) n++
    return n / 2
  }

  function paint(): void {
    grid.replaceChildren()
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = board[r]?.[c] ?? null
        if (!t) {
          grid.append(el('div', { class: 'en-shisen-hole' }))
          continue
        }
        const isEmoji = t.kind === 'emoji'
        const b = el('button', {
          class: `en-shisen-tile${isEmoji ? ' en-shisen-pic' : ''}${samePos(selected, [r, c]) ? ' en-is-sel' : ''}`,
          text: isEmoji ? (emojiOf.get(t.word) ?? '❓') : t.word,
          'data-word': t.word,
          'data-kind': t.kind,
          'data-rc': `${r},${c}`,
        })
        b.addEventListener('click', () => tap([r, c], t))
        grid.append(b)
      }
    }
    left.textContent = '같은 낱말과 그림을 길로 이어 봐'
    pairsEl.textContent = `남은 짝 ${pairsLeft()}개`
  }

  /** 이은 길을 선으로 잠깐 보여준다. 판 바깥으로 돌아간 길도 그린다 */
  function flashPath(path: Pos[]): void {
    const first = grid.querySelector('.en-shisen-tile, .en-shisen-hole') as HTMLElement | null
    if (!first) return
    const gridBox = grid.getBoundingClientRect()
    const cell = first.getBoundingClientRect()
    const gap = cols > 1 ? (gridBox.width - cell.width * cols) / (cols - 1) : 0
    const pitchX = cell.width + gap
    const pitchY = cell.height + gap
    const cx = (c: number) => c * pitchX + cell.width / 2
    const cy = (r: number) => r * pitchY + cell.height / 2

    lines.setAttribute('viewBox', `0 0 ${gridBox.width} ${gridBox.height}`)
    lines.setAttribute('width', String(gridBox.width))
    lines.setAttribute('height', String(gridBox.height))
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    poly.setAttribute('points', path.map(([r, c]) => `${cx(c)},${cy(r)}`).join(' '))
    poly.setAttribute('class', 'en-shisen-line')
    lines.replaceChildren(poly)
    clearTimeout(lineTimer)
    lineTimer = setTimeout(() => lines.replaceChildren(), 420) as unknown as number
  }

  function tap(pos: Pos, tile: Tile): void {
    if (busy) return
    // 같은 타일을 다시 누르면 선택 해제
    if (samePos(selected, pos)) {
      selected = null
      paint()
      return
    }
    // 첫 장: 고르고 소리를 들려준다 (헛클릭도 듣기 연습이 되게)
    if (!selected) {
      selected = pos
      sfx.tap()
      tts.speak(tile.word, { rate: 0.85 })
      paint()
      return
    }

    const firstTile = board[selected[0]]?.[selected[1]]
    if (!firstTile) {
      selected = pos
      paint()
      return
    }

    if (!isPair(firstTile, tile)) {
      // 짝이 아니다 = 낱말을 잘못 읽은 것 → **여기서만 기회가 줄어든다**
      chances--
      chancesEl.textContent = '❤️'.repeat(Math.max(0, chances)) + '🤍'.repeat(CHANCES - Math.max(0, chances))
      sfx.again()
      say.textContent =
        chances > 0
          ? `짝이 아니야 — 같은 낱말의 그림을 찾아 봐 🔎 (기회 ${chances}번 남음)`
          : '기회를 다 썼어!'
      say.className = 'en-q-say en-again'
      // **선택을 모두 지운다.** 처음에는 방금 누른 것을 새 선택으로 남겨 뒀는데,
      // 실패한 뒤에도 카드 하나가 켜져 있으면 아이는 "아직 고르는 중"으로 읽어 다음 한 번이 헛클릭이 된다.
      // 실패했으면 판을 처음 상태로 돌려 주는 것이 분명하다.
      selected = null
      tts.speak(tile.word, { rate: 0.85 })
      paint()
      if (chances <= 0) outOfChances()
      return
    }

    const path = findPath(board, selected, pos)
    if (!path) {
      // 낱말은 맞게 골랐다 → 기회를 깎지 않는다. 길을 여는 것은 다음에 배우면 되는 것이다.
      say.textContent = '낱말은 맞아! 그런데 길이 막혀 있어 — 다른 짝을 먼저 없애 볼까? 🧱'
      say.className = 'en-q-say en-again'
      sfx.again()
      // 이어지지 않았으면 선택을 모두 지운다 (짝이 아닐 때와 같게)
      selected = null
      paint()
      return
    }

    // 이어졌다
    const word = tile.word
    flashPath(path)
    removePair(board, selected, pos)
    selected = null
    sfx.good()
    say.textContent = `${word} 👏`
    say.className = 'en-q-say en-good'
    tts.speak(word, { rate: 0.85 })
    paint()

    if (isCleared(board)) {
      sfx.fanfare()
      busy = true
      setTimeout(() => finish('cleared'), 1100)
      return
    }

    // 길이 다 막혔으면 안내하고 알아서 섞는다 — 아이가 막힌 판을 붙들고 있지 않게
    if (!findMove(board)) blockedAndShuffle()
  }

  function finish(reason: ShisenResult['reason']): void {
    busy = true
    stopAll()
    const allCleared = reason === 'cleared'
    onDone({
      reason,
      seconds: Math.round((Date.now() - started) / 1000),
      pairs: TILES / 2,
      cleared: TILES / 2 - pairsLeft(),
      allCleared,
      shuffles,
      hearts: Math.max(0, chances),
      words: chosen.map((w) => w.en),
    })
  }

  /** 기회를 다 썼다 — 안내하고 결과로 넘어간다. "실패"라고 하지 않는다 */
  function outOfChances(): void {
    busy = true
    notice('💔', '기회를 다 썼어요!', `${TILES / 2 - pairsLeft()}쌍을 없앴어요 — 한 번 더 해 볼까?`, {
      ms: 1800,
      onClose: () => finish('noHearts'),
    })
  }

  /**
   * 이을 수 있는 짝이 하나도 없을 때. 안내창을 띄우고 **자동으로 섞는다.**
   * 섞기를 먼저 해 두는 이유: 안내창이 반투명이라 뒤에서 판이 새로 깔리는 것이 보인다.
   *
   * 섞기를 다 썼는데 길까지 막혔다면 판을 더 이어갈 방법이 없다 → 판을 여기서 끝낸다.
   * (몰래 한 번 더 섞어 주면 제한이 거짓말이 되고, 그대로 두면 아이가 못 누르는 판을 붙들고 있게 된다)
   */
  function blockedAndShuffle(): void {
    // 섞고 나서도 막혀 있을 수 있다(우연히 또 막히게 깔린다) → 길이 생길 때까지 다시 섞는다.
    // 이건 **공짜**다: 남은 섞기를 깎지 않는다
    for (let i = 0; i < 8; i++) {
      autoShuffle('길이 다 막혀서 섞었어! 🔀', 'free')
      if (findMove(board)) {
        notice('🔀', '이을 수 있는 길이 없어요!', '카드를 섞어 줄게요 — 다시 찾아 보자 (섞기는 안 줄어요)', { ms: 2000 })
        return
      }
    }
    // 여기까지 오는 판은 사실상 없다. 그래도 아이를 못 누르는 판에 남겨 두지는 않는다
    busy = true
    notice('🧱', '이을 수 있는 길이 없어요!', '이 판은 여기까지 — 새 판으로 다시 해 볼까?', {
      ms: 2200,
      onClose: () => finish('blocked'),
    })
  }

  /**
   * 섞는다. `'paid'`(아이가 섞기 버튼을 누른 것)만 남은 횟수를 깎는다.
   * `'free'`는 길이 다 막혀 게임이 스스로 섞는 것 — 아이 잘못이 아니므로 값을 매기지 않는다.
   */
  function autoShuffle(message: string, cost: 'paid' | 'free' = 'paid'): void {
    if (cost === 'paid' && shufflesLeft <= 0) return
    reshuffle(board)
    shuffles++
    if (cost === 'paid') shufflesLeft--
    selected = null
    say.textContent = message
    say.className = 'en-q-say en-again'
    paintShuffleBtn()
    paint()
  }

  const shuffleBtn = el('button', { class: 'en-shisen-shuffle' })

  /** 남은 횟수를 버튼에 적는다 — 아이가 누르기 전에 몇 번 남았는지 보이게 */
  function paintShuffleBtn(): void {
    shuffleBtn.textContent = shufflesLeft > 0 ? `🔀 섞기 (${shufflesLeft}번 남음)` : '🔀 섞기 다 썼어요'
    shuffleBtn.disabled = shufflesLeft <= 0
  }

  shuffleBtn.addEventListener('click', () => {
    if (busy || shufflesLeft <= 0) return
    autoShuffle(`섞었어! 🔀 (${shufflesLeft - 1}번 남음)`)
  })

  // 판 크기 고르기 — 누르면 그 크기로 새 판을 깐다(진행 중인 판은 버린다)
  const sizeRow = el(
    'div',
    { class: 'en-shisen-sizes' },
    SIZES.map((sz) => {
      const b = el('button', {
        class: `en-shisen-size${sz.id === size.id ? ' en-is-sel' : ''}`,
        text: `${sz.label} ${sz.rows}×${sz.cols}`,
      })
      b.addEventListener('click', () => {
        if (sz.id === size.id) return
        stopAll()
        runShisen(stage, onQuit, onDone, sz.id)
      })
      return b
    })
  )

  render(
    top('사천성', onQuit, `${TILES / 2}쌍`),
    el('div', { class: 'en-q' }, [
      el('div', { class: 'en-icpt-hud' }, [chancesEl, pairsEl]),
      left,
      wrap,
      say,
      shuffleBtn,
      sizeRow,
    ])
  )
  grid.style.setProperty('--en-cols', String(cols))
  paintShuffleBtn()
  paint()

  // 큰 판은 타일이 작아진다 — 폰에서 고르면 그 사실을 알려 준다(막지는 않는다)
  if (size.id === 'l' && narrow) {
    notice('🔎', '큰 판이에요!', '타일이 작아져요 — 화면을 옆으로 돌리면 더 편해요', { ms: 2000 })
  }

  // 검증용: 막힌 판은 우연히 만들기 어렵다 → 개발 모드에서 판을 직접 만져 이 경로를 확인할 수 있게 열어 둔다
  if (import.meta.env.DEV) {
    ;(window as unknown as { __shisen?: unknown }).__shisen = {
      board,
      paint,
      chances: () => chances,
      shufflesLeft: () => shufflesLeft,
      /** 섞기를 n번 써 버린다 (제한에 걸린 상태를 검증하려고) */
      useShuffles: (n: number) => {
        for (let i = 0; i < n; i++) autoShuffle('검증용 섞기')
      },
      findMove: () => !!findMove(board),
      /** 지금 막혀 있으면 안내창을 띄우고 섞는다 (게임이 스스로 하는 것과 같은 경로) */
      checkBlocked: () => {
        if (findMove(board)) return false
        blockedAndShuffle()
        return true
      },
    }
  }
}
