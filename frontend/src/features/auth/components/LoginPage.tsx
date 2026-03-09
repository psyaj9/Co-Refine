import { useState } from "react";
import { useStore } from "@/shared/store";

interface LoginPageProps {
  onShowRegister: () => void;
}

export default function LoginPage({ onShowRegister }: LoginPageProps) {
  const login = useStore((s) => s.login);
  const authLoading = useStore((s) => s.authLoading);
  const authError = useStore((s) => s.authError);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-surface-50 tracking-tight">
            Co-Refine
          </h1>
          <p className="mt-1 text-sm text-surface-400">
            Qualitative coding research tool
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl bg-surface-900 border panel-border shadow-2xl p-6">
          <h2 className="text-base font-medium text-surface-100 mb-5">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-surface-300"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border panel-border bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-surface-300"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border panel-border bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <p
                role="alert"
                className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-md px-3 py-2"
              >
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading || !email || !password}
              className="w-full rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-surface-900"
            >
              {authLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-surface-400">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={onShowRegister}
              className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
