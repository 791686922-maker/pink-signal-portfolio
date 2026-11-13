export const WORLD_STORAGE_KEY = 'pink-signal-farm:v2' as const

export type WorldShardId = 'bloom' | 'broadcast' | 'ember'

export type WorldInventoryItem =
  | 'sakura-seed'
  | 'copper-key'
  | 'old-battery'

export type WorldShardState = Record<WorldShardId, boolean>

export type FarmWorldStateV2 = {
  version: 2
  unlocked: string[]
  inventory: WorldInventoryItem[]
  shards: WorldShardState
  caughtPetals: number
  towerBands: number[]
  catTrust: number
  revivedFailedProject: boolean
  endingSeen: boolean
  lastVisitDate: string
  soundEnabled: boolean
}

export type FarmWorldSnapshot = Readonly<FarmWorldStateV2>

export type FarmWorldActions = {
  restore: () => FarmWorldStateV2
  save: () => boolean
  unlock: (id: string) => boolean
  addItem: (item: WorldInventoryItem) => boolean
  removeItem: (item: WorldInventoryItem) => boolean
  claimShard: (id: WorldShardId) => boolean
  catchPetal: (amount?: number) => number
  petCat: (amount?: number) => number
  markBand: (band: number) => number
  reviveProject: () => boolean
  completeEnding: () => boolean
  setSoundEnabled: (enabled: boolean) => void
  reset: () => void
}
