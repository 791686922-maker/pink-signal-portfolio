import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export type WorldPhase = 'dawn' | 'day' | 'sunset' | 'night'

type ScrollStoryOptions = {
  onPhaseChange?: (phase: WorldPhase) => void
}

gsap.registerPlugin(ScrollTrigger)

export function useScrollStory(options: ScrollStoryOptions = {}) {
  let context: gsap.Context | undefined
  let media: gsap.MatchMedia | undefined

  onMounted(async () => {
    await nextTick()

    context = gsap.context(() => {
      media = gsap.matchMedia()

      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          '.hero-copy',
          { autoAlpha: 0, y: 34 },
          { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' },
        )

        gsap.fromTo(
          '.hero-world',
          { autoAlpha: 0, scale: 0.94, y: 26 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 1.1, ease: 'power3.out', delay: 0.08 },
        )

        const headings = gsap.utils.toArray<HTMLElement>(
          '.signal-path .section-heading h2, .greenhouse__heading h2, .tool-shed__heading h2, .garden-copy h2, .night-signal__heading h2',
        )

        headings.forEach((heading) => {
          gsap.fromTo(
            heading,
            { autoAlpha: 0.18, y: 30, clipPath: 'inset(0 100% 0 0)' },
            {
              autoAlpha: 1,
              y: 0,
              clipPath: 'inset(0 0% 0 0)',
              ease: 'none',
              scrollTrigger: {
                trigger: heading,
                start: 'top 86%',
                end: 'top 48%',
                scrub: 0.55,
              },
            },
          )
        })

        const visuals = gsap.utils.toArray<HTMLElement>(
          '.project-card__visual, .shed-shelf, .garden, .night-scene',
        )

        visuals.forEach((visual) => {
          gsap.fromTo(
            visual,
            { scale: 0.86, autoAlpha: 0.38 },
            {
              scale: 1,
              autoAlpha: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: visual,
                start: 'top 92%',
                end: 'top 54%',
                scrub: 0.6,
              },
            },
          )
        })

        ScrollTrigger.create({
          start: 0,
          end: 'max',
          onUpdate: ({ progress }) => {
            document.documentElement.style.setProperty('--story-progress', progress.toFixed(4))
          },
        })

        return () => {
          document.documentElement.style.removeProperty('--story-progress')
        }
      })

      const phases: Array<{ selector: string; phase: WorldPhase }> = [
        { selector: '#top', phase: 'dawn' },
        { selector: '#writing', phase: 'day' },
        { selector: '#about', phase: 'sunset' },
        { selector: '#contact', phase: 'night' },
      ]

      phases.forEach(({ selector, phase }) => {
        ScrollTrigger.create({
          trigger: selector,
          start: 'top 58%',
          end: 'bottom 42%',
          onEnter: () => options.onPhaseChange?.(phase),
          onEnterBack: () => options.onPhaseChange?.(phase),
        })
      })
    })

    ScrollTrigger.refresh()
  })

  onBeforeUnmount(() => {
    media?.revert()
    context?.revert()
  })
}
