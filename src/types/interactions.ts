export type PointerPosition = {
  x: number
  y: number
}

export type FlowerStage = 0 | 1 | 2 | 3 | 4

export type GardenTool = 'seed' | 'water'

export type FlowerKind = 'rose' | 'tulip' | 'cosmos' | 'star'

export type GardenCell = {
  id: number
  stage: FlowerStage
  kind: FlowerKind
  wateredAt: number | null
}

export type GardenUnlockId = 'first-bloom' | 'four-blooms' | 'full-garden'

export type GardenUnlockDetail = {
  id: GardenUnlockId
  blooms: number
  planted: number
}

export type GardenSaveV1 = {
  version: 1
  cells: GardenCell[]
  unlocked: GardenUnlockId[]
  savedAt: number
}

export type EasterEggId = 'hello-world' | 'konami'

export type EasterEggDetail = {
  id: EasterEggId
  unlockedAt: number
}

export type SakuraCanvasHandle = {
  startRain: (duration?: number) => void
  stopRain: () => void
}

export type PetalCatchDetail = {
  x: number
  y: number
}
