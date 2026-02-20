import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: proposal, error: fetchError } = await supabase
      .from("proposals")
      .select("id, status")
      .eq("public_token", token)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    if (!["sent", "viewed"].includes(proposal.status)) {
      return NextResponse.json(
        { error: "Proposal cannot be accepted in current state" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("proposals")
      .update({ status: "approved" })
      .eq("public_token", token);

    if (updateError) {
      console.error("Accept update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update proposal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, status: "approved" });
  } catch (error) {
    console.error("Accept error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
