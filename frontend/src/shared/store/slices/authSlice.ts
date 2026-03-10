import type { AuthUser } from "@/shared/types";
import * as api from "@/shared/api/client";

export const TOKEN_KEY = "co_refine_token";
export const USER_KEY = "co_refine_user";
export const PROJECT_KEY = "co_refine_project";
export const DOCUMENT_KEY = "co_refine_document";
export const VIEW_KEY = "co_refine_view";

export interface AuthSlice {
  authUser: AuthUser | null;
  token: string | null;
  authLoading: boolean;
  authError: string | null;

  initAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => void;
}

export const createAuthSlice = (
  set: (partial: any) => void,
  _get: () => any,
): AuthSlice => ({
  authUser: null,
  token: null,
  authLoading: false,
  authError: null,

  initAuth: () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const userRaw = sessionStorage.getItem(USER_KEY);
    if (token && userRaw) {
      try {
        const authUser: AuthUser = JSON.parse(userRaw);
        const activeProjectId = sessionStorage.getItem(PROJECT_KEY) || null;
        const activeDocumentId = sessionStorage.getItem(DOCUMENT_KEY) || null;
        const viewMode = sessionStorage.getItem(VIEW_KEY) || "document";
        set({ token, authUser, activeProjectId, activeDocumentId, viewMode });
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
      }
    }
  },

  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await api.loginUser(email, password);
      sessionStorage.setItem(TOKEN_KEY, res.access_token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
      set({ token: res.access_token, authUser: res.user, authLoading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      set({ authLoading: false, authError: msg });
      throw e;
    }
  },

  register: async (email, displayName, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await api.registerUser(email, displayName, password);
      sessionStorage.setItem(TOKEN_KEY, res.access_token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
      set({ token: res.access_token, authUser: res.user, authLoading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      set({ authLoading: false, authError: msg });
      throw e;
    }
  },

  logout: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(PROJECT_KEY);
    sessionStorage.removeItem(DOCUMENT_KEY);
    sessionStorage.removeItem(VIEW_KEY);
    set({
      authUser: null,
      token: null,
      authError: null,
      projects: [],
      activeProjectId: null,
      documents: [],
      activeDocumentId: null,
      codes: [],
      activeCodeId: null,
      segments: [],
      alerts: [],
      chatMessages: [],
      chatConversationId: null,
      conversations: [],
    });
  },
});
