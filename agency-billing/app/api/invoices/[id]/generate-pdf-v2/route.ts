import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateInvoicePdfBuffer } from "@/lib/pdf/InvoicePdf";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id: invoiceId } = await params;

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

    // Use service role key to bypass RLS
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

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!agencyData) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    console.log(`[PDF] Fetching invoice ${invoiceId}...`);

    // Fetch invoice with all data (service role bypasses RLS)
    const { data: invoice, error: fetchError } = await supabase
  .from("invoices")
  .select(
    `
    *,
    client:clients(id, name, email, company, address),
    agency:agency_settings(agency_name, email, phone, address, logo_url),
    invoice_items(id, title, description, qty, unit_price)
  `
  )
  .eq("id", invoiceId)
  .single();

    if (fetchError || !invoice) {
      console.error("[PDF] Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.agency_id !== agencyData.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("[PDF] Invoice fetched:", {
      title: invoice.title,
      currency: invoice.currency,
      total: invoice.total,
      status: invoice.status,
      hasClient: !!invoice.client,
      hasAgency: !!invoice.agency,
    });

    // Parse items
    // Get items from invoice_items table
let items = [];
if (invoice.invoice_items && Array.isArray(invoice.invoice_items)) {
  items = invoice.invoice_items.map((item: any) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? "",
    quantity: item.qty,
    unitPrice: item.unit_price,
  }));
}

    console.log("[PDF] Items parsed:", items.length, "items");

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unitPrice,
      0
    );
    const taxRate = Number(invoice.tax_rate ?? 0);
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;

    console.log("[PDF] Calculations:", {
      subtotal,
      taxRate,
      taxAmount,
      total: invoice.total,
      currency: invoice.currency,
    });

    // Prepare data for PDF
    const pdfData = {
      title: invoice.title,
      invoiceNumber: invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase(),
      date: new Date(invoice.created_at).toLocaleDateString("en-GB"),
      dueDate: invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString("en-GB")
        : null,
      clientName: invoice.client?.name || "Unknown Client",
      clientEmail: invoice.client?.email || null,
      clientCompany: invoice.client?.company || null,
      clientAddress: invoice.client?.address || null,
      items: items,
      subtotal: subtotal,
      taxRate: taxRate,
      taxAmount: taxAmount,
      total: invoice.total,
      currency: invoice.currency || "USD",
      notes: invoice.notes,
      agencyName: invoice.agency?.agency_name || "Your Agency",
      agencyEmail: invoice.agency?.email || null,
      agencyPhone: invoice.agency?.phone || null,
      agencyAddress: invoice.agency?.address || null,
      agencyLogo: invoice.agency?.logo_url || null,
    };

    console.log("[PDF] Generating PDF with data:", {
      title: pdfData.title,
      currency: pdfData.currency,
      itemCount: pdfData.items.length,
      total: pdfData.total,
    });

    // Generate PDF buffer
    const pdfBuffer = await generateInvoicePdfBuffer(pdfData);

    console.log("[PDF] Buffer generated:", pdfBuffer.length, "bytes");

    // Validate PDF starts with correct header
    const pdfHeader = pdfBuffer.toString("utf8", 0, 4);
    if (pdfHeader !== "%PDF") {
      console.error("[PDF] Invalid header:", pdfHeader);
      return NextResponse.json(
        { error: "Generated PDF is invalid" },
        { status: 500 }
      );
    }

    console.log("[PDF] PDF validated, uploading...");

    // Upload to Supabase Storage
    const filename = `invoices/${invoiceId}/${Date.now()}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filename, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[PDF] Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload PDF", details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filename);

    const pdfUrl = urlData.publicUrl;

    console.log("[PDF] Uploaded to:", pdfUrl);

    // Update invoice with pdf_url
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ pdf_url: pdfUrl })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("[PDF] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update invoice", details: updateError.message },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[PDF] ✅ SUCCESS in ${duration}ms`);

    return NextResponse.json({
      success: true,
      pdf_url: pdfUrl,
    });
  } catch (error) {
    console.error("[PDF] ❌ Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Unexpected error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}