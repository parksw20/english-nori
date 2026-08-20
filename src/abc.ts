/**
 * ABC 알파벳 — 26자를 눌러 **낱말을 직접 쳐 보는** 화면.
 *
 * 다른 놀이는 전부 "주어진 것 중에 고르기"다. 여기서는 **아이가 무엇을 쓸지 스스로 정한다** —
 * 머릿속에 있는 낱말을 글자로 꺼내 보는 유일한 자리이고, 그래서 알파벳 판이 따로 있을 값이 있다.
 *
 * 규칙:
 * - 글자 카드를 누르면 그 글자를 읽어 주고 **하단 줄에 순서대로 쌓인다**
 * - 「입력」을 누르면 도감에 있는 낱말인지 본다
 *   - 있으면 그림·영어·한글 카드가 가운데에서 좌→우로 돌고, **도감 단계가 오른다**
 *   - 없으면 "아직 도감에 없는 낱말"이라고만 알린다 — 틀렸다고 하지 않는다
 *     (child가 chair를 쳤다면 그건 잘못이 아니라 아직 안 배운 것이다)
 *
 * 단어장의 「낱말 만들기」와 다른 점: 저기는 **가진 카드**로만 만들 수 있고 카드를 소모한다.
 * 여기는 26자가 늘 다 있고 아무것도 소모하지 않는다 — 쓰기 연습이지 보상 놀이가 아니다.
 */
import { LETTERS } from './data/phonics'
import type { StageId, Word } from './data/types'
import * as progress from './progress'
import { wordsUpTo } from './phonics'
import * as sfx from './sfx'
import * as srs from './srs'
import * as tts from './tts'
import { el, render, top } from './ui'

/**
 * 맞힌 낱말을 가운데에서 **좌→우로 뱅글뱅글 돌려** 보여준다.
 *
 * 도는 동안 아이는 그림·영어·한글을 한 번에 본다 — 맞혔다는 신호이자 짧은 복습이다.
 * 끝나면 저절로 사라진다(아이에게 닫기 버튼을 찾게 하지 않는다). 아무 데나 눌러도 닫힌다.
 */
function spinCard(w: Word, onEnd: () => void): void {
  const card = el('div', { class: 'en-spin-card' }, [
    el('span', { class: 'en-spin-emoji', text: w.emoji }),
    el('span', { class: 'en-spin-en', text: w.en }),
    el('span', { class: 'en-spin-ko', text: w.ko }),
  ])
  const back = el('div', { class: 'en-spin' }, [card])
  document.body.append(back)

  let done = false
  const close = (): void => {
    if (done) return
    done = true
    back.remove()
    onEnd()
  }
  back.addEventListener('click', close)
  card.addEventListener('animationend', close)
  // animationend가 안 오는 기기에서도 화면이 멈추지 않게 시간 안전장치를 둔다
  setTimeout(close, 2600)
}

export function showAbc(onBack: () => void): void {
  const stage: StageId = progress.topUnlockedStage()
  const words = wordsUpTo(stage)

  /**
   * 입력 줄에 쌓인 글자.
   *
   * **글자 하나마다 화면을 다시 그리지 않는다.** 처음에는 다시 그렸는데, 그러면 아이가 빠르게 두 번 누를 때
   * 이미 떨어져 나간 옛 버튼을 누르게 되고 그 버튼은 옛 상태를 붙잡고 있어 **앞 글자가 사라진다**
   * (c·a·t를 눌렀는데 t만 남았다). 입력 줄만 다시 칠하면 그런 일이 없고 스크롤도 튀지 않는다.
   */
  const typed: string[] = []

  const say = el('p', { class: 'en-q-say' })

  // ── 입력 줄: 누른 순서대로 쌓이고, 오른쪽에 지우기·입력 ──────────────
  const slots = el('div', { class: 'en-type-slots' })

  function paintTyped(): void {
    slots.replaceChildren(
      ...(typed.length
        ? typed.map((ch) => el('span', { class: 'en-type-ch', text: ch }))
        : [el('span', { class: 'en-type-empty', text: '글자를 눌러 낱말을 쳐 보세요' })])
    )
    // 길게 치면 끝이 보이도록 오른쪽으로 따라간다
    slots.scrollLeft = slots.scrollWidth
  }

  function push(ch: string): void {
    typed.push(ch)
    say.textContent = ''
    paintTyped()
  }

  const back = el('button', { class: 'en-type-btn', text: '⌫', 'aria-label': '한 글자 지우기' })
  back.addEventListener('click', () => {
    typed.pop()
    say.textContent = ''
    paintTyped()
  })

  const go = el('button', { class: 'en-type-btn en-type-go', text: '입력' })
  go.addEventListener('click', () => {
    const word = typed.join('')
    if (word.length === 0) return
    const hit = words.find((w) => w.en === word)
    if (!hit) {
      // **틀렸다고 하지 않는다.** 도감에 아직 없는 낱말일 뿐이다
      sfx.again()
      say.textContent = `${word} — 아직 도감에 없는 낱말이에요 🔎`
      say.className = 'en-q-say en-again'
      tts.say(word)
      return
    }
    // 스스로 쳐서 맞혔다 → 도감 단계를 올린다('척척'으로 올려 복습을 더 멀리 보낸다)
    srs.review(hit.en, 'easy')
    sfx.fanfare()
    tts.say(hit.en)
    spinCard(hit, () => {
      // 다음 낱말을 바로 칠 수 있게 입력 줄만 비운다 (화면은 그대로 둔다)
      typed.length = 0
      say.textContent = `${hit.en} — ${hit.ko} 도감 단계가 올랐어요! ⭐`
      say.className = 'en-q-say en-good'
      paintTyped()
    })
  })

  // ── 알파벳 판: 대문자·소문자 짝 ─────────────────────────────────
  const boardCards = LETTERS.map((l) => {
    const b = el('button', { class: 'en-abc-mini', 'data-letter': l.ch, 'aria-label': `${l.ch} 넣기` }, [
      el('span', { class: 'en-abc-mini-pair', text: `${l.ch.toUpperCase()} ${l.ch}` }),
      el('span', { class: 'en-abc-mini-name', text: l.name }),
    ])
    b.addEventListener('click', () => {
      // 누르면 글자를 읽어 주고 입력 줄에 쌓인다 — 누르는 것이 곧 듣는 것이어야 한다
      tts.say(l.ch)
      push(l.ch)
    })
    return b
  })

  const learned = srs.summary(words.map((w) => w.en)).learned

  render(
    top('ABC 알파벳 🔤', onBack, `도감 낱말 ${words.length}개`),
    el('div', {}, [
      el('p', {
        class: 'en-dex-hint',
        text: '글자를 누르면 아래에 쌓여요. 도감에 있는 낱말을 치고 「입력」을 눌러 보세요',
      }),
      el('div', { class: 'en-abc-grid' }, boardCards),
      el('div', { class: 'en-type-row' }, [slots, back, go]),
      say,
      el('p', { class: 'en-dex-hint', text: `지금 도감에 ${words.length}개 · 익힌 낱말 ${learned}개` }),
    ])
  )
  paintTyped()
}
