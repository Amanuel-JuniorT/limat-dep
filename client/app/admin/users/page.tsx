"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Shield,
  User as UserIcon,
  Loader2,
  Search,
  Clock,
  Ban,
  RotateCcw,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Role } from "@/types/pos";
import { useAuth } from "@/context/AuthContext";

interface UserItem {
  id: number;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get("/users");
      setUsers(response.data);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (
    id: number,
    data: { status?: "APPROVED" | "REJECTED"; role?: Role },
  ) => {
    setProcessingId(id);
    try {
      await api.patch(`/users/${id}`, data);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...data } : u)),
      );
    } catch (error) {
      console.error("Failed to update user", error);
      alert("Error updating user");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery),
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20";
      case "REJECTED":
        return "bg-rose-50 text-rose-600 dark:bg-rose-900/20";
      default:
        return "bg-amber-50 text-amber-600 dark:bg-amber-900/20";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-zinc-50 overflow-x-hidden">
      <div className="mx-auto max-w-lg px-6 py-8 pb-12">
        <header className="mb-8 flex flex-col gap-6">
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
                  User <span className="text-indigo-600">Access</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Role & Approval Control
                </p>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-white py-3.5 pl-11 pr-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all dark:bg-slate-900 dark:border-slate-800"
            />
          </div>
        </header>

        {/* Pending Approval Alert */}
        {!loading && users.filter((u) => u.status === "PENDING").length > 0 && (
          <div className="mb-6 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-4 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-900 dark:text-amber-100">
                  {users.filter((u) => u.status === "PENDING").length} Users Pending
                </p>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                  Approval required
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="space-y-4">
            {filteredUsers.map((u) => {
              const isRejected = u.status === "REJECTED";
              return (
                <div
                  key={u.id}
                  className={cn(
                    "bento-card p-5 border-none shadow-sm relative overflow-hidden",
                    isRejected && "opacity-60",
                  )}
                >
                  {/* Rejected overlay stripe */}
                  {isRejected && (
                    <div className="absolute inset-0 bg-rose-50/40 dark:bg-rose-900/10 pointer-events-none" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="relative">
                        <div className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-2xl",
                          isRejected
                            ? "bg-rose-50 dark:bg-rose-900/20"
                            : "bg-slate-50 dark:bg-white/5",
                        )}>
                          {isRejected ? (
                            <Ban className="h-5 w-5 text-rose-400" />
                          ) : (
                            <UserIcon className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        {u.role === "ADMIN" && !isRejected && (
                          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-lg bg-indigo-600 text-white border-2 border-white dark:border-slate-900">
                            <Shield className="h-2.5 w-2.5" />
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className={cn(
                          "text-sm font-black tracking-tight",
                          isRejected && "line-through text-slate-400",
                        )}>
                          {u.name}
                        </h3>
                        <p className="text-[11px] font-bold text-slate-400">
                          {u.phone}
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest",
                              getStatusColor(u.status),
                            )}
                          >
                            {u.status}
                          </span>

                          {/* Role selector — hidden for rejected users */}
                          {!isRejected && (
                            <select
                              value={u.role}
                              onChange={(e) =>
                                handleUpdateUser(u.id, { role: e.target.value as Role })
                              }
                              className="text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 border-none outline-none text-slate-700 dark:text-slate-200"
                            >
                              <option value="SELLER">SELLER (Shop/Event)</option>
                              <option value="STOCK">STOCK (Warehouse)</option>
                              <option value="ADMIN">ADMIN (Full Control)</option>
                            </select>
                          )}
                        </div>

                        {/* Rejection notice */}
                        {isRejected && (
                          <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-rose-400">
                            Access permanently denied
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {u.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateUser(u.id, { status: "APPROVED" })}
                          disabled={processingId === u.id}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-90 dark:shadow-none"
                          title="Approve user"
                        >
                          {processingId === u.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleUpdateUser(u.id, { status: "REJECTED" })}
                          disabled={processingId === u.id}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90 dark:bg-white/5"
                          title="Reject user"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Ban button — for APPROVED users, but never for self */}
                    {u.status === "APPROVED" && u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleUpdateUser(u.id, { status: "REJECTED" })}
                        disabled={processingId === u.id}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90 dark:bg-white/5"
                        title="Ban / Revoke access"
                      >
                        {processingId === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                      </button>
                    )}

                    {/* Reinstate button — only for REJECTED users */}
                    {u.status === "REJECTED" && (
                      <button
                        onClick={() => handleUpdateUser(u.id, { status: "APPROVED" })}
                        disabled={processingId === u.id}
                        className="flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                        title="Reinstate user"
                      >
                        {processingId === u.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Reinstate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bento-card p-12 text-center flex flex-col items-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 dark:bg-slate-900">
              <Users className="h-8 w-8 text-slate-200" />
            </div>
            <h3 className="text-lg font-black tracking-tight">
              No Users Found
            </h3>
          </div>
        )}
      </div>
    </div>
  );
}
