"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const UNIT_TYPES = ["hours", "days", "project", "item"] as const;

export default function NewServicePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultUnitPrice, setDefaultUnitPrice] = useState("");
  const [unitType, setUnitType] = useState<typeof UNIT_TYPES[number]>("hours");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setStatus("Name is required.");
      return;
    }
    const price = parseFloat(defaultUnitPrice);
    if (isNaN(price) || price < 0) {
      setStatus("Default unit price must be a non-negative number.");
      return;
    }

    setLoading(true);
    setStatus("Creating service...");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setStatus("ERROR: Not authenticated");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        default_unit_price: price,
        unit_type: unitType,
        currency: currency.trim() || "USD",
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("ERROR: " + (json.error || "Failed to create service"));
      setLoading(false);
      return;
    }

    setStatus("Service created successfully!");
    setLoading(false);
    setTimeout(() => router.push("/services"), 1000);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/services"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Services
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Add New Service</h1>
        <p className="text-sm text-muted-foreground">Create a new price template</p>
      </div>

      <div className="max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-card border border-border p-6"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Logo Design"
                className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the service"
                rows={3}
                className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Default Unit Price <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={defaultUnitPrice}
                  onChange={(e) => setDefaultUnitPrice(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Unit Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value as typeof UNIT_TYPES[number])}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                >
                  {UNIT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Currency
              </label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="USD"
                className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors max-w-[120px]"
              />
            </div>

            {status && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  status.includes("ERROR")
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : status.includes("successfully")
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {status}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {loading ? "Creating..." : "Create Service"}
              </button>
              <Link
                href="/services"
                className="rounded-xl border border-border bg-secondary px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
