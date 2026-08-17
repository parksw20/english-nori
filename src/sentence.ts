/**
 * 문장 만들기 계산 — 문장을 손으로 적지 않고 **틀 + 낱말**로 만든다.
 *
 * 손으로 다 적으면 낱말이 늘 때마다 문장을 다시 써야 하고, 그때 아이가 못 읽는 낱말이 섞여 든다.
 * 틀에서 만들면 **빈칸에 들어갈 낱말을 규칙으로 걸러낼 수 있다**: 그림으로 알아볼 수 있는 단수 명사,
 * 그 단계까지 배운 글자로만 된 것.
 */
import { PHRASES, SCENES, TEMPLATES, type Phrase, type SceneId, type SentenceTemplate } from './data/sentences'
import type { StageId, Word } from './data/types'
import { SIGHT_WORDS } from './data/words'
import { cvcWordsUpTo, picturableCvcUpTo } from './phonics'
import { shuffle } from './rand'

export interface Sentence {
  /** 읽을 문장 */
  en: string
  /** 한국어 뜻 */
  ko: string
  /** 문장을 이루는 낱말들 (어순 맞추기가 이걸 섞어 낸다) */
  words: string[]
  /** 빈칸에 들어간 낱말들 — 첫 번째가 그림 문제의 정답이 된다 */
  fills: Word[]
  template: SentenceTemplate
}

/**
 * 문장 틀에 넣을 수 있는 낱말.
 *
 * 명사만, 복수형 제외(a ___ 자리), 그림으로 알아볼 수 있는 것만(듣고 그림 고르기를 하려면 필요하다).
 */
export function fillableWords(stage: StageId): Word[] {
  return picturableCvcUpTo(stage).filter((w) => w.pos === 'noun' && !w.plural)
}

/** 문장을 이루는 낱말로 쪼갠다 (문장부호는 낱말에 붙여 둔다 — 어순 맞추기에서 붙어 나와야 자연스럽다) */
export function splitWords(sentence: string): string[] {
  return sentence.split(' ').filter(Boolean)
}

/**
 * 한국어 낱말에 **받침이 있는가.**
 *
 * 조사는 받침에 따라 달라진다(버스**는** / 승합차**를**). 앞서 낱말 요격에서 조사를 붙였다가
 * "가방 였어"가 나와 기호로 피했는데, 문장 뜻은 조사 없이 쓸 수 없어서 판정 함수를 둔다.
 * 한글 음절은 유니코드에서 (코드-0xAC00) % 28 == 0 이면 받침이 없다.
 */
export function hasFinalConsonant(korean: string): boolean {
  const last = korean.trim().at(-1)
  if (!last) return false
  const code = last.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return false // 한글 음절이 아니면(숫자·기호) 받침 없는 쪽으로
  return (code - 0xac00) % 28 !== 0
}

/**
 * 한국어 틀의 낱말 자리를 채운다. 자리 표기는 `%k{받침있을때/없을때}` —
 * 예: `나는 %k{을/를} 봐요.` → 버스면 "버스를", 십이면 "십을".
 */
function fillKo(template: string, words: string[]): string {
  let i = 0
  return template.replace(/%k(?:\{([^}]*)\})?/g, (_m, pair?: string) => {
    const w = words[i++] ?? ''
    if (!pair) return w
    const [withFinal = '', without = ''] = pair.split('/')
    return w + (hasFinalConsonant(w) ? withFinal : without)
  })
}

/** 틀 하나에 낱말을 끼워 문장을 만든다 */
export function fillTemplate(t: SentenceTemplate, picks: Word[]): Sentence {
  let en = t.en
  for (const w of picks) en = en.replace('%n', w.en)
  const ko = fillKo(t.ko, picks.map((w) => w.ko))
  return { en, ko, words: splitWords(en), fills: picks, template: t }
}

/**
 * 읽을 문장 n개를 만든다. 같은 틀·같은 낱말이 한 판에서 겹치지 않게 돌려 쓴다.
 */
export function templatesFor(stage: StageId): SentenceTemplate[] {
  // 틀 안의 고정 낱말도 읽을 수 있어야 한다 → 단계가 모자란 틀은 쓰지 않는다
  return TEMPLATES.filter((t) => (t.minStage ?? 0) <= stage)
}

export function makeSentences(stage: StageId, n: number, rng: () => number = Math.random): Sentence[] {
  const pool = fillableWords(stage)
  if (pool.length < 2) return []
  const templates = shuffle(templatesFor(stage), rng)
  if (templates.length === 0) return []
  const out: Sentence[] = []
  const usedWords = new Set<string>()

  const take = (): Word => {
    const fresh = pool.filter((w) => !usedWords.has(w.en))
    const from = fresh.length > 0 ? fresh : pool
    const w = from[Math.floor(rng() * from.length)] as Word
    usedWords.add(w.en)
    return w
  }

  for (let i = 0; i < n; i++) {
    const t = templates[i % templates.length] as SentenceTemplate
    const picks: Word[] = [take()]
    if (t.slots === 2) {
      // 두 자리는 서로 다른 낱말이어야 한다 ("A cat is not a cat"은 문장이 안 된다)
      let second = take()
      let guard = 0
      while (second.en === picks[0]?.en && guard++ < 20) second = take()
      picks.push(second)
    }
    out.push(fillTemplate(t, picks))
  }
  return out
}

/**
 * 아이가 이 문장을 **스스로 읽을 수 있는가** — 문장에 쓰인 모든 낱말이
 * (그 단계까지 배운 CVC 낱말 ∪ sight words)에 있는지 본다.
 * 문장부호와 대소문자는 무시한다.
 */
export function readableWords(stage: StageId): Set<string> {
  const set = new Set<string>()
  // **읽을 수 있는가와 그림으로 물을 수 있는가는 다른 문제다.**
  // big은 CVC라 읽을 수 있지만 🐘로는 알아볼 수 없다(abstract) → 문장에는 써도 되고 그림 문제에는 못 쓴다.
  // 여기서는 읽기만 따지므로 abstract를 걸러내지 않는다(처음에 picturable을 써서 "The cat is big."이 실패했다).
  for (const w of cvcWordsUpTo(stage)) set.add(w.en)
  for (const s of SIGHT_WORDS) set.add(s.en)
  return set
}

export function bareWord(token: string): string {
  return token.toLowerCase().replace(/[^a-z']/g, '')
}

/** 문장에서 읽을 수 없는 낱말들 (없으면 빈 배열) */
export function unreadableIn(sentence: string, stage: StageId, extra: Set<string> = new Set()): string[] {
  const ok = readableWords(stage)
  return splitWords(sentence)
    .map(bareWord)
    .filter((w) => w.length > 0 && !ok.has(w) && !extra.has(w))
}

// ── 생활 표현 ─────────────────────────────────────────────────────────────

export { PHRASES, SCENES }
export type { Phrase, SceneId }

export function phrasesOf(scene: SceneId): Phrase[] {
  return PHRASES.filter((p) => p.scene === scene)
}

/** 한 판에 낼 표현 — 장면 안에서 섞어 뽑는다 */
export function pickPhrases(scene: SceneId, n: number, rng: () => number = Math.random): Phrase[] {
  return shuffle(phrasesOf(scene), rng).slice(0, n)
}
