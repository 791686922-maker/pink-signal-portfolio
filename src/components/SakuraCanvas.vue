<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { PetalCatchDetail } from '../types/interactions'

const emit = defineEmits<{
  'petal-catch': [detail: PetalCatchDetail]
}>()

type Petal = {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
  spin: number
  alpha: number
  color: string
}

const MAX_PETALS = 120
const COLORS = ['#ff8fbd', '#ffb7d3', '#ffd5e5', '#fff0f5'] as const
const MOBILE_COLORS = ['#ffafd0', '#ffc8dd', '#ffe2ec', '#fffafb'] as const
const canvas = ref<HTMLCanvasElement | null>(null)
const pool: Petal[] = Array.from({ length: MAX_PETALS }, () => ({
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  size: 3,
  phase: 0,
  spin: 0,
  alpha: 1,
  color: COLORS[0],
}))

let context: CanvasRenderingContext2D | null = null
let observer: IntersectionObserver | null = null
let resizeObserver: ResizeObserver | null = null
let motionQuery: MediaQueryList | null = null
let frame = 0
let clearTimer = 0
let width = 0
let height = 0
let lastTime = 0
let rainUntil = 0
let spawnBudget = 0
let cursorWind = 0
let isIntersecting = true
let reduceMotion = false
let lastCatchAt = 0
let mobilePetals = false

function random(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function isSceneVisible() {
  return isIntersecting && document.visibilityState === 'visible'
}

function setCanvasSize() {
  if (!canvas.value || !context) return

  const rect = canvas.value.getBoundingClientRect()
  const nextWidth = Math.max(1, rect.width)
  const nextHeight = Math.max(1, rect.height)
  mobilePetals = nextWidth <= 640 || window.matchMedia('(pointer: coarse)').matches
  const pixelRatio = Math.min(window.devicePixelRatio || 1, mobilePetals ? 3 : 2)

  width = nextWidth
  height = nextHeight
  canvas.value.width = Math.round(nextWidth * pixelRatio)
  canvas.value.height = Math.round(nextHeight * pixelRatio)
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

  if (reduceMotion && rainUntil > performance.now()) drawStaticPetals()
}

function resetPetal(petal: Petal, anywhere = false) {
  const colors = mobilePetals ? MOBILE_COLORS : COLORS
  petal.active = true
  petal.x = random(-24, width + 24)
  petal.y = anywhere ? random(12, Math.max(20, height - 12)) : random(-28, -4)
  petal.vx = random(-0.45, 0.45)
  petal.vy = random(0.7, 1.35)
  petal.size = Math.round(random(mobilePetals ? 5 : 3, mobilePetals ? 8 : 6))
  petal.phase = random(0, Math.PI * 2)
  petal.spin = Math.floor(random(0, 4))
  petal.alpha = random(mobilePetals ? 0.9 : 0.62, 1)
  petal.color = colors[Math.floor(Math.random() * colors.length)] ?? colors[0]
}

function spawnPetal() {
  const petal = pool.find((candidate) => !candidate.active)
  if (petal) resetPetal(petal)
}

function drawPetal(petal: Petal) {
  if (!context) return

  const x = Math.round(petal.x)
  const y = Math.round(petal.y)
  const size = Math.max(2, Math.round(petal.size))
  const horizontal = petal.spin % 2 === 0

  if (mobilePetals) {
    context.globalAlpha = petal.alpha * 0.38
    context.fillStyle = '#a54473'
    if (horizontal) {
      context.fillRect(x + 1, y + 1, size * 2, size)
      context.fillRect(x + size + 1, y - size + 1, size, size)
    } else {
      context.fillRect(x + 1, y + 1, size, size * 2)
      context.fillRect(x - size + 1, y + size + 1, size, size)
    }
  }

  context.globalAlpha = mobilePetals ? Math.max(0.94, petal.alpha) : petal.alpha
  context.fillStyle = petal.color

  if (horizontal) {
    context.fillRect(x, y, size * 2, size)
    context.fillRect(x + size, y - size, size, size)
  } else {
    context.fillRect(x, y, size, size * 2)
    context.fillRect(x - size, y + size, size, size)
  }

  context.fillStyle = '#fff6fa'
  context.globalAlpha = mobilePetals ? 0.96 : petal.alpha * 0.75
  context.fillRect(x, y, Math.max(1, Math.floor(size / 2)), Math.max(1, Math.floor(size / 2)))
}

function clearCanvas() {
  context?.clearRect(0, 0, width, height)
}

function drawStaticPetals() {
  if (!context) return
  clearCanvas()
  pool.forEach((petal) => {
    if (petal.active) drawPetal(petal)
  })
  context.globalAlpha = 1
}

function animate(now: number) {
  frame = 0
  if (!isSceneVisible() || reduceMotion) return

  const delta = Math.min(34, Math.max(0, now - (lastTime || now)))
  lastTime = now

  if (now < rainUntil) {
    spawnBudget += delta * 0.038
    while (spawnBudget >= 1) {
      spawnPetal()
      spawnBudget -= 1
    }
  }

  clearCanvas()
  let activeCount = 0
  const wind = cursorWind * 0.75

  pool.forEach((petal) => {
    if (!petal.active) return

    petal.phase += delta * 0.004
    petal.spin = Math.floor(petal.phase * 1.4) % 4
    petal.x += (petal.vx + wind + Math.sin(petal.phase) * 0.32) * delta * 0.06
    petal.y += petal.vy * delta * 0.06

    if (petal.x < -32) petal.x = width + 20
    if (petal.x > width + 32) petal.x = -20
    if (petal.y > height + 24) {
      petal.active = false
      return
    }

    activeCount += 1
    drawPetal(petal)
  })
  if (context) context.globalAlpha = 1

  if (now < rainUntil || activeCount > 0) {
    frame = window.requestAnimationFrame(animate)
  } else {
    clearCanvas()
  }
}

function ensureLoop() {
  if (frame || reduceMotion || !isSceneVisible()) return
  lastTime = 0
  frame = window.requestAnimationFrame(animate)
}

function stopRain() {
  rainUntil = 0
  spawnBudget = 0
  window.clearTimeout(clearTimer)
  if (frame) window.cancelAnimationFrame(frame)
  frame = 0
  pool.forEach((petal) => {
    petal.active = false
  })
  clearCanvas()
}

function startRain(duration = 8000) {
  const safeDuration = Math.min(20000, Math.max(1000, duration))
  window.clearTimeout(clearTimer)
  rainUntil = performance.now() + safeDuration

  if (reduceMotion) {
    pool.forEach((petal, index) => {
      petal.active = index < 24
      if (petal.active) resetPetal(petal, true)
    })
    drawStaticPetals()
    clearTimer = window.setTimeout(stopRain, safeDuration)
    return
  }

  for (let index = 0; index < 18; index += 1) {
    const petal = pool[index]
    if (petal && !petal.active) resetPetal(petal, true)
  }
  ensureLoop()
}

function onPointerMove(event: PointerEvent) {
  if (width === 0) return
  cursorWind = (event.clientX / width - 0.5) * 1.3
  tryCatchPetal(event.clientX, event.clientY)
}

function tryCatchPetal(x: number, y: number) {
  const now = performance.now()
  if (now >= rainUntil || now - lastCatchAt < 140) return

  const radius = reduceMotion ? 34 : 24
  const radiusSquared = radius * radius
  const caught = pool.find((petal) => {
    if (!petal.active) return false
    const dx = petal.x - x
    const dy = petal.y - y
    return dx * dx + dy * dy <= radiusSquared
  })

  if (!caught) return
  caught.active = false
  lastCatchAt = now
  if (reduceMotion) drawStaticPetals()
  emit('petal-catch', { x, y })
}

function onVisibilityChange() {
  if (!isSceneVisible()) {
    if (frame) window.cancelAnimationFrame(frame)
    frame = 0
    return
  }
  if (rainUntil > performance.now() || pool.some((petal) => petal.active)) ensureLoop()
}

function onMotionPreferenceChange() {
  reduceMotion = Boolean(motionQuery?.matches)
  if (reduceMotion) {
    if (frame) window.cancelAnimationFrame(frame)
    frame = 0
    pool.forEach((petal, index) => {
      petal.active = rainUntil > performance.now() && index < 24
      if (petal.active) resetPetal(petal, true)
    })
    drawStaticPetals()
    window.clearTimeout(clearTimer)
    const remaining = Math.max(0, rainUntil - performance.now())
    if (remaining > 0) clearTimer = window.setTimeout(stopRain, remaining)
  } else if (rainUntil > performance.now()) {
    window.clearTimeout(clearTimer)
    ensureLoop()
  }
}

onMounted(() => {
  if (!canvas.value) return
  context = canvas.value.getContext('2d', { alpha: true })
  if (!context) return

  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduceMotion = motionQuery.matches
  motionQuery.addEventListener('change', onMotionPreferenceChange)

  setCanvasSize()
  resizeObserver = new ResizeObserver(setCanvasSize)
  resizeObserver.observe(canvas.value)

  observer = new IntersectionObserver(([entry]) => {
    isIntersecting = Boolean(entry?.isIntersecting)
    onVisibilityChange()
  })
  observer.observe(canvas.value)

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  stopRain()
  observer?.disconnect()
  resizeObserver?.disconnect()
  motionQuery?.removeEventListener('change', onMotionPreferenceChange)
  window.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

defineExpose({ startRain, stopRain })
</script>

<template>
  <canvas ref="canvas" class="sakura-canvas" aria-hidden="true" />
</template>

<style scoped>
.sakura-canvas {
  position: fixed;
  inset: 0;
  z-index: 40;
  width: 100%;
  height: 100%;
  pointer-events: none;
  image-rendering: pixelated;
}
</style>
