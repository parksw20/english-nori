/**
 * 화면 만들기 도구 — 프레임워크 없이 DOM을 직접 만든다.
 *
 * 7세용 규칙을 여기 모아 둔다: 버튼은 크게, 글씨는 크게, 오답에 벌을 주지 않는다.
 * 규칙을 각 화면에 흩어 놓으면 어느 화면은 빨간 X를 띄우게 된다.
 */

import { LETTERS } from './data/phonics'
import * as prefs from './prefs'

/** 요소 하나 만들기. children에 문자열을 주면 텍스트로 들어간다 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    if (k === 'class') node.className = String(v)
    else if (k === 'text') node.textContent = String(v)
    else if (v === true) node.setAttribute(k, '')
    else node.setAttribute(k, String(v))
  }
  for (const c of children) node.append(c)
  return node
}

/** 화면을 갈아 끼운다 */
export function render(...nodes: (Node | string)[]): void {
  const app = document.getElementById('app')
  if (!app) throw new Error('#app이 없다')
  app.replaceChildren(...nodes)
  window.scrollTo(0, 0)
}

/** 머리말 — 뒤로 가기 + 제목 + 오른쪽 보조 정보 */
export function top(title: string, onBack?: () => void, sub?: string, action?: Node): HTMLElement {
  const kids: (Node | string)[] = []
  if (onBack) {
    const b = el('button', { class: 'en-back', 'aria-label': '뒤로', text: '←' })
    b.addEventListener('click', onBack)
    kids.push(b)
  }
  kids.push(el('h1', { text: title }))
  if (sub) kids.push(el('span', { class: 'en-top-sub', text: sub }))
  // 오른쪽 끝 자리 — 짝이 되는 화면으로 바로 건너가는 버튼 같은 것
  if (action) kids.push(action)
  return el('div', { class: 'en-top' }, kids)
}

/**
 * 화면 오른쪽 위 끝의 작은 건너가기 버튼.
 *
 * ABC 알파벳과 낱말 도감은 아이가 번갈아 보는 짝이다 — 글자를 치다가 "그 낱말이 뭐였지"를 확인하고
 * 다시 치러 온다. 매번 지도까지 나갔다 들어오면 그 흐름이 끊긴다.
 */
export function topLink(label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', { class: 'en-top-link', text: label })
  b.addEventListener('click', onClick)
  return b
}

/**
 * 옆으로 미는 상자를 **마우스로도 끌 수 있게** 한다.
 *
 * 터치는 브라우저가 알아서 밀어 주지만 마우스는 스크롤 막대를 잡아야만 움직인다 —
 * 어른도 잘 못 찾는 얇은 막대를 아이에게 찾으라고 할 수 없다.
 *
 * 끌고 나서 손을 떼는 순간 **그 자리의 버튼이 눌리면 안 된다**(마을을 지나치려다 들어가 버린다).
 * 그래서 5px 넘게 움직였으면 이어지는 click을 잡아서 막는다(캡처 단계에서 먼저 가로챈다).
 */
export function dragScroll(box: HTMLElement): void {
  let dragging = false
  let startX = 0
  let startLeft = 0
  let moved = 0

  const end = (): void => {
    dragging = false
    box.classList.remove('en-is-grabbing')
  }

  box.addEventListener('pointerdown', (e) => {
    // 터치·펜은 브라우저의 관성 스크롤이 훨씬 낫다 → 마우스 왼쪽 버튼만 가로챈다
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    dragging = true
    moved = 0
    startX = e.clientX
    startLeft = box.scrollLeft
    box.classList.add('en-is-grabbing')
  })

  box.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const dx = e.clientX - startX
    moved = Math.max(moved, Math.abs(dx))
    box.scrollLeft = startLeft - dx
  })

  box.addEventListener('pointerup', end)
  // 상자 밖에서 손을 떼면 pointerup이 안 온다 → 나가는 순간 끝낸다
  box.addEventListener('pointerleave', end)
  box.addEventListener('pointercancel', end)

  box.addEventListener(
    'click',
    (e) => {
      if (moved <= 5) return
      e.stopPropagation()
      e.preventDefault()
      moved = 0
    },
    true
  )
}

/**
 * 글자판 배열 고르기 — **ABC 알파벳과 가로세로가 같은 것을 쓴다.**
 *
 * 두 화면에서 글자 자리가 다르면 아이가 매번 다시 찾는다. 고른 값도 하나로 저장해서
 * 한 곳에서 바꾸면 다른 곳도 따라간다.
 */
export function layoutPicker(onChange: () => void): HTMLElement {
  const row = el('div', { class: 'en-minirow en-layout-pick' })
  const items: { id: prefs.AbcLayout; label: string; sub: string }[] = [
    { id: 'abc', label: '🔤 순차', sub: 'A부터 Z까지 차례대로' },
    { id: 'keyboard', label: '⌨️ 키보드', sub: '어른 자판과 같은 자리' },
  ]
  const paint = (): void => {
    for (const b of row.children) b.classList.toggle('en-is-sel', (b as HTMLElement).dataset.layout === prefs.get().abcLayout)
  }
  row.append(
    ...items.map((it) => {
      const b = el('button', { class: 'en-mini', title: it.sub, text: it.label, 'data-layout': it.id })
      b.addEventListener('click', () => {
        prefs.setAbcLayout(it.id)
        paint()
        // 화면을 통째로 다시 그리지 않는다 — 치던 글자가 날아간다
        onChange()
      })
      return b
    })
  )
  paint()
  return row
}

/**
 * 알파벳 글자판 — **ABC 알파벳 화면과 가로세로 퀴즈가 같은 판을 쓴다.**
 *
 * 두 화면에서 글자판이 다르게 생기면 아이는 그것을 다른 물건으로 여긴다(실제로 그렇게 보였다).
 * 카드 생김새·배열·모음 표시가 한 군데서 나오게 여기 둔다.
 *
 * @param onPick 글자를 눌렀을 때. 소리를 낼지는 부르는 쪽이 정한다
 */
export function letterBoard(onPick: (ch: string) => void): { board: HTMLElement; repaint: () => void } {
  const board = el('div', { class: 'en-abc-grid' })

  const card = (ch: string): HTMLElement => {
    const l = LETTERS.find((x) => x.ch === ch)
    const b = el(
      'button',
      {
        class: `en-abc-mini${VOWELS.includes(ch) ? ' en-is-vowel' : ''}`,
        'data-letter': ch,
        'aria-label': `${ch}${VOWELS.includes(ch) ? ' (모음)' : ''}`,
      },
      [
        el('span', { class: 'en-abc-mini-pair', text: `${ch.toUpperCase()} ${ch}` }),
        el('span', { class: 'en-abc-mini-name', text: l?.name ?? '' }),
      ]
    )
    b.addEventListener('click', () => onPick(ch))
    return b
  }

  const repaint = (): void => {
    const keyboard = prefs.get().abcLayout === 'keyboard'
    board.className = `en-abc-grid${keyboard ? ' en-is-keyboard' : ''}`
    board.replaceChildren(
      ...(keyboard
        ? letterRows().map((row) => el('div', { class: 'en-abc-row' }, [...row].map(card)))
        : LETTERS.map((l) => card(l.ch)))
    )
  }
  repaint()
  return { board, repaint }
}

/** 모음 — 낱말마다 반드시 들어가는 글자라 눈에 다르게 보인다(흰 글자) */
const VOWELS = ['a', 'e', 'i', 'o', 'u']

/** 그 배열에서 글자가 놓이는 줄 */
export function letterRows(): string[] {
  return prefs.get().abcLayout === 'keyboard'
    ? ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
    : ['abcdefg', 'hijklmn', 'opqrstu', 'vwxyz']
}

/** 큰 버튼 하나 */
export function bigButton(
  emoji: string,
  label: string,
  onClick: () => void,
  opts: { sub?: string; disabled?: boolean } = {}
): HTMLButtonElement {
  const inner: (Node | string)[] = [el('span', { class: 'en-big-emoji', text: emoji })]
  const labelBox = el('span', {}, [label])
  if (opts.sub) labelBox.append(el('span', { class: 'en-big-sub', text: opts.sub }))
  inner.push(labelBox)
  const b = el('button', { class: 'en-big', disabled: opts.disabled }, inner)
  if (!opts.disabled) b.addEventListener('click', onClick)
  return b
}

/** 진행 막대 (몇 문제째인지) */
export function progressBar(done: number, total: number): HTMLElement {
  const fill = el('span')
  fill.style.width = `${total === 0 ? 0 : Math.round((done / total) * 100)}%`
  return el('div', { class: 'en-q-bar' }, [fill])
}

/**
 * 답에 대한 반응 문구.
 *
 * 틀렸을 때 "틀렸어"라고 하지 않는다 — 7세에게는 그 말이 놀이를 그만두는 이유가 된다.
 * 대신 소리를 다시 들려준다는 뜻의 말을 쓴다.
 */
export const GOOD_WORDS = ['잘했어! 🎉', '좋아! ⭐', '맞았어! 👏', '멋지다! 🌟']
export const AGAIN_WORDS = ['다시 들어 볼까? 👂', '한 번 더 들어 보자 🔁', '소리를 잘 들어 봐 👂']

/**
 * 안내창 — 화면 가운데에 잠깐 띄운다.
 *
 * 작은 글씨 한 줄로는 아이가 못 알아채는 일(길이 다 막혀서 판을 섞었다 같은 것)을 알린다.
 * **아무것도 누르지 않아도 저절로 닫힌다** — 7세에게 확인 버튼을 강제하면 놀이가 끊긴다.
 * 대신 아무 곳이나 누르면 바로 닫히고, 닫힌 뒤에 onClose가 불린다.
 */
export function notice(
  /** 큰 그림 자리 — 이모지 한 글자 또는 직접 만든 노드(글자 카드 등) */
  emoji: string | Node,
  title: string,
  detail?: string,
  opts: { ms?: number; onClose?: () => void } = {}
): void {
  const box = el('div', { class: 'en-notice-box' }, [
    typeof emoji === 'string'
      ? el('div', { class: 'en-notice-emoji', text: emoji })
      : el('div', { class: 'en-notice-emoji' }, [emoji]),
    el('div', { class: 'en-notice-title', text: title }),
    ...(detail ? [el('div', { class: 'en-notice-detail', text: detail })] : []),
  ])
  const back = el('div', { class: 'en-notice', role: 'status' }, [box])

  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    back.remove()
    opts.onClose?.()
  }
  back.addEventListener('click', close)
  document.body.append(back)
  setTimeout(close, opts.ms ?? 1800)
}

/**
 * 글자 카드 한 장을 그린다.
 *
 * 이모지(🎴)를 쓰지 않는 이유: 그건 **화투 카드**라서 이 앱과 아무 관계가 없고,
 * 무엇보다 **어떤 글자를 받았는지 보이지 않는다.** 실제 글자를 얼굴에 크게 얹은 카드를 직접 그리면
 * 받은 순간에 그 글자를 읽게 되어 그 자체가 짧은 연습이 된다.
 *
 * @param n 장수 (여러 장이면 오른쪽 아래에 표시). 1장이면 표시하지 않는다.
 */
export function letterCard(letter: string, n = 1, opts: { onClick?: () => void } = {}): HTMLElement {
  const kids: Node[] = [el('span', { class: 'en-card-face', text: letter })]
  if (n > 1) kids.push(el('span', { class: 'en-card-n', text: `×${n}` }))
  // 누를 일이 있으면 버튼으로 만든다 — div에 클릭을 달면 키보드·보조기술에서 눌리지 않는다
  if (!opts.onClick) return el('div', { class: 'en-card' }, kids)
  const b = el('button', { class: 'en-card', 'aria-label': `${letter} 카드` }, kids)
  b.addEventListener('click', opts.onClick)
  return b
}

/** 카드 여러 장을 나란히 */
export function letterCards(letters: string[]): HTMLElement {
  return el('div', { class: 'en-card-row' }, letters.map((l) => letterCard(l)))
}

export function pickOne<T>(arr: readonly T[]): T {
  const v = arr[Math.floor(Math.random() * arr.length)]
  if (v === undefined) throw new Error('빈 배열')
  return v
}
