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
  type: "reject" | "cancel" | "delete_user" | null;
  relationId: string | null;
  targetName: string | null;
  targetUserId?: string | null;
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
  const [deleteLoadingUserId, setDeleteLoadingUserId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
      setActionLoadingId(null);
    } else {
      loadMembersData(false);
      triggerRefresh();
      setActionLoadingId(null);
    }
  };

  const executeDeleteUserFull = async () => {
    if (!confirmModal.targetUserId || confirmModal.type !== "delete_user") return;
    const userIdToDelete = confirmModal.targetUserId;

    setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null, targetUserId: null });
    setDeleteLoadingUserId(userIdToDelete);

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

        const { data: userPosts } = await supabase.from("posts").select("id").eq("username", uName);
        if (userPosts && userPosts.length > 0) {
          const pIds = userPosts.map(p => p.id);
          await supabase.from("post_likes").delete().in("post_id", pIds);
          await supabase.from("post_comments").delete().in("post_id", pIds);
          await supabase.from("posts").delete().eq("username", uName);
        }
        await supabase.from("post_likes").delete().eq("username", uName);
        await supabase.from("post_comments").delete().eq("username", uName);
        await supabase.from("posts").delete().ilike("profile_username", uName);

        await supabase.from("profiles").delete().eq("user_id", userIdToDelete);
      }

      const { error: rpcError } = await supabase.rpc("admin_delete_user", { target_user_id: userIdToDelete });
      if (rpcError) {
        alert("Auth user deletion failed: " + rpcError.message);
      }

      loadMembersData(false);
      triggerRefresh();
      setDeleteLoadingUserId(null);
    } catch (err: any) {
      alert("Failed to delete user entirely: " + (err.message || err));
      setDeleteLoadingUserId(null);
    }
  };

  const executeModalAcceptFromReject = async () => {
    if (!confirmModal.relationId) return;
    const relationId = confirmModal.relationId;

    setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null, targetUserId: null });
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

  const isFemaleModal = adminModalProfile?.gender?.toLowerCase() === "female";

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
            <p className="text-xs text-gray-500">Discover active members.</p>
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
              const isDeleting = deleteLoadingUserId === m.user_id;
              const isFemaleMember = m.gender?.toLowerCase() === "female";

              return (
                <div key={m.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-xs relative">
                  
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onMouseUp={(e) => e.currentTarget.blur()}
                      onClick={() => setConfirmModal({
                        isOpen: true,
                        type: "delete_user",
                        relationId: null,
                        targetName: m.username,
                        targetUserId: m.user_id,
                      })}
                      className="absolute top-2 right-2 w-5 h-5 bg-[#800000] hover:bg-[#660000] active:bg-[#800000] text-white rounded-sm text-[10px] font-black flex items-center justify-center transition cursor-pointer shadow-xs disabled:opacity-50 focus:outline-none"
                      title="Delete user entirely"
                    >
                      {isDeleting ? "..." : "✕"}
                    </button>
                  )}

                  <div className="flex items-center gap-3">
                    <div 
                      onClick={() => {
                        if (isAdmin) setAdminModalProfile(m);
                      }}
                      className={`w-14 h-14 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-300 ${
                        isAdmin ? "cursor-pointer hover:opacity-80 transition" : ""
                      }`}
                      title={isAdmin ? "View complete signup info" : ""}
                    >
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
                          className={`text-xs font-black uppercase cursor-pointer hover:underline inline-block px-2 py-0.5 rounded shadow-2xs ${
                            isFemaleMember ? "bg-pink-200 text-gray-900" : "bg-blue-200 text-gray-900"
                          }`}
                        >
                          {m.first_name} {m.last_name}
                        </h3>
                      </div>
                      <p className="text-[10px] font-mono text-gray-600 font-bold mt-1">@{m.username}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Age: {calculateAge(m.dob)}</p>
                    </div>
                  </div>

                  {isAcceptedFriend ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-full">
                        Friend
                      </span>
                      <button
                        disabled={isProcessing}
                        onMouseUp={(e) => e.currentTarget.blur()}
                        onClick={() => handleRemoveMember(m.friendshipId, m.username)}
                        className="px-2.5 py-0.5 bg-[#800000] hover:bg-[#660000] text-white rounded text-[9px] font-black uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50 focus:outline-none"
                        title="Remove from friends"
                      >
                        {isProcessing ? "..." : "Remove"}
                      </button>
                    </div>
                  ) : isSender ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded-full">
                        Requested
                      </span>
                      <button
                        disabled={isProcessing}
                        onMouseUp={(e) => e.currentTarget.blur()}
                        onClick={() => setConfirmModal({
                          isOpen: true,
                          type: "cancel",
                          relationId: m.friendshipId,
                          targetName: m.username,
                        })}
                        className="px-2.5 py-0.5 bg-gray-200 hover:bg-[#800000] hover:text-white text-gray-700 rounded text-[9px] font-black uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50 focus:outline-none"
                        title="Cancel sent friend request"
                      >
                        {isProcessing ? "..." : "Cancel"}
                      </button>
                    </div>
                  ) : isReceiver ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase rounded-full">
                        Pending
                      </span>
                      <div className="flex gap-1">
                        {isApproved ? (
                          <button
                            disabled={isProcessing}
                            onMouseUp={(e) => e.currentTarget.blur()}
                            onClick={() => handleAcceptRequest(m.friendshipId)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50 focus:outline-none"
                            title="Accept request"
                          >
                            ✓
                          </button>
                        ) : (
                          <button
                            disabled
                            className="px-2 py-0.5 bg-gray-300 text-gray-500 rounded text-xs font-bold cursor-not-allowed"
                          >
                            ✓
                          </button>
                        )}
                        <button
                          disabled={isProcessing}
                          onMouseUp={(e) => e.currentTarget.blur()}
                          onClick={() => setConfirmModal({
                            isOpen: true,
                            type: "reject",
                            relationId: m.friendshipId,
                            targetName: m.username,
                          })}
                          className="px-2 py-0.5 bg-[#800000] hover:bg-[#660000] text-white rounded text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50 focus:outline-none"
                          title="Reject request"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : isApproved ? (
                    <button
                      onMouseUp={(e) => e.currentTarget.blur()}
                      onClick={() => handleAddMember(m.username)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs focus:outline-none"
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

      {/* ADMIN SIGNUP INFO MODAL */}
      {adminModalProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden transition-all text-left">
            <div className={`p-4 flex justify-between items-center font-bold ${
              isFemaleModal ? "bg-pink-200 text-gray-900" : "bg-blue-200 text-gray-900"
            }`}>
              <h3 className="text-base font-bold">
                Signup Info: {adminModalProfile.first_name} {adminModalProfile.last_name}
              </h3>
              <button
                onClick={() => setAdminModalProfile(null)}
                className="text-gray-700 hover:text-black text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className={`h-1 ${isFemaleModal ? "bg-pink-300" : "bg-blue-300"}`} />

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

              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
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
                  className="px-4 py-2 rounded text-xs font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                >
                  DELETE USER
                </button>
                <button
                  type="button"
                  onClick={() => setAdminModalProfile(null)}
                  className={`px-6 py-2 rounded text-xs font-bold shadow transition cursor-pointer ${
                    isFemaleModal ? "bg-pink-200 hover:bg-pink-300 text-gray-900" : "bg-blue-200 hover:bg-blue-300 text-gray-900"
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden transition-all text-left">
            <div className="bg-[#800000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">
                {confirmModal.type === "reject" ? "Reject Friend Request" : confirmModal.type === "cancel" ? "Cancel Friend Request" : "Delete User Entirely"}
              </h3>
              <button
                onClick={() => setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null, targetUserId: null })}
                className="text-red-100 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#660000]" />

            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 text-xs text-red-900 leading-relaxed">
                {confirmModal.type === "reject" ? (
                  <>Are you sure you want to reject @<strong>{confirmModal.targetName}</strong>&apos;s friend request?</>
                ) : confirmModal.type === "cancel" ? (
                  <>Are you sure you want to cancel your friend request to @<strong>{confirmModal.targetName}</strong>?</>
                ) : (
                  <>Are you sure you want to completely delete @<strong>{confirmModal.targetName}</strong>? This will reset all profile, wall, and account data entirely while preserving transaction records.</>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {confirmModal.type === "reject" ? (
                  <>
                    <button
                      type="button"
                      onClick={executeModalAcceptFromReject}
                      className="w-1/2 py-2.5 rounded text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={executeConfirmedAction}
                      className="w-1/2 py-2.5 rounded text-sm font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                    >
                      Reject
                    </button>
                  </>
                ) : confirmModal.type === "delete_user" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null, targetUserId: null })}
                      className="w-1/2 py-2.5 rounded text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={executeDeleteUserFull}
                      className="w-1/2 py-2.5 rounded text-sm font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null })}
                      className="w-1/2 py-2.5 rounded text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={executeConfirmedAction}
                      className="w-1/2 py-2.5 rounded text-sm font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                    >
                      Confirm
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}