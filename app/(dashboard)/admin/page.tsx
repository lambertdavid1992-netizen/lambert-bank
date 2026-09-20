"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  dob: string;
  address: string;
  email: string;
  mobile_phone: string | null;
  gender: string | null;
  religion: string | null;
  employment_status: string | null;
  photo_url: string | null;
  is_approved: boolean;
}

interface ConfirmModalState {
  isOpen: boolean;
  type: "reject" | "cancel" | "remove" | "delete_user" | null;
  relationId: string | null;
  targetName: string | null;
  targetUserId?: string | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deleteLoadingUserId, setDeleteLoadingUserId] = useState<string | null>(null);

  // Admin Signup Info Modal State
  const [adminModalProfile, setAdminModalProfile] = useState<any | null>(null);

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    type: null,
    relationId: null,
    targetName: null,
    targetUserId: null,
  });

  const calculateAge = (dobString: string) => {
    if (!dobString) return "N/A";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return dobString;
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const fetchPendingApplications = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_approved", false)
      .order("first_name", { ascending: true });

    if (error) {
      setError("Failed to load pending applications: " + error.message);
    } else {
      setPendingUsers(data || []);
    }
  }, [supabase]);

  const checkAdminAndFetch = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", session.user.id)
      .single();

    if (!profile || profile.username.toLowerCase() !== "kingdavid") {
      setError("Access Denied. Authorized KingDavid administrative clearance required.");
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);
    await fetchPendingApplications();
    setLoading(false);
  }, [router, supabase, fetchPendingApplications]);

  useEffect(() => {
    checkAdminAndFetch();
  }, [checkAdminAndFetch]);

  // Realtime listener for instant application queue updates (Accept/Reject syncs automatically)
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("admin-pending-applications-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          fetchPendingApplications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, supabase, fetchPendingApplications]);

  const handleApprove = async (userId: string, username: string) => {
    const nowIso = new Date().toISOString();
    setActionLoadingId(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: true, session_start_timestamp: nowIso })
      .eq("user_id", userId);

    if (error) {
      alert("Failed to approve application: " + error.message);
    } else {
      setPendingUsers((prev) => prev.filter((u) => u.user_id !== userId));
    }
    setActionLoadingId(null);
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
        await supabase.from("profile_gallery").delete().ilike("profile_username", uName);

        await supabase.from("profiles").delete().eq("user_id", userIdToDelete);
      }

      const { error: rpcError } = await supabase.rpc("admin_delete_user", { target_user_id: userIdToDelete });
      if (rpcError) {
        alert("Auth user deletion failed: " + rpcError.message);
      }

      await fetchPendingApplications();
    } catch (err: any) {
      alert("Failed to delete user entirely: " + (err.message || err));
    } finally {
      setDeleteLoadingUserId(null);
    }
  };

  const isFemaleModal = adminModalProfile?.gender?.toLowerCase() === "female";

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
        Verifying Administrative Clearance...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto text-center space-y-4 my-12">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto font-bold text-lg">!</div>
        <h1 className="text-lg font-black text-gray-900 uppercase">Unauthorized Access</h1>
        <p className="text-xs text-gray-500">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Applications Queue */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">
            Pending Applications ({pendingUsers.length})
          </h2>
          <button
            onClick={fetchPendingApplications}
            className="text-xs text-blue-600 font-bold hover:underline cursor-pointer uppercase tracking-wider"
          >
            🔄 Refresh Queue
          </button>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No pending applications in queue</p>
            <p className="text-[11px] text-gray-500">All new member applications have been processed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingUsers.map((user) => {
              const isFemaleUser = user.gender?.toLowerCase() === "female";
              const isApproving = actionLoadingId === user.user_id;

              return (
                <div key={user.id} className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50/50 hover:shadow-md transition relative">
                  
                  <div className="flex items-center gap-4 border-b border-gray-200/60 pb-4">
                    <div 
                      onClick={() => setAdminModalProfile(user)}
                      className="w-16 h-20 rounded-lg bg-gray-200 border border-gray-300 overflow-hidden shadow-inner flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition"
                      title="View complete signup info"
                    >
                      {user.photo_url ? (
                        <img src={user.photo_url} alt="Profile Identity" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-gray-400">No Img</span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col items-start gap-1">
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-full tracking-wider">
                        Pending Review
                      </span>
                      <div>
                        <h3 
                          onClick={() => setAdminModalProfile(user)}
                          className={`text-sm font-black uppercase inline-block px-2 py-0.5 rounded shadow-2xl cursor-pointer hover:underline ${
                            isFemaleUser ? "bg-pink-200 text-gray-900" : "bg-blue-200 text-gray-900"
                          }`}
                          title="View complete signup info"
                        >
                          {user.first_name} {user.last_name}
                        </h3>
                        <p className="text-xs font-mono text-blue-600 font-bold mt-1">@{user.username}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-xs text-gray-700">
                    <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Email:</span> {user.email}</div>
                    <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Mobile:</span> {user.mobile_phone || "N/A"}</div>
                    <div><span className="font-bold text-gray-400 uppercase text-[10px] block">DOB:</span> {user.dob} ({calculateAge(user.dob)})</div>
                    <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Gender:</span> {user.gender || "N/A"}</div>
                    <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Religion:</span> {user.religion || "N/A"}</div>
                    <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Employment:</span> {user.employment_status || "N/A"}</div>
                  </div>

                  <div className="text-xs text-gray-700 pt-1 border-t border-gray-200/60">
                    <span className="font-bold text-gray-400 uppercase text-[10px] block">Residential Address:</span>
                    <span className="font-medium text-gray-900">{user.address}</span>
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-gray-200">
                    <button
                      type="button"
                      disabled={isApproving}
                      onClick={() => setConfirmModal({
                        isOpen: true,
                        type: "delete_user",
                        relationId: null,
                        targetName: user.username,
                        targetUserId: user.user_id,
                      })}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider shadow transition cursor-pointer disabled:opacity-50"
                    >
                      ✕ Reject
                    </button>
                    <button
                      type="button"
                      disabled={isApproving}
                      onClick={() => handleApprove(user.user_id, user.username)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow transition cursor-pointer disabled:opacity-50"
                    >
                      {isApproving ? "Processing..." : "✓ Accept"}
                    </button>
                  </div>
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
                Delete User Entirely
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
                Are you sure you want to completely delete @<strong>{confirmModal.targetName}</strong>? This will reset all profile, wall, and account data entirely while preserving transaction records.
              </div>

              <div className="flex gap-2 pt-2">
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}