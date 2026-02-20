"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { randomBytes } from "crypto";
import {
  Plus,
  ArrowLeft,
  X,
  Copy,
  Check,
  Download,
  Loader2,
  AlertCircle,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/format";
import { toast } from "@/components/ui/Toast";
import ProposalSteps from "@/components/proposals/ProposalSteps";

/* ---------------- TYPES ---------------- */

type Client = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};

type ProposalItem = {
  id: string;
  name: string;
  description: string;
  unitType: string;
  quantity: number;
  unitPrice: number;
  serviceId?: string;
};

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

/* ---------------- HELPERS ---------------- */

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "PRO-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}


function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ---------------- MAIN PAGE COMPONENT ---------------- */

function NewProposalPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  // ============================================
  // STATE: Initialization & Loading
  // ============================================
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyCurrency, setAgencyCurrency] = useState<string>("USD");
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // ============================================
  // STATE: Clients
  // ============================================
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  // ============================================
  // STATE: Services (templates for items)
  // ============================================
  const [services, setServices] = useState<Service[]>([]);

  // ============================================
  // STATE: Form Fields
  // ============================================
  const [selectedClientId, setSelectedClientId] = useState("");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [proposalCode, setProposalCode] = useState(generateCode());
  const [taxRate, setTaxRate] = useState(0);

  // ============================================
  // STATE: Share & Download
  // ============================================
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  // ============================================
  // STATE: Save Operation
  // ============================================
  const [saving, setSaving] = useState(false);
  const [savedProposalId, setSavedProposalId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // ============================================
  // EFFECT 1: Initialize Agency ID
  // Fetches the authenticated user and their agency_id
  // ============================================
  useEffect(() => {
    let isMounted = true;

    const initializeAgency = async () => {
      try {
        setInitLoading(true);
        setInitError(null);

        // Step 1: Get authenticated user
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError) {
          throw new Error("Authentication failed. Please log in again.");
        }

        if (!authData.user) {
          throw new Error("Not authenticated. Please log in.");
        }

        // Step 2: Fetch agency_id, currency, default_tax_rate from agency_settings
        const { data: agencyData, error: agencyError } = await supabase
          .from("agency_settings")
          .select("id, currency, default_tax_rate")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (agencyError) {
          throw new Error("Failed to load agency settings.");
        }

        if (!agencyData?.id) {
          throw new Error("No agency found. Please complete your agency setup first.");
        }

        // Step 3: Store agencyId in state
        if (isMounted) {
          setAgencyId(agencyData.id);
          setAgencyCurrency(agencyData.currency || "USD");
          setTaxRate(Number(agencyData.default_tax_rate) || 0);
        }
      } catch (error) {
        if (isMounted) {
          setInitError(error instanceof Error ? error.message : "Initialization failed.");
        }
      } finally {
        if (isMounted) {
          setInitLoading(false);
        }
      }
    };

    initializeAgency();

    return () => {
      isMounted = false;
    };
  }, []);

  // ============================================
  // EFFECT 2: Load Clients (after agencyId is available)
  // ============================================
  useEffect(() => {
    if (!agencyId) return;

    let isMounted = true;

    const loadClients = async () => {
      try {
        setClientsLoading(true);

        const { data, error } = await supabase
          .from("clients")
          .select("id, name, company, email")
          .eq("agency_id", agencyId)
          .order("name", { ascending: true });

        if (error) {
          console.error("Failed to load clients:", error.message);
          return;
        }

        if (isMounted) {
          setClients((data as Client[]) || []);
        }
      } catch (error) {
        console.error("Error loading clients:", error);
      } finally {
        if (isMounted) {
          setClientsLoading(false);
        }
      }
    };

    loadClients();

    return () => {
      isMounted = false;
    };
  }, [agencyId]);

  // ============================================
  // EFFECT 2b: Load Services (all, for labels + active for dropdown)
  // ============================================
  useEffect(() => {
    if (!agencyId) return;
    let isMounted = true;

    const loadServices = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/services", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok || !isMounted) return;
      const json = await res.json();
      setServices(json.services ?? []);
    };
    loadServices();
    return () => { isMounted = false; };
  }, [agencyId]);

  // ============================================
  // EFFECT 3: Load Existing Proposal for Editing
  // ============================================
  useEffect(() => {
    if (!agencyId || !editId) return;

    let isMounted = true;

    const loadProposal = async () => {
      try {
        const { data, error } = await supabase
          .from("proposals")
          .select("*")
          .eq("id", editId)
          .eq("agency_id", agencyId)
          .single();

        if (error || !data) {
          console.error("Failed to load proposal:", error?.message);
          return;
        }

        if (isMounted) {
          setSavedProposalId(editId);
          setTitle(data.title || "");
          setSelectedClientId(data.client_id || "");
          setValidUntil(data.valid_until || "");
          setProposalCode(data.proposal_number || generateCode());
          if (data.tax_rate != null) {
            setTaxRate(Number(data.tax_rate) || 0);
          }

          // Parse service JSON for items, notes, and share token
          if (data.service) {
            try {
              const serviceData = typeof data.service === "string"
                ? JSON.parse(data.service)
                : data.service;

              if (serviceData.items && Array.isArray(serviceData.items)) {
                setItems(
                  serviceData.items.map((it: Record<string, unknown>) => ({
                    id: it.id ?? crypto.randomUUID(),
                    name: it.name ?? "",
                    description: it.description ?? "",
                    unitType: it.unitType ?? (it.category ?? "hours"),
                    quantity: typeof it.quantity === "number" ? it.quantity : 1,
                    unitPrice: typeof it.unitPrice === "number" ? it.unitPrice : 0,
                    serviceId: it.serviceId ?? undefined,
                  }))
                );
              }
              if (serviceData.notes) {
                setNotes(serviceData.notes);
              }
              if (serviceData.share_token) {
                setShareToken(serviceData.share_token);
                setShowDownload(true);
              }
            } catch {
              console.error("Failed to parse service data");
            }
          }
        }
      } catch (error) {
        console.error("Error loading proposal:", error);
      }
    };

    loadProposal();

    return () => {
      isMounted = false;
    };
  }, [agencyId, editId]);

  // ============================================
  // COMPUTED VALUES
  // ============================================
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // ============================================
  // HANDLERS: Item Management
  // ============================================
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        unitType: "hours",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleSelectService = (itemId: string, serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems(
      items.map((item) => {
        if (item.id !== itemId) return item;
        const isFirstSelection = !item.serviceId;
        return {
          ...item,
          serviceId,
          name: svc.name,
          description: svc.description ?? "",
          unitType: svc.unit_type,
          unitPrice: isFirstSelection ? svc.default_unit_price : item.unitPrice,
        };
      })
    );
  };

  const handleUpdateItem = (id: string, field: keyof ProposalItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // ============================================
  // HANDLER: Share with Customer
  // ============================================
  const handleShare = () => {
    const token = generateToken();
    setShareToken(token);
    const url = `${window.location.origin}/proposals/preview/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setShowDownload(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ============================================
  // HANDLER: Download PDF
  // ============================================
  const handleDownloadPDF = async () => {
    const jsPDF = (await import("jspdf")).default;
    const html2canvas = (await import("html2canvas")).default;

    const pdfContent = document.createElement("div");
    pdfContent.style.padding = "40px";
    pdfContent.style.fontFamily = "Arial, sans-serif";
    pdfContent.style.width = "595px";
    pdfContent.style.background = "#fff";

    pdfContent.innerHTML = `
      <div style="margin-bottom: 30px;">
        <h1 style="font-size: 24px; margin: 0 0 10px 0;">${proposalCode}</h1>
        <p style="color: #666; margin: 0;">Date: ${formatDate(new Date().toISOString())}</p>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="font-size: 14px; color: #666; margin: 0 0 5px 0;">Customer</h3>
        <p style="font-size: 16px; margin: 0;">${selectedClient?.name || "—"}</p>
        ${selectedClient?.email ? `<p style="color: #666; margin: 5px 0 0 0;">${selectedClient.email}</p>` : ""}
        ${selectedClient?.company ? `<p style="color: #666; margin: 5px 0 0 0;">${selectedClient.company}</p>` : ""}
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="font-size: 14px; color: #666; margin: 0 0 5px 0;">Proposal Title</h3>
        <p style="font-size: 16px; margin: 0;">${title || "—"}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="text-align: left; padding: 10px; border: 1px solid #ddd;">Name</th>
            <th style="text-align: left; padding: 10px; border: 1px solid #ddd;">Unit</th>
            <th style="text-align: right; padding: 10px; border: 1px solid #ddd;">Qty</th>
            <th style="text-align: right; padding: 10px; border: 1px solid #ddd;">Unit Price</th>
            <th style="text-align: right; padding: 10px; border: 1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">${item.name || "—"}${item.description ? `<br/><span style="color:#888;font-size:12px">${item.description}</span>` : ""}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${item.unitType ?? "hours"}</td>
              <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
              <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">${formatMoney(item.unitPrice, agencyCurrency)}</td>
              <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">${formatMoney(item.quantity * item.unitPrice, agencyCurrency)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div style="text-align: right; margin-bottom: 30px;">
        <p style="margin: 5px 0;"><span style="color: #666;">Subtotal:</span> <strong>${formatMoney(subtotal, agencyCurrency)}</strong></p>
        <p style="margin: 5px 0;"><span style="color: #666;">Tax (${Math.round(taxRate * 100)}%):</span> <strong>${formatMoney(taxAmount, agencyCurrency)}</strong></p>
        <p style="margin: 5px 0; font-size: 18px;"><span style="color: #666;">Total:</span> <strong>${formatMoney(total, agencyCurrency)}</strong></p>
      </div>

      ${notes ? `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 14px; color: #666; margin: 0 0 5px 0;">Notes</h3>
          <p style="margin: 0;">${notes}</p>
        </div>
      ` : ""}

      <div style="border-top: 1px solid #ddd; padding-top: 20px; color: #666; font-size: 12px;">
        <p style="margin: 0;">This proposal is valid until ${validUntil ? formatDate(validUntil) : "—"}.</p>
      </div>
    `;

    document.body.appendChild(pdfContent);

    const canvas = await html2canvas(pdfContent, { scale: 2 });
    document.body.removeChild(pdfContent);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${proposalCode}.pdf`);
  };

  // ============================================
  // HANDLER: Save Proposal
  // ============================================
  const handleSave = async () => {
  toast("Save started...", "info");
  // Validation 1: Check agencyId
  if (!agencyId) {
    toast("Agency not found. Please refresh the page or check your settings.", "error");
    return;
  }

  // Validation 2: Check selectedClientId
  if (!selectedClientId) {
    toast("Please select a customer before saving.", "info");
    return;
  }

  // Validation 3: Check title
  if (!title.trim()) {
    toast("Please enter a proposal title.", "info");
    return;
  }

  setSaving(true);

  try {
    const baseData = {
  agency_id: agencyId,
  client_id: selectedClientId,
  proposal_number: proposalCode,
  title: title.trim(),
  total: total,
  currency: agencyCurrency,
  tax_rate: taxRate,
  status: shareToken ? "sent" : "draft",
  valid_until: validUntil || null,
  public_token: randomBytes(16).toString("hex"),
  service: JSON.stringify({
    items: items,
    notes: notes,
    subtotal: subtotal,
    tax_amount: taxAmount,
    share_token: shareToken,
  }),
};

    let savedProposalId = editId;

    if (editId) {
      // Update existing proposal (do not overwrite created_by_name)
      const { error } = await supabase
        .from("proposals")
        .update(baseData)
        .eq("id", editId)
        .eq("agency_id", agencyId);
      
      if (error) {
        toast(`Error updating proposal: ${error.message}`, "error");
        return;
      }

      // Delete old items
      await supabase
        .from("proposal_items")
        .delete()
        .eq("proposal_id", editId);

    } else {
      // Insert new proposal (include created_by_name)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast("Not authenticated", "error");
        setSaving(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const createdByName =
        profile?.full_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "Unknown";

      const proposalData = { ...baseData, created_by_name: createdByName };

      const { data, error } = await supabase
        .from("proposals")
        .insert(proposalData)
        .select()
        .single();
      
      if (error) {
        toast(`Error creating proposal: ${error.message}`, "error");
        return;
      }

      savedProposalId = data.id;
    }

    // Insert proposal items (snapshot: title and description separate)
    if (items.length > 0) {
      const proposalItems = items.map(item => ({
        proposal_id: savedProposalId,
        title: item.name,
        description: item.description || null,
        qty: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { error: itemsError } = await supabase
        .from("proposal_items")
        .insert(proposalItems);

      if (itemsError) {
        toast(`Error saving items: ${itemsError.message}`, "error");
        return;
      }
    }

    setSavedProposalId(savedProposalId);
    
    // Redirect to proposal detail page after successful save
    router.push(`/proposals/${savedProposalId}`);
  } catch (error) {
    toast(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
  } finally {
    setSaving(false);
  }
};

  // ============================================
  // RENDER: Loading State
  // ============================================
  if (initLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Error State
  // ============================================
  if (initError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Unable to Load</h2>
            <p className="text-sm text-muted-foreground">{initError}</p>
          </div>
          <Link
            href="/proposals"
            className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/90"
          >
            <ArrowLeft size={16} />
            Back to Proposals
          </Link>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Main Form
  // ============================================
  return (
    <div className="flex h-full">
      {/* Main Form Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Back Link & Header */}
        <div className="mb-6">
          <Link
            href="/proposals"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Back to Proposals
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">
            {editId ? "Edit Proposal" : "New Proposal"}
          </h1>
          <p className="text-sm text-muted-foreground">{proposalCode}</p>
        </div>

        <ProposalSteps currentStep={1} />

        {/* Form Cards */}
        <div className="space-y-6 max-w-4xl">
          {/* Proposal Details Card */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Proposal Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Proposal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter proposal title"
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Customer
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={clientsLoading}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                >
                  <option value="">
                    {clientsLoading ? "Loading customers..." : "Select customer"}
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.company && ` (${client.company})`}
                    </option>
                  ))}
                </select>
                {selectedClient && (
                  <div className="mt-2 p-3 rounded-xl bg-secondary border border-border">
                    <div className="text-sm font-medium text-foreground">{selectedClient.name}</div>
                    {selectedClient.email && (
                      <div className="text-xs text-muted-foreground mt-1">{selectedClient.email}</div>
                    )}
                    {selectedClient.company && (
                      <div className="text-xs text-muted-foreground mt-0.5">{selectedClient.company}</div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={1}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          {/* Items Card */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Items</h3>
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No items yet. Click "Add Item" to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-3 text-xs text-muted-foreground font-medium px-1">
                  <div className="col-span-2">Service</div>
                  <div className="col-span-4">Item Name</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Item Rows */}
                {items.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-2">
                      <select
                        value={item.serviceId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleSelectService(item.id, v);
                        }}
                        className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                      >
                        <option value="">— Select —</option>
                        {services.filter((s) => s.is_active).map((svc) => (
                          <option key={svc.id} value={svc.id}>
                            {svc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          handleUpdateItem(item.id, "name", e.target.value)
                        }
                        placeholder="Item name"
                        className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateItem(
                            item.id,
                            "quantity",
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground text-right focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleUpdateItem(
                            item.id,
                            "unitPrice",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0"
                        className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground text-right focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div className="col-span-2 text-right font-medium text-sm text-foreground">
                      {formatMoney(item.quantity * item.unitPrice, agencyCurrency)}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    </div>
                    <div className="pl-1">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          handleUpdateItem(item.id, "description", e.target.value)
                        }
                        placeholder="Description (optional)"
                        className="w-full max-w-md rounded-lg bg-secondary/70 border border-border/70 px-3 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 transition-colors"
                      />
                    </div>
                  </div>
                ))}

                {/* Totals */}
                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex justify-between items-end gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-muted-foreground">Tax rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={taxRate ? String(Math.round(taxRate * 1000) / 10) : "0"}
                        onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100)}
                        className="w-20 rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground text-right focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-y-2">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium text-foreground">{formatMoney(subtotal, agencyCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax ({Math.round(taxRate * 100)}%)</span>
                        <span className="font-medium text-foreground">{formatMoney(taxAmount, agencyCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                        <span className="text-foreground">Total</span>
                        <span className="text-foreground">{formatMoney(total, agencyCurrency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Proposal Summary */}
      <div className="w-[320px] shrink-0 bg-card border-l border-border overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Proposal Summary Card */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Proposal Summary</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Code</span>
                <span className="font-medium text-foreground">{proposalCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium text-foreground">{selectedClient?.name || "—"}</span>
              </div>
              {selectedClient?.email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-xs text-foreground">{selectedClient.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">{formatDate(new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium text-foreground">{items.length}</span>
              </div>
            </div>

            <div className="border-t border-border mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">{formatMoney(subtotal, agencyCurrency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({Math.round(taxRate * 100)}%)</span>
                <span className="font-medium text-foreground">{formatMoney(taxAmount, agencyCurrency)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{formatMoney(total, agencyCurrency)}</span>
              </div>
            </div>

            {items.length > 0 && (
              <div className="border-t border-border mt-4 pt-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Items</h4>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[150px]">
                        {item.name || "Unnamed item"}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatMoney(item.quantity * item.unitPrice, agencyCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Share Button */}
          <button
            onClick={async () => {
              if (!savedProposalId) {
                toast("Please save the proposal first", "info");
                return;
              }
              setSending(true);
              try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch(`/api/proposals/${savedProposalId}/send-email`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${session?.access_token}` },
                });
                const data = await res.json();
                if (!res.ok) {
                  toast(data.error || "Failed to send email", "error");
                } else {
                  toast("Proposal sent to customer!", "success");
                }
              } catch {
                toast("Failed to send email", "error");
              } finally {
                setSending(false);
              }
            }}
            disabled={sending || !savedProposalId}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
            {sending ? "Sending..." : "Share with Customer"}
          </button>

          {/* Download PDF Button */}
          {showDownload && (
            <button
              onClick={handleDownloadPDF}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Download size={16} />
              <span>Download PDF</span>
            </button>
          )}

          {/* Save Button */}
          <button
          type="button"
            onClick={handleSave}
            
            disabled={saving}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Proposal</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <NewProposalPageContent />
    </Suspense>
  );
}
