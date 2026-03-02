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
  type: "coding_audit" | "consistency" | "ghost_partner" | "analysis_updated" | "agents_started" | "agent_thinking" | "agents_done" | "agent_error" | "chat_stream_start" | "chat_token" | "chat_done" | "chat_error" | "batch_audit_started" | "batch_audit_progress" | "batch_audit_done" | "deterministic_scores" | "code_overlap_matrix";
  segment_id?: string;
  code_id?: string;
  code_label?: string;
  is_consistent?: boolean;
  is_conflict?: boolean;
  segment_text?: string;
  batch?: boolean;
  replaces_segment_id?: string;
  replaces_code_id?: string;
  token?: string;
  conversation_id?: string;
  agent?: string;
  deterministic_scores?: DeterministicScores | null;
  escalation?: { was_escalated: boolean; reason: string | null };
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

export type ViewMode = "document" | "visualisation" | "history";
export type VisTab = "frequencies" | "crosstab" | "analytics" | "scarf" | "agreement" | "scatter" | "cooccurrence" | "histogram";
export type RightPanelTab = "alerts" | "chat";
export type HistoryScope = "project" | "document";

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

export interface EditEventOut {
  id: string;
  project_id: string;
  document_id: string | null;
  entity_type: "segment" | "code";
  action: "created" | "updated" | "deleted";
  entity_id: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata_json: Record<string, unknown> | null;
  user_id: string;
  created_at: string;
}

// ── Scoring Pipeline Types ──────────────────────────────────────────

/** A single candidate code predicted by the inter-rater lens */
export interface PredictedCode {
  code: string;
  confidence: number;
  reasoning: string;
}

export interface DeterministicScores {
  centroid_similarity: number | null;
  is_pseudo_centroid: boolean;
  codebook_prob_dist: Record<string, number> | null;
  entropy: number | null;
  conflict_score: number | null;
  proposed_code_prob: number | null;
  temporal_drift: number | null;
  segment_count: number | null;
}

export interface ConsistencyScoreOut {
  id: string;
  segment_id: string;
  code_id: string;
  user_id: string;
  project_id: string;
  // Stage 1
  centroid_similarity: number | null;
  is_pseudo_centroid: boolean;
  proposed_code_prob: number | null;
  entropy: number | null;
  conflict_score: number | null;
  temporal_drift: number | null;
  codebook_distribution: Record<string, number> | null;
  // Stage 2
  llm_consistency_score: number | null;
  llm_intent_score: number | null;
  llm_conflict_severity: number | null;
  llm_overall_severity: number | null;
  llm_predicted_code: string | null;
  llm_predicted_confidence: number | null;
  llm_predicted_codes_json: PredictedCode[] | null;
  // Stage 3
  was_escalated: boolean;
  escalation_reason: string | null;
  created_at: string;
}

export interface CodeOverlapEntry {
  code_a: string;
  code_b: string;
  similarity: number;
}

export interface DriftTimelineEntry {
  code_label: string;
  drift: number | null;
}

export interface CooccurrenceEntry {
  code_a: string;
  code_b: string;
  count: number;
}

export interface AgreementSummaryEntry {
  code_id: string;
  code_label: string;
  colour: string;
  total: number;
  agree_count: number;
  disagree_count: number;
  avg_conflict_severity: number | null;
  avg_confidence: number | null;
}

export interface DocumentStatEntry {
  document_id: string;
  document_title: string;
  segment_count: number;
  code_count: number;
  codes: string[];
}

// ── Project Settings (Perspectives) ─────────────────────────────────

export interface Perspective {
  id: string;
  label: string;
  description: string;
}

export interface ProjectSettings {
  enabled_perspectives: string[];
  available_perspectives: Perspective[];
}
