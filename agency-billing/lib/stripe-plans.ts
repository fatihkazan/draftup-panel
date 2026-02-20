/**
 * Stripe price ID → subscription plan key and billing cycle mapping (TEST MODE).
 * Used by checkout and webhook handlers. Framework-agnostic, backend-only.
 */

export const STRIPE_PLANS = {
  freelancer: {
    monthly: "price_1Syzeb2RnZjKlDGNZFhah1wg",
    annual: "price_1Syzgz2RnZjKlDGNjmUw6F1y",
  },
  starter: {
    monthly: "price_1Syzij2RnZjKlDGNw2RaP8mZ",
    annual: "price_1SyzjN2RnZjKlDGNtLkhQ8Qb",
  },
  growth: {
    monthly: "price_1Syzk92RnZjKlDGN72G4ADbh",
    annual: "price_1Syzke2RnZjKlDGNmwcHGErD",
  },
  scale: {
    monthly: "price_1Syzle2RnZjKlDGNGKnx2OMa",
    annual: "price_1Syzlw2RnZjKlDGN6roAgP3i",
  },
} as const;
