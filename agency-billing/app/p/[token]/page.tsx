"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, FileText, Printer } from "lucide-react";

/* ---------------- TYPES ---------------- */

type Proposal = {
  id: string;
  agency_id: string;
  title: string;
  status: string;
  total: number;
  currency: string;
  tax_rate?: number | null;
  service?: string;
  proposal_number?: string;
  valid_until?: string;
  created_at: string;
  client?: {
    name: string;
    email?: string;
    company?: string;
    address?: string;
    phone?: string;

  };
};

type ProposalItem = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unitType?: string;
  quantity: number;
  unitPrice: number;
};

type AgencySettings = {
  agency_name: string;
  owner_name?: string;
  email: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  iban?: string;
  swift?: string;
  bank_name?: string;
  logo_url?: string;
};

/* ---------------- CONSTANTS ---------------- */

const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string }> = {
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
  TRY: { symbol: "₺", locale: "tr-TR" },
  GBP: { symbol: "£", locale: "en-GB" },
};

/* ---------------- HELPERS ---------------- */

function formatCurrency(amount: number, currency: string): string {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD;
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* ---------------- MAIN COMPONENT ---------------- */

export default function PublicProposalPage() {
  const params = useParams();
  const token = params?.token as string;
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">No token provided</p>
      </div>
    );
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [agency, setAgency] = useState<AgencySettings | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  // Computed values
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [items]);

  const taxRate = Number(proposal?.tax_rate ?? 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;

  // Load proposal
     useEffect(() => {
  async function loadProposal() {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/proposals/public/${token}`);
      
      if (!response.ok) {
        setError("Proposal not found or not yet shared.");
        setLoading(false);
        return;
      }

      const data = await response.json();

      setProposal({ ...data.proposal, client: data.client });
      setAgency(data.agency);
      setItems(data.items || []);
    } catch (error) {
      console.error("Error loading proposal:", error);
      setError("Failed to load proposal.");
    } finally {
      setLoading(false);
    }
  }  // ← Fonksiyon burda kapanıyor

  loadProposal();  // ← Çağrı DIŞARDA
}, [token]);

  // Handle accept (via secure API with token verification)
  const handleAccept = async () => {
    if (!proposal) return;

    setProcessing(true);
    setActionMessage("");

    try {
      const response = await fetch(`/api/proposals/public/${token}/accept`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage("Error: " + (data.error || "Failed to accept"));
      } else {
        setActionMessage("Proposal approved!");
        setProposal({ ...proposal, status: "approved" });
      }
    } catch (err) {
      setActionMessage("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setProcessing(false);
    }
  };

  // Handle reject (via secure API with token verification)
  const handleReject = async () => {
    if (!proposal) return;
    if (!confirm("Are you sure you want to reject this proposal?")) return;

    setProcessing(true);
    setActionMessage("");

    try {
      const response = await fetch(`/api/proposals/public/${token}/reject`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setActionMessage("Error: " + (data.error || "Failed to reject"));
      } else {
        setActionMessage("Proposal rejected.");
        setProposal({ ...proposal, status: "rejected" });
      }
    } catch (err) {
      setActionMessage("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setProcessing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading proposal...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto mb-4 text-gray-400" size={64} />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Proposal Not Found</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  const isApproved = proposal.status === "approved";
  const isRejected = proposal.status === "rejected";
  const canTakeAction = !isApproved && !isRejected;
  const currency = proposal.currency || "USD";

  // Agency info with fallbacks
  const agencyName = agency?.agency_name || "Agency";
  const ownerName = agency?.owner_name || agencyName;
  const agencyEmail = agency?.email || "";
  const agencyPhone = agency?.phone || "";
  const agencyAddress = agency?.address || "";
  const taxId = agency?.tax_id || "";
  const bankName = agency?.bank_name || "";
  const iban = agency?.iban || "";

  
  
  return (
  <div className="min-h-screen bg-gray-50 py-10">
    {/* Print Button */}
    <button
      onClick={() => window.print()}
      className="no-print fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm"
    >
      <Printer size={14} />
      Print
    </button>

    <div className="max-w-3xl mx-auto px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      
      {/* Header */}
      <div className="px-10 py-8 border-b border-gray-100 flex items-start justify-between">
        <div>
          {agency?.logo_url && (
            <img
              src={agency.logo_url}
              alt={agencyName}
              className="h-12 w-auto object-contain mb-3"
            />
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-sm">
              {agencyName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-gray-500 text-sm">{agencyName}</p>
              <h1 className="text-2xl font-bold text-gray-900">PROPOSAL</h1>
            </div>
          </div>
        </div>
        
        <div className="text-right text-sm space-y-1">
          <p><span className="text-gray-500">Proposal No:</span> <span className="text-gray-900">{proposal.proposal_number}</span></p>
          <p><span className="text-gray-500">Date:</span> <span className="text-gray-900">{formatDate(proposal.created_at)}</span></p>
          <p><span className="text-gray-500">Valid Until:</span> <span className="text-gray-900">{proposal.valid_until ? formatDate(proposal.valid_until) : "N/A"}</span></p>
        </div>
      </div>

      {/* From/To Row */}
      <div className="flex justify-between px-10 py-6 text-sm">
        <div className="space-y-1">
          <p className="text-gray-500">{agencyEmail}</p>
          {agencyPhone && <p className="text-gray-500">{agencyPhone}</p>}
        </div>
        <div className="text-right">
          <p className="text-gray-500 font-semibold mb-2">Proposal To</p>
          <p className="text-gray-900 font-semibold">{proposal.client?.name}</p>
          {proposal.client?.company && <p className="text-gray-500">{proposal.client.company}</p>}
        </div>
      </div>

      {/* Status */}
      {(isApproved || isRejected) && (
        <div className={`mx-10 mb-6 rounded-lg p-3 text-center text-sm ${
          isApproved ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        }`}>
          {isApproved ? "✓ Approved" : "✗ Declined"}
        </div>
      )}

      {/* Items Table */}
      <div className="px-10 mb-8">
        <div className="grid grid-cols-12 gap-4 py-3 px-4 bg-gray-50 text-xs uppercase text-gray-500 font-medium">
          <div className="col-span-1">QTY</div>
          <div className="col-span-6">Item Description</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-3 text-right">Total</div>
        </div>

        {items.length === 0 ? (
          <p className="py-8 text-center text-gray-500 text-sm">No items</p>
        ) : (
          items.map((item, index) => {
            const lineTotal = item.quantity * item.unitPrice;
            return (
              <div key={item.id || index} className="grid grid-cols-12 gap-4 py-4 px-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="col-span-1 text-gray-900 text-lg font-bold">{item.quantity}</div>
                <div className="col-span-6">
                  <p className="text-gray-900 font-medium">{item.name}</p>
                  {(item.description || item.category || item.unitType) && (
                    <p className="text-gray-500 text-xs">{item.description || item.category || item.unitType}</p>
                  )}
                </div>
                <div className="col-span-2 text-right text-gray-600">{formatCurrency(item.unitPrice, currency)}</div>
                <div className="col-span-3 text-right text-gray-900 font-semibold">{formatCurrency(lineTotal, currency)}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Totals */}
      <div className="px-10 mb-8">
        <div className="w-80 ml-auto space-y-2 text-sm">
          <div className="flex justify-between text-gray-500 text-sm">
            <span>Sub-Total</span>
            <span className="text-right">{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-gray-500 text-sm">
            <span>Tax ({Math.round(taxRate * 100)}%)</span>
            <span className="text-right">{formatCurrency(taxAmount, currency)}</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t-2 border-gray-800 mt-2">
            <span className="text-lg font-bold text-gray-900">Grand Total</span>
            <span className="text-2xl font-bold text-gray-900">{formatCurrency(total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      {canTakeAction && (
        <div className="no-print px-10 mb-8">
          {actionMessage && (
            <div className={`mb-4 rounded-lg p-3 text-center text-sm ${
              actionMessage.includes("Error") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              {actionMessage}
            </div>
          )}
          
          <div className="flex gap-3 mt-8 justify-center">
            <button
              onClick={handleAccept}
              disabled={processing}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 size={18} />
              Accept Proposal
            </button>
            <button
              onClick={handleReject}
              disabled={processing}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-white border-2 border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <XCircle size={18} />
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-10 py-8 text-center border-t border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You For Your Business</h3>
        <p className="text-gray-500 text-sm">Powered by {agencyName}</p>
      </div>
      </div>
    </div>

    <style jsx global>{`
      @media print {
        body { background: #f9fafb !important; }
        .no-print { display: none !important; }
      }
    `}</style>
  </div>
);}