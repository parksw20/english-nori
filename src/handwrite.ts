/**
 * 손글씨 판정 — **아이가 그은 선이 그 획을 따라 썼는가**만 본다(화면 없음).
 *
 * 글자 인식기가 아니다. 안내 획(정답 경로)이 있고 아이가 그 위를 덧긋는 놀이라,
 * 물을 것은 셋뿐이다: 맞는 데서 시작했나 · 맞는 데서 끝났나(= 방향) · 길을 따라갔나.
 * 7세 손은 흔들리므로 기준은 넉넉하게 두되, **방향이 반대면 통과시키지 않는다** —
 * 이 놀이가 가르치는 것이 바로 방향이다.
 *
 * 좌표는 판의 viewBox 단위(가로 100)다.
 */

export interface Pt {
  x: number
  y: number
}

export interface JudgeOpts {
  /** 시작점·끝점 허용 거리 */
  endTol: number
  /** 선이 길에서 벗어나도 되는 거리 */
  nearTol: number
  /** 아이 선의 몇 할이 길 근처여야 하나 / 길의 몇 할을 아이 선이 지나야 하나 */
  minCover: number
}

export const DEFAULT_JUDGE: JudgeOpts = { endTol: 18, nearTol: 14, minCover: 0.7 }

export type Verdict =
  | { ok: true }
  | { ok: false; reason: 'too-short' | 'wrong-start' | 'wrong-end' | 'off-path' | 'missed-path' }

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** 꺾은선의 전체 길이 */
export function pathLength(pts: Pt[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1] as Pt, pts[i] as Pt)
  return len
}

/** 꺾은선을 같은 간격의 n점으로 다시 찍는다 — 빠르게 그으면 점이 듬성해서 그대로는 못 비교한다 */
export function resample(pts: Pt[], n: number): Pt[] {
  if (pts.length === 0) return []
  if (pts.length === 1 || n <= 1) return [pts[0] as Pt]
  const total = pathLength(pts)
  if (total === 0) return Array.from({ length: n }, () => pts[0] as Pt)
  const step = total / (n - 1)
  const out: Pt[] = [pts[0] as Pt]
  let acc = 0
  let i = 1
  let prev = pts[0] as Pt
  while (out.length < n && i < pts.length) {
    const cur = pts[i] as Pt
    const seg = dist(prev, cur)
    if (acc + seg >= step) {
      const t = (step - acc) / seg
      const p = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t }
      out.push(p)
      prev = p
      acc = 0
    } else {
      acc += seg
      prev = cur
      i++
    }
  }
  while (out.length < n) out.push(pts[pts.length - 1] as Pt)
  return out
}

/** 점에서 꺾은선까지의 최단 거리 */
export function distToPath(p: Pt, path: Pt[]): number {
  let best = Infinity
  for (let i = 0; i < path.length; i++) {
    const a = path[i] as Pt
    if (i === 0) {
      best = Math.min(best, dist(p, a))
      continue
    }
    const b = path[i - 1] as Pt
    const vx = a.x - b.x
    const vy = a.y - b.y
    const len2 = vx * vx + vy * vy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - b.x) * vx + (p.y - b.y) * vy) / len2))
    best = Math.min(best, dist(p, { x: b.x + vx * t, y: b.y + vy * t }))
  }
  return best
}

/**
 * 아이가 그은 한 획(drawn)이 안내 획(guide)을 따라 썼는가.
 * guide는 안내 경로를 같은 간격으로 찍은 점들(SVG getPointAtLength로 뽑는다).
 */
export function judgeStroke(drawn: Pt[], guide: Pt[], opts: JudgeOpts = DEFAULT_JUDGE): Verdict {
  if (drawn.length < 2 || guide.length < 2) return { ok: false, reason: 'too-short' }
  const gLen = pathLength(guide)
  // 톡 찍은 점이나 아주 짧은 선은 획이 아니다 (길이가 안내 획의 1/4도 안 되면)
  if (pathLength(drawn) < gLen * 0.25) return { ok: false, reason: 'too-short' }

  const d = resample(drawn, 24)
  const g = resample(guide, 24)
  const dStart = d[0] as Pt
  const dEnd = d[d.length - 1] as Pt
  const gStart = g[0] as Pt
  const gEnd = g[g.length - 1] as Pt

  // 방향은 시작·끝으로 본다 — 반대로 그으면 시작이 끝자리에 있다
  if (dist(dStart, gStart) > opts.endTol) return { ok: false, reason: 'wrong-start' }
  if (dist(dEnd, gEnd) > opts.endTol) return { ok: false, reason: 'wrong-end' }

  // 아이 선이 길 근처를 지나는가 (멀리 돌아가면 탈락)
  const near = d.filter((p) => distToPath(p, g) <= opts.nearTol).length / d.length
  if (near < opts.minCover) return { ok: false, reason: 'off-path' }

  // 길을 다 지나는가 (시작·끝만 찍고 가운데를 건너뛰면 탈락)
  const covered = g.filter((p) => distToPath(p, d) <= opts.nearTol).length / g.length
  if (covered < opts.minCover) return { ok: false, reason: 'missed-path' }

  return { ok: true }
}

/**
 * **한 번에 쓴 글자** 판정 — h·m·n·k처럼 획 사이를 되짚어 올라가며(줄기를 다시 타고) 손을 안 떼고 쓰는 글자용.
 *
 * 획 사이의 되짚기 길은 정해진 모양이 없어서 획 하나씩의 방향으로는 못 잰다. 대신 셋만 본다:
 * 첫 획의 시작점에서 출발했나 · 선이 글자 근처에만 있나 · 글자의 길을 **거의 다**(8할) 지났나.
 * 시작점을 보는 것으로 "위에서 아래로"는 지켜진다.
 */
export function judgeCovers(drawn: Pt[], guideUnion: Pt[], start: Pt, opts: JudgeOpts = DEFAULT_JUDGE): Verdict {
  if (drawn.length < 2 || guideUnion.length < 2) return { ok: false, reason: 'too-short' }
  const d = resample(drawn, 48)
  if (dist(d[0] as Pt, start) > opts.endTol) return { ok: false, reason: 'wrong-start' }
  const near = d.filter((p) => distToPath(p, guideUnion) <= opts.nearTol).length / d.length
  if (near < opts.minCover) return { ok: false, reason: 'off-path' }
  const covered = guideUnion.filter((p) => distToPath(p, drawn) <= opts.nearTol).length / guideUnion.length
  if (covered < 0.8) return { ok: false, reason: 'missed-path' }
  return { ok: true }
}

/** 아이에게 보여줄 말 — "틀렸다"가 아니라 무엇을 보면 되는지 */
export function hintFor(v: Verdict): string {
  if (v.ok) return ''
  switch (v.reason) {
    case 'too-short':
      return '조금 더 길게 그어 보자 ✏️'
    case 'wrong-start':
      return '숫자가 있는 곳에서 시작해 보자 🔎'
    case 'wrong-end':
      return '화살표 방향으로 끝까지 가 보자 ➡️'
    case 'off-path':
      return '회색 길 위로 따라가 보자 🛤️'
    case 'missed-path':
      return '길을 다 지나가야 해요 🛤️'
  }
}
