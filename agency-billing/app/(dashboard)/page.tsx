"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  DollarSign,
  PieChart,
  FileText,
  Users,
  Receipt,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/format";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
} from "recharts";

/* ---------------- TYPES ---------------- */

type Currency = "EUR" | "USD" | "GBP" | "TRY";

type Client = {
  id: string;
  name: string;
  client_code?: string;
};

type RecentItem = {
  id: string;
  title: string;
  total: number | string | null;
  currency: Currency | null;
  status?: string;
  client?: Client;
  created_at?: string;
};

/* ---------------- HELPERS ---------------- */


function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/* ---------------- UI COMPONENTS ---------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
  iconColor = "bg-accent/20 text-accent",
}: {
  icon: any;
  label: string;
  value: string;
  trend: string;
  trendUp?: boolean;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card border border-transparent p-4 hover:border-accent transition-all duration-300 cursor-default [box-shadow:inset_0_0_0_1px_transparent] hover:[box-shadow:inset_0_0_0_1px_oklch(0.7_0.18_145)]">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconColor}`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold text-foreground">{value}</div>
        <div className={`flex items-center gap-1 text-xs ${trendUp ? "text-accent" : "text-destructive"}`}>
          {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend}
        </div>
      </div>
    </div>
  );
}

function ActivityItem({
  type,
  title,
  client,
  amount,
  date,
}: {
  type: "paid" | "sent" | "accepted" | "overdue" | "draft";
  title: string;
  client: string;
  amount: string;
  date: string;
}) {
  const configs = {
    paid: { label: "Won", color: "text-accent", bg: "bg-accent/20 text-accent border border-accent/30" },
    sent: { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
    accepted: { label: "Won", color: "text-accent", bg: "bg-accent/20 text-accent border border-accent/30" },
    overdue: { label: "Lost", color: "text-destructive", bg: "bg-destructive/20 text-destructive border border-destructive/30" },
    draft: { label: "Draft", color: "text-muted-foreground", bg: "bg-muted text-muted-foreground border border-border" },
  };

  const config = configs[type];
  const initials = client.split(" ").map(n => n[0]).join("").slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-muted-foreground flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{client}</div>
        <div className="text-xs text-muted-foreground truncate">{title} • {date}</div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-semibold text-foreground">{amount}</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${config.bg}`}>
          {type === "paid" || type === "accepted" ? <CheckCircle2 size={11} /> : 
           type === "overdue" ? <AlertCircle size={11} /> :
           type === "sent" ? <Clock size={11} /> :
           <FileText size={11} />}
          {config.label}
        </span>
      </div>
    </div>
  );
}

function InvoiceStatusBar({
  label,
  amount,
  percentage,
  color,
}: {
  label: string;
  amount: string;
  percentage: number;
  color: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{amount}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- DASHBOARD CONTENT ---------------- */

export default function DashboardPage() {
  const [recentProposals, setRecentProposals] = useState<RecentItem[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<RecentItem[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [agencyCurrency, setAgencyCurrency] = useState<string>("USD");
  const [todayStats, setTodayStats] = useState({
    invoiced: 0,
    collected: 0,
    newClients: 0,
    newInvoices: 0,
  });

  const loadTodayStats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id, currency")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) return;

    const today = new Date().toISOString().slice(0, 10);

    const { data: invoices } = await supabase
      .from("invoices")
      .select("total, id")
      .eq("agency_id", agencyData.id)
      .gte("created_at", today);

    const invoiceIds = (invoices ?? []).map((i) => i.id);
    let paymentsData: { amount: number }[] = [];
    if (invoiceIds.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("amount")
        .in("invoice_id", invoiceIds)
        .gte("payment_date", today);
      paymentsData = payments ?? [];
    }

    const { count: newClients } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyData.id)
      .gte("created_at", today);

    setTodayStats({
      invoiced: (invoices ?? []).reduce((s, i) => s + Number(i.total || 0), 0),
      collected: paymentsData.reduce((s, p) => s + Number(p.amount || 0), 0),
      newClients: newClients || 0,
      newInvoices: (invoices ?? []).length,
    });
  }, []);

  const loadDashboardData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch agency_id and currency from agency_settings
    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id, currency")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) return;

    const agencyId = agencyData.id;
    const agencyCurrency = agencyData.currency || "USD";

    const { data: proposals } = await supabase
      .from("proposals")
      .select("id, title, total, currency, status, proposal_number, created_at, client:clients(id, name, client_code)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, title, total, currency, status, created_at, client:clients(id, name)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(3);

    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId);

    setClientCount(count || 0);
    setAgencyCurrency(agencyCurrency);

    setRecentProposals(
      (proposals ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        total: p.total,
        currency: p.currency,
        status: p.status,
        client: p.client as unknown as Client,
        created_at: p.created_at,
      }))
    );

    setRecentInvoices(
      (invoices ?? []).map((i) => ({
        id: i.id,
        title: i.title,
        total: i.total,
        currency: i.currency,
        status: i.status,
        client: i.client as unknown as Client,
        created_at: i.created_at,
      }))
    );
  }, []);

  const [stats, setStats] = useState({
    totalRevenue: 0,
    revenueChange: 0,
    activeClients: 0,
    clientsThisMonth: 0,
    proposalsSent: 0,
    proposalsPending: 0,
    pendingInvoicesAmount: 0,
    pendingInvoicesCount: 0,
    revenueBreakdown: { collected: 0, pending: 0, overdue: 0 },
    proposalFunnel: {
      pending: 0, sent: 0, approved: 0, rejected: 0,
      pendingAmount: 0, sentAmount: 0, approvedAmount: 0, rejectedAmount: 0,
      sentTotal: 0, winRate: 0,
    },
    totalOutstanding: 0,
    monthlyRevenue: [] as { month: string; monthIndex: number; invoiced: number; collected: number }[],
    revenueOverviewTotals: { invoiced: 0, collected: 0, pending: 0 },
    invoiceStatusBreakdown: { draft: 0, sent: 0, paid: 0, overdue: 0 },
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [revenueOverviewYear, setRevenueOverviewYear] = useState(() => new Date().getFullYear());
  const [proposalFunnelPeriod, setProposalFunnelPeriod] = useState<"thisMonth" | "lastMonth">("thisMonth");

  const loadStats = useCallback(async (year?: number, funnelPeriod?: "thisMonth" | "lastMonth") => {
    setLoadingStats(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No access token");
        return;
      }
      const params = new URLSearchParams();
      if (year != null) params.set("year", String(year));
      if (funnelPeriod) params.set("proposalFunnelPeriod", funnelPeriod);
      const url = params.toString() ? `/api/dashboard/stats?${params}` : "/api/dashboard/stats";
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    loadStats(revenueOverviewYear, proposalFunnelPeriod);
    loadTodayStats();
  }, [loadDashboardData, loadStats, loadTodayStats, revenueOverviewYear, proposalFunnelPeriod]);

  // Refetch stats when user returns to the tab (e.g. after creating an invoice elsewhere)
  useEffect(() => {
    const handleFocus = () => loadStats(revenueOverviewYear, proposalFunnelPeriod);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadStats, revenueOverviewYear, proposalFunnelPeriod]);

  const proposalFunnelChartData = useMemo(() => {
    const f = stats.proposalFunnel;
    if (!f) return [];
    return [
      { name: "Pending", value: f.pending ?? 0, amount: f.pendingAmount ?? 0, color: "oklch(0.7 0.18 145)" },
      { name: "Accepted", value: f.approved ?? 0, amount: f.approvedAmount ?? 0, color: "oklch(0.5 0.13 145)" },
      { name: "Rejected", value: f.rejected ?? 0, amount: f.rejectedAmount ?? 0, color: "oklch(0.55 0.15 260)" },
    ];
  }, [stats.proposalFunnel]);

  const invoiceStatusBars = useMemo(() => {
    const b = stats.invoiceStatusBreakdown;
    if (!b) return [];
    const draft = b.draft ?? 0;
    const sent = b.sent ?? 0;
    const paid = b.paid ?? 0;
    const overdue = b.overdue ?? 0;
    const totalAll = draft + sent + paid + overdue;
    const pct = (n: number) => totalAll > 0 ? Math.round((n / totalAll) * 100) : 0;
    return [
      { label: "Draft", amount: draft, percentage: pct(draft), color: "bg-muted-foreground" },
      { label: "Sent", amount: sent, percentage: pct(sent), color: "bg-blue-500" },
      { label: "Paid", amount: paid, percentage: pct(paid), color: "bg-emerald-500" },
      { label: "Overdue", amount: overdue, percentage: pct(overdue), color: "bg-red-500" },
    ];
  }, [stats.invoiceStatusBreakdown]);

  return (
    <div className="p-6 space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={loadingStats ? "..." : formatMoney(stats.totalRevenue, agencyCurrency)}
          trend={loadingStats ? "Loading..." : `All time · ${stats.revenueChange >= 0 ? "+" : ""}${stats.revenueChange.toFixed(1)}% vs last month`}
          trendUp={stats.revenueChange >= 0}
          iconColor="bg-accent/20 text-accent"
        />
        <StatCard
          icon={Users}
          label="Active Clients"
          value={loadingStats ? "..." : String(stats.activeClients)}
          trend={loadingStats ? "Loading..." : `+${stats.clientsThisMonth} this month`}
          trendUp
          iconColor="bg-blue-500/20 text-blue-400"
        />
        <StatCard
          icon={FileText}
          label="Proposals Sent"
          value={loadingStats ? "..." : String(stats.proposalsSent)}
          trend={loadingStats ? "Loading..." : `${stats.proposalsPending} pending approval`}
          trendUp
          iconColor="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          icon={Receipt}
          label="Pending Invoices"
          value={loadingStats ? "..." : formatMoney(stats.pendingInvoicesAmount, agencyCurrency)}
          trend={loadingStats ? "Loading..." : `All time · ${stats.pendingInvoicesCount} awaiting payment`}
          trendUp={false}
          iconColor="bg-amber-500/20 text-amber-400"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Revenue Snapshot + Activity */}
        <div className="col-span-4 space-y-6">
          {/* Revenue Snapshot Card */}
          <div className="rounded-2xl bg-gradient-to-br from-accent via-accent/80 to-[oklch(0.09_0.005_260)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart size={18} />
                <span className="text-sm font-medium">Today&apos;s Summary</span>
              </div>
              <span className="flex items-center gap-1 text-xs bg-white/20 rounded-full px-2 py-1">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                Live
              </span>
            </div>

            <div className="mb-6">
              <div className="text-sm text-white/70 mb-1">Invoiced Today</div>
              <div className="text-3xl font-bold">
                {formatMoney(todayStats.invoiced, agencyCurrency)}
              </div>
              <div className="text-sm text-white/70 mt-1">
                {todayStats.newInvoices} new invoice{todayStats.newInvoices !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/20">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Collected</span>
                <span className="font-medium">{formatMoney(todayStats.collected, agencyCurrency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/70">New Clients</span>
                <span className="font-medium">{todayStats.newClients}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Link href="/reports" className="flex-1 rounded-xl bg-white/20 py-2.5 text-center text-sm font-medium hover:bg-white/30 transition-colors">
                View Reports
              </Link>
              <Link href="/invoices/new" className="flex-1 rounded-xl bg-white py-2.5 text-center text-sm font-medium text-accent hover:bg-white/90 transition-colors">
                New Invoice
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Recent Activity</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Latest activity</p>
              </div>
              <Link href="/activity" className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
                See All <ArrowUpRight size={12} />
              </Link>
            </div>

            <div className="space-y-0">
              {recentProposals.length > 0 || recentInvoices.length > 0 ? (
                <>
                  {recentProposals.slice(0, 3).map((p) => (
                    <ActivityItem
                      key={p.id}
                      type={p.status === "approved" ? "accepted" : p.status === "sent" ? "sent" : "draft"}
                      title={p.title}
                      client={p.client?.name || "Unknown Client"}
                      amount={formatMoney(Number(p.total || 0), p.currency || agencyCurrency)}
                      date={p.created_at ? formatDate(p.created_at) : "Recently"}
                    />
                  ))}
                  {recentInvoices.slice(0, 3).map((i) => (
                    <ActivityItem
                      key={i.id}
                      type={i.status === "paid" ? "paid" : i.status === "overdue" ? "overdue" : "sent"}
                      title={i.title}
                      client={i.client?.name || "Unknown Client"}
                      amount={formatMoney(Number(i.total || 0), i.currency || agencyCurrency)}
                      date={i.created_at ? formatDate(i.created_at) : "Recently"}
                    />
                  ))}
                </>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Charts */}
        <div className="col-span-8 space-y-6">
          {/* Revenue Overview Chart */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold">Revenue Overview</h3>
                <p className="text-sm text-muted-foreground">Monthly invoiced vs collected</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-accent"></span>
                  <span className="text-sm text-muted-foreground">Invoiced</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-accent/50"></span>
                  <span className="text-sm text-muted-foreground">Collected</span>
                </div>
                <select
                  className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-sm text-foreground"
                  value={revenueOverviewYear}
                  onChange={(e) => setRevenueOverviewYear(parseInt(e.target.value, 10))}
                >
                  <option value={new Date().getFullYear() - 1}>Last Year</option>
                  <option value={new Date().getFullYear()}>This Year</option>
                </select>
              </div>
            </div>

            {/* Mini Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-secondary p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign size={14} className="text-blue-400" />
                  Invoiced
                </div>
                <div className="text-xl font-semibold text-foreground">
                  {loadingStats ? "..." : formatMoney(stats.revenueOverviewTotals?.invoiced ?? 0, agencyCurrency)}
                </div>
                <div className="text-xs text-muted-foreground">{revenueOverviewYear}</div>
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <CheckCircle2 size={14} className="text-purple-400" />
                  Collected
                </div>
                <div className="text-xl font-semibold text-foreground">
                  {loadingStats ? "..." : formatMoney(stats.revenueOverviewTotals?.collected ?? 0, agencyCurrency)}
                </div>
                <div className="text-xs text-muted-foreground">{revenueOverviewYear}</div>
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock size={14} className="text-amber-400" />
                  Pending
                </div>
                <div className="text-xl font-semibold text-foreground">
                  {loadingStats ? "..." : formatMoney(stats.revenueOverviewTotals?.pending ?? 0, agencyCurrency)}
                </div>
                <div className="text-xs text-muted-foreground">{revenueOverviewYear}</div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyRevenue ?? []} barGap={2} style={{ cursor: 'default' }}>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => `${value/1000}k`}
                  />
                  <Tooltip
                    cursor={{ fill: 'oklch(0.18 0.005 260 / 0.5)' }}
                    contentStyle={{
                      backgroundColor: 'oklch(0.12 0.005 260)',
                      border: '1px solid oklch(0.22 0.005 260)',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'oklch(0.65 0 0)' }}
                    itemStyle={{ color: 'oklch(0.95 0 0)' }}
                    formatter={(value: number | undefined) => formatMoney(value ?? 0, agencyCurrency)}
                  />
                  <Bar dataKey="invoiced" fill="oklch(0.7 0.18 145)" radius={[4, 4, 0, 0]} cursor={undefined} />
                  <Bar dataKey="collected" fill="oklch(0.5 0.13 145)" radius={[4, 4, 0, 0]} cursor={undefined} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Row - Proposal Funnel + Invoice Status */}
          <div className="grid grid-cols-2 gap-6">
            {/* Proposal Funnel */}
            <div className="rounded-2xl bg-card border border-border p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Proposal Funnel</h3>
                <select
                  className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-sm text-foreground"
                  value={proposalFunnelPeriod}
                  onChange={(e) => setProposalFunnelPeriod(e.target.value as "thisMonth" | "lastMonth")}
                >
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                </select>
              </div>

              <div className="flex items-center gap-6">
                {/* Donut Chart */}
                <div className="relative">
                  <ResponsiveContainer width={140} height={140}>
                    <RechartsPieChart>
                      <Pie
                        data={proposalFunnelChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {proposalFunnelChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-xs text-muted-foreground">Sent</div>
                    <div className="text-xl font-bold">
                      {loadingStats ? "..." : stats.proposalFunnel?.sentTotal ?? 0}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-3">
                  {proposalFunnelChartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-muted-foreground">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">{item.value}</div>
                        <div className="text-xs text-muted-foreground">{formatMoney(item.amount, agencyCurrency)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Win Rate</span>
                  <span className="font-semibold text-accent">
                    {loadingStats ? "..." : `${(stats.proposalFunnel?.winRate ?? 0).toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Invoice Status */}
            <div className="rounded-2xl bg-card border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Invoice Status</h3>
                <Link href="/invoices" className="text-xs text-accent hover:text-accent/80">
                  View All
                </Link>
              </div>

              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-foreground">
                  {loadingStats ? "..." : formatMoney(stats.totalOutstanding ?? 0, agencyCurrency)}
                </div>
                <div className="text-sm text-muted-foreground">Total Outstanding</div>
              </div>

              <div className="space-y-4">
                {invoiceStatusBars.map((bar) => (
                  <InvoiceStatusBar
                    key={bar.label}
                    label={bar.label}
                    amount={loadingStats ? "..." : formatMoney(bar.amount, agencyCurrency)}
                    percentage={bar.percentage}
                    color={bar.color}
                  />
                ))}
              </div>

              <Link
                href="/invoices"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                View All Invoices
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
