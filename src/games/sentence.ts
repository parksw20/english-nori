/**
 * 문장 놀이 — **아이가 스스로 읽을 수 있는 문장**으로 세 단계를 지난다.
 *
 *   ① 듣기   문장을 듣고 알맞은 그림 고르기 (뜻을 잡는 단계)
 *   ② 어순   섞인 낱말을 순서대로 놓아 문장 만들기 (구조를 잡는 단계)
 *   ③ 말하기 문장을 듣고 따라 말하기 (입으로 내보내는 단계 — **내용어가 몇 개 들렸는지로 채점**)
 *
 * 세 단계를 **낱말마다 번갈아** 하지 않고 단계별로 묶은 이유: 7세는 규칙이 자주 바뀌면
 * 문제를 푸는 대신 "지금 뭘 하는 거지"를 계속 다시 배운다. 한 단계를 몇 문장 이어서 하는 편이 낫다.
 *
 * 문장에 쓰이는 낱말은 전부 배운 CVC 낱말과 sight words다(sentence.ts가 계산해 만든다) —
 * 못 읽는 낱말이 섞이면 ②·③에서 아이가 할 수 있는 일이 사라진다.
 */
import type { StageId } from '../data/types'
import { shuffle } from '../rand'
import { makeSentences, type Sentence } from '../sentence'
import * as sfx from '../sfx'
import { speakBox } from '../speakbox'
import * as tts from '../tts'
import { el, notice, progressBar, render, top } from '../ui'

/** 단계별 문장 수 — 합쳐 8문항이면 7세가 한 번에 끝낼 수 있다 */
const LISTEN = 3
const ORDER = 3
const SPEAK = 2

export interface SentenceResult {
  right: number
  /** 채점 대상 문항 수 (듣기 + 어순 + 채점된 말하기) */
  total: number
  /** 다룬 낱말 (SRS로 넘긴다) */
  perWord: Map<string, boolean>
  /** 말하기를 몇 문장 했나 */
  spoke: number
}

export function runSentence(stage: StageId, onQuit: () => void, onDone: (r: SentenceResult) => void): void {
  const all = makeSentences(stage, LISTEN + ORDER + SPEAK)
  if (all.length === 0) {
    notice('🌱', '아직 문장을 만들 낱말이 모자라요', '낱말을 더 익히고 오면 열려요', { ms: 2000, onClose: onQuit })
    return
  }

  const result: SentenceResult = { right: 0, total: LISTEN + ORDER + SPEAK, perWord: new Map(), spoke: 0 }
  let i = 0

  /** 지금 문장. 단계는 순서(i)로 정해진다 */
  const phaseOf = (n: number): 'listen' | 'order' | 'speak' =>
    n < LISTEN ? 'listen' : n < LISTEN + ORDER ? 'order' : 'speak'

  function next(): void {
    i++
    step()
  }

  function step(): void {
    const s = all[i]
    if (!s || i >= all.length) {
      onDone(result)
      return
    }
    const phase = phaseOf(i)
    if (phase === 'listen') return listen(s)
    if (phase === 'order') return order(s)
    return speak(s)
  }

  /** 공통 머리말 */
  function head(label: string): Node[] {
    return [
      top('문장 놀이', onQuit, `${i + 1} / ${all.length}`),
      progressBar(i, all.length),
      el('p', { class: 'en-q-ask', text: label }),
    ]
  }

  // ── ① 듣기: 문장을 듣고 그림 고르기 ───────────────────────────────
  function listen(s: Sentence): void {
    const answer = s.fills[0]
    if (!answer) return next()
    const others = shuffle(
      all.flatMap((x) => x.fills).filter((w) => w.en !== answer.en),
      Math.random
    )
    const seen = new Set([answer.en])
    const picks = [answer]
    for (const w of others) {
      if (seen.has(w.en)) continue
      seen.add(w.en)
      picks.push(w)
      if (picks.length >= 4) break
    }

    const say = el('p', { class: 'en-q-say' })
    const speaker = el('button', { class: 'en-q-speaker', text: '🔊', 'aria-label': '문장 듣기' })
    speaker.addEventListener('click', () => tts.speak(s.en, { rate: 0.75 }))

    const grid = el('div', { class: 'en-q-choices' })
    let answered = false
    const buttons = shuffle(picks, Math.random).map((w) => {
      const b = el('button', { class: 'en-q-choice en-q-choice-emoji', text: w.emoji, 'data-choice': w.en })
      b.addEventListener('click', () => {
        if (answered) return
        answered = true
        for (const x of buttons) x.disabled = true
        const ok = w.en === answer.en
        if (ok) result.right++
        result.perWord.set(answer.en, ok)
        b.classList.add(ok ? 'en-is-right' : 'en-is-again')
        if (!ok) buttons.find((x) => x.dataset.choice === answer.en)?.classList.add('en-is-right')
        say.textContent = ok ? `맞았어! ${s.en} 👏` : `${s.en} — ${s.ko} 👂`
        say.className = `en-q-say ${ok ? 'en-good' : 'en-again'}`
        ok ? sfx.good() : sfx.again()
        tts.speak(s.en, { rate: 0.8, onEnd: () => setTimeout(next, 400) })
      })
      return b
    })
    grid.append(...buttons)

    render(...head('문장을 듣고 알맞은 그림을 골라 봐'), el('div', { class: 'en-q' }, [
      el('div', { class: 'en-q-show' }, [speaker]),
      grid,
      say,
    ]))
    setTimeout(() => tts.speak(s.en, { rate: 0.75 }), 250)
  }

  // ── ② 어순: 섞인 낱말을 순서대로 ──────────────────────────────────
  function order(s: Sentence): void {
    const target = s.words
    const placed: string[] = []
    let mistakes = 0

    const line = el('div', { class: 'en-sen-line' })
    const bank = el('div', { class: 'en-sen-bank' })
    const say = el('p', { class: 'en-q-say' })

    function paint(): void {
      line.replaceChildren(
        ...target.map((_, idx) =>
          el('div', { class: `en-sen-slot${placed[idx] ? ' en-is-filled' : ''}`, text: placed[idx] ?? '' })
        )
      )
      // 아직 안 놓은 낱말만 아래에 남긴다
      const left = [...target]
      for (const p of placed) {
        const k = left.indexOf(p)
        if (k >= 0) left.splice(k, 1)
      }
      bank.replaceChildren(
        ...shuffleStable(left).map((w) => {
          const b = el('button', { class: 'en-sen-tile', text: w })
          b.addEventListener('click', () => put(w))
          return b
        })
      )
    }

    /** 남은 낱말 순서를 매번 바꾸면 아이가 눈으로 따라가지 못한다 → 한 번 섞은 순서를 유지한다 */
    const bankOrder = shuffle(target, Math.random)
    function shuffleStable(left: string[]): string[] {
      const out: string[] = []
      const rest = [...left]
      for (const w of bankOrder) {
        const k = rest.indexOf(w)
        if (k >= 0) {
          out.push(w)
          rest.splice(k, 1)
        }
      }
      return [...out, ...rest]
    }

    function put(w: string): void {
      const idx = placed.length
      if (target[idx] !== w) {
        mistakes++
        sfx.again()
        say.textContent = '그 낱말이 아니야 — 다시 들어 볼까? 👂'
        say.className = 'en-q-say en-again'
        tts.speak(s.en, { rate: 0.7 })
        return
      }
      placed.push(w)
      sfx.tap()
      say.textContent = ''
      paint()
      if (placed.length < target.length) return

      const ok = mistakes === 0
      if (ok) result.right++
      for (const f of s.fills) result.perWord.set(f.en, ok)
      sfx.good()
      say.textContent = `${s.en} 👏`
      say.className = 'en-q-say en-good'
      tts.speak(s.en, { rate: 0.85, onEnd: () => setTimeout(next, 500) })
    }

    const hear = el('button', { class: 'en-mk-hear', text: '🔊 다시 듣기' })
    hear.addEventListener('click', () => tts.speak(s.en, { rate: 0.7 }))

    render(...head('들은 문장이 되도록 낱말을 순서대로 놓아 봐'), el('div', { class: 'en-q' }, [
      el('p', { class: 'en-sen-ko', text: s.ko }),
      line,
      bank,
      hear,
      say,
    ]))
    paint()
    setTimeout(() => tts.speak(s.en, { rate: 0.7 }), 250)
  }

  // ── ③ 말하기: 듣고 따라 말하기 (채점한다) ─────────────────────────
  function speak(s: Sentence): void {
    // 문장 채점은 **내용어가 몇 개 들렸는지**로 한다 — 통째로 대조하면 아이는 거의 못 넘는다.
    const box = speakBox({
      text: s.en,
      onDone: (r) => {
        result.spoke++
        if (r.ok === true) result.right++
        // 말하기도 그 문장의 낱말을 다룬 것이다 → SRS에 남긴다(채점을 못 했으면 '봤다'로만)
        for (const f of s.fills) result.perWord.set(f.en, r.ok !== false)
      },
    })

    const wrap = el('div', { class: 'en-q' }, [
      el('p', { class: 'en-sen-target', text: s.en }),
      el('p', { class: 'en-sen-ko', text: s.ko }),
      ...box.nodes,
    ])
    // 「다음 ▶」이 speakBox 안에 있어서 이벤트로 올려 받는다
    wrap.addEventListener('en-next', () => {
      box.stop()
      next()
    })

    render(...head('문장을 듣고 따라 말해 봐'), wrap)
    setTimeout(() => tts.speak(s.en, { rate: 0.75 }), 250)
  }

  step()
}
