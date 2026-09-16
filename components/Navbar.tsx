"use client";

import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSessionTimer } from "@/components/SessionTimerProvider";

interface NavbarProps {
  currentUsername: string;
  isApproved?: boolean;
  onRefreshData?: () => void;
}

export function Sidebar({ currentUsername }: { currentUsername: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState<number>(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

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

    const { count: msgCount, error: msgError } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_username", currentUsername)
      .eq("is_read", false);

    if (!msgError && msgCount !== null) {
      setUnreadMessagesCount(msgCount);
    }
  }, [currentUsername, supabase]);

  useEffect(() => {
    fetchBadgeCounts();

    const interval = setInterval(() => {
      fetchBadgeCounts();
    }, 3000);

    const channel = supabase
      .channel("sidebar-unread-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          if (payload.new.recipient_username?.toLowerCase() === currentUsername.toLowerCase() && !payload.new.is_read) {
            setUnreadMessagesCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          fetchBadgeCounts();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchBadgeCounts, currentUsername, supabase]);

  useEffect(() => {
    if (pathname === "/messages") {
      setUnreadMessagesCount(0);
    }
  }, [pathname]);

  const isActive = (path: string) => pathname === path;
  const isKingDavid = currentUsername.toLowerCase() === "kingdavid";

  return (
    <aside className="hidden lg:flex sticky top-20 self-start shrink-0 print:hidden z-40 w-56 flex-col">
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider overflow-hidden w-56">
        
        {/* Bank */}
        <button
          onClick={() => router.push("/")}
          title="Bank"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${isActive("/") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m16-11v11M8 14v3m4-3v3m4-3v3" />
          </svg>
          <span className="truncate">Bank</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => router.push("/profile")}
          title="Profile"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${isActive("/profile") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <span className="truncate">Profile</span>
        </button>

        {/* Gallery */}
        <button
          onClick={() => router.push("/gallery")}
          title="Gallery"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${isActive("/gallery") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
          <span className="truncate">Gallery</span>
        </button>

        {/* Messages with Red Notification Badge */}
        <button
          onClick={() => router.push("/messages")}
          title="Messages"
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition cursor-pointer ${isActive("/messages") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            <span className="truncate">Messages</span>
          </div>
          {unreadMessagesCount > 0 && (
            <span className="w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 shadow-xs ml-1 animate-pulse">
              {unreadMessagesCount}
            </span>
          )}
        </button>

        {/* Friends */}
        <button
          onClick={() => router.push("/friends")}
          title="Friends"
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition cursor-pointer ${isActive("/friends") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <span className="truncate">Friends</span>
          </div>
          {friendRequestsCount > 0 && (
            <span className="w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 shadow-xs ml-1">
              {friendRequestsCount}
            </span>
          )}
        </button>

        {/* Social */}
        <button
          onClick={() => router.push("/social")}
          title="Social"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${isActive("/social") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 9h13.5m-13.5 6h13.5m-7.5-12.75l-3 18.5m7.5-18.5l-3 18.5" />
          </svg>
          <span className="truncate">Social</span>
        </button>

        {/* Streaming */}
        <button
          onClick={() => router.push("/streaming")}
          title="Streaming"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${isActive("/streaming") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M12 12.75h.008v.008H12v-.008Z" />
          </svg>
          <span className="truncate">Streaming</span>
        </button>

        {/* Members */}
        <button
          onClick={() => router.push("/members")}
          title="Members"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${isActive("/members") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.25m-15.686 0A8.959 8.959 0 0 1 3 12c0-.778.099-1.533.284-2.25m0 0A11.959 11.959 0 0 1 12 10.5c2.998 0 5.74 1.1 7.843 2.918" />
          </svg>
          <span className="truncate">Members</span>
        </button>

        {/* Applications */}
        {isKingDavid && (
          <button
            onClick={() => router.push("/admin")}
            title="Applications"
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition cursor-pointer ${isActive("/admin") ? "bg-[#e7b833] text-gray-900 font-black shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-gray-700"}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m-3 .75H6.75A2.25 2.25 0 0 1 4.5 16.5v-10.5A2.25 2.25 0 0 1 6.75 3.75h3.189a2.25 2.25 0 0 1 2.122 1.5H15.75A2.25 2.25 0 0 1 18 7.5v9a2.25 2.25 0 0 1-2.25 2.25h-3.75m-3-12.75V3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V4.5m-6 0h6" />
              </svg>
              <span className="truncate">Applications</span>
            </div>
            {pendingCount > 0 && (
              <span className="w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 shadow-xs ml-1">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}

export default function Navbar({ currentUsername, onRefreshData }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showSignOutModal, setShowSignOutModal] = useState<boolean>(false);
  const [resetUserInput, setResetUserInput] = useState<string>("");
  const { resetSession } = useSessionTimer();

  const [isHeaderOverflowed, setIsHeaderOverflowed] = useState<boolean>(false);
  const headerContainerRef = useRef<HTMLDivElement>(null);

  // Mobile navigation drawer state & badges
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState<number>(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  useEffect(() => {
    const headerEl = headerContainerRef.current;
    if (!headerEl) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setIsHeaderOverflowed(entry.contentRect.width < 500);
      }
    });

    observer.observe(headerEl);
    return () => observer.disconnect();
  }, []);

  const fetchBadgeCounts = useCallback(async () => {
    if (!currentUsername) return;

    if (currentUsername === "KingDavid") {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_approved", false);
      if (!error && count !== null) setPendingCount(count);
    }

    const { count: friendCount, error: friendError } = await supabase
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .eq("receiver_username", currentUsername)
      .eq("status", "pending");
    if (!friendError && friendCount !== null) setFriendRequestsCount(friendCount);

    const { count: msgCount, error: msgError } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_username", currentUsername)
      .eq("is_read", false);
    if (!msgError && msgCount !== null) setUnreadMessagesCount(msgCount);
  }, [currentUsername, supabase]);

  useEffect(() => {
    fetchBadgeCounts();
    const interval = setInterval(fetchBadgeCounts, 3000);
    return () => clearInterval(interval);
  }, [fetchBadgeCounts]);

  useEffect(() => {
    if (pathname === "/messages") {
      setUnreadMessagesCount(0);
    }
  }, [pathname]);

  const isActive = (path: string) => pathname === path;
  const isKingDavid = currentUsername.toLowerCase() === "kingdavid";

  const handleSignOutConfirm = async () => {
    setShowSignOutModal(false);
    if (currentUsername) {
      try {
        const localToken = sessionStorage.getItem("socialtime_active_token") || "";
        await supabase.rpc("end_session_secure", {
          target_username: currentUsername,
          session_token: localToken,
        });
      } catch (err) {
        console.error("Secure logout failed:", err);
      }
    }
    await supabase.auth.signOut();
    sessionStorage.removeItem("socialtime_active_token");
    localStorage.removeItem("socialtime_cached_session_ms");
    router.push("/login");
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = resetUserInput.trim();
    if (!cleanTarget) return;

    if (cleanTarget.toUpperCase() === "ALL") {
      if (confirm("Are you sure you want to reset ALL profiles and transactions in Supabase?")) {
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

  return (
    <>
      {/* Sticky Header Overlay Spanning Viewport */}
      <header className="bg-[#000000] text-white print:hidden sticky top-0 z-[100] shadow-md">
        <div ref={headerContainerRef} className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center space-x-2 shrink-0 min-w-0">
            {/* 3-Line Hamburger Button for Mobile Navigation */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition cursor-pointer shrink-0"
              title="Toggle Navigation Menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>

            <img src="/logo.png" alt="Social Time Logo" className="h-[52px] w-auto object-contain transform translate-y-[2px] shrink-0" />
            
            <div className={`transition-opacity duration-200 overflow-hidden whitespace-nowrap ${isHeaderOverflowed ? "hidden" : "block"}`}>
              <span className="text-lg font-bold tracking-tight block leading-tight">Social Time</span>
              <span className="text-[10px] text-white block tracking-wider italic">&quot;Spending time, together.&quot;</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm shrink-0">
            {currentUsername === "KingDavid" && (
              <div className="flex items-center gap-2 mr-1 border-r border-zinc-800 pr-3">
                <button
                  onClick={() => {
                    setResetUserInput("");
                    setShowResetModal(true);
                  }}
                  className="text-xs bg-[#800000] hover:bg-[#660000] text-white font-bold px-2.5 py-1.5 rounded transition cursor-pointer shadow font-mono"
                  title="Reset specific user account data"
                >
                  -
                </button>
              </div>
            )}

            <div className="flex items-center justify-center">
              <span className="text-white font-bold text-xs tracking-wide">@{currentUsername} {currentUsername === "KingDavid" ? "👑" : ""}</span>
            </div>

            <span className="text-zinc-600 font-light">|</span>

            <button
              type="button"
              title="Settings"
              className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-3.5 py-1.5 rounded-lg border border-zinc-500 transition cursor-pointer shadow-sm flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>

            <span className="text-zinc-600 font-light">|</span>

            <button
              onClick={() => setShowSignOutModal(true)}
              title="Sign Out"
              className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white font-bold border border-zinc-500 px-3.5 py-1.5 rounded-lg transition cursor-pointer shadow-sm flex items-center justify-center"
            >
              {isHeaderOverflowed ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              ) : (
                "Sign Out"
              )}
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-[#e7b833] w-full" />

        {/* Mobile Dropdown Navigation Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 right-0 bg-[#000000]/95 backdrop-blur-xl border-b border-zinc-800 shadow-2xl z-[150] p-4 flex flex-col gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <button
              onClick={() => { router.push("/"); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/") ? "bg-[#e7b833] text-gray-900 font-black shadow" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m16-11v11M8 14v3m4-3v3m4-3v3" />
              </svg>
              <span>Bank</span>
            </button>

            <button
              onClick={() => { router.push("/profile"); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/profile") ? "bg-[#e7b833] text-gray-900 font-black shadow" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <span>Profile</span>
            </button>

            <button
              onClick={() => { router.push("/gallery"); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/gallery") ? "bg-[#e7b833] text-gray-900 font-black shadow" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              <span>Gallery</span>
            </button>

            <button
              onClick={() => { router.push("/messages"); setMobileMenuOpen(false); }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition ${isActive("/messages") ? "bg-[#e7b833] text-gray-900 font-black shadow" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"}`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                <span>Messages</span>
              </div>
              {unreadMessagesCount > 0 && (
                <span className="w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 shadow animate-pulse">
                  {unreadMessagesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { router.push("/friends"); setMobileMenuOpen(false); }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition ${isActive("/friends") ? "bg-[#e7b833] text-gray-900 font-black shadow" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"}`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
                <span>Friends</span>
              </div>
              {friendRequestsCount > 0 && (
                <span className="w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 shadow">
                  {friendRequestsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { router.push("/social"); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/social") ? "bg-[#e7b833] text-gray-900 font-black shadow" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 9h13.5m-13.5 6h13.5m-7.5-12.75l-3 18.5m7.5-18.5l-3 18.5" />
              </svg>
              <span>Social</span>
            </button>

            <button
              onClick={() => { router.push("/streaming"); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/streaming") ? "bg-[#e7b833] text-gray-900 font-black shadow" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M12 12.75h.008v.008H12v-.008Z" />
              </svg>
              <span>Streaming</span>
            </button>

            <button
              onClick={() => { router.push("/members"); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/members") ? "bg-[#e7b833] text-gray-900 font-black shadow" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.25m-15.686 0A8.959 8.959 0 0 1 3 12c0-.778.099-1.533.284-2.25m0 0A11.959 11.959 0 0 1 12 10.5c2.998 0 5.74 1.1 7.843 2.918" />
              </svg>
              <span>Members</span>
            </button>

            {isKingDavid && (
              <button
                onClick={() => { router.push("/admin"); setMobileMenuOpen(false); }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition ${isActive("/admin") ? "bg-[#e7b833] text-gray-900 font-black shadow" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"}`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m-3 .75H6.75A2.25 2.25 0 0 1 4.5 16.5v-10.5A2.25 2.25 0 0 1 6.75 3.75h3.189a2.25 2.25 0 0 1 2.122 1.5H15.75A2.25 2.25 0 0 1 18 7.5v9a2.25 2.25 0 0 1-2.25 2.25h-3.75m-3-12.75V3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V4.5m-6 0h6" />
                  </svg>
                  <span>Applications</span>
                </div>
                {pendingCount > 0 && (
                  <span className="w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 shadow">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </header>

      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden text-left">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">Sign Out Confirmation</h3>
              <button onClick={() => setShowSignOutModal(false)} className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer">✕</button>
            </div>
            <div className="h-1 bg-[#e7b833]" />
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-700 font-medium leading-relaxed">This will end your current session! Are you sure?</p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowSignOutModal(false)} className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 hover:bg-gray-100 cursor-pointer text-gray-700">No</button>
                <button type="button" onClick={handleSignOutConfirm} className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow cursor-pointer">Yes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden text-left">
            <div className="bg-[#800000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold">⚠️ Reset Account Data</h3>
              <button onClick={() => setShowResetModal(false)} className="text-red-100 hover:text-white text-lg leading-none cursor-pointer">✕</button>
            </div>
            <div className="h-1 bg-[#660000]" />
            <form onSubmit={handleExecuteReset} className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-[#800000]">
                Warning: This will clear transaction history and reset session timers. Type an exact username or <strong>ALL</strong>.
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Username / ALL</label>
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
                <button type="button" onClick={() => setShowResetModal(false)} className="w-1/2 py-2.5 rounded text-sm font-semibold border border-gray-300 hover:bg-gray-100 cursor-pointer text-gray-700">Cancel</button>
                <button type="submit" className="w-1/2 py-2.5 rounded text-sm font-bold bg-[#800000] hover:bg-[#660000] text-white shadow cursor-pointer">Confirm Reset</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}