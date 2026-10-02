"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Trash2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  History,
  ChevronDown,
  ChevronUp,
  Warehouse,
  Store,
} from "lucide-react";
import api from "@/lib/api";
import { Item, StockDestination, Wastage } from "@/types/pos";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

type Tab = "record" | "history";

export default function WastagePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("record");

  const [items, setItems] = useState<Item[]>([]);
  const [destinations, setDestinations] = useState<StockDestination[]>([]);
  const [wastages, setWastages] = useState<Wastage[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // History
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const role = user?.role;
  // SELLER → destination only; STOCK → warehouse only; ADMIN → both
  const isSeller = role === "SELLER";
  const isStock = role === "STOCK";
  const isAdmin = role === "ADMIN";

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, destsRes, wastageRes] = await Promise.all([
        api.get("/items"),
        api.get("/destinations"),
        api.get("/wastage"),
      ]);
      setItems(itemsRes.data || []);
      setDestinations((destsRes.data || []).filter((d: StockDestination) => d.isActive));
      setWastages(wastageRes.data || []);

      // Pre-select first active destination for SELLERs
      if (isSeller && destsRes.data?.length > 0) {
        setSelectedDestinationId(destsRes.data.find((d: StockDestination) => d.isActive)?.id.toString() || "");
      }
    } catch (err) {
      console.error("Failed to load wastage data", err);
    } finally {
      setLoading(false);
    }
  }, [isSeller]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) { setError("Please select an item"); return; }
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) { setError("Please enter a valid quantity"); return; }
    if (isSeller && !selectedDestinationId) { setError("Please select a shop or event location"); return; }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post("/wastage", {
        itemId: parseInt(selectedItemId, 10),
        quantity: qty,
        date,
        // STOCK always sends null (warehouse); SELLER always requires dest; ADMIN uses selection
        destinationId: isStock ? undefined : (selectedDestinationId ? parseInt(selectedDestinationId, 10) : undefined),
        reason: reason.trim() || undefined,
      });

      setSuccess("Wastage recorded successfully!");
      setSelectedItemId("");
      setQuantity("1");
      setReason("");
      if (isSeller) setSelectedDestinationId(destinations[0]?.id.toString() || "");

      const wastageRes = await api.get("/wastage");
      setWastages(wastageRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to record wastage");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-zinc-50 overflow-x-hidden">
      <div className="mx-auto max-w-lg px-6 py-8 pb-16">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all shadow-sm active:scale-95 dark:bg-slate-900 dark:border-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-black tracking-tight">
                Stock <span className="text-rose-600">Wastage</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Damage & Loss Records
              </p>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/20">
            <Trash2 className="h-5 w-5" />
          </div>
        </header>

        {/* Responsibility badge */}
        <div className={cn(
          "mb-5 flex items-center gap-3 rounded-2xl p-3.5 text-xs font-bold",
          isSeller
            ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700"
            : isStock
            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500",
        )}>
          {isSeller ? <Store className="h-4 w-4 shrink-0" /> : <Warehouse className="h-4 w-4 shrink-0" />}
          {isSeller
            ? "You can record wastage for shops and event locations only."
            : isStock
            ? "You can record wastage for the main warehouse only."
            : "Admin: You can record wastage for any location or the warehouse."}
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl bg-white dark:bg-slate-900 p-1.5 shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
          {[
            { key: "record", label: "Record Wastage", icon: Trash2 },
            { key: "history", label: "Wastage History", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as Tab)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all",
                  isActive
                    ? "bg-rose-600 text-white shadow-md shadow-rose-200 dark:shadow-none"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 p-4 text-xs font-bold text-rose-600">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-4 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* ── Tab: Record Wastage ──────────────────────────────────────────── */}
        {activeTab === "record" && (
          <div className="bento-card p-6 bg-white dark:bg-slate-900 border-none shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-rose-600" /> Record Item Wastage / Damage
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Select Item
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-600/5 focus:border-rose-600 dark:bg-white/5 dark:border-slate-800"
                >
                  <option value="">Select damaged/wasted item...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku || "NO SKU"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Quantity Lost
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-black text-rose-600 outline-none focus:ring-4 focus:ring-rose-600/5 focus:border-rose-600 dark:bg-white/5 dark:border-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Location
                  </label>
                  {isStock ? (
                    // STOCK: no dropdown needed, always warehouse
                    <div className="w-full rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-sm font-bold text-blue-700 dark:bg-blue-900/10 dark:border-blue-900/30">
                      🏬 Main Warehouse
                    </div>
                  ) : (
                    <select
                      value={selectedDestinationId}
                      onChange={(e) => setSelectedDestinationId(e.target.value)}
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-600/5 focus:border-rose-600 dark:bg-white/5 dark:border-slate-800"
                    >
                      {/* ADMIN only gets the warehouse option */}
                      {isAdmin && <option value="">🏬 Main Warehouse</option>}
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.type === "SHOP" ? "🏪" : "🎪"} {d.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-600/5 focus:border-rose-600 dark:bg-white/5 dark:border-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Reason / Details
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Expired, Spilled, Broken..."
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-600/5 focus:border-rose-600 dark:bg-white/5 dark:border-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-rose-600 py-4 text-sm font-black text-white shadow-xl shadow-rose-200 transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50 dark:shadow-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Record Wastage <Trash2 className="h-4 w-4" /></>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── Tab: Wastage History ─────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              {wastages.length} record{wastages.length !== 1 ? "s" : ""} logged
            </p>

            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-rose-600" />
              </div>
            ) : wastages.length === 0 ? (
              <div className="bento-card p-10 text-center bg-white dark:bg-slate-900">
                <Trash2 className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-400">No wastage records yet</p>
              </div>
            ) : (
              wastages.map((w) => {
                const isExpanded = expandedId === w.id;
                return (
                  <div key={w.id} className="bento-card bg-white dark:bg-slate-900 border-none shadow-sm overflow-hidden">
                    <button
                      className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : w.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-900/20 flex-shrink-0">
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black tracking-tight">{w.item?.name || "Item"}</span>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-900/20 rounded-full">
                              −{w.quantity} units
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {new Date(w.date).toLocaleDateString()} · {w.destination?.name || "🏬 Main Warehouse"}
                            {w.user && ` · By ${w.user.name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-slate-50 dark:border-slate-800 pt-4 space-y-2">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Item</p>
                            <p className="font-bold">{w.item?.name}</p>
                            {w.item?.sku && <p className="text-slate-400 font-medium">{w.item.sku}</p>}
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Location</p>
                            <p className="font-bold">{w.destination?.name || "Main Warehouse"}</p>
                            <p className="text-slate-400 font-medium text-[10px]">{w.destination?.type || "WAREHOUSE"}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Recorded By</p>
                            <p className="font-bold">{w.user?.name || "—"}</p>
                            <p className="text-slate-400 font-medium text-[10px] uppercase">{w.user?.role}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Date</p>
                            <p className="font-bold">{new Date(w.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                          </div>
                        </div>
                        {w.reason && (
                          <div className="mt-2 rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Reason</p>
                            <p className="text-xs font-bold italic text-slate-600 dark:text-slate-300">"{w.reason}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
