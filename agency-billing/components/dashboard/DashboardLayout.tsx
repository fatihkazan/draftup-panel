"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar - Fixed */}
      <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />

      {/* Main Content Area - margin matches sidebar width */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 overflow-hidden ${
          collapsed ? "ml-[72px]" : "ml-[260px]"
        }`}
      >
        {/* Top Header - Sticky */}
        <TopHeader />

        {/* Page Content - Scrollable */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
