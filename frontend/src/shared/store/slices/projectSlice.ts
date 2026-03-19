import type { ProjectOut, ProjectSettings } from "@/shared/types";
import * as api from "@/shared/api/client";
import { PROJECT_KEY, DOCUMENT_KEY } from "./authSlice";

export interface ProjectSlice {
  projects: ProjectOut[];
  activeProjectId: string | null;
  loadProjects: () => Promise<void>;
  setActiveProject: (id: string) => void;
  createProject: (name: string) => Promise<ProjectOut>;
  deleteProject: (id: string) => Promise<void>;

  projectSettings: ProjectSettings | null;
  loadProjectSettings: () => Promise<void>;
}

export const createProjectSlice = (
  set: (partial: any) => void,
  get: () => any,
): ProjectSlice => ({
  projects: [],
  activeProjectId: null,

  loadProjects: async () => {
    const projects = await api.fetchProjects();
    set({ projects });
  },

  setActiveProject: (id) => {
    if (!id) {
      sessionStorage.removeItem(PROJECT_KEY);
      sessionStorage.removeItem(DOCUMENT_KEY);
      set({
        activeProjectId: null,
        activeDocumentId: null,
        documents: [],
        codes: [],
        segments: [],
        analyses: [],
        showUploadPage: false,
      });
      return;
    }
    sessionStorage.setItem(PROJECT_KEY, id);
    sessionStorage.removeItem(DOCUMENT_KEY);
    set({
      activeProjectId: id,
      activeDocumentId: null,
      documents: [],
      codes: [],
      segments: [],
      analyses: [],
      showUploadPage: false,
    });
    setTimeout(async () => {
      const { loadDocuments, loadCodes, loadAnalyses, loadProjectSettings } = get();
      await Promise.all([loadDocuments(), loadCodes(), loadAnalyses(), loadProjectSettings()]);
    }, 0);
  },

  createProject: async (name) => {
    const project = await api.createProject(name);
    await get().loadProjects();
    return project;
  },

  deleteProject: async (id) => {
    await api.deleteProject(id);
    const { activeProjectId } = get();
    if (activeProjectId === id) {
      set({
        activeProjectId: null,
        activeDocumentId: null,
        documents: [],
        codes: [],
        segments: [],
        analyses: [],
      });
    }
    await get().loadProjects();
  },

  projectSettings: null,

  loadProjectSettings: async () => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    try {
      const data = await api.fetchProjectSettings(activeProjectId);
      set({ projectSettings: data });
    } catch (e) {
      console.error("Failed to load project settings:", e);
    }
  },

});
