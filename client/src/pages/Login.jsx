
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      onLogin(response.data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to log in. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#18191e] p-8 shadow-xl">
        <div className="mb-7 text-center">
          <div className="mb-3 text-5xl">🐾</div>
          <h1 className="text-3xl font-bold text-white">Furesque</h1>
          <p className="mt-2 text-sm text-gray-400">
            Sign in to your task monitoring system
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              maxLength={150}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-[#303239] px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-[#303239] px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Authorized users only
        </p>
      </div>
    </div>
  );
}
