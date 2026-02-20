import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature error:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      const agencyId = session.metadata?.agency_id;
      const amountPaid = (session.amount_total ?? 0) / 100;
      const currency = session.currency?.toUpperCase() || "USD";

      if (!invoiceId || !agencyId) {
        return NextResponse.json({ received: true });
      }

      // Record payment
      await supabase.from("payments").insert({
        invoice_id: invoiceId,
        amount: amountPaid,
        method: "card",
        note: `Stripe payment - session ${session.id}`,
        payment_date: new Date().toISOString().slice(0, 10),
      });

      // Update invoice status to paid
      await supabase
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoiceId);
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const isComplete =
        account.details_submitted &&
        account.charges_enabled &&
        account.payouts_enabled;

      if (isComplete) {
        await supabase
          .from("agency_settings")
          .update({ stripe_onboarding_completed: true })
          .eq("stripe_account_id", account.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const config = {
  api: { bodyParser: false },
};
