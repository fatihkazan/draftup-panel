import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

function normalizeToken(value: string | null): string {
  return (value ?? "").trim();
}

export async function GET(request: NextRequest) {
  const token = normalizeToken(request.nextUrl.searchParams.get("token"));
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const supabase = createServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("registration_tokens")
    .select("email, subscription_plan")
    .eq("token", token)
    .eq("used", false)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    email: data.email,
    subscriptionPlan: data.subscription_plan,
  });
}

export async function POST(request: NextRequest) {
  let body: { token?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const token = normalizeToken(body.token ?? null);
  const email = (body.email ?? "").trim().toLowerCase();

  if (!token || !email) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const supabase = createServerClient();
  const nowIso = new Date().toISOString();

  const { data: tokenRow, error: tokenLookupError } = await supabase
    .from("registration_tokens")
    .select("id, email")
    .eq("token", token)
    .eq("used", false)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (tokenLookupError || !tokenRow) {
    return NextResponse.json({ success: false }, { status: 404 });
  }

  if ((tokenRow.email ?? "").toLowerCase() !== email) {
    return NextResponse.json({ success: false }, { status: 403 });
  }

  const { error: consumeError } = await supabase
    .from("registration_tokens")
    .update({ used: true })
    .eq("id", tokenRow.id)
    .eq("used", false);

  if (consumeError) {
    return NextResponse.json({ success: false }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
