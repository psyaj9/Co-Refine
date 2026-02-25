# Code Propagation Feature – Implementation Plan

## Overview

**Code Propagation** automatically identifies passages across all project documents that may warrant the same code. When a user creates/modifies a code, the system scans every document for semantically similar text and presents "propagation suggestions" in the Alerts panel. The user decides which suggestions to accept.

---

## 1. Backend

### 1.1 New Endpoint

```
POST /api/codes/{code_id}/propagate
```

| Parameter | Source | Description |
|-----------|--------|-------------|
| `code_id` | path | The code to propagate |
| `user_id` | query | Current user |

**Flow:**

1. Fetch the code and all its existing `CodedSegment` rows.
2. For each document in the project, retrieve text content from `file_parser`.
3. Use the ChromaDB vector store to find the top-K most similar chunks (embedding similarity) to the existing coded segments.
4. Filter out any chunks that already overlap with existing segments for this code.
5. Send each candidate through a lightweight LLM confirmation call (Gemini Flash Lite) to verify the passage genuinely fits the code's definition.
6. Return confirmed candidates as `propagation_suggestion` WebSocket alerts.

### 1.2 Trigger Points

| Trigger | When |
|---------|------|
| Code creation | After a new code is first applied to ≥ 1 segment |
| Definition update | After user edits a code's definition |
| Manual | User clicks "Propagate" button on a code |

### 1.3 Propagation Prompt (New File)

Create `backend/prompts/propagation_prompt.py`:

```python
PROPAGATION_PROMPT = """
You are a qualitative research assistant helping propagate codes across documents.

## Code
- **Label:** {code_label}
- **Definition:** {code_definition}

## Example Passages Already Coded
{example_passages}

## Candidate Passage
Document: {document_name}
Text: "{candidate_text}"

## Task
Does this candidate passage fit the code "{code_label}"?
- Consider the code definition and the existing example passages.
- Reply with a JSON object:
  {{ "fits": true/false, "confidence": 0.0-1.0, "reasoning": "..." }}
"""
```

### 1.4 Scanning Strategy

- **Scope:** All documents in the project (not just the active one).
- **Chunking:** Use existing vector store chunks (sentence-level or paragraph-level).
- **Similarity threshold:** `cosine_similarity ≥ 0.65` (configurable in `config.py`).
- **LLM confirmation threshold:** `confidence ≥ 0.7`.
- **Max suggestions per propagation run:** 20 (to avoid overwhelming the user).

### 1.5 WebSocket Alert Format

```json
{
  "type": "propagation_suggestion",
  "code_id": "uuid",
  "code_label": "Theme Name",
  "segment_id": null,
  "data": {
    "document_id": "uuid",
    "document_name": "Interview_03.txt",
    "text": "the candidate passage text...",
    "start_index": 1234,
    "end_index": 1456,
    "confidence": 0.85,
    "reasoning": "This passage discusses the same theme because..."
  }
}
```

---

## 2. Frontend

### 2.1 Alert Rendering

In `RightPanel.tsx` `AlertsTab`, add a new block for `propagation_suggestion` alerts:

- Display the document name and a preview of the candidate text.
- Two buttons:
  - **"Apply Code"** — calls `codeSegment()` with the candidate's text range and code, then dismisses the alert.
  - **"Dismiss"** — removes the alert.

### 2.2 Types Update

Add `"propagation_suggestion"` to the `AlertPayload.type` union in `frontend/src/types/index.ts`.

### 2.3 Store Actions

Add `applyPropagation(alert)` action to the Zustand store:
1. Call `api.codeSegment()` with `document_id`, `text`, `start_index`, `end_index`, `code_id`.
2. Dismiss the alert.
3. Refresh segments if the target document is currently active.

### 2.4 UI Enhancements (Optional)

- Add a "Propagate" button in `ProjectExplorer` next to each code (e.g., a small broadcast icon).
- Show a badge count on codes with pending propagation suggestions.

---

## 3. Configuration

Add to `backend/config.py`:

```python
propagation_similarity_threshold: float = 0.65
propagation_confidence_threshold: float = 0.7
propagation_max_suggestions: int = 20
propagation_enabled: bool = True
```

---

## 4. Database Changes

No schema changes required — propagation suggestions are ephemeral (WebSocket alerts only). If persistence is desired later, the existing `alerts` table can store them.

---

## 5. Implementation Order

1. Create `propagation_prompt.py`
2. Add config constants
3. Add `POST /api/codes/{code_id}/propagate` endpoint in `routers/codes.py`
4. Add propagation scanning logic in `services/ai_analyzer.py`
5. Add `"propagation_suggestion"` to frontend types
6. Add alert rendering in `RightPanel.tsx`
7. Add `applyPropagation` store action
8. (Optional) Add "Propagate" button in `ProjectExplorer`
9. Test with multi-document project
