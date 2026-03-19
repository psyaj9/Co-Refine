"""Project domain constants: perspectives + threshold definitions.

Threshold definitions drive both the settings UI and the default values used when a project has not overridden them. 
Keeping these here means the frontend can request them and render the settings panel dynamically.
"""

AVAILABLE_PERSPECTIVES = [
    {
        "id": "self_consistency",
        "label": "Self-Consistency",
        "description": "Did you apply this code consistently with your own past decisions?",
    },
]

# Threshold keys that are user-configurable.
THRESHOLD_DEFINITIONS: list[dict] = [
    {
        "key": "min_segments_for_consistency",
        "label": "Min. segments for consistency",
        "description": "Number of coded segments needed before consistency checks run",
        "default": 3,
        "min": 1,
        "max": 20,
        "step": 1,
        "type": "int",
    },
    {
        "key": "auto_analysis_threshold",
        "label": "Auto analysis threshold",
        "description": "Segment count that triggers automatic analysis for a code",
        "default": 3,
        "min": 1,
        "max": 20,
        "step": 1,
        "type": "int",
    },
    {
        "key": "vector_search_top_k",
        "label": "Vector search top K",
        "description": "How many similar segments to retrieve for comparison",
        "default": 8,
        "min": 3,
        "max": 30,
        "step": 1,
        "type": "int",
    },
    {
        "key": "drift_warning_threshold",
        "label": "Drift warning threshold",
        "description": "Temporal drift score above which a warning is shown",
        "default": 0.3,
        "min": 0.0,
        "max": 1.0,
        "step": 0.05,
        "type": "float",
    },
    {
        "key": "code_overlap_warning_threshold",
        "label": "Code overlap warning",
        "description": "Centroid similarity above which a code-pair overlap warning fires",
        "default": 0.85,
        "min": 0.5,
        "max": 1.0,
        "step": 0.05,
        "type": "float",
    },
]
