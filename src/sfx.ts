/**
 * 효과음 — 오디오 파일 없이 WebAudio로 짧은 소리를 만든다.
 *
 * 파일을 쓰지 않는 이유는 오프라인(PWA)에서도 소리가 나야 하고, 받아 둘 자산이 늘면
 * 첫 로딩이 느려지기 때문이다. 정답은 올라가는 두 음, "다시"는 낮은 한 음 —
 * **"다시" 소리를 실패처럼 들리게 만들지 않는다**(부저 소리는 쓰지 않는다).
 */

import * as prefs from './prefs'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  // 첫 사용자 조작 전에는 정지 상태로 시작한다
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, gain = 0.12): void {
  // 설정의 효과음 크기를 곱한다. 0(꺼짐)이면 오디오 컨텍스트를 아예 만들지 않는다
  const vol = prefs.get().sfxVolume
  if (vol <= 0) return
  const c = audio()
  if (!c) return
  gain *= vol
  const osc = c.createOscillator()
  const amp = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  amp.gain.value = 0
  // 딸깍 소리가 나지 않게 아주 짧게 올리고 내린다
  amp.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01)
  amp.gain.linearRampToValueAtTime(0, c.currentTime + start + dur)
  osc.connect(amp).connect(c.destination)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + dur + 0.02)
}

/** 정답 — 도미솔 느낌으로 올라간다 */
export function good(): void {
  tone(660, 0, 0.12)
  tone(880, 0.1, 0.16)
}

/** 다시 — 낮지만 부드러운 한 음 */
export function again(): void {
  tone(392, 0, 0.18, 0.09)
}

/** 판을 깼을 때 */
export function fanfare(): void {
  tone(523, 0, 0.12)
  tone(659, 0.1, 0.12)
  tone(784, 0.2, 0.12)
  tone(1046, 0.3, 0.22)
}

/** 카드를 뒤집을 때 같은 작은 소리 */
export function tap(): void {
  tone(880, 0, 0.05, 0.06)
}
