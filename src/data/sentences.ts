/**
 * 문장 데이터 — **손으로 넣는 정본**. 두 갈래를 일부러 나눠 둔다.
 *
 * 1. `TEMPLATES` — **읽는 문장.** 아이가 스스로 소리 내어 읽을 수 있는 낱말로만 만든다
 *    (배운 CVC 낱말 + sight words). 빈칸에 들어갈 낱말은 데이터에 적지 않고 계산해서 채운다 —
 *    낱말이 늘 때마다 문장을 다시 쓰지 않으려면 그래야 한다.
 *
 * 2. `PHRASES` — **생활 표현.** 유치원 생활에서 실제로 쓰는 말이다.
 *    이쪽은 **읽기를 요구하지 않는다**: bathroom·thirsty처럼 아직 못 읽는 낱말이 당연히 들어가고,
 *    통째로 듣고 따라 말하는 것이 목적이다. 그래서 어휘 정본(Starters) 검사도 걸지 않는다.
 *    대신 **읽기 문제에는 절대 쓰지 않는다**(테스트가 확인한다).
 */

/**
 * 읽는 문장 틀.
 * - `%n` = 영어 낱말 자리
 * - `%k{받침있을때/없을때}` = 한국어 뜻 + 조사 자리. 조사는 받침에 따라 달라진다
 *   (버스**는** / 십**은**) → sentence.ts가 받침을 보고 고른다.
 */
export interface SentenceTemplate {
  /** 영어 틀 — `%n`이 낱말 자리 */
  en: string
  /** 한국어 틀 — `%k`가 뜻 자리 */
  ko: string
  /** 낱말 자리 수 (1 또는 2). 2면 서로 다른 낱말이 들어간다 */
  slots: 1 | 2
  /**
   * 이 틀을 쓸 수 있는 가장 이른 단계.
   *
   * 틀 안의 **고정 낱말**도 아이가 읽을 수 있어야 한다. `The %n is big.`의 big은 단모음 낱말(단계 1)이라
   * 알파벳 마을에서는 쓸 수 없다 — 테스트가 이걸 잡아 줘서 알게 됐다.
   */
  minStage?: 0 | 1
}

/**
 * 읽는 문장 틀 — 전부 **a/the + 단수 명사** 자리라서 어떤 명사가 들어와도 문장이 성립한다.
 * (형용사·복수형이 끼면 "I see a red"·"I see a men"이 되므로 명사만 넣는다 — sentence.ts가 걸러낸다)
 */
export const TEMPLATES: SentenceTemplate[] = [
  { en: 'I see a %n.', ko: '나는 %k{을/를} 봐요.', slots: 1 },
  { en: 'I like the %n.', ko: '나는 %k{을/를} 좋아해요.', slots: 1 },
  { en: 'It is a %n.', ko: '그것은 %k{이에요/예요}.', slots: 1 },
  // big은 단모음 낱말이라 단계 1부터 읽을 수 있다
  { en: 'The %n is big.', ko: '그 %k{은/는} 커요.', slots: 1, minStage: 1 },
  { en: 'Can you see the %n?', ko: '%k{이/가} 보이나요?', slots: 1 },
  { en: 'I can see a %n and a %n.', ko: '%k{과/와} %k{이/가} 보여요.', slots: 2 },
  { en: 'A %n is not a %n.', ko: '%k{은/는} %k{이/가} 아니에요.', slots: 2 },
]

/** 생활 표현 한 줄 */
export interface Phrase {
  en: string
  ko: string
  /** 어떤 상황에서 쓰는 말인가 */
  scene: SceneId
}

export type SceneId = 'hello' | 'ask' | 'feel' | 'play' | 'class' | 'meal' | 'help'

export const SCENES: { id: SceneId; emoji: string; name: string; detail: string }[] = [
  { id: 'hello', emoji: '👋', name: '인사', detail: '만나고 헤어질 때' },
  { id: 'ask', emoji: '🙏', name: '부탁', detail: '해 달라고 말할 때' },
  { id: 'feel', emoji: '😊', name: '기분', detail: '지금 어떤지 말할 때' },
  { id: 'play', emoji: '🧸', name: '놀이', detail: '친구랑 놀 때' },
  { id: 'class', emoji: '🎒', name: '교실', detail: '선생님과 있을 때' },
  { id: 'meal', emoji: '🍚', name: '밥', detail: '먹을 때' },
  { id: 'help', emoji: '🤕', name: '도움', detail: '아프거나 힘들 때' },
]

/**
 * 유치원 생활 표현.
 *
 * 고른 기준: ①아이가 **하루에 한 번은 쓸 말** ②짧아서 통째로 외워지는 말
 * ③어른이 되받아 줄 수 있는 말(부모가 같은 상황에서 되풀이해 주면 그 자리에서 굳는다).
 * 문법 설명이 필요한 말(현재완료 등)은 넣지 않는다.
 */
export const PHRASES: Phrase[] = [
  // 👋 인사
  { en: 'Hello!', ko: '안녕!', scene: 'hello' },
  { en: 'Good morning!', ko: '좋은 아침!', scene: 'hello' },
  { en: 'How are you?', ko: '어떻게 지내?', scene: 'hello' },
  { en: "I'm fine, thank you.", ko: '잘 지내요, 고마워요.', scene: 'hello' },
  { en: 'What is your name?', ko: '이름이 뭐야?', scene: 'hello' },
  { en: 'My name is ...', ko: '내 이름은 ...이에요.', scene: 'hello' },
  { en: 'Goodbye!', ko: '안녕히 가세요!', scene: 'hello' },
  { en: 'See you tomorrow!', ko: '내일 봐요!', scene: 'hello' },

  // 🙏 부탁
  { en: 'Please help me.', ko: '도와주세요.', scene: 'ask' },
  { en: 'Can I have some water?', ko: '물 좀 주실래요?', scene: 'ask' },
  { en: 'Can I go to the bathroom?', ko: '화장실 가도 되나요?', scene: 'ask' },
  { en: 'Open it, please.', ko: '이거 열어 주세요.', scene: 'ask' },
  { en: 'One more time, please.', ko: '한 번 더 해 주세요.', scene: 'ask' },
  { en: 'Thank you!', ko: '고마워요!', scene: 'ask' },
  { en: "You're welcome.", ko: '천만에요.', scene: 'ask' },
  { en: "I'm sorry.", ko: '미안해요.', scene: 'ask' },

  // 😊 기분
  { en: "I'm happy!", ko: '기분이 좋아요!', scene: 'feel' },
  { en: "I'm sad.", ko: '슬퍼요.', scene: 'feel' },
  { en: "I'm hungry.", ko: '배고파요.', scene: 'feel' },
  { en: "I'm thirsty.", ko: '목말라요.', scene: 'feel' },
  { en: "I'm sleepy.", ko: '졸려요.', scene: 'feel' },
  { en: "I'm tired.", ko: '피곤해요.', scene: 'feel' },
  { en: 'I like it!', ko: '이거 좋아요!', scene: 'feel' },
  { en: "I don't like it.", ko: '이건 싫어요.', scene: 'feel' },

  // 🧸 놀이
  { en: "Let's play!", ko: '같이 놀자!', scene: 'play' },
  { en: 'My turn!', ko: '내 차례!', scene: 'play' },
  { en: 'Your turn.', ko: '네 차례야.', scene: 'play' },
  { en: 'Can I play too?', ko: '나도 같이 놀아도 돼?', scene: 'play' },
  { en: "Let's share.", ko: '같이 쓰자.', scene: 'play' },
  { en: 'That is mine.', ko: '그건 내 거야.', scene: 'play' },
  { en: 'Wait for me!', ko: '나 기다려 줘!', scene: 'play' },
  { en: 'Good job!', ko: '잘했어!', scene: 'play' },

  // 🎒 교실
  { en: 'Good morning, teacher.', ko: '선생님, 안녕하세요.', scene: 'class' },
  { en: "I'm here!", ko: '저 왔어요!', scene: 'class' },
  { en: 'Look at me!', ko: '저를 봐 주세요!', scene: 'class' },
  { en: "I don't know.", ko: '모르겠어요.', scene: 'class' },
  { en: 'I have a question.', ko: '질문이 있어요.', scene: 'class' },
  { en: "I'm done!", ko: '다 했어요!', scene: 'class' },
  { en: 'Me too!', ko: '저도요!', scene: 'class' },
  { en: 'Sit down, please.', ko: '앉아 주세요.', scene: 'class' },

  // 🍚 밥
  { en: "Let's eat!", ko: '먹자!', scene: 'meal' },
  { en: 'It is yummy!', ko: '맛있어요!', scene: 'meal' },
  { en: 'I want more, please.', ko: '더 주세요.', scene: 'meal' },
  { en: 'No, thank you.', ko: '괜찮아요, 안 먹을래요.', scene: 'meal' },
  { en: 'It is hot!', ko: '뜨거워요!', scene: 'meal' },
  { en: 'I finished.', ko: '다 먹었어요.', scene: 'meal' },

  // 🤕 도움
  { en: 'It hurts.', ko: '아파요.', scene: 'help' },
  { en: 'I need help.', ko: '도움이 필요해요.', scene: 'help' },
  { en: "I'm okay.", ko: '괜찮아요.', scene: 'help' },
  { en: 'Where is my mum?', ko: '엄마 어디 있어요?', scene: 'help' },
  { en: 'I want to go home.', ko: '집에 가고 싶어요.', scene: 'help' },
]
