export interface ProjectOut {
  id: string;
  name: string;
  document_count: number;
  code_count: number;
  created_at: string;
}

export interface DocumentOut {
  id: string;
  title: string;
  full_text: string;
  doc_type: string;
  html_content: string | null;
  project_id: string;
  created_at: string;
}

export interface CodeOut {
  id: string;
  label: string;
  definition: string | null;
  colour: string;
  created_by: string;
  project_id: string;
  segment_count: number;
}

export interface SegmentOut {
  id: string;
  document_id: string;
  text: string;
  start_index: number;
  end_index: number;
  code_id: string;
  code_label: string;
  code_colour: string;
  user_id: string;
  created_at: string;
}

export interface AnalysisOut {
  code_id: string;
  code_label: string;
  definition: string | null;
  lens: string | null;
  reasoning: string | null;
  segment_count: number;
}

export interface AlertPayload {
  type: "coding_audit" | "consistency" | "ghost_partner" | "analysis_updated" | "agents_started" | "agent_thinking" | "agents_done" | "agent_error" | "chat_stream_start" | "chat_token" | "chat_done" | "chat_error" | "batch_audit_started" | "batch_audit_progress" | "batch_audit_done";
  segment_id?: string;
  code_id?: string;
  code_label?: string;
  is_consistent?: boolean;
  is_conflict?: boolean;
  segment_text?: string;
  batch?: boolean;
  token?: string;
  conversation_id?: string;
  agent?: string;
  data: Record<string, unknown>;
}

export interface AlertOut {
  id: string;
  alert_type: string;
  payload: Record<string, unknown>;
  segment_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface TextSelection {
  text: string;
  startIndex: number;
  endIndex: number;
  rect?: { top: number; left: number; bottom: number; right: number; width: number; height: number };
}

// New types for the redesign

export type ViewMode = "document" | "visualisation";
export type VisTab = "frequencies" | "crosstab" | "analytics";
export type RightPanelTab = "alerts" | "chat";
export type LeftPanelTab = "documents" | "codes" | "segments" | "definitions";
export type ThemeMode = "light" | "dark";

export interface Memo {
  id: string;
  title: string;
  content: string;
  linked_code_id?: string | null;
  linked_document_id?: string | null;
  linked_segment_id?: string | null;
  project_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageOut {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ConversationPreview {
  conversation_id: string;
  preview: string;
  started_at: string | null;
}

