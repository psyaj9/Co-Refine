import { useState } from "react";
import { useStore } from "@/stores/store";

interface LoginPageProps {
  onShowRegister: () => void;
}

export default function LoginPage({ onShowRegister }: LoginPageProps) {
  const login = useStore((s) => s.login);
  const authLoading = useStore((s) => s.authLoading);
  const authError = useStore((s) => s.authError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login(email, password);
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-surface-50">Co-Refine</h1>
          <p className="mt-1 text-sm text-surface-400">Qualitative coding research tool</p>
        </div>

        <div className="bg-surface-900 rounded-xl border border-panel-border p-6 shadow-lg">
          <h2 className="text-lg font-medium text-surface-100 mb-5">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-surface-300 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-surface-800 border border-panel-border px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-surface-300 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-surface-800 border border-panel-border px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <p role="alert" className="text-sm text-red-400">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {authLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-surface-400">
            No account?{" "}
            <button
              type="button"
              onClick={onShowRegister}
              className="text-brand-400 hover:text-brand-300 transition-colors"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
