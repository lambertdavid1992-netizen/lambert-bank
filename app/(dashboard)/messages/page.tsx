"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Message {
  id: string;
  sender_username: string;
  recipient_username: string;
  content: string;
  created_at: string;
}

interface MemberProfile {
  username: string;
  photo_url?: string;
}

export default function MessagesPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [friends, setFriends] = useState<MemberProfile[]>([]);
  
  // Search state for finding any member (Approved users only)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<MemberProfile[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch current user, approval status, and conversation list on mount
  useEffect(() => {
    async function initUserAndFriends() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        let username = "";
        let approved = false;

        if (session.user.email?.toLowerCase() === "lambertdavid1992@gmail.com") {
          username = "KingDavid";
          approved = true;
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, is_approved")
            .eq("user_id", session.user.id)
            .single();
          if (profile) {
            username = profile.username;
            approved = Boolean(profile.is_approved);
          }
        }

        if (!username) {
          router.push("/login");
          return;
        }
        setCurrentUsername(username);
        setIsApproved(approved);

        if (!approved) {
          // Pending users are restricted exclusively to communicating with KingDavid
          const { data: kdProfile } = await supabase
            .from("profiles")
            .select("username, photo_url")
            .ilike("username", "KingDavid")
            .single();

          const kingDavidUser = kdProfile || { username: "KingDavid" };
          setFriends([kingDavidUser]);
          setSelectedFriend("KingDavid");
        } else {
          // Fetch accepted friendships for approved users
          const { data: friendships } = await supabase
            .from("friendships")
            .select("sender_username, receiver_username")
            .eq("status", "accepted")
            .or(`sender_username.eq.${username},receiver_username.eq.${username}`);

          if (friendships) {
            const friendNames = friendships.map((f) =>
              f.sender_username.toLowerCase() === username.toLowerCase()
                ? f.receiver_username
                : f.sender_username
            );

            if (friendNames.length > 0) {
              const { data: profilesData } = await supabase
                .from("profiles")
                .select("username, photo_url")
                .in("username", friendNames);

              if (profilesData) {
                setFriends(profilesData);
                setSelectedFriend(profilesData[0].username);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to initialize messages:", err);
      } finally {
        setLoading(false);
      }
    }

    initUserAndFriends();
  }, [router, supabase]);

  // Global Member Search Effect (Locked for pending members)
  useEffect(() => {
    if (!isApproved) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, photo_url")
        .neq("username", currentUsername)
        .ilike("username", `%${query}%`)
        .limit(15);

      if (!error && data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUsername, supabase, isApproved]);

  // Fetch chat history with selected member
  const fetchMessages = useCallback(async (targetUser: string) => {
    if (!currentUsername || !targetUser) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_username.eq.${currentUsername},recipient_username.eq.${targetUser}),and(sender_username.eq.${targetUser},recipient_username.eq.${currentUsername})`
      )
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  }, [currentUsername, supabase]);

  useEffect(() => {
    if (selectedFriend) {
      fetchMessages(selectedFriend);
    }
  }, [selectedFriend, fetchMessages]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!currentUsername || !selectedFriend) return;

    const channel = supabase
      .channel(`chat-${currentUsername}-${selectedFriend}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_username === currentUsername && newMsg.recipient_username === selectedFriend) ||
            (newMsg.sender_username === selectedFriend && newMsg.recipient_username === currentUsername)
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUsername, selectedFriend, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend || !currentUsername) return;

    // Enforce pending restriction: Only KingDavid is permitted for unapproved accounts
    if (!isApproved && selectedFriend.toLowerCase() !== "kingdavid") {
      alert("Your account is pending review by KingDavid. You can only message KingDavid.");
      return;
    }

    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText("");

    const { error } = await supabase.from("messages").insert({
      sender_username: currentUsername,
      recipient_username: selectedFriend,
      content: content,
    });

    if (error) {
      console.error("Failed to send message:", error.message);
      alert("Failed to send message.");
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-xs font-semibold text-gray-500">Loading Messages...</div>;
  }

  const displayList = searchQuery.trim() && isApproved ? searchResults : friends;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-4 h-[75vh]">
      {/* Conversations Sidebar */}
      <div className="border-r border-gray-200 bg-gray-50/50 flex flex-col">
        <div className="p-3 border-b border-gray-200 space-y-2.5 bg-white">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide px-1">Messages</h2>
          
          {/* Member Search Bar (Locked for pending members) */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <input
              type="text"
              placeholder={isApproved ? "Search any member..." : "Search locked pending approval..."}
              value={searchQuery}
              disabled={!isApproved}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:border-[#e7b833] focus:bg-white transition text-gray-900 font-medium placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {searchQuery && isApproved && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {!isApproved && (
            <div className="p-3 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800 font-medium text-center">
              Pending Activation: You can message KingDavid below.
            </div>
          )}

          {isSearching ? (
            <div className="p-6 text-center text-xs text-gray-400">Searching members...</div>
          ) : displayList.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">No conversations found.</div>
          ) : (
            displayList.map((member) => (
              <button
                key={member.username}
                onClick={() => setSelectedFriend(member.username)}
                className={`w-full p-3.5 flex items-center gap-3 text-left transition cursor-pointer ${
                  selectedFriend === member.username ? "bg-amber-50/80 border-l-4 border-[#e7b833]" : "hover:bg-gray-100/60"
                }`}
              >
                <div className="relative w-9 h-9 rounded-full bg-gray-200 overflow-hidden shrink-0">
                  {member.photo_url ? (
                    <img src={member.photo_url} alt={member.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-gray-600 text-xs">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 truncate">@{member.username} {member.username.toLowerCase() === "kingdavid" ? "👑" : ""}</p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {member.username.toLowerCase() === "kingdavid" ? "Administrator" : "Direct Message"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Active Chat Window */}
      <div className="md:col-span-3 flex flex-col bg-white">
        {selectedFriend ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-xs text-gray-900">Chatting with @{selectedFriend}</span>
              </div>
            </div>

            {!isApproved && (
              <div className="bg-amber-50 border-b border-amber-200 p-2.5 text-center text-xs text-amber-800 font-medium">
                🔒 Account pending approval. You are permitted to message KingDavid.
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  No messages yet with @{selectedFriend}. Send a message below!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_username.toLowerCase() === currentUsername.toLowerCase();
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
                          isMe ? "bg-[#e7b833] text-gray-900 font-medium rounded-br-xs" : "bg-white border border-gray-200 text-gray-800 rounded-bl-xs"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-gray-400 font-mono mt-1 px-1">
                        {new Date(msg.created_at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 bg-white flex gap-2">
              <input
                type="text"
                placeholder={`Message @${selectedFriend}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-xs bg-gray-100 border border-gray-200 rounded-xl focus:outline-none focus:border-[#e7b833] focus:bg-white transition text-gray-900 font-medium placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] disabled:opacity-40 text-gray-900 shadow-xs transition cursor-pointer uppercase tracking-wider"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
            Select KingDavid to begin messaging.
          </div>
        )}
      </div>
    </div>
  );
}