"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield, CreditCard, Users, Key, Bell, Link2 } from "lucide-react";

const internalNav = [
  { label: "Profile", href: "/settings/profile", icon: User },
  { label: "Security", href: "/settings/security", icon: Shield },
  { label: "Subscription", href: "/settings/subscription", icon: CreditCard },
  { label: "Admin Management", href: "/settings/admin-management", icon: Users },
  { label: "Admin Roles", href: "/settings/admin-roles", icon: Key },
];

const dummyTabs = [
  { label: "Notifications", icon: Bell },
  { label: "Integrations", icon: Link2 },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/settings/profile") return pathname === "/settings/profile";
    if (href === "/settings/admin-management") {
      return pathname === "/settings/admin-management" || pathname.startsWith("/settings/admin-management/");
    }
    return pathname === href;
  };

  return (
    <div className="p-6">
      <div className="bg-secondary border border-border rounded-lg p-1 inline-flex gap-1 mb-6">
        {internalNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "bg-card text-foreground rounded-md px-3 py-1.5 text-sm font-medium flex items-center gap-2"
                  : "text-muted-foreground hover:text-foreground px-3 py-1.5 text-sm font-medium flex items-center gap-2 rounded-md hover:bg-muted transition-colors"
              }
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
        {dummyTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className="text-muted-foreground hover:text-foreground px-3 py-1.5 text-sm font-medium flex items-center gap-2 rounded-md hover:bg-muted transition-colors"
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}
