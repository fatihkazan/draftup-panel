import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ token: null }, { status: 400 });
  }

  const supabase = createServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("registration_tokens")
    .select("token")
    .eq("email", email)
    .eq("used", false)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.token) {
    return NextResponse.json({ token: null }, { status: 404 });
  }

  return NextResponse.json({ token: data.token });
}
