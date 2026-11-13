<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

type WorldPhase = 'dawn' | 'day' | 'sunset' | 'night'
type StreamTapDetail = { kind: 'short' | 'long' }

interface Props {
  signalLevel?: number
  worldPhase?: WorldPhase
  catTrust?: number
  towerTuned?: boolean
  atticOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  signalLevel: 3,
  worldPhase: 'day',
  catTrust: 0,
  towerTuned: false,
  atticOpen: false,
})

const emit = defineEmits<{
  'shake-tree': []
  'cat-pet': []
  'stream-tap': [detail: StreamTapDetail]
  'door-open': []
  'tower-tune': [value: number]
  'phase-change': [phase: WorldPhase]
}>()

const isShaking = ref(false)
const isCatPurring = ref(false)
const isDoorOpen = ref(false)
const streamPulse = ref<StreamTapDetail['kind'] | null>(null)
const isPhaseShifting = ref(false)
const localPhase = ref<WorldPhase>(props.worldPhase)
const towerValue = ref(Math.max(0, Math.min(100, Math.round(props.signalLevel * 25))))
let shakeTimer: number | undefined
let shakeFrame: number | undefined
let catTimer: number | undefined
let streamPulseTimer: number | undefined
let streamLongTimer: number | undefined
let phaseShiftTimer: number | undefined
let streamPointerId: number | undefined
let streamLongFired = false
let suppressNextStreamClick = false

const PHASES: WorldPhase[] = ['dawn', 'day', 'sunset', 'night']
const PHASE_LABELS: Record<WorldPhase, string> = {
  dawn: '清晨',
  day: '白天',
  sunset: '黄昏',
  night: '夜晚',
}

const safeSignalLevel = computed(() => {
  const level = Number.isFinite(props.signalLevel) ? props.signalLevel : 0
  return Math.max(0, Math.min(4, Math.round(level)))
})

const displayedSignalLevel = computed(() => {
  if (!props.towerTuned) return safeSignalLevel.value
  return Math.max(safeSignalLevel.value, Math.min(4, Math.ceil(towerValue.value / 25)))
})

const catTrustLevel = computed(() => {
  const trust = Number.isFinite(props.catTrust) ? Math.max(0, props.catTrust) : 0
  return Math.min(3, Math.round(trust <= 3 ? trust : trust / 34))
})

const phaseButtonLabel = computed(
  () => `切换农场时间，现在是${PHASE_LABELS[localPhase.value]}`,
)

watch(
  () => props.worldPhase,
  (phase) => {
    localPhase.value = phase
  },
)

watch(
  () => props.signalLevel,
  (level) => {
    if (!props.towerTuned) {
      towerValue.value = Math.max(0, Math.min(100, Math.round(level * 25)))
    }
  },
)

function shakeTree() {
  if (shakeTimer) window.clearTimeout(shakeTimer)
  if (shakeFrame) window.cancelAnimationFrame(shakeFrame)
  isShaking.value = false
  shakeFrame = window.requestAnimationFrame(() => {
    isShaking.value = true
    shakeFrame = undefined
  })
  emit('shake-tree')
  shakeTimer = window.setTimeout(() => {
    isShaking.value = false
  }, 620)
}

function petCat() {
  window.clearTimeout(catTimer)
  isCatPurring.value = false
  window.requestAnimationFrame(() => {
    isCatPurring.value = true
  })
  emit('cat-pet')
  catTimer = window.setTimeout(() => {
    isCatPurring.value = false
  }, 720)
}

function openDoor() {
  isDoorOpen.value = !isDoorOpen.value
  emit('door-open')
}

function tuneTower(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  towerValue.value = Math.max(0, Math.min(100, Number(input.value)))
  emit('tower-tune', towerValue.value)
}

function cyclePhase() {
  const currentIndex = PHASES.indexOf(localPhase.value)
  const nextPhase = PHASES[(currentIndex + 1) % PHASES.length] ?? 'day'
  window.clearTimeout(phaseShiftTimer)
  isPhaseShifting.value = false
  window.requestAnimationFrame(() => {
    isPhaseShifting.value = true
  })
  phaseShiftTimer = window.setTimeout(() => {
    isPhaseShifting.value = false
  }, 640)
  localPhase.value = nextPhase
  emit('phase-change', nextPhase)
}

function triggerStream(kind: StreamTapDetail['kind']) {
  window.clearTimeout(streamPulseTimer)
  streamPulse.value = kind
  emit('stream-tap', { kind })
  streamPulseTimer = window.setTimeout(() => {
    streamPulse.value = null
  }, kind === 'long' ? 920 : 520)
}

function beginStreamPress(event: PointerEvent) {
  if (!event.isPrimary) return
  streamPointerId = event.pointerId
  streamLongFired = false

  const target = event.currentTarget as HTMLButtonElement
  try {
    target.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture is an enhancement. Native button activation still works without it.
  }

  window.clearTimeout(streamLongTimer)
  streamLongTimer = window.setTimeout(() => {
    if (streamPointerId !== event.pointerId) return
    streamLongFired = true
    triggerStream('long')
  }, 560)
}

function endStreamPress(event: PointerEvent) {
  if (streamPointerId !== event.pointerId) return
  window.clearTimeout(streamLongTimer)

  if (!streamLongFired) triggerStream('short')
  suppressNextStreamClick = true
  streamPointerId = undefined

  const target = event.currentTarget as HTMLButtonElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
}

function cancelStreamPress(event: PointerEvent) {
  if (streamPointerId !== event.pointerId) return
  window.clearTimeout(streamLongTimer)
  streamPointerId = undefined
  streamLongFired = false
}

function activateStream() {
  if (suppressNextStreamClick) {
    suppressNextStreamClick = false
    return
  }
  triggerStream('short')
}

onBeforeUnmount(() => {
  if (shakeTimer) window.clearTimeout(shakeTimer)
  if (shakeFrame) window.cancelAnimationFrame(shakeFrame)
  window.clearTimeout(catTimer)
  window.clearTimeout(streamPulseTimer)
  window.clearTimeout(streamLongTimer)
  window.clearTimeout(phaseShiftTimer)
})
</script>

<template>
  <section class="pixel-farm" aria-label="粉色信号农场像素场景">
    <div
      class="scene-frame"
      :class="[`phase-${localPhase}`, { 'is-attic-open': atticOpen, 'is-phase-shifting': isPhaseShifting }]"
      :data-world-phase="localPhase"
    >
      <div class="phase-signal" aria-hidden="true" />
      <div class="sky">
        <button
          type="button"
          class="sun"
          :aria-label="phaseButtonLabel"
          data-pixel-magnet="phase"
          @click="cyclePhase"
        >
          <span aria-hidden="true"></span><span aria-hidden="true"></span>
          <span aria-hidden="true"></span><span aria-hidden="true"></span>
        </button>

        <div class="cloud cloud-one" aria-hidden="true"><i></i></div>
        <div class="cloud cloud-two" aria-hidden="true"><i></i></div>

        <div class="mountain mountain-far" aria-hidden="true"></div>
        <div class="mountain mountain-near" aria-hidden="true"></div>
      </div>

      <div class="ground" aria-hidden="true">
        <div class="field-row row-one"></div>
        <div class="field-row row-two"></div>
        <div class="field-row row-three"></div>
        <div class="path"></div>
        <div class="grass-patch grass-a"></div>
        <div class="grass-patch grass-b"></div>
        <div class="grass-patch grass-c"></div>
        <div class="wildflower flower-a"><i></i><i></i><i></i></div>
        <div class="wildflower flower-b"><i></i><i></i><i></i></div>
        <div class="wildflower flower-c"><i></i><i></i><i></i></div>
      </div>

      <div class="greenhouse" aria-hidden="true">
        <div class="greenhouse-roof">
          <span class="roof-pane pane-a"></span>
          <span class="roof-pane pane-b"></span>
          <span class="roof-pane pane-c"></span>
        </div>
        <div class="greenhouse-body">
          <span class="glass-line glass-one"></span>
          <span class="glass-line glass-two"></span>
          <span class="glass-line glass-three"></span>
          <div class="greenhouse-door"><i></i></div>
          <div class="plant plant-one"><i></i><i></i></div>
          <div class="plant plant-two"><i></i><i></i></div>
          <div class="plant plant-three"><i></i><i></i></div>
        </div>
        <div class="greenhouse-base"></div>
      </div>

      <div class="house">
        <div class="chimney">
          <i class="smoke smoke-one"></i>
          <i class="smoke smoke-two"></i>
          <i class="smoke smoke-three"></i>
        </div>
        <div class="house-roof">
          <span class="roof-highlight"></span>
          <div class="attic-window" :class="{ 'is-open': atticOpen }" aria-hidden="true"><i></i></div>
        </div>
        <div class="house-body">
          <div class="house-window window-left">
            <i></i><i></i><i></i><i></i>
          </div>
          <div class="house-window window-right">
            <i></i><i></i><i></i><i></i>
          </div>
          <button
            type="button"
            class="door"
            :class="{ 'is-open': isDoorOpen }"
            :aria-label="isDoorOpen ? '关上农舍房门' : '打开农舍房门'"
            :aria-pressed="isDoorOpen"
            data-pixel-magnet="door"
            data-pixel-tug="door"
            @click="openDoor"
          >
            <span class="door-window" aria-hidden="true"></span>
            <span class="door-handle" aria-hidden="true"></span>
          </button>
          <div class="porch-light"><i></i></div>
        </div>
        <div class="porch">
          <span></span><span></span><span></span>
        </div>
      </div>

      <div
        class="signal-tower"
        :class="{ 'is-tuned': towerTuned }"
        role="group"
        :aria-label="`信号塔强度 ${displayedSignalLevel} / 4`"
      >
        <div class="signal-waves" aria-hidden="true">
          <span class="wave wave-one"></span>
          <span class="wave wave-two"></span>
          <span class="wave wave-three"></span>
        </div>
        <div class="tower-light" :class="{ active: displayedSignalLevel > 0 }" aria-hidden="true"></div>
        <div class="tower-mast" aria-hidden="true"></div>
        <div class="tower-deck" aria-hidden="true"></div>
        <div class="tower-legs" aria-hidden="true">
          <span></span><span></span><i></i><b></b>
        </div>
        <div class="signal-meter" aria-hidden="true">
          <span
            v-for="bar in 4"
            :key="bar"
            :class="{ active: bar <= displayedSignalLevel }"
          ></span>
        </div>
        <label class="tower-tuner">
          <span class="sr-only">调节信号塔频率</span>
          <input
            :value="towerValue"
            type="range"
            min="0"
            max="100"
            step="1"
            :aria-valuetext="`信号频率 ${towerValue}%`"
            data-pixel-magnet="soft"
            @input="tuneTower"
          />
        </label>
      </div>

      <button
        class="cherry-tree"
        :class="{ 'is-shaking': isShaking }"
        type="button"
        aria-label="摇动樱花树"
        data-pixel-magnet="tree"
        data-pixel-tug="tree"
        @click="shakeTree"
      >
        <span class="tree-crown" aria-hidden="true">
          <i class="crown-block crown-a"></i>
          <i class="crown-block crown-b"></i>
          <i class="crown-block crown-c"></i>
          <i class="crown-block crown-d"></i>
          <i class="crown-block crown-e"></i>
          <i class="crown-block crown-f"></i>
          <i class="blossom blossom-a"></i>
          <i class="blossom blossom-b"></i>
          <i class="blossom blossom-c"></i>
          <i class="blossom blossom-d"></i>
          <i class="blossom blossom-e"></i>
          <i class="blossom blossom-f"></i>
          <i class="blossom blossom-g"></i>
          <i class="blossom blossom-h"></i>
          <i class="blossom blossom-i"></i>
          <i class="blossom blossom-j"></i>
        </span>
        <span class="tree-trunk" aria-hidden="true">
          <i class="branch branch-left"></i>
          <i class="branch branch-right"></i>
          <i class="trunk-light"></i>
        </span>
        <span class="tree-sign" aria-hidden="true">摇树</span>
        <span class="tree-shadow" aria-hidden="true"></span>
      </button>

      <button
        type="button"
        class="stream"
        :class="{
          'is-rippling-short': streamPulse === 'short',
          'is-rippling-long': streamPulse === 'long',
        }"
        aria-label="轻点溪流制造水波，长按制造大水波"
        data-pixel-magnet="soft"
        @pointerdown="beginStreamPress"
        @pointerup="endStreamPress"
        @pointercancel="cancelStreamPress"
        @click="activateStream"
      >
        <span class="water-line water-a" aria-hidden="true"></span>
        <span class="water-line water-b" aria-hidden="true"></span>
        <span class="water-line water-c" aria-hidden="true"></span>
        <span class="water-line water-d" aria-hidden="true"></span>
        <span class="bank-pixel bank-a" aria-hidden="true"></span>
        <span class="bank-pixel bank-b" aria-hidden="true"></span>
        <span class="bank-pixel bank-c" aria-hidden="true"></span>
      </button>

      <div class="bridge" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
        <i class="bridge-rail rail-top"></i>
        <i class="bridge-rail rail-bottom"></i>
      </div>

      <div class="blogger" aria-hidden="true">
        <span class="blogger-shadow"></span>
        <div class="blogger-head">
          <span class="hair hair-top"></span>
          <span class="hair hair-side"></span>
          <span class="ear"></span>
          <span class="glasses glasses-left"></span>
          <span class="glasses glasses-right"></span>
          <span class="glasses-bridge"></span>
        </div>
        <div class="blogger-body">
          <span class="jacket-light"></span>
          <span class="arm arm-left"></span>
          <span class="arm arm-right"></span>
          <span class="camera"><i></i></span>
        </div>
        <span class="leg leg-left"></span>
        <span class="leg leg-right"></span>
      </div>

      <button
        type="button"
        class="pixel-cat"
        :class="{ 'is-purring': isCatPurring, 'is-trusting': catTrustLevel > 0 }"
        :aria-label="`摸一摸像素猫，当前亲密度 ${catTrustLevel} / 3`"
        data-pixel-magnet="cat"
        data-pixel-tug="cat"
        @click="petCat"
      >
        <span class="cat-trust" aria-hidden="true">
          <i v-for="level in 3" :key="level" :class="{ active: level <= catTrustLevel }"></i>
        </span>
        <span class="cat-shadow" aria-hidden="true"></span>
        <span class="cat-tail" aria-hidden="true"></span>
        <div class="cat-body" aria-hidden="true"></div>
        <div class="cat-head" aria-hidden="true">
          <i class="cat-ear cat-ear-left"></i>
          <i class="cat-ear cat-ear-right"></i>
          <i class="cat-eye cat-eye-left"></i>
          <i class="cat-eye cat-eye-right"></i>
          <i class="cat-nose"></i>
        </div>
        <span class="cat-paw paw-left" aria-hidden="true"></span>
        <span class="cat-paw paw-right" aria-hidden="true"></span>
      </button>

      <div class="scene-glint" aria-hidden="true"></div>
      <p class="sr-only" aria-live="polite">农场现在是{{ PHASE_LABELS[localPhase] }}</p>
    </div>
  </section>
</template>

<style scoped>
.pixel-farm,
.pixel-farm * {
  box-sizing: border-box;
  border-radius: 0;
}

.pixel-farm {
  width: 100%;
  max-width: 760px;
  margin-inline: auto;
  container-type: inline-size;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  -webkit-user-select: none;
  user-select: none;
}

.scene-frame {
  --px: clamp(3px, 0.72cqw, 6px);
  --ink: #492844;
  --ink-soft: #6a3b5f;
  --rose-dark: #9d4e78;
  --rose: #d86f9a;
  --rose-bright: #f59abb;
  --rose-pale: #ffd3df;
  --blush: #ffe6ed;
  --cream: #fff5f2;
  --green-dark: #4d694f;
  --green: #78966c;
  --green-light: #abc98c;
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 420px;
  aspect-ratio: 6 / 5;
  overflow: hidden;
  border: calc(var(--px) * 1.15) solid var(--ink);
  background: #e98aab;
  box-shadow:
    calc(var(--px) * 1.5) calc(var(--px) * 1.5) 0 #b45b82,
    calc(var(--px) * 3) calc(var(--px) * 3) 0 rgb(73 40 68 / 0.2);
}

.scene-frame::before {
  content: '';
  position: absolute;
  inset: var(--px);
  z-index: 30;
  border: var(--px) solid rgb(255 245 242 / 0.42);
  border-right-color: rgb(73 40 68 / 0.16);
  border-bottom-color: rgb(73 40 68 / 0.16);
  pointer-events: none;
}

.scene-frame::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  background: transparent;
}

.phase-signal {
  position: absolute;
  inset: 0;
  z-index: 28;
  opacity: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    90deg,
    transparent 0 16px,
    rgb(255 244 220 / 0.72) 16px 20px,
    transparent 20px 44px
  );
  mix-blend-mode: screen;
}

.scene-frame.is-phase-shifting .phase-signal {
  animation: phase-signal-wipe 640ms steps(6, end);
}

.scene-frame.phase-dawn::after {
  background: rgb(255 215 225 / 0.1);
}

.scene-frame.phase-sunset::after {
  background: rgb(194 72 123 / 0.13);
  mix-blend-mode: multiply;
}

.scene-frame.phase-night::after {
  background: rgb(42 28 73 / 0.3);
  mix-blend-mode: multiply;
}

.sky {
  position: absolute;
  inset: 0 0 43% 0;
  overflow: hidden;
  background:
    linear-gradient(180deg, #cd719b 0 24%, #e88dad 24% 52%, #f4aec2 52% 100%);
}

.phase-dawn .sky {
  background: linear-gradient(180deg, #bd739e 0 24%, #e794b3 24% 58%, #ffd0d7 58% 100%);
}

.phase-day .sky {
  background: linear-gradient(180deg, #c66f9b 0 24%, #e88dad 24% 52%, #f4aec2 52% 100%);
}

.phase-sunset .sky {
  background: linear-gradient(180deg, #8e527f 0 24%, #d66f99 24% 57%, #f3a58f 57% 100%);
}

.phase-night .sky {
  background: linear-gradient(180deg, #382f65 0 35%, #65406d 35% 66%, #a85d83 66% 100%);
}

.phase-night .ground {
  filter: brightness(0.66) saturate(0.78) hue-rotate(8deg);
}

.phase-night .mountain-far {
  background: #65406f;
}

.phase-night .mountain-near {
  background: #493756;
  box-shadow: inset 0 calc(var(--px) * -2) 0 #372b46;
}

.phase-night .house-window,
.phase-night .porch-light,
.phase-night .attic-window.is-open {
  background: #ffe998;
  box-shadow: 0 0 0 var(--px) rgb(255 229 143 / 0.32);
}

.sky::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: calc(var(--px) * 3);
  background: #ffcad7;
  box-shadow: 0 calc(var(--px) * -2) 0 rgb(255 230 237 / 0.45);
}

.sun {
  appearance: none;
  position: absolute;
  top: 10%;
  left: 12%;
  width: calc(var(--px) * 6);
  height: calc(var(--px) * 6);
  z-index: 1;
  padding: 0;
  border: var(--px) solid #a85079;
  background: #fff0c9;
  box-shadow:
    var(--px) var(--px) 0 #d46f91,
    0 0 0 calc(var(--px) * 2) rgb(255 226 218 / 0.32);
  color: inherit;
  cursor: pointer;
  font: inherit;
  transform: translate3d(0, 0, 0);
  -webkit-tap-highlight-color: transparent;
}

.sun::before {
  content: '';
  position: absolute;
  inset: calc(var(--px) * -2.5);
}

.phase-dawn .sun {
  transform: translate3d(-4cqw, 2cqw, 0);
}

.phase-day .sun {
  transform: translate3d(0, 0, 0);
}

.phase-sunset .sun {
  background: #ffd194;
  transform: translate3d(34cqw, 10cqw, 0);
}

.phase-night .sun {
  border-color: #a98aa9;
  background: #fff3c6;
  box-shadow:
    var(--px) var(--px) 0 #76567d,
    0 0 0 calc(var(--px) * 2) rgb(255 241 191 / 0.14);
  transform: translate3d(56cqw, -1cqw, 0);
}

.sun:active {
  transform: translate3d(0, 0, 0) scale(0.9);
}

.phase-dawn .sun:active { transform: translate3d(-4cqw, 2cqw, 0) scale(0.9); }
.phase-sunset .sun:active { transform: translate3d(34cqw, 10cqw, 0) scale(0.9); }
.phase-night .sun:active { transform: translate3d(56cqw, -1cqw, 0) scale(0.9); }

.sun:focus-visible {
  outline: calc(var(--px) * 1.1) solid #fff8e8;
  outline-offset: calc(var(--px) * 2.4);
}

.sun span {
  position: absolute;
  width: calc(var(--px) * 2);
  height: var(--px);
  background: #fff0c9;
}

.sun span:nth-child(1) { top: calc(var(--px) * -3); left: calc(var(--px) * 1); }
.sun span:nth-child(2) { right: calc(var(--px) * -4); top: calc(var(--px) * 1); }
.sun span:nth-child(3) { bottom: calc(var(--px) * -3); left: calc(var(--px) * 1); }
.sun span:nth-child(4) { left: calc(var(--px) * -4); top: calc(var(--px) * 1); }

.cloud {
  position: absolute;
  z-index: 2;
  width: calc(var(--px) * 16);
  height: calc(var(--px) * 6);
}

.cloud i {
  position: absolute;
  left: calc(var(--px) * 2);
  bottom: var(--px);
  width: calc(var(--px) * 3);
  height: calc(var(--px) * 2);
  background: #fff1f2;
  box-shadow:
    calc(var(--px) * 2) calc(var(--px) * -2) 0 #fff1f2,
    calc(var(--px) * 5) calc(var(--px) * -3) 0 #fff1f2,
    calc(var(--px) * 8) calc(var(--px) * -2) 0 #fff1f2,
    calc(var(--px) * 11) 0 0 #fff1f2,
    calc(var(--px) * 3) 0 0 #fff1f2,
    calc(var(--px) * 6) 0 0 #fff1f2,
    calc(var(--px) * 9) 0 0 #fff1f2,
    calc(var(--px) * 2) var(--px) 0 #d989a6,
    calc(var(--px) * 5) var(--px) 0 #d989a6,
    calc(var(--px) * 8) var(--px) 0 #d989a6,
    calc(var(--px) * 11) var(--px) 0 #d989a6;
}

.cloud-one { top: 14%; left: 38%; }
.cloud-two { top: 30%; right: 5%; transform: scale(0.68); opacity: 0.82; }

.mountain {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
}

.mountain-far {
  height: 49%;
  background: #b66891;
  clip-path: polygon(
    0 100%, 0 76%, 7% 76%, 7% 62%, 13% 62%, 13% 46%, 19% 46%, 19% 32%,
    25% 32%, 25% 48%, 32% 48%, 32% 58%, 39% 58%, 39% 72%, 46% 72%,
    46% 53%, 52% 53%, 52% 38%, 59% 38%, 59% 22%, 65% 22%, 65% 39%,
    72% 39%, 72% 55%, 79% 55%, 79% 67%, 86% 67%, 86% 49%, 92% 49%,
    92% 34%, 100% 34%, 100% 100%
  );
}

.mountain-near {
  height: 36%;
  background: #8e5b7b;
  clip-path: polygon(
    0 100%, 0 62%, 8% 62%, 8% 43%, 16% 43%, 16% 59%, 25% 59%, 25% 72%,
    34% 72%, 34% 50%, 43% 50%, 43% 34%, 52% 34%, 52% 51%, 61% 51%,
    61% 69%, 71% 69%, 71% 47%, 80% 47%, 80% 29%, 89% 29%, 89% 51%,
    100% 51%, 100% 100%
  );
  box-shadow: inset 0 calc(var(--px) * -2) 0 #74516d;
}

.ground {
  position: absolute;
  inset: 51% 0 0;
  z-index: 4;
  overflow: hidden;
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0 calc(var(--px) * 4),
      rgb(73 40 68 / 0.08) calc(var(--px) * 4) calc(var(--px) * 5)
    ),
    #92ad7a;
  border-top: calc(var(--px) * 1.5) solid #5b714f;
}

.field-row {
  position: absolute;
  width: 21%;
  height: 3.4%;
  background: #5d7b57;
  box-shadow:
    0 calc(var(--px) * 2) 0 #b2cb91,
    0 calc(var(--px) * 4) 0 #5d7b57;
  transform: skewX(-18deg);
}

.row-one { left: 8%; top: 28%; }
.row-two { left: 5%; top: 43%; width: 26%; }
.row-three { right: 8%; top: 27%; width: 17%; }

.path {
  position: absolute;
  z-index: 1;
  inset: 0 27% -14% 33%;
  background: #d6a37f;
  border-inline: var(--px) solid #9a725f;
  clip-path: polygon(38% 0, 59% 0, 100% 100%, 0 100%);
  opacity: 0.94;
}

.grass-patch {
  position: absolute;
  width: var(--px);
  height: calc(var(--px) * 3);
  background: var(--green-dark);
  box-shadow:
    calc(var(--px) * 2) var(--px) 0 var(--green-dark),
    calc(var(--px) * 4) calc(var(--px) * -1) 0 var(--green-dark),
    calc(var(--px) * 6) var(--px) 0 var(--green-dark);
}

.grass-a { left: 34%; top: 22%; }
.grass-b { right: 7%; top: 48%; transform: scale(0.8); }
.grass-c { left: 3%; top: 68%; transform: scale(1.2); }

.wildflower {
  position: absolute;
  width: calc(var(--px) * 8);
  height: calc(var(--px) * 6);
}

.wildflower::before,
.wildflower i {
  content: '';
  position: absolute;
  width: var(--px);
  background: var(--green-dark);
}

.wildflower::before { left: 50%; bottom: 0; height: calc(var(--px) * 4); }
.wildflower i { height: var(--px); background: #ffe2e8; box-shadow: var(--px) 0 0 #cb5f8e; }
.wildflower i:nth-child(1) { left: 35%; top: 8%; }
.wildflower i:nth-child(2) { left: 64%; top: 38%; }
.wildflower i:nth-child(3) { left: 12%; top: 52%; }
.flower-a { left: 35%; top: 34%; }
.flower-b { right: 22%; top: 46%; transform: scale(0.72); }
.flower-c { right: 3%; top: 18%; transform: scale(0.9); }

.greenhouse {
  position: absolute;
  left: 7%;
  bottom: 35%;
  z-index: 6;
  width: 27%;
  height: 26%;
  filter: drop-shadow(calc(var(--px) * 1.2) calc(var(--px) * 1.5) 0 rgb(73 40 68 / 0.28));
}

.greenhouse-roof {
  position: absolute;
  inset: 0 5% 54%;
  border: var(--px) solid var(--ink-soft);
  background: rgb(255 220 230 / 0.7);
  clip-path: polygon(0 100%, 0 78%, 13% 78%, 13% 55%, 27% 55%, 27% 32%, 41% 32%, 41% 8%, 59% 8%, 59% 32%, 73% 32%, 73% 55%, 87% 55%, 87% 78%, 100% 78%, 100% 100%);
}

.roof-pane {
  position: absolute;
  top: 12%;
  bottom: 0;
  width: var(--px);
  background: var(--ink-soft);
  transform-origin: bottom;
}

.pane-a { left: 28%; transform: rotate(22deg); }
.pane-b { left: 50%; }
.pane-c { right: 28%; transform: rotate(-22deg); }

.greenhouse-body {
  position: absolute;
  inset: 43% 5% 5%;
  overflow: hidden;
  border: var(--px) solid var(--ink-soft);
  background:
    linear-gradient(180deg, rgb(255 237 239 / 0.78), rgb(239 152 182 / 0.66)),
    #efb4c7;
}

.glass-line {
  position: absolute;
  inset-block: 0;
  width: var(--px);
  background: #9a6681;
}

.glass-one { left: 25%; }
.glass-two { left: 50%; }
.glass-three { left: 75%; }

.greenhouse-door {
  position: absolute;
  right: 7%;
  bottom: 0;
  width: 23%;
  height: 74%;
  border: var(--px) solid var(--ink-soft);
  background: rgb(255 232 237 / 0.55);
}

.greenhouse-door i {
  position: absolute;
  right: 12%;
  top: 50%;
  width: var(--px);
  height: var(--px);
  background: #fff1bb;
}

.plant {
  position: absolute;
  bottom: 0;
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 5);
  background: #547153;
}

.plant i {
  position: absolute;
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 2);
  background: #719466;
}

.plant i:first-child { left: calc(var(--px) * -1.5); top: var(--px); }
.plant i:last-child { right: calc(var(--px) * -1.5); top: calc(var(--px) * 2); }
.plant-one { left: 10%; }
.plant-two { left: 35%; height: calc(var(--px) * 4); }
.plant-three { left: 58%; height: calc(var(--px) * 6); }
.greenhouse-base { position: absolute; inset: auto 0 0; height: calc(var(--px) * 2); background: var(--ink-soft); }

.house {
  position: absolute;
  left: 43%;
  bottom: 32%;
  z-index: 7;
  width: 34%;
  height: 40%;
  filter: drop-shadow(calc(var(--px) * 1.4) calc(var(--px) * 1.8) 0 rgb(73 40 68 / 0.32));
}

.chimney {
  position: absolute;
  z-index: 1;
  top: 5%;
  right: 20%;
  width: 12%;
  height: 25%;
  border: var(--px) solid var(--ink);
  background: #ae5d75;
}

.smoke {
  position: absolute;
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 2);
  background: rgb(255 236 237 / 0.82);
}

.smoke-one { left: 20%; top: calc(var(--px) * -4); }
.smoke-two { left: 65%; top: calc(var(--px) * -8); opacity: 0.72; }
.smoke-three { left: 10%; top: calc(var(--px) * -12); opacity: 0.42; }

.house-roof {
  position: absolute;
  z-index: 2;
  inset: 8% 0 46%;
  overflow: hidden;
  border: var(--px) solid var(--ink);
  background:
    repeating-linear-gradient(90deg, #b84f79 0 calc(var(--px) * 4), #cf6689 calc(var(--px) * 4) calc(var(--px) * 5));
  clip-path: polygon(0 100%, 0 82%, 9% 82%, 9% 65%, 18% 65%, 18% 48%, 28% 48%, 28% 31%, 38% 31%, 38% 14%, 62% 14%, 62% 31%, 72% 31%, 72% 48%, 82% 48%, 82% 65%, 91% 65%, 91% 82%, 100% 82%, 100% 100%);
}

.roof-highlight {
  position: absolute;
  top: 20%;
  left: 28%;
  width: 24%;
  height: var(--px);
  background: #ed91aa;
  box-shadow: calc(var(--px) * 7) calc(var(--px) * 3) 0 #923d68;
}

.attic-window {
  position: absolute;
  left: 43%;
  bottom: 10%;
  width: 18%;
  height: 33%;
  border: var(--px) solid var(--ink);
  background: #ffd7a7;
}

.attic-window.is-open {
  background: #fff0a4;
  box-shadow: 0 0 0 var(--px) rgb(255 232 146 / 0.28);
}

.attic-window i {
  position: absolute;
  left: 50%;
  top: 0;
  width: var(--px);
  height: 100%;
  background: var(--ink);
}

.house-body {
  position: absolute;
  inset: 49% 7% 6%;
  perspective: calc(var(--px) * 40);
  border: var(--px) solid var(--ink);
  background:
    repeating-linear-gradient(0deg, #e9a187 0 calc(var(--px) * 3), #cf826f calc(var(--px) * 3) calc(var(--px) * 4));
}

.house-window {
  position: absolute;
  top: 19%;
  width: 23%;
  height: 34%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: var(--px) solid var(--ink);
  background: #ffe6aa;
}

.house-window i { border: calc(var(--px) * 0.45) solid #9a5d6b; background: #ffd894; }
.window-left { left: 8%; }
.window-right { right: 8%; }

.door {
  appearance: none;
  position: absolute;
  left: 39%;
  bottom: 0;
  width: 23%;
  height: 64%;
  padding: 0;
  border: var(--px) solid var(--ink);
  background: #8d5060;
  color: inherit;
  cursor: pointer;
  font: inherit;
  transform-origin: left center;
  -webkit-tap-highlight-color: transparent;
}

.door::before {
  content: '';
  position: absolute;
  inset: calc(var(--px) * -1);
  z-index: -1;
  background: #392a41;
}

.door.is-open {
  transform: rotateY(-64deg);
}

.door:active:not(.is-open) {
  transform: scale(0.94);
}

.door:focus-visible {
  outline: var(--px) solid #fff7dc;
  outline-offset: var(--px);
}

.door-window {
  position: absolute;
  inset: 11% 18% 55%;
  border: calc(var(--px) * 0.7) solid var(--ink);
  background: #f4bd92;
}

.door-handle {
  position: absolute;
  right: 12%;
  top: 56%;
  width: var(--px);
  height: var(--px);
  background: #ffdc8a;
}

.porch-light {
  position: absolute;
  left: 33%;
  top: 7%;
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 2);
  border: calc(var(--px) * 0.55) solid var(--ink);
  background: #ffe992;
  box-shadow: 0 0 0 var(--px) rgb(255 222 137 / 0.22);
}

.porch {
  position: absolute;
  inset: auto 2% 0;
  height: 10%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: var(--px) solid var(--ink);
  background: #b36d65;
}

.porch span { border-right: var(--px) solid #814c55; }
.porch span:last-child { border-right: 0; }

.signal-tower {
  position: absolute;
  right: 5%;
  bottom: 48%;
  z-index: 6;
  width: 13%;
  height: 34%;
  filter: drop-shadow(var(--px) var(--px) 0 rgb(73 40 68 / 0.25));
}

.signal-tower.is-tuned .tower-light {
  background: #fff1a7;
  box-shadow: 0 0 0 var(--px) rgb(255 237 154 / 0.25);
}

.tower-light {
  position: absolute;
  z-index: 4;
  top: 0;
  left: 45%;
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 2);
  border: calc(var(--px) * 0.5) solid var(--ink);
  background: #7b596d;
}

.tower-light.active { background: #ffe6a3; }

.tower-mast {
  position: absolute;
  z-index: 2;
  top: 8%;
  left: 49%;
  width: var(--px);
  height: 25%;
  background: var(--ink);
}

.tower-deck {
  position: absolute;
  z-index: 3;
  left: 18%;
  top: 29%;
  width: 66%;
  height: calc(var(--px) * 2);
  border: calc(var(--px) * 0.6) solid var(--ink);
  background: #d46e8f;
}

.tower-legs span {
  position: absolute;
  top: 31%;
  bottom: 0;
  width: var(--px);
  background: var(--ink-soft);
  transform-origin: top;
}

.tower-legs span:first-child { left: 28%; transform: rotate(12deg); }
.tower-legs span:nth-child(2) { right: 28%; transform: rotate(-12deg); }

.tower-legs i,
.tower-legs b {
  position: absolute;
  left: 28%;
  width: 48%;
  height: var(--px);
  background: var(--ink-soft);
}

.tower-legs i { top: 54%; transform: rotate(20deg); }
.tower-legs b { top: 72%; transform: rotate(-20deg); }

.signal-waves span {
  position: absolute;
  z-index: 1;
  top: 4%;
  height: var(--px);
  background: #ffe2df;
}

.wave-one { left: 25%; width: calc(var(--px) * 2); }
.wave-two { right: 18%; width: calc(var(--px) * 3); top: -2% !important; }
.wave-three { left: 12%; width: var(--px); top: -8% !important; }

.signal-meter {
  position: absolute;
  right: -6%;
  bottom: 7%;
  display: flex;
  align-items: end;
  gap: calc(var(--px) * 0.6);
  padding: var(--px);
  border: calc(var(--px) * 0.55) solid var(--ink);
  background: #f0b4bf;
}

.signal-meter span {
  width: var(--px);
  height: calc(var(--bar-index, 1) * var(--px));
  background: #9d7185;
}

.signal-meter span:nth-child(1) { height: var(--px); }
.signal-meter span:nth-child(2) { height: calc(var(--px) * 2); }
.signal-meter span:nth-child(3) { height: calc(var(--px) * 3); }
.signal-meter span:nth-child(4) { height: calc(var(--px) * 4); }
.signal-meter span.active { background: #fff0a7; }

.tower-tuner {
  position: absolute;
  z-index: 7;
  left: -28%;
  bottom: -15%;
  width: 156%;
  height: calc(var(--px) * 6);
  display: grid;
  align-items: center;
}

.tower-tuner input {
  appearance: none;
  width: 100%;
  height: calc(var(--px) * 5);
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: ew-resize;
  touch-action: pan-y;
}

.tower-tuner input::-webkit-slider-runnable-track {
  height: calc(var(--px) * 1.5);
  border: calc(var(--px) * 0.5) solid var(--ink);
  background: #d98bac;
  box-shadow: var(--px) var(--px) 0 rgb(73 40 68 / 0.22);
}

.tower-tuner input::-webkit-slider-thumb {
  appearance: none;
  width: calc(var(--px) * 4.5);
  height: calc(var(--px) * 5.5);
  margin-top: calc(var(--px) * -2.35);
  border: calc(var(--px) * 0.7) solid var(--ink);
  border-radius: 0;
  background: #ffe79e;
  box-shadow: var(--px) var(--px) 0 #9e5278;
}

.tower-tuner input::-moz-range-track {
  height: calc(var(--px) * 1.5);
  border: calc(var(--px) * 0.5) solid var(--ink);
  border-radius: 0;
  background: #d98bac;
}

.tower-tuner input::-moz-range-thumb {
  width: calc(var(--px) * 4.5);
  height: calc(var(--px) * 5.5);
  border: calc(var(--px) * 0.7) solid var(--ink);
  border-radius: 0;
  background: #ffe79e;
  box-shadow: var(--px) var(--px) 0 #9e5278;
}

.tower-tuner input:focus-visible {
  outline: var(--px) solid #fff7e8;
  outline-offset: calc(var(--px) * 1.3);
}

.cherry-tree {
  appearance: none;
  position: absolute;
  left: 1.5%;
  bottom: 21%;
  z-index: 13;
  width: 32%;
  height: 57%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  transform-origin: 50% 100%;
  -webkit-tap-highlight-color: transparent;
}

.cherry-tree:focus-visible {
  outline: calc(var(--px) * 1.2) solid #fff7e8;
  outline-offset: calc(var(--px) * 1.2);
  box-shadow: 0 0 0 calc(var(--px) * 2.1) var(--ink);
}

.tree-crown {
  position: absolute;
  inset: 0 0 29%;
  transform-origin: 50% 90%;
}

.crown-block {
  position: absolute;
  width: 32%;
  height: 30%;
  border: calc(var(--px) * 0.72) solid var(--ink);
  background: #d95f92;
  box-shadow:
    inset var(--px) var(--px) 0 #f89abb,
    inset calc(var(--px) * -1) calc(var(--px) * -1) 0 #a94373;
}

.crown-a { left: 34%; top: 0; }
.crown-b { left: 12%; top: 17%; }
.crown-c { right: 9%; top: 20%; }
.crown-d { left: 0; top: 42%; }
.crown-e { left: 34%; top: 37%; width: 38%; height: 37%; z-index: 2; }
.crown-f { right: 0; top: 47%; }

.blossom {
  position: absolute;
  z-index: 4;
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 2);
  background: #fff0f2;
  box-shadow:
    var(--px) 0 0 #ffd2df,
    calc(var(--px) * -1) 0 0 #ffd2df,
    0 var(--px) 0 #f9a1bd,
    0 calc(var(--px) * -1) 0 #fff7f4;
}

.blossom-a { left: 21%; top: 17%; }
.blossom-b { left: 46%; top: 5%; transform: scale(0.8); }
.blossom-c { right: 20%; top: 24%; }
.blossom-d { left: 7%; top: 48%; transform: scale(0.75); }
.blossom-e { left: 40%; top: 39%; }
.blossom-f { right: 5%; top: 53%; transform: scale(0.8); }
.blossom-g { left: 27%; top: 67%; transform: scale(0.7); }
.blossom-h { right: 30%; top: 69%; }
.blossom-i { left: 58%; top: 20%; transform: scale(0.65); }
.blossom-j { left: 9%; top: 30%; transform: scale(0.6); }

.tree-trunk {
  position: absolute;
  z-index: 1;
  left: 42%;
  bottom: 7%;
  width: 18%;
  height: 51%;
  border: calc(var(--px) * 0.8) solid var(--ink);
  background: #8a5260;
  box-shadow: inset calc(var(--px) * -1.4) 0 0 #643c50;
}

.branch {
  position: absolute;
  top: 20%;
  width: 80%;
  height: calc(var(--px) * 2.4);
  border: calc(var(--px) * 0.65) solid var(--ink);
  background: #8a5260;
  transform-origin: center;
}

.branch-left { right: 55%; transform: rotate(28deg); }
.branch-right { left: 55%; top: 34%; transform: rotate(-30deg); }
.trunk-light { position: absolute; left: 13%; top: 32%; width: var(--px); height: 47%; background: #c77b76; }

.tree-sign {
  position: absolute;
  z-index: 6;
  right: 5%;
  bottom: 18%;
  min-width: calc(var(--px) * 7);
  padding: calc(var(--px) * 0.65) var(--px);
  border: calc(var(--px) * 0.72) solid var(--ink);
  background: #ffd39f;
  box-shadow: var(--px) var(--px) 0 #8a5260;
  color: var(--ink);
  font-size: clamp(8px, 2.3cqw, 14px);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.08em;
}

.tree-sign::before {
  content: '';
  position: absolute;
  left: 45%;
  bottom: 100%;
  width: var(--px);
  height: calc(var(--px) * 4);
  background: var(--ink);
}

.tree-shadow {
  position: absolute;
  z-index: 0;
  left: 20%;
  bottom: 0;
  width: 70%;
  height: 8%;
  background: rgb(73 40 68 / 0.24);
  clip-path: polygon(7% 0, 93% 0, 100% 45%, 82% 45%, 82% 100%, 18% 100%, 18% 45%, 0 45%);
}

.stream {
  appearance: none;
  position: absolute;
  z-index: 9;
  inset: auto -5% -8% -5%;
  height: 31%;
  padding: 0;
  overflow: hidden;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  border-top: calc(var(--px) * 1.3) solid #5d6e74;
  background:
    repeating-linear-gradient(0deg, #7da7ae 0 calc(var(--px) * 3), #91bac0 calc(var(--px) * 3) calc(var(--px) * 5));
  color: inherit;
  cursor: crosshair;
  font: inherit;
  clip-path: polygon(0 31%, 14% 23%, 26% 28%, 39% 12%, 54% 22%, 68% 14%, 83% 25%, 100% 8%, 100% 100%, 0 100%);
  touch-action: pan-y;
  -webkit-tap-highlight-color: transparent;
}

.stream::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 54%;
  width: calc(var(--px) * 3);
  height: calc(var(--px) * 2);
  border: var(--px) solid #e9f2ef;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.35);
}

.stream:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 calc(var(--px) * 1.5) #fff7e8;
}

.stream:active {
  filter: brightness(1.08);
}

.water-line {
  position: absolute;
  width: calc(var(--px) * 8);
  height: var(--px);
  background: #d2dee0;
  box-shadow: calc(var(--px) * 3) var(--px) 0 #668f99;
}

.water-a { left: 7%; top: 52%; }
.water-b { left: 33%; top: 68%; transform: scale(0.7); }
.water-c { right: 25%; top: 42%; }
.water-d { right: 4%; top: 71%; transform: scale(0.55); }

.bank-pixel {
  position: absolute;
  top: 9%;
  width: 13%;
  height: calc(var(--px) * 2);
  background: #6f8a60;
}

.bank-a { left: 2%; top: 22%; }
.bank-b { left: 29%; top: 13%; width: 18%; }
.bank-c { right: 5%; top: 11%; width: 21%; }

.bridge {
  position: absolute;
  z-index: 12;
  left: 39%;
  bottom: 9%;
  width: 25%;
  height: 15%;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  border: var(--px) solid var(--ink);
  background: #a96264;
  box-shadow: calc(var(--px) * 1.5) calc(var(--px) * 1.5) 0 rgb(73 40 68 / 0.3);
  transform: rotate(-5deg);
}

.bridge > span { border-right: var(--px) solid #75465a; background: linear-gradient(90deg, #b96f6a, #995863); }
.bridge > span:last-of-type { border-right: 0; }

.bridge-rail {
  position: absolute;
  left: -5%;
  width: 110%;
  height: var(--px);
  background: var(--ink);
  box-shadow:
    var(--px) calc(var(--px) * 2) 0 #d08574,
    calc(var(--px) * 4) calc(var(--px) * 2) 0 #d08574,
    calc(var(--px) * 8) calc(var(--px) * 2) 0 #d08574,
    calc(var(--px) * 12) calc(var(--px) * 2) 0 #d08574,
    calc(var(--px) * 16) calc(var(--px) * 2) 0 #d08574;
}

.rail-top { top: -18%; }
.rail-bottom { bottom: -8%; }

.blogger {
  position: absolute;
  z-index: 15;
  left: 63%;
  bottom: 20%;
  width: 10%;
  height: 26%;
  transform-origin: 50% 100%;
}

.blogger-shadow {
  position: absolute;
  left: -12%;
  bottom: -2%;
  width: 125%;
  height: 8%;
  background: rgb(73 40 68 / 0.28);
}

.blogger-head {
  position: absolute;
  z-index: 3;
  left: 18%;
  top: 3%;
  width: 64%;
  height: 29%;
  border: calc(var(--px) * 0.72) solid var(--ink);
  background: #e7a17f;
}

.hair-top {
  position: absolute;
  left: calc(var(--px) * -0.7);
  top: calc(var(--px) * -0.7);
  width: 112%;
  height: 32%;
  background: #4e3045;
  box-shadow: calc(var(--px) * -1) var(--px) 0 #4e3045;
}

.hair-side { position: absolute; left: calc(var(--px) * -0.7); top: 14%; width: 20%; height: 68%; background: #4e3045; }
.ear { position: absolute; right: calc(var(--px) * -1.4); top: 37%; width: var(--px); height: calc(var(--px) * 2); background: #cf806f; }

.glasses-left,
.glasses-right {
  position: absolute;
  z-index: 2;
  top: 42%;
  width: 34%;
  height: 24%;
  border: calc(var(--px) * 0.65) solid var(--ink);
  background: #dce9df;
}

.glasses-left { left: 10%; }
.glasses-right { right: 7%; }
.glasses-bridge { position: absolute; z-index: 3; left: 43%; top: 51%; width: 16%; height: calc(var(--px) * 0.7); background: var(--ink); }

.blogger-body {
  position: absolute;
  z-index: 2;
  left: 12%;
  top: 31%;
  width: 76%;
  height: 46%;
  border: calc(var(--px) * 0.72) solid var(--ink);
  background: #c34f7d;
  box-shadow: inset calc(var(--px) * -1.3) 0 0 #903b67;
}

.jacket-light { position: absolute; left: 17%; top: 8%; width: var(--px); height: 68%; background: #ef83a4; }

.arm {
  position: absolute;
  top: 13%;
  width: 28%;
  height: 76%;
  border: calc(var(--px) * 0.65) solid var(--ink);
  background: #bd4b78;
}

.arm-left { left: -28%; transform: rotate(9deg); }
.arm-right { right: -28%; transform: rotate(-9deg); }

.camera {
  position: absolute;
  z-index: 4;
  left: 30%;
  top: 31%;
  width: 48%;
  height: 35%;
  border: calc(var(--px) * 0.65) solid var(--ink);
  background: #594056;
  box-shadow: calc(var(--px) * -2) calc(var(--px) * -2) 0 #594056;
}

.camera i {
  position: absolute;
  left: 34%;
  top: 24%;
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 2);
  border: calc(var(--px) * 0.55) solid #f5b4c0;
  background: #8db1ad;
}

.leg {
  position: absolute;
  bottom: 0;
  width: 27%;
  height: 26%;
  border: calc(var(--px) * 0.65) solid var(--ink);
  background: #51425a;
}

.leg-left { left: 19%; }
.leg-right { right: 19%; }

.pixel-cat {
  appearance: none;
  position: absolute;
  z-index: 16;
  right: 18%;
  bottom: 20%;
  width: 9%;
  height: 13%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  transform-origin: 50% 100%;
  -webkit-tap-highlight-color: transparent;
}

.pixel-cat::before {
  content: '';
  position: absolute;
  inset: calc(var(--px) * -2.5);
}

.pixel-cat:focus-visible {
  outline: var(--px) solid #fff7e8;
  outline-offset: calc(var(--px) * 1.5);
  box-shadow: 0 0 0 calc(var(--px) * 1.8) var(--ink);
}

.cat-trust {
  position: absolute;
  z-index: 5;
  top: calc(var(--px) * -4);
  left: 8%;
  display: flex;
  gap: var(--px);
  pointer-events: none;
}

.cat-trust i {
  width: var(--px);
  height: var(--px);
  background: rgb(255 238 197 / 0.34);
}

.cat-trust i.active {
  background: #ffe58f;
  box-shadow: 0 var(--px) 0 #e783a6;
}

.pixel-cat.is-trusting .cat-eye {
  height: calc(var(--px) * 0.65);
}

.cat-shadow { position: absolute; inset: auto -12% 0; height: 12%; background: rgb(73 40 68 / 0.25); }
.cat-body { position: absolute; left: 8%; bottom: 12%; width: 77%; height: 48%; border: calc(var(--px) * 0.65) solid var(--ink); background: #744f68; }

.cat-head {
  position: absolute;
  z-index: 2;
  right: 0;
  top: 3%;
  width: 64%;
  height: 51%;
  border: calc(var(--px) * 0.65) solid var(--ink);
  background: #855b72;
}

.cat-ear {
  position: absolute;
  top: calc(var(--px) * -2.2);
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 2);
  border: calc(var(--px) * 0.55) solid var(--ink);
  background: #855b72;
}

.cat-ear-left { left: 2%; }
.cat-ear-right { right: 1%; }
.cat-eye { position: absolute; top: 38%; width: var(--px); height: var(--px); background: #ffe79a; }
.cat-eye-left { left: 20%; }
.cat-eye-right { right: 20%; }
.cat-nose { position: absolute; left: 45%; bottom: 13%; width: var(--px); height: var(--px); background: #f3a1af; }

.cat-tail {
  position: absolute;
  z-index: 0;
  left: -25%;
  top: 20%;
  width: 55%;
  height: calc(var(--px) * 2);
  border: calc(var(--px) * 0.55) solid var(--ink);
  background: #744f68;
  transform: rotate(-42deg);
  transform-origin: right center;
}

.cat-paw { position: absolute; z-index: 3; bottom: 4%; width: 24%; height: 23%; border: calc(var(--px) * 0.55) solid var(--ink); background: #855b72; }
.paw-left { left: 21%; }
.paw-right { right: 10%; }

.scene-glint {
  position: absolute;
  z-index: 24;
  top: 4%;
  right: 4%;
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 5);
  background: rgb(255 255 255 / 0.42);
  box-shadow:
    calc(var(--px) * -2) calc(var(--px) * 2) 0 rgb(255 255 255 / 0.42),
    calc(var(--px) * 2) calc(var(--px) * 2) 0 rgb(255 255 255 / 0.42);
  pointer-events: none;
}

.phase-night .sun span {
  opacity: 0;
}

.phase-night .scene-glint {
  background: #fff2b2;
  box-shadow:
    calc(var(--px) * -2) calc(var(--px) * 2) 0 #fff2b2,
    calc(var(--px) * 2) calc(var(--px) * 2) 0 #fff2b2,
    calc(var(--px) * -8) calc(var(--px) * 6) 0 rgb(255 242 178 / 0.72),
    calc(var(--px) * -15) calc(var(--px) * 1) 0 rgb(255 242 178 / 0.58);
}

@media (prefers-reduced-motion: no-preference) {
  .scene-frame::after,
  .sky,
  .ground,
  .mountain,
  .house-window,
  .porch-light,
  .attic-window {
    transition: background-color 420ms steps(4, end), filter 420ms steps(4, end), opacity 420ms steps(4, end);
  }
  .sun { transition: transform 520ms steps(6, end), background-color 320ms steps(3, end), box-shadow 320ms steps(3, end); }
  .door { transition: transform 360ms steps(4, end), filter 240ms steps(3, end); }
  .cloud-one { animation: cloud-drift 11s steps(6, end) infinite alternate; }
  .smoke-one { animation: smoke-rise 3.8s steps(4, end) infinite; }
  .water-a,
  .water-c { animation: water-shift 3.2s steps(3, end) infinite alternate; }
  .wave-one { animation: signal-pulse 2.2s steps(3, end) infinite; }
  .pixel-cat:hover { transform: translateY(calc(var(--px) * -1)); }
  .pixel-cat.is-purring { animation: cat-purr 0.72s steps(4, end); }
  .stream.is-rippling-short::after { animation: stream-ripple-short 0.52s steps(5, end); }
  .stream.is-rippling-long::after { animation: stream-ripple-long 0.92s steps(7, end); }
  .attic-window.is-open { animation: attic-glow 1.4s steps(3, end) infinite alternate; }
  .cherry-tree:hover .tree-crown { transform: translateY(calc(var(--px) * -1)); }
  .cherry-tree.is-shaking { animation: tree-shake 0.58s steps(2, end); }
}

@keyframes phase-signal-wipe {
  0% { opacity: 0; transform: translateX(-12%); }
  24% { opacity: 0.82; }
  100% { opacity: 0; transform: translateX(12%); }
}

@keyframes cloud-drift {
  from { transform: translateX(0); }
  to { transform: translateX(calc(var(--px) * 6)); }
}

@keyframes cloud-drift-small {
  from { transform: translateX(0) scale(0.68); }
  to { transform: translateX(calc(var(--px) * -6)) scale(0.68); }
}

@keyframes smoke-rise {
  0% { transform: translate(0, 0); opacity: 0; }
  25% { opacity: 0.8; }
  100% { transform: translate(calc(var(--px) * 2), calc(var(--px) * -5)); opacity: 0; }
}

@keyframes water-shift {
  from { transform: translateX(0); }
  to { transform: translateX(calc(var(--px) * 3)); }
}

@keyframes signal-pulse {
  0%, 100% { opacity: 0.22; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(calc(var(--px) * -1)); }
}

@keyframes blogger-breathe {
  from { transform: translateY(0); }
  to { transform: translateY(calc(var(--px) * -0.6)); }
}

@keyframes tail-wave {
  from { transform: rotate(-42deg); }
  to { transform: rotate(-18deg); }
}

@keyframes tree-shake {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(-3deg); }
  40% { transform: rotate(3deg); }
  60% { transform: rotate(-2deg); }
  80% { transform: rotate(2deg); }
}

@keyframes sign-nudge {
  0%, 90%, 100% { transform: translateY(0); }
  94% { transform: translateY(calc(var(--px) * -1)); }
}

@keyframes cat-purr {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(calc(var(--px) * -0.6), calc(var(--px) * -1)); }
  50% { transform: translate(calc(var(--px) * 0.6), 0); }
  75% { transform: translate(calc(var(--px) * -0.4), calc(var(--px) * -0.5)); }
}

@keyframes stream-ripple-short {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.35); }
  24% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(5); }
}

@keyframes stream-ripple-long {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.35); }
  18% { opacity: 1; box-shadow: 0 0 0 var(--px) #cfe8e8; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(12); box-shadow: 0 0 0 calc(var(--px) * 4) rgb(220 242 240 / 0.18); }
}

@keyframes attic-glow {
  from { filter: brightness(1); }
  to { filter: brightness(1.22); }
}

@media (max-width: 620px) {
  .scene-frame {
    min-height: 390px;
    aspect-ratio: 5 / 6;
  }

  .sky { bottom: 46%; }
  .ground { top: 48%; }

  .greenhouse {
    left: 4%;
    bottom: 39%;
    width: 31%;
    height: 22%;
  }

  .house {
    left: 37%;
    bottom: 35%;
    width: 41%;
    height: 34%;
  }

  .signal-tower {
    right: 3%;
    bottom: 53%;
    width: 16%;
    height: 29%;
  }

  .cherry-tree {
    left: -4%;
    bottom: 21%;
    width: 40%;
    height: 49%;
  }

  .stream { height: 27%; }
  .bridge { left: 34%; bottom: 10%; width: 31%; height: 13%; }
  .blogger { left: 66%; bottom: 19%; width: 13%; height: 23%; }
  .pixel-cat { right: 6%; bottom: 19%; width: 12%; height: 11%; }
  .row-three,
  .flower-c { display: none; }
}

@media (max-width: 390px) {
  .scene-frame { min-height: 360px; }
  .tree-sign { display: none; }
  .greenhouse { transform: scale(0.9); transform-origin: left bottom; }
}

@media (prefers-reduced-motion: reduce) {
  .pixel-farm *,
  .pixel-farm *::before,
  .pixel-farm *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
</style>
