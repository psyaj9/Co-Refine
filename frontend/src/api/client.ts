import type {
  ProjectOut,
  DocumentOut,
  CodeOut,
  SegmentOut,
  AnalysisOut,
  AlertOut,
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

export async function fetchSegments(documentId?: string, userId?: string) {
  const params = new URLSearchParams();
  if (documentId) params.set("document_id", documentId);
  if (userId) params.set("user_id", userId);
  return json<SegmentOut[]>(
    await fetch(`${BASE}/segments/?${params.toString()}`)
  );
}

export async function deleteSegment(id: string) {
  await fetch(`${BASE}/segments/${id}`, { method: "DELETE" });
}

export async function triggerAnalysis(codeId: string, userId: string) {
  return json<AnalysisOut>(
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
