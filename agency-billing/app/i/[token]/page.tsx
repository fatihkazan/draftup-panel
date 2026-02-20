"use client";

import { useEffect, useMemo, useState, CSSProperties } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ============================================
// TYPES
// ============================================

type Currency = "EUR" | "USD" | "GBP" | "TRY";
type Client = { id: string; name: string };

type Invoice = {
  id: string;
  user_id?: string;
  title: string;
  invoice_number?: string | null;
  status: "draft" | "sent" | "paid" | "void";
  currency?: Currency;
  total: number | string;
  created_at: string;
  due_date?: string | null;
  clients?: Client;
  paid?: boolean;
  paid_at?: string | null;
};

type InvoiceItem = {
  id: string;
  invoice_id: string;
  title: string;
  qty: number | string;
  unit_price: number | string;
  created_at: string;
};

type AgencySettings = {
  agency_name: string;
  email: string;
  phone: string;
  address: string;
  payment_label: string;
  iban: string;
  swift: string;
  payment_note: string;
};

// ============================================
// PDF-SAFE COLOR PALETTE (Hex only)
// These replace Tailwind v4's lab()/oklch() color functions
// which are NOT supported by html2canvas/jsPDF
// ============================================

const PDF_COLORS = {
  // Backgrounds
  white: "#ffffff",
  gray50: "#fafafa",
  gray100: "#f4f4f5",
  gray200: "#e4e4e7",

  // Text colors
  black: "#000000",
  gray500: "#71717a",
  gray600: "#52525b",
  gray700: "#3f3f46",
  gray900: "#18181b",

  // Accent colors
  emerald700: "#047857",
  red600: "#dc2626",

  // Borders
  borderLight: "#e4e4e7",
} as const;

// ============================================
// HELPERS
// ============================================

function formatMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dt: string) {
  try {
    return new Date(dt).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return dt;
  }
}

// ============================================
// STATUS BADGE COMPONENT
// Screen mode: Tailwind classes
// Print mode: Inline hex styles
// ============================================

function StatusBadge({
  status,
  isPrintMode,
}: {
  status: Invoice["status"];
  isPrintMode: boolean;
}) {
  // Print mode: Use inline styles with hex colors only
  if (isPrintMode) {
    const baseStyle: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      borderRadius: "9999px",
      padding: "4px 10px",
      fontSize: "12px",
      fontWeight: 500,
    };

    if (status === "paid") {
      return (
        <span
          style={{
            ...baseStyle,
            backgroundColor: "#ecfdf5",
            color: "#047857",
            border: "1px solid #a7f3d0",
          }}
        >
          PAID
        </span>
      );
    }
    if (status === "sent") {
      return (
        <span
          style={{
            ...baseStyle,
            backgroundColor: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe",
          }}
        >
          SENT
        </span>
      );
    }
    // void or draft
    return (
      <span
        style={{
          ...baseStyle,
          backgroundColor: "#f4f4f5",
          color: "#3f3f46",
          border: "1px solid #e4e4e7",
        }}
      >
        {status === "void" ? "VOID" : "DRAFT"}
      </span>
    );
  }

  // Screen mode: Use Tailwind classes
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

  if (status === "paid") {
    return (
      <span
        className={`${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200`}
      >
        PAID
      </span>
    );
  }
  if (status === "sent") {
    return (
      <span className={`${base} bg-blue-50 text-blue-700 ring-1 ring-blue-200`}>
        SENT
      </span>
    );
  }
  if (status === "void") {
    return (
      <span className={`${base} bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200`}>
        VOID
      </span>
    );
  }
  return (
    <span className={`${base} bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200`}>
      DRAFT
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function PublicInvoicePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = String(params?.token ?? "");

  // Check if this is a print/PDF generation request
  const isPrintMode = searchParams.get("print") === "true";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [agency, setAgency] = useState<AgencySettings | null>(null);

  const currency: Currency = (invoice?.currency ?? "EUR") as Currency;

  const computedTotal = useMemo(() => {
    return items.reduce(
      (sum, it) => sum + Number(it.qty) * Number(it.unit_price),
      0
    );
  }, [items]);

  useEffect(() => {
    loadPublicInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isPrintMode]);

  async function loadPublicInvoice() {
    if (!token) return;

    setLoading(true);
    setErrorMsg("");

    // For print mode (PDF generation), allow draft status
    // For public view, only allow sent/paid
    const allowedStatuses = isPrintMode
      ? ["draft", "sent", "paid"]
      : ["sent", "paid"];

    // Fetch invoice by public_token
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select(`
        id,
        user_id,
        invoice_number,
        title,
        total,
        currency,
        due_date,
        status,
        created_at,
        public_token,
        clients(id, name)
      `)
      .in("status", allowedStatuses)
      .eq("public_token", token)
      .single();

    if (invErr) {
      setErrorMsg(invErr.message);
      setInvoice(null);
      setItems([]);
      setAgency(null);
      setLoading(false);
      return;
    }

    // Fetch payments to derive paid status
    const invId = (inv as any)?.id;
    let paidAmount = 0;
    let latestPaymentDate: string | null = null;
    if (invId) {
      const { data: payData } = await supabase
        .from("payments")
        .select("amount, payment_date")
        .eq("invoice_id", invId);
      for (const p of payData ?? []) {
        paidAmount += Number(p.amount);
        if (!latestPaymentDate || p.payment_date > latestPaymentDate) {
          latestPaymentDate = p.payment_date;
        }
      }
    }
    const total = Number((inv as any)?.total ?? 0);
    const isPaid = paidAmount >= total;
    setInvoice({
      ...(inv as unknown as Invoice),
      paid: isPaid,
      paid_at: isPaid && latestPaymentDate ? latestPaymentDate : null,
    } as Invoice);

    // Fetch agency settings using user_id from invoice
    const ownerId = (inv as any)?.user_id as string | undefined;
    if (ownerId) {
      const { data: ag, error: agErr } = await supabase
        .from("agency_settings")
        .select(
          "agency_name, email, phone, address, payment_label, iban, swift, payment_note"
        )
        .eq("user_id", ownerId)
        .maybeSingle();

      if (agErr) {
        console.log("agency settings error:", agErr);
        setAgency(null);
      } else {
        setAgency((ag as AgencySettings) ?? null);
      }
    } else {
      setAgency(null);
    }

    // Fetch invoice items
    const { data: its, error: itemsErr } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", (inv as any)?.id)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      setErrorMsg(itemsErr.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((its as InvoiceItem[]) ?? []);
    setLoading(false);
  }

  // UI fallbacks
  const agencyName = agency?.agency_name?.trim() || "Agency";
  const agencyEmail = agency?.email?.trim() || "";
  const agencyPhone = agency?.phone?.trim() || "";
  const agencyAddress = agency?.address?.trim() || "";
  const paymentLabel = agency?.payment_label?.trim() || "Bank Transfer";
  const iban = agency?.iban?.trim() || "";
  const swift = agency?.swift?.trim() || "";
  const paymentNote = agency?.payment_note?.trim() || "";

  // ============================================
  // PRINT MODE: Full inline styles (PDF-safe)
  // ============================================

  if (isPrintMode) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: PDF_COLORS.white,
          color: PDF_COLORS.black,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: "896px",
            margin: "0 auto",
            padding: "40px 24px",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: "24px", textAlign: "center" }}>
            <h1
              style={{
                fontSize: "30px",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                margin: 0,
                color: PDF_COLORS.black,
              }}
            >
              {invoice?.invoice_number ? `Invoice ${invoice.invoice_number}` : "Invoice"}
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "14px",
                color: PDF_COLORS.gray600,
              }}
            >
              Issued by {agencyName}
            </p>

            <div
              style={{
                marginTop: "8px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "14px",
                color: PDF_COLORS.gray700,
              }}
            >
              <span
                style={{
                  borderRadius: "6px",
                  backgroundColor: PDF_COLORS.gray100,
                  padding: "4px 8px",
                }}
              >
                Client: {invoice?.clients?.name ?? "-"}
              </span>
              <span
                style={{
                  borderRadius: "6px",
                  backgroundColor: PDF_COLORS.gray100,
                  padding: "4px 8px",
                }}
              >
                Date:{" "}
                {invoice?.created_at ? formatDate(invoice.created_at) : "-"}
              </span>
              {invoice?.due_date && (
                <span
                  style={{
                    borderRadius: "6px",
                    backgroundColor: PDF_COLORS.gray100,
                    padding: "4px 8px",
                  }}
                >
                  Due: {formatDate(invoice.due_date)}
                </span>
              )}
            </div>
          </div>

          {/* Main Card */}
          <div
            style={{
              marginTop: "24px",
              borderRadius: "16px",
              border: `1px solid ${PDF_COLORS.borderLight}`,
              backgroundColor: PDF_COLORS.white,
              padding: "24px",
            }}
          >
            {loading ? (
              <div style={{ fontSize: "14px", color: PDF_COLORS.gray600 }}>
                Loading...
              </div>
            ) : errorMsg ? (
              <div style={{ fontSize: "14px", color: PDF_COLORS.red600 }}>
                ERROR: {errorMsg}
              </div>
            ) : !invoice ? (
              <div style={{ fontSize: "14px", color: PDF_COLORS.gray600 }}>
                Not found.
              </div>
            ) : (
              <>
                {/* Agency + Payment Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  {/* From Card */}
                  <div
                    style={{
                      borderRadius: "12px",
                      border: `1px solid ${PDF_COLORS.borderLight}`,
                      backgroundColor: PDF_COLORS.white,
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: PDF_COLORS.gray500,
                      }}
                    >
                      From
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "16px",
                        fontWeight: 600,
                        color: PDF_COLORS.black,
                      }}
                    >
                      {agencyName}
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "14px",
                        color: PDF_COLORS.gray700,
                        lineHeight: "1.5",
                      }}
                    >
                      {agencyEmail && <div>{agencyEmail}</div>}
                      {agencyPhone && <div>{agencyPhone}</div>}
                      {agencyAddress && (
                        <div style={{ color: PDF_COLORS.gray600 }}>
                          {agencyAddress}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Card */}
                  <div
                    style={{
                      borderRadius: "12px",
                      border: `1px solid ${PDF_COLORS.borderLight}`,
                      backgroundColor: PDF_COLORS.white,
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: PDF_COLORS.gray500,
                      }}
                    >
                      Payment
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "16px",
                        fontWeight: 600,
                        color: PDF_COLORS.black,
                      }}
                    >
                      {paymentLabel}
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "14px",
                        color: PDF_COLORS.gray700,
                        lineHeight: "1.5",
                      }}
                    >
                      {iban && <div>IBAN: {iban}</div>}
                      {swift && <div>SWIFT: {swift}</div>}
                      {paymentNote && (
                        <div style={{ color: PDF_COLORS.gray600 }}>
                          {paymentNote}
                        </div>
                      )}
                      {!iban && !swift && !paymentNote && (
                        <div style={{ color: PDF_COLORS.gray600 }}>
                          Payment details not set by agency.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div
                  style={{
                    marginTop: "24px",
                    overflow: "hidden",
                    borderRadius: "12px",
                    border: `1px solid ${PDF_COLORS.borderLight}`,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      fontSize: "14px",
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: PDF_COLORS.gray50,
                          textAlign: "left",
                          color: PDF_COLORS.gray700,
                        }}
                      >
                        <th style={{ padding: "12px 16px", fontWeight: 500 }}>
                          Item
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            width: "80px",
                            fontWeight: 500,
                          }}
                        >
                          Qty
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            width: "128px",
                            fontWeight: 500,
                          }}
                        >
                          Unit
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            width: "128px",
                            fontWeight: 500,
                          }}
                        >
                          Line
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, index) => {
                        const qty = Number(it.qty);
                        const unit = Number(it.unit_price);
                        const line = qty * unit;
                        return (
                          <tr
                            key={it.id}
                            style={{
                              borderTop:
                                index > 0
                                  ? `1px solid ${PDF_COLORS.borderLight}`
                                  : "none",
                            }}
                          >
                            <td
                              style={{
                                padding: "12px 16px",
                                color: PDF_COLORS.black,
                              }}
                            >
                              {it.title}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: PDF_COLORS.black,
                              }}
                            >
                              {qty}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: PDF_COLORS.black,
                              }}
                            >
                              {formatMoney(unit, currency)}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: PDF_COLORS.black,
                              }}
                            >
                              {formatMoney(line, currency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div
                  style={{
                    marginTop: "24px",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "320px",
                      borderRadius: "12px",
                      border: `1px solid ${PDF_COLORS.borderLight}`,
                      backgroundColor: PDF_COLORS.white,
                      padding: "12px 16px",
                      fontSize: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        color: PDF_COLORS.gray600,
                      }}
                    >
                      <div>Subtotal</div>
                      <div>{formatMoney(computedTotal, currency)}</div>
                    </div>

                    <div
                      style={{
                        marginTop: "8px",
                        borderTop: `1px solid ${PDF_COLORS.borderLight}`,
                        paddingTop: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          color: PDF_COLORS.gray900,
                          fontWeight: 700,
                          fontSize: "16px",
                        }}
                      >
                        Total
                      </div>
                      <div
                        style={{
                          color: PDF_COLORS.gray900,
                          fontWeight: 700,
                          fontSize: "20px",
                        }}
                      >
                        {formatMoney(computedTotal, currency)}
                      </div>
                    </div>

                    {invoice.paid && invoice.paid_at ? (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "12px",
                          color: PDF_COLORS.emerald700,
                        }}
                      >
                        Paid on {formatDate(invoice.paid_at)}
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "12px",
                          color: PDF_COLORS.gray500,
                        }}
                      >
                        Please pay and keep the reference for your records.
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    marginTop: "24px",
                    fontSize: "12px",
                    color: PDF_COLORS.gray500,
                  }}
                >
                  Invoice generated on {new Date().toLocaleDateString("en-GB")}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // SCREEN MODE: Tailwind classes (original UI)
  // ============================================

  return (
    <div className="min-h-screen bg-zinc-50 text-black">
      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            {invoice?.invoice_number ? `Invoice ${invoice.invoice_number}` : "Invoice"}
          </h1>
          <p className="mt-2 text-base text-zinc-600">
            Issued by {agencyName}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm text-zinc-600">
            <span className="rounded-md bg-zinc-100 px-2 py-1">
              Client: {invoice?.clients?.name ?? "-"}
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1">
              Date:{" "}
              {invoice?.created_at ? formatDate(invoice.created_at) : "-"}
            </span>
            {invoice?.due_date && (
              <span className="rounded-md bg-zinc-100 px-2 py-1">
                Due: {formatDate(invoice.due_date)}
              </span>
            )}
            {invoice?.status && (
              <StatusBadge status={invoice.paid ? "paid" : invoice.status} isPrintMode={false} />
            )}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50"
          >
            Print / Save PDF
          </button>
        </div>

        {/* Main Card */}
        <div className="print-card mt-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          {loading ? (
            <div className="text-sm text-zinc-600">Loading...</div>
          ) : errorMsg ? (
            <div className="text-sm text-red-600">ERROR: {errorMsg}</div>
          ) : !invoice ? (
            <div className="text-sm text-zinc-600">Not found.</div>
          ) : (
            <>
              {/* Agency + Payment */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs font-medium text-zinc-500">From</div>
                  <div className="mt-2 text-base font-semibold">{agencyName}</div>

                  <div className="mt-2 space-y-1 text-sm text-zinc-700">
                    {agencyEmail ? <div>{agencyEmail}</div> : null}
                    {agencyPhone ? <div>{agencyPhone}</div> : null}
                    {agencyAddress ? (
                      <div className="text-zinc-600">{agencyAddress}</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs font-medium text-zinc-500">
                    Payment
                  </div>
                  <div className="mt-2 text-base font-semibold">
                    {paymentLabel}
                  </div>

                  <div className="mt-2 space-y-1 text-sm text-zinc-700">
                    {iban ? <div>IBAN: {iban}</div> : null}
                    {swift ? <div>SWIFT: {swift}</div> : null}
                    {paymentNote ? (
                      <div className="text-zinc-600">{paymentNote}</div>
                    ) : null}

                    {!iban && !swift && !paymentNote ? (
                      <div className="text-zinc-600">
                        Payment details not set by agency.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr className="text-left text-zinc-700">
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 w-20">Qty</th>
                      <th className="px-4 py-3 w-32">Unit</th>
                      <th className="px-4 py-3 w-32">Line</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {items.map((it) => {
                      const qty = Number(it.qty);
                      const unit = Number(it.unit_price);
                      const line = qty * unit;
                      return (
                        <tr key={it.id}>
                          <td className="px-4 py-3">{it.title}</td>
                          <td className="px-4 py-3">{qty}</td>
                          <td className="px-4 py-3">
                            {formatMoney(unit, currency)}
                          </td>
                          <td className="px-4 py-3">
                            {formatMoney(line, currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-xs rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
                  <div className="flex items-center justify-between text-zinc-600">
                    <div>Subtotal</div>
                    <div>{formatMoney(computedTotal, currency)}</div>
                  </div>

                  <div className="mt-3 border-t border-zinc-200 pt-3 flex items-center justify-between">
                    <div className="text-zinc-900 font-bold text-base">Total</div>
                    <div className="text-zinc-900 font-bold text-xl">
                      {formatMoney(computedTotal, currency)}
                    </div>
                  </div>

                  {invoice.paid && invoice.paid_at ? (
                    <div className="mt-2 text-xs text-emerald-700">
                      Paid on {formatDate(invoice.paid_at)}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-zinc-500">
                      Please pay and keep the reference for your records.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 text-xs text-zinc-500">
                Public invoice link
                {agencyEmail ? <> • Questions: {agencyEmail}</> : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Print-specific styles for browser print */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
