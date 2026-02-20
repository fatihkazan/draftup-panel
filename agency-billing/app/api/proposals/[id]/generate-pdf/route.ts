import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateProposalPdfBuffer } from "@/lib/pdf/ProposalPdf";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params;

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

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agencyData) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const { data: proposal, error: fetchError } = await supabase
      .from("proposals")
      .select(
        `
        *,
        client:clients(id, name, email, company),
        agency:agency_settings(agency_name, email, phone, address, logo_url),
        proposal_items(id, title, description, qty, unit_price)
      `
      )
      .eq("id", proposalId)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    if (proposal.agency_id !== agencyData.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const items = (proposal.proposal_items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      quantity: item.qty,
      unitPrice: item.unit_price,
    }));

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unitPrice,
      0
    );
    const taxRate = Number(proposal.tax_rate ?? 0);
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const total = proposal.total ?? subtotal + taxAmount;

    const pdfData = {
      title: proposal.title,
      proposalNumber: proposal.proposal_number ?? proposal.id.slice(0, 8).toUpperCase(),
      date: new Date(proposal.created_at).toLocaleDateString("en-GB"),
      validUntil: proposal.valid_until
        ? new Date(proposal.valid_until).toLocaleDateString("en-GB")
        : null,
      clientName: proposal.client?.name || "Unknown Client",
      clientEmail: proposal.client?.email || null,
      clientCompany: proposal.client?.company || null,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      currency: proposal.currency || "USD",
      notes: proposal.notes ?? null,
      agencyName: proposal.agency?.agency_name || "Your Agency",
      agencyEmail: proposal.agency?.email || null,
      agencyPhone: proposal.agency?.phone || null,
      agencyAddress: proposal.agency?.address || null,
      agencyLogo: proposal.agency?.logo_url || null,
    };

    const pdfBuffer = await generateProposalPdfBuffer(pdfData);

    const pdfHeader = pdfBuffer.toString("utf8", 0, 4);
    if (pdfHeader !== "%PDF") {
      return NextResponse.json(
        { error: "Generated PDF is invalid" },
        { status: 500 }
      );
    }

    const filename = `proposals/${proposalId}/${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filename, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload PDF", details: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filename);
    const pdfUrl = urlData.publicUrl;

    await supabase
      .from("proposals")
      .update({ pdf_url: pdfUrl })
      .eq("id", proposalId);

    return NextResponse.json({
      success: true,
      pdf_url: pdfUrl,
    });
  } catch (error) {
    console.error("Proposal PDF error:", error);
    return NextResponse.json(
      {
        error: "Unexpected error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
