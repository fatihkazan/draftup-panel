import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  SUBSCRIPTION_PLANS,
  normalizePlanKey,
  isUserLimitReached,
  type PlanKey,
} from "@/lib/subscription-plans";

/**
 * GET: Returns active user count and limit for the current agency.
 * Active users = only users with active status (owners count; pending invites do not).
 * When invite/activate flows exist, count from agency_members (or similar) where status = 'active'.
 * Until then, each agency has one owner (agency_settings.user_id) = 1 active user.
 */
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
        activeUserCount: 0,
        userLimit: plan.userLimit,
        atLimit: false,
        planKey: "freelancer",
      });
    }

    const planKey = normalizePlanKey(
      (agencyData as { subscription_plan?: string }).subscription_plan
    ) as PlanKey;
    const plan = SUBSCRIPTION_PLANS[planKey];

    // Active users: owner counts. When agency_members (or similar) exists, add count of active members.
    const activeUserCount = 1;

    const atLimit = isUserLimitReached(activeUserCount, planKey);

    return NextResponse.json({
      activeUserCount,
      userLimit: plan.userLimit,
      atLimit,
      planKey,
    });
  } catch {
    const plan = SUBSCRIPTION_PLANS.freelancer;
    return NextResponse.json({
      activeUserCount: 0,
      userLimit: plan.userLimit,
      atLimit: false,
      planKey: "freelancer",
    });
  }
}
