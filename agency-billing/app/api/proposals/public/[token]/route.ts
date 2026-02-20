import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch proposal
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("*")
      .eq("public_token", token)
      .in("status", ["sent", "viewed", "approved", "rejected"])
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    // Fetch client
    // Fetch client
let client = null;
if (proposal.client_id) {
  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .select("name, email, company, address, phone")
    .eq("id", proposal.client_id)
    .single();
  
  console.log("Client fetch:", { clientData, clientError });
  client = clientData;
}

    // Fetch agency
    // Fetch agency
let agency = null;
if (proposal.agency_id) {
  const { data: agencyData, error: agencyError } = await supabase
    .from("agency_settings")
    .select("agency_name, owner_name, email, phone, address, tax_id, iban, swift, bank_name, logo_url")
    .eq("id", proposal.agency_id)
    .single();
  
  console.log("Agency fetch:", { agencyData, agencyError });
  agency = agencyData;
}

    // Parse items from service JSON
    let items = [];
    if (proposal.service) {
      try {
        const serviceData = typeof proposal.service === "string"
          ? JSON.parse(proposal.service)
          : proposal.service;

        if (serviceData.items && Array.isArray(serviceData.items)) {
          items = serviceData.items;
        }
      } catch (e) {
        console.error("Failed to parse service data");
      }
    }

    // Update status to "viewed" if sent
    if (proposal.status === "sent") {
      await supabase
        .from("proposals")
        .update({ status: "viewed" })
        .eq("public_token", token);
    }

    return NextResponse.json({
      proposal,
      client,
      agency,
      items,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}