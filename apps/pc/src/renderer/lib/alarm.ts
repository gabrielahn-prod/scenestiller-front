/**
 * 2d 위험 팝업의 소리 ("자동 재생 · 소리").
 *
 * 음원 파일을 넣지 않고 WebAudio 로 짧은 두 음을 만든다 — 에셋·CSP 걱정이 없고,
 * 매장 스피커에서 음악과 섞여도 구분되는 높은 음이다.
 */
const TONES: readonly { readonly hz: number; readonly at: number }[] = [
  { hz: 988, at: 0 }, // B5
  { hz: 784, at: 0.18 }, // G5
  { hz: 988, at: 0.5 },
  { hz: 784, at: 0.68 },
]
const TONE_SEC = 0.16

export const playAlarm = async (): Promise<void> => {
  try {
    const context = new AudioContext()
    // 사용자 조작 없이 뜬 팝업이면 자동재생 정책에 막혀 suspended 로 시작한다.
    // Electron 은 기본 허용이지만, 브라우저 개발 모드에서 조용히 실패해도 괜찮다.
    if (context.state === 'suspended') await context.resume()
    const start = context.currentTime

    TONES.forEach(({ hz, at }) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = hz
      // 딸깍 소리가 나지 않게 짧게 올렸다 내린다.
      gain.gain.setValueAtTime(0, start + at)
      gain.gain.linearRampToValueAtTime(0.12, start + at + 0.01)
      gain.gain.linearRampToValueAtTime(0, start + at + TONE_SEC)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start + at)
      oscillator.stop(start + at + TONE_SEC)
    })

    setTimeout(() => void context.close(), 1200)
  } catch {
    // 소리가 안 나도 팝업은 뜬다.
  }
}
