export type PixelCursorState =
  | 'suspended'
  | 'idle'
  | 'tracking'
  | 'magnetic'
  | 'pressed'
  | 'dragging'
  | 'snapping'
  | 'recoil'
  | 'settling'
  | 'static'

export type PixelPointerType = 'mouse' | 'pen' | 'touch' | 'unknown'

export type PixelPoint = {
  x: number
  y: number
}

export type PixelPointerField = PixelPoint & {
  vx: number
  vy: number
  speed: number
  pressed: boolean
  active: boolean
  pointerId: number
  pointerType: PixelPointerType
  lastUpdated: number
}

export type PixelDragStartDetail = {
  id: string
  source: HTMLElement
  pointer: PixelPoint
  origin: PixelPoint
}

export type PixelDropDetail = {
  id: string
  source: HTMLElement
  dropZone: HTMLElement | null
  dropZoneId: string | null
  pointer: PixelPoint
  delta: PixelPoint
  distance: number
  accepted: boolean
}

export type PixelTugDetail = {
  id: string
  source: HTMLElement
  pointer: PixelPoint
  tension: number
  direction: PixelPoint
}

export type PixelBurstKind = 'spark' | 'petal'

export type PixelCursorHandle = {
  burstAt: (x: number, y: number, kind?: PixelBurstKind) => void
  cancelDrag: () => void
  reset: () => void
}

export type PixelCursorProps = {
  magneticSelector?: string
  dragSelector?: string
  dropSelector?: string
}
