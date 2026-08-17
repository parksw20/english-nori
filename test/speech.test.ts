/**
 * 말하기 채점 테스트 — 마이크 입력은 헤드리스로 넣을 수 없지만 **판정 규칙은 순수 함수**라 검증할 수 있다.
 *
 * 여기서 못 박는 것: ①문장은 전부/전무가 아니라 내용어 비율로 본다 ②기능어(a·the·is)는 세지 않는다
 * ③글자 하나 차이는 맞은 것으로 본다 ④들린/안 들린 낱말을 돌려준다.
 * 처음에는 문장 채점을 아예 넣지 않았는데("인식률이 낮다"는 근거 없는 판단), 실제 문제는 채점 방식이었다.
 */
import { contentWords, editDistance, judge, judgeSentence } from '../src/speech'

let pass = 0
const fails: string[] = []

function check(name: string, fn: () => void): void {
  try {
    fn()
    pass++
    console.log(`  ok  ${name}`)
  } catch (e) {
    fails.push(`${name}: ${(e as Error).message}`)
    console.log(`FAIL  ${name}\n      ${(e as Error).message}`)
  }
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg)
}

console.log('\n말하기 채점 검사\n')

check('낱말 채점은 문장 안에서 낱말을 찾아낸다', () => {
  assert(judge('the cat is here', 'cat'), '문장 안의 cat을 찾아야 한다')
  assert(judge('cap', 'cat'), '글자 하나 차이는 통과')
  assert(!judge('dog', 'cat'), 'dog는 cat이 아니다')
  assert(!judge('', 'cat'), '아무 말도 안 했으면 통과 아니다')
})

check('내용어만 센다 (기능어는 아이 발음에서 뭉개진다)', () => {
  assert(contentWords('I see a bus.').join() === 'see,bus', `내용어: ${contentWords('I see a bus.').join()}`)
  assert(contentWords('It is a cat.').join() === 'cat', `내용어: ${contentWords('It is a cat.').join()}`)
})

check('문장은 내용어 비율로 채점한다', () => {
  // "I see a bus" → 내용어 see·bus
  assert(judgeSentence('i see a bus', 'I see a bus.').ok, '그대로 말하면 통과')
  assert(judgeSentence('see bus', 'I see a bus.').ok, '기능어를 빼먹어도 통과')
  // 인식기가 bus를 but으로 적는 일이 흔하다(글자 하나 차이) → 통과시킨다.
  // 아이를 막지 않는 쪽이 낫다는 판단이고, 이런 관대함은 의도된 것이다.
  assert(judgeSentence('i see a but', 'I see a bus.').ok, 'bus→but(글자 하나)도 통과')
  assert(editDistance('boss', 'bus') === 2, 'boss는 두 글자 차이 — 처음 테스트가 이걸 1로 봤다')
  assert(!judgeSentence('i like a dog', 'I see a bus.').ok, '내용어가 다 틀리면 통과 아니다')
})

check('들린 낱말과 안 들린 낱말을 돌려준다', () => {
  const r = judgeSentence('i see a dog', 'I see a bus.')
  assert(r.hit.join() === 'see', `들린 낱말: ${r.hit.join()}`)
  assert(r.missed.join() === 'bus', `안 들린 낱말: ${r.missed.join()}`)
  assert(!r.ok, '내용어 절반만 맞으면 기본 기준(0.6)에는 못 미친다')
})

check('기준을 낮추면 통과한다 (생활 표현용 0.5)', () => {
  const r = judgeSentence('i see a dog', 'I see a bus.', 0.5)
  assert(r.ok, '0.5 기준에서는 절반이면 통과')
})

check('내용어가 없는 짧은 표현도 채점된다', () => {
  // "Thank you!" 는 내용어(thank)가 있다. "It is a ..." 같은 기능어뿐인 문장은 기능어로 센다
  assert(judgeSentence('thank you', 'Thank you!').ok, 'Thank you는 통과해야 한다')
  assert(!judgeSentence('hello', 'Thank you!').ok, '엉뚱한 말은 통과 아니다')
})

check('편집 거리 계산이 맞다', () => {
  assert(editDistance('cat', 'cat') === 0, '같으면 0')
  assert(editDistance('cat', 'cut') === 1, '한 글자 다르면 1')
  assert(editDistance('cat', 'dog') === 3, '전부 다르면 3')
})

console.log(`\n${pass}개 통과, ${fails.length}개 실패`)
if (fails.length) {
  console.log('\n실패 목록:')
  for (const f of fails) console.log(` - ${f}`)
  process.exit(1)
}
