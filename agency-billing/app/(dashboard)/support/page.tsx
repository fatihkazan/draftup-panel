"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizePlanKey, type PlanKey } from "@/lib/subscription-plans";
import { ChevronDown, ChevronUp } from "lucide-react";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  description: string | null;
  reply: string | null;
  replied_at: string | null;
};

function getStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase().replace("_", " ");
  if (normalized === "in progress") return "In Progress";
  if (normalized === "resolved") return "Resolved";
  return "Open";
}

function getStatusClasses(status: string): string {
  const normalized = status.trim().toLowerCase().replace("_", " ");
  if (normalized === "in progress") {
    return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
  }
  if (normalized === "resolved") {
    return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
  }
  return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
}

export default function SupportPage() {
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState<PlanKey>("freelancer");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({});

  const isPriorityPlan = useMemo(() => plan === "growth" || plan === "scale", [plan]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoadingPage(true);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    let user = sessionData.session?.user ?? null;

    // Session can be temporarily null on initial hydration; fall back to getUser.
    if (!user) {
      const { data: authData } = await supabase.auth.getUser();
      user = authData.user;
    }

    if (!user) {
      setLoadingPage(false);
      setError("You must be logged in to view support tickets.");
      return;
    }

    setUserId(user.id);

    const { data: agencyData } = await supabase
      .from("agency_settings")
      .select("subscription_plan")
      .eq("user_id", user.id)
      .maybeSingle();

    const normalizedPlan = normalizePlanKey((agencyData as { subscription_plan?: string } | null)?.subscription_plan);
    setPlan(normalizedPlan as PlanKey);

    const { data: ticketData, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, subject, status, created_at, description, reply, replied_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (ticketError) {
      setError("Failed to load tickets. Please try again.");
      setLoadingPage(false);
      return;
    }

    setTickets((ticketData ?? []) as Ticket[]);
    setLoadingPage(false);
  }

  function toggleTicket(ticketId: string) {
    setExpandedTickets((prev) => ({
      ...prev,
      [ticketId]: !prev[ticketId],
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    console.log("[Support] onSubmit fired");
    event.preventDefault();

    if (!userId) return;
    if (!subject.trim() || !description.trim()) {
      setError("Please fill in both subject and description.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const priority = isPriorityPlan ? "high" : "normal";
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setSubmitting(false);
      setError("You must be logged in to open a ticket.");
      return;
    }

    console.log("[Support] sending request", { subject, description });
    const response = await fetch("/api/support/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        subject: subject.trim(),
        description: description.trim(),
        priority,
        plan,
      }),
    });
    console.log("[Support] response status", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.log("[Support] error response", errorText);
      setSubmitting(false);
      setError("Could not open ticket. Please try again.");
      return;
    }

    setSubject("");
    setDescription("");
    setSuccess("Your support ticket has been opened successfully.");
    setSubmitting(false);
    await loadData();
  }

  return (
    <div className="w-full px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Support</h1>
          <p className="text-sm text-muted-foreground">Open tickets and track their status</p>
        </div>

        {isPriorityPlan && (
          <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
            Priority Support
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Open a new ticket</h2>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={submitting || loadingPage}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
                placeholder="Brief summary of your issue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting || loadingPage}
                rows={5}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
                placeholder="Describe the issue in detail..."
              />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || loadingPage}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Opening..." : "Open Ticket"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">My Tickets</h2>

          {loadingPage ? (
            <p className="text-sm text-muted-foreground">Loading tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-xl border border-border bg-secondary/50 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleTicket(ticket.id)}
                    className="flex w-full items-start justify-between gap-4 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{ticket.subject}</p>
                      <p className="mt-1 text-xs text-zinc-400">Ticket #{ticket.id.slice(0, 8)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${getStatusClasses(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                      {expandedTickets[ticket.id] ? (
                        <ChevronUp size={16} className="text-zinc-400" />
                      ) : (
                        <ChevronDown size={16} className="text-zinc-400" />
                      )}
                    </div>
                  </button>

                  {expandedTickets[ticket.id] && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      <div>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                          Original Message
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-zinc-200">
                          {ticket.description?.trim() || "No description provided."}
                        </p>
                      </div>

                      {ticket.reply?.trim() ? (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-300">
                            Admin Reply
                          </p>
                          <p className="whitespace-pre-wrap text-sm text-zinc-100">{ticket.reply}</p>
                          {ticket.replied_at && (
                            <p className="mt-2 text-xs text-zinc-400">
                              Replied on{" "}
                              {new Date(ticket.replied_at).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-400">Awaiting response...</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
