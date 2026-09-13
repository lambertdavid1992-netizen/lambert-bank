"use client";

import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState, useCallback } from "react";
import { useSessionTimer } from "@/components/SessionTimerProvider";

interface NavbarProps {
  currentUsername: string;
  isApproved?: boolean;
  onRefreshData?: () => void;
}

function SessionNavbarClock() {
  const { accumulatedMs } = useSessionTimer();

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

  const timerParts = getTimerBreakdown(accumulatedMs);

  return (
    <div className="flex items-center gap-1 font-mono text-[#b8860b] text-xs font-black tracking-tight" title="Live Session Activity Timer">
      <span>⏱️</span>
      <div className="flex items-center gap-0.5">
        <span>{timerParts.days}d</span>:
        <span>{timerParts.hours}h</span>:
        <span>{timerParts.mins}m</span>:
        <span>{timerParts.secs}s</span>:
        <span>{timerParts.ms}ms</span>
      </div>
    </div>
  );
}

export default function Navbar({ 
  currentUsername, 
  onRefreshData 
}: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState<number>(0);

  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [adminDollarInput, setAdminDollarInput] = useState<string>("");

  const [showAddDaysModal, setShowAddDaysModal] = useState<boolean>(false);
  const [addDaysInput, setAddDaysInput] = useState<string>("");

  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetUserInput, setResetUserInput] = useState<string>("");
  
  const { resetSession } = useSessionTimer();

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

  const handleSignOut = async () => {
    if (currentUsername) {
      try {
        const localToken = sessionStorage.getItem("lambert_active_token") || "";
        await supabase.rpc("end_session_secure", {
          target_username: currentUsername,
          session_token: localToken,
        });
      } catch (err) {
        console.error("Secure navbar logout finalization failed:", err);
      }
    }
    await supabase.auth.signOut();
    sessionStorage.removeItem("lambert_active_token");
    localStorage.removeItem("lambert_cached_session_ms");
    router.push("/login");
  };

  const isActive = (path: string) => pathname === path;

  const handleExecuteAddDays = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(addDaysInput.trim(), 10);
    if (isNaN(days) || days <= 0) {
      return alert("Please enter a valid positive number of days.");
    }

    const { error } = await supabase.rpc("admin_add_session_days", {
      target_username: currentUsername || "KingDavid",
      days_to_add: days,
    });

    if (error) {
      alert("Failed to add days: " + error.message);
    } else {
      setShowAddDaysModal(false);
      setAddDaysInput("");
      if (onRefreshData) onRefreshData();
      window.location.reload();
    }
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = resetUserInput.trim();
    if (!cleanTarget) return;

    if (cleanTarget.toUpperCase() === "ALL") {
      if (confirm("Are you sure you want to reset ALL profiles and transactions in Supabase?")) {
        // Dynamically fetch ALL profiles so newly registered accounts (like tungtungsahur) are never missed
        const { data: allProfiles } = await supabase.from("profiles").select("username");
        
        if (allProfiles) {
          for (const p of allProfiles) {
            await supabase.from("transactions").delete().or(`username.eq.${p.username},recipient_name.eq.${p.username}`);
          }
        }

        await supabase.from("profiles").update({ 
          balance_cents: 0, 
          last_claim_date: null, 
          accumulated_session_seconds: 0, 
          accumulated_days: 0,
          pending_claimed_cents: 0, 
          session_start_timestamp: null,
          last_heartbeat_timestamp: null,
          active_session_id: null 
        }).neq("username", "NON_EXISTENT_DUMMY_CHECK");

        await resetSession();
        setShowResetModal(false);
        setResetUserInput("");
        window.location.reload();
      }
    } else {
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", cleanTarget)
        .single();

      if (!targetProfile) {
        return alert(`Profile "${cleanTarget}" not found.`);
      }

      const matchedUser = targetProfile.username;

      if (confirm(`Reset account data for @${matchedUser}?`)) {
        await supabase.from("transactions").delete().or(`username.eq.${matchedUser},recipient_name.eq.${matchedUser}`);
        await supabase.from("profiles").update({ 
          balance_cents: 0, 
          last_claim_date: null, 
          accumulated_session_seconds: 0, 
          accumulated_days: 0,
          pending_claimed_cents: 0, 
          session_start_timestamp: null,
          last_heartbeat_timestamp: null,
          active_session_id: null 
        }).eq("username", matchedUser);

        setShowResetModal(false);
        setResetUserInput("");
        if (currentUsername.toLowerCase() === matchedUser.toLowerCase()) {
          await resetSession();
          window.location.reload();
        } else {
          alert(`Successfully reset data for @${matchedUser}.`);
          if (onRefreshData) onRefreshData();
        }
      }
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
      if (onRefreshData) onRefreshData();
      window.location.reload();
    }
  };

  return (
    <>
      <header className="bg-[#1e293b] text-white print:hidden">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Lambert Bank Logo" className="w-8 h-8 object-contain" />
            <div>
              <span className="text-lg font-bold tracking-tight block leading-tight">Lambert Bank</span>
              <span className="text-[10px] text-white block tracking-wider italic">"Time is Money!"</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-sm">
            {currentUsername === "KingDavid" && (
              <div className="flex items-center gap-2 mr-2 border-r border-slate-700 pr-4">
                <button
                  onClick={() => {
                    setAdminDollarInput("");
                    setShowAdminModal(true);
                  }}
                  className="text-xs bg-[#b8860b] hover:bg-[#d4a52b] text-gray-900 font-bold px-3 py-1.5 rounded transition cursor-pointer shadow"
                  title="Quick Admin Fund Injection"
                >
                  Admin Fund
                </button>
                <button
                  onClick={() => {
                    setAddDaysInput("");
                    setShowAddDaysModal(true);
                  }}
                  className="text-xs bg-[#0d8b07] hover:bg-[#0a6d05] text-white font-bold px-3 py-1.5 rounded transition cursor-pointer shadow"
                  title="Add days to session activity timer"
                >
                  + Add Days
                </button>
                <button
                  onClick={() => {
                    setResetUserInput("");
                    setShowResetModal(true);
                  }}
                  className="text-xs bg-[#800000] hover:bg-[#660000] text-white font-bold px-3 py-1.5 rounded transition cursor-pointer shadow"
                  title="Reset specific user account data"
                >
                  - Reset Data
                </button>
              </div>
            )}

            <div 
              onClick={() => router.push("/profile")}
              className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer hover:border-[#e7b833] transition"
              title="View User Information & Signup Details"
            >
              <span className="text-xs text-gray-400">Account:</span>
              <span className="text-white font-bold text-xs">@{currentUsername} {currentUsername === "KingDavid" ? "👑" : ""}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-[#e7b833] w-full" />
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 print:hidden">
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${isActive("/") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
            >
              Bank
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => router.push("/profile")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${isActive("/profile") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
            >
              Profile
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => router.push("/friends")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${isActive("/friends") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
            >
              <span>Friends</span>
              {friendRequestsCount > 0 && (
                <span className="w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
                  {friendRequestsCount}
                </span>
              )}
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => router.push("/social")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${isActive("/social") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
            >
              Social
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => router.push("/members")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${isActive("/members") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
            >
              Members
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => router.push("/gallery")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${isActive("/gallery") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
            >
              Gallery
            </button>

            {currentUsername === "KingDavid" && (
              <>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => router.push("/admin")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${isActive("/admin") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
                >
                  <span>Pending Applications</span>
                  {pendingCount > 0 && (
                    <span className="w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>

          <SessionNavbarClock />
        </div>
      </div>

      {/* ADMIN FUND MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden transition-all text-left">
            <div className="bg-[#b8860b] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">Admin Capital Injection</h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-amber-100 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#9a7009]" />

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
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded text-sm text-black font-mono focus:outline-none focus:border-[#b8860b]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="w-1/2 py-2.5 rounded text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded text-sm font-bold bg-[#b8860b] hover:bg-[#d4a52b] text-white shadow transition cursor-pointer"
                >
                  Mint Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DAYS MODAL */}
      {showAddDaysModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden transition-all text-left">
            <div className="bg-[#0d8b07] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold">⏱️ Add Activity Days</h3>
              <button
                onClick={() => setShowAddDaysModal(false)}
                className="text-emerald-100 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#0a6d05]" />

            <form onSubmit={handleExecuteAddDays} className="p-5 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
                Enter the number of days to append to <strong>KingDavid</strong>&apos;s activity timer and elevate badge rank.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Days to Add
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 10"
                  value={addDaysInput}
                  onChange={(e) => setAddDaysInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-black font-mono focus:outline-none focus:border-[#0d8b07]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDaysModal(false)}
                  className="w-1/2 py-2.5 rounded text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded text-sm font-bold bg-[#0d8b07] hover:bg-[#0a6d05] text-white shadow transition cursor-pointer"
                >
                  Add Days
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET DATA MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden transition-all text-left">
            <div className="bg-[#800000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold">⚠️ Reset Account Data</h3>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-red-100 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#660000]" />

            <form onSubmit={handleExecuteReset} className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-[#800000]">
                Warning: This will clear transaction history and reset session timers. Type an exact username or <strong>ALL</strong>.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Target Username / ALL
                </label>
                <input
                  type="text"
                  required
                  placeholder="ALL or username"
                  value={resetUserInput}
                  onChange={(e) => setResetUserInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-black font-mono focus:outline-none focus:border-[#800000]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-1/2 py-2.5 rounded text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded text-sm font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}