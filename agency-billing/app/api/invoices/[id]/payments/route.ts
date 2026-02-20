import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"] as const;

async function getAgencyId(supabase: ReturnType<typeof createServerClient>, token: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return null;
  const { data: agency } = await supabase
    .from("agency_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return agency?.id ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createServerClient();
    const agencyId = await getAgencyId(supabase, token);
    if (!agencyId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, agency_id")
      .eq("id", invoiceId)
      .single();

    if (!invoice || invoice.agency_id !== agencyId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: payments, error } = await supabase
      .from("payments")
      .select("id, amount, payment_date, method, note, created_at")
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: true });

    if (error) {
      console.error("Payments fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
    }

    return NextResponse.json({ payments: payments ?? [] });
  } catch (err) {
    console.error("Payments GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const supabase = createServerClient();

  // 1. Authorization
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization header required. Use: Bearer <token>" },
      { status: 401 }
    );
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token in Authorization header" }, { status: 401 });
  }
  const agencyId = await getAgencyId(supabase, token);
  if (!agencyId) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // 2. Agency ownership check
  const { id: invoiceId } = await params;
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, agency_id, total")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.agency_id !== agencyId) {
    return NextResponse.json({ error: "Forbidden: invoice does not belong to your agency" }, { status: 403 });
  }

  // 3. Payload validation
  let body: { amount?: unknown; payment_date?: unknown; method?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const amountNum = Number(body.amount);
  if (Number.isNaN(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "amount must be a number greater than 0" }, { status: 400 });
  }
  const paymentDate = body.payment_date;
  if (paymentDate == null || String(paymentDate).trim() === "") {
    return NextResponse.json({ error: "payment_date is required" }, { status: 400 });
  }
  const method = body.method ?? "other";
  const note = body.note ?? null;
  const validMethod = PAYMENT_METHODS.includes(String(method) as typeof PAYMENT_METHODS[number])
    ? String(method)
    : "other";

  // 4. Balance due validation
  const { data: existingPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId);
  const paidAmount = (existingPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balanceDue = Math.max(0, Number(invoice.total) - paidAmount);
  const roundedAmount = Math.round(amountNum * 100) / 100;
  if (balanceDue <= 0) {
    return NextResponse.json({ error: "Invoice is already fully paid" }, { status: 400 });
  }
  if (roundedAmount > balanceDue) {
    return NextResponse.json({ error: "Payment exceeds balance due" }, { status: 400 });
  }

  // 5. Insert payment
  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      amount: roundedAmount,
      payment_date: String(paymentDate).trim(),
      method: validMethod,
      note: note != null ? String(note) : null,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Payment insert error:", insertError);
    return NextResponse.json(
      { error: insertError.message || "Failed to add payment" },
      { status: 500 }
    );
  }

  // 6. Response
  return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    console.error("Payments POST error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
