import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceInvoiceLimit } from "@/lib/enforcePlan";

/** POST: Create invoice. Enforces monthly invoice limit (backend). */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id, subscription_plan, user_id, currency")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const agencyId = agencyData.id;
    if (agencyId === undefined || agencyId === null) {
      console.error("[invoices] Agency ID not resolved");
      return NextResponse.json(
        { error: "Agency ID not resolved" },
        { status: 500 }
      );
    }
    let limitResult: Awaited<ReturnType<typeof enforceInvoiceLimit>>;
    try {
      limitResult = await enforceInvoiceLimit(agencyId);
    } catch {
      return NextResponse.json(
        { error: "Plan enforcement failed", code: "PLAN_ENFORCEMENT_ERROR" },
        { status: 403 }
      );
    }
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Invoice limit reached",
          code: limitResult.reason,
          limit: limitResult.limit,
        },
        { status: 403 }
      );
    }

    const { data, error } = await supabase.rpc(
      "increment_agency_invoice_counter",
      { p_agency_id: agencyId }
    );

    console.log("[invoices] RPC raw response:", { data, error });

    const nextInvoiceCounter =
      Array.isArray(data) ? data[0] :
      typeof data === "object" && data !== null
        ? Object.values(data)[0]
        : data;

    if (error) {
      console.error("[invoices] RPC error:", error);
      return NextResponse.json({ error: "RPC error" }, { status: 500 });
    }

    if (nextInvoiceCounter == null) {
      console.error("[invoices] Counter resolved null. Raw data:", data);
      return NextResponse.json(
        { error: "Counter returned null" },
        { status: 500 }
      );
    }

    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(nextInvoiceCounter).padStart(4, "0")}`;

    const body = await request.json();
    const {
      client_id: clientId,
      title: titleParam,
      total,
      currency: currencyParam,
      tax_rate: taxRate = 0,
      due_date: dueDate,
      notes,
      items: itemsParam,
    } = body;

    if (!clientId || !titleParam || !Array.isArray(itemsParam) || itemsParam.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: client_id, title, or items" },
        { status: 400 }
      );
    }

    const agency = agencyData as { currency?: string };
    const currency = currencyParam ?? agency.currency ?? "USD";
    const publicToken = crypto.randomUUID();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const createdByName =
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "Unknown";

    const invoiceRow = {
      user_id: (agencyData as { user_id?: string }).user_id ?? user.id,
      agency_id: agencyData.id,
      client_id: clientId,
      title: String(titleParam).trim(),
      total: Number(total),
      currency,
      tax_rate: Number(taxRate) || 0,
      status: "draft",
      paid: false,
      due_date: dueDate || null,
      notes: notes ?? null,
      public_token: publicToken,
      invoice_number: invoiceNumber,
      created_by_name: createdByName,
    };

    console.log("Invoice row:", invoiceRow);

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert(invoiceRow)
      .select()
      .single();

    if (insertError) {
      console.error("Invoice insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create invoice", details: insertError.message },
        { status: 500 }
      );
    }

    const invoiceItems = itemsParam.map((item: { title: string; description?: string; quantity?: number; unitPrice?: number }) => ({
      invoice_id: invoice.id,
      title: item.title ?? "",
      description: item.description ?? null,
      qty: Number(item.quantity) ?? 1,
      unit_price: Number(item.unitPrice) ?? 0,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(invoiceItems);

    if (itemsError) {
      await supabase.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json(
        { error: "Failed to create invoice items", details: itemsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice_id: invoice.id,
      invoice,
      nextInvoiceCounter,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
