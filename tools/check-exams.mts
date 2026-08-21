/** 새 마을 시험이 실제로 말이 되는 문제를 내는지 눈으로 보는 도구 */
import { EXAMS, generateExam, practiceQuestion } from '../src/exam'
import { WORDS } from '../src/data/words'
import { stageOf } from '../src/phonics'
import type { StageId } from '../src/data/types'

for (const spec of EXAMS) {
  const qs = generateExam(spec.stage, Math.random)
  const dupes = qs.length - new Set(qs.map((q) => `${q.type}|${q.answer}|${q.show}`)).size
  const badDecode = qs.filter((q) => q.decode && q.word && stageOf(q.word) > spec.stage)
  const badChoices = qs.filter((q) => new Set(q.choices).size !== q.choices.length || !q.choices.includes(q.answer))
  console.log(`\n── ${spec.title} (${qs.length}문항, 중복 ${dupes}, 단계침범 ${badDecode.length}, 보기이상 ${badChoices.length})`)
  for (const q of qs.slice(0, 6)) {
    console.log(`   ${q.type.padEnd(15)} 보임:${(q.show || '—').padEnd(8)} 소리:${(q.say ?? '—').padEnd(11)} 답:${q.answer.padEnd(11)} 보기:${q.choices.join('/')}`)
  }
  if (badDecode.length) console.log('   ⚠ 단계침범:', badDecode.map((q) => `${q.word}(${stageOf(q.word ?? '')})`).join(', '))
  if (badChoices.length) console.log('   ⚠ 보기이상:', badChoices.map((q) => `${q.answer}: ${q.choices.join('/')}`).join(' · '))
}

// 오늘의 놀이(연습)도 새 단계 낱말로 만들어지는지
console.log('\n── 오늘의 놀이 (단계 4 낱말)')
for (const en of ['cake', 'sock', 'ship', 'time']) {
  const w = WORDS.find((x) => x.en === en)
  if (!w) continue
  const stage = w.stage as StageId
  for (const nth of [0, 1, 2]) {
    const q = practiceQuestion(w, stage, nth)
    console.log(`   ${en}#${nth} ${q.type.padEnd(15)} 보임:${(q.show || '—').padEnd(8)} 답:${q.answer}`)
  }
}
