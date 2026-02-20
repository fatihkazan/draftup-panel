"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div>
      <Link
        href="/settings/admin-management"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={16} />
        Back to Admin Management
      </Link>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Admin User</h1>
      <p className="text-sm text-muted-foreground mb-6">View admin user details</p>
      <div className="rounded-2xl bg-card border border-border p-6">
        <p className="text-sm text-muted-foreground">User ID: {id}</p>
      </div>
    </div>
  );
}
