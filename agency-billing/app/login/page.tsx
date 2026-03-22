"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (data.session) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      window.location.href = "/clients";
    }
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
            Welcome back
          </h1>
          <p className="mb-8 text-center text-sm text-zinc-400">
            Sign in to your account
          </p>

          <div className="space-y-4">
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
                disabled={loading}
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
                onKeyDown={(e) => e.key === "Enter" && login()}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              onClick={login}
              disabled={loading}
              className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "#22C55E" }}
            >
              {loading ? "Signing in…" : "Login"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}