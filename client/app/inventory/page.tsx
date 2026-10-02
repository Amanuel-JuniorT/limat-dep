"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  Search,
  Plus,
  Loader2,
  Activity,
  Printer,
  TrendingUp,
  History,
  ChevronDown,
  ChevronUp,
  Tag,
  RefreshCw,
  Info,
  CheckCircle2,
  Edit3,
} from "lucide-react";
import api from "@/lib/api";
import { Item } from "@/types/pos";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PriceHistoryEntry {
  id: number;
  itemId: number;
  item?: { id: number; name: string; sku?: string };
  costPrice: number;
  sellingPrice: number;
  effectiveFrom: string;
  notes?: string;
  createdAt: string;
  user: { id: number; name: string; role: string };
  purchase?: { id: number; supplierName?: string; invoiceNumber?: string; createdAt: string } | null;
}

interface PurchaseRecord {
  id: number;
  supplierName?: string;
  invoiceNumber?: string;
  totalCost: number;
  createdAt: string;
  user: { id: number; name: string; role: string };
  items: {
    id: number;
    quantity: number;
    unitCost: number;
    subtotal: number;
    item: { id: number; name: string; sku?: string };
  }[];
  priceHistory: PriceHistoryEntry[];
}

interface IntakeItemRow {
  itemId: number;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
  effectiveFrom: string;
  priceNote: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateStr = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const todayIso = () => new Date().toISOString().split("T")[0];

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "catalog" | "history" | "prices";

export default function InventoryPage() {
  const { user } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("catalog");

  // Edit/Create Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    sellingPrice: "",
    costPrice: "",
    description: "",
    initialQuantity: "0",
  });

  // Stock Intake Modal (multi-row)
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [intakeGlobal, setIntakeGlobal] = useState({
    supplierName: "",
    invoiceNumber: "",
  });
  const [intakeRows, setIntakeRows] = useState<IntakeItemRow[]>([]);

  // Intake History
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedPurchase, setExpandedPurchase] = useState<number | null>(null);

  // Price History
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [selectedPriceItem, setSelectedPriceItem] = useState<number | "all">("all");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Intake Batch Modal
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
  const [editIntakeSupplier, setEditIntakeSupplier] = useState("");
  const [editIntakeInvoice, setEditIntakeInvoice] = useState("");
  const [editIntakeItems, setEditIntakeItems] = useState<
    { purchaseItemId: number; itemId: number; itemName: string; quantity: string; unitCost: string }[]
  >([]);

  const openEditIntakeModal = (p: PurchaseRecord) => {
    setEditingPurchase(p);
    setEditIntakeSupplier(p.supplierName || "");
    setEditIntakeInvoice(p.invoiceNumber || "");
    setEditIntakeItems(
      p.items.map((pi) => ({
        purchaseItemId: pi.id,
        itemId: pi.item.id,
        itemName: pi.item.name,
        quantity: pi.quantity.toString(),
        unitCost: pi.unitCost.toString(),
      }))
    );
  };

  const handleUpdateIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/purchases/${editingPurchase.id}`, {
        supplierName: editIntakeSupplier,
        invoiceNumber: editIntakeInvoice,
        items: editIntakeItems.map((item) => ({
          purchaseItemId: item.purchaseItemId,
          quantity: Number(item.quantity) || 0,
          unitCost: Number(item.unitCost) || 0,
        })),
      });
      setEditingPurchase(null);
      await Promise.all([fetchItems(), fetchHistory()]);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update intake batch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEdit = user?.role === "ADMIN" || user?.role === "STOCK";

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const response = await api.get("/items");
      setItems(response.data);
    } catch (error) {
      console.error("Failed to fetch items", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/purchases");
      setPurchases(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const res = await api.get("/item-price-history");
      setPriceHistory(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setPricesLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (activeTab === "history" && purchases.length === 0) fetchHistory();
    if (activeTab === "prices" && priceHistory.length === 0) fetchPrices();
  }, [activeTab]);

  // ─── Product modal ──────────────────────────────────────────────────────────

  // Edit Price Dialog Mode & State
  const [priceDialogMode, setPriceDialogMode] = useState<"update" | "correct">("update");
  const [correctField, setCorrectField] = useState<"SELLING" | "COST" | "QTY">("SELLING");
  const [correctedQty, setCorrectedQty] = useState<string>("0");
  const [effectiveFromDate, setEffectiveFromDate] = useState<string>(todayIso());
  const [salesNoticeCount, setSalesNoticeCount] = useState<number | null>(null);

  const handleOpenModal = async (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        sku: item.sku || "",
        sellingPrice: (item.sellingPrice || 0).toString(),
        costPrice: (item.costPrice || 0).toString(),
        description: item.description || "",
        initialQuantity: "0",
      });
      setCorrectedQty((item.warehouseStock || 0).toString());
      setPriceDialogMode("update");
      setCorrectField("SELLING");
      setEffectiveFromDate(todayIso());
      setSalesNoticeCount(null);

      // Fetch count of sales after effective date for notice
      try {
        const res = await api.get(`/item-price-history/count-sales-after?itemId=${item.id}&effectiveFrom=${todayIso()}`);
        setSalesNoticeCount(res.data.salesCount);
      } catch (e) {
        console.error("Failed to fetch sales count notice", e);
      }
    } else {
      setEditingItem(null);
      setFormData({ name: "", sku: "", sellingPrice: "", costPrice: "", description: "", initialQuantity: "0" });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingItem) {
        if (priceDialogMode === "update") {
          // Forward price update
          await api.post("/item-price-history", {
            itemId: editingItem.id,
            sellingPrice: Number(formData.sellingPrice),
            costPrice: Number(formData.costPrice),
            effectiveFrom: effectiveFromDate,
            notes: "Manual price update",
          });
        } else {
          // Retroactive price or quantity correction
          let targetValue = 0;
          if (correctField === "SELLING") targetValue = Number(formData.sellingPrice);
          else if (correctField === "COST") targetValue = Number(formData.costPrice);
          else targetValue = parseInt(correctedQty, 10) || 0;

          const res = await api.post("/item-price-history/correct", {
            itemId: editingItem.id,
            fieldCorrected: correctField,
            newPrice: targetValue,
          });
          alert(`Correction applied successfully! ${res.data.recordsUpdated} record(s) updated.`);
        }
      } else {
        await api.post("/items", {
          name: formData.name,
          sku: formData.sku.trim() || undefined,
          description: formData.description || undefined,
          sellingPrice: Number(formData.sellingPrice),
          costPrice: Number(formData.costPrice),
          initialQuantity: Number(formData.initialQuantity),
        });
      }
      await fetchItems();
      if (activeTab === "prices") await fetchPrices();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Failed to save item", error);
      alert(error.response?.data?.message || "Error saving item. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!editingItem) return;
    if (!confirm(`Are you sure you want to deactivate ${editingItem.name}?`)) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/items/${editingItem.id}`);
      await fetchItems();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to delete item", error);
      alert("Error deactivating item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Intake Modal ───────────────────────────────────────────────────────────

  const makeIntakeRow = (item?: Item): IntakeItemRow => ({
    itemId: item?.id || (items[0]?.id ?? 0),
    quantity: "1",
    unitCost: item ? (item.costPrice || 0).toString() : (items[0]?.costPrice || 0).toString(),
    sellingPrice: item ? (item.sellingPrice || 0).toString() : (items[0]?.sellingPrice || 0).toString(),
    effectiveFrom: todayIso(),
    priceNote: "",
  });

  const handleOpenIntakeModal = (item?: Item) => {
    setIntakeGlobal({ supplierName: "", invoiceNumber: "" });
    setIntakeRows([makeIntakeRow(item)]);
    setIsIntakeModalOpen(true);
  };

  const updateRow = (index: number, patch: Partial<IntakeItemRow>) => {
    setIntakeRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRow = () => setIntakeRows((rows) => [...rows, makeIntakeRow()]);
  const removeRow = (index: number) => setIntakeRows((rows) => rows.filter((_, i) => i !== index));

  const handleStockIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (intakeRows.length === 0) return;
    setIsSubmitting(true);
    try {
      const payload = {
        supplierName: intakeGlobal.supplierName.trim() || undefined,
        invoiceNumber: intakeGlobal.invoiceNumber.trim() || undefined,
        items: intakeRows.map((row) => ({
          itemId: row.itemId,
          quantity: Math.max(1, parseInt(row.quantity, 10) || 1),
          unitCost: parseFloat(row.unitCost) || 0,
          newSellingPrice: parseFloat(row.sellingPrice) || 0,
          effectiveFrom: row.effectiveFrom || todayIso(),
          priceNote: row.priceNote || undefined,
        })),
      };

      await api.post("/purchases", payload);
      await fetchItems();
      if (activeTab === "history") await fetchHistory();
      if (activeTab === "prices") await fetchPrices();
      setIsIntakeModalOpen(false);
    } catch (error: any) {
      console.error("Failed to record stock intake", error);
      alert(error.response?.data?.message || "Error recording stock intake.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Derived ────────────────────────────────────────────────────────────────

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredPriceHistory =
    selectedPriceItem === "all"
      ? priceHistory
      : priceHistory.filter((p) => p.itemId === selectedPriceItem);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-zinc-50 overflow-x-hidden">
      <div className="mx-auto max-w-lg px-6 py-8 pb-12 print:hidden">

        {/* Header */}
        <header className="mb-6 flex flex-col gap-5">
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
                  Inventory <span className="text-indigo-600">Storage</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Warehouse Stock & Price History
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg active:scale-95 transition-all dark:bg-slate-800"
                title="Print Inventory Report"
              >
                <Printer className="h-4 w-4" />
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={() => handleOpenIntakeModal()}
                    className="flex h-10 px-3 items-center gap-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                    title="Record Stock Intake"
                  >
                    <TrendingUp className="h-4 w-4" />
                    + Intake
                  </button>
                  <button
                    onClick={() => handleOpenModal()}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg active:scale-95 transition-all"
                    title="Add New Product"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-2xl bg-white border border-slate-100 p-1 dark:bg-slate-900 dark:border-slate-800">
            {([
              { key: "catalog", label: "Catalog", icon: Package },
              { key: "history", label: "Intake History", icon: History },
              { key: "prices", label: "Price History", icon: Tag },
            ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-black uppercase tracking-wider transition-all",
                  activeTab === key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Search (catalog only) */}
          {activeTab === "catalog" && (
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Search catalog..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-white py-3.5 pl-11 pr-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all dark:bg-slate-900 dark:border-slate-800"
              />
            </div>
          )}
        </header>

        {/* ── Tab: Catalog ──────────────────────────────────────────────────── */}
        {activeTab === "catalog" && (
          <>
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="bento-card overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-50 bg-slate-50/50 dark:bg-white/5 dark:border-slate-800">
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Item / SKU
                        </th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                          Whse
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                          Prices & Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {filteredItems.map((item) => (
                        <tr key={item.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-indigo-900/10">
                          <td className="px-5 py-4 cursor-pointer" onClick={() => canEdit && handleOpenModal(item)}>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5">
                                <Package className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                              </div>
                              <div>
                                <p className="text-xs font-bold tracking-tight mb-0.5">{item.name}</p>
                                <p className="text-[10px] font-black text-indigo-600/50 uppercase">{item.sku || "NO SKU"}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-black tabular-nums",
                                (item.warehouseStock || 0) <= 5
                                  ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20"
                                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20",
                              )}
                            >
                              {item.warehouseStock || 0}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <p className="text-xs font-black text-emerald-600 tabular-nums">
                              Sell: {fmt(item.sellingPrice)} ETB
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 tabular-nums mt-0.5">
                              Cost: {fmt(item.costPrice)} ETB
                            </p>
                            {canEdit && (
                              <div className="mt-2 flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenIntakeModal(item)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900 text-[10px] font-black uppercase hover:bg-emerald-100 transition-all flex items-center gap-1"
                                >
                                  <TrendingUp className="h-3 w-3" />
                                  + Intake
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bento-card p-12 text-center flex flex-col items-center">
                <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 dark:bg-slate-900">
                  <Activity className="h-8 w-8 text-slate-200" />
                </div>
                <h3 className="text-lg font-black tracking-tight">No Matches Found</h3>
              </div>
            )}
          </>
        )}

        {/* ── Tab: Intake History ───────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {purchases.length} intake{purchases.length !== 1 ? "s" : ""} recorded
              </p>
              <button
                onClick={fetchHistory}
                className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            ) : purchases.length === 0 ? (
              <div className="bento-card p-10 text-center bg-white dark:bg-slate-900">
                <History className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-400">No intakes recorded yet</p>
              </div>
            ) : (
              purchases.map((p) => {
                const hasPriceUpdate = p.priceHistory && p.priceHistory.length > 0;
                const isExpanded = expandedPurchase === p.id;
                return (
                  <div key={p.id} className="bento-card bg-white dark:bg-slate-900 border-none shadow-sm overflow-hidden">
                    <button
                      className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left"
                      onClick={() => setExpandedPurchase(isExpanded ? null : p.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 flex-shrink-0 dark:bg-emerald-900/20">
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black tracking-tight">
                              {p.supplierName || "Unknown Supplier"}
                            </span>
                            {hasPriceUpdate && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 text-[9px] font-black uppercase tracking-wider">
                                <Tag className="h-2.5 w-2.5" />
                                Price Updated
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {dateStr(p.createdAt)} · {p.items.length} item{p.items.length !== 1 ? "s" : ""}
                            {p.invoiceNumber && ` · ${p.invoiceNumber}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-black text-emerald-600 tabular-nums">
                          {fmt(p.totalCost)} ETB
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-slate-50 dark:border-slate-800 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Items Purchased</p>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditIntakeModal(p)}
                              className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <Edit3 className="h-3 w-3" />
                              Correct Intake
                            </button>
                          )}
                        </div>
                        {p.items.map((pi) => (
                          <div key={pi.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                            <div>
                              <p className="text-xs font-bold">{pi.item.name}</p>
                              <p className="text-[10px] font-bold text-slate-400">{pi.item.sku || "No SKU"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black tabular-nums">{pi.quantity} × {fmt(pi.unitCost)} ETB</p>
                              <p className="text-[10px] font-bold text-slate-400 tabular-nums">= {fmt(pi.subtotal)} ETB</p>
                            </div>
                          </div>
                        ))}

                        {hasPriceUpdate && (
                          <div className="mt-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Price Changes</p>
                            {p.priceHistory.map((ph) => (
                              <div key={ph.id} className="rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-3 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold">{ph.item?.name}</p>
                                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                                    Effective: {dateStr(ph.effectiveFrom)}
                                  </p>
                                  {ph.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{ph.notes}</p>}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-xs font-black text-emerald-600 tabular-nums">Sell: {fmt(ph.sellingPrice)} ETB</p>
                                  <p className="text-[10px] font-bold text-slate-400 tabular-nums">Cost: {fmt(ph.costPrice)} ETB</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                          Recorded by {p.user.name} · Total: <span className="text-emerald-600 font-black">{fmt(p.totalCost)} ETB</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab: Price History ────────────────────────────────────────────── */}
        {activeTab === "prices" && (
          <div className="space-y-3">
            {/* Filter by item */}
            <div className="flex items-center gap-2">
              <select
                value={selectedPriceItem === "all" ? "all" : selectedPriceItem}
                onChange={(e) =>
                  setSelectedPriceItem(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="flex-1 rounded-2xl border border-slate-100 bg-white py-2.5 px-4 text-xs font-bold outline-none dark:bg-slate-900 dark:border-slate-800"
              >
                <option value="all">All Items</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchPrices}
                className="flex items-center gap-1 px-3 py-2.5 rounded-2xl border border-slate-100 bg-white text-[10px] font-black text-indigo-600 dark:bg-slate-900 dark:border-slate-800"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {filteredPriceHistory.length} price change{filteredPriceHistory.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                <Info className="h-3 w-3" />
                Newest effective date first
              </div>
            </div>

            {pricesLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            ) : filteredPriceHistory.length === 0 ? (
              <div className="bento-card p-10 text-center bg-white dark:bg-slate-900">
                <Tag className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-400">No price history yet</p>
                <p className="text-xs text-slate-400 mt-1">Price updates recorded during intake will appear here</p>
              </div>
            ) : (
              <div className="bento-card bg-white dark:bg-slate-900 border-none shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredPriceHistory.map((ph, idx) => {
                    const prev = filteredPriceHistory[idx + 1];
                    const sameItem = prev && prev.itemId === ph.itemId;
                    const sellDiff = sameItem ? ph.sellingPrice - prev.sellingPrice : null;
                    const costDiff = sameItem ? ph.costPrice - prev.costPrice : null;
                    return (
                      <div key={ph.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 flex-shrink-0 mt-0.5">
                              <Tag className="h-3.5 w-3.5 text-amber-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black tracking-tight">{ph.item?.name}</span>
                                {ph.purchase && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20">
                                    via Intake
                                  </span>
                                )}
                                {idx === 0 && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 flex items-center gap-0.5">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                Effective: {dateStr(ph.effectiveFrom)} · by {ph.user.name}
                              </p>
                              {ph.notes && (
                                <p className="text-[10px] text-slate-400 italic mt-0.5">{ph.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-black text-emerald-600 tabular-nums">
                              {fmt(ph.sellingPrice)} ETB
                              {sellDiff !== null && (
                                <span className={cn("ml-1 text-[10px]", sellDiff >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                  {sellDiff >= 0 ? "▲" : "▼"}{fmt(Math.abs(sellDiff))}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 tabular-nums">
                              Cost: {fmt(ph.costPrice)} ETB
                              {costDiff !== null && (
                                <span className={cn("ml-1", costDiff >= 0 ? "text-rose-400" : "text-emerald-400")}>
                                  {costDiff >= 0 ? "▲" : "▼"}{fmt(Math.abs(costDiff))}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stock Intake Modal ───────────────────────────────────────────────── */}
      {isIntakeModalOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg animate-in fade-in duration-200 bento-card p-6 bg-white dark:bg-slate-950 border-none shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Stock <span className="text-emerald-600">Intake</span>
                </h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Receive new stock into warehouse
                </p>
              </div>
              <button
                onClick={() => setIsIntakeModalOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleStockIntakeSubmit} className="space-y-5">
              {/* Global fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Supplier (Optional)
                  </label>
                  <input
                    type="text"
                    value={intakeGlobal.supplierName}
                    onChange={(e) => setIntakeGlobal({ ...intakeGlobal, supplierName: e.target.value })}
                    placeholder="Supplier name"
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs font-bold outline-none dark:bg-white/5 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Invoice Ref (Optional)
                  </label>
                  <input
                    type="text"
                    value={intakeGlobal.invoiceNumber}
                    onChange={(e) => setIntakeGlobal({ ...intakeGlobal, invoiceNumber: e.target.value })}
                    placeholder="INV-001"
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs font-bold outline-none dark:bg-white/5 dark:border-slate-800"
                  />
                </div>
              </div>

              {/* Item rows */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Items</p>

                {intakeRows.map((row, idx) => {
                  const selectedItem = items.find((i) => i.id === row.itemId);
                  return (
                    <div key={idx} className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
                      {/* Row header */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                          Item {idx + 1}
                        </span>
                        {intakeRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            className="text-[10px] font-black text-rose-400 hover:text-rose-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Item select */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                          Item
                        </label>
                        <select
                          value={row.itemId}
                          onChange={(e) => {
                            const sel = items.find((i) => i.id === Number(e.target.value));
                            updateRow(idx, {
                              itemId: Number(e.target.value),
                              unitCost: (sel?.costPrice || 0).toString(),
                              sellingPrice: (sel?.sellingPrice || 0).toString(),
                            });
                          }}
                          className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs font-bold outline-none dark:bg-white/5 dark:border-slate-800"
                        >
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} (Stock: {i.warehouseStock || 0})
                            </option>
                          ))}
                        </select>
                        {selectedItem && (
                          <p className="text-[10px] text-slate-400 mt-1 font-bold">
                            Current Active: Sell {fmt(selectedItem.sellingPrice)} · Cost {fmt(selectedItem.costPrice)} ETB
                          </p>
                        )}
                      </div>

                      {/* Qty, Cost, Selling Price */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                            Qty (+)
                          </label>
                          <input
                            required
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                            className="w-full rounded-xl border border-emerald-100 bg-emerald-50/20 p-2.5 text-xs font-black text-emerald-600 outline-none dark:bg-white/5 dark:border-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                            Unit Cost
                          </label>
                          <input
                            required
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.unitCost}
                            onChange={(e) => updateRow(idx, { unitCost: e.target.value })}
                            className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 text-xs font-bold outline-none dark:bg-white/5 dark:border-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                            Selling Price
                          </label>
                          <input
                            required
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.sellingPrice}
                            onChange={(e) => updateRow(idx, { sellingPrice: e.target.value })}
                            className="w-full rounded-xl border border-emerald-100 bg-emerald-50/20 p-2.5 text-xs font-black text-emerald-600 outline-none dark:bg-white/5 dark:border-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addRow}
                  className="w-full rounded-2xl border border-dashed border-indigo-200 py-3 text-xs font-black text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 dark:border-indigo-900 dark:hover:bg-indigo-900/20"
                >
                  <Plus className="h-4 w-4" />
                  Add Another Item
                </button>
              </div>

              {/* Totals preview */}
              {intakeRows.length > 0 && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-3 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    Total Cost
                  </span>
                  <span className="text-sm font-black text-emerald-700 tabular-nums">
                    {fmt(intakeRows.reduce((s, r) => s + (parseFloat(r.unitCost) || 0) * (parseInt(r.quantity) || 0), 0))} ETB
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIntakeModalOpen(false)}
                  className="flex-1 rounded-2xl border border-slate-100 py-3 text-xs font-black text-slate-400 hover:bg-slate-50 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Confirm Intake
                      <TrendingUp className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit/Create Item Modal ────────────────────────────────────────────── */}
      {isModalOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/20 backdrop-blur-md sm:items-center p-4">
          <div className="w-full max-w-md animate-in slide-in-from-bottom duration-300 bento-card p-8 bg-white dark:bg-slate-950 border-none shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black tracking-tight">
                  {editingItem ? "Edit Prices for" : "New Catalog"}{" "}
                  <span className="text-indigo-600">{editingItem ? editingItem.name : "Product"}</span>
                </h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {editingItem ? "Update selling & cost prices" : "Add to warehouse inventory"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {editingItem && (
                <div className="space-y-3">
                  {/* Mode switcher: Update vs Correct */}
                  <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setPriceDialogMode("update")}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-black rounded-lg transition-all",
                        priceDialogMode === "update"
                          ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-white"
                          : "text-slate-400 hover:text-slate-700",
                      )}
                    >
                      Update Price (Going Forward)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceDialogMode("correct")}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-black rounded-lg transition-all",
                        priceDialogMode === "correct"
                          ? "bg-rose-500 text-white shadow-sm"
                          : "text-slate-400 hover:text-rose-500",
                      )}
                    >
                      Correct Mistake
                    </button>
                  </div>

                  {priceDialogMode === "update" ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                          Effective From Date
                        </label>
                        <input
                          type="date"
                          value={effectiveFromDate}
                          onChange={(e) => setEffectiveFromDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs font-bold outline-none dark:bg-white/5 dark:border-slate-800"
                        />
                      </div>

                      {salesNoticeCount !== null && salesNoticeCount > 0 && (
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-black">{salesNoticeCount} sale(s)</span> were recorded for this item after {dateStr(effectiveFromDate)}. Changing this price will apply going forward for new sales.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                        <Info className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black">Data Correction Notice:</span> This will fix a past error and retroactively update all historical sales records matching the current wrong price ({correctField === "SELLING" ? fmt(editingItem.sellingPrice) : fmt(editingItem.costPrice)} ETB). An audit record will be logged.
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                          Field to Correct
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCorrectField("SELLING")}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-xl text-xs font-black border transition-all",
                              correctField === "SELLING"
                                ? "bg-rose-50 border-rose-200 text-rose-600"
                                : "border-slate-100 text-slate-400",
                            )}
                          >
                            Selling Price
                          </button>
                          <button
                            type="button"
                            onClick={() => setCorrectField("COST")}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-xl text-xs font-black border transition-all",
                              correctField === "COST"
                                ? "bg-rose-50 border-rose-200 text-rose-600"
                                : "border-slate-100 text-slate-400",
                            )}
                          >
                            Cost Price
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!editingItem && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Product Name
                    </label>
                    <input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Coca-Cola 500ml"
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      SKU Code (Optional)
                    </label>
                    <input
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="ITEM-001"
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">
                    Selling Price (ETB)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    disabled={editingItem !== null && priceDialogMode === "correct" && correctField !== "SELLING"}
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/20 p-4 text-sm font-black text-emerald-600 outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 dark:bg-white/5 dark:border-slate-800 disabled:opacity-40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Cost Price (ETB)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    disabled={editingItem !== null && priceDialogMode === "correct" && correctField !== "COST"}
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800 disabled:opacity-40"
                  />
                </div>
              </div>

              {!editingItem && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Initial Warehouse Quantity
                  </label>
                  <input
                    type="number"
                    value={formData.initialQuantity}
                    onChange={(e) => setFormData({ ...formData, initialQuantity: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                  />
                </div>
              )}

              <div className="pt-4 flex gap-3">
                {editingItem && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={isSubmitting}
                    className="flex-1 rounded-2xl border border-slate-100 bg-white py-4 font-black text-rose-500 hover:bg-rose-50 transition-all active:scale-95 dark:bg-slate-900 dark:border-slate-800"
                  >
                    Deactivate
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] rounded-2xl bg-indigo-600 py-4 font-black text-white shadow-xl shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50 dark:shadow-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {editingItem ? "Update Prices" : "Create Product"}
                      <Plus className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Correct Intake Batch */}
      {editingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-black tracking-tight">Correct Intake Batch</h2>
                <p className="text-xs font-bold text-slate-400">Modify recorded batch quantities or unit costs</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPurchase(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateIntake} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier Name</label>
                  <input
                    type="text"
                    value={editIntakeSupplier}
                    onChange={(e) => setEditIntakeSupplier(e.target.value)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs font-bold outline-none focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice #</label>
                  <input
                    type="text"
                    value={editIntakeInvoice}
                    onChange={(e) => setEditIntakeInvoice(e.target.value)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs font-bold outline-none focus:border-indigo-600 dark:bg-white/5 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Batch Items</p>
                {editIntakeItems.map((item, idx) => (
                  <div key={item.purchaseItemId} className="rounded-2xl border border-slate-100 p-3 space-y-2 dark:border-slate-800 bg-slate-50/30 dark:bg-white/5">
                    <p className="text-xs font-black">{item.itemName}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Quantity</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={item.quantity}
                          onChange={(e) => {
                            const copy = [...editIntakeItems];
                            copy[idx].quantity = e.target.value;
                            setEditIntakeItems(copy);
                          }}
                          className="w-full rounded-xl border border-slate-100 bg-white p-2.5 text-xs font-bold outline-none focus:border-indigo-600 dark:bg-slate-900 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Unit Cost (ETB)</label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => {
                            const copy = [...editIntakeItems];
                            copy[idx].unitCost = e.target.value;
                            setEditIntakeItems(copy);
                          }}
                          className="w-full rounded-xl border border-slate-100 bg-white p-2.5 text-xs font-bold outline-none focus:border-indigo-600 dark:bg-slate-900 dark:border-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPurchase(null)}
                  className="flex-1 rounded-2xl border border-slate-100 py-3.5 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] rounded-2xl bg-indigo-600 py-3.5 text-xs font-black text-white shadow-xl shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50 dark:shadow-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : "Save Corrections"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Report */}
      <div className="hidden print:block w-full text-black p-8 bg-white absolute top-0 left-0 min-h-screen z-50">
        <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Limat Warehouse Inventory</h1>
          <p className="text-xs font-bold uppercase tracking-widest mt-1">Official Stock & Dual Price Report</p>
          <p className="text-[10px] font-black mt-2">Generated on: {mounted ? new Date().toLocaleString() : ""}</p>
        </div>
        <table className="w-full text-left mb-8">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="py-3 text-[12px] font-black uppercase tracking-wider">SKU / Item Name</th>
              <th className="py-3 text-center text-[12px] font-black uppercase tracking-wider">Whse Stock</th>
              <th className="py-3 text-right text-[12px] font-black uppercase tracking-wider">Selling Price</th>
              <th className="py-3 text-right text-[12px] font-black uppercase tracking-wider">Cost Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-3">
                  <p className="text-[14px] font-black">{item.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{item.sku || "NO SKU"}</p>
                </td>
                <td className="py-3 text-center text-[14px] font-black">{item.warehouseStock || 0}</td>
                <td className="py-3 text-right text-[14px] font-black">{fmt(item.sellingPrice)}</td>
                <td className="py-3 text-right text-[14px] font-black">{fmt(item.costPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
