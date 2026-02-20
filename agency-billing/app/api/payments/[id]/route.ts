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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentId } = await params;
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

    const { data: payment } = await supabase
      .from("payments")
      .select("id, invoice_id, amount")
      .eq("id", paymentId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, agency_id, total")
      .eq("id", payment.invoice_id)
      .single();

    if (!invoice || invoice.agency_id !== agencyId) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const { data: otherPayments } = await supabase
      .from("payments")
      .select("amount")
      .eq("invoice_id", payment.invoice_id)
      .neq("id", paymentId);
    const othersSum = (otherPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const balanceForThis = Math.max(0, Number(invoice.total) - othersSum);

    const body = await request.json();
    const amount = body.amount !== undefined ? Number(body.amount) : undefined;
    const paymentDate = body.payment_date;
    const method = body.method;
    const note = body.note;

    const updates: Record<string, unknown> = {};
    if (amount !== undefined) {
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
      }
      if (amount > balanceForThis) {
        return NextResponse.json(
          { error: `Amount cannot exceed balance due (${balanceForThis.toFixed(2)})` },
          { status: 400 }
        );
      }
      updates.amount = Math.round(amount * 100) / 100;
    }
    if (paymentDate !== undefined) updates.payment_date = paymentDate;
    if (method !== undefined) {
      updates.method = PAYMENT_METHODS.includes(method) ? method : "other";
    }
    if (note !== undefined) updates.note = note ?? null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("payments")
      .update(updates)
      .eq("id", paymentId)
      .select()
      .single();

    if (error) {
      console.error("Payment PATCH error:", error);
      return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
    }

    return NextResponse.json({ payment: updated });
  } catch (err) {
    console.error("Payment PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentId } = await params;
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

    const { data: payment } = await supabase
      .from("payments")
      .select("id, invoice_id")
      .eq("id", paymentId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("agency_id")
      .eq("id", payment.invoice_id)
      .single();

    if (!invoice || invoice.agency_id !== agencyId) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (error) {
      console.error("Payment DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Payment DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
