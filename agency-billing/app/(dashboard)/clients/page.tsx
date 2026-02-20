"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Pencil, Mail, Building2, UserCircle, Search, DollarSign, TrendingUp, Users, Filter, FileText, Receipt } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Client = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  client_code?: string;
  created_at: string;
  tier: "Starter" | "Growth" | "Scale";
  totalRevenue?: number;
  lastProposalDate?: string | null;
  lastProposalStatus?: string | null;
  currency?: string;
};

const tierColors: Record<string, string> = {
  Starter: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Growth: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Scale: "bg-accent/20 text-accent border-accent/30",
};

function formatMoney(amount: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ClientsPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string | null>(null);

  async function loadClients() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Fetch agency_id from agency_settings
    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const agencyId = agencyData?.id;

    if (!agencyId) {
      console.log("No agency found for user");
      setLoading(false);
      return;
    }

    // Fetch clients using agency_id (clients belong to agency, not user)
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("LOAD ERROR:", error);
      setLoading(false);
      return;
    }

    const clientIds = (data as any[]).map((c) => c.id);

    const { data: invoiceData } = await supabase
      .from("invoices")
      .select("client_id, total")
      .eq("agency_id", agencyId)
      .in("client_id", clientIds);

    const { data: proposalData } = await supabase
      .from("proposals")
      .select("client_id, status, created_at")
      .eq("agency_id", agencyId)
      .in("client_id", clientIds)
      .order("created_at", { ascending: false });

    const { data: agencySettings } = await supabase
      .from("agency_settings")
      .select("currency")
      .eq("id", agencyId)
      .maybeSingle();

    const revenueByClient: Record<string, number> = {};
    for (const inv of invoiceData ?? []) {
      revenueByClient[inv.client_id] = (revenueByClient[inv.client_id] || 0) + Number(inv.total || 0);
    }

    const lastProposalByClient: Record<string, { date: string; status: string }> = {};
    for (const prop of proposalData ?? []) {
      if (!lastProposalByClient[prop.client_id]) {
        lastProposalByClient[prop.client_id] = { date: prop.created_at, status: prop.status };
      }
    }

    setClients(
      (data as any[]).map((c) => ({
        ...c,
        tier: c.tier || "Starter",
        totalRevenue: revenueByClient[c.id] || 0,
        lastProposalDate: lastProposalByClient[c.id]?.date || null,
        lastProposalStatus: lastProposalByClient[c.id]?.status || null,
        currency: agencySettings?.currency || "USD",
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    let result = clients;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email?.toLowerCase().includes(q) ?? false) ||
          (c.company?.toLowerCase().includes(q) ?? false)
      );
    }
    if (tierFilter) {
      result = result.filter((c) => c.tier === tierFilter);
    }
    return result;
  }, [clients, search, tierFilter]);

  const totalRevenue = clients.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
  const scaleCount = clients.filter((c) => c.tier === "Scale").length;
  const growthCount = clients.filter((c) => c.tier === "Growth").length;
  const firstCurrency = clients[0]?.currency || "USD";

  return (
    <div className="p-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-2xl font-semibold text-foreground">
                  {loading ? "..." : clients.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-semibold text-accent">
                  {loading ? "..." : formatMoney(totalRevenue, firstCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scale clients</p>
                <p className="text-2xl font-semibold text-accent">
                  {loading ? "..." : scaleCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Users size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Growth clients</p>
                <p className="text-2xl font-semibold text-blue-400">
                  {loading ? "..." : growthCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters + Add row */}
      <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          {["Starter", "Growth", "Scale"].map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tierFilter === tier
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-foreground hover:text-foreground"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
        <Link
          href="/clients/new"
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors w-full sm:w-auto"
        >
          <Plus size={18} />
          Add New Client
        </Link>
      </div>

      {/* Client cards / Empty / Loading */}
      {loading ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Loading clients...</p>
          </CardContent>
        </Card>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <UserCircle size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">No clients yet.</p>
            <Link
              href="/clients/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
            >
              <Plus size={16} />
              Add Your First Client
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="border-border bg-card hover:border-accent/50 transition-all group"
            >
              <CardContent className="p-5">
                {/* Top: Avatar + name + company + tier badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-secondary text-foreground font-semibold">
                        {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                        {client.name}
                        {client.client_code && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">({client.client_code})</span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">{client.company || "—"}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${tierColors[client.tier || "Starter"]}`}>
                    {client.tier || "Starter"}
                  </span>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    {client.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.company && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{client.company}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-medium text-foreground">{formatMoney(client.totalRevenue || 0, client.currency || "USD")}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Proposal</span>
                      <span className="font-medium text-foreground">{client.lastProposalDate ? formatDate(client.lastProposalDate) : "—"}</span>
                    </div>
                    {client.lastProposalStatus && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-medium text-foreground capitalize">{client.lastProposalStatus}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                  <Link
                    href={`/proposals?client=${client.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent h-8 px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Proposals
                  </Link>
                  <Link
                    href={`/invoices?client=${client.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent h-8 px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Invoices
                  </Link>
                  <Link
                    href={`/clients/${client.id}/edit`}
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-transparent h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && clients.length > 0 && filteredClients.length === 0 && (
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No clients match your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
