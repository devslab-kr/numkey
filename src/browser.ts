/**
 * IIFE entry — everything under a single `numkey` global for <script> usage,
 * plus auto-init: every `<input data-numkey>` on the page (present now or
 * added later) is bound automatically, so a JSP/PHP page needs exactly one
 * script tag and markup attributes — no JavaScript to write.
 */
export * from './index'

import { observe } from './dom'

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => observe())
  } else {
    observe()
  }
}
