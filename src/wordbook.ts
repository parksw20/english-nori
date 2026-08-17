/**
 * 단어장 — 모은 글자 카드로 낱말을 만든다. 한자놀이의 단어장을 옮긴 것.
 *
 * 이 화면이 하는 일은 **소리로 아는 낱말을 글자로 조립해 보는 것**이다.
 * 그래서 카드를 앞에서부터 순서대로 끼우게 한다(c → a → t). 순서 없이 넣게 하면
 * 글자 모으기 게임이 되고 스펠링 연습이 안 된다.
 */
import * as cards from './cards'
import type { StageId, Word } from './data/types'
import * as progress from './progress'
import * as sfx from './sfx'
import * as tts from './tts'
import { el, letterCard, notice, render, top } from './ui'

/**
 * 낱말 만들기 화면 — **아이가 카드를 직접 골라 칸에 넣는다.** (한자놀이의 「낱말 만들기」와 같은 방식)
 *
 * 처음에는 「만들기」 버튼이 앞에서부터 알아서 채우게 했는데, 그러면 아이가 하는 일이
 * **버튼을 세 번 누르는 것**뿐이라 스펠링 연습이 되지 않는다. 어느 칸에 어느 글자가 들어가는지를
 * 아이가 골라야 c-a-t의 순서가 몸에 남는다.
 *
 * 틀린 카드를 골라도 벌은 없다 — 낱말을 다시 들려주고 그대로 둔다.
 */
/**
 * 카드 한 장의 소리 — **글자 이름**을 읽는다(e → "이", b → "비").
 *
 * TTS에 글자 하나를 주면 소리(음소)가 아니라 글자 이름이 나온다. 다른 곳에서는 그게 문제였지만
 * 여기서는 그것이 맞다 — 스펠링은 "씨-에이-티"처럼 **이름으로 부르며** 조립하는 것이기 때문이다.
 */
function speakLetter(letter: string): void {
  tts.speak(letter, { rate: 0.8 })
}

function showMakeWord(w: Word, onBack: () => void, onMade: () => void): void {
  const letters = w.en.split('')
  const filled: (string | null)[] = letters.map(() => null)

  const slotRow = el('div', { class: 'en-mk-slots' })
  const hint = el('p', { class: 'en-q-ask' })
  const say = el('p', { class: 'en-q-say' })
  const myCards = el('div', { class: 'en-wb-cards en-mk-cards' })

  /** 지금 채워야 하는 칸 (없으면 -1 = 다 찼다) */
  const cursor = (): number => filled.indexOf(null)

  /**
   * 소리 예약 취소용 표.
   *
   * 틀린 카드를 누르면 "글자 → 낱말" 순으로 이어 읽는데, 아이가 그 사이에 다음 카드를 누르면
   * **앞서 예약된 낱말 소리가 새 글자 뒤에 늦게 따라붙는다**(브라우저 검증에서 c를 눌렀는데
   * "c" 다음에 "cat"이 나왔다). 누를 때마다 표를 올려, 자기 차례가 지난 예약은 스스로 그만두게 한다.
   */
  let voiceTurn = 0

  function paintSlots(): void {
    const at = cursor()
    slotRow.replaceChildren(
      ...letters.map((ch, i) => {
        const done = filled[i] !== null
        const box = el('div', {
          class: `en-mk-slot${done ? ' en-is-filled' : ''}${i === at ? ' en-is-now' : ''}`,
        })
        if (done) box.append(el('span', { class: 'en-card-face', text: ch }))
        return box
      })
    )
    const i = at
    hint.textContent =
      i === -1
        ? '다 채웠어요!'
        : `${i + 1}번째 칸에 넣을 카드를 고르세요 — 「${letters[i]}」`
  }

  function paintCards(): void {
    // 이미 넣은 카드는 그만큼 빼고 보여준다 (아직 소모는 하지 않는다)
    const used = new Map<string, number>()
    for (const f of filled) if (f) used.set(f, (used.get(f) ?? 0) + 1)

    myCards.replaceChildren(
      ...cards.held().flatMap(({ letter, n }) => {
        const left = n - (used.get(letter) ?? 0)
        if (left <= 0) return []
        const b = letterCard(letter, left, { onClick: () => pick(letter) })
        b.dataset.letter = letter
        return [b]
      })
    )
  }

  function pick(letter: string): void {
    const i = cursor()
    if (i === -1) return
    if (letters[i] !== letter) {
      // 벌은 없다. **누른 글자를 먼저 읽어 주고**(자기가 무엇을 눌렀는지 알아야 한다)
      // 이어서 낱말을 다시 들려준다
      sfx.again()
      say.textContent = `${letter} 카드가 아니야 — ${w.en}을 다시 들어 볼까? 👂`
      say.className = 'en-q-say en-again'
      const turn = ++voiceTurn
      tts.speak(letter, {
        rate: 0.8,
        onEnd: () => {
          if (turn === voiceTurn) tts.say(w.en)
        },
      })
      return
    }
    filled[i] = letter
    sfx.tap()
    say.textContent = ''
    paintSlots()
    paintCards()

    if (cursor() !== -1) {
      // 아직 남았다 — 넣은 글자 이름만 읽어 준다
      voiceTurn++
      speakLetter(letter)
      return
    }

    // 다 채웠다 → 카드를 실제로 소모하고 단어장에 담는다.
    // 마지막 글자 이름을 읽고 **이어서** 낱말을 통째로 들려준다(겹치면 둘 다 안 들린다).
    if (cards.completeWord(w.en)) {
      sfx.fanfare()
      const turn = ++voiceTurn
      tts.speak(letter, {
        rate: 0.8,
        onEnd: () => {
          if (turn === voiceTurn) tts.say(w.en)
        },
      })
      notice(w.emoji, `${w.en} 완성!`, `${w.ko} — 단어장에 담았어요`, { ms: 2400, onClose: onMade })
    }
  }

  const hear = el('button', { class: 'en-mk-hear', text: `🔊 ${w.en} 들어보기` })
  hear.addEventListener('click', () => tts.say(w.en))

  render(
    top('낱말 만들기', onBack),
    el('div', { class: 'en-q' }, [
      el('p', { class: 'en-mk-target', text: `${w.emoji} ${w.en} — ${w.ko}` }),
      slotRow,
      hint,
      hear,
      el('h2', { class: 'en-wb-head', text: '내 카드' }),
      myCards,
      say,
    ])
  )
  paintSlots()
  paintCards()
  setTimeout(() => tts.say(w.en), 250)
}

/** 단어장 목록에 놓이는 낱말 한 줄 — 누르면 만들기 화면으로 간다 */
function wordRow(w: Word, onOpen: () => void): HTMLElement {
  const slots = el(
    'div',
    { class: 'en-wb-slots' },
    w.en.split('').map(() => el('div', { class: 'en-wb-slot' }))
  )

  // 그림을 누르면 낱말을 읽어 준다 — 아직 글씨를 못 읽는 아이는 소리를 듣고 고른다
  const pic = el('button', { class: 'en-wb-emoji en-wb-hear', text: w.emoji, 'aria-label': `${w.en} 듣기` })
  pic.addEventListener('click', (e) => {
    e.stopPropagation()
    tts.say(w.en)
  })

  const btn = el('button', { class: 'en-wb-make', text: '만들기 ✏️' })
  btn.addEventListener('click', onOpen)

  return el('div', { class: 'en-wb-row' }, [
    pic,
    el('div', { class: 'en-wb-body' }, [el('span', { class: 'en-wb-ko', text: w.ko }), slots]),
    btn,
  ])
}

export function showWordbook(onBack: () => void): void {
  const stage: StageId = progress.topUnlockedStage()
  const redraw = (): void => showWordbook(onBack)

  const held = cards.held()
  const made = cards.completedWords()
  const ready = cards.completableWords(stage)
  const nearly = cards.nearlyWords(stage, 2)

  const kids: Node[] = [
    el('p', {
      class: 'en-q-ask',
      text: `카드 ${cards.total()}장 · 만든 낱말 ${made.length}개 — 카드를 모아 낱말을 만들어요`,
    }),
  ]

  // ── 가진 카드 ──────────────────────────────────────────
  kids.push(el('h2', { class: 'en-wb-head', text: '가진 글자 카드' }))
  kids.push(
    held.length
      ? el(
          'div',
          { class: 'en-wb-cards' },
          // 가진 카드도 누르면 글자 이름을 읽어 준다 — 아직 글자를 모르는 아이가 카드를 익히는 길
          held.map(({ letter, n }) => {
            const c = letterCard(letter, n, { onClick: () => speakLetter(letter) })
            c.dataset.letter = letter
            return c
          })
        )
      : el('p', { class: 'en-wb-empty', text: '아직 카드가 없어요 — 놀이를 하면 카드를 받아요!' })
  )

  // ── 지금 만들 수 있는 낱말 ─────────────────────────────
  if (ready.length) {
    kids.push(el('h2', { class: 'en-wb-head', text: `지금 만들 수 있어요 (${ready.length}개)` }))
    for (const w of ready) {
      kids.push(wordRow(w, () => showMakeWord(w, redraw, redraw)))
    }
  }

  // ── 조금만 더 모으면 되는 낱말 ─────────────────────────
  if (nearly.length) {
    kids.push(el('h2', { class: 'en-wb-head', text: '조금만 더 모으면!' }))
    kids.push(
      el(
        'div',
        { class: 'en-wb-nearly' },
        nearly.slice(0, 8).map(({ word, missing }) =>
          el('div', { class: 'en-wb-near' }, [
            el('span', { class: 'en-wb-emoji', text: word.emoji }),
            el('span', { text: word.en }),
            el('span', { class: 'en-wb-missing', text: `${missing.join(' ')} 필요` }),
          ])
        )
      )
    )
  }

  // ── 만든 낱말 ──────────────────────────────────────────
  kids.push(el('h2', { class: 'en-wb-head', text: `만든 낱말 (${made.length}개)` }))
  kids.push(
    made.length
      ? el(
          'div',
          { class: 'en-wb-made' },
          made.map((en) => {
            const b = el('button', { class: 'en-wb-madeword', text: en })
            b.addEventListener('click', () => tts.say(en))
            return b
          })
        )
      : el('p', { class: 'en-wb-empty', text: '아직 없어요. 카드를 모아 첫 낱말을 만들어 봐요!' })
  )

  // ── 카드 교환 ──────────────────────────────────────────
  if (cards.total() >= cards.EXCHANGE_COST) {
    kids.push(el('h2', { class: 'en-wb-head', text: `카드 바꾸기 (${cards.EXCHANGE_COST}장 → 원하는 글자 1장)` }))
    const want = el('div', { class: 'en-wb-cards' })
    // 지금 모자란 글자를 먼저 보여준다 — 아이가 무엇으로 바꿔야 할지 스스로 알기 어렵다
    const suggest = [...new Set(nearly.flatMap((x) => x.missing))].slice(0, 12)
    const options = suggest.length ? suggest : 'abcdefghijklmnopqrstuvwxyz'.split('').slice(0, 12)
    for (const letter of options) {
      // 카드 그림 그대로 누를 수 있게 — 고르는 것도 카드다
      const b = letterCard(letter, 1, {
        onClick: () => {
          // 무엇을 고르는지 소리로 확인시켜 준다
          speakLetter(letter)
          // 가진 카드 중 **낱말에 안 쓰이는 것부터** 5장을 낸다
          const needed = new Set(nearly.flatMap((x) => x.missing))
          const pool: string[] = []
          for (const { letter: l, n } of cards.held()) {
            for (let i = 0; i < n; i++) pool.push(l)
          }
          pool.sort((a, b2) => Number(needed.has(a)) - Number(needed.has(b2)))
          const give = pool.slice(0, cards.EXCHANGE_COST)
          if (cards.exchange(give, letter)) {
            sfx.good()
            notice(letterCard(letter), `${letter} 카드를 받았어요!`, `${give.join(' ')} 5장을 냈어요`, {
              ms: 1500,
              onClose: redraw,
            })
          }
        },
      })
      want.append(b)
    }
    kids.push(want)
  }

  render(top('단어장 📒', onBack, `카드 ${cards.total()}장`), el('div', {}, kids))
}
