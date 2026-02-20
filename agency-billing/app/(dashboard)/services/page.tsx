"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Package, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Service = {
  id: string;
  name: string;
  description: string | null;
  default_unit_price: number;
  unit_type: string;
  currency: string;
  is_active: boolean;
  created_at: string;
};

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ServicesPage() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadServices() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    const res = await fetch("/api/services", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = await res.json();
    setServices(json.services ?? []);
    setLoading(false);
  }

  async function toggleActive(service: Service) {
    setTogglingId(service.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setTogglingId(null);
      return;
    }

    const res = await fetch(`/api/services/${service.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ is_active: !service.is_active }),
    });

    setTogglingId(null);
    if (res.ok) {
      loadServices();
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground">Manage your agency price templates</p>
        </div>
        <Link
          href="/services/new"
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus size={18} />
          Add New Service
        </Link>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Loading services...
          </div>
        ) : services.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Package size={48} className="mx-auto mb-4 text-muted-foreground" />
            <div className="text-sm text-muted-foreground mb-4">No services yet.</div>
            <Link
              href="/services/new"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground hover:bg-accent/90"
            >
              <Plus size={16} />
              Add Your First Service
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {services.map((svc) => (
              <div
                key={svc.id}
                className={`flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors ${!svc.is_active ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-foreground">
                    <Package size={20} />
                  </div>
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-2">
                      {svc.name}
                      {!svc.is_active && (
                        <span className="text-xs font-normal text-muted-foreground">(Disabled)</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {formatCurrency(svc.default_unit_price, svc.currency)} / {svc.unit_type}
                      </span>
                      {svc.description && (
                        <span className="max-w-xs truncate">{svc.description}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(svc)}
                    disabled={togglingId === svc.id}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                      svc.is_active
                        ? "border-amber-600/50 text-amber-400 hover:bg-amber-600/20"
                        : "border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/20"
                    }`}
                  >
                    {svc.is_active ? (
                      <>
                        <ToggleRight size={16} />
                        Disable
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={16} />
                        Enable
                      </>
                    )}
                  </button>
                  <Link
                    href={`/services/${svc.id}/edit`}
                    className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Pencil size={14} />
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
