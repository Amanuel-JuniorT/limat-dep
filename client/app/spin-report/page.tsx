"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  RotateCw,
  ArrowLeft,
  Plus,
  Loader2,
  Calendar,
  Gift,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Award,
  Store,
  History,
  Ban,
  ShoppingBag,
  Send,
} from "lucide-react";
import api from "@/lib/api";
import { Item, StockDestination, ClosedDate } from "@/types/pos";
import { cn } from "@/lib/utils";

interface SingleEventRecord {
  tempId: string;
  type: "SPIN" | "SALE";
  itemId?: number;
  itemName?: string;
  spinIndex?: number;
  spinCount: number;
  quantity: number;
  unitPrice: number;
  paymentMethod: "CASH" | "TELEBIRR" | "CBE";
  tipAmount: number;
  notes?: string;
}

interface SpinSlot {
  spinIndex: number;
  selectedItemId: string;
  quantity: string;
}

export default function SpinReportPage() {
  const [destinations, setDestinations] = useState<StockDestination[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Header State
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>("");
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Record Entry Form State
  const [recordType, setRecordType] = useState<"SPIN" | "SALE">("SPIN");
  const [spinCountInput, setSpinCountInput] = useState<string>("1");

  // Per-spin result slots state (for when spin count >= 1)
  const [spinSlots, setSpinSlots] = useState<SpinSlot[]>([
    { spinIndex: 1, selectedItemId: "", quantity: "1" },
  ]);

  // SALE type state
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState<string>("1");

  // Common payment & tip
  const [itemPaymentMethod, setItemPaymentMethod] = useState<"CASH" | "TELEBIRR" | "CBE">("CASH");
  const [itemTipAmount, setItemTipAmount] = useState<string>("0");
  const [itemNotes, setItemNotes] = useState<string>("");

  // List of distinct individual event records ready for batch submission
  const [eventRecords, setEventRecords] = useState<SingleEventRecord[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Closed date modal
  const [isClosedModalOpen, setIsClosedModalOpen] = useState(false);
  const [closedReason, setClosedReason] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Update spin slots array whenever spinCountInput changes
  const handleSpinCountChange = (val: string) => {
    setSpinCountInput(val);
    const count = Math.max(1, Math.min(20, parseInt(val, 10) || 1));
    setSpinSlots((prev) => {
      const next: SpinSlot[] = [];
      for (let i = 1; i <= count; i++) {
        const existing = prev.find((s) => s.spinIndex === i);
        next.push(
          existing || { spinIndex: i, selectedItemId: "", quantity: "1" },
        );
      }
      return next;
    });
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [destsRes, itemsRes, closedRes] = await Promise.all([
        api.get("/destinations/active"),
        api.get("/items"),
        api.get("/closed-dates"),
      ]);

      const eventDests = (destsRes.data || []).filter(
        (d: StockDestination) => d.type === "EVENT_WINDOW",
      );
      setDestinations(eventDests);
      setItems(itemsRes.data || []);
      setClosedDates(closedRes.data || []);

      if (eventDests.length > 0) {
        setSelectedDestinationId(eventDests[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to load spin report initial data", err);
    } finally {
      setLoading(false);
    }
  };

  const noActiveEventOpened = destinations.length === 0 || !selectedDestinationId;

  const isSelectedDateClosed = closedDates.some(
    (c) =>
      c.destinationId.toString() === selectedDestinationId &&
      c.date.startsWith(reportDate),
  );
  const closedRecord = closedDates.find(
    (c) =>
      c.destinationId.toString() === selectedDestinationId &&
      c.date.startsWith(reportDate),
  );

  const isFormDisabled = noActiveEventOpened || isSelectedDateClosed;

  const handleAddRecordToList = () => {
    setError(null);

    if (recordType === "SPIN") {
      const totalSpins = spinSlots.length;
      const tipPerSpin = (parseFloat(itemTipAmount) || 0) / (totalSpins || 1);

      const newSpinRecords: SingleEventRecord[] = spinSlots.map((slot) => {
        let itemObj: Item | undefined = undefined;
        if (slot.selectedItemId) {
          itemObj = items.find((i) => i.id.toString() === slot.selectedItemId);
        }

        const rewardQty = itemObj ? parseInt(slot.quantity, 10) || 1 : 0;

        return {
          tempId: Date.now().toString() + Math.random().toString(),
          type: "SPIN",
          itemId: itemObj?.id,
          itemName: itemObj?.name,
          spinIndex: totalSpins > 1 ? slot.spinIndex : undefined,
          spinCount: 1, // each spin is recorded distinct
          quantity: rewardQty,
          unitPrice: 30, // 30 ETB per spin
          paymentMethod: itemPaymentMethod,
          tipAmount: Math.max(0, tipPerSpin),
          notes: itemNotes.trim() || undefined,
        };
      });

      setEventRecords((prev) => [...prev, ...newSpinRecords]);

      // Reset spin slots
      setSpinCountInput("1");
      setSpinSlots([{ spinIndex: 1, selectedItemId: "", quantity: "1" }]);
    } else {
      // SALE type
      if (!selectedItemId) {
        setError("Please select an item for direct event sale");
        return;
      }
      const itemObj = items.find((i) => i.id.toString() === selectedItemId);
      if (!itemObj) return;

      const qty = parseInt(itemQuantity, 10) || 1;

      const newRecord: SingleEventRecord = {
        tempId: Date.now().toString() + Math.random().toString(),
        type: "SALE",
        itemId: itemObj.id,
        itemName: itemObj.name,
        spinCount: 0,
        quantity: qty,
        unitPrice: Number(itemObj.sellingPrice || 0),
        paymentMethod: itemPaymentMethod,
        tipAmount: Math.max(0, parseFloat(itemTipAmount) || 0),
        notes: itemNotes.trim() || undefined,
      };

      setEventRecords((prev) => [...prev, newRecord]);

      setSelectedItemId("");
      setItemQuantity("1");
    }

    // Reset common inputs
    setItemTipAmount("0");
    setItemNotes("");
  };

  const handleRemoveRecord = (tempId: string) => {
    setEventRecords((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (noActiveEventOpened) {
      setError("No active Event Window destination selected.");
      return;
    }

    if (eventRecords.length === 0) {
      setError("Please add at least one spin or sale record before submitting.");
      return;
    }

    if (isSelectedDateClosed) {
      setError("This destination is marked as CLOSED for the selected date.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const destinationId = parseInt(selectedDestinationId, 10);

      await api.post("/spin-reports", {
        destinationId,
        reportDate,
        items: eventRecords.map((r) => ({
          type: r.type,
          itemId: r.itemId,
          spinCount: r.spinCount,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          paymentMethod: r.paymentMethod,
          tipAmount: r.tipAmount,
          notes: r.notes,
        })),
      });

      setSuccess(
        `Successfully recorded Event Report containing ${eventRecords.length} distinct record(s)!`,
      );
      setEventRecords([]);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to submit event wheel report",
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
        date: reportDate,
        reason: closedReason.trim() || "Event Closed",
      });
      setSuccess("Marked event date as closed.");
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
    if (!confirm("Are you sure you want to reopen/unclose this event date?")) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/closed-dates/${closedId}`);
      setSuccess("Event date reopened successfully.");
      const closedRes = await api.get("/closed-dates");
      setClosedDates(closedRes.data || []);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to reopen date");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grand totals calculation
  const grandSubtotal = eventRecords.reduce(
    (acc, r) =>
      acc + (r.type === "SPIN" ? r.spinCount * 30 : r.quantity * r.unitPrice),
    0,
  );
  const grandTips = eventRecords.reduce((acc, r) => acc + r.tipAmount, 0);
  const grandTotal = grandSubtotal + grandTips;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-zinc-50 overflow-x-hidden">
      <div className="mx-auto max-w-lg px-6 py-8 pb-16">
        {/* Header */}
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
                Event Wheel <span className="text-indigo-600">Report</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Spins & Direct Sales Entry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/spin-report/history"
              className="flex h-10 px-3.5 items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900 font-bold text-xs hover:bg-indigo-100 transition-all"
            >
              <History className="h-4 w-4" />
              History
            </Link>

            {selectedDestinationId && (
              <button
                type="button"
                onClick={() => setIsClosedModalOpen(true)}
                className="flex h-10 px-3 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900 font-bold text-xs hover:bg-rose-100 transition-all"
                title="Mark Closed Date"
              >
                <Ban className="h-4 w-4" />
                Mark Closed
              </button>
            )}
          </div>
        </header>

        {/* Warning Banner 1: No Active Event Window Destination */}
        {noActiveEventOpened && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-black">No Active Event Window Destination</p>
              <p className="text-[10px] opacity-80 mt-0.5">
                No active Event Window destinations are currently open. Please add or activate an Event Window in Destinations/Allocations before submitting wheel reports.
              </p>
            </div>
          </div>
        )}

        {/* Warning Banner 2: Closed Date */}
        {!noActiveEventOpened && isSelectedDateClosed && closedRecord && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 shrink-0 text-rose-500" />
              <div>
                <p className="font-black">Event Destination Closed</p>
                <p className="text-[10px] opacity-80">
                  Marked closed for {reportDate} ({closedRecord.reason || "No reason specified"})
                </p>
              </div>
            </div>
            <button
              onClick={() => handleUncloseDate(closedRecord.id)}
              className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider hover:bg-rose-700 transition-all shadow-sm"
            >
              Unclose Day
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmitBatch} className="space-y-6">
          {/* Header Controls */}
          <div className="bento-card p-6 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                Event Window Destination
              </label>
              <select
                value={selectedDestinationId}
                onChange={(e) => setSelectedDestinationId(e.target.value)}
                disabled={isFormDisabled || destinations.length === 0}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all dark:bg-slate-800 dark:border-slate-700"
              >
                {destinations.length === 0 ? (
                  <option value="">No Active Event Destinations</option>
                ) : (
                  destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (EVENT)
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                Event Date
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                disabled={isFormDisabled}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Record Entry Form */}
          <div
            className={cn(
              "bento-card p-6 bg-white dark:bg-slate-900 shadow-sm space-y-4 border-l-4 border-indigo-600 transition-opacity",
              isFormDisabled && "opacity-50 pointer-events-none",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                + Record Entry (Spin or Event Sale)
              </h3>

              {/* Record Type Selector */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRecordType("SPIN")}
                  disabled={isFormDisabled}
                  className={cn(
                    "px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all",
                    recordType === "SPIN"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  🎰 Spin
                </button>
                <button
                  type="button"
                  onClick={() => setRecordType("SALE")}
                  disabled={isFormDisabled}
                  className={cn(
                    "px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all",
                    recordType === "SALE"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  🛒 Direct Sale
                </button>
              </div>
            </div>

            {recordType === "SPIN" ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Number of Spins (@ 30 ETB per spin)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={spinCountInput}
                    onChange={(e) => handleSpinCountChange(e.target.value)}
                    disabled={isFormDisabled}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold outline-none"
                  />
                </div>

                {/* Individual Spin Result Slots */}
                <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                    Record Result for Each Spin Count ({spinSlots.length} Spin{spinSlots.length > 1 ? "s" : ""})
                  </span>

                  {spinSlots.map((slot, idx) => (
                    <div
                      key={slot.spinIndex}
                      className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-200">
                        <span>Spin #{slot.spinIndex} Result</span>
                        <span className="text-[10px] font-bold text-indigo-600">30 ETB</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">
                            Reward Item Won
                          </label>
                          <select
                            value={slot.selectedItemId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSpinSlots((prev) =>
                                prev.map((s) =>
                                  s.spinIndex === slot.spinIndex
                                    ? { ...s, selectedItemId: val }
                                    : s,
                                ),
                              );
                            }}
                            disabled={isFormDisabled}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold outline-none"
                          >
                            <option value="">No Item Won</option>
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {slot.selectedItemId && (
                          <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">
                              Reward Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={slot.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSpinSlots((prev) =>
                                  prev.map((s) =>
                                    s.spinIndex === slot.spinIndex
                                      ? { ...s, quantity: val }
                                      : s,
                                  ),
                                );
                              }}
                              disabled={isFormDisabled}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* SALE type */
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Direct Sale Item
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    disabled={isFormDisabled}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold outline-none"
                  >
                    <option value="">Choose Item...</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.sellingPrice} ETB)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Sale Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    disabled={isFormDisabled}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold outline-none"
                  />
                </div>
              </div>
            )}

            {/* Payment channel & tip */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Payment Channel
                </label>
                <select
                  value={itemPaymentMethod}
                  onChange={(e) =>
                    setItemPaymentMethod(
                      e.target.value as "CASH" | "TELEBIRR" | "CBE",
                    )
                  }
                  disabled={isFormDisabled}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-xs font-bold outline-none"
                >
                  <option value="CASH">Cash</option>
                  <option value="TELEBIRR">Telebirr</option>
                  <option value="CBE">CBE</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Tip for this Record (ETB)
                </label>
                <input
                  type="number"
                  min="0"
                  value={itemTipAmount}
                  onChange={(e) => setItemTipAmount(e.target.value)}
                  disabled={isFormDisabled}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-sm font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Notes for this Record (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Winner name, special discount..."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                disabled={isFormDisabled}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-3.5 px-4 text-xs font-bold outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAddRecordToList}
              disabled={isFormDisabled}
              className="w-full rounded-2xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-800 py-3.5 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Record(s) to Event Batch
            </button>
          </div>

          {/* Event Batch Records Ready to Submit */}
          {eventRecords.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Event Records Ready to Submit ({eventRecords.length})
              </h3>

              <div className="space-y-2">
                {eventRecords.map((r, idx) => (
                  <div
                    key={r.tempId}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black">
                          #{idx + 1}{" "}
                          {r.type === "SPIN"
                            ? `🎰 Spin ${r.spinIndex ? `#${r.spinIndex}` : ""} (30 ETB)`
                            : `🛒 Sale (${r.itemName})`}
                        </span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 rounded-full">
                          {r.paymentMethod}
                        </span>
                      </div>

                      {r.type === "SPIN" && r.itemName && (
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                          🎁 Won Reward: {r.quantity} × {r.itemName}
                        </p>
                      )}

                      {r.type === "SPIN" && !r.itemName && (
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                          No item won
                        </p>
                      )}

                      {r.type === "SALE" && (
                        <p className="text-[10px] font-bold text-slate-500 mt-1">
                          Qty: {r.quantity} × {r.unitPrice} ETB
                        </p>
                      )}

                      {r.tipAmount > 0 && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                          💡 Tip: +{r.tipAmount.toFixed(1)} ETB
                        </p>
                      )}

                      {r.notes && (
                        <p className="text-[10px] italic text-slate-400 mt-0.5">
                          "{r.notes}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-indigo-600">
                        {(r.type === "SPIN"
                          ? r.spinCount * 30
                          : r.quantity * r.unitPrice) + r.tipAmount}{" "}
                        ETB
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveRecord(r.tempId)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grand Total Summary */}
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-between font-black text-sm">
                <span>Grand Total ({eventRecords.length} records):</span>
                <span className="text-indigo-600 text-lg tabular-nums">
                  {grandTotal.toFixed(0)} ETB
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isFormDisabled}
                className="w-full rounded-2xl bg-indigo-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit All {eventRecords.length} Event Record(s)
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Closed Date Modal */}
      {isClosedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bento-card p-6 bg-white dark:bg-slate-900 shadow-2xl space-y-4">
            <h3 className="text-base font-black tracking-tight text-rose-600">
              Mark Event Destination Closed
            </h3>
            <p className="text-xs text-slate-500">
              Date: <span className="font-bold text-slate-900 dark:text-zinc-100">{reportDate}</span>
            </p>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Reason (Optional)
              </label>
              <input
                type="text"
                value={closedReason}
                onChange={(e) => setClosedReason(e.target.value)}
                placeholder="e.g. Bad weather, venue closed..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs font-bold outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleMarkClosed}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-rose-700 transition-all"
              >
                Confirm Closed
              </button>
              <button
                type="button"
                onClick={() => setIsClosedModalOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
