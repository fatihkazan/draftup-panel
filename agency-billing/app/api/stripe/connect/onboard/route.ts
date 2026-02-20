import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-01-28.clover" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: agency } = await supabase
      .from("agency_settings")
      .select("id, stripe_account_id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    let accountId = agency.stripe_account_id;

    // Create Stripe Express account if not exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: agency.email || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      await supabase
        .from("agency_settings")
        .update({ stripe_account_id: accountId })
        .eq("id", agency.id);
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/profile?stripe=refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/profile?stripe=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error("Stripe onboard error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
