import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"];

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
  const method = searchParams.get("method");

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

  const validMethod =
    method && PAYMENT_METHODS.includes(method) ? method : null;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, title, status")
    .eq("agency_id", agencyId)
    .neq("status", "draft")
    .neq("status", "void");
  const invIds = (invoices || []).map((i) => i.id);
  if (invIds.length === 0) {
    return NextResponse.json({
      payments: [],
      totals: { total_collected: 0, breakdown_by_method: {} },
    });
  }

  let query = supabase
    .from("payments")
    .select("id, amount, payment_date, method, note, invoice_id")
    .in("invoice_id", invIds)
    .gte("payment_date", startStr)
    .lte("payment_date", endStr)
    .order("payment_date", { ascending: false });
  if (validMethod) {
    query = query.eq("method", validMethod);
  }
  const { data: payments, error } = await query;

  if (error) {
    console.error("Payments report error:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }

  const payList = payments || [];
  const invIdsInPayments = [...new Set(payList.map((p) => p.invoice_id))];

  const { data: invData } = await supabase
    .from("invoices")
    .select("id, title, client_id")
    .in("id", invIdsInPayments);
  const invMap = new Map((invData || []).map((i) => [i.id, i]));

  const clientIds = [...new Set((invData || []).map((i) => i.client_id).filter(Boolean))];
  const { data: clients } =
    clientIds.length > 0
      ? await supabase.from("clients").select("id, name").in("id", clientIds)
      : { data: [] };
  const clientMap = new Map((clients || []).map((c) => [c.id, c.name]));

  const paymentsList = payList.map((p) => {
    const inv = invMap.get(p.invoice_id);
    const clientName = inv?.client_id ? clientMap.get(inv.client_id) || "—" : "—";
    return {
      date: p.payment_date,
      invoice_number: inv?.title || p.invoice_id.slice(0, 8),
      client_name: clientName,
      amount: Number(p.amount),
      method: p.method || "other",
      note: p.note || null,
    };
  });

  const total_collected = payList.reduce((s, p) => s + Number(p.amount), 0);
  const breakdown_by_method: Record<string, number> = {};
  for (const p of payList) {
    const m = p.method || "other";
    breakdown_by_method[m] = (breakdown_by_method[m] || 0) + Number(p.amount);
  }

  return NextResponse.json({
    payments: paymentsList,
    totals: { total_collected, breakdown_by_method },
  });
}
