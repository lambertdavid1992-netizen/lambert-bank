"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface StreamChatMessage {
  id: string;
  username: string;
  message: string;
  created_at: string;
}

interface Viewer {
  username: string;
  photo_url?: string;
}

export default function StreamingPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [currentUsername, setCurrentUsername] = useState<string>("Guest");
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | undefined>(undefined);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [balanceCents, setBalanceCents] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [viewersList, setViewersList] = useState<Viewer[]>([]);
  const [showViewersModal, setShowViewersModal] = useState<boolean>(false);
  const [showDonateModal, setShowDonateModal] = useState<boolean>(false);
  const [tipAmount, setTipAmount] = useState<string>("5");

  const [chatInput, setChatInput] = useState<string>("");
  const [messages, setMessages] = useState<StreamChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load user details, photo, approval status, and balance
  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (session.user.email?.toLowerCase() === "lambertdavid1992@gmail.com") {
          setCurrentUsername("KingDavid");
          setIsApproved(true);
          setBalanceCents(100000); // Admin default
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, is_approved, photo_url, balance_cents")
            .eq("user_id", session.user.id)
            .single();
          if (profile) {
            setCurrentUsername(profile.username);
            setIsApproved(Boolean(profile.is_approved));
            setCurrentUserPhoto(profile.photo_url || undefined);
            setBalanceCents(profile.balance_cents || 0);
          }
        }
      }
    }
    loadUser();
  }, [supabase]);

  // Toggle Live Streaming & Camera Stream (Approved members only)
  const toggleLive = async () => {
    if (!isApproved) {
      alert("Live streaming is only available to approved members.");
      return;
    }

    if (!isStreaming) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsStreaming(true);
      } catch (err) {
        console.error("Camera/Microphone access denied or unavailable:", err);
        alert("Could not access camera or microphone. Please check your browser permissions.");
      }
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsStreaming(false);
    }
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Fetch initial stream chat history
  const fetchStreamMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("stream_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);

    if (!error && data) {
      setMessages(data);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStreamMessages();
  }, [fetchStreamMessages]);

  // Realtime subscription for incoming stream comments
  useEffect(() => {
    const channel = supabase
      .channel("live-stream-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_messages",
        },
        (payload) => {
          const newMsg = payload.new as StreamChatMessage;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Realtime Presence for Live Viewers tracking & list building
  useEffect(() => {
    if (!currentUsername || currentUsername === "Guest") return;

    const channel = supabase.channel("stream-room-presence", {
      config: {
        presence: {
          key: currentUsername,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const activeViewers: Viewer[] = [];
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.username) {
              activeViewers.push({ username: p.username, photo_url: p.photo_url });
            }
          });
        });

        setViewersList(activeViewers);
        setViewerCount(Math.max(1, activeViewers.length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            username: currentUsername,
            photo_url: currentUserPhoto,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUsername, currentUserPhoto, supabase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUsername) return;

    const text = chatInput.trim();
    setChatInput("");

    const { error } = await supabase.from("stream_messages").insert({
      username: currentUsername,
      message: text,
    });

    if (error) {
      console.error("Failed to send comment:", error.message);
      alert("Failed to send chat message.");
    }
  };

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(tipAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid donation amount.");
      return;
    }

    const donateCents = Math.round(amount * 100);
    if (donateCents > balanceCents) {
      alert("Donation amount exceeds your available account balance.");
      return;
    }

    // Insert system donation notice into stream chat
    await supabase.from("stream_messages").insert({
      username: "System",
      message: `🎁 @${currentUsername} donated $${amount.toFixed(2)} to KingDavid!`,
    });

    setShowDonateModal(false);
    alert(`Successfully donated $${amount.toFixed(2)} to KingDavid!`);
  };

  return (
    <div className={isStreaming 
      ? "fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden" 
      : "h-[calc(100vh-7rem)] flex flex-col items-center justify-center overflow-hidden px-2"
    }>
      {/* Pending Activation Notice Banner (Hidden when fullscreen streaming) */}
      {!isApproved && !isStreaming && (
        <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-[10px] text-amber-800 font-medium text-center shrink-0">
          👑📺 Pending activation: Viewing KingDavid&apos;s live broadcast. Live streaming is restricted to approved members.
        </div>
      )}

      {/* Stream Frame (Expands to Full Viewport Width/Height when Streaming) */}
      <div className={isStreaming
        ? "relative bg-black w-full h-full overflow-hidden flex flex-col justify-end group"
        : "relative bg-black rounded-3xl border-4 border-zinc-800 overflow-hidden shadow-2xl h-full max-h-[72vh] aspect-[9/16] flex flex-col justify-end group shrink-0"
      }>
        
        {/* Live Camera / Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Top-Left Controls: Go Live Button (Approved only) & Viewer Count */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
          {isApproved ? (
            <button
              type="button"
              onClick={toggleLive}
              title={isStreaming ? "Click to stop streaming" : "Click to go live"}
              className={`flex items-center gap-1.5 backdrop-blur-md px-2.5 py-1 rounded-full border transition cursor-pointer shadow-md ${
                isStreaming
                  ? "bg-black/90 border-rose-600 text-white font-bold"
                  : "bg-black/60 border-zinc-700 text-zinc-300 hover:text-white"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isStreaming ? "bg-rose-600" : "bg-zinc-500"}`} />
              <span className="text-[8px] font-black uppercase tracking-widest">
                {isStreaming ? "LIVE" : "GO LIVE"}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-800 text-zinc-400 opacity-60 cursor-not-allowed" title="Live streaming locked for pending members">
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
              <span className="text-[8px] font-black uppercase tracking-widest">LOCKED</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowViewersModal(true)}
            title="Click to view current live viewers"
            className="flex items-center gap-1 bg-black/60 hover:bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-800 text-[9px] font-mono text-zinc-300 transition cursor-pointer shadow-md"
          >
            👁️ {viewerCount} ▾
          </button>
        </div>

        {/* Top-Right: @KingDavid Overlay & Micro Donate Button (Only shown if balance > 0) */}
        <div className="absolute top-2.5 right-2.5 z-20 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-zinc-800">
            <span className="text-[10px] font-bold text-white font-mono">@KingDavid 👑</span>
          </div>
          {balanceCents > 0 && (
            <button
              type="button"
              onClick={() => setShowDonateModal(true)}
              title="Donate to stream host"
              className="w-6 h-6 rounded-full bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 font-bold text-[10px] flex items-center justify-center shadow-md transition cursor-pointer border border-amber-400"
            >
              $
            </button>
          )}
        </div>

        {/* Bottom Overlay: Shrunken Chat Feed & Input */}
        <div className="relative z-20 bg-gradient-to-t from-black/95 via-zinc-950/80 to-transparent pt-6 pb-2 px-2.5 w-full flex flex-col justify-end max-h-[35%]">
          
          {/* Scrollable Chat Messages (Shrunk down) */}
          <div className="overflow-y-auto space-y-1 mb-1.5 max-h-24 pr-1 text-[10px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
            {messages.length === 0 ? (
              <div className="text-center text-[9px] text-zinc-400 py-1">No comments yet. Say something!</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="leading-tight bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-md border border-zinc-700/60 shadow-xs">
                  <span className="font-bold text-[#e7b833] mr-1">@{m.username}:</span>
                  <span className="text-white text-[9px]">{m.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Shrunken Full-Width Chat Input with Arrow Button */}
          <form onSubmit={handleSendChat} className="w-full">
            <div className="relative w-full flex items-center">
              <input
                type="text"
                placeholder="Send a comment..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="w-full pl-2.5 pr-9 py-1.5 text-[10px] bg-zinc-900/90 border border-zinc-700 rounded-lg focus:outline-none focus:border-[#e7b833] text-white font-medium placeholder:text-zinc-500 backdrop-blur-sm shadow-inner"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                title="Send comment"
                className="absolute right-1 w-6 h-6 rounded-md flex items-center justify-center bg-[#e7b833] hover:bg-[#d4a52b] disabled:opacity-40 text-gray-900 shadow-xs transition cursor-pointer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CURRENT VIEWERS MODAL */}
      {showViewersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden transition-all text-left">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center font-bold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Current Live Viewers ({viewersList.length})</h3>
              </div>
              <button
                onClick={() => setShowViewersModal(false)}
                className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833]" />

            <div className="p-4 max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
              {viewersList.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">No active viewers online.</div>
              ) : (
                viewersList.map((viewer, idx) => (
                  <div key={`${viewer.username}-${idx}`} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-200">
                        {viewer.photo_url ? (
                          <img src={viewer.photo_url} alt={viewer.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-gray-600 text-xs">
                            {viewer.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">
                          @{viewer.username} {viewer.username.toLowerCase() === "kingdavid" ? "👑" : ""}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-medium">Online Now</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 text-center">
              <button
                type="button"
                onClick={() => setShowViewersModal(false)}
                className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow-xs transition cursor-pointer uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MICRO DONATION / PAY SOMEONE MODAL */}
      {showDonateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-xs overflow-hidden transition-all text-left">
            <div className="bg-[#000000] text-white p-3.5 flex justify-between items-center font-bold">
              <div className="flex items-center gap-2">
                <span className="text-base">🎁</span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Donate to @KingDavid</h3>
              </div>
              <button
                onClick={() => setShowDonateModal(false)}
                className="text-gray-400 hover:text-white text-base leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833]" />

            <form onSubmit={handleDonate} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Donation Amount ($ AUD)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-xs bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:border-[#e7b833] focus:bg-white text-gray-900 font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-1.5 pt-1">
                {["5", "10", "20", "50"].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTipAmount(amt)}
                    className={`flex-1 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                      tipAmount === amt
                        ? "bg-[#e7b833] border-[#e7b833] text-gray-900 shadow-2xs"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDonateModal(false)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow-xs transition cursor-pointer uppercase tracking-wider"
                >
                  Send Tip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}