"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

interface Message {
  id: string;
  sender_username: string;
  content: string;
  created_at: string;
}

interface Room {
  id: string;
  name: string;
  type: string;
  fee_cents: number;
}

export default function ChatHubPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [username, setUsername] = useState<string>("KingDavid");
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [isApproved, setIsApproved] = useState<boolean>(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (roomId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  }, [supabase]);

  const handleClearRoomChat = async () => {
    if (username !== "KingDavid") {
      return alert("Unauthorized: Only KingDavid (Administrator) can clear room histories.");
    }

    if (!currentRoom) return;

    if (confirm(`Are you sure you want to delete ALL messages in "${currentRoom.name}"? This action cannot be undone.`)) {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("room_id", currentRoom.id);

      if (error) {
        alert("Failed to clear chat history: " + error.message);
      } else {
        setMessages([]);
      }
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (username !== "KingDavid") {
      return alert("Unauthorized: Only KingDavid (Administrator) can delete individual messages.");
    }

    if (confirm("Delete this message?")) {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId);

      if (error) {
        alert("Failed to delete message: " + error.message);
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    }
  };

  useEffect(() => {
    async function initChat() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const email = session.user.email || "";

      if (email.toLowerCase() === "lambertdavid1992@gmail.com") {
        setUsername("KingDavid");
        setCurrentUsername("KingDavid");
        setIsApproved(true);
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, is_approved")
          .eq("user_id", session.user.id)
          .single();

        if (profile) {
          setUsername(profile.username);
          setCurrentUsername(profile.username);
          setIsApproved(Boolean(profile.is_approved));
        } else {
          router.push("/login");
          return;
        }
      }

      const { data: roomData } = await supabase.from("rooms").select("*").order("fee_cents", { ascending: true });
      if (roomData && roomData.length > 0) {
        setRooms(roomData);
        setCurrentRoom(roomData[0]);
        await fetchMessages(roomData[0].id);
      }
      setLoading(false);
    }

    initChat();
  }, [router, supabase, fetchMessages]);

  useEffect(() => {
    if (!currentRoom) return;

    fetchMessages(currentRoom.id);

    const channel = supabase
      .channel(`room-live-${currentRoom.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoom.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom, supabase, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApproved) {
      alert("Account pending approval. Messaging is disabled.");
      return;
    }
    if (!inputMessage.trim() || !currentRoom) return;

    const content = inputMessage.trim();
    setInputMessage("");

    const timeSlice = Date.now().toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    const txnId = `TXN-CHAT-${timeSlice}-${rand}`;
    
    const now = new Date();
    const datePart = now.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
    const timePart = now.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
    const timestampStr = `${datePart}, ${timePart}`;

    try {
      const { error } = await supabase.rpc("send_chat_message", {
        p_username: username,
        p_room_id: currentRoom.id,
        p_content: content,
        p_timestamp_str: timestampStr,
        p_txn_id: txnId,
      });

      if (error) {
        alert(error.message);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <p className="text-sm font-semibold text-gray-500">Loading Lambert Social...</p>
      </div>
    );
  }

  const currentFeeFormatted = currentRoom ? `$${(currentRoom.fee_cents / 100).toFixed(2)}` : "$0.00";

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#222222] font-sans antialiased">
      <Navbar currentUsername={currentUsername} />

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        
        {!isApproved && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between shadow-xs print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-base">
                ⏳
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">Account Pending Approval</h3>
                <p className="text-[11px] text-amber-700">You can view chat room history, but messaging is locked until KingDavid approves your account.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3 h-fit">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Social Rooms</h2>
            <div className="space-y-1">
              {rooms.map((room) => {
                const feeLabel = `$${(room.fee_cents / 100).toFixed(2)}`;
                return (
                  <button
                    key={room.id}
                    onClick={() => setCurrentRoom(room)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                      currentRoom?.id === room.id
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <span>{room.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${currentRoom?.id === room.id ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-600"}`}>
                      {feeLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 md:col-span-3 flex flex-col overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-gray-900">{currentRoom?.name}</h3>
                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ● Live Feed ({currentFeeFormatted}/msg fee)
                </span>
              </div>

              {username === "KingDavid" && currentRoom && (
                <button
                  type="button"
                  onClick={handleClearRoomChat}
                  className="text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2.5 py-1 rounded border border-rose-200 transition cursor-pointer"
                  title="Purge all messages in this room"
                >
                  🗑️ Clear Room Chat
                </button>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[60vh]">
              {messages.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-10">No messages yet. Say hello to start the conversation!</p>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_username === username;
                  return (
                    <div key={msg.id} className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}>
                      <div className="flex items-center space-x-2 px-1 mb-0.5">
                        <span className="text-[10px] font-bold text-gray-500">{msg.sender_username}</span>
                        {username === "KingDavid" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            title="Delete message"
                          >
                            [Delete]
                          </button>
                        )}
                      </div>
                      <div className={`p-3 rounded-2xl text-xs max-w-md ${isMe ? "bg-blue-600 text-white rounded-br-xs" : "bg-gray-100 text-gray-900 rounded-bl-xs"}`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2">
              {isApproved ? (
                <>
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={`Type an encrypted message (${currentFeeFormatted} fee)...`}
                    className="flex-1 border border-gray-300 bg-white rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-lg shadow transition cursor-pointer"
                  >
                    Send ({currentFeeFormatted})
                  </button>
                </>
              ) : (
                <input
                  type="text"
                  disabled
                  placeholder="Messaging locked: Account pending administrator approval..."
                  className="flex-1 border border-gray-200 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-400 cursor-not-allowed"
                />
              )}
            </form>
          </div>
        </div>

      </main>
    </div>
  );
}