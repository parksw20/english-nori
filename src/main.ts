/**
 * 앱 뼈대 — 화면 사이를 옮겨 다닌다.
 *
 * 라우터를 쓰지 않는다: 화면이 열 개도 안 되고, 아이가 뒤로가기 버튼으로 놀이를 빠져나가는 것보다
 * 화면 안의 큰 ← 버튼이 확실하다. 대신 **주소창에 상태를 남기지 않는다**는 뜻이므로
 * 진행 상황은 전부 localStorage에 있다.
 */
import './style.css'
import type { StageId } from './data/types'
import { examFor, generateExam } from './exam'
import { runMatch } from './games/match'
import { runPhrases } from './games/phrases'
import { runSentence } from './games/sentence'
import { runIntercept } from './games/intercept'
import { runShisen } from './games/shisen'
import { runSoundHunt } from './games/soundhunt'
import { runSpeak } from './games/speak'
import { runWordBuild } from './games/wordbuild'
import * as cards from './cards'
import * as prefs from './prefs'
import * as progress from './progress'
import { runQuiz } from './quiz'
import * as sfx from './sfx'
import * as srs from './srs'
import * as tts from './tts'
import { pickRewards, examRewardCount } from './reward'
import { el, letterCards } from './ui'
import { showAbc } from './abc'
import { showManual } from './manual'
import { showSettings } from './settings'
import { showWordbook } from './wordbook'
import { showCollection, showMap, showParent, showResult, showVillage, wrongReview, type GameId } from './views'

/** 지금 보고 있는 마을 (놀이가 끝나면 이 마을로 돌아온다) */
let current: StageId = 0

/**
 * 카드 n장을 주고 **결과 화면에 넣을 조각**을 돌려준다.
 *
 * 처음에는 결과 화면 **앞에** 안내창으로 띄웠는데, 아이가 점수를 보기 전에 카드가 지나가 버려
 * "무엇 때문에 받았는지"와 카드가 이어지지 않았다. 결과 화면 안에서 점수와 함께 보여주면
 * 다시 볼 수 있고, 몇 점에 몇 장인지도 눈에 남는다. 0장이면 아무것도 넣지 않는다.
 *
 * 카드는 직접 그린 황금카드다 — 🎴(화투 이모지)는 이 앱과 무관하고 받은 글자가 보이지 않는다.
 */
function grantCards(n: number): Node[] {
  const got = pickRewards(current, n)
  if (got.length === 0) return []
  cards.addMany(got)
  return [
    el('p', { class: 'en-result-score', text: `글자 카드 ${got.length}장을 받았어요!` }),
    letterCards(got),
    el('p', { class: 'en-result-note', text: '단어장에서 낱말을 만들어 봐요 📒' }),
  ]
}

// 짝이 되는 두 화면 — 서로의 오른쪽 위 버튼이 상대를 부른다.
// 뒤로(←)는 둘 다 지도로 간다: 아이가 두 화면 사이를 오갔다고 해서 나가는 길이 길어지면 안 된다
function toDex(): void {
  tts.stop()
  showCollection(toMap, toAbc)
}

function toAbc(): void {
  tts.stop()
  showAbc(toMap, toDex)
}

function toMap(): void {
  tts.stop()
  showMap({
    onVillage: (s) => {
      current = s
      toVillage()
    },
    // 도감 ↔ ABC는 서로 오른쪽 위 버튼으로 건너다닌다(지도를 거치지 않는다)
    onCollection: () => toDex(),
    onAbc: () => toAbc(),
    onWordbook: () => showWordbook(toMap),
    onManual: () => showManual(toMap),
    onSettings: () => showSettings(toMap),
    onParent: () => showParent(toMap),
  })
}

function toVillage(): void {
  tts.stop()
  showVillage(current, {
    onToday: () => void import('./today').then((m) => m.runToday(current, toVillage)),
    onGame: (id) => startGame(id),
    onExam: startExam,
    onBack: toMap,
  })
}

function startGame(id: GameId): void {
  if (id === 'soundhunt') {
    runSoundHunt(current, toVillage, (r) => {
      for (const [word, ok] of r.perWord) srs.review(word, ok ? 'right' : 'wrong')
      const best = progress.recordBest('soundhunt', r.right)
      showResult({
        emoji: r.right === r.total ? '🏆' : '👏',
        title: best ? `최고 기록! ${r.right}개` : '잘했어요!',
        score: `${r.right} / ${r.total} 맞혔어요 (최고 ${progress.bestOf('soundhunt')}개)`,
        // 4문제 맞힐 때마다 1장
        extra: grantCards(Math.floor(r.right / 4)),
        onAgain: () => startGame('soundhunt'),
        onBack: toVillage,
      })
    })
    return
  }
  if (id === 'wordbuild') {
    runWordBuild(current, toVillage, (r) => {
      for (const [word, ok] of r.perWord) srs.review(word, ok ? 'right' : 'wrong')
      const best = progress.recordBest('wordbuild', r.right)
      showResult({
        emoji: '🧩',
        title: best ? `최고 기록! ${r.right}개` : '낱말을 다 만들었어요!',
        score: `${r.right} / ${r.total} 한 번에 성공 (최고 ${progress.bestOf('wordbuild')}개)`,
        // 한 판 끝내면 1장, 전부 한 번에 맞히면 1장 더
        extra: grantCards(1 + (r.right === r.total ? 1 : 0)),
        onAgain: () => startGame('wordbuild'),
        onBack: toVillage,
      })
    })
    return
  }
  if (id === 'intercept') {
    runIntercept(current, toVillage, (r) => {
      for (const [word, ok] of r.perWord) srs.review(word, ok ? 'right' : 'wrong')
      const best = progress.recordBest('intercept', r.score)
      showResult({
        emoji: r.score >= 200 ? '🚀' : '☄️',
        title: best ? `최고 기록! ${r.score}점` : r.score > 0 ? `${r.score}점` : '다음엔 더 읽어 보자!',
        score: `낱말 ${r.solved}개를 읽었어요 (최고 ${progress.bestOf('intercept')}점)`,
        // 100점마다 1장
        extra: grantCards(Math.floor(r.score / 100)),
        onAgain: () => startGame('intercept'),
        onBack: toVillage,
      })
    })
    return
  }
  if (id === 'shisen') {
    runShisen(current, toVillage, (r) => {
      // 이어서 없앤 낱말은 여러 번 보고 들은 것이다 → 복습으로 기록한다
      for (const w of r.words) srs.review(w, 'right')
      // **판을 다 비운 판만** 시간 기록으로 센다 — 기회를 다 써서 끝난 판의 시간은 견줄 수 없다
      const best = r.allCleared && progress.recordBestTime('shisen', r.seconds)
      const prev = progress.bestTimeOf('shisen')
      const shuffleNote = r.shuffles ? ` · 섞기 ${r.shuffles}번` : ''
      showResult({
        emoji: r.allCleared ? '🀄' : '💔',
        title: best
          ? `최고 기록! ${r.seconds}초`
          : r.allCleared
            ? '판을 다 비웠어요!'
            : `${r.cleared}쌍을 없앴어요`,
        score: r.allCleared
          ? `${r.pairs}쌍 · ${r.seconds}초${shuffleNote}${!best && prev !== null ? ` (최고 ${prev}초)` : ''}`
          : `${r.cleared} / ${r.pairs}쌍${shuffleNote} — 기회 5번을 다 썼어요`,
        // 판을 다 비우면 2장 (큰 판은 3장). 기회를 다 썼으면 없다
        extra: grantCards(r.allCleared ? (r.pairs >= 32 ? 3 : 2) : 0),
        onAgain: () => startGame('shisen'),
        onBack: toVillage,
      })
    })
    return
  }
  if (id === 'sentence') {
    runSentence(current, toVillage, (r) => {
      for (const [word, ok] of r.perWord) srs.review(word, ok ? 'right' : 'wrong')
      const best = progress.recordBest('sentence', r.right)
      showResult({
        emoji: r.right === r.total ? '🏆' : '📝',
        title: best ? `최고 기록! ${r.right}개` : '문장 놀이 끝!',
        score: `${r.right} / ${r.total} 맞혔어요 · ${r.spoke}문장 따라 말했어요`,
        // 문장은 낱말 여러 개를 한 번에 다뤘다 → 2장
        extra: grantCards(2),
        onAgain: () => startGame('sentence'),
        onBack: toVillage,
      })
    })
    return
  }
  if (id === 'phrases') {
    runPhrases(toVillage, (r) => {
      showResult({
        emoji: '🗣️',
        title: '생활 표현 연습 끝!',
        score: `${r.spoke} / ${r.total}문장을 따라 말했어요`,
        extra: [
          el('p', {
            class: 'en-result-note',
            text: '오늘 이 말이 필요한 순간에 부모님이 영어로 되받아 주면 그 자리에서 굳어요',
          }),
          ...grantCards(1),
        ],
        onAgain: () => startGame('phrases'),
        onBack: toVillage,
      })
    })
    return
  }
  if (id === 'match') {
    runMatch(current, toVillage, (r) => {
      // 짝을 맞춘 낱말은 "만났다"는 뜻이지 시험한 것은 아니다 → 정답으로 올리되 등급은 보통
      for (const w of r.words) srs.review(w, 'right')
      const best = progress.recordBestTime('match', r.flips)
      const prev = progress.bestTimeOf('match')
      showResult({
        emoji: '🃏',
        title: best ? `최고 기록! ${r.flips}번` : '짝을 다 찾았어요!',
        score: `${r.flips}번 뒤집어서 ${r.pairs}쌍 완성${!best && prev !== null ? ` (최고 ${prev}번)` : ''}`,
        extra: grantCards(1),
        onAgain: () => startGame('match'),
        onBack: toVillage,
      })
    })
    return
  }
  runSpeak(current, toVillage, (r) => {
    for (const [word, ok] of r.scored) srs.review(word, ok ? 'easy' : 'right')
    showResult({
      emoji: '🎤',
      title: '큰 소리로 잘 말했어요!',
      score: r.usedScoring ? `${r.scored.size}개 중 ${[...r.scored.values()].filter(Boolean).length}개 정확` : `${r.said}개 말했어요`,
      extra: r.usedScoring
        ? undefined
        : [el('p', { class: 'en-result-score', text: '이 기기에서는 발음 채점을 못 해요 — 녹음을 비교해 보세요' })],
      onAgain: () => startGame('speak'),
      onBack: toVillage,
    })
  })
}

function startExam(): void {
  const spec = examFor(current)
  runQuiz({
    title: spec.title,
    questions: generateExam(current),
    onQuit: toVillage,
    // 시험에서는 정답을 알려주지 않는다 — 알려주면 다음 문제의 답을 유추한다
    silentMarking: true,
    onDone: (r) => {
      const passed = r.right >= spec.pass
      // 카드 보상은 **처음 합격**일 때 기본 10장이 붙는다 → 기록하기 전에 확인해 둔다
      const firstPass = passed && !progress.hasCertificate(current)
      for (const [word, ok] of r.perWord) srs.review(word, ok ? 'right' : 'wrong')
      progress.recordExam({
        score: r.right,
        total: r.total,
        passed,
        seconds: r.seconds,
        at: Date.now(),
        stage: current,
        misses: r.wrong.map((w) => ({ answer: w.answer, chosen: w.chosen, word: w.word })),
      })
      if (passed) sfx.fanfare()

      const extra: Node[] = []
      if (passed) {
        extra.push(el('p', { class: 'en-result-score', text: '🏅 수료증을 받았어요!' }))
        // 다음 마을이 있으면 열렸다고 알려 준다
        if (progress.isUnlocked((current + 1) as StageId) && (current + 1) <= 1)
          extra.push(el('p', { class: 'en-result-score', text: '다음 마을이 열렸어요! 🗺️' }))
      } else {
        extra.push(el('p', { class: 'en-result-score', text: '조금 더 놀고 다시 보자 — 5분 뒤에 볼 수 있어요' }))
      }
      // 합격선부터 만점까지를 나눠 준다 (0점부터 나누면 합격만 해도 덤을 거의 다 받는다).
      // 카드는 **점수 바로 아래**에 둔다 — 몇 점에 몇 장인지가 한 화면에 같이 보여야 한다.
      extra.push(...grantCards(examRewardCount(r.right, r.total, spec.pass, firstPass)))

      // 시험 중에는 정답을 안 알려줬으니 **끝난 뒤에 틀린 문제를 돌려준다**
      if (r.wrong.length > 0) extra.push(wrongReview(r.wrong))

      showResult({
        emoji: passed ? '🏅' : '🌱',
        title: passed ? `${spec.title} 합격!` : '거의 다 왔어요',
        score: `${r.right} / ${r.total} (합격은 ${spec.pass}개)`,
        extra,
        onBack: toVillage,
      })
    },
  })
}

/** 시작 */
function boot(): void {
  // 테마를 가장 먼저 입힌다 — 늦게 하면 밝은 화면이 한 번 번쩍인다
  prefs.reload()
  tts.initTts()
  srs.reload()
  progress.reload()
  cards.reload()
  current = progress.topUnlockedStage()
  toMap()
}

boot()

/**
 * 검증용 훅 — 브라우저에서 화면을 눌러 보는 대신 콘솔에서 상태를 확인하고 조작할 수 있게 열어 둔다.
 * (한자놀이에서 배운 방식: 패널 스크린샷이 안 될 때 이걸로 실측한다)
 */
declare global {
  interface Window {
    __app?: Record<string, unknown>
  }
}
window.__app = {
  toMap,
  toVillage,
  startExam,
  startGame,
  stage: () => current,
  setStage: (s: StageId) => {
    current = s
    toVillage()
  },
  progress,
  srs,
  tts,
  cards,
  prefs,
}
