import type {
  ProjectOut,
  DocumentOut,
  CodeOut,
  SegmentOut,
  AnalysisOut,
  AlertOut,
  ChatMessageOut,
  ConversationPreview,
  EditEventOut,
  ProjectSettings,
  ThresholdDefinition,
  OverviewData,
  FacetData,
  ConsistencyData,
} from "@/types";

const BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function createProject(name: string) {
  return json<ProjectOut>(
    await fetch(`${BASE}/projects/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  );
}

export async function fetchProjects() {
  return json<ProjectOut[]>(await fetch(`${BASE}/projects/`));
}

export async function deleteProject(id: string) {
  await fetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function uploadDocument(
  file: File,
  title: string,
  docType: string,
  projectId: string
) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("title", title);
  fd.append("doc_type", docType);
  fd.append("project_id", projectId);
  return json<{ id: string; title: string; project_id: string }>(
    await fetch(`${BASE}/documents/upload`, { method: "POST", body: fd })
  );
}

export async function pasteDocument(
  title: string,
  text: string,
  docType: string,
  projectId: string
) {
  const fd = new FormData();
  fd.append("title", title);
  fd.append("text", text);
  fd.append("doc_type", docType);
  fd.append("project_id", projectId);
  return json<{ id: string; title: string; project_id: string }>(
    await fetch(`${BASE}/documents/paste`, { method: "POST", body: fd })
  );
}

export async function fetchDocuments(projectId?: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  return json<DocumentOut[]>(
    await fetch(`${BASE}/documents/?${params.toString()}`)
  );
}

export async function fetchDocument(id: string) {
  return json<DocumentOut>(await fetch(`${BASE}/documents/${id}`));
}

export async function deleteDocument(id: string) {
  await fetch(`${BASE}/documents/${id}`, { method: "DELETE" });
}

export async function createCode(
  label: string,
  colour: string,
  userId: string,
  projectId: string,
  definition?: string
) {
  return json<CodeOut>(
    await fetch(`${BASE}/codes/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        colour,
        user_id: userId,
        project_id: projectId,
        ...(definition ? { definition } : {}),
      }),
    })
  );
}

export async function fetchCodes(projectId?: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  return json<CodeOut[]>(
    await fetch(`${BASE}/codes/?${params.toString()}`)
  );
}

export async function updateCode(id: string, patch: { label?: string; colour?: string; definition?: string }) {
  return json<CodeOut>(
    await fetch(`${BASE}/codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function deleteCode(id: string) {
  await fetch(`${BASE}/codes/${id}`, { method: "DELETE" });
}

export async function codeSegment(body: {
  document_id: string;
  text: string;
  start_index: number;
  end_index: number;
  code_id: string;
  user_id: string;
}) {
  return json<SegmentOut>(
    await fetch(`${BASE}/segments/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function batchCreateSegments(
  items: {
    document_id: string;
    text: string;
    start_index: number;
    end_index: number;
    code_id: string;
    user_id: string;
  }[]
) {
  return json<{ created: number }>(
    await fetch(`${BASE}/segments/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
  );
}

export async function fetchSegments(documentId?: string, userId?: string) {
  const params = new URLSearchParams();
  if (documentId) params.set("document_id", documentId);
  if (userId) params.set("user_id", userId);
  return json<SegmentOut[]>(
    await fetch(`${BASE}/segments/?${params.toString()}`)
  );
}

export async function fetchSegment(segmentId: string) {
  return json<SegmentOut>(await fetch(`${BASE}/segments/${segmentId}`));
}

export async function deleteSegment(id: string) {
  await fetch(`${BASE}/segments/${id}`, { method: "DELETE" });
}

export async function triggerAnalysis(codeId: string, userId: string) {
  return json<{ status: string; code_id: string }>(
    await fetch(`${BASE}/segments/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code_id: codeId, user_id: userId }),
    })
  );
}

export async function fetchAnalyses(projectId?: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  return json<AnalysisOut[]>(
    await fetch(`${BASE}/segments/analyses?${params.toString()}`)
  );
}

export async function fetchAlerts(userId: string, unreadOnly = true) {
  const params = new URLSearchParams({
    user_id: userId,
    unread_only: String(unreadOnly),
  });
  return json<AlertOut[]>(
    await fetch(`${BASE}/segments/alerts?${params.toString()}`)
  );
}

export async function fetchCodeSegments(codeId: string, userId = "default") {
  const params = new URLSearchParams({ user_id: userId });
  return json<SegmentOut[]>(
    await fetch(`${BASE}/codes/${codeId}/segments?${params.toString()}`)
  );
}

export async function triggerBatchAudit(projectId: string, userId: string) {
  return json<{ status: string; code_count: number }>(
    await fetch(`${BASE}/segments/batch-audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_id: userId }),
    })
  );
}

export async function markAlertRead(alertId: string) {
  await fetch(`${BASE}/segments/alerts/${alertId}/read`, { method: "PATCH" });
}

export async function fetchSettings() {
  return json<{
    has_api_key: boolean;
    fast_model: string;
    reasoning_model: string;
    embedding_model: string;
  }>(await fetch(`${BASE}/settings`));
}

export async function sendChatMessage(
  message: string,
  projectId: string,
  userId: string,
  conversationId?: string | null,
) {
  return json<{ conversation_id: string; status: string }>(
    await fetch(`${BASE}/chat/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        project_id: projectId,
        user_id: userId,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    })
  );
}

export async function fetchChatHistory(conversationId: string) {
  return json<ChatMessageOut[]>(
    await fetch(`${BASE}/chat/history/${conversationId}`)
  );
}

export async function fetchConversations(projectId: string, userId: string) {
  const params = new URLSearchParams({ project_id: projectId, user_id: userId });
  return json<ConversationPreview[]>(
    await fetch(`${BASE}/chat/conversations?${params.toString()}`)
  );
}

export async function deleteConversation(conversationId: string) {
  await fetch(`${BASE}/chat/conversations/${conversationId}`, { method: "DELETE" });
}

export async function fetchEditHistory(
  projectId: string,
  params?: { document_id?: string; entity_type?: string; limit?: number; offset?: number },
) {
  const qs = new URLSearchParams();
  if (params?.document_id) qs.set("document_id", params.document_id);
  if (params?.entity_type) qs.set("entity_type", params.entity_type);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return json<EditEventOut[]>(
    await fetch(`${BASE}/projects/${projectId}/edit-history?${qs.toString()}`)
  );
}

// ── Project Settings (Perspectives) ─────────────────────────────────

export async function fetchProjectSettings(projectId: string) {
  return json<ProjectSettings>(
    await fetch(`${BASE}/projects/${projectId}/settings`)
  );
}

export async function updateProjectSettings(
  projectId: string,
  patch: { enabled_perspectives?: string[]; thresholds?: Record<string, number> },
) {
  return json<ProjectSettings>(
    await fetch(`${BASE}/projects/${projectId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function fetchThresholdDefinitions() {
  return json<ThresholdDefinition[]>(
    await fetch(`${BASE}/projects/threshold-definitions`)
  );
}

// ── Visualisations ───────────────────────────────────────────────────

export async function fetchVisOverview(projectId: string) {
  return json<OverviewData>(
    await fetch(`${BASE}/projects/${projectId}/vis/overview`)
  );
}

export async function fetchVisFacets(projectId: string, codeId?: string | null) {
  const params = new URLSearchParams();
  if (codeId) params.set("code_id", codeId);
  return json<{ facets: FacetData[] }>(
    await fetch(`${BASE}/projects/${projectId}/vis/facets?${params.toString()}`)
  );
}

export async function fetchVisConsistency(projectId: string, codeId?: string | null) {
  const params = new URLSearchParams();
  if (codeId) params.set("code_id", codeId);
  return json<ConsistencyData>(
    await fetch(`${BASE}/projects/${projectId}/vis/consistency?${params.toString()}`)
  );
}

// ── Facet Explorer (legacy alias) ───────────────────────────────────

export async function fetchFacets(projectId: string, codeId?: string | null) {
  return fetchVisFacets(projectId, codeId);
}

export async function renameFacet(projectId: string, facetId: string, label: string) {
  return json<{ id: string; label: string; label_source: string }>(
    await fetch(`${BASE}/projects/${projectId}/vis/facets/${facetId}/label`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    })
  );
}

export async function suggestFacetLabels(projectId: string, codeId: string) {
  return json<{ facets: unknown[] }>(
    await fetch(
      `${BASE}/projects/${projectId}/vis/facets/suggest-labels?code_id=${encodeURIComponent(codeId)}`,
      { method: "POST" }
    )
  );
}

export async function explainFacet(projectId: string, facetId: string) {
  return json<{ explanation: string; facet_label: string; code_name: string }>(
    await fetch(`${BASE}/projects/${projectId}/vis/facets/${facetId}/explain`, { method: "POST" })
  );
}
