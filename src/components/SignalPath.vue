<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { signalArticles } from '../data/content'

const emit = defineEmits<{
  progress: [value: number]
  bandTuned: [band: number]
  broadcastComplete: []
}>()

const articleCards = ref<HTMLElement[]>([])
const activeId = ref(signalArticles[0]?.id ?? '')
const progressValue = ref(0)
const frequency = ref(12)
const tunedBands = ref<number[]>([])
const tunerStatus = ref('先读完三篇文章，才能听清广播频段。')
const seenArticles = new Set<string>()
let observer: IntersectionObserver | undefined

const BAND_TARGETS = [24, 57, 86] as const

function activateArticle(id: string) {
  activeId.value = id
}

function registerProgress(id: string) {
  if (seenArticles.has(id)) return

  seenArticles.add(id)
  progressValue.value = Math.round((seenArticles.size / signalArticles.length) * 100)
  emit('progress', progressValue.value)
}

function inspectFrequency() {
  if (progressValue.value < 100) return

  const matchedIndex = BAND_TARGETS.findIndex(
    (target) => Math.abs(target - frequency.value) <= 2,
  )

  if (matchedIndex < 0) {
    tunerStatus.value = '还有噪声。慢慢拖动旋钮，寻找发光刻度。'
    return
  }

  if (tunedBands.value.includes(matchedIndex)) {
    tunerStatus.value = `频段 ${matchedIndex + 1} 已经锁定。继续寻找下一段信号。`
    return
  }

  tunedBands.value = [...tunedBands.value, matchedIndex]
  emit('bandTuned', matchedIndex)
  tunerStatus.value = `频段 ${matchedIndex + 1} 锁定，收到一段清晰广播。`

  if (tunedBands.value.length === BAND_TARGETS.length) {
    tunerStatus.value = '三段广播已经重合。塔顶正在发出新的信号。'
    emit('broadcastComplete')
  }
}

onMounted(async () => {
  await nextTick()

  if (!('IntersectionObserver' in window)) {
    progressValue.value = 100
    emit('progress', 100)
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue

        const id = (entry.target as HTMLElement).dataset.articleId
        if (!id) continue

        activateArticle(id)
        registerProgress(id)
      }
    },
    {
      threshold: 0.48,
      rootMargin: '-12% 0px -28%',
    },
  )

  articleCards.value.forEach((card) => observer?.observe(card))
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section id="writing" class="signal-path" aria-labelledby="signal-path-title">
    <div class="signal-path__scene" aria-hidden="true">
      <div class="sun" />
      <div class="cloud cloud--one" />
      <div class="cloud cloud--two" />
      <div class="signal-tower">
        <span class="signal-tower__cap" />
        <span class="signal-tower__mast" />
        <span class="signal-tower__beam signal-tower__beam--one" :class="{ 'is-on': progressValue >= 34 }" />
        <span class="signal-tower__beam signal-tower__beam--two" :class="{ 'is-on': progressValue >= 67 }" />
        <span class="signal-tower__beam signal-tower__beam--three" :class="{ 'is-on': progressValue === 100 }" />
      </div>
      <div class="path-lights">
        <span
          v-for="article in signalArticles"
          :key="article.id"
          class="path-light"
          :class="{ 'is-on': activeId === article.id || seenArticles.has(article.id) }"
        />
      </div>
      <div
        class="path-runner"
        :style="{ '--runner-progress': progressValue }"
      >
        <span aria-hidden="true" />
      </div>
      <div class="field field--back" />
      <div class="field field--front" />
      <p class="scene-status">信号 {{ progressValue }}%</p>
    </div>

    <div class="signal-path__content">
      <header class="section-heading">
        <p class="section-label">BBB 晨间广播</p>
        <h2 id="signal-path-title">沿着信号小径，读三篇文章</h2>
        <p>这些是可替换的示例文章。每读到一篇，山坡上的信号灯就亮一盏。</p>
      </header>

      <section class="broadcast-tuner" aria-labelledby="broadcast-tuner-title">
        <div class="broadcast-tuner__copy">
          <p>隐藏调频台</p>
          <h3 id="broadcast-tuner-title">把三段文章信号调到同一条线上</h3>
        </div>
        <div class="broadcast-tuner__control">
          <label for="broadcast-frequency">频率 {{ frequency.toString().padStart(2, '0') }}</label>
          <input
            id="broadcast-frequency"
            v-model.number="frequency"
            data-pixel-magnet="soft"
            type="range"
            min="0"
            max="100"
            step="1"
            :disabled="progressValue < 100"
            @input="inspectFrequency"
          />
          <div class="frequency-marks" aria-hidden="true">
            <i
              v-for="(target, index) in BAND_TARGETS"
              :key="target"
              :class="{ 'is-locked': tunedBands.includes(index) }"
              :style="{ left: `${target}%` }"
            />
          </div>
          <p class="tuner-status" aria-live="polite">{{ tunerStatus }}</p>
        </div>
      </section>

      <ol class="article-trail">
        <li v-for="(article, index) in signalArticles" :key="article.id">
          <article
            ref="articleCards"
            class="article-card"
            :class="{ 'is-active': activeId === article.id }"
            :data-article-id="article.id"
            data-pixel-magnet="soft"
            tabindex="0"
            @focus="activateArticle(article.id)"
          >
            <div class="article-card__meta">
              <span>{{ article.signal }}</span>
              <span>{{ article.readingTime }}</span>
              <span>{{ article.note }}</span>
            </div>
            <h3>{{ article.title }}</h3>
            <p>{{ article.summary }}</p>
            <div class="article-card__takeaway">
              <span>带走一句</span>
              <strong>{{ article.takeaway }}</strong>
            </div>
            <span class="article-card__marker" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
          </article>
        </li>
      </ol>
    </div>

    <p class="sr-only" aria-live="polite">文章小径探索进度 {{ progressValue }}%</p>
  </section>
</template>

<style scoped>
.signal-path {
  --rose-50: #fff4f7;
  --rose-100: #f9dce6;
  --rose-300: #eaa1b9;
  --rose-500: #c95f85;
  --plum-700: #63394f;
  --plum-900: #321f2a;
  --leaf: #6f8268;
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr);
  min-height: 100dvh;
  width: 100%;
  box-sizing: border-box;
  color: var(--plum-900);
  background: var(--rose-50);
  text-align: left;
}

.signal-path__scene {
  position: sticky;
  top: 0;
  min-height: 100dvh;
  overflow: hidden;
  background:
    linear-gradient(180deg, #ffdbe7 0 52%, #d8c98c 52% 55%, #8da078 55% 100%);
  border-right: 4px solid var(--plum-700);
  image-rendering: pixelated;
}

.sun {
  position: absolute;
  top: 13%;
  left: 17%;
  width: 76px;
  aspect-ratio: 1;
  background: #fff1b7;
  box-shadow: 0 0 0 8px rgb(255 241 183 / 35%);
}

.cloud {
  position: absolute;
  width: 72px;
  height: 18px;
  background: #fff8fb;
  box-shadow: 18px -14px 0 #fff8fb, 36px 0 0 #fff8fb;
  opacity: 0.82;
}

.cloud--one {
  top: 18%;
  right: 12%;
}

.cloud--two {
  top: 31%;
  left: -5%;
  transform: scale(0.68);
}

.signal-tower {
  position: absolute;
  z-index: 3;
  top: 25%;
  left: 57%;
  width: 124px;
  height: 250px;
}

.signal-tower__mast {
  position: absolute;
  left: 57px;
  top: 32px;
  width: 12px;
  height: 190px;
  background: var(--plum-700);
  box-shadow: -22px 188px 0 8px var(--plum-900), 22px 188px 0 8px var(--plum-900);
}

.signal-tower__cap {
  position: absolute;
  z-index: 2;
  left: 51px;
  top: 18px;
  width: 24px;
  height: 24px;
  background: #ffe3a4;
  border: 4px solid var(--plum-900);
  box-sizing: border-box;
}

.signal-tower__beam {
  position: absolute;
  border: 5px solid transparent;
  border-top-color: rgb(99 57 79 / 32%);
  border-radius: 50%;
  transform: rotate(-28deg);
  transition: border-color 240ms steps(2, end), filter 240ms steps(2, end);
}

.signal-tower__beam.is-on {
  border-top-color: #fff0ad;
  filter: drop-shadow(0 0 4px #fff0ad);
}

.signal-tower__beam--one {
  top: 5px;
  left: 35px;
  width: 48px;
  height: 48px;
}

.signal-tower__beam--two {
  top: -10px;
  left: 20px;
  width: 78px;
  height: 78px;
}

.signal-tower__beam--three {
  top: -25px;
  left: 5px;
  width: 108px;
  height: 108px;
}

.field {
  position: absolute;
  right: -8%;
  bottom: 0;
  left: -8%;
  height: 34%;
  background: repeating-linear-gradient(90deg, transparent 0 36px, rgb(50 31 42 / 24%) 36px 40px);
  transform: skewY(-5deg);
}

.field--back {
  bottom: 13%;
  background-color: #9fad7d;
}

.field--front {
  bottom: -16%;
  background-color: #768c66;
  transform: skewY(6deg);
}

.path-lights {
  position: absolute;
  z-index: 5;
  left: 15%;
  bottom: 18%;
  display: flex;
  align-items: flex-end;
  gap: clamp(30px, 6vw, 72px);
  transform: rotate(7deg);
}

.path-light {
  width: 12px;
  height: 12px;
  background: #6b6658;
  border: 4px solid var(--plum-900);
  box-shadow: 0 18px 0 -3px var(--plum-700);
  transition: background 180ms steps(2, end), box-shadow 180ms steps(2, end);
}

.path-light.is-on {
  background: #fff1a8;
  box-shadow: 0 0 0 6px rgb(255 241 168 / 24%), 0 18px 0 -3px var(--plum-700);
}

.path-runner {
  --runner-progress: 0;
  position: absolute;
  z-index: 6;
  left: 11%;
  bottom: 23%;
  width: 18px;
  height: 26px;
  transform: translateX(calc(var(--runner-progress) * 2.2px));
  transition: transform 560ms steps(8, end);
}

.path-runner::before {
  position: absolute;
  top: 0;
  left: 4px;
  width: 10px;
  height: 10px;
  content: '';
  background: #f2b4c9;
  border: 3px solid var(--plum-900);
}

.path-runner span {
  position: absolute;
  left: 2px;
  bottom: 0;
  width: 14px;
  height: 14px;
  background: var(--rose-500);
  border: 3px solid var(--plum-900);
  box-shadow: -4px 12px 0 -2px var(--plum-900), 8px 12px 0 -2px var(--plum-900);
}

.scene-status {
  position: absolute;
  right: 20px;
  bottom: 20px;
  margin: 0;
  padding: 8px 10px;
  color: #fff7fa;
  background: var(--plum-900);
  border: 3px solid #fff7fa;
  font: 700 0.74rem/1.2 ui-monospace, monospace;
  letter-spacing: 0.08em;
}

.signal-path__content {
  padding: clamp(72px, 10vw, 148px) clamp(24px, 6vw, 88px);
}

.section-heading {
  max-width: 680px;
  margin-bottom: 72px;
}

.section-label {
  margin: 0 0 16px;
  color: var(--rose-500);
  font: 800 0.76rem/1.2 ui-monospace, monospace;
  letter-spacing: 0.14em;
}

.section-heading h2 {
  margin: 0;
  max-width: 14ch;
  color: var(--plum-900);
  font-size: clamp(2rem, 4.6vw, 4.4rem);
  line-height: 1.02;
  letter-spacing: -0.055em;
}

.section-heading > p:last-child {
  max-width: 48ch;
  margin-top: 22px;
  color: var(--plum-700);
  line-height: 1.75;
}

.broadcast-tuner {
  display: grid;
  grid-template-columns: minmax(180px, 0.72fr) minmax(240px, 1.28fr);
  gap: 28px;
  max-width: 760px;
  margin: -28px 0 76px;
  padding: 24px;
  border: 4px solid var(--plum-700);
  background: #382432;
  box-shadow: 8px 8px 0 var(--rose-300);
  color: #fff7fa;
}

.broadcast-tuner__copy > p {
  margin: 0 0 8px;
  color: #f4abc5;
  font: 700 0.7rem/1.3 ui-monospace, monospace;
  letter-spacing: 0.12em;
}

.broadcast-tuner__copy h3 {
  margin: 0;
  font-size: clamp(1.05rem, 1.8vw, 1.42rem);
  line-height: 1.35;
}

.broadcast-tuner__control {
  position: relative;
  min-width: 0;
}

.broadcast-tuner__control label {
  display: block;
  margin-bottom: 11px;
  color: #fff0ad;
  font: 700 0.78rem/1.2 ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}

.broadcast-tuner input[type='range'] {
  width: 100%;
  height: 28px;
  margin: 0;
  accent-color: #f57da8;
  cursor: ew-resize;
}

.broadcast-tuner input:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.frequency-marks {
  position: relative;
  width: calc(100% - 10px);
  height: 12px;
  margin: -3px 5px 0;
}

.frequency-marks i {
  position: absolute;
  top: 0;
  width: 4px;
  height: 8px;
  background: #8e7182;
  transform: translateX(-2px);
}

.frequency-marks i.is-locked {
  height: 12px;
  background: #fff0ad;
  box-shadow: 0 0 0 3px rgb(255 240 173 / 18%);
}

.tuner-status {
  min-height: 2.8em;
  margin: 11px 0 0;
  color: #d9becd;
  font-size: 0.78rem;
  line-height: 1.4;
}

.article-trail {
  display: grid;
  gap: 64px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.article-trail li:nth-child(2) {
  margin-left: clamp(0px, 7vw, 96px);
}

.article-trail li:nth-child(3) {
  margin-right: clamp(0px, 4vw, 54px);
}

.article-card {
  position: relative;
  max-width: 700px;
  padding: clamp(28px, 4vw, 46px);
  overflow: hidden;
  background: #fffafd;
  border: 4px solid var(--plum-700);
  box-shadow: 9px 9px 0 var(--rose-300);
  outline: none;
  transition: transform 180ms steps(3, end), box-shadow 180ms steps(3, end);
}

.article-card:is(:hover, :focus-visible, .is-active) {
  transform: translate(-4px, -4px);
  box-shadow: 13px 13px 0 var(--rose-500);
}

.article-card:focus-visible {
  outline: 4px solid #8a3157;
  outline-offset: 6px;
}

.article-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--rose-500);
  font: 700 0.7rem/1.4 ui-monospace, monospace;
}

.article-card h3 {
  max-width: 19ch;
  margin: 22px 0 16px;
  color: var(--plum-900);
  font-size: clamp(1.45rem, 2.7vw, 2.35rem);
  line-height: 1.18;
  letter-spacing: -0.035em;
}

.article-card > p {
  max-width: 56ch;
  margin: 0;
  color: var(--plum-700);
  line-height: 1.75;
}

.article-card__takeaway {
  display: grid;
  gap: 6px;
  margin-top: 26px;
  padding-top: 18px;
  border-top: 3px dashed var(--rose-100);
}

.article-card__takeaway span {
  color: var(--rose-500);
  font: 700 0.7rem/1.3 ui-monospace, monospace;
}

.article-card__takeaway strong {
  color: var(--plum-900);
  font-size: 0.95rem;
}

.article-card__marker {
  position: absolute;
  right: -5px;
  bottom: -14px;
  color: var(--rose-100);
  font: 900 clamp(4.5rem, 9vw, 7rem)/1 ui-monospace, monospace;
  pointer-events: none;
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

@media (max-width: 820px) {
  .signal-path {
    display: block;
  }

  .signal-path__scene {
    position: relative;
    min-height: 440px;
    border-right: 0;
    border-bottom: 4px solid var(--plum-700);
  }

  .signal-path__content {
    padding: 64px 20px 88px;
  }

  .section-heading {
    margin-bottom: 48px;
  }

  .article-trail {
    gap: 36px;
  }

  .path-runner {
    transform: translateX(calc(var(--runner-progress) * 1.45px));
  }

  .broadcast-tuner {
    grid-template-columns: 1fr;
    gap: 18px;
    margin: 0 0 52px;
    padding: 22px 18px;
  }

  .article-trail li:nth-child(n) {
    margin-inline: 0;
  }

  .article-card {
    padding: 26px 22px;
    box-shadow: 6px 6px 0 var(--rose-300);
  }

  .article-card:is(:hover, :focus-visible, .is-active) {
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0 var(--rose-500);
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-card,
  .path-light,
  .signal-tower__beam,
  .path-runner {
    transition: none;
  }
}
</style>
