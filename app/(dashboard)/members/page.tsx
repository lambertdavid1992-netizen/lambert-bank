"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

interface FriendRelation {
  id: string;
  sender_username: string;
  receiver_username: string;
  status: "pending" | "accepted";
  profile?: any;
}

export default function MembersPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [members, setMembers] = useState<any[]>([]);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [isApproved, setIsApproved] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const calculateAge = (dobString: string) => {
    if (!dobString) return "N/A";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return dobString;
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const loadMembersData = useCallback(async (isInitial = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, is_approved")
      .eq("user_id", user.id)
      .single();

    if (!profile) return;
    const myUsername = profile.username;
    setCurrentUsername(myUsername);
    setIsApproved(Boolean(profile.is_approved));

    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`sender_username.eq.${myUsername},receiver_username.eq.${myUsername}`);

    const connectionMap = new Map<string, { id: string; status: string; sender: string }>(); 
    if (friendships) {
      for (const f of friendships) {
        const other = f.sender_username.toLowerCase() === myUsername.toLowerCase() 
          ? f.receiver_username.toLowerCase() 
          : f.sender_username.toLowerCase();
        connectionMap.set(other, { id: f.id, status: f.status, sender: f.sender_username });
      }
    }

    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_approved", true);

    if (allProfiles) {
      const filtered = allProfiles.filter((p) => {
        const isSelf = p.username.toLowerCase() === myUsername.toLowerCase();
        return !isSelf;
      });

      const enrichedMembers = filtered.map((m) => {
        const connection = connectionMap.get(m.username.toLowerCase());
        return {
          ...m,
          friendshipId: connection?.id || null,
          friendshipStatus: connection?.status || null,
          friendshipSender: connection?.sender || null,
        };
      });

      setMembers(enrichedMembers);
    }
    if (isInitial) setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadMembersData(true);

    const interval = setInterval(() => {
      loadMembersData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [loadMembersData, refreshTrigger]);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleAddMember = async (targetUsername: string) => {
    if (!isApproved) {
      alert("Account pending approval. Adding members is locked.");
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      sender_username: currentUsername,
      receiver_username: targetUsername,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        loadMembersData(false);
        triggerRefresh();
      } else {
        alert("Failed to send request: " + error.message);
      }
    } else {
      loadMembersData(false);
      triggerRefresh();
    }
  };

  const handleRemoveMember = async (relationId: string, targetName: string) => {
    if (actionLoadingId) return;
    if (!confirm(`Are you sure you want to remove @${targetName} from your friends list?`)) return;

    setActionLoadingId(relationId);
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", relationId);

    if (error) {
      alert("Failed to remove friend: " + error.message);
      setActionLoadingId(null);
    } else {
      loadMembersData(false);
      triggerRefresh();
      setActionLoadingId(null);
    }
  };

  const handleCancelRequest = async (relationId: string, targetName: string) => {
    if (actionLoadingId) return;
    if (!confirm(`Are you sure you want to cancel your friend request to @${targetName}?`)) return;

    setActionLoadingId(relationId);
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", relationId);

    if (error) {
      alert("Failed to cancel request: " + error.message);
      setActionLoadingId(null);
    } else {
      loadMembersData(false);
      triggerRefresh();
      setActionLoadingId(null);
    }
  };

  const handleAcceptRequest = async (relationId: string) => {
    if (actionLoadingId) return;
    if (!isApproved) {
      alert("Account pending approval.");
      return;
    }

    setActionLoadingId(relationId);
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", relationId);

    if (error) {
      alert("Failed to accept request: " + error.message);
      setActionLoadingId(null);
    } else {
      loadMembersData(false);
      triggerRefresh();
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {!isApproved && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-base">
              ⏳
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">Account Pending Approval</h3>
              <p className="text-[11px] text-amber-700">You can view active members, but adding new connections is locked until KingDavid approves your account.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 uppercase">Platform Members</h2>
            <p className="text-xs text-gray-500">Discover active members and send friend connection requests.</p>
          </div>
          <button 
            onClick={() => router.push("/friends")} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
          >
            View Friends →
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-gray-500 text-center py-12">Loading members...</p>
        ) : members.length === 0 ? (
          <div className="bg-gray-50 p-10 rounded-xl text-center space-y-2 border border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase">No available members found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((m) => {
              const isAcceptedFriend = m.friendshipStatus === "accepted";
              const isPending = m.friendshipStatus === "pending";
              const isSender = isPending && m.friendshipSender?.toLowerCase() === currentUsername.toLowerCase();
              const isReceiver = isPending && !isSender;
              const isProcessing = actionLoadingId === m.friendshipId;

              return (
                <div key={m.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-300">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 font-bold">Img</div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 
                          onClick={() => router.push(`/user/${m.username}`)}
                          className="text-xs font-black text-blue-600 hover:underline uppercase cursor-pointer"
                        >
                          {m.first_name} {m.last_name}
                        </h3>
                        {isAcceptedFriend ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-full">
                            Friend
                          </span>
                        ) : isSender ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded-full">
                            Requested
                          </span>
                        ) : isReceiver ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase rounded-full">
                            Pending
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] font-mono text-gray-600 font-bold">@{m.username}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Age: {calculateAge(m.dob)}</p>
                    </div>
                  </div>

                  {isAcceptedFriend ? (
                    <button
                      disabled={isProcessing}
                      onClick={() => handleRemoveMember(m.friendshipId, m.username)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isProcessing ? "Processing..." : "Remove"}
                    </button>
                  ) : isSender ? (
                    <button
                      disabled={isProcessing}
                      onClick={() => handleCancelRequest(m.friendshipId, m.username)}
                      className="px-3 py-2 bg-gray-200 hover:bg-rose-600 hover:text-white text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                      title="Cancel sent friend request"
                    >
                      {isProcessing ? "Processing..." : "Cancel Request"}
                    </button>
                  ) : isReceiver ? (
                    <div className="flex gap-1.5">
                      {isApproved ? (
                        <button
                          disabled={isProcessing}
                          onClick={() => handleAcceptRequest(m.friendshipId)}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          Accept
                        </button>
                      ) : (
                        <button
                          disabled
                          className="px-3 py-2 bg-gray-300 text-gray-500 rounded-lg text-xs font-bold uppercase tracking-wider cursor-not-allowed"
                        >
                          Accept
                        </button>
                      )}
                      <button
                        disabled={isProcessing}
                        onClick={() => handleRemoveMember(m.friendshipId, m.username)}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : isApproved ? (
                    <button
                      onClick={() => handleAddMember(m.username)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
                    >
                      Add
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg text-xs font-bold uppercase tracking-wider cursor-not-allowed shadow-xs"
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}