"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, X, MoreVertical, Eye, UserCircle } from "lucide-react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  status: "active" | "inactive" | "pending";
  primary_role?: string;
};

const STATUS_CONFIG = {
  active: { label: "Active", color: "bg-accent/20 text-accent" },
  inactive: { label: "Inactive", color: "bg-slate-500/20 text-muted-foreground" },
  pending: { label: "Pending", color: "bg-amber-500/20 text-amber-400" },
};

const STATUS_FILTERS = ["all", "active", "inactive", "pending"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!config) return <span className="text-xs text-muted-foreground">{status}</span>;
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function AdminManagementPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const { data: { user } } = await import("@/lib/supabaseClient").then((m) =>
      m.supabase.auth.getUser()
    );
    if (!user) {
      setLoading(false);
      return;
    }
    const { supabase } = await import("@/lib/supabaseClient");
    const { data: agency } = await supabase
      .from("agency_settings")
      .select("id, user_id, email")
      .maybeSingle();
    const currentUser: AdminUser = {
      id: user.id,
      name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Current User",
      email: user.email || agency?.email || "",
      phone: (user.user_metadata?.phone as string) || null,
      created_at: user.created_at || new Date().toISOString(),
      status: "active",
      primary_role: "owner",
    };
    setUsers([currentUser]);
    setLoading(false);
  }

  let filtered = users;
  if (statusFilter !== "all") {
    filtered = filtered.filter((u) => u.status === statusFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || "").includes(q)
    );
  }

  const statusCounts = {
    all: users.length,
    active: users.filter((u) => u.status === "active").length,
    inactive: users.filter((u) => u.status === "inactive").length,
    pending: users.filter((u) => u.status === "pending").length,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Admin Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage admin users and their information
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === s ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground border border-border hover:bg-muted"
            }`}
          >
            {s === "all" ? `All (${statusCounts.all})` : `${STATUS_CONFIG[s].label} (${statusCounts[s]})`}
          </button>
        ))}
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="w-full rounded-xl bg-secondary border border-border pl-12 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Loading admin users...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UserCircle size={48} className="mx-auto mb-4 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "No users match your filters."
                : "No admin users yet."}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-6">Name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-6">Email</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-6">Phone</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-6">Created</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-6">Status</th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase py-3 px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-foreground">
                          {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{u.name}</div>
                          {u.primary_role && (
                            <span className="inline-block mt-0.5 rounded px-2 py-0.5 text-xs bg-secondary text-muted-foreground">
                              {u.primary_role}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">{u.email || "—"}</td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">{u.phone || "—"}</td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="relative flex items-center justify-end gap-2">
                        <Link
                          href={`/settings/admin-management/${u.id}`}
                          className="rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Eye size={14} className="inline mr-1.5" />
                          View
                        </Link>
                        <button
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          aria-label="More actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
