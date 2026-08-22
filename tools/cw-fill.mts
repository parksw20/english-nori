/** 난이도별로 목표 낱말 수를 얼마나 채우는지 — 판 크기 대비 문제 수를 정할 때 쓴다 */
import { build, isPlayable, type Level } from '../src/crossword'
import { picturableUpTo, stageOf } from '../src/phonics'
import type { StageId } from '../src/data/types'

function pool(stage: number): string[] {
  return picturableUpTo(stage as StageId)
    .filter((w) => stageOf(w.en) <= stage)
    .map((w) => w.en)
}

/** makePuzzle과 같은 절차를 쓰되, 목표를 못 채워도 몇 개까지 갔는지 본다 */
function tryLevel(words: string[], size: number, want: number, maxLen: number, tries = 60): number[] {
  const usable = words.filter((w) => /^[a-z]+$/.test(w) && w.length >= 3 && w.length <= maxLen)
  const got: number[] = []
  for (let run = 0; run < 30; run++) {
    let best = 0
    for (let t = 0; t < tries; t++) {
      const picked = [...usable].sort(() => Math.random() - 0.5).slice(0, want + 4).sort((a, b) => b.length - a.length)
      const p = build(picked, size)
      if (isPlayable(p, want)) { best = p.words.length; break }
      best = Math.max(best, p.words.length)
    }
    got.push(best)
  }
  return got
}

const cases: (Pick<Level, 'label' | 'stage' | 'size' | 'words' | 'maxLen'>)[] = [
  { label: '초급', stage: 2, size: 7, words: 6, maxLen: 5 },
  { label: '초급+', stage: 2, size: 7, words: 7, maxLen: 5 },
  { label: '중급', stage: 3, size: 9, words: 9, maxLen: 6 },
  { label: '중급+', stage: 3, size: 9, words: 10, maxLen: 7 },
  { label: '고급', stage: 4, size: 11, words: 12, maxLen: 8 },
  { label: '고급+', stage: 4, size: 11, words: 14, maxLen: 9 },
]

for (const c of cases) {
  const got = tryLevel(pool(c.stage), c.size, c.words, c.maxLen)
  const full = got.filter((n) => n >= c.words).length
  console.log(
    `${c.label} ${c.size}×${c.size} 목표 ${c.words}개 (풀 ${pool(c.stage).length}) → 30판 중 ${full}판 성공 · 평균 ${(got.reduce((a, b) => a + b, 0) / got.length).toFixed(1)}개`
  )
}
