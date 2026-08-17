/**
 * 낱말 정본 — **손으로 넣는 데이터**. 여기 있는 것만 손으로 쓰고,
 * 그래핌 분해·CVC 판정·문제 보기·오답 후보는 전부 계산해서 만든다(phonics.ts, distract.ts).
 *
 * 어휘 기준: Cambridge English **Pre A1 Starters** A–Z 목록 (src/data/starters.json).
 * 그 목록 밖의 낱말은 `source: 'phonics'`로 표시하고 아래 PHONICS_EXTRA에 이유를 남긴다 —
 * 테스트가 이유 없는 이탈과 비율 초과를 잡는다.
 */
import type { SightWord, Word } from './types'

/**
 * Starters 목록 밖인데 넣은 낱말과 그 이유.
 *
 * 파닉스는 소리를 빠짐없이 훑어야 하는데 Starters 목록에는 q·u·v로 시작하는 아이용 낱말이 없고,
 * 단모음 o의 CVC 낱말이 box·dog 둘뿐이다. 그대로 두면 "o 마을"에 낱말이 두 개인 마을이 된다.
 * 그래서 **모든 파닉스 교재가 쓰는 고전 낱말만** 최소한으로 보탠다.
 */
export const PHONICS_EXTRA: Record<string, string> = {
  queen: 'Starters에 q로 시작하는 낱말이 없다 — 알파벳 q의 대표 낱말',
  umbrella: 'Starters에 u로 시작하는 아이용 낱말이 없다 — 알파벳 u의 대표 낱말',
  van: 'Starters에 v로 시작하는 낱말이 없다 — 알파벳 v의 대표 낱말',
  pig: '단모음 i의 CVC 낱말 보강 (Starters에는 Movers부터 나온다)',
  hot: '단모음 o의 CVC 낱말이 box·dog뿐 — 소리 연습량 확보',
  pot: '단모음 o의 CVC 낱말이 box·dog뿐 — 소리 연습량 확보',
  fox: '단모음 o와 끝소리 x를 같이 연습할 수 있는 유일한 낱말',
}

/**
 * 단계 0 — 알파벳 26자의 대표 낱말.
 * LETTERS의 keyword가 전부 여기 있어야 한다(테스트가 확인한다).
 */
const STAGE0: Word[] = [
  { en: 'apple', ko: '사과', emoji: '🍎', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'ball', ko: '공', emoji: '⚽', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'cat', ko: '고양이', emoji: '🐱', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'dog', ko: '개', emoji: '🐶', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'egg', ko: '달걀', emoji: '🥚', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'fish', ko: '물고기', emoji: '🐟', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'goat', ko: '염소', emoji: '🐐', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'hat', ko: '모자', emoji: '🎩', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'ice cream', ko: '아이스크림', emoji: '🍦', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'jacket', ko: '재킷', emoji: '🧥', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'kite', ko: '연', emoji: '🪁', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'lamp', ko: '램프', emoji: '💡', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'monkey', ko: '원숭이', emoji: '🐵', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'nose', ko: '코', emoji: '👃', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'orange', ko: '오렌지', emoji: '🍊', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'pen', ko: '펜', emoji: '🖊️', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'queen', ko: '여왕', emoji: '👸', stage: 0, source: 'phonics', pos: 'noun' },
  { en: 'red', ko: '빨강', emoji: '🟥', stage: 0, source: 'starters', pos: 'adj' },
  { en: 'sun', ko: '해', emoji: '☀️', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'tiger', ko: '호랑이', emoji: '🐯', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'umbrella', ko: '우산', emoji: '☂️', stage: 0, source: 'phonics', pos: 'noun' },
  { en: 'van', ko: '승합차', emoji: '🚐', stage: 0, source: 'phonics', pos: 'noun' },
  { en: 'water', ko: '물', emoji: '💧', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'box', ko: '상자', emoji: '📦', stage: 0, source: 'starters', pos: 'noun' },
  { en: 'yellow', ko: '노랑', emoji: '🟨', stage: 0, source: 'starters', pos: 'adj' },
  { en: 'zoo', ko: '동물원', emoji: '🦁', stage: 0, source: 'starters', pos: 'noun', abstract: true }, // 🦁는 사자다
]

/**
 * 단계 1 — 단모음 CVC 낱말.
 *
 * 단계 0에서 이미 나온 CVC(cat·hat·pen·red·box·dog·sun)는 여기 다시 적지 않는다 —
 * 어느 모음 묶음에 들어가는지는 스펠링에서 계산하므로(phonics.ts) 단계 1 게임에서 자동으로 함께 나온다.
 */
const STAGE1: Word[] = [
  // a
  { en: 'bag', ko: '가방', emoji: '🎒', stage: 1, source: 'starters', pos: 'noun' },
  { en: 'bat', ko: '방망이', emoji: '🏏', stage: 1, source: 'starters', pos: 'noun' },
  { en: 'dad', ko: '아빠', emoji: '👨', stage: 1, source: 'starters', pos: 'noun' },
  { en: 'man', ko: '남자', emoji: '🧑', stage: 1, source: 'starters', pos: 'noun', abstract: true }, // 🧑는 '사람' — dad👨와 구별이 안 된다
  { en: 'mat', ko: '매트', emoji: '🟫', stage: 1, source: 'starters', pos: 'noun', abstract: true }, // 갈색 사각형은 아무 뜻도 아니다
  { en: 'sad', ko: '슬픈', emoji: '😢', stage: 1, source: 'starters', pos: 'adj' },
  // e
  { en: 'bed', ko: '침대', emoji: '🛏️', stage: 1, source: 'starters', pos: 'noun' },
  { en: 'leg', ko: '다리', emoji: '🦵', stage: 1, source: 'starters', pos: 'noun' },
  { en: 'men', ko: '남자들', emoji: '👬', stage: 1, source: 'starters', pos: 'noun', plural: true, abstract: true }, // man과 그림으로 구별할 수 없다
  { en: 'pet', ko: '반려동물', emoji: '🐕', stage: 1, source: 'starters', pos: 'noun', abstract: true }, // 🐕는 dog🐶와 같은 개다
  { en: 'ten', ko: '십', emoji: '🔟', stage: 1, source: 'number', pos: 'num' },
  // i
  { en: 'big', ko: '큰', emoji: '🐘', stage: 1, source: 'starters', pos: 'adj', abstract: true }, // 🐘는 코끼리다
  { en: 'kid', ko: '아이', emoji: '🧒', stage: 1, source: 'starters', pos: 'noun' },
  { en: 'sit', ko: '앉다', emoji: '🪑', stage: 1, source: 'starters', pos: 'verb', abstract: true }, // 🪑는 의자다
  { en: 'six', ko: '여섯', emoji: '6️⃣', stage: 1, source: 'number', pos: 'num' },
  { en: 'pig', ko: '돼지', emoji: '🐷', stage: 1, source: 'phonics', pos: 'noun' },
  // o
  { en: 'hot', ko: '뜨거운', emoji: '🔥', stage: 1, source: 'phonics', pos: 'adj', abstract: true }, // 🔥는 불이다
  { en: 'pot', ko: '냄비', emoji: '🍲', stage: 1, source: 'phonics', pos: 'noun' },
  { en: 'fox', ko: '여우', emoji: '🦊', stage: 1, source: 'phonics', pos: 'noun' },
  // u
  { en: 'bus', ko: '버스', emoji: '🚌', stage: 1, source: 'starters', pos: 'noun' },
  { en: 'fun', ko: '재미', emoji: '😄', stage: 1, source: 'starters', pos: 'other', abstract: true }, // 웃는 얼굴은 happy와 구별이 안 된다
  { en: 'mum', ko: '엄마', emoji: '👩', stage: 1, source: 'starters', pos: 'noun' },
  { en: 'rug', ko: '깔개', emoji: '🧶', stage: 1, source: 'starters', pos: 'noun', abstract: true }, // 🧶는 실뭉치다
  { en: 'run', ko: '달리다', emoji: '🏃', stage: 1, source: 'starters', pos: 'verb' },
]

export const WORDS: Word[] = [...STAGE0, ...STAGE1]

/**
 * 활용형 → 목록 표제어.
 *
 * Starters A–Z 목록은 `be v` 한 줄로 끝나고 is/are/am을 따로 싣지 않는다.
 * sight word로는 is가 반드시 필요하므로(모든 문장에 나온다) **기본형으로 대조**한다.
 */
export const BASE_FORM: Record<string, string> = {
  is: 'be',
  are: 'be',
  am: 'be',
}

/**
 * Sight words — 파닉스로 소리 내어 읽기 어려운 고빈도 낱말. Dolch pre-primer 기준.
 * 그림이 없어도 되는 기능어라 Word와 따로 둔다(이모지 검사에서 빠진다).
 */
export const SIGHT_WORDS: SightWord[] = [
  { en: 'a', ko: '하나의', dolch: 'pre-primer', source: 'starters' },
  { en: 'and', ko: '그리고', dolch: 'pre-primer', source: 'starters' },
  { en: 'blue', ko: '파랑', dolch: 'pre-primer', source: 'starters' },
  { en: 'can', ko: '할 수 있다', dolch: 'pre-primer', source: 'starters' },
  { en: 'come', ko: '오다', dolch: 'pre-primer', source: 'starters' },
  { en: 'find', ko: '찾다', dolch: 'pre-primer', source: 'starters' },
  { en: 'for', ko: '위하여', dolch: 'pre-primer', source: 'starters' },
  { en: 'funny', ko: '웃긴', dolch: 'pre-primer', source: 'starters' },
  { en: 'go', ko: '가다', dolch: 'pre-primer', source: 'starters' },
  { en: 'i', ko: '나', dolch: 'pre-primer', source: 'starters' },
  { en: 'in', ko: '안에', dolch: 'pre-primer', source: 'starters' },
  { en: 'is', ko: '이다', dolch: 'pre-primer', source: 'starters' },
  { en: 'it', ko: '그것', dolch: 'pre-primer', source: 'starters' },
  { en: 'jump', ko: '뛰다', dolch: 'pre-primer', source: 'starters' },
  { en: 'like', ko: '좋아하다', dolch: 'pre-primer', source: 'starters' },
  { en: 'look', ko: '보다', dolch: 'pre-primer', source: 'starters' },
  { en: 'me', ko: '나를', dolch: 'pre-primer', source: 'starters' },
  { en: 'my', ko: '나의', dolch: 'pre-primer', source: 'starters' },
  { en: 'not', ko: '아니다', dolch: 'pre-primer', source: 'starters' },
  { en: 'one', ko: '하나', dolch: 'pre-primer', source: 'number' },
  { en: 'play', ko: '놀다', dolch: 'pre-primer', source: 'starters' },
  { en: 'see', ko: '보다', dolch: 'pre-primer', source: 'starters' },
  { en: 'the', ko: '그', dolch: 'pre-primer', source: 'starters' },
  { en: 'three', ko: '셋', dolch: 'pre-primer', source: 'number' },
  { en: 'to', ko: '~로', dolch: 'pre-primer', source: 'starters' },
  { en: 'two', ko: '둘', dolch: 'pre-primer', source: 'number' },
  { en: 'up', ko: '위로', dolch: 'pre-primer', source: 'starters' },
  { en: 'we', ko: '우리', dolch: 'pre-primer', source: 'starters' },
  { en: 'where', ko: '어디', dolch: 'pre-primer', source: 'starters' },
  { en: 'you', ko: '너', dolch: 'pre-primer', source: 'starters' },
]

/**
 * 숫자 낱말 — A–Z 목록에는 없지만 공식 "Letters & numbers" 항목이 1~20을 출제 범위로 명시한다.
 * `source: 'number'`인 낱말은 이 목록 안에 있어야 한다(테스트가 확인한다).
 */
export const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
]
