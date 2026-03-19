# Co-Refine

![Python](https://img.shields.io/badge/python-3.12%2B-3776AB?logo=python&logoColor=white)
![Frontend](https://img.shields.io/badge/frontend-React%2019-61DAFB?logo=react&logoColor=black)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi&logoColor=white)
![Status](https://img.shields.io/badge/status-research%20prototype-orange)
![License](https://img.shields.io/badge/license-not%20specified-lightgrey)

Co-Refine is a qualitative coding research tool for collaborative document analysis. Researchers upload text-based documents, apply codes to selected segments, and receive AI-assisted audits for consistency, intent alignment, and confidence.

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Why This Project Is Useful](#why-this-project-is-useful)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How To Get Started](#how-to-get-started)
- [Usage Examples](#usage-examples)
- [Where To Get Help](#where-to-get-help)
- [Who Maintains And Contributes](#who-maintains-and-contributes)

## What This Project Does

Co-Refine supports end-to-end qualitative coding workflows:

- Create accounts and work in authenticated projects.
- Upload or paste documents (PDF, DOCX, text).
- Build and maintain a codebook.
- Apply codes to text spans with a guided UI.
- Run deterministic and LLM-assisted audits of coding quality.
- Review disagreement metrics via ICR (Inter-Coder Reliability).
- Explore visual analytics (consistency trends, overlap, facets).
- Receive real-time updates over WebSocket events.

## Why This Project Is Useful

Co-Refine helps research teams improve coding quality with less manual overhead:

- Faster coding feedback: automatic checks surface drift and overlap early.
- Better consistency: deterministic scoring and AI prompts reduce ambiguous code use.
- Team alignment: ICR metrics and disagreement views make coder differences explicit.
- Full traceability: edit history captures how coding decisions evolve.
- Practical architecture: clean feature slices in both backend and frontend make the codebase easier to extend.

## Tech Stack

### Backend

- Python 3.12+
- FastAPI
- SQLAlchemy 2.x + SQLite
- ChromaDB for embeddings/vector search
- Azure OpenAI integration (optional but recommended)

### Frontend

- React 19 + TypeScript
- Zustand state management
- Tailwind CSS + Radix UI
- Vite build tooling
- Vitest + Playwright for tests

## Project Structure

```text
.
├── backend/                  # FastAPI app, feature routers, services, DB models
├── frontend/                 # React SPA, feature slices, shared store/api
├── docs/                     # Additional technical documentation
├── CLAUDE.md                 # Project architecture and engineering conventions
└── README.md
```

Key references:

- System architecture: [docs/SYSTEM_DOCUMENTATION.md](docs/SYSTEM_DOCUMENTATION.md)
- Project conventions: [CLAUDE.md](CLAUDE.md)
- Backend dependencies: [backend/requirements.txt](backend/requirements.txt)
- Frontend scripts/dependencies: [frontend/package.json](frontend/package.json)

## How To Get Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- npm 10+

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd concept-test
```

### 2. Configure backend environment

Create a `.env` file in `backend/` (or set environment variables) with at least:

```env
JWT_SECRET=replace_with_a_long_random_secret
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Optional but required for full AI capabilities:
AZURE_API_KEY=
AZURE_ENDPOINT=
AZURE_API_VERSION=
AZURE_DEPLOYMENT_FAST=
AZURE_DEPLOYMENT_REASONING=
AZURE_EMBEDDING_MODEL=
```

Notes:

- If `JWT_SECRET` is omitted, a temporary secret is generated at runtime and sessions are invalidated on restart.
- Core CRUD flows run locally; AI-heavy features require Azure OpenAI configuration.

### 3. Start backend

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/api/health
```

### 4. Start frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` and `/ws` to `http://localhost:8000`.

## Usage Examples

### Example: register and log in via API

```bash
curl -X POST http://localhost:8000/api/auth/register \
	-H "Content-Type: application/json" \
	-d '{"email":"researcher@example.com","display_name":"Researcher","password":"StrongPassword123"}'
```

```bash
curl -X POST http://localhost:8000/api/auth/login \
	-H "Content-Type: application/json" \
	-d '{"email":"researcher@example.com","password":"StrongPassword123"}'
```

### Example: local development checks

```bash
# Frontend unit tests
cd frontend
npm run test

# Frontend e2e tests
npm run test:e2e
```

### Typical UI flow

1. Register or sign in.
2. Create a project.
3. Upload/paste documents.
4. Create codes in the codebook.
5. Highlight text and apply codes.
6. Review audit alerts, visualisations, and ICR pages.

## Where To Get Help

- Technical deep dive: [docs/SYSTEM_DOCUMENTATION.md](docs/SYSTEM_DOCUMENTATION.md)
- Architecture conventions: [CLAUDE.md](CLAUDE.md)
- Endpoint behavior and data types: see [backend/features](backend/features) (especially each feature's `router.py` and `schemas.py` files)
- Bug reports and feature requests: open an issue in this repository with reproduction steps and logs

## Who Maintains And Contributes

This repository is maintained by the Co-Refine project owner and contributors supporting the dissertation research effort.

### Contributing (quick start)

1. Create a feature branch from `main`.
2. Keep changes scoped to one concern.
3. Run relevant tests before opening a PR.
4. Include a clear summary of behavior changes and any migration/setup impact.

For substantial architectural work, follow the conventions in [CLAUDE.md](CLAUDE.md) to stay aligned with feature boundaries and coding standards.
