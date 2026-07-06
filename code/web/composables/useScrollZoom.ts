/**
 * useScrollZoom — Wrapper-based sticky scroll-zoom effect.
 *
 * Pattern:
 *   <div class="sticky-zoom-wrapper" style="height: 150vh">
 *     <div id="features" class="sticky-zoom-content">
 *       <div class="sticky-zoom-bg bg-canvas-soft ..."></div>
 *       <div class="sticky-zoom-body">
 *         <!-- section content -->
 *       </div>
 *     </div>
 *   </div>
 *
 * The outer wrapper holds the tall scroll height. The inner content is
 * position:sticky, pinned at top:0 with height:100vh and overflow:hidden.
 *
 * Inside the sticky content, a dedicated .sticky-zoom-bg element expands
 * from a card shape to full-screen, driven by --zoom-progress (0→1).
 */

import { onBeforeUnmount } from 'vue'

interface SectionState {
  wrapper: HTMLElement
  content: HTMLElement
}

const sections = new Map<string, SectionState>()
let rafId = 0
let resizeHandler: (() => void) | null = null

function tick() {
  const vh = window.innerHeight

  for (const [, s] of sections) {
    const rect = s.wrapper.getBoundingClientRect()
    const wrapperH = rect.height
    const scrolledPast = -rect.top
    const scrollRange = wrapperH - vh

    let progress: number
    if (scrollRange <= 0) {
      progress = rect.top <= 0 ? 1 : 0
    } else {
      progress = Math.min(1, Math.max(0, scrolledPast / scrollRange))
    }

    s.content.style.setProperty('--zoom-progress', progress.toFixed(4))
  }

  rafId = requestAnimationFrame(tick)
}

function setupGlobalHandlers() {
  if (rafId) return
  rafId = requestAnimationFrame(tick)
  resizeHandler = () => {} // RAF picks up new sizes next frame
  window.addEventListener('resize', resizeHandler, { passive: true })
}

function teardownGlobalHandlers() {
  if (rafId) cancelAnimationFrame(rafId)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  rafId = 0
  resizeHandler = null
}

export function useScrollZoom() {
  /**
   * Register an existing .sticky-zoom-content element by its DOM id.
   * The composable will auto-wrap it in a .sticky-zoom-wrapper if needed.
   *
   * @param id        DOM id of the .sticky-zoom-content element.
   * @param stickyVh  Height of the outer wrapper in vh units (default 150).
   */
  function registerSection(id: string, stickyVh: number = 150) {
    const content = document.getElementById(id)
    if (!content) {
      console.warn(`[useScrollZoom] element #${id} not found`)
      return
    }

    content.classList.add('sticky-zoom-content')

    // Auto-wrap in a .sticky-zoom-wrapper if not already wrapped
    let wrapper = content.closest('.sticky-zoom-wrapper') as HTMLElement | null
    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.classList.add('sticky-zoom-wrapper')
      wrapper.style.height = `${stickyVh}vh`
      content.parentNode!.insertBefore(wrapper, content)
      wrapper.appendChild(content)
    } else {
      wrapper.style.height = `${stickyVh}vh`
    }

    // Incremental z-index so later sections stack above earlier ones
    content.style.setProperty('z-index', String(sections.size + 1))

    setupGlobalHandlers()
    sections.set(id, { wrapper, content })
  }

  function unregisterSection(id: string) {
    const s = sections.get(id)
    if (s) {
      s.content.style.removeProperty('--zoom-progress')
      s.content.style.removeProperty('z-index')
      s.content.classList.remove('sticky-zoom-content')
      s.wrapper.classList.remove('sticky-zoom-wrapper')
      sections.delete(id)
    }
    if (sections.size === 0) teardownGlobalHandlers()
  }

  onBeforeUnmount(() => {
    for (const [id] of sections) unregisterSection(id)
  })

  return { registerSection, unregisterSection }
}
