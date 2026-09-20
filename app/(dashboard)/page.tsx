"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, usePathname } from "next/navigation";
import { useSessionTimer } from "@/components/SessionTimerProvider";

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
  quirky_phrase?: string;
}

type PayFlowStep = "INPUT" | "CONFIRM" | "RECEIPT";

function getTransactionIcon(type: string, title: string = "") {
  const lower = title.toLowerCase();
  if (lower.includes("claim") || lower.includes("pending balance transfer")) {
    return (
      <div className="w-8 h-8 rounded-full bg-[#eaeaea] text-gray-800 flex items-center justify-center shrink-0 font-bold text-xs shadow-2xs relative overflow-hidden" title="Claim / Reward">
        <svg className="w-5 h-5 text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="7" />
          <path d="M10 7.5v5m-1.5-3.5h3" />
          <circle cx="17.5" cy="17.5" r="4.5" fill="white" stroke="currentColor" strokeWidth="2" />
          <path d="M17.5 15.5v4m-2-2h4" />
        </svg>
      </div>
    );
  }
  if (lower.includes("admin capital injection")) {
    return (
      <div className="w-8 h-8 rounded-full bg-[#eaeaea] text-gray-800 flex items-center justify-center shrink-0 font-bold text-xs shadow-2xs" title="Admin Capital Injection">
        👑
      </div>
    );
  }
  if (type === "DEBIT" || lower.includes("transfer to")) {
    return (
      <div className="w-8 h-8 rounded-full bg-[#eaeaea] text-gray-800 flex items-center justify-center shrink-0 shadow-2xs" title="Outgoing Transfer">
        <span className="text-sm font-bold">⇄</span>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[#eaeaea] text-gray-800 flex items-center justify-center shrink-0 shadow-2xs relative overflow-hidden" title="Incoming Transfer / Gift">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    </div>
  );
}

function formatDateDDMMYYYY(dateTimeStr: string): string {
  if (!dateTimeStr) return "";
  const d = new Date(dateTimeStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return dateTimeStr.split(",")[0] || dateTimeStr;
}

export default function CommBankStyleDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [sessionUserEmail, setSessionUserEmail] = useState<string>("");
  const [sessionUserId, setSessionUserId] = useState<string>("");

  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [userGender, setUserGender] = useState<string>("");
  const [mounted, setMounted] = useState<boolean>(false);

  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [accumulatedDays, setAccumulatedDays] = useState<number>(0);
  const [currentBadge, setCurrentBadge] = useState<TimeBadge | null>(null);
  const [nextBadge, setNextBadge] = useState<TimeBadge | null>(null);
  const [accumulatedSessionSeconds, setAccumulatedSessionSeconds] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState<number>(0);

  // Dynamic Session Timer, Multiplier & Live Total
  const { accumulatedMs: activeSessionMilliseconds, pendingBalanceCents, multiplier, claimPendingBalance, addSessionDays, totalDays } = useSessionTimer();

  const [allBadges, setAllBadges] = useState<TimeBadge[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [recipient, setRecipient] = useState<string>("");
  const [dollarInput, setDollarInput] = useState<string>("");
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [payStep, setPayStep] = useState<PayFlowStep>("INPUT");
  const [completedTxn, setCompletedTxn] = useState<Transaction | null>(null);

  const [viewingTxn, setViewingTxn] = useState<Transaction | null>(null);

  // Input refs for native constraint tooltips
  const recipientInputRef = useRef<HTMLInputElement>(null);
  const dollarInputRef = useRef<HTMLInputElement>(null);

  // Admin Capital Injection Modal State
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [adminDollarInput, setAdminDollarInput] = useState<string>("");

  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Local state for dashboard custom Add Days modal (++)
  const [showDashboardAddDaysModal, setShowDashboardAddDaysModal] = useState<boolean>(false);
  const [dashboardAddDaysInput, setDashboardAddDaysInput] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 30;

  // Floating money animation state
  const [floatingCoins, setFloatingCoins] = useState<{ id: number; text: string; animType: 'floatUp' | 'top' }[]>([]);

  const fetchBadgeCounts = useCallback(async () => {
    if (!currentUsername) return;

    if (currentUsername === "KingDavid") {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_approved", false);

      if (!error && count !== null) {
        setPendingCount(count);
      }
    }

    const { count: friendCount, error: friendError } = await supabase
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .eq("receiver_username", currentUsername)
      .eq("status", "pending");

    if (!friendError && friendCount !== null) {
      setFriendRequestsCount(friendCount);
    }
  }, [currentUsername, supabase]);

  useEffect(() => {
    fetchBadgeCounts();

    const interval = setInterval(() => {
      fetchBadgeCounts();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchBadgeCounts]);

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

          const { data: adminProf } = await supabase
            .from("profiles")
            .select("gender")
            .eq("username", "KingDavid")
            .single();
          if (adminProf) setUserGender(adminProf.gender || "");

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
            setUserGender(profile.gender || "");
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
        setAccumulatedSessionSeconds(profileData.accumulated_session_seconds || 0);
        setUserGender(profileData.gender || "");
        const days = profileData.accumulated_days ?? Math.floor((profileData.accumulated_session_seconds || 0) / 86400);
        setAccumulatedDays(days);
      }

      const { data: badgesList } = await supabase
        .from("time_badges")
        .select("*")
        .order("min_days", { ascending: true });

      if (badgesList) {
        setAllBadges(badgesList);
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

  // Instant local derivation of time ranks using live totalDays
  useEffect(() => {
    if (allBadges.length === 0) return;

    const matchedCurrent = [...allBadges]
      .reverse()
      .find((b) => totalDays >= b.min_days) || allBadges[0];

    const matchedNext = allBadges.find((b) => b.min_days > totalDays) || null;

    setCurrentBadge(matchedCurrent);
    setNextBadge(matchedNext);
  }, [totalDays, allBadges]);

  const handleSignOut = async () => {
    if (currentUsername && isApproved) {
      try {
        const localToken = sessionStorage.getItem("socialtime_active_token") || "";
        await supabase.rpc("end_session_secure", {
          target_username: currentUsername,
          session_token: localToken,
        });
      } catch (err) {
        console.error("Secure logout finalization failed:", err);
      }
    }
    await supabase.auth.signOut();
    sessionStorage.removeItem("socialtime_active_token");
    localStorage.removeItem("socialtime_cached_session_ms");
    router.push("/login");
  };

  // Realtime subscription for instant profile updates & live transaction sync
  useEffect(() => {
    if (!mounted || !currentUsername) return;

    const channel = supabase
      .channel(`user-live-sync-${currentUsername}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `username=eq.${currentUsername}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated) {
            if (typeof updated.balance_cents === "number") {
              setBalanceCents(updated.balance_cents);
            }
            if (typeof updated.is_approved === "boolean") {
              setIsApproved(updated.is_approved);
            }
            if (typeof updated.accumulated_session_seconds === "number") {
              setAccumulatedSessionSeconds(updated.accumulated_session_seconds);
            }
            if (typeof updated.accumulated_days === "number") {
              setAccumulatedDays(updated.accumulated_days);
            }
            if (typeof updated.gender === "string") {
              setUserGender(updated.gender);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `username=eq.${currentUsername}`,
        },
        async () => {
          await loadUserData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mounted, currentUsername, supabase, loadUserData]);

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

  // Synchronized form validation: uses anchored input tooltips for both recipient and amount
  const handleReviewPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const latestBal = await fetchLatestBalance(currentUsername);

    if (latestBal === null || latestBal < 1) {
      dollarInputRef.current?.setCustomValidity("You need a minimum balance of $0.01 to send a transfer.");
      dollarInputRef.current?.reportValidity();
      return;
    }

    const cleanRecipient = recipient.trim().replace(/^@/, "");
    if (!cleanRecipient) {
      recipientInputRef.current?.setCustomValidity("Please enter a valid recipient username.");
      recipientInputRef.current?.reportValidity();
      return;
    }

    if (cleanRecipient.toLowerCase() === currentUsername.toLowerCase()) {
      recipientInputRef.current?.setCustomValidity("You cannot send funds to your own username.");
      recipientInputRef.current?.reportValidity();
      return;
    }

    const { data: recipientProfile, error: recipientError } = await supabase
      .from("profiles")
      .select("username")
      .ilike("username", cleanRecipient)
      .single();

    if (recipientError || !recipientProfile) {
      recipientInputRef.current?.setCustomValidity("Unable to proceed: Recipient not found!");
      recipientInputRef.current?.reportValidity();
      return;
    }

    const parsedDollars = parseFloat(dollarInput);
    if (isNaN(parsedDollars) || parsedDollars <= 0) {
      dollarInputRef.current?.setCustomValidity("Please enter a valid amount.");
      dollarInputRef.current?.reportValidity();
      return;
    }

    const transferCents = Math.round(parsedDollars * 100);

    if (transferCents < 1) {
      dollarInputRef.current?.setCustomValidity("Minimum transfer amount is $0.01.");
      dollarInputRef.current?.reportValidity();
      return;
    }

    if (transferCents > latestBal) {
      dollarInputRef.current?.setCustomValidity("Value exceeds available balance.");
      dollarInputRef.current?.reportValidity();
      return;
    }

    setPayStep("CONFIRM");
  };

  const handleExecutePayment = async () => {
    const latestBal = await fetchLatestBalance(currentUsername);
    if (latestBal === null || latestBal < 1) {
      dollarInputRef.current?.setCustomValidity("You need a minimum balance of $0.01 to send a transfer.");
      dollarInputRef.current?.reportValidity();
      return;
    }

    const cleanRecipient = recipient.trim().replace(/^@/, "");
    const transferCents = Math.round(parseFloat(dollarInput) * 100);

    if (transferCents > latestBal) {
      dollarInputRef.current?.setCustomValidity("Value exceeds available balance.");
      dollarInputRef.current?.reportValidity();
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
      const animId = Date.now();
      setFloatingCoins((prev) => [...prev, { id: animId, text: `+${claimableStr}`, animType: "floatUp" }]);
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

  const handleExecuteDashboardAddDays = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(dashboardAddDaysInput.trim(), 10);
    if (isNaN(days) || days <= 0) {
      return alert("Please enter a valid positive number of days.");
    }

    const success = await addSessionDays(days);
    if (!success) {
      alert("Failed to add days.");
    } else {
      setShowDashboardAddDaysModal(false);
      setDashboardAddDaysInput("");
      await loadUserData();
    }
  };

  const handleAdminInject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUsername !== "KingDavid") {
      return alert("Unauthorized: Only KingDavid has admin privileges.");
    }

    const parsed = parseFloat(adminDollarInput);
    if (isNaN(parsed) || parsed <= 0) {
      return alert("Please enter a valid injection amount.");
    }

    const injectCents = Math.round(parsed * 100);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error: rpcError } = await supabase.rpc("increment_balance_by_user", {
      target_user_id: session.user.id,
      amount_cents: injectCents,
    });

    if (rpcError) {
      alert("Failed to mint funds: " + rpcError.message);
    } else {
      setShowAdminModal(false);
      setAdminDollarInput("");
      await loadUserData();
      window.location.reload();
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
      "Amount (AUD)",
      "Balance (AUD)",
    ];

    const rows = dataSet.map((tx) => {
      let desc = tx.title;
      if (tx.title === "Admin Capital Injection" || tx.title === "Pending Balance Transfer") {
        desc = tx.title;
      } else if (tx.recipientName && tx.title.startsWith("Transfer to ")) {
        desc = `Transfer to @${tx.recipientName}`;
      }
      const signedAmt = tx.type === "CREDIT" ? `+${(tx.centsAmount / 100).toFixed(2)}` : `-${(tx.centsAmount / 100).toFixed(2)}`;
      return [
        `"${tx.dateTime}"`,
        `"${tx.id}"`,
        `"${desc}"`,
        `"${tx.category}"`,
        `"${signedAmt}"`,
        `"${(tx.balanceAfterCents / 100).toFixed(2)}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const fileTimestamp = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `SocialTime_Statement_${currentUsername}_${fileTimestamp}.csv`);
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
    document.title = "Social Time";
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
    document.title = "Social Time";
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 50);
  };

  const isAnyReceiptOpen = Boolean(
    (showPayModal && payStep === "RECEIPT") || viewingTxn || showDashboardAddDaysModal || showAdminModal
  );

  if (!mounted || authLoading) {
    return (
      <div className="py-20 text-center text-xs font-semibold text-gray-500">
        Loading Social Time...
      </div>
    );
  }

  const liveTotalMs = activeSessionMilliseconds;
  const liveTotalSeconds = Math.floor(liveTotalMs / 1000);
  const timerParts = getTimerBreakdown(liveTotalMs);

  const claimableCents = Math.floor(pendingBalanceCents * 100 + 1e-9);
  const isPayDisabled = balanceCents === null || balanceCents < 1;

  const currentRankMinSeconds = currentBadge ? currentBadge.min_days * 86400 : 0;
  const nextRankMinSeconds = nextBadge ? nextBadge.min_days * 86400 : currentRankMinSeconds + 86400;
  const rankSpanSeconds = nextRankMinSeconds - currentRankMinSeconds;
  const secondsIntoRank = Math.max(0, liveTotalSeconds - currentRankMinSeconds);

  const rawProgressPercent = nextBadge && rankSpanSeconds > 0 
    ? (secondsIntoRank / rankSpanSeconds) * 100 
    : 100;

  const progressPercent = nextBadge 
    ? Number(Math.min(99.99, Math.max(0, rawProgressPercent)).toFixed(2)) 
    : 100.00;

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const currentBadgeIndex = allBadges.findIndex((b) => b.title === currentBadge?.title);
  const currentTier = currentBadgeIndex >= 0 ? Math.min(10, currentBadgeIndex + 1) : 1;
  const isKingDavid = currentUsername.toLowerCase() === "kingdavid";

  const formattedBalanceString = balanceCents !== null ? formatCurrency(balanceCents) : "$—";
  const dynamicViewBoxWidth = Math.max(80, formattedBalanceString.length * 13.5);

  const formattedPendingString = formatPendingCurrency(pendingBalanceCents);
  const dynamicPendingViewBoxWidth = Math.max(80, formattedPendingString.length * 13.5);

  const isActive = (path: string) => pathname === path;

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes floatStraightUp {
          0% { opacity: 0; transform: translate(-50%, 0px) scale(0.85); }
          25% { opacity: 1; transform: translate(-50%, -10px) scale(1.05); }
          100% { opacity: 0; transform: translate(-50%, -40px) scale(1); }
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
            <h1 className="text-2xl font-black tracking-tight text-gray-900">SOCIAL TIME</h1>
            <p className="text-xs text-gray-500 uppercase font-semibold mt-0.5">Official Account Statement</p>
          </div>
          <div className="text-right text-xs text-gray-600 space-y-0.5">
            <div>Account Holder: <strong>@{currentUsername}</strong></div>
            <div>Date Requested: <strong>{getRequestedTimestamp()}</strong></div>
            <div>Current Balance: <strong>{balanceCents !== null ? formatCurrency(balanceCents) : "$—"}</strong></div>
          </div>
        </div>
      </div>

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

      {/* Dashboard Metrics Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 print:hidden`}>

        {/* 1. BANK BALANCE CARD */}
        <div className="bg-white rounded-xl border border-gray-200 p-2.5 sm:p-3 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden">
          <div className="flex-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bank Balance</p>
            <div className="relative w-full mt-0 mb-0">
              <svg className="w-full h-7 sm:h-8 block overflow-visible" viewBox={`0 0 ${dynamicViewBoxWidth} 32`} preserveAspectRatio="xMinYMid meet">
                <text 
                  x="0" 
                  y="24" 
                  className="font-extrabold font-mono fill-[#b8860b]"
                  style={{ fontSize: '24px', fontWeight: 800 }}
                >
                  {formattedBalanceString}
                </text>
              </svg>

              {floatingCoins.map((coin) => (
                <span
                  key={coin.id}
                  className={`absolute pointer-events-none z-30 font-mono font-black text-sm whitespace-nowrap ${
                    coin.animType === "top"
                      ? "top-0 left-1/2 -translate-x-1/2 text-[#b8860b]"
                      : "top-1 left-1/2 -translate-x-1/2 text-[#0d8b07]"
                  }`}
                  style={{
                    animation:
                      coin.animType === "top"
                        ? "fallDownTop 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards"
                        : "floatStraightUp 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards",
                    textShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  }}
                >
                  {coin.text}
                </span>
              ))}
            </div>
          </div>

          {isApproved && (
            <div className="mt-0.5 pt-0.5 border-t border-gray-100 flex flex-col gap-0.5">
              <button
                onClick={handleOpenPayModal}
                disabled={isPayDisabled}
                title={isPayDisabled ? "Minimum balance of $0.01 required" : "Pay Someone"}
                className={`w-full h-8 font-bold text-xs px-3 rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 ${
                  isPayDisabled
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 cursor-pointer"
                }`}
              >
                <span className="text-sm">⇄</span> Pay Someone
              </button>
              <div className="flex items-center justify-center text-[11px] font-mono px-0.5 h-4 relative">
                <span className={userGender === "Female" ? "text-pink-600 font-bold" : userGender === "Male" ? "text-blue-600 font-bold" : "text-gray-500"}>
                  ID: @{currentUsername}
                </span>
                {currentUsername === "KingDavid" && (
                  <button
                    onClick={() => {
                      setAdminDollarInput("");
                      setShowAdminModal(true);
                    }}
                    className="absolute right-0 w-3.5 h-3.5 rounded bg-[#b8860b] hover:bg-[#d4a52b] text-gray-900 font-black text-[9px] flex items-center justify-center transition cursor-pointer shadow-xs font-sans leading-none"
                    title="Admin Capital Injection"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. PENDING BALANCE CARD WITH MULTIPLIER IN TOP RIGHT */}
        {isApproved && (
          <div className="bg-white rounded-xl border border-gray-200 p-2.5 sm:p-3 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden">
            <div className="absolute right-3.5 top-3 z-10">
              <span className={`text-xs font-mono font-extrabold block ${
                userGender === "Female" ? "text-pink-600" : "text-blue-600"
              }`}>
                x {multiplier.toFixed(2)}
              </span>
            </div>

            <div className="flex-1 pr-12">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Pending Balance</p>
              <div className="relative w-full mt-0 mb-0">
                <svg className="w-full h-7 sm:h-8 block overflow-visible" viewBox={`0 0 ${dynamicPendingViewBoxWidth} 32`} preserveAspectRatio="xMinYMid meet">
                  <text 
                    x="0" 
                    y="24" 
                    className="font-extrabold font-mono fill-[#0d8b07]"
                    style={{ fontSize: '24px', fontWeight: 800 }}
                  >
                    {formattedPendingString}
                  </text>
                </svg>
              </div>
            </div>

            <div className="mt-0.5 pt-0.5 border-t border-gray-100 flex flex-col gap-0.5">
              <button
                onClick={handleTransferPending}
                disabled={claimableCents < 3}
                title={claimableCents < 3 ? "Minimum transfer amount is $0.03" : "Claim whole cents to bank balance"}
                className={`w-full h-8 font-bold text-xs px-3 rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 ${
                  claimableCents < 3
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-[#0d8b07] hover:bg-[#0a6d05] text-gray-900 cursor-pointer shadow-sm"
                }`}
              >
                <span className="relative w-5 h-5 inline-flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="10" cy="10" r="7" />
                    <path d="M10 7.5v5m-1.5-3.5h3" />
                    <circle cx="17.5" cy="17.5" r="4.5" fill={claimableCents < 3 ? "white" : "#0d8b07"} stroke="currentColor" strokeWidth="2" />
                    <path d="M17.5 15.5v4m-2-2h4" />
                  </svg>
                </span> Claim
              </button>
              <div className="flex items-center justify-center text-[11px] text-gray-500 font-mono px-0.5 h-4">
                Minimum transfer $0.03
              </div>
            </div>
          </div>
        )}

        {/* 3. TOTAL ACTIVITY TIMER CARD */}
        {isApproved && (
          <div className="bg-white rounded-xl border border-gray-200 p-2.5 sm:p-3 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative">
            <div className="flex items-start justify-between pb-1.5 border-b border-gray-100 mb-1.5">
              <div className="flex items-start gap-2.5 min-w-0 w-full">
                <div className="relative w-9 h-9 shrink-0 mt-0.5">
                  <img
                    src={`/badges/time/${currentBadge?.file_name || 'time-waster.png'}`}
                    alt={currentBadge?.title || 'Time Waster'}
                    className="w-full h-full object-contain drop-shadow-sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">TIME RANK</p>

                    <div className="flex items-center" title={`Rank Tier ${currentTier}`}>
                      {currentTier <= 5 ? (
                        <div className="flex items-center -space-x-1">
                          {Array.from({ length: currentTier }).map((_, idx) => (
                            <div key={idx} className="relative w-3.5 h-3.5 shrink-0">
                              <img src="/badges/time/golden-star.png" alt="Star" className="w-full h-full object-contain drop-shadow-2xs" />
                            </div>
                          ))}
                        </div>
                      ) : currentTier >= 6 && currentTier <= 9 ? (
                        <div className="flex items-center -space-x-1">
                          {Array.from({ length: currentTier - 5 }).map((_, idx) => (
                            <div key={idx} className="relative w-3.5 h-3.5 shrink-0">
                              <img src="/badges/time/golden-cross.png" alt="Cross" className="w-full h-full object-contain drop-shadow-2xs" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="relative w-4 h-4 shrink-0" title="Rank Tier 10 (Hourglass)">
                          <img src="/badges/time/golden-hourglass.png" alt="Hourglass" className="w-full h-full object-contain drop-shadow-2xs" />
                        </div>
                      )}

                      {isKingDavid && (
                        <div className="relative w-3.5 h-3.5 shrink-0 ml-0.5" title="KingDavid Sovereign Infinity">
                          <img src="/badges/time/golden-infinity.png" alt="Infinity" className="w-full h-full object-contain drop-shadow-2xs" />
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-bold text-gray-900 truncate">{currentBadge?.title || 'Time Waster'}</p>
                  {currentBadge?.quirky_phrase && (
                    <p className="text-[11px] text-gray-500 italic mt-0.2 leading-snug">
                      &ldquo;{currentBadge.quirky_phrase}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5 pb-0.5">
              <div className="flex flex-col">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">TOTAL ACTIVITY TIMER</p>
                <div className="flex items-center gap-1.5">
                  {currentUsername === "KingDavid" && (
                    <button
                      onClick={() => {
                        setDashboardAddDaysInput("");
                        setShowDashboardAddDaysModal(true);
                      }}
                      className="w-3.5 h-3.5 rounded bg-[#0d8b07] hover:bg-[#0a6d05] text-white text-[9px] font-black flex items-center justify-center shadow-xs cursor-pointer transition shrink-0 self-center"
                      title="Add Activity Days Window"
                    >
                      +
                    </button>
                  )}
                  <div className="flex items-center gap-1 font-mono text-[#b8860b] text-base sm:text-lg font-black tracking-wide">
                    <div className="flex flex-col items-center">
                      <span>{timerParts.days}</span>
                      <span className="text-[9px] text-gray-400 font-sans font-semibold tracking-tighter leading-none mt-0.5">D</span>
                    </div>
                    <span className="pb-2.5">:</span>
                    <div className="flex flex-col items-center">
                      <span>{timerParts.hours}</span>
                      <span className="text-[9px] text-gray-400 font-sans font-semibold tracking-tighter leading-none mt-0.5">H</span>
                    </div>
                    <span className="pb-2.5">:</span>
                    <div className="flex flex-col items-center">
                      <span>{timerParts.mins}</span>
                      <span className="text-[9px] text-gray-400 font-sans font-semibold tracking-tighter leading-none mt-0.5">M</span>
                    </div>
                    <span className="pb-2.5">:</span>
                    <div className="flex flex-col items-center">
                      <span>{timerParts.secs}</span>
                      <span className="text-[9px] text-gray-400 font-sans font-semibold tracking-tighter leading-none mt-0.5">S</span>
                    </div>
                    <span className="pb-2.5">:</span>
                    <div className="flex flex-col items-center">
                      <span>{timerParts.ms}</span>
                      <span className="text-[9px] text-gray-400 font-sans font-semibold tracking-tighter leading-none mt-0.5">MS</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-1 rounded-full shadow-xs shrink-0 ml-2">
                {nextBadge ? (
                  <div className="relative w-12 h-12 flex items-center justify-center" title={`Rank progress: ${progressPercent.toFixed(2)}%`}>
                    <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-100"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className={`transition-all duration-300 ease-out ${
                          userGender === "Female" ? "text-pink-600" : "text-blue-600"
                        }`}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className={`absolute inset-0 flex items-center justify-center font-mono text-[8px] font-bold tracking-tighter ${
                      userGender === "Female" ? "text-pink-700" : "text-blue-800"
                    }`}>
                      {progressPercent.toFixed(2)}%
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-100 bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-2xs" title="Max Rank Achieved">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table View */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="p-4 sm:px-5 sm:py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between md:items-center gap-3 bg-gray-50/50 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">Transactions</h2>
              <span className="text-[11px] text-gray-400 font-normal hidden sm:inline">(Click any row to view & print receipt)</span>
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
                id="transaction-search"
                name="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchQuery("");
                }}
                placeholder="Search ref ID, recipient, or amount..."
                className="w-full pl-9 pr-8 py-2 text-xs text-gray-900 bg-gray-100 hover:bg-gray-100 focus:bg-white border border-gray-200 focus:border-[#e7b833] rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-100 transition-all placeholder:text-gray-400 font-medium"
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
          <table className="w-full table-auto text-left border-collapse print:bg-white">
            <thead>
              <tr className="bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wider border-b border-gray-200 print:bg-gray-100 print:text-gray-900">
                <th className="py-3 px-4 md:px-5 border-r border-gray-200">
                  <span className="md:hidden">Type</span>
                  <span className="hidden md:inline">Transaction Information</span>
                </th>
                <th className="py-3 px-3 md:px-5 border-r border-gray-200 md:hidden">Date</th>
                <th className="py-3 px-3 md:px-5 border-r border-gray-200 text-right md:hidden">Amount</th>
                <th className="py-3 px-3 md:px-5 border-r border-gray-200 text-right hidden md:table-cell">Debits</th>
                <th className="py-3 px-3 md:px-5 border-r border-gray-200 text-right hidden md:table-cell">Credits</th>
                <th className="py-3 px-4 md:px-5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm print:divide-gray-300">
              {currentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-500 text-sm">
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
                              <span className="relative w-4 h-4 inline-block align-middle shrink-0 mr-1">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="10" cy="10" r="7" />
                                  <path d="M10 7.5v5m-1.5-3.5h3" />
                                  <circle cx="17.5" cy="17.5" r="4.5" fill="white" stroke="currentColor" strokeWidth="2" />
                                  <path d="M17.5 15.5v4m-2-2h4" />
                                </svg>
                              </span> Claim Pending Balance {claimableCents < 3 ? "(Min $0.03)" : ""}
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
                      {/* Fixed mobile view: cleaned up the overflowing absolute tooltip */}
                      <td className="py-3.5 px-4 md:px-5 border-r border-gray-100 print:border-gray-300 print:bg-white truncate">
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(tx.type, tx.title)}

                          <div className="hidden md:block flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-gray-900 group-hover:text-[#b8860b] print:text-gray-900 print:group-hover:text-gray-900 transition truncate">
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
                              <span className="text-[10px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition print:hidden shrink-0 ml-2">
                                View Receipt ↗
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 font-mono print:text-gray-600 truncate">
                              {tx.dateTime} • {tx.category} • Ref: {tx.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 md:px-5 border-r border-gray-100 print:border-gray-300 print:bg-white text-xs font-mono text-gray-600 md:hidden truncate">
                        {formatDateDDMMYYYY(tx.dateTime)}
                      </td>

                      <td className="py-3.5 px-3 md:px-5 border-r border-gray-100 print:border-gray-300 print:bg-white text-right font-mono md:hidden truncate">
                        <span className={`font-semibold ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                          {isCredit ? "+" : "-"}{formatCurrency(tx.centsAmount)}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 md:px-5 border-r border-gray-100 print:border-gray-300 print:bg-white text-right font-mono hidden md:table-cell truncate">
                        {!isCredit ? (
                          <span className="font-semibold text-rose-600 print:text-rose-600">
                            -{formatCurrency(tx.centsAmount)}
                          </span>
                        ) : (
                          <span className="text-gray-300 print:text-gray-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 md:px-5 border-r border-gray-100 print:border-gray-300 print:bg-white text-right font-mono hidden md:table-cell truncate">
                        {isCredit ? (
                          <span className="font-semibold text-emerald-600 print:text-emerald-600">
                            +{formatCurrency(tx.centsAmount)}
                          </span>
                        ) : (
                          <span className="text-gray-300 print:text-gray-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 md:px-5 text-right font-mono font-bold text-gray-900 print:text-gray-900 print:bg-white truncate">
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

      {/* PAYMENT FLOW MODAL (Unified styling matching Navbar Sign Out Modal) */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden transition-all text-left print:border-none print:shadow-none print:max-w-none">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center print:hidden font-bold">
              <h3 className="text-base font-bold text-white">
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
                      ref={recipientInputRef}
                      type="text"
                      required
                      placeholder="JohnSmith (Case Insensitive)"
                      value={recipient}
                      onChange={(e) => {
                        e.target.setCustomValidity("");
                        setRecipient(e.target.value.replace(/^@/, ""));
                      }}
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
                      ref={dollarInputRef}
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={balanceCents !== null ? balanceCents / 100 : undefined}
                      value={dollarInput}
                      onChange={(e) => {
                        e.target.setCustomValidity("");
                        setDollarInput(e.target.value);
                      }}
                      placeholder="1.00"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded text-sm text-black font-mono focus:outline-none focus:border-[#e7b833]"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex justify-between">
                    <span>Minimum: <strong>$0.01</strong></span>
                    <span>Available: <strong>{balanceCents !== null ? formatCurrency(balanceCents) : "$—"}</strong></span>
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
                    className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
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
                    className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                  >
                    Back / Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePayment}
                    className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
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
                      <h1 className="text-xl font-black text-gray-900">SOCIAL TIME</h1>
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
                      {formatCurrency(viewingTxn?.balanceAfterCents ?? completedTxn.balanceAfterCents)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1 print:hidden">
                  <button
                    type="button"
                    onClick={handlePrintIndividualReceipt}
                    className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePayModal}
                    className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN CAPITAL INJECTION MODAL (Unified styling matching Navbar Sign Out Modal) */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden transition-all text-left">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">Admin Capital Injection</h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833]" />

            <form onSubmit={handleAdminInject} className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                You are logged in as <strong>KingDavid</strong> (Administrator). Enter any amount to mint directly into your wallet balance.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Injection Amount ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 1000.00"
                    value={adminDollarInput}
                    onChange={(e) => setAdminDollarInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded text-sm text-black font-mono focus:outline-none focus:border-[#e7b833]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
                >
                  Mint Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DASHBOARD CUSTOM ADD DAYS MODAL (++) */}
      {showDashboardAddDaysModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden transition-all text-left">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">⏱️ Add Activity Days</h3>
              <button
                onClick={() => setShowDashboardAddDaysModal(false)}
                className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833]" />

            <form onSubmit={handleExecuteDashboardAddDays} className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                Enter the number of days to append to <strong>KingDavid</strong>&apos;s activity timer and elevate badge rank.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Days to Add
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000000000"
                  required
                  placeholder="e.g. 10"
                  value={dashboardAddDaysInput}
                  onChange={(e) => setDashboardAddDaysInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-black font-mono focus:outline-none focus:border-[#e7b833]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDashboardAddDaysModal(false)}
                  className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
                >
                  Add Days
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORICAL RECEIPT MODAL */}
      {viewingTxn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden transition-all text-left print:border-none print:shadow-none print:max-w-none">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center print:hidden font-bold">
              <h3 className="text-base font-bold text-white">OFFICIAL TRANSACTION RECEIPT</h3>
              <button
                onClick={() => setViewingTxn(null)}
                className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833]" />

            <div className="p-6 text-center space-y-5 print:pt-14 print:px-12 print:pb-8 print:max-w-xl print:mx-auto">
              <div className="hidden print:block pb-4 mb-4 border-b border-gray-300 text-left">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-black text-gray-900">SOCIAL TIME</h1>
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
                  className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTxn(null)}
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}