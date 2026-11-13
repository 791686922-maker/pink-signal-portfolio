<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { useFarmWorld } from '../composables/useFarmWorld'

interface Props {
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  complete: []
}>()

const { state, completeEnding } = useFarmWorld()

const stage = ref(0)
const reducedMotion = ref(false)
const controlButton = ref<HTMLButtonElement | null>(null)
const timers: Array<ReturnType<typeof setTimeout>> = []
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
let completedThisRun = false

const stageMessages = [
  '农场正在关闭普通照明。',
  '三朵特殊花已经醒来。',
  '花圃信号正在返回山顶。',
  '温室、工具房与文章小径依次接通。',
  '夜空正在记住这次访问。',
  '三段信号正在合成最后一朵花。',
  '零点广播已经送达。',
] as const

const currentMessage = computed(() => stageMessages[stage.value] ?? stageMessages[0])

const visitorCode = computed(() => {
  const source = `${state.lastVisitDate}:${state.caughtPetals}:${state.towerBands.join('.')}`
  let hash = 17
  for (const character of source) hash = (hash * 31 + character.charCodeAt(0)) % 65535
  const day = state.lastVisitDate.replaceAll('-', '').slice(4)
  return `PSF-${day}-${hash.toString(16).toUpperCase().padStart(4, '0')}`
})

function clearTimers() {
  while (timers.length) {
    const timer = timers.pop()
    if (timer) window.clearTimeout(timer)
  }
}

function schedule(nextStage: number, delay: number, finish = false) {
  timers.push(
    window.setTimeout(() => {
      stage.value = nextStage
      if (finish) finishShow()
    }, delay),
  )
}

function finishShow() {
  if (completedThisRun) return
  completedThisRun = true
  completeEnding()
  emit('complete')
}

async function startShow() {
  if (typeof window === 'undefined') return

  clearTimers()
  stage.value = 0
  completedThisRun = false
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  await nextTick()
  controlButton.value?.focus()

  if (reducedMotion.value) {
    schedule(1, 300)
    schedule(3, 900)
    schedule(5, 1500)
    schedule(6, 2100, true)
    return
  }

  schedule(1, 900)
  schedule(2, 2200)
  schedule(3, 3500)
  schedule(4, 5000)
  schedule(5, 6600)
  schedule(6, 8600, true)
}

function restoreDocument() {
  if (typeof document === 'undefined') return
  document.body.style.overflow = previousOverflow
}

function skipShow() {
  clearTimers()
  stage.value = 6
  finishShow()
}

function requestClose() {
  clearTimers()
  restoreDocument()
  emit('close')
  nextTick(() => previousFocus?.focus())
}

function handleControl() {
  if (stage.value < 6) {
    skipShow()
    return
  }
  requestClose()
}

function handleEscape() {
  requestClose()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      startShow()
      return
    }
    clearTimers()
    restoreDocument()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearTimers()
  restoreDocument()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="broadcast-overlay">
      <section
        v-if="open"
        class="zero-broadcast"
        :class="{ 'is-reduced': reducedMotion, 'is-final': stage >= 6 }"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zero-broadcast-title"
        @keydown.esc="handleEscape"
      >
        <button ref="controlButton" type="button" class="broadcast-control" @click="handleControl">
          {{ stage < 6 ? '跳过演出' : '关闭广播' }}
        </button>

        <p class="broadcast-status" aria-live="polite">{{ currentMessage }}</p>

        <div class="broadcast-scene" aria-hidden="true">
          <div class="night-grid" />

          <div class="broadcast-stars">
            <i v-for="star in 18" :key="star" />
          </div>

          <div class="broadcast-moon" :class="{ 'is-awake': stage >= 4 }">
            <i />
          </div>

          <div class="far-hills" />
          <div class="near-hills" />

          <div class="farm-silhouette">
            <div class="farm-house">
              <span class="roof" />
              <span class="wall" />
              <i v-for="window in 4" :key="window" :class="{ 'is-on': stage >= 3 }" />
            </div>

            <div class="final-tower" :class="{ 'is-on': stage >= 2 }">
              <span />
              <i /><i /><i />
            </div>

            <div class="signal-flowers" :class="{ 'is-on': stage >= 1 }">
              <span v-for="flower in 3" :key="flower"><i /><b /></span>
            </div>
          </div>

          <div class="returning-signal" :class="{ 'is-on': stage >= 2 }">
            <span v-for="node in 12" :key="node" />
          </div>

          <div class="constellation" :class="{ 'is-on': stage >= 4 }">
            <span v-for="point in 9" :key="point" />
            <i class="line line-one" />
            <i class="line line-two" />
            <i class="line line-three" />
            <i class="line line-four" />
          </div>

          <div class="zero-flower" :class="{ 'is-on': stage >= 5 }">
            <span class="zero-flower__petal petal-one" />
            <span class="zero-flower__petal petal-two" />
            <span class="zero-flower__petal petal-three" />
            <span class="zero-flower__petal petal-four" />
            <span class="zero-flower__petal petal-five" />
            <i />
          </div>

          <div class="signal-sparks" :class="{ 'is-on': stage >= 5 }">
            <i v-for="spark in 16" :key="spark" />
          </div>
        </div>

        <div class="broadcast-progress" aria-hidden="true">
          <span v-for="step in 7" :key="step" :class="{ 'is-on': stage >= step - 1 }" />
        </div>

        <Transition name="final-message">
          <div v-if="stage >= 6" class="final-message">
            <p>ZERO BROADCAST RECEIVED</p>
            <h2 id="zero-broadcast-title">你不是逛完了这个网页。</h2>
            <strong>你让整座农场重新开机了。</strong>
            <div class="visitor-code">
              <span>本次访问信号</span>
              <code>{{ visitorCode }}</code>
            </div>
            <button type="button" @click="requestClose">收下这段广播</button>
          </div>
        </Transition>

        <h2 v-if="stage < 6" id="zero-broadcast-title" class="sr-only">零点广播终局演出</h2>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.zero-broadcast {
  position: fixed;
  z-index: 300;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #fff4f8;
  background: #120d1b;
  font-family: var(--font-pixel, ui-monospace, monospace);
  isolation: isolate;
}

.broadcast-control {
  position: fixed;
  z-index: 30;
  top: 20px;
  right: 20px;
  min-height: 42px;
  padding: 8px 12px;
  border: 3px solid #f8d5e4;
  color: #f8d5e4;
  background: #2f203b;
  box-shadow: 4px 4px 0 #08060d;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.broadcast-control:hover,
.broadcast-control:focus-visible,
.final-message button:hover,
.final-message button:focus-visible {
  color: #28172c;
  background: #ffd2e2;
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #08060d;
}

.broadcast-control:focus-visible,
.final-message button:focus-visible {
  outline: 4px solid #fff1a9;
  outline-offset: 4px;
}

.broadcast-status {
  position: fixed;
  z-index: 25;
  left: 22px;
  bottom: 22px;
  max-width: min(48ch, calc(100% - 44px));
  margin: 0;
  padding: 10px 12px;
  border-left: 5px solid #ee7daa;
  color: #e5cbd9;
  background: rgb(18 13 27 / 74%);
  font-size: 10px;
  line-height: 1.6;
}

.broadcast-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(180deg, #171127 0 57%, #2d263f 57% 63%, #171827 63% 100%);
  image-rendering: pixelated;
}

.night-grid {
  position: absolute;
  inset: 0;
  opacity: 0.12;
  background:
    linear-gradient(90deg, #f3c5dc 1px, transparent 1px) 0 0 / 24px 24px,
    linear-gradient(#f3c5dc 1px, transparent 1px) 0 0 / 24px 24px;
  animation: grid-breathe 2.4s steps(4, end) infinite alternate;
}

.broadcast-stars i {
  position: absolute;
  width: 5px;
  height: 5px;
  background: #f8e7bb;
  box-shadow: 0 0 0 3px rgb(248 231 187 / 8%);
}

.broadcast-stars i:nth-child(1) { top: 12%; left: 8%; }
.broadcast-stars i:nth-child(2) { top: 24%; left: 14%; }
.broadcast-stars i:nth-child(3) { top: 8%; left: 22%; }
.broadcast-stars i:nth-child(4) { top: 31%; left: 29%; }
.broadcast-stars i:nth-child(5) { top: 17%; left: 36%; }
.broadcast-stars i:nth-child(6) { top: 7%; left: 45%; }
.broadcast-stars i:nth-child(7) { top: 27%; left: 52%; }
.broadcast-stars i:nth-child(8) { top: 14%; left: 59%; }
.broadcast-stars i:nth-child(9) { top: 34%; left: 66%; }
.broadcast-stars i:nth-child(10) { top: 9%; left: 72%; }
.broadcast-stars i:nth-child(11) { top: 22%; left: 81%; }
.broadcast-stars i:nth-child(12) { top: 15%; left: 91%; }
.broadcast-stars i:nth-child(13) { top: 40%; left: 6%; }
.broadcast-stars i:nth-child(14) { top: 42%; left: 21%; }
.broadcast-stars i:nth-child(15) { top: 37%; left: 42%; }
.broadcast-stars i:nth-child(16) { top: 44%; left: 57%; }
.broadcast-stars i:nth-child(17) { top: 39%; left: 78%; }
.broadcast-stars i:nth-child(18) { top: 46%; left: 94%; }

.broadcast-moon {
  position: absolute;
  top: 11%;
  right: 13%;
  width: clamp(64px, 8vw, 110px);
  aspect-ratio: 1;
  background: #baa9b6;
  box-shadow: 0 0 0 12px rgb(255 224 169 / 5%);
  transition: background 500ms steps(4, end), box-shadow 500ms steps(4, end);
}

.broadcast-moon i {
  position: absolute;
  top: 18%;
  right: 16%;
  width: 16%;
  height: 16%;
  background: rgb(64 44 72 / 22%);
  box-shadow: -220% 160% 0 rgb(64 44 72 / 18%), -30% 310% 0 rgb(64 44 72 / 16%);
}

.broadcast-moon.is-awake {
  background: #ffe0a9;
  box-shadow: 0 0 0 18px rgb(255 224 169 / 12%), 0 0 70px rgb(255 207 147 / 30%);
}

.far-hills,
.near-hills {
  position: absolute;
  right: -5%;
  left: -5%;
  clip-path: polygon(0 100%, 0 72%, 12% 38%, 24% 69%, 38% 22%, 53% 67%, 67% 33%, 79% 72%, 91% 28%, 100% 64%, 100% 100%);
}

.far-hills {
  bottom: 31%;
  height: 45%;
  background: #3d2d4d;
}

.near-hills {
  bottom: 23%;
  height: 36%;
  background: #261d33;
  transform: scaleX(1.12);
}

.farm-silhouette {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 38%;
  background: #15131f;
}

.farm-house {
  position: absolute;
  left: 18%;
  bottom: 22%;
  width: clamp(160px, 22vw, 340px);
  height: clamp(90px, 13vw, 185px);
}

.farm-house .roof {
  position: absolute;
  inset: 0 0 48% 0;
  background: #5e334e;
  clip-path: polygon(0 100%, 18% 20%, 78% 20%, 100% 100%);
}

.farm-house .wall {
  position: absolute;
  right: 9%;
  bottom: 0;
  left: 9%;
  height: 54%;
  background: #2e2130;
}

.farm-house i {
  position: absolute;
  z-index: 2;
  bottom: 18%;
  width: 9%;
  aspect-ratio: 1;
  border: 3px solid #130e18;
  background: #3a293a;
  transition: background 260ms steps(3, end), box-shadow 260ms steps(3, end);
}

.farm-house i:nth-of-type(1) { left: 17%; }
.farm-house i:nth-of-type(2) { left: 38%; }
.farm-house i:nth-of-type(3) { right: 34%; }
.farm-house i:nth-of-type(4) { right: 15%; }

.farm-house i.is-on {
  background: #ffd17e;
  box-shadow: 0 0 12px #ffd17e;
}

.final-tower {
  position: absolute;
  right: 21%;
  bottom: 18%;
  width: 86px;
  height: clamp(160px, 24vw, 300px);
}

.final-tower > span {
  position: absolute;
  top: 22px;
  left: 39px;
  width: 8px;
  height: calc(100% - 22px);
  background: #8a5c77;
  box-shadow: -25px calc(100% - 24px) 0 6px #0a0810, 25px calc(100% - 24px) 0 6px #0a0810;
}

.final-tower > i {
  position: absolute;
  border: 5px solid transparent;
  border-top-color: #6f5266;
  border-radius: 50%;
  opacity: 0.38;
  transform: rotate(-25deg);
}

.final-tower > i:nth-of-type(1) { top: 3px; left: 25px; width: 28px; height: 28px; }
.final-tower > i:nth-of-type(2) { top: -12px; left: 10px; width: 58px; height: 58px; }
.final-tower > i:nth-of-type(3) { top: -27px; left: -5px; width: 88px; height: 88px; }

.final-tower.is-on > i {
  border-top-color: #fff2ae;
  opacity: 1;
  filter: drop-shadow(0 0 5px #fff2ae);
  animation: tower-pulse 900ms steps(4, end) infinite alternate;
}

.signal-flowers {
  position: absolute;
  left: 45%;
  bottom: 16%;
  display: flex;
  gap: clamp(22px, 3vw, 48px);
  opacity: 0.22;
  transform: translateY(16px);
  transition: opacity 320ms steps(4, end), transform 320ms steps(4, end);
}

.signal-flowers.is-on {
  opacity: 1;
  transform: translateY(0);
}

.signal-flowers > span {
  position: relative;
  width: 12px;
  height: clamp(50px, 7vw, 90px);
  background: #6f9a73;
}

.signal-flowers span i,
.signal-flowers span b {
  position: absolute;
  top: -12px;
  width: 22px;
  height: 22px;
  background: #f47cab;
  box-shadow: 0 -15px 0 #ffb5d0, 0 15px 0 #dc5d92;
}

.signal-flowers span i { left: -18px; }
.signal-flowers span b { right: -18px; transform: rotate(90deg); }

.signal-flowers > span:nth-child(2) :is(i, b) { background: #ffd075; }
.signal-flowers > span:nth-child(3) :is(i, b) { background: #b5cfff; }

.returning-signal {
  position: absolute;
  z-index: 8;
  right: 22%;
  bottom: 32%;
  left: 47%;
  height: 5px;
  opacity: 0;
  background: #ffdd8c;
  box-shadow: 0 0 14px #ffbcda;
}

.returning-signal.is-on {
  opacity: 1;
  animation: signal-return 820ms steps(10, end) both;
}

.returning-signal span {
  position: absolute;
  top: -4px;
  width: 12px;
  height: 12px;
  background: #ff91bd;
}

.returning-signal span:nth-child(1) { left: 1%; }
.returning-signal span:nth-child(2) { left: 9%; }
.returning-signal span:nth-child(3) { left: 17%; }
.returning-signal span:nth-child(4) { left: 25%; }
.returning-signal span:nth-child(5) { left: 33%; }
.returning-signal span:nth-child(6) { left: 41%; }
.returning-signal span:nth-child(7) { left: 49%; }
.returning-signal span:nth-child(8) { left: 57%; }
.returning-signal span:nth-child(9) { left: 65%; }
.returning-signal span:nth-child(10) { left: 73%; }
.returning-signal span:nth-child(11) { left: 81%; }
.returning-signal span:nth-child(12) { left: 89%; }

.constellation {
  position: absolute;
  z-index: 10;
  top: 12%;
  left: 50%;
  width: min(34vw, 470px);
  height: min(28vw, 330px);
  opacity: 0;
  transform: translateX(-50%);
  transition: opacity 500ms steps(5, end);
}

.constellation.is-on {
  opacity: 1;
}

.constellation span {
  position: absolute;
  width: 9px;
  height: 9px;
  background: #fff1ad;
  box-shadow: 0 0 12px #fff1ad;
}

.constellation span:nth-child(1) { top: 50%; left: 4%; }
.constellation span:nth-child(2) { top: 20%; left: 18%; }
.constellation span:nth-child(3) { top: 72%; left: 27%; }
.constellation span:nth-child(4) { top: 35%; left: 40%; }
.constellation span:nth-child(5) { top: 62%; left: 52%; }
.constellation span:nth-child(6) { top: 18%; left: 63%; }
.constellation span:nth-child(7) { top: 48%; left: 75%; }
.constellation span:nth-child(8) { top: 28%; left: 89%; }
.constellation span:nth-child(9) { top: 78%; left: 96%; }

.constellation .line {
  position: absolute;
  height: 3px;
  background: #f4abc8;
  box-shadow: 0 0 8px #f4abc8;
  transform-origin: left center;
}

.line-one { top: 51%; left: 4%; width: 38%; transform: rotate(-28deg); }
.line-two { top: 35%; left: 40%; width: 28%; transform: rotate(30deg); }
.line-three { top: 62%; left: 52%; width: 30%; transform: rotate(-35deg); }
.line-four { top: 48%; left: 75%; width: 28%; transform: rotate(34deg); }

.zero-flower {
  position: absolute;
  z-index: 14;
  top: 45%;
  left: 50%;
  width: clamp(130px, 18vw, 250px);
  aspect-ratio: 1;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.2) rotate(-20deg);
}

.zero-flower.is-on {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1) rotate(0);
  transition: opacity 500ms steps(5, end), transform 1.2s steps(8, end);
}

.zero-flower__petal {
  position: absolute;
  top: 34%;
  left: 34%;
  width: 32%;
  height: 32%;
  background: #f47cad;
  box-shadow: inset -8px -8px 0 #cf4d84, 0 0 24px rgb(244 124 173 / 48%);
}

.petal-one { transform: translateY(-92%); }
.petal-two { transform: translate(88%, -22%) rotate(72deg); }
.petal-three { transform: translate(55%, 76%) rotate(144deg); }
.petal-four { transform: translate(-55%, 76%) rotate(216deg); }
.petal-five { transform: translate(-88%, -22%) rotate(288deg); }

.zero-flower > i {
  position: absolute;
  z-index: 2;
  top: 38%;
  left: 38%;
  width: 24%;
  height: 24%;
  background: #ffe18c;
  box-shadow: 0 0 20px #ffe18c;
}

.signal-sparks {
  position: absolute;
  z-index: 13;
  inset: 0;
  opacity: 0;
}

.signal-sparks.is-on {
  opacity: 1;
}

.signal-sparks i {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7px;
  height: 7px;
  background: #ffd276;
  animation: spark-out 1.6s steps(8, end) infinite;
}

.signal-sparks i:nth-child(1) { --x: -37vw; --y: -30vh; animation-delay: 0ms; }
.signal-sparks i:nth-child(2) { --x: -24vw; --y: -38vh; animation-delay: 100ms; }
.signal-sparks i:nth-child(3) { --x: -8vw; --y: -33vh; animation-delay: 200ms; }
.signal-sparks i:nth-child(4) { --x: 12vw; --y: -36vh; animation-delay: 300ms; }
.signal-sparks i:nth-child(5) { --x: 29vw; --y: -27vh; animation-delay: 400ms; }
.signal-sparks i:nth-child(6) { --x: 39vw; --y: -12vh; animation-delay: 500ms; }
.signal-sparks i:nth-child(7) { --x: 38vw; --y: 12vh; animation-delay: 600ms; }
.signal-sparks i:nth-child(8) { --x: 27vw; --y: 31vh; animation-delay: 700ms; }
.signal-sparks i:nth-child(9) { --x: 10vw; --y: 38vh; animation-delay: 800ms; }
.signal-sparks i:nth-child(10) { --x: -9vw; --y: 37vh; animation-delay: 900ms; }
.signal-sparks i:nth-child(11) { --x: -27vw; --y: 30vh; animation-delay: 1000ms; }
.signal-sparks i:nth-child(12) { --x: -39vw; --y: 11vh; animation-delay: 1100ms; }
.signal-sparks i:nth-child(13) { --x: -33vw; --y: -13vh; animation-delay: 1200ms; }
.signal-sparks i:nth-child(14) { --x: 21vw; --y: 18vh; animation-delay: 1300ms; }
.signal-sparks i:nth-child(15) { --x: 17vw; --y: -16vh; animation-delay: 1400ms; }
.signal-sparks i:nth-child(16) { --x: -17vw; --y: 18vh; animation-delay: 1500ms; }

.broadcast-progress {
  position: fixed;
  z-index: 24;
  top: 24px;
  left: 22px;
  display: flex;
  gap: 6px;
}

.broadcast-progress span {
  width: clamp(18px, 3vw, 42px);
  height: 6px;
  background: #443149;
  transition: background 180ms steps(2, end), box-shadow 180ms steps(2, end);
}

.broadcast-progress span.is-on {
  background: #ee7daa;
  box-shadow: 0 0 8px #ee7daa;
}

.final-message {
  position: relative;
  z-index: 20;
  width: min(720px, calc(100% - 40px));
  padding: clamp(28px, 6vw, 64px);
  border: 5px solid #ffe5ef;
  color: #fff5f8;
  background: rgb(27 17 36 / 90%);
  box-shadow: 12px 12px 0 #08060d, inset 0 0 0 6px rgb(239 124 171 / 20%);
  box-sizing: border-box;
  text-align: center;
}

.final-message > p {
  margin: 0 0 20px;
  color: #ef8cb3;
  font-size: clamp(9px, 1.2vw, 12px);
  letter-spacing: 0.15em;
}

.final-message h2 {
  max-width: 13ch;
  margin: 0 auto;
  font-size: clamp(2rem, 6vw, 5.4rem);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.05em;
  text-wrap: balance;
}

.final-message > strong {
  display: block;
  margin-top: 18px;
  color: #ffe09b;
  font-size: clamp(1rem, 2vw, 1.55rem);
  line-height: 1.5;
}

.visitor-code {
  display: grid;
  width: fit-content;
  gap: 7px;
  margin: 28px auto 0;
  padding: 12px 16px;
  border: 3px solid #8c5f7a;
  background: #22182b;
}

.visitor-code span {
  color: #bfa5b5;
  font-size: 9px;
}

.visitor-code code {
  color: #ffd987;
  font: inherit;
  font-size: 12px;
}

.final-message button {
  min-height: 48px;
  margin-top: 26px;
  padding: 10px 16px;
  border: 4px solid #fff0f6;
  color: #2b1b32;
  background: #f2a4c3;
  box-shadow: 5px 5px 0 #08060d;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.broadcast-overlay-enter-active,
.broadcast-overlay-leave-active {
  transition: opacity 220ms steps(4, end);
}

.broadcast-overlay-enter-from,
.broadcast-overlay-leave-to {
  opacity: 0;
}

.final-message-enter-active {
  transition: opacity 360ms steps(5, end), transform 500ms steps(6, end);
}

.final-message-enter-from {
  opacity: 0;
  transform: scale(0.82);
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

@keyframes grid-breathe {
  to { opacity: 0.2; }
}

@keyframes tower-pulse {
  to { filter: drop-shadow(0 0 12px #fff2ae); }
}

@keyframes signal-return {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}

@keyframes spark-out {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0);
  }
  22% { opacity: 1; }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(1);
  }
}

@media (max-width: 700px) {
  .broadcast-control {
    top: 14px;
    right: 14px;
  }

  .broadcast-progress {
    top: 18px;
    left: 14px;
    gap: 4px;
  }

  .broadcast-progress span {
    width: 15px;
    height: 5px;
  }

  .broadcast-status {
    right: 14px;
    bottom: 14px;
    left: 14px;
  }

  .farm-house {
    left: 5%;
  }

  .final-tower {
    right: 8%;
  }

  .signal-flowers {
    left: 41%;
  }

  .returning-signal {
    right: 11%;
    left: 44%;
  }

  .constellation {
    top: 19%;
    width: 78vw;
    height: 45vw;
  }

  .final-message {
    padding: 30px 22px;
    box-shadow: 7px 7px 0 #08060d;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zero-broadcast *,
  .zero-broadcast *::before,
  .zero-broadcast *::after {
    scroll-behavior: auto !important;
    animation: none !important;
    transition: none !important;
  }
}
</style>
