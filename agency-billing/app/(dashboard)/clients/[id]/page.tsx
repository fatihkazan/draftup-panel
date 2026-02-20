"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Receipt, Mail, Building2, Phone, MapPin, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/format";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agency } = await supabase
      .from("agency_settings")
      .select("id, currency")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agency) return;
    setCurrency(agency.currency || "USD");

    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("agency_id", agency.id)
      .maybeSingle();

    if (!clientData) { router.push("/clients"); return; }
    setClient(clientData);

    const { data: proposalsData } = await supabase
      .from("proposals")
      .select("id, title, status, total, created_at")
      .eq("client_id", id)
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false });

    const { data: invoicesData } = await supabase
      .from("invoices")
      .select("id, title, invoice_number, status, total, due_date, created_at")
      .eq("client_id", id)
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false });

    setProposals(proposalsData || []);
    setInvoices(invoicesData || []);
    setLoading(false);
  }

  const PROPOSAL_STATUS: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    sent: { label: "Sent", color: "bg-accent/20 text-accent" },
    approved: { label: "Approved", color: "bg-accent/20 text-accent" },
    rejected: { label: "Rejected", color: "bg-destructive/20 text-destructive" },
  };

  const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    sent: { label: "Sent", color: "bg-blue-500/20 text-blue-400" },
    paid: { label: "Paid", color: "bg-accent/20 text-accent" },
    overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!client) return null;

  const initials = client.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const totalRevenue = invoices.reduce((s, i) => s + Number(i.total || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft size={18} className="text-muted-foreground" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center text-accent font-semibold text-lg">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{client.name}</h1>
            <p className="text-sm text-muted-foreground">{client.company || "—"}</p>
          </div>
        </div>
        <Link href={`/clients/${id}/edit`} className="px-4 py-2 rounded-xl bg-secondary border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
          Edit Client
        </Link>
      </div>

      {/* Info + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Contact Info</h3>
          {client.email && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail size={14} />{client.email}</div>}
          {client.phone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone size={14} />{client.phone}</div>}
          {client.company && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 size={14} />{client.company}</div>}
          {client.address && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={14} />{client.address}</div>}
        </div>
        <div className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-accent">{formatMoney(totalRevenue, currency)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground mb-1">Total Proposals</p>
          <p className="text-2xl font-bold text-foreground">{proposals.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoices</p>
        </div>
      </div>

      {/* Proposals */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Proposals</h3>
          <Link href={`/proposals/new?client=${id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors">
            <Plus size={12} /> New Proposal
          </Link>
        </div>
        {proposals.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No proposals yet</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/30">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Title</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Amount</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Date</th>
            </tr></thead>
            <tbody>
              {proposals.map(p => (
                <tr key={p.id} onClick={() => router.push(`/proposals/${p.id}`)} className="border-b border-border last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm text-foreground font-medium">{p.title}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PROPOSAL_STATUS[p.status]?.color || "bg-muted text-muted-foreground"}`}>{PROPOSAL_STATUS[p.status]?.label || p.status}</span></td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-foreground">{formatMoney(Number(p.total || 0), currency)}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{new Date(p.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoices */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Invoices</h3>
          <Link href={`/invoices/new?client=${id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors">
            <Plus size={12} /> New Invoice
          </Link>
        </div>
        {invoices.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No invoices yet</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/30">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Invoice</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Amount</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Due Date</th>
            </tr></thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)} className="border-b border-border last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.title}</p>
                  </td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS[inv.status]?.color || "bg-muted text-muted-foreground"}`}>{INVOICE_STATUS[inv.status]?.label || inv.status}</span></td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-foreground">{formatMoney(Number(inv.total || 0), currency)}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
