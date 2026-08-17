/**
 * 단계 테스트(보스전) — 급수 시험에 해당한다.
 *
 * 문항 **구성표**만 손으로 정하고(EXAMS), 문제 자체는 낱말 데이터에서 계산해 만든다.
 * 구성표의 합계가 총문항과 어긋나면 앱이 뜨는 순간 터진다(아래 검증) — 조용히 어긋나는 것보다 낫다.
 * 합격선은 70% (한자놀이와 같은 기준).
 */
import { choices as makeChoices, shuffle } from './distract'
import { LETTERS, SHORT_VOWELS } from './data/phonics'
import type { Letter } from './data/types'
import type { StageId, Word } from './data/types'
import { WORDS } from './data/words'
import { cvcWordsUpTo, isCvc, picturableCvcUpTo, picturableUpTo, stageOf, wordsUpTo } from './phonics'

/** 문제 유형 */
export type QuestionType =
  /** 낱말 소리를 듣고 **첫 글자**를 고르기 (그림 없음 — picture-initial보다 어렵다) */
  | 'letter-sound'
  /**
   * 글자 이름을 듣고 그 글자의 **대표 그림**을 고르기.
   *
   * 여기서는 `abstract` 낱말도 쓸 수 있다 — 묻는 것이 "이 그림이 무슨 낱말이냐"가 아니라
   * "z 하면 배운 그림이 무엇이냐"이기 때문이다(z-zoo🦁를 짝으로 가르쳤으므로 🦁가 정답이 된다).
   */
  | 'letter-word'
  /** 낱말 소리를 듣고 낱말(글자) 고르기 */
  | 'word-listen'
  /** 그림을 보고 낱말(스펠링) 고르기 — 읽을 수 있는 낱말만 나온다 */
  | 'word-picture'
  /** 그림을 보고 **첫 글자** 고르기 — 아직 낱말을 못 읽는 알파벳 단계용 */
  | 'picture-initial'
  /** 빠진 모음 채우기 (c_t) */
  | 'missing-vowel'

export interface Question {
  type: QuestionType
  /** 화면에 보여줄 것 (글자·그림 이모지·빈칸 낱말). 소리로만 내는 문제는 빈 문자열 */
  show: string
  /** 소리로 읽어 줄 것 (TTS에 넘긴다). 없으면 소리 없는 문제 */
  say?: string
  /** 정답 */
  answer: string
  /** 4지선다 보기 (정답 포함, 섞여 있다) */
  choices: string[]
  /** 문제를 만든 낱말 (복습 기록용) */
  word?: string
  /**
   * 아이가 **낱말을 소리 내어 읽어야** 답할 수 있는 문제인가.
   *
   * 알파벳 단계의 대표 낱말(apple·umbrella·zoo)은 그림으로 소리를 기억하게 하는 장치일 뿐
   * 해독 대상이 아니다. 이 표시가 있는 문제에만 "그 단계까지 배운 글자" 규칙이 적용된다.
   */
  decode?: boolean
}

export interface ExamSpec {
  stage: StageId
  title: string
  /** 유형별 문항 수 */
  parts: { type: QuestionType; count: number }[]
  /** 총 문항 */
  total: number
  /** 합격 문항 수 */
  pass: number
}

/** 단계별 출제 구성표 — **밸런싱으로 건드리지 않는다**. 합격선은 전 단계 70% */
export const EXAMS: ExamSpec[] = [
  {
    stage: 0,
    title: '알파벳 마을 시험',
    parts: [
      { type: 'letter-sound', count: 8 },
      { type: 'letter-word', count: 6 },
      { type: 'picture-initial', count: 6 },
    ],
    total: 20,
    pass: 14,
  },
  {
    stage: 1,
    title: '단모음 마을 시험',
    parts: [
      { type: 'word-listen', count: 8 },
      { type: 'word-picture', count: 7 },
      { type: 'missing-vowel', count: 5 },
    ],
    total: 20,
    pass: 14,
  },
]

// 구성표가 스스로 어긋나 있으면 즉시 알린다 (한자놀이와 같은 방식)
for (const e of EXAMS) {
  const sum = e.parts.reduce((s, p) => s + p.count, 0)
  if (sum !== e.total) throw new Error(`${e.title}: 유형 합계 ${sum} ≠ 총문항 ${e.total}`)
  if (e.pass !== Math.ceil(e.total * 0.7)) throw new Error(`${e.title}: 합격선이 70%가 아니다 (${e.pass}/${e.total})`)
}

export function examFor(stage: StageId): ExamSpec {
  const e = EXAMS.find((x) => x.stage === stage)
  if (!e) throw new Error(`단계 ${stage} 시험 구성표가 없다`)
  return e
}

/** 첫소리 문제에 쓸 수 없는 글자(x)는 뺀다 */
const INITIAL_LETTERS = LETTERS.filter((l) => l.position !== 'final')

const byWord = new Map(WORDS.map((w) => [w.en, w]))
/** 알파벳 26자의 대표 낱말 — 아이에게 "글자↔그림" 짝으로 가르친 것들 */
const KEYWORDS: Word[] = LETTERS.map((l) => byWord.get(l.keyword)).filter((w): w is Word => !!w)

/**
 * 시험 문제를 만든다. rng를 밖에서 받는 것은 테스트가 같은 시험을 재현할 수 있어야 하기 때문.
 */
export function generateExam(stage: StageId, rng: () => number = Math.random): Question[] {
  const spec = examFor(stage)
  const pools = poolsFor(stage)
  // 장부는 시험 하나당 하나 — 유형이 달라도 같은 낱말이 또 나오지 않게 유형 사이에서도 공유한다
  const ledger = newLedger()
  const qs: Question[] = []

  for (const part of spec.parts) {
    for (let i = 0; i < part.count; i++) {
      qs.push(makeQuestion(part.type, pools, rng, undefined, ledger))
    }
  }
  return shuffle(qs, rng)
}

/**
 * 문제를 만들 때 쓰는 낱말 묶음.
 *
 * `pics`/`picCvc`는 **그림으로 알아볼 수 있는 낱말만** 담는다 — 그림이 곧 문제인 유형은
 * 반드시 이쪽을 써야 한다(🐘를 보여주고 big을 고르라는 문제가 나오지 않게).
 */
interface Pools {
  pool: Word[]
  cvc: Word[]
  pics: Word[]
  picCvc: Word[]
}

function poolsFor(stage: StageId): Pools {
  return {
    pool: wordsUpTo(stage),
    cvc: cvcWordsUpTo(stage),
    pics: picturableUpTo(stage),
    picCvc: picturableCvcUpTo(stage),
  }
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  const v = arr[Math.floor(rng() * arr.length)]
  if (v === undefined) throw new Error('문제를 만들 낱말이 없다')
  return v
}

/**
 * **한 시험 안에서 같은 것이 다시 나오지 않게** 하는 장부.
 *
 * 문항을 매번 따로 뽑으면 20문항짜리 시험에 같은 낱말이 세 번 나오고, letter-word는
 * 정답이 대표 낱말로 고정돼 있어 글자가 겹치는 순간 **완전히 같은 문제**가 두 번 나온다.
 * 그래서 이미 쓴 낱말·글자를 적어 두고 안 쓴 것부터 뽑는다.
 * 풀이 문항 수보다 작으면(모음별 낱말이 모자란 단계) 어쩔 수 없이 다시 쓰되, 그때도 덜 쓴 것부터 쓴다.
 */
interface Ledger {
  words: Set<string>
  letters: Set<string>
}

function newLedger(): Ledger {
  return { words: new Set(), letters: new Set() }
}

/** 아직 안 쓴 것 중에서 뽑는다. 다 썼으면 장부를 비우고 다시 시작한다(한 바퀴 돌린다) */
function pickFresh<T>(items: readonly T[], keyOf: (t: T) => string, used: Set<string>, rng: () => number): T {
  if (items.length === 0) throw new Error('문제를 만들 낱말이 없다')
  const fresh = items.filter((i) => !used.has(keyOf(i)))
  if (fresh.length === 0) {
    // 풀을 한 바퀴 다 썼다 — 비우고 처음부터(그래야 두 바퀴째도 고르게 나온다)
    used.clear()
    return pickFresh(items, keyOf, used, rng)
  }
  const chosen = pick(fresh, rng)
  used.add(keyOf(chosen))
  return chosen
}

/**
 * 유형을 정해 문제를 여러 개 만든다 — 미니게임(소리 사냥)이 쓴다.
 * 유형을 돌려 가며 만들어서 같은 유형이 몰리지 않게 한다.
 */
export function randomQuestions(
  stage: StageId,
  types: QuestionType[],
  count: number,
  rng: () => number = Math.random
): Question[] {
  const pools = poolsFor(stage)
  // 미니게임도 한 판 안에서는 겹치지 않게 한다 (10문제에 같은 낱말이 세 번 나오면 재미가 없다)
  const ledger = newLedger()
  return Array.from({ length: count }, (_, k) =>
    makeQuestion(types[k % types.length] as QuestionType, pools, rng, undefined, ledger)
  )
}

/**
 * 오늘의 놀이(연습)용 문제 — **낱말을 지정해서** 만든다.
 *
 * 시험은 무작위로 뽑지만 연습은 SRS가 고른 낱말을 내야 한다(복습 기한이 지난 것부터).
 * 낼 수 있는 유형은 낱말이 정한다: CVC가 아니면 읽기 문제를 낼 수 없으므로 첫소리 문제로 간다.
 */
export function practiceQuestion(word: Word, stage: StageId, nth = 0, rng: () => number = Math.random): Question {
  const readable = isCvc(word.en) && stageOf(word.en) <= stage
  // 그림으로 물을 수 없는 낱말(🐘=big, 🦁=zoo)은 그림 문제에서 빼고 소리로 묻는다.
  // 읽을 수 없는 낱말(apple·zoo)은 첫소리만 물을 수 있는데, 그림으로 알아볼 수 있으면
  // 그림→첫글자로, 아니면 듣고→첫글자로 낸다.
  const types: QuestionType[] = readable
    ? word.abstract
      ? ['word-listen', 'missing-vowel']
      : ['word-picture', 'word-listen', 'missing-vowel']
    : word.abstract
      ? ['letter-sound']
      : ['picture-initial']
  const type = types[nth % types.length] as QuestionType
  return makeQuestion(type, poolsFor(stage), rng, word)
}

function makeQuestion(
  type: QuestionType,
  pools: Pools,
  rng: () => number,
  target?: Word,
  /** 없으면 겹침을 따지지 않는다 (연습 문제는 한 번에 하나만 만든다) */
  ledger: Ledger = newLedger()
): Question {
  const { cvc, pics, picCvc } = pools
  /**
   * 낱말 하나를 뽑고 **그 낱말의 첫 글자도 썼다고 적는다.**
   * 글자와 낱말을 따로 세면 "ball을 듣고 b 고르기"와 "🎾ball의 첫 글자 고르기"가 같은 시험에 나온다.
   */
  const takeWord = (items: readonly Word[]): Word => {
    const w = pickFresh(items, (x) => x.en, ledger.words, rng)
    ledger.letters.add(w.en[0] as string)
    return w
  }
  /** 글자 하나를 뽑고 **그 글자의 대표 낱말도 썼다고 적는다** (같은 이유) */
  const takeLetter = (items: readonly Letter[]): Letter => {
    const l = pickFresh(items, (x) => x.ch, ledger.letters, rng)
    ledger.words.add(l.keyword)
    return l
  }
  switch (type) {
    case 'letter-sound': {
      // TTS에 글자 하나를 주면 **소리가 아니라 글자 이름**을 읽는다("d" → "디").
      // 그래서 소리 문제는 대표 낱말을 들려주고 첫 글자를 묻는다 — 그림이 없어 picture-initial보다 어렵다.
      // 첫소리로 쓰이지 않는 글자(x)는 여기서 뺀다: box를 들려주고 답이 x일 수는 없다.
      const l = target
        ? (INITIAL_LETTERS.find((x) => x.ch === target.en[0]) ?? takeLetter(INITIAL_LETTERS))
        : takeLetter(INITIAL_LETTERS)
      const others = shuffle(
        INITIAL_LETTERS.filter((x) => x.ch !== l.ch),
        rng
      ).slice(0, 3)
      return {
        type,
        show: '',
        say: l.keyword,
        answer: l.ch,
        choices: shuffle([l.ch, ...others.map((x) => x.ch)], rng),
        word: l.keyword,
      }
    }
    case 'letter-word': {
      const l = target
        ? (INITIAL_LETTERS.find((x) => x.ch === target.en[0]) ?? takeLetter(INITIAL_LETTERS))
        : takeLetter(INITIAL_LETTERS)
      // 정답은 **그 글자의 대표 낱말**이다. 아무 낱말이나 쓰면 아이가 배운 짝(b-ball)과 어긋나고,
      // 🐘(big)처럼 그림으로 알아볼 수 없는 낱말이 정답이 되어 버린다.
      // 반대로 🦁(zoo)처럼 그림만으로는 알 수 없는 낱말도 **대표 낱말로 가르친 것**이라 여기서는 정답이 된다.
      const right = byWord.get(l.keyword)
      if (!right) throw new Error(`${l.ch}의 대표 낱말 ${l.keyword}이 WORDS에 없다`)
      const wrong = shuffle(
        KEYWORDS.filter((w) => !w.en.startsWith(l.ch)),
        rng
      ).slice(0, 3)
      return {
        type,
        show: l.ch,
        // 글자 이름을 읽어 준다. 대표 낱말을 읽으면 정답을 알려 주는 셈이 된다.
        say: l.ch,
        answer: right.en,
        choices: shuffle([right.en, ...wrong.map((w) => w.en)], rng),
        word: right.en,
      }
    }
    case 'word-listen': {
      const w = target ?? takeWord(cvc)
      return {
        type,
        show: '',
        say: w.en,
        answer: w.en,
        choices: makeChoices(w, cvc, rng).map((c) => c.en),
        word: w.en,
        decode: true,
      }
    }
    case 'word-picture': {
      // 그림을 보고 스펠링을 고르는 문제는 **읽을 수 있는 낱말**에서만 낸다.
      // pool 전체에서 뽑으면 umbrella·orange처럼 아직 못 읽는 낱말이 정답으로 나온다.
      // 그림이 곧 문제이므로 🐘(big)처럼 그림으로 알 수 없는 낱말도 뺀다.
      const w = target ?? takeWord(picCvc)
      return {
        type,
        show: w.emoji,
        answer: w.en,
        choices: makeChoices(w, cvc, rng).map((c) => c.en),
        word: w.en,
        decode: true,
      }
    }
    case 'picture-initial': {
      // 첫소리를 묻는 문제라 낱말을 읽을 필요가 없다 → 알파벳 단계의 대표 낱말을 그대로 쓴다
      // 그림을 보고 첫 글자를 묻는 문제 → 그림으로 알아볼 수 있는 낱말만
      const usable = pics.filter((w) => /^[a-z]/.test(w.en))
      const w = target ?? takeWord(usable)
      const first = w.en[0] as string
      const wrong = shuffle(
        LETTERS.filter((l) => l.ch !== first && l.position !== 'final'),
        rng
      ).slice(0, 3)
      return {
        type,
        show: w.emoji,
        say: w.en,
        answer: first,
        choices: shuffle([first, ...wrong.map((l) => l.ch)], rng),
        word: w.en,
      }
    }
    case 'missing-vowel': {
      const w = target ?? takeWord(cvc)
      const v = w.en[1] as string
      return {
        type,
        show: `${w.en[0]}_${w.en[2]}`,
        say: w.en,
        answer: v,
        choices: shuffle(
          [v, ...shuffle(SHORT_VOWELS.map((s) => s.v).filter((x) => x !== v), rng).slice(0, 3)],
          rng
        ),
        word: w.en,
        decode: true,
      }
    }
  }
}
