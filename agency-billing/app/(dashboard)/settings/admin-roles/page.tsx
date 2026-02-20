"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type AdminWithRole = {
  id: string;
  name: string;
  email: string;
  current_role: string;
};

const ROLES = ["owner", "admin", "editor", "viewer"];

const inputClasses = "rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent transition-colors";

export default function AdminRolesPage() {
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminWithRole[]>([]);

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: agency } = await supabase
      .from("agency_settings")
      .select("id, user_id, email")
      .maybeSingle();
    const currentUser: AdminWithRole = {
      id: user.id,
      name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Current User",
      email: user.email || agency?.email || "",
      current_role: "owner",
    };
    setAdmins([currentUser]);
    setLoading(false);
  }

  function handleRoleChange(userId: string, newRole: string) {
    setAdmins((prev) =>
      prev.map((a) => (a.id === userId ? { ...a, current_role: newRole } : a))
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Admin Roles</h1>
        <p className="text-sm text-muted-foreground">
          Manage roles assigned to admin users
        </p>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Loading roles...
          </div>
        ) : admins.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Shield size={48} className="mx-auto mb-4 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">No admin users to assign roles.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-6">Admin</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-6">Email</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-6">Current Role(s)</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3 px-6">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-foreground">
                          {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{a.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">{a.email || "—"}</td>
                    <td className="py-4 px-6">
                      <span className="inline-block rounded-full px-3 py-1 text-xs font-medium bg-secondary text-muted-foreground">
                        {a.current_role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <select
                        value={a.current_role}
                        onChange={(e) => handleRoleChange(a.id, e.target.value)}
                        className={`${inputClasses} min-w-[140px]`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
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
