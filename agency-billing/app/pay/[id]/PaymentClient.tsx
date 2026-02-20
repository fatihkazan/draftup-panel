"use client";

import { useState } from "react";

export default function PaymentClient({ invoice }: { invoice: any }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const agency = invoice.agency;
  const client = invoice.client;
  const isPaid = invoice.status === "paid";
  const canPay = agency?.stripe_account_id && agency?.stripe_onboarding_completed;

  async function handlePay() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/connect/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Payment failed");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[oklch(0.09_0.005_260)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <p className="text-sm text-[oklch(0.65_0_0)]">Invoice from</p>
          <h1 className="text-xl font-semibold text-white mt-1">
            {agency?.agency_name || "Agency"}
          </h1>
        </div>

        {/* Invoice Card */}
        <div className="rounded-2xl bg-[oklch(0.12_0.005_260)] border border-[oklch(0.22_0.005_260)] p-6 mb-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-[oklch(0.65_0_0)]">Invoice</p>
              <p className="font-semibold text-white">{invoice.title}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              isPaid
                ? "bg-[oklch(0.7_0.18_145_/_0.2)] text-[oklch(0.7_0.18_145)]"
                : "bg-[oklch(0.75_0.18_55_/_0.2)] text-[oklch(0.75_0.18_55)]"
            }`}>
              {isPaid ? "Paid" : "Pending"}
            </span>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-[oklch(0.65_0_0)]">Client</span>
              <span className="text-white">{client?.name || "—"}</span>
            </div>
            {invoice.due_date && (
              <div className="flex justify-between text-sm">
                <span className="text-[oklch(0.65_0_0)]">Due Date</span>
                <span className="text-white">
                  {new Date(invoice.due_date).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric"
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-[oklch(0.22_0.005_260)] pt-4">
            <div className="flex justify-between items-center">
              <span className="text-[oklch(0.65_0_0)]">Total Amount</span>
              <span className="text-2xl font-bold text-white">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: invoice.currency || "USD",
                }).format(invoice.total || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Pay Button */}
        {isPaid ? (
          <div className="w-full rounded-xl bg-[oklch(0.7_0.18_145_/_0.2)] border border-[oklch(0.7_0.18_145_/_0.3)] py-4 text-center text-[oklch(0.7_0.18_145)] font-medium">
            ✓ This invoice has been paid
          </div>
        ) : canPay ? (
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full rounded-xl bg-[oklch(0.7_0.18_145)] py-4 text-sm font-semibold text-[oklch(0.09_0.005_260)] hover:bg-[oklch(0.65_0.18_145)] disabled:opacity-50 transition-colors"
          >
            {loading ? "Redirecting to payment..." : `Pay ${new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: invoice.currency || "USD",
            }).format(invoice.total || 0)}`}
          </button>
        ) : (
          <div className="w-full rounded-xl bg-[oklch(0.18_0.005_260)] border border-[oklch(0.22_0.005_260)] py-4 text-center text-[oklch(0.65_0_0)] text-sm">
            Online payment not available for this invoice
          </div>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-[oklch(0.65_0.2_25)]">{error}</p>
        )}

        <p className="mt-6 text-center text-xs text-[oklch(0.45_0_0)]">
          Powered by Draftup · Secured by Stripe
        </p>
      </div>
    </div>
  );
}
