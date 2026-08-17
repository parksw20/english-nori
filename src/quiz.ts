/**
 * 문제 한 판을 굴리는 공통 화면 — 오늘의 놀이, 시험, 소리 사냥이 모두 이걸 쓴다.
 *
 * 7세용 규칙이 이 파일에 모여 있다:
 * - 문제를 띄우면 **소리를 먼저 자동으로 들려준다**(아이가 스피커를 찾아 누를 필요가 없다)
 * - 오답에 벌점·빨간 X가 없다. 정답을 눌러 볼 수 있게 남겨 두고, 정답 소리를 다시 들려준다
 * - 다음 문제로 자동으로 넘어간다(아이가 "다음" 버튼을 찾지 않아도 되게)
 */
import type { Question, QuestionType } from './exam'
import { WORDS } from './data/words'
import * as sfx from './sfx'
import * as tts from './tts'
import { AGAIN_WORDS, GOOD_WORDS, el, pickOne, progressBar, render, top } from './ui'

const EMOJI_OF = new Map(WORDS.map((w) => [w.en, w.emoji]))

/** 보기를 그림으로 보여줄 문제 유형 — 아직 글자를 못 읽는 단계용 */
function choicesAreEmoji(q: Question): boolean {
  return q.type === 'letter-word'
}

/**
 * 틀린 문제 한 건.
 *
 * 시험은 푸는 중에 정답을 알려주지 않으므로(알려주면 다음 문제의 답을 유추한다)
 * **끝난 뒤에 무엇을 틀렸는지 돌려줘야** 아이가 다시 들어 볼 수 있고 부모도 무엇이 약한지 안다.
 */
export interface WrongItem {
  type: QuestionType
  /** 정답 */
  answer: string
  /** 아이가 고른 것 */
  chosen: string
  /** 문제를 만든 낱말 (있으면 그림·소리를 붙일 수 있다) */
  word?: string
}

export interface QuizResult {
  right: number
  total: number
  /** 틀린 문제들 (푼 순서) */
  wrong: WrongItem[]
  /** 낱말별 정답 여부 (SRS에 넘긴다). 같은 낱말이 여러 번 나오면 마지막 결과가 남는다 */
  perWord: Map<string, boolean>
  seconds: number
}

export interface QuizOptions {
  title: string
  questions: Question[]
  onQuit: () => void
  onDone: (r: QuizResult) => void
  /** 시험처럼 정답을 알려주지 않고 넘어갈 때 true */
  silentMarking?: boolean
}

const ASK: Record<Question['type'], string> = {
  'letter-sound': '무슨 글자로 시작할까?',
  'letter-word': '이 글자로 시작하는 그림은?',
  'word-listen': '무슨 낱말일까?',
  'word-picture': '이 그림은 어떤 낱말?',
  'picture-initial': '첫 글자는 무엇일까?',
  'missing-vowel': '빈칸에 들어갈 글자는?',
}

/** 문제 판 시작 */
export function runQuiz(opts: QuizOptions): void {
  const started = Date.now()
  const result: QuizResult = { right: 0, total: opts.questions.length, wrong: [], perWord: new Map(), seconds: 0 }
  let i = 0

  function finish(): void {
    result.seconds = Math.round((Date.now() - started) / 1000)
    tts.stop()
    opts.onDone(result)
  }

  function step(): void {
    const found = opts.questions[i]
    if (!found) return finish()
    // 아래의 answer()·next()가 함수 선언이라 TS가 좁힌 타입을 물려받지 못한다 → 타입을 못 박은 지역 상수로 넘긴다
    const q: Question = found

    const say = el('p', { class: 'en-q-say' })
    const showBox = el('div', { class: 'en-q-show' })

    // 무엇을 보여줄지 — 그림·글자·빈칸 낱말, 아니면 큰 스피커
    const speakNow = (): void => {
      if (q.say) tts.speak(q.say, { rate: q.type === 'word-listen' ? 0.7 : 0.85 })
    }
    if (q.show) {
      const isWord = q.type === 'missing-vowel'
      showBox.append(el('span', { class: isWord ? 'en-q-word' : '', text: q.show }))
      if (q.say) {
        const sp = el('button', { class: 'en-q-speaker', 'aria-label': '다시 듣기', text: '🔊' })
        sp.style.fontSize = '48px'
        sp.addEventListener('click', speakNow)
        showBox.append(sp)
      }
    } else {
      const sp = el('button', { class: 'en-q-speaker', 'aria-label': '듣기', text: '🔊' })
      sp.addEventListener('click', speakNow)
      showBox.append(sp)
      // 영어 음성이 없는 기기에서는 소리만 내는 문제를 아이가 풀 방법이 없다
      // (그림도 글자도 없으니 찍기밖에 안 된다) → 들려줄 말을 글자로 보여준다.
      // 근본 해결은 음성이 있는 기기에서 놀는 것이고, 그 안내는 지도 화면에 띄운다.
      if (!tts.hasVoice() && q.say) {
        showBox.append(el('span', { class: 'en-q-word', text: q.say }))
      }
    }

    const grid = el('div', { class: 'en-q-choices' })
    const buttons: HTMLButtonElement[] = []
    let answered = false

    for (const c of q.choices) {
      const asEmoji = choicesAreEmoji(q)
      const label = asEmoji ? (EMOJI_OF.get(c) ?? c) : c
      const b = el('button', { class: `en-q-choice${asEmoji ? ' en-q-choice-emoji' : ''}`, text: label, 'data-choice': c })
      b.addEventListener('click', () => answer(c, b))
      buttons.push(b)
      grid.append(b)
    }

    function answer(chosen: string, btn: HTMLButtonElement): void {
      if (answered) return
      answered = true
      const ok = chosen === q.answer
      if (ok) result.right++
      else result.wrong.push({ type: q.type, answer: q.answer, chosen, word: q.word })
      if (q.word) result.perWord.set(q.word, ok)

      for (const b of buttons) b.disabled = true

      if (opts.silentMarking) {
        // 시험 중에는 정답을 알려주지 않는다 — 다만 누른 것은 표시해 준다
        btn.classList.add('en-is-right')
        setTimeout(next, 350)
        return
      }

      if (ok) {
        btn.classList.add('en-is-right')
        say.textContent = pickOne(GOOD_WORDS)
        say.className = 'en-q-say en-good'
        sfx.good()
        // 맞았을 때도 낱말 소리를 한 번 더 들려준다 (소리-글자 연결을 굳힌다)
        if (q.word) tts.speak(q.word, { rate: 0.85, onEnd: next })
        else setTimeout(next, 700)
      } else {
        btn.classList.add('en-is-again')
        say.textContent = pickOne(AGAIN_WORDS)
        say.className = 'en-q-say en-again'
        sfx.again()
        // 정답을 알려 주고 그 소리를 들려준다. 벌점은 없다.
        const right = buttons.find((b) => b.dataset.choice === q.answer)
        right?.classList.add('en-is-right')
        const speakTarget = q.word ?? q.say
        if (speakTarget) tts.speak(speakTarget, { rate: 0.65, onEnd: () => setTimeout(next, 500) })
        else setTimeout(next, 1200)
      }
    }

    function next(): void {
      i++
      step()
    }

    render(
      top(opts.title, opts.onQuit, `${i + 1} / ${opts.questions.length}`),
      progressBar(i, opts.questions.length),
      el('div', { class: 'en-q' }, [el('p', { class: 'en-q-ask', text: ASK[q.type] }), showBox, grid, say])
    )

    // 검증용: 지금 문제와 정답을 개발 모드에서만 밖에 내놓는다.
    // 화면만 보고는 소리 문제의 정답을 알 수 없어서, 브라우저 검증이 이 훅으로 문제를 풀어 본다.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __quiz?: unknown }).__quiz = {
        index: i,
        total: opts.questions.length,
        type: q.type,
        answer: q.answer,
        word: q.word,
        click: (choice: string) => {
          const b = buttons.find((x) => x.dataset.choice === choice)
          b?.click()
        },
        solve: () => {
          const b = buttons.find((x) => x.dataset.choice === q.answer)
          b?.click()
        },
      }
    }

    // 문제가 뜨면 바로 들려준다 — 아이가 스피커를 찾아 누르게 하지 않는다
    if (q.say) setTimeout(speakNow, 250)
  }

  step()
}
