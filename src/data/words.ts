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
  { en: 'big', ko: '큰', emoji: '🦕', stage: 1, source: 'starters', pos: 'adj', abstract: true }, // 🦕는 공룡이다 (🐘는 단계 3 elephant가 쓴다)
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

/**
 * 단계 2 — **쌍자음 마을**. 자음 두 개가 붙어 나는 소리(ck·ll·ss·nd·nk·mp·st·gr…).
 *
 * 단모음까지 배운 아이가 다음에 부딪히는 벽이다: sock을 s·o·c·k로 읽으려 하면 소리가 안 맞는다.
 * 낱말은 Starters 표제어 안에서 **그 단계까지 배운 글자만으로 읽히는 것**만 골랐다
 * (zebra는 목록에 있지만 e를 이름소리로 읽어야 해서 뺐다 — 단계 침범이다).
 */
const STAGE2: Word[] = [
  // ck·ll·ss·pp·dd — 같은 글자가 겹친 소리
  { en: 'sock', ko: '양말', emoji: '🧦', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'clock', ko: '시계', emoji: '🕐', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'duck', ko: '오리', emoji: '🦆', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'truck', ko: '트럭', emoji: '🚚', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'doll', ko: '인형', emoji: '🪆', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'wall', ko: '벽', emoji: '🧱', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'dress', ko: '원피스', emoji: '👗', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'glasses', ko: '안경', emoji: '👓', stage: 2, source: 'starters', pos: 'noun', plural: true },
  { en: 'happy', ko: '행복한', emoji: '😊', stage: 2, source: 'starters', pos: 'adj' },
  { en: 'teddy', ko: '곰인형', emoji: '🧸', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'hippo', ko: '하마', emoji: '🦛', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'tennis', ko: '테니스', emoji: '🎾', stage: 2, source: 'starters', pos: 'noun' },
  // nd·nk·lk — 자음이 이어지는 끝소리
  { en: 'hand', ko: '손', emoji: '✋', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'sand', ko: '모래', emoji: '🏖️', stage: 2, source: 'starters', pos: 'noun', abstract: true }, // 🏖️는 바닷가다
  { en: 'handbag', ko: '손가방', emoji: '👜', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'candy', ko: '사탕', emoji: '🍬', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'pink', ko: '분홍', emoji: '🩷', stage: 2, source: 'starters', pos: 'adj' },
  { en: 'drink', ko: '마시다', emoji: '🥤', stage: 2, source: 'starters', pos: 'verb', abstract: true }, // 🥤는 음료다
  { en: 'milk', ko: '우유', emoji: '🥛', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'donkey', ko: '당나귀', emoji: '🫏', stage: 2, source: 'starters', pos: 'noun' },
  // 첫소리 자음 덩어리 — bl·cl·dr·fr·gr·sm·st·sw·tr
  { en: 'black', ko: '검정', emoji: '⬛', stage: 2, source: 'starters', pos: 'adj' },
  { en: 'clap', ko: '박수치다', emoji: '👏', stage: 2, source: 'starters', pos: 'verb' },
  { en: 'frog', ko: '개구리', emoji: '🐸', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'grandma', ko: '할머니', emoji: '👵', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'grandpa', ko: '할아버지', emoji: '👴', stage: 2, source: 'starters', pos: 'noun' },
  { en: 'small', ko: '작은', emoji: '🐜', stage: 2, source: 'starters', pos: 'adj', abstract: true }, // 🐜는 개미다
  { en: 'stop', ko: '멈추다', emoji: '🛑', stage: 2, source: 'starters', pos: 'verb' },
  { en: 'swim', ko: '수영하다', emoji: '🏊', stage: 2, source: 'starters', pos: 'verb' },
  { en: 'basketball', ko: '농구', emoji: '🏀', stage: 2, source: 'starters', pos: 'noun' },
]

/**
 * 단계 3 — **두글자소리 마을**. 두 글자가 모여 **한 소리**가 되는 것(sh·ch·th·wh·ph·ng).
 *
 * 단계 2의 자음 덩어리와 헷갈리기 쉬워 순서가 중요하다: st는 두 소리(스+트)지만 sh는 한 소리(쉬)다.
 */
const STAGE3: Word[] = [
  // sh
  { en: 'ship', ko: '배', emoji: '🚢', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'shop', ko: '가게', emoji: '🏪', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'shell', ko: '조개껍데기', emoji: '🐚', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'fishing', ko: '낚시', emoji: '🎣', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'jellyfish', ko: '해파리', emoji: '🪼', stage: 3, source: 'starters', pos: 'noun' },
  // ch
  { en: 'chicken', ko: '닭', emoji: '🐔', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'chips', ko: '감자튀김', emoji: '🍟', stage: 3, source: 'starters', pos: 'noun', plural: true },
  { en: 'lunch', ko: '점심', emoji: '🍱', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'kitchen', ko: '부엌', emoji: '🍳', stage: 3, source: 'starters', pos: 'noun', abstract: true }, // 🍳는 요리다
  { en: 'watch', ko: '손목시계', emoji: '⌚', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'catch', ko: '잡다', emoji: '🧤', stage: 3, source: 'starters', pos: 'verb', abstract: true }, // 🧤는 장갑이다
  { en: 'child', ko: '아이', emoji: '👦', stage: 3, source: 'starters', pos: 'noun', abstract: true }, // kid🧒와 뜻이 겹친다 — 그림으로는 못 가른다
  { en: 'children', ko: '아이들', emoji: '👫', stage: 3, source: 'starters', pos: 'noun', plural: true, abstract: true },
  // th·wh
  { en: 'bath', ko: '목욕', emoji: '🛁', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'thanks', ko: '고마워', emoji: '🙏', stage: 3, source: 'starters', pos: 'other', abstract: true },
  // ph
  { en: 'photo', ko: '사진', emoji: '📷', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'elephant', ko: '코끼리', emoji: '🐘', stage: 3, source: 'starters', pos: 'noun' },
  // ng
  { en: 'song', ko: '노래', emoji: '🎵', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'sing', ko: '노래하다', emoji: '🎤', stage: 3, source: 'starters', pos: 'verb', abstract: true }, // 🎤는 마이크다
  { en: 'long', ko: '긴', emoji: '📏', stage: 3, source: 'starters', pos: 'adj', abstract: true }, // 📏는 자다
  { en: 'mango', ko: '망고', emoji: '🥭', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'evening', ko: '저녁', emoji: '🌆', stage: 3, source: 'starters', pos: 'noun' },
  { en: 'angry', ko: '화난', emoji: '😠', stage: 3, source: 'starters', pos: 'adj' },
  { en: 'clothes', ko: '옷', emoji: '👕', stage: 3, source: 'starters', pos: 'noun', plural: true },
]

/**
 * 단계 4 — **마법의 e 마을**. 낱말 끝의 e가 소리를 내지 않고 **앞 모음을 자기 이름으로 바꾼다**
 * (cap→cape, kit→kite). 아이가 처음 만나는 "규칙이 규칙을 바꾸는" 자리다.
 *
 * here·store처럼 e 앞이 r인 것은 넣지 않는다 — r이 모음을 삼켜 소리가 달라진다(단계 6).
 */
const STAGE4: Word[] = [
  // a_e
  { en: 'cake', ko: '케이크', emoji: '🍰', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'snake', ko: '뱀', emoji: '🐍', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'plane', ko: '비행기', emoji: '✈️', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'grape', ko: '포도', emoji: '🍇', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'game', ko: '게임', emoji: '🎮', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'face', ko: '얼굴', emoji: '😀', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'wave', ko: '파도', emoji: '🌊', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'name', ko: '이름', emoji: '🏷️', stage: 4, source: 'starters', pos: 'noun', abstract: true },
  { en: 'lemonade', ko: '레모네이드', emoji: '🍋', stage: 4, source: 'starters', pos: 'noun', abstract: true }, // 🍋는 레몬이다
  { en: 'classmate', ko: '반 친구', emoji: '🧑‍🤝‍🧑', stage: 4, source: 'starters', pos: 'noun', abstract: true },
  // i_e
  { en: 'bike', ko: '자전거', emoji: '🚲', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'rice', ko: '밥', emoji: '🍚', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'ice', ko: '얼음', emoji: '🧊', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'juice', ko: '주스', emoji: '🧃', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'lime', ko: '라임', emoji: '🍈', stage: 4, source: 'starters', pos: 'noun', abstract: true }, // 🍈는 멜론이다
  { en: 'mice', ko: '쥐들', emoji: '🐭', stage: 4, source: 'starters', pos: 'noun', plural: true },
  { en: 'smile', ko: '미소', emoji: '🙂', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'crocodile', ko: '악어', emoji: '🐊', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'write', ko: '쓰다', emoji: '✍️', stage: 4, source: 'starters', pos: 'verb' },
  { en: 'ride', ko: '타다', emoji: '🚴', stage: 4, source: 'starters', pos: 'verb', abstract: true }, // 🚴는 자전거 타는 사람 — bike와 겹친다
  { en: 'drive', ko: '운전하다', emoji: '🚗', stage: 4, source: 'starters', pos: 'verb', abstract: true }, // 🚗는 자동차다
  { en: 'nice', ko: '좋은', emoji: '👍', stage: 4, source: 'starters', pos: 'adj', abstract: true },
  { en: 'time', ko: '시간', emoji: '⏰', stage: 4, source: 'starters', pos: 'noun', abstract: true }, // ⏰는 시계 — clock와 겹친다
  // o_e·u_e
  { en: 'phone', ko: '전화', emoji: '📱', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'home', ko: '집', emoji: '🏠', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'close', ko: '닫다', emoji: '🔒', stage: 4, source: 'starters', pos: 'verb', abstract: true }, // 🔒는 자물쇠다
  { en: 'chocolate', ko: '초콜릿', emoji: '🍫', stage: 4, source: 'starters', pos: 'noun' },
  { en: 'white', ko: '흰색', emoji: '⬜', stage: 4, source: 'starters', pos: 'adj' },
  { en: 'page', ko: '쪽', emoji: '📄', stage: 4, source: 'starters', pos: 'noun', abstract: true },
]

/**
 * 단계 5 — **긴모음 마을**. 모음 두 개가 팀을 이뤄 **앞 모음의 이름**을 낸다 (ai·ay·ee·ea·oa·ow·ie·igh).
 *
 * 마법의 e와 같은 소리를 다른 방법으로 적는 것이다: cake와 rain, bike와 night.
 * "같은 소리를 적는 길이 여러 개"라는 것을 여기서 처음 배운다.
 */
const STAGE5: Word[] = [
  // ee·ea
  { en: 'tree', ko: '나무', emoji: '🌳', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'sheep', ko: '양', emoji: '🐑', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'bee', ko: '벌', emoji: '🐝', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'feet', ko: '발들', emoji: '🦶', stage: 5, source: 'starters', pos: 'noun', plural: true },
  { en: 'green', ko: '초록', emoji: '🟩', stage: 5, source: 'starters', pos: 'adj' },
  { en: 'sleep', ko: '자다', emoji: '😴', stage: 5, source: 'starters', pos: 'verb' },
  { en: 'sweet', ko: '달콤한', emoji: '🍭', stage: 5, source: 'starters', pos: 'adj', abstract: true }, // 🍭는 사탕이다
  { en: 'meat', ko: '고기', emoji: '🥩', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'bread', ko: '빵', emoji: '🍞', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'ear', ko: '귀', emoji: '👂', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'beach', ko: '바닷가', emoji: '🏝️', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'eat', ko: '먹다', emoji: '🍴', stage: 5, source: 'starters', pos: 'verb', abstract: true }, // 🍴는 포크다
  { en: 'read', ko: '읽다', emoji: '📖', stage: 5, source: 'starters', pos: 'verb', abstract: true }, // 📖는 책이다
  { en: 'clean', ko: '깨끗한', emoji: '🧼', stage: 5, source: 'starters', pos: 'adj', abstract: true }, // 🧼는 비누다
  // ai·ay
  { en: 'train', ko: '기차', emoji: '🚂', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'paint', ko: '물감', emoji: '🎨', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'day', ko: '날', emoji: '🌞', stage: 5, source: 'starters', pos: 'noun', abstract: true }, // 🌞는 해 — sun☀️과 겹친다
  { en: 'play', ko: '놀다', emoji: '🎠', stage: 5, source: 'starters', pos: 'verb', abstract: true },
  // oa·ow
  { en: 'boat', ko: '배', emoji: '⛵', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'window', ko: '창문', emoji: '🪟', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'brown', ko: '갈색', emoji: '🟤', stage: 5, source: 'starters', pos: 'adj' },
  // ie·igh
  { en: 'pie', ko: '파이', emoji: '🥧', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'night', ko: '밤', emoji: '🌙', stage: 5, source: 'starters', pos: 'noun' },
  // 그 밖의 긴모음 팀
  { en: 'pear', ko: '배(과일)', emoji: '🍐', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'pea', ko: '완두콩', emoji: '🫛', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'jeans', ko: '청바지', emoji: '👖', stage: 5, source: 'starters', pos: 'noun', plural: true },
  { en: 'crayon', ko: '크레용', emoji: '🖍️', stage: 5, source: 'starters', pos: 'noun' },
  { en: 'chair', ko: '의자', emoji: '💺', stage: 5, source: 'starters', pos: 'noun' },
]

/**
 * 단계 6 — **r모음 마을**. r이 앞 모음을 삼켜 새 소리가 된다 (ar·or·er·ir·ur).
 *
 * 단모음 규칙이 통하지 않는 첫 자리다: car를 c-a-r로 읽으면 "캐르"가 된다.
 */
const STAGE6: Word[] = [
  // ar
  { en: 'car', ko: '자동차', emoji: '🚙', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'arm', ko: '팔', emoji: '💪', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'park', ko: '공원', emoji: '🏞️', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'garden', ko: '정원', emoji: '🌷', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'guitar', ko: '기타', emoji: '🎸', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'dinner', ko: '저녁밥', emoji: '🍽️', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'shorts', ko: '반바지', emoji: '🩳', stage: 6, source: 'starters', pos: 'noun', plural: true },
  // or
  { en: 'horse', ko: '말', emoji: '🐴', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'morning', ko: '아침', emoji: '🌅', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'short', ko: '짧은', emoji: '🤏', stage: 6, source: 'starters', pos: 'adj', abstract: true }, // 🤏는 '조금'이다
  // er
  { en: 'teacher', ko: '선생님', emoji: '🧑‍🏫', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'burger', ko: '햄버거', emoji: '🍔', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'flower', ko: '꽃', emoji: '🌸', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'spider', ko: '거미', emoji: '🕷️', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'monster', ko: '괴물', emoji: '👹', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'mirror', ko: '거울', emoji: '🪞', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'paper', ko: '종이', emoji: '📃', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'ruler', ko: '자', emoji: '📐', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'camera', ko: '카메라', emoji: '📸', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'mother', ko: '어머니', emoji: '👩‍🦰', stage: 6, source: 'starters', pos: 'noun', abstract: true }, // mum👩과 뜻이 같다
  { en: 'father', ko: '아버지', emoji: '👨‍🦰', stage: 6, source: 'starters', pos: 'noun', abstract: true }, // dad👨과 뜻이 같다
  { en: 'sister', ko: '누나·언니', emoji: '👭', stage: 6, source: 'starters', pos: 'noun', abstract: true },
  { en: 'brother', ko: '형·오빠', emoji: '👨‍👦', stage: 6, source: 'starters', pos: 'noun', abstract: true }, // men👬과 그림이 같다
  // ir·ur
  { en: 'bird', ko: '새', emoji: '🐦', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'girl', ko: '여자아이', emoji: '👧', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'shirt', ko: '셔츠', emoji: '👔', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'purple', ko: '보라', emoji: '🟣', stage: 6, source: 'starters', pos: 'adj' },
  { en: 'lizard', ko: '도마뱀', emoji: '🦎', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'giraffe', ko: '기린', emoji: '🦒', stage: 6, source: 'starters', pos: 'noun' },
  { en: 'carrot', ko: '당근', emoji: '🥕', stage: 6, source: 'starters', pos: 'noun' },
]

/**
 * 단계 7 — **이중모음 마을**. 소리가 하나에서 다른 하나로 미끄러진다 (oo·ou·oi·oy·aw·au·ew).
 *
 * 입 모양이 도중에 바뀌는 소리라 아이가 따라 하기 어렵다 — 그림과 함께 여러 번 듣는 것이 핵심이다.
 */
const STAGE7: Word[] = [
  // oo
  { en: 'book', ko: '책', emoji: '📕', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'boots', ko: '장화', emoji: '🥾', stage: 7, source: 'starters', pos: 'noun', plural: true },
  { en: 'food', ko: '음식', emoji: '🥗', stage: 7, source: 'starters', pos: 'noun', abstract: true }, // 🥗는 샐러드다
  { en: 'school', ko: '학교', emoji: '🏫', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'door', ko: '문', emoji: '🚪', stage: 7, source: 'starters', pos: 'noun' }, // oo를 쓴다 — r모음이 아니다
  { en: 'room', ko: '방', emoji: '🚻', stage: 7, source: 'starters', pos: 'noun', abstract: true },
  { en: 'foot', ko: '발', emoji: '👣', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'cool', ko: '시원한', emoji: '😎', stage: 7, source: 'starters', pos: 'adj', abstract: true },
  { en: 'good', ko: '좋은', emoji: '👌', stage: 7, source: 'starters', pos: 'adj', abstract: true },
  { en: 'look', ko: '보다', emoji: '👀', stage: 7, source: 'starters', pos: 'verb', abstract: true },
  // ou·ow
  { en: 'house', ko: '집', emoji: '🏡', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'mouse', ko: '쥐', emoji: '🐁', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'mouth', ko: '입', emoji: '👄', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'cow', ko: '소', emoji: '🐄', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'count', ko: '세다', emoji: '🔢', stage: 7, source: 'starters', pos: 'verb', abstract: true },
  { en: 'trousers', ko: '바지', emoji: '👝', stage: 7, source: 'starters', pos: 'noun', plural: true, abstract: true },
  // oi·oy
  { en: 'toy', ko: '장난감', emoji: '🪀', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'boy', ko: '남자아이', emoji: '🧑‍🎓', stage: 7, source: 'starters', pos: 'noun', abstract: true }, // kid·child와 그림으로 못 가른다
  { en: 'point', ko: '가리키다', emoji: '👉', stage: 7, source: 'starters', pos: 'verb' },
  // aw·au·ew
  { en: 'draw', ko: '그리다', emoji: '✏️', stage: 7, source: 'starters', pos: 'verb' },
  { en: 'drawing', ko: '그림', emoji: '🖼️', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'sausage', ko: '소시지', emoji: '🌭', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'new', ko: '새로운', emoji: '🆕', stage: 7, source: 'starters', pos: 'adj', abstract: true },
  { en: 'balloon', ko: '풍선', emoji: '🎈', stage: 7, source: 'starters', pos: 'noun' },
  { en: 'goodbye', ko: '안녕(작별)', emoji: '👋', stage: 7, source: 'starters', pos: 'other', abstract: true },
]

/**
 * 단계 8 — **긴낱말 마을**. 아는 낱말 두 개를 붙인 것(합성어)과 소리 덩어리가 여럿인 긴 낱말.
 *
 * 여기서 배우는 것은 새 소리가 아니라 **읽는 방법**이다: 긴 낱말은 통째로 읽는 것이 아니라
 * 아는 조각으로 쪼개서 읽는다(play+ground, water+melon). 낱말이 길다고 겁내지 않게 하는 자리다.
 */
const STAGE8: Word[] = [
  { en: 'playground', ko: '놀이터', emoji: '🛝', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'football', ko: '축구', emoji: '🥅', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'watermelon', ko: '수박', emoji: '🍉', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'pineapple', ko: '파인애플', emoji: '🍍', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'bedroom', ko: '침실', emoji: '🛌', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'bathroom', ko: '욕실', emoji: '🚿', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'classroom', ko: '교실', emoji: '📚', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'bookcase', ko: '책장', emoji: '🗄️', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'bookshop', ko: '서점', emoji: '🏬', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'armchair', ko: '안락의자', emoji: '🛋️', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'keyboard', ko: '건반', emoji: '⌨️', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'skateboard', ko: '스케이트보드', emoji: '🛹', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'motorbike', ko: '오토바이', emoji: '🏍️', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'helicopter', ko: '헬리콥터', emoji: '🚁', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'apartment', ko: '아파트', emoji: '🏢', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'birthday', ko: '생일', emoji: '🎂', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'breakfast', ko: '아침밥', emoji: '🥐', stage: 8, source: 'starters', pos: 'noun' },
  { en: 'afternoon', ko: '오후', emoji: '🕒', stage: 8, source: 'starters', pos: 'noun', abstract: true }, // 시계 그림은 시간과 겹친다
  { en: 'meatballs', ko: '미트볼', emoji: '🍝', stage: 8, source: 'starters', pos: 'noun', plural: true },
  { en: 'grandmother', ko: '할머니', emoji: '👵🏻', stage: 8, source: 'starters', pos: 'noun', abstract: true }, // grandma와 뜻이 같다
  { en: 'grandfather', ko: '할아버지', emoji: '👴🏻', stage: 8, source: 'starters', pos: 'noun', abstract: true }, // grandpa와 뜻이 같다
  { en: 'cupboard', ko: '찬장', emoji: '🚰', stage: 8, source: 'starters', pos: 'noun', abstract: true },
  { en: 'skateboarding', ko: '스케이트보드 타기', emoji: '🛼', stage: 8, source: 'starters', pos: 'noun', abstract: true },
]

/**
 * 단계 9 — **예외 마을**. 규칙대로 읽으면 틀리는 낱말들.
 *
 * 마지막 마을을 예외로 두는 이유: 규칙을 다 배운 뒤라야 "이건 규칙을 어긴다"는 말이 뜻을 가진다.
 * 여기 낱말은 **통째로 익힌다** — one을 o-n-e로 읽어 보라고 하면 아이가 규칙 자체를 의심하게 된다.
 * 그림이 없는 낱말이 많은 것도 이 마을의 성질이다(숫자와 기능어가 많다).
 */
const STAGE9: Word[] = [
  // 숫자 — 소리와 철자가 어긋나는 대표 자리(one·two·eight)
  { en: 'four', ko: '넷', emoji: '4️⃣', stage: 9, source: 'number', pos: 'num' },
  { en: 'five', ko: '다섯', emoji: '5️⃣', stage: 9, source: 'number', pos: 'num' },
  { en: 'seven', ko: '일곱', emoji: '7️⃣', stage: 9, source: 'number', pos: 'num' },
  { en: 'eight', ko: '여덟', emoji: '8️⃣', stage: 9, source: 'number', pos: 'num' },
  { en: 'nine', ko: '아홉', emoji: '9️⃣', stage: 9, source: 'number', pos: 'num' },
  // 규칙을 어기는 흔한 낱말
  { en: 'people', ko: '사람들', emoji: '👥', stage: 9, source: 'starters', pos: 'noun', plural: true },
  { en: 'friend', ko: '친구', emoji: '🤝', stage: 9, source: 'starters', pos: 'noun', abstract: true },
  { en: 'love', ko: '사랑', emoji: '❤️', stage: 9, source: 'starters', pos: 'noun' },
  { en: 'give', ko: '주다', emoji: '🎁', stage: 9, source: 'starters', pos: 'verb', abstract: true }, // 🎁는 선물이다
  { en: 'walk', ko: '걷다', emoji: '🚶', stage: 9, source: 'starters', pos: 'verb' },
  { en: 'talk', ko: '말하다', emoji: '🗣️', stage: 9, source: 'starters', pos: 'verb' },
  { en: 'listen', ko: '듣다', emoji: '🎧', stage: 9, source: 'starters', pos: 'verb', abstract: true }, // 🎧는 헤드폰이다
  { en: 'shoe', ko: '신발', emoji: '👟', stage: 9, source: 'starters', pos: 'noun' },
  { en: 'again', ko: '다시', emoji: '🔁', stage: 9, source: 'starters', pos: 'other', abstract: true },
  { en: 'great', ko: '멋진', emoji: '🙌', stage: 9, source: 'starters', pos: 'adj', abstract: true },
  { en: 'sorry', ko: '미안해', emoji: '🙇', stage: 9, source: 'starters', pos: 'other', abstract: true },
  { en: 'today', ko: '오늘', emoji: '📅', stage: 9, source: 'starters', pos: 'other', abstract: true },
  { en: 'colour', ko: '색', emoji: '🌈', stage: 9, source: 'starters', pos: 'noun' },
  { en: 'beautiful', ko: '아름다운', emoji: '💐', stage: 9, source: 'starters', pos: 'adj', abstract: true },
  { en: 'know', ko: '알다', emoji: '🧠', stage: 9, source: 'starters', pos: 'verb', abstract: true },
]

export const WORDS: Word[] = [
  ...STAGE0,
  ...STAGE1,
  ...STAGE2,
  ...STAGE3,
  ...STAGE4,
  ...STAGE5,
  ...STAGE6,
  ...STAGE7,
  ...STAGE8,
  ...STAGE9,
]

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
