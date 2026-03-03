### 4. Counterfactual Consistency Optimizer

**What it does**  
When consistency_score < 0.55, the LLM generates 2–3 “what-if” re-codings of the exact same text that would achieve higher consistency, plus suggested wording for the code definition.

**Human-in-the-loop**  
One-click “Apply this counterfactual” or “Here’s my better idea” (opens editor).

**Literature grounding**  
- Wachter et al. (2017) & Guidotti et al. (2024) – counterfactual explanations in XAI  
- Cito et al. (2021) – counterfactuals specifically for models of code  
- Karimi et al. (2021) – actionable recourse through counterfactuals

**Novelty**  
Counterfactuals applied to *researcher coding decisions* rather than ML predictions.
