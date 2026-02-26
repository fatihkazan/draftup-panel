import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, createServerClient } from "@/lib/supabaseServer";
import { normalizePlanKey, type PlanKey } from "@/lib/subscription-plans";
import { sendMail } from "@/lib/mailer";

type CreateTicketPayload = {
  subject?: string;
  description?: string;
};

export async function POST(request: NextRequest) {
  console.log("[Support Tickets API] POST /api/support/tickets hit");
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return NextResponse.json({ success: false, error: "Missing auth token" }, { status: 401 });
  }

  const anon = createAnonClient();
  const {
    data: { user },
    error: userError,
  } = await anon.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateTicketPayload | null;
  const subject = body?.subject?.trim() ?? "";
  const description = body?.description?.trim() ?? "";

  if (!subject || !description) {
    return NextResponse.json({ success: false, error: "Subject and description are required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: agencyData } = await supabase
    .from("agency_settings")
    .select("subscription_plan")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = normalizePlanKey((agencyData as { subscription_plan?: string } | null)?.subscription_plan) as PlanKey;
  const priority = plan === "growth" || plan === "scale" ? "high" : "normal";
  const ownerEmail = user.email ?? "";

  const { data: createdTicket, error: insertError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject,
      description,
      priority,
      plan,
      email: ownerEmail || null,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  await sendMail({
    to: "fatihkazan2525@gmail.com",
    subject: `New Support Ticket: ${subject}`,
    text: [
      `Ticket ID: ${(createdTicket as { id: string }).id}`,
      `Subject: ${subject}`,
      `Description: ${description}`,
      `User Email: ${ownerEmail || "unknown"}`,
      `Priority: ${priority}`,
      `Plan: ${plan}`,
    ].join("\n"),
  });

  return NextResponse.json({ success: true, ticketId: (createdTicket as { id: string }).id });
}
