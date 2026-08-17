/**
 * 놀이 방식에 대한 **취향** 설정.
 *
 * progress(수료증·최고기록)와 일부러 분리했다. 저것은 아이가 쌓은 것이라 백업·복원 대상이고,
 * 이것은 기기마다 다를 수 있는 취향이다 — 기록을 되돌려도 이 값은 그 기기 것을 그대로 둔다.
 * (한자놀이 `prefs.ts`에서 옮기고 테마·효과음 크기를 더했다)
 */

const KEY = 'yeongeo-nori.prefs.v1'

/** 화면 테마. `auto`는 기기 설정(다크모드)을 따라간다 */
export type Theme = 'auto' | 'light' | 'dark'

export interface Prefs {
  theme: Theme
  /** 효과음 크기 0(꺼짐)~1 */
  sfxVolume: number
  /**
   * 낱말 요격에서 맞힐수록 낙하가 빨라지는가.
   *
   * 기본은 빨라진다(가중). 다만 아직 읽기가 느린 아이에게는 몇 판 못 가서
   * 따라잡을 수 없는 속도가 되어 재미보다 부담이 커진다 — 그럴 때 끈다.
   */
  interceptRamp: boolean
  /**
   * 문장 발음을 **채점할지**.
   *
   * 켜면 받아쓰기로 내용어가 몇 개 들렸는지 세어 알려 준다. 다만 아이 목소리·주변 소음·마이크에 따라
   * 잘 안 잡힐 수 있고, 그때는 아이가 맞게 말했는데 계속 "한 번 더"를 보게 된다 →
   * 그런 기기에서는 끄고 **녹음 비교만** 한다. (낱말 발음 채점은 이 설정과 별개로 늘 켜져 있다)
   */
  sentenceScoring: boolean
  /**
   * 「기록 처음부터」를 누를 때 물어보는 비밀번호.
   *
   * **막으려는 것은 아이의 손가락이지 남의 침입이 아니다.** 이 값은 이 브라우저에
   * 그냥 적혀 있고 소스도 공개돼 있다 — 확인 창을 두 번 띄워도 아이는 그냥 두 번 누르기 때문에
   * "아는 사람만 통과하는" 한 단계가 필요해서 넣었다.
   */
  resetPassword: string
}

export const DEFAULT_RESET_PASSWORD = '1234'

/** 고를 수 있는 효과음 크기 */
export const SFX_LEVELS: { label: string; value: number }[] = [
  { label: '꺼짐', value: 0 },
  { label: '작게', value: 0.5 },
  { label: '보통', value: 1 },
  { label: '크게', value: 1.6 },
]

export const THEMES: { label: string; value: Theme }[] = [
  { label: '기기 설정', value: 'auto' },
  { label: '밝게 ☀️', value: 'light' },
  { label: '어둡게 🌙', value: 'dark' },
]

const DEFAULTS: Prefs = {
  theme: 'auto',
  sfxVolume: 1,
  interceptRamp: true,
  sentenceScoring: true,
  resetPassword: DEFAULT_RESET_PASSWORD,
}

let p: Prefs = load()

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    // 저장된 값에 없는 항목은 기본값으로 채운다 — 설정이 늘어나도 예전 저장본이 안 깨진다
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* 저장소가 막혀도 이번 판은 그대로 굴러가야 한다 */
  }
}

/** 저장소를 다시 읽어 온다 — 기록을 불러온 직후처럼 밖에서 값이 바뀐 경우 */
export function reload(): void {
  p = load()
  applyTheme()
}

export function get(): Prefs {
  return p
}

/**
 * 테마를 화면에 입힌다 — `<html data-theme="dark">`.
 *
 * `auto`일 때는 아무 표시도 남기지 않는다. CSS가 `prefers-color-scheme`으로 알아서 고르게 하려면
 * 표시가 없어야 한다(표시를 남기면 기기 설정이 바뀌어도 따라가지 못한다).
 */
export function applyTheme(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (p.theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', p.theme)
}

export function setTheme(theme: Theme): void {
  p = { ...p, theme }
  save()
  applyTheme()
}

export function setSfxVolume(v: number): void {
  p = { ...p, sfxVolume: v }
  save()
}

export function setInterceptRamp(on: boolean): void {
  p = { ...p, interceptRamp: on }
  save()
}

export function setSentenceScoring(on: boolean): void {
  p = { ...p, sentenceScoring: on }
  save()
}

/** 앞뒤 공백은 무시한다 — 아이 것이 아니라 어른이 급히 치는 값이다 */
export function checkResetPassword(input: string): boolean {
  return input.trim() === p.resetPassword
}

export function setResetPassword(pw: string): void {
  p = { ...p, resetPassword: pw.trim() }
  save()
}
