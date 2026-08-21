/**
 * 파닉스 단계표 — **손으로 넣는 정본 데이터**.
 *
 * 급수 시험의 "출제기준표"에 해당한다. 이 표가 무엇을 언제 배우는지 정하고,
 * 낱말이 그 단계에 어울리는지(단계 침범이 없는지)는 phonics.ts가 이 표로 계산한다.
 * 순서는 합성 파닉스(synthetic phonics)의 통상 진행: 소리 → 조합 → 예외.
 */
import type { Grapheme, Letter, StageId } from './types'

/** 단계 이름 — 지도 화면에 보여 줄 마을 이름 */
export const STAGE_NAMES: Record<StageId, string> = {
  0: '알파벳 마을',
  1: '단모음 마을',
  2: '쌍자음 마을',
  3: '두글자소리 마을',
  4: '마법의 e 마을',
  5: '긴모음 마을',
  6: 'r모음 마을',
  7: '이중모음 마을',
  8: '긴낱말 마을',
  9: '예외 마을',
}

/**
 * 알파벳 26자 — 단계 0.
 *
 * `sound`는 글자 **이름**이 아니라 대표 **소리**의 한국어 근사다. 아이에게는 이름보다 소리가 먼저다.
 * 소리를 실제로 들려주는 것은 TTS(en-US)이고 이 표기는 눈으로 확인하는 보조 표시다.
 */
export const LETTERS: Letter[] = [
  { ch: 'a', name: '에이', sound: '애', keyword: 'apple' },
  { ch: 'b', name: '비', sound: '브', keyword: 'ball' },
  { ch: 'c', name: '씨', sound: '크', keyword: 'cat' },
  { ch: 'd', name: '디', sound: '드', keyword: 'dog' },
  { ch: 'e', name: '이', sound: '에', keyword: 'egg' },
  { ch: 'f', name: '에프', sound: '프(f)', keyword: 'fish' },
  { ch: 'g', name: '지', sound: '그', keyword: 'goat' },
  { ch: 'h', name: '에이치', sound: '흐', keyword: 'hat' },
  { ch: 'i', name: '아이', sound: '이', keyword: 'ice cream' },
  { ch: 'j', name: '제이', sound: '즈', keyword: 'jacket' },
  { ch: 'k', name: '케이', sound: '크', keyword: 'kite' },
  { ch: 'l', name: '엘', sound: '르(l)', keyword: 'lamp' },
  { ch: 'm', name: '엠', sound: '므', keyword: 'monkey' },
  { ch: 'n', name: '엔', sound: '느', keyword: 'nose' },
  { ch: 'o', name: '오', sound: '아', keyword: 'orange' },
  { ch: 'p', name: '피', sound: '프', keyword: 'pen' },
  { ch: 'q', name: '큐', sound: '쿠', keyword: 'queen' },
  { ch: 'r', name: '알', sound: '르(r)', keyword: 'red' },
  { ch: 's', name: '에스', sound: '스', keyword: 'sun' },
  { ch: 't', name: '티', sound: '트', keyword: 'tiger' },
  { ch: 'u', name: '유', sound: '어', keyword: 'umbrella' },
  { ch: 'v', name: '브이', sound: '브(v)', keyword: 'van' },
  { ch: 'w', name: '더블유', sound: '우', keyword: 'water' },
  // x로 시작하는 낱말은 아이가 쓸 일이 거의 없다 → 끝소리로 가르친다
  { ch: 'x', name: '엑스', sound: '크스', keyword: 'box', position: 'final' },
  { ch: 'y', name: '와이', sound: '이', keyword: 'yellow' },
  { ch: 'z', name: '지', sound: '즈', keyword: 'zoo' },
]

/**
 * 그래핌표 — 글자 조각과 그 소리, 그리고 배우는 단계.
 *
 * 단계 2 이후는 아직 낱말을 넣지 않았지만 **표에는 있어야 한다**. `sock`의 `ck`가 단계 2라는 것을
 * 표가 알고 있어야, 단계 1 낱말 목록에 sock이 섞여 든 것을 테스트가 잡아낼 수 있다.
 * 여러 글자 그래핌이 먼저 매칭되도록 phonics.ts가 길이 내림차순으로 훑는다.
 */
export const GRAPHEMES: Grapheme[] = [
  // 단계 0 — 알파벳 낱글자
  ...('abcdefghijklmnopqrstuvwxyz'.split('').map((g) => ({ g, sound: g, stage: 0 as StageId }))),

  // 단계 2 — 같은 글자 겹침과 자음 덩어리
  ...['ck', 'll', 'ss', 'ff', 'zz', 'gg', 'tt', 'dd', 'pp', 'nn', 'mm', 'bb', 'rr'].map((g) => ({
    g,
    sound: g,
    stage: 2 as StageId,
  })),
  ...['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'nd', 'nk', 'nt', 'mp', 'lt', 'ft', 'lk'].map(
    (g) => ({ g, sound: g, stage: 2 as StageId })
  ),

  // 단계 3 — 두 글자가 한 소리
  ...['sh', 'ch', 'th', 'wh', 'ph', 'ng'].map((g) => ({ g, sound: g, stage: 3 as StageId })),

  // 단계 4 — 마법의 e (split digraph). `_`는 자음 한 글자 자리
  ...['a_e', 'i_e', 'o_e', 'u_e', 'e_e'].map((g) => ({ g, sound: g, stage: 4 as StageId })),

  // 단계 5 — 긴 모음 팀
  ...['ai', 'ay', 'ee', 'ea', 'oa', 'ow', 'ie', 'igh'].map((g) => ({ g, sound: g, stage: 5 as StageId })),

  // 단계 6 — r이 모음을 삼키는 소리
  ...['ar', 'or', 'er', 'ir', 'ur'].map((g) => ({ g, sound: g, stage: 6 as StageId })),

  // 단계 7 — 모음 두 개가 미끄러지는 소리(이중모음)
  ...['oo', 'ou', 'oi', 'oy', 'aw', 'au', 'ew'].map((g) => ({ g, sound: g, stage: 7 as StageId })),
]

/** 단모음 5개와 대표 소리 — 단계 1을 다섯 묶음으로 나눈다 */
export const SHORT_VOWELS = [
  { v: 'a', sound: '애', example: 'cat' },
  { v: 'e', sound: '에', example: 'bed' },
  { v: 'i', sound: '이', example: 'big' },
  { v: 'o', sound: '아', example: 'box' },
  { v: 'u', sound: '어', example: 'bus' },
] as const
