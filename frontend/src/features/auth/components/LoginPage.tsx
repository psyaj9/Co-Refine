import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login(email, password);
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-surface-900">Co-Refine</h1>
          <p className="mt-1 text-sm text-surface-500">Qualitative coding research tool</p>
        </div>

        <div className="bg-white rounded-xl border border-surface-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-surface-800 mb-5">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-surface-600 mb-1.5"
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
                className="w-full rounded-lg bg-surface-50 border border-surface-200 px-3 py-2 text-sm text-surface-800 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-surface-600 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-surface-50 border border-surface-200 px-3 py-2 pr-10 text-sm text-surface-800 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-surface-400 hover:text-surface-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden size={16} />
                  ) : (
                    <Eye aria-hidden size={16} />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <p role="alert" className="text-sm text-red-500">
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

          <p className="mt-4 text-center text-sm text-surface-500">
            No account?{" "}
            <button
              type="button"
              onClick={onShowRegister}
              className="text-brand-500 hover:text-brand-600 transition-colors"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
