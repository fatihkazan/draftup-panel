/**
 * Subscription plans — single source of truth.
 * Invoice limits: per agency, per month. Every invoice creation counts (including drafts).
 * Void/deleted invoices do NOT restore the limit.
 * User limits: only ACTIVE users; pending invites do NOT count; owners count.
 */

export const PLAN_KEYS = ["freelancer", "starter", "growth", "scale"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export interface PlanLimits {
  /** Monthly invoice limit; null = unlimited */
  monthlyInvoiceLimit: number | null;
  /** Max active users (pending invites do not count) */
  userLimit: number;
}

/** Plan limits by plan key. Used for enforcement and display. */
export const SUBSCRIPTION_PLANS: Record<PlanKey, PlanLimits> = {
  freelancer: {
    monthlyInvoiceLimit: 10,
    userLimit: 1,
  },
  starter: {
    monthlyInvoiceLimit: 25,
    userLimit: 3,
  },
  growth: {
    monthlyInvoiceLimit: 150,
    userLimit: 10,
  },
  scale: {
    monthlyInvoiceLimit: null,
    userLimit: 50,
  },
};

/** Display name and description for each plan (e.g. for subscription page). */
export const PLAN_DISPLAY: Record<
  PlanKey,
  { name: string; description: string }
> = {
  freelancer: {
    name: "Freelancer",
    description: "For solo freelancers.",
  },
  starter: {
    name: "Starter",
    description: "Ideal for small agencies getting started.",
  },
  growth: {
    name: "Growth",
    description: "For growing teams with higher volume.",
  },
  scale: {
    name: "Scale",
    description: "For established agencies with high demand.",
  },
};

/** Default plan when agency has no plan set (e.g. new agencies). */
export const DEFAULT_PLAN_KEY: PlanKey = "freelancer";

/**
 * Returns the plan key from agency settings. Use this when reading from DB.
 */
export function normalizePlanKey(value: string | null | undefined): PlanKey {
  if (value && PLAN_KEYS.includes(value as PlanKey)) {
    return value as PlanKey;
  }
  return DEFAULT_PLAN_KEY;
}

/**
 * Check if the agency is at or over its monthly invoice limit.
 * @param usedThisMonth - Count of invoices created this month (all statuses, including drafts).
 * @param planKey - Agency's subscription plan.
 */
export function isInvoiceLimitReached(
  usedThisMonth: number,
  planKey: PlanKey
): boolean {
  const limit = SUBSCRIPTION_PLANS[planKey].monthlyInvoiceLimit;
  if (limit === null) return false;
  return usedThisMonth >= limit;
}

/**
 * Check if the agency can add another active user (invite/activate).
 * @param activeUserCount - Count of active users (pending invites do not count).
 * @param planKey - Agency's subscription plan.
 */
export function isUserLimitReached(
  activeUserCount: number,
  planKey: PlanKey
): boolean {
  const limit = SUBSCRIPTION_PLANS[planKey].userLimit;
  return activeUserCount >= limit;
}
