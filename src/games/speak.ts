/**
 * 말하기 — 그림을 보고 낱말을 소리 내어 말한다.
 *
 * **기본 모드는 녹음이다.** 내 목소리와 원어민 소리를 번갈아 들으며 스스로 비교한다 —
 * 채점이 없어도 연습이 성립하고, 오프라인·모든 브라우저에서 된다.
 * 받아쓰기 채점(Chrome/Edge + 네트워크)이 가능하면 보너스로 붙는다.
 *
 * 채점은 관대하다(speech.ts): 세 번 시도하면 무조건 통과시킨다 —
 * 아이가 맞게 말했는데 인식기가 못 알아들어 막히면 그 자리에서 놀이가 끝난다.
 */
import { gameWordsFor } from '../phonics'
import type { StageId, Word } from '../data/types'
import { shuffle } from '../rand'
import * as sfx from '../sfx'
import * as speech from '../speech'
import * as tts from '../tts'
import { el, progressBar, render, top } from '../ui'

const ROUNDS = 5

export interface SpeakResult {
  said: number
  total: number
  /** 채점을 실제로 한 낱말만 (녹음 모드에서는 비어 있다) */
  scored: Map<string, boolean>
  /** 받아쓰기 채점을 썼는가 — 부모 리포트에서 "미채점"을 밝히는 데 쓴다 */
  usedScoring: boolean
}

export function runSpeak(stage: StageId, onQuit: () => void, onDone: (r: SpeakResult) => void): void {
  // 그 마을의 낱말을 말해 본다 (앞 마을 것만 나오지 않게)
  const words = shuffle(gameWordsFor(stage, { count: ROUNDS * 2 })).slice(0, ROUNDS)
  const scoring = speech.canScore()
  const result: SpeakResult = { said: 0, total: words.length, scored: new Map(), usedScoring: scoring }
  let i = 0

  function step(): void {
    const w = words[i]
    if (!w) return onDone(result)
    round(w)
  }

  function round(w: Word): void {
    let tries = 0
    let myVoiceUrl: string | null = null
    let stopRec: (() => void) | null = null
    let listening: speech.ListenHandle | null = null

    const say = el('p', { class: 'en-q-say' })
    const hint = el('p', {
      class: 'en-say-hint',
      text: scoring ? '버튼을 누르고 그림의 낱말을 말해 봐' : '버튼을 누르고 말한 다음, 내 소리와 원어민 소리를 비교해 봐',
    })
    const mic = el('button', { class: 'en-say-mic', text: '🎤 눌러서 말하기' })

    const listenPair = el('div', { class: 'en-say-pair' })
    const nextBtn = el('button', { class: 'en-big', text: '다음 ▶' })
    nextBtn.style.display = 'none'
    nextBtn.addEventListener('click', () => {
      if (myVoiceUrl) URL.revokeObjectURL(myVoiceUrl)
      i++
      step()
    })

    function showPair(): void {
      listenPair.replaceChildren()
      const mine = el('button', { class: 'en-q-choice', text: '🧒 내 소리' })
      mine.addEventListener('click', () => {
        if (!myVoiceUrl) return
        const a = new Audio(myVoiceUrl)
        void a.play()
      })
      const native = el('button', { class: 'en-q-choice', text: '🔊 원어민' })
      native.addEventListener('click', () => tts.speak(w.en, { rate: 0.8 }))
      if (myVoiceUrl) listenPair.append(mine)
      listenPair.append(native)
    }

    function finishRound(ok: boolean | null): void {
      result.said++
      if (ok !== null) result.scored.set(w.en, ok)
      mic.classList.remove('en-is-recording')
      mic.textContent = '🎤 다시 말해 보기'
      nextBtn.style.display = ''
      showPair()
    }

    async function start(): Promise<void> {
      tries++
      tts.stop()
      say.textContent = ''
      mic.classList.add('en-is-recording')
      mic.textContent = '⏹ 말하고 나서 누르기'

      // 녹음은 가능하면 항상 한다 — 채점이 되든 안 되든 내 소리를 들려주는 게 핵심이다
      const rec = await speech.startRecording((url) => {
        myVoiceUrl = url
        showPair()
      })
      stopRec = rec?.stop ?? null

      if (scoring) {
        listening = speech.listen(w.en, (r) => {
          stopRec?.()
          stopRec = null
          const pass = r.ok || tries >= speech.MAX_TRIES
          if (r.ok) {
            sfx.good()
            say.textContent = '정확해! 🎉'
            say.className = 'en-q-say en-good'
          } else if (pass) {
            // 세 번째부터는 통과시킨다. 틀렸다고 하지 않고 "이렇게 들려" 정도로 남긴다
            say.textContent = r.transcript ? `이렇게 들렸어: ${r.transcript} — 원어민 소리랑 비교해 보자 👂` : '내 소리랑 원어민 소리를 비교해 보자 👂'
            say.className = 'en-q-say en-again'
          } else {
            sfx.again()
            say.textContent = '한 번 더 해 볼까? 🔁'
            say.className = 'en-q-say en-again'
            mic.classList.remove('en-is-recording')
            mic.textContent = '🎤 다시 말하기'
            return // 아직 기회가 남았다 → 라운드를 끝내지 않는다
          }
          finishRound(r.ok)
        })
      } else {
        // 채점이 안 되는 환경: 아이가 스스로 멈춘다
        mic.textContent = '⏹ 다 말했어'
      }
    }

    function stop(): void {
      listening?.stop()
      listening = null
      stopRec?.()
      stopRec = null
      if (!scoring) finishRound(null)
    }

    mic.addEventListener('click', () => {
      if (mic.classList.contains('en-is-recording')) stop()
      else void start()
    })

    render(
      top('말하기', onQuit, `${i + 1} / ${words.length}`),
      progressBar(i, words.length),
      el('div', { class: 'en-q' }, [
        el('p', { class: 'en-q-ask', text: '그림을 보고 큰 소리로 말해 봐' }),
        el('div', { class: 'en-q-show' }, [el('span', { text: w.emoji })]),
        el('p', { class: 'en-q-word', text: w.en }),
        hint,
        mic,
        listenPair,
        say,
        nextBtn,
      ])
    )
    // 먼저 원어민 소리를 들려준다 — 듣지 않고 말하게 하면 한국어 발음이 굳는다
    setTimeout(() => tts.speak(w.en, { rate: 0.8 }), 250)
  }

  step()
}
