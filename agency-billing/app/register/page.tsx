"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabaseClient";

const LANDING_PAGE_URL = "https://draftup.co";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [tokenValidated, setTokenValidated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tokenFromQuery = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";

    if (!tokenFromQuery) {
      window.location.replace(LANDING_PAGE_URL);
      return;
    }

    async function validateToken() {
      try {
        const response = await fetch(
          `/api/register-token?token=${encodeURIComponent(tokenFromQuery)}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          window.location.replace(LANDING_PAGE_URL);
          return;
        }

        const payload = (await response.json()) as {
          valid?: boolean;
          email?: string;
        };

        if (!payload.valid || !payload.email) {
          window.location.replace(LANDING_PAGE_URL);
          return;
        }

        if (!cancelled) {
          setToken(tokenFromQuery);
          setEmail(payload.email);
          setTokenValidated(true);
        }
      } catch {
        window.location.replace(LANDING_PAGE_URL);
      }
    }

    validateToken();

    return () => {
      cancelled = true;
    };
  }, []);

  async function register() {
    if (!tokenValidated || !token) {
      return;
    }

    if (!fullName || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    const consumeResponse = await fetch("/api/register-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    });

    if (!consumeResponse.ok) {
      setError("Account created, but token finalization failed. Please contact support.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-8 py-10 shadow-2xl">
          <div className="mb-8 flex justify-center">
            <Image
              src="/logo.png"
              alt="Logo"
              width={120}
              height={40}
              priority
            />
          </div>

          <h1 className="mb-1 text-center text-xl font-semibold text-white">
            Create an account
          </h1>
          <p className="mb-8 text-center text-sm text-zinc-400">
            Get started for free
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Full Name
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || !tokenValidated}
                readOnly
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && register()}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              onClick={register}
              disabled={loading || !tokenValidated}
              className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "#22C55E" }}
            >
              {loading ? "Creating account…" : tokenValidated ? "Create Account" : "Validating link…"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <a
              href="/login"
              className="font-medium text-zinc-300 underline-offset-4 hover:underline"
            >
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
