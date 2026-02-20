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
    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 });
    }

    // Fetch invoice with agency info
    const { data: invoice } = await supabase
      .from("invoices")
      .select(`
        id, title, total, currency, status, agency_id,
        agency:agency_settings(id, agency_name, stripe_account_id, stripe_onboarding_completed)
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
    }

    const agency = invoice.agency as any;

    if (!agency?.stripe_account_id || !agency?.stripe_onboarding_completed) {
      return NextResponse.json({ error: "Agency Stripe not configured" }, { status: 400 });
    }

    // Create Stripe Checkout Session on behalf of connected account
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: invoice.currency?.toLowerCase() || "usd",
              product_data: {
                name: invoice.title || "Invoice Payment",
              },
              unit_amount: Math.round((invoice.total || 0) * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          invoice_id: invoice.id,
          agency_id: invoice.agency_id,
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/${invoice.id}?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/${invoice.id}?cancelled=true`,
      },
      {
        stripeAccount: agency.stripe_account_id,
      }
    );

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
