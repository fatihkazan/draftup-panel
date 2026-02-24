"use client";

import { useEffect } from "react";

const LANDING_PAGE_URL = "https://draftup.co";

export default function WelcomePage() {
  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email")?.trim().toLowerCase() ?? "";

    if (!email) {
      window.location.replace(LANDING_PAGE_URL);
      return;
    }

    async function resolveRegistrationToken() {
      try {
        const response = await fetch(
          `/api/auth/get-register-token?email=${encodeURIComponent(email)}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          window.location.replace(LANDING_PAGE_URL);
          return;
        }

        const payload = (await response.json()) as { token?: string | null };
        if (!payload.token) {
          window.location.replace(LANDING_PAGE_URL);
          return;
        }

        window.location.replace(`/register?token=${encodeURIComponent(payload.token)}`);
      } catch {
        window.location.replace(LANDING_PAGE_URL);
      }
    }

    resolveRegistrationToken();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0a0a0a" }}>
      <p className="text-sm text-zinc-300">Welcome! Setting up your account...</p>
    </div>
  );
}
