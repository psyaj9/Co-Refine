"""Visualisations schemas."""
from pydantic import BaseModel


class RelabelFacetBody(BaseModel):
    label: str
