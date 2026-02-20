"use client";

import Link from "next/link";

type Props = {
  onClose: () => void;
  open?: boolean;
};

export function InvoiceLimitModal({ onClose, open = true }: Props) {
  if (open === false) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative max-w-sm w-[90%] shrink-0 rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white">
          Invoice limit reached
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          You&apos;ve reached your monthly invoice limit.
          <br />
          Upgrade your plan to continue creating invoices.
        </p>
        <div className="mt-6 flex flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            OK
          </button>
          <Link
            href="/pricing"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}
