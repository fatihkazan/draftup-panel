import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

async function getAgencyId(
  supabase: ReturnType<typeof createServerClient>,
  token: string
): Promise<string | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return null;
  const { data: agency } = await supabase
    .from("agency_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return agency?.id ?? null;
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
  const agencyId = await getAgencyId(supabase, token);
  if (!agencyId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

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
    .select("id, total, created_at, sent_at")
    .eq("agency_id", agencyId)
    .neq("status", "draft")
    .neq("status", "void");

  const invList = invoices || [];
  const invoiceDateStr = (inv: { sent_at: string | null; created_at: string }) =>
    (inv.sent_at || inv.created_at || "").slice(0, 10);
  const inRange = invList.filter((inv) => {
    const d = invoiceDateStr(inv);
    return d && d >= startStr && d <= endStr;
  });

  const invIds = inRange.map((i) => i.id);
  let paidByInv: Record<string, number> = {};
  if (invIds.length > 0) {
    const { data: payments } = await supabase
      .from("payments")
      .select("invoice_id, amount")
      .in("invoice_id", invIds);
    for (const p of payments || []) {
      paidByInv[p.invoice_id] = (paidByInv[p.invoice_id] || 0) + Number(p.amount);
    }
  }

  const unpaid = inRange.filter((inv) => (paidByInv[inv.id] || 0) === 0);
  const partially_paid = inRange.filter((inv) => {
    const paid = paidByInv[inv.id] || 0;
    const total = Number(inv.total || 0);
    return paid > 0 && paid < total;
  });
  const paid = inRange.filter((inv) => {
    const paid = paidByInv[inv.id] || 0;
    const total = Number(inv.total || 0);
    return paid >= total;
  });

  const sumTotal = (list: typeof inRange) =>
    list.reduce((s, inv) => s + Number(inv.total || 0), 0);

  return NextResponse.json({
    unpaid: { count: unpaid.length, total_amount: sumTotal(unpaid) },
    partially_paid: { count: partially_paid.length, total_amount: sumTotal(partially_paid) },
    paid: { count: paid.length, total_amount: sumTotal(paid) },
  });
}
