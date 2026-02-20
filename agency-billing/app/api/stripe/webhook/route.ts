import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { STRIPE_PLANS } from "@/lib/stripe-plans";
import { createServerClient } from "@/lib/supabaseServer";

const SUPPORTED_EVENT_TYPES = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

type PlanKey = keyof typeof STRIPE_PLANS;
type BillingCycle = "monthly" | "annual";

function resolvePlanFromPriceId(
  priceId: string
): { planKey: PlanKey; billingCycle: BillingCycle } | null {
  for (const [planKey, cycles] of Object.entries(STRIPE_PLANS)) {
    if (cycles.monthly === priceId) {
      return { planKey: planKey as PlanKey, billingCycle: "monthly" };
    }
    if (cycles.annual === priceId) {
      return { planKey: planKey as PlanKey, billingCycle: "annual" };
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.error("[Stripe webhook] Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch (e) {
    console.error("[Stripe webhook] Failed to read body", e);
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const eventType = event.type;

  if (SUPPORTED_EVENT_TYPES.includes(eventType as (typeof SUPPORTED_EVENT_TYPES)[number])) {
    const subscription = event.data?.object as Stripe.Subscription | undefined;
    const subscriptionId = subscription?.id ?? "(no id)";
    const status = subscription?.status ?? "(unknown)";
    const price =
      subscription?.items?.data?.[0]?.price;
    const priceId =
      typeof price === "string" ? price : (price as Stripe.Price | undefined)?.id;

    if (!priceId) {
      console.warn("[Stripe webhook] Subscription has no price id:", {
        eventType,
        subscriptionId,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const resolved = resolvePlanFromPriceId(priceId);
    if (!resolved) {
      console.warn(
        "[Stripe webhook] Price id does not match any known plan:",
        priceId,
        { eventType, subscriptionId }
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const planKey = resolved.planKey;
    const billingCycle = resolved.billingCycle;

    const metadataAgencyId =
      typeof subscription?.metadata?.agency_id === "string"
        ? subscription.metadata.agency_id.trim()
        : "";
    if (!metadataAgencyId) {
      console.warn("[Stripe webhook] Webhook V3: missing agency_id in subscription metadata");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from("agency_settings")
        .update({
          subscription_plan: planKey,
          billing_cycle: billingCycle,
          subscription_status: status,
        })
        .eq("id", metadataAgencyId)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[Stripe webhook] DB error syncing subscription:", error);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      if (!data) {
        console.warn(
          "[Stripe webhook] Webhook V3: agency_settings row not found for agency_id:",
          metadataAgencyId
        );
        return NextResponse.json({ received: true }, { status: 200 });
      }

      console.log("Webhook V3: subscription synced", {
        agencyId: metadataAgencyId,
        planKey,
        billingCycle,
        status,
      });
    } catch (err) {
      console.error("[Stripe webhook] Error syncing subscription to agency_settings:", err);
      return NextResponse.json({ received: true }, { status: 200 });
    }
  } else {
    console.log("[Stripe webhook] Unsupported event type:", eventType);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
