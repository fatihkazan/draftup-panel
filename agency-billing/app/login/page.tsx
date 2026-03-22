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
    <div className="min-h-screen flex items-center justify-center relative">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/login-bg2.jpg"
          alt="Background"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-sm px-4">
        <div
          className="rounded-2xl px-8 py-10 shadow-2xl backdrop-blur-md"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 100%)",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        >
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
          <p className="mb-8 text-center text-sm text-white/60">
            Sign in to your account
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/40 focus:ring-1 focus:ring-white/20 disabled:opacity-50"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/40 focus:ring-1 focus:ring-white/20 disabled:opacity-50"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && login()}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-400/30 bg-red-500/20 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}
            <button
              onClick={login}
              disabled={loading}
              className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
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
