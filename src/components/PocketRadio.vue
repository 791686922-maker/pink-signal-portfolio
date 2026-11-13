<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import { useFarmWorld } from '../composables/useFarmWorld'
import type { WorldInventoryItem, WorldShardId } from '../types/world'

const {
  state,
  shardCount,
  endingReady,
  hasAnyDiscovery,
  setSoundEnabled,
} = useFarmWorld()

const isOpen = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

const shardLabels: Record<WorldShardId, string> = {
  bloom: '花瓣信号片',
  broadcast: '广播信号片',
  ember: '余烬信号片',
}

const itemLabels: Record<WorldInventoryItem, string> = {
  'sakura-seed': '樱花信号种',
  'copper-key': '溪流铜钥匙',
  'old-battery': '旧温室电池',
}

const shardIds: WorldShardId[] = ['bloom', 'broadcast', 'ember']

const inventoryEntries = computed(() => {
  const counts = new Map<WorldInventoryItem, number>()
  for (const item of state.inventory) counts.set(item, (counts.get(item) ?? 0) + 1)
  return Array.from(counts, ([id, count]) => ({ id, count, label: itemLabels[id] }))
})

const contextClue = computed(() => {
  if (state.endingSeen) return '零点广播已经记住你。明天回来，天空也许会改变。'
  if (endingReady.value) return '三段信号已经齐全。天黑以后，去湖边看看月亮。'

  if (!state.shards.bloom) {
    if (state.caughtPetals < 6) {
      const remaining = 6 - state.caughtPetals
      return `樱花雨里，尾线可以接住花瓣。还差 ${remaining} 片。`
    }
    if (state.inventory.includes('sakura-seed')) {
      return '樱花信号种不喜欢口袋。把它带到读者花圃。'
    }
    return '一朵特别的花已经盛开。听一听它留下的信号。'
  }

  if (!state.shards.broadcast) {
    if (state.towerBands.length < 3) {
      return `信号小径还缺 ${3 - state.towerBands.length} 个频段。读完文章再看塔顶。`
    }
    return '三个频段已经重合。阁楼终端在等一句最经典的问候。'
  }

  if (!state.shards.ember) {
    if (state.inventory.includes('old-battery')) {
      return '旧电池不属于工具房。温室里还有一项实验在等它。'
    }
    if (state.catTrust < 3) {
      return '动作慢一点。桥边的猫不喜欢突然靠近。'
    }
    if (!state.inventory.includes('copper-key')) {
      return '溪流听得懂三拍信号：短、短、长。'
    }
    return '铜钥匙能打开的不是大门。注意工具房里颜色最暗的格子。'
  }

  return '信号暂时安静了。继续往夜色最深的地方走。'
})

async function togglePanel() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    closeButton.value?.focus()
  }
}

async function closePanel() {
  isOpen.value = false
  await nextTick()
  trigger.value?.focus()
}
</script>

<template>
  <Transition name="radio-arrive">
    <aside v-if="hasAnyDiscovery" class="pocket-radio" aria-label="口袋电台">
      <button
        ref="trigger"
        type="button"
        class="radio-trigger"
        :aria-expanded="isOpen"
        aria-controls="pocket-radio-panel"
        @click="togglePanel"
      >
        <span class="radio-trigger__icon" aria-hidden="true">
          <i v-for="id in shardIds" :key="id" :class="{ 'is-on': state.shards[id] }" />
        </span>
        <span>口袋电台</span>
        <small>{{ shardCount }} / 3</small>
      </button>

      <Transition name="radio-panel">
        <section
          v-if="isOpen"
          id="pocket-radio-panel"
          class="radio-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="pocket-radio-title"
          @keydown.esc="closePanel"
        >
          <header class="radio-panel__header">
            <div>
              <p>FIELD FREQUENCY 96.7</p>
              <h2 id="pocket-radio-title">农场口袋电台</h2>
            </div>
            <button ref="closeButton" type="button" class="radio-close" @click="closePanel">
              关闭
            </button>
          </header>

          <div class="radio-screen" aria-live="polite">
            <span class="radio-screen__scan" aria-hidden="true" />
            <p>{{ contextClue }}</p>
          </div>

          <div class="shard-list" aria-label="信号片收集进度">
            <div
              v-for="id in shardIds"
              :key="id"
              class="shard"
              :class="{ 'is-found': state.shards[id] }"
            >
              <span aria-hidden="true"><i /><i /><i /></span>
              <p>{{ shardLabels[id] }}</p>
              <small>{{ state.shards[id] ? '已接收' : '无信号' }}</small>
            </div>
          </div>

          <div class="radio-inventory">
            <div class="radio-inventory__heading">
              <h3>口袋</h3>
              <p>已接住花瓣 {{ state.caughtPetals }} 片</p>
            </div>
            <ul v-if="inventoryEntries.length">
              <li v-for="item in inventoryEntries" :key="item.id">
                <span aria-hidden="true" />
                {{ item.label }}
                <small v-if="item.count > 1">× {{ item.count }}</small>
              </li>
            </ul>
            <p v-else class="inventory-empty">现在还是空的。农场会把重要的东西交给你。</p>
          </div>

          <button
            type="button"
            class="sound-toggle"
            :aria-pressed="state.soundEnabled"
            @click="setSoundEnabled(!state.soundEnabled)"
          >
            <span aria-hidden="true" :class="{ 'is-on': state.soundEnabled }" />
            像素音效 {{ state.soundEnabled ? '开启' : '关闭' }}
          </button>
        </section>
      </Transition>
    </aside>
  </Transition>
</template>

<style scoped>
.pocket-radio {
  position: fixed;
  z-index: 94;
  left: 20px;
  bottom: 20px;
  color: #422238;
  font-family: var(--font-pixel, ui-monospace, monospace);
}

.radio-trigger {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding: 7px 11px;
  border: 3px solid #422238;
  color: #422238;
  background: #fff2d9;
  box-shadow: 4px 4px 0 #422238;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.radio-trigger:hover,
.radio-trigger:focus-visible {
  background: #ffd3e3;
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #422238;
}

.radio-trigger:focus-visible,
.radio-close:focus-visible,
.sound-toggle:focus-visible {
  outline: 4px solid #fff;
  outline-offset: 3px;
  box-shadow: 0 0 0 7px #9e3f70;
}

.radio-trigger small {
  padding: 4px 5px;
  color: #fff7ef;
  background: #6a3a58;
  font: inherit;
  font-size: 10px;
}

.radio-trigger__icon {
  display: flex;
  width: 28px;
  height: 24px;
  align-items: end;
  gap: 3px;
  padding: 3px;
  background: #4b2940;
  box-sizing: border-box;
}

.radio-trigger__icon i {
  width: 5px;
  height: 5px;
  background: #806377;
}

.radio-trigger__icon i:nth-child(2) {
  height: 10px;
}

.radio-trigger__icon i:nth-child(3) {
  height: 15px;
}

.radio-trigger__icon i.is-on {
  background: #ffd36e;
  box-shadow: 0 0 7px #ffd36e;
}

.radio-panel {
  position: absolute;
  left: 0;
  bottom: calc(100% + 14px);
  width: min(420px, calc(100vw - 40px));
  max-height: min(690px, calc(100dvh - 100px));
  padding: 18px;
  overflow: auto;
  border: 4px solid #422238;
  color: #422238;
  background: #f6b5cc;
  box-shadow: 8px 8px 0 rgb(45 23 37 / 38%);
  box-sizing: border-box;
}

.radio-panel::before {
  position: absolute;
  top: 8px;
  right: 8px;
  bottom: 8px;
  left: 8px;
  border: 2px solid rgb(66 34 56 / 18%);
  content: '';
  pointer-events: none;
}

.radio-panel__header,
.radio-screen,
.shard-list,
.radio-inventory,
.sound-toggle {
  position: relative;
  z-index: 1;
}

.radio-panel__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}

.radio-panel__header p,
.radio-panel__header h2,
.radio-inventory h3,
.radio-inventory p,
.shard p,
.shard small {
  margin: 0;
}

.radio-panel__header p {
  margin-bottom: 6px;
  color: #9a416d;
  font-size: 9px;
  letter-spacing: 0.08em;
}

.radio-panel__header h2 {
  font-size: 19px;
  line-height: 1.25;
}

.radio-close {
  min-height: 36px;
  padding: 6px 8px;
  border: 3px solid #422238;
  color: #422238;
  background: #fff2d9;
  box-shadow: 3px 3px 0 #422238;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.radio-screen {
  min-height: 84px;
  display: grid;
  place-items: center start;
  padding: 15px;
  overflow: hidden;
  border: 4px solid #422238;
  color: #f9ffcf;
  background: #304737;
  box-shadow: inset 0 0 0 4px #79916d;
}

.radio-screen p {
  position: relative;
  z-index: 2;
  max-width: 34ch;
  margin: 0;
  font-size: 11px;
  line-height: 1.75;
}

.radio-screen__scan {
  position: absolute;
  inset: 0;
  opacity: 0.2;
  background: repeating-linear-gradient(0deg, transparent 0 5px, #e8ffc0 5px 7px);
  animation: radio-scan 2.6s steps(8, end) infinite;
}

.shard-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.shard {
  min-width: 0;
  padding: 10px 7px;
  border: 3px solid #63354f;
  background: #e99ab9;
  text-align: center;
  opacity: 0.68;
}

.shard.is-found {
  background: #fff0b7;
  opacity: 1;
}

.shard > span {
  position: relative;
  display: block;
  width: 28px;
  height: 27px;
  margin: 0 auto 8px;
}

.shard > span i {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #775367;
  transform: rotate(45deg);
}

.shard > span i:nth-child(1) {
  top: 0;
  left: 9px;
}

.shard > span i:nth-child(2) {
  top: 9px;
  left: 0;
}

.shard > span i:nth-child(3) {
  top: 9px;
  right: 0;
}

.shard.is-found > span i {
  background: #e75e97;
  box-shadow: 0 0 5px #f074a8;
}

.shard p {
  overflow-wrap: anywhere;
  font-size: 9px;
  line-height: 1.4;
}

.shard small {
  display: block;
  margin-top: 5px;
  color: #90627b;
  font-size: 8px;
}

.radio-inventory {
  margin-top: 12px;
  padding: 13px;
  border: 3px solid #63354f;
  background: #ffe9ee;
}

.radio-inventory__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 9px;
  border-bottom: 2px dashed #cf8aa7;
}

.radio-inventory h3 {
  font-size: 12px;
}

.radio-inventory__heading p {
  color: #97516f;
  font-size: 8px;
}

.radio-inventory ul {
  display: grid;
  gap: 7px;
  margin: 11px 0 0;
  padding: 0;
  list-style: none;
}

.radio-inventory li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
}

.radio-inventory li > span {
  width: 10px;
  height: 10px;
  background: #d45a8d;
  box-shadow: 3px 3px 0 #63354f;
  transform: rotate(45deg);
}

.radio-inventory li small {
  margin-left: auto;
}

.inventory-empty {
  margin-top: 11px !important;
  color: #8c6578;
  font-size: 9px;
  line-height: 1.6;
}

.sound-toggle {
  display: flex;
  width: 100%;
  min-height: 38px;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
  padding: 7px 10px;
  border: 3px solid #63354f;
  color: #422238;
  background: #ffd8e6;
  font: inherit;
  font-size: 9px;
  cursor: pointer;
}

.sound-toggle > span {
  width: 8px;
  height: 8px;
  background: #836071;
  box-shadow: 12px 0 0 #836071, 24px 0 0 #836071;
}

.sound-toggle > span.is-on {
  background: #5d9b70;
  box-shadow: 12px 0 0 #ffd36e, 24px 0 0 #e75e97;
}

.sound-toggle > span + * {
  margin-left: 24px;
}

.radio-arrive-enter-active,
.radio-arrive-leave-active,
.radio-panel-enter-active,
.radio-panel-leave-active {
  transition: opacity 160ms steps(3, end), transform 160ms steps(3, end);
}

.radio-arrive-enter-from,
.radio-arrive-leave-to {
  opacity: 0;
  transform: translateY(18px);
}

.radio-panel-enter-from,
.radio-panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

@keyframes radio-scan {
  to {
    transform: translateY(14px);
  }
}

@media (max-width: 700px) {
  .pocket-radio {
    left: 12px;
    bottom: 72px;
  }

  .radio-trigger {
    min-height: 42px;
    padding: 5px 8px;
  }

  .radio-panel {
    width: calc(100vw - 24px);
    max-height: calc(100dvh - 132px);
    padding: 14px;
  }

  .shard-list {
    gap: 5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .radio-screen__scan {
    animation: none;
  }

  .radio-trigger,
  .radio-arrive-enter-active,
  .radio-arrive-leave-active,
  .radio-panel-enter-active,
  .radio-panel-leave-active {
    transition: none;
  }
}
</style>
