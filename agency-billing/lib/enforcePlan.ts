import { createServerClient } from "@/lib/supabaseServer";
import {
  SUBSCRIPTION_PLANS,
  normalizePlanKey,
  type PlanKey,
} from "@/lib/subscription-plans";

export type EnforceInvoiceLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "INVOICE_LIMIT_REACHED"; limit: number };

/**
 * Enforces monthly invoice limit for the agency.
 * Loads plan from agency_settings, counts invoices this month, returns allowed or block.
 * Throws if agency has no plan.
 */
export async function enforceInvoiceLimit(
  agencyId: string
): Promise<EnforceInvoiceLimitResult> {
  const supabase = createServerClient();

  const { data: agency, error: agencyError } = await supabase
    .from("agency_settings")
    .select("subscription_plan")
    .eq("id", agencyId)
    .maybeSingle();

  if (agencyError) {
    throw new Error(`Failed to load agency: ${agencyError.message}`);
  }

  const planKey = normalizePlanKey(agency?.subscription_plan);

  const limit = SUBSCRIPTION_PLANS[planKey].monthlyInvoiceLimit;
  if (limit === null) {
    return { allowed: true };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthIso = startOfMonth.toISOString();

  const { count, error: countError } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .in("status", ["sent", "paid", "overdue"])
    .gte("created_at", startOfMonthIso);

  if (countError) {
    throw new Error(`Failed to count invoices: ${countError.message}`);
  }

  const used = count ?? 0;
  if (used >= limit) {
    return { allowed: false, reason: "INVOICE_LIMIT_REACHED", limit };
  }

  return { allowed: true };
}
