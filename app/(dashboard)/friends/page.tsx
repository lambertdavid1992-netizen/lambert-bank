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

interface ConfirmModalState {
  isOpen: boolean;
  type: "reject" | "cancel" | "remove" | "delete_user" | null;
  relationId: string | null;
  targetName: string | null;
  targetUserId?: string | null;
}

export default function FriendsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [isApproved, setIsApproved] = useState<boolean>(true);
  const [friends, setFriends] = useState<FriendRelation[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRelation[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRelation[]>([]);
  const [activeTab, setActiveTab] = useState<"FRIENDS" | "REQUESTS" | "SENT">("FRIENDS");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Admin Signup Info Modal State
  const [adminModalProfile, setAdminModalProfile] = useState<any | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    type: null,
    relationId: null,
    targetName: null,
    targetUserId: null,
  });

  const isAdmin = currentUsername.toLowerCase() === "kingdavid";

  const calculateAge = (dobString: string) => {
    if (!dobString) return "N/A";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return dobString;
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const loadData = useCallback(async (isInitial = false) => {
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

    const { data: relations } = await supabase
      .from("friendships")
      .select("*")
      .or(`sender_username.eq.${myUsername},receiver_username.eq.${myUsername}`);

    if (relations) {
      const acceptedList: FriendRelation[] = [];
      const pendingIncomingList: FriendRelation[] = [];
      const pendingSentList: FriendRelation[] = [];

      for (const rel of relations) {
        const otherUsername = rel.sender_username.toLowerCase() === myUsername.toLowerCase() 
          ? rel.receiver_username 
          : rel.sender_username;

        const { data: targetProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", otherUsername)
          .single();

        const enrichedRel = { ...rel, profile: targetProfile };

        if (rel.status === "accepted") {
          acceptedList.push(enrichedRel);
        } else if (rel.status === "pending") {
          if (rel.receiver_username.toLowerCase() === myUsername.toLowerCase()) {
            pendingIncomingList.push(enrichedRel);
          } else if (rel.sender_username.toLowerCase() === myUsername.toLowerCase()) {
            pendingSentList.push(enrichedRel);
          }
        }
      }

      setFriends(acceptedList);
      setFriendRequests(pendingIncomingList);
      setSentRequests(pendingSentList);
    }

    if (isInitial) setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Realtime subscription replacing 3-second polling
  useEffect(() => {
    const channel = supabase
      .channel("friends-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          loadData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadData]);

  const handleSearchUsers = async (query: string) => {
    if (!isApproved) {
      alert("Account pending approval. Friend requests are locked.");
      return;
    }
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_approved", true)
      .ilike("username", `%${query}%`)
      .neq("username", currentUsername)
      .limit(5);

    if (data) {
      setSearchResults(data);
    }
  };

  const handleSendRequest = async (targetUsername: string) => {
    if (!isApproved) {
      alert("Account pending approval. Friend requests are locked.");
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      sender_username: currentUsername,
      receiver_username: targetUsername,
      status: "pending",
    });

    if (error) {
      alert("Failed to send request: " + error.message);
    } else {
      setSearchQuery("");
      setSearchResults([]);
      await loadData(false);
    }
  };

  const handleRemoveMember = (relationId: string, targetName: string) => {
    setConfirmModal({
      isOpen: true,
      type: "remove",
      relationId,
      targetName,
    });
  };

  const executeConfirmedAction = async () => {
    if (!confirmModal.relationId || !confirmModal.type) return;
    const relationId = confirmModal.relationId;
    const actionType = confirmModal.type;

    setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null, targetUserId: null });

    setActionLoadingId(relationId);
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", relationId);

    if (error) {
      alert(`Failed to ${actionType} request: ` + error.message);
    } else {
      await loadData(false);
    }
    setActionLoadingId(null);
  };

  const executeDeleteUserFull = async () => {
    if (!confirmModal.targetUserId || confirmModal.type !== "delete_user") return;
    const userIdToDelete = confirmModal.targetUserId;
    setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null, targetUserId: null });

    try {
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("username, photo_url")
        .eq("user_id", userIdToDelete)
        .single();

      if (targetProfile) {
        const uName = targetProfile.username;
        if (targetProfile.photo_url) {
          try {
            const pathParts = targetProfile.photo_url.split('/profile-photos/');
            if (pathParts.length > 1) {
              await supabase.storage.from('profile-photos').remove([pathParts[1]]);
            }
          } catch (storageErr) {
            console.error("Storage removal error:", storageErr);
          }
        }
        await supabase.from("friendships").delete().or(`sender_username.eq.${uName},receiver_username.eq.${uName}`);
        await supabase.from("posts").delete().eq("username", uName);
        await supabase.from("post_likes").delete().eq("username", uName);
        await supabase.from("post_comments").delete().eq("username", uName);
        await supabase.from("posts").delete().ilike("profile_username", uName);
        await supabase.from("profile_gallery").delete().ilike("profile_username", uName);
        await supabase.from("profiles").delete().eq("user_id", userIdToDelete);
      }

      await supabase.rpc("admin_delete_user", { target_user_id: userIdToDelete });
      await loadData(false);
    } catch (err: any) {
      alert("Failed to delete user entirely: " + (err.message || err));
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
    } else {
      await loadData(false);
    }
    setActionLoadingId(null);
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
              <p className="text-[11px] text-amber-700">Friend requests and adding new connections are locked until KingDavid approves your account.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 uppercase">Friends Network</h2>
            <p className="text-xs text-gray-500">Connect with other members and manage your social network.</p>
          </div>

          {isApproved ? (
            <div className="relative w-full sm:w-72">
              <input
                key="active-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchUsers(e.target.value)}
                placeholder="Search users to add..."
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 font-medium bg-gray-50/50"
              />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                  {searchResults.map((u) => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-xs">
                      <div>
                        <span className="font-bold block">{u.first_name} {u.last_name}</span>
                        <span className="text-gray-400 font-mono text-[10px]">@{u.username}</span>
                      </div>
                      <button
                        onClick={() => handleSendRequest(u.username)}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase cursor-pointer hover:bg-emerald-700 transition shadow-xs"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full sm:w-72">
              <input
                key="locked-search-input"
                type="text"
                disabled
                value=""
                placeholder="Search locked: Pending approval..."
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed font-medium"
              />
            </div>
          )}
        </div>

        <div className="flex border-b border-gray-200 gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("FRIENDS")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "FRIENDS" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <span>Friends</span>
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">{friends.length}</span>
          </button>
          
          <button
            onClick={() => setActiveTab("REQUESTS")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "REQUESTS" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <span>REQUESTS</span>
            {friendRequests.length > 0 && (
              <span className="w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                {friendRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("SENT")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "SENT" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <span>PENDING</span>
            {sentRequests.length > 0 && (
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                {sentRequests.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-gray-500 text-center py-12">Loading network...</p>
        ) : activeTab === "FRIENDS" ? (
          friends.length === 0 ? (
            <div className="bg-gray-50 p-10 rounded-xl text-center space-y-2 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase">You have no friends added yet.</p>
              <p className="text-[11px] text-gray-400">Use the search bar above or check the Members page to add friends.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friends.map((item) => {
                const friendProf = item.profile;
                const friendUsername = item.sender_username.toLowerCase() === currentUsername.toLowerCase() 
                  ? item.receiver_username 
                  : item.sender_username;
                const isProcessing = Boolean(actionLoadingId) && actionLoadingId === item.id;
                const isFemaleFriend = friendProf?.gender?.toLowerCase() === "female";

                return (
                  <div key={item.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={() => {
                          if (isAdmin) setAdminModalProfile(friendProf);
                        }}
                        className={`w-14 h-14 rounded-lg bg-gray-200 overflow-hidden shrink-0 border border-gray-300 ${
                          isAdmin ? "cursor-pointer hover:opacity-80 transition" : ""
                        }`}
                        title={isAdmin ? "View complete signup info" : ""}
                      >
                        {friendProf?.photo_url ? (
                          <img src={friendProf.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 font-bold">Img</div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 
                            onClick={() => router.push(`/user/${friendUsername}`)}
                            className={`text-xs font-black uppercase cursor-pointer hover:underline inline-block px-2 py-0.5 rounded shadow-2xs ${
                              isFemaleFriend ? "bg-pink-200 text-gray-900" : "bg-blue-200 text-gray-900"
                            }`}
                          >
                            {friendProf?.first_name} {friendProf?.last_name}
                          </h3>
                        </div>
                        <p className="text-[10px] font-mono text-gray-600 font-bold mt-1">@{friendUsername}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Age: {calculateAge(friendProf?.dob)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-full">
                        Friend
                      </span>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleRemoveMember(item.id, friendUsername)}
                        className="px-2.5 py-0.5 bg-[#800000] hover:bg-[#660000] text-white rounded text-[9px] font-black uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                        title="Remove from friends"
                      >
                        {isProcessing ? "..." : "Remove"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : activeTab === "REQUESTS" ? (
          friendRequests.length === 0 ? (
            <div className="bg-gray-50 p-10 rounded-xl text-center space-y-2 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase">No incoming requests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friendRequests.map((req) => {
                const reqProf = req.profile;
                const isProcessing = Boolean(actionLoadingId) && actionLoadingId === req.id;
                const isFemaleReq = reqProf?.gender?.toLowerCase() === "female";

                return (
                  <div key={req.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={() => {
                          if (isAdmin) setAdminModalProfile(reqProf);
                        }}
                        className={`w-14 h-14 rounded-lg bg-gray-200 overflow-hidden shrink-0 border border-gray-300 ${
                          isAdmin ? "cursor-pointer hover:opacity-80 transition" : ""
                        }`}
                        title={isAdmin ? "View complete signup info" : ""}
                      >
                        {reqProf?.photo_url ? (
                          <img src={reqProf.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 font-bold">Img</div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 
                            onClick={() => router.push(`/user/${req.sender_username}`)}
                            className={`text-xs font-black uppercase cursor-pointer hover:underline inline-block px-2 py-0.5 rounded shadow-2xs ${
                              isFemaleReq ? "bg-pink-200 text-gray-900" : "bg-blue-200 text-gray-900"
                            }`}
                          >
                            {reqProf?.first_name} {reqProf?.last_name}
                          </h3>
                        </div>
                        <p className="text-[10px] font-mono text-gray-600 font-bold mt-1">@{req.sender_username}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Age: {calculateAge(reqProf?.dob)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase rounded-full">
                        Pending
                      </span>
                      <div className="flex gap-1">
                        <button
                          disabled={isProcessing || !isApproved}
                          onClick={() => handleAcceptRequest(req.id)}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                          title="Accept request"
                        >
                          ✓
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => setConfirmModal({
                            isOpen: true,
                            type: "reject",
                            relationId: req.id,
                            targetName: req.sender_username,
                          })}
                          className="px-2 py-0.5 bg-[#800000] hover:bg-[#660000] text-white rounded text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                          title="Reject request"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          sentRequests.length === 0 ? (
            <div className="bg-gray-50 p-10 rounded-xl text-center space-y-2 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase">No outgoing requests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentRequests.map((req) => {
                const reqProf = req.profile;
                const isProcessing = Boolean(actionLoadingId) && actionLoadingId === req.id;
                const isFemaleSent = reqProf?.gender?.toLowerCase() === "female";

                return (
                  <div key={req.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={() => {
                          if (isAdmin) setAdminModalProfile(reqProf);
                        }}
                        className={`w-14 h-14 rounded-lg bg-gray-200 overflow-hidden shrink-0 border border-gray-300 ${
                          isAdmin ? "cursor-pointer hover:opacity-80 transition" : ""
                        }`}
                        title={isAdmin ? "View complete signup info" : ""}
                      >
                        {reqProf?.photo_url ? (
                          <img src={reqProf.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 font-bold">Img</div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 
                            onClick={() => router.push(`/user/${req.receiver_username}`)}
                            className={`text-xs font-black uppercase cursor-pointer hover:underline inline-block px-2 py-0.5 rounded shadow-2xs ${
                              isFemaleSent ? "bg-pink-200 text-gray-900" : "bg-blue-200 text-gray-900"
                            }`}
                          >
                            {reqProf?.first_name} {reqProf?.last_name}
                          </h3>
                        </div>
                        <p className="text-[10px] font-mono text-gray-600 font-bold mt-1">@{req.receiver_username}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Age: {calculateAge(reqProf?.dob)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded-full">
                        Requested
                      </span>
                      <button
                        disabled={isProcessing}
                        onClick={() => setConfirmModal({
                          isOpen: true,
                          type: "cancel",
                          relationId: req.id,
                          targetName: req.receiver_username,
                        })}
                        className="px-2.5 py-0.5 bg-gray-200 hover:bg-[#800000] hover:text-white text-gray-700 rounded text-[9px] font-black uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                        title="Cancel sent friend request"
                      >
                        {isProcessing ? "..." : "Cancel"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* UNIFIED ADMIN SIGNUP INFO MODAL */}
      {adminModalProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden transition-all text-left">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">
                Signup Info: {adminModalProfile.first_name} {adminModalProfile.last_name}
              </h3>
              <button
                onClick={() => setAdminModalProfile(null)}
                className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833]" />

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <div className="w-20 h-24 rounded-lg bg-gray-100 border border-gray-300 overflow-hidden shrink-0 flex items-center justify-center">
                  {adminModalProfile.photo_url ? (
                    <img src={adminModalProfile.photo_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-gray-400">No Photo</span>
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  <p><span className="font-bold text-gray-400 uppercase text-[10px]">Full Name:</span> {adminModalProfile.first_name} {adminModalProfile.last_name}</p>
                  <p><span className="font-bold text-gray-400 uppercase text-[10px]">Username:</span> @{adminModalProfile.username}</p>
                  <p><span className="font-bold text-gray-400 uppercase text-[10px]">Email:</span> {adminModalProfile.email}</p>
                  <p><span className="font-bold text-gray-400 uppercase text-[10px]">Mobile Phone:</span> {adminModalProfile.mobile_phone || "N/A"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
                <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Date of Birth:</span> {adminModalProfile.dob} ({calculateAge(adminModalProfile.dob)})</div>
                <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Gender:</span> {adminModalProfile.gender || "N/A"}</div>
                <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Religion:</span> {adminModalProfile.religion || "N/A"}</div>
                <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Employment:</span> {adminModalProfile.employment_status || "N/A"}</div>
                <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Approval Status:</span> {adminModalProfile.is_approved ? "Approved" : "Pending Review"}</div>
              </div>

              <div className="text-xs text-gray-700 pt-2 border-t border-gray-100">
                <span className="font-bold text-gray-400 uppercase text-[10px] block">Residential Address:</span>
                <span className="font-medium text-gray-900">{adminModalProfile.address}</span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-100 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const profToDel = adminModalProfile;
                    setAdminModalProfile(null);
                    setConfirmModal({
                      isOpen: true,
                      type: "delete_user",
                      relationId: null,
                      targetName: profToDel.username,
                      targetUserId: profToDel.user_id,
                    });
                  }}
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                >
                  DELETE USER
                </button>
                <button
                  type="button"
                  onClick={() => setAdminModalProfile(null)}
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED DESTRUCTIVE CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden text-left">
            <div className="bg-[#800000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">
                {confirmModal.type === "reject" ? "Reject Friend Request" : confirmModal.type === "remove" ? "Remove Friend" : confirmModal.type === "cancel" ? "Cancel Friend Request" : "Delete User Entirely"}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null, targetUserId: null })}
                className="text-gray-300 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#660000]" />

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                {confirmModal.type === "reject" ? (
                  <>Are you sure you want to reject @<strong>{confirmModal.targetName}</strong>&apos;s friend request?</>
                ) : confirmModal.type === "remove" ? (
                  <>Are you sure you want to remove @<strong>{confirmModal.targetName}</strong> from your friends list?</>
                ) : confirmModal.type === "cancel" ? (
                  <>Are you sure you want to cancel your friend request to @<strong>{confirmModal.targetName}</strong>?</>
                ) : (
                  <>Are you sure you want to completely delete @<strong>{confirmModal.targetName}</strong>? This will reset all profile, wall, and account data entirely while preserving transaction records.</>
                )}
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null, targetUserId: null })}
                  className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmModal.type === "delete_user" ? executeDeleteUserFull : executeConfirmedAction}
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}