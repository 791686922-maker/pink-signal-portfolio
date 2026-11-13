<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { socialLinks } from '../data/content'

type FormState = 'idle' | 'loading' | 'success' | 'error'
type ConstellationState = 'idle' | 'drawing' | 'error' | 'complete'
type StarId = 'night-star-a' | 'night-star-b' | 'night-star-c' | 'night-star-d' | 'night-star-e'

type NightStar = {
  id: StarId
  label: string
  x: number
  y: number
}

const props = withDefaults(
  defineProps<{
    shardCount?: number
    endingReady?: boolean
    endingSeen?: boolean
  }>(),
  {
    shardCount: 0,
    endingReady: false,
    endingSeen: false,
  },
)

const emit = defineEmits<{
  'open-finale': []
}>()

const stars: readonly NightStar[] = [
  { id: 'night-star-a', label: '山脊星', x: 18, y: 20 },
  { id: 'night-star-b', label: '湖畔星', x: 31, y: 43 },
  { id: 'night-star-c', label: '心灯星', x: 49, y: 28 },
  { id: 'night-star-d', label: '月门星', x: 67, y: 13 },
  { id: 'night-star-e', label: '远讯星', x: 82, y: 40 },
] as const

const constellationSequence: readonly StarId[] = [
  'night-star-b',
  'night-star-a',
  'night-star-c',
  'night-star-d',
  'night-star-e',
] as const

const isMailboxOpen = ref(false)
const email = ref('')
const message = ref('')
const formState = ref<FormState>('idle')
const emailInput = ref<HTMLInputElement | null>(null)
const selectedStars = ref<StarId[]>([])
const constellationState = ref<ConstellationState>('idle')
let submitTimer: ReturnType<typeof setTimeout> | undefined
let constellationTimer: ReturnType<typeof setTimeout> | undefined

const safeShardCount = computed(() => Math.min(3, Math.max(0, Math.floor(props.shardCount))))

const selectedStarPoints = computed(() =>
  selectedStars.value
    .map((id) => stars.find((star) => star.id === id))
    .filter((star): star is NightStar => Boolean(star))
    .map((star) => `${star.x},${star.y}`)
    .join(' '),
)

const constellationStatus = computed(() => {
  if (constellationState.value === 'complete') return '发现「归途天线」：湖面正在回应这条信号。'
  if (constellationState.value === 'error') return '星光断线了。顺序已重置，请从离湖最近的星开始。'
  if (selectedStars.value.length > 0) {
    return `信号已连接 ${selectedStars.value.length}/5，继续沿最亮的星向右。`
  }
  return '线索：从离湖最近的星开始，再向左上，最后沿亮星一路向右。'
})

const endingLabel = computed(() => {
  if (props.endingSeen) return '重播零点广播'
  return '合并三枚信号片 · 开始零点广播'
})

const submitLabel = computed(() => {
  if (formState.value === 'loading') return '模拟投递中'
  if (formState.value === 'success') return '演示已完成'
  return '投进邮箱'
})

async function toggleMailbox() {
  isMailboxOpen.value = !isMailboxOpen.value
  if (isMailboxOpen.value) {
    await nextTick()
    emailInput.value?.focus()
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function submitDemo() {
  if (submitTimer) clearTimeout(submitTimer)
  formState.value = 'loading'

  submitTimer = setTimeout(async () => {
    if (!isValidEmail(email.value)) {
      formState.value = 'error'
      await nextTick()
      emailInput.value?.focus()
      return
    }

    formState.value = 'success'
  }, 780)
}

function resetDemo() {
  formState.value = 'idle'
  email.value = ''
  message.value = ''
  nextTick(() => emailInput.value?.focus())
}

function starStyle(star: NightStar) {
  return {
    left: `${star.x}%`,
    top: `${(star.y / 60) * 100}%`,
  }
}

function connectStar(id: StarId) {
  if (constellationState.value === 'complete') return true

  const expected = constellationSequence[selectedStars.value.length]
  if (id !== expected) {
    selectedStars.value = []
    constellationState.value = 'error'
    if (constellationTimer) clearTimeout(constellationTimer)
    constellationTimer = setTimeout(() => {
      if (constellationState.value === 'error') constellationState.value = 'idle'
    }, 900)
    return false
  }

  selectedStars.value = [...selectedStars.value, id]
  constellationState.value = selectedStars.value.length === constellationSequence.length ? 'complete' : 'drawing'
  return true
}

function acceptPixelDrop(id: string) {
  const star = stars.find((item) => item.id === id)
  if (!star) return false
  return connectStar(star.id)
}

defineExpose({ acceptPixelDrop })

onBeforeUnmount(() => {
  if (submitTimer) clearTimeout(submitTimer)
  if (constellationTimer) clearTimeout(constellationTimer)
})
</script>

<template>
  <section id="contact" class="night-signal" aria-labelledby="night-signal-title">
    <div class="night-signal__content">
      <header class="night-signal__heading">
        <p class="night-signal__label">夜晚信号</p>
        <h2 id="night-signal-title">天黑以后，电台还为你留着一格信号</h2>
        <p>想聊文章、产品或一次合作，可以打开农场邮箱。当前表单只演示交互，不会发送或保存信息。</p>
      </header>

      <div class="mailbox-zone">
        <button
          type="button"
          class="mailbox-button"
          :class="{ 'is-open': isMailboxOpen }"
          :aria-expanded="isMailboxOpen"
          aria-controls="contact-form"
          @click="toggleMailbox"
        >
          <span class="mailbox-button__pixel" aria-hidden="true">
            <span class="mailbox-button__flag" />
            <span class="mailbox-button__slot" />
          </span>
          <span>{{ isMailboxOpen ? '收起邮箱' : '打开邮箱' }}</span>
        </button>

        <Transition name="mailbox">
          <form
            v-if="isMailboxOpen"
            id="contact-form"
            class="contact-form"
            :aria-busy="formState === 'loading'"
            novalidate
            @submit.prevent="submitDemo"
          >
            <div class="field-group">
              <label for="contact-email">你的邮箱</label>
              <input
                id="contact-email"
                ref="emailInput"
                v-model.trim="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                :aria-invalid="formState === 'error'"
                :aria-describedby="formState === 'error' ? 'contact-error' : 'contact-helper'"
                placeholder="name@example.com"
                :disabled="formState === 'loading' || formState === 'success'"
              />
              <p id="contact-helper">提交有效邮箱可预览成功状态，格式错误会显示错误状态。</p>
            </div>

            <div class="field-group">
              <label for="contact-message">想说的话</label>
              <textarea
                id="contact-message"
                v-model.trim="message"
                rows="4"
                placeholder="这里适合写一件具体的事"
                :disabled="formState === 'loading' || formState === 'success'"
              />
            </div>

            <div class="form-actions">
              <button
                v-if="formState !== 'success'"
                type="submit"
                class="submit-button"
                :disabled="formState === 'loading'"
              >
                {{ submitLabel }}
              </button>
              <button v-else type="button" class="submit-button submit-button--secondary" @click="resetDemo">
                再演示一次
              </button>

              <p v-if="formState === 'loading'" class="form-status is-loading" role="status">
                正在把像素信封送往山顶。
              </p>
              <p v-else-if="formState === 'success'" class="form-status is-success" role="status">
                演示完成。你的信息没有被发送或保存。
              </p>
              <p v-else-if="formState === 'error'" id="contact-error" class="form-status is-error" role="alert">
                邮箱格式似乎不完整，请检查后再试。
              </p>
            </div>
          </form>
        </Transition>
      </div>

      <nav class="social-links" aria-label="社交链接示例">
        <p>社交链接为示例地址</p>
        <ul>
          <li v-for="link in socialLinks" :key="link.label">
            <a :href="link.href" :aria-label="`${link.label}，${link.hint}`">
              <span>{{ link.label }}</span>
              <small>{{ link.hint }}</small>
            </a>
          </li>
        </ul>
      </nav>
    </div>

    <div
      class="night-scene"
      :class="{
        'has-constellation': constellationState === 'complete',
        'has-ending': endingReady,
      }"
      aria-labelledby="constellation-title"
    >
      <div
        class="constellation-board"
        data-pixel-drop="night-constellation"
        data-pixel-accept="night-star-a,night-star-b,night-star-c,night-star-d,night-star-e"
        role="group"
        aria-describedby="constellation-hint constellation-feedback"
      >
        <h3 id="constellation-title" class="sr-only">可交互的归途星座</h3>
        <svg class="constellation-lines" viewBox="0 0 100 60" aria-hidden="true" preserveAspectRatio="none">
          <polyline
            v-if="selectedStarPoints"
            :points="selectedStarPoints"
            vector-effect="non-scaling-stroke"
          />
        </svg>

        <button
          v-for="(star, index) in stars"
          :key="star.id"
          type="button"
          class="constellation-star"
          :class="{
            'is-selected': selectedStars.includes(star.id),
            'is-next': constellationSequence[selectedStars.length] === star.id,
          }"
          :style="starStyle(star)"
          :data-pixel-drag="star.id"
          data-pixel-magnet="strong"
          :aria-label="`${star.label}，星点 ${String.fromCharCode(65 + index)}`"
          :aria-pressed="selectedStars.includes(star.id)"
          @click="connectStar(star.id)"
        >
          <span aria-hidden="true" />
          <small aria-hidden="true">{{ String.fromCharCode(65 + index) }}</small>
        </button>
      </div>

      <aside class="constellation-console" :class="`is-${constellationState}`">
        <p class="constellation-console__eyebrow">归途星图</p>
        <p id="constellation-hint">依次点亮五颗星，或把星拖进主星域。</p>
        <p id="constellation-feedback" class="constellation-console__feedback" aria-live="polite">
          {{ constellationStatus }}
        </p>
      </aside>

      <div class="moon" />
      <span class="ambient-star ambient-star--one" aria-hidden="true" />
      <span class="ambient-star ambient-star--two" aria-hidden="true" />
      <span class="ambient-star ambient-star--three" aria-hidden="true" />
      <div class="mountain mountain--back" />
      <div class="mountain mountain--front" />
      <div class="lake">
        <span class="moon-reflection" />
        <span class="signal-reflection" aria-hidden="true" />
        <span class="lake-line lake-line--one" />
        <span class="lake-line lake-line--two" />
      </div>
      <div class="sitting-figure">
        <span class="sitting-figure__head" />
        <span class="sitting-figure__body" />
      </div>
      <div class="shore-flower shore-flower--one" />
      <div class="shore-flower shore-flower--two" />
      <div class="shore-flower shore-flower--three" />

      <aside class="ending-gate" :class="{ 'is-ready': endingReady }">
        <div v-if="!endingReady" class="ending-gate__progress" aria-live="polite">
          <span>零点广播等待信号片</span>
          <strong>{{ safeShardCount }}/3</strong>
          <span class="ending-gate__dots" aria-hidden="true">
            <i v-for="index in 3" :key="index" :class="{ 'is-lit': index <= safeShardCount }" />
          </span>
        </div>
        <button
          v-else
          type="button"
          class="ending-gate__button"
          data-pixel-magnet="strong"
          @click="emit('open-finale')"
        >
          <span>{{ endingSeen ? '信号仍在回响' : '三枚信号片开始共振' }}</span>
          <strong>{{ endingLabel }}</strong>
        </button>
      </aside>

      <p class="night-scene__caption">今天先到这里。<br />花会替你继续长。</p>
    </div>
  </section>
</template>

<style scoped>
.night-signal {
  --night-950: #1d1828;
  --night-900: #292035;
  --night-800: #3c2a48;
  --rose-200: #f1bfd0;
  --rose-400: #d97799;
  --rose-500: #bf567d;
  --paper: #fff4f7;
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(360px, 0.98fr);
  min-height: 100dvh;
  width: 100%;
  box-sizing: border-box;
  color: var(--paper);
  background: var(--night-950);
  text-align: left;
}

.night-signal__content {
  position: relative;
  z-index: 3;
  padding: clamp(76px, 10vw, 136px) clamp(20px, 6vw, 82px);
  background:
    linear-gradient(90deg, rgb(255 255 255 / 3%) 1px, transparent 1px) 0 0 / 32px 32px,
    var(--night-950);
  border-right: 4px solid #6b415b;
}

.night-signal__heading {
  max-width: 720px;
}

.night-signal__label {
  margin: 0 0 16px;
  color: var(--rose-200);
  font: 800 0.76rem/1.2 ui-monospace, monospace;
  letter-spacing: 0.14em;
}

.night-signal__heading h2 {
  max-width: 15ch;
  margin: 0;
  color: var(--paper);
  font-size: clamp(2rem, 4.8vw, 4.5rem);
  line-height: 1.03;
  letter-spacing: -0.055em;
}

.night-signal__heading > p:last-child {
  max-width: 52ch;
  margin: 24px 0 0;
  color: #d8c4d2;
  line-height: 1.75;
}

.mailbox-zone {
  display: grid;
  justify-items: start;
  margin-top: 48px;
}

.mailbox-button {
  display: inline-flex;
  align-items: center;
  gap: 18px;
  min-height: 54px;
  padding: 0;
  color: var(--paper);
  background: transparent;
  border: 0;
  font: 800 0.84rem/1.3 ui-monospace, monospace;
  cursor: pointer;
}

.mailbox-button:focus-visible {
  outline: 4px solid var(--rose-200);
  outline-offset: 6px;
}

.mailbox-button__pixel {
  position: relative;
  width: 78px;
  height: 54px;
  background: var(--rose-500);
  border: 4px solid var(--paper);
  box-shadow: 7px 7px 0 #0d0b12;
  box-sizing: border-box;
  transition: transform 160ms steps(2, end), background 160ms steps(2, end);
}

.mailbox-button__pixel::after {
  content: '';
  position: absolute;
  left: 30px;
  top: 50px;
  width: 12px;
  height: 44px;
  background: #82627b;
  border-inline: 4px solid var(--paper);
}

.mailbox-button__flag {
  position: absolute;
  right: 8px;
  top: -25px;
  width: 12px;
  height: 24px;
  background: var(--rose-400);
  border: 4px solid var(--paper);
}

.mailbox-button__slot {
  position: absolute;
  left: 15px;
  top: 19px;
  width: 34px;
  height: 6px;
  background: var(--night-950);
}

.mailbox-button:is(:hover, .is-open) .mailbox-button__pixel {
  transform: translate(-3px, -4px);
  background: var(--rose-400);
}

.contact-form {
  display: grid;
  gap: 22px;
  width: min(100%, 620px);
  margin-top: 58px;
  padding: clamp(24px, 4vw, 40px);
  background: #33263e;
  border: 4px solid #c28ca7;
  box-shadow: 9px 9px 0 #0d0b12;
  box-sizing: border-box;
}

.field-group {
  display: grid;
  gap: 9px;
}

.field-group label {
  color: var(--paper);
  font-weight: 800;
}

.field-group :is(input, textarea) {
  width: 100%;
  padding: 13px 14px;
  color: var(--night-950);
  background: var(--paper);
  border: 4px solid #8f607b;
  border-radius: 0;
  box-sizing: border-box;
  font: inherit;
  resize: vertical;
}

.field-group :is(input, textarea)::placeholder {
  color: #765c6b;
  opacity: 1;
}

.field-group :is(input, textarea):focus {
  outline: 4px solid var(--rose-200);
  outline-offset: 3px;
  border-color: var(--night-950);
}

.field-group input[aria-invalid='true'] {
  border-color: #b93654;
}

.field-group :is(input, textarea):disabled {
  opacity: 0.74;
}

.field-group > p {
  margin: 0;
  color: #d8c4d2;
  font-size: 0.72rem;
  line-height: 1.5;
}

.form-actions {
  display: grid;
  gap: 14px;
  justify-items: start;
}

.submit-button {
  min-height: 50px;
  padding: 0 20px;
  color: var(--night-950);
  background: var(--rose-200);
  border: 4px solid var(--paper);
  box-shadow: 5px 5px 0 #0d0b12;
  font: 900 0.82rem/1.2 ui-monospace, monospace;
  cursor: pointer;
}

.submit-button:is(:hover, :focus-visible):not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 7px 7px 0 #0d0b12;
}

.submit-button:focus-visible {
  outline: 4px solid var(--rose-200);
  outline-offset: 5px;
}

.submit-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.submit-button--secondary {
  color: var(--paper);
  background: transparent;
}

.form-status {
  margin: 0;
  padding-left: 15px;
  border-left: 5px solid currentColor;
  font-size: 0.78rem;
  line-height: 1.55;
}

.form-status.is-loading {
  color: #f3d397;
}

.form-status.is-success {
  color: #b9d9ba;
}

.form-status.is-error {
  color: #ffb6c3;
}

.social-links {
  max-width: 680px;
  margin-top: 64px;
  padding-top: 28px;
  border-top: 3px dashed #705068;
}

.social-links > p {
  margin: 0 0 16px;
  color: #cdb5c6;
  font-size: 0.74rem;
}

.social-links ul {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.social-links a {
  display: grid;
  gap: 3px;
  min-width: 138px;
  padding: 12px 14px;
  color: var(--paper);
  background: #362a42;
  border: 3px solid #74506a;
  text-decoration: none;
}

.social-links a:is(:hover, :focus-visible) {
  color: var(--night-950);
  background: var(--rose-200);
  border-color: var(--paper);
}

.social-links a:focus-visible {
  outline: 4px solid var(--rose-200);
  outline-offset: 4px;
}

.social-links a span {
  font-weight: 900;
}

.social-links a small {
  font-size: 0.65rem;
  opacity: 0.8;
}

.night-scene {
  position: sticky;
  top: 0;
  min-height: 100dvh;
  overflow: hidden;
  background: linear-gradient(180deg, #251c35 0 54%, #343047 54% 58%, #24273c 58% 100%);
  image-rendering: pixelated;
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

.constellation-board {
  position: absolute;
  z-index: 5;
  top: 4%;
  right: 3%;
  left: 3%;
  height: 42%;
  border: 1px dashed rgb(241 191 208 / 14%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 3%);
}

.constellation-board::before,
.constellation-board::after {
  position: absolute;
  width: 9px;
  height: 9px;
  border-color: rgb(241 191 208 / 58%);
  content: '';
}

.constellation-board::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid;
  border-left: 2px solid;
}

.constellation-board::after {
  right: -1px;
  bottom: -1px;
  border-right: 2px solid;
  border-bottom: 2px solid;
}

.constellation-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  shape-rendering: crispEdges;
}

.constellation-lines polyline {
  fill: none;
  stroke: #ffd6e4;
  stroke-width: 3px;
  stroke-linecap: square;
  stroke-linejoin: miter;
  filter: drop-shadow(0 0 3px rgb(255 178 209 / 90%));
  animation: constellation-draw 260ms steps(4, end) both;
}

.constellation-star {
  position: absolute;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  color: #fff0c8;
  background: transparent;
  border: 0;
  transform: translate(-50%, -50%);
  cursor: pointer;
  touch-action: none;
}

.constellation-star > span {
  width: 8px;
  height: 8px;
  background: currentColor;
  box-shadow:
    0 0 0 3px rgb(255 240 200 / 10%),
    0 0 14px rgb(255 222 235 / 38%);
  transition: transform 150ms steps(3, end), box-shadow 150ms steps(3, end), color 150ms steps(3, end);
}

.constellation-star > small {
  position: absolute;
  top: 30px;
  left: 50%;
  min-width: 17px;
  padding: 2px 3px;
  color: #bfa8ba;
  background: rgb(29 24 40 / 82%);
  border: 1px solid #72516d;
  font: 800 0.56rem/1 ui-monospace, monospace;
  opacity: 0;
  transform: translateX(-50%);
  transition: opacity 120ms steps(2, end);
}

.constellation-star:is(:hover, :focus-visible) > small,
.constellation-star.is-selected > small {
  opacity: 1;
}

.constellation-star:is(:hover, :focus-visible) > span,
.constellation-star.is-next > span {
  color: #ffd6e4;
  transform: scale(1.45);
  box-shadow:
    0 0 0 4px rgb(255 214 228 / 14%),
    0 0 18px rgb(255 177 209 / 68%);
}

.constellation-star.is-selected > span {
  color: #fff7d6;
  transform: scale(1.65);
  box-shadow:
    0 0 0 4px rgb(255 240 200 / 18%),
    0 0 22px rgb(255 214 228 / 90%);
}

.constellation-star:focus-visible {
  outline: 3px solid var(--rose-200);
  outline-offset: 1px;
}

.constellation-console {
  position: absolute;
  z-index: 8;
  top: 43%;
  left: 5%;
  width: min(44%, 280px);
  padding: 11px 13px;
  color: #d8c4d2;
  background: rgb(29 24 40 / 86%);
  border: 2px solid #6b4865;
  box-shadow: 5px 5px 0 rgb(13 11 18 / 74%);
  backdrop-filter: blur(3px);
}

.constellation-console p {
  margin: 0;
  font-size: clamp(0.62rem, 0.9vw, 0.75rem);
  line-height: 1.45;
}

.constellation-console .constellation-console__eyebrow {
  margin-bottom: 6px;
  color: var(--rose-200);
  font: 900 0.62rem/1 ui-monospace, monospace;
  letter-spacing: 0.14em;
}

.constellation-console__feedback {
  margin-top: 7px !important;
  padding-top: 7px;
  color: #fff4f7;
  border-top: 1px dashed #76546f;
}

.constellation-console.is-error {
  border-color: #cc637c;
  animation: console-error 240ms steps(3, end) 2;
}

.constellation-console.is-complete {
  color: #fff2cf;
  border-color: #ffe1a8;
  box-shadow:
    5px 5px 0 rgb(13 11 18 / 74%),
    0 0 32px rgb(255 183 211 / 15%);
}

.moon {
  position: absolute;
  z-index: 1;
  top: 12%;
  right: 17%;
  width: 82px;
  aspect-ratio: 1;
  background: #ffe7b0;
  box-shadow: 0 0 0 9px rgb(255 231 176 / 12%);
}

.ambient-star {
  position: absolute;
  width: 7px;
  height: 7px;
  background: #fff0c8;
  box-shadow: 0 0 0 3px rgb(255 240 200 / 9%);
}

.ambient-star--one {
  top: 16%;
  left: 9%;
}

.ambient-star--two {
  top: 27%;
  left: 55%;
}

.ambient-star--three {
  top: 8%;
  left: 88%;
}

.mountain {
  position: absolute;
  right: -10%;
  left: -10%;
  clip-path: polygon(0 100%, 0 74%, 18% 32%, 31% 68%, 49% 20%, 65% 66%, 82% 38%, 100% 76%, 100% 100%);
}

.mountain--back {
  bottom: 40%;
  height: 45%;
  background: #4c3857;
}

.mountain--front {
  bottom: 34%;
  height: 36%;
  background: #392c43;
  transform: scaleX(1.18);
}

.lake {
  position: absolute;
  inset: 58% 0 0;
  overflow: hidden;
  background:
    repeating-linear-gradient(0deg, transparent 0 22px, rgb(227 180 205 / 8%) 22px 25px),
    #24273c;
}

.moon-reflection {
  position: absolute;
  top: 8%;
  right: 19%;
  width: 52px;
  height: 150px;
  background: linear-gradient(180deg, rgb(255 231 176 / 32%), transparent);
  clip-path: polygon(32% 0, 68% 0, 100% 100%, 0 100%);
}

.signal-reflection {
  position: absolute;
  top: 5%;
  left: 38%;
  width: 26%;
  height: 56%;
  opacity: 0;
  background:
    repeating-linear-gradient(0deg, rgb(255 202 222 / 0%) 0 10px, rgb(255 202 222 / 36%) 10px 13px),
    linear-gradient(180deg, rgb(255 221 232 / 32%), transparent 82%);
  clip-path: polygon(43% 0, 57% 0, 100% 100%, 0 100%);
  transform: scaleY(0.18);
  transform-origin: top;
}

.night-scene.has-constellation .signal-reflection {
  opacity: 1;
  transform: scaleY(1);
  animation: signal-reflection 2.4s steps(8, end) infinite;
}

.night-scene.has-constellation::after {
  position: absolute;
  z-index: 2;
  inset: 0;
  border: 8px solid rgb(255 208 225 / 0%);
  box-shadow: inset 0 0 70px rgb(255 167 205 / 0%);
  pointer-events: none;
  content: '';
  animation: night-discovery 1.8s steps(6, end) 1;
}

.lake-line {
  position: absolute;
  height: 5px;
  background: #8b6a88;
}

.lake-line--one {
  top: 28%;
  left: 12%;
  width: 25%;
}

.lake-line--two {
  top: 54%;
  right: 12%;
  width: 32%;
}

.sitting-figure {
  position: absolute;
  z-index: 3;
  left: 40%;
  bottom: 29%;
  width: 72px;
  height: 100px;
}

.sitting-figure__head {
  position: absolute;
  top: 0;
  left: 22px;
  width: 34px;
  height: 34px;
  background: #d79a8c;
  border: 5px solid #17121f;
  box-shadow: -9px -8px 0 1px #4a2c43;
}

.sitting-figure__body {
  position: absolute;
  left: 15px;
  bottom: 0;
  width: 46px;
  height: 62px;
  background: var(--rose-500);
  border: 5px solid #17121f;
  transform: skewX(-8deg);
}

.shore-flower {
  position: absolute;
  z-index: 4;
  bottom: 26%;
  width: 8px;
  height: 26px;
  background: #7d966e;
  box-shadow: -7px -8px 0 2px var(--rose-200), 7px -8px 0 2px var(--rose-400);
}

.shore-flower--one {
  left: 18%;
}

.shore-flower--two {
  left: 26%;
  transform: scale(0.8);
}

.shore-flower--three {
  right: 19%;
  transform: scale(1.1);
}

.ending-gate {
  position: absolute;
  z-index: 9;
  bottom: 6%;
  left: 5%;
  width: min(44%, 300px);
  color: #e2ccda;
  background: rgb(23 18 31 / 88%);
  border: 3px solid #67475f;
  box-shadow: 6px 6px 0 rgb(13 11 18 / 72%);
}

.ending-gate__progress {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 7px 12px;
  align-items: center;
  padding: 13px 14px;
  font: 800 0.7rem/1.25 ui-monospace, monospace;
}

.ending-gate__progress strong {
  color: #fff2cf;
  font-size: 0.9rem;
}

.ending-gate__dots {
  display: flex;
  grid-column: 1 / -1;
  gap: 7px;
}

.ending-gate__dots i {
  display: block;
  flex: 1;
  height: 5px;
  background: #594455;
  border: 1px solid #765970;
}

.ending-gate__dots i.is-lit {
  background: #ffc5da;
  border-color: #fff2cf;
  box-shadow: 0 0 9px rgb(255 197 218 / 46%);
}

.ending-gate__button {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 14px 15px;
  color: #241927;
  background: #ffc8dc;
  border: 0;
  text-align: left;
  cursor: pointer;
  transition: transform 150ms steps(3, end), background 150ms steps(3, end);
}

.ending-gate__button span {
  font: 800 0.62rem/1.2 ui-monospace, monospace;
  letter-spacing: 0.05em;
  opacity: 0.78;
}

.ending-gate__button strong {
  font-size: clamp(0.76rem, 1.1vw, 0.92rem);
  line-height: 1.3;
}

.ending-gate__button:is(:hover, :focus-visible) {
  color: #fff4f7;
  background: #b84f79;
  transform: translate(-3px, -3px);
}

.ending-gate__button:focus-visible {
  outline: 4px solid #fff2cf;
  outline-offset: 4px;
}

.ending-gate.is-ready {
  border-color: #fff0c8;
  box-shadow:
    6px 6px 0 rgb(13 11 18 / 72%),
    0 0 24px rgb(255 199 220 / 24%);
}

.night-scene__caption {
  position: absolute;
  right: 8%;
  bottom: 8%;
  margin: 0;
  color: var(--paper);
  font-size: clamp(1.25rem, 2.8vw, 2.3rem);
  font-weight: 800;
  line-height: 1.35;
  text-align: right;
  text-shadow: 3px 3px 0 #17121f;
}

@keyframes constellation-draw {
  from {
    opacity: 0;
    stroke-dasharray: 3 6;
  }
  to {
    opacity: 1;
    stroke-dasharray: 100 0;
  }
}

@keyframes console-error {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(5px);
  }
}

@keyframes night-discovery {
  0% {
    border-color: rgb(255 208 225 / 0%);
    box-shadow: inset 0 0 70px rgb(255 167 205 / 0%);
  }
  42% {
    border-color: rgb(255 208 225 / 32%);
    box-shadow: inset 0 0 70px rgb(255 167 205 / 38%);
  }
  100% {
    border-color: rgb(255 208 225 / 0%);
    box-shadow: inset 0 0 70px rgb(255 167 205 / 0%);
  }
}

@keyframes signal-reflection {
  0%,
  100% {
    opacity: 0.62;
    transform: scaleX(0.92);
  }
  50% {
    opacity: 1;
    transform: scaleX(1.08);
  }
}

.mailbox-enter-active,
.mailbox-leave-active {
  transition: opacity 180ms steps(2, end), transform 180ms steps(2, end);
}

.mailbox-enter-from,
.mailbox-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

@media (max-width: 900px) {
  .night-signal {
    display: flex;
    flex-direction: column;
  }

  .night-signal__content {
    border-right: 0;
    border-bottom: 4px solid #6b415b;
  }

  .night-scene {
    position: relative;
    min-height: 620px;
    order: 2;
  }

  .constellation-console {
    width: min(46%, 290px);
  }
}

@media (max-width: 620px) {
  .night-signal__content {
    padding: 68px 20px 92px;
  }

  .contact-form {
    margin-top: 56px;
    padding: 24px 18px;
    box-shadow: 6px 6px 0 #0d0b12;
  }

  .social-links ul {
    display: grid;
    grid-template-columns: 1fr;
  }

  .night-scene {
    min-height: 660px;
  }

  .constellation-board {
    top: 3%;
    right: 2%;
    left: 2%;
    height: 36%;
  }

  .constellation-console {
    top: 37%;
    left: 18px;
    width: calc(100% - 36px);
    box-sizing: border-box;
  }

  .ending-gate {
    right: 18px;
    bottom: 24px;
    left: 18px;
    width: auto;
  }

  .night-scene__caption {
    right: 20px;
    bottom: 132px;
    font-size: 1.15rem;
  }

  .sitting-figure {
    left: 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mailbox-button__pixel,
  .mailbox-enter-active,
  .mailbox-leave-active,
  .constellation-star > span,
  .constellation-star > small,
  .ending-gate__button {
    transition: none;
  }

  .constellation-lines polyline,
  .constellation-console.is-error,
  .night-scene.has-constellation .signal-reflection,
  .night-scene.has-constellation::after {
    animation: none;
  }

  .night-scene.has-constellation .signal-reflection {
    opacity: 0.82;
    transform: scaleY(1);
  }
}
</style>
