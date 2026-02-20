"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/Toast";

type Client = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  address: string | null;
  phone: string | null;
  tax_number: string | null;
  tier?: "Starter" | "Growth" | "Scale";
  client_code?: string | null;
  created_at?: string | null;
  note?: string | null;
};

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [tier, setTier] = useState<"Starter" | "Growth" | "Scale">("Starter");
  const [clientCode, setClientCode] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    loadClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function loadClient() {
  try {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log("User not authenticated, redirecting to login...");
      window.location.href = "/login";
      return;
    }

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) {
      setStatus("No agency found");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("clients")
      .select("*, client_code, created_at")
      .eq("id", clientId)
      .eq("agency_id", agencyData.id)
      .single();

    console.log("CLIENT DATA:", data); // DEBUG
    console.log("CLIENT ERROR:", error); // DEBUG

    if (error || !data) {
      console.log("LOAD ERROR:", error);
      setStatus("Client not found");
      setLoading(false);
      return;
    }

    const client = data as Client;
    setName(client.name);
    setEmail(client.email || "");
    setCompany(client.company || "");
    setAddress(client.address || "");
    setPhone(client.phone || "");
    setTaxNumber(client.tax_number || "");
    setTier((client.tier as "Starter" | "Growth" | "Scale") || "Starter");
    setClientCode(client.client_code || "");
    setCreatedAt(client.created_at || null);
    setNote(client.note || "");
    setLoading(false);
  } catch (err) {
    console.error("CATCH ERROR:", err);
    setStatus("Error loading client");
    setLoading(false);
  }
}
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setStatus("Name is required.");
      return;
    }

    setSaving(true);
    setStatus("Saving...");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setStatus("ERROR: Not authenticated");
      setSaving(false);
      return;
    }

    // Fetch agency_id from agency_settings
    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) {
      setStatus("ERROR: No agency found");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("clients")
      .update({
        name: name.trim(),
        email: email.trim() || null,
        company: company.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        tax_number: taxNumber.trim() || null,
        tier,
      })
      .eq("id", clientId)
      .eq("agency_id", agencyData.id);

    if (error) {
      console.log("UPDATE ERROR:", error);
      setStatus("ERROR: " + error.message);
      setSaving(false);
      return;
    }

    setStatus("Client updated successfully!");
    setSaving(false);

    // Redirect after brief delay
    setTimeout(() => {
      router.push("/clients");
    }, 1000);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading client...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Back Link & Header */}
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Clients
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Edit Client</h1>
        <p className="text-sm text-muted-foreground">Update client information</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Form - takes 2 columns */}
        <div className="col-span-2">
          <div className="rounded-2xl bg-card border border-border p-6">
            <form onSubmit={handleSave}>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="ACME Agency"
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Tax Number</label>
                <input
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  placeholder="123456789"
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, Country"
                  rows={3}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">Tier</label>
                <div className="flex gap-3">
                  {(["Starter", "Growth", "Scale"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(t)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                        tier === t
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-accent/50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {status && (
              <div className={`rounded-xl border p-4 text-sm ${
                status.includes("ERROR")
                  ? "border-red-500/50 bg-red-500/10 text-destructive"
                  : status.includes("successfully")
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-secondary text-muted-foreground"
              }`}>
                {status}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-foreground hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <Link
                href="/clients"
                className="rounded-xl border border-border bg-secondary px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Cancel
              </Link>
            </div>
          </div>
          </form>
          </div>
        </div>

        {/* Right sidebar - 1 column */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Client Code</h3>
            <p className="text-lg font-mono font-bold text-accent mt-2">{clientCode || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Auto-generated identifier</p>
          </div>
          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Created</h3>
            <p className="text-sm text-muted-foreground">{createdAt ? new Date(createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>
          </div>
          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Client Note</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal notes about this client..."
              rows={4}
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors resize-none mb-3"
            />
            <button
              onClick={async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { error } = await supabase
                  .from("clients")
                  .update({ note })
                  .eq("id", clientId);
                if (error) {
                  toast("Failed to save note", "error");
                } else {
                  toast("Note saved!", "success");
                }
              }}
              className="w-full rounded-xl bg-secondary border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Save Note
            </button>
          </div>
          <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-5">
            <h3 className="text-sm font-semibold text-destructive mb-1">Danger Zone</h3>
            <p className="text-xs text-muted-foreground mb-3">Deleting a client is permanent and cannot be undone.</p>
            <button type="button" className="w-full rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm py-2 hover:bg-destructive/20 transition-colors">
              Delete Client
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
