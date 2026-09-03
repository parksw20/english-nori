/**
 * 손글씨 판정 테스트 — `npm test`가 함께 돌린다.
 *
 * 판정은 눈으로 검증할 수 없다: 화면에서는 "통과했다/안 했다"만 보이고, 왜 그런지는 안 보인다.
 * 7세 손의 흔들림은 통과시키고 **반대 방향·엉뚱한 곳**은 떨어뜨린다는 것을 숫자로 못 박는다.
 */

export {}

const { judgeStroke, judgeCovers, resample, distToPath, pathLength } = await import('../src/handwrite')

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

/** 두 점을 잇는 직선을 n점으로 */
function line(x1: number, y1: number, x2: number, y2: number, n = 20): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => ({ x: x1 + ((x2 - x1) * i) / (n - 1), y: y1 + ((y2 - y1) * i) / (n - 1) }))
}

/** 흔들린 손 — 점마다 ±amp만큼 지그재그 */
function jitter(pts: { x: number; y: number }[], amp: number): { x: number; y: number }[] {
  return pts.map((p, i) => ({ x: p.x + (i % 2 ? amp : -amp), y: p.y + (i % 3 ? amp / 2 : -amp / 2) }))
}

// A의 첫 획: 꼭짓점(50,10) → 왼쪽 아래(15,90)
const GUIDE = line(50, 10, 15, 90)

console.log('\n손글씨 판정 검사\n')

check('길을 그대로 따라 그으면 통과', () => {
  assert(judgeStroke(line(50, 10, 15, 90), GUIDE).ok, '똑같이 그었는데 떨어졌다')
})

check('손이 흔들려도(±6) 통과 — 7세 손이다', () => {
  const v = judgeStroke(jitter(line(50, 10, 15, 90), 6), GUIDE)
  assert(v.ok, `흔들린 선이 떨어졌다: ${JSON.stringify(v)}`)
})

check('시작과 끝이 조금 빗나가도(12) 통과', () => {
  assert(judgeStroke(line(58, 18, 22, 84), GUIDE).ok, '살짝 빗나간 선이 떨어졌다')
})

check('**반대 방향**으로 그으면 떨어진다 (이 놀이가 가르치는 것이 방향이다)', () => {
  const v = judgeStroke(line(15, 90, 50, 10), GUIDE)
  assert(!v.ok && v.reason === 'wrong-start', `거꾸로 그었는데 ${JSON.stringify(v)}`)
})

check('엉뚱한 곳에 그으면 떨어진다', () => {
  const v = judgeStroke(line(80, 10, 85, 90), GUIDE)
  assert(!v.ok, '엉뚱한 곳의 선이 통과했다')
})

check('톡 찍은 점·아주 짧은 선은 획이 아니다', () => {
  const v = judgeStroke(line(50, 10, 48, 14, 5), GUIDE)
  assert(!v.ok && v.reason === 'too-short', `짧은 선이 ${JSON.stringify(v)}`)
})

check('시작·끝만 맞고 가운데를 크게 돌아가면 떨어진다', () => {
  // 꼭짓점에서 오른쪽으로 크게 돌아 왼쪽 아래로 오는 선
  const detour = [...line(50, 10, 95, 50, 10), ...line(95, 50, 15, 90, 10)]
  const v = judgeStroke(detour, GUIDE)
  assert(!v.ok, '크게 돌아간 선이 통과했다')
})

check('붙어 있는 두 획을 이어 붙인 길도 한 획으로 통과한다 (B의 2·3획)', () => {
  // 위 반원 끝(25,50)에서 아래 반원이 시작한다 → 아이가 손을 안 떼고 한 번에 긋는다
  const upper = [...line(25, 10, 80, 10, 6), ...line(80, 10, 80, 50, 6), ...line(80, 50, 25, 50, 6)]
  const lower = [...line(25, 50, 85, 50, 6), ...line(85, 50, 85, 90, 6), ...line(85, 90, 25, 90, 6)]
  const joined = [...upper, ...lower]
  assert(judgeStroke(joined, joined).ok, '이어 붙인 길을 그대로 그었는데 떨어졌다')
  assert(!judgeStroke(upper, joined).ok, '반만 그었는데 이어 붙인 길에 통과했다')
})

check('h를 되짚어 올라가며 한 번에 써도 통과한다 (줄기 ↓ → 되짚어 ↑ → 어깨 → ↓)', () => {
  const stem = line(30, 10, 30, 80, 10)
  const arch = [...line(30, 50, 52, 40, 6), ...line(52, 40, 70, 58, 6), ...line(70, 58, 70, 80, 6)]
  const union = [...stem, ...arch]
  const oneStroke = [...stem, ...line(30, 80, 30, 50, 6), ...arch]
  assert(judgeCovers(oneStroke, union, stem[0] as { x: number; y: number }).ok, '한 번에 쓴 h가 떨어졌다')
  // 줄기만 긋고 말면 안 된다
  const v1 = judgeCovers(stem, union, stem[0] as { x: number; y: number })
  assert(!v1.ok && v1.reason === 'missed-path', `줄기만 그었는데 ${JSON.stringify(v1)}`)
  // 아래에서 시작하면(거꾸로) 안 된다
  const v2 = judgeCovers([...oneStroke].reverse(), union, stem[0] as { x: number; y: number })
  assert(!v2.ok && v2.reason === 'wrong-start', `거꾸로 썼는데 ${JSON.stringify(v2)}`)
})

check('resample은 같은 간격으로 n점을 준다', () => {
  const r = resample(line(0, 0, 100, 0, 3), 11)
  assert(r.length === 11, `점 수 ${r.length}`)
  assert(Math.abs((r[5]?.x ?? 0) - 50) < 1, `가운데 점이 ${r[5]?.x}`)
  assert(Math.abs(pathLength(r) - 100) < 1, `길이 ${pathLength(r)}`)
})

check('distToPath는 선분까지의 수직 거리를 준다', () => {
  assert(Math.abs(distToPath({ x: 50, y: 10 }, line(0, 0, 100, 0, 2)) - 10) < 0.01, '수직 거리가 틀렸다')
  assert(Math.abs(distToPath({ x: 120, y: 0 }, line(0, 0, 100, 0, 2)) - 20) < 0.01, '끝점 밖 거리가 틀렸다')
})

console.log(`\n${pass}개 통과, ${fails.length}개 실패`)
if (fails.length) {
  console.log('\n실패 목록:')
  for (const f of fails) console.log(` - ${f}`)
  process.exit(1)
}
