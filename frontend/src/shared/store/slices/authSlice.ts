import type { AuthUser } from "@/types";
import * as api from "@/api/client";

export const TOKEN_KEY = "co_refine_token";
export const USER_KEY = "co_refine_user";

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
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (token && userRaw) {
      try {
        const authUser: AuthUser = JSON.parse(userRaw);
        set({ token, authUser });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
  },

  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await api.loginUser(email, password);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
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
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      set({ token: res.access_token, authUser: res.user, authLoading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      set({ authLoading: false, authError: msg });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({
      authUser: null,
      token: null,
      authError: null,
      // Reset project/document/code/segment state
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
