# Co-Refine — Multi-User Support + Inter-Coder Reliability (ICR) Implementation Plan

## Context
This document contains the full discussion between the developer and Grok about extending an existing **solo-researcher dissertation codebase** to support:

- **Multiple users**
- **Inter-Coder Reliability (ICR)** metrics
- While keeping the original **Intra-Coder (self-consistency)** pipeline unchanged

The current system was intentionally designed for **single-user qualitative research**. The goal of this extension is to introduce **multi-user isolation and optional collaborative reliability metrics** without breaking the existing architecture.

---

# Original Developer Question

> "This is my full application at the minute, how would I go about implementing multi user and calculating inter-coder reliability as well as self consistency, would the implementation be very heavy or would it be fairly simple"

---

# Grok's Detailed Response & Implementation Plan

Multi-user support is a **medium-effort change (mostly refactoring + one-time setup).**

Adding **inter-coder reliability (ICR)** on top of the existing **intra-coder (self-consistency)** pipeline is **heavier — roughly 2–3× the work of multi-user alone — but still feasible** because the data model is already **~70% prepared**.

The current codebase is **deliberately solo-researcher-only**, because the dissertation argues philosophically **against traditional ICR approaches**.

However, many tables already contain `user_id` fields such as:

- `ConsistencyScore`
- `AgentAlert`
- `EditEvent`
- `ChatMessage`
- `CodedSegment`

These fields currently use a **hardcoded "default" user** in ~40 locations.

So the architecture is **single-tenant**, but it already contains the necessary structural hooks.

---

# 1. Multi-User Support (Core Isolation)

### Effort
**Fairly Simple – ~2–4 days**

### Goal
Ensure every object belongs to a specific user:

- Project
- Document
- Codes
- Segments
- Alerts
- Messages

No user should be able to access another user's data.

---

## Step 1 — Add a Real User Model

Create a new model.

```python
# backend/core/models/user.py

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
```

Re-export in:

```
core/models/__init__.py
```

Run a migration.

---

## Step 2 — Add Lightweight Authentication

Two options exist.

### Option A (Recommended for Dissertation)
**API Key authentication**

Very simple and takes < 1 day.

```python
# infrastructure/auth.py

async def get_current_user(api_key: str = Header(...)) -> User:
    user = db.query(User).filter(User.api_key == api_key).first()

    if not user:
        raise HTTPException(401)

    return user
```

---

### Option B
**JWT Authentication using fastapi-users**

Adds ~200 lines of code but includes:

- Login
- Registration
- Token refresh

---

## Step 3 — Scope All Queries to the Current User

Add dependency injection for `current_user`.

Example repository update:

```python
def get_project_by_id(db: Session, project_id: str, user: User):
    return db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id
    ).first()
```

This change must be applied across all:

- Routers
- Services
- Repositories

Your `backend-analysis.md` already identifies every location where `"default"` is used.

---

## Step 4 — Database Migration

One migration required.

Changes:

- Add `user_id` foreign key to `Project`
- Cascade ownership to child tables
- Convert existing `user_id` fields to real FKs

---

## Step 5 — Frontend Changes

Very small changes required.

Add:

- Login screen OR
- Store API key in `localStorage`

Update the API client wrapper.

```
shared/api/client.ts
```

Automatically attach the API key to requests.

---

## Effort Summary (Multi-User)

Most work is **mechanical refactoring**.

Once finished, you can remove the entire legacy system:

```
routers/
services/
```

Which significantly simplifies the architecture.

---

# 2. Adding Inter-Coder Reliability (ICR)

This is **heavier than multi-user support**, but still manageable.

The existing **intra-coder self-consistency pipeline remains unchanged**.

ICR becomes a **separate calculation layer**.

---

# Minimal Viable ICR (Backend Only)

Estimated effort: **~2 days**

Create a new endpoint.

```
GET /api/projects/{project_id}/inter-coder-reliability
    ?coders=userA,userB,userC
    &document_id=optional
```

---

# How to Compute ICR

Reuse existing data structures and embeddings.

No new LLM calls required.

### Step 1 — Align Segments

Match segments across users by:

- Exact text match OR
- ≥70% character overlap

---

### Step 2 — Calculate Reliability Metrics

Use `scikit-learn`.

Metrics:

- **Cohen's Kappa** (2 coders)
- **Fleiss' Kappa** (multiple coders)
- **Krippendorff's Alpha**

Also compute:

- Percentage agreement
- Per-code reliability breakdown

---

# Implementation File

Create a new module:

```
features/scoring/inter_coder.py
```

---

# Full Collaborative ICR (Optional Advanced Feature)

Estimated effort: **1–2 weeks**

Additional features would include:

### Project Membership

Add table:

```
project_members
```

Allows multiple users in a project.

---

### Real-Time Presence

Reuse existing WebSocket system.

Show which coder is currently active.

---

### Side-by-Side Comparison UI

Display:

```
User A coding
User B coding
```

For the same document.

---

### Segment-Level Coding Overlay

For each segment show:

```
Coder A → Code X
Coder B → Code Y
Coder C → Code X
```

---

# Overall Effort Summary

| Feature | Effort | Reason |
|------|------|------|
| Multi-user isolation + auth | Medium (3–5 days) | Requires repository/router refactoring |
| Basic ICR endpoint | Medium (2–3 days) | Reuses embeddings and overlap logic |
| Full collaborative UI | Heavy (1–2 weeks) | New UI, permissions, and presence features |
| Intra-coder pipeline | No extra work | Already isolated per user |

---

# Recommended Implementation Order

Safest path:

### Phase 1
Complete backend refactoring described in:

```
backend-analysis.md
```

- Remove legacy code
- Fix architecture layering

---

### Phase 2
Add multi-user support

- User model
- Authentication
- Query scoping

---

### Phase 3
Add ICR calculation endpoint

```
/inter-coder-reliability
```

---

### Phase 4 (Optional)
Add collaborative features.

---

# Quick Wins (One Evening Work)

You could realistically implement the following in a single evening:

1. Add the `User` model
2. Convert all `"default"` users → `current_user.id`
3. Enforce `user_id` foreign keys
4. Add a **Cohen's Kappa reliability endpoint**

---

# Final Note

Your system already contains:

- Embeddings
- Sibling overlap detection
- Audit trail
- WebSocket infrastructure

Which means **you are not starting from scratch**.

---

# Optional Next Steps

You may ask the coding agent to generate:

- Migration SQL
- `inter_coder.py` module
- Authentication middleware
- FastAPI-Users JWT implementation
- Diff-style refactoring list

Example prompt for an AI coding agent:

```
Implement the multi-user plan exactly as described in the following document.

Start with Phase 1 (User model + authentication) and follow the recommended implementation order.
```