import json
import uuid
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
from sqlalchemy.orm import Session
from core.models import Facet, FacetAssignment
from core.logging import get_logger
from infrastructure.vector_store.store import get_collection
from infrastructure.llm.client import call_llm
from prompts.facet_label_prompt import build_facet_label_prompt
from features.facets.repository import (
    get_segments_for_code,
    get_active_facets_for_code,
    get_code,
    get_latest_analysis_for_code,
    get_top_assignments_for_facet,
    get_segments_by_ids,
)

logger = get_logger(__name__)

MIN_SEGMENTS_FOR_CLUSTERING = 4
MAX_FACETS = 4
MIN_FACETS = 2


def _compute_optimal_k(embeddings: np.ndarray) -> int:
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
    n = len(embeddings)
    perplexity = min(30, max(2, n - 1))

    try:
        reducer = TSNE(n_components=2, perplexity=perplexity, random_state=42)
        return reducer.fit_transform(embeddings)
    
    except Exception:
        reducer = PCA(n_components=2)
        return reducer.fit_transform(embeddings)


def _get_embeddings_by_ids(user_id: str, ids: list[str]) -> dict[str, list[float]]:

    try:
        collection = get_collection(user_id)
        result = collection.get(ids=ids, include=["embeddings"])
        return {doc_id: emb for doc_id, emb in zip(result["ids"], result["embeddings"])}
    
    except Exception as e:
        logger.warning("Failed to retrieve embeddings from vector store", extra={"error": str(e)})
        return {}


def run_facet_analysis(
    db: Session,
    user_id: str,
    code_id: str,
    project_id: str,
) -> dict:
    segments = get_segments_for_code(db, code_id, user_id)

    if len(segments) < MIN_SEGMENTS_FOR_CLUSTERING:
        return {"status": "skipped", "reason": "not_enough_segments"}

    segment_ids = [s.id for s in segments]
    embeddings_map = _get_embeddings_by_ids(user_id, segment_ids)
    valid_segments = [s for s in segments if s.id in embeddings_map]

    if len(valid_segments) < MIN_SEGMENTS_FOR_CLUSTERING:
        return {"status": "skipped", "reason": "embeddings_not_found"}

    emb_matrix = np.array([embeddings_map[s.id] for s in valid_segments])
    k = _compute_optimal_k(emb_matrix)
    km = KMeans(n_clusters=k, random_state=42, n_init="auto")
    labels = km.fit_predict(emb_matrix)
    centroids = km.cluster_centers_
    coords_2d = _compute_tsne(emb_matrix)

    existing_facets = get_active_facets_for_code(db, code_id, user_id)

    for f in existing_facets:
        f.is_active = False

    new_facets = []

    for cluster_idx in range(k):
        facet = Facet(
            id=str(uuid.uuid4()),
            code_id=code_id,
            project_id=project_id,
            user_id=user_id,
            label=f"Facet {cluster_idx + 1}",
            centroid_json=json.dumps(centroids[cluster_idx].tolist()),
            segment_count=int(np.sum(labels == cluster_idx)),
            is_active=True,
        )
        db.add(facet)
        new_facets.append(facet)

    db.flush()

    for i, seg in enumerate(valid_segments):
        cluster_idx = int(labels[i])
        seg.tsne_x = float(coords_2d[i, 0])
        seg.tsne_y = float(coords_2d[i, 1])

        emb = emb_matrix[i]
        centroid = centroids[cluster_idx]
        norm = np.linalg.norm(emb) * np.linalg.norm(centroid)
        sim = float(np.dot(emb, centroid) / norm) if norm > 0 else 0.0

        assignment = FacetAssignment(
            id=str(uuid.uuid4()),
            segment_id=seg.id,
            facet_id=new_facets[cluster_idx].id,
            similarity_score=sim,
            is_dominant=True,
        )
        db.add(assignment)

    db.commit()

    suggest_facet_labels(db, code_id, new_facets)

    return {"status": "success", "code_id": code_id, "facet_count": k, "segment_count": len(valid_segments)}


def suggest_facet_labels(db: Session, code_id: str, facets: list[Facet]) -> None:
    if not facets:
        return

    code = get_code(db, code_id)

    if not code:
        return

    analysis = get_latest_analysis_for_code(db, code_id)
    code_definition = (analysis.definition if analysis else None) or code.definition

    facet_inputs = []

    for idx, facet in enumerate(facets):
        top_assignments = get_top_assignments_for_facet(db, facet.id, limit=5)
        seg_ids = [a.segment_id for a in top_assignments]
        segs = get_segments_by_ids(db, seg_ids)
        segs_by_id = {s.id: s for s in segs}
        texts = [
            (segs_by_id[a.segment_id].text or "")[:300]
            for a in top_assignments
            if a.segment_id in segs_by_id
        ]
        facet_inputs.append({"facet_index": idx, "segments": texts, "facet": facet})

    try:
        messages = build_facet_label_prompt(
            code_label=code.label,
            code_definition=code_definition,
            facets=[{"facet_index": f["facet_index"], "segments": f["segments"]} for f in facet_inputs],
        )
        result = call_llm(messages)
        suggestions = result.get("facets", [])

        label_map: dict[int, str] = {
            s["facet_index"]: s["suggested_label"]

            for s in suggestions
            if isinstance(s.get("facet_index"), int) and s.get("suggested_label")
        }

        for item in facet_inputs:
            idx = item["facet_index"]
            facet = item["facet"]

            if idx in label_map:
                suggested = label_map[idx]
                facet.label = suggested
                facet.suggested_label = suggested
                facet.label_source = "ai"

        db.commit()
        logger.info(f"Facet labels AI-suggested code_id={code_id} count={len(label_map)}")
        
    except Exception as exc:
        logger.warning(f"Facet label suggestion failed — keeping generic labels code_id={code_id} error={exc}")
