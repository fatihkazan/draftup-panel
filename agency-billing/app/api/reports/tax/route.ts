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

function getTaxAmount(inv: { total: number; tax_rate: number | null }): number {
  const total = Number(inv.total || 0);
  const taxRate = Number(inv.tax_rate ?? 0);
  if (total === 0 || taxRate === 0) return 0;
  return Math.round((total * taxRate) / (1 + taxRate) * 100) / 100;
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
  const startDateParam = searchParams.get("start_date");
  const endDateParam = searchParams.get("end_date");

  const startDate = parseDate(startDateParam);
  const endDate = parseDate(endDateParam);
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "start_date and end_date are required" },
      { status: 400 }
    );
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: "start_date must be before end_date" }, { status: 400 });
  }
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, total, tax_rate, created_at, sent_at")
    .eq("agency_id", agencyId)
    .neq("status", "draft")
    .neq("status", "void");

  const invList = invoices || [];
  const invoiceDateStr = (inv: { sent_at: string | null; created_at: string }) =>
    (inv.sent_at || inv.created_at || "").slice(0, 10);

  const invInRange = invList.filter((inv) => {
    const d = invoiceDateStr(inv);
    return d && d >= startStr && d <= endStr;
  });

  const tax_invoiced = invInRange.reduce((s, inv) => s + getTaxAmount(inv), 0);

  const invIds = invList.map((i) => i.id);
  const invById = new Map(invList.map((i) => [i.id, i]));

  let tax_collected = 0;
  if (invIds.length > 0) {
    const { data: payments } = await supabase
      .from("payments")
      .select("invoice_id, amount, payment_date")
      .in("invoice_id", invIds)
      .gte("payment_date", startStr)
      .lte("payment_date", endStr);
    for (const p of payments || []) {
      const inv = invById.get(p.invoice_id);
      if (!inv) continue;
      const total = Number(inv.total || 0);
      if (total === 0) continue;
      const taxAmount = getTaxAmount(inv);
      const ratio = taxAmount / total;
      tax_collected += Number(p.amount) * ratio;
    }
    tax_collected = Math.round(tax_collected * 100) / 100;
  }

  return NextResponse.json({
    tax_invoiced,
    tax_collected,
    currency,
  });
}
