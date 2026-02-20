import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  SUBSCRIPTION_PLANS,
  normalizePlanKey,
  isInvoiceLimitReached,
  type PlanKey,
} from "@/lib/subscription-plans";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id, subscription_plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) {
      const plan = SUBSCRIPTION_PLANS.freelancer;
      return NextResponse.json({
        used: 0,
        limit: plan.monthlyInvoiceLimit,
        atLimit: false,
        planKey: "freelancer",
      });
    }

    const planKey = normalizePlanKey(
      (agencyData as { subscription_plan?: string }).subscription_plan
    ) as PlanKey;
    const plan = SUBSCRIPTION_PLANS[planKey];
    const limit = plan.monthlyInvoiceLimit;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { count, error } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyData.id)
      .gte("created_at", startOfMonth)
      .lte("created_at", endOfMonth);

    if (error) {
      return NextResponse.json({
        used: 0,
        limit: limit ?? null,
        atLimit: false,
        planKey,
      });
    }

    const used = count ?? 0;
    const atLimit = isInvoiceLimitReached(used, planKey);

    return NextResponse.json({
      used,
      limit: limit ?? null,
      atLimit,
      planKey,
    });
  } catch {
    const plan = SUBSCRIPTION_PLANS.freelancer;
    return NextResponse.json({
      used: 0,
      limit: plan.monthlyInvoiceLimit,
      atLimit: false,
      planKey: "freelancer",
    });
  }
}
