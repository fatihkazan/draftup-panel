"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, Pencil, FileText, Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { InvoiceLimitModal } from "@/components/InvoiceLimitModal";
import { toast } from "@/components/ui/Toast";

/* ---------------- TYPES ---------------- */

type Client = {
  id: string;
  name: string;
  client_code?: string;
};

type Proposal = {
  id: string;
  proposal_number: string;
  title: string;
  total: number;
  currency: string;
  status: string;
  valid_until: string | null;
  created_at: string;
  created_by_name?: string | null;
  client: Client | null;
  converted_to_invoice_id: string | null;
};

/* ---------------- HELPERS ---------------- */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ---------------- UI COMPONENTS ---------------- */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    sent: { label: "Sent", color: "bg-primary/10 text-primary" },
    approved: { label: "Approved", color: "bg-accent/10 text-accent" },
    rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
  };
  const cfg = config[status] || config.draft;
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

/* ---------------- MAIN CONTENT ---------------- */

function ProposalsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const clientFilter = searchParams.get("client") || "";
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingProposalId, setConvertingProposalId] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 10;

  // ============================================
  // EFFECT 1: Initialize Agency ID
  // ============================================
  useEffect(() => {
    let isMounted = true;

    const initializeAgency = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          setLoading(false);
          return;
        }

        const { data: agencyData } = await supabase
          .from("agency_settings")
          .select("id")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (isMounted && agencyData?.id) {
          setAgencyId(agencyData.id);
        } else if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize agency:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAgency();

    return () => {
      isMounted = false;
    };
  }, []);

  // ============================================
  // EFFECT 2: Load Proposals (after agencyId is available)
  // ============================================
  useEffect(() => {
    if (!agencyId) return;

    let isMounted = true;

    const loadProposals = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("proposals")
          .select("id, proposal_number, title, total, currency, status, valid_until, created_at, created_by_name, converted_to_invoice_id, client:clients(id, name, client_code)")
          .eq("agency_id", agencyId)
          .order("created_at", { ascending: false });
          
          

        if (error) {
          console.error("Failed to load proposals:", error.message);
          return;
        }

        if (isMounted && data) {
  setProposals(data.map(p => ({
    id: p.id,
    proposal_number: p.proposal_number,
    title: p.title,
    total: p.total,
    currency: p.currency,
    status: p.status,
    valid_until: p.valid_until,
    created_at: p.created_at,
    created_by_name: p.created_by_name,
    converted_to_invoice_id: p.converted_to_invoice_id,
    client: p.client as unknown as Client | null,
  })));
}
      } catch (error) {
        console.error("Error loading proposals:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProposals();

    return () => {
      isMounted = false;
    };
  }, [agencyId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilter, clientFilter]);

  // ============================================
  // HANDLER: Delete Proposal
  // ============================================
  const handleDelete = async (e: React.MouseEvent, proposalId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this proposal?")) return;

    const { error } = await supabase
      .from("proposals")
      .delete()
      .eq("id", proposalId);

    if (!error) {
      setProposals(proposals.filter(p => p.id !== proposalId));
    }
  };
// ============================================
// HANDLER: Convert to Invoice
// ============================================
const [converting, setConverting] = useState<string | null>(null);

const handleConvertToInvoice = async (e: React.MouseEvent, proposalId: string) => {
  e.stopPropagation();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    toast("Not authenticated", "error");
    return;
  }

  const usageRes = await fetch("/api/subscription/invoice-usage", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const usageData = await usageRes.json();
  if (usageData.atLimit) {
    setShowLimitModal(true);
    return;
  }

  setConvertingProposalId(proposalId);
  setConvertModalOpen(true);
  return;
};

  const confirmConvert = async () => {
    if (!convertingProposalId) return;
    setConvertModalOpen(false);
    const proposalId = convertingProposalId;
    setConvertingProposalId(null);
    setConverting(proposalId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast("Not authenticated", "error");
        return;
      }
      const response = await fetch(`/api/proposals/${proposalId}/convert-to-invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.error === "Invoice limit reached") {
          setShowLimitModal(true);
        } else {
          toast(data.error || "Failed to convert proposal", "error");
        }
        return;
      }
      router.push(`/invoices/${data.invoice_id}`);
    } catch (error) {
      console.error("Conversion error:", error);
      toast("An unexpected error occurred", "error");
    } finally {
      setConverting(null);
    }
  };

  const filteredProposals = useMemo(() => {
    let result = proposals;
    if (searchQuery.trim()) {
      result = result.filter(p =>
        p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (selectedFilter !== "all") {
      result = result.filter(p => p.status === selectedFilter);
    }
    if (clientFilter) {
      result = result.filter(p => p.client?.id === clientFilter);
    }
    return result;
  }, [proposals, searchQuery, selectedFilter, clientFilter]);

  const totalPages = Math.ceil(filteredProposals.length / ITEMS_PER_PAGE);
  const paginatedProposals = filteredProposals.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Proposals</h1>
          <p className="text-sm text-muted-foreground">Manage your proposals</p>
        </div>

        <Link
          href="/proposals/new"
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus size={18} />
          New Proposal
        </Link>
      </div>

      {/* Search + Filter bar - only when we have proposals */}
      {!loading && proposals.length > 0 && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search proposals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 h-9 pl-9 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              {["all", "draft", "sent", "approved", "rejected"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedFilter === filter
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Proposals Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-accent mb-3" />
            <div className="text-sm text-muted-foreground">Loading proposals...</div>
          </div>
        ) : proposals.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
            <div className="text-sm text-muted-foreground mb-4">No proposals yet. Create your first one.</div>
            <Link
              href="/proposals/new"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground hover:bg-accent/90 transition-colors"
            >
              <Plus size={16} />
              Create Your First Proposal
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-4 font-medium">Code</th>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Created</th>
                <th className="px-6 py-4 font-medium">Created By</th>
                <th className="px-6 py-4 font-medium">Valid Until</th>
                <th className="px-6 py-4 font-medium text-right">Total</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedProposals.map((proposal) => (
                <tr
                  key={proposal.id}
                  onClick={() => router.push(`/proposals/${proposal.id}`)}
                  className="cursor-pointer hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-foreground">{proposal.proposal_number || "—"}</span>
                  </td>
                  <td className="px-6 py-4 text-foreground">
                    {proposal.title || "—"}
                  </td>
                  <td className="px-6 py-4 text-foreground">
                    {proposal.client?.name || "—"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {formatDate(proposal.created_at)}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {proposal.created_by_name || "—"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {proposal.valid_until ? formatDate(proposal.valid_until) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">
                    {formatCurrency(proposal.total || 0)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={proposal.status || "draft"} />
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
  <div className="flex items-center gap-2">
    {/* Convert to Invoice button - only show for approved proposals */}
{proposal.status === "approved" && !proposal.converted_to_invoice_id && (
  <button
    onClick={(e) => handleConvertToInvoice(e, proposal.id)}
    disabled={converting === proposal.id}
    className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-xs font-medium transition-colors disabled:opacity-50"
    title="Convert to Invoice"
  >
    {converting === proposal.id ? "Converting..." : "→ Invoice"}
  </button>
)}
    
    
    
    {/* Already converted indicator */}
    {proposal.converted_to_invoice_id && (
      <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
        Converted
      </span>
    )}

    <button
      onClick={() => router.push(`/proposals/new?edit=${proposal.id}`)}
      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      title="Edit"
    >
      <Pencil size={16} />
    </button>
    <button
      onClick={(e) => handleDelete(e, proposal.id)}
      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
      title="Delete"
    >
      <Trash2 size={16} />
    </button>
  </div>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && proposals.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
            <p className="text-sm text-muted-foreground">
              Showing {filteredProposals.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredProposals.length)} of {filteredProposals.length} proposals
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
                      : "bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
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
        )}
      </div>

      {showLimitModal && (
        <InvoiceLimitModal onClose={() => setShowLimitModal(false)} />
      )}

      {convertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-foreground mb-2">Convert to Invoice</h3>
            <p className="text-sm text-muted-foreground mb-6">
              This proposal will be converted to a draft invoice. Do you want to continue?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setConvertModalOpen(false); setConvertingProposalId(null); }}
                className="flex-1 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmConvert}
                disabled={!!converting}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {converting ? "Converting..." : "Convert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProposalsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <ProposalsPageContent />
    </Suspense>
  );
}
