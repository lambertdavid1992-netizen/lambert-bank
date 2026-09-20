"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

interface StreamChatMessage {
  id: string;
  username: string;
  message: string;
  created_at: string;
}

interface StreamRecord {
  id: string;
  host_username: string;
  title: string;
  is_active: boolean;
}

interface Viewer {
  username: string;
  photo_url?: string;
}

export default function StreamingPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  const [currentUsername, setCurrentUsername] = useState<string>("Guest");
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | undefined>(undefined);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [balanceCents, setBalanceCents] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("Connecting...");
  const [selectedStreamer, setSelectedStreamer] = useState<string | null>(null);
  const [activeStreams, setActiveStreams] = useState<StreamRecord[]>([]);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [viewersList, setViewersList] = useState<Viewer[]>([]);
  const [showViewersModal, setShowViewersModal] = useState<boolean>(false);
  const [showDonateModal, setShowDonateModal] = useState<boolean>(false);
  const [tipAmount, setTipAmount] = useState<string>("5");
  const [chatInput, setChatInput] = useState<string>("");
  const [messages, setMessages] = useState<StreamChatMessage[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (session.user.email?.toLowerCase() === "lambertdavid1992@gmail.com") {
          setCurrentUsername("KingDavid");
          setIsApproved(true);
          setBalanceCents(100000);
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

  const fetchActiveStreams = useCallback(async () => {
    const { data, error } = await supabase
      .from("streams")
      .select("*")
      .eq("is_active", true);

    if (!error && data) {
      const uniqueStreamsMap = new Map<string, StreamRecord>();
      data.forEach((s) => {
        uniqueStreamsMap.set(s.host_username, s);
      });
      const streamsList = Array.from(uniqueStreamsMap.values());
      setActiveStreams(streamsList);

      if (selectedStreamer && selectedStreamer !== currentUsername) {
        const isStillActive = streamsList.some((s) => s.host_username.toLowerCase() === selectedStreamer.toLowerCase());
        if (!isStillActive) {
          setSelectedStreamer(null);
        }
      }
    } else {
      setActiveStreams([]);
      if (selectedStreamer && selectedStreamer !== currentUsername) {
        setSelectedStreamer(null);
      }
    }
  }, [supabase, selectedStreamer, currentUsername]);

  useEffect(() => {
    fetchActiveStreams();
  }, [fetchActiveStreams]);

  useEffect(() => {
    const channel = supabase
      .channel("streams-lobby-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "streams" },
        () => { fetchActiveStreams(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchActiveStreams]);

  // Unload listener prevents abandoned live broadcasts
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isStreaming && currentUsername) {
        supabase.from("streams").update({ is_active: false }).eq("host_username", currentUsername).eq("is_active", true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (isStreaming && currentUsername) {
        supabase.from("streams").update({ is_active: false }).eq("host_username", currentUsername).eq("is_active", true);
      }
    };
  }, [isStreaming, currentUsername, supabase]);

  // WebRTC P2P Signaling
  useEffect(() => {
    if (!selectedStreamer || !currentUsername || currentUsername === "Guest") return;
    const isHost = selectedStreamer === currentUsername && isStreaming;

    const iceServers: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
      iceCandidatePoolSize: 10,
    };

    const roomChannel = supabase.channel(`room-broadcast-${selectedStreamer}`, {
      config: { broadcast: { self: false } }
    });

    let isCleanedUp = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 6;

    const addBufferedCandidates = async (pc: RTCPeerConnection, peerKey: string) => {
      const candidates = pendingCandidatesRef.current.get(peerKey);
      if (candidates && candidates.length > 0) {
        for (const candidate of candidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("Buffered ICE error:", e);
          }
        }
        pendingCandidatesRef.current.set(peerKey, []);
      }
    };

    const setupViewerConnection = async () => {
      if (isCleanedUp || isHost) return;

      const oldPc = peerConnectionsRef.current.get(selectedStreamer);
      if (oldPc) {
        oldPc.close();
        peerConnectionsRef.current.delete(selectedStreamer);
      }
      pendingCandidatesRef.current.set(selectedStreamer, []);

      const pc = new RTCPeerConnection(iceServers);
      peerConnectionsRef.current.set(selectedStreamer, pc);

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.onconnectionstatechange = () => {
        if (isCleanedUp) return;
        if (pc.connectionState === "connected") {
          reconnectAttempts = 0;
          setConnectionStatus("Live");
        } else if (pc.connectionState === "disconnected") {
          setConnectionStatus("Connection unstable...");
        } else if (pc.connectionState === "failed") {
          scheduleReconnect();
        }
      };

      pc.ontrack = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.muted = false;
          videoRef.current.play().catch(console.error);
          setConnectionStatus("Live");
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          roomChannel.send({
            type: "broadcast",
            event: "webrtc-signal",
            payload: { type: "ice", sender: currentUsername, target: selectedStreamer, payload: event.candidate }
          });
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        roomChannel.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: { type: "offer", sender: currentUsername, target: selectedStreamer, payload: pc.localDescription }
        });
      } catch (err) {
        console.error("Failed to create offer:", err);
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (isCleanedUp || isHost) return;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionStatus("Unable to connect. Tap to retry.");
        return;
      }
      reconnectAttempts += 1;
      const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 8000);
      setConnectionStatus(`Reconnecting (${reconnectAttempts})...`);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        setupViewerConnection();
      }, delay);
    };

    roomChannel
      .on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
        if (payload.target !== currentUsername) return;
        const { type, sender, payload: signal } = payload;

        if (isHost) {
          let pc = peerConnectionsRef.current.get(sender);
          if (type === "offer") {
            if (!pc) {
              pc = new RTCPeerConnection(iceServers);
              peerConnectionsRef.current.set(sender, pc);

              pc.onconnectionstatechange = () => {
                if (pc?.connectionState === "connected") {
                  setConnectionStatus("Live");
                }
                if (pc?.connectionState === "failed" || pc?.connectionState === "closed") {
                  pc?.close();
                  peerConnectionsRef.current.delete(sender);
                }
              };

              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                  pc!.addTrack(track, localStreamRef.current!);
                });
              }

              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  roomChannel.send({
                    type: "broadcast",
                    event: "webrtc-signal",
                    payload: { type: "ice", sender: currentUsername, target: sender, payload: event.candidate }
                  });
                }
              };
            }

            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            await addBufferedCandidates(pc, sender);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            roomChannel.send({
              type: "broadcast",
              event: "webrtc-signal",
              payload: { type: "answer", sender: currentUsername, target: sender, payload: pc.localDescription }
            });
          } else if (type === "ice") {
            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal));
              } catch (e) {
                console.error("Host ICE error:", e);
              }
            } else {
              const queue = pendingCandidatesRef.current.get(sender) || [];
              queue.push(signal);
              pendingCandidatesRef.current.set(sender, queue);
            }
          }
        } else {
          const pc = peerConnectionsRef.current.get(selectedStreamer);
          if (!pc) return;

          if (type === "answer") {
            if (pc.signalingState === "stable") return;
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            await addBufferedCandidates(pc, selectedStreamer);
          } else if (type === "ice") {
            if (pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal));
              } catch (e) {
                console.error("Viewer ICE error:", e);
              }
            } else {
              const queue = pendingCandidatesRef.current.get(selectedStreamer) || [];
              queue.push(signal);
              pendingCandidatesRef.current.set(selectedStreamer, queue);
            }
          }
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !isHost) {
          setConnectionStatus("Connecting to stream...");
          await setupViewerConnection();
        }
      });

    return () => {
      isCleanedUp = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      pendingCandidatesRef.current.clear();
      supabase.removeChannel(roomChannel);
    };
  }, [selectedStreamer, currentUsername, isStreaming, supabase]);

  const closeUserActiveStreams = async (username: string) => {
    await supabase
      .from("streams")
      .update({ is_active: false })
      .eq("host_username", username)
      .eq("is_active", true);
  };

  const enterFullScreen = () => {
    const elem = document.documentElement as any;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
  };

  const exitFullScreen = () => {
    const doc = document as any;
    if (doc.exitFullscreen && document.fullscreenElement) {
      doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen && doc.webkitFullscreenElement) {
      doc.webkitExitFullscreen();
    }
  };

  const toggleLive = async () => {
    if (!isApproved) {
      alert("Live streaming is only available to approved members.");
      return;
    }

    if (!isStreaming) {
      try {
        enterFullScreen();
        await closeUserActiveStreams(currentUsername);
        await supabase.from("stream_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        setMessages([]);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });

        stream.getVideoTracks()[0].onended = () => {
          handleExitStream();
        };

        localStreamRef.current = stream;
        setIsStreaming(true);
        setSelectedStreamer(currentUsername);
        setConnectionStatus("Live");

        setTimeout(async () => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            try {
              await videoRef.current.play();
            } catch (err) {
              console.error("Local play error:", err);
            }
          }
        }, 100);

        const { data, error } = await supabase
          .from("streams")
          .insert({
            host_username: currentUsername,
            title: `${currentUsername}'s Live Broadcast`,
            is_active: true,
          })
          .select()
          .single();

        if (!error && data) {
          setStreamId(data.id);
        }
      } catch (err) {
        console.error("Media access failed:", err);
        alert("Camera and microphone permission required to stream.");
      }
    } else {
      handleExitStream();
    }
    fetchActiveStreams();
  };

  const handleExitStream = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);

    if (streamId) {
      await supabase
        .from("streams")
        .update({ is_active: false })
        .eq("id", streamId);
      setStreamId(null);
    }
    await closeUserActiveStreams(currentUsername);

    exitFullScreen();
    setSelectedStreamer(null);
    fetchActiveStreams();
  };

  useEffect(() => {
    if (isStreaming && selectedStreamer === currentUsername && videoRef.current && localStreamRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [selectedStreamer, isStreaming, currentUsername]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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
    if (selectedStreamer) {
      fetchStreamMessages();
    }
  }, [selectedStreamer, fetchStreamMessages]);

  useEffect(() => {
    const channel = supabase
      .channel("live-stream-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stream_messages" },
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

  useEffect(() => {
    if (!currentUsername || currentUsername === "Guest" || !selectedStreamer) return;

    const channel = supabase.channel(`stream-room-${selectedStreamer}`, {
      config: { presence: { key: currentUsername } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const activeViewers: Viewer[] = [];
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.username && p.username !== selectedStreamer) {
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
  }, [currentUsername, currentUserPhoto, selectedStreamer, supabase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUsername) return;
    const text = chatInput.trim();
    setChatInput("");
    await supabase.from("stream_messages").insert({
      username: currentUsername,
      message: text,
    });
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

    await supabase.from("stream_messages").insert({
      username: "System",
      message: `🎁 @${currentUsername} donated $${amount.toFixed(2)} to @${selectedStreamer}!`,
    });

    setShowDonateModal(false);
    alert(`Successfully donated $${amount.toFixed(2)} to @${selectedStreamer}!`);
  };

  if (!selectedStreamer) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 px-2">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Live Broadcast Lobby</h1>
            <p className="text-xs text-gray-500">Select an active stream below to join and watch live.</p>
          </div>
          {isApproved ? (
            <button
              onClick={toggleLive}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow-sm transition cursor-pointer flex items-center gap-2"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              Go Live Now
            </button>
          ) : (
            <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg font-medium">
              🔒 Live broadcasting restricted to approved members
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {activeStreams.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-gray-400 bg-white rounded-xl border border-gray-200">
              No active live streams right now. Check back soon!
            </div>
          ) : (
            activeStreams.map((stream) => (
              <div
                key={stream.id}
                onClick={() => {
                  enterFullScreen();
                  setSelectedStreamer(stream.host_username);
                }}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#e7b833] hover:shadow-md transition cursor-pointer flex flex-col items-center text-center group"
              >
                <div className="relative w-16 h-16 rounded-full bg-gray-900 text-white font-black flex items-center justify-center text-xl border-2 border-amber-400 mb-3 shadow-sm group-hover:scale-105 transition">
                  {stream.host_username.charAt(0).toUpperCase()}
                  <div className="absolute bottom-0 inset-x-0 bg-rose-600 text-white text-[8px] font-black uppercase tracking-widest py-0.5">
                    LIVE
                  </div>
                </div>
                <h3 className="text-xs font-bold text-gray-900 group-hover:text-[#b8860b] transition">
                  @{stream.host_username} {stream.host_username === "KingDavid" ? "👑" : ""}
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">{stream.title}</p>
                <button
                  type="button"
                  className="mt-3 w-full py-2 rounded-lg text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow-xs transition cursor-pointer uppercase tracking-wider"
                >
                  WATCH LIVE
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-black w-screen h-screen flex flex-col items-center justify-center overflow-hidden p-0 m-0">
      <div className="relative bg-black w-full h-full flex flex-col justify-end overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={selectedStreamer === currentUsername}
          className="absolute inset-0 w-full h-full object-cover bg-black transform -scale-x-100"
        />

        <div className="absolute top-16 left-4 z-30">
          <span className="bg-black/50 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-mono uppercase tracking-wider border border-white/10">
            {connectionStatus}
          </span>
        </div>

        <div className="absolute top-4 left-4 flex items-center gap-1.5 z-30">
          {isApproved ? (
            <button
              type="button"
              onClick={toggleLive}
              title={isStreaming ? "Click to stop streaming" : "Click to go live"}
              className={`flex items-center gap-1.5 backdrop-blur-md px-3 py-1.5 rounded-full border transition cursor-pointer shadow-md ${
                isStreaming
                  ? "bg-black/90 border-rose-600 text-white font-bold"
                  : "bg-black/60 border-zinc-700 text-zinc-300 hover:text-white"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isStreaming ? "bg-rose-600" : "bg-zinc-500"}`} />
              <span className="text-[9px] font-black uppercase tracking-widest">
                {isStreaming ? "LIVE" : "GO LIVE"}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowViewersModal(true)}
            title="Click to view current live viewers"
            className="flex items-center gap-1 bg-black/60 hover:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-800 text-[10px] font-mono text-zinc-300 transition cursor-pointer shadow-md"
          >
            👁️ {viewerCount} ▾
          </button>
        </div>

        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          {balanceCents > 0 && selectedStreamer !== currentUsername && (
            <button
              type="button"
              onClick={() => setShowDonateModal(true)}
              title="Donate to stream host"
              className="w-7 h-7 rounded-full bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 font-bold text-xs flex items-center justify-center shadow-md transition cursor-pointer border border-amber-400"
            >
              $
            </button>
          )}

          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-800 shadow-md">
            <span className="text-[10px] font-bold text-white font-mono">@{selectedStreamer} {selectedStreamer === "KingDavid" ? "👑" : ""}</span>
          </div>

          <button
            type="button"
            onClick={handleExitStream}
            title="Exit stream"
            className="w-7 h-7 rounded-full bg-zinc-800/90 hover:bg-zinc-700 text-white flex items-center justify-center text-xs font-bold shadow-xl transition cursor-pointer border border-zinc-600"
          >
            ✕
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-zinc-950/60 to-transparent pt-12 pb-6 px-4 flex flex-col justify-end max-h-[50%]">
          <div className="overflow-y-auto space-y-1.5 mb-2 max-h-40 pr-1 text-xs [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
            {messages.length === 0 ? (
              <div className="text-center text-[10px] text-zinc-400 py-1">No comments yet. Say something!</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="leading-tight bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md border border-zinc-700/60 shadow-xs">
                  <span className="font-bold text-[#e7b833] mr-1.5">@{m.username}:</span>
                  <span className="text-white text-[11px]">{m.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="w-full">
            <div className="relative w-full flex items-center">
              <input
                type="text"
                placeholder="Send a comment..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-zinc-900/90 border border-zinc-700 rounded-lg focus:outline-none focus:border-[#e7b833] text-white font-medium placeholder:text-zinc-500 backdrop-blur-sm shadow-inner"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                title="Send comment"
                className="absolute right-1.5 w-7 h-7 rounded-md flex items-center justify-center bg-[#e7b833] hover:bg-[#d4a52b] disabled:opacity-40 text-gray-900 shadow-xs transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* VIEWERS MODAL */}
      {showViewersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden text-left">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center font-bold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Current Live Viewers ({viewersList.length})</h3>
              </div>
              <button onClick={() => setShowViewersModal(false)} className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer">✕</button>
            </div>
            <div className="h-1 bg-[#e7b833]" />
            <div className="p-4 max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
              {viewersList.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">No active viewers online.</div>
              ) : (
                viewersList.map((viewer, idx) => (
                  <div key={`${viewer.username}-${idx}`} className="py-3 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-900">@{viewer.username}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-center">
              <button onClick={() => setShowViewersModal(false)} className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#e7b833] text-gray-900 cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* DONATION MODAL */}
      {showDonateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-xs overflow-hidden text-left">
            <div className="bg-[#000000] text-white p-3.5 flex justify-between items-center font-bold">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Donate to @{selectedStreamer}</h3>
              <button onClick={() => setShowDonateModal(false)} className="text-gray-400 hover:text-white text-base leading-none cursor-pointer">✕</button>
            </div>
            <div className="h-1 bg-[#e7b833]" />
            <form onSubmit={handleDonate} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Donation Amount ($ AUD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-100 border border-gray-200 rounded-lg font-bold text-gray-900"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowDonateModal(false)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-gray-200 text-gray-800 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#e7b833] text-gray-900 cursor-pointer">Send Tip</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}