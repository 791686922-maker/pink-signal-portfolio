import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

import type { EasterEggDetail, EasterEggId } from '../types/interactions'

export type UseEasterEggsOptions = {
  autoStart?: boolean
  onUnlock?: (detail: EasterEggDetail) => void
}

const HELLO_WORLD = 'hello world'
const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const

export function useEasterEggs(options: UseEasterEggsOptions = {}) {
  const unlockedEggs = ref<EasterEggId[]>([])
  const lastUnlocked = ref<EasterEggDetail | null>(null)
  let helloBuffer = ''
  let konamiIndex = 0
  let isListening = false

  function isEditableEvent(event: KeyboardEvent) {
    return event.composedPath().some((node) => {
      if (!(node instanceof HTMLElement)) return false
      return (
        node.isContentEditable ||
        node.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
      )
    })
  }

  function unlock(id: EasterEggId) {
    if (unlockedEggs.value.includes(id)) return

    const detail: EasterEggDetail = {
      id,
      unlockedAt: Date.now(),
    }
    unlockedEggs.value = [...unlockedEggs.value, id]
    lastUnlocked.value = detail
    options.onUnlock?.(detail)
  }

  function inspectHelloWorld(event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      helloBuffer = helloBuffer.slice(0, -1)
      return
    }

    if (event.key.length !== 1) return
    const character = event.key.toLowerCase()
    if (!/[a-z ]/.test(character)) return

    helloBuffer = `${helloBuffer}${character}`.slice(-HELLO_WORLD.length)
    if (helloBuffer === HELLO_WORLD) {
      unlock('hello-world')
      helloBuffer = ''
    }
  }

  function inspectKonami(event: KeyboardEvent) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const expected = KONAMI_SEQUENCE[konamiIndex]

    if (key === expected) {
      konamiIndex += 1
      if (konamiIndex === KONAMI_SEQUENCE.length) {
        unlock('konami')
        konamiIndex = 0
      }
      return
    }

    konamiIndex = key === KONAMI_SEQUENCE[0] ? 1 : 0
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isEditableEvent(event)) return
    inspectHelloWorld(event)
    inspectKonami(event)
  }

  function start() {
    if (isListening) return
    window.addEventListener('keydown', onKeyDown)
    isListening = true
  }

  function stop() {
    if (!isListening) return
    window.removeEventListener('keydown', onKeyDown)
    isListening = false
    helloBuffer = ''
    konamiIndex = 0
  }

  function reset() {
    unlockedEggs.value = []
    lastUnlocked.value = null
    helloBuffer = ''
    konamiIndex = 0
  }

  onMounted(() => {
    if (options.autoStart !== false) start()
  })
  onBeforeUnmount(stop)

  return {
    unlockedEggs: readonly(unlockedEggs),
    lastUnlocked: readonly(lastUnlocked),
    start,
    stop,
    reset,
  }
}
