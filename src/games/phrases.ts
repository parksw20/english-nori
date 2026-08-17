/**
 * 생활 표현 — 유치원 생활에서 **실제로 쓰는 말**을 통째로 듣고 따라 말한다.
 *
 * 문장 놀이(읽기)와 목적이 다르다. 여기서는 아이가 읽지 못해도 된다:
 * `Can I go to the bathroom?`을 읽으려면 단계 6까지 가야 하는데, 그 말은 **오늘 당장 필요하다.**
 * 그래서 이쪽은 소리와 상황으로만 익힌다 — 글자는 어른이 보라고 함께 보여주지만 읽기를 요구하지 않는다.
 *
 * 채점은 한다 — 다만 **내용어가 몇 개 들렸는지**로 보고 기준을 더 낮춘다(0.5).
 * 통째로 외운 말이라 리듬이 뭉개지기 쉽고, 여기서 막히면 "오늘 쓸 말"을 못 배우고 끝나기 때문이다.
 * 인식이 안 되는 기기에서는 조용히 녹음 비교만 한다.
 * 부모가 같은 상황에서 되받아 주는 것이 이 놀이의 진짜 절반이다(그 안내를 화면에 적어 둔다).
 */
import { PHRASES, SCENES, pickPhrases, type Phrase, type SceneId } from '../sentence'
import * as sfx from '../sfx'
import { speakBox } from '../speakbox'
import * as tts from '../tts'
import { el, notice, progressBar, render, top } from '../ui'

/** 한 장면에서 몇 문장을 하나 — 7세가 지치지 않을 만큼만 */
const PER_ROUND = 5

export interface PhraseResult {
  scene: SceneId
  /** 따라 말한 문장 수 */
  spoke: number
  total: number
}

/** 장면 고르기 화면 */
export function runPhrases(onQuit: () => void, onDone: (r: PhraseResult) => void): void {
  render(
    top('생활 표현 🗣️', onQuit),
    el('p', { class: 'en-q-ask', text: '어떤 때에 쓰는 말을 연습할까?' }),
    el(
      'div',
      {},
      SCENES.map((sc) => {
        const n = PHRASES.filter((p) => p.scene === sc.id).length
        const b = el('button', { class: 'en-map-village' }, [
          el('span', { class: 'en-map-icon', text: sc.emoji }),
          el('span', { class: 'en-map-name' }, [
            sc.name,
            el('span', { class: 'en-map-meta', text: `${sc.detail} · ${n}문장` }),
          ]),
        ])
        b.addEventListener('click', () => runScene(sc.id, onQuit, onDone))
        return b
      })
    )
  )
}

function runScene(scene: SceneId, onQuit: () => void, onDone: (r: PhraseResult) => void): void {
  const list = pickPhrases(scene, PER_ROUND)
  const sc = SCENES.find((s) => s.id === scene)
  let i = 0
  let spoke = 0

  function next(): void {
    i++
    step()
  }

  function step(): void {
    const p = list[i]
    if (!p) {
      sfx.fanfare()
      notice(sc?.emoji ?? '🗣️', `${sc?.name ?? ''} 표현 끝!`, `${spoke}문장을 따라 말했어요`, {
        ms: 1600,
        onClose: () => onDone({ scene, spoke, total: list.length }),
      })
      return
    }
    round(p)
  }

  function round(p: Phrase): void {
    // 생활 표현은 조금 더 관대하게 (통째로 외운 말이라 리듬이 뭉개져도 통한 것으로 본다)
    const box = speakBox({
      text: p.en,
      minRatio: 0.5,
      onDone: () => {
        spoke++
      },
    })

    const hear = el('button', { class: 'en-mk-hear', text: '🔊 다시 듣기' })
    hear.addEventListener('click', () => tts.speak(p.en, { rate: 0.8 }))

    const wrap = el('div', { class: 'en-q' }, [
      el('p', { class: 'en-sen-target', text: p.en }),
      el('p', { class: 'en-sen-ko', text: p.ko }),
      hear,
      el('p', {
        class: 'en-say-hint',
        text: '읽지 않아도 돼요 — 이 말이 필요한 상황에서 부모님이 되받아 주면 더 빨리 굳어요',
      }),
      ...box.nodes,
    ])
    wrap.addEventListener('en-next', () => {
      box.stop()
      next()
    })

    render(
      top(`${sc?.emoji ?? ''} ${sc?.name ?? '생활 표현'}`, onQuit, `${i + 1} / ${list.length}`),
      progressBar(i, list.length),
      wrap
    )
    setTimeout(() => tts.speak(p.en, { rate: 0.8 }), 250)
  }

  step()
}
