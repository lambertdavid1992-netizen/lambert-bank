"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

const SessionContext = createContext<{ 
  accumulatedMs: number; 
  pendingBalanceCents: number; 
  multiplier: number;
  totalDays: number;
  claimPendingBalance: () => Promise<boolean>;
  resetSession: () => Promise<void>;
  addSessionDays: (days: number) => Promise<boolean>;
}>({ 
  accumulatedMs: 0, 
  pendingBalanceCents: 0, 
  multiplier: 1.00,
  totalDays: 0,
  claimPendingBalance: async () => false,
  resetSession: async () => {},
  addSessionDays: async () => false
});

export function useSessionTimer() {
  return useContext(SessionContext);
}

export default function SessionTimerProvider({ children }: { children: React.ReactNode }) {
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [accumulatedMs, setAccumulatedMs] = useState<number>(0);
  const [pendingClaimedCents, setPendingClaimedCents] = useState<number>(0);

  const totalSeconds = Math.floor(accumulatedMs / 1000);
  const totalDays = Math.floor(totalSeconds / 86400);
  const multiplier = Number((1 + (totalDays * 0.01)).toFixed(2));
  
  // Rate: $0.06 per 30 seconds (0.2 cents per second)
  const totalEarnedCentsPrecise = (totalSeconds * 0.2) * multiplier;
  const unclaimedCentsPrecise = Math.max(0, totalEarnedCentsPrecise - (pendingClaimedCents || 0));
  const pendingBalanceCents = Number((unclaimedCentsPrecise / 100).toFixed(5));

  const usernameRef = useRef<string>("");
  const sessionTokenRef = useRef<string>("");
  const isApprovedRef = useRef<boolean>(false);
  const isSessionActiveRef = useRef<boolean>(false);

  const clearSessionState = useCallback(() => {
    usernameRef.current = "";
    sessionTokenRef.current = "";
    isApprovedRef.current = false;
    isSessionActiveRef.current = false;
    setAccumulatedMs(0);
    setPendingClaimedCents(0);
  }, []);

  const resetSession = useCallback(async () => {
    if (!usernameRef.current) return;
    try {
      await supabase.rpc("reset_user_session_time", {
        target_username: usernameRef.current,
      });
      setAccumulatedMs(0);
      setPendingClaimedCents(0);
    } catch (err) {
      console.error("Failed to reset session on server:", err);
    }
  }, [supabase]);

  const addSessionDays = useCallback(async (days: number): Promise<boolean> => {
    if (!usernameRef.current || days <= 0) return false;
    try {
      const { data: newSeconds, error } = await supabase.rpc("admin_add_session_days", {
        target_username: usernameRef.current,
        days_to_add: days,
      });

      if (!error && typeof newSeconds === "number") {
        setAccumulatedMs(newSeconds * 1000);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to add session days:", err);
      return false;
    }
  }, [supabase]);

  const claimPendingBalance = useCallback(async (): Promise<boolean> => {
    if (!usernameRef.current) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const timeSlice = Date.now().toString().slice(-6);
      const rand = Math.floor(1000 + Math.random() * 9000);
      const txnId = `TXN-${timeSlice}-${rand}`;
      
      const now = new Date();
      const datePart = now.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
      const timePart = now.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
      const timestampStr = `${datePart}, ${timePart}`;

      const clientSeconds = Math.floor(accumulatedMs / 1000);

      const { data: newBalance, error } = await supabase.rpc("claim_pending_balance", {
        p_user_id: session.user.id,
        p_username: usernameRef.current,
        p_timestamp_str: timestampStr,
        p_txn_id: txnId,
        p_client_seconds: clientSeconds,
      });

      if (!error && typeof newBalance === "number") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("pending_claimed_cents, accumulated_session_seconds")
          .eq("username", usernameRef.current)
          .single();
        
        if (profile) {
          setPendingClaimedCents(profile.pending_claimed_cents ?? 0);
          if (typeof profile.accumulated_session_seconds === "number") {
            setAccumulatedMs((prevMs) => {
              const currentRemainder = prevMs % 1000;
              return (profile.accumulated_session_seconds * 1000) + currentRemainder;
            });
          }
        }
        return true;
      }

      if (error) {
        alert(error.message);
      }
      return false;
    } catch (err) {
      console.error("Failed to claim pending balance:", err);
      return false;
    }
  }, [supabase, accumulatedMs]);

  // Non-expiring heartbeat: syncs time with server without ever forcing logouts or timeouts
  const sendHeartbeat = useCallback(async () => {
    if (!usernameRef.current || !sessionTokenRef.current || !isApprovedRef.current) return;
    try {
      const { data: serverSeconds, error } = await supabase.rpc("record_session_heartbeat", {
        target_username: usernameRef.current,
        session_token: sessionTokenRef.current,
      });

      const numericSeconds = Number(serverSeconds);
      if (!error && !isNaN(numericSeconds) && numericSeconds >= 0 && isSessionActiveRef.current) {
        setAccumulatedMs((prev) => {
          if (prev === 0 && numericSeconds > 10) return prev; 
          const remainder = prev % 1000;
          return (numericSeconds * 1000) + remainder;
        });
      }
    } catch (err) {
      console.error("Session heartbeat sync failed:", err);
    }
  }, [supabase]);

  // Realtime listener for instant admin resets on active user accounts
  useEffect(() => {
    if (!usernameRef.current) return;

    const channel = supabase
      .channel(`profile-reset-listener-${usernameRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `username=eq.${usernameRef.current}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated && updated.accumulated_session_seconds === 0 && updated.balance_cents === 0) {
            setAccumulatedMs(0);
            setPendingClaimedCents(0);
            window.location.reload();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (isMounted) clearSessionState();
        return;
      }

      const email = session.user.email || "";
      let targetUser = "";
      let approved = false;

      if (email.toLowerCase() === "lambertdavid1992@gmail.com") {
        targetUser = "KingDavid";
        approved = true;
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, is_approved")
          .eq("user_id", session.user.id)
          .single();

        if (profile) {
          targetUser = profile.username;
          approved = Boolean(profile.is_approved);
        }
      }

      if (!isMounted) return;

      if (!approved || !targetUser) {
        clearSessionState();
        return;
      }

      let currentActiveToken = sessionStorage.getItem("lambert_active_token");
      if (!currentActiveToken) {
        currentActiveToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem("lambert_active_token", currentActiveToken);
      }

      sessionTokenRef.current = currentActiveToken;
      usernameRef.current = targetUser;
      isApprovedRef.current = true;
      isSessionActiveRef.current = true;

      const [startRes, profileRes] = await Promise.all([
        supabase.rpc("start_session", {
          target_username: targetUser,
          session_token: currentActiveToken,
        }),
        supabase.from("profiles").select("accumulated_session_seconds, pending_claimed_cents").eq("username", targetUser).single()
      ]);

      if (!isMounted) return;

      const dbSeconds = profileRes.data?.accumulated_session_seconds ?? 0;
      const rpcSeconds = typeof startRes.data === "number" ? startRes.data : 0;
      const resolvedSeconds = Math.max(dbSeconds, rpcSeconds);

      setAccumulatedMs(resolvedSeconds * 1000);

      if (profileRes.data && typeof profileRes.data.pending_claimed_cents === "number") {
        setPendingClaimedCents(profileRes.data.pending_claimed_cents);
      }
    }

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        clearSessionState();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        initializeSession();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, clearSessionState]);

  // Continuous local earning tick: accumulates time and money every 100ms as long as the tab is open
  useEffect(() => {
    const uiTickInterval = setInterval(() => {
      if (isApprovedRef.current && usernameRef.current) {
        setAccumulatedMs((prev) => prev + 100);
      }
    }, 100);

    return () => clearInterval(uiTickInterval);
  }, []);

  // Periodic server sync heartbeat every 30 seconds
  useEffect(() => {
    const serverHeartbeatInterval = setInterval(() => {
      if (isApprovedRef.current && usernameRef.current) {
        sendHeartbeat();
      }
    }, 30000);

    return () => clearInterval(serverHeartbeatInterval);
  }, [sendHeartbeat]);

  return (
    <SessionContext.Provider value={{ accumulatedMs, pendingBalanceCents, multiplier, totalDays, claimPendingBalance, resetSession, addSessionDays }}>
      {children}
    </SessionContext.Provider>
  );
}