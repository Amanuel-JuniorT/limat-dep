"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  CreditCard,
  HandCoins,
  Coins,
  Receipt,
  X,
  ChevronDown,
  ShoppingBag,
  Sparkles,
  Loader2,
  Gamepad2,
  Gift,
  Award,
  RotateCw,
  ShoppingCart,
  PenSquare,
  ArrowLeft,
  Wallet,
  Landmark,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

// Types
interface Item {
  id: string | number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category?: string;
  prices?: any[];
}

interface CartItem extends Item {
  quantity: number;
}

interface SpinResult {
  id: string;
  type: "item" | "discount";
  itemId?: string | number;
  itemName?: string;
  message?: string;
  discountAmount?: number;
  timestamp: Date;
  quantity?: number;
}

export default function PosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [spinQuantity, setSpinQuantity] = useState<number>(0);
  const [spinResults, setSpinResults] = useState<SpinResult[]>([]);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "TELEBIRR" | "CBE" | "CUSTOM"
  >("CASH");
  const [customTip, setCustomTip] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [isCustomPaymentOpen, setIsCustomPaymentOpen] =
    useState<boolean>(false);

  // New states for enhancements
  const [customPayments, setCustomPayments] = useState<{
    CASH: number;
    TELEBIRR: number;
    CBE: number;
  }>({
    CASH: 0,
    TELEBIRR: 0,
    CBE: 0,
  });

  const [customPaymentsTemp, setCustomPaymentsTemp] = useState<{
    CASH: number;
    TELEBIRR: number;
    CBE: number;
  }>({
    CASH: 0,
    TELEBIRR: 0,
    CBE: 0,
  });

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Modal state for recording spin results
  const [selectedPrizeType, setSelectedPrizeType] = useState<"spin" | "sales">(
    "spin",
  );
  const [selectedItemId, setSelectedItemId] = useState<string | number>("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const prevTotalRef = useRef<number>(0);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await api.get("/items");
      // Map backend structure to local Item type
      const formatted = response.data.map((i: any) => ({
        ...i,
        name: i.name,
        sku: i.sku || "",
        price: Number(i.prices?.[0]?.price || 0),
        stock: Number(i.totalStock || 0),
        category: "General",
      }));
      setItems(formatted);
    } catch (error) {
      console.error("Failed to fetch items", error);
    } finally {
      setLoading(false);
    }
  };

  // Spin price constant
  const SPIN_PRICE = 30;

  // Filter items based on search AND stock availability
  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category &&
        item.category.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  // Calculations
  const normalSubtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const totalSpinResultsCount = spinResults.reduce(
    (sum, r) => sum + (r.quantity || 1),
    0,
  );
  const spinTotalCharge = (spinQuantity + totalSpinResultsCount) * SPIN_PRICE;
  const subtotal = normalSubtotal + spinTotalCharge;
  const total = subtotal + tipAmount;

  const effectivePaidAmount =
    paymentMethod === "CUSTOM"
      ? customPayments.CASH + customPayments.TELEBIRR + customPayments.CBE
      : paidAmount;
  const change = Math.max(0, effectivePaidAmount - total);

  // Auto-fill paidAmount for non-custom payment methods
  useEffect(() => {
    const prevTotal = prevTotalRef.current;

    if (total <= 0) {
      setPaidAmount(0);
      setCustomPayments({ CASH: 0, TELEBIRR: 0, CBE: 0 });
      setCustomPaymentsTemp({ CASH: 0, TELEBIRR: 0, CBE: 0 });
    } else {
      setPaidAmount((currentPaid) => {
        if (paymentMethod !== "CUSTOM") {
          if (
            currentPaid === 0 ||
            currentPaid === prevTotal ||
            currentPaid < total
          ) {
            return total;
          }
        }
        return currentPaid;
      });
    }
    prevTotalRef.current = total;
  }, [total, paymentMethod]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format money
  const formatMoney = (value: number) => `${value.toFixed(2)} ETB`;

  // Cart functions
  const addToCart = (item: Item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string | number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQuantity = item.quantity + delta;
            if (newQuantity < 1) return null;
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null),
    );
  };

  const removeFromCart = (id: string | number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Spin functions
  const addSpin = () => {
    setSpinQuantity((prev) => prev + 1);
  };

  const removeSpin = () => {
    setSpinQuantity((prev) => Math.max(0, prev - 1));
  };

  // Open modal to record spin result
  const openSpinModal = () => {
    if (spinQuantity === 0) {
      showToast("Add spins first!", "error");
      return;
    }

    // Reset modal state
    setSelectedPrizeType("spin");
    setSelectedItemId("");
  };

  // Save spin result from modal
  // Save spin result from modal
  const saveSpinResult = (itemId?: string | number) => {
    let result: SpinResult;

    if (selectedPrizeType === "spin") {
      const idToUse = itemId || selectedItemId;
      if (!idToUse) {
        showToast("Select an item won", "error");
        return;
      }
      const item = items.find((i) => String(i.id) === String(idToUse));
      if (!item) return;

      result = {
        id: Date.now().toString() + Math.random(),
        type: "item",
        itemId: item.id,
        itemName: item.name,
        timestamp: new Date(),
        quantity: 1,
      };

      setSpinResults((prev) => {
        const existing = prev.find(
          (r) => r.type === "item" && r.itemId === item.id,
        );
        if (existing) {
          return prev.map((r) =>
            r.type === "item" && r.itemId === item.id
              ? { ...r, quantity: (r.quantity || 1) + 1 }
              : r,
          );
        }
        return [result, ...prev];
      });
      setSpinQuantity((prev) => Math.max(0, prev - 1));
      showToast("Spin reward recorded!", "success");
    } else if (selectedPrizeType === "sales") {
      const idToUse = itemId || selectedItemId;
      const item = items.find((i) => String(i.id) === String(idToUse));
      if (item) {
        addToCart(item);
        showToast(`${item.name} added to cart`, "success");
      }
    }

    setSelectedItemId("");
  };

  const updateSpinResultQuantity = (id: string, delta: number) => {
    setSpinResults((prev) =>
      prev
        .map((result) => {
          if (result.id === id) {
            const newQuantity = (result.quantity || 1) + delta;
            if (newQuantity < 1) return null;
            return { ...result, quantity: newQuantity };
          }
          return result;
        })
        .filter((result): result is SpinResult => result !== null),
    );
  };

  const deleteSpinResult = (id: string) => {
    setSpinResults((prev) => prev.filter((r) => r.id !== id));
  };

  const clearSpinResults = () => {
    setSpinResults([]);
  };

  // Clear all
  const clearAll = () => {
    setCart([]);
    setSpinQuantity(0);
    setSpinResults([]);
    setTipAmount(0);
    setPaidAmount(0);
    setCustomTip("");
    setPaymentMethod("CASH");
    setCustomPayments({ CASH: 0, TELEBIRR: 0, CBE: 0 });
    setCustomPaymentsTemp({ CASH: 0, TELEBIRR: 0, CBE: 0 });
  };

  // Tip functions
  const handleTipPreset = (amount: number) => {
    setTipAmount(amount);
    setCustomTip("");
  };

  const applyCustomTip = () => {
    const amount = parseFloat(customTip);
    if (!isNaN(amount) && amount >= 0) {
      setTipAmount(amount);
    }
  };

  const useChangeAsTip = () => {
    if (change > 0) {
      setTipAmount((prev) => prev + change);
      setCustomTip((tipAmount + change).toFixed(0));
      if (paymentMethod !== "CUSTOM") {
        setPaidAmount(0);
      }
    }
  };

  // Select item from dropdown
  const selectItem = (item: Item) => {
    addToCart(item);
    setSearchQuery("");
    setIsDropdownOpen(false);
  };

  // Complete sale
  const handleCompleteSale = async () => {
    const hasItems =
      cart.length > 0 || spinQuantity > 0 || spinResults.length > 0;
    const hasTip = tipAmount > 0;

    if (!hasItems && !hasTip) {
      showToast("Cart is empty", "error");
      return;
    }

    // 2. High-level payment guards
    if (paymentMethod === "CUSTOM") {
      const totalPaid =
        customPayments.CASH + customPayments.TELEBIRR + customPayments.CBE;
      if (totalPaid < total - 0.01) {
        showToast(
          `Remaining balance: ${formatMoney(total - totalPaid)}`,
          "error",
        );
        return;
      }
    } else {
      if (paidAmount < total - 0.01 && paidAmount > 0) {
        showToast(`Customer owes ${formatMoney(total - paidAmount)}`, "info");
        return;
      }
      if (paidAmount < total - 0.01) {
        console.log(`Paid Amount: ${paidAmount}`);
        console.log(`Total Amount: ${total}`);
        showToast("Payment amount not covered", "error");
        return;
      }
    }

    if (change > 0.01) {
      const confirmChange = window.confirm(
        `Change Due: ${formatMoney(change)}\n\nPlease confirm you have returned the change to the customer before completing the sale.`,
      );
      if (!confirmChange) return;
    }

    setProcessing(true);

    try {
      // 1. Process all Spin Results
      for (const result of spinResults) {
        const qty = result.quantity || 1;
        for (let q = 0; q < qty; q++) {
          await api.post("/sales/spin", {
            spinResult:
              result.type === "item" ? `Won: ${result.itemName}` : "Reward",
            rewardItemId:
              result.type === "item" ? Number(result.itemId) : undefined,
            tipAmount: 0,
          });
        }
      }

      // 2. Process remaining unplayed spins
      for (let i = 0; i < spinQuantity; i++) {
        await api.post("/sales/spin", {
          spinResult: "Purchased but not played",
          tipAmount: 0,
        });
      }

      // 3. Process main cart
      const itemsToBuy = cart.map((cartItem) => ({
        itemId: Number(cartItem.id),
        quantity: cartItem.quantity,
      }));

      if (itemsToBuy.length > 0 || tipAmount > 0) {
        const payload: any = {
          items: itemsToBuy,
          tipAmount: tipAmount,
          paymentMethod: paymentMethod,
        };

        if (paymentMethod === "CUSTOM") {
          payload.splitPayments = customPayments;
        }

        const response = await api.post("/sales", payload);
        setLastTransaction(response.data);
      } else {
        setLastTransaction({ id: "SPIN-ONLY" });
      }

      clearAll();
      showToast("Sale completed successfully!", "success");
      setTimeout(() => setLastTransaction(null), 3000);
    } catch (error) {
      console.error("Transaction failed:", error);
      showToast("Error completing sale", "error");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 text-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          Syncing Terminal...
        </p>
      </div>
    );
  }

  const validateCustomPayment = () => {
    const totalAdded =
      customPaymentsTemp.CASH +
      customPaymentsTemp.TELEBIRR +
      customPaymentsTemp.CBE;

    if (totalAdded === 0) {
      showToast("Please enter at least one payment amount", "error");
      return;
    }

    if (totalAdded > total) {
      const excess = totalAdded - total;
      const keepAsTip = confirm(
        `Total payment (${formatMoney(totalAdded)}) exceeds order total (${formatMoney(total)}). \n\nWould you like to keep the ${formatMoney(excess)} change as a tip?`,
      );

      if (keepAsTip) {
        setTipAmount((prev) => prev + excess);
        showToast(`Added ${formatMoney(excess)} to tips`, "success");
      }
      // Save changes even if they keep change as tip
      setCustomPayments(customPaymentsTemp);
      setIsCustomPaymentOpen(false);
    } else {
      if (totalAdded < total) {
        showToast(
          `Remaining balance: ${formatMoney(total - totalAdded)}`,
          "info",
        );
      } else {
        showToast("Payment amounts set", "success");
      }
      // Save changes for both exact and underpayments
      setCustomPayments(customPaymentsTemp);
      setIsCustomPaymentOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <div className="mx-auto max-w-md p-4 pb-12">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-100 bg-white p-2 text-slate-400 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight">
                Limat <span className="text-indigo-600">POS</span>
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {user?.name || "Operator"} · ETB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-2xl bg-white px-2 py-1 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-3 py-2">
              <Gamepad2 className="h-3.5 w-3.5 text-white" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                Spin & Shop
              </span>
            </div>
          </div>
        </header>

        {/* Spin Result Modal */}
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <Gift className="h-3 w-3" /> Result
        </p>
        <div
          ref={modalRef}
          className="w-full max-w-md mb-4 rounded-[2.5rem] bg-white dark:bg-slate-900 p-8 shadow-2xl animate-in zoom-in-95 duration-200"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Result
              </h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                Capture the prize outcome
              </p>
            </div>
          </div>

          <div className="mb-6 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Category
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedPrizeType("spin")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                  selectedPrizeType === "spin"
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600"
                    : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-400",
                )}
              >
                <Gift className="h-5 w-5" />
                <span className="text-[10px] font-black uppercase">SPIN</span>
              </button>
              <button
                onClick={() => setSelectedPrizeType("sales")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                  selectedPrizeType === "sales"
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600"
                    : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-400",
                )}
              >
                <Wallet className="h-5 w-5" />
                <span className="text-[10px] font-black uppercase">SALES</span>
              </button>
            </div>
          </div>

          {(selectedPrizeType === "spin" || selectedPrizeType === "sales") && (
            <div className="mb-8">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                {selectedPrizeType === "spin"
                  ? "Select Won Item"
                  : "Select Item to Sell"}
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedItemId(val);
                  if (val) saveSpinResult(val);
                }}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 dark:bg-slate-800 px-4 py-4 text-xs font-bold outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
              >
                <option value="">Search Inventory...</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Stock: {item.stock})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search */}
        {/* <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <Wallet className="h-3 w-3" /> Sales
        </p>
        <div className="mb-6" ref={dropdownRef}>
          <div className="relative">
            <div
              className={cn(
                "flex items-center rounded-2xl border bg-white p-1 transition-all shadow-sm dark:bg-slate-900 dark:border-slate-800",
                isDropdownOpen
                  ? "ring-2 ring-indigo-600/20 border-indigo-600/30"
                  : "border-slate-100",
              )}
            >
              <Search className="ml-4 h-4 w-4 text-slate-300" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Find items to buy..."
                className="w-full bg-transparent px-3 py-3 text-sm font-bold outline-none placeholder:text-slate-300"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="mr-2 rounded-full p-1 hover:bg-slate-50"
                >
                  <X className="h-3.5 w-3.5 text-slate-300" />
                </button>
              )}
              <ChevronDown
                className={cn(
                  "mr-3 h-4 w-4 text-slate-300 transition-transform",
                  isDropdownOpen && "rotate-180",
                )}
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl bg-white p-2 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                {filteredItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-xs font-bold">No items found</p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectItem(item)}
                      className="flex w-full items-center justify-between rounded-xl p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full",
                              item.stock > 10
                                ? "bg-emerald-500"
                                : item.stock > 0
                                  ? "bg-amber-500"
                                  : "bg-rose-500",
                            )}
                          />
                          <p className="text-sm font-bold">{item.name}</p>
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-slate-100 rounded-full text-slate-400">
                            {item.category || "General"}
                          </span>
                          <span
                            className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                              item.stock > 0
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-rose-50 text-rose-500",
                            )}
                          >
                            {item.stock > 0
                              ? `${item.stock} in stock`
                              : "Out of Stock"}
                          </span>
                        </div>
                        <p className="text-[10px] font-black text-indigo-600 uppercase mt-1">
                          {item.price.toFixed(2)} ETB
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-slate-200" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div> */}

        {/* Order Sheet */}
        <div className="bento-card mb-4 p-5 border-none shadow-sm bg-white dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                Order Sheet
              </h2>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} ITEMS
            </span>
          </div>

          <div className="max-h-60 space-y-3 overflow-y-auto custom-scrollbar">
            {cart.length === 0 &&
            spinQuantity === 0 &&
            spinResults.length === 0 ? (
              <div className="py-10 text-center opacity-20">
                <ShoppingBag className="mx-auto mb-2 h-8 w-8" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  Terminal Ready
                </p>
              </div>
            ) : (
              <>
                {/* Regular Items */}
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 rounded-lg bg-white border border-slate-100 p-1 dark:bg-slate-900 dark:border-slate-800">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-black tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-none text-slate-900 dark:text-white">
                          {item.name}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                          {formatMoney(item.price)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 tabular-nums">
                        {(item.price * item.quantity).toFixed(0)}
                      </p>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 text-slate-200 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Spin Results (Prizes) */}
                {spinResults.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="h-3.5 w-3.5 text-purple-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-600">
                          Spin Prizes Logged
                        </span>
                      </div>
                      <button
                        onClick={clearSpinResults}
                        className="text-[8px] font-black uppercase text-slate-400 hover:text-rose-500"
                      >
                        Drop All
                      </button>
                    </div>
                    {spinResults.map((result) => (
                      <div
                        key={result.id}
                        className="mb-2 flex items-center justify-between rounded-xl bg-purple-50/50 p-2 dark:bg-purple-900/10 last:mb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 rounded-lg bg-white border border-purple-100 p-1 dark:bg-slate-900 dark:border-purple-900/30">
                            <button
                              onClick={() => updateSpinResultQuantity(result.id, -1)}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center text-xs font-black tabular-nums text-slate-900 dark:text-white">
                              {result.quantity || 1}
                            </span>
                            <button
                              onClick={() => updateSpinResultQuantity(result.id, 1)}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-900 dark:text-white">
                              {result.type === "item"
                                ? result.itemName
                                : result.type === "discount"
                                  ? `${result.discountAmount} ETB Discount`
                                  : ""}
                            </p>
                            <span className="text-[8px] font-black uppercase text-purple-400">
                              {result.type === "item"
                                ? "Inventory Reward"
                                : "Participant Mark"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteSpinResult(result.id)}
                          className="p-2 text-purple-300 hover:text-rose-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {(cart.length > 0 || spinQuantity > 0 || spinResults.length > 0) && (
            <button
              onClick={clearAll}
              className="mt-4 w-full rounded-xl border border-rose-50 bg-rose-50/30 py-2.5 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50/50 transition-colors"
            >
              Cancel Order
            </button>
          )}
        </div>

        {/* Totals & Tip */}
        <div className="space-y-4 mb-4">
          <div className="bento-card p-5 border-none shadow-sm bg-white dark:bg-slate-900">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Items Subtotal</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatMoney(normalSubtotal)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>
                  Spins ({spinQuantity + totalSpinResultsCount} × {SPIN_PRICE})
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatMoney(spinTotalCharge)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Service Tip</span>
                <span className="font-bold text-indigo-600">
                  {formatMoney(tipAmount)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-50 pt-3 dark:border-slate-800">
                <span className="text-xs font-black uppercase tracking-widest">
                  Total Amount
                </span>
                <span className="text-xl font-black tracking-tight">
                  {formatMoney(total)}
                </span>
              </div>
            </div>

            <div className="mb-4 pt-4 border-t border-slate-50 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <HandCoins className="h-3 w-3" /> Quick Tip
              </p>
              <div className="flex gap-2 mb-3">
                {[0, 10, 20, 50].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleTipPreset(amount)}
                    className={cn(
                      "flex-1 rounded-xl py-3 text-xs font-bold transition-all border",
                      tipAmount === amount && !customTip
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                        : "bg-white text-slate-400 border-slate-100 hover:border-indigo-100 dark:bg-slate-800 dark:border-slate-800",
                    )}
                  >
                    {amount === 0 ? "None" : `+${amount}`}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                  placeholder="Custom amount..."
                  className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-bold outline-none focus:border-indigo-600 dark:bg-slate-800 dark:border-slate-800"
                />
                <button
                  onClick={applyCustomTip}
                  className="rounded-xl bg-slate-100 px-6 py-3 text-[10px] font-black text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <Wallet className="h-3 w-3" /> Payment Method
          </p>

          <div className="bento-card p-5 border-none shadow-sm bg-white dark:bg-slate-900">
            <div className="flex gap-2 mb-4">
              {[
                { id: "CASH", label: "Cash", icon: HandCoins },
                { id: "TELEBIRR", label: "Telebirr", icon: Smartphone },
                { id: "CBE", label: "CBE", icon: Landmark },
                { id: "CUSTOM", label: "Custom", icon: Plus },
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => {
                    // 1. Handle switching AWAY from Custom with entries
                    if (paymentMethod === "CUSTOM" && method.id !== "CUSTOM") {
                      const totalAdded =
                        customPayments.CASH +
                        customPayments.TELEBIRR +
                        customPayments.CBE;

                      if (totalAdded > 0) {
                        if (
                          confirm(
                            "Do you want to clear the custom payments and associated tips?",
                          )
                        ) {
                          setCustomPayments({ CASH: 0, TELEBIRR: 0, CBE: 0 });
                          setTipAmount(0);
                          setCustomTip("");
                        } else {
                          // Prevent switch if user cancels
                          return;
                        }
                      }
                    }

                    // 2. Set the method
                    setPaymentMethod(method.id as any);

                    // 3. Handle opening Custom Modal
                    if (method.id === "CUSTOM") {
                      // Always sync temp state with committed state when opening/clicking
                      setCustomPaymentsTemp(customPayments);

                      const totalAdded =
                        customPayments.CASH +
                        customPayments.TELEBIRR +
                        customPayments.CBE;

                      // Open if switching TO custom OR if staying on custom with 0 values
                      if (paymentMethod !== "CUSTOM" || totalAdded === 0) {
                        setIsCustomPaymentOpen(true);
                      }
                    }
                  }}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-2 rounded-xl py-4 border transition-all",
                    paymentMethod === method.id
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                      : "bg-white text-slate-400 border-slate-100 hover:border-indigo-100 dark:bg-slate-800 dark:border-slate-800",
                  )}
                >
                  <method.icon className="h-5 w-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {method.label}
                  </span>
                </button>
              ))}
            </div>

            {paymentMethod === "CUSTOM" &&
              customPayments.CASH +
                customPayments.TELEBIRR +
                customPayments.CBE >
                0 && (
                <>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Total Order</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatMoney(total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Added Payments</span>
                      <span className="font-bold text-emerald-600">
                        {formatMoney(
                          customPayments.CASH +
                            customPayments.TELEBIRR +
                            customPayments.CBE,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-50 pt-3 dark:border-slate-800">
                      <span className="text-xs font-black uppercase tracking-widest">
                        {customPayments.CASH +
                          customPayments.TELEBIRR +
                          customPayments.CBE >
                        total
                          ? "Change Due"
                          : "Remaining Balance"}
                      </span>
                      <span
                        className={cn(
                          "text-xl font-black tracking-tight",
                          customPayments.CASH +
                            customPayments.TELEBIRR +
                            customPayments.CBE >=
                            total
                            ? "text-emerald-600"
                            : "text-rose-500",
                        )}
                      >
                        {formatMoney(
                          Math.abs(
                            total -
                              (customPayments.CASH +
                                customPayments.TELEBIRR +
                                customPayments.CBE),
                          ),
                        )}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
                      <div
                        className={cn(
                          "h-full transition-all duration-500",
                          customPayments.CASH +
                            customPayments.TELEBIRR +
                            customPayments.CBE >=
                            total
                            ? "bg-emerald-500"
                            : "bg-indigo-600",
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            ((customPayments.CASH +
                              customPayments.TELEBIRR +
                              customPayments.CBE) /
                              (total || 1)) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {[
                    { id: "CASH", label: "Cash", icon: HandCoins },
                    { id: "TELEBIRR", label: "Telebirr", icon: Smartphone },
                    { id: "CBE", label: "CBE", icon: Landmark },
                  ].map((method) => (
                    <div
                      key={method.id}
                      className={cn(
                        "flex items-center mb-3 rounded-2xl border bg-white p-1 transition-all shadow-sm dark:bg-slate-900 dark:border-slate-800",
                        "border-slate-100",
                      )}
                    >
                      <p className="flex-3 bg-transparent px-3 py-3 text-sm font-bold outline-none placeholder:text-slate-300 w-full">
                        {customPayments[
                          method.id as keyof typeof customPayments
                        ] || ""}
                      </p>
                      <div
                        className={cn(
                          "flex-1 rounded-xl py-3 text-xs font-bold transition-all border min-w-[100px] flex items-center justify-center",
                          customPayments[
                            method.id as keyof typeof customPayments
                          ] > 0
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                            : "bg-slate-50 text-slate-400 border-slate-100",
                        )}
                      >
                        {method.label}
                      </div>
                    </div>
                  ))}
                  {/* Edit Payment */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => setIsCustomPaymentOpen(true)}
                      className="rounded-xl  px-6 py-3 text-[10px] font-black text-slate-600 bg-indigo-600 py-5 text-xs font-black uppercase tracking-widest text-white  transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Edit Payment
                    </button>
                  </div>
                </>
              )}
          </div>
        </div>

        {/* Payment */}
        <div className="bento-card p-5 border-none shadow-sm bg-white dark:bg-slate-900">
          <div className="mb-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <CreditCard className="h-3 w-3" /> Cash Received
            </label>
            {paymentMethod === "CUSTOM" ? (
              <p className="w-full rounded-xl border border-slate-100 bg-slate-100 px-4 py-5 text-3xl font-black outline-none focus:border-indigo-600 dark:bg-slate-800/50 dark:border-slate-800">
                {customPayments.CASH +
                  customPayments.TELEBIRR +
                  customPayments.CBE}
              </p>
            ) : (
              <input
                type="number"
                value={paidAmount || ""}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-100 bg-slate-100 px-4 py-5 text-3xl font-black outline-none focus:border-indigo-600 dark:bg-slate-800/50 dark:border-slate-800"
                placeholder="0.00"
              />
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-900/10 mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
              Give Change
            </span>
            <span className="text-xl font-black text-indigo-600 tabular-nums">
              {formatMoney(change)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={useChangeAsTip}
              disabled={change <= 0}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl border py-4 text-[10px] font-black uppercase tracking-widest transition-all",
                change > 0
                  ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 shadow-sm"
                  : "border-slate-50 bg-slate-50 text-slate-200 cursor-not-allowed",
              )}
            >
              <Coins className="h-3 w-3" /> Use Change
            </button>
            <button
              onClick={handleCompleteSale}
              disabled={
                processing ||
                (cart.length === 0 &&
                  spinQuantity === 0 &&
                  spinResults.length === 0 &&
                  tipAmount <= 0)
              }
              className={cn(
                "flex-[1.8] flex items-center justify-center gap-2 rounded-xl py-4 text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-indigo-100",
                processing ||
                  (cart.length === 0 &&
                    spinQuantity === 0 &&
                    spinResults.length === 0 &&
                    tipAmount <= 0)
                  ? "bg-slate-100 text-slate-300 dark:bg-slate-800"
                  : "bg-indigo-600 text-white hover:bg-indigo-700",
              )}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Complete Sale
            </button>
          </div>
        </div>

        {/* Success Toast / Modal */}
        {lastTransaction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[3rem] bg-white dark:bg-slate-900 p-10 text-center shadow-2xl animate-in zoom-in duration-300">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-indigo-600 text-white shadow-xl shadow-indigo-100">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-slate-800">
                Paid Out
              </h3>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Logged as TX-
                {lastTransaction.id.toString().slice(-6).toUpperCase()}
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-center gap-1">
                    <Receipt className="h-3 w-3" /> Total
                  </span>
                  <p className="text-lg font-black mt-1 text-slate-900">
                    {Number(lastTransaction.totalAmount || total).toFixed(0)}{" "}
                    ETB
                  </p>
                </div>
                <div className="rounded-2xl bg-indigo-50 p-4 border border-indigo-100">
                  <span className="text-[10px] font-black uppercase text-indigo-400 flex items-center justify-center gap-1">
                    <HandCoins className="h-3 w-3" /> Tip
                  </span>
                  <p className="text-lg font-black mt-1 text-indigo-600">
                    {Number(
                      lastTransaction.tipAmount || tipAmount || 0,
                    ).toFixed(0)}{" "}
                    ETB
                  </p>
                </div>
              </div>

              <button
                onClick={() => setLastTransaction(null)}
                className="mt-8 w-full rounded-2xl bg-slate-900 py-5 text-xs font-black uppercase tracking-widest text-white hover:bg-black transition-all shadow-xl active:scale-[0.98]"
              >
                Close Receipt
              </button>
            </div>
          </div>
        )}
        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 z-[100] w-full max-w-xs -translate-x-1/2 px-4 animate-in slide-in-from-bottom-5 duration-300">
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl p-4 shadow-2xl border backdrop-blur-md",
                toast.type === "success"
                  ? "bg-emerald-500/90 border-emerald-400 text-white"
                  : toast.type === "error"
                    ? "bg-rose-500/90 border-rose-400 text-white"
                    : "bg-indigo-600/90 border-indigo-500 text-white",
              )}
            >
              {toast.type === "success" ? (
                <CheckCircle className="h-5 w-5 shrink-0" />
              ) : toast.type === "error" ? (
                <X className="h-5 w-5 shrink-0" />
              ) : (
                <Sparkles className="h-5 w-5 shrink-0" />
              )}
              <p className="text-xs font-black uppercase tracking-widest">
                {toast.message}
              </p>
            </div>
          </div>
        )}
      </div>
      {isCustomPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-[2.5rem] bg-white dark:bg-slate-900 p-8 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <button
              onClick={() => {
                setIsCustomPaymentOpen(false);
                // Only fallback to CASH if no custom payments were actually set
                const totalSet =
                  customPayments.CASH +
                  customPayments.TELEBIRR +
                  customPayments.CBE;
                if (totalSet === 0) {
                  setPaymentMethod("CASH");
                }
              }}
              className="rounded-full bg-slate-50 p-2 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center justify-between">
              <div>
                <div className="bento-card p-5 border-none shadow-sm bg-white dark:bg-slate-900">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Total Order</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatMoney(total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Added Payments</span>
                      <span className="font-bold text-emerald-600">
                        {formatMoney(
                          customPaymentsTemp.CASH +
                            customPaymentsTemp.TELEBIRR +
                            customPaymentsTemp.CBE,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-50 pt-3 dark:border-slate-800">
                      <span className="text-xs font-black uppercase tracking-widest">
                        {customPaymentsTemp.CASH +
                          customPaymentsTemp.TELEBIRR +
                          customPaymentsTemp.CBE >
                        total
                          ? "Change Due"
                          : "Remaining Balance"}
                      </span>
                      <span
                        className={cn(
                          "text-xl font-black tracking-tight",
                          customPaymentsTemp.CASH +
                            customPaymentsTemp.TELEBIRR +
                            customPaymentsTemp.CBE >=
                            total
                            ? "text-emerald-600"
                            : "text-rose-500",
                        )}
                      >
                        {formatMoney(
                          Math.abs(
                            total -
                              (customPaymentsTemp.CASH +
                                customPaymentsTemp.TELEBIRR +
                                customPaymentsTemp.CBE),
                          ),
                        )}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
                      <div
                        className={cn(
                          "h-full transition-all duration-500",
                          customPaymentsTemp.CASH +
                            customPaymentsTemp.TELEBIRR +
                            customPaymentsTemp.CBE >=
                            total
                            ? "bg-emerald-500"
                            : "bg-indigo-600",
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            ((customPaymentsTemp.CASH +
                              customPaymentsTemp.TELEBIRR +
                              customPaymentsTemp.CBE) /
                              (total || 1)) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {[
                    { id: "CASH", label: "Cash", icon: HandCoins },
                    { id: "TELEBIRR", label: "Telebirr", icon: Smartphone },
                    { id: "CBE", label: "CBE", icon: Landmark },
                  ].map((method) => (
                    <div
                      key={method.id}
                      className={cn(
                        "flex items-center mb-3 rounded-2xl border bg-white p-1 transition-all shadow-sm dark:bg-slate-900 dark:border-slate-800",
                        "border-slate-100",
                      )}
                    >
                      <input
                        type="number"
                        placeholder="Enter Amount"
                        value={
                          customPaymentsTemp[
                            method.id as keyof typeof customPaymentsTemp
                          ] || ""
                        }
                        onChange={(e) =>
                          setCustomPaymentsTemp((prev) => ({
                            ...prev,
                            [method.id]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="flex-3 bg-transparent px-3 py-3 text-sm font-bold outline-none placeholder:text-slate-300 w-full"
                      />
                      <div
                        className={cn(
                          "flex-1 rounded-xl py-3 text-xs font-bold transition-all border min-w-[100px] flex items-center justify-center",
                          customPaymentsTemp[
                            method.id as keyof typeof customPaymentsTemp
                          ] > 0
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                            : "bg-slate-50 text-slate-400 border-slate-100",
                        )}
                      >
                        {method.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => validateCustomPayment()}
              className="rounded-xl  px-6 py-3 text-[10px] font-black text-slate-600 bg-indigo-600 py-5 text-xs font-black uppercase tracking-widest text-white  transition-all active:scale-[0.98] cursor-pointer"
            >
              Set Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
