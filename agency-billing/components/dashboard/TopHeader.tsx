"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Bell, Search, Plus, ChevronRight, ChevronDown, Sun, Moon, Receipt, FileText, UserPlus, X, Users } from "lucide-react";

/* ---------------- BREADCRUMB CONFIG ---------------- */

const pageTitles: Record<string, { title: string; parent?: string }> = {
  "/": { title: "Dashboard" },
  "/clients": { title: "Clients" },
  "/clients/new": { title: "New Client", parent: "Clients" },
  "/proposals": { title: "Proposals" },
  "/proposals/new": { title: "New Proposal", parent: "Proposals" },
  "/invoices": { title: "Invoices" },
  "/invoices/new": { title: "New Invoice", parent: "Invoices" },
  "/payments": { title: "Payments" },
  "/reports": { title: "Reports" },
  "/settings": { title: "Settings" },
  "/settings/profile": { title: "Profile", parent: "Settings" },
  "/settings/security": { title: "Security", parent: "Settings" },
  "/settings/subscription": { title: "Subscription", parent: "Settings" },
  "/settings/admin-management": { title: "Admin Management", parent: "Settings" },
  "/settings/admin-roles": { title: "Admin Roles", parent: "Settings" },
  "/support": { title: "Support" },
};

/* ---------------- MAIN COMPONENT ---------------- */

export function TopHeader() {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" || "dark";
    setThemeState(saved);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(saved);
    setMounted(true);
  }, []);

  function setTheme(newTheme: "dark" | "light") {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(newTheme);
  }
  const [notifOpen, setNotifOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: agency } = await supabase
          .from("agency_settings")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!agency) return;

        const q = searchQuery.toLowerCase();

        const [{ data: clients }, { data: proposals }, { data: invoices }] = await Promise.all([
          supabase.from("clients").select("id, name, company").eq("agency_id", agency.id).ilike("name", `%${q}%`).limit(4),
          supabase.from("proposals").select("id, title, status").eq("agency_id", agency.id).ilike("title", `%${q}%`).limit(4),
          supabase.from("invoices").select("id, title, invoice_number, status").eq("agency_id", agency.id).or(`title.ilike.%${q}%,invoice_number.ilike.%${q}%`).limit(4),
        ]);

        const results = [
          ...(clients || []).map(c => ({ type: "client", id: c.id, title: c.name, subtitle: c.company || "", href: `/clients/${c.id}` })),
          ...(proposals || []).map(p => ({ type: "proposal", id: p.id, title: p.title, subtitle: p.status, href: `/proposals/${p.id}` })),
          ...(invoices || []).map(i => ({ type: "invoice", id: i.id, title: i.title, subtitle: i.invoice_number, href: `/invoices/${i.id}` })),
        ];

        setSearchResults(results);
        setSearchOpen(true);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!notifOpen) return;
    async function loadRecent() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: agencyData } = await supabase
        .from("agency_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!agencyData?.id) return;

      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, title, status, created_at, client:clients(name)")
        .eq("agency_id", agencyData.id)
        .order("created_at", { ascending: false })
        .limit(3);

      const { data: proposals } = await supabase
        .from("proposals")
        .select("id, title, status, created_at, client:clients(name)")
        .eq("agency_id", agencyData.id)
        .order("created_at", { ascending: false })
        .limit(2);

      const combined = [
        ...(invoices ?? []).map(i => ({ ...i, type: "invoice" })),
        ...(proposals ?? []).map(p => ({ ...p, type: "proposal" })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

      setRecentItems(combined);
    }
    loadRecent();
  }, [notifOpen]);

  // Get page info based on current route
  const getPageInfo = () => {
    // Check exact match first
    if (pageTitles[pathname]) {
      return pageTitles[pathname];
    }

    // Check for dynamic routes (e.g., /clients/[id]/edit)
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length >= 1) {
      const basePath = `/${segments[0]}`;
      if (pageTitles[basePath]) {
        return {
          title: segments.length > 1 ? "Details" : pageTitles[basePath].title,
          parent: pageTitles[basePath].title,
        };
      }
    }

    return { title: "Page" };
  };

  const pageInfo = getPageInfo();

  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between px-6 h-16">
        {/* Left - Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          {pageInfo.parent && (
            <>
              <span className="text-muted-foreground">{pageInfo.parent}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </>
          )}
          <span className="font-medium text-foreground">{pageInfo.title}</span>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div ref={searchRef} className="relative">
            <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 h-10 w-64">
              <Search size={15} className="text-muted-foreground shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchResults([]); setSearchOpen(false); }}>
                  <X size={14} className="text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {searchOpen && (
              <div className="absolute top-12 left-0 w-80 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                {searchLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No results found</div>
                ) : (
                  <div className="py-2">
                    {["client", "proposal", "invoice"].map(type => {
                      const group = searchResults.filter(r => r.type === type);
                      if (group.length === 0) return null;
                      const labels: Record<string, string> = { client: "Clients", proposal: "Proposals", invoice: "Invoices" };
                      const icons: Record<string, any> = { client: Users, proposal: FileText, invoice: Receipt };
                      const Icon = icons[type];
                      return (
                        <div key={type}>
                          <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase">{labels[type]}</div>
                          {group.map(result => (
                            <Link
                              key={result.id}
                              href={result.href}
                              onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                                <Icon size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Bell size={18} />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                {recentItems.length || 3}
              </span>
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-card border border-border shadow-lg overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">Recent Activity</span>
                  <span className="text-xs text-muted-foreground">{recentItems.length} items</span>
                </div>
                <div className="divide-y divide-border">
                  {recentItems.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">No recent activity</div>
                  ) : (
                    recentItems.map((item) => (
                      <Link
                        key={item.id}
                        href={item.type === "invoice" ? `/invoices/${item.id}` : `/proposals/new?edit=${item.id}`}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${
                          item.type === "invoice" ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
                        }`}>
                          {item.type === "invoice" ? <Receipt size={14} /> : <FileText size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground truncate">{item.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {(item.client as any)?.name || "Unknown"} • {item.status}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(item.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                <div className="px-4 py-3 border-t border-border">
                  <Link
                    href="/invoices"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-accent hover:text-accent/80 font-medium"
                  >
                    View all invoices →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          {/* New dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
            >
              <Plus size={18} />
              New
              <ChevronDown size={14} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-card border border-border shadow-lg overflow-hidden z-50">
                <Link
                  href="/invoices/new"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Receipt size={16} className="text-muted-foreground" />
                  New Invoice
                </Link>
                <Link
                  href="/proposals/new"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <FileText size={16} className="text-muted-foreground" />
                  New Proposal
                </Link>
                <Link
                  href="/clients/new"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <UserPlus size={16} className="text-muted-foreground" />
                  New Client
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
