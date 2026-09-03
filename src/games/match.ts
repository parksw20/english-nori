/**
 * 그림 짝맞추기 — 낱말 카드와 그림 카드를 뒤집어 짝을 찾는다.
 *
 * 짝을 맞출 때마다 그 낱말을 소리로 들려준다. 기억력 놀이지만 실제 학습은 그 소리에서 온다.
 *
 * **소리가 나는 동안 입력을 막지 않는다.** 처음에는 "연타로 소리를 지우지 못하게" 막아 뒀는데,
 * 브라우저 검증에서 짝을 맞춘 직후 누른 카드가 반응하지 않는 것이 드러났다 —
 * 아이 눈에는 게임이 멈춘 것으로 보인다. 소리는 tts.speak가 알아서 이전 것을 끊으므로 겹치지 않는다.
 * 입력을 막는 것은 **짝이 아닐 때 두 장을 보여주는 0.9초뿐**이다(그건 봐야 하는 시간이라 막아야 한다).
 */
import { gameWordsFor } from '../phonics'
import type { StageId, Word } from '../data/types'
import { shuffle } from '../rand'
import * as sfx from '../sfx'
import * as tts from '../tts'
import { el, render, top } from '../ui'

/** 짝 수 — 7세 기준으로 6쌍(12장)이 한 판에 알맞다 */
const PAIRS = 6

interface Card {
  id: number
  word: Word
  kind: 'word' | 'emoji'
  done: boolean
}

export interface MatchResult {
  /** 뒤집은 횟수 (적을수록 잘한 것) */
  flips: number
  pairs: number
  words: string[]
}

export function runMatch(stage: StageId, onQuit: () => void, onDone: (r: MatchResult) => void): void {
  // 낱말↔그림 짝이 성립해야 하므로 **그림으로 알아볼 수 있는 낱말만** 쓴다(🐘=big은 짝을 찾을 수 없다).
  // 읽을 수 있는 낱말(CVC)이 충분하면 그것으로, 모자라면(단계 0) 그 단계 낱말 전체에서.
  const pool = gameWordsFor(stage, { picturable: true, maxLen: 8, count: PAIRS * 2 })
  const chosen = shuffle(pool).slice(0, PAIRS)
  const cards: Card[] = shuffle(
    chosen.flatMap((w, k) => [
      { id: k * 2, word: w, kind: 'word' as const, done: false },
      { id: k * 2 + 1, word: w, kind: 'emoji' as const, done: false },
    ])
  )

  let open: Card[] = []
  let flips = 0
  let matched = 0
  /** 짝이 아닌 두 장을 되돌리는 동안에만 입력을 막는다 */
  let busy = false

  const grid = el('div', { class: 'en-match-grid' })
  const say = el('p', { class: 'en-q-say' })

  function face(c: Card): string {
    return c.kind === 'emoji' ? c.word.emoji : c.word.en
  }

  function paint(): void {
    grid.replaceChildren(
      ...cards.map((c) => {
        const shown = c.done || open.includes(c)
        const b = el('button', {
          class: `en-match-card${c.done ? ' en-is-done' : shown ? ' en-is-open' : ''}`,
          text: shown ? face(c) : '?',
          'data-card': c.id,
          'data-word': c.word.en,
        })
        if (!c.done && !shown) b.addEventListener('click', () => flip(c))
        return b
      })
    )
  }

  function flip(c: Card): void {
    if (busy || open.includes(c) || c.done) return
    open.push(c)
    flips++
    sfx.tap()
    paint()
    if (open.length < 2) {
      // 첫 장을 열면 그 낱말을 읽어 준다 — 그림이든 글자든 같은 소리로 이어 준다
      tts.speak(c.word.en, { rate: 0.85 })
      return
    }

    const [a, b] = open as [Card, Card]
    if (a.word.en === b.word.en) {
      a.done = true
      b.done = true
      matched++
      open = []
      paint()
      sfx.good()
      say.textContent = `${a.word.en} — ${a.word.ko} 👏`
      say.className = 'en-q-say en-good'
      // 소리는 들려주지만 다음 카드를 바로 누를 수 있다
      tts.speak(a.word.en, { rate: 0.8 })
      if (matched === PAIRS) {
        sfx.fanfare()
        // 마지막 낱말 소리는 끝까지 들려주고 결과로 넘어간다
        setTimeout(() => onDone({ flips, pairs: PAIRS, words: chosen.map((w) => w.en) }), 1100)
      }
    } else {
      busy = true
      say.textContent = '짝이 아니야, 다시 찾아 보자 🔁'
      say.className = 'en-q-say en-again'
      setTimeout(() => {
        open = []
        busy = false
        paint()
      }, 900)
    }
  }

  render(
    top('그림 짝맞추기', onQuit),
    el('div', { class: 'en-q' }, [el('p', { class: 'en-q-ask', text: '같은 낱말과 그림을 찾아 봐' }), grid, say])
  )
  paint()
}
