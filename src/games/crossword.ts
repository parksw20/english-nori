/**
 * 가로세로 퀴즈 — 그림을 보고 칸에 낱말을 채운다.
 *
 * 다른 놀이는 **주어진 보기 중에 고르는** 것이고 여기는 **철자를 처음부터 끝까지 스스로 만드는** 것이다.
 * 그래서 같은 낱말이라도 훨씬 어렵고, 마을이 올라간 뒤에야 열린다(초급 3번 마을 · 중급 4번 · 고급 5번).
 *
 * 7세를 위한 규칙 세 가지:
 * - **글쇠는 화면 안에 있다.** 키보드를 못 치는 아이가 대상이라 A~Z 글자판을 붙였다.
 * - **문제는 그림이다.** 뜻풀이 문장을 못 읽으니 그림과 한글 뜻만 보여준다.
 * - **틀린 채로 두지 않는다.** 낱말을 다 채우면 바로 맞는지 알려 주고, 맞으면 초록으로 잠근다.
 */
import { LEVELS, levelOf, makePuzzle, type Level, type Placed } from '../crossword'
import type { StageId, Word } from '../data/types'
import { picturableUpTo, stageOf } from '../phonics'
import * as progress from '../progress'
import * as sfx from '../sfx'
import * as tts from '../tts'
import { el, notice, render, top } from '../ui'

export interface CrosswordResult {
  levelId: Level['id']
  seconds: number
  /** 다 채웠는가 */
  cleared: boolean
  /** 채운 낱말 수 / 전체 */
  solved: number
  total: number
  words: string[]
  /** 다 풀었을 때 주는 글자 카드 수 */
  reward: number
}

const KEY_ROWS = ['abcdefg', 'hijklmn', 'opqrstu', 'vwxyz']

/** 모음은 글자판에서도 다르게 보인다 (ABC 알파벳 화면과 같은 표시) */
const VOWELS = ['a', 'e', 'i', 'o', 'u']

/** 난이도 고르기 — 잠긴 것은 **보여주되 누를 수 없게** 한다(다음 목표가 보여야 한다) */
export function runCrossword(
  stage: StageId,
  onQuit: () => void,
  onDone: (r: CrosswordResult) => void,
  levelId?: Level['id']
): void {
  if (levelId) {
    runLevel(stage, levelOf(levelId), onQuit, onDone)
    return
  }

  const kids: Node[] = [
    el('p', { class: 'en-dex-hint', text: '그림을 보고 칸에 낱말을 채워요. 난이도를 골라 보세요' }),
  ]
  for (const l of LEVELS) {
    const open = stage >= l.stage
    const best = progress.bestTimeOf(`crossword-${l.id}`)
    const b = el('button', { class: `en-big${open ? '' : ' en-is-locked'}`, disabled: !open }, [
      el('span', { class: 'en-big-emoji', text: open ? '✏️' : '🔒' }),
      el('span', {}, [
        `${l.label} ${l.size}×${l.size}`,
        el('span', {
          class: 'en-big-sub',
          text: open
            ? `낱말 ${l.words}개 · 다 풀면 카드 ${l.reward}장${best !== null ? ` · 🏆 최고 ${best}초` : ''}`
            : `${l.stage + 1}번 마을에서 열려요`,
        }),
      ]),
    ])
    if (open) b.addEventListener('click', () => runLevel(stage, l, onQuit, onDone))
    kids.push(b)
  }

  render(top('가로세로 퀴즈 ✏️', onQuit, '난이도 고르기'), el('div', {}, kids))
}

function runLevel(stage: StageId, level: Level, onQuit: () => void, onDone: (r: CrosswordResult) => void): void {
  /**
   * **열린 마을까지의 낱말** 중 **그 단계에서 소리 내어 읽고 쓸 수 있는 것**만 쓴다.
   *
   * 그림만 보고 고르는 놀이가 아니라 **철자를 한 글자씩 만드는** 놀이다 —
   * nose(마법의 e)는 쌍자음 마을 아이에게 그림으로는 알아도 쓸 수는 없는 낱말이다
   * (검증에서 실제로 쌍자음 판에 nose가 나왔다).
   */
  const pool = picturableUpTo(stage).filter((w) => stageOf(w.en) <= stage)
  const byWord = new Map(pool.map((w) => [w.en, w]))
  const puzzle = makePuzzle(
    pool.map((w) => w.en),
    level
  )
  if (!puzzle) {
    notice('🔎', '판을 못 만들었어요', '낱말이 더 모이면 다시 해 봐요', { ms: 2000, onClose: onQuit })
    return
  }

  const started = Date.now()
  /** 아이가 채워 넣은 글자 (정답과 같은 모양의 판) */
  const filled: (string | null)[][] = puzzle.cells.map((row) => row.map(() => null))
  const solved = new Set<string>()
  /** 지금 고른 낱말과 그 안에서의 위치 */
  let current: Placed | undefined = puzzle.words[0]
  let cursor = 0

  const grid = el('div', { class: 'en-cw-grid' })
  grid.style.setProperty('--en-cw-cols', String(puzzle.cols))
  const say = el('p', { class: 'en-q-say' })
  const clueBox = el('div', { class: 'en-cw-clues' })
  const hintLine = el('p', { class: 'en-cw-now' })

  function cellsOf(w: Placed): { r: number; c: number }[] {
    return Array.from({ length: w.word.length }, (_, i) => ({
      r: w.row + (w.dir === 'down' ? i : 0),
      c: w.col + (w.dir === 'across' ? i : 0),
    }))
  }

  function isSolved(w: Placed): boolean {
    return solved.has(keyOf(w))
  }

  function keyOf(w: Placed): string {
    return `${w.no}${w.dir}`
  }

  /** 그 칸이 이미 맞힌 낱말의 칸인가 (맞힌 글자는 지우지 않는다) */
  function locked(r: number, c: number): boolean {
    return puzzle!.words.some((w) => isSolved(w) && cellsOf(w).some((p) => p.r === r && p.c === c))
  }

  function paint(): void {
    grid.replaceChildren()
    for (let r = 0; r < puzzle!.rows; r++) {
      for (let c = 0; c < puzzle!.cols; c++) {
        const answer = puzzle!.cells[r]?.[c] ?? null
        if (answer === null) {
          grid.append(el('span', { class: 'en-cw-blank' }))
          continue
        }
        const starts = puzzle!.words.find((w) => w.row === r && w.col === c)
        const inCurrent = current ? cellsOf(current).some((p) => p.r === r && p.c === c) : false
        const isCursor = inCurrent && current ? cellsOf(current)[cursor]?.r === r && cellsOf(current)[cursor]?.c === c : false
        const box = el(
          'button',
          {
            class: `en-cw-cell${inCurrent ? ' en-is-on' : ''}${isCursor ? ' en-is-cursor' : ''}${locked(r, c) ? ' en-is-done' : ''}`,
            'data-rc': `${r},${c}`,
          },
          [
            ...(starts ? [el('span', { class: 'en-cw-no', text: String(starts.no) })] : []),
            el('span', { class: 'en-cw-ch', text: filled[r]?.[c] ?? '' }),
          ]
        )
        box.addEventListener('click', () => selectCell(r, c))
        grid.append(box)
      }
    }
    paintClues()
    paintNow()
  }

  /** 문제 목록 — 그림과 한글 뜻. 맞힌 것은 흐려지고 영어 철자가 드러난다 */
  function paintClues(): void {
    const line = (dir: 'across' | 'down'): HTMLElement => {
      const mine = puzzle!.words.filter((w) => w.dir === dir)
      return el('div', { class: 'en-cw-cluecol' }, [
        el('p', { class: 'en-cw-cluehead', text: dir === 'across' ? '가로 →' : '세로 ↓' }),
        ...mine.map((w) => {
          const word = byWord.get(w.word) as Word
          const done = isSolved(w)
          const b = el('button', { class: `en-cw-clue${done ? ' en-is-done' : ''}${current === w ? ' en-is-on' : ''}` }, [
            el('span', { class: 'en-cw-clueno', text: String(w.no) }),
            el('span', { class: 'en-cw-clueemoji', text: word.emoji }),
            el('span', { class: 'en-cw-clueko', text: done ? `${word.ko} · ${w.word}` : word.ko }),
          ])
          b.addEventListener('click', () => select(w))
          return b
        }),
      ])
    }
    clueBox.replaceChildren(line('across'), line('down'))
  }

  function paintNow(): void {
    if (!current) {
      hintLine.textContent = ''
      return
    }
    const word = byWord.get(current.word) as Word
    hintLine.replaceChildren(
      el('span', { class: 'en-cw-now-emoji', text: word.emoji }),
      el('span', { text: `${current.no}. ${word.ko} (${current.dir === 'across' ? '가로' : '세로'} ${current.word.length}글자)` })
    )
  }

  function select(w: Placed): void {
    if (isSolved(w)) {
      // 이미 맞힌 낱말은 다시 고르지 않고 소리만 들려준다 — 지워질까 봐 못 누르게 하면 소리도 못 듣는다
      tts.say(w.word)
      return
    }
    current = w
    // **낱말의 처음**에 커서를 둔다. 빈칸부터 시작하게 했더니, 겹친 글자가 이미 채워진 낱말에서
    // 아이가 낱말을 통째로 치면 한 칸씩 밀렸다(lamp → l·l·a·p). 아이는 앞 글자를 빼고 치지 않는다
    cursor = 0
    say.textContent = ''
    paint()
  }

  /** 칸을 누르면 그 칸이 든 낱말을 고른다. 가로·세로가 겹치면 **누를 때마다 번갈아** 바뀐다 */
  function selectCell(r: number, c: number): void {
    const here = puzzle!.words.filter((w) => !isSolved(w) && cellsOf(w).some((p) => p.r === r && p.c === c))
    if (here.length === 0) return
    const next = (here.includes(current as Placed) ? here[(here.indexOf(current as Placed) + 1) % here.length] : here[0]) as Placed
    current = next
    cursor = cellsOf(next).findIndex((p) => p.r === r && p.c === c)
    say.textContent = ''
    paint()
  }

  function typeLetter(ch: string): void {
    if (!current) return
    const cells = cellsOf(current)
    /**
     * 이미 맞힌 낱말과 겹쳐 **잠긴 칸**을 지날 때.
     *
     * 아이는 두 가지로 친다: 낱말을 **통째로**(겹친 글자까지) 치거나, **빠진 글자만** 친다.
     * 둘 다 되게 하려면 잠긴 칸에서 이렇게 나눈다 —
     *  - 누른 글자가 그 칸의 글자와 같으면: "통째로 치는 중"이니 **글자를 쓴 셈 치고** 다음 칸으로
     *  - 다르면: "빠진 글자만 치는 중"이니 글자는 들고 **칸만** 넘어간다
     * (처음에는 무조건 넘기기만 했더니 pot이 ppt가 됐다 — p가 이미 있는데 p를 한 칸 뒤에 썼다)
     */
    while (cursor < cells.length) {
      const at = cells[cursor] as { r: number; c: number }
      if (!locked(at.r, at.c)) break
      const there = filled[at.r]?.[at.c]
      cursor++
      if (there === ch) {
        paint()
        return
      }
    }
    const spot = cells[cursor]
    if (!spot) {
      cursor = cells.length - 1
      return
    }
    ;(filled[spot.r] as (string | null)[])[spot.c] = ch
    cursor = Math.min(cursor + 1, cells.length - 1)
    paint()
    checkWord(current)
  }

  function erase(): void {
    if (!current) return
    const cells = cellsOf(current)
    const spot = cells[cursor]
    if (!spot) return
    if (filled[spot.r]?.[spot.c] && !locked(spot.r, spot.c)) {
      ;(filled[spot.r] as (string | null)[])[spot.c] = null
    } else if (cursor > 0) {
      cursor--
      const prev = cells[cursor]
      if (prev && !locked(prev.r, prev.c)) (filled[prev.r] as (string | null)[])[prev.c] = null
    }
    say.textContent = ''
    paint()
  }

  /** 낱말이 다 찼으면 맞는지 본다 — 아이가 "다 됐어요" 버튼을 찾지 않게 스스로 확인한다 */
  function checkWord(w: Placed): void {
    const cells = cellsOf(w)
    const letters = cells.map((p) => filled[p.r]?.[p.c] ?? null)
    // 빈칸이 하나라도 있으면 아직 볼 때가 아니다.
    // (처음엔 join한 뒤 `typed.includes('')`로 봤는데 **모든 문자열은 빈 문자열을 포함한다** —
    //  그래서 늘 참이 되어 채점이 한 번도 돌지 않았다. 화면은 멀쩡해 보였다)
    if (letters.some((x) => !x)) return
    const typed = letters.join('')
    if (typed !== w.word) {
      sfx.again()
      say.textContent = `${typed} — 다시 한번 볼까? 🔎`
      say.className = 'en-q-say en-again'
      return
    }
    solved.add(keyOf(w))
    // 겹쳐 지나가는 낱말이 이 글자 덕에 완성됐을 수도 있다
    sfx.good()
    tts.say(w.word)
    const word = byWord.get(w.word) as Word
    say.textContent = `${w.word} — ${word.ko} 👏`
    say.className = 'en-q-say en-good'
    for (const other of puzzle!.words) {
      if (other !== w && !isSolved(other)) {
        const t = cellsOf(other)
          .map((p) => filled[p.r]?.[p.c] ?? '')
          .join('')
        if (t === other.word) solved.add(keyOf(other))
      }
    }
    // 다음에 풀 낱말로 저절로 옮겨 준다
    const next = puzzle!.words.find((x) => !isSolved(x))
    if (next) {
      current = next
      cursor = cellsOf(next).findIndex((p) => !filled[p.r]?.[p.c])
      if (cursor < 0) cursor = 0
    }
    paint()
    if (solved.size === puzzle!.words.length) finish(true)
  }

  function finish(cleared: boolean): void {
    tts.stop()
    const seconds = Math.round((Date.now() - started) / 1000)
    if (cleared) sfx.fanfare()
    onDone({
      levelId: level.id,
      seconds,
      cleared,
      solved: solved.size,
      total: puzzle!.words.length,
      words: puzzle!.words.map((w) => w.word),
      reward: cleared ? level.reward : 0,
    })
  }

  // ── 글자판 ────────────────────────────────────────────────
  const pad = el(
    'div',
    { class: 'en-cw-pad' },
    KEY_ROWS.map((row) =>
      el(
        'div',
        { class: 'en-cw-padrow' },
        [...row].map((ch) => {
          const k = el('button', {
            class: `en-cw-key${VOWELS.includes(ch) ? ' en-is-vowel' : ''}`,
            text: ch,
            'data-key': ch,
          })
          k.addEventListener('click', () => typeLetter(ch))
          return k
        })
      )
    )
  )
  const back = el('button', { class: 'en-cw-key en-cw-erase', text: '⌫', 'aria-label': '지우기' })
  back.addEventListener('click', erase)
  const hear = el('button', { class: 'en-cw-key en-cw-hear', text: '🔊', 'aria-label': '들어보기' })
  hear.addEventListener('click', () => current && tts.say(current.word))
  pad.append(el('div', { class: 'en-cw-padrow' }, [back, hear]))

  // 물리 키보드도 받는다 — 어른이 옆에서 도와줄 때 훨씬 빠르다
  const onKey = (e: KeyboardEvent): void => {
    if (!document.body.contains(grid)) {
      window.removeEventListener('keydown', onKey)
      return
    }
    if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toLowerCase())
    else if (e.key === 'Backspace') erase()
  }
  window.addEventListener('keydown', onKey)

  const giveUp = el('button', { class: 'en-mini', text: '그만하기' })
  giveUp.addEventListener('click', () => finish(false))

  render(
    top(`가로세로 ${level.label}`, onQuit, `낱말 ${puzzle.words.length}개`),
    el('div', { class: 'en-q' }, [hintLine, grid, say, pad, clueBox, el('div', { class: 'en-minirow' }, [giveUp])])
  )
  paint()

  if (import.meta.env.DEV) {
    ;(window as unknown as { __cw?: unknown }).__cw = {
      puzzle,
      type: typeLetter,
      select,
      solveAll: () => {
        for (const w of puzzle.words) {
          select(w)
          for (const ch of w.word) typeLetter(ch)
        }
      },
    }
  }
}
