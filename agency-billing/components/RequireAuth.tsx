"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      console.log("AUTH CHECK user:", data.user);

      if (!alive) return;

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setOk(true);
    });

    return () => {
      alive = false;
    };
  }, [router]);

  // Login kontrolü bitene kadar boş ekran (istersen buraya loader koyarız)
  if (!ok) return null;

  return <>{children}</>;
}
