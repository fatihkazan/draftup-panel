import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Get agency_id from auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Get agency_id
    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agencyData) {
      return NextResponse.json(
        { error: "Agency not found" },
        { status: 404 }
      );
    }

    const agencyId = agencyData.id;

    const now = new Date();

    // Parse year for revenue overview (default: current year)
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const selectedYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const isValidYear = !isNaN(selectedYear) && selectedYear >= 2000 && selectedYear <= 2100;
    const statsYear = isValidYear ? selectedYear : now.getFullYear();

    const proposalFunnelPeriodParam = searchParams.get("proposalFunnelPeriod");
    const proposalFunnelPeriod = proposalFunnelPeriodParam === "lastMonth" ? "lastMonth" : "thisMonth";

    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Fetch all invoices (include sent_at for revenue overview)
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, total, status, due_date, created_at, sent_at")
      .eq("agency_id", agencyId);

    // Fetch all payments for agency's invoices (payment-derived totals)
    const invoiceIds = (invoices || []).map(inv => inv.id);
    let paymentsByInvoice: Record<string, number> = {};
    if (invoiceIds.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds);
      for (const p of payments || []) {
        paymentsByInvoice[p.invoice_id] = (paymentsByInvoice[p.invoice_id] || 0) + Number(p.amount);
      }
    }
    const getPaidAmount = (inv: { id: string }) => paymentsByInvoice[inv.id] || 0;
    const isPaid = (inv: { id: string; total: number }) => getPaidAmount(inv) >= (inv.total || 0);
    const getBalanceDue = (inv: { id: string; total: number }) =>
      Math.max(0, (inv.total || 0) - getPaidAmount(inv));

    // Fetch all proposals
    const { data: proposals } = await supabase
      .from("proposals")
      .select("id, total, status, created_at")
      .eq("agency_id", agencyId);

    // Fetch all clients
    const { data: clients } = await supabase
      .from("clients")
      .select("id, created_at")
      .eq("agency_id", agencyId);

    // Calculate stats
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Collected revenue: sum of paid_amount across all invoices
    const collectedRevenue = (invoices || []).reduce(
      (sum, inv) => sum + getPaidAmount(inv),
      0
    );
    const totalRevenue = collectedRevenue;

    // Last month revenue: sum of payments with payment_date in last month
    let lastMonthPayments: { amount: number; payment_date: string }[] = [];
    if (invoiceIds.length > 0) {
      const lmStart = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}-01`;
      const lmEndMonth = lastMonth + 2 > 12 ? 1 : lastMonth + 2;
      const lmEndYear = lastMonth + 2 > 12 ? lastMonthYear + 1 : lastMonthYear;
      const lmEnd = `${lmEndYear}-${String(lmEndMonth).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("payments")
        .select("amount, payment_date")
        .in("invoice_id", invoiceIds)
        .gte("payment_date", lmStart)
        .lt("payment_date", lmEnd);
      lastMonthPayments = data || [];
    }
    const lastMonthRevenue = lastMonthPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const revenueChange = lastMonthRevenue > 0 
      ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

    // Active Clients
    const activeClients = (clients || []).length;

    // Clients added this month
    const clientsThisMonth = (clients || [])
      .filter(client => {
        const created = new Date(client.created_at);
        return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
      }).length;

    // Proposals Sent
    const proposalsSent = (proposals || [])
      .filter(p => ["sent", "viewed", "approved"].includes(p.status))
      .length;

    // Proposals pending approval
    const proposalsPending = (proposals || [])
      .filter(p => ["sent", "viewed"].includes(p.status))
      .length;

    // Pending Invoices (sent but not fully paid)
    const pendingInvoicesAmount = (invoices || [])
      .filter(inv => inv.status === "sent" && !isPaid(inv))
      .reduce((sum, inv) => sum + getBalanceDue(inv), 0);

    const pendingInvoicesCount = (invoices || [])
      .filter(inv => inv.status === "sent" && !isPaid(inv))
      .length;

    // Revenue Breakdown: collected = sum paid_amount, pending/overdue = balance_due
    const collected = collectedRevenue;
    const pending = (invoices || [])
      .filter(inv => inv.status === "sent" && !isPaid(inv) && (!inv.due_date || new Date(inv.due_date) >= now))
      .reduce((sum, inv) => sum + getBalanceDue(inv), 0);
    const overdue = (invoices || [])
      .filter(inv => {
        if (isPaid(inv) || !inv.due_date) return false;
        return new Date(inv.due_date) < now;
      })
      .reduce((sum, inv) => sum + getBalanceDue(inv), 0);

    // Proposal Funnel (filtered by period: thisMonth or lastMonth)
    const propList = proposals || [];
    const targetMonth = proposalFunnelPeriod === "lastMonth" ? lastMonth : currentMonth;
    const targetYear = proposalFunnelPeriod === "lastMonth" ? lastMonthYear : currentYear;
    const funnelProps = propList.filter(p => {
      const created = new Date(p.created_at);
      return created.getMonth() === targetMonth && created.getFullYear() === targetYear;
    });
    const sumTotal = (list: typeof funnelProps) => list.reduce((s, p) => s + (p.total || 0), 0);
    const pendingList = funnelProps.filter(p => p.status === "draft");
    const sentList = funnelProps.filter(p => ["sent", "viewed"].includes(p.status));
    const approvedList = funnelProps.filter(p => p.status === "approved");
    const rejectedList = funnelProps.filter(p => p.status === "rejected");
    const sentTotal = sentList.length + approvedList.length + rejectedList.length;
    const outcomesTotal = approvedList.length + rejectedList.length;
    const winRate = outcomesTotal > 0 ? (approvedList.length / outcomesTotal) * 100 : 0;

    const proposalFunnel = {
      pending: pendingList.length,
      sent: sentList.length,
      approved: approvedList.length,
      rejected: rejectedList.length,
      pendingAmount: sumTotal(pendingList),
      sentAmount: sumTotal(sentList),
      approvedAmount: sumTotal(approvedList),
      rejectedAmount: sumTotal(rejectedList),
      sentTotal,
      winRate,
    };

    // Invoice Status: outstanding = sum of balance_due
    const totalOutstanding = (invoices || []).reduce(
      (sum, inv) => sum + getBalanceDue(inv),
      0
    );

    // Invoice Status Breakdown (draft, sent, paid, overdue)
    const invListForStatus = invoices || [];
    const draftAmount = invListForStatus
      .filter(inv => inv.status === "draft")
      .reduce((s, inv) => s + (inv.total || 0), 0);
    const overdueAmount = invListForStatus
      .filter(inv => {
        if (isPaid(inv) || !inv.due_date) return false;
        return new Date(inv.due_date) < now;
      })
      .reduce((s, inv) => s + getBalanceDue(inv), 0);
    const sentAmount = invListForStatus
      .filter(inv => inv.status === "sent" && !isPaid(inv) && (!inv.due_date || new Date(inv.due_date) >= now))
      .reduce((s, inv) => s + getBalanceDue(inv), 0);
    const paidAmount = collected;
    const invoiceStatusBreakdown = {
      draft: draftAmount,
      sent: sentAmount,
      paid: paidAmount,
      overdue: overdueAmount,
    };

    // Monthly Revenue Overview (for selected year)
    const invList = invoices || [];
    let allPayments: { invoice_id: string; amount: number; payment_date: string }[] = [];
    if (invoiceIds.length > 0) {
      const { data } = await supabase
        .from("payments")
        .select("invoice_id, amount, payment_date")
        .in("invoice_id", invoiceIds);
      allPayments = data || [];
    }
    const monthlyRevenue = MONTH_NAMES.map((month, idx) => {
      const monthIndex = idx + 1;
      let invoiced = 0;
      let collected = 0;
      for (const inv of invList) {
        const total = inv.total || 0;
        const invDate = inv.sent_at
          ? new Date(inv.sent_at)
          : (inv.status === "sent" ? new Date(inv.created_at) : null);
        if (invDate && invDate.getFullYear() === statsYear && invDate.getMonth() === idx) {
          invoiced += total;
        }
      }
      for (const p of allPayments) {
        const paidDate = new Date(p.payment_date);
        if (paidDate.getFullYear() === statsYear && paidDate.getMonth() === idx) {
          collected += Number(p.amount);
        }
      }
      return { month, monthIndex, invoiced, collected };
    });

    // Revenue Overview Totals (for selected year)
    const yearInvoiced = monthlyRevenue.reduce((s, m) => s + m.invoiced, 0);
    const yearCollected = monthlyRevenue.reduce((s, m) => s + m.collected, 0);
    const revenueOverviewTotals = {
      invoiced: yearInvoiced,
      collected: yearCollected,
      pending: (invoices || []).filter(inv => inv.status === "sent" && !isPaid(inv)).reduce((s, inv) => s + getBalanceDue(inv), 0),
    };

    return NextResponse.json({
      totalRevenue,
      revenueChange,
      activeClients,
      clientsThisMonth,
      proposalsSent,
      proposalsPending,
      pendingInvoicesAmount,
      pendingInvoicesCount,
      revenueBreakdown: {
        collected,
        pending,
        overdue,
      },
      proposalFunnel,
      totalOutstanding,
      invoiceStatusBreakdown,
      monthlyRevenue,
      revenueOverviewTotals,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}