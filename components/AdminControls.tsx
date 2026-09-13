"use client";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

interface AdminControlsProps {
  currentUsername: string;
  pendingCount?: number;
  onOpenAdminPanel?: () => void;
  onRefreshData?: () => void;
}

export default function AdminControls({ 
  currentUsername, 
  pendingCount = 0, 
  onOpenAdminPanel,
  onRefreshData 
}: AdminControlsProps) {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  if (currentUsername !== "KingDavid") return null;

  const handleResetAllData = async () => {
    const targetUserPrompt = prompt(
      `Enter exact username to reset (e.g., David, Sarah, Alex, Elysha), or type "ALL":`,
      "ALL"
    );

    if (!targetUserPrompt) return;
    const cleanTarget = targetUserPrompt.trim();

    const allowedUsers = ["KingDavid", "David", "Sarah", "Alex", "Elysha"];
    if (cleanTarget.toUpperCase() === "ALL") {
      if (confirm("Are you sure you want to reset ALL profiles and transactions in Supabase?")) {
        for (const user of allowedUsers) {
          await supabase.from("transactions").delete().or(`username.eq.${user},recipient_name.eq.${user}`);
          await supabase.from("profiles").update({ 
            balance_cents: 0, 
            last_claim_date: null, 
            accumulated_session_seconds: 0, 
            pending_claimed_cents: 0,
            session_start_timestamp: null, 
            last_heartbeat_timestamp: null,
            active_session_id: null 
          }).eq("username", user);
        }
        window.location.reload();
      }
    } else {
      const matchedUser = allowedUsers.find(
        (u) => u.toLowerCase() === cleanTarget.toLowerCase()
      );

      if (!matchedUser) {
        return alert(`Profile "${cleanTarget}" not found.`);
      }

      if (confirm(`Reset account data for ${matchedUser}?`)) {
        await supabase.from("transactions").delete().or(`username.eq.${matchedUser},recipient_name.eq.${matchedUser}`);
        await supabase.from("profiles").update({ 
          balance_cents: 0, 
          last_claim_date: null, 
          accumulated_session_seconds: 0, 
          pending_claimed_cents: 0,
          session_start_timestamp: null, 
          last_heartbeat_timestamp: null,
          active_session_id: null 
        }).eq("username", matchedUser);

        if (currentUsername.toLowerCase() === matchedUser.toLowerCase()) {
          window.location.reload();
        } else {
          alert(`Successfully reset data for ${matchedUser}.`);
          if (onRefreshData) onRefreshData();
        }
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 print:hidden">
      <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm text-xs font-bold uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
          <span>King David Admin Controls</span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span>Command Centre</span>
              {pendingCount > 0 && (
                <span className="bg-rose-500 text-white px-1.5 py-0.2 rounded-full text-[10px]">{pendingCount}</span>
              )}
            </button>
          )}
          <button
            onClick={handleResetAllData}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
            title="Reset specific user account data"
          >
            Reset Data
          </button>
        </div>
      </div>
    </div>
  );
}