/**
 * 영어 음성 읽기 (en-US).
 *
 * 한자놀이 `src/tts.ts`에서 이식하고 언어를 바꿨다. 7세는 영어 글자도 한글 안내문도 아직 못 읽는
 * 상태를 기본값으로 두므로, **소리가 없으면 이 앱은 성립하지 않는다.**
 * 브라우저 내장 SpeechSynthesis만 쓴다 — 네트워크·키·비용이 없고 대부분 오프라인에서도 된다.
 */

let voice: SpeechSynthesisVoice | null = null
let ready = false

/**
 * 영어 목소리 고르기 — **좋은 것부터**.
 *
 * 아이가 듣는 발음이 곧 아이의 발음이 된다. 옛 방식(concatenative) 음성은 낱말 하나를 읽을 때
 * 특히 딱딱해서 파닉스 소리가 뭉개진다. 신경망 음성 이름은 제각각이라 우선순위로 고른다:
 *   - Edge: "Microsoft Ava Online (Natural) - English (United States)" 등
 *   - Chrome·안드로이드: "Google US English"
 *   - 아이폰·맥: "Samantha", "Ava"
 * 그래도 없으면 아무 영어 음성이나 쓴다.
 */
const VOICE_PREFERENCE: ((v: SpeechSynthesisVoice) => boolean)[] = [
  (v) => /natural/i.test(v.name),
  (v) => /online/i.test(v.name),
  (v) => /google us/i.test(v.name),
  (v) => /google/i.test(v.name),
  (v) => /samantha|ava|allison|siri/i.test(v.name),
  // 네트워크 음성은 대체로 신경망이다
  (v) => v.localService === false,
  () => true,
]

const PREF_KEY = 'yeongeo-nori.voice'
const RATE_KEY = 'yeongeo-nori.voice.rate'

/**
 * 말 빠르기 배수. 부르는 쪽이 정한 rate에 **곱한다** —
 * 낱말처럼 원래 천천히 읽던 것은 여전히 상대적으로 천천히 읽혀야 한다.
 */
let rateScale = 1

export function reload(): void {
  try {
    const saved = Number(localStorage.getItem(RATE_KEY))
    rateScale = Number.isFinite(saved) && saved > 0 ? saved : 1
  } catch {
    /* 저장소가 막혀도 기본 속도로 읽는다 */
  }
  if (isSupported()) pickVoice()
}

reload()

/** 고를 수 있는 빠르기. 파닉스는 느린 쪽이 기본값이다 */
export const RATES: { label: string; value: number }[] = [
  { label: '아주 느리게 (0.6배)', value: 0.6 },
  { label: '느리게 (0.8배)', value: 0.8 },
  { label: '보통 (1배)', value: 1 },
]

export function rate(): number {
  return rateScale
}

export function setRate(v: number): void {
  rateScale = v
  try {
    localStorage.setItem(RATE_KEY, String(v))
  } catch {
    /* 무시 */
  }
}

function englishVoices(): SpeechSynthesisVoice[] {
  return speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en'))
}

function pickVoice(): void {
  const all = speechSynthesis.getVoices()
  if (all.length === 0) return
  const en = englishVoices()

  // 사용자가 고른 목소리가 있으면 그것이 먼저다
  const saved = localStorage.getItem(PREF_KEY)
  const chosen = saved ? en.find((v) => v.name === saved) : null
  if (chosen) {
    voice = chosen
    ready = true
    return
  }

  // 미국 영어를 먼저 보고, 없으면 아무 영어나
  const us = en.filter((v) => /^en[-_]us/i.test(v.lang))
  voice = null
  for (const list of [us, en]) {
    for (const prefers of VOICE_PREFERENCE) {
      const hit = list.find(prefers)
      if (hit) {
        voice = hit
        break
      }
    }
    if (voice) break
  }
  ready = true
}

export function voiceName(): string | null {
  return voice?.name ?? null
}

export function voices(): SpeechSynthesisVoice[] {
  return englishVoices()
}

export function useVoice(name: string): void {
  const hit = englishVoices().find((v) => v.name === name)
  if (!hit) return
  voice = hit
  try {
    localStorage.setItem(PREF_KEY, name)
  } catch {
    /* 저장이 막혀도 이번 세션에서는 적용된다 */
  }
}

export function initTts(): void {
  if (!('speechSynthesis' in window)) return
  pickVoice()
  // 크롬은 목록이 늦게 온다
  speechSynthesis.addEventListener('voiceschanged', pickVoice)
}

/** 영어 목소리가 있는지 (없으면 UI에서 스피커 아이콘을 숨긴다) */
export function hasVoice(): boolean {
  return ready && voice !== null
}

export function isSupported(): boolean {
  // node(테스트)에는 window가 아예 없다 — 'in' 연산자에 닿기 전에 걸러야 던지지 않는다
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * 읽어 준다. 이전에 읽던 것은 끊는다 — 아이가 그림을 연타하면 소리가 겹쳐 알아들을 수 없다.
 * 기본 rate가 0.85인 것은 낱말이 짧아서 빠르면 첫소리가 잘리기 때문.
 */
export function speak(text: string, opts: { rate?: number; onEnd?: () => void } = {}): void {
  if (!isSupported()) {
    // 음성이 없는 기기에서도 뒷일(축하 화면 등)은 이어져야 한다
    if (opts.onEnd) setTimeout(opts.onEnd, 300)
    return
  }
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = voice?.lang ?? 'en-US'
  if (voice) u.voice = voice
  // 브라우저가 받아 주는 범위(0.1~10)를 벗어나면 조용히 무시되거나 튄다
  u.rate = Math.max(0.1, Math.min(10, (opts.rate ?? 0.85) * rateScale))
  u.pitch = 1

  if (opts.onEnd) {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      opts.onEnd!()
    }
    u.addEventListener('end', finish)
    u.addEventListener('error', finish)
    // 소리가 아예 안 울리는 경우(권한·버그)에도 멈추지 않게 안전장치
    setTimeout(finish, (900 + text.length * 120) / rateScale)
  }

  speechSynthesis.speak(u)
}

/**
 * 낱말을 **한 번만** 읽어 준다.
 *
 * 눌러서 듣는 곳(도감 카드·단어장·만든 낱말)은 전부 이걸 쓴다 — 한 번 누르면 한 번 읽혀야 한다.
 * 사용자가 "단어장에서 왜 두 번씩 말하냐"고 물은 것이 blend를 눌러 듣는 자리에까지 쓴 탓이었다.
 */
export function say(word: string, onEnd?: () => void): void {
  speak(word, { rate: 0.85, ...(onEnd ? { onEnd } : {}) })
}

/**
 * 낱말을 **소리 하나씩 → 통째로** 읽어 준다 (c-a-t → cat).
 *
 * 파닉스의 핵심 동작(blending)이라 **두 번 읽는다**(느리게 → 보통).
 * 음소를 글자 이름이 아니라 소리로 내야 하는데 TTS에 'c'를 주면 "씨"라고 글자 이름을 읽는다 →
 * 그래서 음소를 따로 읽히지 않고, 소리를 살릴 수 있는 낱말 단위로 느리게+보통 두 번 읽는다.
 *
 * **쓰는 자리를 가려야 한다**: 아이가 처음부터 소리를 붙여 읽어야 하는 **문제 제시**에만 쓰고,
 * 눌러서 듣는 곳(도감·단어장)에는 say()를 쓴다 — 한 번 누르면 한 번 읽혀야 한다.
 * 음소 단독 발음은 별도 오디오 파일이 필요한지 실기기에서 확인한 뒤 결정한다(PLAN.md 미확정 항목).
 */
export function blend(word: string, onEnd?: () => void): void {
  speak(word, {
    rate: 0.5,
    onEnd: () => speak(word, { rate: 0.9, onEnd }),
  })
}

export function stop(): void {
  if (isSupported()) speechSynthesis.cancel()
}
