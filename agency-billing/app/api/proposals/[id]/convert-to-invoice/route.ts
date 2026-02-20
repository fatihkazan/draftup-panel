import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import {
  normalizePlanKey,
  isInvoiceLimitReached,
  type PlanKey,
} from "@/lib/subscription-plans";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params;
    console.log("[CONVERT] Starting conversion for proposal:", proposalId);

    // 1. Require authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 2. Get user's agency_id and plan
    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id, subscription_plan")
      .eq("user_id", user.id)
      .single();
    if (!agencyData) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }
    console.log("[CONVERT] Agency:", agencyData);

    const planKey = normalizePlanKey(
      (agencyData as { subscription_plan?: string }).subscription_plan
    ) as PlanKey;

    const { data: proposal, error: fetchError } = await supabase
      .from("proposals")
      .select(
        `
        *,
        client:clients(id, name, email, company),
        proposal_items(id, title, description, qty, unit_price)
      `
      )
      .eq("id", proposalId)
      .single();

    if (fetchError || !proposal) {
      console.error("Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }
    console.log("[CONVERT] Proposal status:", proposal?.status);
    if (proposal.agency_id !== agencyData.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (proposal.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved proposals can be converted to invoices" },
        { status: 400 }
      );
    }

    if (proposal.converted_to_invoice_id) {
      return NextResponse.json(
        {
          error: "This proposal has already been converted to an invoice",
          invoice_id: proposal.converted_to_invoice_id,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyData.id)
      .gte("created_at", startOfMonth)
      .lte("created_at", endOfMonth);

    const usedThisMonth = count ?? 0;
    if (isInvoiceLimitReached(usedThisMonth, planKey)) {
      return NextResponse.json(
        { error: "Invoice limit reached" },
        { status: 403 }
      );
    }

    const publicToken = randomBytes(16).toString("hex");

    const { data: counterData, error: counterError } = await supabase
      .rpc("increment_agency_invoice_counter", { p_agency_id: proposal.agency_id });
    console.log("[CONVERT] Counter result:", counterData, "Error:", counterError);

    if (counterError || counterData === null) {
      console.error("Counter error:", counterError);
      return NextResponse.json(
        { error: "Failed to generate invoice number" },
        { status: 500 }
      );
    }

    const year = new Date().getFullYear();
    const paddedCounter = String(counterData).padStart(4, "0");
    const invoiceNumber = `INV-${year}-${paddedCounter}`;

    // Get user_id and currency from agency_settings
const { data: agency, error: agencyError } = await supabase
  .from("agency_settings")
  .select("user_id, currency")
  .eq("id", proposal.agency_id)
  .single();

if (agencyError || !agency) {
  console.error("Agency fetch error:", agencyError);
  return NextResponse.json(
    { error: "Agency not found" },
    { status: 500 }
  );
}

const invoiceData = {
  user_id: agency.user_id,
  agency_id: proposal.agency_id,
  client_id: proposal.client_id,
  invoice_number: invoiceNumber,
  title: proposal.title,
  total: proposal.total,
  currency: agency.currency || proposal.currency || "USD",
  tax_rate: proposal.tax_rate ?? 0,
  status: "draft",
  paid: false,
  due_date: null,
  notes: proposal.notes,
  public_token: publicToken,
};

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError) {
      console.error("Invoice creation error:", invoiceError);
      return NextResponse.json(
        { error: "Failed to create invoice", details: invoiceError.message },
        { status: 500 }
      );
    }
    console.log("[CONVERT] Invoice created:", invoice?.id);

    if (proposal.proposal_items && proposal.proposal_items.length > 0) {
      const invoiceItems = proposal.proposal_items.map((item: any) => ({
        invoice_id: invoice.id,
        title: item.title,
        description: item.description || null,
        qty: item.qty,
        unit_price: item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItems);

      if (itemsError) {
        console.error("Invoice items creation error:", itemsError);
        await supabase.from("invoices").delete().eq("id", invoice.id);
        return NextResponse.json(
          { error: "Failed to create invoice items", details: itemsError.message },
          { status: 500 }
        );
      }
    }

    const { error: updateError } = await supabase
      .from("proposals")
      .update({ converted_to_invoice_id: invoice.id })
      .eq("id", proposalId);

    if (updateError) {
      console.error("Proposal update error:", updateError);
    }

    return NextResponse.json({
      success: true,
      invoice_id: invoice.id,
      message: "Proposal successfully converted to invoice",
    });
  } catch (error) {
    console.error("Unexpected error FULL:", JSON.stringify(error, null, 2), error);
    return NextResponse.json(
      {
        error: "Unexpected error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}