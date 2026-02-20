import { NextRequest, NextResponse } from "next/server";
import { sendInvoiceEmail } from "@/lib/sendInvoiceEmail";

/** Temporary test route for manual testing of sendInvoiceEmail. No auth, no DB. */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const to = typeof body?.to === "string" ? body.to : "test@example.com";

    const { error } = await sendInvoiceEmail({
      to,
      invoiceNumber: "INV-2026-0001",
      agencyName: "Offero Test",
    });

    if (error) {
      console.error("[test/send-invoice-email]", error);
      return NextResponse.json(
        { error: "Failed to send", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, to });
  } catch (err) {
    console.error("[test/send-invoice-email]", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
