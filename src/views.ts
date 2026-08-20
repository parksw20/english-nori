/**
 * 화면들 — 지도(마을 목록), 낱말 도감, 결과, 부모 리포트.
 *
 * 아이 화면과 부모 화면을 일부러 다르게 만든다: 아이 쪽은 크고 그림 위주, 부모 쪽은 작고 조용한 표.
 * 부모 화면에는 **검증하지 못한 것을 그대로 적는다**(발음 채점을 안 했으면 "미채점"이라고 쓴다).
 */
import { LETTERS, STAGE_NAMES, SHORT_VOWELS } from './data/phonics'
import { WORDS } from './data/words'
import { MAX_STAGE, type StageId, type Word } from './data/types'
import { cvcByVowel, cvcWordsUpTo, wordsUpTo } from './phonics'
import * as cards from './cards'
import * as progress from './progress'
import * as srs from './srs'
import * as tts from './tts'
import { bigButton, el, render, top, topLink } from './ui'

/** 어른이 가끔 여는 화면용 작은 버튼 — 색을 쓰지 않고 테두리만 둔다(아이 눈길을 끌 이유가 없다) */
function miniButton(emoji: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', { class: 'en-mini' }, [
    el('span', { class: 'en-mini-emoji', text: emoji }),
    el('span', { text: label }),
  ])
  b.addEventListener('click', onClick)
  return b
}

/** 마을 아이콘 */
const VILLAGE_EMOJI: Record<number, string> = { 0: '🔤', 1: '🏡' }

export interface MapActions {
  onVillage: (stage: StageId) => void
  onCollection: () => void
  onWordbook: () => void
  onAbc: () => void
  onManual: () => void
  onSettings: () => void
  onParent: () => void
}

/**
 * 성취 타일 — **지금 어디까지 왔는지 한눈에** 보여준다.
 *
 * 아이에게는 숫자가 목표가 된다: "배운 낱말 16/50"이 보이면 그 칸을 채우고 싶어진다.
 * 그래서 분모가 있는 값(배운 낱말)과 오늘 할 일(복습할 것)을 나란히 둔다.
 */
function statTiles(stage: StageId): HTMLElement {
  const all = wordsUpTo(stage).map((w) => w.en)
  const sum = srs.summary(all)
  const p = progress.get()
  const tiles: { big: string; label: string }[] = [
    { big: `${sum.learned} / ${sum.total}`, label: '배운 낱말' },
    { big: String(sum.due), label: '오늘 복습할 것' },
    { big: String(sum.mastered), label: '잘 익은 낱말' },
    { big: `${p.certificates.length}개`, label: '수료증' },
  ]
  return el(
    'div',
    { class: 'en-stats' },
    tiles.map((t) =>
      el('div', { class: 'en-stat' }, [
        el('span', { class: 'en-stat-big', text: t.big }),
        el('span', { class: 'en-stat-label', text: t.label }),
      ])
    )
  )
}

/**
 * 목표 막대 — 이 단계의 낱말을 얼마나 익혔는지.
 * 채워지는 것이 보여야 "다 채우고 싶다"가 생긴다.
 */
function goalBar(stage: StageId): HTMLElement {
  const all = wordsUpTo(stage).map((w) => w.en)
  const sum = srs.summary(all)
  const pct = sum.total === 0 ? 0 : Math.round((sum.learned / sum.total) * 100)
  const fill = el('span')
  fill.style.width = `${pct}%`
  return el('div', { class: 'en-goal' }, [
    el('div', { class: 'en-goal-top' }, [
      el('span', { text: `${STAGE_NAMES[stage]} 낱말 모으기` }),
      el('span', { class: 'en-goal-pct', text: `${pct}%` }),
    ]),
    el('div', { class: 'en-q-bar' }, [fill]),
  ])
}

/** 지도 — 마을을 고른다. 앞 마을 시험에 합격해야 다음 마을이 열린다 */
export function showMap(a: MapActions): void {
  const villages: Node[] = []
  for (let s = 0 as StageId; s <= MAX_STAGE; s = (s + 1) as StageId) {
    const unlocked = progress.isUnlocked(s)
    const words = wordsUpTo(s).length
    const learned = srs.summary(wordsUpTo(s).map((w) => w.en)).learned
    const b = el(
      'button',
      { class: 'en-map-village', disabled: !unlocked },
      [
        el('span', { class: 'en-map-icon', text: unlocked ? (VILLAGE_EMOJI[s] ?? '🏠') : '🔒' }),
        el('span', { class: 'en-map-name' }, [
          `${s + 1}. ${STAGE_NAMES[s]}`,
          el('span', {
            class: 'en-map-meta',
            text: unlocked ? `낱말 ${learned} / ${words} 익힘` : '앞 마을 시험에 합격하면 열려요',
          }),
        ]),
        el('span', { class: 'en-map-cert', text: progress.hasCertificate(s) ? '🏅' : '' }),
      ]
    )
    if (unlocked) b.addEventListener('click', () => a.onVillage(s))
    villages.push(b)
  }

  const p = progress.get()
  const top_ = progress.topUnlockedStage()
  // 영어 음성이 없는 기기(음성 미설치 브라우저 등)에서는 소리 문제가 성립하지 않는다 →
  // 아이가 아니라 **부모가 읽을** 안내를 조용히 띄운다.
  const noVoice = !tts.hasVoice()
  render(
    top('영어놀이 🗺️', undefined, `스티커 ${p.stickers.length}장`),
    noVoice
      ? el('div', { class: 'en-parent-note' }, [
          el('p', {
            text: '이 기기에는 영어 음성이 없어서 소리가 나지 않습니다. Chrome 또는 Edge에서 열거나 Windows 설정에서 영어 음성을 추가해 주세요. (소리가 없으면 듣기 문제는 글자로 대신 보여 줍니다)',
          }),
        ])
      : el('div'),
    el('div', {}, villages),
    goalBar(top_),
    statTiles(top_),
    // 알파벳이 먼저다 — 글자를 알아야 낱말이 읽힌다. 배우는 순서대로 놓는다
    bigButton('🔤', 'ABC 알파벳', a.onAbc, { sub: '글자를 눌러 낱말을 쳐 봐요' }),
    bigButton('📖', '낱말 도감', a.onCollection, { sub: '모은 낱말을 구경해요' }),
    bigButton('📒', '단어장', a.onWordbook, {
      sub: `카드 ${cards.total()}장 · 만든 낱말 ${cards.completedWords().length}개`,
    }),
    // 놀이 방법·설정·부모님 화면은 **아이가 노는 것이 아니라 어른이 가끔 여는 곳**이다.
    // 큰 주황 버튼으로 두면 화면의 절반을 차지해 정작 놀이가 아래로 밀린다 → 작은 한 줄로 내린다.
    el('div', { class: 'en-minirow' }, [
      miniButton('📘', '놀이 방법', a.onManual),
      miniButton('⚙️', '설정', a.onSettings),
      miniButton('👨‍👩‍👧', '부모님', a.onParent),
    ]),
    p.stickers.length > 0 ? el('div', { class: 'en-sticker-row' }, p.stickers.map((s) => el('span', { text: s }))) : el('div')
  )
}

export interface VillageActions {
  onToday: () => void
  onGame: (id: GameId) => void
  onExam: () => void
  onBack: () => void
}

export type GameId =
  | 'soundhunt'
  | 'wordbuild'
  | 'intercept'
  | 'shisen'
  | 'match'
  | 'sentence'
  | 'phrases'
  | 'speak'

/**
 * 미니게임 목록 — 이름·설명·기록 읽는 법을 한곳에 둔다.
 *
 * 기록을 **게임 버튼에 바로** 적는 이유: 아이가 "최고 기록!"을 봤으면 그 기록이 어디 있는지
 * 다음에 열었을 때 보여야 한다. 따로 기록 화면을 만들면 7세는 찾아가지 않는다.
 */
const GAMES = [
  {
    id: 'soundhunt' as const,
    emoji: '👂',
    name: '소리 사냥',
    sub: '소리를 듣고 찾아요',
    /** 많을수록 좋은 기록 */
    best: () => {
      const b = progress.bestOf('soundhunt')
      return b > 0 ? `최고 ${b}개 맞힘` : null
    },
    /** 읽을 수 있는 낱말(CVC)이 있어야 성립하는 게임인가 */
    needsCvc: false,
  },
  {
    id: 'wordbuild' as const,
    emoji: '🧩',
    name: '낱말 만들기',
    sub: '글자를 순서대로 놓아요',
    best: () => {
      const b = progress.bestOf('wordbuild')
      return b > 0 ? `최고 ${b}개 한 번에 성공` : null
    },
    needsCvc: true,
  },
  {
    id: 'intercept' as const,
    emoji: '🚀',
    name: '낱말 요격',
    sub: '떨어지는 낱말을 읽고 그림을 맞혀요',
    best: () => {
      const b = progress.bestOf('intercept')
      return b > 0 ? `최고 ${b}점` : null
    },
    needsCvc: true,
  },
  {
    id: 'shisen' as const,
    emoji: '🀄',
    name: '사천성',
    sub: '낱말과 그림을 길로 이어 없애요',
    best: () => {
      const b = progress.bestTimeOf('shisen')
      return b !== null ? `최고 ${b}초` : null
    },
    needsCvc: true,
  },
  {
    id: 'match' as const,
    emoji: '🃏',
    name: '그림 짝맞추기',
    sub: '같은 낱말과 그림을 찾아요',
    best: () => {
      const b = progress.bestTimeOf('match')
      return b !== null ? `최고 ${b}번 뒤집어 완성` : null
    },
    needsCvc: true,
  },
  {
    id: 'sentence' as const,
    emoji: '📝',
    name: '문장 놀이',
    sub: '듣고 → 순서대로 놓고 → 따라 말해요',
    best: () => {
      const b = progress.bestOf('sentence')
      return b > 0 ? `최고 ${b}개 맞힘` : null
    },
    // 문장을 만들려면 그림으로 알아볼 수 있는 단수 명사가 몇 개는 있어야 한다
    needsCvc: true,
  },
  {
    id: 'phrases' as const,
    emoji: '🗣️',
    name: '생활 표현',
    sub: '유치원에서 쓰는 말을 따라 말해요',
    best: () => null,
    needsCvc: false,
  },
  {
    id: 'speak' as const,
    emoji: '🎤',
    name: '말하기',
    sub: '내 소리와 원어민 소리를 비교해요',
    best: () => null,
    needsCvc: false,
  },
]

/** 마을 안 — 오늘의 놀이, 미니게임, 시험 */
export function showVillage(stage: StageId, a: VillageActions): void {
  const cool = progress.examCooldownLeft(stage)
  const words = wordsUpTo(stage).map((w) => w.en)
  const sum = srs.summary(words)
  const cvcCount = cvcWordsUpTo(stage).length

  const kids: Node[] = [
    bigButton('🌟', '오늘의 놀이', a.onToday, {
      sub:
        progress.bestOf('today') > 0
          ? `복습할 것 ${sum.due}개 · 🏆 최고 ${progress.bestOf('today')}개 맞힘`
          : `새 낱말과 복습 — 10분이면 끝나요 (복습할 것 ${sum.due}개)`,
    }),
  ]
  for (const g of GAMES) {
    // 낱말 만들기·사천성·짝맞추기는 읽을 수 있는 낱말(CVC)이 6개 이상 있어야 성립한다
    if (g.needsCvc && cvcCount < 6) continue
    const record = g.best()
    // 기록이 있으면 설명 대신 기록을 보여준다 — "최고 기록!"을 본 아이가
    // 다음에 열었을 때 그 기록을 찾을 곳이 있어야 한다
    kids.push(bigButton(g.emoji, g.name, () => a.onGame(g.id), { sub: record ? `🏆 ${record}` : g.sub }))
  }
  kids.push(
    bigButton('🏅', progress.hasCertificate(stage) ? '마을 시험 다시 보기' : '마을 시험', a.onExam, {
      sub: cool > 0 ? `${Math.ceil(cool / 60000)}분 뒤에 다시 볼 수 있어요` : '20문제 중 14개를 맞히면 합격',
      disabled: cool > 0,
    })
  )

  render(
    top(STAGE_NAMES[stage], a.onBack, `익힘 ${sum.learned}/${sum.total}`),
    goalBar(stage),
    el('div', {}, kids)
  )
}

/** 도감에서 무엇을 보고 있나 — `all`이면 낱말 전체, 아니면 그 알파벳 */
export type DexFilter = 'all' | string

/** 낱말 카드 한 장 (누르면 읽어 준다) */
function dexCard(w: Word): HTMLElement {
  const lv = srs.levelOf(w.en)
  const faded = srs.isFaded(w.en)
  const g = srs.GROWTH[lv]
  const c = el('button', { class: `en-dex-card en-lv-${lv}${faded ? ' en-is-faded' : ''}`, 'data-word': w.en }, [
    // 자람 표시는 색과 **겹쳐서** 알린다 — 색약이거나 화면이 어두우면 색만으로는 단계가 안 보인다
    el('span', { class: 'en-dex-grow', text: g.icon, title: g.name, 'aria-label': g.name }),
    el('span', { class: 'en-dex-emoji', text: w.emoji }),
    el('span', { class: 'en-dex-en', text: w.en }),
    el('span', { class: 'en-dex-ko', text: w.ko }),
  ])
  // 카드를 누르면 읽어 준다 — 글씨를 못 읽는 아이가 도감을 구경하는 방법
  c.addEventListener('click', () => tts.say(w.en))
  return c
}

/**
 * 낱말 도감 — 낱말 카드가 SRS 단계에 따라 색이 짙어진다.
 *
 * 보기가 둘이다:
 * - **전체** — 지금까지 나온 낱말을 전부 (원래 화면)
 * - **알파벳별** — 그 글자의 알파벳 카드(이름·소리·대표 낱말)와 그 글자로 시작하는 낱말들
 *
 * 알파벳 탭은 낱말이 하나도 없는 글자(q·v처럼)도 **빼지 않는다**. 알파벳은 26자를 다 배우는 것이고,
 * 빈 탭이 있어야 아이가 "여기는 아직 낱말이 없구나"를 알 수 있다.
 */
export function showCollection(onBack: () => void, onAbc?: () => void, filter: DexFilter = 'all'): void {
  const stage = progress.topUnlockedStage()
  const words = wordsUpTo(stage)
  const redraw = (f: DexFilter): void => showCollection(onBack, onAbc, f)

  /** 그 글자로 시작하는 낱말 (x는 첫소리로 쓰지 않으니 낱말 안에 든 것으로 본다) */
  const wordsOf = (ch: string): Word[] => {
    const letter = LETTERS.find((l) => l.ch === ch)
    return letter?.position === 'final'
      ? words.filter((w) => w.en.includes(ch))
      : words.filter((w) => w.en.startsWith(ch))
  }

  // ── 탭 줄: 전체 + a~z ───────────────────────────────────
  const tabs = el('div', { class: 'en-dex-tabs' })
  const tab = (label: string, value: DexFilter, sub?: string): HTMLElement => {
    const b = el('button', { class: `en-dex-tab${filter === value ? ' en-is-sel' : ''}`, 'data-tab': value }, [
      el('span', { class: 'en-dex-tab-main', text: label }),
      ...(sub ? [el('span', { class: 'en-dex-tab-sub', text: sub })] : []),
    ])
    b.addEventListener('click', () => {
      // **알파벳 탭을 누르면 그 글자를 읽어 준다.** 화면을 바꾸는 것만으로는 아이가 글자 이름을 배울 수 없다 —
      // 누르는 것이 곧 듣는 것이어야 한다(「전체」는 낱말이 아니라 보기 이름이라 읽지 않는다).
      if (value !== 'all') tts.say(value)
      redraw(value)
    })
    return b
  }
  tabs.append(tab('전체', 'all', `${words.length}개`))
  for (const l of LETTERS) {
    const n = wordsOf(l.ch).length
    tabs.append(tab(l.ch, l.ch, n > 0 ? `${n}개` : '·'))
  }

  const kids: Node[] = [tabs]

  if (filter === 'all') {
    kids.push(
      el('div', { class: 'en-dex-legend' }, [
        el('span', { text: '많이 맞히고 오래 기억할수록 자라요:' }),
        el('span', { text: '· 씨앗 → 🌱 새싹 → 🌿 풀 → 🌳 나무 → 🌸 꽃.' }),
        el('span', { text: '한 번 자라면 내려가지 않아요. 복습할 때가 지나면 테두리가 빨개져요(시듦).' }),
      ]),
      el('div', { class: 'en-dex-grid' }, words.map(dexCard))
    )
  } else {
    const letter = LETTERS.find((l) => l.ch === filter)
    const keyword = letter ? words.find((w) => w.en === letter.keyword) : undefined
    const mine = wordsOf(filter)

    if (letter) {
      // 알파벳 카드 — 글자·이름·소리·대표 낱말. 누르면 글자 이름을 읽어 준다
      const big = el('button', { class: 'en-abc-card', 'data-letter': letter.ch }, [
        el('span', { class: 'en-abc-ch', text: `${letter.ch} ${letter.ch.toUpperCase()}` }),
        el('span', { class: 'en-abc-name', text: `이름 ${letter.name} · 소리 ${letter.sound}` }),
        el('span', {
          class: 'en-abc-key',
          text: `${keyword?.emoji ?? ''} ${letter.keyword}${letter.position === 'final' ? ' (끝소리)' : ''}`,
        }),
      ])
      big.addEventListener('click', () => tts.say(letter.ch))
      kids.push(big)

      const hear = el('button', { class: 'en-mk-hear', text: `🔊 ${letter.keyword} 들어보기` })
      hear.addEventListener('click', () => tts.blend(letter.keyword))
      kids.push(hear)
    }

    kids.push(
      el('p', {
        class: 'en-q-ask',
        text: mine.length
          ? letter?.position === 'final'
            ? `${filter}가 들어간 낱말 ${mine.length}개`
            : `${filter}로 시작하는 낱말 ${mine.length}개`
          : '이 글자로 된 낱말은 아직 없어요',
      })
    )
    if (mine.length) kids.push(el('div', { class: 'en-dex-grid' }, mine.map(dexCard)))
  }

  render(
    top(
      '낱말 도감 📖',
      onBack,
      filter === 'all' ? `${words.length}개` : filter,
      onAbc ? topLink('🔤 ABC', onAbc) : undefined
    ),
    el('div', {}, kids)
  )
}

/**
 * 틀린 문제 되돌아보기 — 시험이 끝난 뒤에만 보여준다.
 *
 * 아이용이라 **"틀렸다"는 말을 쓰지 않는다**: 제목은 "다시 들어 볼 낱말"이고, 카드를 누르면 정답 소리가 난다.
 * 아이가 고른 답은 작은 글씨로 아래에 둔다 — 부모가 무엇과 헷갈렸는지 알아야 도와줄 수 있다.
 * (cat을 cap으로 고른 것과 zoo로 고른 것은 완전히 다른 문제다)
 */
export function wrongReview(misses: { answer: string; chosen: string; word?: string }[]): Node {
  if (misses.length === 0) return el('div')
  const emojiOf = new Map(WORDS.map((w) => [w.en, w.emoji]))

  const cards = misses.map((m) => {
    const emoji = m.word ? emojiOf.get(m.word) : undefined
    const label = m.word ?? m.answer
    const c = el('button', { class: 'en-dex-card' }, [
      el('span', { class: 'en-dex-emoji', text: emoji ?? '🔊' }),
      el('span', { class: 'en-dex-en', text: label }),
      // 글자를 묻는 문제였다면 정답 글자를 따로 보여준다 (낱말과 정답이 다르다)
      m.answer !== label ? el('span', { class: 'en-dex-ko', text: `정답 ${m.answer}` }) : el('span', { class: 'en-dex-ko', text: ' ' }),
      // 고른 답이 낱말이면 그림도 같이 보여준다 — 보기가 그림으로 나왔던 문제(letter-word)에서는
      // 글자만 적어 주면 아이가 자기가 뭘 눌렀는지 알아보지 못한다
      el('span', { class: 'en-dex-ko', text: `고른 답 ${emojiOf.get(m.chosen) ?? ''}${m.chosen}` }),
    ])
    c.addEventListener('click', () => tts.say(m.word ?? m.answer))
    return c
  })

  return el('div', {}, [
    el('p', { class: 'en-q-ask', text: `다시 들어 볼 낱말 ${misses.length}개 — 눌러서 소리를 들어 봐 🔊` }),
    el('div', { class: 'en-dex-grid' }, cards),
  ])
}

/** 놀이 결과 화면 */
export function showResult(o: {
  emoji: string
  title: string
  score?: string
  extra?: Node[]
  onAgain?: () => void
  onBack: () => void
}): void {
  const kids: Node[] = [
    el('div', { class: 'en-result-emoji', text: o.emoji }),
    el('div', { class: 'en-result-title', text: o.title }),
  ]
  if (o.score) kids.push(el('div', { class: 'en-result-score', text: o.score }))
  if (o.extra) kids.push(...o.extra)

  const buttons: Node[] = []
  if (o.onAgain) buttons.push(bigButton('🔁', '한 번 더', o.onAgain))
  buttons.push(bigButton('🗺️', '지도로 돌아가기', o.onBack))

  render(top('잘했어요!', o.onBack), el('div', { class: 'en-result' }, kids), el('div', {}, buttons))
}

/**
 * 부모님 화면 — 오늘 무엇을 했는지, 무엇이 약한지.
 * **채점하지 않은 것은 "미채점"이라고 밝힌다.** 발음은 브라우저가 못 알아들으면 채점 자체가 없다.
 */
export function showParent(onBack: () => void): void {
  const p = progress.get()
  const today = progress.dayKey()
  const stage = progress.topUnlockedStage()
  const all = wordsUpTo(stage).map((w) => w.en)
  const sum = srs.summary(all)

  // 모음별로 얼마나 익혔나 — 어느 소리가 약한지 한눈에 보이게
  const byVowel = cvcByVowel(stage)
  const vowelRows = SHORT_VOWELS.map((v) => {
    const ws = byVowel[v.v]
    const learned = ws.filter((w) => !srs.isNew(w.en)).length
    const wrong = ws.reduce((n, w) => n + srs.stateOf(w.en).wrong, 0)
    return el('tr', {}, [
      el('td', { text: `${v.v} (${v.sound}) — ${v.example}` }),
      el('td', { text: `${learned}/${ws.length}` }),
      el('td', { text: String(wrong) }),
    ])
  })

  // 자주 틀리는 낱말 5개
  const weak = [...all]
    .map((en) => ({ en, s: srs.stateOf(en) }))
    .filter((x) => x.s.wrong > 0)
    .sort((a, b) => b.s.wrong - a.s.wrong)
    .slice(0, 5)

  const exams = p.exams.slice(0, 5).map((e) =>
    el('tr', {}, [
      el('td', { text: new Date(e.at).toLocaleDateString('ko-KR') }),
      el('td', { text: STAGE_NAMES[e.stage] }),
      el('td', { text: `${e.score}/${e.total} ${e.passed ? '합격' : '아직'}` }),
    ])
  )

  render(
    top('부모님 화면', onBack),
    el('div', { class: 'en-parent' }, [
      el('p', {
        text: `오늘 ${today} · 연속 ${progress.streak(today)}일 · 스티커 ${p.stickers.length}장 · 익힌 낱말 ${sum.learned}/${sum.total} (복습할 것 ${sum.due}개)`,
      }),

      el('h2', { text: '소리별 진행' }),
      el('div', { class: 'en-scroll-x' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [el('th', { text: '모음' }), el('th', { text: '익힘' }), el('th', { text: '틀린 횟수' })])]),
          el('tbody', {}, vowelRows),
        ]),
      ]),

      el('h2', { text: '자주 틀리는 낱말' }),
      weak.length
        ? el('div', { class: 'en-scroll-x' }, [
            el('table', {}, [
              el('tbody', {}, weak.map((w) => el('tr', {}, [el('td', { text: w.en }), el('td', { text: `${w.s.wrong}번` })]))),
            ]),
          ])
        : el('p', { text: '아직 없습니다.' }),

      el('h2', { text: '놀이 기록' }),
      (() => {
        const rows = GAMES.map((g) => ({ name: g.name, rec: g.best() })).filter((x) => x.rec !== null)
        const today = progress.bestOf('today')
        if (rows.length === 0 && today === 0) return el('p', { text: '아직 기록이 없습니다.' })
        return el('div', { class: 'en-scroll-x' }, [
          el('table', {}, [
            el('tbody', {}, [
              ...(today > 0 ? [el('tr', {}, [el('td', { text: '오늘의 놀이' }), el('td', { text: `최고 ${today}개 맞힘` })])] : []),
              ...rows.map((r) => el('tr', {}, [el('td', { text: r.name }), el('td', { text: r.rec as string })])),
            ]),
          ]),
        ])
      })(),

      el('h2', { text: '지난 시험에서 틀린 문제' }),
      (() => {
        const last = p.exams.find((e) => (e.misses?.length ?? 0) > 0)
        if (!last) return el('p', { text: p.exams.length ? '틀린 문제가 없습니다.' : '아직 시험을 보지 않았습니다.' })
        return el('div', {}, [
          el('p', {
            text: `${new Date(last.at).toLocaleDateString('ko-KR')} ${STAGE_NAMES[last.stage]} · ${last.score}/${last.total}`,
          }),
          el('div', { class: 'en-scroll-x' }, [
            el('table', {}, [
              el('thead', {}, [
                el('tr', {}, [el('th', { text: '문제' }), el('th', { text: '정답' }), el('th', { text: '아이가 고른 답' })]),
              ]),
              el(
                'tbody',
                {},
                (last.misses ?? []).map((m) =>
                  el('tr', {}, [
                    el('td', { text: m.word ?? '—' }),
                    el('td', { text: m.answer }),
                    el('td', { text: m.chosen }),
                  ])
                )
              ),
            ]),
          ]),
        ])
      })(),

      el('h2', { text: '마을 시험 기록' }),
      exams.length
        ? el('div', { class: 'en-scroll-x' }, [el('table', {}, [el('tbody', {}, exams)])])
        : el('p', { text: '아직 시험을 보지 않았습니다.' }),

      el('h2', { text: '알아 두실 것' }),
      el('div', { class: 'en-parent-note' }, [
        el('p', {
          text:
            '발음(말하기)은 브라우저가 아이 목소리를 알아듣지 못하면 채점하지 않습니다. ' +
            '채점이 없어도 녹음을 원어민 소리와 번갈아 들으며 스스로 비교하는 것이 연습입니다. ' +
            '이 화면의 숫자에는 발음 점수가 들어 있지 않습니다(미채점).',
        }),
        el('p', {
          text: `한 세션은 10~15분으로 끝나게 만들었습니다. 하루에 여러 번 놀아도 스티커는 하루 한 장입니다. 알파벳 ${LETTERS.length}자와 단모음 낱말이 현재 범위입니다.`,
        }),
      ]),
    ])
  )
}
