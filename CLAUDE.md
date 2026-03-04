# Co-Refine — Project Guide for Claude Code

## Project Context

**Co-Refine** is a qualitative coding research tool (dissertation project). Researchers upload documents, apply codes to text segments, and receive AI-powered audits of their coding decisions (consistency, intent, confidence). The backend is FastAPI + SQLAlchemy + SQLite + ChromaDB. The frontend is a React 19 SPA.

---

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

---

## Frontend Architecture

### Tech Stack
- **Framework**: React 19 (functional components + hooks only)
- **Language**: TypeScript ~5.7 (strict mode)
- **Styling**: Tailwind CSS 3 with custom design tokens (`surface-*`, `brand-*`, `panel-*`)
- **State**: Zustand v5 (slice-based, composed store)
- **UI Primitives**: Radix UI (`@radix-ui/react-*`)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Build**: Vite 6
- **Tests**: Vitest + React Testing Library + Playwright (e2e) + axe-core (a11y)

### Folder Structure

```
frontend/src/
├── app/
│   ├── App.tsx                          # Root layout: 3-panel resizable + keyboard shortcuts
│   └── main.tsx                         # React root mount
│
├── features/                            # Self-contained feature slices
│   │                                    # Each: components/ + hooks/ + index.ts
│   ├── audit/                           # Audit pipeline alerts & display
│   │   ├── components/
│   │   │   ├── AlertsTab.tsx            # Orchestrator
│   │   │   ├── AlertCard.tsx            # Alert type router
│   │   │   ├── AuditStageProgress.tsx   # 3-stage pipeline progress bar
│   │   │   ├── AuditScoreTable.tsx      # Deterministic scores table
│   │   │   ├── SeverityBadge.tsx        # Severity pill atom
│   │   │   ├── MetricStrip.tsx          # Compact metric display
│   │   │   ├── MetricTooltip.tsx        # Hover tooltip for metrics
│   │   │   ├── CodingAuditCard.tsx      # coding_audit card
│   │   │   ├── CodingAuditDetail.tsx    # Expanded audit detail view
│   │   │   ├── ConsistencyActions.tsx   # Consistency alert actions
│   │   │   ├── GhostPartnerActions.tsx  # Ghost partner alert actions
│   │   │   └── ChallengeForm.tsx        # Challenge input + submit
│   │   ├── hooks/
│   │   │   └── useChallengeSubmit.ts    # Challenge API call + store update
│   │   └── index.ts
│   │
│   ├── chat/
│   │   ├── components/
│   │   │   └── ChatTab.tsx              # Orchestrator
│   │   └── index.ts
│   │
│   ├── codes/                           # Codebook CRUD & search
│   │   ├── components/
│   │   │   ├── CodesTabContent.tsx      # Orchestrator
│   │   │   ├── CodeListItem.tsx         # Single code row
│   │   │   ├── ExpandedCodeDetail.tsx   # Expanded code detail panel
│   │   │   └── RetrievedSegments.tsx    # Similar segments display
│   │   ├── hooks/
│   │   │   └── useCodeActions.ts        # Code CRUD action helpers
│   │   └── index.ts
│   │
│   ├── documents/                       # Document upload, list, viewer
│   │   ├── components/
│   │   │   ├── DocumentsTabContent.tsx  # Orchestrator
│   │   │   ├── DocumentUpload.tsx       # Upload UI
│   │   │   ├── DocumentViewer.tsx       # Annotated document viewer
│   │   │   └── MarginPills.tsx          # Code pills in margin
│   │   └── index.ts
│   │
│   ├── history/
│   │   ├── components/
│   │   │   ├── EditHistoryView.tsx      # Orchestrator
│   │   │   ├── HistoryTimeline.tsx      # Timeline list
│   │   │   └── CodeChangeBanner.tsx     # Diff banner atom
│   │   ├── lib/
│   │   │   └── history-helpers.ts       # Pure history data transforms
│   │   └── index.ts
│   │
│   ├── project/                         # Project management + settings
│   │   ├── components/
│   │   │   ├── AgentSettingsModal.tsx   # Orchestrator (~114L)
│   │   │   ├── PerspectivesTab.tsx      # Perspective checkboxes tab
│   │   │   └── ThresholdsTab.tsx        # Threshold sliders tab
│   │   ├── hooks/
│   │   │   └── useProjectSettings.ts    # Load/save/dirty settings logic
│   │   └── index.ts
│   │
│   ├── selection/                       # Text selection + highlight popover
│   │   ├── components/
│   │   │   ├── HighlightPopover.tsx     # Orchestrator (~94L)
│   │   │   ├── SelectionView.tsx        # New selection: code picker
│   │   │   ├── ClickedSegmentsView.tsx  # Existing coded segment detail
│   │   │   └── PendingApplicationsBar.tsx # Queued applications bar
│   │   ├── hooks/
│   │   │   └── usePopoverInteraction.ts # Dismiss, apply, focus trap
│   │   └── index.ts
│   │
│   └── visualisations/
│       ├── components/
│       │   ├── Visualisations.tsx       # Tab shell
│       │   ├── VisOverviewTab.tsx
│       │   ├── FacetExplorerTab.tsx
│       │   └── ConsistencyTab.tsx
│       └── index.ts
│
├── widgets/                             # Composed layout regions (use features, not vice versa)
│   ├── LeftPanel/
│   │   ├── LeftPanel.tsx
│   │   └── index.ts
│   ├── RightPanel/
│   │   ├── RightPanel.tsx
│   │   └── index.ts
│   ├── Toolbar/
│   │   ├── Toolbar.tsx
│   │   └── index.ts
│   └── StatusBar/
│       ├── StatusBar.tsx
│       └── index.ts
│
└── shared/                              # Cross-feature infrastructure
    ├── __tests__/
    │   ├── setup.ts                     # Vitest setup (jsdom, jest-axe)
    │   └── test-helpers.ts              # Mock factories + defaultStoreState
    ├── api/
    │   ├── client.ts                    # Fetch wrapper for all API endpoints
    │   └── index.ts
    ├── hooks/
    │   ├── useWebSocket.ts              # WS event dispatcher
    │   ├── useTextSelection.ts          # Native selection capture
    │   ├── useDraggable.ts
    │   └── index.ts
    ├── lib/
    │   ├── utils.ts                     # cn(), hexToRgba(), color contrast
    │   ├── constants.ts                 # Color palette + audit explanations
    │   ├── annotated-text.ts            # HTML annotation builders (pure)
    │   ├── alert-helpers.tsx            # Alert data mapping + icon rendering
    │   └── index.ts
    ├── store/
    │   ├── slices/
    │   │   ├── uiSlice.ts               # viewMode, rightPanelTab, showUploadPage, selectedVisCodeId
    │   │   ├── projectSlice.ts          # projects[], activeProjectId, CRUD
    │   │   ├── documentSlice.ts         # documents[], activeDocumentId, CRUD
    │   │   ├── codeSlice.ts             # codes[], activeCodeId, search, CRUD
    │   │   ├── segmentSlice.ts          # segments[], pendingApplications, scrollToSegmentId
    │   │   ├── auditSlice.ts            # alerts[], auditStage, batchAudit, agentsRunning
    │   │   ├── chatSlice.ts             # chatMessages[], streaming
    │   │   └── historySlice.ts          # editHistory[], historyScope
    │   ├── store.ts                     # Compose all slices → useStore
    │   └── index.ts                     # export { useStore }
    ├── types/
    │   └── index.ts                     # All TypeScript interfaces (source of truth)
    └── ui/                              # Shared atomic primitives
        ├── Badge.tsx                    # Pill/badge with variant presets
        ├── IconButton.tsx               # Icon-only button with a11y
        └── index.ts
```

### Architecture Rules

#### Layer Boundaries (STRICT — never violate)
```
app → widgets → features → shared
features → shared            ✓ allowed
shared → features            ✗ FORBIDDEN
features/A → features/B      ✗ FORBIDDEN (use shared/ or lift to widgets/)
widgets → widgets            ✗ FORBIDDEN
```

#### Component Rules
1. **Single Responsibility**: One component, one reason to change. If you find yourself writing "and" to describe what a component does, extract.
2. **Size limit**: No component over ~150 lines. Orchestrator/page components may reach ~200L max.
3. **Orchestrators vs Atoms**: Orchestrators compose smaller components and contain layout. Atoms are pure display with props. Never mix.
4. **No inline business logic in JSX**: Extract to hooks or shared/lib. JSX should be declarative markup only.
5. **useMemo/useCallback**: Only when measurably needed (long lists, expensive computations, stable callbacks passed to memoized children). Don't pre-optimize.

#### Hook Rules
1. Custom hooks live next to the feature they serve in `features/X/hooks/`.
2. Cross-feature hooks live in `shared/hooks/`.
3. Hooks encapsulate: async data fetching, complex local state, derived computations, side effects.
4. Never put JSX in a hook.

#### Store Rules (Zustand Slices)
```typescript
// Pattern for each slice:
export type UiSlice = { viewMode: ViewMode; setViewMode: (v: ViewMode) => void; ... }
export const createUiSlice: StateCreator<AppState, [], [], UiSlice> =
  (set, get) => ({ viewMode: "document", setViewMode: (v) => set({ viewMode: v }), ... })

// Composed in store.ts:
export const useStore = create<AppState>()((...args) => ({
  ...createUiSlice(...args),
  ...createProjectSlice(...args),
  // ...
}))
```
- Each slice owns its own types, state, and actions.
- Cross-slice calls use `get()` to access sibling slice state.
- No async logic directly in components — all async in store slices or custom hooks.

#### Naming Conventions
- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts`, prefixed `use`
- Utilities: `camelCase.ts` (pure functions)
- Types: `PascalCase` interfaces, no `I` prefix
- Feature barrel: `features/X/index.ts` exports only the public surface
- Tests: `ComponentName.test.tsx` colocated with the component

#### Import Rules
```typescript
// Always use path aliases (tsconfig paths):
import { useStore } from "@/shared/store"
import { AlertsTab } from "@/features/audit"
import { cn } from "@/shared/lib/utils"

// Never use deep relative paths from another feature:
import something from "../../features/audit/components/AlertCard" // ✗
```

#### Accessibility (WCAG AA required)
- All interactive elements: `aria-label` or visible text label
- Icon-only buttons: always `aria-label` + `aria-hidden` on the icon SVG
- Modal dialogs: `role="dialog"` + `aria-modal` + focus trap
- Color coding: never convey information by color alone (use text/icon alongside)
- Keyboard nav: Tab order logical, no keyboard traps outside modals

#### TypeScript
- `strict: true` in tsconfig (already set)
- No `any` — use `unknown` and type guard if needed
- Prefer explicit return types on hooks and utility functions
- All component props have named interface: `interface ComponentNameProps { ... }`

#### Testing
- Unit tests colocated with the component: `Foo.tsx` + `Foo.test.tsx`
- Utility/hook tests colocated with the utility
- A11y tests: `Foo.a11y.test.tsx` colocated
- Use `@testing-library/react` — test behavior, not implementation
- `render` helper from `shared/__tests__/test-helpers.ts` wraps all provider setup
- e2e in `e2e/` (Playwright) — tests critical user flows

#### Styling
- Tailwind utility classes only — no CSS modules, no inline `style={{}}` (except dynamic values like color hex)
- Custom tokens in `tailwind.config.js`: `surface-*` (neutrals), `brand-*` (primary), `panel-border`, `panel-bg`
- Dark mode via `dark:` prefix (system preference)
- `cn()` from `@/shared/lib/utils` for conditional class merging

### Design Tokens Reference
```
surface-50 / surface-100 / ... / surface-900  — neutral grays
brand-50 / brand-500 / brand-900             — primary blue
panel-border                                  — 1px border token
panel-bg                                      — panel background token
```

---

## Backend Notes

- **FastAPI** + SQLAlchemy (SQLite) + ChromaDB
- All PKs are `String` (UUID), never Integer
- WebSocket at `ws://localhost:8000/ws/{user_id}` — events dispatched through `useWebSocket.ts`
- Key WS event types: `coding_audit`, `consistency`, `ghost_partner`, `agents_started/done`, `chat_token/done`, `batch_audit_*`, `deterministic_scores`, `reflection_complete`, `challenge_result`, `facet_updated`
- REST API base: `http://localhost:8000`

## Key File Locations

| Concern | File |
|---------|------|
| All TypeScript types | `shared/types/index.ts` |
| Zustand store (composed) | `shared/store/store.ts` |
| API client | `shared/api/client.ts` |
| Color utilities | `shared/lib/utils.ts` |
| Alert data mapping | `shared/lib/alert-helpers.tsx` |
| WS event handler | `shared/hooks/useWebSocket.ts` |
| Root layout | `app/App.tsx` |
| Shared UI atoms | `shared/ui/index.ts` |
| Test helpers | `shared/__tests__/test-helpers.ts` |
