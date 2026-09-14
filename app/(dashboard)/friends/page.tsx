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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

    const interval = setInterval(() => {
      loadData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [loadData, refreshTrigger]);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

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
      alert(`Friend request sent to @${targetUsername}!`);
      setSearchQuery("");
      setSearchResults([]);
      loadData(false);
      triggerRefresh();
    }
  };

  const handleAcceptRequest = async (relationId: string) => {
    if (!isApproved) {
      alert("Account pending approval.");
      return;
    }

    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", relationId);

    if (error) {
      alert("Failed to accept request: " + error.message);
    } else {
      alert("Friend request accepted!");
      loadData(false);
      triggerRefresh();
    }
  };

  const handleDeleteFriend = async (relationId: string, friendName: string) => {
    if (!confirm(`Are you sure you want to remove @${friendName} from your friends list?`)) return;

    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", relationId);

    if (error) {
      alert("Failed to remove friend: " + error.message);
    } else {
      loadData(false);
      triggerRefresh();
    }
  };

  const handleCancelRequest = async (relationId: string, targetName: string) => {
    if (!confirm(`Are you sure you want to cancel your friend request to @${targetName}?`)) return;

    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", relationId);

    if (error) {
      alert("Failed to cancel request: " + error.message);
    } else {
      loadData(false);
      triggerRefresh();
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
                value={searchQuery ?? ""}
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
                        className="px-2.5 py-1 bg-blue-600 text-white rounded text-[10px] font-bold uppercase cursor-pointer hover:bg-blue-700 transition"
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
            <span>Pending Your Approval</span>
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
            <span>Your Requests</span>
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

                return (
                  <div key={item.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-300">
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
                            className="text-xs font-black text-blue-600 hover:underline uppercase cursor-pointer"
                          >
                            {friendProf?.first_name} {friendProf?.last_name}
                          </h3>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-full">
                            Friend
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-600 font-bold">@{friendUsername}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Age: {calculateAge(friendProf?.dob)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFriend(item.id, friendUsername)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : activeTab === "REQUESTS" ? (
          friendRequests.length === 0 ? (
            <div className="bg-gray-50 p-10 rounded-xl text-center space-y-2 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase">No incoming friend requests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friendRequests.map((req) => {
                const reqProf = req.profile;
                return (
                  <div key={req.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-300">
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
                            className="text-xs font-black text-blue-600 hover:underline uppercase cursor-pointer"
                          >
                            {reqProf?.first_name} {reqProf?.last_name}
                          </h3>
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase rounded-full">
                            Pending
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-600 font-bold">@{req.sender_username}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Age: {calculateAge(reqProf?.dob)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isApproved ? (
                        <button
                          onClick={() => handleAcceptRequest(req.id)}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
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
                        onClick={() => handleDeleteFriend(req.id, req.sender_username)}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          sentRequests.length === 0 ? (
            <div className="bg-gray-50 p-10 rounded-xl text-center space-y-2 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase">No outgoing pending requests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentRequests.map((req) => {
                const reqProf = req.profile;
                return (
                  <div key={req.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-300">
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
                            className="text-xs font-black text-blue-600 hover:underline uppercase cursor-pointer"
                          >
                            {reqProf?.first_name} {reqProf?.last_name}
                          </h3>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded-full">
                            Requested
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-600 font-bold">@{req.receiver_username}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Age: {calculateAge(reqProf?.dob)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelRequest(req.id, req.receiver_username)}
                      className="px-3 py-2 bg-gray-200 hover:bg-rose-600 hover:text-white text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
                    >
                      Cancel Request
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}