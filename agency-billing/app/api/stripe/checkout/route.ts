import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { STRIPE_PLANS } from "@/lib/stripe-plans";
import { createAnonClient } from "@/lib/supabaseServer";

const PLAN_KEYS = ["freelancer", "starter", "growth", "scale"] as const;
const BILLING_CYCLES = ["monthly", "annual"] as const;

type PlanKey = (typeof PLAN_KEYS)[number];
type BillingCycle = (typeof BILLING_CYCLES)[number];

function getPriceId(planKey: PlanKey, billingCycle: BillingCycle): string | null {
  const plan = STRIPE_PLANS[planKey];
  if (!plan) return null;
  return plan[billingCycle] ?? null;
}

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error("[Stripe checkout] STRIPE_SECRET_KEY is not set");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  let body: { planKey?: string; billingCycle?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const planKeyRaw = body.planKey;
  const billingCycleRaw = body.billingCycle;
  if (
    typeof planKeyRaw !== "string" ||
    !PLAN_KEYS.includes(planKeyRaw as PlanKey)
  ) {
    return NextResponse.json(
      { error: "Invalid planKey; must be one of: freelancer, starter, growth, scale" },
      { status: 400 }
    );
  }
  if (
    typeof billingCycleRaw !== "string" ||
    !BILLING_CYCLES.includes(billingCycleRaw as BillingCycle)
  ) {
    return NextResponse.json(
      { error: "Invalid billingCycle; must be one of: monthly, annual" },
      { status: 400 }
    );
  }
  const planKey = planKeyRaw as PlanKey;
  const billingCycle = billingCycleRaw as BillingCycle;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAnonClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: agencyRow, error: agencyError } = await supabase
    .from("agency_settings")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (agencyError) {
    console.error("[Stripe checkout] agency_settings lookup failed:", agencyError);
    return NextResponse.json({ error: "Agency lookup failed" }, { status: 500 });
  }
  if (!agencyRow) {
    return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  }
  const agencyId = agencyRow.id;

  const priceId = getPriceId(planKey, billingCycle);
  if (!priceId) {
    return NextResponse.json(
      { error: "Invalid plan or billing cycle" },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const successUrl =
    process.env.STRIPE_CHECKOUT_SUCCESS_URL ??
    `${baseUrl}/dashboard?checkout=success`;

  const cancelUrl =
    process.env.STRIPE_CHECKOUT_CANCEL_URL ??
    `${baseUrl}/dashboard?checkout=cancel`;

  const stripe = new Stripe(stripeSecretKey);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          agency_id: agencyId,
        },
      },
    });
  } catch (err) {
    console.error("[Stripe checkout] Session create failed:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }

  if (!session.url) {
    console.error("[Stripe checkout] Session has no URL");
    return NextResponse.json(
      { error: "Checkout session has no URL" },
      { status: 500 }
    );
  }

  console.log("[Stripe checkout] Session created", {
    agencyId,
    planKey,
    billingCycle,
    priceId,
  });

  return NextResponse.json({ url: session.url });
}
