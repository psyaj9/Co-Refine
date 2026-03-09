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
  CodeOverlapData,
  CodeCooccurrenceData,
  TokenResponse,
} from "@/types";

const BASE = "/api";
const TOKEN_KEY = "co_refine_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth (no token required) ─────────────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  return json<TokenResponse>(
    await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  );
}

export async function registerUser(email: string, display_name: string, password: string) {
  return json<TokenResponse>(
    await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, display_name, password }),
    })
  );
}

export async function createProject(name: string) {
  return json<ProjectOut>(
    await apiFetch(`${BASE}/projects/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  );
}

export async function fetchProjects() {
  return json<ProjectOut[]>(await apiFetch(`${BASE}/projects/`));
}

export async function deleteProject(id: string) {
  await apiFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
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
    await apiFetch(`${BASE}/documents/upload`, { method: "POST", body: fd })
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
    await apiFetch(`${BASE}/documents/paste`, { method: "POST", body: fd })
  );
}

export async function fetchDocuments(projectId?: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  return json<DocumentOut[]>(
    await apiFetch(`${BASE}/documents/?${params.toString()}`)
  );
}

export async function fetchDocument(id: string) {
  return json<DocumentOut>(await apiFetch(`${BASE}/documents/${id}`));
}

export async function deleteDocument(id: string) {
  await apiFetch(`${BASE}/documents/${id}`, { method: "DELETE" });
}

export async function createCode(
  label: string,
  colour: string,
  projectId: string,
  definition?: string
) {
  return json<CodeOut>(
    await apiFetch(`${BASE}/codes/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        colour,
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
    await apiFetch(`${BASE}/codes/?${params.toString()}`)
  );
}

export async function updateCode(id: string, patch: { label?: string; colour?: string; definition?: string }) {
  return json<CodeOut>(
    await apiFetch(`${BASE}/codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function deleteCode(id: string) {
  await apiFetch(`${BASE}/codes/${id}`, { method: "DELETE" });
}

export async function codeSegment(body: {
  document_id: string;
  text: string;
  start_index: number;
  end_index: number;
  code_id: string;
}) {
  return json<SegmentOut>(
    await apiFetch(`${BASE}/segments/`, {
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
  }[]
) {
  return json<{ created: number }>(
    await apiFetch(`${BASE}/segments/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
  );
}

export async function fetchSegments(documentId?: string) {
  const params = new URLSearchParams();
  if (documentId) params.set("document_id", documentId);
  return json<SegmentOut[]>(
    await apiFetch(`${BASE}/segments/?${params.toString()}`)
  );
}

export async function fetchSegment(segmentId: string) {
  return json<SegmentOut>(await apiFetch(`${BASE}/segments/${segmentId}`));
}

export async function deleteSegment(id: string) {
  await apiFetch(`${BASE}/segments/${id}`, { method: "DELETE" });
}

export async function triggerAnalysis(codeId: string) {
  return json<{ status: string; code_id: string }>(
    await apiFetch(`${BASE}/segments/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code_id: codeId }),
    })
  );
}

export async function fetchAnalyses(projectId?: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  return json<AnalysisOut[]>(
    await apiFetch(`${BASE}/segments/analyses?${params.toString()}`)
  );
}

export async function fetchAlerts(unreadOnly = true) {
  const params = new URLSearchParams({
    unread_only: String(unreadOnly),
  });
  return json<AlertOut[]>(
    await apiFetch(`${BASE}/segments/alerts?${params.toString()}`)
  );
}

export async function fetchCodeSegments(codeId: string) {
  return json<SegmentOut[]>(
    await apiFetch(`${BASE}/codes/${codeId}/segments`)
  );
}

export async function triggerBatchAudit(projectId: string) {
  return json<{ status: string; code_count: number }>(
    await apiFetch(`${BASE}/segments/batch-audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    })
  );
}

export async function markAlertRead(alertId: string) {
  await apiFetch(`${BASE}/segments/alerts/${alertId}/read`, { method: "PATCH" });
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
  conversationId?: string | null,
) {
  return json<{ conversation_id: string; status: string }>(
    await apiFetch(`${BASE}/chat/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        project_id: projectId,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    })
  );
}

export async function fetchChatHistory(conversationId: string) {
  return json<ChatMessageOut[]>(
    await apiFetch(`${BASE}/chat/history/${conversationId}`)
  );
}

export async function fetchConversations(projectId: string) {
  const params = new URLSearchParams({ project_id: projectId });
  return json<ConversationPreview[]>(
    await apiFetch(`${BASE}/chat/conversations?${params.toString()}`)
  );
}

export async function deleteConversation(conversationId: string) {
  await apiFetch(`${BASE}/chat/conversations/${conversationId}`, { method: "DELETE" });
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
    await apiFetch(`${BASE}/projects/${projectId}/edit-history?${qs.toString()}`)
  );
}

// ── Project Settings (Perspectives) ─────────────────────────────────

export async function fetchProjectSettings(projectId: string) {
  return json<ProjectSettings>(
    await apiFetch(`${BASE}/projects/${projectId}/settings`)
  );
}

export async function updateProjectSettings(
  projectId: string,
  patch: { enabled_perspectives?: string[]; thresholds?: Record<string, number> },
) {
  return json<ProjectSettings>(
    await apiFetch(`${BASE}/projects/${projectId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function fetchThresholdDefinitions() {
  return json<ThresholdDefinition[]>(
    await apiFetch(`${BASE}/projects/threshold-definitions`)
  );
}

// ── Visualisations ───────────────────────────────────────────────────

export async function fetchVisOverview(projectId: string) {
  return json<OverviewData>(
    await apiFetch(`${BASE}/projects/${projectId}/vis/overview`)
  );
}

export async function fetchVisFacets(projectId: string, codeId?: string | null) {
  const params = new URLSearchParams();
  if (codeId) params.set("code_id", codeId);
  return json<{ facets: FacetData[] }>(
    await apiFetch(`${BASE}/projects/${projectId}/vis/facets?${params.toString()}`)
  );
}

export async function fetchVisConsistency(projectId: string, codeId?: string | null) {
  const params = new URLSearchParams();
  if (codeId) params.set("code_id", codeId);
  return json<ConsistencyData>(
    await apiFetch(`${BASE}/projects/${projectId}/vis/consistency?${params.toString()}`)
  );
}

export async function fetchVisOverlap(projectId: string) {
  return json<CodeOverlapData>(
    await apiFetch(`${BASE}/projects/${projectId}/vis/overlap`)
  );
}

export async function fetchVisCooccurrence(projectId: string) {
  return json<CodeCooccurrenceData>(
    await apiFetch(`${BASE}/projects/${projectId}/vis/code-cooccurrence`)
  );
}

// ── Facet Explorer (legacy alias) ───────────────────────────────────

export async function fetchFacets(projectId: string, codeId?: string | null) {
  return fetchVisFacets(projectId, codeId);
}

export async function renameFacet(projectId: string, facetId: string, label: string) {
  return json<{ id: string; label: string; label_source: string }>(
    await apiFetch(`${BASE}/projects/${projectId}/vis/facets/${facetId}/label`, {
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
