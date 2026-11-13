<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { toolShedItems } from '../data/content'

const props = withDefaults(
  defineProps<{
    atticOpen?: boolean
    batteryClaimed?: boolean
  }>(),
  {
    atticOpen: false,
    batteryClaimed: false,
  },
)

const emit = defineEmits<{
  (event: 'combination-complete'): void
}>()

const CORRECT_SEQUENCE = ['about-xiaoliangdian', 'working-stack', 'current-research'] as const
const ACCEPTED_DRAG_IDS = toolShedItems.map((item) => `shed:${item.id}`).join(',')

const activeId = ref(toolShedItems[0]?.id ?? '')
const shelf = ref<HTMLElement | null>(null)
const workbenchIds = ref<string[]>([])
const puzzleComplete = ref(props.batteryClaimed)
const isResetting = ref(false)
const puzzleFeedback = ref(
  props.batteryClaimed ? '暗格已经打开，旧电池已被取走。' : '工作台还在等待第一件物品。',
)
let combinationEmitted = false
let resetTimer: ReturnType<typeof setTimeout> | undefined

const activeItem = computed(
  () => toolShedItems.find((item) => item.id === activeId.value) ?? toolShedItems[0],
)

const workbenchItems = computed(() =>
  workbenchIds.value.map((id) => toolShedItems.find((item) => item.id === id)).filter(Boolean),
)

const canPlaceActiveItem = computed(
  () =>
    props.atticOpen &&
    !props.batteryClaimed &&
    !puzzleComplete.value &&
    !isResetting.value &&
    Boolean(activeItem.value),
)

function selectItem(id: string) {
  activeId.value = id
}

function clearResetTimer() {
  if (resetTimer === undefined) return
  window.clearTimeout(resetTimer)
  resetTimer = undefined
}

function isCorrectSequence(sequence: string[]) {
  return CORRECT_SEQUENCE.every((id, index) => sequence[index] === id)
}

function placeOnWorkbench(id: string) {
  if (!props.atticOpen) {
    puzzleFeedback.value = '房梁上的小门还没有打开。'
    return false
  }

  if (props.batteryClaimed) {
    puzzleFeedback.value = '暗格已经打开，旧电池已被取走。'
    return false
  }

  if (puzzleComplete.value || isResetting.value) return false
  if (!toolShedItems.some((item) => item.id === id)) return false

  const nextSequence = [...workbenchIds.value, id]
  workbenchIds.value = nextSequence

  if (nextSequence.length < CORRECT_SEQUENCE.length) {
    puzzleFeedback.value = `第 ${nextSequence.length} 件已就位。木制齿轮轻轻转了一格。`
    return true
  }

  if (isCorrectSequence(nextSequence)) {
    puzzleComplete.value = true
    puzzleFeedback.value = '咔哒——三枚齿轮咬合，工作台下方弹出一个小暗格。'
    if (!combinationEmitted) {
      combinationEmitted = true
      emit('combination-complete')
    }
    return true
  }

  isResetting.value = true
  puzzleFeedback.value = '喀——齿轮卡住了。顺序不对，三件物品正在被工作台送回。'
  clearResetTimer()
  resetTimer = window.setTimeout(() => {
    workbenchIds.value = []
    isResetting.value = false
    puzzleFeedback.value = '工作台复位了。可以再读一遍房梁上的纸条。'
    resetTimer = undefined
  }, 760)
  return false
}

function removeLastItem() {
  if (puzzleComplete.value || isResetting.value || workbenchIds.value.length === 0) return
  workbenchIds.value = workbenchIds.value.slice(0, -1)
  puzzleFeedback.value = workbenchIds.value.length
    ? '最后一件物品已放回架子。'
    : '工作台又空了。'
}

function acceptPixelDrop(rawId: string) {
  const id = rawId.startsWith('shed:') ? rawId.slice('shed:'.length) : rawId
  return placeOnWorkbench(id)
}

defineExpose({ acceptPixelDrop })

watch(
  () => props.batteryClaimed,
  (claimed) => {
    if (!claimed) return
    puzzleComplete.value = true
    puzzleFeedback.value = '暗格已经打开，旧电池已被取走。'
  },
)

onBeforeUnmount(clearResetTimer)

async function moveFocus(event: KeyboardEvent, index: number) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return

  event.preventDefault()
  let nextIndex = index

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (index + 1) % toolShedItems.length
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (index - 1 + toolShedItems.length) % toolShedItems.length
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = toolShedItems.length - 1
  }

  selectItem(toolShedItems[nextIndex]?.id ?? activeId.value)
  await nextTick()
  shelf.value?.querySelectorAll<HTMLButtonElement>('.shed-object')[nextIndex]?.focus()
}
</script>

<template>
  <section id="about" class="tool-shed" aria-labelledby="tool-shed-title">
    <header class="tool-shed__heading">
      <p class="tool-shed__label">BBB 工具房</p>
      <h2 id="tool-shed-title">认识一个人，先看看他每天拿起什么</h2>
      <p>四件物品对应关于我、技术栈、合作方式和当前研究。内容均可替换。</p>
    </header>

    <div class="tool-shed__layout">
      <div ref="shelf" class="shed-shelf" aria-label="选择一件物品查看详情">
        <p class="sr-only">可使用方向键切换物品</p>
        <button
          v-for="(item, index) in toolShedItems"
          :key="item.id"
          type="button"
          class="shed-object"
          :class="[`shed-object--${item.kind}`, { 'is-active': activeId === item.id }]"
          :aria-pressed="activeId === item.id"
          :data-pixel-drag="`shed:${item.id}`"
          data-pixel-magnet="soft"
          aria-controls="shed-detail"
          @click="selectItem(item.id)"
          @focus="selectItem(item.id)"
          @keydown="moveFocus($event, index)"
        >
          <span class="object-pixel" aria-hidden="true">
            <span>{{ item.shortLabel }}</span>
          </span>
          <span class="object-label">{{ item.label }}</span>
        </button>
        <div class="shelf-board shelf-board--top" aria-hidden="true" />
        <div class="shelf-board shelf-board--bottom" aria-hidden="true" />
      </div>

      <div id="shed-detail" class="shed-detail" aria-live="polite">
        <Transition name="detail" mode="out-in">
          <article
            v-if="activeItem"
            :id="`shed-detail-${activeItem.id}`"
            :key="activeItem.id"
            class="shed-detail__inner"
          >
            <p class="shed-detail__name">{{ activeItem.label }}</p>
            <h3>{{ activeItem.title }}</h3>
            <p>{{ activeItem.description }}</p>
            <ul>
              <li v-for="detail in activeItem.details" :key="detail">{{ detail }}</li>
            </ul>
            <button
              v-if="atticOpen"
              type="button"
              class="place-button"
              :disabled="!canPlaceActiveItem"
              @click="placeOnWorkbench(activeItem.id)"
            >
              {{ batteryClaimed ? '电池已取走' : puzzleComplete ? '暗格已打开' : '放上阁楼工作台' }}
            </button>
          </article>
        </Transition>
      </div>
    </div>

    <Transition name="attic-reveal">
      <section
        v-if="atticOpen"
        class="attic-workshop"
        aria-labelledby="attic-workshop-title"
      >
        <div class="attic-workshop__rafters" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <header class="attic-workshop__heading">
          <div>
            <p class="attic-workshop__eyebrow">阁楼暗层·工作台</p>
            <h3 id="attic-workshop-title">房梁里藏着一台不肯直接说话的机器</h3>
          </div>
          <p class="attic-workshop__hint">
            半张维修纸写着：“先让握灯的人归位，再放上他日日使用的器具；
            最后，让那个仍未解答的问题朝向窗外。”刻着“一起”的那件东西，似乎只负责把门带到这里。
          </p>
        </header>

        <div
          class="workbench"
          :class="{
            'is-complete': puzzleComplete,
            'is-resetting': isResetting,
            'is-claimed': batteryClaimed,
          }"
          data-pixel-drop="shed-workbench"
          :data-pixel-accept="ACCEPTED_DRAG_IDS"
          tabindex="0"
          aria-describedby="workbench-instructions workbench-feedback"
        >
          <p id="workbench-instructions" class="workbench__instructions">
            可把架子上的物品拖到这里，也可选中物品后按“放上阁楼工作台”。
          </p>

          <ol class="workbench__slots" aria-label="工作台三个顺序槽">
            <li
              v-for="slotIndex in 3"
              :key="slotIndex"
              class="workbench-slot"
              :class="{ 'has-item': workbenchItems[slotIndex - 1] }"
            >
              <span class="workbench-slot__number">0{{ slotIndex }}</span>
              <template v-if="workbenchItems[slotIndex - 1]">
                <span class="workbench-slot__glyph" aria-hidden="true">
                  {{ workbenchItems[slotIndex - 1]?.shortLabel }}
                </span>
                <span class="workbench-slot__label">
                  {{ workbenchItems[slotIndex - 1]?.label }}
                </span>
              </template>
              <span v-else class="workbench-slot__empty">等待物品</span>
            </li>
          </ol>

          <div class="workbench__status-row">
            <p id="workbench-feedback" class="workbench__feedback" aria-live="polite">
              {{ puzzleFeedback }}
            </p>
            <button
              v-if="!puzzleComplete && !batteryClaimed"
              type="button"
              class="undo-button"
              :disabled="isResetting || workbenchIds.length === 0"
              @click="removeLastItem"
            >
              撤回最后一件
            </button>
          </div>

          <div
            v-if="puzzleComplete || batteryClaimed"
            class="battery-compartment"
            :class="{ 'is-empty': batteryClaimed }"
          >
            <div v-if="!batteryClaimed" class="old-battery" role="img" aria-label="一枚带着粉色电芯的像素旧电池">
              <span class="old-battery__cap" />
              <span class="old-battery__charge" />
              <span class="old-battery__spark" aria-hidden="true">✦</span>
            </div>
            <p v-else>暗格里只剩一圈淡粉色电痕。电池已带去需要它的地方。</p>
          </div>
        </div>
      </section>
    </Transition>
  </section>
</template>

<style scoped>
.tool-shed {
  --pink-100: #f7dce5;
  --pink-300: #e7a1b7;
  --pink-500: #c65f83;
  --plum-700: #623b50;
  --plum-900: #302129;
  --wood-300: #c58f72;
  --wood-500: #9a644f;
  --paper: #fff8f1;
  width: 100%;
  padding: clamp(76px, 10vw, 148px) clamp(20px, 6vw, 84px);
  box-sizing: border-box;
  color: var(--plum-900);
  background: #f5d8dc;
  text-align: left;
}

.tool-shed__heading {
  max-width: 780px;
  margin-bottom: 64px;
}

.tool-shed__label {
  margin: 0 0 16px;
  color: #93405f;
  font: 800 0.76rem/1.2 ui-monospace, monospace;
  letter-spacing: 0.14em;
}

.tool-shed__heading h2 {
  max-width: 16ch;
  margin: 0;
  color: var(--plum-900);
  font-size: clamp(2rem, 4.8vw, 4.5rem);
  line-height: 1.03;
  letter-spacing: -0.055em;
}

.tool-shed__heading > p:last-child {
  max-width: 48ch;
  margin-top: 22px;
  color: var(--plum-700);
  line-height: 1.7;
}

.tool-shed__layout {
  display: grid;
  grid-template-columns: minmax(360px, 0.95fr) minmax(320px, 1.05fr);
  gap: clamp(28px, 5vw, 76px);
  align-items: stretch;
  max-width: 1280px;
  margin: 0 auto;
}

.shed-shelf {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 52px 20px;
  min-height: 590px;
  padding: 46px 34px 52px;
  overflow: hidden;
  background:
    repeating-linear-gradient(90deg, rgb(48 33 41 / 6%) 0 3px, transparent 3px 46px),
    #e9bbad;
  border: 5px solid var(--plum-700);
  box-shadow: 11px 11px 0 rgb(48 33 41 / 18%);
  box-sizing: border-box;
}

.shelf-board {
  position: absolute;
  right: 18px;
  left: 18px;
  height: 18px;
  background: var(--wood-500);
  border: 4px solid var(--plum-700);
  box-shadow: 0 8px 0 rgb(48 33 41 / 14%);
  pointer-events: none;
}

.shelf-board--top {
  top: 48%;
}

.shelf-board--bottom {
  bottom: 20px;
}

.shed-object {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: end center;
  align-self: end;
  min-width: 0;
  min-height: 210px;
  padding: 12px;
  color: var(--plum-900);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.shed-object:nth-of-type(2) {
  transform: translateY(-24px);
}

.shed-object:nth-of-type(3) {
  transform: translateY(12px);
}

.shed-object:focus-visible {
  outline: 4px solid #843354;
  outline-offset: 3px;
}

.object-pixel {
  position: relative;
  display: grid;
  place-items: center;
  width: 92px;
  height: 112px;
  margin-bottom: 22px;
  color: #fff7fa;
  background: var(--pink-500);
  border: 5px solid var(--plum-900);
  box-shadow: 8px 8px 0 rgb(48 33 41 / 22%);
  transition: transform 160ms steps(2, end), box-shadow 160ms steps(2, end);
}

.object-pixel::before,
.object-pixel::after {
  content: '';
  position: absolute;
  background: var(--paper);
  border: 4px solid var(--plum-900);
}

.object-pixel::before {
  top: -22px;
  left: 15px;
  width: 52px;
  height: 18px;
}

.object-pixel::after {
  right: -18px;
  bottom: 18px;
  width: 14px;
  height: 38px;
}

.object-pixel span {
  font: 900 1.55rem/1 ui-monospace, monospace;
}

.shed-object--stack .object-pixel {
  width: 112px;
  height: 80px;
  background: #78866c;
}

.shed-object--stack .object-pixel::before {
  top: 12px;
  left: 18px;
  width: 68px;
  height: 38px;
  background: #e5e7bc;
}

.shed-object--stack .object-pixel::after {
  right: 20px;
  bottom: -18px;
  width: 68px;
  height: 12px;
  background: var(--wood-300);
}

.shed-object--work .object-pixel {
  width: 122px;
  height: 72px;
  background: #d28a82;
}

.shed-object--work .object-pixel::before {
  top: -28px;
  left: 42px;
  width: 30px;
  height: 24px;
  background: var(--wood-300);
}

.shed-object--work .object-pixel::after {
  right: 18px;
  bottom: 20px;
  width: 10px;
  height: 10px;
  background: #fff0a8;
}

.shed-object--research .object-pixel {
  width: 82px;
  height: 120px;
  background: #6f7e8c;
}

.shed-object--research .object-pixel::before {
  top: 15px;
  left: 14px;
  width: 44px;
  height: 38px;
  background: #d9edf0;
}

.shed-object--research .object-pixel::after {
  right: 9px;
  bottom: 14px;
  width: 8px;
  height: 8px;
  background: #fff0a8;
  box-shadow: -18px 0 0 #ef9db5;
}

.shed-object:is(:hover, .is-active) .object-pixel {
  transform: translate(-4px, -5px);
  box-shadow: 12px 13px 0 rgb(48 33 41 / 25%);
}

.object-label {
  padding: 7px 9px;
  color: var(--paper);
  background: var(--plum-700);
  border: 3px solid var(--plum-900);
  font: 800 0.75rem/1.2 ui-monospace, monospace;
  white-space: nowrap;
}

.shed-detail {
  position: relative;
  min-height: 590px;
  padding: clamp(32px, 5vw, 64px);
  overflow: hidden;
  background: var(--paper);
  border: 5px solid var(--plum-700);
  box-shadow: 11px 11px 0 var(--pink-300);
  box-sizing: border-box;
}

.shed-detail::before {
  content: '';
  position: absolute;
  top: 20px;
  right: 20px;
  width: 20px;
  height: 20px;
  background: var(--pink-300);
  box-shadow: -28px 0 0 var(--pink-100), 0 28px 0 var(--pink-100);
}

.shed-detail__inner {
  position: relative;
  z-index: 1;
}

.shed-detail__name {
  margin: 0 0 28px;
  color: var(--pink-500);
  font: 800 0.76rem/1.2 ui-monospace, monospace;
  letter-spacing: 0.1em;
}

.shed-detail h3 {
  max-width: 13ch;
  margin: 0 0 20px;
  color: var(--plum-900);
  font-size: clamp(1.8rem, 4vw, 3.8rem);
  line-height: 1.05;
  letter-spacing: -0.05em;
}

.shed-detail__inner > p:not(.shed-detail__name) {
  max-width: 48ch;
  margin: 0;
  color: var(--plum-700);
  line-height: 1.7;
}

.shed-detail ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 34px 0 0;
  padding: 0;
  list-style: none;
}

.shed-detail li {
  position: relative;
  min-height: 72px;
  padding: 16px 16px 16px 30px;
  color: var(--plum-700);
  background: #f9e8ec;
  border-left: 5px solid var(--pink-500);
  box-sizing: border-box;
  line-height: 1.5;
}

.shed-detail li::before {
  content: '';
  position: absolute;
  top: 22px;
  left: 12px;
  width: 7px;
  height: 7px;
  background: var(--pink-500);
}

.place-button,
.undo-button {
  min-height: 46px;
  color: var(--paper);
  background: var(--plum-700);
  border: 3px solid var(--plum-900);
  box-shadow: 4px 4px 0 var(--pink-300);
  font: 800 0.76rem/1.35 ui-monospace, monospace;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: transform 120ms steps(2, end), box-shadow 120ms steps(2, end);
}

.place-button {
  width: min(100%, 280px);
  margin-top: 30px;
  padding: 10px 16px;
}

.place-button:is(:hover, :focus-visible):not(:disabled),
.undo-button:is(:hover, :focus-visible):not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 7px 7px 0 var(--pink-300);
  outline: 0;
}

.place-button:focus-visible,
.undo-button:focus-visible,
.workbench:focus-visible {
  outline: 4px solid #fff0a8;
  outline-offset: 4px;
}

.place-button:disabled,
.undo-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.attic-workshop {
  position: relative;
  max-width: 1280px;
  margin: clamp(70px, 9vw, 132px) auto 0;
  padding: clamp(34px, 6vw, 72px);
  overflow: hidden;
  color: #fff4f7;
  background:
    linear-gradient(90deg, rgb(255 244 247 / 4%) 1px, transparent 1px) 0 0 / 23px 23px,
    linear-gradient(rgb(255 244 247 / 3%) 1px, transparent 1px) 0 0 / 23px 23px,
    #3a2933;
  border: 5px solid var(--plum-900);
  box-shadow: 13px 13px 0 rgb(48 33 41 / 24%);
  box-sizing: border-box;
  isolation: isolate;
}

.attic-workshop::before,
.attic-workshop::after {
  content: '';
  position: absolute;
  z-index: -1;
  width: 170px;
  height: 170px;
  background: #563848;
  border: 5px solid #241920;
  transform: rotate(45deg);
}

.attic-workshop::before {
  top: -126px;
  left: -64px;
}

.attic-workshop::after {
  top: -126px;
  right: -64px;
}

.attic-workshop__rafters {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.attic-workshop__rafters span {
  position: absolute;
  top: -60px;
  width: 22px;
  height: 300px;
  background: #7a4e4a;
  border: 4px solid #241920;
  box-shadow: 7px 7px 0 rgb(15 10 13 / 22%);
}

.attic-workshop__rafters span:nth-child(1) {
  left: 13%;
  transform: rotate(-28deg);
}

.attic-workshop__rafters span:nth-child(2) {
  left: calc(50% - 11px);
}

.attic-workshop__rafters span:nth-child(3) {
  right: 13%;
  transform: rotate(28deg);
}

.attic-workshop__heading {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr);
  gap: clamp(24px, 5vw, 72px);
  align-items: end;
  margin-bottom: 38px;
}

.attic-workshop__eyebrow {
  margin: 0 0 12px;
  color: #ef9fba;
  font: 900 0.73rem/1.2 ui-monospace, monospace;
  letter-spacing: 0.12em;
}

.attic-workshop__heading h3 {
  max-width: 14ch;
  margin: 0;
  color: #fff7f9;
  font-size: clamp(1.85rem, 4.2vw, 4rem);
  line-height: 1.04;
  letter-spacing: -0.05em;
}

.attic-workshop__hint {
  margin: 0;
  padding: 22px 22px 22px 26px;
  color: #553544;
  background: #f7dfd7;
  border: 4px solid #241920;
  box-shadow: 7px 7px 0 #c8708f;
  font: 700 0.87rem/1.75 ui-monospace, monospace;
  transform: rotate(0.8deg);
}

.workbench {
  position: relative;
  padding: clamp(24px, 4vw, 44px);
  background:
    repeating-linear-gradient(0deg, transparent 0 34px, rgb(55 27 36 / 10%) 34px 37px),
    #b77770;
  border: 5px solid #241920;
  box-shadow: inset 0 -10px 0 #8d564f, 10px 10px 0 rgb(15 10 13 / 28%);
  transition: background-color 180ms steps(2, end), transform 180ms steps(2, end);
}

.workbench::before,
.workbench::after {
  content: '';
  position: absolute;
  bottom: -38px;
  width: 34px;
  height: 36px;
  background: #7a4e4a;
  border: 5px solid #241920;
  border-top: 0;
}

.workbench::before {
  left: 34px;
}

.workbench::after {
  right: 34px;
}

.workbench.is-resetting {
  animation: workbench-error 380ms steps(4, end) 2;
}

.workbench.is-complete {
  background-color: #c78683;
  box-shadow: inset 0 -10px 0 #8d564f, 10px 10px 0 #e38caa;
}

.workbench__instructions {
  margin: 0 0 20px;
  color: #3b2530;
  font: 800 0.73rem/1.55 ui-monospace, monospace;
}

.workbench__slots {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(10px, 2vw, 22px);
  margin: 0;
  padding: 0;
  list-style: none;
}

.workbench-slot {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  place-items: center;
  min-width: 0;
  min-height: 148px;
  padding: 18px 12px 14px;
  color: #4c303d;
  background: rgb(76 48 61 / 13%);
  border: 4px dashed #69414f;
  box-sizing: border-box;
}

.workbench-slot.has-item {
  background: #f6d6df;
  border-style: solid;
  box-shadow: inset 0 -7px 0 #e6a0b5;
}

.workbench-slot__number {
  justify-self: start;
  color: #65404e;
  font: 900 0.65rem/1 ui-monospace, monospace;
  letter-spacing: 0.08em;
}

.workbench-slot__glyph {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin: 9px 0;
  color: #fff8fa;
  background: var(--pink-500);
  border: 4px solid var(--plum-900);
  box-shadow: 5px 5px 0 rgb(48 33 41 / 22%);
  font: 900 1rem/1 ui-monospace, monospace;
}

.workbench-slot__label,
.workbench-slot__empty {
  max-width: 100%;
  overflow-wrap: anywhere;
  text-align: center;
  font: 800 0.72rem/1.35 ui-monospace, monospace;
}

.workbench-slot__empty {
  align-self: center;
  color: rgb(76 48 61 / 68%);
}

.workbench__status-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: center;
  margin-top: 22px;
}

.workbench__feedback {
  min-height: 2.8em;
  margin: 0;
  color: #35212b;
  font: 800 0.8rem/1.55 ui-monospace, monospace;
}

.undo-button {
  padding: 9px 13px;
  box-shadow: 4px 4px 0 #e9b7c6;
}

.battery-compartment {
  display: grid;
  place-items: center;
  min-height: 142px;
  margin-top: 24px;
  padding: 18px;
  color: #fceaf0;
  background: #2b1d25;
  border: 5px solid #241920;
  box-shadow: inset 0 8px 0 #160f13;
  box-sizing: border-box;
  animation: compartment-open 420ms steps(5, end) both;
}

.battery-compartment.is-empty p {
  max-width: 42ch;
  margin: 0;
  color: #dab6c1;
  text-align: center;
  font: 700 0.78rem/1.6 ui-monospace, monospace;
}

.old-battery {
  position: relative;
  width: 146px;
  height: 66px;
  background: #65505a;
  border: 5px solid #140d11;
  box-shadow: 7px 7px 0 rgb(0 0 0 / 34%);
}

.old-battery__cap {
  position: absolute;
  top: 18px;
  right: -18px;
  width: 13px;
  height: 24px;
  background: #c3a7ac;
  border: 5px solid #140d11;
  border-left: 0;
}

.old-battery__charge {
  position: absolute;
  inset: 12px 38px 12px 14px;
  background: linear-gradient(90deg, #ec8eae 0 58%, #4b3741 58% 100%);
  border: 4px solid #1e1419;
}

.old-battery__spark {
  position: absolute;
  top: -25px;
  right: 32px;
  color: #fff0a8;
  font: 900 1.4rem/1 ui-monospace, monospace;
  animation: battery-spark 900ms steps(2, end) infinite;
}

.attic-reveal-enter-active,
.attic-reveal-leave-active {
  transition: opacity 240ms steps(4, end), transform 240ms steps(4, end);
}

.attic-reveal-enter-from,
.attic-reveal-leave-to {
  opacity: 0;
  transform: translateY(-24px);
}

@keyframes workbench-error {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-7px);
  }
  75% {
    transform: translateX(7px);
  }
}

@keyframes compartment-open {
  from {
    clip-path: inset(0 50% 100% 50%);
  }
  to {
    clip-path: inset(0);
  }
}

@keyframes battery-spark {
  0%,
  48% {
    opacity: 1;
    transform: translateY(-2px);
  }
  49%,
  100% {
    opacity: 0.35;
    transform: translateY(1px);
  }
}

.detail-enter-active,
.detail-leave-active {
  transition: opacity 140ms steps(2, end), transform 140ms steps(2, end);
}

.detail-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.detail-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .tool-shed__layout {
    grid-template-columns: 1fr;
  }

  .shed-shelf,
  .shed-detail {
    min-height: 540px;
  }

  .attic-workshop__heading {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .attic-workshop__heading h3 {
    max-width: 17ch;
  }
}

@media (max-width: 620px) {
  .tool-shed {
    padding: 68px 20px 88px;
  }

  .tool-shed__heading {
    margin-bottom: 44px;
  }

  .shed-shelf {
    min-height: 0;
    padding: 28px 16px 36px;
    gap: 34px 8px;
    box-shadow: 6px 6px 0 rgb(48 33 41 / 18%);
  }

  .shed-object {
    min-height: 180px;
    padding-inline: 4px;
  }

  .shed-object:nth-of-type(n) {
    transform: none;
  }

  .object-pixel {
    transform: scale(0.82);
    margin-bottom: 10px;
  }

  .shed-object:is(:hover, .is-active) .object-pixel {
    transform: scale(0.82) translate(-3px, -4px);
  }

  .object-label {
    font-size: 0.68rem;
  }

  .shed-detail {
    min-height: 520px;
    padding: 36px 24px;
    box-shadow: 6px 6px 0 var(--pink-300);
  }

  .shed-detail ul {
    grid-template-columns: 1fr;
  }

  .attic-workshop {
    margin-top: 70px;
    padding: 30px 18px 38px;
    box-shadow: 7px 7px 0 rgb(48 33 41 / 24%);
  }

  .attic-workshop__heading {
    gap: 24px;
    margin-bottom: 28px;
  }

  .attic-workshop__hint {
    padding: 18px;
    font-size: 0.76rem;
    transform: none;
  }

  .workbench {
    padding: 20px 14px 28px;
    box-shadow: inset 0 -8px 0 #8d564f, 6px 6px 0 rgb(15 10 13 / 28%);
  }

  .workbench__slots {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .workbench-slot {
    grid-template-columns: auto 56px minmax(0, 1fr);
    grid-template-rows: 1fr;
    place-items: center start;
    min-height: 82px;
    padding: 10px 12px;
  }

  .workbench-slot__glyph {
    margin: 0;
  }

  .workbench-slot__label,
  .workbench-slot__empty {
    padding-left: 10px;
    text-align: left;
  }

  .workbench__status-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .undo-button {
    justify-self: stretch;
  }

  .old-battery {
    transform: scale(0.86);
  }
}

@media (prefers-reduced-motion: reduce) {
  .object-pixel,
  .detail-enter-active,
  .detail-leave-active,
  .place-button,
  .undo-button,
  .workbench,
  .attic-reveal-enter-active,
  .attic-reveal-leave-active {
    transition: none;
  }

  .workbench.is-resetting,
  .battery-compartment,
  .old-battery__spark {
    animation: none;
  }
}
</style>
