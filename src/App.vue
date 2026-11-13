<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import PixelFarmScene from './components/PixelFarmScene.vue'
import PixelCursor from './components/PixelCursor.vue'
import SakuraCanvas from './components/SakuraCanvas.vue'
import GardenPlot from './components/GardenPlot.vue'
import SignalPath from './components/SignalPath.vue'
import GreenhouseProjects from './components/GreenhouseProjects.vue'
import ToolShed from './components/ToolShed.vue'
import NightSignal from './components/NightSignal.vue'
import PocketRadio from './components/PocketRadio.vue'
import ZeroBroadcast from './components/ZeroBroadcast.vue'
import { useEasterEggs } from './composables/useEasterEggs'
import { useFarmWorld } from './composables/useFarmWorld'
import { usePixelAudio } from './composables/usePixelAudio'
import { useScrollStory, type WorldPhase } from './composables/useScrollStory'
import type {
  EasterEggDetail,
  GardenUnlockDetail,
  PetalCatchDetail,
  SakuraCanvasHandle,
} from './types/interactions'
import type {
  PixelCursorHandle,
  PixelDropDetail,
  PixelTugDetail,
} from './types/pixelCursor'

type StreamTapDetail = { kind: 'short' | 'long' }
type GardenPlotHandle = {
  acceptPixelDrop: (dragId: string, dropZoneId: string) => void
}
type ToolShedHandle = {
  acceptPixelDrop: (dragId: string) => void
}
type NightSignalHandle = {
  acceptPixelDrop: (dragId: string) => boolean
}

const signalLevel = ref(0)
const articleProgress = ref(0)
const shakeCount = ref(0)
const sakuraRef = ref<SakuraCanvasHandle>()
const pixelCursorRef = ref<PixelCursorHandle>()
const gardenRef = ref<GardenPlotHandle>()
const toolShedRef = ref<ToolShedHandle>()
const nightSignalRef = ref<NightSignalHandle>()
const notice = ref('')
const secretMode = ref(false)
const zeroBroadcastOpen = ref(false)
const worldPhase = ref<WorldPhase>('dawn')
const streamPattern = ref<Array<'short' | 'long'>>([])

const {
  state,
  shardCount,
  endingReady,
  unlock,
  addItem,
  removeItem,
  claimShard,
  catchPetal,
  petCat,
  markBand,
  reviveProject,
  completeEnding,
} = useFarmWorld()

const { play } = usePixelAudio({ enabled: () => state.soundEnabled })

const towerTuned = computed(() => state.unlocked.includes('tower:tuned'))
const atticOpen = computed(() => state.unlocked.includes('attic:open'))
const hasSpecialSeed = computed(() => state.inventory.includes('sakura-seed'))
const hasBattery = computed(() => state.inventory.includes('old-battery'))

let noticeTimer: ReturnType<typeof setTimeout> | undefined
let secretTimer: ReturnType<typeof setTimeout> | undefined
let streamTimer: ReturnType<typeof setTimeout> | undefined

function showNotice(message: string, duration = 4200) {
  notice.value = message
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = ''
  }, duration)
}

function updateSignal(progress: number) {
  articleProgress.value = progress
  const nextLevel = progress >= 100 ? 4 : Math.ceil(Math.max(0, progress) / 34)
  signalLevel.value = Math.max(signalLevel.value, nextLevel)
}

function shakeTree() {
  shakeCount.value += 1

  if (shakeCount.value < 3) {
    showNotice(`樱花树轻轻晃了一下。还差 ${3 - shakeCount.value} 次。`, 2200)
    return
  }

  shakeCount.value = 0
  sakuraRef.value?.startRain(8000)
  unlock('tree:sakura-rain')
  play('unlock')
  showNotice('樱花雨开始了。用粉色尾线穿过花瓣，把它们接住。', 5200)
}

function handleTug(detail: PixelTugDetail) {
  if (detail.id === 'tree') {
    shakeCount.value = 2
    shakeTree()
    return
  }
  if (detail.id === 'cat') {
    handleCatPet()
    return
  }
  if (detail.id === 'door') handleDoorOpen()
}

function handlePetalCatch(detail: PetalCatchDetail) {
  const total = catchPetal()
  pixelCursorRef.value?.burstAt(detail.x, detail.y, 'petal')
  play(total >= 6 ? 'unlock' : 'collect')

  if (total === 1) showNotice('尾线接住了第一片樱花。再找五片。', 2600)
  else if (total === 3) showNotice('三片花瓣在口袋电台里发光。', 2600)
  else if (total === 6) showNotice('六片花瓣合成了一颗樱花信号种。把它带去花圃。', 5200)
}

function handleDrop(detail: PixelDropDetail) {
  if (!detail.accepted || !detail.dropZoneId) {
    if (detail.id.startsWith('garden') || detail.id === 'sakura-seed' || detail.id.startsWith('shed:')) {
      play('error')
      showNotice('这里接不住它。尾线已经把物件弹回原位。', 2400)
    }
    return
  }

  if (detail.dropZoneId.startsWith('garden-cell-')) {
    gardenRef.value?.acceptPixelDrop(detail.id, detail.dropZoneId)
    play('pluck')
    return
  }

  if (detail.dropZoneId === 'shed-workbench') {
    toolShedRef.value?.acceptPixelDrop(detail.id)
    play('pluck')
    return
  }

  if (detail.dropZoneId === 'night-constellation') {
    nightSignalRef.value?.acceptPixelDrop(detail.id)
    play('collect')
  }
}

function handleCatPet() {
  if (state.catTrust >= 3) {
    showNotice('像素猫已经完全信任你。它一直望着农舍的门。', 2400)
    return
  }

  const trust = petCat()
  play('pluck')
  if (trust < 3) showNotice(`像素猫开始打呼。亲密度 ${trust} / 3。`, 2200)
  else showNotice('猫把爪子按在一块铜色门牌上。现在可以去找钥匙了。', 4200)
}

function handleStreamTap(detail: StreamTapDetail) {
  streamPattern.value = [...streamPattern.value, detail.kind].slice(-3)
  window.clearTimeout(streamTimer)
  streamTimer = window.setTimeout(() => {
    streamPattern.value = []
  }, 2800)
  play('pluck')

  const isMatch = streamPattern.value.join(',') === 'short,short,long'
  if (!isMatch) return

  streamPattern.value = []
  unlock('stream:short-short-long')
  if (!state.inventory.includes('copper-key') && !atticOpen.value) addItem('copper-key')
  play('unlock')
  showNotice('短、短、长。溪流吐出一把铜钥匙，农舍门牌同时亮起。', 5200)
}

function handleDoorOpen() {
  if (atticOpen.value) {
    showNotice('阁楼已经打开。工具房最暗的那格正在通电。', 2600)
    return
  }
  if (state.catTrust < 3) {
    play('error')
    showNotice('门边的猫挡住了路。先让它熟悉你的气味。', 3200)
    return
  }
  if (!state.inventory.includes('copper-key')) {
    play('error')
    showNotice('门牌上刻着三道水纹：短、短、长。', 3200)
    return
  }

  removeItem('copper-key')
  unlock('attic:open')
  play('unlock')
  showNotice('铜钥匙转动。阁楼工作台已经在工具房中出现。', 4600)
}

function handleBandTuned(band: number) {
  const count = markBand(band)
  play('collect')
  showNotice(`第 ${band + 1} 段频率已锁定。广播信号 ${count} / 3。`, 2600)
}

function tryClaimBroadcastShard() {
  const tuned = state.towerBands.length >= 3 || state.unlocked.includes('broadcast:tuned-complete')
  const greeted = state.unlocked.includes('code:hello-world')
  if (!tuned || !greeted || state.shards.broadcast) return

  claimShard('broadcast')
  play('unlock')
  showNotice('HELLO WORLD 穿过三段频率，凝成了广播信号片。', 5200)
}

function handleBroadcastComplete() {
  unlock('broadcast:tuned-complete')
  showNotice('三段频率重合。残缺字幕闪过：H_LL_ W_RLD。', 5000)
  tryClaimBroadcastShard()
}

function handleProjectIlluminated(projectId: string) {
  if (unlock(`project:${projectId}:illuminated`)) play('pluck')
}

function handleToolCombination() {
  if (!hasBattery.value && !state.revivedFailedProject) addItem('old-battery')
  unlock('shed:battery-found')
  play('unlock')
  showNotice('工作台暗格弹开。你找到一枚仍有余温的旧电池。', 5200)
}

function handleReviveProject() {
  if (!hasBattery.value) {
    play('error')
    showNotice('这项实验缺少电源。工具房里也许藏着一枚旧电池。', 3400)
    return
  }
  if (!reviveProject()) return
  play('grow')
  showNotice('失败实验重新发芽，并留下了余烬信号片。失败记录没有被抹去。', 6000)
}

function handleSpecialBloom() {
  if (state.inventory.includes('sakura-seed')) removeItem('sakura-seed')
  if (!state.shards.bloom) claimShard('bloom')
  play('grow')
  showNotice('樱花信号种开成了一棵微型树。花瓣信号片已经收进电台。', 6000)
}

function openFinale() {
  if (!endingReady.value) {
    showNotice(`零点广播还缺 ${3 - shardCount.value} 枚信号片。`, 3000)
    return
  }
  play('broadcast')
  zeroBroadcastOpen.value = true
}

function handleBroadcastEnding() {
  completeEnding()
  secretMode.value = true
  showNotice('零点广播完成。这次访问已经拥有自己的信号编号。', 6000)
}

function handleGardenUnlock(detail: GardenUnlockDetail) {
  const messages: Record<GardenUnlockDetail['id'], string> = {
    'first-bloom': '第一朵花开了。这个花园会记得它。',
    'four-blooms': '四朵花同时亮起，稻草人好像动了一下。',
    'full-garden': '整块花圃已经盛开。你完成了隐藏的花园结局。',
  }

  showNotice(messages[detail.id], 5200)
}

function handleEggUnlock(detail: EasterEggDetail) {
  if (detail.id === 'hello-world') {
    unlock('code:hello-world')
    play('unlock')
    showNotice('HELLO WORLD 被农场接收。若三段频率已齐，它会变成一枚信号片。', 5200)
    tryClaimBroadcastShard()
    return
  }

  unlock('secret:konami')
  secretMode.value = true
  sakuraRef.value?.startRain(12000)
  worldPhase.value = 'night'
  play('broadcast')
  showNotice('旧掌机醒了。整座农场进入金色调试夜，樱花雨重新加载。', 5200)
  window.clearTimeout(secretTimer)
  secretTimer = window.setTimeout(() => {
    secretMode.value = false
  }, 16000)
}

useEasterEggs({ onUnlock: handleEggUnlock, autoStart: true })
useScrollStory({ onPhaseChange: (phase) => { worldPhase.value = phase } })

onBeforeUnmount(() => {
  window.clearTimeout(noticeTimer)
  window.clearTimeout(secretTimer)
  window.clearTimeout(streamTimer)
})
</script>

<template>
  <div
    class="site"
    :class="[`world-phase-${worldPhase}`, { 'secret-mode': secretMode }]"
    :data-world-phase="worldPhase"
  >
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <PixelCursor
      ref="pixelCursorRef"
      @drop="handleDrop"
      @tug="handleTug"
    />
    <SakuraCanvas ref="sakuraRef" @petal-catch="handlePetalCatch" />
    <PocketRadio />
    <ZeroBroadcast
      :open="zeroBroadcastOpen"
      @close="zeroBroadcastOpen = false"
      @complete="handleBroadcastEnding"
    />

    <header class="topbar">
      <a class="brand pixel-font" href="#top" aria-label="返回首页">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        BBB
      </a>

      <nav class="desktop-nav" aria-label="主要导航">
        <a href="#writing">文章</a>
        <a href="#lab">实验</a>
        <a href="#about">关于</a>
        <a href="#garden">种花</a>
        <a href="#contact">联系</a>
      </nav>

      <a class="topbar-action pixel-font" href="#garden">领一颗种子</a>
    </header>

    <main id="main-content">
      <section id="top" class="hero section-shell" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="hero-kicker pixel-font">粉色信号农场正在接收</p>
          <h1 id="hero-title">我把技术，种成会发光的东西。</h1>
          <p class="hero-intro">我是 BBB。写 AI、产品与互联网，也把每一次判断、失败和奇怪实验公开给你看。</p>
          <div class="hero-actions">
            <a class="pixel-button" href="#writing">读文章</a>
            <a class="pixel-button secondary" href="#lab">进温室</a>
          </div>
        </div>

        <div class="hero-world">
          <PixelFarmScene
            :signal-level="signalLevel"
            :world-phase="worldPhase"
            :cat-trust="state.catTrust"
            :tower-tuned="towerTuned"
            :attic-open="atticOpen"
            @shake-tree="shakeTree"
            @cat-pet="handleCatPet"
            @stream-tap="handleStreamTap"
            @door-open="handleDoorOpen"
            @phase-change="worldPhase = $event"
          />
          <div class="world-note pixel-font">
            <strong>这不是插画，是入口</strong>
            <span>拉住树冠再松手</span>
            <span>溪流听得懂长短拍</span>
            <span>猫会记住你</span>
          </div>
          <p v-if="streamPattern.length" class="stream-code pixel-font" aria-live="polite">
            水纹：{{ streamPattern.map((beat) => beat === 'short' ? '·' : '━').join(' ') }}
          </p>
        </div>
      </section>

      <hr class="pixel-divider" />

      <SignalPath
        @progress="updateSignal"
        @band-tuned="handleBandTuned"
        @broadcast-complete="handleBroadcastComplete"
      />
      <GreenhouseProjects
        :revived-failed-project="state.revivedFailedProject"
        :has-battery="hasBattery"
        @illuminate="handleProjectIlluminated"
        @revive-request="handleReviveProject"
      />
      <ToolShed
        ref="toolShedRef"
        :attic-open="atticOpen"
        :battery-claimed="state.revivedFailedProject"
        @combination-complete="handleToolCombination"
      />

      <section id="garden" class="garden-chapter" aria-labelledby="garden-title">
        <div class="section-shell garden-layout">
          <div class="garden-copy">
            <p class="garden-label pixel-font">读者花圃</p>
            <h2 id="garden-title" class="section-title">留下一朵只属于这次访问的花。</h2>
            <p class="section-copy">
              选择土地播种，再浇水三次。花朵会从种子长到盛开，并保存在你的浏览器里。
            </p>
            <div class="garden-rule" aria-hidden="true">
              <span>播种</span><b></b><span>浇水</span><b></b><span>盛开</span>
            </div>
          </div>

          <GardenPlot
            ref="gardenRef"
            :has-special-seed="hasSpecialSeed"
            :bloom-shard-claimed="state.shards.bloom"
            @unlock="handleGardenUnlock"
            @special-bloom="handleSpecialBloom"
          />
        </div>
      </section>

      <NightSignal
        ref="nightSignalRef"
        :shard-count="shardCount"
        :ending-ready="endingReady"
        :ending-seen="state.endingSeen"
        @open-finale="openFinale"
      />
    </main>

    <nav class="mobile-dock pixel-font" aria-label="移动端导航">
      <a href="#writing">文章</a>
      <a href="#lab">实验</a>
      <a href="#garden">种花</a>
      <a href="#contact">联系</a>
    </nav>

    <Transition name="notice">
      <p v-if="notice" class="pixel-notice pixel-font" role="status" aria-live="polite">
        {{ notice }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.site {
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  --phase-glow: #ffd5e5;
}

.site.world-phase-sunset {
  --phase-glow: #f5a990;
}

.site.world-phase-night {
  --phase-glow: #8f6aac;
}

.site.secret-mode::after {
  position: fixed;
  inset: 0;
  z-index: 80;
  pointer-events: none;
  content: '';
  opacity: 0.22;
  background: repeating-linear-gradient(
    90deg,
    transparent 0 16px,
    #ffe38a 16px 20px,
    transparent 20px 44px
  );
  mix-blend-mode: color-dodge;
  animation: secret-scan 1.2s steps(6, end) infinite;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 60;
  display: grid;
  width: min(1240px, calc(100% - 32px));
  height: 70px;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 28px;
  margin: 12px auto 0;
  padding: 0 14px 0 18px;
  border: 3px solid var(--ink);
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--ink) 34%, transparent);
  backdrop-filter: blur(12px);
  transition: background 320ms steps(5, end), border-color 320ms steps(5, end);
}

.world-phase-night .topbar {
  border-color: #8c6683;
  background: rgb(45 32 52 / 92%);
}

.world-phase-night .topbar :is(a, .brand) {
  color: #fff0f6;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
}

.brand-mark {
  display: grid;
  width: 26px;
  height: 24px;
  grid-template-columns: repeat(3, 6px);
  align-items: end;
  gap: 3px;
}

.brand-mark i {
  display: block;
  width: 6px;
  background: var(--rose-strong);
  box-shadow: 2px 0 0 var(--ink);
}

.brand-mark i:nth-child(1) {
  height: 9px;
}

.brand-mark i:nth-child(2) {
  height: 18px;
}

.brand-mark i:nth-child(3) {
  height: 13px;
}

.desktop-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(16px, 2.5vw, 34px);
}

.desktop-nav a {
  position: relative;
  color: var(--ink-soft);
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.desktop-nav a::after {
  position: absolute;
  right: 0;
  bottom: -8px;
  left: 0;
  height: 4px;
  content: '';
  background: var(--rose-strong);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 180ms steps(3, end);
}

.desktop-nav a:hover::after,
.desktop-nav a:focus-visible::after {
  transform: scaleX(1);
}

.topbar-action {
  min-height: 40px;
  padding: 10px 13px;
  border: 3px solid var(--ink);
  color: var(--paper);
  background: var(--rose-strong);
  box-shadow: 3px 3px 0 var(--ink);
  font-size: 13px;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
}

.hero {
  position: relative;
  width: min(1320px, calc(100% - 40px));
  min-height: calc(100dvh - 82px);
  padding-block: clamp(58px, 8vh, 92px) clamp(88px, 10vw, 150px);
  text-align: center;
}

.hero::before {
  position: absolute;
  top: 6%;
  left: 50%;
  width: min(80vw, 980px);
  height: min(32vw, 330px);
  content: '';
  pointer-events: none;
  background: repeating-linear-gradient(
    90deg,
    transparent 0 44px,
    color-mix(in srgb, var(--phase-glow) 42%, transparent) 44px 48px
  );
  mask-image: linear-gradient(90deg, transparent, #000 22% 78%, transparent);
  opacity: calc(0.12 + var(--story-progress, 0) * 0.2);
  transform: translateX(-50%) perspective(500px) rotateX(62deg);
}

.hero-copy {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  max-width: 1120px;
  margin: 0 auto;
}

.hero-kicker {
  width: fit-content;
  margin: 0 0 24px;
  padding: 8px 10px;
  border: 3px solid var(--ink);
  color: var(--paper);
  background: var(--rose-deep);
  box-shadow: 3px 3px 0 var(--ink);
  font-size: 12px;
  letter-spacing: 0.16em;
}

.hero h1 {
  max-width: 12ch;
  margin: 0;
  font-family: var(--font-pixel);
  font-size: clamp(3.1rem, 6.6vw, 6.9rem);
  font-weight: 400;
  line-height: 1.02;
  letter-spacing: -0.05em;
  color: var(--ink);
  text-wrap: balance;
  text-shadow: 4px 4px 0 color-mix(in srgb, var(--rose) 30%, transparent);
}

.hero-intro {
  max-width: 52ch;
  margin: 24px 0 0;
  color: var(--ink-soft);
  font-size: clamp(1.05rem, 1.45vw, 1.24rem);
  line-height: 1.75;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 32px;
  justify-content: center;
}

.hero-world {
  position: relative;
  width: min(100%, 1000px);
  min-width: 0;
  margin: clamp(44px, 6vw, 72px) auto 0;
}

.hero-world :deep(.pixel-farm) {
  max-width: 1000px;
}

.world-note {
  position: absolute;
  right: 20px;
  bottom: 18px;
  z-index: 4;
  display: grid;
  gap: 5px;
  max-width: 280px;
  margin: 0;
  padding: 8px 10px;
  border: 2px solid var(--ink);
  color: var(--ink);
  background: var(--cream);
  box-shadow: 3px 3px 0 var(--ink);
  font-size: 12px;
  line-height: 1.45;
  text-align: left;
}

.world-note strong {
  margin-bottom: 2px;
  color: var(--rose-deep);
  font-size: 13px;
}

.world-note span::before {
  content: '＋ ';
  color: var(--rose-strong);
}

.stream-code {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 6;
  margin: 0;
  padding: 9px 11px;
  color: var(--cream);
  background: var(--ink);
  border: 3px solid var(--cream);
  box-shadow: 4px 4px 0 rgb(48 20 42 / 38%);
  font-size: 13px;
}

.garden-chapter {
  position: relative;
  padding: clamp(96px, 13vw, 180px) 0;
  overflow: hidden;
  background:
    linear-gradient(180deg, #f5c6d5 0%, #e99ab7 64%, #c66c94 100%);
}

.garden-chapter::before,
.garden-chapter::after {
  position: absolute;
  content: '';
  pointer-events: none;
}

.garden-chapter::before {
  top: 44px;
  right: 6vw;
  width: 76px;
  height: 76px;
  background: var(--cream);
  box-shadow:
    -12px 8px 0 #ffdca6,
    12px 12px 0 color-mix(in srgb, var(--rose-deep) 26%, transparent);
}

.garden-chapter::after {
  right: 0;
  bottom: 0;
  left: 0;
  height: 72px;
  background: repeating-linear-gradient(90deg, var(--sage-dark) 0 32px, var(--sage) 32px 64px);
  clip-path: polygon(0 35%, 3% 12%, 7% 32%, 11% 4%, 16% 30%, 20% 8%, 25% 36%, 30% 0, 36% 32%, 41% 12%, 47% 36%, 53% 8%, 59% 34%, 65% 3%, 72% 38%, 79% 11%, 86% 34%, 92% 4%, 100% 30%, 100% 100%, 0 100%);
}

.garden-layout {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(300px, 0.82fr) minmax(480px, 1.18fr);
  align-items: center;
  gap: clamp(48px, 8vw, 110px);
}

.garden-label {
  margin: 0 0 18px;
  color: var(--rose-deep);
  font-size: 14px;
}

.garden-rule {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 32px;
  font-family: var(--font-pixel);
  font-size: 13px;
}

.garden-rule b {
  width: 28px;
  height: 4px;
  background: var(--rose-deep);
  box-shadow: 6px 0 0 var(--ink);
}

.mobile-dock {
  display: none;
}

.pixel-notice {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 100;
  width: min(390px, calc(100% - 32px));
  margin: 0;
  padding: 16px 18px;
  border: 3px solid var(--ink);
  color: var(--ink);
  background: var(--cream);
  box-shadow: 5px 5px 0 var(--ink);
  font-size: 14px;
  line-height: 1.55;
}

.notice-enter-active,
.notice-leave-active {
  transition: transform 180ms steps(3, end), opacity 180ms linear;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

@keyframes secret-scan {
  to {
    transform: translateX(44px);
  }
}

@media (max-width: 980px) {
  .topbar {
    grid-template-columns: auto 1fr;
  }

  .desktop-nav {
    justify-content: end;
  }

  .topbar-action {
    display: none;
  }

  .hero {
    width: min(100% - 28px, 900px);
  }

  .hero-copy {
    max-width: 880px;
  }

  .hero h1 {
    max-width: 12ch;
    font-size: clamp(3.6rem, 10vw, 6rem);
  }

  .garden-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .topbar {
    width: calc(100% - 24px);
    height: 62px;
    margin-top: 8px;
  }

  .desktop-nav {
    display: none;
  }

  .hero {
    min-height: auto;
    padding-top: 54px;
    padding-bottom: 100px;
  }

  .hero-kicker {
    margin-bottom: 18px;
  }

  .hero h1 {
    font-size: clamp(3rem, 15vw, 4.8rem);
  }

  .hero-intro {
    margin-top: 20px;
    font-size: 1.05rem;
  }

  .hero-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 26px;
  }

  .world-note {
    right: 12px;
    bottom: 12px;
    max-width: 210px;
    font-size: 11px;
  }

  .stream-code {
    left: 12px;
    bottom: 12px;
    font-size: 11px;
  }

  .garden-chapter {
    padding-top: 104px;
    padding-bottom: 128px;
  }

  .garden-chapter::before {
    top: 30px;
    right: 10vw;
    width: 48px;
    height: 48px;
  }

  .garden-layout {
    gap: 38px;
  }

  .garden-rule {
    flex-wrap: wrap;
  }

  .mobile-dock {
    position: fixed;
    right: 12px;
    bottom: 10px;
    left: 12px;
    z-index: 70;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border: 3px solid var(--ink);
    background: color-mix(in srgb, var(--paper) 94%, transparent);
    box-shadow: 4px 4px 0 var(--ink);
    backdrop-filter: blur(10px);
  }

  .mobile-dock a {
    min-height: 48px;
    display: grid;
    place-items: center;
    border-right: 2px solid var(--ink);
    font-size: 12px;
    text-decoration: none;
  }

  .mobile-dock a:last-child {
    border-right: 0;
  }

  .pixel-notice {
    right: 16px;
    bottom: 76px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .site.secret-mode::after {
    animation: none;
  }

  .topbar {
    transition: none;
  }
}
</style>
