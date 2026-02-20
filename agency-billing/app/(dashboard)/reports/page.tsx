"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CreditCard,
  Receipt,
  Clock,
  CircleDollarSign,
  CheckCircle2,
  FileText,
  Download,
  Calendar,
  BarChart3,
  ChevronRight,
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, PieChart, Pie } from "recharts";

type ReportType = "revenue" | "payments" | "invoices" | "tax";
type DateRange = "this_month" | "last_month" | "custom";

const METHODS = ["cash", "bank_transfer", "card", "other"];
const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
};
const STATUS_COLORS = ["oklch(0.65 0 0)", "oklch(0.75 0.18 55)", "oklch(0.7 0.18 145)"];
const CHART_COLORS = ["oklch(0.7 0.18 145)", "oklch(0.5 0.13 145)", "oklch(0.75 0.18 55)", "oklch(0.65 0 0)"];

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "oklch(0.12 0.005 260)",
    border: "1px solid oklch(0.22 0.005 260)",
    borderRadius: "8px",
  },
  labelStyle: { color: "oklch(0.65 0 0)" },
  itemStyle: { color: "oklch(0.95 0 0)" },
};

function getDateRangeBounds(range: DateRange, customStart: string, customEnd: string) {
  const now = new Date();
  if (range === "this_month") {
    const y = now.getFullYear();
    const m = now.getMonth();
    return {
      startStr: `${y}-${String(m + 1).padStart(2, "0")}-01`,
      endStr: now.toISOString().slice(0, 10),
    };
  }
  if (range === "last_month") {
    const m = now.getMonth();
    const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const lastM = m === 0 ? 11 : m - 1;
    return {
      startStr: `${y}-${String(lastM + 1).padStart(2, "0")}-01`,
      endStr: `${y}-${String(lastM + 1).padStart(2, "0")}-${new Date(y, lastM + 1, 0).getDate()}`,
    };
  }
  return { startStr: customStart, endStr: customEnd };
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
}: {
  icon: any;
  label: string;
  value: string;
  iconBg: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-accent/50 transition-all duration-300 cursor-default">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}

type RevenueData = { total_invoiced: number; total_collected: number; outstanding: number; currency: string };
type PaymentRow = { date: string; invoice_number: string; client_name: string; amount: number; method: string; note: string | null };
type PaymentsData = {
  payments: PaymentRow[];
  totals: { total_collected: number; breakdown_by_method: Record<string, number> };
  currency: string;
};
type StatusData = { count: number; total_amount: number };
type InvoiceStatusData = { unpaid: StatusData; partially_paid: StatusData; paid: StatusData };
type TaxData = { tax_invoiced: number; tax_collected: number; currency: string };

const REPORT_TYPES: ReportType[] = ["revenue", "payments", "invoices", "tax"];

function reportFromQuery(q: string | null): ReportType {
  if (q && REPORT_TYPES.includes(q as ReportType)) return q as ReportType;
  return "revenue";
}

export default function ReportsDashboardPage() {
  const searchParams = useSearchParams();
  const reportParam = useMemo(() => reportFromQuery(searchParams.get("report")), [searchParams]);
  const now = new Date();
  const [reportType, setReportType] = useState<ReportType>(reportParam);
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [startDate, setStartDate] = useState(now.toISOString().slice(0, 7) + "-01");
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [method, setMethod] = useState("");

  useEffect(() => {
    setReportType(reportFromQuery(searchParams.get("report")));
  }, [searchParams]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [paymentsData, setPaymentsData] = useState<PaymentsData | null>(null);
  const [invoiceStatusData, setInvoiceStatusData] = useState<InvoiceStatusData | null>(null);
  const [invoiceStatusCurrency, setInvoiceStatusCurrency] = useState("USD");
  const [taxData, setTaxData] = useState<TaxData | null>(null);

  const applyReport = useCallback(async () => {
    setLoading(true);
    setError("");
    const { startStr, endStr } = getDateRangeBounds(dateRange, startDate, endDate);
    if (dateRange === "custom" && (!startDate || !endDate)) {
      setError("Select start and end date for custom range");
      setLoading(false);
      return;
    }
    if (dateRange === "custom" && startDate > endDate) {
      setError("Start date must be before end date");
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${session.access_token}` };

      if (reportType === "revenue") {
        const params = new URLSearchParams();
        params.set("range", dateRange);
        if (dateRange === "custom") {
          params.set("start_date", startStr);
          params.set("end_date", endStr);
        }
        const res = await fetch(`/api/reports/revenue-overview?${params}`, { headers });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to load report");
          setLoading(false);
          return;
        }
        setRevenueData(json);
        setPaymentsData(null);
        setInvoiceStatusData(null);
        setTaxData(null);
      } else if (reportType === "payments") {
        const params = new URLSearchParams();
        params.set("start_date", startStr);
        params.set("end_date", endStr);
        if (method) params.set("method", method);
        const res = await fetch(`/api/reports/payments?${params}`, { headers });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to load report");
          setLoading(false);
          return;
        }
        let currency = "USD";
        if (session.user?.id) {
          const { data: agency } = await supabase
            .from("agency_settings")
            .select("currency")
            .eq("user_id", session.user.id)
            .single();
          currency = agency?.currency || "USD";
        }
        setPaymentsData({
          payments: json.payments || [],
          totals: json.totals || { total_collected: 0, breakdown_by_method: {} },
          currency,
        });
        setRevenueData(null);
        setInvoiceStatusData(null);
        setTaxData(null);
      } else if (reportType === "invoices") {
        const params = new URLSearchParams();
        params.set("start_date", startStr);
        params.set("end_date", endStr);
        const res = await fetch(`/api/reports/invoice-status?${params}`, { headers });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to load report");
          setLoading(false);
          return;
        }
        setInvoiceStatusData(json);
        if (session.user?.id) {
          const { data: agency } = await supabase
            .from("agency_settings")
            .select("currency")
            .eq("user_id", session.user.id)
            .single();
          setInvoiceStatusCurrency(agency?.currency || "USD");
        }
        setRevenueData(null);
        setPaymentsData(null);
        setTaxData(null);
      } else {
        const params = new URLSearchParams();
        params.set("start_date", startStr);
        params.set("end_date", endStr);
        const res = await fetch(`/api/reports/tax?${params}`, { headers });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to load report");
          setLoading(false);
          return;
        }
        setTaxData(json);
        setRevenueData(null);
        setPaymentsData(null);
        setInvoiceStatusData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [reportType, dateRange, startDate, endDate, method]);

  const statusConfig = [
    { key: "unpaid" as const, label: "Unpaid", color: "bg-muted text-muted-foreground", icon: Clock },
    { key: "partially_paid" as const, label: "Partially paid", color: "bg-chart-3/20 text-chart-3", icon: CircleDollarSign },
    { key: "paid" as const, label: "Paid", color: "bg-accent/20 text-accent", icon: CheckCircle2 },
  ];

  const formatPaymentDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Financial visibility from your invoices and payments.</p>
      </div>

      {/* Report Type Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { key: "revenue", label: "Revenue Overview", icon: BarChart3 },
          { key: "payments", label: "Payments", icon: CreditCard },
          { key: "invoices", label: "Invoice Status", icon: Receipt },
          { key: "tax", label: "Tax", icon: DollarSign },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setReportType(key as ReportType)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              reportType === key
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Date filters row */}
      <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-card border border-border">
        <Filter size={16} className="text-muted-foreground" />
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
          className="rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground"
        >
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="custom">Custom range</option>
        </select>
        {dateRange === "custom" && (
          <>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground"
            />
          </>
        )}
        {reportType === "payments" && (
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground"
          >
            <option value="">All methods</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>{METHOD_LABELS[m]}</option>
            ))}
          </select>
        )}
        <button
          onClick={applyReport}
          disabled={loading}
          className="ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Apply"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Revenue */}
      {reportType === "revenue" && revenueData && !loading && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={DollarSign} label="Total Invoiced" value={formatMoney(revenueData.total_invoiced, revenueData.currency)} iconBg="bg-accent/20 text-accent" />
            <StatCard icon={TrendingUp} label="Total Collected" value={formatMoney(revenueData.total_collected, revenueData.currency)} iconBg="bg-accent/20 text-accent" />
            <StatCard icon={AlertCircle} label="Outstanding" value={formatMoney(revenueData.outstanding, revenueData.currency)} iconBg="bg-chart-3/20 text-chart-3" />
          </div>
          <div className="rounded-2xl bg-card border border-border p-6 mb-4">
            <h3 className="font-semibold text-foreground mb-2">Invoiced vs Collected</h3>
            <p className="text-sm text-muted-foreground mb-4">Selected period comparison</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Invoiced", amount: revenueData.total_invoiced, fill: "oklch(0.7 0.18 145)" },
                    { name: "Collected", amount: revenueData.total_collected, fill: "oklch(0.5 0.13 145)" },
                  ]}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 80, bottom: 0 }}
                >
                  <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8" }} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8" }} width={70} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE.contentStyle}
                    labelStyle={TOOLTIP_STYLE.labelStyle}
                    itemStyle={TOOLTIP_STYLE.itemStyle}
                    formatter={(v: number | undefined) => [formatMoney(v ?? 0, revenueData.currency), ""]}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    <Cell fill="oklch(0.7 0.18 145)" />
                    <Cell fill="oklch(0.5 0.13 145)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Collected revenue is based on payments.</p>
        </div>
      )}

      {/* Payments */}
      {reportType === "payments" && paymentsData && !loading && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid gap-4">
            <div className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-accent/50 transition-all duration-300 cursor-default">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
                <CreditCard size={24} />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Collected</div>
                <div className="text-xl font-semibold text-foreground">
                  {formatMoney(paymentsData.totals.total_collected, paymentsData.currency)}
                </div>
              </div>
            </div>
          </div>
          {Object.keys(paymentsData.totals.breakdown_by_method).length > 0 && (
            <div className="rounded-2xl bg-card border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4">Collected by Payment Method</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(paymentsData.totals.breakdown_by_method).map(([meth, amount], i) => ({
                      name: METHOD_LABELS[meth] || meth,
                      amount,
                      fill: CHART_COLORS[i % CHART_COLORS.length],
                    }))}
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE.contentStyle}
                      labelStyle={TOOLTIP_STYLE.labelStyle}
                      itemStyle={TOOLTIP_STYLE.itemStyle}
                      formatter={(v: number) => [formatMoney(v, paymentsData.currency), ""]}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {Object.entries(paymentsData.totals.breakdown_by_method).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <h3 className="font-semibold text-foreground px-4 pt-4 pb-2">Payments Detail</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-4">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-4">Invoice</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-4">Client</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase py-3 px-4">Amount</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-4">Method</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-4">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No payments in this range.</td>
                    </tr>
                  ) : (
                    paymentsData.payments.map((p, i) => (
                      <tr key={i} className="border-b border-border hover:bg-secondary/30">
                        <td className="py-3 px-4 text-sm text-foreground">{formatPaymentDate(p.date)}</td>
                        <td className="py-3 px-4 text-sm text-foreground">{p.invoice_number}</td>
                        <td className="py-3 px-4 text-sm text-foreground">{p.client_name}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-foreground">{formatMoney(p.amount, paymentsData.currency)}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{METHOD_LABELS[p.method] || p.method}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{p.note || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Status */}
      {reportType === "invoices" && invoiceStatusData && !loading && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid gap-4 sm:grid-cols-3">
            {statusConfig.map(({ key, label, color, icon: Icon }) => (
              <div key={key} className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-accent/50 transition-all duration-300 cursor-default">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                  <Icon size={24} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="text-xl font-semibold text-foreground">
                    {formatMoney(invoiceStatusData[key].total_amount, invoiceStatusCurrency)}
                  </div>
                  <div className="text-xs text-muted-foreground">{invoiceStatusData[key].count} invoice{invoiceStatusData[key].count !== 1 ? "s" : ""}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-card border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Distribution by Status</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusConfig.map(({ key, label }, i) => ({
                    name: label,
                    amount: invoiceStatusData[key].total_amount,
                    fill: STATUS_COLORS[i],
                  }))}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 90, bottom: 0 }}
                >
                  <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8" }} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8" }} width={85} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE.contentStyle}
                    labelStyle={TOOLTIP_STYLE.labelStyle}
                    itemStyle={TOOLTIP_STYLE.itemStyle}
                    formatter={(v: number) => [formatMoney(v, invoiceStatusCurrency), ""]}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {statusConfig.map((_, i) => (
                      <Cell key={i} fill={STATUS_COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tax */}
      {reportType === "tax" && taxData && !loading && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-accent/50 transition-all duration-300 cursor-default">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
                <Receipt size={24} />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Tax Invoiced</div>
                <div className="text-xl font-semibold text-foreground">{formatMoney(taxData.tax_invoiced, taxData.currency)}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 hover:border-accent/50 transition-all duration-300 cursor-default">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
                <Receipt size={24} />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Tax Collected</div>
                <div className="text-xl font-semibold text-foreground">{formatMoney(taxData.tax_collected, taxData.currency)}</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-card border border-border p-6 mb-4">
            <h3 className="font-semibold text-foreground mb-2">Tax Invoiced vs Tax Collected</h3>
            <p className="text-sm text-muted-foreground mb-4">Comparison for selected period</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Tax Invoiced", amount: taxData.tax_invoiced, fill: "oklch(0.7 0.18 145)" },
                    { name: "Tax Collected", amount: taxData.tax_collected, fill: "oklch(0.5 0.13 145)" },
                  ]}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 100, bottom: 0 }}
                >
                  <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8" }} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8" }} width={95} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE.contentStyle}
                    labelStyle={TOOLTIP_STYLE.labelStyle}
                    itemStyle={TOOLTIP_STYLE.itemStyle}
                    formatter={(v: number) => [formatMoney(v, taxData.currency), ""]}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    <Cell fill="oklch(0.7 0.18 145)" />
                    <Cell fill="oklch(0.5 0.13 145)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Tax collected is calculated proportionally from payments.</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !revenueData && !paymentsData && !invoiceStatusData && !taxData && !error && (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mx-auto mb-4">
            <BarChart3 size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-2">Select a report and apply</h3>
          <p className="text-sm text-muted-foreground mb-4">Choose a date range and click Apply to load your report data.</p>
          <button
            onClick={applyReport}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            <TrendingUp size={16} />
            Load Report
          </button>
        </div>
      )}
    </div>
  );
}
