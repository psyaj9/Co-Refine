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
  type: "consistency" | "ghost_partner" | "analysis_updated" | "ghost_thinking" | "ghost_thinking_done" | "agents_started" | "agent_thinking" | "agents_done" | "agent_error";
  segment_id?: string;
  code_id?: string;
  code_label?: string;
  is_consistent?: boolean;
  is_conflict?: boolean;
  token?: string;
  stream_id?: string;
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
