/**
 * 오늘의 놀이 — 이 앱의 본체.
 *
 * 새 낱말 4개 + 복습 8개 = 12문제. **끝이 정해져 있다**는 게 중요하다:
 * 7세는 무한히 계속되는 화면 앞에서 스스로 그만두지 못하고, 그러면 다음 날 하기 싫어진다.
 * 끝나면 스티커 한 장(하루 한 장) + 그날 배운 낱말을 보여준다.
 */
import type { StageId } from './data/types'
import { practiceQuestion } from './exam'
import { wordsUpTo } from './phonics'
import * as cards from './cards'
import * as progress from './progress'
import { pickRewards } from './reward'
import { runQuiz } from './quiz'
import * as sfx from './sfx'
import * as srs from './srs'
import { el, letterCards } from './ui'
import { showResult } from './views'

/** 한 세션 크기 — 새 낱말은 4개까지만(더 넣으면 아이가 지친다) */
const SESSION_WORDS = 12
const MAX_NEW = 4

const STICKERS = ['🌟', '🎈', '🍭', '🦄', '🚀', '🐣', '🌈', '🍀', '🎁', '🐳']

export function runToday(stage: StageId, onBack: () => void): void {
  const pool = wordsUpTo(stage)
  const byEn = new Map(pool.map((w) => [w.en, w]))
  const picked = srs.pickSession(
    pool.map((w) => w.en),
    SESSION_WORDS,
    MAX_NEW
  )

  const questions = picked.flatMap((en, k) => {
    const w = byEn.get(en)
    return w ? [practiceQuestion(w, stage, k)] : []
  })

  runQuiz({
    title: '오늘의 놀이',
    questions,
    onQuit: onBack,
    onDone: (r) => {
      // 채점 결과를 SRS에 넘긴다. 만점이면 '척척'으로 올려 다음 복습을 더 멀리 보낸다.
      for (const [word, ok] of r.perWord) srs.review(word, ok ? 'right' : 'wrong')

      const today = progress.dayKey()
      const sticker = STICKERS[Math.floor(Math.random() * STICKERS.length)] ?? '🌟'
      const isNewSticker = progress.finishSession(today, sticker)
      progress.recordBest('today', r.right)
      sfx.fanfare()

      const learned = [...r.perWord.keys()]
        .map((en) => byEn.get(en))
        .filter((w): w is NonNullable<typeof w> => !!w)

      // 오늘의 놀이를 끝내면 카드 2장
      const got = pickRewards(stage, 2)
      cards.addMany(got)

      showResult({
        emoji: isNewSticker ? sticker : '👏',
        title: isNewSticker ? '오늘의 놀이 끝! 스티커 한 장!' : '오늘의 놀이 끝!',
        score: `${r.right} / ${r.total} 맞혔어요`,
        extra: [
          el('p', { class: 'en-result-score', text: `글자 카드 ${got.length}장을 받았어요!` }),
          letterCards(got),
          el('p', { class: 'en-result-note', text: '단어장에서 낱말을 만들어 봐요 📒' }),
          el('p', { class: 'en-result-score', text: '오늘 만난 낱말' }),
          el(
            'div',
            { class: 'en-sticker-row' },
            learned.map((w) => el('span', { text: w.emoji, title: w.en }))
          ),
        ],
        onBack,
      })
    },
  })
}
