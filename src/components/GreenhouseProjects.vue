<script setup lang="ts">
import { computed, ref } from 'vue'
import { greenhouseProjects } from '../data/content'

const props = withDefaults(
  defineProps<{
    revivedFailedProject?: boolean
    hasBattery?: boolean
  }>(),
  {
    revivedFailedProject: false,
    hasBattery: false,
  },
)

const emit = defineEmits<{
  illuminate: [projectId: string]
  reviveRequest: []
}>()

const activeIndex = ref(0)
const lampIndex = ref(0)
const activeProject = computed(() => greenhouseProjects[activeIndex.value])

function selectProject(index: number) {
  activeIndex.value = index
  lampIndex.value = index
  const project = greenhouseProjects[index]
  if (project) emit('illuminate', project.id)
}

function moveLamp() {
  selectProject(lampIndex.value)
}
</script>

<template>
  <section id="lab" class="greenhouse" aria-labelledby="greenhouse-title">
    <header class="greenhouse__heading">
      <p class="greenhouse__label">发明温室</p>
      <h2 id="greenhouse-title">我写下判断，也把它们做成东西</h2>
      <p>这里先放五个可替换项目。第五格保留给没有做成的实验。</p>
    </header>

    <div class="light-console">
      <div>
        <p>可移动生长灯</p>
        <strong>{{ activeProject?.title }}</strong>
      </div>
      <label for="greenhouse-lamp">拖动灯光，照亮一个项目</label>
      <input
        id="greenhouse-lamp"
        v-model.number="lampIndex"
        data-pixel-magnet="soft"
        type="range"
        min="0"
        :max="greenhouseProjects.length - 1"
        step="1"
        @input="moveLamp"
      />
      <div class="lamp-track" aria-hidden="true">
        <i :style="{ left: `${(lampIndex / (greenhouseProjects.length - 1)) * 100}%` }" />
      </div>
    </div>

    <div class="project-grid" role="list" aria-label="BBB 项目示例">
      <article
        v-for="(project, index) in greenhouseProjects"
        :key="project.id"
        class="project-card"
        :class="{
          'is-active': activeIndex === index,
          'is-failed': project.isFailed && !props.revivedFailedProject,
          'is-revived': project.isFailed && props.revivedFailedProject,
        }"
        :data-pixel-drop="project.isFailed ? 'failed-project' : undefined"
        :data-pixel-accept="project.isFailed ? 'old-battery' : undefined"
        data-pixel-magnet="soft"
        tabindex="0"
        role="listitem"
        :aria-current="activeIndex === index ? 'true' : undefined"
        @click="selectProject(index)"
        @focus="selectProject(index)"
        @keydown.enter.prevent="selectProject(index)"
        @keydown.space.prevent="selectProject(index)"
      >
        <div class="project-card__visual" aria-hidden="true">
          <span class="plant plant--left" />
          <span class="plant plant--center" />
          <span class="plant plant--right" />
          <span class="grow-light" />
        </div>

        <div class="project-card__body">
          <div class="project-card__meta">
            <span>{{ project.status }}</span>
            <span class="sample-badge">{{ project.badge }}</span>
          </div>
          <h3>{{ project.title }}</h3>
          <p>{{ project.summary }}</p>

          <p v-if="project.isFailed && props.revivedFailedProject" class="revived-note">
            旧电池已经让这株实验重新发芽。失败记录仍然保留。
          </p>
          <details v-else-if="project.isFailed" class="failure-note">
            <summary>查看停止原因</summary>
            <p>{{ project.detail }}</p>
          </details>
          <p v-else class="project-card__detail">{{ project.detail }}</p>

          <button
            v-if="project.isFailed && props.hasBattery && !props.revivedFailedProject"
            type="button"
            class="battery-action"
            data-pixel-magnet="strong"
            @click.stop="emit('reviveRequest')"
          >
            把旧电池投入温室
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.greenhouse {
  --pink-50: #fff7f9;
  --pink-100: #f9dfe8;
  --pink-300: #eaa6bb;
  --pink-500: #c75d83;
  --plum-700: #653a50;
  --plum-900: #30202a;
  --green-300: #b3c198;
  --green-500: #718269;
  width: 100%;
  padding: clamp(76px, 10vw, 148px) clamp(20px, 6vw, 84px);
  box-sizing: border-box;
  color: var(--plum-900);
  background:
    linear-gradient(90deg, rgb(101 58 80 / 6%) 1px, transparent 1px) 0 0 / 32px 32px,
    linear-gradient(rgb(101 58 80 / 6%) 1px, transparent 1px) 0 0 / 32px 32px,
    #f4eadb;
  text-align: left;
}

.greenhouse__heading {
  max-width: 770px;
  margin: 0 0 64px;
}

.greenhouse__label {
  margin: 0 0 16px;
  color: var(--pink-500);
  font: 800 0.76rem/1.2 ui-monospace, monospace;
  letter-spacing: 0.14em;
}

.greenhouse__heading h2 {
  max-width: 16ch;
  margin: 0;
  color: var(--plum-900);
  font-size: clamp(2rem, 4.8vw, 4.5rem);
  line-height: 1.03;
  letter-spacing: -0.055em;
}

.greenhouse__heading > p:last-child {
  max-width: 44ch;
  margin-top: 22px;
  color: var(--plum-700);
  line-height: 1.7;
}

.light-console {
  display: grid;
  grid-template-columns: minmax(190px, 0.55fr) minmax(220px, 1fr);
  gap: 14px 32px;
  align-items: end;
  max-width: 1320px;
  margin: 0 auto 22px;
  padding: 18px 22px 16px;
  color: #fff9fb;
  background: var(--plum-900);
  border: 4px solid var(--plum-700);
  box-shadow: 7px 7px 0 rgb(101 58 80 / 18%);
}

.light-console p,
.light-console label {
  margin: 0;
  font: 800 0.68rem/1.4 ui-monospace, monospace;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.light-console strong {
  display: block;
  margin-top: 5px;
  color: #ffd6e5;
  font-size: clamp(1.05rem, 2vw, 1.55rem);
}

.light-console input {
  width: 100%;
  margin: 8px 0 0;
  accent-color: #ff87ae;
  cursor: ew-resize;
}

.lamp-track {
  position: relative;
  grid-column: 2;
  height: 18px;
  margin: -7px 8px 0;
  border-top: 3px dotted rgb(255 214 229 / 52%);
}

.lamp-track i {
  position: absolute;
  top: -11px;
  width: 22px;
  height: 14px;
  background: #fff1b0;
  border: 3px solid var(--pink-500);
  box-shadow: 0 12px 0 rgb(255 241 176 / 28%);
  transform: translateX(-50%);
  transition: left 160ms steps(5, end);
}

.project-grid {
  display: grid;
  grid-template-columns: 3.3fr repeat(4, minmax(0, 1fr));
  gap: 0;
  max-width: 1320px;
  margin: 0 auto;
  overflow: hidden;
  background: var(--plum-700);
  border: 4px solid var(--plum-700);
  box-shadow: 10px 10px 0 rgb(101 58 80 / 18%);
  transition: grid-template-columns 420ms steps(9, end);
}

.project-grid:has(.project-card:nth-child(2).is-active) {
  grid-template-columns: 1fr 3.3fr repeat(3, minmax(0, 1fr));
}

.project-grid:has(.project-card:nth-child(3).is-active) {
  grid-template-columns: repeat(2, minmax(0, 1fr)) 3.3fr repeat(2, minmax(0, 1fr));
}

.project-grid:has(.project-card:nth-child(4).is-active) {
  grid-template-columns: repeat(3, minmax(0, 1fr)) 3.3fr 1fr;
}

.project-grid:has(.project-card:nth-child(5).is-active) {
  grid-template-columns: repeat(4, minmax(0, 1fr)) 3.3fr;
}

.project-card {
  position: relative;
  display: grid;
  grid-template-rows: minmax(230px, 0.9fr) minmax(250px, 1.1fr);
  min-width: 0;
  min-height: 590px;
  overflow: hidden;
  background: var(--pink-50);
  border: 0;
  border-right: 3px solid var(--plum-700);
  outline: none;
  cursor: pointer;
  transition: background 180ms steps(3, end), filter 180ms steps(3, end);
}

.project-card:last-child {
  border-right: 0;
}

.project-card:not(.is-active) {
  filter: saturate(0.66) brightness(0.97);
}

.project-card:is(:hover, :focus-visible) {
  background: #fffafd;
  filter: none;
}

.project-card:focus-visible {
  z-index: 2;
  outline: 4px solid #fff1b0;
  outline-offset: -7px;
}

.project-card__visual {
  position: relative;
  min-height: 230px;
  overflow: hidden;
  background:
    linear-gradient(90deg, transparent 48%, rgb(101 58 80 / 15%) 48% 52%, transparent 52%) 0 0 / 46px 100%,
    linear-gradient(transparent 47%, rgb(101 58 80 / 15%) 47% 53%, transparent 53%) 0 0 / 100% 46px,
    #f6c9d7;
  border-bottom: 4px solid var(--plum-700);
}

.project-card__body {
  align-self: stretch;
  min-width: 0;
  padding: clamp(22px, 2.4vw, 34px);
}

.project-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px 12px;
  color: var(--pink-500);
  font: 800 0.7rem/1.3 ui-monospace, monospace;
}

.sample-badge {
  padding: 4px 7px;
  color: #fff9fb;
  background: var(--plum-700);
  border: 2px solid var(--plum-900);
}

.project-card h3 {
  margin: 18px 0 12px;
  color: var(--plum-900);
  font-size: clamp(1.35rem, 2.5vw, 2.25rem);
  line-height: 1.1;
  letter-spacing: -0.035em;
}

.project-card:not(.is-active) .project-card__body {
  padding: 22px 16px;
}

.project-card:not(.is-active) h3 {
  font-size: clamp(1rem, 1.45vw, 1.25rem);
  overflow-wrap: anywhere;
}

.project-card:not(.is-active) .sample-badge,
.project-card:not(.is-active) .project-card__body > p,
.project-card:not(.is-active) .failure-note,
.project-card:not(.is-active) .battery-action {
  display: none;
}

.project-card__body > p {
  margin: 0;
  color: var(--plum-700);
  line-height: 1.65;
}

.project-card__detail {
  margin-top: 18px !important;
  padding-top: 14px;
  border-top: 3px dashed var(--pink-100);
  font-size: 0.78rem;
}

.failure-note {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 3px dashed #b9a99c;
  color: var(--plum-700);
}

.failure-note summary {
  width: fit-content;
  color: var(--plum-900);
  font-weight: 800;
  cursor: pointer;
}

.failure-note summary:focus-visible {
  outline: 3px solid #873358;
  outline-offset: 4px;
}

.failure-note p {
  margin: 12px 0 0;
  line-height: 1.6;
}

.plant {
  position: absolute;
  bottom: 25px;
  width: 24px;
  height: 42px;
  background: var(--green-500);
  border: 4px solid var(--plum-700);
  box-shadow: -12px -13px 0 -5px var(--green-300), 12px -24px 0 -5px var(--green-300);
  transform-origin: bottom;
  transition: transform 260ms steps(3, end);
}

.plant::after {
  content: '';
  position: absolute;
  left: -12px;
  bottom: -22px;
  width: 40px;
  height: 20px;
  background: #ae765f;
  border: 4px solid var(--plum-700);
}

.plant--left {
  left: 17%;
  transform: scale(0.72);
}

.plant--center {
  left: 47%;
  transform: scale(1.1);
}

.plant--right {
  right: 14%;
  transform: scale(0.86);
}

.grow-light {
  position: absolute;
  top: 20px;
  left: 18%;
  width: 64%;
  height: 12px;
  background: #fff1b0;
  border: 4px solid var(--plum-700);
  box-shadow: 0 10px 0 rgb(255 241 176 / 24%);
  transition: box-shadow 180ms steps(2, end), background 180ms steps(2, end);
}

.project-card:is(:hover, :focus-visible, .is-active) .grow-light {
  background: #fff8d7;
  box-shadow: 0 14px 0 rgb(255 241 176 / 42%);
}

.project-card:is(:hover, :focus-visible, .is-active) .plant--center {
  transform: scale(1.16) translateY(-4px);
}

.is-failed {
  background: #ebe4dc;
  border-color: #78655f;
  box-shadow: 7px 7px 0 rgb(76 59 55 / 18%);
}

.is-failed .project-card__visual {
  background:
    linear-gradient(90deg, transparent 48%, rgb(76 59 55 / 14%) 48% 52%, transparent 52%) 0 0 / 36px 100%,
    #c6b9ad;
  border-color: #78655f;
}

.is-failed .plant {
  filter: grayscale(0.72);
  transform: rotate(18deg) scale(0.72);
}

.is-failed .plant--left,
.is-failed .plant--right {
  display: none;
}

.is-failed .grow-light {
  background: #b8aaa0;
  box-shadow: none;
}

.is-revived {
  background: #fff9e7;
}

.is-revived .project-card__visual {
  background:
    radial-gradient(circle at 50% 28%, rgb(255 241 176 / 62%) 0 18%, transparent 19%),
    linear-gradient(90deg, transparent 48%, rgb(101 58 80 / 12%) 48% 52%, transparent 52%) 0 0 / 38px 100%,
    #efc8d5;
}

.is-revived .plant {
  background: #6f9065;
  animation: revived-grow 880ms steps(7, end) both;
}

.revived-note {
  margin-top: 18px !important;
  padding-top: 14px;
  border-top: 3px dashed #d49a61;
  color: #704e37 !important;
  font-weight: 800;
}

.battery-action {
  margin-top: 18px;
  padding: 10px 12px;
  color: #fff9fb;
  background: var(--pink-500);
  border: 3px solid var(--plum-900);
  box-shadow: 4px 4px 0 var(--plum-700);
  font: 800 0.75rem/1.3 ui-monospace, monospace;
  cursor: pointer;
}

.battery-action:active {
  transform: translate(3px, 3px);
  box-shadow: 1px 1px 0 var(--plum-700);
}

@keyframes revived-grow {
  from { transform: translateY(34px) scale(0.55); }
  to { transform: translateY(0) scale(1.08); }
}

@media (max-width: 1040px) {
  .light-console {
    grid-template-columns: 1fr;
  }

  .lamp-track {
    grid-column: 1;
  }

  .project-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 16px;
    overflow: visible;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  .project-card:nth-child(n) {
    grid-template-rows: 190px auto;
    min-height: 480px;
    border: 4px solid var(--plum-700);
    box-shadow: 6px 6px 0 rgb(101 58 80 / 18%);
  }

  .project-card__visual {
    min-height: 180px;
    border-bottom: 4px solid var(--plum-700);
  }

  .project-card:not(.is-active) .project-card__body {
    padding: 22px;
  }

  .project-card:not(.is-active) .sample-badge {
    display: inline;
  }

  .project-card:not(.is-active) .project-card__body > p,
  .project-card:not(.is-active) .failure-note,
  .project-card:not(.is-active) .battery-action {
    display: block;
  }
}

@media (max-width: 700px) {
  .greenhouse {
    padding: 68px 20px 88px;
  }

  .greenhouse__heading {
    margin-bottom: 44px;
  }

  .project-grid {
    grid-template-columns: 1fr !important;
    gap: 20px;
  }

  .project-card:nth-child(n) {
    grid-column: 1;
  }

  .project-card {
    box-shadow: 5px 5px 0 rgb(101 58 80 / 18%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .project-card,
  .plant,
  .grow-light,
  .project-grid,
  .lamp-track i {
    transition: none;
  }

  .is-revived .plant {
    animation: none;
  }
}
</style>
