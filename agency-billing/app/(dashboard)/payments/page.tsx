"use client";

import { useEffect, useState, useMemo } from "react";
import { CreditCard, DollarSign, Building2, Banknote, Wallet, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/format";

type Payment = {
  id: string;
  amount: number;
  method: string;
  note: string | null;
  payment_date: string;
  invoice: {
    id: string;
    title: string;
    invoice_number: string;
    client: {
      name: string;
    } | null;
  } | null;
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  stripe: "Stripe",
  other: "Other",
};

const METHOD_ICONS: Record<string, any> = {
  cash: Banknote,
  bank_transfer: Building2,
  card: CreditCard,
  stripe: CreditCard,
  other: Wallet,
};

const METHOD_COLORS: Record<string, string> = {
  cash: "bg-accent/20 text-accent border-accent/30",
  bank_transfer: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  card: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  stripe: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

function formatDate(dateString: string) {
  return new Date(dateString + "T12:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currency, setCurrency] = useState("USD");
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id, currency")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) { setLoading(false); return; }

    setCurrency(agencyData.currency || "USD");

    const { data: invoiceIds } = await supabase
      .from("invoices")
      .select("id")
      .eq("agency_id", agencyData.id);

    if (!invoiceIds?.length) { setLoading(false); return; }

    const ids = invoiceIds.map(i => i.id);

    const { data } = await supabase
      .from("payments")
      .select(`
        id, amount, method, note, payment_date,
        invoice:invoices(id, title, invoice_number, client:clients(name))
      `)
      .in("invoice_id", ids)
      .order("payment_date", { ascending: false });

    setPayments((data as any[]) ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let result = payments;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.invoice?.title?.toLowerCase().includes(q) ||
        p.invoice?.invoice_number?.toLowerCase().includes(q) ||
        p.invoice?.client?.name?.toLowerCase().includes(q) ||
        p.note?.toLowerCase().includes(q)
      );
    }
    if (methodFilter) {
      result = result.filter(p => p.method === methodFilter);
    }
    return result;
  }, [payments, search, methodFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const stripeTotal = payments.filter(p => p.method === "stripe" || p.note?.includes("Stripe")).reduce((s, p) => s + Number(p.amount), 0);
  const methodCounts = payments.reduce((acc, p) => {
    acc[p.method] = (acc[p.method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-accent/50 transition-all">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Collected</p>
            <p className="text-xl font-semibold text-foreground">{formatMoney(totalCollected, currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-accent/50 transition-all">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
            <CreditCard size={22} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Via Stripe</p>
            <p className="text-xl font-semibold text-foreground">{formatMoney(stripeTotal, currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-accent/50 transition-all">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
            <Building2 size={22} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Payments</p>
            <p className="text-xl font-semibold text-foreground">{payments.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-accent/50 transition-all">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Wallet size={22} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Methods Used</p>
            <p className="text-xl font-semibold text-foreground">{Object.keys(methodCounts).length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search invoice, client..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full h-10 rounded-xl bg-secondary border border-border pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          {["", "stripe", "card", "cash", "bank_transfer", "other"].map((m) => (
            <button
              key={m}
              onClick={() => { setMethodFilter(m); setCurrentPage(1); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                methodFilter === m
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "" ? "All" : METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Date</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Invoice</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Client</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Method</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Note</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Loading...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No payments found.</td></tr>
            ) : (
              paginated.map((payment) => {
                const MethodIcon = METHOD_ICONS[payment.method] || Wallet;
                const methodColor = METHOD_COLORS[payment.method] || METHOD_COLORS.other;
                return (
                  <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground">{formatDate(payment.payment_date)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div className="font-medium">{payment.invoice?.invoice_number || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[160px]">{payment.invoice?.title}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{payment.invoice?.client?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${methodColor}`}>
                        <MethodIcon size={12} />
                        {METHOD_LABELS[payment.method] || payment.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{payment.note || "—"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">{formatMoney(Number(payment.amount), currency)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} payments
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page ? "bg-accent text-accent-foreground" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {page}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
