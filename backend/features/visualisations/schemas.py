"""Visualisations schemas."""
from pydantic import BaseModel


class RelabelFacetBody(BaseModel):
    label: str


class CodeCooccurrenceOut(BaseModel):
    codes: list[str]
    matrix: list[list[int]]
    total_segments: int
    co_occurrence_counts: dict[str, int] | None = None
