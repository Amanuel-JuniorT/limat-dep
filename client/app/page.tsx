"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  Package,
  BarChart3,
  LogOut,
  Bell,
  RotateCw,
  ShieldAlert,
  ArrowUpRight,
  FileText,
  Boxes,
  Trash2,
  Store,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import api from "@/lib/api";

export default function Home() {
  const { user, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    pendingUsers: 0,
    loading: true,
  });

  const fetchData = async () => {
    try {
      let pendingUsers = 0;
      if (user?.role === "ADMIN") {
        const response = await api.get("/users/pending-count");
        pendingUsers = response.data?.count || 0;
      }
      setStats({ pendingUsers, loading: false });
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.role]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const roleLabel =
    user?.role === "ADMIN"
      ? "Administrator"
      : user?.role === "STOCK"
      ? "Stock Manager"
      : "Shop / Event Seller";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-zinc-50">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-100 bg-white/80 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none">
            <Store className="h-5 w-5" />
          </div>
          <span className="text-lg font-black tracking-tight">
            Limat <span className="text-indigo-600">Terminal</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RotateCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </button>

          <div className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 p-1 pr-3 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              {user?.name?.[0] || "U"}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold leading-none text-slate-700 dark:text-slate-200">
                {user?.name || "User"}
              </p>
              <p className="text-[8px] font-black uppercase tracking-wider text-indigo-600">
                {user?.role || "GUEST"}
              </p>
            </div>
            <button
              onClick={logout}
              className="ml-2 text-slate-400 hover:text-rose-500 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-6 pb-24">
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">
            {roleLabel} Node
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Dashboard
          </h2>
        </div>

        {/* Navigation List by Role */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
            Role Workspace Navigation
          </p>

          {/* SELLER OR ADMIN ACCESS */}
          {(user?.role === "SELLER" || user?.role === "ADMIN") && (
            <>
              <Link
                href="/sales-report"
                className="group flex items-center justify-between rounded-2xl bg-white p-4 transition-all hover:ring-2 hover:ring-indigo-600/10 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">
                      Daily Sales Report
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                      Submit batch shop sales
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </Link>

              <Link
                href="/spin-report"
                className="group flex items-center justify-between rounded-2xl bg-white p-4 transition-all hover:ring-2 hover:ring-purple-600/10 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-100 dark:shadow-none">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">
                      Event Spin Wheel Report
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                      30 ETB spins & rewards (Events)
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
              </Link>
            </>
          )}

          {/* STOCK OR ADMIN ACCESS */}
          {(user?.role === "STOCK" || user?.role === "ADMIN") && (
            <>
              <Link
                href="/inventory"
                className="group flex items-center justify-between rounded-2xl bg-white p-4 transition-all hover:ring-2 hover:ring-emerald-600/10 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-100 dark:shadow-none">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">
                      Warehouse & Catalog
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                      Items & dual prices (Selling & Cost)
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
              </Link>

              <Link
                href="/allocations"
                className="group flex items-center justify-between rounded-2xl bg-white p-4 transition-all hover:ring-2 hover:ring-emerald-600/10 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-100 dark:shadow-none">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">
                      Stock Allocation & Returns
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                      Transfer to Shop & Event Windows
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-teal-600 transition-colors" />
              </Link>

              <Link
                href="/wastage"
                className="group flex items-center justify-between rounded-2xl bg-white p-4 transition-all hover:ring-2 hover:ring-rose-600/10 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-100 dark:shadow-none">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">
                      Record Wastage
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                      Damage & loss write-offs
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-rose-600 transition-colors" />
              </Link>
            </>
          )}

          {/* ADMIN ONLY ANALYTICS */}
          {user?.role === "ADMIN" && (
            <Link
              href="/reports"
              className="group flex items-center justify-between rounded-2xl bg-white p-4 transition-all hover:ring-2 hover:ring-blue-600/10 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    Business Reports
                  </h3>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                    Reconciliation & totals
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </Link>
          )}

          {/* ADMIN ONLY CONTROL */}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin/users"
              className="group flex items-center justify-between rounded-2xl bg-white p-4 transition-all hover:ring-2 hover:ring-rose-600/10 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-100 dark:shadow-none">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    User Access & Roles
                  </h3>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                    Approve users & assign roles
                  </p>
                </div>
              </div>
              {stats.pendingUsers > 0 ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-lg shadow-rose-200 dark:shadow-none animate-in zoom-in duration-300">
                  {stats.pendingUsers}
                </div>
              ) : (
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-rose-600 transition-colors" />
              )}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
