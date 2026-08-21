/**
 * 파닉스 계산 — **손으로 적지 않는 것들**은 전부 여기서 만든다.
 *
 * 낱말을 그래핌으로 쪼개고(segment), 그 낱말이 어느 단계에서 읽을 수 있는지 판정하고(stageOf),
 * CVC인지와 어느 단모음 묶음인지를 계산한다. 데이터에 모음 묶음을 손으로 적지 않는 이유는
 * 적으면 스펠링과 어긋날 수 있기 때문이다 — 계산하면 어긋날 수 없다.
 */
import { GRAPHEMES } from './data/phonics'
import type { ShortVowel, StageId, Word } from './data/types'
import { WORDS } from './data/words'

const SHORT_VOWELS: readonly ShortVowel[] = ['a', 'e', 'i', 'o', 'u']

/** 여러 글자 그래핌이 먼저 잡혀야 한다 (sock → s·o·ck, 아니면 s·o·c·k가 된다) */
const BY_LENGTH = [...GRAPHEMES]
  .filter((g) => !g.g.includes('_')) // 마법의 e(a_e)는 이어진 글자가 아니라 떨어져 있다 — 따로 다룬다
  .sort((a, b) => b.g.length - a.g.length)

const STAGE_OF_GRAPHEME = new Map(GRAPHEMES.map((g) => [g.g, g.stage]))

/**
 * 낱말을 그래핌으로 쪼갠다. 가장 긴 것부터 맞춰 나가는 단순한 방식(greedy).
 * 표에 없는 글자가 나오면 null — 그런 낱말은 아직 어느 단계에도 넣을 수 없다는 뜻이다.
 */
export function segment(word: string): string[] | null {
  const w = word.toLowerCase()
  if (!/^[a-z]+$/.test(w)) return null // 'ice cream'처럼 띄어쓰기가 있는 표제어는 대상이 아니다
  const out: string[] = []
  let i = 0
  while (i < w.length) {
    // **마법의 e를 먼저 본다.** 이걸 안 보면 snake가 s·n·a·k·e로 쪼개져 단계 2 낱말이 돼 버린다 —
    // 단모음만 배운 아이는 그 낱말을 "스나크-에"로 읽는다. 낱말 끝의 [모음][자음 하나]e만 이 규칙이다
    const magic = magicE(w, i)
    if (magic) {
      out.push(magic)
      i += 3
      continue
    }
    const hit = BY_LENGTH.find((g) => w.startsWith(g.g, i))
    if (!hit) return null
    out.push(hit.g)
    i += hit.g.length
  }
  return out
}

/**
 * 낱말 **끝**의 `[모음][자음 하나]e`를 split digraph로 본다 (cake의 `a_e`).
 *
 * 끝에서만 보는 이유: 가운데의 e는 소리가 나는 일이 많고(seven·open), 규칙을 넓게 잡으면
 * 멀쩡한 단모음 낱말까지 단계 4로 밀려나 단계 1에서 낼 문제가 사라진다.
 */
function magicE(w: string, i: number): string | null {
  if (i + 3 !== w.length) return null
  const [v, c, e] = [w[i], w[i + 1], w[i + 2]]
  if (e !== 'e' || !v || !c) return null
  if (!SHORT_VOWELS.includes(v as ShortVowel)) return null
  // 자음 한 글자여야 한다. w·x·y는 앞 모음과 한 덩어리로 소리 나고(saw·boy),
  // r은 앞 모음을 삼켜 버린다(here·store·more) — 그건 마법의 e가 아니라 r모음(단계 6)이다
  if (SHORT_VOWELS.includes(c as ShortVowel) || 'wxyr'.includes(c)) return null
  return `${v}_e`
}

/**
 * 이 낱말을 소리 내어 읽으려면 몇 단계까지 배웠어야 하는가.
 * 쪼갤 수 없으면 Infinity — 어느 단계에도 못 넣는다.
 */
export function stageOf(word: string): number {
  const segs = segment(word)
  if (!segs) return Infinity
  return segs.reduce((max, s) => Math.max(max, STAGE_OF_GRAPHEME.get(s) ?? Infinity), 0)
}

/** 낱말이 그 단계까지 배운 글자만으로 이루어져 있는가 (단계 침범 검사의 핵심) */
export function readableAt(word: string, stage: StageId): boolean {
  return stageOf(word) <= stage
}

/** 자음-단모음-자음 3소리인가. 단계 1의 출제 대상은 이걸로 고른다 */
export function isCvc(word: string): boolean {
  const segs = segment(word)
  if (!segs || segs.length !== 3) return false
  const [a, b, c] = segs as [string, string, string]
  if (a.length !== 1 || b.length !== 1 || c.length !== 1) return false
  if (!SHORT_VOWELS.includes(b as ShortVowel)) return false
  if (SHORT_VOWELS.includes(a as ShortVowel) || SHORT_VOWELS.includes(c as ShortVowel)) return false
  // 끝의 r·w·y는 앞 모음의 소리를 바꾼다(car·saw·boy) — 단모음 연습에는 쓰지 않는다
  return !'rwy'.includes(c)
}

/** CVC 낱말의 모음. CVC가 아니면 null */
export function shortVowelOf(word: string): ShortVowel | null {
  if (!isCvc(word)) return null
  return (word[1] as ShortVowel) ?? null
}

/** 그 단계까지 나온 낱말 전부 (누계) */
export function wordsUpTo(stage: StageId): Word[] {
  return WORDS.filter((w) => w.stage <= stage)
}

/**
 * 단계 1(단모음 CVC) 게임에 낼 낱말.
 *
 * 단계 0에서 이미 나온 cat·hat·box 같은 CVC도 여기 함께 들어온다 —
 * 데이터에 중복해 적지 않고 스펠링에서 계산하기 때문이다.
 */
export function cvcWordsUpTo(stage: StageId): Word[] {
  return wordsUpTo(stage).filter((w) => isCvc(w.en))
}

/**
 * **그림으로 물어도 되는 낱말**만 남긴다.
 *
 * 그림→낱말, 그림→첫글자, 짝맞추기, 사천성처럼 **그림이 곧 문제**인 곳은 이 풀을 써야 한다.
 * 안 그러면 🐘를 보여주고 big을 고르라는, 답을 알 방법이 없는 문제가 나온다.
 */
export function picturableUpTo(stage: StageId): Word[] {
  return wordsUpTo(stage).filter((w) => !w.abstract)
}

/** 그림으로 물어도 되는 CVC 낱말 (단계 1의 그림 문제·게임용) */
export function picturableCvcUpTo(stage: StageId): Word[] {
  return cvcWordsUpTo(stage).filter((w) => !w.abstract)
}

/** 모음별로 묶은 CVC 낱말 — "a 마을 / e 마을"처럼 화면에 나눠 보여줄 때 쓴다 */
export function cvcByVowel(stage: StageId): Record<ShortVowel, Word[]> {
  const out = { a: [], e: [], i: [], o: [], u: [] } as Record<ShortVowel, Word[]>
  for (const w of cvcWordsUpTo(stage)) {
    const v = shortVowelOf(w.en)
    if (v) out[v].push(w)
  }
  return out
}
