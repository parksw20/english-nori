/**
 * 문장 따라 말하기 상자 — 문장 놀이와 생활 표현이 함께 쓴다.
 *
 * 두 곳에 같은 코드를 두 벌 두었더니 한쪽만 고치는 일이 생겼다(채점을 넣을 때 실제로 그랬다) → 한 곳으로 모았다.
 *
 * 채점은 **내용어가 몇 개 들렸는지**로 한다(speech.judgeSentence). 문장을 통째로 대조하면
 * 아이는 거의 못 넘고, 안 하면 아이가 "잘 말했는지" 알 방법이 없다. 들린 낱말을 그대로 보여주는 것이
 * "다시 해"보다 훨씬 쓸모 있다 — 어느 소리가 빠졌는지가 다음 시도의 목표가 된다.
 *
 * 채점을 쓸 수 없는 기기(오프라인·Safari)에서는 조용히 녹음 비교만 한다.
 */
import * as prefs from './prefs'
import * as sfx from './sfx'
import * as speech from './speech'
import * as tts from './tts'
import { el } from './ui'

export interface SpeakBoxOptions {
  /** 따라 말할 문장 */
  text: string
  /** 통과 기준 — 생활 표현은 조금 더 관대하게 둔다 */
  minRatio?: number
  /** 한 문장이 끝났을 때 (ok는 채점을 못 한 경우 null) */
  onDone: (r: { ok: boolean | null; tries: number }) => void
}

export interface SpeakBox {
  /** 화면에 넣을 조각들 */
  nodes: Node[]
  /** 화면을 떠날 때 정리 */
  stop: () => void
}

export function speakBox(opts: SpeakBoxOptions): SpeakBox {
  // 설정에서 끄면 채점하지 않는다 — 마이크가 아이 목소리를 잘 못 잡는 기기가 있다
  const scoring = speech.canScore() && prefs.get().sentenceScoring
  let tries = 0
  let myUrl: string | null = null
  let stopRec: (() => void) | null = null
  let listening: speech.ListenHandle | null = null
  let finished = false

  const say = el('p', { class: 'en-q-say' })
  const heard = el('p', { class: 'en-say-heard' })
  const pair = el('div', { class: 'en-say-pair' })
  const mic = el('button', { class: 'en-say-mic', text: '🎤 눌러서 따라 말하기' })
  const nextBtn = el('button', { class: 'en-big', text: '다음 ▶' })
  nextBtn.style.display = 'none'

  const hint = el('p', {
    class: 'en-say-hint',
    text: scoring
      ? '버튼을 누르고 문장을 말해 봐 — 들린 낱말을 보여줄게'
      : speech.canScore()
        ? '채점은 꺼 두었어요 — 내 소리와 원어민 소리를 비교해 보세요 (설정에서 켤 수 있어요)'
        : '이 기기에서는 채점을 못 해요 — 내 소리와 원어민 소리를 비교해 보세요',
  })

  function showPair(): void {
    pair.replaceChildren()
    if (myUrl) {
      const mine = el('button', { class: 'en-q-choice', text: '🧒 내 소리' })
      mine.addEventListener('click', () => void new Audio(myUrl as string).play())
      pair.append(mine)
    }
    const native = el('button', { class: 'en-q-choice', text: '🔊 원어민' })
    native.addEventListener('click', () => tts.speak(opts.text, { rate: 0.8 }))
    pair.append(native)
  }

  /** 들린 낱말을 낱말별로 보여준다 — 무엇이 빠졌는지가 다음 목표가 된다 */
  function paintHeard(score: speech.SentenceScore): void {
    heard.replaceChildren(
      el('span', { class: 'en-say-heard-label', text: '들린 낱말: ' }),
      ...speech.contentWords(opts.text).map((w) =>
        el('span', { class: `en-say-word${score.hit.includes(w) ? ' en-is-hit' : ' en-is-miss'}`, text: w })
      )
    )
  }

  function finish(ok: boolean | null): void {
    if (finished) return
    finished = true
    mic.classList.remove('en-is-recording')
    mic.textContent = '🎤 다시 말해 보기'
    nextBtn.style.display = ''
    showPair()
    opts.onDone({ ok, tries })
  }

  async function start(): Promise<void> {
    tries++
    tts.stop()
    say.textContent = ''
    mic.classList.add('en-is-recording')
    mic.textContent = '⏹ 말하고 나서 누르기'

    // 녹음은 채점이 되든 안 되든 늘 한다 — 내 소리를 들려주는 것이 이 놀이의 절반이다
    const rec = await speech.startRecording((url) => {
      myUrl = url
      showPair()
    })
    stopRec = rec?.stop ?? null

    if (!scoring) {
      mic.textContent = '⏹ 다 말했어'
      return
    }

    listening = speech.listen(
      opts.text,
      (r) => {
        stopRec?.()
        stopRec = null
        const score = speech.judgeSentence(r.transcript, opts.text, opts.minRatio)
        if (r.transcript) paintHeard(score)

        if (score.ok) {
          sfx.good()
          say.textContent = '잘 말했어! 🎉'
          say.className = 'en-q-say en-good'
          finish(true)
          return
        }
        if (tries >= speech.MAX_TRIES) {
          // 세 번이면 넘어간다 — 막히면 놀이가 끝난다
          say.textContent = score.missed.length
            ? `${score.missed.join(', ')} 소리를 한 번 더 들어 보자 👂`
            : '원어민 소리와 비교해 보자 👂'
          say.className = 'en-q-say en-again'
          finish(false)
          return
        }
        sfx.again()
        say.textContent = score.hit.length
          ? `${score.hit.join(', ')}는 들렸어! 한 번 더 해 볼까? 🔁`
          : '한 번 더 해 볼까? 🔁'
        say.className = 'en-q-say en-again'
        mic.classList.remove('en-is-recording')
        mic.textContent = '🎤 다시 말하기'
      },
      (t, target) => speech.judgeSentence(t, target, opts.minRatio).ok
    )
  }

  function stopSpeaking(): void {
    listening?.stop()
    listening = null
    stopRec?.()
    stopRec = null
    // 채점을 못 하는 기기에서는 아이가 스스로 멈추고 끝낸다
    if (!scoring) {
      say.textContent = '내 소리와 원어민 소리를 번갈아 들어 봐 👂'
      say.className = 'en-q-say en-good'
      finish(null)
    }
  }

  mic.addEventListener('click', () => (mic.classList.contains('en-is-recording') ? stopSpeaking() : void start()))
  nextBtn.addEventListener('click', () => {
    if (myUrl) URL.revokeObjectURL(myUrl)
    nextBtn.dispatchEvent(new CustomEvent('en-next', { bubbles: true }))
  })

  return {
    nodes: [hint, mic, pair, heard, say, nextBtn],
    stop: () => {
      listening?.stop()
      stopRec?.()
      if (myUrl) URL.revokeObjectURL(myUrl)
    },
  }
}
