"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function UserPublicProfilePage() {
  const router = useRouter();
  const params = useParams();
  const targetUsername = params?.username as string;

  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [profile, setProfile] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [friendship, setFriendship] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const calculateAge = (dobString: string) => {
    if (!dobString) return "N/A";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return dobString;
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .single();
      
    if (viewerProfile) {
      setCurrentUser(viewerProfile);
      setCurrentUsername(viewerProfile.username);
    }

    const { data: targetData } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", targetUsername)
      .single();

    if (targetData) {
      setProfile(targetData);

      if (viewerProfile) {
        const myName = viewerProfile.username;
        const otherName = targetData.username;

        const { data: relData } = await supabase
          .from("friendships")
          .select("*")
          .or(`and(sender_username.eq.${myName},receiver_username.eq.${otherName}),and(sender_username.eq.${otherName},receiver_username.eq.${myName})`)
          .maybeSingle();

        setFriendship(relData || null);
      }
    }
    setLoading(false);
  }, [targetUsername, router, supabase]);

  useEffect(() => {
    if (targetUsername) {
      loadData();
    }
  }, [targetUsername, loadData]);

  const handleAddMember = async () => {
    if (!currentUser?.is_approved) {
      alert("Account pending approval. Adding members is locked.");
      return;
    }
    setActionLoading(true);
    const { error } = await supabase.from("friendships").insert({
      sender_username: currentUsername,
      receiver_username: profile.username,
      status: "pending",
    });

    if (error) {
      alert("Failed to send request: " + error.message);
    } else {
      await loadData();
    }
    setActionLoading(false);
  };

  const handleRemoveMember = async () => {
    if (!friendship || actionLoading) return;
    if (!confirm(`Are you sure you want to remove @${profile.username} from your friends list?`)) return;

    setActionLoading(true);
    const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);

    if (error) {
      alert("Failed to remove friend: " + error.message);
    } else {
      await loadData();
    }
    setActionLoading(false);
  };

  const handleCancelRequest = async () => {
    if (!friendship || actionLoading) return;
    if (!confirm(`Are you sure you want to cancel your friend request to @${profile.username}?`)) return;

    setActionLoading(true);
    const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);

    if (error) {
      alert("Failed to cancel request: " + error.message);
    } else {
      await loadData();
    }
    setActionLoading(false);
  };

  const handleAcceptRequest = async () => {
    if (!friendship || actionLoading) return;
    if (!currentUser?.is_approved) {
      alert("Account pending approval.");
      return;
    }

    setActionLoading(true);
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendship.id);

    if (error) {
      alert("Failed to accept request: " + error.message);
    } else {
      await loadData();
    }
    setActionLoading(false);
  };

  const getCountry = (fullAddress: string) => {
    if (!fullAddress || fullAddress === "N/A") return "N/A";
    const parts = fullAddress.split(",").map(p => p.trim());
    return parts.length > 0 ? parts[parts.length - 1] : "N/A";
  };

  const getCity = (fullAddress: string) => {
    if (!fullAddress || fullAddress === "N/A") return "N/A";
    const parts = fullAddress.split(",").map(p => p.trim());
    if (parts.length >= 3) {
      return parts[parts.length - 3];
    }
    return parts.length > 0 ? parts[0] : "N/A";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <p className="text-sm font-semibold text-gray-500">Loading User Profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-3">
          <h2 className="text-base font-bold text-gray-900">User Not Found</h2>
          <p className="text-xs text-gray-500">The requested profile @{targetUsername} does not exist.</p>
          <button onClick={() => router.push("/")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer">
            ← Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isSelf = currentUser?.username?.toLowerCase() === profile.username?.toLowerCase();
  const isAcceptedFriend = friendship?.status === "accepted";
  const isPending = friendship?.status === "pending";
  const isSender = isPending && friendship?.sender_username?.toLowerCase() === currentUsername?.toLowerCase();
  const isReceiver = isPending && !isSender;

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#222222] font-sans antialiased">
      <Navbar currentUsername={currentUsername} />

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 uppercase">User Profile — @{profile.username}</h2>
              <p className="text-xs text-gray-500">Registered member details and credentials.</p>
            </div>
            
            <div className="flex items-center gap-3">
              {!isSelf && (
                isAcceptedFriend ? (
                  <button
                    disabled={actionLoading}
                    onClick={handleRemoveMember}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Remove Friend"}
                  </button>
                ) : isSender ? (
                  <button
                    disabled={actionLoading}
                    onClick={handleCancelRequest}
                    className="px-3 py-2 bg-gray-200 hover:bg-rose-600 hover:text-white text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Cancel Request"}
                  </button>
                ) : isReceiver ? (
                  <div className="flex gap-1.5">
                    <button
                      disabled={actionLoading || !currentUser?.is_approved}
                      onClick={handleAcceptRequest}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={handleRemoveMember}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={actionLoading || !currentUser?.is_approved}
                    onClick={handleAddMember}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Add Friend"}
                  </button>
                )
              )}
              <button onClick={() => router.push("/")} className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">
                ← Back to Bank
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-gray-100 pb-6">
            <div className="w-28 h-36 rounded-lg bg-gray-100 border border-gray-300 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
              {profile.photo_url ? (
                <img src={profile.photo_url} alt="Profile Identity" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">No Image</span>
              )}
            </div>

            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h3 className="text-lg font-black uppercase tracking-wide text-gray-900">
                  {profile.first_name} {profile.last_name}
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
              <p className="text-xs font-mono text-blue-600 font-bold">Payment ID: @{profile.username}</p>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase mt-2 ${
                profile.is_approved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {profile.is_approved ? "Verified Active Member" : "Pending Approval"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-gray-50 p-5 rounded-xl border border-gray-200">
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Legal First Name:</span>
              <span className="font-semibold text-gray-900">{profile.first_name || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Legal Last Name:</span>
              <span className="font-semibold text-gray-900">{profile.last_name || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Username (Payment ID):</span>
              <span className="font-semibold text-gray-900">{profile.username || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Date of Birth:</span>
              <span className="font-semibold text-gray-900">{profile.dob || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Gender:</span>
              <span className="font-semibold text-gray-900">{profile.gender || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Religion:</span>
              <span className="font-semibold text-gray-900">{profile.religion || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Employment Status:</span>
              <span className="font-semibold text-gray-900">{profile.employment_status || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Mobile Phone:</span>
              <span className="font-semibold text-gray-900">{profile.mobile_phone || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Country:</span>
              <span className="font-semibold text-gray-900">{getCountry(profile.address)}</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase text-[10px] block">City:</span>
              <span className="font-semibold text-gray-900">{getCity(profile.address)}</span>
            </div>
            <div className="col-span-1 sm:col-span-2 pt-2 border-t border-gray-200">
              <span className="font-bold text-gray-400 uppercase text-[10px] block">Email Address:</span>
              <span className="font-semibold text-gray-900">{profile.email || "N/A"}</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}