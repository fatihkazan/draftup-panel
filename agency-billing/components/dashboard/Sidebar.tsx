"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Package,
  Settings,
  HelpCircle,
  CreditCard,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* ---------------- TYPES ---------------- */

type NavItem = {
  label: string;
  href: string;
  icon: any;
  badge?: number;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

/* ---------------- NAV CONFIG ---------------- */

const navigation: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Clients", href: "/clients", icon: Users },
      { label: "Proposals", href: "/proposals", icon: FileText },
      { label: "Invoices", href: "/invoices", icon: Receipt },
      { label: "Services", href: "/services", icon: Package },
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Support", href: "/support", icon: HelpCircle },
    ],
  },
];

/* ---------------- SIDEBAR ITEM ---------------- */

function SidebarItem({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <div
        className={`
          group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative
          ${isActive
            ? "bg-sidebar-accent text-sidebar-foreground"
            : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          }
        `}
      >
        {isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-accent opacity-100"
            aria-hidden
          />
        )}
        <Icon
          size={20}
          className={isActive ? "text-accent shrink-0" : "shrink-0 group-hover:scale-110 transition-transform duration-200"}
        />
        <span
          className={`flex-1 whitespace-nowrap transition-all duration-200 ${
            collapsed ? "opacity-0 w-0 min-w-0 overflow-hidden" : ""
          }`}
        >
          {item.label}
        </span>
        {item.badge != null && !collapsed && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs text-accent-foreground">
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );
}

/* ---------------- MAIN SIDEBAR ---------------- */

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();

  const isItemActive = (href: string): boolean => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-40 h-screen flex flex-col transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <Link href="/" className="block">
          <img
            src="/logo_dark.png"
            alt="Draftup"
            className="dark:block hidden"
            style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
          />
          <img
            src="/logo_light.png"
            alt="Draftup"
            className="dark:hidden block"
            style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-2">
        {navigation.map((section) => (
          <div key={section.title} className="mb-6">
            <div
              className={`text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2 transition-all duration-200 ${
                collapsed ? "opacity-0 w-0 min-w-0 overflow-hidden h-0 p-0 m-0" : ""
              }`}
            >
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <SidebarItem
                  key={item.href}
                  item={item}
                  isActive={isItemActive(item.href)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse button */}
      <div className="p-2 border-t border-sidebar-border shrink-0">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-sidebar-accent/50 cursor-pointer transition-colors">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/80 text-sm font-semibold text-accent-foreground">
            AO
          </div>
          <div className={`flex-1 min-w-0 transition-all duration-200 ${collapsed ? "opacity-0 w-0 min-w-0 overflow-hidden" : ""}`}>
            <div className="text-sm font-medium text-sidebar-foreground truncate">Agency Owner</div>
            <div className="text-xs text-muted-foreground truncate">owner@agency.com</div>
          </div>
          <button
            type="button"
            className="p-2 text-muted-foreground hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent transition-colors shrink-0"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
