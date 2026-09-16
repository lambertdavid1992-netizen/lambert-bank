"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";

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

const REACTION_CONFIG: { type: string; emoji: string; label: string }[] = [
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😡", label: "Angry" },
];

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileParam = searchParams.get("username");

  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [profile, setProfile] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Timeline wall state
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState<string>("");
  const [posting, setPosting] = useState<boolean>(false);
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [postId: string]: boolean }>({});

  // Pending Warning Modal State
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

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

  const loadProfileAndPosts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      let loggedInUsername = "";
      const email = session.user.email || "";

      if (email.toLowerCase() === "lambertdavid1992@gmail.com") {
        loggedInUsername = "KingDavid";
        setCurrentUserProfile({ username: "KingDavid", is_approved: true });
      } else {
        const { data: userProf } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .single();
        if (userProf) {
          loggedInUsername = userProf.username;
          setCurrentUserProfile(userProf);
        }
      }

      setCurrentUsername(loggedInUsername);

      const targetProfileUser = profileParam ? profileParam.trim() : loggedInUsername;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", targetProfileUser)
        .single();

      if (profileData) {
        setProfile(profileData);
        await fetchPosts(profileData.username, loggedInUsername);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Failed to load profile data", err);
    } finally {
      setLoading(false);
    }
  }, [router, supabase, profileParam]);

  const fetchPosts = async (profileUser: string, activeUser: string) => {
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
  };

  useEffect(() => {
    loadProfileAndPosts();

    const channel = supabase
      .channel("profile-timeline-wall")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => { if (profile?.username && currentUsername) fetchPosts(profile.username, currentUsername); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => { if (profile?.username && currentUsername) fetchPosts(profile.username, currentUsername); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        () => { if (profile?.username && currentUsername) fetchPosts(profile.username, currentUsername); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadProfileAndPosts, profile?.username, currentUsername, supabase]);

  const isViewerApproved = Boolean(currentUserProfile?.is_approved);

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
      <div className="py-20 text-center text-xs font-semibold text-red-500">
        Profile not found.
      </div>
    );
  }

  const isApproved = Boolean(profile?.is_approved);
  const isOwnProfile = currentUsername.toLowerCase() === profile?.username?.toLowerCase();
  const isFemale = profile?.gender?.toLowerCase() === "female";

  const hasOwnerPosted = posts.some((p) => p.username.toLowerCase() === profile.username.toLowerCase());
  const canPost = isOwnProfile || hasOwnerPosted;

  return (
    <div className="space-y-6">
      {/* Pending Account Notice */}
      {!isApproved && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-base">
              ⏳
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">Account Pending Approval</h3>
              <p className="text-[11px] text-amber-700">This profile is currently under review.</p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header Identity Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-28 h-36 rounded-lg bg-gray-100 border border-gray-300 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="Profile Identity" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400">No Image</span>
            )}
          </div>

          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div>
              <span className={`inline-block px-3 py-1 rounded-lg text-lg font-black uppercase tracking-wide text-gray-900 shadow-2xs ${
                isFemale ? "bg-pink-200" : "bg-blue-200"
              }`}>
                {profile?.first_name || "Account"} {profile?.last_name || ""}
              </span>
            </div>
            
            <p className={`text-xs font-mono font-bold ${isFemale ? "text-pink-600" : "text-blue-600"}`}>
              Payment ID: @{profile?.username}
            </p>

            <div className="text-[11px] text-gray-600 space-y-0.5 pt-1 font-medium">
              <p>{calculateAge(profile?.dob)}</p>
              <p>{getCity(profile?.address)}, {getCountry(profile?.address)}</p>
              <p>{profile?.religion || "N/A"}</p>
              <p>{profile?.employment_status || "N/A"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        <h2 className="text-sm font-bold text-gray-900">
          @{profile?.username}&apos;s thoughts
        </h2>

        {/* Post Composer Box */}
        {canPost && (
          <form onSubmit={handleCreatePost} className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <textarea
              rows={3}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={isOwnProfile ? `What's on your mind, @${currentUsername}?` : `Write something on @${profile?.username}'s wall...`}
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
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs font-semibold text-gray-500">Loading Profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}