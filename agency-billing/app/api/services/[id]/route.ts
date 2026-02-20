import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

const UNIT_TYPES = ["hours", "days", "project", "item"] as const;

async function getAgencyId(supabase: ReturnType<typeof createServerClient>, token: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return null;
  const { data } = await supabase
    .from("agency_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return data?.id ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createServerClient();

    const agencyId = await getAgencyId(supabase, token);
    if (!agencyId) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from("services")
      .select("id")
      .eq("id", id)
      .eq("agency_id", agencyId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
    }
    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) {
      updates.description = typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    }
    if (typeof body.default_unit_price === "number" && body.default_unit_price >= 0) {
      updates.default_unit_price = body.default_unit_price;
    } else if (typeof body.default_unit_price === "string") {
      const n = parseFloat(body.default_unit_price);
      if (!isNaN(n) && n >= 0) updates.default_unit_price = n;
    }
    if (body.unit_type && UNIT_TYPES.includes(body.unit_type)) {
      updates.unit_type = body.unit_type;
    }
    if (typeof body.currency === "string") {
      updates.currency = body.currency.trim() || "USD";
    }

    const { data, error } = await supabase
      .from("services")
      .update(updates)
      .eq("id", id)
      .eq("agency_id", agencyId)
      .select()
      .single();

    if (error) {
      console.error("Services update error:", error);
      return NextResponse.json(
        { error: "Failed to update service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ service: data });
  } catch (err) {
    console.error("Services PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
