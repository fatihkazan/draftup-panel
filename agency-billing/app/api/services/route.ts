import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

const UNIT_TYPES = ["hours", "days", "project", "item"] as const;

export async function GET(request: NextRequest) {
  try {
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
      .single();
    if (!agencyData) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active_only") === "true";

    let query = supabase
      .from("services")
      .select("*")
      .eq("agency_id", agencyData.id)
      .order("name", { ascending: true });
    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;

    if (error) {
      console.error("Services list error:", error);
      return NextResponse.json(
        { error: "Failed to list services" },
        { status: 500 }
      );
    }

    return NextResponse.json({ services: data ?? [] });
  } catch (err) {
    console.error("Services GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
      .single();
    if (!agencyData) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, default_unit_price, unit_type, currency } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }
    const defaultPrice = parseFloat(default_unit_price);
    if (isNaN(defaultPrice) || defaultPrice < 0) {
      return NextResponse.json(
        { error: "default_unit_price must be a non-negative number" },
        { status: 400 }
      );
    }
    if (!unit_type || !UNIT_TYPES.includes(unit_type)) {
      return NextResponse.json(
        { error: "unit_type must be one of: hours, days, project, item" },
        { status: 400 }
      );
    }

    const insert = {
      agency_id: agencyData.id,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() || null : null,
      default_unit_price: defaultPrice,
      unit_type,
      currency: typeof currency === "string" && currency.trim() ? currency.trim() : "USD",
      is_active: true,
    };

    const { data, error } = await supabase
      .from("services")
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error("Services create error:", error);
      return NextResponse.json(
        { error: "Failed to create service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ service: data });
  } catch (err) {
    console.error("Services POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
