"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { InvoiceLimitModal } from "@/components/InvoiceLimitModal";
import { formatMoney } from "@/lib/format";

/* ---------------- TYPES ---------------- */

type Client = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};

type InvoiceItem = {
  id: string;
  title: string;
  description: string;
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

/* ---------------- HELPERS ---------------- */


/* ---------------- MAIN PAGE COMPONENT ---------------- */

export default function NewInvoicePage() {
  const router = useRouter();

  // ============================================
  // STATE: Initialization & Loading
  // ============================================
  const [userId, setUserId] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // ============================================
  // STATE: Clients
  // ============================================
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [services, setServices] = useState<Service[]>([]);

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
          

        // DEBUG: Log what we got from agency_settings
        console.error("=== INIT DEBUG ===");
        console.error("authData.user.id:", authData.user.id);
        console.error("authData.user.email:", authData.user.email);
        console.error("agencyData from DB:", agencyData);
        console.error("agencyError:", agencyError);
        console.error("==================");

        if (agencyError) {
          throw new Error("Failed to load agency settings.");
        }

        if (!agencyData?.id) {
          throw new Error("No agency found. Please complete your agency setup first.");
        }

        // Step 3: Store userId and agencyId in state
        if (isMounted) {
          setUserId(authData.user.id);
          setAgencyId(agencyData.id);
          setCurrency(agencyData.currency || "USD");
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
  // EFFECT 2: Load Clients (after userId and agencyId are available)
  // Only fetch clients that belong to the current user's agency
  // This prevents foreign key violations when creating invoices
  // ============================================
  useEffect(() => {
    if (!userId || !agencyId) return;

    let isMounted = true;

    const loadClients = async () => {
      try {
        setClientsLoading(true);

        // Filter by BOTH user_id AND agency_id to ensure:
        // 1. Only clients belonging to this user are shown
        // 2. The client's agency_id matches the invoice's agency_id (prevents FK errors)
        const { data, error } = await supabase
          .from("clients")
          .select("id, name, email, company")
          .eq("user_id", userId)
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
  }, [userId, agencyId]);

  // Load active services
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

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;

  // Get selected customer
  const selectedCustomer = clients.find(c => c.id === customerId);

  // Add item
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        title: "",
        description: "",
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
          title: svc.name,
          description: svc.description ?? "",
          unitPrice: isFirstSelection ? svc.default_unit_price : item.unitPrice,
        };
      })
    );
  };

  // Update item
  const handleUpdateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // ============================================
  // HANDLER: Save Invoice
  // ============================================
  const handleSave = async () => {
    // Validation 1: Check agencyId - this MUST exist
    if (!agencyId) {
      setStatus("ERROR: Agency not found. Please refresh the page or check your settings.");
      return;
    }

    // Validation 2: Check customerId
    if (!customerId) {
      setStatus("ERROR: Please select a customer");
      return;
    }

    // Validation 3: Check title
    if (!title.trim()) {
      setStatus("ERROR: Please enter an invoice title");
      return;
    }

    // Validation 4: Check items
    if (items.length === 0) {
      setStatus("ERROR: Please add at least one item");
      return;
    }

    setSaving(true);
    setStatus("Saving...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus("ERROR: Not authenticated.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id: customerId,
          title: title.trim(),
          total,
          currency,
          tax_rate: taxRate,
          due_date: dueDate || null,
          notes: notes || null,
          items: items.map((item) => ({
            title: item.title,
            description: item.description || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        }),
      });

      const data = await res.json();

      if (res.status === 403 && data.error === "Invoice limit reached") {
        setShowLimitModal(true);
        setSaving(false);
        return;
      }

      if (!res.ok) {
        setStatus("ERROR: " + (data.error || data.details || "Failed to create invoice"));
        setSaving(false);
        return;
      }

      setStatus("Invoice created successfully!");
      setSaving(false);

      const createdInvoice = data.invoice ?? { id: data.invoice_id };
      setTimeout(() => {
        router.push(`/invoices/${createdInvoice.id}`);
      }, 1000);
    } catch (error) {
      setStatus("ERROR: " + (error instanceof Error ? error.message : "Unknown error"));
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
            href="/invoices"
            className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/90"
          >
            <ArrowLeft size={16} />
            Back to Invoices
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
            href="/invoices"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Back to Invoices
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">New Invoice</h1>
          <p className="text-sm text-muted-foreground">Create a new invoice</p>
        </div>

        {/* Form Cards */}
        <div className="space-y-6 max-w-4xl">
          {/* Invoice Details Card */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Invoice Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Invoice Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter invoice title"
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Customer
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
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
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                >
                  <option value="TRY">TRY - Turkish Lira</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
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
                  <div className="col-span-3">Title</div>
                  <div className="col-span-2 text-right">Qty</div>
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
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateItem(item.id, "title", e.target.value)}
                        placeholder="Short name"
                        className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground text-right focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground text-right focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div className="col-span-2 text-right font-medium text-sm text-foreground">
                      {formatMoney(item.quantity * item.unitPrice, currency || "USD")}
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
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium text-foreground">{formatMoney(subtotal, currency || "USD")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax ({Math.round(taxRate * 100)}%)</span>
                        <span className="font-medium text-foreground">{formatMoney(taxAmount, currency || "USD")}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                        <span className="text-foreground">Total</span>
                        <span className="text-foreground">{formatMoney(total, currency || "USD")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes Card */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the invoice..."
              rows={3}
              className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {/* Status & Actions */}
          {status && (
            <div className={`rounded-xl border p-4 text-sm ${
              status.includes("ERROR")
                ? "border-red-500/50 bg-red-500/10 text-destructive"
                : status.includes("successfully")
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border bg-secondary text-muted-foreground"
            }`}>
              {status}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Create Invoice"}
            </button>
            <Link
              href="/invoices"
              className="rounded-xl border border-border bg-secondary px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Summary */}
      <div className="w-[320px] shrink-0 bg-card border-l border-border overflow-y-auto p-6">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Invoice Summary</h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium text-foreground">{selectedCustomer?.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              <span className="font-medium text-foreground">{currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium text-foreground">{items.length}</span>
            </div>
          </div>

          <div className="border-t border-border mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground">{formatMoney(subtotal, currency || "USD")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({Math.round(taxRate * 100)}%)</span>
              <span className="font-medium text-foreground">{formatMoney(taxAmount, currency || "USD")}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">{formatMoney(total, currency || "USD")}</span>
            </div>
          </div>
        </div>
      </div>

      {showLimitModal && (
        <InvoiceLimitModal onClose={() => setShowLimitModal(false)} />
      )}
    </div>
  );
}
