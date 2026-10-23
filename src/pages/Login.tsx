import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../lib/api";
import { saveSession } from "../lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter both your email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.status && res.token && res.admin) {
        saveSession(res.token, res.admin);
        navigate("/dashboard", { replace: true });
      } else {
        setError(res.message || "Login failed. Please check your credentials.");
      }
    } catch {
      setError(
        "Could not reach the server. Make sure the backend is running at http://localhost:3000.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand to-brand-dark px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8 sm:p-10">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-brand flex items-center justify-center text-white text-xl font-bold shadow-md">
            C
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">Celitix CMS</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your admin dashboard</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder-gray-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-gray-50"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder-gray-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-gray-50"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          {loading && (
            <p className="text-center text-xs text-gray-400">
              The first sign-in can take a few seconds while the server warms up.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
