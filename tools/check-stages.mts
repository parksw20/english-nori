/** 단계별 낱말이 실제로 그 단계에서 읽히는지, 그림이 겹치지 않는지 눈으로 보는 도구 */
import { WORDS } from '../src/data/words'
import { segment, stageOf } from '../src/phonics'

const bad = WORDS.filter((w) => w.stage > 0 && !w.en.includes(' ') && stageOf(w.en) > w.stage) // 단계 0 대표낱말은 해독 대상이 아니다
console.log(
  '단계 침범:',
  bad.length ? bad.map((w) => `${w.en}(적힌 ${w.stage} / 계산 ${stageOf(w.en)} = ${(segment(w.en) ?? []).join('·')})`).join('\n  ') : '없음'
)

for (const s of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const mine = WORDS.filter((w) => w.stage === s)
  console.log(`단계 ${s}: ${mine.length}개 · 그림가능 ${mine.filter((w) => !w.abstract).length}개 · 누계 ${WORDS.filter((w) => w.stage <= s).length}`)
}

// 그림 문제에 나올 수 있는 낱말끼리 이모지가 겹치면 답이 둘이 된다
const pics = WORDS.filter((w) => !w.abstract)
const byEmoji = new Map<string, string[]>()
for (const w of pics) byEmoji.set(w.emoji, [...(byEmoji.get(w.emoji) ?? []), w.en])
const dup = [...byEmoji].filter(([, ws]) => ws.length > 1)
console.log('그림 겹침:', dup.length ? dup.map(([e, ws]) => `${e} ${ws.join('/')}`).join(', ') : '없음')
