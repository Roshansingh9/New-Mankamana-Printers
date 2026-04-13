"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  UserPlus,
  Package,
  CheckCircle,
  Wallet,
  LogOut,
  Users,
  BadgeDollarSign,
} from "lucide-react";
import { cachedJsonFetch, invalidateCacheKey } from "@/lib/requestCache";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [pendingDesigns, setPendingDesigns] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const json = await cachedJsonFetch<any>("dashboard-stats", "/api/admin/dashboard/stats", 8000);
        const d = json?.data;
        if (d) {
          setPendingRegistrations(d.pending_registrations || 0);
          setPendingDesigns(d.pending_designs || 0);
        }
      } catch {
        // non-blocking
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);

    // Refresh immediately when an action resolves a notification
    const refreshNow = () => {
      invalidateCacheKey("dashboard-stats");
      void fetchCounts();
    };
    window.addEventListener("stats-updated", refreshNow);
    // Refresh when the tab regains focus
    const onVisible = () => { if (!document.hidden) fetchCounts(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("stats-updated", refreshNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const navSections = [
    {
      label: "Operations",
      items: [
        { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, badge: 0 },
        { title: "Registration Requests", href: "/registration-requests", icon: UserPlus, badge: pendingRegistrations },
        { title: "Clients", href: "/clients", icon: Users, badge: 0 },
        { title: "Designs", href: "/design-approval", icon: CheckCircle, badge: pendingDesigns },
        { title: "Wallet", href: "/payments", icon: Wallet, badge: 0 },
        { title: "Orders", href: "/orders", icon: Package, badge: 0 },
      ],
    },
    {
      label: "Catalog",
      items: [
        { title: "Pricing", href: "/pricing", icon: BadgeDollarSign, badge: 0 },
      ],
    },
  ];

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="relative flex h-screen w-64 flex-col border-r border-slate-800/80 bg-gradient-to-b from-[#111827] via-[#0f172a] to-[#0b1220] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,97,255,0.22),transparent_38%)]" />
      <div className="relative flex items-center gap-3 p-6">
        <Image
          src="/main-logo.png"
          alt="New Mankamana Printers Logo"
          width={40}
          height={40}
          className="object-contain"
        />
        <div>
          <h1 className="text-sm font-bold tracking-tight">MANAKAMANA</h1>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            Admin Portal
          </p>
        </div>
      </div>

      <nav className="sidebar-scroll relative flex-1 min-h-0 overflow-y-auto space-y-6 px-4 pb-6">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="mb-2 mt-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {section.label}
            </div>
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#0061FF] text-white shadow-lg shadow-[#0061FF]/30"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.title}</span>
                  {item.badge > 0 && (
                    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="relative mt-auto border-t border-slate-800 p-4">
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[#0061FF]/20 flex items-center justify-center text-[11px] font-bold text-[#0061FF]">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white">Admin User</span>
              <span className="text-[10px] text-slate-500">Super Admin</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
