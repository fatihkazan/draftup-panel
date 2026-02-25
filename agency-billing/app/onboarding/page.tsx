"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AgencyRow = {
  id: string;
  agency_name?: string | null;
};

const ACCENT_GREEN = "#22C55E";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const progressPercent = useMemo(() => (step / 3) * 100, [step]);

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
    setLoading(true);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    let user = sessionData.session?.user ?? null;

    if (!user) {
      const { data: userData } = await supabase.auth.getUser();
      user = userData.user;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);
    setEmail(user.email ?? "");

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if ((profileData as { full_name?: string } | null)?.full_name) {
      setOwnerName((profileData as { full_name: string }).full_name);
    } else {
      setOwnerName((user.user_metadata?.full_name as string | undefined) ?? "");
    }

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id, agency_name, email, owner_name, logo_url")
      .eq("user_id", user.id)
      .maybeSingle();

    const agencyRow = agencyData as
      | (AgencyRow & { email?: string | null; owner_name?: string | null; logo_url?: string | null })
      | null;

    if (agencyRow?.id) {
      setAgencyId(agencyRow.id);
      if (agencyRow.email) setEmail(agencyRow.email);
      if (agencyRow.owner_name) setOwnerName(agencyRow.owner_name);
      if (agencyRow.logo_url) setLogoUrl(agencyRow.logo_url);
      if (agencyRow.agency_name?.trim()) {
        router.replace("/");
        return;
      }
    }

    setLoading(false);
  }

  async function uploadLogoIfAny(currentUserId: string): Promise<string | null> {
    if (!logoFile) return logoUrl || null;
    const ext = logoFile.name.split(".").pop() || "png";
    const path = `${currentUserId}/onboarding-logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from("agency-logos").upload(path, logoFile, { upsert: true });
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    const { data } = supabase.storage.from("agency-logos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleStep1Next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agencyName.trim() || !ownerName.trim() || !email.trim()) {
      setError("Please fill in agency name, owner name, and email.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("Saving agency setup...");

    try {
      const resolvedLogoUrl = await uploadLogoIfAny(userId);
      const payload = {
        user_id: userId,
        agency_name: agencyName.trim(),
        owner_name: ownerName.trim(),
        email: email.trim(),
        logo_url: resolvedLogoUrl,
      };

      if (agencyId) {
        const { error: updateError } = await supabase
          .from("agency_settings")
          .update(payload)
          .eq("id", agencyId);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("agency_settings")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        setAgencyId((inserted as { id: string }).id);
      }

      setStatus("");
      setStep(2);
    } catch (err) {
      setError("Could not save step 1. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2Next(skip: boolean) {
    if (skip) {
      setStep(3);
      return;
    }

    if (!clientName.trim() || !clientEmail.trim()) {
      setError("Please fill in client name and client email, or click Skip.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("Saving first client...");

    try {
      const { data: agencyData } = await supabase
        .from("agency_settings")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const resolvedAgencyId = agencyId || (agencyData as { id?: string } | null)?.id || "";
      if (!resolvedAgencyId) {
        throw new Error("Agency not found");
      }

      const clientCode = `CLT-${String(Date.now()).slice(-4)}`;
      const { error: insertError } = await supabase.from("clients").insert({
        agency_id: resolvedAgencyId,
        name: clientName.trim(),
        email: clientEmail.trim(),
        company: companyName.trim() || null,
        client_code: clientCode,
      });

      if (insertError) throw new Error(insertError.message);
      setStatus("");
      setStep(3);
    } catch {
      setError("Could not save client. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0a0a0a" }}>
        <p className="text-sm text-zinc-300">Preparing onboarding...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ backgroundColor: "#0a0a0a" }}>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Step {step}/3</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, backgroundColor: ACCENT_GREEN }} />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-5">
              <div>
                <h1 className="text-xl font-semibold text-white">Set up your agency</h1>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Agency name</label>
                <input
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  placeholder="Acme Studio"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Owner name</label>
                <input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  placeholder="hello@agency.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Logo upload (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
              {status && <p className="text-xs text-zinc-400">{status}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: ACCENT_GREEN }}
              >
                {saving ? "Saving..." : "Next"}
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-semibold text-white">Add your first client</h1>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Client name</label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  placeholder="John Smith"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Client email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  placeholder="client@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Company name (optional)</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  placeholder="Client Co."
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
              {status && <p className="text-xs text-zinc-400">{status}</p>}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void handleStep2Next(true)}
                  disabled={saving}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => void handleStep2Next(false)}
                  disabled={saving}
                  className="rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: ACCENT_GREEN }}
                >
                  {saving ? "Saving..." : "Next"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-white">Create your first proposal</h1>
                <p className="text-sm text-zinc-400">You&apos;re ready! Create your first proposal</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => router.push("/proposals/new")}
                  className="rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: ACCENT_GREEN }}
                >
                  Create Proposal
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
