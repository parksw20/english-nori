/**
 * 획 순서 데이터 검사 — `npm test`가 함께 돌린다.
 *
 * 획 방향은 화면으로 보면 그럴듯해 보여서 놓친다: A의 첫 획이 아래에서 위로 올라가도 완성된 모양은 같다.
 * 사용자가 잡았다(2026-09-04). 아이 손이 배우는 것은 완성된 모양이 아니라 **움직임**이므로 방향을 숫자로 못 박는다.
 */

export {}

const { STROKES } = await import('../src/data/strokes')

let pass = 0
const fails: string[] = []

function check(name: string, fn: () => void): void {
  try {
    fn()
    pass++
    console.log(`  ok  ${name}`)
  } catch (e) {
    fails.push(`${name}: ${(e as Error).message}`)
    console.log(`  FAIL ${name} — ${(e as Error).message}`)
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

/** path의 좌표를 차례로 뽑는다 (M·L·Q의 끝점만 — 제어점은 방향 판단에 안 쓴다) */
function points(d: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const re = /([MLQ])\s*([^MLQ]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) {
    const nums = (m[2] as string).trim().split(/[\s,]+/).map(Number)
    if (m[1] === 'Q') {
      // Q cx cy x y — 끝점은 마지막 둘
      out.push({ x: nums[2] as number, y: nums[3] as number })
    } else {
      for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i] as number, y: nums[i + 1] as number })
    }
  }
  return out
}

console.log('\n획 순서 검사\n')

check('26자 대문자·소문자가 모두 있고 획이 비어 있지 않다', () => {
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    for (const g of [ch, ch.toUpperCase()]) {
      const s = STROKES[g]
      assert(!!s && s.length > 0, `${g}: 획이 없다`)
      for (const d of s ?? []) assert(points(d).length >= 2, `${g}: 점이 둘 미만인 획 "${d}"`)
    }
  }
})

check('모든 획은 위에서 아래로 내린다 (아래에서 시작해 올라가는 획이 없다)', () => {
  const bad: string[] = []
  for (const [g, strokes] of Object.entries(STROKES)) {
    strokes.forEach((d, i) => {
      const pts = points(d)
      const start = pts[0] as { x: number; y: number }
      const end = pts[pts.length - 1] as { x: number; y: number }
      const lowest = Math.max(...pts.map((p) => p.y))
      // 내려가는 획(끝이 더 아래)이거나, 내려갔다 올라오는 한 획(가운데 어딘가가 시작·끝보다 아래)이면 통과.
      // 곡선의 오른쪽 끝이 시작보다 살짝 위인 C·G·S 같은 것은 3 이내면 봐준다
      const descends = end.y >= start.y - 3
      const dips = lowest > start.y + 3 && lowest > end.y + 3
      if (!descends && !dips) bad.push(`${g}#${i + 1} (${start.x},${start.y})→(${end.x},${end.y})`)
    })
  }
  assert(bad.length === 0, `올라가는 획: ${bad.join(' · ')}`)
})

check('가로획은 왼쪽에서 오른쪽으로 긋는다', () => {
  const bad: string[] = []
  for (const [g, strokes] of Object.entries(STROKES)) {
    strokes.forEach((d, i) => {
      const pts = points(d)
      const start = pts[0] as { x: number; y: number }
      const end = pts[pts.length - 1] as { x: number; y: number }
      if (Math.abs(start.y - end.y) <= 1 && pts.length === 2 && end.x < start.x) bad.push(`${g}#${i + 1}`)
    })
  }
  assert(bad.length === 0, `오른쪽→왼쪽 가로획: ${bad.join(' · ')}`)
})

check('A는 꼭짓점에서 왼쪽 아래로 첫 획을 긋는다 (사용자가 잡은 사례)', () => {
  const a = STROKES.A as string[]
  const p = points(a[0] as string)
  assert(p[0]?.y === 10 && (p[0]?.x ?? 0) === 50, `A 첫 획이 꼭짓점에서 시작하지 않는다: ${a[0]}`)
  assert((p[1]?.x ?? 0) < 50 && (p[1]?.y ?? 0) > 80, `A 첫 획이 왼쪽 아래로 내려가지 않는다: ${a[0]}`)
})

console.log(`\n${pass}개 통과, ${fails.length}개 실패`)
if (fails.length) {
  console.log('\n실패 목록:')
  for (const f of fails) console.log(` - ${f}`)
  process.exit(1)
}
