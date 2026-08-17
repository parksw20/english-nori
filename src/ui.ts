/**
 * 화면 만들기 도구 — 프레임워크 없이 DOM을 직접 만든다.
 *
 * 7세용 규칙을 여기 모아 둔다: 버튼은 크게, 글씨는 크게, 오답에 벌을 주지 않는다.
 * 규칙을 각 화면에 흩어 놓으면 어느 화면은 빨간 X를 띄우게 된다.
 */

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
export function top(title: string, onBack?: () => void, sub?: string): HTMLElement {
  const kids: (Node | string)[] = []
  if (onBack) {
    const b = el('button', { class: 'en-back', 'aria-label': '뒤로', text: '←' })
    b.addEventListener('click', onBack)
    kids.push(b)
  }
  kids.push(el('h1', { text: title }))
  if (sub) kids.push(el('span', { class: 'en-top-sub', text: sub }))
  return el('div', { class: 'en-top' }, kids)
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
