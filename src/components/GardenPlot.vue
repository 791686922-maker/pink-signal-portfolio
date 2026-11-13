<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type {
  FlowerKind,
  FlowerStage,
  GardenCell,
  GardenTool,
  GardenUnlockDetail,
  GardenUnlockId,
} from '../types/interactions'

const props = withDefaults(
  defineProps<{
    hasSpecialSeed?: boolean
    bloomShardClaimed?: boolean
  }>(),
  {
    hasSpecialSeed: false,
    bloomShardClaimed: false,
  },
)

const emit = defineEmits<{
  unlock: [detail: GardenUnlockDetail]
  'special-bloom': []
}>()

const STORAGE_KEY = 'pink-signal-garden:v1'
const FLOWER_KINDS: FlowerKind[] = ['rose', 'tulip', 'cosmos', 'star']
const STAGE_NAMES: Record<FlowerStage, string> = {
  0: '空地',
  1: '种子',
  2: '嫩芽',
  3: '花苞',
  4: '盛开',
}

type ActiveGardenTool = GardenTool | 'sakura'

type GardenSaveV2 = {
  version: 2
  cells: GardenCell[]
  unlocked: GardenUnlockId[]
  savedAt: number
  special: {
    cellId: number | null
    waterings: number
    bloomEmitted: boolean
  }
}

function createEmptyCells(): GardenCell[] {
  return Array.from({ length: 16 }, (_, id) => ({
    id,
    stage: 0,
    kind: FLOWER_KINDS[id % FLOWER_KINDS.length] ?? 'rose',
    wateredAt: null,
  }))
}

const cells = ref<GardenCell[]>(createEmptyCells())
const activeTool = ref<ActiveGardenTool>('seed')
const announcement = ref('花圃准备好了。先选择播种，再点击一块土地。')
const unlocked = ref<GardenUnlockId[]>([])
const specialCellId = ref<number | null>(null)
const specialWaterings = ref(0)
const specialBloomEmitted = ref(false)
const bloomCelebrating = ref(false)
const resetArmed = ref(false)

let bloomTimer = 0
let resetTimer = 0
let paintingPointerId: number | null = null
let ignorePointerClickUntil = 0
const paintedCells = new Set<number>()

const bloomCount = computed(() => cells.value.filter((cell) => cell.stage === 4).length)
const plantedCount = computed(() => cells.value.filter((cell) => cell.stage > 0).length)
const specialSeedAvailable = computed(
  () => props.hasSpecialSeed && specialCellId.value === null && !props.bloomShardClaimed,
)
const specialProgressLabel = computed(() => {
  if (props.bloomShardClaimed) return '花心碎片已收藏'
  if (specialCellId.value === null) return '拖到空地，或选中后点击空地'
  if (specialWaterings.value >= 3) return '樱花树正在盛开'
  return `神秘种子还需要 ${3 - specialWaterings.value} 次浇水`
})

function isFlowerStage(value: unknown): value is FlowerStage {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 4
}

function isFlowerKind(value: unknown): value is FlowerKind {
  return typeof value === 'string' && FLOWER_KINDS.includes(value as FlowerKind)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function restoreGarden() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || (parsed.version !== 1 && parsed.version !== 2)) return
    if (!Array.isArray(parsed.cells) || parsed.cells.length !== 16) return

    const restored = parsed.cells.map((cell, index): GardenCell | null => {
      if (
        !isRecord(cell) ||
        !isFlowerStage(cell.stage) ||
        !isFlowerKind(cell.kind)
      ) {
        return null
      }

      return {
        id: index,
        stage: cell.stage,
        kind: cell.kind,
        wateredAt: typeof cell.wateredAt === 'number' ? cell.wateredAt : null,
      }
    })

    if (restored.some((cell) => cell === null)) return
    cells.value = restored as GardenCell[]

    if (Array.isArray(parsed.unlocked)) {
      const validIds: GardenUnlockId[] = ['first-bloom', 'four-blooms', 'full-garden']
      unlocked.value = parsed.unlocked.filter((id): id is GardenUnlockId => validIds.includes(id))
    }

    // v1 存档没有神秘种子字段，保持原花圃不变即可。
    if (parsed.version === 2 && isRecord(parsed.special)) {
      const rawId = parsed.special.cellId
      const rawWaterings = parsed.special.waterings
      const validId =
        rawId === null || (Number.isInteger(rawId) && Number(rawId) >= 0 && Number(rawId) < 16)
      const validWaterings =
        Number.isInteger(rawWaterings) && Number(rawWaterings) >= 0 && Number(rawWaterings) <= 3

      if (validId && validWaterings) {
        specialCellId.value = rawId === null ? null : Number(rawId)
        specialWaterings.value = Number(rawWaterings)
        specialBloomEmitted.value = parsed.special.bloomEmitted === true

        if (specialCellId.value !== null) {
          const cell = cells.value[specialCellId.value]
          if (cell) {
            cells.value[specialCellId.value] = {
              ...cell,
              kind: 'cosmos',
              stage: Math.min(4, specialWaterings.value + 1) as FlowerStage,
            }
          }
        }
      }
    }

    announcement.value =
      specialCellId.value !== null
        ? `欢迎回来，神秘种子已经喝了 ${specialWaterings.value} 次水。`
        : `欢迎回来，你的花圃有 ${bloomCount.value} 朵花正在盛开。`
  } catch {
    announcement.value = '旧花圃没有成功读取，已经为你铺好一片新土地。'
  }
}

function saveGarden() {
  const payload: GardenSaveV2 = {
    version: 2,
    cells: cells.value,
    unlocked: unlocked.value,
    savedAt: Date.now(),
    special: {
      cellId: specialCellId.value,
      waterings: specialWaterings.value,
      bloomEmitted: specialBloomEmitted.value,
    },
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    announcement.value = `${announcement.value} 本次进度只能暂时保留。`
  }
}

function notifyUnlock(id: GardenUnlockId) {
  if (unlocked.value.includes(id)) return

  unlocked.value = [...unlocked.value, id]
  emit('unlock', {
    id,
    blooms: bloomCount.value,
    planted: plantedCount.value,
  })
}

function inspectUnlocks() {
  if (bloomCount.value >= 1) notifyUnlock('first-bloom')
  if (bloomCount.value >= 4) notifyUnlock('four-blooms')
  if (bloomCount.value === 16) notifyUnlock('full-garden')
}

function chooseTool(tool: GardenTool) {
  activeTool.value = tool
  announcement.value = tool === 'seed' ? '已拿起种子袋。' : '已拿起像素浇水壶。'
}

function chooseSpecialSeed() {
  if (!specialSeedAvailable.value) {
    announcement.value = specialCellId.value === null ? '樱花种子暂时还没有出现。' : specialProgressLabel.value
    return
  }

  activeTool.value = 'sakura'
  announcement.value = '已捧起会发光的樱花种子，为它选一块空地。'
}

function chooseKind(id: number): FlowerKind {
  return FLOWER_KINDS[(id + plantedCount.value + new Date().getDate()) % FLOWER_KINDS.length] ?? 'rose'
}

function plantSpecialSeed(index: number) {
  const current = cells.value[index]
  if (!current || !specialSeedAvailable.value) return false

  if (current.stage > 0) {
    announcement.value = '这块土地已有小住客，请给樱花种子换一个空位置。'
    return false
  }

  specialCellId.value = index
  specialWaterings.value = 0
  specialBloomEmitted.value = false
  cells.value[index] = {
    ...current,
    stage: 1,
    kind: 'cosmos',
  }
  activeTool.value = 'water'
  announcement.value = `樱花种子在第 ${index + 1} 块土地睡下了，再浇水 3 次。`
  saveGarden()
  return true
}

function celebrateSpecialBloom() {
  bloomCelebrating.value = true
  window.clearTimeout(bloomTimer)
  bloomTimer = window.setTimeout(() => {
    bloomCelebrating.value = false
  }, 2200)

  if (!specialBloomEmitted.value) {
    specialBloomEmitted.value = true
    emit('special-bloom')
  }
}

function waterSpecialCell(index: number) {
  const current = cells.value[index]
  if (!current || specialCellId.value !== index) return false

  if (specialWaterings.value >= 3) {
    announcement.value = '樱花树已经开成了一小片春天。'
    return false
  }

  specialWaterings.value += 1
  cells.value[index] = {
    ...current,
    stage: Math.min(4, specialWaterings.value + 1) as FlowerStage,
    wateredAt: Date.now(),
  }

  if (specialWaterings.value === 3) {
    announcement.value = '树冠点亮了！樱花的花心落下一枚发光碎片。'
    celebrateSpecialBloom()
  } else {
    announcement.value = `樱花苗喝下第 ${specialWaterings.value} 次水，树枝又长高了一格。`
  }

  inspectUnlocks()
  saveGarden()
  return true
}

function tendCell(index: number) {
  const current = cells.value[index]
  if (!current) return

  if (activeTool.value === 'sakura') {
    plantSpecialSeed(index)
    return
  }

  if (activeTool.value === 'seed') {
    if (current.stage > 0) {
      announcement.value = `第 ${index + 1} 块土地已经种下花了，换浇水壶试试。`
      return
    }

    cells.value[index] = {
      ...current,
      stage: 1,
      kind: chooseKind(index),
    }
    announcement.value = `第 ${index + 1} 块土地播种成功。`
  } else {
    if (specialCellId.value === index) {
      waterSpecialCell(index)
      return
    }

    if (current.stage === 0) {
      announcement.value = `第 ${index + 1} 块还是空地，请先播种。`
      return
    }
    if (current.stage === 4) {
      announcement.value = `第 ${index + 1} 块的花已经开得正好。`
      return
    }

    const nextStage = Math.min(4, current.stage + 1) as FlowerStage
    cells.value[index] = {
      ...current,
      stage: nextStage,
      wateredAt: Date.now(),
    }
    announcement.value =
      nextStage === 4
        ? `叮，第 ${index + 1} 块土地开花了。`
        : `第 ${index + 1} 块土地长成了${STAGE_NAMES[nextStage]}。`
  }

  inspectUnlocks()
  saveGarden()
}

function cellLabel(cell: GardenCell) {
  const action = activeTool.value === 'seed' ? '播种' : activeTool.value === 'sakura' ? '种下樱花种子' : '浇水'
  if (specialCellId.value === cell.id) {
    return `第 ${cell.id + 1} 块土地，樱花树已浇水 ${specialWaterings.value} 次，点击${action}`
  }
  return `第 ${cell.id + 1} 块土地，当前是${STAGE_NAMES[cell.stage]}，点击${action}`
}

function applyPaint(index: number) {
  if (paintedCells.has(index)) return
  paintedCells.add(index)
  tendCell(index)
}

function stopPainting(event?: PointerEvent) {
  if (event && paintingPointerId !== event.pointerId) return
  paintingPointerId = null
  paintedCells.clear()
  window.removeEventListener('pointermove', continuePainting)
  window.removeEventListener('pointerup', stopPainting)
  window.removeEventListener('pointercancel', stopPainting)
}

function continuePainting(event: PointerEvent) {
  if (paintingPointerId !== event.pointerId) return
  const target = document.elementFromPoint(event.clientX, event.clientY)
  const cell = target instanceof Element ? target.closest<HTMLElement>('[data-garden-cell]') : null
  const index = Number(cell?.dataset.gardenCell)
  if (Number.isInteger(index) && index >= 0 && index < cells.value.length) applyPaint(index)
}

function beginPainting(index: number, event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true })
  stopPainting()
  paintingPointerId = event.pointerId
  ignorePointerClickUntil = performance.now() + 650
  paintedCells.clear()
  applyPaint(index)
  window.addEventListener('pointermove', continuePainting, { passive: true })
  window.addEventListener('pointerup', stopPainting, { passive: true })
  window.addEventListener('pointercancel', stopPainting, { passive: true })
}

function activateCell(index: number, event: MouseEvent) {
  // 真实指针已在 pointerdown 处理；detail=0 的键盘/辅助技术点击仍可用。
  if (event.detail > 0 && performance.now() < ignorePointerClickUntil) return
  tendCell(index)
}

function acceptPixelDrop(dragId: string, dropZoneId: string) {
  const match = /^garden-cell-(\d+)$/.exec(dropZoneId)
  const index = match ? Number(match[1]) : -1
  if (!Number.isInteger(index) || index < 0 || index >= cells.value.length) return false

  if (dragId === 'garden-seed') {
    activeTool.value = 'seed'
    tendCell(index)
    return true
  }

  if (dragId === 'garden-water') {
    activeTool.value = 'water'
    tendCell(index)
    return true
  }

  if (dragId === 'sakura-seed') {
    activeTool.value = 'sakura'
    return plantSpecialSeed(index)
  }

  return false
}

function disarmReset() {
  resetArmed.value = false
  window.clearTimeout(resetTimer)
}

function resetGarden() {
  stopPainting()
  window.clearTimeout(bloomTimer)
  bloomCelebrating.value = false
  cells.value = createEmptyCells()
  unlocked.value = []
  activeTool.value = 'seed'
  specialCellId.value = null
  specialWaterings.value = 0
  specialBloomEmitted.value = false
  disarmReset()

  try {
    window.localStorage.removeItem(STORAGE_KEY)
    announcement.value = props.bloomShardClaimed
      ? '花圃已经重新翻土。收藏过的信号片仍然安全，随时可以从第一颗种子重新开始。'
      : '花圃已经重新翻土，16 块空地正等着新的种子。'
  } catch {
    announcement.value = '花圃已经暂时清空，但浏览器没有允许修改本地存档。'
  }
}

function requestGardenReset() {
  if (resetArmed.value) {
    resetGarden()
    return
  }

  resetArmed.value = true
  announcement.value = '再次点击“确认清空”，花圃才会重新翻土。信号片和彩蛋不会消失。'
  window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(disarmReset, 4200)
}

defineExpose({ acceptPixelDrop })

onMounted(restoreGarden)

onBeforeUnmount(() => {
  stopPainting()
  window.clearTimeout(bloomTimer)
  window.clearTimeout(resetTimer)
})
</script>

<template>
  <section
    class="garden"
    :class="{ 'is-celebrating': bloomCelebrating }"
    aria-labelledby="visitor-garden-title"
  >
    <header class="garden__header">
      <div>
        <p class="garden__eyebrow">花圃会记得你的照料</p>
        <h2 id="visitor-garden-title">给今天种一朵花</h2>
        <p class="garden__intro">点击照料一格，或按住指针滑过整片土地。</p>
      </div>
      <div class="garden__counter-stack">
        <div class="garden__counter" aria-label="花圃进度">
          <strong>{{ bloomCount.toString().padStart(2, '0') }}</strong>
          <span>/ 16 盛开</span>
        </div>
        <button
          type="button"
          class="garden-reset"
          :class="{ 'is-armed': resetArmed }"
          :aria-pressed="resetArmed"
          data-pixel-magnet="strong"
          @click="requestGardenReset"
        >
          <span class="garden-reset__icon" aria-hidden="true" />
          {{ resetArmed ? '确认清空' : '重新翻土' }}
        </button>
      </div>
    </header>

    <div class="garden__workbench">
      <div class="garden__tools" role="group" aria-label="选择园艺工具">
        <button
          type="button"
          class="tool-button"
          :class="{ 'is-active': activeTool === 'seed' }"
          :aria-pressed="activeTool === 'seed'"
          data-pixel-magnet="strong"
          data-pixel-drag="garden-seed"
          @click="chooseTool('seed')"
        >
          <span class="tool-button__icon tool-button__icon--seed" aria-hidden="true" />
          播种
        </button>
        <button
          type="button"
          class="tool-button"
          :class="{ 'is-active': activeTool === 'water' }"
          :aria-pressed="activeTool === 'water'"
          data-pixel-magnet="strong"
          data-pixel-drag="garden-water"
          @click="chooseTool('water')"
        >
          <span class="tool-button__icon tool-button__icon--water" aria-hidden="true" />
          浇水
        </button>
      </div>
      <p class="garden__hint">播种 1 次，浇水 3 次。工具也可以直接拖进土地。</p>
    </div>

    <div
      v-if="specialSeedAvailable || specialCellId !== null || bloomShardClaimed"
      class="sakura-seed-dock"
      :class="{ 'is-grown': specialWaterings >= 3 }"
    >
      <button
        v-if="specialSeedAvailable"
        type="button"
        class="sakura-seed-button"
        :class="{ 'is-active': activeTool === 'sakura' }"
        :aria-pressed="activeTool === 'sakura'"
        data-pixel-magnet="strong"
        data-pixel-drag="sakura-seed"
        @click="chooseSpecialSeed"
      >
        <span class="sakura-seed-button__seed" aria-hidden="true" />
        发光樱花种子
      </button>
      <span v-else class="sakura-seed-dock__tree" aria-hidden="true" />
      <p>
        <strong>{{ bloomShardClaimed ? '花心碎片已点亮' : '一枚不同寻常的种子' }}</strong>
        <span>{{ specialProgressLabel }}</span>
      </p>
      <span v-if="bloomShardClaimed" class="sakura-seed-dock__shard" aria-label="已获得花心碎片">◆</span>
    </div>

    <div class="plot-shell">
      <div class="plot-grid" aria-label="4 乘 4 像素花圃">
        <button
          v-for="cell in cells"
          :key="cell.id"
          type="button"
          class="soil-cell"
          :class="[
            `soil-cell--stage-${cell.stage}`,
            `soil-cell--${cell.kind}`,
            {
              'soil-cell--special': specialCellId === cell.id,
              'is-special-bloom': specialCellId === cell.id && specialWaterings >= 3,
            },
          ]"
          :aria-label="cellLabel(cell)"
          :data-garden-cell="cell.id"
          :data-pixel-drop="`garden-cell-${cell.id}`"
          data-pixel-accept="garden-seed,garden-water,sakura-seed"
          data-pixel-magnet="soft"
          @pointerdown="beginPainting(cell.id, $event)"
          @click="activateCell(cell.id, $event)"
        >
          <span class="soil-cell__furrow" aria-hidden="true" />
          <span
            v-if="cell.stage > 0 && specialCellId !== cell.id"
            class="plant"
            :class="`plant--stage-${cell.stage}`"
            aria-hidden="true"
          >
            <i class="plant__stem" />
            <i class="plant__leaf plant__leaf--left" />
            <i class="plant__leaf plant__leaf--right" />
            <i class="plant__bud" />
            <i class="plant__petal plant__petal--top" />
            <i class="plant__petal plant__petal--right" />
            <i class="plant__petal plant__petal--bottom" />
            <i class="plant__petal plant__petal--left" />
            <i class="plant__heart" />
          </span>
          <span
            v-if="specialCellId === cell.id"
            class="sakura-tree"
            :class="[`sakura-tree--${specialWaterings}`, { 'is-bursting': bloomCelebrating }]"
            aria-hidden="true"
          >
            <i class="sakura-tree__root" />
            <i class="sakura-tree__trunk" />
            <i class="sakura-tree__branch sakura-tree__branch--left" />
            <i class="sakura-tree__branch sakura-tree__branch--right" />
            <i class="sakura-tree__crown sakura-tree__crown--one" />
            <i class="sakura-tree__crown sakura-tree__crown--two" />
            <i class="sakura-tree__crown sakura-tree__crown--three" />
            <i class="sakura-tree__heart" />
            <i class="sakura-tree__petal sakura-tree__petal--one" />
            <i class="sakura-tree__petal sakura-tree__petal--two" />
            <i class="sakura-tree__petal sakura-tree__petal--three" />
            <i class="sakura-tree__petal sakura-tree__petal--four" />
          </span>
          <span v-if="specialCellId === cell.id" class="soil-cell__special-progress" aria-hidden="true">
            {{ specialWaterings }}/3
          </span>
        </button>
      </div>
      <div v-if="bloomCelebrating" class="bloom-flash" aria-hidden="true">
        <i v-for="index in 12" :key="index" :style="{ '--petal-index': index }" />
      </div>
      <span class="plot-shell__corner plot-shell__corner--one" aria-hidden="true" />
      <span class="plot-shell__corner plot-shell__corner--two" aria-hidden="true" />
      <span class="plot-shell__corner plot-shell__corner--three" aria-hidden="true" />
    </div>

    <p class="garden__status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </section>
</template>

<style scoped>
.garden {
  --ink: #522943;
  --pink: #f568a5;
  --pink-light: #ffd3e5;
  --cream: #fff8ea;
  --soil: #96566f;
  --soil-dark: #6f3c57;
  position: relative;
  width: min(100%, 850px);
  margin-inline: auto;
  padding: clamp(24px, 5vw, 52px);
  color: var(--ink);
  border: 4px solid var(--ink);
  background:
    linear-gradient(90deg, rgba(245, 104, 165, 0.08) 1px, transparent 1px) 0 0 / 16px 16px,
    var(--cream);
  box-shadow: 8px 8px 0 #e8a4c0;
  box-sizing: border-box;
}

.garden::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 28px;
  width: 88px;
  height: 8px;
  background: var(--pink);
  box-shadow: 220px 0 0 #ffc5dd, 530px 0 0 #ffdc89;
}

.garden__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
  text-align: left;
}

.garden__eyebrow {
  margin: 0 0 9px;
  color: #aa4d79;
  font: 700 12px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: 0.14em;
}

.garden h2 {
  margin: 0;
  color: var(--ink);
  font-size: clamp(26px, 5vw, 44px);
  line-height: 1.05;
  letter-spacing: 0.02em;
}

.garden__intro {
  max-width: 34rem;
  margin: 12px 0 0;
  color: #865f72;
  font-size: 14px;
}

.garden__counter-stack {
  display: grid;
  flex: 0 0 auto;
  gap: 9px;
  min-width: 118px;
}

.garden__counter {
  flex: 0 0 auto;
  padding: 10px 12px;
  border: 3px solid var(--ink);
  background: #fff;
  box-shadow: 4px 4px 0 var(--pink-light);
  text-align: center;
}

.garden__counter strong {
  color: var(--pink);
  font: 800 28px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.garden__counter span {
  display: block;
  margin-top: 4px;
  font: 700 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: 0.06em;
}

.garden-reset {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 7px 9px;
  border: 3px solid var(--ink);
  color: var(--ink);
  background: #ffe8a9;
  box-shadow: 3px 3px 0 var(--pink-light);
  font: 800 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  cursor: pointer;
  transition: transform 100ms steps(2, end), box-shadow 100ms steps(2, end), background 100ms steps(2, end);
}

.garden-reset:is(:hover, :focus-visible) {
  background: #ffd37f;
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 var(--pink-light);
}

.garden-reset.is-armed {
  color: var(--cream);
  background: var(--ink);
  box-shadow: 3px 3px 0 var(--pink);
}

.garden-reset__icon {
  position: relative;
  width: 12px;
  height: 12px;
  border: 3px solid currentColor;
  border-left-color: transparent;
  box-sizing: border-box;
}

.garden-reset__icon::after {
  position: absolute;
  top: -5px;
  left: -4px;
  width: 5px;
  height: 5px;
  content: '';
  background: currentColor;
}

.garden__workbench {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.garden__tools {
  display: flex;
  gap: 8px;
}

.tool-button {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  padding: 8px 14px;
  color: var(--ink);
  border: 3px solid var(--ink);
  border-radius: 0;
  background: #fff;
  box-shadow: 3px 3px 0 #d9a6ba;
  font: 800 13px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  cursor: pointer;
  transition: transform 100ms steps(2, end), background-color 100ms steps(2, end), box-shadow 100ms steps(2, end);
}

.tool-button:hover,
.tool-button.is-active {
  background: var(--pink-light);
  box-shadow: 3px 3px 0 var(--pink);
  transform: translate(-1px, -1px);
}

.tool-button:active {
  box-shadow: 1px 1px 0 var(--ink);
  transform: translate(2px, 2px);
}

.tool-button:focus-visible,
.sakura-seed-button:focus-visible,
.soil-cell:focus-visible {
  outline: 4px solid #fff;
  outline-offset: 2px;
  box-shadow: 0 0 0 7px #9c3c72;
}

.tool-button__icon {
  position: relative;
  display: inline-block;
  width: 17px;
  height: 17px;
  image-rendering: pixelated;
}

.tool-button__icon--seed {
  width: 12px;
  height: 12px;
  margin-inline: 2px 3px;
  background: #7b3d54;
  box-shadow: 3px -3px 0 #a66276, -3px 3px 0 #522943;
  transform: rotate(45deg);
}

.tool-button__icon--water::before {
  content: '';
  position: absolute;
  left: 1px;
  bottom: 1px;
  width: 12px;
  height: 10px;
  background: #6fc9d2;
  box-shadow: 3px -3px 0 #3e7f96;
}

.tool-button__icon--water::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 4px;
  width: 7px;
  height: 7px;
  border: 3px solid #3e7f96;
}

.garden__hint {
  margin: 0;
  color: #9c657e;
  font: 700 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
  text-align: right;
}

.sakura-seed-dock {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 58px;
  margin: -2px 0 18px;
  padding: 10px 12px;
  overflow: hidden;
  border: 3px solid var(--ink);
  background: #fff0f7;
  box-shadow: 4px 4px 0 #ffabc9;
}

.sakura-seed-dock::after {
  content: '';
  position: absolute;
  inset: 6px 6px auto auto;
  width: 5px;
  height: 5px;
  background: #f568a5;
  box-shadow: -9px 7px 0 #ffd0e1, -18px 0 0 #ff8eb7;
}

.sakura-seed-dock.is-grown {
  background: #ffe3ef;
  box-shadow: 4px 4px 0 #f568a5;
}

.sakura-seed-dock p {
  display: grid;
  gap: 4px;
  min-width: 0;
  margin: 0;
  text-align: left;
}

.sakura-seed-dock p strong {
  color: #70324f;
  font-size: 13px;
}

.sakura-seed-dock p span {
  color: #9b5a77;
  font: 700 11px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.sakura-seed-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 7px 10px;
  color: var(--ink);
  border: 3px solid var(--ink);
  background: #fff;
  box-shadow: 3px 3px 0 #f568a5;
  font: 800 11px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
  cursor: grab;
}

.sakura-seed-button:hover,
.sakura-seed-button.is-active {
  background: #ffd4e6;
  transform: translate(-1px, -1px);
}

.sakura-seed-button:active {
  cursor: grabbing;
  transform: translate(2px, 2px);
}

.sakura-seed-button__seed {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  background: #ff76aa;
  box-shadow:
    4px -4px 0 #ffd4e6,
    -4px 4px 0 #9f426e,
    7px 3px 0 #fff1a8;
  transform: rotate(45deg);
  animation: special-seed-glow 1.4s steps(3, end) infinite;
}

.sakura-seed-dock__tree {
  position: relative;
  width: 32px;
  height: 34px;
  border-bottom: 8px solid #8a5164;
}

.sakura-seed-dock__tree::before {
  content: '';
  position: absolute;
  left: 13px;
  bottom: 4px;
  width: 6px;
  height: 20px;
  background: #8a5164;
  box-shadow: -10px -8px 0 5px #ff9fc2, 10px -12px 0 7px #ffc3d9, 0 -18px 0 8px #f568a5;
}

.sakura-seed-dock__shard {
  position: relative;
  z-index: 1;
  color: #fff5a8;
  font-size: 28px;
  line-height: 1;
  text-shadow: 3px 0 #f568a5, -3px 0 #f568a5, 0 3px #f568a5, 0 -3px #f568a5;
  animation: shard-hover 900ms steps(3, end) infinite alternate;
}

.plot-shell {
  position: relative;
  padding: clamp(12px, 3vw, 22px);
  border: 4px solid var(--ink);
  background: #d9a070;
  box-shadow: inset 0 0 0 5px #f0c892, 6px 6px 0 #e8a4c0;
}

.plot-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: clamp(5px, 1.4vw, 11px);
  padding: clamp(5px, 1.5vw, 10px);
  background: var(--soil-dark);
  touch-action: none;
  user-select: none;
}

.soil-cell {
  position: relative;
  aspect-ratio: 1;
  min-width: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: var(--soil);
  box-shadow:
    inset 0 -6px 0 #7b455e,
    inset 6px 0 0 #ab6b7e,
    0 0 0 2px #5f354d;
  cursor: pointer;
  image-rendering: pixelated;
}

.soil-cell:hover {
  background: #a9637a;
}

.soil-cell--special {
  z-index: 4;
  background: #b96987;
  box-shadow:
    inset 0 -6px 0 #7b455e,
    inset 6px 0 0 #d17b9a,
    0 0 0 3px #ffd0e1,
    0 0 0 6px #773e59;
}

.soil-cell--special::after {
  content: '';
  position: absolute;
  inset: 6px;
  border: 2px dashed rgba(255, 220, 235, 0.75);
  pointer-events: none;
}

.soil-cell--special.is-special-bloom {
  background: #c57894;
  box-shadow:
    inset 0 -6px 0 #874661,
    inset 6px 0 0 #e294ae,
    0 0 0 3px #fff1a8,
    0 0 0 7px #f568a5,
    0 0 0 11px rgba(255, 212, 230, 0.68);
}

.soil-cell__special-progress {
  position: absolute;
  right: 5px;
  bottom: 5px;
  z-index: 9;
  padding: 3px 4px 2px;
  color: #fff;
  background: #6f3c57;
  font: 800 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  box-shadow: 2px 2px 0 #f568a5;
  pointer-events: none;
}

.sakura-tree,
.sakura-tree i {
  position: absolute;
  display: block;
  pointer-events: none;
}

.sakura-tree {
  left: 50%;
  bottom: 20%;
  z-index: 8;
  width: 0;
  height: 0;
  filter: drop-shadow(4px 5px 0 rgba(77, 37, 55, 0.28));
  transform-origin: bottom center;
  animation: tree-grow 440ms steps(5, end) both;
}

.sakura-tree__root {
  left: -13px;
  bottom: -2px;
  width: 26px;
  height: 6px;
  background: #61384d;
  box-shadow: -7px 3px 0 #61384d, 7px 3px 0 #61384d;
}

.sakura-tree__trunk {
  left: -4px;
  bottom: 1px;
  width: 9px;
  height: 12px;
  background: #875164;
  box-shadow: inset -3px 0 #60384b;
  transform-origin: bottom;
  transition: height 380ms steps(4, end);
}

.sakura-tree--1 .sakura-tree__trunk {
  height: clamp(24px, 4.4vw, 38px);
}

.sakura-tree--2 .sakura-tree__trunk,
.sakura-tree--3 .sakura-tree__trunk {
  height: clamp(37px, 6.5vw, 58px);
}

.sakura-tree__branch {
  bottom: clamp(24px, 4.4vw, 40px);
  width: 30px;
  height: 6px;
  opacity: 0;
  background: #875164;
  transition: opacity 180ms steps(2, end), transform 360ms steps(4, end);
}

.sakura-tree__branch--left {
  right: -1px;
  transform: rotate(-36deg) scaleX(0);
  transform-origin: right;
}

.sakura-tree__branch--right {
  left: -1px;
  transform: rotate(36deg) scaleX(0);
  transform-origin: left;
}

.sakura-tree--2 .sakura-tree__branch,
.sakura-tree--3 .sakura-tree__branch {
  opacity: 1;
}

.sakura-tree--2 .sakura-tree__branch--left,
.sakura-tree--3 .sakura-tree__branch--left {
  transform: rotate(-36deg) scaleX(1);
}

.sakura-tree--2 .sakura-tree__branch--right,
.sakura-tree--3 .sakura-tree__branch--right {
  transform: rotate(36deg) scaleX(1);
}

.sakura-tree__crown {
  bottom: clamp(34px, 6.3vw, 57px);
  width: clamp(32px, 6vw, 56px);
  height: clamp(23px, 4.2vw, 38px);
  opacity: 0;
  background: #ff9fc2;
  box-shadow:
    inset -7px -6px 0 #e85f94,
    7px -8px 0 #ffc5da,
    -7px -6px 0 #f568a5;
  transform: scale(0.2);
  transition: opacity 170ms steps(2, end), transform 440ms steps(5, end);
}

.sakura-tree__crown--one {
  left: -28px;
  z-index: 2;
}

.sakura-tree__crown--two {
  left: -58px;
  bottom: clamp(28px, 5.2vw, 48px);
}

.sakura-tree__crown--three {
  left: 4px;
  bottom: clamp(28px, 5.2vw, 48px);
}

.sakura-tree--1 .sakura-tree__crown--one {
  opacity: 0.45;
  transform: scale(0.45);
}

.sakura-tree--2 .sakura-tree__crown {
  opacity: 0.72;
  transform: scale(0.72);
}

.sakura-tree--3 .sakura-tree__crown {
  opacity: 1;
  transform: scale(1);
  animation: crown-breathe 1.2s steps(3, end) infinite alternate;
}

.sakura-tree__heart {
  left: -7px;
  bottom: clamp(42px, 7.6vw, 70px);
  z-index: 4;
  width: 14px;
  height: 14px;
  opacity: 0;
  background: #fff1a8;
  box-shadow: 4px 0 #ffe16f, 0 4px #ffe16f;
  transform: rotate(45deg) scale(0);
}

.sakura-tree--3 .sakura-tree__heart {
  opacity: 1;
  transform: rotate(45deg) scale(1);
  animation: heart-glint 720ms steps(3, end) infinite alternate;
}

.sakura-tree__petal {
  z-index: 5;
  width: 7px;
  height: 5px;
  opacity: 0;
  background: #ffe1ed;
}

.sakura-tree--3 .sakura-tree__petal {
  opacity: 1;
  animation: tree-petal 1.8s steps(6, end) infinite;
}

.sakura-tree__petal--one {
  left: -48px;
  bottom: 58px;
}

.sakura-tree__petal--two {
  left: 39px;
  bottom: 48px;
  animation-delay: -480ms !important;
}

.sakura-tree__petal--three {
  left: -25px;
  bottom: 83px;
  animation-delay: -820ms !important;
}

.sakura-tree__petal--four {
  left: 21px;
  bottom: 78px;
  animation-delay: -1.2s !important;
}

.bloom-flash {
  position: absolute;
  inset: 4px;
  z-index: 12;
  overflow: hidden;
  border: 5px solid #fff1a8;
  box-shadow: inset 0 0 0 8px rgba(245, 104, 165, 0.58);
  pointer-events: none;
  animation: bloom-frame 2.2s steps(8, end) both;
}

.bloom-flash i {
  position: absolute;
  top: -14px;
  width: 10px;
  height: 7px;
  background: #ffc4da;
  box-shadow: 4px 4px 0 #f568a5;
  animation: garden-petal-rain 1.6s steps(9, end) both;
  animation-delay: calc(var(--petal-index) * 55ms);
}

.bloom-flash i:nth-child(4n + 1) { left: 9%; }
.bloom-flash i:nth-child(4n + 2) { left: 34%; }
.bloom-flash i:nth-child(4n + 3) { left: 63%; }
.bloom-flash i:nth-child(4n) { left: 88%; }
.bloom-flash i:nth-child(n + 5):nth-child(-n + 8) { margin-left: 11%; }
.bloom-flash i:nth-child(n + 9) { margin-left: -7%; }

.soil-cell__furrow,
.soil-cell__furrow::before,
.soil-cell__furrow::after {
  position: absolute;
  left: 18%;
  bottom: 20%;
  width: 16%;
  height: 4px;
  background: #63394f;
  content: '';
}

.soil-cell__furrow::before {
  left: 190%;
  bottom: 160%;
  width: 180%;
}

.soil-cell__furrow::after {
  left: 350%;
  bottom: -80%;
  width: 100%;
}

.plant,
.plant i {
  position: absolute;
  display: block;
}

.plant {
  left: 50%;
  bottom: 20%;
  width: 0;
  height: 0;
  filter: drop-shadow(3px 3px 0 rgba(70, 35, 51, 0.25));
  transform-origin: bottom center;
  animation: plant-arrive 380ms steps(4, end) both;
}

.plant__stem {
  bottom: 0;
  left: -3px;
  width: 6px;
  height: clamp(18px, 4.2vw, 34px);
  background: #4f8a57;
}

.plant__leaf {
  width: 11px;
  height: 7px;
  background: #73b566;
}

.plant__leaf--left {
  right: 1px;
  bottom: 10px;
  box-shadow: -4px -3px 0 #73b566;
}

.plant__leaf--right {
  left: 1px;
  bottom: 18px;
  box-shadow: 4px -3px 0 #73b566;
}

.plant__bud,
.plant__petal,
.plant__heart {
  opacity: 0;
}

.plant__bud {
  bottom: clamp(16px, 4vw, 32px);
  left: -7px;
  width: 14px;
  height: 12px;
  background: #f568a5;
  box-shadow: inset -4px -3px 0 #bf477b;
}

.plant__petal {
  bottom: clamp(22px, 4.7vw, 38px);
  left: -7px;
  width: 14px;
  height: 14px;
  background: #ff91bd;
}

.plant__petal--top {
  transform: translateY(-10px);
}

.plant__petal--right {
  transform: translateX(10px);
}

.plant__petal--bottom {
  transform: translateY(10px);
}

.plant__petal--left {
  transform: translateX(-10px);
}

.plant__heart {
  bottom: clamp(25px, 5vw, 41px);
  left: -5px;
  width: 10px;
  height: 10px;
  background: #ffe27d;
}

.plant--stage-1 .plant__stem,
.plant--stage-1 .plant__leaf {
  display: none;
}

.plant--stage-1::after {
  content: '';
  position: absolute;
  left: -6px;
  bottom: 0;
  width: 12px;
  height: 8px;
  background: #5a354c;
  box-shadow: 3px -3px 0 #7c4b5d;
  transform: rotate(45deg);
}

.plant--stage-2 {
  transform: scale(0.7);
}

.plant--stage-2 .plant__leaf--right {
  display: none;
}

.plant--stage-3 .plant__bud,
.plant--stage-4 .plant__petal,
.plant--stage-4 .plant__heart {
  opacity: 1;
}

.soil-cell--tulip .plant__petal {
  background: #ff6c94;
}

.soil-cell--cosmos .plant__petal {
  background: #ffd4e6;
}

.soil-cell--star .plant__petal {
  background: #ffca72;
}

.soil-cell--stage-4 .plant {
  animation: bloom-pop 520ms steps(5, end) both;
}

.plot-shell__corner {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #fff1a8;
  box-shadow: 8px 0 0 #fff1a8, 0 8px 0 #fff1a8;
}

.plot-shell__corner--one {
  top: 8px;
  left: 8px;
}

.plot-shell__corner--two {
  top: 10px;
  right: 16px;
  transform: rotate(90deg);
}

.plot-shell__corner--three {
  right: 16px;
  bottom: 16px;
  transform: rotate(180deg);
}

.garden__status {
  min-height: 1.4em;
  margin: 20px 0 0;
  color: #80536c;
  font: 700 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
  text-align: left;
}

.garden.is-celebrating {
  animation: garden-celebration 2.2s steps(8, end) both;
}

@keyframes plant-arrive {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.7);
  }
}

@keyframes bloom-pop {
  0% {
    transform: scale(0.75);
  }
  70% {
    transform: scale(1.12);
  }
}

@keyframes special-seed-glow {
  50% {
    box-shadow:
      4px -4px 0 #fff1a8,
      -4px 4px 0 #9f426e,
      9px 4px 0 #fff;
  }
}

@keyframes shard-hover {
  to {
    transform: translateY(-5px) rotate(8deg);
  }
}

@keyframes tree-grow {
  from {
    opacity: 0.4;
    transform: translateY(9px) scaleY(0.35);
  }
}

@keyframes crown-breathe {
  to {
    filter: brightness(1.13);
    transform: translateY(-3px) scale(1.03);
  }
}

@keyframes heart-glint {
  to {
    filter: brightness(1.25);
    transform: rotate(45deg) scale(1.22);
  }
}

@keyframes tree-petal {
  0% {
    transform: translate(0, 0) rotate(0);
  }
  100% {
    opacity: 0;
    transform: translate(18px, 48px) rotate(180deg);
  }
}

@keyframes bloom-frame {
  0%, 100% {
    opacity: 0;
  }
  12%, 76% {
    opacity: 1;
  }
}

@keyframes garden-petal-rain {
  0% {
    opacity: 0;
    transform: translateY(0) rotate(0);
  }
  15% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(54px, 430px) rotate(270deg);
  }
}

@keyframes garden-celebration {
  18% {
    box-shadow: 12px 12px 0 #f568a5;
    transform: translate(-2px, -2px);
  }
  38% {
    box-shadow: 5px 5px 0 #fff1a8;
    transform: translate(2px, 1px);
  }
  64% {
    box-shadow: 10px 10px 0 #ff9fc2;
    transform: translate(-1px, 0);
  }
}

@media (max-width: 600px) {
  .garden {
    padding: 24px 16px 28px;
    border-width: 3px;
    box-shadow: 5px 5px 0 #e8a4c0;
  }

  .garden__header {
    align-items: flex-start;
  }

  .garden__counter-stack {
    min-width: 78px;
  }

  .garden__counter strong {
    font-size: 22px;
  }

  .garden-reset {
    padding-inline: 6px;
    font-size: 9px;
  }

  .garden__workbench {
    align-items: flex-start;
    flex-direction: column;
  }

  .garden__tools {
    width: 100%;
  }

  .tool-button {
    flex: 1;
    justify-content: center;
  }

  .garden__hint {
    text-align: left;
  }

  .sakura-seed-dock {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
  }

  .sakura-seed-button {
    grid-column: 1 / -1;
    justify-content: center;
  }

  .sakura-seed-dock__tree {
    margin-left: 5px;
  }

  .plot-shell {
    padding: 12px;
  }

  .plant__leaf {
    width: 8px;
  }

  .plant__petal {
    width: 10px;
    height: 10px;
    left: -5px;
  }

  .plant__petal--top {
    transform: translateY(-7px);
  }

  .plant__petal--right {
    transform: translateX(7px);
  }

  .plant__petal--bottom {
    transform: translateY(7px);
  }

  .plant__petal--left {
    transform: translateX(-7px);
  }

  .sakura-tree__crown--one {
    left: -20px;
  }

  .sakura-tree__crown--two {
    left: -39px;
  }

  .sakura-tree__crown--three {
    left: 2px;
  }

  .sakura-tree__petal--one {
    left: -34px;
  }

  .sakura-tree__petal--two {
    left: 27px;
  }

  .sakura-tree__petal--three {
    left: -19px;
  }

  .sakura-tree__petal--four {
    left: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-button,
  .garden-reset,
  .sakura-seed-button,
  .sakura-seed-button__seed,
  .sakura-seed-dock__shard,
  .sakura-tree,
  .sakura-tree i,
  .bloom-flash,
  .bloom-flash i,
  .garden.is-celebrating,
  .plant,
  .soil-cell--stage-4 .plant {
    transition: none;
    animation: none;
  }
}
</style>
