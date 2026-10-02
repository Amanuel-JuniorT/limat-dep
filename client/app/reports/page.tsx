"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  ArrowLeft,
  Calendar as CalendarIcon,
  TrendingUp,
  Wallet,
  Gamepad2,
  Coins,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Printer,
  ShoppingCart,
  RotateCw,
  Package,
  DollarSign,
  Gift,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface DailySummary {
  date: string;
  totalRevenue: number;
  salesRevenue: number;
  salesCount: number;
  spinRevenue: number;
  spinCount: number;
  totalTips: number;
  grossProfit: number;
  totalCOGS: number;
  marketingCost: number;
  paymentBreakdown: {
    CASH: number;
    TELEBIRR: number;
    CBE: number;
  };
  tipBreakdown: {
    CASH: number;
    TELEBIRR: number;
    CBE: number;
  };
  itemBreakdown: Array<{
    itemId: number;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  spinBreakdown: Array<{
    itemId: number;
    name: string;
    quantity: number;
  }>;
}

import { useAuth } from "@/context/AuthContext";

export default function ReportsPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isRangeMode, setIsRangeMode] = useState(false);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchData();
    }
  }, [fromDate, toDate, isRangeMode, user?.role]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const actualToDate = isRangeMode ? toDate : fromDate;
      const [summaryRes, salesRes] = await Promise.all([
        api.get(`/reports/summary?from=${fromDate}&to=${actualToDate}`),
        api.get("/sales"), // We might want a date filter for sales too eventually
      ]);
      setSummary(summaryRes.data);
      setTransactions(salesRes.data || []);
    } catch (error) {
      console.error("Failed to fetch reports data", error);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: "ETB",
      maximumFractionDigits: 0,
    }).format(value);

  const handlePrint = () => {
    setIsPreviewOpen(false);
    setTimeout(() => window.print(), 100);
  };

  const adjustDate = (days: number) => {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + days);
    setFromDate(date.toISOString().split("T")[0]);
    if (!isRangeMode) {
      setToDate(date.toISOString().split("T")[0]);
    }
  };

  if (user && user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bento-card max-w-sm p-8 bg-white dark:bg-slate-900 flex flex-col items-center">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 flex items-center justify-center mb-4">
            <X className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-black tracking-tight mb-1">Access Restricted</h2>
          <p className="text-xs text-slate-400 mb-6">Business reports are only accessible to administrators.</p>
          <Link
            href="/"
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider text-center"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-zinc-50 overflow-x-hidden p-6 print:p-0 print:bg-white print:text-black">
      <div className="mx-auto max-w-lg print:max-w-none">
        {/* Header - Hidden in Print */}
        <header className="mb-8 flex flex-col gap-6 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all shadow-sm active:scale-95 dark:bg-slate-900 dark:border-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-xl font-black tracking-tight">
                  Business <span className="text-indigo-600">Analytics</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Daily Performance
                </p>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-white p-1 border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex-1">
                <button
                  onClick={() => adjustDate(-1)}
                  className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex flex-1 items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                  <CalendarIcon className="h-3 w-3 text-indigo-600" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-transparent text-center outline-none cursor-pointer"
                  />
                  {isRangeMode && (
                    <>
                      <span className="mx-1 text-slate-300">to</span>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="bg-transparent text-center outline-none cursor-pointer"
                      />
                    </>
                  )}
                </div>
                <button
                  onClick={() => adjustDate(1)}
                  className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="flex items-center gap-2 px-6 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95 dark:shadow-none dark:bg-indigo-600 h-12"
              >
                <Printer className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Print
                </span>
              </button>
            </div>

            <button
              onClick={() => setIsRangeMode(!isRangeMode)}
              className={cn(
                "w-full py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                isRangeMode
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-slate-100 text-slate-400 dark:bg-slate-900 dark:border-slate-800",
              )}
            >
              {isRangeMode ? "Switch to Single Day" : "Enable Multi-Day Range"}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex h-64 items-center justify-center print:hidden">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* Primary Stat Card */}
            <div className="bento-card overflow-hidden border-none bg-indigo-600 p-8 text-white shadow-2xl shadow-indigo-100 dark:shadow-none print:bg-slate-50 print:text-black print:border print:border-slate-200 print:shadow-none">
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 print:opacity-100">
                  Total Transactions
                </p>
                <h2 className="mt-2 text-4xl font-black tracking-tighter">
                  {formatMoney(summary.totalRevenue)}
                </h2>
              </div>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-2 gap-4 print:grid-cols-2">
              <div className="bento-card p-5 border-none shadow-sm dark:bg-slate-900 print:border print:border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 mb-3">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    POS Sales
                  </p>
                  <h3 className="text-lg font-black mt-1">
                    {formatMoney(summary.salesRevenue)}
                  </h3>
                </div>
                <p className="mt-2 text-[10px] font-bold text-slate-400">
                  {summary.salesCount} Tickets
                </p>
              </div>

              <div className="bento-card p-5 border-none shadow-sm dark:bg-slate-900 print:border print:border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/20 mb-3">
                    <Gamepad2 className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Spin Revenue
                  </p>
                  <h3 className="text-lg font-black mt-1">
                    {formatMoney(summary.spinRevenue)}
                  </h3>
                </div>
                <p className="mt-2 text-[10px] font-bold text-slate-400">
                  {summary.spinCount} Spins
                </p>
              </div>

              <div className="bento-card p-5 border-none shadow-sm dark:bg-slate-900 print:border print:border-slate-100 flex flex-col justify-between col-span-2">
                <div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 mb-3">
                    <Coins className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Total Tips
                  </p>
                  <h3 className="text-lg font-black mt-1">
                    {formatMoney(summary.totalTips)}
                  </h3>
                </div>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="bento-card p-6 border-none shadow-sm dark:bg-slate-900 print:border print:border-slate-100">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                Financial Summary
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-slate-50 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-bold">
                    <ShoppingCart className="h-3.5 w-3.5" /> Sales Revenue
                  </div>
                  <span className="font-black tabular-nums">
                    {formatMoney(summary.salesRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pb-1">
                  <div className="flex items-center gap-2 text-slate-500 font-bold">
                    <RotateCw className="h-3.5 w-3.5" /> Spin Revenue
                  </div>
                  <span className="font-black tabular-nums">
                    {formatMoney(summary.spinRevenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Activity Feed - Hidden in Print (Optional - keep for context) */}
            <div className="mt-8 print:hidden">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">
                Recent Transactions
              </p>
              <div className="space-y-3">
                {transactions.slice(0, 10).map((tx) => (
                  <div
                    key={tx.id}
                    className="bento-card p-4 flex items-center justify-between bg-white dark:bg-slate-900 border-none shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center text-white",
                          tx.type === "SALE"
                            ? "bg-indigo-600"
                            : "bg-purple-600",
                        )}
                      >
                        {tx.type === "SALE" ? (
                          <ShoppingCart className="h-3.5 w-3.5" />
                        ) : (
                          <RotateCw className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold tracking-tight">
                          {tx.type === "SALE"
                            ? tx.items
                                ?.map((i: any) => i.item.name)
                                .join(", ") || "Standard Sale"
                            : `Wheel: ${tx.spinResult || "Reward"}`}
                        </h4>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                          {new Date(tx.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {tx.user?.name}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-black tabular-nums">
                      {Math.round(tx.totalAmount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Note - Print Only */}
            <div className="hidden print:block text-[10px] font-bold text-slate-400 text-center mt-12 border-t pt-8 italic">
              Limat Terminal Daily Reconciliation Report · Generated on{" "}
              {new Date().toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="bento-card p-12 text-center flex flex-col items-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 dark:bg-slate-900">
              <BarChart3 className="h-8 w-8 text-slate-200" />
            </div>
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              No Data Available
            </h3>
            <p className="mt-2 text-xs text-slate-400 font-medium font-bold">
              There are no transactions for the selected date.
            </p>
          </div>
        )}
      </div>

      {/* Reconcile Preview Modal */}
      {isPreviewOpen && summary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300 print:hidden">
          <div className="w-full max-w-lg rounded-[2.5rem] bg-white dark:bg-slate-900 p-8 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  Reconcile Preview
                </h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {isRangeMode ? "Period Closing" : "Daily Closing"} ·{" "}
                  {new Date(fromDate).toLocaleDateString()}
                  {isRangeMode && ` - ${new Date(toDate).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-full bg-slate-50 p-2 text-slate-400 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
              {/* Payment Method Totals */}
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-4 ml-1">
                  Payment Collection
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      Cash Received
                    </span>
                    <span className="text-lg font-black tabular-nums">
                      {formatMoney(summary.paymentBreakdown.CASH)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10">
                    <span className="text-sm font-bold text-indigo-600">
                      Telebirr Total
                    </span>
                    <span className="text-lg font-black text-indigo-600 tabular-nums">
                      {formatMoney(summary.paymentBreakdown.TELEBIRR)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      CBE Total
                    </span>
                    <span className="text-lg font-black tabular-nums">
                      {formatMoney(summary.paymentBreakdown.CBE)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Tips Section */}
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-4 ml-1">
                  Tip Breakdown
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-none">
                    <span className="text-xs font-bold text-emerald-600/80">
                      Cash Tips
                    </span>
                    <span className="text-base font-black tabular-nums text-emerald-600">
                      {formatMoney(summary.tipBreakdown.CASH)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-none">
                    <span className="text-xs font-bold text-emerald-600/80">
                      Telebirr Tips
                    </span>
                    <span className="text-base font-black tabular-nums text-emerald-600">
                      {formatMoney(summary.tipBreakdown.TELEBIRR)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-none">
                    <span className="text-xs font-bold text-emerald-600/80">
                      CBE Tips
                    </span>
                    <span className="text-base font-black tabular-nums text-emerald-600">
                      {formatMoney(summary.tipBreakdown.CBE)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-emerald-600 text-white mt-2 shadow-lg shadow-emerald-100 dark:shadow-none">
                    <span className="text-sm font-black uppercase tracking-widest">
                      Total Tips
                    </span>
                    <span className="text-xl font-black tabular-nums">
                      {formatMoney(summary.totalTips)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Sold Items List */}
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-4 ml-1">
                  Product Breakdown
                </h4>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-5 py-4 font-black uppercase tracking-widest text-slate-400">
                          Item
                        </th>
                        <th className="px-5 py-4 font-black uppercase tracking-widest text-slate-400 text-center">
                          Qty
                        </th>
                        <th className="px-5 py-4 font-black uppercase tracking-widest text-slate-400 text-right">
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summary.itemBreakdown.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-5 py-10 text-center text-slate-400 font-bold"
                          >
                            No items sold today
                          </td>
                        </tr>
                      ) : (
                        summary.itemBreakdown.map((item) => (
                          <tr key={item.itemId}>
                            <td className="px-5 py-4 font-black text-base">
                              {item.name}
                            </td>
                            <td className="px-5 py-4 font-black text-center text-base tabular-nums">
                              {item.quantity}
                            </td>
                            <td className="px-5 py-4 font-black text-right text-base tabular-nums">
                              {item.revenue.toFixed(0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Spin Prizes Distributed */}
              {summary.spinBreakdown.length > 0 && (
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600 mb-4 ml-1">
                    Spin Prizes Distributed
                  </h4>
                  <div className="rounded-2xl border border-purple-100 bg-purple-50/20 dark:border-purple-900/30 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-purple-50 dark:bg-purple-900/20">
                        <tr>
                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-purple-600">
                            Prize Item
                          </th>
                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-purple-600 text-center">
                            Qty
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100 dark:divide-purple-900/30">
                        {summary.spinBreakdown.map((item) => (
                          <tr key={item.itemId}>
                            <td className="px-5 py-4 font-black">
                              {item.name}
                            </td>
                            <td className="px-5 py-4 font-black text-center tabular-nums text-purple-600">
                              {item.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Final Summary Row for Print Look */}
              <div className="pt-6 border-t border-dashed border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Net Revenue
                  </span>
                  <span className="text-2xl font-black tabular-nums">
                    {formatMoney(summary.totalRevenue)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={handlePrint}
                className="w-full rounded-2xl bg-indigo-600 py-5 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Confirm & Print Report
              </button>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="w-full rounded-2xl bg-slate-50 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Content (Standard Layout) */}
      {summary && (
        <div className="hidden print:block w-full text-black break-before-page">
          <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
            <h1 className="text-2xl font-black uppercase tracking-tighter">
              Limat Terminal
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest mt-1">
              Daily Reconciliation Report
            </p>
            <p className="text-[10px] font-black mt-2">
              From: {new Date(fromDate).toLocaleDateString()}
              {isRangeMode && ` To: ${new Date(toDate).toLocaleDateString()}`}
            </p>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest border-b pb-2 mb-4">
                Financial Overview
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span>Total Revenue:</span>{" "}
                  <span>{formatMoney(summary.totalRevenue)}</span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest border-b pb-2 mb-4">
                Payment Breakdown (Sales)
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span>Cash:</span>{" "}
                  <span>{formatMoney(summary.paymentBreakdown.CASH)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Telebirr:</span>{" "}
                  <span>{formatMoney(summary.paymentBreakdown.TELEBIRR)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>CBE:</span>{" "}
                  <span>{formatMoney(summary.paymentBreakdown.CBE)}</span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest border-b pb-2 mb-4">
                Tip Breakdown
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between font-bold">
                  <span>Cash Tips:</span>{" "}
                  <span>{formatMoney(summary.tipBreakdown.CASH)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Telebirr Tips:</span>{" "}
                  <span>{formatMoney(summary.tipBreakdown.TELEBIRR)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>CBE Tips:</span>{" "}
                  <span>{formatMoney(summary.tipBreakdown.CBE)}</span>
                </div>
                <div className="flex justify-between font-black pt-2 border-t mt-2">
                  <span>Total Tips:</span>{" "}
                  <span>{formatMoney(summary.totalTips)}</span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest border-b pb-2 mb-4">
                Item Breakdown
              </h2>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-[12px] font-black">Item Name</th>
                    <th className="py-2 text-center text-[12px] font-black">
                      Qty
                    </th>
                    <th className="py-2 text-right text-[12px] font-black">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.itemBreakdown.map((item) => (
                    <tr key={item.itemId}>
                      <td className="py-3 text-[14px] font-black">
                        {item.name}
                      </td>
                      <td className="py-3 text-center text-[14px] font-black">
                        {item.quantity}
                      </td>
                      <td className="py-3 text-right text-[14px] font-black">
                        {item.revenue.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Print Spin Prizes */}
            {summary.spinBreakdown.length > 0 && (
              <section>
                <h2 className="text-[10px] font-black uppercase tracking-widest border-b border-purple-200 pb-2 mb-4 text-purple-600">
                  Spin Prizes Distributed
                </h2>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-[12px] font-black">
                        Prize Item
                      </th>
                      <th className="py-2 text-center text-[12px] font-black">
                        Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.spinBreakdown.map((item) => (
                      <tr key={item.itemId}>
                        <td className="py-3 text-[14px] font-black">
                          {item.name}
                        </td>
                        <td className="py-3 text-center text-[14px] font-black text-purple-600">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>

          <div className="mt-12 pt-8 border-t text-[8px] font-black text-center uppercase tracking-[0.3em] opacity-40">
            End of Report · {new Date().toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
