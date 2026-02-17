# The Inductive Lens

A qualitative coding tool with AI-assisted analysis for inductive research. Highlight text segments in uploaded documents, assign qualitative codes, and receive real-time AI feedback on coding consistency, interpretive drift, and emergent thematic definitions.

**React + TypeScript** frontend · **FastAPI + SQLite** backend · **OpenRouter** multi-model AI gateway · **ChromaDB** vector search

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- [OpenRouter](https://openrouter.ai/) API key (free tier works)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
cp .env.example .env            # then edit .env and set OPENROUTER_API_KEY
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api/*` and `/ws/*` to port 8000.

---

## Architecture

```
┌───────────────────────────────────────────────┐
│              React Frontend                   │
│        (Vite + TypeScript + Tailwind)         │
└──────┬─────────────────────┬──────────────────┘
       │  REST /api/*        │  WebSocket /ws/{user}
       ▼                     ▼
┌───────────────────────────────────────────────┐
│              FastAPI Backend                  │
├──────┬─────────────┬──────────────────────────┤
│SQLite│  ChromaDB   │  OpenRouter API          │
│(ORM) │  (vectors)  │  (DeepSeek free models)  │
└──────┴─────────────┴──────────────────────────┘
```

### Key Decisions

- **Non-blocking AI** — segment creation returns immediately; AI agents run as `BackgroundTask`s and push results via WebSocket
- **Tiered inference** — fast model for quick checks, reasoning model for deep analysis. Auto-escalation when consistency score < threshold
- **Windowed context** — prompts receive ~2 sentences around the highlight instead of the full document, keeping token cost low
- **Local embeddings** — `all-MiniLM-L6-v2` runs on CPU with zero API cost
- **Server-side secrets** — API key lives in `.env`, never exposed to the browser

---

## Configuration

All settings are in `backend/.env` (loaded via Pydantic Settings):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | *(required)* | OpenRouter API key |
| `FAST_MODEL` | `deepseek/deepseek-chat-v3-0324:free` | Quick tasks (consistency, ghost partner) |
| `REASONING_MODEL` | `deepseek/deepseek-r1:free` | Deep analysis, mediation, escalation |
| `EMBEDDING_MODEL` | `local` | `local` = sentence-transformers, or an OpenRouter model name |
| `CONSISTENCY_ESCALATION_THRESHOLD` | `0.7` | Score below which reasoning model is invoked |
| `DATABASE_URL` | `sqlite:///./qualitative_coding.db` | SQLAlchemy URL |
| `CHROMA_PERSIST_DIR` | `./chroma_data` | ChromaDB storage |

See `.env.example` for a full list with model alternatives.

---

## Data Model

| Table | Purpose |
|-------|---------|
| `projects` | Top-level container |
| `documents` | Uploaded text / PDF / DOCX |
| `codes` | Qualitative code labels + colours |
| `coded_segments` | Highlighted text spans linked to codes |
| `code_analyses` | AI-inferred definitions and lenses |
| `alerts` | Persisted agent notifications |

All relationships use cascade deletes.

---

## AI Agent Pipeline

When a segment is coded, three background agents fire:

1. **Self-Consistency** — vector-searches similar prior segments, asks the fast model if the coding is consistent. Escalates to reasoning model if score < 0.7.
2. **Ghost Partner** — receives windowed context, independently predicts the correct code, flags conflicts.
3. **Auto-Analysis** — when a code reaches 3+ segments, synthesises a grounded definition using the reasoning model.

Each agent persists an alert to the DB and pushes it over WebSocket.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| **Projects** | | |
| GET | `/api/projects/` | List projects |
| POST | `/api/projects/` | Create project |
| DELETE | `/api/projects/{id}` | Delete project + cascade |
| **Documents** | | |
| GET | `/api/documents/` | List (filter by project) |
| POST | `/api/documents/upload` | Upload file |
| POST | `/api/documents/paste` | Paste text |
| DELETE | `/api/documents/{id}` | Delete document |
| **Codes** | | |
| GET | `/api/codes/` | List codes |
| POST | `/api/codes/` | Create code |
| PATCH | `/api/codes/{id}` | Update label/colour |
| DELETE | `/api/codes/{id}` | Delete code |
| **Segments** | | |
| POST | `/api/segments/` | Code a segment (triggers AI) |
| GET | `/api/segments/` | List segments |
| DELETE | `/api/segments/{id}` | Delete segment |
| POST | `/api/segments/analyze` | Trigger analysis |
| GET | `/api/segments/analyses` | Get analyses |
| GET | `/api/segments/alerts` | Get alerts |
| PATCH | `/api/segments/alerts/{id}/read` | Mark read |
| **Settings** | | |
| GET | `/api/settings` | Current model config |
| **WebSocket** | | |
| WS | `/ws/{user_id}` | Real-time alerts |

---

## Frontend

| Component | Purpose |
|-----------|---------|
| `Sidebar` | Project picker, document/code lists, inferred definitions |
| `DocumentViewer` | Document text with colour-coded highlight overlays |
| `DocumentUpload` | Drag-and-drop + paste upload |
| `HighlightPopover` | Code assignment on text selection |
| `AlertPanel` | Real-time AI agent alerts with streaming support |

State managed with **Zustand**. WebSocket auto-reconnects after 3s.

---

## Workflow

1. Create a project → upload documents
2. Create qualitative codes (colours auto-assigned)
3. Highlight text → assign codes via popover
4. AI agents analyse in the background → alerts appear in real-time
5. Hover a code → click 📖 to manually trigger analysis
