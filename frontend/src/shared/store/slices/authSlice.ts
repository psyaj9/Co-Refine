import type { AuthUser, TokenResponse } from "@/types";

const TOKEN_KEY = "co_refine_token";
const USER_KEY = "co_refine_user";

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

export const createAuthSlice = (set: (partial: any) => void): AuthSlice => ({
  authUser: null,
  token: null,
  authLoading: false,
  authError: null,

  initAuth: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as AuthUser;
        set({ authUser: user, token, currentUser: user.user_id });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
  },

  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.text();
        try {
          const parsed = JSON.parse(body) as { detail?: string };
          throw new Error(parsed.detail ?? "Login failed");
        } catch {
          throw new Error(body || "Login failed");
        }
      }
      const data = (await res.json()) as TokenResponse;
      const user: AuthUser = {
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name,
      };
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({
        authUser: user,
        token: data.access_token,
        currentUser: user.user_id,
        authLoading: false,
        authError: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed";
      set({ authLoading: false, authError: msg });
      throw e;
    }
  },

  register: async (email, displayName, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, display_name: displayName, password }),
      });
      if (!res.ok) {
        const body = await res.text();
        try {
          const parsed = JSON.parse(body) as { detail?: string };
          throw new Error(parsed.detail ?? "Registration failed");
        } catch {
          throw new Error(body || "Registration failed");
        }
      }
      const data = (await res.json()) as TokenResponse;
      const user: AuthUser = {
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name,
      };
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({
        authUser: user,
        token: data.access_token,
        currentUser: user.user_id,
        authLoading: false,
        authError: null,
      });
    } catch (e) {
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
      currentUser: "default",
      authError: null,
      projects: [],
      activeProjectId: null,
      documents: [],
      codes: [],
      segments: [],
    });
  },
});
