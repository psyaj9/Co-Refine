"""Project domain constants: perspectives + threshold definitions.

Perspectives are the different lenses the audit pipeline can evaluate coding
decisions through. Right now only self-consistency is implemented, but the
structure is designed to support adding more (e.g. inter-rater, theoretical
grounding) without changing the settings schema.

Threshold definitions drive both the settings UI (sliders, labels, descriptions)
and the default values used when a project hasn't overridden them. Keeping these
here (rather than scattered in config) means the frontend can request them and
render the settings panel dynamically.
"""

AVAILABLE_PERSPECTIVES = [
    {
        "id": "self_consistency",
        "label": "Self-Consistency",
        "description": "Did you apply this code consistently with your own past decisions?",
    },
]

# Threshold keys that are user-configurable, with their defaults + metadata.
# The 'key' must match the corresponding field name in core/config.py (Settings)
# so that get_merged_thresholds() can fall back to the global config default.
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
