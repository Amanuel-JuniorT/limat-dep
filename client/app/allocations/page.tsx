"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  Plus,
  Loader2,
  Store,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ArrowRightLeft,
  Building,
  History,
  Boxes,
  ChevronDown,
  ChevronUp,
  X,
  TrendingDown,
  TrendingUp,
  Check,
  Calendar,
  User,
  Pencil,
  Trash2,
} from "lucide-react";
import api from "@/lib/api";
import { Item, StockDestination, Allocation } from "@/types/pos";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface DestinationBalanceItem {
  itemId: number;
  item?: { id: number; name: string; sku?: string };
  currentStock: number;
}

interface DestinationBalanceGroup {
  destination: StockDestination;
  items: DestinationBalanceItem[];
}

type Tab = "transfer" | "balances" | "history";

export default function StockAllocationsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("transfer");

  const [destinations, setDestinations] = useState<StockDestination[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [destinationBalances, setDestinationBalances] = useState<DestinationBalanceGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // New Destination Modal
  const [isDestModalOpen, setIsDestModalOpen] = useState(false);
  const [destName, setDestName] = useState("");
  const [destType, setDestType] = useState<"SHOP" | "EVENT_WINDOW">("SHOP");
  const [destNotes, setDestNotes] = useState("");
  const [destSpinPrice, setDestSpinPrice] = useState<string>("30");

  // End Event Window & Return Stock Modal
  const [endEventDest, setEndEventDest] = useState<StockDestination | null>(null);
  const [endEventReturnItems, setEndEventReturnItems] = useState<
    { itemId: number; itemName: string; currentStock: number; returnQty: string }[]
  >([]);

  // Edit Destination Modal
  const [editDest, setEditDest] = useState<StockDestination | null>(null);
  const [editDestName, setEditDestName] = useState("");
  const [editDestType, setEditDestType] = useState<"SHOP" | "EVENT_WINDOW">("SHOP");
  const [editDestNotes, setEditDestNotes] = useState("");
  const [editDestActive, setEditDestActive] = useState(true);
  const [editDestSpinPrice, setEditDestSpinPrice] = useState<string>("30");

  // New Allocation Form
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>("");
  const [allocSpinPrice, setAllocSpinPrice] = useState<string>("30");
  const [notes, setNotes] = useState("");

  // Items to allocate / return
  const [allocationItems, setAllocationItems] = useState<
    Array<{ itemId: number; quantity: number; name: string }>
  >([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState<string>("1");

  // Expanded History Rows
  const [expandedAllocId, setExpandedAllocId] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManage = user?.role === "ADMIN" || user?.role === "STOCK";

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [destsRes, itemsRes, allocsRes, balancesRes] = await Promise.all([
        api.get("/destinations"),
        api.get("/items"),
        api.get("/allocations"),
        api.get("/allocations/balances"),
      ]);
      const fetchedDests = destsRes.data || [];
      setDestinations(fetchedDests);
      setItems(itemsRes.data || []);
      setAllocations(allocsRes.data || []);
      setDestinationBalances(balancesRes.data || []);

      if (fetchedDests.length > 0 && !selectedDestinationId) {
        setSelectedDestinationId(fetchedDests[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to fetch allocation data", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDestinationId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const selectedDest = destinations.find((d) => d.id.toString() === selectedDestinationId);

  useEffect(() => {
    if (selectedDest && selectedDest.type === "EVENT_WINDOW") {
      setAllocSpinPrice((selectedDest.spinPrice ?? 30).toString());
    }
  }, [selectedDestinationId, selectedDest?.spinPrice]);

  const handleCreateDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destName.trim()) return;

    setIsSubmitting(true);
    try {
      await api.post("/destinations", {
        name: destName.trim(),
        type: destType,
        notes: destNotes.trim() || undefined,
        spinPrice: destType === "EVENT_WINDOW" ? (parseFloat(destSpinPrice) || 30) : undefined,
      });
      setDestName("");
      setDestNotes("");
      setDestSpinPrice("30");
      setIsDestModalOpen(false);
      setSuccess("New destination added successfully!");
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create destination");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddItem = () => {
    if (!selectedItemId) return;
    const itemObj = items.find((i) => i.id.toString() === selectedItemId);
    if (!itemObj) return;

    const qty = parseInt(itemQuantity, 10) || 1;

    setAllocationItems((prev) => {
      const existing = prev.find((i) => i.itemId === itemObj.id);
      if (existing) {
        return prev.map((i) =>
          i.itemId === itemObj.id ? { ...i, quantity: i.quantity + qty } : i,
        );
      }
      return [...prev, { itemId: itemObj.id, quantity: qty, name: itemObj.name }];
    });

    setSelectedItemId("");
    setItemQuantity("1");
  };

  const handleRemoveItem = (itemId: number) => {
    setAllocationItems((prev) => prev.filter((i) => i.itemId !== itemId));
  };

  const handleSubmitAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allocationItems.length === 0) {
      setError("Please add at least one item to allocate/return");
      return;
    }
    if (!selectedDestinationId) {
      setError("Please select a destination");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const endpoint = isReturnMode ? "/allocations/return" : "/allocations";

    try {
      await api.post(endpoint, {
        destinationId: parseInt(selectedDestinationId, 10),
        items: allocationItems.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
        })),
        notes: notes.trim() || undefined,
        spinPrice: !isReturnMode && selectedDest?.type === "EVENT_WINDOW" ? (parseFloat(allocSpinPrice) || 30) : undefined,
      });

      setSuccess(
        isReturnMode
          ? "Successfully returned items to warehouse!"
          : "Successfully allocated items from warehouse!",
      );
      setAllocationItems([]);
      setNotes("");

      fetchInitialData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to process allocation");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open End Event Modal with current allocated stock pre-filled
  const openEndEventModal = (dest: StockDestination) => {
    const group = destinationBalances.find((b) => b.destination?.id === dest.id);
    const allocatedItems = group
      ? group.items.map((i) => ({
          itemId: i.itemId,
          itemName: i.item?.name || `Item #${i.itemId}`,
          currentStock: i.currentStock,
          returnQty: i.currentStock > 0 ? i.currentStock.toString() : "0",
        }))
      : [];

    setEndEventDest(dest);
    setEndEventReturnItems(allocatedItems);
  };

  const handleConfirmEndEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endEventDest) return;

    setIsSubmitting(true);
    try {
      const itemsToReturn = endEventReturnItems
        .map((i) => ({ itemId: i.itemId, quantity: parseInt(i.returnQty, 10) || 0 }))
        .filter((i) => i.quantity > 0);

      if (itemsToReturn.length > 0) {
        await api.post("/allocations/return", {
          destinationId: endEventDest.id,
          items: itemsToReturn,
          notes: `Automatic stock return upon ending event window: ${endEventDest.name}`,
        });
      }

      await api.patch(`/destinations/${endEventDest.id}`, {
        isActive: false,
      });

      setEndEventDest(null);
      setSuccess(`Event Window "${endEventDest.name}" ended and stock returned to warehouse!`);
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to end event window");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDestinationStatus = async (
    destId: number,
    currentActive: boolean,
  ) => {
    const actionName = currentActive
      ? "End / Deactivate Destination"
      : "Reactivate Destination";
    if (!confirm(`Are you sure you want to ${actionName}?`)) return;

    try {
      await api.patch(`/destinations/${destId}`, {
        isActive: !currentActive,
      });
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update destination status");
    }
  };

  const openEditModal = (dest: StockDestination) => {
    setEditDest(dest);
    setEditDestName(dest.name);
    setEditDestType(dest.type as "SHOP" | "EVENT_WINDOW");
    setEditDestNotes(dest.notes || "");
    setEditDestActive(dest.isActive);
    setEditDestSpinPrice((dest.spinPrice ?? 30).toString());
  };

  const handleEditDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDest || !editDestName.trim()) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/destinations/${editDest.id}`, {
        name: editDestName.trim(),
        type: editDestType,
        notes: editDestNotes.trim() || undefined,
        isActive: editDestActive,
        spinPrice: editDestType === "EVENT_WINDOW" ? (parseFloat(editDestSpinPrice) || 30) : undefined,
      });
      setEditDest(null);
      setSuccess("Destination updated successfully!");
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update destination");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDestination = async (dest: StockDestination) => {
    if (!confirm(`Delete "${dest.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/destinations/${dest.id}`);
      setSuccess(`"${dest.name}" deleted successfully.`);
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete destination");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-zinc-50 overflow-x-hidden">
      <div className="mx-auto max-w-xl px-6 py-8 pb-16">
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
                Stock <span className="text-emerald-600">Allocation</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Warehouse Transfers & Active Balances
              </p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => setIsDestModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
            >
              <Plus className="h-4 w-4" /> Add Location
            </button>
          )}
        </header>

        {/* Top Navigation Tabs */}
        <div className="flex rounded-2xl bg-white dark:bg-slate-900 p-1.5 shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
          {[
            { key: "transfer", label: "Stock Transfer", icon: ArrowRightLeft },
            { key: "balances", label: "Balances & Dests", icon: Boxes },
            { key: "history", label: "History", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as Tab)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black transition-all min-w-0",
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-none"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

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

        {/* ── Tab 1: Stock Transfer ────────────────────────────────────────── */}
        {activeTab === "transfer" && (
          <div className="bento-card p-6 bg-white dark:bg-slate-900 border-none shadow-sm mb-8">
            {/* Transfer Direction Segmented Toggle */}
            <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 mb-6">
              <button
                type="button"
                onClick={() => setIsReturnMode(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all",
                  !isReturnMode
                    ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Allocate to Location
              </button>
              <button
                type="button"
                onClick={() => setIsReturnMode(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all",
                  isReturnMode
                    ? "bg-white text-amber-700 shadow-sm dark:bg-slate-900 dark:text-amber-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                <TrendingDown className="h-4 w-4 text-amber-600" />
                Return to Warehouse
              </button>
            </div>

            <form onSubmit={handleSubmitAllocation} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Target Location (Shop / Event Window)
                </label>
                <select
                  value={selectedDestinationId}
                  onChange={(e) => setSelectedDestinationId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.type === "SHOP" ? "🏪" : "🎪"} {d.name} {!d.isActive ? "(Ended)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Spin Price configuration for Event Window destinations */}
              {!isReturnMode && selectedDest && selectedDest.type === "EVENT_WINDOW" && (
                <div className="space-y-1.5 rounded-2xl bg-amber-500/5 p-4 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      🎡 Event Spin Price (ETB per Spin)
                    </label>
                    {!selectedDest.isActive && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md">
                        Reopening Event
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={allocSpinPrice}
                    onChange={(e) => setAllocSpinPrice(e.target.value)}
                    placeholder="Spin price (e.g. 30)"
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {!selectedDest.isActive
                      ? "Allocating items will automatically reopen this event window with this spin price."
                      : "Confirm or update the active spin price for this event."}
                  </p>
                </div>
              )}

              {/* Add Items */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Select Items to {isReturnMode ? "Return" : "Allocate"}
                </p>
                <div className="flex gap-2">
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="flex-1 min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  >
                    <option value="">Choose product...</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} (Warehouse: {i.warehouseStock})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    className="w-20 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-black text-center outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 dark:bg-white/5 dark:border-slate-800"
                  />

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="rounded-2xl bg-emerald-600 text-white px-4 font-black flex items-center justify-center hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Added list */}
              {allocationItems.length > 0 && (
                <div className="space-y-2 pt-2">
                  {allocationItems.map((item) => (
                    <div
                      key={item.itemId}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                    >
                      <div>
                        <p className="text-xs font-bold">{item.name}</p>
                        <p className="text-[10px] font-bold text-emerald-600">
                          Transfer Qty: {item.quantity} units
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.itemId)}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Notes / Reference
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Initial stock allocation for event..."
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 dark:bg-white/5 dark:border-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || destinations.length === 0}
                className="w-full rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-xl shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 dark:shadow-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {isReturnMode ? "Confirm Stock Return" : "Confirm Stock Allocation"}
                    <ArrowRightLeft className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── Tab 2: Balances & Destinations ───────────────────────────────── */}
        {activeTab === "balances" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {destinations.length} active stock location{destinations.length !== 1 ? "s" : ""}
              </p>
              {canManage && (
                <button
                  onClick={() => setIsDestModalOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg"
                >
                  <Plus className="h-3 w-3" />
                  Add Location
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              </div>
            ) : destinations.length === 0 ? (
              <div className="bento-card p-10 text-center bg-white dark:bg-slate-900">
                <Store className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-400">No destinations created yet</p>
              </div>
            ) : (
              destinations.map((dest) => {
                const group = destinationBalances.find((b) => b.destination?.id === dest.id);
                const itemsAllocated = group ? group.items : [];
                const totalStock = itemsAllocated.reduce((sum, i) => sum + i.currentStock, 0);

                return (
                  <div key={dest.id} className="bento-card bg-white dark:bg-slate-900 p-5 space-y-4 border-none shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex-shrink-0">
                          {dest.type === "SHOP" ? <Store className="h-5 w-5" /> : <Building className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black tracking-tight">{dest.name}</h3>
                            <span
                              className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                dest.isActive
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"
                                  : "bg-slate-100 text-slate-400 dark:bg-slate-800",
                              )}
                            >
                              {dest.type} · {dest.isActive ? "ACTIVE" : "ENDED"}
                            </span>
                          </div>
                          {dest.notes && (
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{dest.notes}</p>
                          )}
                          {dest.type === "EVENT_WINDOW" && (
                            <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 mt-0.5 flex items-center gap-1">
                              🎡 {(dest.spinPrice ?? 30).toLocaleString()} ETB / spin
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-600 tabular-nums">
                          {totalStock} units
                        </span>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          Allocated Stock
                        </p>
                      </div>
                    </div>

                    {/* Breakdown of items */}
                    <div className="rounded-2xl bg-slate-50/50 dark:bg-white/5 p-3 space-y-2 border border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Allocated Products Breakdown
                      </p>
                      {itemsAllocated.length === 0 ? (
                        <p className="text-xs font-bold text-slate-400 italic">No active stock allocated</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {itemsAllocated.map((i) => (
                            <div key={i.itemId} className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-xl text-xs">
                              <span className="font-bold truncate max-w-[120px]">{i.item?.name || `Item #${i.itemId}`}</span>
                              <span className="font-black text-emerald-600 tabular-nums">{i.currentStock}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Controls */}
                    {canManage && (
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <button
                          onClick={() => {
                            setSelectedDestinationId(dest.id.toString());
                            setIsReturnMode(false);
                            setActiveTab("transfer");
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Allocate More
                        </button>

                        {dest.type === "EVENT_WINDOW" && dest.isActive && (
                          <button
                            onClick={() => openEndEventModal(dest)}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            End Event & Return Stock
                          </button>
                        )}

                        {/* Edit & Delete */}
                        <button
                          onClick={() => openEditModal(dest)}
                          className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDestination(dest)}
                          className="py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-xs font-black flex items-center justify-center gap-1.5 transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab 3: Allocation History ────────────────────────────────────── */}
        {activeTab === "history" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {allocations.length} transaction{allocations.length !== 1 ? "s" : ""} logged
              </p>
            </div>

            {allocations.length === 0 ? (
              <div className="bento-card p-10 text-center bg-white dark:bg-slate-900">
                <History className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-400">No stock allocations logged yet</p>
              </div>
            ) : (
              allocations.map((a) => {
                const isExpanded = expandedAllocId === a.id;
                return (
                  <div key={a.id} className="bento-card bg-white dark:bg-slate-900 border-none shadow-sm overflow-hidden">
                    <button
                      className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left"
                      onClick={() => setExpandedAllocId(isExpanded ? null : a.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0",
                            a.isReturn
                              ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
                              : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600",
                          )}
                        >
                          {a.isReturn ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black tracking-tight">{a.destination?.name}</span>
                            <span
                              className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                a.isReturn
                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20"
                                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20",
                              )}
                            >
                              {a.isReturn ? "RETURN" : "ALLOCATION"}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {new Date(a.date).toLocaleDateString()} · {a.items?.length || 0} items transferred
                            {a.user && ` · By ${a.user.name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-slate-50 dark:border-slate-800 pt-4 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transferred Items</p>
                        {a.items?.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0 text-xs">
                            <span className="font-bold">{item.item?.name}</span>
                            <span className="font-black text-emerald-600 tabular-nums">{item.quantity} units</span>
                          </div>
                        ))}
                        {a.notes && (
                          <p className="text-[10px] text-slate-400 italic mt-2">
                            Notes: {a.notes}
                          </p>
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

      {/* Modal: Add New Destination */}
      {isDestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bento-card p-6 bg-white dark:bg-slate-900 shadow-2xl">
            <h3 className="text-lg font-black tracking-tight mb-4">
              Add New <span className="text-emerald-600">Location</span>
            </h3>

            <form onSubmit={handleCreateDestination} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Location Name
                </label>
                <input
                  required
                  type="text"
                  value={destName}
                  onChange={(e) => setDestName(e.target.value)}
                  placeholder="e.g. Shop Window 2, Event Stand A..."
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold outline-none dark:bg-slate-800 dark:border-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Location Type
                </label>
                <select
                  value={destType}
                  onChange={(e) => setDestType(e.target.value as any)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold outline-none dark:bg-slate-800 dark:border-slate-800"
                >
                  <option value="SHOP">Permanent Shop</option>
                  <option value="EVENT_WINDOW">Event Window / Stand</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={destNotes}
                  onChange={(e) => setDestNotes(e.target.value)}
                  placeholder="e.g. Located near main hall..."
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold outline-none dark:bg-slate-800 dark:border-slate-800"
                />
              </div>

              {/* Spin Price — only for event windows */}
              {destType === "EVENT_WINDOW" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Price Per Spin (ETB)
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 dark:bg-slate-800 dark:border-slate-800">
                    <span className="text-xs font-black text-slate-400">ETB</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={destSpinPrice}
                      onChange={(e) => setDestSpinPrice(e.target.value)}
                      className="flex-1 bg-transparent py-4 text-sm font-black outline-none text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1">Default is 30 ETB per spin</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDestModalOpen(false)}
                  className="flex-1 rounded-2xl border border-slate-100 py-3 text-xs font-black text-slate-400 hover:bg-slate-50 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: End Event Window & Return Stock */}
      {endEventDest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bento-card p-6 bg-white dark:bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black tracking-tight text-amber-600">
                  End Event & Return Stock
                </h3>
                <p className="text-xs font-bold text-slate-400">{endEventDest.name}</p>
              </div>
              <button
                onClick={() => setEndEventDest(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmEndEvent} className="space-y-4">
              <p className="text-xs font-bold text-slate-500">
                Confirm stock to return to main warehouse before closing this event window:
              </p>

              <div className="space-y-3">
                {endEventReturnItems.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 italic">No active stock allocated to return.</p>
                ) : (
                  endEventReturnItems.map((item, idx) => (
                    <div key={item.itemId} className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold">{item.itemName}</p>
                        <p className="text-[10px] font-bold text-emerald-600">Active Qty: {item.currentStock}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[9px] font-black uppercase text-slate-400">Return:</label>
                        <input
                          type="number"
                          min="0"
                          max={item.currentStock}
                          value={item.returnQty}
                          onChange={(e) => {
                            const copy = [...endEventReturnItems];
                            copy[idx].returnQty = e.target.value;
                            setEndEventReturnItems(copy);
                          }}
                          className="w-16 rounded-xl border border-slate-200 p-2 text-xs font-black text-center outline-none"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEndEventDest(null)}
                  className="flex-1 rounded-2xl border border-slate-100 py-3 text-xs font-black text-slate-400 hover:bg-slate-50 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] rounded-2xl bg-amber-600 py-3 text-xs font-black text-white hover:bg-amber-700 shadow-lg shadow-amber-200 dark:shadow-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirm Return & Close Event"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Destination */}
      {editDest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bento-card p-6 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black tracking-tight">
                Edit <span className="text-emerald-600">Location</span>
              </h3>
              <button
                onClick={() => setEditDest(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditDestination} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Location Name
                </label>
                <input
                  required
                  type="text"
                  value={editDestName}
                  onChange={(e) => setEditDestName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 dark:bg-slate-800 dark:border-slate-800"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Location Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["SHOP", "EVENT_WINDOW"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditDestType(t)}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-black transition-all",
                        editDestType === t
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none"
                          : "bg-slate-50 border-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700",
                      )}
                    >
                      {t === "SHOP" ? <Store className="h-3.5 w-3.5" /> : <Building className="h-3.5 w-3.5" />}
                      {t === "SHOP" ? "Shop" : "Event"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editDestNotes}
                  onChange={(e) => setEditDestNotes(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 dark:bg-slate-800 dark:border-slate-800"
                />
              </div>

              {/* Spin Price — only for event windows */}
              {editDestType === "EVENT_WINDOW" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Price Per Spin (ETB)
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 dark:bg-slate-800 dark:border-slate-800">
                    <span className="text-xs font-black text-slate-400">ETB</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={editDestSpinPrice}
                      onChange={(e) => setEditDestSpinPrice(e.target.value)}
                      className="flex-1 bg-transparent py-4 text-sm font-black outline-none text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1">This price applies to all future spin reports for this event</p>
                </div>
              )}

              {/* Status toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">Status: Active</span>
                <button
                  type="button"
                  onClick={() => setEditDestActive((v) => !v)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    editDestActive ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                      editDestActive ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditDest(null)}
                  className="flex-1 rounded-2xl border border-slate-100 py-3 text-xs font-black text-slate-400 hover:bg-slate-50 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
