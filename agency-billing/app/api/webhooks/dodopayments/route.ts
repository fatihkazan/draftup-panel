import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { createServerClient } from "@/lib/supabaseServer";
import { PLAN_KEYS, type PlanKey } from "@/lib/subscription-plans";

const HANDLED_EVENTS = new Set([
  "subscription.active",
  "subscription.renewed",
  "subscription.updated",
  "subscription.plan_changed",
  "payment.succeeded",
]);

function resolvePlanKey(productName: string): PlanKey | null {
  const lower = productName.toLowerCase();
  for (const key of PLAN_KEYS) {
    if (lower.includes(key)) return key;
  }
  return null;
}

function resolveBillingCycle(productName: string): "monthly" | "yearly" {
  const lower = productName.toLowerCase();
  if (lower.includes("year") || lower.includes("annual")) return "yearly";
  return "monthly";
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const webhookHeaders = {
    "webhook-id": req.headers.get("webhook-id") || "",
    "webhook-signature": req.headers.get("webhook-signature") || "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
  };
  try {
    const wh = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_SECRET!);
    await wh.verify(rawBody, webhookHeaders);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const payload = JSON.parse(rawBody);
  const eventType = payload.type as string;
  if (!HANDLED_EVENTS.has(eventType)) {
    return NextResponse.json({ received: true });
  }
  const supabase = createServerClient();
  try {
    const data = payload.data;
    const customerEmail = data?.customer?.email as string | undefined;
    const productName = (data?.product_name || data?.items?.[0]?.product_name || "") as string;
    if (!customerEmail) {
      return NextResponse.json({ received: true });
    }
    const planKey = resolvePlanKey(productName);
    const billingCycle = resolveBillingCycle(productName);
    if (!planKey) {
      console.error("Could not resolve plan from product name:", productName);
      return NextResponse.json({ received: true });
    }
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;
    const user = users.find(u => u.email === customerEmail);
    if (user) {
      await supabase
        .from("agency_settings")
        .update({
          subscription_status: "active",
          subscription_plan: planKey,
          billing_cycle: billingCycle,
        })
        .eq("user_id", user.id);
    } else {
      if (eventType === "payment.succeeded" || eventType === "subscription.active") {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabase.from("registration_tokens").insert({
          token,
          email: customerEmail,
          subscription_plan: planKey,
          used: false,
          expires_at: expiresAt,
        });
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
