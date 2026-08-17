/**
 * 소리 사냥 — 소리를 듣고 글자나 낱말을 고른다. 단계에 따라 문제 유형이 바뀐다.
 *
 * 알파벳 마을(단계 0)에서는 글자 소리를, 단모음 마을(단계 1)에서는 낱말 소리를 사냥한다.
 * 문제 화면은 quiz.ts를 그대로 쓴다 — 오답에 벌을 주지 않는 규칙이 한 곳에만 있게 하려고.
 */
import type { QuestionType } from '../exam'
import { randomQuestions } from '../exam'
import type { StageId } from '../data/types'
import { runQuiz, type QuizResult } from '../quiz'

const ROUNDS = 10

/** 단계별 사냥감 */
function typesFor(stage: StageId): QuestionType[] {
  return stage === 0 ? ['letter-sound', 'picture-initial'] : ['word-listen', 'missing-vowel']
}

export function runSoundHunt(stage: StageId, onQuit: () => void, onDone: (r: QuizResult) => void): void {
  runQuiz({
    title: '소리 사냥',
    questions: randomQuestions(stage, typesFor(stage), ROUNDS),
    onQuit,
    onDone,
  })
}
