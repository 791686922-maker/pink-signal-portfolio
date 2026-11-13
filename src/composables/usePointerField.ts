import type { PixelPointerField, PixelPointerType } from '../types/pixelCursor'

type PointerFieldListener = (event: PointerEvent, field: PixelPointerField) => void

const listeners = new Set<PointerFieldListener>()

const field: PixelPointerField = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  speed: 0,
  pressed: false,
  active: false,
  pointerId: -1,
  pointerType: 'unknown',
  lastUpdated: 0,
}

let consumers = 0
let listening = false

function normalisePointerType(pointerType: string): PixelPointerType {
  if (pointerType === 'mouse' || pointerType === 'pen' || pointerType === 'touch') {
    return pointerType
  }
  return 'unknown'
}

function updatePosition(event: PointerEvent) {
  const elapsed = event.timeStamp - field.lastUpdated
  const nextX = event.clientX
  const nextY = event.clientY

  if (field.active && elapsed > 0 && elapsed < 120) {
    const seconds = elapsed / 1000
    const instantVx = (nextX - field.x) / seconds
    const instantVy = (nextY - field.y) / seconds
    field.vx = field.vx * 0.68 + instantVx * 0.32
    field.vy = field.vy * 0.68 + instantVy * 0.32
    field.speed = Math.hypot(field.vx, field.vy)
  } else {
    field.vx = 0
    field.vy = 0
    field.speed = 0
  }

  field.x = nextX
  field.y = nextY
  field.active = true
  field.pointerId = event.pointerId
  field.pointerType = normalisePointerType(event.pointerType)
  field.lastUpdated = event.timeStamp
}

function handlePointerMove(event: PointerEvent) {
  updatePosition(event)
  listeners.forEach((listener) => listener(event, field))
}

function attach() {
  if (listening) return
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  listening = true
}

function detach() {
  if (!listening) return
  window.removeEventListener('pointermove', handlePointerMove)
  listening = false
}

function markPressed(event: PointerEvent) {
  updatePosition(event)
  field.pressed = true
}

function markReleased(event?: PointerEvent) {
  if (event) updatePosition(event)
  field.pressed = false
}

function deactivate() {
  field.vx = 0
  field.vy = 0
  field.speed = 0
  field.pressed = false
  field.active = false
  field.pointerId = -1
  field.pointerType = 'unknown'
  field.lastUpdated = 0
}

export function usePointerField() {
  let acquired = false

  function start() {
    if (acquired) return
    acquired = true
    consumers += 1
    attach()
  }

  function stop() {
    if (!acquired) return
    acquired = false
    consumers = Math.max(0, consumers - 1)
    if (consumers === 0) {
      detach()
      deactivate()
    }
  }

  function subscribe(listener: PointerFieldListener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    field,
    start,
    stop,
    subscribe,
    markPressed,
    markReleased,
    deactivate,
  }
}
