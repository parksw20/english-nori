/** 마을이 올라갈수록 가로세로 판에 쓰이는 낱말이 실제로 느는지 — 난이도별 길이 제한까지 반영해 센다 */
import { LEVELS } from '../src/crossword'
import { picturableUpTo, stageOf } from '../src/phonics'
import type { StageId } from '../src/data/types'
import { STAGE_NAMES } from '../src/data/phonics'

function pool(stage: number): string[] {
  return picturableUpTo(stage as StageId)
    .filter((w) => stageOf(w.en) <= stage)
    .map((w) => w.en)
}

console.log('마을(단계) · 쓸 수 있는 낱말 · 초급(≤5글자) · 중급(≤6) · 고급(≤8)')
for (let s = 2; s <= 9; s++) {
  const p = pool(s)
  const byLevel = LEVELS.map((l) => p.filter((w) => w.length >= 3 && w.length <= l.maxLen).length)
  console.log(`${s + 1}번 ${STAGE_NAMES[s as StageId].padEnd(9)} 전체 ${String(p.length).padStart(3)}개 · ${byLevel.join(' / ')}`)
}

// 같은 마을에서 판을 여러 번 열면 낱말이 바뀌는가 (매번 새로 뽑는지)
const seen = new Set<string>()
for (let i = 0; i < 20; i++) {
  const p = pool(4)
  const picked = [...p].sort(() => Math.random() - 0.5).slice(0, 12)
  picked.forEach((w) => seen.add(w))
}
console.log(`\n5번 마을에서 20판을 열면 서로 다른 낱말 ${seen.size}개가 나온다 (풀 ${pool(4).length}개)`)
