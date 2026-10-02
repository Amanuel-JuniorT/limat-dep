"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  ArrowLeft,
  Plus,
  Loader2,
  Store,
  CheckCircle2,
  AlertCircle,
  Ban,
  Trash2,
  Eye,
  X,
  Send,
} from "lucide-react";
import api from "@/lib/api";
import { Item, StockDestination, SalesReport, ClosedDate } from "@/types/pos";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface SingleSaleRecord {
  tempId: string;
  itemId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  paymentMethod: "CASH" | "TELEBIRR" | "CBE";
  tipAmount: number;
  notes?: string;
}

export default function SalesReportPage() {
  const { user } = useAuth();
  const [destinations, setDestinations] = useState<StockDestination[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Header State
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>("");
  const [saleDate, setSaleDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Entry Form State (for adding ONE sale record at a time)
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState<string>("1");
  const [itemPaymentMethod, setItemPaymentMethod] = useState<"CASH" | "TELEBIRR" | "CBE">("CASH");
  const [itemTipAmount, setItemTipAmount] = useState<string>("0");
  const [itemNotes, setItemNotes] = useState<string>("");

  // List of distinct individual sale records
  const [saleRecords, setSaleRecords] = useState<SingleSaleRecord[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Closed date modal
  const [isClosedModalOpen, setIsClosedModalOpen] = useState(false);
  const [closedReason, setClosedReason] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [destsRes, itemsRes, closedRes] = await Promise.all([
        api.get("/destinations/active"),
        api.get("/items"),
        api.get("/closed-dates"),
      ]);
      const shopDests = (destsRes.data || []).filter((d: StockDestination) => d.type === "SHOP");
      setDestinations(shopDests);
      setItems(itemsRes.data || []);
      setClosedDates(closedRes.data || []);

      if (shopDests.length > 0) {
        setSelectedDestinationId(shopDests[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to load sales report data", err);
    } finally {
      setLoading(false);
    }
  };

  const currentClosedRecord = closedDates.find(
    (c) =>
      c.destinationId.toString() === selectedDestinationId &&
      new Date(c.date).toISOString().split("T")[0] === saleDate,
  );
  const isCurrentDateClosed = !!currentClosedRecord;

  // Add individual sale entry without merging/aggregating
  const handleAddSaleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      setError("Please choose an item");
      return;
    }
    const itemObj = items.find((i) => i.id.toString() === selectedItemId);
    if (!itemObj) return;

    const qty = parseInt(itemQuantity, 10) || 1;
    const price = itemObj.sellingPrice || 0;
    const tip = parseFloat(itemTipAmount) || 0;

    const newRecord: SingleSaleRecord = {
      tempId: Math.random().toString(36).substring(2, 9),
      itemId: itemObj.id,
      itemName: itemObj.name,
      quantity: qty,
      unitPrice: price,
      paymentMethod: itemPaymentMethod,
      tipAmount: tip,
      notes: itemNotes.trim() || undefined,
    };

    setSaleRecords((prev) => [...prev, newRecord]);
    setError(null);

    // Reset single entry inputs
    setSelectedItemId("");
    setItemQuantity("1");
    setItemTipAmount("0");
    setItemNotes("");
  };

  const handleRemoveRecord = (tempId: string) => {
    setSaleRecords((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  // Submit all distinct sale records to backend
  const handleSubmitAllReports = async () => {
    if (isCurrentDateClosed) {
      setError("This shop/destination is marked as closed for this date.");
      return;
    }
    if (saleRecords.length === 0) {
      setError("Please add at least one sale record before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const destinationId = parseInt(selectedDestinationId, 10);

      // Submit all records as one single batch SalesReport containing distinct items
      await api.post("/sales-reports", {
        destinationId,
        saleDate,
        items: saleRecords.map((record) => ({
          itemId: record.itemId,
          quantity: record.quantity,
          unitPrice: record.unitPrice,
          paymentMethod: record.paymentMethod,
          tipAmount: record.tipAmount,
          notes: record.notes,
        })),
      });

      setSuccess(`Successfully submitted sales report with ${saleRecords.length} record(s)!`);
      setSaleRecords([]);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to submit sales report",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkClosed = async () => {
    if (!selectedDestinationId) return;
    setIsSubmitting(true);
    try {
      await api.post("/closed-dates", {
        destinationId: parseInt(selectedDestinationId, 10),
        date: saleDate,
        reason: closedReason.trim() || "Shop Closed",
      });
      setSuccess("Marked date as closed.");
      setIsClosedModalOpen(false);
      setClosedReason("");
      const closedRes = await api.get("/closed-dates");
      setClosedDates(closedRes.data || []);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to mark date as closed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUncloseDate = async (closedId: number) => {
    if (!confirm("Are you sure you want to reopen/unclose this day?")) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/closed-dates/${closedId}`);
      setSuccess("Date reopened successfully!");
      const closedRes = await api.get("/closed-dates");
      setClosedDates(closedRes.data || []);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to reopen date");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDest = destinations.find(
    (d) => d.id.toString() === selectedDestinationId,
  );

  const grandTotal = saleRecords.reduce(
    (sum, r) => sum + r.quantity * r.unitPrice + r.tipAmount,
    0,
  );

  const noActiveShopOpened = destinations.length === 0 || !selectedDestinationId;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-zinc-50 overflow-x-hidden">
      <div className="mx-auto max-w-lg px-6 py-8 pb-16">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all shadow-sm active:scale-95 dark:bg-slate-900 dark:border-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-black tracking-tight">
                Sales <span className="text-indigo-600">Reports</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Individual Transactions Entry
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sales-report/history"
              className="flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-all"
            >
              <Eye className="h-3.5 w-3.5" /> History
            </Link>
            {!isCurrentDateClosed && selectedDestinationId && (
              <button
                onClick={() => setIsClosedModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider hover:bg-rose-100 transition-all"
              >
                <Ban className="h-3.5 w-3.5" /> Mark Closed
              </button>
            )}
          </div>
        </header>

        {/* Warning Banner 1: No Active Shop Destination */}
        {noActiveShopOpened && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-black">No Active Permanent Shop Destination</p>
              <p className="text-[10px] opacity-80 mt-0.5">
                No active Shop destinations are currently available. Please create or activate a permanent Shop location in Stock Allocation / Destinations before submitting sales reports.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 p-4 text-xs font-bold text-rose-600">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-4 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* Closed Day Banner */}
        {isCurrentDateClosed ? (
          <div className="bento-card p-8 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-200 dark:shadow-none">
              <Ban className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-rose-900 dark:text-rose-200">
              Shop Closed on {saleDate}
            </h2>
            <p className="text-xs font-bold text-rose-600/80 mt-1">
              Reason: {currentClosedRecord?.reason || "Closed for the day"}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-4">
              Sales submissions are disabled for closed dates.
            </p>
            <button
              onClick={() => handleUncloseDate(currentClosedRecord.id)}
              disabled={isSubmitting}
              className="mt-6 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-rose-600 px-6 py-3 text-xs font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
            >
              Reopen / Unclose Day
            </button>
          </div>
        ) : (
          <>
            {/* Common Header: Shop & Date */}
            <div className="bento-card p-5 bg-white dark:bg-slate-900 border-none shadow-sm mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Destination / Shop
                  </label>
                  <select
                    value={selectedDestinationId}
                    onChange={(e) => setSelectedDestinationId(e.target.value)}
                    disabled={noActiveShopOpened}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800 disabled:opacity-50"
                  >
                    {destinations.length === 0 ? (
                      <option value="">No Active Shop Destinations</option>
                    ) : (
                      destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.type})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Sale Date
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    disabled={noActiveShopOpened}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Individual Sale Entry Card */}
            <div
              className={cn(
                "bento-card p-6 bg-white dark:bg-slate-900 border-none shadow-sm mb-8 transition-opacity",
                noActiveShopOpened && "opacity-50 pointer-events-none",
              )}
            >
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-5 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600" /> Record Single Sale Transaction
              </h2>

              <form onSubmit={handleAddSaleRecord} className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Item
                    </label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      disabled={noActiveShopOpened}
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                    >
                      <option value="">Choose item...</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.sellingPrice} ETB)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      disabled={noActiveShopOpened}
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-black text-center outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Payment Channel
                    </label>
                    <select
                      value={itemPaymentMethod}
                      onChange={(e) => setItemPaymentMethod(e.target.value as any)}
                      disabled={noActiveShopOpened}
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                    >
                      <option value="CASH">Cash</option>
                      <option value="TELEBIRR">Telebirr</option>
                      <option value="CBE">CBE</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Tip for this Sale (ETB)
                    </label>
                    <input
                      type="number"
                      value={itemTipAmount}
                      onChange={(e) => setItemTipAmount(e.target.value)}
                      disabled={noActiveShopOpened}
                      placeholder="0"
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Notes for this Sale (Optional)
                  </label>
                  <input
                    type="text"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    disabled={noActiveShopOpened}
                    placeholder="e.g. Discount given, transferred via Telebirr ref #123..."
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  disabled={noActiveShopOpened}
                  className="w-full rounded-2xl bg-slate-900 dark:bg-slate-800 py-3.5 text-xs font-black uppercase tracking-widest text-white hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4 text-indigo-400" />
                  Add Sale Record to List
                </button>
              </form>
            </div>

            {/* List of Added Distinct Sale Records */}
            {saleRecords.length > 0 && (
              <div className="space-y-4 mb-8">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">
                  Records Ready to Submit ({saleRecords.length})
                </h3>

                <div className="space-y-3">
                  {saleRecords.map((r, index) => (
                    <div
                      key={r.tempId}
                      className="bento-card p-4 bg-white dark:bg-slate-900 border-none shadow-sm flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400">
                            #{index + 1}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {r.itemName}
                          </span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 rounded-full">
                            {r.paymentMethod}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400">
                          {r.quantity} × {r.unitPrice} ETB ={" "}
                          <span className="font-black text-slate-700 dark:text-slate-300">
                            {r.quantity * r.unitPrice} ETB
                          </span>
                          {r.tipAmount > 0 && (
                            <span className="ml-2 font-black text-emerald-600">
                              +{r.tipAmount} ETB Tip
                            </span>
                          )}
                        </p>
                        {r.notes && (
                          <p className="text-[9px] font-bold text-slate-500 italic">
                            "{r.notes}"
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveRecord(r.tempId)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex justify-between items-center text-xs font-black">
                  <span className="text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
                    Grand Total ({saleRecords.length} Sales):
                  </span>
                  <span className="text-lg text-indigo-600 tabular-nums font-black">
                    {grandTotal} ETB
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSubmitAllReports}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 dark:shadow-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Submit All {saleRecords.length} Distinct Sale Records
                      <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Closed Date Modal */}
      {isClosedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bento-card p-6 bg-white dark:bg-slate-900 shadow-2xl">
            <h3 className="text-lg font-black tracking-tight mb-2">
              Mark Date as <span className="text-rose-600">Closed</span>
            </h3>
            <p className="text-xs font-bold text-slate-400 mb-6">
              This will block any sales submissions and allocations for {selectedDest?.name} on {saleDate}.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Reason for closure
                </label>
                <input
                  type="text"
                  value={closedReason}
                  onChange={(e) => setClosedReason(e.target.value)}
                  placeholder="e.g. Public Holiday, Maintenance..."
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold outline-none dark:bg-slate-800 dark:border-slate-800"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsClosedModalOpen(false)}
                  className="flex-1 rounded-2xl border border-slate-100 py-3 text-xs font-black text-slate-400 hover:bg-slate-50 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMarkClosed}
                  disabled={isSubmitting}
                  className="flex-1 rounded-2xl bg-rose-600 py-3 text-xs font-black text-white hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-none"
                >
                  Confirm Closed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
