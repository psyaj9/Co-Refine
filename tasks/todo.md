# Accessibility, Animation & Panel Usability Refactor

## Phase 0 – Infrastructure ✅
- [x] Install Framer Motion (already in package.json)
- [x] Install test deps: vitest, jest-axe, @testing-library/react, @playwright/test, axe-core
- [x] Create `useReducedMotion` hook
- [x] Create `motion.ts` shared animation variants
- [x] Add `getContrastColor()` to utils.ts (WCAG luminance-based)

## Phase 1 – Panel Usability ✅
- [x] Fix LeftPanel documents section space: remove hard `maxHeight: 30%`, use conditional `flex-1`
- [x] Fix panel toggles: always-visible buttons (opacity-60), increased to 24×40px
- [x] Context-aware icons: PanelLeftClose/Open, PanelRightClose/Open
- [x] Keyboard shortcuts: Ctrl+B (left panel), Ctrl+J (right panel)

## Phase 2 – WCAG Compliance ✅
- [x] LeftPanel: listbox/option roles, keyboard selection, focus-visible rings
- [x] DocumentsTabContent: listbox/option, AnimatePresence list items, keyboard
- [x] CodesTabContent: listbox/option, Enter=load segments, Space=select
- [x] RightPanel: tab cross-fade with AnimatePresence, alert badge aria-label
- [x] AlertsTab: motion.li with slideInRight, dismiss icon aria-hidden
- [x] ChatTab: motion.div chatBubble, role=article, aria-labels
- [x] Toolbar: WAI-ARIA toolbar pattern (ArrowLeft/Right/Home/End), icon aria-hidden
- [x] StatusBar: all icons aria-hidden
- [x] RetrievedSegments: close button aria-label, keyboard nav (tabIndex, onKeyDown)
- [x] HighlightPopover: focus trap, aria-modal, getContrastColor on Apply button, all aria-hidden fixed
- [x] CrossTabulation: scope attributes on all th/td elements
- [x] FrequencyChart: wrapped in `<figure role="img" aria-label="...">`
- [x] AIAnalytics: scope on PerCodeTable headers, pie charts in accessible figures

## Phase 3 – Framer Motion Transitions ✅
- [x] List items: AnimatePresence + motion.li with listItem variants
- [x] Alert items: slideInRight entry animation
- [x] Chat messages: chatBubble entry animation
- [x] Tab content: cross-fade with tabContent variants
- [x] Collapsible sections: AnimatePresence with collapsible variants
- [x] HighlightPopover: scaleIn entry/exit animation
- [x] View mode transitions: AnimatePresence mode="wait" with fadeIn

## Phase 4 – CSS & Reduced Motion ✅
- [x] `prefers-reduced-motion` media query in index.css (kills all CSS animations/transitions)
- [x] All Framer Motion animations respect `useReducedMotion()` hook

## Phase 5 – Test Suite ✅
- [x] vitest.config.ts with jsdom environment + path aliases
- [x] Test setup: matchMedia stub, ResizeObserver stub, jest-dom
- [x] Toolbar.a11y.test.tsx: role=toolbar, axe scan, arrow-key nav, Home/End
- [x] StatusBar.a11y.test.tsx: axe scan, aria-hidden on icons
- [x] utils.a11y.test.ts: getContrastColor (7 cases inc. short hex)
- [x] useReducedMotion.test.ts: default false, matches true, change event
- [x] Playwright e2e/a11y.spec.ts: full-page axe, skip-nav, Ctrl+B, toolbar keyboard
- [x] playwright.config.ts: Chromium, headless
- [x] package.json scripts: test, test:watch, test:e2e

## Validation ✅
- [x] All 16 unit tests passing
- [x] TypeScript compilation: zero errors
- [x] Vite production build: successful
