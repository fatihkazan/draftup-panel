import { createClient } from "@supabase/supabase-js";
import PaymentClient from "./PaymentClient";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      id, title, total, currency, status, due_date,
      client:clients(name, email, company),
      agency:agency_settings(agency_name, email, stripe_account_id, stripe_onboarding_completed)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!invoice) {
    return <div style={{ color: "white", padding: "20px" }}>Invoice not found: {id}</div>;
  }

  return <PaymentClient invoice={invoice} />;
}
