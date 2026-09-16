"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useParams } from "next/navigation";

interface LikeRecord {
  username: string;
  reaction_type: string;
}

interface CommentRecord {
  id: string;
  post_id: string;
  username: string;
  content: string;
  created_at: string;
}

interface Post {
  id: string;
  username: string;
  profile_username: string;
  content: string;
  created_at: string;
  likes: LikeRecord[];
  userReaction: string | null;
  comments: CommentRecord[];
}

interface ConfirmModalState {
  isOpen: boolean;
  type: "reject" | "cancel" | "delete_user" | null;
  relationId: string | null;
  targetName: string | null;
  targetUserId?: string | null;
}

const REACTION_CONFIG: { type: string; emoji: string; label: string }[] = [
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😡", label: "Angry" },
];

function UserPublicProfileContent() {
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
  const [deleteLoadingUserId, setDeleteLoadingUserId] = useState<string | null>(null);

  // Timeline wall state
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState<string>("");
  const [posting, setPosting] = useState<boolean>(false);
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [postId: string]: boolean }>({});

  // Pending Warning Modal State
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Admin Signup Info Modal State
  const [adminModalProfile, setAdminModalProfile] = useState<any | null>(null);

  // Confirm Modal State
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
    const years = Math.abs(ageDate.getUTCFullYear() - 1970);
    return `${years} Years Old`;
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

  const fetchPosts = useCallback(async (profileUser: string, activeUser: string) => {
    const { data: postsData, error } = await supabase
      .from("posts")
      .select("*")
      .ilike("profile_username", profileUser)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
      return;
    }

    if (postsData) {
      const postIds = postsData.map((p) => p.id);
      
      const { data: likesData } = await supabase
        .from("post_likes")
        .select("post_id, username, reaction_type")
        .in("post_id", postIds);

      const { data: commentsData } = await supabase
        .from("post_comments")
        .select("id, post_id, username, content, created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: false });

      const formatted: Post[] = postsData.map((post) => {
        const postLikes: LikeRecord[] = likesData?.filter((l) => l.post_id === post.id) || [];
        const postComments: CommentRecord[] = commentsData?.filter((c) => c.post_id === post.id) || [];
        const userLike = postLikes.find((l) => l.username.toLowerCase() === activeUser.toLowerCase());
        return {
          id: post.id,
          username: post.username,
          profile_username: post.profile_username,
          content: post.content,
          created_at: post.created_at,
          likes: postLikes,
          userReaction: userLike ? userLike.reaction_type : null,
          comments: postComments,
        };
      });

      setPosts(formatted);
    }
  }, [supabase]);

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
      
    let loggedInName = "";
    if (viewerProfile) {
      setCurrentUser(viewerProfile);
      loggedInName = viewerProfile.username;
      setCurrentUsername(loggedInName);
    }

    const { data: targetData } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", targetUsername)
      .single();

    if (targetData) {
      setProfile(targetData);

      if (viewerProfile) {
        const otherName = targetData.username;

        const { data: relData } = await supabase
          .from("friendships")
          .select("*")
          .or(`and(sender_username.eq.${loggedInName},receiver_username.eq.${otherName}),and(sender_username.eq.${otherName},receiver_username.eq.${loggedInName})`)
          .maybeSingle();

        setFriendship(relData || null);
      }

      await fetchPosts(targetData.username, loggedInName);
    }
    setLoading(false);
  }, [targetUsername, router, supabase, fetchPosts]);

  useEffect(() => {
    if (targetUsername) {
      loadData();
    }
  }, [targetUsername, loadData]);

  useEffect(() => {
    if (!profile?.username || !currentUsername) return;

    const channel = supabase
      .channel(`user-timeline-${profile.username}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => { fetchPosts(profile.username, currentUsername); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => { fetchPosts(profile.username, currentUsername); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        () => { fetchPosts(profile.username, currentUsername); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.username, currentUsername, supabase, fetchPosts]);

  const isViewerApproved = Boolean(currentUser?.is_approved);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isViewerApproved) {
      setWarningMessage("Your account is pending approval by King David. Posting thoughts is currently locked.");
      setWarningModalOpen(true);
      return;
    }
    if (!newPostContent.trim() || !currentUsername || !profile?.username) return;

    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      profile_username: profile.username,
      username: currentUsername,
      content: newPostContent.trim(),
    });

    if (error) {
      alert("Failed to create post: " + error.message);
    } else {
      setNewPostContent("");
      await fetchPosts(profile.username, currentUsername);
    }
    setPosting(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this thought?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId);

    if (error) {
      alert("Failed to delete post: " + error.message);
    } else {
      if (profile?.username && currentUsername) {
        await fetchPosts(profile.username, currentUsername);
      }
    }
  };

  const handleAddComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!isViewerApproved) {
      setWarningMessage("Your account is pending approval by King David. Replying to thoughts is currently locked.");
      setWarningModalOpen(true);
      return;
    }
    const commentText = commentInputs[postId];
    if (!commentText?.trim() || !currentUsername) return;

    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      username: currentUsername,
      content: commentText.trim(),
    });

    if (error) {
      alert("Failed to add comment: " + error.message);
    } else {
      setCommentInputs({ ...commentInputs, [postId]: "" });
      if (profile?.username && currentUsername) {
        await fetchPosts(profile.username, currentUsername);
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    const { error } = await supabase.from("post_comments").delete().eq("id", commentId);

    if (error) {
      alert("Failed to delete comment: " + error.message);
    } else {
      if (profile?.username && currentUsername) {
        await fetchPosts(profile.username, currentUsername);
      }
    }
  };

  const handleSelectReaction = async (postId: string, reactionType: string, existingReaction: string | null) => {
    if (!isViewerApproved) {
      setWarningMessage("Your account is pending approval by King David. Reacting to posts is currently locked.");
      setWarningModalOpen(true);
      return;
    }
    if (!currentUsername || !profile?.username) return;

    if (existingReaction === reactionType) {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("username", currentUsername);
    } else {
      await supabase
        .from("post_likes")
        .upsert(
          { post_id: postId, username: currentUsername, reaction_type: reactionType },
          { onConflict: "post_id,username" }
        );
    }

    await fetchPosts(profile.username, currentUsername);
  };

  const toggleExpandComments = (postId: string) => {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleAddMember = async () => {
    if (!currentUser?.is_approved) {
      setWarningMessage("Account pending approval. Adding members is locked.");
      setWarningModalOpen(true);
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
      setWarningMessage("Account pending approval.");
      setWarningModalOpen(true);
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

      setDeleteLoadingUserId(null);
      router.push("/");
    } catch (err: any) {
      alert("Failed to delete user entirely: " + (err.message || err));
      setDeleteLoadingUserId(null);
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).toLowerCase();
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-semibold text-gray-500">
        Loading User Profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-3 max-w-md mx-auto my-12">
        <h2 className="text-base font-bold text-gray-900">User Not Found</h2>
        <p className="text-xs text-gray-500">The requested profile @{targetUsername} does not exist.</p>
        <button onClick={() => router.push("/")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer">
          ← Return to Dashboard
        </button>
      </div>
    );
  }

  const isSelf = currentUser?.username?.toLowerCase() === profile.username?.toLowerCase();
  const isAcceptedFriend = friendship?.status === "accepted";
  const isPending = friendship?.status === "pending";
  const isSender = isPending && friendship?.sender_username?.toLowerCase() === currentUsername?.toLowerCase();
  const isReceiver = isPending && !isSender;
  const isFemale = profile?.gender?.toLowerCase() === "female";
  const isFemaleModal = adminModalProfile?.gender?.toLowerCase() === "female";

  const hasOwnerPosted = posts.some((p) => p.username.toLowerCase() === profile.username.toLowerCase());
  const canPost = isSelf || hasOwnerPosted;

  const renderActionButton = () => {
    if (isSelf) return null;
    return isAcceptedFriend ? (
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
          disabled={actionLoading}
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
        disabled={actionLoading}
        onClick={handleAddMember}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
      >
        {actionLoading ? "Processing..." : "Add Friend"}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Profile Header Identity Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
        
        {/* Top Navigation & Desktop Action Button Row */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <button onClick={() => router.push("/")} className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">
            ← Return to Dashboard
          </button>

          {/* Desktop Right Corner Action Button */}
          <div className="hidden sm:block">
            {renderActionButton()}
          </div>
        </div>

        {/* Mobile Action Button (Directly above profile picture) */}
        <div className="block sm:hidden flex justify-center pb-1 pt-1">
          {renderActionButton()}
        </div>

        {/* Profile Details: Responsive side-by-side on desktop, stacked on mobile */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-2">
          <div className="w-28 h-36 rounded-lg bg-gray-100 border border-gray-300 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="Profile Identity" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400">No Image</span>
            )}
          </div>

          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
              <span 
                onClick={(e) => {
                  if (isAdmin) {
                    e.preventDefault();
                    setAdminModalProfile(profile);
                  }
                }}
                className={`inline-block px-3 py-1 rounded-lg text-lg font-black uppercase tracking-wide text-gray-900 shadow-2xs ${
                  isAdmin ? "cursor-pointer hover:opacity-80 transition" : ""
                } ${isFemale ? "bg-pink-200" : "bg-blue-200"}`}
                title={isAdmin ? "View complete signup info" : ""}
              >
                {profile.first_name} {profile.last_name}
              </span>

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
            
            <p className={`text-xs font-mono font-bold ${isFemale ? "text-pink-600" : "text-blue-600"}`}>
              Payment ID: @{profile.username}
            </p>

            <div className="text-[11px] text-gray-600 space-y-0.5 pt-1 font-medium">
              <p>{calculateAge(profile.dob)}</p>
              <p>{getCity(profile.address)}, {getCountry(profile.address)}</p>
              <p>{profile.religion || "N/A"}</p>
              <p>{profile.employment_status || "N/A"}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Timeline Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        <h2 className="text-sm font-bold text-gray-900">
          @{profile.username}&apos;s thoughts
        </h2>

        {/* Post Composer Box */}
        {canPost && (
          <form onSubmit={handleCreatePost} className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <textarea
              rows={3}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={`Write something on @${profile.username}'s wall...`}
              className="w-full p-3 text-xs text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#e7b833] resize-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={posting || !newPostContent.trim()}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? "Posting..." : "Post thoughts"}
              </button>
            </div>
          </form>
        )}

        {/* Posts Feed */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-400 font-medium italic">
              &ldquo;Like a blank slate, so are the thoughts of some&rdquo;
            </div>
          ) : (
            posts.map((post) => {
              const isExpanded = expandedComments[post.id];
              const visibleComments = isExpanded ? post.comments : post.comments.slice(0, 3);
              const remainingCount = post.comments.length - 3;

              return (
                <div key={post.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xs text-gray-700">
                        {post.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">@{post.username}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{formatTimestamp(post.created_at)}</span>
                      </div>
                    </div>

                    {/* Delete button for KingDavid or post author */}
                    {(currentUsername.toLowerCase() === "kingdavid" || post.username.toLowerCase() === currentUsername.toLowerCase()) && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded transition cursor-pointer shadow-2xs"
                        title="Delete thought"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed px-1">
                    {post.content}
                  </p>

                  {/* Reaction Bar */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="bg-gray-100 rounded-full px-4 py-1.5 flex items-center gap-4 shadow-2xs">
                      {REACTION_CONFIG.map((rc) => {
                        const count = post.likes.filter((l) => l.reaction_type === rc.type).length;
                        const isActive = post.userReaction === rc.type;
                        return (
                          <button
                            key={rc.type}
                            onClick={() => handleSelectReaction(post.id, rc.type, post.userReaction)}
                            className={`flex items-center gap-1 transition cursor-pointer hover:scale-110 ${
                              isActive ? "opacity-100 scale-105 font-bold text-rose-600" : "opacity-40 grayscale hover:grayscale-0 hover:opacity-90 text-gray-700"
                            }`}
                            title={rc.label}
                          >
                            <span className="text-base">{rc.emoji}</span>
                            <span className="font-mono text-xs">{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    {post.userReaction && (
                      <span className="text-gray-500 font-normal ml-3">
                        You Reacted
                      </span>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    {post.comments.length > 0 && (
                      <div className="space-y-2 pl-2 sm:pl-4 border-l-2 border-gray-200">
                        {visibleComments.map((comment) => (
                          <div key={comment.id} className="text-xs flex items-start justify-between bg-gray-50 p-2 rounded-lg">
                            <div className="space-y-0.5">
                              <span className="font-bold text-gray-900">@{comment.username}</span>
                              <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                              <span className="text-[9px] text-gray-400 font-mono">{formatTimestamp(comment.created_at)}</span>
                            </div>

                            {/* Delete comment for KingDavid or comment author */}
                            {(currentUsername.toLowerCase() === "kingdavid" || comment.username.toLowerCase() === currentUsername.toLowerCase()) && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded transition cursor-pointer shrink-0 ml-2"
                                title="Delete comment"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        ))}

                        {post.comments.length > 3 && (
                          <button
                            onClick={() => toggleExpandComments(post.id)}
                            className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer pt-1 block"
                          >
                            {isExpanded ? "Show fewer comments" : `View more comments (${remainingCount} more)`}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Add Comment Form */}
                    <form onSubmit={(e) => handleAddComment(post.id, e)} className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={commentInputs[post.id] || ""}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                        placeholder="Write a comment..."
                        className="flex-1 px-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-[#e7b833]"
                      />
                      <button
                        type="submit"
                        disabled={!commentInputs[post.id]?.trim()}
                        className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reply
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
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

      {/* WARNING MODAL FOR PENDING USERS */}
      {warningModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden transition-all text-left">
            <div className="bg-[#800000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">Account Pending Approval</h3>
              <button
                onClick={() => setWarningModalOpen(false)}
                className="text-red-100 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#660000]" />

            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 text-xs text-red-900 leading-relaxed">
                {warningMessage}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setWarningModalOpen(false)}
                  className="px-5 py-2.5 rounded text-sm font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                >
                  OK
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
                      onClick={() => setConfirmModal({ isOpen: false, type: null, relationId: null, targetName: null, targetUserId: null })}
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

export default function UserPublicProfilePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs font-semibold text-gray-500">Loading Profile...</div>}>
      <UserPublicProfileContent />
    </Suspense>
  );
}