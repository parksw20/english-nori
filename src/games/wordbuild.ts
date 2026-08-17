/**
 * 낱말 만들기 — 그림을 보고 글자 타일을 순서대로 눌러 스펠링을 완성한다.
 *
 * 파닉스에서 듣기(고르기)보다 한 단계 어려운 활동이다: 소리를 글자로 바꿔 내보내야 한다.
 * 그래서 **틀린 자리를 알려 주지 않고**(그러면 찍기가 된다) 잘못 누른 타일만 되돌린다.
 * 타일은 정답 글자 + 방해 글자를 섞은 것이고, 방해 글자는 **같은 단계에서 배운 자음**에서 뽑는다.
 */
import { cvcWordsUpTo } from '../phonics'
import type { StageId, Word } from '../data/types'
import { shuffle } from '../rand'
import * as sfx from '../sfx'
import * as tts from '../tts'
import { el, progressBar, render, top } from '../ui'

const ROUNDS = 6

export interface BuildResult {
  right: number
  total: number
  perWord: Map<string, boolean>
}

export function runWordBuild(stage: StageId, onQuit: () => void, onDone: (r: BuildResult) => void): void {
  const pool = cvcWordsUpTo(stage)
  const words = shuffle(pool).slice(0, ROUNDS)
  const result: BuildResult = { right: 0, total: words.length, perWord: new Map() }
  let i = 0

  function step(): void {
    const w = words[i]
    if (!w) return onDone(result)
    renderRound(w)
  }

  function renderRound(w: Word): void {
    const letters = w.en.split('')
    // 방해 타일 3개 — 다른 CVC 낱말에서 쓰이는 글자에서 뽑는다(엉뚱한 글자는 답이 너무 쉽다)
    const others = [...new Set(pool.flatMap((x) => x.en.split('')))].filter((c) => !letters.includes(c))
    const tiles = shuffle([...letters, ...shuffle(others).slice(0, 3)])

    const filled: (string | null)[] = letters.map(() => null)
    /** 어느 타일에서 왔는지 — 되돌릴 때 그 타일을 다시 살린다 */
    const fromTile: (number | null)[] = letters.map(() => null)
    let mistakes = 0

    const slotRow = el('div', { class: 'en-build-slots' })
    const tileRow = el('div', { class: 'en-build-tiles' })
    const say = el('p', { class: 'en-q-say' })

    const slotEls = letters.map((_, idx) => {
      const s = el('div', { class: 'en-build-slot', 'data-slot': idx })
      s.addEventListener('click', () => undo(idx))
      return s
    })
    slotRow.append(...slotEls)

    const tileEls = tiles.map((ch, idx) => {
      const b = el('button', { class: 'en-build-tile', text: ch, 'data-tile': idx })
      b.addEventListener('click', () => put(ch, idx))
      return b
    })
    tileRow.append(...tileEls)

    function paint(): void {
      slotEls.forEach((s, idx) => {
        const v = filled[idx]
        s.textContent = v ?? ''
        s.classList.toggle('en-is-filled', v !== null)
      })
      tileEls.forEach((t, idx) => {
        t.disabled = fromTile.includes(idx)
      })
    }

    function put(ch: string, tileIdx: number): void {
      const next = filled.indexOf(null)
      if (next === -1) return
      // 이 자리에 맞는 글자가 아니면 놓지 않는다. 어느 자리가 틀렸는지는 알려주지 않는다.
      if (letters[next] !== ch) {
        mistakes++
        sfx.again()
        say.textContent = '음… 소리를 다시 들어 보자 👂'
        say.className = 'en-q-say en-again'
        tts.speak(w.en, { rate: 0.6 })
        return
      }
      filled[next] = ch
      fromTile[next] = tileIdx
      sfx.tap()
      paint()
      if (!filled.includes(null)) done()
    }

    function undo(idx: number): void {
      if (filled[idx] === null) return
      // 마지막에 넣은 것부터 되돌린다 (중간을 비우면 다음 자리 계산이 틀어진다)
      const last = filled.reduce((acc, v, k) => (v !== null ? k : acc), -1)
      if (idx !== last) return
      filled[idx] = null
      fromTile[idx] = null
      paint()
    }

    function done(): void {
      const ok = mistakes === 0
      if (ok) result.right++
      result.perWord.set(w.en, ok)
      sfx.good()
      say.textContent = ok ? '완성! 🎉' : '완성했어! 👏'
      say.className = 'en-q-say en-good'
      tts.blend(w.en, () => {
        i++
        step()
      })
    }

    render(
      top('낱말 만들기', onQuit, `${i + 1} / ${words.length}`),
      progressBar(i, words.length),
      el('div', { class: 'en-q' }, [
        el('p', { class: 'en-q-ask', text: '그림을 보고 글자를 순서대로 눌러 봐' }),
        el('div', { class: 'en-q-show' }, [el('span', { text: w.emoji })]),
        slotRow,
        tileRow,
        say,
      ])
    )
    paint()
    setTimeout(() => tts.blend(w.en), 250)
  }

  step()
}
