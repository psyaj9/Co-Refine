/**
 * Shared test helpers for creating mock store state.
 */
import type { ProjectOut, DocumentOut, CodeOut, SegmentOut, AlertPayload, AnalysisOut, ChatMessageOut, EditEventOut } from "@/shared/types";

export function mockProject(overrides: Partial<ProjectOut> = {}): ProjectOut {
  return {
    id: "proj-1",
    name: "Test Project",
    document_count: 2,
    code_count: 3,
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function mockDocument(overrides: Partial<DocumentOut> = {}): DocumentOut {
  return {
    id: "doc-1",
    title: "Test Document",
    full_text: "The quick brown fox jumps over the lazy dog.",
    doc_type: "txt",
    html_content: null,
    project_id: "proj-1",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function mockCode(overrides: Partial<CodeOut> = {}): CodeOut {
  return {
    id: "code-1",
    label: "Theme A",
    definition: "A test theme",
    colour: "#F44336",
    created_by: "user-1",
    project_id: "proj-1",
    segment_count: 5,
    ...overrides,
  };
}

export function mockSegment(overrides: Partial<SegmentOut> = {}): SegmentOut {
  return {
    id: "seg-1",
    document_id: "doc-1",
    text: "brown fox",
    start_index: 10,
    end_index: 19,
    code_id: "code-1",
    code_label: "Theme A",
    code_colour: "#F44336",
    user_id: "user-1",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function mockAlert(overrides: Partial<AlertPayload> = {}): AlertPayload {
  return {
    type: "coding_audit",
    data: {},
    ...overrides,
  };
}

export function mockAnalysis(overrides: Partial<AnalysisOut> = {}): AnalysisOut {
  return {
    code_id: "code-1",
    code_label: "Theme A",
    definition: "A test theme definition",
    lens: "inductive",
    reasoning: "This code captures...",
    segment_count: 5,
    ...overrides,
  };
}

export function mockChatMessage(overrides: Partial<ChatMessageOut> = {}): ChatMessageOut {
  return {
    id: "msg-1",
    conversation_id: "conv-1",
    role: "user",
    content: "Hello",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function mockEditEvent(overrides: Partial<EditEventOut> = {}): EditEventOut {
  return {
    id: "evt-1",
    project_id: "proj-1",
    document_id: "doc-1",
    entity_type: "segment",
    action: "created",
    entity_id: "seg-1",
    field_changed: null,
    old_value: null,
    new_value: null,
    metadata_json: { code_label: "Theme A", segment_text: "hello" },
    user_id: "user-1",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Default mock store state with all fields.
 * Override individual fields as needed in tests.
 */
export function defaultStoreState() {
  return {
    currentUser: "user-1",
    viewMode: "document" as const,
    rightPanelTab: "alerts" as const,
    showUploadPage: false,
    projects: [mockProject()],
    activeProjectId: "proj-1",
    documents: [mockDocument()],
    activeDocumentId: "doc-1",
    codes: [mockCode()],
    activeCodeId: null as string | null,
    inconsistentSegmentIds: new Set<string>(),
    segments: [mockSegment()],
    retrievedSegments: [] as SegmentOut[],
    retrievedCodeId: null as string | null,
    scrollToSegmentId: null as string | null,
    selection: null,
    clickedSegments: null,
    analyses: [] as AnalysisOut[],
    alerts: [] as AlertPayload[],
    agentsRunning: false,
    batchAuditRunning: false,
    batchAuditProgress: null,
    auditStage: {
      current: 0 as 0 | 1 | 2 | 3,
      stage1Scores: null,
      escalation: null,
      confidence: null,
    },
    projectSettings: null,
    codeSearchQuery: "",
    docSearchQuery: "",
    chatMessages: [] as ChatMessageOut[],
    chatConversationId: null as string | null,
    chatStreaming: false,
    editHistory: [] as EditEventOut[],
    historyScope: "project" as const,
    historySelectedEventId: null as string | null,
    showRightPanel: true,
    // Actions (stubs)
    setViewMode: vi.fn(),
    setRightPanelTab: vi.fn(),
    setShowUploadPage: vi.fn(),
    loadProjects: vi.fn().mockResolvedValue(undefined),
    setActiveProject: vi.fn(),
    createProject: vi.fn().mockResolvedValue(mockProject()),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    loadDocuments: vi.fn().mockResolvedValue(undefined),
    setActiveDocument: vi.fn(),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    loadCodes: vi.fn().mockResolvedValue(undefined),
    setActiveCode: vi.fn(),
    addCode: vi.fn().mockResolvedValue(undefined),
    deleteCode: vi.fn().mockResolvedValue(undefined),
    updateCode: vi.fn().mockResolvedValue(undefined),
    loadSegments: vi.fn().mockResolvedValue(undefined),
    applyCode: vi.fn().mockResolvedValue(undefined),
    loadRetrievedSegments: vi.fn().mockResolvedValue(undefined),
    clearRetrievedSegments: vi.fn(),
    setScrollToSegmentId: vi.fn(),
    setSelection: vi.fn(),
    setClickedSegments: vi.fn(),
    removeSegment: vi.fn().mockResolvedValue(undefined),
    loadAnalyses: vi.fn().mockResolvedValue(undefined),
    pushAlert: vi.fn(),
    dismissAlert: vi.fn(),
    clearThinkingAlerts: vi.fn(),
    applySuggestedCode: vi.fn().mockResolvedValue(undefined),
    keepMyCode: vi.fn(),
    setCodeSearchQuery: vi.fn(),
    setDocSearchQuery: vi.fn(),
    sendChatMessage: vi.fn().mockResolvedValue(undefined),
    appendChatToken: vi.fn(),
    finishChatStream: vi.fn(),
    clearChat: vi.fn(),
    loadChatHistory: vi.fn().mockResolvedValue(undefined),
    setHistoryScope: vi.fn(),
    setHistorySelectedEventId: vi.fn(),
    loadEditHistory: vi.fn().mockResolvedValue(undefined),
    loadProjectSettings: vi.fn().mockResolvedValue(undefined),
  };
}

import { vi } from "vitest";
