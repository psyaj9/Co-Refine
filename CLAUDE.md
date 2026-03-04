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

## Backend Architecture

### Tech Stack
- **Framework**: FastAPI (Python 3.12+)
- **ORM**: SQLAlchemy 2.x (declarative base)
- **Database**: SQLite (file-based, dev/dissertation scope)
- **Vector Store**: ChromaDB (persistent, cosine distance)
- **Embeddings**: Azure OpenAI or local SentenceTransformer (`all-MiniLM-L6-v2`)
- **LLM**: Azure OpenAI (gpt-5-mini fast model, gpt-5.2 reasoning model)
- **WebSocket**: Native FastAPI WebSocket
- **Validation**: Pydantic v2 (BaseModel for DTOs, BaseSettings for config)
- **Tests**: pytest (planned)

### Architecture: Vertical Slices + Clean Architecture Internals

```
backend/
├── main.py                          # App factory: lifespan, CORS, router mount
│
├── core/                            # Shared kernel — NO feature imports allowed
│   ├── __init__.py
│   ├── config.py                    # Pydantic Settings (from .env)
│   ├── database.py                  # Engine, SessionLocal, Base, get_db()
│   ├── models/                      # SQLAlchemy ORM models (one per aggregate)
│   │   ├── __init__.py              # Re-exports all models
│   │   ├── project.py               # Project
│   │   ├── document.py              # Document
│   │   ├── code.py                  # Code
│   │   ├── segment.py               # CodedSegment
│   │   ├── analysis.py              # AnalysisResult
│   │   ├── alert.py                 # AgentAlert
│   │   ├── chat.py                  # ChatMessage
│   │   ├── edit_event.py            # EditEvent
│   │   ├── consistency_score.py     # ConsistencyScore
│   │   ├── human_feedback.py        # HumanFeedback
│   │   ├── facet.py                 # Facet + FacetAssignment
│   │   └── migrations.py            # Lightweight column migrations + init_db()
│   ├── exceptions.py                # Domain exception hierarchy
│   ├── logging.py                   # Structured logger setup (replaces print())
│   └── events.py                    # WebSocket event type string constants
│
├── infrastructure/                  # External integration adapters
│   ├── __init__.py
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── client.py                # LLMClient protocol + AzureOpenAIClient impl
│   │   └── json_parser.py           # parse_json_response + PARSE_FAILED_SENTINEL
│   ├── vector_store/
│   │   ├── __init__.py
│   │   ├── embeddings.py            # embed_text() — local + API strategies
│   │   ├── store.py                 # ChromaDB collection CRUD (get/add/delete/query)
│   │   └── mmr.py                   # Maximal Marginal Relevance sampling
│   └── websocket/
│       ├── __init__.py
│       └── manager.py               # ConnectionManager + threadsafe send
│
├── features/                        # Vertical slices — one folder per domain
│   ├── __init__.py
│   ├── projects/
│   │   ├── __init__.py
│   │   ├── router.py                # /api/projects CRUD + settings + thresholds
│   │   ├── schemas.py               # ProjectCreate, ProjectOut, ProjectSettingsOut, etc.
│   │   ├── service.py               # Threshold merge, count aggregation
│   │   ├── repository.py            # DB queries (projects, batch counts)
│   │   └── constants.py             # AVAILABLE_PERSPECTIVES, THRESHOLD_DEFINITIONS
│   │
│   ├── documents/
│   │   ├── __init__.py
│   │   ├── router.py                # /api/documents upload, paste, list, get, delete
│   │   ├── schemas.py               # DocumentOut, DocumentUploadResponse
│   │   ├── service.py               # Upload orchestration, text normalization
│   │   ├── repository.py            # DB queries
│   │   └── file_parser.py           # extract_text(), extract_html()
│   │
│   ├── codes/
│   │   ├── __init__.py
│   │   ├── router.py                # /api/codes CRUD
│   │   ├── schemas.py               # CodeCreate, CodeOut, CodeUpdate
│   │   ├── service.py               # Edit-event recording, cascade delete
│   │   └── repository.py            # DB queries
│   │
│   ├── segments/
│   │   ├── __init__.py
│   │   ├── router.py                # /api/segments CRUD + alerts
│   │   ├── schemas.py               # SegmentCreate, SegmentOut, BatchSegmentCreate, AlertOut
│   │   ├── service.py               # Segment create/delete + edit-event recording
│   │   └── repository.py            # DB queries
│   │
│   ├── audit/                       # Refactored from 894-line god module
│   │   ├── __init__.py
│   │   ├── router.py                # /api/segments/analyze, /batch-audit, /challenge
│   │   ├── schemas.py               # AnalysisTrigger, BatchAuditRequest, ChallengeRequest/Response
│   │   ├── orchestrator.py          # Top-level: _run_background_agents (dispatches sub-steps)
│   │   ├── segment_auditor.py       # CORE: audit_single_segment() — shared by all 3 audit flows
│   │   ├── batch_auditor.py         # Batch audit across all project codes
│   │   ├── sibling_auditor.py       # Re-audit overlapping segments on span change
│   │   ├── auto_analyzer.py         # Auto-analysis trigger when segment count reaches threshold
│   │   ├── challenge_handler.py     # Human challenge cycle (pass 3)
│   │   ├── score_persister.py       # ConsistencyScore + AgentAlert write helpers
│   │   └── context_builder.py       # Codebook builder, window extractor, history builder
│   │
│   ├── scoring/                     # Deterministic Stage 1 (pure math, no LLM)
│   │   ├── __init__.py
│   │   ├── centroid.py              # Code centroid + cold-start fallback
│   │   ├── distribution.py          # Softmax, entropy, conflict score
│   │   ├── temporal_drift.py        # LOGOS temporal drift
│   │   ├── code_overlap.py          # GATOS code overlap matrix
│   │   └── pipeline.py              # compute_stage1_scores() aggregator
│   │
│   ├── chat/
│   │   ├── __init__.py
│   │   ├── router.py                # /api/chat send, history, conversations
│   │   ├── schemas.py               # ChatRequest, ChatMessageOut
│   │   ├── service.py               # Context builder + streaming orchestration
│   │   └── repository.py            # DB queries (messages, conversations)
│   │
│   ├── facets/
│   │   ├── __init__.py
│   │   ├── service.py               # KMeans clustering + t-SNE/PCA
│   │   └── repository.py            # Facet + FacetAssignment persistence
│   │
│   ├── visualisations/
│   │   ├── __init__.py
│   │   ├── router.py                # /api/projects/{id}/vis overview, facets, consistency
│   │   ├── schemas.py               # RelabelFacetBody
│   │   └── service.py               # Overview stats, facet explorer, consistency aggregation
│   │
│   └── edit_history/
│       ├── __init__.py
│       ├── router.py                # /api/projects/{id}/edit-history
│       ├── schemas.py               # EditEventOut
│       └── repository.py            # DB queries with filters
│
├── prompts/                         # Prompt builders (shared across features)
│   ├── __init__.py
│   ├── analysis.py
│   ├── audit.py
│   ├── reflection.py
│   ├── challenge.py
│   └── chat.py
│
└── tests/                           # Mirrors feature structure
    ├── conftest.py                  # Fixtures: test DB, mock LLM client, mock ChromaDB
    ├── core/
    ├── infrastructure/
    └── features/
        ├── projects/
        ├── segments/
        ├── audit/
        └── ...
```

### Layer Rules (STRICT)

```
features/X/router.py  →  features/X/service.py  →  features/X/repository.py
                                                 →  infrastructure/*
                                                 →  core/*

  ✓  feature/router   → feature/service, feature/schemas
  ✓  feature/service  → feature/repository, infrastructure/*, core/*
  ✓  feature/service  → prompts/*
  ✗  feature/A        → feature/B           (FORBIDDEN — lift to core/ or infra/)
  ✗  core/*           → features/*          (FORBIDDEN)
  ✗  infrastructure/* → features/*          (FORBIDDEN)

EXCEPTION: features/audit/ may import from features/scoring/ —
  audit is the single consumer of scoring. This is a deliberate "shared kernel" relationship.
```

### Backend Conventions

#### Naming
- **Routers**: `router.py` — one `APIRouter` per file, prefix set in file
- **Services**: `service.py` — stateless functions, receive `db: Session` as parameter
- **Repositories**: `repository.py` — pure DB query functions, no business logic
- **Schemas**: `schemas.py` — Pydantic BaseModel for request/response DTOs
- **ORM Models**: `core/models/X.py` — one file per SQLAlchemy table

#### Error Handling
- **Domain exceptions** in `core/exceptions.py`: `NotFoundError`, `ValidationError`, `ConflictError`, `ExternalServiceError`
- **Router-level mapping**: Catch domain exceptions → HTTPException
- **No bare `except Exception`** — always log with structured logger, re-raise or return sentinel

#### Logging
- Use `core/logging.py` structured logger everywhere
- Replace all `print()` with `logger.info/warning/error`
- Include context: `logger.error("Audit failed", segment_id=..., code_label=...)`

#### Database
- All PKs are `String` (UUID), never Integer
- `get_db()` for request-scoped sessions (FastAPI Depends)
- `SessionLocal()` for background task sessions (create + close in try/finally)
- Relationships use `cascade="all, delete-orphan"` for parent-child

#### WebSocket Events
- 19 event types — constants in `core/events.py`
- Background threads send via `ws_manager.send_alert_threadsafe()`
- Key types: `agents_started`, `agents_done`, `agent_thinking`, `agent_error`,
  `deterministic_scores`, `coding_audit`, `reflection_complete`, `challenge_result`,
  `analysis_updated`, `batch_audit_started/progress/done`, `code_overlap_matrix`,
  `facet_updated`, `chat_stream_start`, `chat_token`, `chat_done`, `chat_error`

#### Testing Strategy
- Unit tests: pytest + `conftest.py` with in-memory SQLite, mocked LLM, mocked ChromaDB
- Integration tests: Full router tests with `TestClient`
- All tests in `backend/tests/` mirroring the feature structure

### Key Backend File Locations

| Concern | File |
|---------|------|
| App entrypoint | `backend/main.py` |
| Config / Settings | `backend/core/config.py` |
| DB engine + session | `backend/core/database.py` |
| All ORM models | `backend/core/models/__init__.py` |
| Domain exceptions | `backend/core/exceptions.py` |
| LLM client | `backend/infrastructure/llm/client.py` |
| Vector store | `backend/infrastructure/vector_store/store.py` |
| WS manager | `backend/infrastructure/websocket/manager.py` |
| Audit pipeline | `backend/features/audit/orchestrator.py` |
| Scoring pipeline | `backend/features/scoring/pipeline.py` |
| Prompt builders | `backend/prompts/*.py` |

---

## Frontend Key File Locations

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
