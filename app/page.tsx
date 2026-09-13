"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useSessionTimer } from "@/components/SessionTimerProvider";
import Navbar from "@/components/Navbar";
import Image from "next/image";

interface Transaction {
  id: string;
  dateTime: string;
  title: string;
  senderName?: string;
  recipientName?: string;
  category: "Debit" | "Credit";
  type: "DEBIT" | "CREDIT";
  centsAmount: number;
  balanceAfterCents: number;
}

interface TimeBadge {
  min_days: number;
  title: string;
  file_name: string;
  multiplier: string;
}

type PayFlowStep = "INPUT" | "CONFIRM" | "RECEIPT";

export default function CommBankStyleDashboard() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [sessionUserEmail, setSessionUserEmail] = useState<string>("");
  const [sessionUserId, setSessionUserId] = useState<string>("");

  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [mounted, setMounted] = useState<boolean>(false);

  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [accumulatedDays, setAccumulatedDays] = useState<number>(0);
  const [currentBadge, setCurrentBadge] = useState<TimeBadge | null>(null);
  
  // DYNAMIC TIMER, MULTIPLIER & CLAIM LINK
  const { accumulatedMs: activeSessionMilliseconds, pendingBalanceCents, multiplier, claimPendingBalance } = useSessionTimer();

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [recipient, setRecipient] = useState<string>("");
  const [dollarInput, setDollarInput] = useState<string>("");
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [payStep, setPayStep] = useState<PayFlowStep>("INPUT");
  const [completedTxn, setCompletedTxn] = useState<Transaction | null>(null);

  const [viewingTxn, setViewingTxn] = useState<Transaction | null>(null);

  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 30;

  // Floating money animation state ("rightGreen" for pending claim, "top" for admin fund injection)
  const [floatingCoins, setFloatingCoins] = useState<{ id: number; text: string; animType: 'rightGreen' | 'top' }[]>([]);

  const fetchLatestBalance = useCallback(async (username: string): Promise<number | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("balance_cents")
      .eq("username", username)
      .single();
    
    if (data) {
      if (typeof data.balance_cents === "number") setBalanceCents(data.balance_cents);
      return data.balance_cents;
    }
    return balanceCents;
  }, [supabase, balanceCents]);

  useEffect(() => {
    setMounted(true);
    async function checkAuthAndApproval() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        const email = session.user.email || "";
        setSessionUserEmail(email);
        setSessionUserId(session.user.id);

        let targetUser = "";
        let approvedStatus = false;
        const nowIso = new Date().toISOString();

        if (email.toLowerCase() === "lambertdavid1992@gmail.com") {
          targetUser = "KingDavid";
          setCurrentUsername("KingDavid");
          approvedStatus = true;

          await supabase
            .from("profiles")
            .update({ is_approved: true, user_id: session.user.id, session_start_timestamp: nowIso })
            .eq("username", "KingDavid");
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", session.user.id)
            .single();

          if (profile) {
            targetUser = profile.username;
            setCurrentUsername(profile.username);
            approvedStatus = Boolean(profile.is_approved);
          } else {
            router.push("/login");
            return;
          }
        }

        setIsApproved(approvedStatus);

      } catch (err) {
        console.error("Auth verification failed:", err);
        router.push("/login");
      } finally {
        setAuthLoading(false);
      }
    }

    checkAuthAndApproval();
  }, [router, supabase]);

  const loadUserData = useCallback(async () => {
    if (!currentUsername) return;
    try {
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", currentUsername)
        .single();

      if (profileError || !profileData) {
        const { data: newProfile } = await supabase
          .from("profiles")
          .upsert({ 
            username: currentUsername, 
            balance_cents: 0, 
            is_approved: currentUsername === "KingDavid", 
            accumulated_session_seconds: 0
          })
          .select()
          .single();
        profileData = newProfile;
      }

      if (profileData) {
        setBalanceCents(profileData.balance_cents ?? 0);
        const days = profileData.accumulated_days ?? Math.floor((profileData.accumulated_session_seconds || 0) / 86400);
        setAccumulatedDays(days);

        const { data: badgeDataArray } = await supabase
          .from("time_badges")
          .select("*")
          .lte("min_days", days)
          .order("min_days", { ascending: false })
          .limit(1);

        if (badgeDataArray && badgeDataArray.length > 0) {
          setCurrentBadge(badgeDataArray[0]);
        }
      }

      const { data: txnsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("username", currentUsername)
        .order("created_at", { ascending: false });

      if (txnsData && txnsData.length > 0) {
        const formattedTxns: Transaction[] = txnsData.map((t) => {
          const isSpecialBankTxn = t.title === "Admin Capital Injection" || t.title === "Pending Balance Transfer";
          return {
            id: t.id,
            dateTime: t.date_time,
            title: t.title,
            senderName: isSpecialBankTxn ? undefined : (t.category === "Credit" ? (t.recipient_name || undefined) : currentUsername),
            recipientName: isSpecialBankTxn ? currentUsername : (t.category === "Debit" ? (t.recipient_name || undefined) : currentUsername),
            category: t.category as "Debit" | "Credit",
            type: t.type as "DEBIT" | "CREDIT",
            centsAmount: Number(t.cents_amount),
            balanceAfterCents: Number(t.balance_after_cents),
          };
        });
        setTransactions(formattedTxns);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error("Failed to load user data from Supabase", err);
    }
  }, [currentUsername, supabase]);

  useEffect(() => {
    if (!mounted || !currentUsername) return;
    loadUserData();
  }, [currentUsername, mounted, loadUserData]);

  const handleSignOut = async () => {
    if (currentUsername && isApproved) {
      try {
        const localToken = sessionStorage.getItem("lambert_active_token") || "";
        await supabase.rpc("end_session_secure", {
          target_username: currentUsername,
          session_token: localToken,
        });
      } catch (err) {
        console.error("Secure logout finalization failed:", err);
      }
    }
    await supabase.auth.signOut();
    sessionStorage.removeItem("lambert_active_token");
    localStorage.removeItem("lambert_cached_session_ms");
    router.push("/login");
  };

  useEffect(() => {
    if (!mounted || !currentUsername) return;

    const interval = setInterval(async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance_cents, is_approved, accumulated_days, accumulated_session_seconds")
        .eq("username", currentUsername)
        .single();

      if (profile) {
        if (typeof profile.balance_cents === "number") {
          setBalanceCents(profile.balance_cents);
        }
        if (typeof profile.is_approved === "boolean") {
          setIsApproved(profile.is_approved);
        }
        const days = profile.accumulated_days ?? Math.floor((profile.accumulated_session_seconds || 0) / 86400);
        setAccumulatedDays(days);

        const { data: badgeDataArray } = await supabase
          .from("time_badges")
          .select("*")
          .lte("min_days", days)
          .order("min_days", { ascending: false })
          .limit(1);

        if (badgeDataArray && badgeDataArray.length > 0) {
          setCurrentBadge(badgeDataArray[0]);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [mounted, currentUsername, supabase]);

  const generateTxnId = (): string => {
    const timeSlice = Date.now().toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TXN-${timeSlice}-${rand}`;
  };

  const formatCurrency = (cents: number): string => {
    const abs = Math.abs(cents);
    const dollars = abs / 100;
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(dollars);
  };

  const formatPendingCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount);
  };

  const getDynamicTextSize = (cents: number | null) => {
    if (cents === null) return "text-2xl";
    const absDollars = Math.abs(cents) / 100;
    if (absDollars >= 1e12) return "text-xs";
    if (absDollars >= 1e11) return "text-sm";
    if (absDollars >= 1e10) return "text-base";
    if (absDollars >= 1e9) return "text-lg";
    return "text-2xl";
  };

  const getTimerBreakdown = (ms: number) => {
    const milliseconds = Math.floor((ms % 1000) / 10);
    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);

    const pad = (n: number, z = 2) => String(n).padStart(z, "0");
    return {
      days: String(days),
      hours: pad(hours),
      mins: pad(minutes),
      secs: pad(seconds),
      ms: pad(milliseconds, 2)
    };
  };

  const getCurrentFormattedDateTime = (): string => {
    const now = new Date();
    const datePart = now.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timePart = now
      .toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();

    return `${datePart}, ${timePart}`;
  };

  const getRequestedTimestamp = (): string => {
    const now = new Date();
    const datePart = now.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timePart = now
      .toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
    return `${datePart}, ${timePart}`;
  };

  const filteredTransactions = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();
    if (!cleanQuery) return transactions;

    const queryWithoutSymbol = cleanQuery.replace(/[$,]/g, "");

    return transactions.filter((tx) => {
      const matchesId = tx.id.toLowerCase().includes(cleanQuery);

      const textToSearch = tx.recipientName
        ? tx.recipientName.toLowerCase()
        : tx.title.toLowerCase();
      const matchesText =
        textToSearch.includes(cleanQuery) ||
        tx.category.toLowerCase().includes(cleanQuery);

      const formattedWithSign = formatCurrency(tx.centsAmount);
      const rawDecimal = (tx.centsAmount / 100).toFixed(2);
      const wholeDollars = Math.floor(tx.centsAmount / 100).toString();

      const matchesAmount =
        formattedWithSign.toLowerCase().includes(cleanQuery) ||
        rawDecimal.includes(queryWithoutSymbol) ||
        (queryWithoutSymbol.length > 0 && wholeDollars === queryWithoutSymbol);

      return matchesId || matchesText || matchesAmount;
    });
  }, [transactions, searchQuery]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentTransactions = filteredTransactions.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenPayModal = async () => {
    if (!isApproved) {
      return alert("Account pending approval. Pay Someone feature is locked.");
    }
    await fetchLatestBalance(currentUsername);
    if (balanceCents === null || balanceCents < 1) {
      return;
    }
    setPayStep("INPUT");
    setCompletedTxn(null);
    setShowPayModal(true);
  };

  const handleClosePayModal = () => {
    setShowPayModal(false);
    setPayStep("INPUT");
    setCompletedTxn(null);
    setRecipient("");
    setDollarInput("");
  };

  const handleReviewPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const latestBal = await fetchLatestBalance(currentUsername);

    if (latestBal === null || latestBal < 1) {
      return alert("You need a minimum balance of $0.01 to send a transfer.");
    }

    const cleanRecipient = recipient.trim().replace(/^@/, "");
    if (!cleanRecipient) {
      return alert("Please enter a valid recipient username.");
    }

    if (cleanRecipient.toLowerCase() === currentUsername.toLowerCase()) {
      return alert("You cannot send funds to your own username.");
    }

    const { data: recipientProfile, error: recipientError } = await supabase
      .from("profiles")
      .select("username")
      .ilike("username", cleanRecipient)
      .single();

    if (recipientError || !recipientProfile) {
      return alert("Unable to proceed: Recipient not found!");
    }

    const parsedDollars = parseFloat(dollarInput);
    if (isNaN(parsedDollars) || parsedDollars <= 0) {
      return alert("Please enter a valid amount.");
    }

    const transferCents = Math.round(parsedDollars * 100);

    if (transferCents < 1) {
      return alert("Minimum transfer amount is $0.01.");
    }

    if (transferCents > latestBal) {
      return alert("Value exceeds available balance.");
    }

    setPayStep("CONFIRM");
  };

  const handleExecutePayment = async () => {
    const latestBal = await fetchLatestBalance(currentUsername);
    if (latestBal === null || latestBal < 1) {
      alert("You need a minimum balance of $0.01 to send a transfer.");
      return;
    }

    const cleanRecipient = recipient.trim().replace(/^@/, "");
    const transferCents = Math.round(parseFloat(dollarInput) * 100);

    if (transferCents > latestBal) {
      alert("Value exceeds available balance.");
      setPayStep("INPUT");
      return;
    }

    const timestamp = getCurrentFormattedDateTime();
    const senderTxnId = generateTxnId();
    const recipTxnId = generateTxnId();

    const { data: newBalance, error } = await supabase.rpc("execute_secure_transfer", {
      p_sender_id: sessionUserId,
      p_sender_username: currentUsername,
      p_recipient_username: cleanRecipient,
      p_amount_cents: transferCents,
      p_timestamp_str: timestamp,
      p_sender_txn_id: senderTxnId,
      p_recip_txn_id: recipTxnId
    });

    if (error) {
      alert("Transfer failed: " + error.message);
      setPayStep("INPUT");
      return;
    }

    const senderTxn: Transaction = {
      id: senderTxnId,
      dateTime: timestamp,
      title: `Transfer to @${cleanRecipient}`,
      senderName: currentUsername,
      recipientName: cleanRecipient,
      category: "Debit",
      type: "DEBIT",
      centsAmount: transferCents,
      balanceAfterCents: Number(newBalance),
    };

    setBalanceCents(Number(newBalance));
    setTransactions((prev) => [senderTxn, ...prev]);
    setCurrentPage(1);
    setCompletedTxn(senderTxn);
    setPayStep("RECEIPT");
  };

  const handleTransferPending = async () => {
    if (!isApproved) {
      return alert("Account pending approval. Transfer feature is locked.");
    }

    const claimableCentsBefore = Math.floor(pendingBalanceCents * 100 + 1e-9);
    const claimableStr = formatCurrency(claimableCentsBefore);
    const success = await claimPendingBalance();
    
    if (success) {
      // Trigger green animation sliding in from the right (Pending balance side)
      const animId = Date.now();
      setFloatingCoins((prev) => [...prev, { id: animId, text: `+${claimableStr}`, animType: "rightGreen" }]);
      setTimeout(() => {
        setFloatingCoins((prev) => prev.filter((item) => item.id !== animId));
      }, 1200);

      await fetchLatestBalance(currentUsername);
      const { data: txnsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("username", currentUsername)
        .order("created_at", { ascending: false });

      if (txnsData && txnsData.length > 0) {
        const formattedTxns: Transaction[] = txnsData.map((t) => {
          const isSpecialBankTxn = t.title === "Admin Capital Injection" || t.title === "Pending Balance Transfer";
          return {
            id: t.id,
            dateTime: t.date_time,
            title: t.title,
            senderName: isSpecialBankTxn ? undefined : (t.category === "Credit" ? (t.recipient_name || undefined) : currentUsername),
            recipientName: isSpecialBankTxn ? currentUsername : (t.category === "Debit" ? (t.recipient_name || undefined) : currentUsername),
            category: t.category as "Debit" | "Credit",
            type: t.type as "DEBIT" | "CREDIT",
            centsAmount: Number(t.cents_amount),
            balanceAfterCents: Number(t.balance_after_cents),
          };
        });
        setTransactions(formattedTxns);
      }
    }
  };

  const exportToCSV = (useFiltered: boolean = false) => {
    const dataSet = useFiltered ? filteredTransactions : transactions;

    if (dataSet.length === 0) {
      return alert("No transactions available to export.");
    }

    const headers = [
      "Date & Time",
      "Reference ID",
      "Description",
      "Category",
      "Debit (AUD)",
      "Credit (AUD)",
      "Balance (AUD)",
    ];

    const rows = dataSet.map((tx) => {
      let desc = tx.title;
      if (tx.title === "Admin Capital Injection" || tx.title === "Pending Balance Transfer") {
        desc = tx.title;
      } else if (tx.recipientName && tx.title.startsWith("Transfer to ")) {
        desc = `Transfer to @${tx.recipientName}`;
      }
      return [
        `"${tx.dateTime}"`,
        `"${tx.id}"`,
        `"${desc}"`,
        `"${tx.category}"`,
        tx.type === "DEBIT" ? `"-${(tx.centsAmount / 100).toFixed(2)}"` : '""',
        tx.type === "CREDIT" ? `"+${(tx.centsAmount / 100).toFixed(2)}"` : '""',
        `"${(tx.balanceAfterCents / 100).toFixed(2)}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const fileTimestamp = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `LambertBank_Statement_${currentUsername}_${fileTimestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handlePrintStatement = () => {
    setShowExportMenu(false);
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const originalTitle = document.title;
    document.title = "Lambert Bank";
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const handlePrintIndividualReceipt = () => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const originalTitle = document.title;
    document.title = "Lambert Bank";
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 50);
  };

  const isAnyReceiptOpen = Boolean(
    (showPayModal && payStep === "RECEIPT") || viewingTxn
  );

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <p className="text-sm font-semibold text-gray-500">Loading Lambert Bank...</p>
      </div>
    );
  }

  const timerParts = getTimerBreakdown(activeSessionMilliseconds);
  const claimableCents = Math.floor(pendingBalanceCents * 100 + 1e-9);
  const isPayDisabled = balanceCents === null || balanceCents < 1;

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#222222] font-sans antialiased">
      <style>{`
        @keyframes slideFromRightGreen {
          0% { opacity: 0; transform: translate(50px, 0px) scale(0.85); }
          25% { opacity: 1; transform: translate(0px, 0px) scale(1.05); }
          100% { opacity: 0; transform: translate(-30px, 0px) scale(1); }
        }
        @keyframes fallDownTop {
          0% { opacity: 0; transform: translate(-50%, -30px) scale(0.85); }
          25% { opacity: 1; transform: translate(-50%, 4px) scale(1.05); }
          100% { opacity: 0; transform: translate(-50%, 40px) scale(1); }
        }
      `}</style>

      <div className={`hidden ${isAnyReceiptOpen ? "" : "print:block"} pt-10 px-10 pb-4 mb-4 border-b-2 border-gray-900`}>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">LAMBERT BANK</h1>
            <p className="text-xs text-gray-500 uppercase font-semibold mt-0.5">Official Account Statement</p>
          </div>
          <div className="text-right text-xs text-gray-600 space-y-0.5">
            <div>Account Holder: <strong>@{currentUsername}</strong></div>
            <div>Date Requested: <strong>{getRequestedTimestamp()}</strong></div>
            <div>Current Balance: <strong>{balanceCents !== null ? formatCurrency(balanceCents) : "$—"}</strong></div>
          </div>
        </div>
      </div>

      <Navbar 
        currentUsername={currentUsername} 
        onRefreshData={async () => {
          await loadUserData();
          const animId = Date.now();
          // Admin Capital Injection comes from the top in gold
          setFloatingCoins((prev) => [...prev, { id: animId, text: `+$1,000.00`, animType: "top" }]);
          setTimeout(() => {
            setFloatingCoins((prev) => prev.filter((item) => item.id !== animId));
          }, 1200);
        }}
      />

      <main className={`max-w-5xl mx-auto p-4 sm:p-6 space-y-6 ${isAnyReceiptOpen ? "print:hidden" : "print:p-10 print:max-w-none"}`}>
        
        {/* Pending Account Status Banner */}
        {!isApproved && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between shadow-xs print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-base">
                ⏳
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">Account Pending Approval</h3>
                <p className="text-[11px] text-amber-700">Your profile is currently under review by KingDavid. Some features like Pay Anyone and the Session Timer are locked.</p>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Metrics Grid (Reduced to 3 columns, shrunken internal vertical gaps) */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 print:hidden`}>
          
          {/* 1. BANK BALANCE CARD */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bank Balance</p>
              <div className="relative inline-block w-full">
                <p className={`font-extrabold text-[#b8860b] font-mono tracking-tight mt-0.5 truncate ${
                  getDynamicTextSize(balanceCents)
                }`} title={balanceCents !== null ? formatCurrency(balanceCents) : "$—"}>
                  {balanceCents !== null ? formatCurrency(balanceCents) : "$—"}
                </p>

                {floatingCoins.map((coin) => (
                  <span
                    key={coin.id}
                    className={`absolute pointer-events-none z-30 font-mono font-black text-sm whitespace-nowrap ${
                      coin.animType === "top"
                        ? "top-0 left-1/2 -translate-x-1/2 text-[#b8860b]"
                        : "top-1 right-0 text-[#0d8b07]"
                    }`}
                    style={{
                      animation:
                        coin.animType === "top"
                          ? "fallDownTop 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards"
                          : "slideFromRightGreen 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards",
                      textShadow: "0 2px 4px rgba(0,0,0,0.15)",
                    }}
                  >
                    {coin.text}
                  </span>
                ))}
              </div>
            </div>

            {isApproved && (
              <div className="mt-1 pt-1.5 border-t border-gray-100 flex flex-col gap-1">
                <button
                  onClick={handleOpenPayModal}
                  disabled={isPayDisabled}
                  title={isPayDisabled ? "Minimum balance of $0.01 required" : "Pay Someone"}
                  className={`w-full font-bold text-xs py-2 px-3 rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 ${
                    isPayDisabled
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 cursor-pointer"
                  }`}
                >
                  <span className="text-sm">⇄</span> Pay Someone
                </button>
                <p className="text-[11px] text-gray-500 font-mono text-center">ID: @{currentUsername}</p>
              </div>
            )}
          </div>

          {/* 2. PENDING BALANCE CARD */}
          {isApproved && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Pending Balance</p>
                <p className={`font-extrabold text-[#0d8b07] font-mono tracking-tight mt-0.5 truncate ${
                  getDynamicTextSize(Math.round(pendingBalanceCents * 100))
                }`} title={formatPendingCurrency(pendingBalanceCents)}>
                  {formatPendingCurrency(pendingBalanceCents)}
                </p>
              </div>

              <div className="mt-1 pt-1.5 border-t border-gray-100 flex flex-col gap-1">
                <div className="relative inline-block w-full">
                  <button
                    onClick={handleTransferPending}
                    disabled={claimableCents < 3}
                    title={claimableCents < 3 ? "Minimum transfer amount is $0.03" : "Claim whole cents to bank balance"}
                    className={`w-full py-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs ${
                      claimableCents < 3
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-[#0d8b07] hover:bg-[#0a6d05] text-white cursor-pointer shadow-sm"
                    }`}
                  >
                    <span>💸</span> Claim
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 text-center">Minimum transfer $0.03</p>
              </div>
            </div>
          )}

          {/* 3. TOTAL ACTIVITY TIMER CARD WITH TIME BADGE & EMBEDDED MULTIPLIER */}
          {isApproved && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              
              {/* TIME BADGE & EMBEDDED MULTIPLIER */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative w-9 h-9 shrink-0">
                    <Image
                      src={`/badges/time/${currentBadge?.file_name || 'time-waster.png'}`}
                      alt={currentBadge?.title || 'Time Waster'}
                      fill
                      className="object-contain drop-shadow-sm"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">Tier Rank</p>
                    <p className="text-xs font-bold text-gray-900 truncate">{currentBadge?.title || 'Time Waster'}</p>
                  </div>
                </div>
                
                {/* Small Text Multiplier Directly Under/Next to Badge */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-extrabold text-indigo-600 block">
                    x {multiplier.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-gray-400 block">
                    +0.01 / day
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Activity Timer</p>
                  <div className="flex items-center gap-1 font-mono text-[#b8860b] text-sm font-black tracking-tight mt-1">
                    <div className="flex flex-col items-center">
                      <span>{timerParts.days}</span>
                      <span className="text-[9px] text-gray-500 font-normal uppercase">Days</span>
                    </div>
                    <span>:</span>
                    <div className="flex flex-col items-center">
                      <span>{timerParts.hours}</span>
                      <span className="text-[9px] text-gray-500 font-normal uppercase">Hours</span>
                    </div>
                    <span>:</span>
                    <div className="flex flex-col items-center">
                      <span>{timerParts.mins}</span>
                      <span className="text-[9px] text-gray-500 font-normal uppercase">Mins</span>
                    </div>
                    <span>:</span>
                    <div className="flex flex-col items-center">
                      <span>{timerParts.secs}</span>
                      <span className="text-[9px] text-gray-500 font-normal uppercase">Secs</span>
                    </div>
                    <span>:</span>
                    <div className="flex flex-col items-center">
                      <span>{timerParts.ms}</span>
                      <span className="text-[9px] text-gray-500 font-normal uppercase">Ms</span>
                    </div>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-full bg-amber-50 text-[#b8860b] flex items-center justify-center font-bold text-lg shrink-0">
                  ⏱️
                </div>
              </div>

            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
          <div className="p-4 sm:px-5 sm:py-4 border-b border-gray-200 flex flex-col lg:flex-row justify-between lg:items-center gap-3 bg-gray-50/50 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Transactions</h2>
                <span className="text-[11px] text-gray-400 font-normal">(Click any row to view & print receipt)</span>
              </div>
              <span className="text-xs text-gray-500">
                Showing {filteredTransactions.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length}
                {searchQuery.trim() && ` (filtered from ${transactions.length})`}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-72 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#b8860b] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3" />
                  </svg>
                </div>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSearchQuery("");
                  }}
                  placeholder="Search ref ID, recipient, or amount..."
                  className="w-full pl-9 pr-8 py-2 text-xs text-gray-900 bg-gray-100/90 hover:bg-gray-100 focus:bg-white border border-gray-200 focus:border-[#e7b833] rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-100 transition-all placeholder:text-gray-400 font-medium"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                  >
                    <span className="bg-gray-200 hover:bg-gray-300 rounded-full p-0.5 transition">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  </button>
                )}
              </div>

              <div className="relative shrink-0" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <span>Export</span>
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 z-40 text-xs text-gray-700">
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Export Format
                    </div>
                    <button
                      type="button"
                      onClick={() => exportToCSV(false)}
                      className="w-full px-3 py-2 text-left hover:bg-amber-50 hover:text-[#b8860b] flex items-center justify-between cursor-pointer transition"
                    >
                      <span>Download Statement (CSV)</span>
                      <span className="text-[10px] text-gray-400">All</span>
                    </button>
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => exportToCSV(true)}
                        className="w-full px-3 py-2 text-left hover:bg-amber-50 hover:text-[#b8860b] flex items-center justify-between cursor-pointer transition"
                      >
                        <span>Download Filtered (CSV)</span>
                        <span className="text-[10px] text-[#b8860b] font-semibold">{filteredTransactions.length}</span>
                      </button>
                    )}
                    <div className="h-px bg-gray-100 my-1" />
                    <button
                      type="button"
                      onClick={handlePrintStatement}
                      className="w-full px-3 py-2 text-left hover:bg-amber-50 hover:text-[#b8860b] flex items-center justify-between cursor-pointer transition"
                    >
                      <span>Print / Save Statement (PDF)</span>
                      <span className="text-[10px] text-gray-400">PDF</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print:bg-white">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wider border-b border-gray-200 print:bg-gray-100 print:text-gray-900">
                  <th className="py-3 px-5 border-r border-gray-200">Transaction Information</th>
                  <th className="py-3 px-5 border-r border-gray-200 text-right w-36">Debits</th>
                  <th className="py-3 px-5 border-r border-gray-200 text-right w-36">Credits</th>
                  <th className="py-3 px-5 text-right w-36">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm print:divide-gray-300">
                {currentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-gray-500 text-sm">
                      {searchQuery.trim() ? (
                        `No transactions matching "${searchQuery}".`
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <p className="text-gray-600 font-medium">No transaction records found. Get started below:</p>
                          <div className="flex items-center gap-3 text-xs font-bold">
                            {isApproved && (
                              <button
                                type="button"
                                onClick={handleTransferPending}
                                disabled={claimableCents < 3}
                                className={`transition cursor-pointer ${
                                  claimableCents < 3 
                                    ? "text-gray-400 cursor-not-allowed" 
                                    : "text-[#0d8b07] hover:underline"
                                }`}
                              >
                                💸 Claim Pending Balance {claimableCents < 3 ? "(Min $0.03)" : ""}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  currentTransactions.map((tx) => {
                    const isCredit = tx.type === "CREDIT";
                    const isSpecial = tx.title === "Admin Capital Injection" || tx.title === "Pending Balance Transfer";
                    const displayTitle = isSpecial
                      ? tx.title
                      : (tx.recipientName && tx.title.startsWith("Transfer to ")
                          ? `Transfer to @${tx.recipientName}`
                          : tx.title);

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setViewingTxn(tx)}
                        title="Click to view & print official receipt"
                        className="hover:bg-amber-50/50 cursor-pointer transition group print:bg-white print:hover:bg-transparent"
                      >
                        <td className="py-3.5 px-5 border-r border-gray-100 print:border-gray-300 print:bg-white">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900 group-hover:text-[#b8860b] print:text-gray-900 print:group-hover:text-gray-900 transition">
                              {!isSpecial && tx.recipientName && tx.title.startsWith("Transfer to ") ? (
                                <>
                                  Transfer to{" "}
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/user/${tx.recipientName}`);
                                    }}
                                    className="text-[#b8860b] hover:underline font-bold cursor-pointer"
                                    title={`View @${tx.recipientName}'s Profile & Portfolio`}
                                  >
                                    @{tx.recipientName}
                                  </span>
                                </>
                              ) : (
                                displayTitle
                              )}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition print:hidden">
                              View Receipt ↗
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 font-mono print:text-gray-600">
                            {tx.dateTime} • {tx.category} • Ref: {tx.id}
                          </div>
                        </td>

                        <td className="py-3.5 px-5 border-r border-gray-100 print:border-gray-300 print:bg-white text-right font-mono">
                          {!isCredit ? (
                            <span className="font-semibold text-rose-600 print:text-rose-600">
                              -{formatCurrency(tx.centsAmount)}
                            </span>
                          ) : (
                            <span className="text-gray-300 print:text-gray-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-5 border-r border-gray-100 print:border-gray-300 print:bg-white text-right font-mono">
                          {isCredit ? (
                            <span className="font-semibold text-emerald-600 print:text-emerald-600">
                              +{formatCurrency(tx.centsAmount)}
                            </span>
                          ) : (
                            <span className="text-gray-300 print:text-gray-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-5 text-right font-mono font-bold text-gray-900 print:text-gray-900 print:bg-white">
                          {formatCurrency(tx.balanceAfterCents)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length > ITEMS_PER_PAGE && (
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-600 print:hidden">
              <span>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (30 items / page)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded border border-gray-300 bg-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded border border-gray-300 bg-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* PAYMENT FLOW MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden transition-all print:border-none print:shadow-none print:max-w-none">
            <div className="bg-[#1e293b] text-white p-4 flex justify-between items-center print:hidden">
              <h3 className="text-base font-bold">
                {payStep === "INPUT" && "Pay Someone"}
                {payStep === "CONFIRM" && "Review & Confirm Transfer"}
                {payStep === "RECEIPT" && "OFFICIAL TRANSACTION RECEIPT"}
              </h3>
              {payStep !== "RECEIPT" && (
                <button
                  onClick={handleClosePayModal}
                  className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="h-1 bg-[#e7b833] print:hidden" />

            {payStep === "INPUT" && (
              <form onSubmit={handleReviewPayment} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Recipient Payment ID (Username)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 font-semibold">@</span>
                    <input
                      type="text"
                      required
                      placeholder="JohnSmith (Case Insensitive)"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value.replace(/^@/, ""))}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded text-sm text-black focus:outline-none focus:border-[#e7b833]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Send funds securely across verified user accounts instantly!
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Amount ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 font-semibold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={balanceCents !== null ? balanceCents / 100 : undefined}
                      value={dollarInput}
                      onChange={(e) => setDollarInput(e.target.value)}
                      placeholder="1.00"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded text-sm text-black font-mono focus:outline-none focus:border-[#e7b833]"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex justify-between">
                    <span>Minimum: <strong>$0.01</strong></span>
                    <span>Available balance: <strong>{balanceCents !== null ? formatCurrency(balanceCents) : "$—"}</strong></span>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>From:</span>
                    <span className="font-semibold text-gray-800">@{currentUsername}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClosePayModal}
                    className="w-1/2 py-2.5 rounded text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 rounded text-sm font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
                  >
                    Review Transfer
                  </button>
                </div>
              </form>
            )}

            {payStep === "CONFIRM" && (
              <div className="p-5 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex gap-3 text-amber-900">
                  <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <div className="text-xs leading-relaxed">
                    <strong className="font-bold block text-amber-950">Confirm Payment Details</strong>
                    Instant transfers cannot be reversed. Please verify that the recipient username is correct before sending.
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2.5 text-xs text-gray-700">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-gray-500 uppercase tracking-wider font-semibold text-[10px]">Transfer Amount</span>
                    <span className="text-xl font-mono font-bold text-gray-900">
                      ${parseFloat(dollarInput).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sender ID:</span>
                    <strong className="text-gray-900 font-mono text-sm">@{currentUsername}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Recipient ID:</span>
                    <strong className="text-gray-900 font-mono text-sm">@{recipient.trim().replace(/^@/, "")}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-semibold text-gray-900">Debit</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200">
                    <span className="text-gray-500">Remaining Balance:</span>
                    <span className="font-mono font-semibold text-gray-800">
                      {balanceCents !== null ? formatCurrency(balanceCents - Math.round(parseFloat(dollarInput) * 100)) : "$—"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayStep("INPUT")}
                    className="w-1/2 py-2.5 rounded text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Back / Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePayment}
                    className="w-1/2 py-2.5 rounded text-sm font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
                  >
                    Authorize & Send
                  </button>
                </div>
              </div>
            )}

            {payStep === "RECEIPT" && completedTxn && (
              <div className="p-6 text-center space-y-5 print:pt-14 print:px-12 print:pb-8 print:max-w-xl print:mx-auto">
                <div className="hidden print:block pb-4 mb-4 border-b border-gray-300 text-left">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-xl font-black text-gray-900">LAMBERT BANK</h1>
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">OFFICIAL TRANSACTION RECEIPT</p>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      <div>Date Requested: <strong>{getRequestedTimestamp()}</strong></div>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-1.5 bg-rose-100 text-rose-800 print:bg-rose-100 print:text-rose-800">
                    Settled Transfer
                  </span>
                  <h4 className="text-xl font-extrabold text-gray-900">
                    {completedTxn.recipientName ? `Transfer to @${completedTxn.recipientName}` : completedTxn.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">Reference: {completedTxn.id}</p>
                </div>

                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-left space-y-2 text-xs print:border-solid print:bg-white print:p-6">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">Total Amount</span>
                    <span className={`text-base font-mono font-black ${
                      completedTxn.type === "CREDIT" ? "text-emerald-600 print:text-emerald-600" : "text-rose-600 print:text-rose-600"
                    }`}>
                      {completedTxn.type === "CREDIT" ? "+" : "-"}{formatCurrency(completedTxn.centsAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sender ID</span>
                    <span className="font-semibold text-gray-900 font-mono">@{completedTxn.senderName || currentUsername}</span>
                  </div>
                  {completedTxn.recipientName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Recipient ID</span>
                      <span className="font-semibold text-gray-900 font-mono">@{completedTxn.recipientName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Category</span>
                    <span className="text-gray-800">{completedTxn.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date & Timestamp</span>
                    <span className="text-gray-800 font-mono">{completedTxn.dateTime}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200">
                    <span className="text-gray-500">Running Balance</span>
                    <span className="font-mono font-bold text-gray-900">
                      {formatCurrency(completedTxn.balanceAfterCents)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1 print:hidden">
                  <button
                    type="button"
                    onClick={handlePrintIndividualReceipt}
                    className="w-1/2 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m11.318-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                    </svg>
                    Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePayModal}
                    className="w-1/2 py-2.5 rounded-lg text-sm font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow-sm transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORICAL RECEIPT MODAL */}
      {viewingTxn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden transition-all print:border-none print:shadow-none print:max-w-none">
            <div className="bg-[#1e293b] text-white p-4 flex justify-between items-center print:hidden">
              <h3 className="text-base font-bold">OFFICIAL TRANSACTION RECEIPT</h3>
              <button
                onClick={() => setViewingTxn(null)}
                className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833] print:hidden" />

            <div className="p-6 text-center space-y-5 print:pt-14 print:px-12 print:pb-8 print:max-w-xl print:mx-auto">
              <div className="hidden print:block pb-4 mb-4 border-b border-gray-300 text-left">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-black text-gray-900">LAMBERT BANK</h1>
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">OFFICIAL TRANSACTION RECEIPT</p>
                  </div>
                  <div className="text-right text-xs text-gray-600">
                    <div>Date Requested: <strong>{getRequestedTimestamp()}</strong></div>
                  </div>
                </div>
              </div>

              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-1.5 ${
                  viewingTxn.type === "CREDIT"
                    ? "bg-emerald-100 text-emerald-800 print:bg-emerald-100 print:text-emerald-800"
                    : "bg-rose-100 text-rose-800 print:bg-rose-100 print:text-rose-800"
                }`}>
                  {viewingTxn.type === "CREDIT" ? "Direct Credit" : "Settled Transfer"}
                </span>
                <h4 className="text-xl font-extrabold text-gray-900">
                  {viewingTxn.title === "Admin Capital Injection" || viewingTxn.title === "Pending Balance Transfer"
                    ? viewingTxn.title
                    : (viewingTxn.recipientName ? `Transfer to @${viewingTxn.recipientName}` : viewingTxn.title)}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">Reference: {viewingTxn.id}</p>
              </div>

              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-left space-y-2 text-xs print:border-solid print:bg-white print:p-6">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Total Amount</span>
                  <span className={`text-base font-mono font-black ${
                    viewingTxn.type === "CREDIT" ? "text-emerald-600 print:text-emerald-600" : "text-rose-600 print:text-rose-600"
                  }`}>
                    {viewingTxn.type === "CREDIT" ? "+" : "-"}{formatCurrency(viewingTxn.centsAmount)}
                  </span>
                </div>
                {viewingTxn.title !== "Admin Capital Injection" && viewingTxn.title !== "Pending Balance Transfer" && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sender ID</span>
                    <span className="font-semibold text-gray-900 font-mono">@{viewingTxn.senderName || currentUsername}</span>
                  </div>
                )}
                {viewingTxn.recipientName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Recipient ID</span>
                    <span className="font-semibold text-gray-900 font-mono">@{viewingTxn.recipientName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="text-gray-800">{viewingTxn.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date & Timestamp</span>
                  <span className="text-gray-800 font-mono">{viewingTxn.dateTime}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-200">
                  <span className="text-gray-500">Running Balance</span>
                  <span className="font-mono font-bold text-gray-900">
                    {formatCurrency(viewingTxn.balanceAfterCents)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1 print:hidden">
                <button
                  type="button"
                  onClick={handlePrintIndividualReceipt}
                  className="w-1/2 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m11.318-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                  </svg>
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTxn(null)}
                  className="w-1/2 py-2.5 rounded-lg text-sm font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow-sm transition cursor-pointer"
                >
                  Close / Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}