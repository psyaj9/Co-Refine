# Facet Drift Detector & Visualisations Suite — Full Implementation Plan

> **Status**: Ready to implement  
> **Last Updated**: March 2026  
> **Scope**: Feature 1 (Facet Drift Detector) + Interactive Visualisations Suite (replacing Consistency Dashboard)

---

## Overview

Two closely related deliverables, built and deployed together:

1. **Facet Drift Detector** — Backend math + AI agent layer that extracts 2–4 latent sub-meanings ("facets") inside each code using embedding clustering. Flags when a new segment introduces a new facet or shifts the code's emphasis.
2. **Visualisations Suite** — Interactive 3-tab React UI (replacing the static `ConsistencyDashboard`) built with `recharts`, grounded in CAQDAS industry standards (MAXQDA, NVivo, ATLAS.ti). Supports cross-filtering, box plots, scatter plots, and timelines.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Clustering algorithm | `sklearn.cluster.KMeans` (K=2–4) | Simple, fast, deterministic enough for qualitative work |
| Optimal K selection | `sklearn.metrics.silhouette_score` | Auto-selects best K without researcher input |
| 2D scatter coordinates | `sklearn.manifold.TSNE` (fallback: PCA) | Best perceptual cluster separation for small datasets |
| Charting library | `recharts` | Lightweight, JSX-native, React 19 compatible, 447k weekly downloads |
| Frontend routing | Keep `viewMode === "dashboard"` | Avoids cascading breaks; only the display label changes |
| Storage | New `Facet` SQL table + `facet_distribution_json` on `ConsistencyScore` | Append-only, zero impact on existing pipeline |

---

## Phase 1 — Backend Data Layer

### 1.1 Update `backend/database.py`

**Add the `Facet` model** (new table):

```python
class Facet(Base):
    __tablename__ = "facets"

    id = Column(Integer, primary_key=True, index=True)
    code_id = Column(Integer, ForeignKey("codes.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    label = Column(String, nullable=False)            # e.g. "immediate shock"
    centroid_json = Column(Text, nullable=False)      # JSON list of floats (embedding vector)
    segment_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    code = relationship("Code", back_populates="facets")
    project = relationship("Project", back_populates="facets")
    assignments = relationship("FacetAssignment", back_populates="facet")
```

**Add the `FacetAssignment` model** (links segments to facets):

```python
class FacetAssignment(Base):
    __tablename__ = "facet_assignments"

    id = Column(Integer, primary_key=True, index=True)
    segment_id = Column(Integer, ForeignKey("segments.id"), nullable=False)
    facet_id = Column(Integer, ForeignKey("facets.id"), nullable=False)
    similarity_score = Column(Float, nullable=False)  # cosine sim to facet centroid
    is_dominant = Column(Boolean, default=True)       # is this the primary facet?
    assigned_at = Column(DateTime, default=datetime.utcnow)

    segment = relationship("Segment", back_populates="facet_assignments")
    facet = relationship("Facet", back_populates="assignments")
```

**Add `facet_distribution_json` column to `ConsistencyScore`**:

```python
facet_distribution_json = Column(Text, nullable=True)
# Stores: {"facet_id": score, ...} for the segment being scored
```

**Add `tsne_x`, `tsne_y` columns to `Segment`** (for scatter plot):

```python
tsne_x = Column(Float, nullable=True)
tsne_y = Column(Float, nullable=True)
```

**Add back-references** on `Code` and `Project`:

```python
# On Code model:
facets = relationship("Facet", back_populates="code")

# On Project model:
facets = relationship("Facet", back_populates="project")
```

### 1.2 Update `backend/models.py`

Add corresponding Pydantic schemas:

```python
class FacetBase(BaseModel):
    label: str
    segment_count: int
    is_active: bool

class FacetRead(FacetBase):
    id: int
    code_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FacetAssignmentRead(BaseModel):
    facet_id: int
    facet_label: str
    similarity_score: float
    is_dominant: bool

    class Config:
        from_attributes = True

# Vis API response models
class VisOverviewResponse(BaseModel):
    total_segments: int
    total_codes: int
    avg_consistency_score: float
    score_over_time: list[dict]          # [{date, avg_score}]
    top_drifting_codes: list[dict]       # [{code_name, drift_score}]

class FacetExplorerResponse(BaseModel):
    code_id: int
    code_name: str
    facets: list[FacetRead]
    segments: list[dict]                 # [{segment_id, tsne_x, tsne_y, facet_id, text_preview}]

class ConsistencyTabResponse(BaseModel):
    scores_by_code: list[dict]           # [{code_name, scores: [float]}] for box plots
    score_timeline: list[dict]           # [{date, score, code_name}]
```

---

## Phase 2 — Facet Clustering Service

### 2.1 Create `backend/services/facet_clustering.py`

```python
"""
Facet clustering service.
Extracts 2-4 latent sub-meanings (facets) within a code using KMeans on embeddings.
Uses silhouette score to automatically select optimal K.
"""
import json
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
from sqlalchemy.orm import Session
from database import Facet, FacetAssignment, Segment, Code
from services.vector_store import VectorStoreService

MIN_SEGMENTS_FOR_CLUSTERING = 4   # don't cluster until we have enough data
MAX_FACETS = 4
MIN_FACETS = 2


def _compute_optimal_k(embeddings: np.ndarray) -> int:
    """Use silhouette score to pick best K between MIN_FACETS and MAX_FACETS."""
    n = len(embeddings)
    best_k = MIN_FACETS
    best_score = -1.0
    max_k = min(MAX_FACETS, n - 1)
    if max_k < MIN_FACETS:
        return MIN_FACETS
    for k in range(MIN_FACETS, max_k + 1):
        km = KMeans(n_clusters=k, random_state=42, n_init="auto")
        labels = km.fit_predict(embeddings)
        score = silhouette_score(embeddings, labels)
        if score > best_score:
            best_score = score
            best_k = k
    return best_k


def _compute_tsne(embeddings: np.ndarray) -> np.ndarray:
    """Reduce embeddings to 2D for scatter plot. Falls back to PCA if TSNE fails."""
    n = len(embeddings)
    perplexity = min(30, max(2, n - 1))
    try:
        reducer = TSNE(n_components=2, perplexity=perplexity, random_state=42)
        return reducer.fit_transform(embeddings)
    except Exception:
        reducer = PCA(n_components=2)
        return reducer.fit_transform(embeddings)


def run_facet_analysis(
    db: Session,
    vector_store: VectorStoreService,
    code_id: int,
    project_id: int,
) -> dict:
    """
    Main entry point called from _run_background_agents.
    1. Fetch all embeddings for segments under this code.
    2. Cluster into K facets.
    3. Upsert Facet rows and FacetAssignment rows.
    4. Update tsne_x/tsne_y on each Segment.
    5. Return summary dict for WebSocket event.
    """
    # 1. Get all segments for this code
    segments = (
        db.query(Segment)
        .filter(Segment.code_id == code_id, Segment.project_id == project_id)
        .all()
    )
    if len(segments) < MIN_SEGMENTS_FOR_CLUSTERING:
        return {"status": "skipped", "reason": "not_enough_segments"}

    # 2. Fetch embeddings from ChromaDB
    segment_ids = [str(s.id) for s in segments]
    embeddings_map = vector_store.get_embeddings_by_ids(segment_ids)
    valid_segments = [s for s in segments if str(s.id) in embeddings_map]
    if len(valid_segments) < MIN_SEGMENTS_FOR_CLUSTERING:
        return {"status": "skipped", "reason": "embeddings_not_found"}

    emb_matrix = np.array([embeddings_map[str(s.id)] for s in valid_segments])

    # 3. Select optimal K and cluster
    k = _compute_optimal_k(emb_matrix)
    km = KMeans(n_clusters=k, random_state=42, n_init="auto")
    labels = km.fit_predict(emb_matrix)
    centroids = km.cluster_centers_

    # 4. Compute 2D coordinates
    coords_2d = _compute_tsne(emb_matrix)

    # 5. Upsert Facets in DB
    existing_facets = (
        db.query(Facet)
        .filter(Facet.code_id == code_id, Facet.is_active == True)
        .all()
    )
    # Simple strategy: replace all active facets for this code with new cluster results
    for f in existing_facets:
        f.is_active = False

    new_facets = []
    for cluster_idx in range(k):
        centroid = centroids[cluster_idx].tolist()
        facet = Facet(
            code_id=code_id,
            project_id=project_id,
            label=f"Facet {cluster_idx + 1}",   # LLM will later rename these
            centroid_json=json.dumps(centroid),
            segment_count=int(np.sum(labels == cluster_idx)),
            is_active=True,
        )
        db.add(facet)
        new_facets.append(facet)

    db.flush()  # get IDs

    # 6. Upsert FacetAssignments + update tsne coords
    for i, seg in enumerate(valid_segments):
        cluster_idx = int(labels[i])
        seg.tsne_x = float(coords_2d[i, 0])
        seg.tsne_y = float(coords_2d[i, 1])

        # Cosine similarity to dominant centroid
        emb = emb_matrix[i]
        centroid = centroids[cluster_idx]
        norm = np.linalg.norm(emb) * np.linalg.norm(centroid)
        sim = float(np.dot(emb, centroid) / norm) if norm > 0 else 0.0

        assignment = FacetAssignment(
            segment_id=seg.id,
            facet_id=new_facets[cluster_idx].id,
            similarity_score=sim,
            is_dominant=True,
        )
        db.add(assignment)

    db.commit()

    return {
        "status": "success",
        "code_id": code_id,
        "facet_count": k,
        "segment_count": len(valid_segments),
    }
```

### 2.2 Update `backend/services/vector_store.py`

Add the `get_embeddings_by_ids` method (fetches raw vectors from ChromaDB by document IDs):

```python
def get_embeddings_by_ids(self, ids: list[str]) -> dict[str, list[float]]:
    """Returns {id: embedding_vector} for all matching documents."""
    try:
        result = self.collection.get(ids=ids, include=["embeddings"])
        return {
            doc_id: emb
            for doc_id, emb in zip(result["ids"], result["embeddings"])
        }
    except Exception:
        return {}
```

---

## Phase 3 — Backend Orchestration

### 3.1 Update `backend/routers/segments.py`

Inside `_run_background_agents`, after Stage 1 scores are calculated and committed, inject facet analysis:

```python
# --- Existing Stage 1 code ends here ---

# ---- Facet Analysis (runs after Stage 1) ----
from services.facet_clustering import run_facet_analysis

facet_result = run_facet_analysis(
    db=db,
    vector_store=vector_store,
    code_id=segment.code_id,
    project_id=segment.project_id,
)

if facet_result["status"] == "success":
    await ws_manager.broadcast(
        project_id=segment.project_id,
        event={
            "type": "facet_updated",
            "code_id": segment.code_id,
            "facet_count": facet_result["facet_count"],
            "segment_count": facet_result["segment_count"],
        },
    )

# ---- Continue to Stage 2 / Stage 3 as normal ----
```

---

## Phase 4 — Visualisations API Endpoints

### 4.1 Create `backend/routers/vis.py`

Three endpoints powering the three frontend tabs:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db, Project, Segment, Code, ConsistencyScore, Facet, FacetAssignment
import json

router = APIRouter(prefix="/api/projects/{project_id}/vis", tags=["visualisations"])


@router.get("/overview")
def get_vis_overview(project_id: int, db: Session = Depends(get_db)):
    """Tab 1: Project-level summary stats + score-over-time series."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404)

    total_segments = db.query(func.count(Segment.id)).filter(
        Segment.project_id == project_id
    ).scalar()
    total_codes = db.query(func.count(Code.id)).filter(
        Code.project_id == project_id
    ).scalar()

    scores = (
        db.query(ConsistencyScore)
        .join(Segment, ConsistencyScore.segment_id == Segment.id)
        .filter(Segment.project_id == project_id)
        .order_by(ConsistencyScore.created_at)
        .all()
    )

    avg_score = (
        sum(s.overall_score for s in scores) / len(scores) if scores else 0.0
    )

    # Group scores by date for trend line
    score_over_time = {}
    for s in scores:
        date_str = s.created_at.strftime("%Y-%m-%d")
        score_over_time.setdefault(date_str, []).append(s.overall_score)
    score_trend = [
        {"date": d, "avg_score": sum(v) / len(v)}
        for d, v in sorted(score_over_time.items())
    ]

    # Top drifting codes (std dev of scores as proxy for drift)
    import numpy as np
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    top_drifting = []
    for code in codes:
        code_scores = [
            s.overall_score
            for s in scores
            if db.query(Segment).filter(Segment.id == s.segment_id, Segment.code_id == code.id).first()
        ]
        if len(code_scores) >= 2:
            top_drifting.append({
                "code_name": code.name,
                "drift_score": float(np.std(code_scores)),
            })
    top_drifting.sort(key=lambda x: x["drift_score"], reverse=True)

    return {
        "total_segments": total_segments,
        "total_codes": total_codes,
        "avg_consistency_score": round(avg_score, 3),
        "score_over_time": score_trend,
        "top_drifting_codes": top_drifting[:5],
    }


@router.get("/facets")
def get_vis_facets(project_id: int, code_id: int | None = None, db: Session = Depends(get_db)):
    """Tab 2: Facet explorer. Returns scatter data (tsne_x/y) + facet labels per code."""
    query = db.query(Facet).filter(Facet.project_id == project_id, Facet.is_active == True)
    if code_id:
        query = query.filter(Facet.code_id == code_id)
    facets = query.all()

    result = []
    for facet in facets:
        code = db.query(Code).filter(Code.id == facet.code_id).first()
        assignments = (
            db.query(FacetAssignment)
            .filter(FacetAssignment.facet_id == facet.id)
            .all()
        )
        segments_data = []
        for asgn in assignments:
            seg = db.query(Segment).filter(Segment.id == asgn.segment_id).first()
            if seg and seg.tsne_x is not None:
                segments_data.append({
                    "segment_id": seg.id,
                    "tsne_x": seg.tsne_x,
                    "tsne_y": seg.tsne_y,
                    "similarity_score": asgn.similarity_score,
                    "text_preview": (seg.text or "")[:120],
                })
        result.append({
            "facet_id": facet.id,
            "facet_label": facet.label,
            "code_id": facet.code_id,
            "code_name": code.name if code else "Unknown",
            "segment_count": facet.segment_count,
            "segments": segments_data,
        })

    return {"facets": result}


@router.get("/consistency")
def get_vis_consistency(
    project_id: int,
    code_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Tab 3: Box plots + timeline of consistency scores, filterable by code."""
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    if code_id:
        codes = [c for c in codes if c.id == code_id]

    scores_by_code = []
    timeline = []

    for code in codes:
        segs = db.query(Segment).filter(
            Segment.code_id == code.id, Segment.project_id == project_id
        ).all()
        seg_ids = [s.id for s in segs]
        code_scores = (
            db.query(ConsistencyScore)
            .filter(ConsistencyScore.segment_id.in_(seg_ids))
            .order_by(ConsistencyScore.created_at)
            .all()
        )
        scores_by_code.append({
            "code_name": code.name,
            "code_id": code.id,
            "scores": [s.overall_score for s in code_scores],
        })
        for s in code_scores:
            timeline.append({
                "date": s.created_at.isoformat(),
                "score": s.overall_score,
                "code_name": code.name,
                "code_id": code.id,
            })

    return {
        "scores_by_code": scores_by_code,
        "timeline": sorted(timeline, key=lambda x: x["date"]),
    }


@router.patch("/facets/{facet_id}/label")
def relabel_facet(
    project_id: int,
    facet_id: int,
    body: dict,
    db: Session = Depends(get_db),
):
    """Allow researcher to rename a facet."""
    facet = db.query(Facet).filter(Facet.id == facet_id, Facet.project_id == project_id).first()
    if not facet:
        raise HTTPException(404)
    facet.label = body.get("label", facet.label)
    db.commit()
    return {"id": facet.id, "label": facet.label}
```

### 4.2 Register router in `backend/main.py`

```python
from routers import vis
app.include_router(vis.router)
```

---

## Phase 5 — Frontend Setup

### 5.1 Install `recharts`

```bash
cd frontend
npm install recharts
npm install --save-dev @types/recharts
```

### 5.2 File Structure

New files to create under `frontend/src/components/`:

```
components/
  Visualisations.tsx            ← main shell with 3-tab switcher
  vis/
    VisOverviewTab.tsx           ← Tab 1: project summary + trend line
    FacetExplorerTab.tsx         ← Tab 2: scatter plot per code
    ConsistencyTab.tsx           ← Tab 3: box plots + timeline
```

### 5.3 Update `frontend/src/App.tsx` and `frontend/src/components/Toolbar.tsx`

**No routing changes needed.** Only change the display label from "Consistency Dashboard" → "Visualisations":

In `Toolbar.tsx`:
```tsx
// Before:
<button onClick={() => setViewMode("dashboard")}>Consistency Dashboard</button>

// After:
<button onClick={() => setViewMode("dashboard")}>Visualisations</button>
```

The `viewMode === "dashboard"` value stays unchanged everywhere to avoid breaking existing state logic.

### 5.4 Update `frontend/src/stores/store.ts`

Add `selectedVisCodeId` for cross-filtering:

```typescript
interface VisState {
  selectedVisCodeId: number | null;
  setSelectedVisCodeId: (id: number | null) => void;
}

// Inside create():
selectedVisCodeId: null,
setSelectedVisCodeId: (id) => set({ selectedVisCodeId: id }),
```

---

## Phase 6 — Frontend Components

### 6.1 `Visualisations.tsx` (Shell)

```tsx
import { useState } from "react";
import VisOverviewTab from "./vis/VisOverviewTab";
import FacetExplorerTab from "./vis/FacetExplorerTab";
import ConsistencyTab from "./vis/ConsistencyTab";

type Tab = "overview" | "facets" | "consistency";

export default function Visualisations({ projectId }: { projectId: number }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(["overview", "facets", "consistency"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "overview" ? "Overview" : tab === "facets" ? "Facet Explorer" : "Consistency"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "overview" && <VisOverviewTab projectId={projectId} />}
        {activeTab === "facets" && <FacetExplorerTab projectId={projectId} />}
        {activeTab === "consistency" && <ConsistencyTab projectId={projectId} />}
      </div>
    </div>
  );
}
```

### 6.2 `VisOverviewTab.tsx` (Tab 1)

Components used: `LineChart`, `BarChart` from `recharts`.

```tsx
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from "recharts";

interface OverviewData {
  total_segments: number;
  total_codes: number;
  avg_consistency_score: number;
  score_over_time: { date: string; avg_score: number }[];
  top_drifting_codes: { code_name: string; drift_score: number }[];
}

export default function VisOverviewTab({ projectId }: { projectId: number }) {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/vis/overview`)
      .then((r) => r.json())
      .then(setData);
  }, [projectId]);

  if (!data) return <p className="text-gray-400">Loading overview…</p>;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Total Segments" value={data.total_segments} />
        <KPICard label="Codes" value={data.total_codes} />
        <KPICard label="Avg Consistency" value={`${(data.avg_consistency_score * 100).toFixed(1)}%`} />
      </div>

      {/* Trend line */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-gray-600">Consistency Over Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.score_over_time}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
            <Line type="monotone" dataKey="avg_score" stroke="#3b82f6" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Drift bar chart */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-gray-600">Top Drifting Codes</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.top_drifting_codes} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 11 }} />
            <YAxis dataKey="code_name" type="category" width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => v.toFixed(3)} />
            <Bar dataKey="drift_score" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KPICard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
```

### 6.3 `FacetExplorerTab.tsx` (Tab 2)

Components used: `ScatterChart` from `recharts`. Cross-filtering by clicking a code fires `setSelectedVisCodeId`.

```tsx
import { useEffect, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ZAxis,
} from "recharts";
import { useStore } from "../../stores/store";

const FACET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function FacetExplorerTab({ projectId }: { projectId: number }) {
  const { selectedVisCodeId, setSelectedVisCodeId } = useStore();
  const [facets, setFacets] = useState<any[]>([]);

  useEffect(() => {
    const url = selectedVisCodeId
      ? `/api/projects/${projectId}/vis/facets?code_id=${selectedVisCodeId}`
      : `/api/projects/${projectId}/vis/facets`;
    fetch(url).then((r) => r.json()).then((d) => setFacets(d.facets));
  }, [projectId, selectedVisCodeId]);

  // Group facets by code for multi-series scatter
  const byCode = facets.reduce<Record<string, any[]>>((acc, f) => {
    acc[f.code_name] = acc[f.code_name] || [];
    acc[f.code_name].push(...f.segments.map((s: any) => ({
      x: s.tsne_x,
      y: s.tsne_y,
      facet: f.facet_label,
      text: s.text_preview,
    })));
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Each dot is a coded segment. Clusters = discovered facets. Click a code to filter.
      </p>

      {selectedVisCodeId && (
        <button
          onClick={() => setSelectedVisCodeId(null)}
          className="text-xs text-blue-500 underline"
        >
          ← Show all codes
        </button>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" name="t-SNE 1" tick={{ fontSize: 10 }} />
          <YAxis dataKey="y" name="t-SNE 2" tick={{ fontSize: 10 }} />
          <ZAxis range={[40, 40]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white dark:bg-gray-800 border rounded p-2 text-xs max-w-xs">
                  <p className="font-semibold">{d.facet}</p>
                  <p className="text-gray-500 mt-1">{d.text}</p>
                </div>
              );
            }}
          />
          <Legend />
          {Object.entries(byCode).map(([codeName, points], i) => (
            <Scatter
              key={codeName}
              name={codeName}
              data={points}
              fill={FACET_COLORS[i % FACET_COLORS.length]}
              onClick={() => {
                const fc = facets.find((f) => f.code_name === codeName);
                if (fc) setSelectedVisCodeId(fc.code_id);
              }}
              style={{ cursor: "pointer" }}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Facet label list for renaming */}
      {facets.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-2">Facet Labels (click to rename)</h4>
          <div className="flex flex-wrap gap-2">
            {facets.map((f) => (
              <FacetLabelBadge
                key={f.facet_id}
                facetId={f.facet_id}
                label={f.facet_label}
                projectId={projectId}
                onRenamed={(newLabel) =>
                  setFacets((prev) =>
                    prev.map((x) => (x.facet_id === f.facet_id ? { ...x, facet_label: newLabel } : x))
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FacetLabelBadge({
  facetId, label, projectId, onRenamed,
}: {
  facetId: number; label: string; projectId: number; onRenamed: (l: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);

  const save = () => {
    fetch(`/api/projects/${projectId}/vis/facets/${facetId}/label`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: value }),
    }).then(() => { onRenamed(value); setEditing(false); });
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="text-xs border rounded px-1 py-0.5"
        />
        <button onClick={save} className="text-xs text-green-500">✓</button>
        <button onClick={() => setEditing(false)} className="text-xs text-red-400">✕</button>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer text-xs bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-1 rounded-full border border-blue-200 dark:border-blue-700 hover:bg-blue-100 transition-colors"
    >
      {label}
    </span>
  );
}
```

### 6.4 `ConsistencyTab.tsx` (Tab 3)

Components used: Custom box plot (using `ComposedChart`) + `LineChart` timeline. Cross-filtering links to Facet Explorer.

```tsx
import { useEffect, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, ReferenceLine,
} from "recharts";
import { useStore } from "../../stores/store";

interface ConsistencyData {
  scores_by_code: { code_name: string; code_id: number; scores: number[] }[];
  timeline: { date: string; score: number; code_name: string; code_id: number }[];
}

function computeBoxStats(scores: number[]) {
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const median = sorted[Math.floor(n * 0.5)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const min = sorted[0];
  const max = sorted[n - 1];
  return { min, q1, median, q3, max };
}

export default function ConsistencyTab({ projectId }: { projectId: number }) {
  const { selectedVisCodeId, setSelectedVisCodeId } = useStore();
  const [data, setData] = useState<ConsistencyData | null>(null);

  useEffect(() => {
    const url = selectedVisCodeId
      ? `/api/projects/${projectId}/vis/consistency?code_id=${selectedVisCodeId}`
      : `/api/projects/${projectId}/vis/consistency`;
    fetch(url).then((r) => r.json()).then(setData);
  }, [projectId, selectedVisCodeId]);

  if (!data) return <p className="text-gray-400">Loading consistency data…</p>;

  const boxData = data.scores_by_code
    .filter((c) => c.scores.length >= 2)
    .map((c) => ({ code_name: c.code_name, code_id: c.code_id, ...computeBoxStats(c.scores) }));

  const timelineData = data.timeline.map((t) => ({
    ...t,
    date: new Date(t.date).toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      {selectedVisCodeId && (
        <button onClick={() => setSelectedVisCodeId(null)} className="text-xs text-blue-500 underline">
          ← Show all codes
        </button>
      )}

      {/* Box plots (Q1/median/Q3 as stacked bar approximation) */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-gray-600">
          Score Distribution by Code (min / Q1 / median / Q3 / max)
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={boxData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
            <YAxis dataKey="code_name" type="category" width={120} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, name: string) => [`${(v * 100).toFixed(1)}%`, name]}
            />
            {/* Whisker (min to max) shown via transparent base + actual bars */}
            <Bar dataKey="min" stackId="box" fill="transparent" />
            <Bar dataKey="q1" stackId="box" fill="#bfdbfe" name="Q1–Median" />
            <Bar dataKey="median" stackId="box" fill="#3b82f6" name="Median" barSize={3} />
            <Bar dataKey="q3" stackId="box" fill="#93c5fd" name="Median–Q3" />
            <ReferenceLine x={0.7} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "0.7 threshold", fontSize: 10 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-gray-600">Score Timeline</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
            <Legend />
            <ReferenceLine y={0.7} stroke="#ef4444" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              dot={{ r: 3, cursor: "pointer" }}
              name="Consistency Score"
              strokeWidth={1.5}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-1">
          Click a code in the Overview or Facet Explorer to filter this timeline.
        </p>
      </div>
    </div>
  );
}
```

---

## Phase 7 — WebSocket Events

Extend the existing WebSocket event bus with two new event types:

| Event Type | Payload | Triggered By |
|---|---|---|
| `facet_updated` | `{code_id, facet_count, segment_count}` | After successful `run_facet_analysis` |
| `facet_label_changed` | `{facet_id, new_label}` | After `PATCH /vis/facets/{id}/label` |

In the frontend `ws_manager` listener (wherever existing events are handled), add:

```typescript
case "facet_updated": {
  // Invalidate the facets cache for this code so charts refetch
  queryClient.invalidateQueries(["vis", "facets", event.code_id]);
  break;
}
```

---

## Phase 8 — Python Dependencies

Add to `backend/requirements.txt`:

```
scikit-learn>=1.4.0
numpy>=1.26.0
```

Run:
```bash
pip install scikit-learn numpy
```

---

## File Change Summary

| File | Action | Notes |
|---|---|---|
| `backend/database.py` | Modify | Add `Facet`, `FacetAssignment` models; add columns to `Segment` and `ConsistencyScore` |
| `backend/models.py` | Modify | Add Pydantic schemas for facets and vis API responses |
| `backend/services/facet_clustering.py` | **Create** | New KMeans + TSNE clustering service |
| `backend/services/vector_store.py` | Modify | Add `get_embeddings_by_ids` method |
| `backend/routers/segments.py` | Modify | Inject `run_facet_analysis` call in `_run_background_agents` |
| `backend/routers/vis.py` | **Create** | New router with `/overview`, `/facets`, `/consistency`, `/facets/{id}/label` |
| `backend/main.py` | Modify | Register vis router |
| `backend/requirements.txt` | Modify | Add `scikit-learn`, `numpy` |
| `frontend/src/stores/store.ts` | Modify | Add `selectedVisCodeId` cross-filter state |
| `frontend/src/components/Visualisations.tsx` | **Create** | 3-tab shell (replaces `ConsistencyDashboard.tsx`) |
| `frontend/src/components/vis/VisOverviewTab.tsx` | **Create** | Tab 1: KPI cards + trend line + drift bar chart |
| `frontend/src/components/vis/FacetExplorerTab.tsx` | **Create** | Tab 2: t-SNE scatter + facet label editor |
| `frontend/src/components/vis/ConsistencyTab.tsx` | **Create** | Tab 3: Box plots + timeline + cross-filter |
| `frontend/src/components/Toolbar.tsx` | Modify | Label only: "Consistency Dashboard" → "Visualisations" |
| `frontend/src/App.tsx` | Modify | Swap `<ConsistencyDashboard>` for `<Visualisations>` |
| `frontend/package.json` | Modify | Add `recharts` dependency |

---

## Implementation Order

```
Phase 1  →  database.py + models.py          (data layer first)
Phase 2  →  facet_clustering.py              (pure Python, no integration yet)
Phase 3  →  segments.py injection            (wire clustering into pipeline)
Phase 4  →  vis.py endpoints + main.py       (API ready to test)
Phase 8  →  pip install, requirements.txt    (unblock Phase 2)
Phase 5  →  npm install recharts             (unblock frontend)
Phase 6  →  Visualisations.tsx + vis/*.tsx   (UI components)
Phase 7  →  WS events in frontend listener   (polish)
```

---

## Testing Checklist

- [ ] `Facet` and `FacetAssignment` tables created on app startup (`Base.metadata.create_all`)
- [ ] Clustering does not run for codes with < 4 segments (returns `status: skipped`)
- [ ] `GET /api/projects/{id}/vis/overview` returns valid JSON with expected shape
- [ ] `GET /api/projects/{id}/vis/facets` returns scatter coordinates
- [ ] `GET /api/projects/{id}/vis/consistency` returns box plot data
- [ ] `PATCH /api/projects/{id}/vis/facets/{id}/label` renames a facet
- [ ] Frontend: tab switching works without errors
- [ ] Frontend: selecting a code cross-filters Facet Explorer and Consistency tab
- [ ] Frontend: facet label edit → rename → saved on backend
- [ ] Frontend: `facet_updated` WebSocket event triggers chart re-fetch

---

## Literature & Design Grounding

| Feature | Source |
|---|---|
| Facet/sub-theme detection | Braun & Clarke (2006, 2021); MAXQDA sub-code maps; Ryan & Bernard (2003) |
| t-SNE scatter for segments | Standard practice in NVivo Cluster Analysis; MAXQDA Mixed Methods module |
| Box plots for score distribution | NVivo Matrix Coding Query visualisations; MAXQDA Codeline |
| Cross-filtering | ATLAS.ti co-occurrence table interactivity; MAXQDA Visual Tools |
| Timeline consistency trend | Hinder et al. (2023, 2024) — longitudinal concept drift |
| Silhouette score for auto-K | Standard ML practice; no literature-specific grounding needed |
