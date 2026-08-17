/**
 * 낱말 요격 — 한자놀이의 「독음 요격」을 옮긴 것.
 *
 * 한자놀이에서는 한자어가 떨어지고 **독음(소리)**을 골랐다. 여기서는 영어 낱말이 떨어지고
 * **그림**을 고른다 — 글자를 소리 내어 읽어야(decode) 답할 수 있으니 같은 자리의 연습이다.
 * 보기는 최소대조쌍이 먼저 온다(cat이 떨어지면 🐱🎩🦇🎒) → 첫소리·모음을 구별해야 맞힌다.
 *
 * 한자놀이에서 얻은 두 교훈을 그대로 지킨다:
 * 1. **첫 낱말을 rAF 안에서 띄우지 않는다** — 탭이 뒤에 있으면 rAF가 돌지 않아 게임이 시작조차 못 한다.
 * 2. **경과 시간은 벽시계가 아니라 프레임 델타 누적**(한 프레임 상한 100ms) — 탭을 다시 열면
 *    벽시계로는 낱말이 이미 바닥에 처박혀 즉사한다.
 */
import { choices as makeChoices } from '../distract'
import { picturableCvcUpTo, picturableUpTo } from '../phonics'
import type { StageId, Word } from '../data/types'
import { shuffle } from '../rand'
import * as prefs from '../prefs'
import * as sfx from '../sfx'
import * as tts from '../tts'
import { el, notice, progressBar, render, top } from '../ui'

const LIVES = 3
/**
 * 한 낱말이 바닥까지 내려오는 시간(ms).
 * 한자놀이는 11250ms에서 시작했는데, 영어 낱말은 **소리 내어 읽어야** 하므로 조금 더 준다.
 */
const FALL_START = 12000
const FALL_MIN = 6000
const FALL_STEP = 400

export interface InterceptResult {
  score: number
  solved: number
  /** 다룬 낱말과 맞혔는지 — SRS로 넘긴다 */
  perWord: Map<string, boolean>
}

export function runIntercept(stage: StageId, onQuit: () => void, onDone: (r: InterceptResult) => void): void {
  // 보기가 그림이므로 그림으로 알아볼 수 있는 낱말만 쓴다
  const pool = picturableCvcUpTo(stage).length >= 4 ? picturableCvcUpTo(stage) : picturableUpTo(stage)

  let lives = LIVES
  let score = 0
  let solved = 0
  let queue: Word[] = shuffle(pool)
  let cur: Word | null = null
  let raf = 0
  /** 이 낱말이 떨어진 시간(ms) — 프레임 델타 누적 */
  let elapsed = 0
  let lastTs = 0
  let fallMs = FALL_START
  let over = false
  const perWord = new Map<string, boolean>()

  const sky = el('div', { class: 'en-icpt-sky' })
  const faller = el('div', { class: 'en-icpt-faller' })
  const choiceBox = el('div', { class: 'en-q-choices' })
  const livesEl = el('span', { class: 'en-icpt-lives', text: '❤️'.repeat(LIVES) })
  const scoreEl = el('span', { class: 'en-icpt-score', text: '0점' })
  const say = el('p', { class: 'en-q-say' })

  function stopFall(): void {
    cancelAnimationFrame(raf)
  }

  function quit(): void {
    over = true
    stopFall()
    tts.stop()
    onQuit()
  }

  function nextWord(): void {
    if (over) return
    if (queue.length === 0) queue = shuffle(pool)
    const next = queue.shift()
    if (!next) return
    cur = next

    faller.textContent = cur.en
    faller.className = 'en-icpt-faller'
    faller.style.top = '0px'

    // 보기는 그림. 최소대조쌍이 먼저 오도록 distract.ts가 골라 준다
    const opts = makeChoices(cur, pool)
    choiceBox.replaceChildren(
      ...opts.map((w) => {
        const b = el('button', { class: 'en-q-choice en-q-choice-emoji', text: w.emoji, 'data-choice': w.en })
        b.addEventListener('click', () => answer(w.en))
        return b
      })
    )

    elapsed = 0
    lastTs = 0
    raf = requestAnimationFrame(tick)
  }

  /**
   * 시간을 delta만큼 흘려 낱말을 내린다. **rAF와 분리해 둔 이유**는 두 가지다:
   * 1. 프레임이 안 도는 환경(숨겨진 탭·합성 정지)에서도 검증할 수 있어야 한다 —
   *    한자놀이에서 배운 방식대로 디버그 훅이 이 함수를 직접 부른다.
   * 2. 실제 낙하 로직과 검증이 같은 코드를 지나야 검증이 의미가 있다.
   */
  function advance(delta: number): void {
    if (over || !cur) return
    elapsed += delta
    const t = elapsed / fallMs
    const travel = Math.max(0, sky.clientHeight - faller.offsetHeight)
    faller.style.top = `${Math.max(0, Math.min(1, t) * travel)}px`
    if (t >= 1) miss()
  }

  function tick(now: number): void {
    if (over || !cur) return
    // 화면에서 떠났으면(뒤로 가기) 조용히 멈춘다 — 붙어 있지 않은 DOM을 계속 움직일 이유가 없다
    if (!document.body.contains(sky)) {
      over = true
      return
    }
    // 한 프레임에 100ms 넘게 흘렀다면 탭이 쉬고 있었다는 뜻 — 그만큼은 안 떨어뜨린다
    const delta = lastTs ? Math.min(now - lastTs, 100) : 0
    lastTs = now
    advance(delta)
    if (over || elapsed / fallMs >= 1) return
    raf = requestAnimationFrame(tick)
  }

  /** 남은 시간 비율 (1 = 방금 나왔다, 0 = 바닥) */
  function remaining(): number {
    return Math.max(0, 1 - elapsed / fallMs)
  }

  function miss(): void {
    if (!cur) return
    stopFall()
    perWord.set(cur.en, false)
    // 놓쳤을 때도 벌주지 않는다 — 무엇이었는지 알려주고 소리를 들려준다
    // 조사("은/는", "였어/이었어")는 받침에 따라 달라져 낱말마다 어색해진다 → 기호로 잇는다
    say.textContent = `아쉽다! ${cur.en} → ${cur.emoji} ${cur.ko} 👂`
    say.className = 'en-q-say en-again'
    tts.speak(cur.en, { rate: 0.7 })
    loseLife()
  }

  function loseLife(): void {
    lives--
    livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🤍'.repeat(LIVES - Math.max(0, lives))
    if (lives <= 0) {
      finish()
      return
    }
    faller.classList.add('en-icpt-boom')
    setTimeout(nextWord, 800)
  }

  function answer(picked: string): void {
    if (!cur || over) return
    if (picked === cur.en) {
      stopFall()
      // 위에서 맞힐수록 점수가 높다 — 빨리 읽는 것이 곧 실력
      const remain = remaining()
      const gained = 10 + Math.round(remain * 20)
      score += gained
      solved++
      scoreEl.textContent = `${score}점`
      perWord.set(cur.en, true)
      sfx.good()
      say.textContent = `+${gained}점 · ${cur.en} 👏`
      say.className = 'en-q-say en-good'
      tts.speak(cur.en, { rate: 0.85 })
      faller.classList.add('en-icpt-hit')
      // 설정에서 「변화 없음」을 고르면 처음 속도 그대로 간다 (읽기가 느린 아이용)
      if (prefs.get().interceptRamp) fallMs = Math.max(FALL_MIN, fallMs - FALL_STEP)
      setTimeout(nextWord, 500)
    } else {
      stopFall()
      perWord.set(cur.en, false)
      sfx.again()
      say.textContent = `다시 읽어 보자 — ${cur.en} → ${cur.emoji} ${cur.ko} 👂`
      say.className = 'en-q-say en-again'
      tts.speak(cur.en, { rate: 0.7 })
      loseLife()
    }
  }

  function finish(): void {
    over = true
    stopFall()
    // 게임이 끝난 이유를 아이가 알아야 한다 — 하트를 다 썼다는 것을 안내창으로 알리고 결과로 넘어간다
    notice('☄️', '하트를 다 썼어요!', `${score}점 · 낱말 ${solved}개를 읽었어요`, {
      ms: 1600,
      onClose: () => onDone({ score, solved, perWord }),
    })
  }

  sky.append(faller)
  render(
    top('낱말 요격', quit),
    el('div', { class: 'en-q' }, [
      el('div', { class: 'en-icpt-hud' }, [livesEl, scoreEl]),
      sky,
      el('p', { class: 'en-q-ask', text: '바닥에 닿기 전에 낱말을 읽고 알맞은 그림을 눌러!' }),
      choiceBox,
      say,
    ])
  )
  // 진행 막대는 쓰지 않는다(끝이 정해진 놀이가 아니다) — 자리만 맞춘다
  progressBar(0, 1)

  // **rAF 밖에서** 첫 낱말을 띄운다. sky는 이미 DOM에 붙어 있어 clientHeight를 바로 읽을 수 있다.
  nextWord()

  // 검증용: 프레임이 안 도는 환경(숨은 탭·합성 정지)에서도 낙하와 놓침을 확인할 수 있게 열어 둔다
  if (import.meta.env.DEV) {
    ;(window as unknown as { __intercept?: unknown }).__intercept = {
      /** 시간을 ms만큼 흘린다 (rAF와 같은 경로를 지난다) */
      step: (ms: number) => advance(ms),
      state: () => ({ word: cur?.en, elapsed, fallMs, lives, score, solved, over, top: faller.style.top }),
    }
  }
}
