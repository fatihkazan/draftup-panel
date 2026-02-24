"use client";

import { FormEvent, useEffect, useState } from "react";

const LANDING_PAGE_URL = "https://draftup.co";

export default function WelcomePage() {
  const [email, setEmail] = useState("");
  const [needsManualEmail, setNeedsManualEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function resolveRegistrationToken(emailToLookup: string) {
    const normalizedEmail = emailToLookup.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Please enter a valid email.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/auth/get-register-token?email=${encodeURIComponent(normalizedEmail)}`,
        { cache: "no-store" }
      );

      const payload = (await response.json()) as { token?: string | null };
      if (!response.ok || !payload.token) {
        setError("No purchase found for this email. Please check your email or contact support.");
        setLoading(false);
        return;
      }

      window.location.replace(`/register?token=${encodeURIComponent(payload.token)}`);
    } catch {
      setError("No purchase found for this email. Please check your email or contact support.");
      setLoading(false);
    }
  }

  useEffect(() => {
    const emailFromQuery = new URLSearchParams(window.location.search).get("email")?.trim() ?? "";

    if (!emailFromQuery) {
      setNeedsManualEmail(true);
      return;
    }

    setEmail(emailFromQuery);
    resolveRegistrationToken(emailFromQuery);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void resolveRegistrationToken(email);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0a0a0a" }}>
      {needsManualEmail ? (
        <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-7">
          <h1 className="mb-4 text-center text-base font-semibold text-white">
            Enter the email you used to purchase
          </h1>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={loading}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
          />
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#22C55E" }}
          >
            {loading ? "Checking..." : "Continue"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-300">Welcome! Setting up your account...</p>
      )}
    </div>
  );
}
