/**
 * 글자 따라 쓰기 — 실루엣 위에 **획 순서를 보여주고**, 아이가 손가락(마우스)으로 덧그린다.
 *
 * 왜 화면 안에서 쓰게 하나: 글자를 **고르는** 것과 **만드는** 것은 다른 능력이다.
 * 26자를 다 고를 줄 아는 아이도 b와 d를 손으로 쓰면 자주 뒤집는다 — 손이 순서를 알아야 한다.
 *
 * 규칙:
 * - 뒤에 그 글자의 실루엣이 흐리게 깔린다(따라 그릴 길)
 * - 획 순서를 **처음 한 번 바로** 보여주고, 그 뒤로는 **3초마다 되풀이**한다
 *   (한 번 보고 놓친 아이가 기다리면 다시 볼 수 있어야 한다)
 * - 아이가 그린 선은 진하게 남고, 「지우기」로 지운다
 */
import { ONE_STROKE_OK, STROKES } from './data/strokes'
import { hintFor, judgeCovers, judgeStroke, type Pt } from './handwrite'
import { el } from './ui'

const NS = 'http://www.w3.org/2000/svg'

/**
 * 판의 좌표계 — **손글씨 공책**처럼 세로를 3등분한다.
 *
 * 판(높이 126)을 **정확히 3등분**하는 점선 두 줄(가운뎃줄 42 · 기준선 84)이 있고, 윗줄·아랫줄은 판 테두리다.
 * 대문자는 윗줄~기준선, 소문자는 가운뎃줄~기준선에 앉는다(올림획 b·d·h는 윗줄까지, 내림획 g·p·y는 아랫줄까지).
 * 글자는 테두리에 닿지 않게 위아래 8씩 안쪽에 둔다.
 * 처음엔 글자가 상자 가운데 떠 있어서 대·소문자의 키 차이가 안 보였다(사용자 지적) —
 * 아이는 "a는 작고 b는 크다"를 줄에 대고 배운다.
 */
const VB_W = 100
const VB_H = 126
const LINES = { top: 8, mid: 42, base: 84, bottom: 118 } as const

/** 획 데이터(strokes.ts)의 y를 공책 줄에 맞춘다. 데이터는 대문자 10~90 · 소문자 x높이 40~80(올림 10, 내림 100) 기준이다 */
function yUpper(y: number): number {
  return LINES.top + ((y - 10) * (LINES.base - LINES.top)) / 80
}
function yLower(y: number): number {
  if (y <= 40) return LINES.top + ((y - 10) * (LINES.mid - LINES.top)) / 30 // 올림획: 10→윗줄, 40→가운뎃줄
  if (y <= 80) return LINES.mid + ((y - 40) * (LINES.base - LINES.mid)) / 40 // x높이: 40→가운뎃줄, 80→기준선
  return LINES.base + ((y - 80) * (LINES.bottom - LINES.base)) / 20 // 내림획: 80→기준선, 100→아랫줄
}

/** path의 좌표 쌍마다 y만 바꾼다 (M·L·Q 모두 (x y) 쌍이라 홀수째 숫자가 y다) */
function mapPathY(d: string, fy: (y: number) => number): string {
  let i = 0
  return d.replace(/-?[\d.]+/g, (num) => {
    const isY = i % 2 === 1
    i++
    return isY ? fy(Number(num)).toFixed(1) : num
  })
}
/** 되풀이 간격 */
const LOOP_MS = 3000
/** 획 하나를 긋는 시간 — 길이에 비례하되 너무 빠르지 않게 */
const STROKE_MS = (len: number): number => 350 + len * 5
const BETWEEN_MS = 180

export interface Tracer {
  el: HTMLElement
  /** 다른 글자로 바꾼다 */
  show: (letter: string) => void
  /** 화면에서 내려갈 때 — 타이머를 멈춘다 */
  stop: () => void
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
  return n
}

/**
 * 글자 하나(대문자 또는 소문자)를 그리는 판.
 * 세 겹이다: 실루엣(뒤) → 획 안내(가운데, 움직임) → 아이의 선(앞)
 */
/** 판에서 일어나는 일 — 획 하나를 맞게 그었다 / 틀렸다(힌트) / 글자를 다 썼다 */
type PadEvent = { type: 'ok' } | { type: 'bad'; hint: string } | { type: 'done' }

function glyphPad(letter: string, kind: 'upper' | 'lower', onEvent: (e: PadEvent) => void): {
  box: HTMLElement
  isDone: () => boolean
  play: () => number
  duration: () => number
  /** 번호를 놓는다 — 재생을 기다리지 않고 바로 보이게 */
  prepare: () => void
  reset: () => void
  clear: () => void
} {
  const fy = kind === 'upper' ? yUpper : yLower
  const paths = (STROKES[letter] ?? []).map((d) => mapPathY(d, fy))
  const svg = svgEl('svg', { viewBox: `0 0 ${VB_W} ${VB_H}`, class: 'en-trace-svg' })

  // ⓪ 공책 줄 — **가운데 두 줄만**(가운뎃줄·기준선) 판 테두리와 같은 점선으로.
  // 윗줄·아랫줄은 판의 테두리가 대신한다 — 줄이 넷이면 글자보다 줄이 먼저 보였다(사용자 판단)
  const lines = svgEl('g', { class: 'en-trace-lines' })
  for (const y of [LINES.mid, LINES.base]) {
    lines.append(svgEl('line', { x1: '0', x2: String(VB_W), y1: String(y), y2: String(y), class: 'en-trace-line' }))
  }
  svg.append(lines)

  // ① 실루엣 — 따라 그릴 길. 굵고 흐리다
  const ghost = svgEl('g', { class: 'en-trace-ghost' })
  for (const d of paths) ghost.append(svgEl('path', { d }))

  // ② 획 안내 — 차례로 그어진다
  const guide = svgEl('g', { class: 'en-trace-guide' })
  const guidePaths = paths.map((d) => {
    const p = svgEl('path', { d })
    guide.append(p)
    return p
  })

  // ③ 아이가 그리는 선
  const ink = svgEl('g', { class: 'en-trace-ink' })
  svg.append(ghost, guide, ink)

  // 획 순서 번호 — 시작점 곁에 작은 숫자. 아이가 "어디서부터"를 보게 한다
  const marks = svgEl('g', { class: 'en-trace-no' })
  svg.append(marks)
  let marksPlaced = false

  /**
   * 번호를 **획이 나아가는 방향의 반대쪽**에 놓는다.
   *
   * 시작점에 그냥 찍으면 B·D·P·R처럼 같은 점에서 시작하는 두 획의 번호가 겹쳐 하나만 보였다.
   * 획 1은 아래로 가니 번호는 위에, 획 2는 오른쪽으로 가니 번호는 왼쪽에 — 자연히 갈라진다.
   * 그래도 겹치면 이미 놓인 번호를 피해 밀어낸다. 길이·방향은 DOM에 붙은 뒤에만 잴 수 있어 재생 직전에 놓는다.
   */
  function placeMarks(): void {
    if (marksPlaced) return
    marksPlaced = true
    const placed: { x: number; y: number }[] = []
    guidePaths.forEach((p, i) => {
      const total = p.getTotalLength?.() || 0
      const s0 = p.getPointAtLength(0)
      const s1 = p.getPointAtLength(Math.min(6, total))
      let dx = s1.x - s0.x
      let dy = s1.y - s0.y
      const n = Math.hypot(dx, dy) || 1
      dx /= n
      dy /= n
      // 획 반대쪽으로 9만큼 물러난 자리
      let x = s0.x - dx * 9
      let y = s0.y - dy * 9
      // 상자 밖으로 나가지 않게
      x = Math.max(5, Math.min(VB_W - 7, x))
      y = Math.max(9, Math.min(VB_H - 4, y))
      // 이미 놓인 번호와 겹치면 오른쪽·아래로 밀어낸다
      for (let tries = 0; tries < 6 && placed.some((q) => Math.hypot(q.x - x, q.y - y) < 9); tries++) {
        x += 7
        y += 7
      }
      placed.push({ x, y })
      const t = svgEl('text', { x: String(x.toFixed(1)), y: String((y + 3).toFixed(1)) })
      t.textContent = String(i + 1)
      marks.append(t)
    })
  }

  const box = el('div', { class: 'en-trace-pad' })
  box.append(svg)

  // ── 획 안내 재생 ──────────────────────────────────────
  let timers: number[] = []
  const lengths = guidePaths.map((p) => p.getTotalLength?.() ?? 100)

  function reset(): void {
    for (const t of timers) clearTimeout(t)
    timers = []
    guidePaths.forEach((p, i) => {
      // 아직 길이를 못 쟀으면(화면에 붙기 전) 넉넉한 값으로 숨긴다 — 0을 주면 실선으로 보인다
      const len = lengths[i] || 1000
      p.style.transition = 'none'
      p.style.strokeDasharray = String(len)
      p.style.strokeDashoffset = String(len)
    })
  }

  /** DOM에 붙은 뒤에야 getTotalLength가 맞는 값을 준다 → 그때 다시 잰다 */
  function measure(): void {
    guidePaths.forEach((p, i) => {
      lengths[i] = p.getTotalLength?.() || lengths[i] || 100
    })
  }

  /** 다 긋는 데 걸리는 시간(ms) — 재생하지 않고 계산만 */
  function duration(): number {
    measure()
    return 60 + lengths.reduce((sum, len) => sum + STROKE_MS(len || 100) + BETWEEN_MS, 0)
  }

  /** 획을 차례로 긋는다. 다 긋는 데 걸리는 시간을 돌려준다 */
  function play(): number {
    reset()
    measure()
    placeMarks()
    let at = 60
    guidePaths.forEach((p, i) => {
      const len = lengths[i] || 100
      const ms = STROKE_MS(len)
      timers.push(
        window.setTimeout(() => {
          p.style.strokeDasharray = String(len)
          p.style.strokeDashoffset = String(len)
          // 다음 프레임에 전환을 켜야 0에서 시작하는 움직임이 보인다
          requestAnimationFrame(() => {
            p.style.transition = `stroke-dashoffset ${ms}ms linear`
            p.style.strokeDashoffset = '0'
          })
        }, at)
      )
      at += ms + BETWEEN_MS
    })
    return at
  }

  // ── 아이가 그리기 + 획마다 판정 ───────────────────────────
  let drawing: SVGPathElement | null = null
  let pts: Pt[] = []
  /** 다음에 그어야 할 획 번호 */
  let expected = 0
  let done = false
  const toLocal = (e: PointerEvent): Pt => {
    const r = svg.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * VB_W, y: ((e.clientY - r.top) / r.height) * VB_H }
  }
  const dOf = (): string => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  /** i번 획부터 j번 획까지가 **손을 떼지 않고** 이어 그을 수 있는 모양인가 (앞 획의 끝 = 다음 획의 시작) */
  function connectable(i: number, j: number): boolean {
    for (let m = i; m < j; m++) {
      const a = guidePaths[m]
      const b = guidePaths[m + 1]
      if (!a || !b) return false
      const end = a.getPointAtLength(a.getTotalLength())
      const start = b.getPointAtLength(0)
      if (Math.hypot(end.x - start.x, end.y - start.y) > 14) return false
    }
    return true
  }

  /** 안내 획을 같은 간격의 점으로 — 판정은 점끼리 비교한다 */
  function guidePoints(i: number): Pt[] {
    const p = guidePaths[i]
    if (!p) return []
    const L = p.getTotalLength()
    return Array.from({ length: 24 }, (_, k) => {
      const q = p.getPointAtLength((L * k) / 23)
      return { x: q.x, y: q.y }
    })
  }

  svg.addEventListener('pointerdown', (e) => {
    if (done) return
    e.preventDefault()
    svg.setPointerCapture(e.pointerId)
    pts = [toLocal(e)]
    drawing = svgEl('path', { d: dOf() })
    ink.append(drawing)
  })
  svg.addEventListener('pointermove', (e) => {
    if (!drawing) return
    pts.push(toLocal(e))
    drawing.setAttribute('d', dOf())
  })
  const end = (): void => {
    if (!drawing) return
    const stroke = drawing
    drawing = null
    /**
     * 손을 뗀 순간 그 획을 판정한다 — 글자를 다 쓴 뒤 한꺼번에 보면 어느 획이 틀렸는지 아이가 모른다.
     * 틀린 획은 지우고 같은 획을 다시 긋게 한다(앞서 맞힌 획은 남긴다).
     */
    /**
     * **이어 쓰기**: B의 2·3획처럼 앞 획이 끝나는 자리에서 다음 획이 시작하면 아이는 손을 떼지 않고
     * 한 번에 긋는다(사용자 지적). 그래서 남은 획을 **여러 개 이어 붙인 길**과도 견줘 보고,
     * 가장 많이 맞힌 쪽을 인정한다. 붙어 있지 않은 획(E의 1→2)은 이어 붙이지 않는다 — 모양이 다르다.
     */
    let passed = 0
    let first: ReturnType<typeof judgeStroke> | null = null
    for (let k = Math.min(guidePaths.length - expected, 4); k >= 1; k--) {
      if (k > 1 && !connectable(expected, expected + k - 1)) continue
      const guide = Array.from({ length: k }, (_, j) => guidePoints(expected + j)).flat()
      const v = judgeStroke(pts, guide)
      if (v.ok) {
        passed = k
        break
      }
      if (k === 1) first = v
    }
    // h·m·n·k…: 되짚어 올라가며 한 번에 쓴 것 — 남은 획 전부의 길을 거의 다 지났으면 통과
    if (passed === 0 && ONE_STROKE_OK.has(letter)) {
      const remaining = guidePaths.length - expected
      const union = Array.from({ length: remaining }, (_, j) => guidePoints(expected + j)).flat()
      const start = guidePoints(expected)[0]
      if (start && judgeCovers(pts, union, start).ok) passed = remaining
    }
    if (passed === 0) {
      stroke.classList.add('en-is-wrong')
      window.setTimeout(() => stroke.remove(), 350)
      onEvent({ type: 'bad', hint: hintFor(first ?? { ok: false, reason: 'off-path' }) })
      return
    }
    stroke.classList.add('en-is-ok')
    expected += passed
    if (expected >= guidePaths.length) {
      done = true
      box.classList.add('en-is-done')
      onEvent({ type: 'done' })
    } else {
      onEvent({ type: 'ok' })
    }
  }
  svg.addEventListener('pointerup', end)
  svg.addEventListener('pointercancel', end)

  function clear(): void {
    ink.replaceChildren()
    expected = 0
    done = false
    drawing = null
    box.classList.remove('en-is-done')
  }

  function prepare(): void {
    measure()
    placeMarks()
  }

  return { box, isDone: () => done, play, duration, prepare, reset, clear }
}

/**
 * 따라 쓰기 판 — 대문자와 소문자를 나란히.
 * 둘을 같이 두는 이유는 카드(A a)와 같다: 같은 글자의 두 모습이라는 것을 손으로도 안다.
 */
export function makeTracer(
  initial: string,
  onSpeak?: (letter: string) => void,
  /** 대문자·소문자를 다 맞게 썼을 때 */
  onPass?: (letter: string) => void
): Tracer {
  const holder = el('div', { class: 'en-trace' })
  const pads = el('div', { class: 'en-trace-pads' })
  const title = el('p', { class: 'en-trace-title' })
  const msg = el('p', { class: 'en-trace-msg' })
  const clearBtn = el('button', { class: 'en-mini', text: '🧽 지우기' })
  const againBtn = el('button', { class: 'en-mini', text: '▶ 순서 다시' })
  const hearBtn = el('button', { class: 'en-mini', text: '🔊 듣기' })
  holder.append(title, pads, msg, el('div', { class: 'en-minirow' }, [againBtn, clearBtn, hearBtn]))

  let current = initial
  let upper: ReturnType<typeof glyphPad> | null = null
  let lower: ReturnType<typeof glyphPad> | null = null
  let timers: number[] = []

  function stopLoop(): void {
    for (const t of timers) clearTimeout(t)
    timers = []
    upper?.reset()
    lower?.reset()
  }

  /**
   * 대문자 → 소문자 차례로 한 번 보여주고, **다 그린 뒤 3초 쉬었다가** 다시 보여준다.
   * setInterval(3초)로 하면 획이 많은 글자(W·M)는 다 그리기 전에 다시 시작해 버린다.
   */
  function playBoth(): void {
    if (!document.body.contains(holder)) {
      stopLoop()
      return
    }
    // 소문자 번호는 소문자 재생(대문자 다음)을 기다리지 않고 지금 놓는다 — 아이는 두 판을 같이 본다
    lower?.prepare()
    const up = upper?.play() ?? 0
    const low = lower?.duration() ?? 0
    timers.push(window.setTimeout(() => lower?.play(), up + BETWEEN_MS))
    timers.push(window.setTimeout(playBoth, up + BETWEEN_MS + low + LOOP_MS))
  }

  function show(letter: string): void {
    current = letter
    holder.dataset.letter = letter
    stopLoop()
    msg.textContent = ''
    msg.className = 'en-trace-msg'
    const onEvent = (e: PadEvent): void => {
      if (e.type === 'bad') {
        msg.textContent = e.hint
        msg.className = 'en-trace-msg en-again'
        return
      }
      msg.textContent = e.type === 'done' ? '좋아! 👏' : '맞아, 다음 획! ✏️'
      msg.className = 'en-trace-msg en-good'
      // 대문자·소문자를 **둘 다** 다 썼을 때만 통과 — 카드에 둘이 같이 있는 이유와 같다
      if (upper?.isDone() && lower?.isDone()) {
        msg.textContent = `${letter.toUpperCase()} ${letter} 통과! 입력 줄에 넣었어요 ✅`
        onPass?.(letter)
      }
    }
    upper = glyphPad(letter.toUpperCase(), 'upper', onEvent)
    lower = glyphPad(letter.toLowerCase(), 'lower', onEvent)
    pads.replaceChildren(upper.box, lower.box)
    title.textContent = `${letter.toUpperCase()} ${letter} 순서대로 써 보세요 ✍️`
    // 처음 한 번은 **바로**, 그다음부터는 다 그린 뒤 3초마다.
    // rAF가 아니라 타이머로 여는 이유: 화면이 가려져 있으면 rAF가 멈춰 첫 재생(과 번호 배치)이 밀린다
    timers.push(window.setTimeout(playBoth, 0))
  }

  clearBtn.addEventListener('click', () => {
    upper?.clear()
    lower?.clear()
    msg.textContent = ''
    msg.className = 'en-trace-msg'
  })
  againBtn.addEventListener('click', () => {
    stopLoop()
    playBoth()
  })
  hearBtn.addEventListener('click', () => onSpeak?.(current))

  show(initial)
  return { el: holder, show, stop: stopLoop }
}
