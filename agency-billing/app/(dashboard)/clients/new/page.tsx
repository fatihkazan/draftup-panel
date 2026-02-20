"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function NewClientPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [note, setNote] = useState("");
  const [tier, setTier] = useState<"Starter" | "Growth" | "Scale">("Starter");
  const [createdClient, setCreatedClient] = useState<any>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setStatus("Name is required.");
      return;
    }

    setLoading(true);
    setStatus("Creating client...");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setStatus("ERROR: Not authenticated");
      setLoading(false);
      return;
    }

    // Fetch agency_id from agency_settings
    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) {
      setStatus("ERROR: No agency found. Please set up your agency in Settings first.");
      setLoading(false);
      return;
    }

    const clientCode = `CLT-${String(Date.now()).slice(-4)}`;

    const { data, error } = await supabase.from("clients").insert({
      name: name.trim(),
      email: email.trim() || null,
      company: company.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      tax_number: taxNumber.trim() || null,
      note: note.trim() || null,
      agency_id: agencyData.id,
      tier,
      client_code: clientCode,
    }).select();

    if (error) {
      console.error("INSERT ERROR:", error);
      setStatus("ERROR: " + error.message);
      setLoading(false);
      return;
    }

    setStatus("Client created successfully!");
    setLoading(false);
    setCreatedClient(Array.isArray(data) ? data[0] : data);
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
        <h1 className="text-2xl font-semibold text-foreground">Add New Client</h1>
        <p className="text-sm text-muted-foreground">Create a new client profile</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
        <form onSubmit={handleSubmit} className="rounded-2xl bg-card border border-border p-8">
            <div className="mb-6 pb-6 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Client Information</h2>
              <p className="text-sm text-muted-foreground mt-1">Fill in the details below to create a new client profile.</p>
            </div>

            <div className="space-y-6">
              <div>
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

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div>
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

              <div>
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
                <label className="block text-xs text-muted-foreground mb-1">Client Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Internal notes about this client..."
                  rows={3}
                  className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors resize-none"
                />
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
                  disabled={loading}
                  className="rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Creating..." : "Create Client"}
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

        <div className="space-y-4">
          {createdClient ? (
            <>
              <div className="rounded-2xl bg-card border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-1">Client Code</h3>
                <p className="text-lg font-mono font-bold text-accent mt-2">{createdClient.client_code}</p>
                <p className="text-xs text-muted-foreground mt-1">Unique identifier for this client</p>
              </div>
              <div className="rounded-2xl bg-card border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Created</h3>
                <p className="text-sm text-foreground">{new Date(createdClient.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
              <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-5">
                <h3 className="text-sm font-semibold text-destructive mb-1">Danger Zone</h3>
                <p className="text-xs text-muted-foreground mb-3">Deleting a client is permanent and cannot be undone.</p>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Are you sure?")) return;
                    await supabase.from("clients").delete().eq("id", createdClient.id);
                    router.push("/clients");
                  }}
                  className="w-full rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm py-2 hover:bg-destructive/20 transition-colors"
                >
                  Delete Client
                </button>
              </div>
              <button
                type="button"
                onClick={() => router.push("/clients")}
                className="w-full rounded-xl bg-accent text-accent-foreground text-sm font-medium py-2.5 hover:bg-accent/90 transition-colors"
              >
                Go to Clients
              </button>
            </>
          ) : (
            <div className="rounded-2xl bg-card border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">Quick Tips</h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>• Fill in the client&apos;s name and email</li>
                <li>• Add company info for invoices</li>
                <li>• Set the tier to track client value</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
