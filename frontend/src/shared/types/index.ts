
export interface AuthUser {
  user_id: string;
  email: string;
  display_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  display_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  display_name: string;
  password: string;
}

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
  type: "coding_audit" | "consistency" | "ghost_partner" | "analysis_updated" | "agents_started" | "agent_thinking" | "agents_done" | "agent_error" | "chat_stream_start" | "chat_token" | "chat_done" | "chat_error" | "batch_audit_started" | "batch_audit_progress" | "batch_audit_done" | "deterministic_scores" | "code_overlap_matrix" | "temporal_drift_warning";
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


export interface ScoreDelta {
  consistency_score: number;
  intent_alignment_score: number;
  overall_severity_score: number;
}

export interface ReflectionMeta {
  was_reflected: boolean;
  initial_scores: {
    consistency_score: number;
    intent_alignment_score: number;
    overall_severity_score: number;
  };
  reflected_scores: {
    consistency_score: number;
    intent_alignment_score: number;
    overall_severity_score: number;
  };
  score_delta: ScoreDelta;
}

export interface ChallengeMeta {
  was_challenged: boolean;
  researcher_feedback: string;
  pre_challenge_scores: {
    consistency_score: number;
    intent_alignment_score: number;
    overall_severity_score: number;
  };
  post_challenge_scores: {
    consistency_score: number;
    intent_alignment_score: number;
    overall_severity_score: number;
  };
  score_delta: ScoreDelta;
}

export interface ChallengeReflectionResponse {
  audit_result: Record<string, unknown>;
  challenge: ChallengeMeta;
  human_feedback_id: string;
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

export type ViewMode = "document" | "dashboard" | "history";
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


export interface DeterministicScores {
  centroid_similarity: number | null;
  is_pseudo_centroid: boolean;
  temporal_drift: number | null;
  segment_count: number | null;
}


export interface Perspective {
  id: string;
  label: string;
  description: string;
}

export interface ProjectSettings {
  enabled_perspectives: string[];
  available_perspectives: Perspective[];
  thresholds: Record<string, number>;
}

export interface ThresholdDefinition {
  key: string;
  label: string;
  description: string;
  default: number;
  min: number;
  max: number;
  step: number;
  type: "int" | "float";
}


export interface MetricPoint {
  date: string;
  avg_consistency: number | null;
  avg_centroid_sim: number | null;
}

export interface OverviewData {
  total_segments: number;
  total_codes: number;
  avg_consistency_score: number;
  avg_centroid_sim: number;
  escalation_rate: number;
  score_over_time: { date: string; avg_score: number }[];
  metrics_over_time: MetricPoint[];
  top_variable_codes: { code_name: string; variability_score: number }[];
  top_temporal_drift_codes: { code_name: string; avg_drift: number }[];
}

export interface FacetSegment {
  segment_id: string;
  tsne_x: number;
  tsne_y: number;
  similarity_score: number;
  text_preview: string;
}

export interface FacetData {
  facet_id: string;
  facet_label: string;
  suggested_label: string | null;
  label_source: "auto" | "ai" | "user";
  code_id: string;
  code_name: string;
  code_definition: string | null;
  segment_count: number;
  avg_similarity: number | null;
  min_similarity: number | null;
  segments: FacetSegment[];
}

export interface CodeScores {
  code_name: string;
  code_id: string;
  scores: number[];
  centroid_similarity_scores: number[];
}

export interface TimelineEntry {
  date: string;
  score: number;
  code_name: string;
  code_id: string;
}

export interface ReflectionEntry {
  date: string;
  code_id: string;
  code_name: string;
  initial_score: number;
  final_score: number;
  delta: number;
}

export interface ConsistencyData {
  scores_by_code: CodeScores[];
  timeline: TimelineEntry[];
  reflection_data: ReflectionEntry[];
}

export interface CodeOverlapData {
  matrix: Record<string, Record<string, number>>;
  code_labels: string[];
  threshold: number;
}

export interface CodeCooccurrenceData {
  /** Ordered list of code labels (rows/columns of the matrix). */
  codes: string[];
  /** Symmetric n×n matrix; diagonal = total usage count for that code. */
  matrix: number[][];
  /** Total number of distinct text spans (regardless of how many codes cover each). */
  total_segments: number;
  /** Flattened upper-triangle counts: "CodeA__CodeB" → count. */
  co_occurrence_counts: Record<string, number> | null;
}


export interface PendingApplication {
  id: string;
  documentId: string;
  text: string;
  startIndex: number;
  endIndex: number;
  codeId: string;
  codeLabel: string;
  codeColour: string;
}
