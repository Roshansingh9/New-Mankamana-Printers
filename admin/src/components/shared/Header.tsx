"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronDown, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "@/components/shared/theme-provider";
import { cachedJsonFetch, invalidateCacheKey } from "@/lib/requestCache";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const json = await cachedJsonFetch<any>("dashboard-stats", "/api/admin/dashboard/stats", 8000);
        const d = json?.data;
        if (d) setPendingCount((d.pending_registrations || 0) + (d.pending_designs || 0));
      } catch {
        // non-blocking
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 15000);

    // Refresh immediately when an action resolves a notification
    const refreshNow = () => {
      invalidateCacheKey("dashboard-stats");
      void fetchPending();
    };
    window.addEventListener("stats-updated", refreshNow);
    // Refresh when the tab regains focus
    const onVisible = () => { if (!document.hidden) fetchPending(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("stats-updated", refreshNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      {/* Search */}
      <div className="flex w-full max-w-sm items-center">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search orders, clients…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#0061FF] focus:bg-white focus:ring-2 focus:ring-[#0061FF]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#0061FF] dark:focus:bg-slate-800"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4.5 w-4.5" />
          ) : (
            <Moon className="h-4.5 w-4.5" />
          )}
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label={`Notifications${pendingCount > 0 ? ` — ${pendingCount} pending` : ""}`}
          className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <Bell className="h-4.5 w-4.5" />
          {pendingCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {pendingCount > 99 ? "99" : pendingCount}
            </span>
          )}
        </button>

        <div className="mx-2 h-5 w-px bg-slate-200 dark:bg-slate-700" />

        {/* User */}
        <button
          type="button"
          aria-label="Admin user menu"
          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0061FF]/10 text-[11px] font-bold text-[#0061FF]">
            AD
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Admin</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:text-slate-600" />
        </button>
      </div>
    </header>
  );
}
