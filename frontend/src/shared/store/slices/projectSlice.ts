import type { ProjectOut, ProjectSettings } from "@/types";
import * as api from "@/api/client";

export interface ProjectSlice {
  projects: ProjectOut[];
  activeProjectId: string | null;
  loadProjects: () => Promise<void>;
  setActiveProject: (id: string) => void;
  createProject: (name: string) => Promise<ProjectOut>;
  deleteProject: (id: string) => Promise<void>;

  projectSettings: ProjectSettings | null;
  loadProjectSettings: () => Promise<void>;
  updateProjectSettings: (perspectives: string[]) => Promise<void>;
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
      sessionStorage.removeItem("co_refine_project");
      sessionStorage.removeItem("co_refine_document");
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
    sessionStorage.setItem("co_refine_project", id);
    sessionStorage.removeItem("co_refine_document");
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

  updateProjectSettings: async (perspectives: string[]) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    try {
      const data = await api.updateProjectSettings(activeProjectId, {
        enabled_perspectives: perspectives,
      });
      set({ projectSettings: data });
    } catch (e) {
      console.error("Failed to update project settings:", e);
    }
  },
});
