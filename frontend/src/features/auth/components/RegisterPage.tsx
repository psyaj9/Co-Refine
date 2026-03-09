import { useState } from "react";
import { useStore } from "@/shared/store";

interface RegisterPageProps {
  onShowLogin: () => void;
}

export default function RegisterPage({ onShowLogin }: RegisterPageProps) {
  const register = useStore((s) => s.register);
  const authLoading = useStore((s) => s.authLoading);
  const authError = useStore((s) => s.authError);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await register(email, displayName, password);
  };

  const isValid = email.trim() && displayName.trim() && password.length >= 8;

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
            Create an account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label
                htmlFor="register-name"
                className="block text-xs font-medium text-surface-300"
              >
                Display name
              </label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border panel-border bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                placeholder="Your name"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="register-email"
                className="block text-xs font-medium text-surface-300"
              >
                Email address
              </label>
              <input
                id="register-email"
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
                htmlFor="register-password"
                className="block text-xs font-medium text-surface-300"
              >
                Password
                <span className="ml-1 text-surface-500 font-normal">(min 8 characters)</span>
              </label>
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
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
              disabled={authLoading || !isValid}
              className="w-full rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-surface-900"
            >
              {authLoading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-surface-400">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onShowLogin}
              className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
