"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Plus, Receipt } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Invoice = {
  id: string;
  client_id: string;
  title: string;
  currency: string;
  status: string;
  total: number;
  created_at: string;
  created_by_name?: string | null;
  client?: {
    name: string;
  };
  paidAmount?: number;
  isPaid?: boolean;
};

type StatusFilter = "all" | "draft" | "sent" | "paid" | "overdue" | "void";

const STATUS_CONFIG = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", color: "bg-primary/10 text-primary" },
  paid: { label: "Paid", color: "bg-accent/10 text-accent" },
  overdue: { label: "Overdue", color: "bg-destructive/10 text-destructive" },
  void: { label: "Void", color: "bg-muted text-muted-foreground" },
};

function StatusBadge({ status, paid }: { status: string; paid: boolean }) {
  if (paid) {
    return (
      <span className="inline-block rounded-md px-3 py-1 text-xs font-medium bg-accent/10 text-accent">
        Paid
      </span>
    );
  }

  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!config) return <span className="text-xs text-muted-foreground">{status}</span>;

  return (
    <span className={`inline-block rounded-md px-3 py-1 text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function InvoicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientFilter = searchParams.get("client") || "";
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, clientFilter]);

  async function loadInvoices() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("invoices")
      .select(`
        id, client_id, title, currency, status, total, created_at, created_by_name,
        client:clients(name)
      `)
      .eq("agency_id", agencyData.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("LOAD ERROR:", error);
      setLoading(false);
      return;
    }

    const invList = (data as any[]) ?? [];
    const ids = invList.map((i: any) => i.id);
    let paidByInvoice: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .in("invoice_id", ids);
      for (const p of payments ?? []) {
        paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + Number(p.amount);
      }
    }
    const enriched = invList.map((i: any) => ({
      ...i,
      paidAmount: paidByInvoice[i.id] || 0,
      isPaid: (paidByInvoice[i.id] || 0) >= (i.total || 0),
    }));
    setInvoices(enriched);
    setLoading(false);
  }

  const filteredInvoices = useMemo(() => {
    let result = invoices;

    // Filter by status
    if (statusFilter === "paid") {
      result = result.filter(i => i.isPaid);
    } else if (statusFilter !== "all") {
      result = result.filter(i => !i.isPaid && i.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(i => {
        const title = i.title.toLowerCase();
        const clientName = i.client?.name?.toLowerCase() || "";
        const id = i.id.toLowerCase();
        const status = i.status.toLowerCase();

        return title.includes(query) ||
               clientName.includes(query) ||
               id.includes(query) ||
               status.includes(query);
      });
    }

    if (clientFilter) {
      result = result.filter(i => i.client_id === clientFilter);
    }

    return result;
  }, [invoices, statusFilter, searchQuery, clientFilter]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const statusCounts = {
    all: invoices.length,
    draft: invoices.filter(i => !i.isPaid && i.status === "draft").length,
    sent: invoices.filter(i => !i.isPaid && i.status === "sent").length,
    paid: invoices.filter(i => i.isPaid).length,
    overdue: invoices.filter(i => !i.isPaid && i.status === "overdue").length,
    void: invoices.filter(i => i.status === "void").length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Manage your invoices and track payments
          </p>
        </div>

        <Link
          href="/invoices/new"
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus size={18} />
          New Invoice
        </Link>
      </div>

      {/* Status Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors border ${
            statusFilter === "all"
              ? "bg-accent text-accent-foreground border-transparent"
              : "bg-secondary text-muted-foreground hover:text-foreground border-border"
          }`}
        >
          All ({statusCounts.all})
        </button>

        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status as StatusFilter)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors border ${
              statusFilter === status
                ? "bg-accent text-accent-foreground border-transparent"
                : "bg-secondary text-muted-foreground hover:text-foreground border-border"
            }`}
          >
            {config.label} ({statusCounts[status as keyof typeof statusCounts]})
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, client name, ID, or status..."
          className="w-full rounded-xl bg-secondary border border-border pl-12 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Invoices List */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Loading invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Receipt size={48} className="mx-auto mb-4 text-muted-foreground" />
            <div className="text-sm text-muted-foreground mb-4">
              {searchQuery ? (
                <>
                  No invoices found matching "<strong className="text-foreground">{searchQuery}</strong>"
                  <div className="mt-2">
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-accent hover:text-accent/80"
                    >
                      Clear search
                    </button>
                  </div>
                </>
              ) : statusFilter === "all" ? (
                "No invoices yet."
              ) : (
                `No ${STATUS_CONFIG[statusFilter as keyof typeof STATUS_CONFIG]?.label.toLowerCase()} invoices.`
              )}
            </div>
            {statusFilter === "all" && !searchQuery && (
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground hover:bg-accent/90 transition-colors"
              >
                <Plus size={16} />
                Create Your First Invoice
              </Link>
            )}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created By</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <td className="py-4 px-4">
                      <span className="text-sm font-medium text-foreground">{invoice.title}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{invoice.id.slice(0, 8)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-foreground">{invoice.client?.name || "Unknown client"}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-muted-foreground">{new Date(invoice.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-muted-foreground">{invoice.created_by_name || "—"}</span>
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge status={invoice.status} paid={invoice.isPaid ?? false} />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-sm font-semibold text-foreground">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency || "EUR" }).format(invoice.total || 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
              <p className="text-sm text-muted-foreground">
                Showing {filteredInvoices.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length} invoices
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <InvoicesPageContent />
    </Suspense>
  );
}
