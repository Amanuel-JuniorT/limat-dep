"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  ArrowLeft,
  Store,
  Calendar,
  CreditCard,
  Coins,
  Search,
  Loader2,
  X,
  User,
  ShoppingBag,
  Filter,
  Trash2,
  Edit2,
  Save,
  Check,
} from "lucide-react";
import api from "@/lib/api";
import { SalesReport, SalesReportItem } from "@/types/pos";
import { cn } from "@/lib/utils";

export default function SalesReportHistoryPage() {
  const [reports, setReports] = useState<SalesReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedReport, setSelectedReport] = useState<SalesReport | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<
    {
      id: number;
      itemId: number;
      itemName: string;
      quantity: number;
      unitPrice: number;
      paymentMethod: "CASH" | "TELEBIRR" | "CBE";
      tipAmount: number;
      notes: string;
    }[]
  >([]);
  const [editNotes, setEditNotes] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.get("/sales-reports");
      setReports(response.data || []);
    } catch (err) {
      console.error("Failed to load sales report history", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (report: SalesReport) => {
    setSelectedReport(report);
    setIsEditing(false);
    setEditNotes(report.notes || "");
    setEditItems(
      report.items?.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        itemName: i.item?.name || "Item",
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        paymentMethod: (i.paymentMethod as any) || report.paymentMethod || "CASH",
        tipAmount: Number(i.tipAmount || 0),
        notes: i.notes || "",
      })) || [],
    );
  };

  const handleDeleteReport = async () => {
    if (!selectedReport) return;
    if (
      !confirm(
        `Are you sure you want to delete/undo Sales Report #${selectedReport.id}? This will reverse and restore all deducted stock!`,
      )
    ) {
      return;
    }

    setIsActionLoading(true);
    try {
      await api.delete(`/sales-reports/${selectedReport.id}`);
      setReports((prev) => prev.filter((r) => r.id !== selectedReport.id));
      setSelectedReport(null);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete sales report");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedReport) return;
    setIsActionLoading(true);
    try {
      const response = await api.patch(`/sales-reports/${selectedReport.id}`, {
        notes: editNotes,
        items: editItems.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          paymentMethod: i.paymentMethod,
          tipAmount: i.tipAmount,
          notes: i.notes,
        })),
      });

      const updatedReport = response.data;
      setReports((prev) =>
        prev.map((r) => (r.id === updatedReport.id ? updatedReport : r)),
      );
      setSelectedReport(updatedReport);
      setIsEditing(false);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update sales report");
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.destination?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.items?.some((i) =>
        i.item?.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const matchesDate = !dateFilter || r.saleDate.startsWith(dateFilter);

    return matchesSearch && matchesDate;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-zinc-50 overflow-x-hidden">
      <div className="mx-auto max-w-lg px-6 py-8 pb-16">
        <header className="mb-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/sales-report"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all shadow-sm active:scale-95 dark:bg-slate-900 dark:border-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-xl font-black tracking-tight">
                  Sales Report <span className="text-indigo-600">History</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Detailed Batch Records
                </p>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20">
              <FileText className="h-5 w-5" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Search by shop, item, seller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-white py-3.5 pl-11 pr-4 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all dark:bg-slate-900 dark:border-slate-800"
              />
            </div>

            <div className="relative flex items-center gap-2">
              <div className="relative w-full">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-white py-3.5 pl-11 pr-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all dark:bg-slate-900 dark:border-slate-800"
                />
              </div>
              {dateFilter && (
                <button
                  onClick={() => setDateFilter("")}
                  className="px-3 py-3.5 rounded-2xl border border-slate-100 bg-white text-xs font-bold text-slate-400 hover:text-rose-500 transition-all dark:bg-slate-900 dark:border-slate-800"
                  title="Clear Date Filter"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="space-y-3">
            {filteredReports.map((r) => (
              <div
                key={r.id}
                onClick={() => handleOpenModal(r)}
                className="bento-card p-5 bg-white dark:bg-slate-900 border-none shadow-sm hover:ring-2 hover:ring-indigo-600/10 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Store className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="text-xs font-black">
                      {r.destination?.name || "Shop"}
                    </span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 rounded-full">
                      {r.items?.length || 1} Record(s)
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">
                    📅 {new Date(r.saleDate).toLocaleDateString()} · 👤 {r.user?.name || "Seller"}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate max-w-[200px]">
                    📦 {r.items?.map((i) => i.item?.name).join(", ")}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-black text-indigo-600 tabular-nums">
                    {Number(r.totalAmount).toFixed(0)} ETB
                  </p>
                  {Number(r.tipAmount) > 0 && (
                    <p className="text-[9px] font-bold text-emerald-500 tabular-nums">
                      +{Number(r.tipAmount)} ETB Tip
                    </p>
                  )}
                  <span className="text-[9px] font-black uppercase text-indigo-600 mt-1 block hover:underline">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bento-card p-12 text-center flex flex-col items-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 dark:bg-slate-900">
              <ShoppingBag className="h-8 w-8 text-slate-200" />
            </div>
            <h3 className="text-lg font-black tracking-tight">
              No Sales Reports Found
            </h3>
            {dateFilter && (
              <p className="text-xs text-slate-400 mt-2 font-medium">
                No reports submitted for date {dateFilter}.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Detailed Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bento-card p-6 bg-white dark:bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black tracking-tight">
                  Sales Report <span className="text-indigo-600">#{selectedReport.id}</span>
                </h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {new Date(selectedReport.saleDate).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400">Destination</span>
                  <p className="font-bold">{selectedReport.destination?.name}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400">Submitted By</span>
                  <p className="font-bold">{selectedReport.user?.name}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400">Items Count</span>
                  <p className="font-bold text-indigo-600">{selectedReport.items?.length || 0} Records</p>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400">Total Tips</span>
                  <p className="font-bold text-emerald-600">{Number(selectedReport.tipAmount || 0)} ETB</p>
                </div>
              </div>

              {/* View vs Edit Mode */}
              {!isEditing ? (
                <>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                      Individual Records Breakdown
                    </h4>
                    <div className="space-y-2">
                      {selectedReport.items?.map((i, index) => (
                        <div
                          key={i.id}
                          className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs font-black">
                            <span>
                              #{index + 1} {i.item?.name}
                            </span>
                            <span className="text-indigo-600">
                              {Number(i.subtotal).toFixed(0)} ETB
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                            <span>
                              Qty: {i.quantity} × {Number(i.unitPrice).toFixed(0)} ETB
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 rounded-md font-black uppercase">
                              {i.paymentMethod || selectedReport.paymentMethod}
                            </span>
                          </div>

                          {Number(i.tipAmount) > 0 && (
                            <div className="text-[10px] font-bold text-emerald-600">
                              💡 Tip: +{Number(i.tipAmount)} ETB
                            </div>
                          )}

                          {i.notes && (
                            <div className="text-[10px] italic text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                              "{i.notes}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Totals */}
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-slate-600 dark:text-slate-400">
                      <span>Subtotal:</span>
                      <span>{Number(selectedReport.subtotal).toFixed(2)} ETB</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-600">
                      <span>Total Tip Amount:</span>
                      <span>+{Number(selectedReport.tipAmount || 0).toFixed(2)} ETB</span>
                    </div>
                    <div className="flex justify-between font-black text-base pt-2 border-t border-indigo-100 dark:border-indigo-900/30 text-indigo-600">
                      <span>Grand Total Recorded:</span>
                      <span>{Number(selectedReport.totalAmount).toFixed(2)} ETB</span>
                    </div>
                  </div>

                  {/* Notes Context */}
                  {selectedReport.notes && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                        Overall Report Notes
                      </span>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 italic">
                        "{selectedReport.notes}"
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-800 py-3.5 text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit Report
                    </button>

                    <button
                      onClick={handleDeleteReport}
                      disabled={isActionLoading}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 px-4 py-3.5 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-100 transition-all"
                    >
                      {isActionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Undo / Delete
                    </button>
                  </div>
                </>
              ) : (
                /* Editing Mode Form */
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                    Edit Report Records
                  </h4>

                  {editItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs font-black">
                        <span>#{idx + 1} {item.itemName}</span>
                        <span className="text-indigo-600 font-bold">
                          {item.quantity * item.unitPrice} ETB
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setEditItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, quantity: val } : it,
                                ),
                              );
                            }}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                            Payment Channel
                          </label>
                          <select
                            value={item.paymentMethod}
                            onChange={(e) => {
                              const val = e.target.value as "CASH" | "TELEBIRR" | "CBE";
                              setEditItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, paymentMethod: val } : it,
                                ),
                              );
                            }}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold outline-none"
                          >
                            <option value="CASH">Cash</option>
                            <option value="TELEBIRR">Telebirr</option>
                            <option value="CBE">CBE</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                            Tip Amount (ETB)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.tipAmount}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              setEditItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, tipAmount: val } : it,
                                ),
                              );
                            }}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                            Notes
                          </label>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, notes: val } : it,
                                ),
                              );
                            }}
                            placeholder="Optional item note..."
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      Overall Report Notes
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Report notes..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs font-bold outline-none"
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={isActionLoading}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20"
                    >
                      {isActionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Changes
                    </button>

                    <button
                      onClick={() => setIsEditing(false)}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
