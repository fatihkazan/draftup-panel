import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

async function getAgencyContext(
  supabase: ReturnType<typeof createServerClient>,
  token: string
) {
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return null;
  const { data: agency } = await supabase
    .from("agency_settings")
    .select("id, currency")
    .eq("user_id", user.id)
    .single();
  return agency;
}

function parseDate(s: string | null): Date | null {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient();

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }
  const token = authHeader.slice(7).trim();
  const agency = await getAgencyContext(supabase, token);
  if (!agency) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const agencyId = agency.id;
  const currency = agency.currency || "USD";

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "this_month";
  const startDateParam = searchParams.get("start_date");
  const endDateParam = searchParams.get("end_date");

  let startDate: Date;
  let endDate: Date;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (range === "custom") {
    const start = parseDate(startDateParam);
    const end = parseDate(endDateParam);
    if (!start || !end) {
      return NextResponse.json(
        { error: "start_date and end_date required for custom range" },
        { status: 400 }
      );
    }
    if (start > end) {
      return NextResponse.json({ error: "start_date must be before end_date" }, { status: 400 });
    }
    startDate = start;
    endDate = end;
  } else if (range === "last_month") {
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    startDate = new Date(lastMonthYear, lastMonth, 1);
    endDate = new Date(lastMonthYear, lastMonth + 1, 0, 23, 59, 59, 999);
  } else {
    startDate = new Date(currentYear, currentMonth, 1);
    endDate = new Date(now.getTime());
  }

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, total, status, created_at, sent_at")
    .eq("agency_id", agencyId)
    .neq("status", "draft")
    .neq("status", "void");

  const invList = invoices || [];
  const invoiceIds = invList.map((i) => i.id);

  const invoiceDateStr = (inv: { sent_at: string | null; created_at: string }) =>
    (inv.sent_at || inv.created_at || "").slice(0, 10);

  const total_invoiced = invList
    .filter((inv) => {
      const d = invoiceDateStr(inv);
      return d && d >= startStr && d <= endStr;
    })
    .reduce((s, inv) => s + Number(inv.total || 0), 0);

  let total_collected = 0;
  if (invoiceIds.length > 0) {
    const { data: payments } = await supabase
      .from("payments")
      .select("amount, payment_date")
      .in("invoice_id", invoiceIds)
      .gte("payment_date", startStr)
      .lte("payment_date", endStr);
    total_collected = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
  }

  const { data: allPayments } =
    invoiceIds.length > 0
      ? await supabase.from("payments").select("invoice_id, amount").in("invoice_id", invoiceIds)
      : { data: [] as { invoice_id: string; amount: number }[] };
  const paidByInv: Record<string, number> = {};
  for (const p of allPayments || []) {
    paidByInv[p.invoice_id] = (paidByInv[p.invoice_id] || 0) + Number(p.amount);
  }
  const outstanding = invList.reduce((s, inv) => {
    const paid = paidByInv[inv.id] || 0;
    const total = Number(inv.total || 0);
    return s + Math.max(0, total - paid);
  }, 0);

  return NextResponse.json({
    total_invoiced,
    total_collected,
    outstanding,
    currency,
  });
}
