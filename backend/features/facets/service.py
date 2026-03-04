"""Facet clustering service.

Extracted from services/facet_clustering.py.
Updated to use infrastructure.vector_store.store directly.
"""
import json
import uuid

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
from sqlalchemy.orm import Session

from core.models import Facet, FacetAssignment, CodedSegment
from core.logging import get_logger
from infrastructure.vector_store.store import get_collection

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
    except Exception:
        return {}


def run_facet_analysis(
    db: Session,
    user_id: str,
    code_id: str,
    project_id: str,
) -> dict:
    """Cluster segments into facets; upsert Facet/FacetAssignment rows."""
    segments = (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
        .all()
    )
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

    existing_facets = (
        db.query(Facet).filter(Facet.code_id == code_id, Facet.is_active == True).all()
    )
    for f in existing_facets:
        f.is_active = False

    new_facets = []
    for cluster_idx in range(k):
        facet = Facet(
            id=str(uuid.uuid4()),
            code_id=code_id,
            project_id=project_id,
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
    return {"status": "success", "code_id": code_id, "facet_count": k, "segment_count": len(valid_segments)}
