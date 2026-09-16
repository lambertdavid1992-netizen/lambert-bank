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
  is_read?: boolean;
  reactions?: Record<string, string>;
}

interface MemberProfile {
  username: string;
  photo_url?: string;
  unreadCount?: number;
}

const QUICK_EMOJIS = ["😊", "👍", "❤️", "🔥", "🎉", "😂", "🙏", "✨", "🚀", "👑"];
const REACTION_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

export default function MessagesPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [conversations, setConversations] = useState<MemberProfile[]>([]);
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<MemberProfile[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

  // Click & Hold reaction menu state
  const [reactionMenuState, setReactionMenuState] = useState<{
    msgId: string;
    x: number;
    y: number;
  } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modal state for wiping chat history
  const [showWipeModal, setShowWipeModal] = useState<boolean>(false);
  const [wipeTargetUser, setWipeTargetUser] = useState<string>("");
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isKingDavid = currentUsername.toLowerCase() === "kingdavid";

  // Initialize user and conversation threads with unread counts
  const loadConversations = useCallback(async (username: string, approved: boolean) => {
    try {
      const contactSet = new Set<string>();

      if (!approved) {
        contactSet.add("KingDavid");
      } else {
        const { data: friendships } = await supabase
          .from("friendships")
          .select("sender_username, receiver_username")
          .eq("status", "accepted")
          .or(`sender_username.eq.${username},receiver_username.eq.${username}`);

        friendships?.forEach((f) => {
          const friendName = f.sender_username.toLowerCase() === username.toLowerCase() ? f.receiver_username : f.sender_username;
          contactSet.add(friendName);
        });

        const { data: msgHistory } = await supabase
          .from("messages")
          .select("sender_username, recipient_username")
          .or(`sender_username.eq.${username},recipient_username.eq.${username}`);

        msgHistory?.forEach((m) => {
          const partner = m.sender_username.toLowerCase() === username.toLowerCase() ? m.recipient_username : m.sender_username;
          contactSet.add(partner);
        });
      }

      const usernames = Array.from(contactSet);
      if (usernames.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("username, photo_url")
          .in("username", usernames);

        // Fetch unread counts per sender
        const { data: unreadData } = await supabase
          .from("messages")
          .select("sender_username")
          .eq("recipient_username", username)
          .eq("is_read", false);

        const unreadMap: Record<string, number> = {};
        unreadData?.forEach((m) => {
          unreadMap[m.sender_username] = (unreadMap[m.sender_username] || 0) + 1;
        });

        if (profilesData) {
          const profilesWithUnread = profilesData.map((p) => ({
            ...p,
            unreadCount: unreadMap[p.username] || 0,
          }));

          setConversations((prev) => {
            const existingMap = new Map(prev.map((c) => [c.username.toLowerCase(), c]));
            profilesWithUnread.forEach((p) => {
              existingMap.set(p.username.toLowerCase(), {
                ...p,
                unreadCount: p.unreadCount ?? (existingMap.get(p.username.toLowerCase())?.unreadCount || 0),
              });
            });
            return Array.from(existingMap.values());
          });

          if (!selectedFriend && window.innerWidth >= 768 && profilesWithUnread.length > 0) {
            setSelectedFriend(profilesWithUnread[0].username);
          }
        }
      } else {
        setConversations((prev) => (prev.length > 0 ? prev : [{ username: "KingDavid", unreadCount: 0 }]));
        if (!selectedFriend && window.innerWidth >= 768) {
          setSelectedFriend("KingDavid");
        }
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, [supabase, selectedFriend]);

  useEffect(() => {
    async function init() {
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

        await loadConversations(username, approved);
      } catch (err) {
        console.error("Initialization failed:", err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router, supabase, loadConversations]);

  // Global member search for approved users
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

  // Fetch messages and mark them as read in DB
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

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("sender_username", targetUser)
        .eq("recipient_username", currentUsername)
        .eq("is_read", false);

      setConversations((prev) =>
        prev.map((c) => (c.username.toLowerCase() === targetUser.toLowerCase() ? { ...c, unreadCount: 0 } : c))
      );
    }
  }, [currentUsername, supabase]);

  useEffect(() => {
    if (selectedFriend) {
      fetchMessages(selectedFriend);
    }
  }, [selectedFriend, fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!currentUsername) return;

    const channel = supabase
      .channel(`chat-global-${currentUsername}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const msg = payload.new as Message;
          if (
            (msg.sender_username === currentUsername && msg.recipient_username === selectedFriend) ||
            (msg.sender_username === selectedFriend && msg.recipient_username === currentUsername)
          ) {
            if (payload.eventType === "INSERT") {
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
              });
              if (msg.sender_username === selectedFriend) {
                await supabase
                  .from("messages")
                  .update({ is_read: true })
                  .eq("id", msg.id);
              }
            } else if (payload.eventType === "UPDATE") {
              setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
            }
          }
          loadConversations(currentUsername, isApproved);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUsername, selectedFriend, isApproved, loadConversations, supabase]);

  // Scroll messages container smoothly when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFriend || !currentUsername) return;

    if (!isApproved && selectedFriend.toLowerCase() !== "kingdavid") {
      alert("Your account is pending review by KingDavid. You can only message KingDavid.");
      return;
    }

    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText("");
    setShowEmojiPicker(false);

    // Reset textarea height to initial state
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const { error } = await supabase.from("messages").insert({
      sender_username: currentUsername,
      recipient_username: selectedFriend,
      content: content,
      is_read: false,
      reactions: {},
    });

    if (error) {
      console.error("Failed to send message:", error.message);
      alert("Failed to send message.");
    }
  };

  const handleReaction = async (messageId: string, emoji: string, existingReactions?: Record<string, string>) => {
    if (!currentUsername) return;
    const reactions = { ...(existingReactions || {}) };

    if (reactions[currentUsername] === emoji) {
      delete reactions[currentUsername];
    } else {
      reactions[currentUsername] = emoji;
    }

    const { error } = await supabase
      .from("messages")
      .update({ reactions })
      .eq("id", messageId);

    if (error) {
      console.error("Failed to update reaction:", error);
    }
    setReactionMenuState(null);
  };

  // Click & Hold handlers for mobile/desktop reaction menu placement
  const handleBubbleClick = (msgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReactionMenuState({
      msgId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleTouchStart = (msgId: string, e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      setReactionMenuState({
        msgId,
        x: touch.clientX,
        y: touch.clientY,
      });
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Helper when clicking any member from search or conversation list
  const handleSelectMember = (member: MemberProfile) => {
    setSelectedFriend(member.username);
    setSearchQuery(""); // Clear search field

    setConversations((prev) => {
      if (prev.some((c) => c.username.toLowerCase() === member.username.toLowerCase())) {
        return prev;
      }
      return [member, ...prev];
    });
  };

  // Open confirmation modal for wiping chat history
  const handleWipeChatHistoryClick = (targetUser: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWipeTargetUser(targetUser);
    setShowWipeModal(true);
  };

  // Execute wipe history after confirmation modal "Yes"
  const handleConfirmWipe = async () => {
    if (!wipeTargetUser) return;
    setShowWipeModal(false);

    const { error } = await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_username.eq.${currentUsername},recipient_username.eq.${wipeTargetUser}),and(sender_username.eq.${wipeTargetUser},recipient_username.eq.${currentUsername})`
      );

    if (error) {
      console.error("Failed to wipe chat history:", error);
      alert("Failed to wipe chat history.");
      return;
    }

    if (selectedFriend?.toLowerCase() === wipeTargetUser.toLowerCase()) {
      setMessages([]);
      setSelectedFriend(null);
    }

    setConversations((prev) => prev.filter((c) => c.username.toLowerCase() !== wipeTargetUser.toLowerCase()));
    setWipeTargetUser("");
  };

  if (loading) {
    return <div className="py-20 text-center text-xs font-semibold text-gray-500">Loading Messages...</div>;
  }

  const displayList = searchQuery.trim() && isApproved ? searchResults : conversations;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-4 h-[78vh]">
      
      {/* Conversations Sidebar */}
      <div className={`border-r border-gray-200 bg-gray-50/50 flex flex-col h-full overflow-hidden ${selectedFriend ? "hidden md:flex" : "flex"} md:col-span-1`}>
        <div className="p-3 border-b border-gray-200 space-y-2.5 bg-white shrink-0">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide px-1">Messages</h2>
          
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
              className="w-full pl-8 pr-7 py-1.5 text-base md:text-xs bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:border-[#e7b833] focus:bg-white transition text-gray-900 font-medium placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div
                key={member.username}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectMember(member)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectMember(member);
                  }
                }}
                className={`w-full p-3.5 flex items-center justify-between text-left transition cursor-pointer group/item ${
                  selectedFriend === member.username ? "bg-amber-50/80 border-l-4 border-[#e7b833]" : "hover:bg-gray-100/60"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
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
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {/* Administrator Wipe Chat Button */}
                  {isKingDavid && (
                    <button
                      type="button"
                      onClick={(e) => handleWipeChatHistoryClick(member.username, e)}
                      title={`Wipe chat history with @${member.username}`}
                      className="w-5 h-5 rounded bg-red-100 hover:bg-red-600 text-red-600 hover:text-white flex items-center justify-center text-[10px] font-bold transition cursor-pointer"
                    >
                      ✕
                    </button>
                  )}

                  {/* Unread Badge */}
                  {Boolean(member.unreadCount && member.unreadCount > 0) && (
                    <span className="w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                      {member.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Chat Window */}
      <div className={`flex flex-col overflow-hidden bg-white ${!selectedFriend ? "hidden md:flex md:col-span-3 md:h-full" : "fixed inset-x-0 bottom-0 top-16 z-50 md:static md:inset-auto md:z-auto md:col-span-3 md:h-full"}`}>
        {selectedFriend ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-2xs shrink-0 relative">
              <button
                type="button"
                onClick={() => setSelectedFriend(null)}
                className="text-gray-600 hover:text-gray-900 px-2.5 py-1 rounded-lg hover:bg-gray-100 transition cursor-pointer flex items-center gap-1.5 z-10 font-bold text-xs uppercase"
                title="Back to conversations"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                <span>Back</span>
              </button>

              <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none">
                <span className="font-bold text-xs text-gray-900">@{selectedFriend}</span>
              </div>

              <div className="w-12" />
            </div>

            {!isApproved && (
              <div className="bg-amber-50 border-b border-amber-200 p-2.5 text-center text-xs text-amber-800 font-medium shrink-0">
                🔒 Account pending approval. You are permitted to message KingDavid.
              </div>
            )}

            {/* Messages Scroll Area */}
            <div 
              ref={messagesContainerRef} 
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-gray-50/30 relative"
            >
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  No messages yet with @{selectedFriend}. Send a message below!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_username.toLowerCase() === currentUsername.toLowerCase();
                  const reactionsObj = msg.reactions || {};
                  
                  // Order reactions: other users' reactions on the left, current user's reaction on the far right (first right place)
                  const myReaction = currentUsername ? reactionsObj[currentUsername] : null;
                  const otherReactionEntries = Object.entries(reactionsObj).filter(
                    ([user]) => user.toLowerCase() !== currentUsername.toLowerCase()
                  );
                  const orderedEmojis = [
                    ...otherReactionEntries.map(([_, emoji]) => emoji),
                    ...(myReaction ? [myReaction] : [])
                  ];

                  return (
                    <div key={msg.id} className={`flex flex-col relative ${isMe ? "items-end" : "items-start"}`}>
                      
                      {/* Message Bubble Wrapper with Click & Touch Events */}
                      <div
                        onClick={(e) => handleBubbleClick(msg.id, e)}
                        onTouchStart={(e) => handleTouchStart(msg.id, e)}
                        onTouchEnd={handleTouchEnd}
                        className="relative w-fit max-w-[75%] mb-4 cursor-pointer"
                      >
                        <div
                          className={`rounded-2xl px-4 pt-2.5 pb-3.5 text-xs shadow-2xs break-words whitespace-pre-wrap ${
                            isMe ? "bg-black text-white font-medium rounded-br-xs" : "bg-white border border-gray-200 text-gray-800 rounded-bl-xs"
                          }`}
                        >
                          {msg.content}
                        </div>

                        {/* Interactive Reaction Pills Display */}
                        {orderedEmojis.length > 0 && (
                          <div className={`absolute -bottom-2.5 flex items-center gap-0.5 bg-white border border-gray-200 rounded-full px-2 py-0.5 shadow-sm text-[10px] z-10 pointer-events-none ${isMe ? "right-3" : "left-3"}`}>
                            {orderedEmojis.map((emoji, idx) => (
                              <span key={idx} className="px-0.5">{emoji}</span>
                            ))}
                            {Object.keys(reactionsObj).length > 2 && (
                              <span className="text-[9px] font-bold text-gray-500 ml-0.5">{Object.keys(reactionsObj).length}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Timestamp & Read Status Receipt */}
                      <div className={`flex items-center gap-2 px-1 text-[9px] text-gray-400 font-mono ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                        <span>{new Date(msg.created_at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()}</span>
                        {isMe && (
                          <span className={`font-bold ${msg.is_read ? "text-black" : "text-gray-400"}`}>
                            {msg.is_read ? "Read" : "Sent"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Transparent Full-Screen Backdrop to automatically close reaction menu on outside click */}
              {reactionMenuState && (
                <div 
                  className="fixed inset-0 z-[190]"
                  onClick={() => setReactionMenuState(null)}
                />
              )}

              {/* Pinned Click/Touch Reaction Menu positioned exactly where clicked/held */}
              {reactionMenuState && (
                <div
                  style={{
                    position: "fixed",
                    top: `${Math.max(20, reactionMenuState.y - 50)}px`,
                    left: `${Math.max(20, Math.min(window.innerWidth - 240, reactionMenuState.x - 100))}px`,
                  }}
                  className="flex items-center gap-1 bg-white border border-gray-200 shadow-xl rounded-full px-3 py-1.5 z-[200] animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        const targetMsg = messages.find(m => m.id === reactionMenuState.msgId);
                        handleReaction(reactionMenuState.msgId, emoji, targetMsg?.reactions);
                      }}
                      className="hover:scale-125 transition-transform text-base px-1.5 cursor-pointer"
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Stable Form & Emoji Popup Picker */}
            <div className="p-3 border-t border-gray-200 bg-white relative shrink-0">
              {showEmojiPicker && (
                <div className="absolute bottom-full left-3 mb-2 bg-white border border-gray-200 shadow-xl rounded-xl p-2.5 grid grid-cols-5 gap-2 z-50">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setInputText((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                        if (textareaRef.current) {
                          textareaRef.current.style.height = "auto";
                          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 72)}px`;
                        }
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition cursor-pointer text-base"
                      title={`Insert ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2 shrink-0">
                <div className="relative flex-1 flex items-center bg-gray-100 border border-gray-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    title="Insert emoji"
                    className="absolute left-2.5 bottom-2 text-gray-400 hover:text-gray-600 transition cursor-pointer text-sm flex items-center justify-center w-6 h-6 rounded-full hover:bg-gray-200/60 z-10"
                  >
                    😊
                  </button>
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder={`Message @${selectedFriend}...`}
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      const el = e.target;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 72)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="w-full pl-10 pr-3.5 py-2 text-base md:text-xs bg-transparent focus:outline-none text-gray-900 font-medium placeholder:text-gray-400 min-w-0 resize-none max-h-[72px] overflow-y-auto leading-relaxed"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] disabled:opacity-40 text-gray-900 shadow-xs transition cursor-pointer uppercase tracking-wider shrink-0"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
            Select a conversation to begin messaging.
          </div>
        )}
      </div>

      {/* WIPE CHAT HISTORY CONFIRMATION MODAL */}
      {showWipeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden transition-all text-left">
            <div className="bg-[#800000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">Wipe Chat History</h3>
              <button
                onClick={() => setShowWipeModal(false)}
                className="text-red-100 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#660000]" />

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                Are you sure you want to wipe all chat history with <span className="font-bold">@{wipeTargetUser}</span>? This cannot be undone.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWipeModal(false)}
                  className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer text-gray-700"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWipe}
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                >
                  Yes, Wipe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}