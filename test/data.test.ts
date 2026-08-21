/**
 * 데이터 무결성 테스트 — `npm test`.
 *
 * 손으로 넣는 데이터(단계표·낱말·sight words)가 스스로 어긋나는 것을 막는다.
 * 특히 **단계 침범**(아직 안 배운 글자가 든 낱말)은 눈으로는 절대 못 잡는다 —
 * 단계 3에서 배우는 sh가 든 fish가 단계 1 낱말에 섞여 들면 아이는 읽을 수 없는 낱말을 만난다.
 * 실패하면 배포도 멈춘다(GitHub Actions).
 */
import starters from '../src/data/starters.json' with { type: 'json' }
import { GRAPHEMES, LETTERS, SHORT_VOWELS, STAGE_NAMES } from '../src/data/phonics'
import { MAX_STAGE, type StageId } from '../src/data/types'
import { BASE_FORM, NUMBER_WORDS, PHONICS_EXTRA, SIGHT_WORDS, WORDS } from '../src/data/words'
import { cvcByVowel, cvcWordsUpTo, isCvc, picturableCvcUpTo, picturableUpTo, segment, stageOf, wordsUpTo } from '../src/phonics'
import { choices, isMinimalPair } from '../src/distract'
import { EXAMS, examFor, generateExam, practiceQuestion, randomQuestions } from '../src/exam'
import { PHRASES, SCENES, TEMPLATES } from '../src/data/sentences'
import { fillTemplate, fillableWords, hasFinalConsonant, makeSentences, templatesFor, unreadableIn } from '../src/sentence'

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

const STARTERS = new Set(starters.words)
const STAGES: StageId[] = [0, 1]

/**
 * Starters 목록에 있는가.
 * - 'ice cream'처럼 띄어쓴 표제어는 낱말별로도 확인한다
 * - is/are/am은 목록에 `be` 한 줄로만 있다 → 기본형으로 대조한다(BASE_FORM)
 */
function inStarters(en: string): boolean {
  if (STARTERS.has(en)) return true
  const base = BASE_FORM[en]
  if (base && STARTERS.has(base)) return true
  if (en.includes(' ')) return en.split(' ').every((t) => STARTERS.has(t))
  return false
}

console.log(`\n영어놀이 데이터 검사 — 낱말 ${WORDS.length}개, Starters 정본 ${starters.words.length}개\n`)

// ── 1. 단계 침범: 소리 내어 읽는 낱말이 그 단계까지 배운 글자만으로 이루어져 있는가 ──────
//
// 알파벳 단계(0)의 대표 낱말(apple·umbrella·zoo)은 **해독 대상이 아니다** — 글자 소리를 그림으로
// 기억시키는 장치라 아이가 스펠링을 읽을 필요가 없다. 그래서 이 검사는 아이가 실제로 소리 내어
// 읽어야 하는 낱말(CVC)에만 적용한다. 대신 알파벳 낱말이 읽기 문제에 새어 들지 않는지는
// 아래 7번(시험 생성)에서 확인한다.
check('소리 내어 읽는 낱말에 아직 안 배운 그래핌이 없다 (단계 침범)', () => {
  const bad: string[] = []
  for (const w of WORDS) {
    if (!isCvc(w.en)) continue
    const s = stageOf(w.en)
    if (s > w.stage) bad.push(`${w.en}(단계 ${w.stage}) → ${segment(w.en)?.join('·')}는 단계 ${s}`)
  }
  assert(bad.length === 0, `${bad.length}개 — ${bad.join(' / ')}`)
})

check('단계 1 낱말은 전부 CVC다 (단모음 마을의 정의)', () => {
  const bad = WORDS.filter((w) => w.stage === 1 && !isCvc(w.en)).map((w) => `${w.en}(${segment(w.en)?.join('·')})`)
  assert(bad.length === 0, `CVC가 아닌 단계 1 낱말: ${bad.join(', ')}`)
})

check('모든 낱말이 그래핌으로 쪼개진다 (표에 없는 글자 조합이 없다)', () => {
  const bad = WORDS.filter((w) => !w.en.includes(' ') && segment(w.en) === null).map((w) => w.en)
  assert(bad.length === 0, `쪼갤 수 없는 낱말: ${bad.join(', ')}`)
})

// ── 2. 연습량 ────────────────────────────────────────────────────────────────
/** 낱말들에 실제로 나온 그래핌을 센다 */
function graphemeUse(): Map<string, number> {
  const used = new Map<string, number>()
  for (const w of wordsUpTo(MAX_STAGE)) {
    const segs = segment(w.en)
    if (!segs) continue
    for (const g of new Set(segs)) used.set(g, (used.get(g) ?? 0) + 1)
  }
  return used
}

check('알파벳 26자마다 낱말이 있다 (연습량)', () => {
  const used = graphemeUse()
  const letters = GRAPHEMES.filter((g) => g.stage === 0).map((g) => g.g)
  const missing = letters.filter((g) => (used.get(g) ?? 0) === 0)
  assert(missing.length === 0, `낱말이 하나도 없는 글자: ${missing.join(', ')}`)
  const thin = letters.filter((g) => (used.get(g) ?? 0) < 3)
  if (thin.length) console.log(`      (참고) 낱말이 3개 미만인 글자: ${thin.map((g) => `${g}:${used.get(g) ?? 0}`).join(' ')}`)
})

/**
 * 단계 2 이후는 **표의 그래핌을 다 가르치지 않는다.**
 * 표에는 sp·tw·lt처럼 Starters 안에서 마땅한 낱말이 없는 것도 있고, 그것들은 시험에서
 * **오답 보기**로만 쓰인다(빈칸 문제의 답은 낱말에서 나오므로 낱말 없는 그래핌은 답이 될 수 없다).
 * 그래서 "표를 다 채웠나"가 아니라 **"마을마다 배울 것이 충분한가"**를 본다.
 */
check('마을마다 낱말과 소리가 충분하다 (단계 2~4)', () => {
  const used = graphemeUse()
  for (const stage of [2, 3, 4] as const) {
    const mine = WORDS.filter((w) => w.stage === stage)
    assert(mine.length >= 20, `단계 ${stage}: 낱말 ${mine.length}개 (20개 이상이어야)`)
    assert(
      mine.filter((w) => !w.abstract).length >= 15,
      `단계 ${stage}: 그림으로 낼 수 있는 낱말 ${mine.filter((w) => !w.abstract).length}개 (15개 이상이어야)`
    )
    // 그 단계의 소리가 실제 낱말에 몇 가지나 나오는가 — 빈칸 문제의 정답이 될 수 있는 것들
    // 3가지인 이유: 마법의 e 마을은 a_e·i_e·o_e뿐이다 —
    // Starters 목록에 u_e(cube·June)와 e_e(these는 기능어) 낱말이 없다
    const taught = GRAPHEMES.filter((g) => g.stage === stage).filter((g) => (used.get(g.g) ?? 0) > 0)
    assert(taught.length >= 3, `단계 ${stage}: 낱말에 나오는 소리가 ${taught.length}가지 (3가지 이상이어야)`)
  }
})

// ── 3. 어휘 정본: Starters 목록 안에 있는가 ────────────────────────────────────
check('낱말이 Starters 목록 안에 있다 (예외는 이유가 적혀 있다)', () => {
  const bad: string[] = []
  for (const w of [...WORDS, ...SIGHT_WORDS]) {
    if (w.source === 'starters') {
      if (!inStarters(w.en)) bad.push(`${w.en}: Starters 목록에 없는데 source가 'starters'`)
    } else if (w.source === 'number') {
      if (!NUMBER_WORDS.includes(w.en)) bad.push(`${w.en}: 숫자 낱말(1~20)이 아닌데 source가 'number'`)
    } else if (w.source === 'phonics') {
      if (!PHONICS_EXTRA[w.en]) bad.push(`${w.en}: PHONICS_EXTRA에 이유가 없다`)
      if (inStarters(w.en)) bad.push(`${w.en}: Starters에 있으니 source를 'starters'로 바꿔라`)
    }
  }
  assert(bad.length === 0, `${bad.length}개\n      ${bad.join('\n      ')}`)
})

check('PHONICS_EXTRA에 안 쓰는 항목이 없다', () => {
  const used = new Set(WORDS.filter((w) => w.source === 'phonics').map((w) => w.en))
  const unused = Object.keys(PHONICS_EXTRA).filter((k) => !used.has(k))
  assert(unused.length === 0, `안 쓰는 예외: ${unused.join(', ')}`)
})

check('Starters 밖 낱말이 단계별 30%를 넘지 않는다', () => {
  for (const st of STAGES) {
    const inStage = WORDS.filter((w) => w.stage === st)
    const extra = inStage.filter((w) => w.source === 'phonics')
    const ratio = extra.length / inStage.length
    assert(
      ratio <= 0.3,
      `단계 ${st}(${STAGE_NAMES[st]}): ${extra.length}/${inStage.length} = ${Math.round(ratio * 100)}% > 30% (${extra.map((w) => w.en).join(', ')})`
    )
  }
})

// ── 4. 그림·뜻 누락과 중복 ────────────────────────────────────────────────────
check('모든 낱말에 한국어 뜻과 이모지가 있다', () => {
  const bad = WORDS.filter((w) => !w.ko.trim() || !w.emoji.trim()).map((w) => w.en)
  assert(bad.length === 0, `빠진 낱말: ${bad.join(', ')}`)
})

check('낱말이 중복되지 않는다', () => {
  const seen = new Set<string>()
  const dup: string[] = []
  for (const w of WORDS) {
    if (seen.has(w.en)) dup.push(w.en)
    seen.add(w.en)
  }
  assert(dup.length === 0, `중복: ${dup.join(', ')}`)
})

check('이모지가 낱말끼리 겹치지 않는다 (그림 짝맞추기가 성립해야 한다)', () => {
  const byEmoji = new Map<string, string[]>()
  for (const w of WORDS) byEmoji.set(w.emoji, [...(byEmoji.get(w.emoji) ?? []), w.en])
  const dup = [...byEmoji.entries()].filter(([, ws]) => ws.length > 1)
  assert(dup.length === 0, dup.map(([e, ws]) => `${e}: ${ws.join('/')}`).join(' · '))
})

// ── 4-1. 그림으로 물어도 되는 낱말 ───────────────────────────────────────────
//
// 🐘를 보여주고 big을 고르라는 문제는 **답을 알 방법이 없는 문제**다(아이는 elephant를 떠올린다).
// 그런 낱말은 `abstract: true`로 표시하고 그림 문제에서 빼는데, 표시를 빼먹으면 아무도 모른다 →
// 그림 문제를 실제로 생성해 abstract 낱말이 섞이는지 여기서 잡는다.
check('그림으로 물을 낱말이 단계마다 넉넉히 있다', () => {
  for (const st of STAGES) {
    const pics = picturableUpTo(st)
    assert(pics.length >= 12, `단계 ${st}: 그림 낱말 ${pics.length}개 (12개 이상 필요)`)
  }
  // 짝맞추기 6쌍·사천성 6낱말·시험 word-picture가 모두 CVC 그림 낱말을 쓴다
  const picCvc = picturableCvcUpTo(1)
  assert(picCvc.length >= 8, `그림으로 물을 CVC 낱말이 ${picCvc.length}개 (8개 이상 필요)`)
  console.log(`      그림 낱말: 단계0 ${picturableUpTo(0).length}개 · 단계1 ${picturableUpTo(1).length}개 (CVC ${picCvc.length}개)`)
})

check('abstract 낱말에도 뜻과 이모지가 있다 (도감에는 그대로 나온다)', () => {
  const bad = WORDS.filter((w) => w.abstract && (!w.ko.trim() || !w.emoji.trim())).map((w) => w.en)
  assert(bad.length === 0, `빠진 낱말: ${bad.join(', ')}`)
})

check('그림 문제에 abstract 낱말이 나오지 않는다 (시험 30회 생성)', () => {
  const abstractSet = new Set(WORDS.filter((w) => w.abstract).map((w) => w.en))
  // letter-word는 예외다: "z 하면 배운 그림은?"이라 대표 낱말(🦁=zoo)이 정답이 되는 것이 맞다.
  // 그림을 보고 **낱말을 알아내야** 하는 유형만 검사한다.
  const PICTURE_TYPES = new Set(['word-picture', 'picture-initial'])
  const bad: string[] = []
  for (let i = 0; i < 30; i++) {
    for (const st of STAGES) {
      for (const q of generateExam(st)) {
        if (!PICTURE_TYPES.has(q.type)) continue
        // **화면에 그림으로 나오는 낱말**만 검사한다.
        // 오답 보기는 글자로 읽는 것이라 big·hot이 섞이는 것은 오히려 좋다 —
        // 🐷(pig)에 big·bag·six가 보기로 붙으면 소리를 구별해야 하는 좋은 문제가 된다.
        if (q.word && abstractSet.has(q.word)) bad.push(`${q.type}에 그림으로 나온 ${q.word}`)
      }
    }
  }
  assert(bad.length === 0, `${bad.length}건 — ${[...new Set(bad)].slice(0, 5).join(' / ')}`)
})

check('letter-word의 정답은 늘 그 글자의 대표 낱말이다', () => {
  const keyword = new Map(LETTERS.map((l) => [l.ch, l.keyword]))
  const bad: string[] = []
  for (let i = 0; i < 30; i++) {
    for (const st of STAGES) {
      for (const q of generateExam(st)) {
        if (q.type !== 'letter-word') continue
        const want = keyword.get(q.show)
        if (q.answer !== want) bad.push(`${q.show} → ${q.answer} (대표 낱말은 ${want})`)
        // 보기 4개는 서로 다른 글자의 대표 낱말이어야 한다
        const notKeyword = q.choices.filter((c) => ![...keyword.values()].includes(c))
        if (notKeyword.length) bad.push(`${q.show} 보기에 대표 낱말이 아닌 것: ${notKeyword.join(',')}`)
      }
    }
  }
  assert(bad.length === 0, [...new Set(bad)].slice(0, 5).join(' / '))
})

check('연습 문제도 abstract 낱말에는 그림 문제를 내지 않는다', () => {
  const bad: string[] = []
  for (const w of WORDS.filter((x) => x.abstract)) {
    for (let nth = 0; nth < 6; nth++) {
      const q = practiceQuestion(w, 1, nth)
      if (q.type === 'word-picture' || q.type === 'picture-initial') bad.push(`${w.en} → ${q.type}`)
    }
  }
  assert(bad.length === 0, bad.join(', '))
})

// ── 4-2. 문장: 아이가 스스로 읽을 수 있는가 ─────────────────────────────────
//
// 문장을 손으로 다 적으면 못 읽는 낱말이 반드시 섞여 든다("I have a bike." — bike는 단계 4다).
// 그래서 **틀 + 계산**으로 만들고, 만들어진 문장의 모든 낱말이 읽을 수 있는지 여기서 확인한다.
check('문장 틀의 고정 낱말이 전부 읽을 수 있다 (sight words ∪ CVC)', () => {
  const bad: string[] = []
  for (const st of STAGES) {
    for (const t of templatesFor(st)) {
      // 빈칸(%n)을 뺀 나머지가 고정 낱말이다. **그 단계에서** 읽을 수 있어야 한다
      const fixed = t.en.replace(/%n/g, 'cat')
      const un = unreadableIn(fixed, st)
      if (un.length) bad.push(`단계 ${st} "${t.en}" → ${un.join(', ')}`)
    }
  }
  assert(bad.length === 0, `읽을 수 없는 낱말: ${bad.join(' / ')}`)
})

check('만들어진 문장이 전부 읽을 수 있다 (30판)', () => {
  const bad: string[] = []
  for (let i = 0; i < 30; i++) {
    for (const st of STAGES) {
      for (const s of makeSentences(st, 8)) {
        const un = unreadableIn(s.en, st)
        if (un.length) bad.push(`단계 ${st}: ${s.en} → ${un.join(', ')}`)
      }
    }
  }
  assert(bad.length === 0, `${bad.length}건 — ${[...new Set(bad)].slice(0, 3).join(' / ')}`)
})

check('문장 빈칸에는 그림으로 알아볼 수 있는 단수 명사만 들어간다', () => {
  const bad: string[] = []
  for (const st of STAGES) {
    for (const w of fillableWords(st)) {
      if (w.pos !== 'noun') bad.push(`${w.en}: ${w.pos}`)
      if (w.plural) bad.push(`${w.en}: 복수형`)
      if (w.abstract) bad.push(`${w.en}: 그림으로 알 수 없음`)
    }
    assert(fillableWords(st).length >= 4, `단계 ${st}: 문장에 넣을 명사가 ${fillableWords(st).length}개뿐`)
  }
  assert(bad.length === 0, bad.join(', '))
})

check('한국어 뜻의 조사가 받침에 맞다', () => {
  assert(hasFinalConsonant('십'), '십은 받침이 있다')
  assert(hasFinalConsonant('펜'), '펜은 받침이 있다')
  assert(!hasFinalConsonant('버스'), '버스는 받침이 없다')
  assert(!hasFinalConsonant('고양이'), '고양이는 받침이 없다')
  assert(!hasFinalConsonant('6'), '숫자는 받침 없는 쪽으로 본다')

  // **틀에 낱말을 직접 끼워 결과 문장을 그대로 대조한다.**
  // (문장을 뽑아 정규식으로 훑는 방식은 "고양이가 아니에요"처럼 맞는 문장을 오탐한다 — 실제로 그랬다)
  const byEn = new Map(WORDS.map((w) => [w.en, w]))
  const t = (en: string) => {
    const found = TEMPLATES.find((x) => x.en === en)
    if (!found) throw new Error(`틀을 못 찾았다: ${en}`)
    return found
  }
  const w = (en: string) => {
    const found = byEn.get(en)
    if (!found) throw new Error(`낱말을 못 찾았다: ${en}`)
    return found
  }
  const cases: [string, string[], string][] = [
    ['I see a %n.', ['bus'], '나는 버스를 봐요.'],
    ['I see a %n.', ['ten'], '나는 십을 봐요.'],
    ['It is a %n.', ['cat'], '그것은 고양이예요.'],
    ['It is a %n.', ['pen'], '그것은 펜이에요.'],
    ['Can you see the %n?', ['bus'], '버스가 보이나요?'],
    ['Can you see the %n?', ['pen'], '펜이 보이나요?'],
    ['A %n is not a %n.', ['sun', 'cat'], '해는 고양이가 아니에요.'],
    ['A %n is not a %n.', ['pen', 'ten'], '펜은 십이 아니에요.'],
    ['I can see a %n and a %n.', ['bus', 'pen'], '버스와 펜이 보여요.'],
    ['I can see a %n and a %n.', ['pen', 'bus'], '펜과 버스가 보여요.'],
  ]
  const bad: string[] = []
  for (const [tpl, words, want] of cases) {
    const got = fillTemplate(t(tpl), words.map(w)).ko
    if (got !== want) bad.push(`"${got}" ≠ "${want}"`)
  }
  assert(bad.length === 0, bad.join(' / '))
})

check('단계마다 쓸 수 있는 문장 틀이 있다', () => {
  for (const st of STAGES) {
    assert(templatesFor(st).length >= 3, `단계 ${st}: 문장 틀이 ${templatesFor(st).length}개뿐`)
  }
  console.log(`      문장 틀: 단계0 ${templatesFor(0).length}개 · 단계1 ${templatesFor(1).length}개`)
})

check('두 낱말이 들어가는 틀은 서로 다른 낱말을 넣는다', () => {
  const bad: string[] = []
  for (let i = 0; i < 40; i++) {
    for (const s of makeSentences(1, 8)) {
      if (s.template.slots === 2) {
        const [a, b] = s.fills
        if (a && b && a.en === b.en) bad.push(s.en)
      }
    }
  }
  assert(bad.length === 0, `같은 낱말이 두 번: ${[...new Set(bad)].join(', ')}`)
})

check('모든 낱말에 품사가 있다 (문장 틀이 아무 낱말이나 끼우지 않게)', () => {
  const ok = new Set(['noun', 'adj', 'verb', 'num', 'other'])
  const bad = WORDS.filter((w) => !ok.has(w.pos)).map((w) => `${w.en}:${w.pos}`)
  assert(bad.length === 0, bad.join(', '))
})

// ── 4-3. 생활 표현: 읽기 대상이 아니다 ──────────────────────────────────────
check('생활 표현이 장면마다 4문장 이상 있다', () => {
  for (const sc of SCENES) {
    const n = PHRASES.filter((p) => p.scene === sc.id).length
    assert(n >= 4, `${sc.name}: ${n}문장 (4개 이상 필요)`)
  }
  console.log(`      생활 표현 ${PHRASES.length}문장 / ${SCENES.length}장면`)
})

check('생활 표현에 한국어 뜻이 있고 장면이 올바르다', () => {
  const ids = new Set(SCENES.map((s) => s.id))
  const bad = PHRASES.filter((p) => !p.ko.trim() || !p.en.trim() || !ids.has(p.scene)).map((p) => p.en)
  assert(bad.length === 0, bad.join(', '))
})

check('생활 표현은 읽기 문제에 쓰이지 않는다 (읽기 낱말과 섞이지 않음)', () => {
  // 생활 표현은 통째로 듣고 말하는 것이라 못 읽는 낱말이 들어 있는 게 정상이다.
  // 그것이 **읽기 대상 낱말 목록(WORDS)에 새어 들지 않았는지**만 확인한다.
  const wordSet = new Set(WORDS.map((w) => w.en))
  const leaked = PHRASES.flatMap((p) => p.en.split(' ').map((t) => t.toLowerCase().replace(/[^a-z']/g, '')))
    .filter((t) => t.length > 2 && wordSet.has(t) === false)
  // 여기서 검사하려는 것은 반대 방향이다: PHRASES에만 있는 낱말이 WORDS에 없어야 정상
  assert(leaked.length > 0, '생활 표현이 읽기 낱말만으로 되어 있다 — 생활 표현이 아닐 수 있다')
  console.log(`      생활 표현에만 나오는 낱말 ${new Set(leaked).size}종 (읽기 대상 아님 — 정상)`)
})

// ── 5. 단계 구성: 알파벳 26자와 모음 묶음 ─────────────────────────────────────
check('알파벳 26자가 빠짐없이 있고 대표 낱말이 WORDS에 있다', () => {
  assert(LETTERS.length === 26, `알파벳이 ${LETTERS.length}자`)
  const chars = LETTERS.map((l) => l.ch).join('')
  assert(chars === 'abcdefghijklmnopqrstuvwxyz', `순서/누락: ${chars}`)
  const have = new Set(WORDS.map((w) => w.en))
  const missing = LETTERS.filter((l) => !have.has(l.keyword)).map((l) => `${l.ch}→${l.keyword}`)
  assert(missing.length === 0, `WORDS에 없는 대표 낱말: ${missing.join(', ')}`)
})

check('대표 낱말이 그 글자로 시작한다 (x는 끝소리라 예외)', () => {
  const bad = LETTERS.filter((l) => (l.position === 'final' ? !l.keyword.includes(l.ch) : !l.keyword.startsWith(l.ch))).map(
    (l) => `${l.ch}→${l.keyword}`
  )
  assert(bad.length === 0, bad.join(', '))
})

check('단모음 5개마다 CVC 낱말이 4개 이상 있다 (마을이 비지 않게)', () => {
  const by = cvcByVowel(1)
  const thin = SHORT_VOWELS.map((s) => s.v).filter((v) => by[v].length < 4)
  const detail = SHORT_VOWELS.map((s) => `${s.v}:${by[s.v].length}`).join(' ')
  assert(thin.length === 0, `모음 ${thin.join(', ')}의 낱말이 4개 미만 — ${detail}`)
  console.log(`      모음별 CVC: ${detail} (합계 ${cvcWordsUpTo(1).length})`)
})

check('CVC 판정이 실제 CVC만 통과시킨다', () => {
  for (const w of ['cat', 'bus', 'six', 'fox', 'red']) assert(isCvc(w), `${w}는 CVC여야 한다`)
  for (const w of ['fish', 'sock', 'egg', 'cake', 'apple', 'car', 'boy', 'goat'])
    assert(!isCvc(w), `${w}는 CVC가 아니어야 한다`)
})

// ── 6. sight words ───────────────────────────────────────────────────────────
check('sight word가 CVC 낱말 목록과 겹치지 않는다', () => {
  const cvc = new Set(cvcWordsUpTo(MAX_STAGE).map((w) => w.en))
  const clash = SIGHT_WORDS.filter((s) => cvc.has(s.en)).map((s) => s.en)
  // 파닉스로 읽히는 낱말을 통째로 외우게 할 이유가 없다
  assert(clash.length === 0, `파닉스로 읽을 수 있는데 sight word에도 있다: ${clash.join(', ')}`)
})

check('sight word가 중복되지 않는다', () => {
  const s = SIGHT_WORDS.map((w) => w.en)
  const dup = s.filter((w, i) => s.indexOf(w) !== i)
  assert(dup.length === 0, `중복: ${dup.join(', ')}`)
})

// ── 7. 시험(보스전)을 실제로 만들어 본다 ──────────────────────────────────────
check('모든 단계의 시험이 구성표대로 만들어진다', () => {
  for (const st of STAGES) {
    const spec = examFor(st)
    // 난수를 고정해 같은 시험을 재현한다 (실패했을 때 다시 볼 수 있어야 한다)
    let seed = 12345
    const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const qs = generateExam(st, rng)
    assert(qs.length === spec.total, `단계 ${st}: 문항 ${qs.length} ≠ ${spec.total}`)
    for (const q of qs) {
      assert(q.choices.length === 4, `단계 ${st} ${q.type}: 보기가 ${q.choices.length}개 (4지선다여야 한다)`)
      assert(q.choices.includes(q.answer), `단계 ${st} ${q.type}: 보기에 정답(${q.answer})이 없다`)
      assert(new Set(q.choices).size === 4, `단계 ${st} ${q.type}: 보기에 같은 것이 있다 (${q.choices.join(',')})`)
      assert(q.show !== '' || q.say !== undefined, `단계 ${st} ${q.type}: 보여줄 것도 들려줄 것도 없다`)
      // 읽어서 답하는 문제에만 "그 단계까지 배운 글자" 규칙이 걸린다
      if (q.decode && q.word)
        assert(stageOf(q.word) <= st, `단계 ${st} 시험의 읽기 문제에 단계 ${stageOf(q.word)} 낱말(${q.word})이 나왔다`)
      if (q.decode && q.word) assert(isCvc(q.word), `단계 ${st} 읽기 문제에 CVC가 아닌 낱말(${q.word})이 나왔다`)
    }
    const kinds = new Set(qs.map((q) => q.type))
    for (const p of spec.parts) assert(kinds.has(p.type), `단계 ${st}: ${p.type} 문제가 안 나왔다`)
  }
})

// 한 시험에 같은 문제가 여러 번 나오는 것은 눈으로는 "운이 나빴나" 싶고 넘어가지만
// 실제로는 문항을 매번 독립적으로 뽑았기 때문이다 → 30판을 세어 확인한다.
check('한 시험 안에 똑같은 문제가 없다 (30판)', () => {
  const bad: string[] = []
  for (let i = 0; i < 30; i++) {
    for (const st of STAGES) {
      const qs = generateExam(st)
      const keys = qs.map((q) => `${q.type}|${q.show}|${q.answer}`)
      const dup = keys.filter((k, idx) => keys.indexOf(k) !== idx)
      if (dup.length) bad.push(`단계 ${st}: ${[...new Set(dup)].join(', ')}`)
    }
  }
  assert(bad.length === 0, `${bad.length}판에서 중복 — ${[...new Set(bad)].slice(0, 3).join(' / ')}`)
})

check('한 시험에서 같은 낱말·글자를 두 번 묻지 않는다 (30판)', () => {
  const bad: string[] = []
  for (let i = 0; i < 30; i++) {
    for (const st of STAGES) {
      const qs = generateExam(st)
      // 문제의 '주제' = 그 문제가 다루는 낱말(없으면 정답 글자)
      const subjects = qs.map((q) => q.word ?? q.answer)
      const dup = subjects.filter((x, idx) => subjects.indexOf(x) !== idx)
      if (dup.length) bad.push(`단계 ${st}: ${[...new Set(dup)].join(', ')}`)
    }
  }
  assert(bad.length === 0, `${bad.length}판에서 주제 중복 — ${[...new Set(bad)].slice(0, 3).join(' / ')}`)
})

check('미니게임 한 판에도 같은 문제가 없다 (소리 사냥 30판)', () => {
  const bad: string[] = []
  for (let i = 0; i < 30; i++) {
    for (const [st, types] of [
      [0, ['letter-sound', 'picture-initial']],
      [1, ['word-listen', 'missing-vowel']],
    ] as const) {
      const qs = randomQuestions(st, [...types], 10)
      const keys = qs.map((q) => `${q.type}|${q.show}|${q.answer}`)
      const dup = keys.filter((k, idx) => keys.indexOf(k) !== idx)
      if (dup.length) bad.push(`단계 ${st}: ${[...new Set(dup)].join(', ')}`)
    }
  }
  assert(bad.length === 0, `${bad.length}판에서 중복 — ${[...new Set(bad)].slice(0, 3).join(' / ')}`)
})

check('시험을 여러 번 만들어도 늘 성립한다 (난수 30회)', () => {
  for (let i = 0; i < 30; i++) {
    for (const st of STAGES) {
      const qs = generateExam(st)
      for (const q of qs) {
        assert(q.choices.includes(q.answer), `단계 ${st} ${q.type}: 정답 누락 (${i}회)`)
        assert(new Set(q.choices).size === 4, `단계 ${st} ${q.type}: 보기 중복 (${i}회) ${q.choices.join(',')}`)
      }
    }
  }
})

check('시험 구성표 합계와 합격선(70%)이 맞다', () => {
  for (const e of EXAMS) {
    const sum = e.parts.reduce((s, p) => s + p.count, 0)
    assert(sum === e.total, `${e.title}: ${sum} ≠ ${e.total}`)
    assert(e.pass === Math.ceil(e.total * 0.7), `${e.title}: 합격선 ${e.pass}`)
  }
})

// ── 8. 오답 보기 생성기 ──────────────────────────────────────────────────────
check('오답 보기에 정답이 섞이지 않고, 최소대조쌍을 먼저 고른다', () => {
  const pool = cvcWordsUpTo(1)
  const cat = pool.find((w) => w.en === 'cat')
  if (!cat) throw new Error('cat이 있어야 한다')
  for (let i = 0; i < 50; i++) {
    const cs = choices(cat, pool)
    assert(cs.length === 4, `보기 ${cs.length}개`)
    assert(cs.filter((c) => c.en === 'cat').length === 1, '정답이 중복됐다')
    // cat의 최소대조쌍(bat·mat·hat)이 풀에 3개 이상 있으니 보기는 전부 최소대조쌍이어야 한다
    const wrong = cs.filter((c) => c.en !== 'cat')
    const notMinimal = wrong.filter((c) => !isMinimalPair('cat', c.en)).map((c) => c.en)
    assert(notMinimal.length === 0, `최소대조쌍이 아닌 보기: ${notMinimal.join(', ')}`)
  }
})

check('최소대조쌍 판정이 맞다', () => {
  assert(isMinimalPair('cat', 'bat'), 'cat/bat')
  assert(isMinimalPair('cat', 'cut'), 'cat/cut')
  assert(!isMinimalPair('cat', 'cat'), '같은 낱말')
  assert(!isMinimalPair('cat', 'bus'), 'cat/bus는 두 곳이 다르다')
  assert(!isMinimalPair('cat', 'cats'), '길이가 다르다')
})

// ── 결과 ─────────────────────────────────────────────────────────────────────
console.log(`\n${pass}개 통과, ${fails.length}개 실패`)
if (fails.length) {
  console.log('\n실패 목록:')
  for (const f of fails) console.log(` - ${f}`)
  process.exit(1)
}
