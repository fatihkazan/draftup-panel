import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@/lib/supabaseServer";
import { PLAN_KEYS, type PlanKey } from "@/lib/subscription-plans";

const HANDLED_EVENTS = new Set([
  "order_created",
  "subscription_created",
  "subscription_updated",
]);

// ---------------------------------------------------------------------------
// Signature verification
// LemonSqueezy signs the raw body with HMAC-SHA256 and sends it in X-Signature.
// ---------------------------------------------------------------------------
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Map a product/variant name to a known plan key.
// Matches the first plan key found (case-insensitive) in the name string.
// ---------------------------------------------------------------------------
function resolvePlanKey(name: string): PlanKey | null {
  const lower = name.toLowerCase();
  for (const key of PLAN_KEYS) {
    if (lower.includes(key)) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Map a variant name/interval to a billing cycle.
// ---------------------------------------------------------------------------
function resolveBillingCycle(variantName: string, interval?: string): "monthly" | "yearly" {
  const lower = (variantName + " " + (interval ?? "")).toLowerCase();
  if (lower.includes("year") || lower.includes("annual")) return "yearly";
  return "monthly";
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[LS webhook] LEMONSQUEEZY_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = request.headers.get("x-signature") ?? request.headers.get("X-Signature");
  if (!signature) {
    console.warn("[LS webhook] Missing X-Signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error("[LS webhook] Failed to read body", err);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!verifySignature(rawBody, signature, secret)) {
    console.warn("[LS webhook] Signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("[LS webhook] Failed to parse JSON body", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = (payload.meta as Record<string, unknown>)?.event_name as string | undefined;
  if (!eventName || !HANDLED_EVENTS.has(eventName)) {
    console.log("[LS webhook] Ignoring unhandled event:", eventName);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const meta = (payload.meta as Record<string, unknown>) ?? {};
  const data = (payload.data as Record<string, unknown>) ?? {};
  const attributes = (data.attributes as Record<string, unknown>) ?? {};
  const customData = (meta.custom_data as Record<string, unknown>) ?? {};

  // Resolve customer email
  const email: string =
    (customData.email as string | undefined) ||
    (attributes.user_email as string | undefined) ||
    (attributes.customer_email as string | undefined) ||
    "";

  if (!email) {
    console.warn("[LS webhook] Could not determine customer email", { eventName });
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Resolve plan key from product name
  const productName: string =
    (attributes.product_name as string | undefined) ||
    (customData.product_name as string | undefined) ||
    "";
  const variantName: string =
    (attributes.variant_name as string | undefined) ||
    (customData.variant_name as string | undefined) ||
    "";
  const interval: string = (attributes.interval as string | undefined) ?? "";

  const planKey = resolvePlanKey(productName || variantName);
  if (!planKey) {
    console.warn("[LS webhook] Could not resolve plan from product/variant name", {
      productName,
      variantName,
      eventName,
    });
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const billingCycle = resolveBillingCycle(variantName, interval);

  // Find user by email in Supabase auth
  const supabase = createServerClient();

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error("[LS webhook] Failed to list users", usersError);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const user = usersData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    console.warn("[LS webhook] No Supabase user found for email:", email);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Update agency_settings for this user
  const { error: updateError } = await supabase
    .from("agency_settings")
    .update({
      subscription_status: "active",
      subscription_plan: planKey,
      billing_cycle: billingCycle,
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[LS webhook] Failed to update agency_settings", updateError);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  console.log("[LS webhook] Subscription synced", {
    eventName,
    email,
    userId: user.id,
    planKey,
    billingCycle,
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
