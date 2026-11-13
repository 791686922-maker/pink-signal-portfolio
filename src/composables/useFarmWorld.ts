import { computed, readonly, reactive } from 'vue'

import {
  WORLD_STORAGE_KEY,
  type FarmWorldStateV2,
  type WorldInventoryItem,
  type WorldShardId,
} from '../types/world'

const INVENTORY_ITEMS: WorldInventoryItem[] = [
  'sakura-seed',
  'copper-key',
  'old-battery',
]
const SHARD_IDS: WorldShardId[] = ['bloom', 'broadcast', 'ember']
const MAX_COUNTER = 999

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultState(): FarmWorldStateV2 {
  return {
    version: 2,
    unlocked: [],
    inventory: [],
    shards: {
      bloom: false,
      broadcast: false,
      ember: false,
    },
    caughtPetals: 0,
    towerBands: [],
    catTrust: 0,
    revivedFailedProject: false,
    endingSeen: false,
    lastVisitDate: todayKey(),
    soundEnabled: false,
  }
}

const worldState = reactive<FarmWorldStateV2>(createDefaultState())
let restored = false
let storageListenerReady = false

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeInteger(value: unknown, fallback = 0, max = MAX_COUNTER) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(0, Math.trunc(value)))
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).slice(0, 128)
}

function safeInventory(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is WorldInventoryItem => INVENTORY_ITEMS.includes(entry as WorldInventoryItem),
  ).slice(0, 64)
}

function safeBands(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
        .map((entry) => Math.round(entry * 10) / 10),
    ),
  ).slice(0, 12)
}

function safeDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : todayKey()
}

function sanitizeState(value: unknown): FarmWorldStateV2 {
  const fallback = createDefaultState()
  if (!isRecord(value) || value.version !== 2) return fallback

  const rawShards = isRecord(value.shards) ? value.shards : {}

  return {
    version: 2,
    unlocked: uniqueStrings(value.unlocked),
    inventory: safeInventory(value.inventory),
    shards: {
      bloom: rawShards.bloom === true,
      broadcast: rawShards.broadcast === true,
      ember: rawShards.ember === true,
    },
    caughtPetals: safeInteger(value.caughtPetals),
    towerBands: safeBands(value.towerBands),
    catTrust: safeInteger(value.catTrust, 0, 3),
    revivedFailedProject: value.revivedFailedProject === true,
    endingSeen: value.endingSeen === true,
    lastVisitDate: safeDate(value.lastVisitDate),
    soundEnabled: value.soundEnabled === true,
  }
}

function applyState(nextState: FarmWorldStateV2) {
  worldState.version = 2
  worldState.unlocked = [...nextState.unlocked]
  worldState.inventory = [...nextState.inventory]
  worldState.shards = { ...nextState.shards }
  worldState.caughtPetals = nextState.caughtPetals
  worldState.towerBands = [...nextState.towerBands]
  worldState.catTrust = nextState.catTrust
  worldState.revivedFailedProject = nextState.revivedFailedProject
  worldState.endingSeen = nextState.endingSeen
  worldState.lastVisitDate = nextState.lastVisitDate
  worldState.soundEnabled = nextState.soundEnabled
}

function snapshot(): FarmWorldStateV2 {
  return {
    version: 2,
    unlocked: [...worldState.unlocked],
    inventory: [...worldState.inventory],
    shards: { ...worldState.shards },
    caughtPetals: worldState.caughtPetals,
    towerBands: [...worldState.towerBands],
    catTrust: worldState.catTrust,
    revivedFailedProject: worldState.revivedFailedProject,
    endingSeen: worldState.endingSeen,
    lastVisitDate: worldState.lastVisitDate,
    soundEnabled: worldState.soundEnabled,
  }
}

function persist() {
  if (typeof window === 'undefined') return false

  try {
    window.localStorage.setItem(WORLD_STORAGE_KEY, JSON.stringify(snapshot()))
    return true
  } catch {
    return false
  }
}

function restoreFromValue(raw: string | null) {
  if (!raw) {
    applyState(createDefaultState())
    return
  }

  try {
    applyState(sanitizeState(JSON.parse(raw)))
  } catch {
    applyState(createDefaultState())
  }
}

function restore() {
  if (typeof window === 'undefined') return snapshot()

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(WORLD_STORAGE_KEY)
  } catch {
    raw = null
  }

  restoreFromValue(raw)
  const today = todayKey()
  if (worldState.lastVisitDate !== today) {
    worldState.lastVisitDate = today
    persist()
  }
  restored = true
  return snapshot()
}

function ensureRestored() {
  if (!restored) restore()

  if (typeof window !== 'undefined' && !storageListenerReady) {
    window.addEventListener('storage', (event) => {
      if (event.key !== WORLD_STORAGE_KEY) return
      restoreFromValue(event.newValue)
      worldState.lastVisitDate = todayKey()
    })
    storageListenerReady = true
  }
}

function unlock(id: string) {
  const normalized = id.trim()
  if (!normalized || worldState.unlocked.includes(normalized)) return false

  worldState.unlocked = [...worldState.unlocked, normalized].slice(-128)
  persist()
  return true
}

function addItem(item: WorldInventoryItem) {
  if (!INVENTORY_ITEMS.includes(item)) return false

  worldState.inventory = [...worldState.inventory, item].slice(-64)
  unlock(`item:${item}`)
  persist()
  return true
}

function removeItem(item: WorldInventoryItem) {
  const index = worldState.inventory.indexOf(item)
  if (index < 0) return false

  worldState.inventory = worldState.inventory.filter((_, itemIndex) => itemIndex !== index)
  persist()
  return true
}

function claimShard(id: WorldShardId) {
  if (!SHARD_IDS.includes(id) || worldState.shards[id]) return false

  worldState.shards[id] = true
  unlock(`shard:${id}`)
  persist()
  return true
}

function catchPetal(amount = 1) {
  const increment = safeInteger(amount, 1, 24)
  worldState.caughtPetals = Math.min(MAX_COUNTER, worldState.caughtPetals + increment)
  unlock('petal:caught')

  if (worldState.caughtPetals >= 6 && !worldState.unlocked.includes('seed:sakura-ready')) {
    worldState.unlocked = [...worldState.unlocked, 'seed:sakura-ready']
    worldState.inventory = [
      ...worldState.inventory,
      'sakura-seed' as WorldInventoryItem,
    ].slice(-64)
  }

  persist()
  return worldState.caughtPetals
}

function petCat(amount = 1) {
  const increment = safeInteger(amount, 1, 3)
  worldState.catTrust = Math.min(3, worldState.catTrust + increment)
  unlock('cat:met')
  if (worldState.catTrust >= 3) unlock('cat:trusted')
  persist()
  return worldState.catTrust
}

function markBand(band: number) {
  if (!Number.isFinite(band)) return worldState.towerBands.length

  const normalized = Math.round(band * 10) / 10
  if (!worldState.towerBands.includes(normalized)) {
    worldState.towerBands = [...worldState.towerBands, normalized].slice(-12)
    unlock(`band:${normalized}`)
  }
  if (worldState.towerBands.length >= 3) unlock('tower:tuned')
  persist()
  return worldState.towerBands.length
}

function reviveProject() {
  if (worldState.revivedFailedProject) return false

  removeItem('old-battery')
  worldState.revivedFailedProject = true
  unlock('project:revived')
  claimShard('ember')
  persist()
  return true
}

function completeEnding() {
  if (worldState.endingSeen) return false

  worldState.endingSeen = true
  unlock('ending:zero-broadcast')
  persist()
  return true
}

function setSoundEnabled(enabled: boolean) {
  worldState.soundEnabled = Boolean(enabled)
  persist()
}

function reset() {
  applyState(createDefaultState())
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(WORLD_STORAGE_KEY)
    } catch {
      // 浏览器可能禁用本地存储，内存状态仍然已经重置。
    }
  }
  restored = true
}

export function useFarmWorld() {
  ensureRestored()

  const shardCount = computed(() => SHARD_IDS.filter((id) => worldState.shards[id]).length)
  const endingReady = computed(() => shardCount.value === SHARD_IDS.length)
  const hasAnyDiscovery = computed(
    () =>
      worldState.unlocked.length > 0 ||
      worldState.inventory.length > 0 ||
      worldState.caughtPetals > 0 ||
      shardCount.value > 0,
  )

  return {
    state: readonly(worldState),
    shardCount,
    endingReady,
    hasAnyDiscovery,
    restore,
    save: persist,
    unlock,
    addItem,
    removeItem,
    claimShard,
    catchPetal,
    petCat,
    markBand,
    reviveProject,
    completeEnding,
    setSoundEnabled,
    reset,
  }
}
