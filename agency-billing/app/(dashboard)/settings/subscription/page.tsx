"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CreditCard, FileText, Users } from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  PLAN_DISPLAY,
  normalizePlanKey,
  type PlanKey,
} from "@/lib/subscription-plans";

const CHECKOUT_URLS: Record<PlanKey, string> = {
  freelancer: "https://draftup.lemonsqueezy.com/checkout/buy/929f6b32-b7e5-4364-b8e8-f3f923d75cb2",
  starter: "https://draftup.lemonsqueezy.com/checkout/buy/c4f2026b-d6d0-4426-9d7f-40aa3bb0feeb",
  growth: "https://draftup.lemonsqueezy.com/checkout/buy/782eb6ff-2248-4ed3-8998-6f1b92f74712",
  scale: "https://draftup.lemonsqueezy.com/checkout/buy/700085c2-d105-4c79-8200-cdd78ea01cf7",
};

const NEXT_PLAN: Partial<Record<PlanKey, PlanKey>> = {
  freelancer: "starter",
  starter: "growth",
  growth: "scale",
};

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [agencyName, setAgencyName] = useState("");
  const [invoicesThisMonth, setInvoicesThisMonth] = useState(0);
  const [planKey, setPlanKey] = useState<PlanKey>("freelancer");
  const [activeUserCount, setActiveUserCount] = useState(1);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    console.log("Subscription userId:", userId);
  }, [userId]);

  async function load() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    console.log("supabase.auth.getUser() user:", user?.id);
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("id, agency_name, subscription_plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agencyData?.id) {
      setLoading(false);
      return;
    }

    setAgencyName((agencyData as { agency_name?: string }).agency_name || "Agency");
    setPlanKey(
      normalizePlanKey((agencyData as { subscription_plan?: string }).subscription_plan) as PlanKey
    );

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { count, error } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyData.id)
      .gte("created_at", startOfMonth)
      .lte("created_at", endOfMonth);

    if (!error) {
      setInvoicesThisMonth(count ?? 0);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const res = await fetch("/api/subscription/user-usage", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.activeUserCount !== undefined) setActiveUserCount(data.activeUserCount);
    }

    setLoading(false);
  }

  const plan = SUBSCRIPTION_PLANS[planKey];
  const display = PLAN_DISPLAY[planKey];
  const nextPlanKey = NEXT_PLAN[planKey];
  const invoiceLimit = plan.monthlyInvoiceLimit;
  const usedInvoices = invoicesThisMonth;
  const remainingInvoices =
    invoiceLimit === null ? null : Math.max(0, invoiceLimit - usedInvoices);
  const usagePercent =
    invoiceLimit !== null && invoiceLimit > 0
      ? Math.min(100, (usedInvoices / invoiceLimit) * 100)
      : 0;

  const userLimit = plan.userLimit;
  const activeUsers = activeUserCount;

  const withCheckoutUserId = (url: string) => {
    if (!userId) return url;
    return `${url}?checkout[custom][user_id]=${userId}`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Plan and usage limits
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CreditCard size={18} />
                Plan Overview
              </h3>
              {userId && nextPlanKey && (
                <a
                  href={withCheckoutUserId(CHECKOUT_URLS[nextPlanKey])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-xl bg-[#10b981] px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/90 transition-colors"
                >
                  Upgrade to {PLAN_DISPLAY[nextPlanKey].name}
                </a>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Plan</div>
                <div className="font-medium text-foreground">{display.name}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{display.description}</div>
              </div>
              <div className="pt-2 border-t border-border flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Agency:</span>
                  <span className="text-foreground ml-2">{agencyName || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Billing cycle:</span>
                  <span className="text-foreground ml-2">Monthly</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText size={18} />
              Invoice Usage
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium text-foreground">{usedInvoices}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-center">
                  <div className="text-2xl font-semibold text-foreground">{usedInvoices}</div>
                  <div className="text-xs text-muted-foreground">Used This Month</div>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-center">
                  <div className="text-2xl font-semibold text-accent">
                    {remainingInvoices === null ? "Unlimited" : remainingInvoices}
                  </div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-center">
                  <div className="text-2xl font-semibold text-foreground">
                    {invoiceLimit === null ? "Unlimited" : invoiceLimit}
                  </div>
                  <div className="text-xs text-muted-foreground">Monthly Limit</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users size={18} />
              User Limit
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Active users:</span>
              <span className="font-medium text-foreground">{activeUsers}</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium text-foreground">{userLimit}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
