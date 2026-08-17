/**
 * 말하기 — 아이 목소리를 다루는 부분.
 *
 * **두 가지 방식이 있고, 기본은 녹음 쪽이다.**
 *
 * 1. `record*` — MediaRecorder로 녹음해서 원어민 소리와 번갈아 들려준다.
 *    채점이 없지만 오프라인·모든 브라우저에서 되고, 스스로 비교하는 것만으로 연습이 성립한다.
 * 2. `listen` — SpeechRecognition으로 받아써서 채점한다. **Chrome/Edge 전용 + 네트워크 필수**라
 *    PWA 오프라인과 충돌한다 → 기능이 없으면 조용히 숨기고 1번만 쓴다.
 *
 * 채점은 관대하게 한다. 7세 목소리 인식률은 낮아서 엄격하게 하면 아이가 맞게 말했는데도
 * 계속 막힌다 — 그러면 놀이가 그 자리에서 끝난다. 그래서 (a) 받아쓴 말 안에 목표 낱말이
 * 들어 있거나 (b) 글자 하나 차이면 통과, (c) 세 번 시도하면 무조건 통과시킨다.
 */

type RecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => RecognitionLike

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** 받아쓰기 채점을 쓸 수 있는가. 오프라인이면 쓸 수 없다(서버로 보내 인식한다) */
export function canScore(): boolean {
  if (!recognitionCtor()) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  return true
}

/** 녹음을 쓸 수 있는가 */
export function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    'MediaRecorder' in window
  )
}

/** 세 번 시도하면 무조건 통과 — 막히면 놀이가 끝난다 */
export const MAX_TRIES = 3

/** 글자 편집 거리 (관대한 채점의 기준) */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...Array<number>(n).fill(0)]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
    }
    prev = cur
  }
  return prev[n] ?? 0
}

/**
 * 받아쓴 말이 목표 낱말과 맞는가 — **관대하게**.
 * 인식기는 낱말 하나를 물어봐도 문장으로 돌려주곤 한다("cat" → "the cat is").
 */
export function judge(transcript: string, target: string): boolean {
  const said = transcript.toLowerCase().replace(/[^a-z ]/g, ' ').trim()
  const want = target.toLowerCase()
  if (!said) return false
  const words = said.split(/\s+/)
  if (words.includes(want)) return true
  // 글자 하나 차이는 통과 (인식기가 cat을 cap으로 적는 일이 흔하다)
  return words.some((w) => editDistance(w, want) <= 1)
}

/**
 * **문장 채점** — 낱말 하나짜리와 다르게 전부/전무로 보지 않는다.
 *
 * 처음에는 문장에 채점을 아예 넣지 않았다. "문장은 인식률이 더 낮다"고 판단했는데 근거가 약했다 —
 * 인식기는 문맥(언어 모델)을 쓰기 때문에 **낱말 하나보다 문장을 더 잘 잡는** 경우가 많다.
 * 문제는 인식률이 아니라 **채점 방식**이었다: 문장을 통째로 대조하면 아이는 거의 못 넘는다.
 *
 * 그래서 **낱말이 몇 개 들렸는지**로 본다. 기능어(a·the·is…)는 아이 발음에서 잘 뭉개지고
 * 인식기도 잘 흘리므로 **내용어만** 센다. 어느 낱말이 들렸는지 돌려줘서 화면에 보여준다 —
 * "다시 해"보다 "bus는 잘 들렸어"가 아이에게 훨씬 쓸모 있다.
 */
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'it', 'i', 'you', 'to', 'and', 'of', 'in', 'on', 'at',
  'can', 'do', 'does', 'my', 'your', 'me', 'we', 'not', 'some', 'that', 'this', 'too',
])

export function contentWords(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z' ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !FUNCTION_WORDS.has(w))
}

export interface SentenceScore {
  ok: boolean
  /** 들린 내용어 */
  hit: string[]
  /** 안 들린 내용어 */
  missed: string[]
}

/**
 * 받아쓴 말에 목표 문장의 내용어가 얼마나 들어 있나.
 * @param minRatio 통과 기준 (기본 0.6 = 내용어의 6할)
 */
export function judgeSentence(transcript: string, target: string, minRatio = 0.6): SentenceScore {
  const said = transcript.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean)
  const want = contentWords(target)
  // 내용어가 없는 짧은 표현("Thank you!" 등)은 기능어라도 하나는 맞아야 한다
  const targets = want.length > 0 ? want : target.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean)

  const hit: string[] = []
  const missed: string[] = []
  for (const w of targets) {
    // 글자 하나 차이는 맞은 것으로 본다 (인식기가 bus를 buss로 적는 일이 흔하다)
    const found = said.some((t) => t === w || editDistance(t, w) <= 1)
    ;(found ? hit : missed).push(w)
  }
  const ratio = targets.length === 0 ? 0 : hit.length / targets.length
  return { ok: ratio >= minRatio, hit, missed }
}

export interface ListenHandle {
  stop: () => void
}

/**
 * 한 번 듣고 결과를 알려준다.
 * onDone은 반드시 한 번 불린다 — 인식이 실패해도 화면이 멈추면 안 된다.
 */
export function listen(
  target: string,
  onDone: (r: { ok: boolean; transcript: string; error?: string }) => void,
  /** 채점 방법. 없으면 낱말 채점(judge)을 쓴다 */
  scorer: (transcript: string, target: string) => boolean = judge
): ListenHandle {
  const Ctor = recognitionCtor()
  if (!Ctor) {
    onDone({ ok: false, transcript: '', error: 'unsupported' })
    return { stop: () => {} }
  }
  const rec = new Ctor()
  rec.lang = 'en-US'
  rec.interimResults = false
  rec.maxAlternatives = 3
  rec.continuous = false

  let settled = false
  const finish = (r: { ok: boolean; transcript: string; error?: string }) => {
    if (settled) return
    settled = true
    onDone(r)
  }

  rec.onresult = (e) => {
    // 여러 후보 중 하나라도 맞으면 통과 — 첫 후보만 보면 아깝게 떨어진다
    const alts: string[] = []
    const first = e.results[0]
    if (first) for (let i = 0; i < first.length; i++) alts.push(first[i]?.transcript ?? '')
    const hit = alts.find((t) => scorer(t, target))
    finish({ ok: !!hit, transcript: hit ?? alts[0] ?? '' })
  }
  rec.onerror = (e) => finish({ ok: false, transcript: '', error: e.error })
  rec.onend = () => finish({ ok: false, transcript: '', error: 'no-speech' })

  try {
    rec.start()
  } catch {
    finish({ ok: false, transcript: '', error: 'start-failed' })
  }

  // 아이가 아무 말도 안 하면 10초 뒤에 스스로 끝난다 (문장은 낱말보다 오래 걸린다)
  const timer = setTimeout(() => rec.abort(), 10000)
  return {
    stop: () => {
      clearTimeout(timer)
      try {
        rec.stop()
      } catch {
        /* 이미 끝났으면 무시 */
      }
    },
  }
}

export interface Recording {
  /** 재생용 주소 (다 쓰면 revoke) */
  url: string
  stop: () => void
}

/**
 * 녹음 시작. 반환된 stop()을 부르면 녹음이 끝나고 onReady로 주소가 온다.
 * 마이크 권한은 이 함수를 처음 부를 때 요청된다 — **첫 화면에서 부르지 않는다.**
 */
export async function startRecording(onReady: (url: string) => void): Promise<{ stop: () => void } | null> {
  if (!canRecord()) return null
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    return null // 권한 거부 — 부르는 쪽이 녹음 없이 진행한다
  }
  const rec = new MediaRecorder(stream)
  const chunks: Blob[] = []
  rec.addEventListener('dataavailable', (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  })
  rec.addEventListener('stop', () => {
    for (const t of stream.getTracks()) t.stop()
    if (chunks.length === 0) return
    onReady(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })))
  })
  rec.start()
  return {
    stop: () => {
      if (rec.state !== 'inactive') rec.stop()
    },
  }
}
