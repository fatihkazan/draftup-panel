"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session?.user ?? null;

      if (!user) {
        const { data: userData } = await supabase.auth.getUser();
        user = userData.user;
      }

      if (!alive) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: agencyData } = await supabase
        .from("agency_settings")
        .select("agency_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const agencyName = (agencyData as { agency_name?: string } | null)?.agency_name ?? "";
      if (!agencyName.trim()) {
        router.replace("/onboarding");
        return;
      }

      if (!alive) return;
      setReady(true);
    }

    void checkAccess();
    return () => {
      alive = false;
    };
  }, [router]);

  if (!ready) return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}
