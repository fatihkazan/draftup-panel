"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default function OnboardingPage() {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;

    async function init() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!alive) return;

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: agencyData } = await supabase
        .from("agency_settings")
        .select("id, agency_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!alive) return;

      if (agencyData?.agency_name?.trim()) {
        router.replace("/dashboard");
        return;
      }

      setChecking(false);
    }

    void init();
    return () => {
      alive = false;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agencyName.trim()) {
      setError("Please enter your agency or company name.");
      return;
    }

    setError("");
    setLoading(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userError || !user) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    const { data: existingAgency } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingAgency) {
      const { error: updateError } = await supabase
        .from("agency_settings")
        .update({ agency_name: agencyName.trim() })
        .eq("user_id", user.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("agency_settings")
        .insert({
          user_id: user.id,
          agency_name: agencyName.trim(),
          subscription_plan: "pro",
        });

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }
    }

    router.replace("/dashboard");
  }

  if (checking) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card px-8 py-10 shadow-2xl">
          <div className="mb-8 flex justify-center">
            <Image
              src="/logo.png"
              alt="Draftup"
              width={120}
              height={40}
              priority
            />
          </div>

          <h1 className="mb-1 text-center text-xl font-semibold text-foreground">
            Welcome! Let&apos;s set up your workspace
          </h1>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            Enter your agency or company name to get started
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Agency / Company Name
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
                placeholder="Acme Inc."
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                disabled={loading}
                autoComplete="organization"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Saving…" : "Get Started"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
