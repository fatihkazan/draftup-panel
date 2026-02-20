"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Loader2, Send, CheckCircle2, Receipt } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/format";
import ProposalSteps from "@/components/proposals/ProposalSteps";
import { toast } from "@/components/ui/Toast";

type Proposal = {
  id: string;
  proposal_number: string;
  title: string;
  total: number;
  currency: string;
  status: string;
  valid_until: string | null;
  created_at: string;
  pdf_url?: string | null;
  converted_to_invoice_id?: string | null;
  service?: string | null;
  tax_rate?: number | null;
  client?: { id: string; name: string; company?: string | null; email?: string | null } | null;
};

type ProposalItem = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", color: "bg-primary/10 text-primary" },
  approved: { label: "Approved", color: "bg-accent/10 text-accent" },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
};

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    if (!proposalId) return;
    loadProposal();
  }, [proposalId]);

  useEffect(() => {
    if (proposal) {
      const step =
        proposal.status === "draft" ? 1 :
        proposal.status === "sent" ? 3 :  // Mail gönderildi, approval bekleniyor
        proposal.status === "approved" ? 4 :  // Approved, invoice oluşturulabilir
        proposal.converted_to_invoice_id ? 4 : 1;
      setCurrentStep(step as 1 | 2 | 3 | 4);
    }
  }, [proposal]);

  async function loadProposal() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) {
      setStatusMessage("Agency not found");
      setLoading(false);
      return;
    }

    // Cache bust: yield so we get fresh data
    await new Promise((resolve) => setTimeout(resolve, 0));

    const { data, error } = await supabase
      .from("proposals")
      .select("*, client:clients(name, email), proposal_items(*), converted_to_invoice_id")
      .eq("id", proposalId)
      .eq("agency_id", agencyData.id)
      .single();

    if (error || !data) {
      setStatusMessage("Proposal not found");
      setProposal(null);
      setLoading(false);
      return;
    }

    setProposal(data as Proposal);
    if ((data as any)?.pdf_url) setPdfUrl((data as any).pdf_url);

    // Items: prefer proposal_items, fallback to service JSON
    const raw = data as any;
    if (raw.proposal_items && Array.isArray(raw.proposal_items) && raw.proposal_items.length > 0) {
      setItems(
        raw.proposal_items.map((it: { id?: string; title?: string; description?: string | null; qty?: number; unit_price?: number }) => ({
          id: it.id || crypto.randomUUID(),
          name: it.title ?? "",
          description: it.description ?? "",
          quantity: typeof it.qty === "number" ? it.qty : 1,
          unitPrice: typeof it.unit_price === "number" ? it.unit_price : 0,
        }))
      );
    } else if (raw?.service) {
      try {
        const serviceData = typeof raw.service === "string" ? JSON.parse(raw.service) : raw.service;
        if (serviceData.items && Array.isArray(serviceData.items)) {
          setItems(
            serviceData.items.map((it: any) => ({
              id: it.id || crypto.randomUUID(),
              name: it.name || "",
              description: it.description || "",
              quantity: typeof it.quantity === "number" ? it.quantity : 1,
              unitPrice: typeof it.unitPrice === "number" ? it.unitPrice : 0,
            }))
          );
        }
      } catch {
        console.error("Failed to parse service data");
      }
    }

    const loadedProposal = data as Proposal;
    const step =
      loadedProposal?.status === "draft" ? 1 :
      loadedProposal?.status === "sent" ? 3 :
      loadedProposal?.status === "approved" ? 4 :
      loadedProposal?.converted_to_invoice_id ? 4 : 1;
    console.log("Proposal loaded:", loadedProposal);
    console.log("Status:", loadedProposal?.status);
    console.log("Current step:", step);

    setStatusMessage("");
    setLoading(false);
  }

  async function handleGeneratePdf() {
    setGeneratingPdf(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`/api/proposals/${proposalId}/generate-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to generate PDF", "error");
        return;
      }
      // Update status to sent after PDF is generated
      await supabase
        .from("proposals")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", proposalId);
      toast("PDF generated! Waiting for customer approval.", "success");
      setPdfUrl(data.pdf_url);
      if (proposal) setProposal({ ...proposal, status: "sent", pdf_url: data.pdf_url });
      setCurrentStep(3);
    } catch {
      toast("Failed to generate PDF", "error");
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleSaveAndContinue() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status: "sent" })
        .eq("id", proposalId);

      if (error) {
        setStatusMessage("ERROR: " + (error.message || "Failed to update proposal"));
        return;
      }

      setStatusMessage("Proposal marked as ready to send!");
      await loadProposal(); // Reload to update status
    } catch {
      setStatusMessage("ERROR: Failed to update proposal");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendToCustomer() {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/proposals/${proposalId}/send-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to send", "error");
      } else {
        toast("Proposal sent to customer!", "success");
        setSendModalOpen(false);
        if (proposal) setProposal({ ...proposal, status: "sent" });
        setCurrentStep(3);
      }
    } catch {
      toast("Failed to send proposal", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleConvertToInvoice() {
    setConverting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatusMessage("ERROR: Not authenticated");
        return;
      }

      const res = await fetch(`/api/proposals/${proposalId}/convert-to-invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage("ERROR: " + (data.error || "Failed to convert proposal"));
        return;
      }

      setStatusMessage("Proposal converted to invoice successfully!");
      await loadProposal(); // Reload to get invoice ID
    } catch {
      setStatusMessage("ERROR: Failed to convert proposal");
    } finally {
      setConverting(false);
    }
  }

  if (!proposalId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Invalid proposal</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-6">
        <Link href="/proposals" className="text-sm text-accent hover:underline flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Proposals
        </Link>
        <p className="mt-4 text-muted-foreground">{statusMessage || "Proposal not found"}</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.draft;

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxRate = proposal.tax_rate ?? 0;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/proposals" className="text-sm text-accent hover:underline flex items-center gap-1 mb-6">
        <ArrowLeft size={14} /> Back to Proposals
      </Link>

      <ProposalSteps
        currentStep={currentStep as 1 | 2 | 3 | 4}
        hasInvoice={!!proposal?.converted_to_invoice_id}
      />

      {statusMessage && (
        <div className={`mb-6 rounded-xl border p-4 text-sm ${
          statusMessage.includes("ERROR")
            ? "border-destructive/50 bg-destructive/10 text-destructive"
            : "border-accent/50 bg-accent/10 text-accent"
        }`}>
          {statusMessage}
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{proposal.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {proposal.proposal_number || proposal.id.slice(0, 8)} • {formatDate(proposal.created_at)}
            </p>
            <span className={`inline-block mt-2 rounded-md px-2.5 py-1 text-xs font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              {formatMoney(proposal.total, proposal.currency)}
            </p>
            {proposal.client && (
              <p className="text-sm text-muted-foreground mt-1">{proposal.client.name}</p>
            )}
          </div>
        </div>

        {/* Step 1: Draft - Generate PDF, Edit, Send to Customer */}
        {currentStep === 1 && (
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
            {!pdfUrl && (
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="flex items-center gap-2 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <FileText size={16} />
                {generatingPdf ? "Generating..." : "Generate PDF"}
              </button>
            )}
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Download size={16} />
                Download PDF
              </a>
            )}
            <Link
              href={`/proposals/new?edit=${proposal.id}`}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
            >
              Edit Proposal
            </Link>
            <button
              onClick={() => setSendModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
            >
              <Send size={16} />
              Send to Customer
            </button>
          </div>
        )}

        {/* Step 3: Sent - Waiting for approval, Manual approve, Download PDF */}
        {currentStep === 3 && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <p className="text-sm text-blue-400 font-medium">Waiting for customer approval</p>
              <p className="text-xs text-muted-foreground mt-1">Customer has not responded yet</p>
            </div>

            <button
              onClick={async () => {
                await supabase
                  .from("proposals")
                  .update({ status: "approved" })
                  .eq("id", proposalId);

                setProposal({ ...proposal, status: "approved" });
                setCurrentStep(4);
                toast("Proposal marked as approved", "success");
              }}
              className="flex items-center gap-2 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <CheckCircle2 size={16} />
              Mark as Approved (Manual)
            </button>

            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Download size={16} />
                Download PDF
              </a>
            ) : (
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="flex items-center gap-2 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <FileText size={16} />
                {generatingPdf ? "Generating..." : "Generate PDF"}
              </button>
            )}
          </div>
        )}

        {/* Step 4: Approved - Customer approved + Convert; or Converted - Link to invoice */}
        {currentStep === 4 && !proposal.converted_to_invoice_id && (
          <div className="space-y-6 pt-4 border-t border-border">
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 flex items-start gap-3">
              <CheckCircle2 size={20} className="text-accent mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Customer approved!</h3>
                <p className="text-sm text-muted-foreground">
                  You can now convert this proposal to an invoice.
                </p>
              </div>
            </div>

            <button
              onClick={handleConvertToInvoice}
              disabled={converting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {converting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Receipt size={16} />
                  Convert to Invoice
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 4: Converted - Show Link to Invoice */}
        {currentStep === 4 && proposal.converted_to_invoice_id && (
          <div className="space-y-6 pt-4 border-t border-border">
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 flex items-start gap-3">
              <CheckCircle2 size={20} className="text-accent mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">Proposal Converted</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  This proposal has been converted to an invoice.
                </p>
                <Link
                  href={`/invoices/${proposal.converted_to_invoice_id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
                >
                  <Receipt size={16} />
                  View Invoice
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-foreground mb-2">Send Proposal</h3>
            <p className="text-sm text-muted-foreground mb-6">
              This proposal will be sent to {proposal?.client?.name} ({proposal?.client?.email})
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSendModalOpen(false)}
                disabled={sending}
                className="flex-1 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendToCustomer}
                disabled={sending}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
