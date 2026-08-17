/**
 * 설정 — **어른이 보는 화면**이다. 아이 화면과 달리 글씨가 작고 조용하다.
 *
 * 여기 있는 것들은 전부 "이 기기에서 어떻게 놀지"에 대한 취향이고(prefs),
 * 아이가 쌓은 기록(progress·srs·cards)과는 저장소가 분리돼 있다 —
 * 기록을 되돌려도 취향은 그 기기 것을 그대로 둔다.
 */
import * as cards from './cards'
import * as prefs from './prefs'
import * as progress from './progress'
import * as srs from './srs'
import * as tts from './tts'
import { el, notice, render, top } from './ui'

/** 여러 개 중 하나를 고르는 버튼 줄 */
function chooser<T>(
  options: { label: string; value: T }[],
  current: T,
  onPick: (v: T) => void
): HTMLElement {
  return el(
    'div',
    { class: 'en-set-choices' },
    options.map((o) => {
      const b = el('button', {
        class: `en-set-choice${o.value === current ? ' en-is-sel' : ''}`,
        text: o.label,
      })
      b.addEventListener('click', () => onPick(o.value))
      return b
    })
  )
}

/** 설정 한 줄: 제목 + 설명 + 조작부 */
function row(title: string, detail: string, control: Node): HTMLElement {
  return el('div', { class: 'en-set-row' }, [
    el('div', { class: 'en-set-label' }, [
      el('div', { class: 'en-set-title', text: title }),
      el('div', { class: 'en-set-detail', text: detail }),
    ]),
    control,
  ])
}

function section(emoji: string, title: string, rows: Node[]): HTMLElement {
  return el('div', { class: 'en-set-card' }, [
    el('div', { class: 'en-set-head', text: `${emoji} ${title}` }),
    ...rows,
  ])
}

export function showSettings(onBack: () => void): void {
  const redraw = (): void => showSettings(onBack)
  const p = prefs.get()

  // ── 목소리 고르기 (기기에 있는 영어 목소리 중에서) ─────────────────
  const voices = tts.voices()
  const voiceSelect = el('select', { class: 'en-set-select' })
  if (voices.length === 0) {
    voiceSelect.append(el('option', { text: '이 기기에는 영어 목소리가 없어요' }))
    voiceSelect.disabled = true
  } else {
    for (const v of voices) {
      const o = el('option', { value: v.name, text: `${v.name} (${v.lang})` })
      if (v.name === tts.voiceName()) o.selected = true
      voiceSelect.append(o)
    }
    voiceSelect.addEventListener('change', () => {
      tts.useVoice(voiceSelect.value)
      // 고르면 바로 들려준다 — 이름만 보고는 어떤 소리인지 알 수 없다
      tts.speak('cat', { rate: 0.9 })
    })
  }

  render(
    top('설정 ⚙️', onBack),
    el('div', { class: 'en-set' }, [
      section('🎨', '화면', [
        row(
          '테마',
          '어두운 방에서 놀 때는 어둡게 두세요. 「기기 설정」은 폰·PC의 다크모드를 따라갑니다',
          chooser(prefs.THEMES, p.theme, (v) => {
            prefs.setTheme(v)
            redraw()
          })
        ),
      ]),

      section('🔊', '소리', [
        row(
          '효과음 크기',
          '버튼·카드·박수 소리의 크기예요',
          chooser(prefs.SFX_LEVELS, p.sfxVolume, (v) => {
            prefs.setSfxVolume(v)
            redraw()
          })
        ),
        row('읽어 주는 목소리', '기기에 있는 영어 목소리 중에서 골라요 (고르면 바로 들려줍니다)', voiceSelect),
        row(
          '읽어 주는 속도',
          '아직 귀가 느린 아이는 느리게 두세요',
          chooser(tts.RATES, tts.rate(), (v) => {
            tts.setRate(v)
            tts.speak('cat', { rate: 0.9 })
            redraw()
          })
        ),
      ]),

      section('🎮', '놀이', [
        row(
          '문장 발음 채점',
          '문장을 따라 말할 때 들린 낱말을 채점해요. 마이크가 아이 목소리를 잘 못 잡으면 끄세요 — 끄면 녹음만 비교합니다 (낱말 발음 채점은 늘 켜져 있어요)',
          chooser(
            [
              { label: '채점함', value: true },
              { label: '안 함', value: false },
            ],
            p.sentenceScoring,
            (v) => {
              prefs.setSentenceScoring(v)
              redraw()
            }
          )
        ),
        row(
          '낱말 요격 속도',
          '맞힐수록 낱말이 빨리 떨어지게 할지',
          chooser(
            [
              { label: '변화 없음', value: false },
              { label: '가중됨', value: true },
            ],
            p.interceptRamp,
            (v) => {
              prefs.setInterceptRamp(v)
              redraw()
            }
          )
        ),
      ]),

      section('💾', '기록', [
        row(
          '기록은 이 브라우저에만',
          '기기를 바꾸거나 브라우저 데이터를 지우면 사라져요',
          el('div', { class: 'en-set-choices' }, [
            (() => {
              const b = el('button', { class: 'en-set-choice', text: '💾 저장' })
              b.addEventListener('click', () => {
                const dump: Record<string, string> = {}
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i)
                  if (k?.startsWith('yeongeo-nori.')) dump[k] = localStorage.getItem(k) ?? ''
                }
                const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
                const a = el('a', { href: URL.createObjectURL(blob), download: 'yeongeo-nori-backup.json' })
                a.click()
                URL.revokeObjectURL(a.href)
              })
              return b
            })(),
            (() => {
              const input = el('input', { type: 'file', accept: '.json' })
              input.style.display = 'none'
              input.addEventListener('change', () => {
                const f = input.files?.[0]
                if (!f) return
                void f.text().then((txt) => {
                  try {
                    const dump = JSON.parse(txt) as Record<string, string>
                    for (const [k, v] of Object.entries(dump)) {
                      if (k.startsWith('yeongeo-nori.')) localStorage.setItem(k, v)
                    }
                    // 불러온 값을 각 모듈이 다시 읽어야 화면에 반영된다
                    prefs.reload()
                    progress.reload()
                    srs.reload()
                    cards.reload()
                    tts.reload()
                    notice('📂', '기록을 불러왔어요!', undefined, { ms: 1400, onClose: redraw })
                  } catch {
                    notice('⚠️', '읽을 수 없는 파일이에요', '저장했던 백업 파일인지 확인해 주세요', { ms: 2000 })
                  }
                })
              })
              const b = el('button', { class: 'en-set-choice', text: '📂 불러오기' })
              b.addEventListener('click', () => input.click())
              return el('span', {}, [b, input])
            })(),
          ])
        ),
        row(
          '지우기 비밀번호',
          `「기록 처음부터」를 누를 때 물어봐요. 처음 값은 ${prefs.DEFAULT_RESET_PASSWORD}예요 — 아이가 모르게 바꿔 두세요`,
          (() => {
            const b = el('button', { class: 'en-set-choice', text: '바꾸기' })
            b.addEventListener('click', () => {
              const now = window.prompt('지금 비밀번호')
              if (now === null) return
              if (!prefs.checkResetPassword(now)) {
                notice('🔒', '비밀번호가 달라요', undefined, { ms: 1500 })
                return
              }
              const next = window.prompt('새 비밀번호')
              if (!next?.trim()) return
              prefs.setResetPassword(next)
              notice('🔑', '바꿨어요', undefined, { ms: 1200 })
            })
            return b
          })()
        ),
        row(
          '기록 처음부터',
          '배운 기록·수료증·글자 카드·단어장을 모두 지워요. 되돌릴 수 없어요',
          (() => {
            const b = el('button', { class: 'en-set-choice en-is-danger', text: '지우기' })
            b.addEventListener('click', () => {
              const pw = window.prompt('지우기 비밀번호')
              if (pw === null) return
              if (!prefs.checkResetPassword(pw)) {
                notice('🔒', '비밀번호가 달라요', '기록은 그대로 있어요', { ms: 1600 })
                return
              }
              progress.resetAll()
              srs.resetAll()
              cards.resetAll()
              notice('🧹', '기록을 지웠어요', '처음부터 다시 놀 수 있어요', { ms: 1600, onClose: onBack })
            })
            return b
          })()
        ),
      ]),
    ])
  )
}
