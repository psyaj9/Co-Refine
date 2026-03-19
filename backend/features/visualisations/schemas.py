"""Visualisations schemas — request bodies and response models for vis endpoints."""
from pydantic import BaseModel


class RelabelFacetBody(BaseModel):
    """Request body for PATCH /facets/{facet_id}/label."""
    label: str


class CodeCooccurrenceOut(BaseModel):
    """Response for the code co-occurrence matrix endpoint.

    codes: Ordered list of code labels (index corresponds to matrix rows/cols).
    matrix: n×n count matrix. Diagonal = total usage per code.
            Off-diagonal [i][j] = spans where both code i and code j were applied.
    total_segments: Total number of distinct text spans coded in this project.
    co_occurrence_counts: Flattened upper-triangle counts as "CodeA__CodeB" → count.
                          Useful for heatmap rendering without unpacking the full matrix.
    """
    codes: list[str]
    matrix: list[list[int]]
    total_segments: int
    co_occurrence_counts: dict[str, int] | None = None
