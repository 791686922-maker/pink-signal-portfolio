import { onBeforeUnmount } from 'vue'

export type PixelSound = 'pluck' | 'collect' | 'unlock' | 'grow' | 'error' | 'broadcast'

type PixelAudioOptions = {
  enabled: () => boolean
}

const NOTES: Record<PixelSound, number[]> = {
  pluck: [330, 440],
  collect: [523, 659, 784],
  unlock: [392, 523, 659, 784],
  grow: [294, 370, 440],
  error: [220, 185],
  broadcast: [262, 392, 523, 784],
}

export function usePixelAudio(options: PixelAudioOptions) {
  let audioContext: AudioContext | null = null

  function play(kind: PixelSound) {
    if (!options.enabled() || typeof window === 'undefined') return

    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) return

    audioContext ??= new AudioContextConstructor()
    if (audioContext.state === 'suspended') void audioContext.resume()

    const now = audioContext.currentTime
    const notes = NOTES[kind]
    notes.forEach((frequency, index) => {
      if (!audioContext) return
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      const start = now + index * 0.075
      const duration = kind === 'broadcast' ? 0.16 : 0.1

      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(start)
      oscillator.stop(start + duration + 0.02)
    })
  }

  onBeforeUnmount(() => {
    if (!audioContext) return
    void audioContext.close()
    audioContext = null
  })

  return { play }
}
