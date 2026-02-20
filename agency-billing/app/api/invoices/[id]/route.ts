import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

/** PATCH: Update draft invoice. Only draft invoices can be edited. */
export async function PATCH(
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
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!agencyData?.id) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("id, status, agency_id")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (invoice.agency_id !== agencyData.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (invoice.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft invoices can be edited" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      title: titleParam,
      due_date: dueDate,
      notes,
      tax_rate: taxRate = 0,
      total,
      items: itemsParam,
    } = body;

    if (!titleParam || !titleParam.trim()) {
      return NextResponse.json(
        { error: "Invoice title is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(itemsParam) || itemsParam.length === 0) {
      return NextResponse.json(
        { error: "Add at least one item" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        title: String(titleParam).trim(),
        due_date: dueDate || null,
        notes: notes ?? null,
        tax_rate: Number(taxRate) || 0,
        total: Number(total),
      })
      .eq("id", invoiceId)
      .eq("agency_id", agencyData.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update invoice", details: updateError.message },
        { status: 500 }
      );
    }

    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

    const invoiceItems = itemsParam.map((item: { title?: string; description?: string; qty?: number; unit_price?: number }) => ({
      invoice_id: invoiceId,
      title: String(item.title ?? "").trim(),
      description: item.description ?? null,
      qty: Number(item.qty) ?? 1,
      unit_price: Number(item.unit_price) ?? 0,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(invoiceItems);

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to update invoice items", details: itemsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invoice updated",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
