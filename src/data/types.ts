/** 데이터 정본의 타입. 손으로 넣는 것은 여기 정의된 것뿐이고, 나머지는 계산해서 만든다. */

/**
 * 파닉스 단계 — 급수 사다리에 해당한다. 0부터 시작해 순서대로 열린다.
 *
 * 0~6까지 미리 선언해 둔 것은 **아직 안 만든 단계의 그래핌(ck·sh·매직e…)도 표에 있어야
 * "단계 침범" 검사가 성립하기 때문**이다. sock의 `ck`가 단계 2라는 사실을 표가 알고 있어야
 * 단계 1 낱말에 sock이 섞여 든 것을 테스트가 잡아낸다.
 */
export type StageId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** 지금 만들어 둔 마지막 단계 — 마을 10개 (알파벳 → 예외 낱말) */
export const MAX_STAGE: StageId = 9

/** 단모음 5개 — 단계 1의 하위 묶음 */
export type ShortVowel = 'a' | 'e' | 'i' | 'o' | 'u'

/**
 * 낱말의 출처. **테스트가 이 값으로 검사 강도를 바꾼다.**
 *
 * - `starters`: Cambridge Pre A1 Starters A–Z 목록에 있는 낱말 (기본값이어야 한다)
 * - `number`: 숫자 낱말. A–Z 목록에는 없지만 공식 "Letters & numbers" 항목이
 *   숫자 1~20을 출제 범위로 명시한다 (starters.json의 lettersAndNumbersInScope)
 * - `phonics`: Starters 밖이지만 파닉스 진행에 반드시 필요한 낱말.
 *   `PHONICS_EXTRA`에 이유를 적어 등록해야 하고, 단계 안에서 비율 상한이 걸린다.
 */
export type WordSource = 'starters' | 'number' | 'phonics'

export interface Word {
  /** 영어 스펠링 (소문자) */
  en: string
  /** 한국어 뜻 */
  ko: string
  /** 그림 — 이모지 하나. 그림이 필요 없는 기능어는 sight word 쪽에 둔다 */
  emoji: string
  /** 이 낱말이 처음 나오는 단계 (MAX_STAGE까지) */
  stage: StageId
  source: WordSource
  /**
   * 품사 — **문장 틀에 끼울 수 있는지**를 가른다.
   *
   * 이게 없으면 `I see a ___.`에 red·sad가 들어가 "I see a red"가 된다.
   * 문장 놀이가 쓰는 것은 `noun`뿐이고, 나머지는 낱말 놀이에서만 쓴다.
   */
  pos: 'noun' | 'adj' | 'verb' | 'num' | 'other'
  /**
   * 복수형인가 (men·chips…). `a ___` 자리에 들어가면 안 된다 —
   * "I see a men"이 되어 버린다.
   */
  plural?: true
  /**
   * **그림만 보고는 이 낱말이라고 알 수 없다**는 표시.
   *
   * 🐘를 보면 아이는 elephant를 떠올리고 big을 떠올리지 않는다. 🔥는 불이고 뜨거움이 아니며,
   * 🪑는 의자이고 앉기가 아니다. 이런 낱말에 그림 문제를 내면 **정답을 알 방법이 없는 문제**가 된다.
   *
   * 표시된 낱말은 그림으로 묻는 문제(그림→낱말·그림→첫글자·짝맞추기·사천성)에서 빠지고,
   * 소리로 묻는 문제(듣고 고르기·빈칸 모음)에는 그대로 나온다 — 낱말 자체를 버리는 게 아니다.
   * 도감에서도 그림과 함께 보이므로 뜻을 익히는 데는 문제가 없다.
   */
  abstract?: true
}

/** 알파벳 한 글자 = 단계 0의 학습 단위 */
export interface Letter {
  /** 소문자 */
  ch: string
  /** 글자 이름 (에이·비…) — 아이에게 읽어 줄 한국어 표기 */
  name: string
  /** 대표 소리의 한국어 근사 표기 */
  sound: string
  /** 그 소리로 시작하는 대표 낱말 (WORDS 안에 있어야 한다) */
  keyword: string
  /**
   * 대표 낱말에서 이 글자가 놓인 자리.
   * x처럼 낱말 첫소리로 거의 안 쓰이는 글자는 'final'이라고 적어 둔다 —
   * 게임이 "첫소리 찾기" 문제를 만들 때 이 글자를 빼야 한다.
   */
  position?: 'initial' | 'final'
}

/** 그래핌(글자↔소리 대응) — 단계별로 무엇을 배웠는지가 낱말 검사의 기준이 된다 */
export interface Grapheme {
  /** 글자 조각 (c, sh, a_e …) */
  g: string
  /** 소리의 한국어 근사 */
  sound: string
  /** 이 그래핌을 배우는 단계 */
  stage: StageId
}

/** 파닉스로는 읽을 수 없어 통째로 익히는 고빈도 낱말 */
export interface SightWord {
  en: string
  ko: string
  /** Dolch 목록 구분 */
  dolch: 'pre-primer' | 'primer'
  source: WordSource
}
