<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { usePointerField } from '../composables/usePointerField'
import type {
  PixelBurstKind,
  PixelCursorHandle,
  PixelCursorProps,
  PixelCursorState,
  PixelDragStartDetail,
  PixelDropDetail,
  PixelTugDetail,
} from '../types/pixelCursor'

type RopeNode = {
  x: number
  y: number
  vx: number
  vy: number
}

type Spark = {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  color: number
}

type InteractionKind = 'drag' | 'tug'

type ActiveInteraction = {
  kind: InteractionKind
  id: string
  element: HTMLElement
  pointerId: number
  startX: number
  startY: number
  originLeft: number
  originTop: number
  originRight: number
  originBottom: number
  currentX: number
  currentY: number
  desiredX: number
  desiredY: number
  velocityX: number
  velocityY: number
  axis: 'x' | 'y' | 'both'
  started: boolean
  tugThreshold: number
  tugLimit: number
  snapX: number
  snapY: number
  burstPending: boolean
}

const props = withDefaults(defineProps<PixelCursorProps>(), {
  magneticSelector: 'a[href], button:not(:disabled), summary, [data-pixel-magnet]',
  dragSelector: '[data-pixel-drag]',
  dropSelector: '[data-pixel-drop]',
})

const emit = defineEmits<{
  'drag-start': [detail: PixelDragStartDetail]
  drop: [detail: PixelDropDetail]
  tug: [detail: PixelTugDetail]
}>()

const NODE_COUNT = 10
const SPARK_COUNT = 24
const DRAG_THRESHOLD = 6
const ROPE_GRID = 2
const ROPE_MAX_SEGMENT = 12
const SETTLE_DISTANCE = 0.5
const SETTLE_SPEED = 0.05

const canvas = ref<HTMLCanvasElement | null>(null)
const overlayEnabled = ref(false)
const nodes: RopeNode[] = Array.from({ length: NODE_COUNT }, () => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
}))
const sparks: Spark[] = Array.from({ length: SPARK_COUNT }, () => ({
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  size: 2,
  color: 0,
}))

const pointerField = usePointerField()

let context: CanvasRenderingContext2D | null = null
let finePointerQuery: MediaQueryList | null = null
let reducedMotionQuery: MediaQueryList | null = null
let forcedColorsQuery: MediaQueryList | null = null
let unsubscribePointer: (() => boolean) | null = null
let frame = 0
let lastFrameTime = 0
let lastInputTime = 0
let canvasWidth = 0
let canvasHeight = 0
let pixelRatio = 1
let ropeOpacity = 0
let ropeInitialised = false
let settleFrames = 0
let state: PixelCursorState = 'idle'
let pressedPointerId = -1
let pressX = 0
let pressY = 0
let interaction: ActiveInteraction | null = null
let magnetElement: HTMLElement | null = null
let magnetLeft = 0
let magnetTop = 0
let magnetWidth = 0
let magnetHeight = 0
let magnetResetTimer = 0
let dropPreviewElement: HTMLElement | null = null
let dropSuccessTimer = 0
let suppressClickElement: HTMLElement | null = null
let suppressClickUntil = 0
let previousDirtyLeft = 0
let previousDirtyTop = 0
let previousDirtyRight = 0
let previousDirtyBottom = 0
let hasPreviousDirty = false

function safeClosest(target: EventTarget | null, selector: string) {
  if (!(target instanceof Element)) return null
  try {
    const element = target.closest(selector)
    return element instanceof HTMLElement ? element : null
  } catch {
    return null
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function quantise(value: number) {
  return Math.round(value / ROPE_GRID) * ROPE_GRID
}

function setCanvasSize() {
  if (!canvas.value || !context) return
  canvasWidth = Math.max(1, window.innerWidth)
  canvasHeight = Math.max(1, window.innerHeight)
  pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
  canvas.value.width = Math.round(canvasWidth * pixelRatio)
  canvas.value.height = Math.round(canvasHeight * pixelRatio)
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.imageSmoothingEnabled = false
  hasPreviousDirty = false
}

function clearPreviousFrame() {
  if (!context || !hasPreviousDirty) return
  const padding = 28
  const left = Math.floor(previousDirtyLeft - padding)
  const top = Math.floor(previousDirtyTop - padding)
  const width = Math.ceil(previousDirtyRight - previousDirtyLeft + padding * 2)
  const height = Math.ceil(previousDirtyBottom - previousDirtyTop + padding * 2)
  context.clearRect(left, top, width, height)
  hasPreviousDirty = false
}

function clearCanvas() {
  if (!context) return
  context.clearRect(0, 0, canvasWidth, canvasHeight)
  hasPreviousDirty = false
}

function includeDirtyPoint(x: number, y: number, radius = 4) {
  const left = x - radius
  const top = y - radius
  const right = x + radius
  const bottom = y + radius

  if (!hasPreviousDirty) {
    previousDirtyLeft = left
    previousDirtyTop = top
    previousDirtyRight = right
    previousDirtyBottom = bottom
    hasPreviousDirty = true
    return
  }

  previousDirtyLeft = Math.min(previousDirtyLeft, left)
  previousDirtyTop = Math.min(previousDirtyTop, top)
  previousDirtyRight = Math.max(previousDirtyRight, right)
  previousDirtyBottom = Math.max(previousDirtyBottom, bottom)
}

function initialiseRope(x: number, y: number) {
  for (let index = 0; index < NODE_COUNT; index += 1) {
    const node = nodes[index]
    if (!node) continue
    node.x = x
    node.y = y
    node.vx = 0
    node.vy = 0
  }
  ropeInitialised = true
}

function springNode(node: RopeNode, targetX: number, targetY: number, dt: number, stiffness: number, damping: number) {
  const accelerationX = (targetX - node.x) * stiffness - node.vx * damping
  const accelerationY = (targetY - node.y) * stiffness - node.vy * damping
  node.vx += accelerationX * dt
  node.vy += accelerationY * dt
  node.x += node.vx * dt
  node.y += node.vy * dt
}

function updateInteraction(dt: number) {
  if (!interaction) return

  const stiffness = state === 'dragging' ? 260 : state === 'snapping' ? 185 : 230
  const damping = state === 'dragging' ? 30 : 27
  const accelerationX = (interaction.desiredX - interaction.currentX) * stiffness - interaction.velocityX * damping
  const accelerationY = (interaction.desiredY - interaction.currentY) * stiffness - interaction.velocityY * damping
  interaction.velocityX += accelerationX * dt
  interaction.velocityY += accelerationY * dt
  interaction.currentX += interaction.velocityX * dt
  interaction.currentY += interaction.velocityY * dt

  interaction.element.style.setProperty('--pixel-drag-x', `${Math.round(interaction.currentX)}px`)
  interaction.element.style.setProperty('--pixel-drag-y', `${Math.round(interaction.currentY)}px`)

  const remaining = Math.hypot(
    interaction.desiredX - interaction.currentX,
    interaction.desiredY - interaction.currentY,
  )
  const speed = Math.hypot(interaction.velocityX, interaction.velocityY)

  if (state === 'snapping' && remaining < 0.8 && speed < 8) {
    if (interaction.burstPending) {
      spawnBurst(interaction.snapX, interaction.snapY, 'spark', 10)
      interaction.burstPending = false
    }
    interaction.desiredX = 0
    interaction.desiredY = 0
    state = 'recoil'
  } else if (state === 'recoil' && remaining < 0.5 && speed < 6) {
    finishInteraction()
    state = 'settling'
  }
}

function updateRope(dt: number) {
  if (!ropeInitialised) initialiseRope(pointerField.field.x, pointerField.field.y)

  const head = nodes[0]
  if (!head) return
  head.x = pointerField.field.x
  head.y = pointerField.field.y
  head.vx = pointerField.field.vx
  head.vy = pointerField.field.vy

  const hasAnchor = pressedPointerId >= 0 || Boolean(interaction)
  let anchorX = pressX
  let anchorY = pressY

  if (interaction) {
    anchorX = interaction.startX + interaction.currentX
    anchorY = interaction.startY + interaction.currentY
  }

  for (let index = 1; index < NODE_COUNT; index += 1) {
    const node = nodes[index]
    const previous = nodes[index - 1]
    if (!node || !previous) continue

    if (hasAnchor) {
      const progress = index / (NODE_COUNT - 1)
      const targetX = head.x + (anchorX - head.x) * progress
      const targetY = head.y + (anchorY - head.y) * progress
      springNode(node, targetX, targetY, dt, 118 - index * 4, 22)
    } else {
      springNode(node, previous.x, previous.y, dt, 82 - index * 2.5, 18)
      const dx = node.x - previous.x
      const dy = node.y - previous.y
      const distance = Math.hypot(dx, dy)
      if (distance > ROPE_MAX_SEGMENT) {
        const scale = ROPE_MAX_SEGMENT / distance
        node.x = previous.x + dx * scale
        node.y = previous.y + dy * scale
        node.vx *= 0.82
        node.vy *= 0.82
      }
    }
  }

  if (hasAnchor) {
    const tail = nodes[NODE_COUNT - 1]
    if (tail) {
      tail.x = anchorX
      tail.y = anchorY
      tail.vx = 0
      tail.vy = 0
    }
  }
}

function updateSparks(dt: number) {
  let active = 0
  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const spark = sparks[index]
    if (!spark?.active) continue
    spark.life -= dt
    if (spark.life <= 0) {
      spark.active = false
      continue
    }
    spark.vy += 42 * dt
    spark.x += spark.vx * dt
    spark.y += spark.vy * dt
    spark.vx *= 0.975
    active += 1
  }
  return active
}

function drawPixel(x: number, y: number, size: number, color: string, opacity: number) {
  if (!context || opacity <= 0) return
  context.globalAlpha = opacity
  context.fillStyle = color
  context.fillRect(x - size / 2, y - size / 2, size, size)
  includeDirtyPoint(x, y, size + 3)
}

function drawSignalTrail() {
  if (!context || ropeOpacity <= 0) return

  const isTethered = pressedPointerId >= 0 || Boolean(interaction)

  for (let index = NODE_COUNT - 1; index >= 1; index -= 1) {
    const node = nodes[index]
    if (!node) continue

    const progress = 1 - index / NODE_COUNT
    const x = quantise(node.x)
    const y = quantise(node.y)
    const fade = ropeOpacity * (0.16 + progress * 0.56)

    // The tail deliberately leaves air between pixels. It reads as a signal
    // drifting through the farm instead of a heavy cable following the cursor.
    if (isTethered || index % 2 === 0) {
      drawPixel(x, y, index < 4 ? 6 : 4, '#f4a6c3', fade * 0.42)
      drawPixel(x, y, 2, '#fff3dc', fade)
    }

    if (index % 3 === 0) {
      drawPixel(x + 4, y - 4, 2, '#d75f91', fade * 0.72)
    }
  }

  if (!isTethered) return

  for (let index = 0; index < NODE_COUNT - 1; index += 1) {
    const from = nodes[index]
    const to = nodes[index + 1]
    if (!from || !to) continue

    const deltaX = to.x - from.x
    const deltaY = to.y - from.y
    const distance = Math.hypot(deltaX, deltaY)
    const steps = Math.floor(distance / 10)

    for (let step = 1; step < steps; step += 1) {
      const progress = step / steps
      const x = quantise(from.x + deltaX * progress)
      const y = quantise(from.y + deltaY * progress)
      drawPixel(x, y, 2, '#ffd8e8', ropeOpacity * 0.56)
    }
  }
}

function drawSignalHead() {
  if (!context || ropeOpacity <= 0) return
  const head = nodes[0]
  if (!head) return
  const headX = quantise(head.x)
  const headY = quantise(head.y)

  drawPixel(headX, headY, 10, '#f4a6c3', ropeOpacity * 0.18)
  drawPixel(headX, headY, 6, '#e47da5', ropeOpacity * 0.72)
  drawPixel(headX, headY, 2, '#fff7e6', ropeOpacity)
}

function drawAnchorSignal() {
  if (!context || pressedPointerId < 0 || ropeOpacity <= 0) return
  const x = quantise(interaction ? interaction.startX + interaction.currentX : pressX)
  const y = quantise(interaction ? interaction.startY + interaction.currentY : pressY)
  drawPixel(x, y, 10, '#e47da5', ropeOpacity * 0.26)
  drawPixel(x, y, 5, '#ffd8e8', ropeOpacity * 0.78)
  drawPixel(x, y, 2, '#fff7e6', ropeOpacity)
}

function drawSparks() {
  if (!context) return
  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const spark = sparks[index]
    if (!spark?.active) continue
    context.globalAlpha = clamp(spark.life * 2.4, 0, 1)
    context.fillStyle = spark.color === 0 ? '#ff8fbd' : spark.color === 1 ? '#fff2a9' : '#ffd7eb'
    const x = quantise(spark.x)
    const y = quantise(spark.y)
    context.fillRect(x, y, spark.size, spark.size)
    includeDirtyPoint(x, y, spark.size + 2)
  }
}

function ropeIsSettled() {
  const head = nodes[0]
  if (!head) return true
  for (let index = 1; index < NODE_COUNT; index += 1) {
    const node = nodes[index]
    if (!node) continue
    if (Math.hypot(node.x - head.x, node.y - head.y) > SETTLE_DISTANCE) return false
    if (Math.hypot(node.vx, node.vy) > SETTLE_SPEED) return false
  }
  return true
}

function animate(now: number) {
  frame = 0
  if (!overlayEnabled.value || !context) return

  const dt = Math.min(0.024, Math.max(0.001, lastFrameTime ? (now - lastFrameTime) / 1000 : 1 / 60))
  lastFrameTime = now

  clearPreviousFrame()
  updateInteraction(dt)
  updateRope(dt)
  const activeSparks = updateSparks(dt)

  if (now - lastInputTime > 150 && pressedPointerId < 0 && !interaction) {
    ropeOpacity = Math.max(0, ropeOpacity - dt * 3.6)
  }

  drawSignalTrail()
  drawSignalHead()
  drawAnchorSignal()
  drawSparks()
  context.globalAlpha = 1

  const settled = ropeIsSettled()
  if (settled && ropeOpacity <= 0 && activeSparks === 0 && !interaction) {
    settleFrames += 1
  } else {
    settleFrames = 0
  }

  if (settleFrames >= 6) {
    state = 'idle'
    clearPreviousFrame()
    lastFrameTime = 0
    return
  }

  requestFrame()
}

function requestFrame() {
  if (frame || !overlayEnabled.value) return
  frame = window.requestAnimationFrame(animate)
}

function spawnBurst(x: number, y: number, kind: PixelBurstKind, count = 8) {
  if (!overlayEnabled.value) return
  let spawned = 0
  for (let index = 0; index < SPARK_COUNT && spawned < count; index += 1) {
    const spark = sparks[index]
    if (!spark || spark.active) continue
    const angle = (Math.PI * 2 * spawned) / count + Math.random() * 0.35
    const speed = 34 + Math.random() * 46
    spark.active = true
    spark.x = x
    spark.y = y
    spark.vx = Math.cos(angle) * speed
    spark.vy = Math.sin(angle) * speed - (kind === 'petal' ? 18 : 4)
    spark.life = 0.34 + Math.random() * 0.18
    spark.size = kind === 'petal' && spawned % 2 === 0 ? 4 : 2
    spark.color = spawned % 3
    spawned += 1
  }
  requestFrame()
}

function burstAt(x: number, y: number, kind: PixelBurstKind = 'spark') {
  spawnBurst(x, y, kind, kind === 'petal' ? 12 : 8)
}

function resetMagnet(immediate = false) {
  window.clearTimeout(magnetResetTimer)
  if (!magnetElement) return
  const previous = magnetElement
  previous.style.setProperty('--pixel-magnet-x', '0px')
  previous.style.setProperty('--pixel-magnet-y', '0px')
  magnetElement = null

  if (immediate) {
    previous.classList.remove('pixel-cursor-magnetic-target', 'pixel-cursor-motion-target')
    previous.style.removeProperty('--pixel-magnet-x')
    previous.style.removeProperty('--pixel-magnet-y')
    return
  }

  magnetResetTimer = window.setTimeout(() => {
    if (!previous.classList.contains('pixel-cursor-drag-target')) {
      previous.classList.remove('pixel-cursor-magnetic-target', 'pixel-cursor-motion-target')
    }
    previous.style.removeProperty('--pixel-magnet-x')
    previous.style.removeProperty('--pixel-magnet-y')
  }, 150)
}

function updateMagnet(event: PointerEvent) {
  if (interaction || pressedPointerId >= 0) {
    resetMagnet()
    return
  }

  const next = safeClosest(event.target, props.magneticSelector)
  if (next !== magnetElement) {
    resetMagnet()
    if (next) {
      window.clearTimeout(magnetResetTimer)
      magnetElement = next
      const rect = next.getBoundingClientRect()
      magnetLeft = rect.left
      magnetTop = rect.top
      magnetWidth = rect.width
      magnetHeight = rect.height
      next.classList.add('pixel-cursor-motion-target', 'pixel-cursor-magnetic-target')
    }
  }

  if (!magnetElement || magnetWidth <= 0 || magnetHeight <= 0) return
  const mode = magnetElement.dataset.pixelMagnet
  const strength = mode === 'strong' ? 0.12 : mode === 'soft' ? 0.07 : 0.085
  const limit = mode === 'strong' ? 6 : mode === 'soft' ? 3.5 : 4
  const centerX = magnetLeft + magnetWidth / 2
  const centerY = magnetTop + magnetHeight / 2
  const offsetX = clamp((event.clientX - centerX) * strength, -limit, limit)
  const offsetY = clamp((event.clientY - centerY) * strength, -limit, limit)
  magnetElement.style.setProperty('--pixel-magnet-x', `${offsetX.toFixed(2)}px`)
  magnetElement.style.setProperty('--pixel-magnet-y', `${offsetY.toFixed(2)}px`)
  state = 'magnetic'
}

function updateDragTarget(event: PointerEvent) {
  if (!interaction || event.pointerId !== interaction.pointerId) return
  const rawX = event.clientX - interaction.startX
  const rawY = event.clientY - interaction.startY
  const distance = Math.hypot(rawX, rawY)

  if (!interaction.started && distance >= DRAG_THRESHOLD) {
    interaction.started = true
    interaction.element.classList.add('pixel-cursor-is-dragging')
    suppressClickElement = interaction.element
    suppressClickUntil = performance.now() + 520
    state = 'dragging'

    if (interaction.kind === 'drag') {
      emit('drag-start', {
        id: interaction.id,
        source: interaction.element,
        pointer: { x: event.clientX, y: event.clientY },
        origin: { x: interaction.startX, y: interaction.startY },
      })
    }
  }

  if (!interaction.started) return
  let nextX = interaction.axis === 'y' ? 0 : rawX
  let nextY = interaction.axis === 'x' ? 0 : rawY

  if (interaction.kind === 'tug') {
    const tugDistance = Math.hypot(nextX, nextY)
    if (tugDistance > interaction.tugLimit) {
      const scale = interaction.tugLimit / tugDistance
      nextX *= scale
      nextY *= scale
    }
  } else {
    nextX = clamp(nextX, 8 - interaction.originLeft, canvasWidth - 8 - interaction.originRight)
    nextY = clamp(nextY, 8 - interaction.originTop, canvasHeight - 8 - interaction.originBottom)
  }

  interaction.desiredX = nextX
  interaction.desiredY = nextY

  if (interaction.kind === 'drag') {
    const zone = findDropZone(event.clientX, event.clientY)
    setDropPreview(zone && acceptsDrop(zone, interaction.id) ? zone : null)
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!overlayEnabled.value || event.pointerType === 'touch') return
  if (!ropeInitialised) initialiseRope(event.clientX, event.clientY)
  ropeOpacity = 1
  lastInputTime = performance.now()
  settleFrames = 0

  if (interaction) {
    updateDragTarget(event)
  } else {
    updateMagnet(event)
    if (pressedPointerId < 0 && state !== 'magnetic') state = 'tracking'
  }

  requestFrame()
}

function createInteraction(element: HTMLElement, kind: InteractionKind, event: PointerEvent) {
  const rect = element.getBoundingClientRect()
  const axisValue = element.dataset.pixelAxis
  const axis = axisValue === 'x' || axisValue === 'y' ? axisValue : 'both'
  const thresholdValue = Number(element.dataset.pixelTugThreshold)
  const tugThreshold = Number.isFinite(thresholdValue) && thresholdValue > 0 ? thresholdValue : 34
  const limitValue = Number(element.dataset.pixelTugLimit)
  const tugLimit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : Math.max(44, tugThreshold * 1.55)
  const id = kind === 'drag' ? element.dataset.pixelDrag : element.dataset.pixelTug

  interaction = {
    kind,
    id: id || element.id || kind,
    element,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originLeft: rect.left,
    originTop: rect.top,
    originRight: rect.right,
    originBottom: rect.bottom,
    currentX: 0,
    currentY: 0,
    desiredX: 0,
    desiredY: 0,
    velocityX: 0,
    velocityY: 0,
    axis,
    started: false,
    tugThreshold,
    tugLimit,
    snapX: event.clientX,
    snapY: event.clientY,
    burstPending: false,
  }

  element.classList.add('pixel-cursor-motion-target', 'pixel-cursor-drag-target')
  element.style.setProperty('--pixel-drag-x', '0px')
  element.style.setProperty('--pixel-drag-y', '0px')

  try {
    element.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture is an enhancement. Delegated document listeners still complete the interaction.
  }
}

function handlePointerDown(event: PointerEvent) {
  if (!overlayEnabled.value || event.pointerType === 'touch' || event.button !== 0) return
  pointerField.markPressed(event)
  pressedPointerId = event.pointerId
  pressX = event.clientX
  pressY = event.clientY
  ropeOpacity = 1
  lastInputTime = performance.now()
  state = 'pressed'
  resetMagnet()

  const dragElement = safeClosest(event.target, props.dragSelector)
  const tugElement = safeClosest(event.target, '[data-pixel-tug]')
  if (dragElement) createInteraction(dragElement, 'drag', event)
  else if (tugElement) createInteraction(tugElement, 'tug', event)

  requestFrame()
}

function acceptsDrop(zone: HTMLElement, id: string) {
  const accept = zone.dataset.pixelAccept?.trim()
  if (!accept || accept === '*') return true
  return accept.split(',').some((item) => item.trim() === id)
}

function findDropZone(x: number, y: number) {
  const stack = document.elementsFromPoint(x, y)
  for (let index = 0; index < stack.length; index += 1) {
    const element = stack[index]
    if (!(element instanceof Element)) continue
    try {
      const candidate = element.matches(props.dropSelector) ? element : element.closest(props.dropSelector)
      if (candidate instanceof HTMLElement) return candidate
    } catch {
      return null
    }
  }
  return null
}

function setDropPreview(next: HTMLElement | null) {
  if (next === dropPreviewElement) return
  dropPreviewElement?.classList.remove('pixel-cursor-drop-preview')
  dropPreviewElement = next
  dropPreviewElement?.classList.add('pixel-cursor-drop-preview')
}

function clearDropPreview() {
  dropPreviewElement?.classList.remove('pixel-cursor-drop-preview')
  dropPreviewElement = null
}

function celebrateDrop(zone: HTMLElement) {
  window.clearTimeout(dropSuccessTimer)
  zone.classList.remove('pixel-cursor-drop-success')
  window.requestAnimationFrame(() => zone.classList.add('pixel-cursor-drop-success'))
  dropSuccessTimer = window.setTimeout(() => {
    zone.classList.remove('pixel-cursor-drop-success')
  }, 620)
}

function releasePointerCapture(active: ActiveInteraction) {
  try {
    if (active.element.hasPointerCapture(active.pointerId)) {
      active.element.releasePointerCapture(active.pointerId)
    }
  } catch {
    // The pointer may already have been released by the browser.
  }
}

function handleDragRelease(event: PointerEvent, active: ActiveInteraction) {
  const rawX = event.clientX - active.startX
  const rawY = event.clientY - active.startY
  const distance = Math.hypot(rawX, rawY)

  if (active.kind === 'tug') {
    if (distance >= active.tugThreshold) {
      const safeDistance = Math.max(1, distance)
      emit('tug', {
        id: active.id,
        source: active.element,
        pointer: { x: event.clientX, y: event.clientY },
        tension: distance,
        direction: { x: rawX / safeDistance, y: rawY / safeDistance },
      })
      spawnBurst(event.clientX, event.clientY, 'petal', 10)
    }
    active.desiredX = 0
    active.desiredY = 0
    state = 'recoil'
    return
  }

  const zone = findDropZone(event.clientX, event.clientY)
  const accepted = Boolean(zone && acceptsDrop(zone, active.id))
  emit('drop', {
    id: active.id,
    source: active.element,
    dropZone: zone,
    dropZoneId: zone ? zone.dataset.pixelDrop || zone.id || null : null,
    pointer: { x: event.clientX, y: event.clientY },
    delta: { x: rawX, y: rawY },
    distance,
    accepted,
  })

  if (zone && accepted) {
    clearDropPreview()
    celebrateDrop(zone)
    const zoneRect = zone.getBoundingClientRect()
    active.desiredX = zoneRect.left + zoneRect.width / 2 - (active.originLeft + active.originRight) / 2
    active.desiredY = zoneRect.top + zoneRect.height / 2 - (active.originTop + active.originBottom) / 2
    if (active.axis === 'x') active.desiredY = 0
    if (active.axis === 'y') active.desiredX = 0
    active.snapX = zoneRect.left + zoneRect.width / 2
    active.snapY = zoneRect.top + zoneRect.height / 2
    active.burstPending = true
    state = 'snapping'
  } else {
    clearDropPreview()
    active.desiredX = 0
    active.desiredY = 0
    state = 'recoil'
  }
}

function handlePointerUp(event: PointerEvent) {
  if (event.pointerId !== pressedPointerId) return
  pointerField.markReleased(event)
  pressedPointerId = -1
  lastInputTime = performance.now()

  const active = interaction
  if (active) {
    releasePointerCapture(active)
    if (active.started) handleDragRelease(event, active)
    else {
      finishInteraction()
      state = 'settling'
    }
  } else {
    state = 'settling'
  }

  requestFrame()
}

function finishInteraction() {
  if (!interaction) return
  const element = interaction.element
  element.classList.remove('pixel-cursor-is-dragging', 'pixel-cursor-drag-target')
  element.style.removeProperty('--pixel-drag-x')
  element.style.removeProperty('--pixel-drag-y')
  if (!element.classList.contains('pixel-cursor-magnetic-target')) {
    element.classList.remove('pixel-cursor-motion-target')
  }
  clearDropPreview()
  interaction = null
}

function cancelDrag() {
  if (!interaction) return
  const active = interaction
  pressedPointerId = -1
  pointerField.markReleased()
  releasePointerCapture(active)
  active.desiredX = 0
  active.desiredY = 0
  state = 'recoil'
  requestFrame()
}

function handlePointerCancel(event: PointerEvent) {
  if (event.pointerId !== pressedPointerId && event.pointerId !== interaction?.pointerId) return
  cancelDrag()
  if (!interaction) {
    pressedPointerId = -1
    pointerField.markReleased(event)
    state = 'settling'
    requestFrame()
  }
}

function handleLostPointerCapture(event: PointerEvent) {
  if (interaction && event.pointerId === interaction.pointerId && pressedPointerId >= 0) {
    cancelDrag()
  }
}

function handleClick(event: MouseEvent) {
  if (!suppressClickElement || performance.now() > suppressClickUntil) {
    suppressClickElement = null
    return
  }
  if (event.target instanceof Node && suppressClickElement.contains(event.target)) {
    event.preventDefault()
    event.stopImmediatePropagation()
    suppressClickElement = null
  }
}

function suspend() {
  resetMagnet(true)
  clearDropPreview()
  if (interaction) {
    const element = interaction.element
    releasePointerCapture(interaction)
    finishInteraction()
    element.blur()
  }
  pressedPointerId = -1
  ropeOpacity = 0
  ropeInitialised = false
  state = 'suspended'
  pointerField.deactivate()
  if (frame) window.cancelAnimationFrame(frame)
  frame = 0
  lastFrameTime = 0
  clearCanvas()
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') suspend()
  else if (overlayEnabled.value) state = 'idle'
}

function handleScroll() {
  resetMagnet()
  if (interaction && pressedPointerId >= 0) cancelDrag()
}

function updatePreferences() {
  const enabled = Boolean(finePointerQuery?.matches)
    && !Boolean(reducedMotionQuery?.matches)
    && !Boolean(forcedColorsQuery?.matches)
  overlayEnabled.value = enabled

  if (!enabled) {
    state = reducedMotionQuery?.matches ? 'static' : 'suspended'
    suspend()
  } else {
    state = 'idle'
    setCanvasSize()
  }
}

function reset() {
  resetMagnet(true)
  clearDropPreview()
  if (interaction) finishInteraction()
  pressedPointerId = -1
  ropeOpacity = 0
  ropeInitialised = false
  settleFrames = 0
  state = overlayEnabled.value ? 'idle' : 'suspended'
  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const spark = sparks[index]
    if (spark) spark.active = false
  }
  if (frame) window.cancelAnimationFrame(frame)
  frame = 0
  lastFrameTime = 0
  clearCanvas()
}

onMounted(() => {
  if (!canvas.value) return
  context = canvas.value.getContext('2d', { alpha: true })
  if (!context) return

  finePointerQuery = window.matchMedia('(pointer: fine)')
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  forcedColorsQuery = window.matchMedia('(forced-colors: active)')
  finePointerQuery.addEventListener('change', updatePreferences)
  reducedMotionQuery.addEventListener('change', updatePreferences)
  forcedColorsQuery.addEventListener('change', updatePreferences)

  pointerField.start()
  unsubscribePointer = pointerField.subscribe(handlePointerMove)
  updatePreferences()

  document.addEventListener('pointerdown', handlePointerDown, true)
  document.addEventListener('pointerup', handlePointerUp, true)
  document.addEventListener('pointercancel', handlePointerCancel, true)
  document.addEventListener('lostpointercapture', handleLostPointerCapture, true)
  document.addEventListener('click', handleClick, true)
  document.documentElement.addEventListener('mouseleave', suspend)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('blur', suspend)
  window.addEventListener('resize', setCanvasSize, { passive: true })
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  reset()
  pointerField.stop()
  unsubscribePointer?.()
  finePointerQuery?.removeEventListener('change', updatePreferences)
  reducedMotionQuery?.removeEventListener('change', updatePreferences)
  forcedColorsQuery?.removeEventListener('change', updatePreferences)
  document.removeEventListener('pointerdown', handlePointerDown, true)
  document.removeEventListener('pointerup', handlePointerUp, true)
  document.removeEventListener('pointercancel', handlePointerCancel, true)
  document.removeEventListener('lostpointercapture', handleLostPointerCapture, true)
  document.removeEventListener('click', handleClick, true)
  document.documentElement.removeEventListener('mouseleave', suspend)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('blur', suspend)
  window.removeEventListener('resize', setCanvasSize)
  window.removeEventListener('scroll', handleScroll)
  window.clearTimeout(magnetResetTimer)
  window.clearTimeout(dropSuccessTimer)
})

defineExpose<PixelCursorHandle>({ burstAt, cancelDrag, reset })
</script>

<template>
  <canvas
    ref="canvas"
    class="pixel-tether-canvas"
    :class="{ 'is-enabled': overlayEnabled }"
    aria-hidden="true"
  />
</template>

<style scoped>
.pixel-tether-canvas {
  position: fixed;
  inset: 0;
  z-index: 90;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  image-rendering: pixelated;
}

.pixel-tether-canvas.is-enabled {
  opacity: 1;
}

:global(.pixel-cursor-motion-target) {
  translate:
    calc(var(--pixel-magnet-x, 0px) + var(--pixel-drag-x, 0px))
    calc(var(--pixel-magnet-y, 0px) + var(--pixel-drag-y, 0px));
}

:global(.pixel-cursor-magnetic-target) {
  filter: saturate(1.12) brightness(1.05);
  transition: translate 140ms steps(3, end), filter 140ms steps(3, end);
}

:global(.pixel-cursor-drag-target) {
  will-change: translate;
}

:global(.pixel-cursor-is-dragging) {
  transition: none;
  user-select: none;
}

:global(.pixel-cursor-drop-preview) {
  outline: 3px solid #fff4dc;
  outline-offset: 5px;
  box-shadow: 0 0 0 5px rgb(236 124 165 / 0.35), 0 0 24px rgb(244 166 195 / 0.62);
  animation: pixel-drop-beacon 520ms steps(3, end) infinite alternate;
}

:global(.pixel-cursor-drop-success) {
  animation: pixel-drop-success 620ms steps(5, end);
}

@keyframes pixel-drop-beacon {
  to {
    outline-color: #f6aac4;
    filter: brightness(1.12) saturate(1.2);
  }
}

@keyframes pixel-drop-success {
  0% { filter: brightness(1.35) saturate(1.3); }
  32% { filter: brightness(1.58) saturate(1.46) drop-shadow(0 0 16px #ffdce8); }
  100% { filter: none; }
}

@media (prefers-reduced-motion: reduce), (pointer: coarse), (forced-colors: active) {
  .pixel-tether-canvas {
    display: none;
  }

  :global(.pixel-cursor-motion-target) {
    translate: none;
  }
}
</style>
