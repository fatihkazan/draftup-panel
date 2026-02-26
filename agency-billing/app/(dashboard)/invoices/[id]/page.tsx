"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Send,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/format";
import { downloadPdf } from "@/lib/pdfGenerator";

// ============================================
// TYPES
// ============================================

type Invoice = {
  id: string;
  title: string;
  total: number;
  currency: string;
  tax_rate?: number | null;
  status: "draft" | "sent" | "paid" | "overdue" | "void";
  paid: boolean;
  due_date: string | null;
  notes: string | null;
  items: string | null;
  created_at: string;
  public_token: string;
  pdf_url: string | null;
  sent_at: string | null;
  client?: {
    id: string;
    name: string;
    email: string | null;
    company: string | null;
  };
};

type InvoiceItem = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type Payment = {
  id: string;
  amount: number;
  payment_date: string;
  method: string;
  note: string | null;
  created_at: string;
};

// ============================================
// HELPERS
// ============================================


function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getPaymentLink(invoiceId: string) {
  return `${window.location.origin}/pay/${invoiceId}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-slate-500/20 text-muted-foreground" },
  sent: { label: "Sent", color: "bg-accent/20 text-accent" },
  paid: { label: "Paid", color: "bg-accent/20 text-accent" },
  overdue: { label: "Overdue", color: "bg-destructive/10 text-destructive" },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Unpaid", color: "bg-slate-500/20 text-muted-foreground" },
  partially_paid: { label: "Partially paid", color: "bg-amber-500/20 text-amber-400" },
  paid: { label: "Paid", color: "bg-accent/20 text-accent" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  // State
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusMessage, setStatusMessage] = useState("");

  // Action loading states
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [markingAsSent, setMarkingAsSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Add payment modal
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addMethod, setAddMethod] = useState("other");
  const [addNote, setAddNote] = useState("");

  // Edit payment modal
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMethod, setEditMethod] = useState("other");
  const [editNote, setEditNote] = useState("");

  // ============================================
  // DATA LOADING
  // ============================================

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  useEffect(() => {
    const handleFocus = () => loadInvoice();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  async function loadInvoice() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    if (!agencyData?.id) {
      setStatusMessage("No agency found");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
  .from("invoices")
  .select(
    `
    *,
    client:clients(id, name, email, company),
    invoice_items(id, title, description, qty, unit_price)
  `
  )
  .eq("id", invoiceId)
  .eq("agency_id", agencyData.id)
  .single();

    if (error || !data) {
      console.log("LOAD ERROR:", error);
      setStatusMessage("Invoice not found");
      setLoading(false);
      return;
    }

    setInvoice(data as Invoice);

    // Parse items
    // Parse items from invoice_items table
if (data.invoice_items && Array.isArray(data.invoice_items)) {
  const parsedItems = data.invoice_items.map((item: any) => ({
    id: item.id,
    title: item.title ?? "",
    description: item.description ?? "",
    quantity: item.qty,
    unitPrice: item.unit_price,
  }));
  setItems(parsedItems);
}

    await loadPayments(invoiceId);
    setLoading(false);
  }

  async function loadPayments(invId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`/api/invoices/${invId}/payments`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setPayments(json.payments ?? []);
      }
    } catch {
      setPayments([]);
    }
  }

  // ============================================
  // BUTTON STATE LOGIC (STRICT)
  // ============================================

  // Determine which buttons to show based on invoice state
  const isDraft = invoice?.status === "draft";
  const isSent = invoice?.status === "sent";
  const hasPdf = !!invoice?.pdf_url;

  // Button visibility rules:
  // - No PDF: "Generate PDF" (any status, including paid)
  // - Has PDF: "Download PDF" (any status)
  // - Draft + Has PDF: "Mark as Invoice" + "Download PDF"
  // - Sent: "Download PDF" + "Send to Customer"

  const showGeneratePdf = !hasPdf;
  const showMarkAsInvoice = isDraft && hasPdf;
  const showDownloadPdf = hasPdf;
  const showSendToCustomer = hasPdf && invoice?.status !== "draft";

  // ============================================
  // ACTION HANDLERS
  // ============================================

  async function handleGeneratePdf() {
    setGeneratingPdf(true);
    setStatusMessage("Generating PDF...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatusMessage("ERROR: Not authenticated");
        return;
      }
      const response = await fetch(`/api/invoices/${invoiceId}/generate-pdf-v2`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate PDF");
      }
      setStatusMessage("PDF generated successfully!");
      await loadInvoice();
    } catch (error) {
      console.error("handleGeneratePdf error:", error);
      setStatusMessage(
        "ERROR: " + (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setGeneratingPdf(false);
    }
  }
  async function handleDownloadPdf() {
    if (!invoice?.pdf_url) {
      setStatusMessage("ERROR: No PDF available");
      return;
    }

    const filename = `${invoice.title.replace(/[^a-z0-9]/gi, "_")}_invoice.pdf`;
    await downloadPdf(invoice.pdf_url, filename);
  }

  /**
   * Mark as Invoice: Updates status to 'sent', sets sent_at
   * This finalizes the invoice - becomes official/revenue-counted
   */
  async function handleMarkAsInvoice() {
    if (!invoice) return;

    setMarkingAsSent(true);
    setStatusMessage("Finalizing invoice...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`/api/invoices/${invoiceId}/mark-sent`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to finalize invoice");
      }

      setStatusMessage("Invoice finalized successfully!");

      // Reload invoice to get updated status
      await loadInvoice();
    } catch (error) {
      setStatusMessage(
        "ERROR: " + (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setMarkingAsSent(false);
    }
  }

  async function handleAddPayment() {
    if (!invoice) return;

    const amountNumber = Number(addAmount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      setStatusMessage("ERROR: Amount must be greater than 0");
      return;
    }
    const paidAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
    const balanceDue = Math.max(0, Number(invoice.total) - paidAmount);
    if (amountNumber > balanceDue) {
      setStatusMessage(`ERROR: Amount cannot exceed balance due (${balanceDue.toFixed(2)})`);
      return;
    }
    if (!addDate || !addDate.trim()) {
      setStatusMessage("ERROR: Payment date is required");
      return;
    }

    setPaymentSubmitting(true);
    setStatusMessage("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setStatusMessage("ERROR: Not authenticated");
      setPaymentSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amount: Math.round(amountNumber * 100) / 100,
          payment_date: addDate.trim(),
          method: addMethod,
          note: addNote?.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage("ERROR: " + (data.error || "Failed to add payment"));
        return;
      }
      setStatusMessage("Payment added successfully!");
      setShowAddPaymentModal(false);
      setAddAmount("");
      setAddDate("");
      setAddMethod("other");
      setAddNote("");
      await loadPayments(invoiceId);
    } catch (e) {
      setStatusMessage("ERROR: " + (e instanceof Error ? e.message : "Failed to add payment"));
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function handleEditPayment() {
    if (!editingPayment || !invoice) return;
    const amount = parseFloat(editAmount);
    const othersSum = payments
      .filter((p) => p.id !== editingPayment.id)
      .reduce((s, p) => s + Number(p.amount), 0);
    const balanceForThis = Math.max(0, Number(invoice.total) - othersSum);
    if (!amount || amount <= 0) {
      setStatusMessage("ERROR: Amount must be greater than 0");
      return;
    }
    if (amount > balanceForThis) {
      setStatusMessage(`ERROR: Amount cannot exceed balance due (${balanceForThis.toFixed(2)})`);
      return;
    }
    if (!editDate) {
      setStatusMessage("ERROR: Payment date is required");
      return;
    }
    setPaymentSubmitting(true);
    setStatusMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const res = await fetch(`/api/payments/${editingPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          amount: Math.round(amount * 100) / 100,
          payment_date: editDate,
          method: editMethod,
          note: editNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update payment");
      setStatusMessage("Payment updated!");
      setEditingPayment(null);
      await loadPayments(invoiceId);
    } catch (e) {
      setStatusMessage("ERROR: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function handleDeletePayment(payment: Payment) {
    if (!confirm("Delete this payment?")) return;
    setPaymentSubmitting(true);
    setStatusMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete payment");
      setStatusMessage("Payment deleted.");
      await loadPayments(invoiceId);
    } catch (e) {
      setStatusMessage("ERROR: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setPaymentSubmitting(false);
    }
  }

  function openAddPaymentModal() {
    setAddAmount("");
    setAddDate(new Date().toISOString().slice(0, 10));
    setAddMethod("other");
    setAddNote("");
    setShowAddPaymentModal(true);
  }

  function openEditPaymentModal(p: Payment) {
    setEditingPayment(p);
    setEditAmount(String(p.amount));
    setEditDate(p.payment_date.slice(0, 10));
    setEditMethod(p.method || "other");
    setEditNote(p.note || "");
  }

  async function handleCopyPaymentLink() {
    const link = getPaymentLink(invoice!.id);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Send to Customer: Sends email with PDF link
   * Does NOT change status (already 'sent')
   */
  async function handleSendToCustomer() {
    if (!invoice) return;

    if (!invoice.client?.email) {
      setStatusMessage("ERROR: Customer has no email address");
      return;
    }

    setSendingEmail(true);
    setStatusMessage("Sending email...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`/api/invoices/${invoiceId}/send-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      setStatusMessage(`Email sent to ${invoice.client.email}!`);
    } catch (error) {
      setStatusMessage(
        "ERROR: " + (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setSendingEmail(false);
    }
  }

  // ============================================
  // RENDER: Loading State
  // ============================================

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading invoice...</div>
      </div>
    );
  }

  // ============================================
  // RENDER: Not Found State
  // ============================================

  if (!invoice) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">Invoice not found</div>
          <Link href="/invoices" className="text-accent hover:text-accent/90">
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Main Content
  // ============================================

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const taxRate = Number(invoice.tax_rate ?? 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const paidAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balanceDue = Math.max(0, Number(invoice.total) - paidAmount);
  const paymentStatus =
    paidAmount >= Number(invoice.total)
      ? "paid"
      : paidAmount > 0
        ? "partially_paid"
        : "unpaid";
  const displayStatus =
    invoice.status === "draft" ? "draft" : paymentStatus;
  const statusConfig =
    displayStatus === "draft"
      ? STATUS_CONFIG.draft
      : PAYMENT_STATUS_CONFIG[displayStatus] || STATUS_CONFIG.sent;
  const statusLabel =
    displayStatus === "draft" ? "Draft" : PAYMENT_STATUS_CONFIG[paymentStatus]?.label ?? "Sent";

  return (
    <div className="p-6">
      {/* Back Link & Header */}
      <div className="mb-6">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Invoices
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold text-foreground">
                {invoice.title}
              </h1>
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusConfig.color}`}
              >
                {statusLabel}
              </span>
              {hasPdf && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-400">
                  <FileText size={12} />
                  PDF Ready
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Created {formatDate(invoice.created_at)}
              {invoice.due_date && ` • Due ${formatDate(invoice.due_date)}`}
              {invoice.sent_at && ` • Sent ${formatDate(invoice.sent_at)}`}
            </p>
          </div>

          {/* Action Buttons - Conditionally rendered based on state */}
          <div className="flex gap-2">
            {/* Generate PDF button - Only shown when draft AND no pdf_url */}
            {showGeneratePdf && (
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    Generate PDF
                  </>
                )}
              </button>
            )}

            {/* Download PDF button - Shown when pdf_url exists */}
            {showDownloadPdf && (
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Download size={16} />
                Download PDF
              </button>
            )}

            {/* Mark as Invoice button - Only shown when draft AND has pdf_url */}
            {showMarkAsInvoice && (
              <button
                onClick={handleMarkAsInvoice}
                disabled={markingAsSent}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {markingAsSent ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Mark as Invoice
                  </>
                )}
              </button>
            )}

            {/* Send to Customer button - Only shown when status is 'sent' */}
            {invoice?.status === "draft" && (
              <Link
                href={`/invoices/${invoiceId}/edit`}
                className="flex items-center gap-2 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Pencil size={16} />
                Edit Invoice
              </Link>
            )}
            {showSendToCustomer && (
              <button
                onClick={handleSendToCustomer}
                disabled={sendingEmail || !invoice.client?.email}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
                title={
                  !invoice.client?.email ? "Customer has no email" : undefined
                }
              >
                {sendingEmail ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Send to Customer
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm ${
            statusMessage.includes("ERROR")
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : statusMessage.includes("...")
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-emerald-500/50 bg-emerald-500/10 text-accent"
          }`}
        >
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Customer</h3>
            {invoice.client ? (
              <div>
                <div className="text-foreground font-medium">
                  {invoice.client.name}
                </div>
                {invoice.client.email && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {invoice.client.email}
                  </div>
                )}
                {invoice.client.company && (
                  <div className="text-sm text-muted-foreground">
                    {invoice.client.company}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground">No customer assigned</div>
            )}
          </div>

          {/* Items */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Items</h3>

            {items.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No items
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-3 text-xs text-muted-foreground font-medium px-1">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {/* Item Rows */}
                {items.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="grid grid-cols-12 gap-3 py-2 border-t border-border"
                  >
                    <div className="col-span-6 text-foreground">
                      <div>{item.title || "—"}</div>
                      {item.description && (
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-muted-foreground">
                      {item.quantity}
                    </div>
                    <div className="col-span-2 text-right text-muted-foreground">
                      {formatMoney(item.unitPrice, invoice.currency)}
                    </div>
                    <div className="col-span-2 text-right font-medium text-foreground">
                      {formatMoney(
                        item.quantity * item.unitPrice,
                        invoice.currency
                      )}
                    </div>
                  </div>
                ))}

                {/* Totals */}
                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium text-foreground">
                          {formatMoney(subtotal, invoice.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax ({Math.round(taxRate * 100)}%)</span>
                        <span className="font-medium text-foreground">
                          {formatMoney(taxAmount, invoice.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                        <span className="text-foreground">Total</span>
                        <span className="text-foreground">
                          {formatMoney(invoice.total, invoice.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="rounded-2xl bg-card border border-border p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}

          {/* Payments */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Payments</h3>
              {balanceDue > 0 && (
                <button
                  onClick={openAddPaymentModal}
                  disabled={paymentSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/90 disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add payment
                </button>
              )}
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No payments recorded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50 border border-border"
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {formatMoney(Number(p.amount), invoice.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(p.payment_date)}
                        {p.method && p.method !== "other" && (
                          <> • {PAYMENT_METHOD_LABELS[p.method] ?? p.method}</>
                        )}
                        {p.note && <> • {p.note}</>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                          onClick={() => openEditPaymentModal(p)}
                          disabled={paymentSubmitting}
                          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(p)}
                          disabled={paymentSubmitting}
                          className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Summary</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span
                  className={`font-medium ${(displayStatus === "draft" ? STATUS_CONFIG.draft : PAYMENT_STATUS_CONFIG[paymentStatus])?.color.split(" ")[1] ?? "text-muted-foreground"}`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium text-foreground">
                  {invoice.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium text-foreground">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PDF</span>
                <span
                  className={`font-medium ${hasPdf ? "text-accent" : "text-muted-foreground"}`}
                >
                  {hasPdf ? "Generated" : "Not generated"}
                </span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-medium text-foreground">
                    {formatDate(invoice.due_date)}
                  </span>
                </div>
              )}
              {invoice.sent_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Finalized</span>
                  <span className="font-medium text-foreground">
                    {formatDate(invoice.sent_at)}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-border mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium text-foreground">
                  {formatMoney(invoice.total, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid amount</span>
                <span className="font-medium text-foreground">
                  {formatMoney(paidAmount, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Balance due</span>
                <span className="font-medium text-foreground">
                  {formatMoney(balanceDue, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Link Card */}
          {hasPdf && (
            <div className="rounded-2xl bg-card border border-border p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Payment Link
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Share this link with your customer to accept payment
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/pay/${invoice.id}`}
                  className="flex-1 rounded-lg bg-secondary border border-border px-3 py-2 text-xs text-muted-foreground truncate"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/pay/${invoice.id}`
                    );
                    setStatusMessage("Link copied to clipboard!");
                    setTimeout(() => setStatusMessage(""), 2000);
                  }}
                  className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment Modal */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-secondary border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add payment</h3>
              <button
                onClick={() => setShowAddPaymentModal(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg bg-slate-900 border border-border px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Payment date *</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-border px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Method</label>
                <select
                  value={addMethod}
                  onChange={(e) => setAddMethod(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-border px-3 py-2 text-foreground"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder="Reference or note"
                  className="w-full rounded-lg bg-slate-900 border border-border px-3 py-2 text-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Balance due: {formatMoney(balanceDue, invoice.currency)}
              </p>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddPayment}
                disabled={paymentSubmitting}
                className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {paymentSubmitting ? "Adding..." : "Add payment"}
              </button>
              <button
                onClick={() => setShowAddPaymentModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-secondary border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Edit payment</h3>
              <button
                onClick={() => setEditingPayment(null)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg bg-slate-900 border border-border px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Payment date *</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-border px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Method</label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-border px-3 py-2 text-foreground"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Reference or note"
                  className="w-full rounded-lg bg-slate-900 border border-border px-3 py-2 text-foreground"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleEditPayment}
                disabled={paymentSubmitting}
                className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {paymentSubmitting ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditingPayment(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
