"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Service = {
  id: string;
  name: string;
  description: string | null;
  default_unit_price: number;
  unit_type: string;
  currency: string;
  is_active: boolean;
};

const UNIT_TYPES = ["hours", "days", "project", "item"] as const;

export default function EditServicePage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultUnitPrice, setDefaultUnitPrice] = useState("");
  const [unitType, setUnitType] = useState<typeof UNIT_TYPES[number]>("hours");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    loadService();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  async function loadService() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setStatus("Not authenticated");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/services", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      setStatus("Failed to load services");
      setLoading(false);
      return;
    }

    const json = await res.json();
    const svc = (json.services ?? []).find((s: Service) => s.id === serviceId);
    if (!svc) {
      setStatus("Service not found");
      setLoading(false);
      return;
    }

    setName(svc.name);
    setDescription(svc.description || "");
    setDefaultUnitPrice(String(svc.default_unit_price));
    setUnitType(UNIT_TYPES.includes(svc.unit_type) ? svc.unit_type : "hours");
    setCurrency(svc.currency || "USD");
    setStatus("");
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
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

    setSaving(true);
    setStatus("Saving...");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setStatus("ERROR: Not authenticated");
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/services/${serviceId}`, {
      method: "PATCH",
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
      setStatus("ERROR: " + (json.error || "Failed to update service"));
      setSaving(false);
      return;
    }

    setStatus("Service updated successfully!");
    setSaving(false);
    setTimeout(() => router.push("/services"), 1000);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading service...</div>
      </div>
    );
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
        <h1 className="text-2xl font-semibold text-foreground">Edit Service</h1>
        <p className="text-sm text-muted-foreground">Update service information</p>
      </div>

      <div className="max-w-2xl">
        <form
          onSubmit={handleSave}
          className="rounded-2xl bg-card border border-border p-6"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Name <span className="text-destructive">*</span>
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
                  Default Unit Price <span className="text-destructive">*</span>
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
                  Unit Type <span className="text-destructive">*</span>
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
                    ? "border-red-500/50 bg-red-500/10 text-destructive"
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
                disabled={saving}
                className="rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Changes"}
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
