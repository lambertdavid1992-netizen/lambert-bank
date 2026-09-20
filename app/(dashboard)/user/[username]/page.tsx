"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useParams } from "next/navigation";
import { compressImageFile, extractStoragePath } from "@/lib/imageUtils";

interface LikeRecord {
  username: string;
  reaction_type: string;
}

interface CommentLikeRecord {
  comment_id: string;
  username: string;
  reaction_type: string;
}

interface CommentRecord {
  id: string;
  post_id: string;
  username: string;
  content: string;
  created_at: string;
  likes: CommentLikeRecord[];
  userReaction: string | null;
}

interface Post {
  id: string;
  username: string;
  profile_username: string;
  content: string;
  image_url: string | null;
  created_at: string;
  likes: LikeRecord[];
  userReaction: string | null;
  comments: CommentRecord[];
}

interface GalleryLikeRecord {
  gallery_id: string;
  username: string;
  reaction_type: string;
}

interface GalleryItem {
  id: string;
  profile_username: string;
  image_url: string;
  created_at: string;
  username: string;
  likes: GalleryLikeRecord[];
  userReaction: string | null;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
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
  const [newPostImageFile, setNewPostImageFile] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState<boolean>(false);
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [postId: string]: boolean }>({});

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryItem | null>(null);
  const [selectedPostImage, setSelectedPostImage] = useState<string | null>(null);

  // Pending Warning Modal State
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Admin Signup Info Modal State
  const [adminModalProfile, setAdminModalProfile] = useState<any | null>(null);

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
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
    const parts = fullAddress.split(",").map((p) => p.trim());
    return parts.length > 0 ? parts[parts.length - 1] : "N/A";
  };

  const getCity = (fullAddress: string) => {
    if (!fullAddress || fullAddress === "N/A") return "N/A";
    const parts = fullAddress.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      return parts[parts.length - 3];
    }
    return parts.length > 0 ? parts[0] : "N/A";
  };

  const fetchPosts = useCallback(
    async (profileUser: string, activeUser: string) => {
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
          .in("post_id", postIds.length > 0 ? postIds : ["none"]);

        const { data: commentsData } = await supabase
          .from("post_comments")
          .select("id, post_id, username, content, created_at")
          .in("post_id", postIds.length > 0 ? postIds : ["none"])
          .order("created_at", { ascending: false });

        const commentIds = commentsData?.map((c) => c.id) || [];

        const { data: commentLikesData } = await supabase
          .from("comment_likes")
          .select("comment_id, username, reaction_type")
          .in("comment_id", commentIds.length > 0 ? commentIds : ["none"]);

        const formatted: Post[] = postsData.map((post) => {
          const postLikes: LikeRecord[] = likesData?.filter((l) => l.post_id === post.id) || [];
          const rawComments: CommentRecord[] = commentsData?.filter((c) => c.post_id === post.id) || [];

          const postComments = rawComments.map((comment) => {
            const commentLikes = commentLikesData?.filter((cl) => cl.comment_id === comment.id) || [];
            const userCommentLike = commentLikes.find(
              (cl) => cl.username.toLowerCase() === activeUser.toLowerCase()
            );
            return {
              ...comment,
              likes: commentLikes,
              userReaction: userCommentLike ? userCommentLike.reaction_type : null,
            };
          });

          const userLike = postLikes.find((l) => l.username.toLowerCase() === activeUser.toLowerCase());
          return {
            id: post.id,
            username: post.username,
            profile_username: post.profile_username,
            content: post.content,
            image_url: post.image_url || null,
            created_at: post.created_at,
            likes: postLikes,
            userReaction: userLike ? userLike.reaction_type : null,
            comments: postComments,
          };
        });

        setPosts(formatted);
      }
    },
    [supabase]
  );

  const fetchGallery = useCallback(
    async (profileUser: string, activeUser: string) => {
      const { data, error } = await supabase
        .from("profile_gallery")
        .select("*")
        .ilike("profile_username", profileUser)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching gallery items:", error);
        return;
      }

      if (data) {
        const galleryIds = data.map((img) => img.id);
        const { data: galleryLikesData } = await supabase
          .from("gallery_likes")
          .select("gallery_id, username, reaction_type")
          .in("gallery_id", galleryIds.length > 0 ? galleryIds : ["none"]);

        const formattedGallery: GalleryItem[] = data.map((item) => {
          const itemLikes = galleryLikesData?.filter((gl) => gl.gallery_id === item.id) || [];
          const userItemLike = itemLikes.find((gl) => gl.username.toLowerCase() === activeUser.toLowerCase());
          return {
            ...item,
            likes: itemLikes,
            userReaction: userItemLike ? userItemLike.reaction_type : null,
          };
        });

        setGalleryImages(formattedGallery);
      }
    },
    [supabase]
  );

  const loadData = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
          .or(
            `and(sender_username.eq.${loggedInName},receiver_username.eq.${otherName}),and(sender_username.eq.${otherName},receiver_username.eq.${loggedInName})`
          )
          .maybeSingle();

        setFriendship(relData || null);
      }

      await fetchPosts(targetData.username, loggedInName);
      await fetchGallery(targetData.username, loggedInName);
    }
    setLoading(false);
  }, [targetUsername, router, supabase, fetchPosts, fetchGallery]);

  useEffect(() => {
    if (targetUsername) {
      loadData();
    }
  }, [targetUsername, loadData]);

  useEffect(() => {
    if (!profile?.username || !currentUsername) return;

    const channel = supabase
      .channel(`user-wall-and-gallery-${profile.username}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          fetchPosts(profile.username, currentUsername);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => {
          fetchPosts(profile.username, currentUsername);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        () => {
          fetchPosts(profile.username, currentUsername);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comment_likes" },
        () => {
          fetchPosts(profile.username, currentUsername);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profile_gallery" },
        () => {
          fetchGallery(profile.username, currentUsername);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gallery_likes" },
        () => {
          fetchGallery(profile.username, currentUsername);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          if (profile?.username && payload.new.username.toLowerCase() === profile.username.toLowerCase()) {
            setProfile(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.username, currentUsername, supabase, fetchPosts, fetchGallery]);

  const isSelf = currentUser?.username?.toLowerCase() === profile?.username?.toLowerCase();
  const isAcceptedFriend = friendship?.status === "accepted";
  const isPending = friendship?.status === "pending";
  const isSender = isPending && friendship?.sender_username?.toLowerCase() === currentUsername?.toLowerCase();
  const isReceiver = isPending && !isSender;
  const isFemale = profile?.gender?.toLowerCase() === "female";
  const isViewerApproved = Boolean(currentUser?.is_approved);

  const hasOwnerPosted = posts.some((p) => p.username.toLowerCase() === profile?.username?.toLowerCase());
  const canPost = isSelf || hasOwnerPosted;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!isViewerApproved) {
      setWarningMessage("Your account is pending approval by King David. Updating profile picture is currently locked.");
      setWarningModalOpen(true);
      e.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Profile picture size exceeds 10MB limit. Please choose a smaller image.");
      e.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    try {
      const compressedAvatar = await compressImageFile(file, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 500,
      });

      if (profile?.photo_url) {
        const oldPath = extractStoragePath(profile.photo_url, "profile-photos");
        if (oldPath) {
          await supabase.storage.from("profile-photos").remove([oldPath]);
        }
      }

      const fileName = `avatar-${Date.now()}.webp`;
      const filePath = `${currentUsername}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, compressedAvatar, { contentType: "image/webp", upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-photos").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ photo_url: publicUrl })
        .eq("username", currentUsername);

      if (updateError) throw updateError;

      setProfile((prev: any) => ({ ...prev, photo_url: publicUrl }));
    } catch (err: any) {
      alert("Failed to update profile picture: " + (err.message || err));
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Restrict uploads strictly to own account
    if (!isSelf) {
      alert("You can only upload pictures to your own gallery.");
      e.target.value = "";
      return;
    }

    if (!isViewerApproved) {
      setWarningMessage("Your account is pending approval by King David. Uploading images is currently locked.");
      setWarningModalOpen(true);
      e.target.value = "";
      return;
    }

    const userUploadedCount = galleryImages.filter(
      (img) => img.username.toLowerCase() === currentUsername.toLowerCase()
    ).length;

    if (userUploadedCount >= 50) {
      alert("You have reached the maximum limit of 50 uploaded pictures for this profile.");
      e.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit. Please choose a smaller image.");
      e.target.value = "";
      return;
    }

    setUploadingImage(true);
    try {
      const optimizedFile = await compressImageFile(file, {
        maxSizeMB: 0.35,
        maxWidthOrHeight: 1440,
      });

      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.webp`;
      const filePath = `${profile.username}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(filePath, optimizedFile, { contentType: "image/webp" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("gallery").getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("profile_gallery").insert({
        profile_username: profile.username,
        image_url: publicUrl,
        username: currentUsername,
      });

      if (dbError) throw dbError;

      await fetchGallery(profile.username, currentUsername);
    } catch (err: any) {
      alert("Failed to upload image: " + (err.message || err));
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const confirmDeleteImage = (img: GalleryItem) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Image Confirmation",
      message: "Are you sure you want to delete this image?",
      onConfirm: async () => {
        const storagePath = extractStoragePath(img.image_url, "gallery");
        if (storagePath) {
          await supabase.storage.from("gallery").remove([storagePath]);
        }

        const { error } = await supabase.from("profile_gallery").delete().eq("id", img.id);
        if (error) {
          alert("Failed to delete image: " + error.message);
        } else {
          if (profile?.username && currentUsername) {
            await fetchGallery(profile.username, currentUsername);
          }
        }
      },
    });
  };

  const handlePostImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.size > 10 * 1024 * 1024) {
      alert("Thought image size exceeds 10MB limit.");
      e.target.value = "";
      return;
    }

    setNewPostImageFile(file);
    setNewPostImagePreview(URL.createObjectURL(file));
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isViewerApproved) {
      setWarningMessage("Your account is pending approval by King David. Posting thoughts is currently locked.");
      setWarningModalOpen(true);
      return;
    }
    if ((!newPostContent.trim() && !newPostImageFile) || !currentUsername || !profile?.username) return;

    setPosting(true);
    try {
      let uploadedImageUrl: string | null = null;

      if (newPostImageFile) {
        const optimizedFile = await compressImageFile(newPostImageFile, {
          maxSizeMB: 0.35,
          maxWidthOrHeight: 1440,
        });

        const fileName = `post-${Math.random().toString(36).substring(2)}-${Date.now()}.webp`;
        const filePath = `${profile.username}/posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("gallery")
          .upload(filePath, optimizedFile, { contentType: "image/webp" });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("gallery").getPublicUrl(filePath);

        uploadedImageUrl = publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        profile_username: profile.username,
        username: currentUsername,
        content: newPostContent.trim(),
        image_url: uploadedImageUrl,
      });

      if (error) throw error;

      setNewPostContent("");
      setNewPostImageFile(null);
      setNewPostImagePreview(null);
      await fetchPosts(profile.username, currentUsername);
    } catch (err: any) {
      alert("Failed to create post: " + (err.message || err));
    } finally {
      setPosting(false);
    }
  };

  const confirmDeletePost = (post: Post) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Thought Confirmation",
      message: "Are you sure you want to delete this thought?",
      onConfirm: async () => {
        if (post.image_url) {
          const storagePath = extractStoragePath(post.image_url, "gallery");
          if (storagePath) {
            await supabase.storage.from("gallery").remove([storagePath]);
          }
        }

        const { error } = await supabase.from("posts").delete().eq("id", post.id);
        if (error) {
          alert("Failed to delete post: " + error.message);
        } else {
          if (profile?.username && currentUsername) {
            await fetchPosts(profile.username, currentUsername);
          }
        }
      },
    });
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

  const confirmDeleteComment = (commentId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Comment Confirmation",
      message: "Are you sure you want to delete this comment?",
      onConfirm: async () => {
        const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
        if (error) {
          alert("Failed to delete comment: " + error.message);
        } else {
          if (profile?.username && currentUsername) {
            await fetchPosts(profile.username, currentUsername);
          }
        }
      },
    });
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

  const handleSelectCommentReaction = async (
    commentId: string,
    reactionType: string,
    existingReaction: string | null
  ) => {
    if (!isViewerApproved) {
      setWarningMessage("Your account is pending approval by King David. Reacting to comments is currently locked.");
      setWarningModalOpen(true);
      return;
    }
    if (!currentUsername || !profile?.username) return;

    if (existingReaction === reactionType) {
      await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("username", currentUsername);
    } else {
      await supabase
        .from("comment_likes")
        .upsert(
          { comment_id: commentId, username: currentUsername, reaction_type: reactionType },
          { onConflict: "comment_id,username" }
        );
    }

    await fetchPosts(profile.username, currentUsername);
  };

  const handleSelectGalleryReaction = async (
    galleryId: string,
    reactionType: string,
    existingReaction: string | null
  ) => {
    if (!isViewerApproved) {
      setWarningMessage("Your account is pending approval by King David. Reacting to gallery photos is currently locked.");
      setWarningModalOpen(true);
      return;
    }
    if (!currentUsername || !profile?.username) return;

    if (existingReaction === reactionType) {
      await supabase
        .from("gallery_likes")
        .delete()
        .eq("gallery_id", galleryId)
        .eq("username", currentUsername);
    } else {
      await supabase
        .from("gallery_likes")
        .upsert(
          { gallery_id: galleryId, username: currentUsername, reaction_type: reactionType },
          { onConflict: "gallery_id,username" }
        );
    }

    await fetchGallery(profile.username, currentUsername);
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

  const confirmRemoveMember = () => {
    if (!friendship || actionLoading) return;
    setConfirmModal({
      isOpen: true,
      title: "Remove Friend Confirmation",
      message: `Are you sure you want to remove @${profile.username} from your friends list?`,
      onConfirm: async () => {
        setActionLoading(true);
        const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);
        if (error) {
          alert("Failed to remove friend: " + error.message);
        } else {
          await loadData();
        }
        setActionLoading(false);
      },
    });
  };

  const confirmCancelRequest = () => {
    if (!friendship || actionLoading) return;
    setConfirmModal({
      isOpen: true,
      title: "Cancel Request Confirmation",
      message: `Are you sure you want to cancel your friend request to @${profile.username}?`,
      onConfirm: async () => {
        setActionLoading(true);
        const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);
        if (error) {
          alert("Failed to cancel request: " + error.message);
        } else {
          await loadData();
        }
        setActionLoading(false);
      },
    });
  };

  const confirmRejectRequest = () => {
    if (!friendship || actionLoading) return;
    setConfirmModal({
      isOpen: true,
      title: "Reject Request Confirmation",
      message: `Are you sure you want to reject @${profile.username}'s friend request?`,
      onConfirm: async () => {
        setActionLoading(true);
        const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);
        if (error) {
          alert("Failed to reject request: " + error.message);
        } else {
          await loadData();
        }
        setActionLoading(false);
      },
    });
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

  const executeDeleteUserFull = async (userIdToDelete: string, targetName: string) => {
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
            const pathParts = targetProfile.photo_url.split("/profile-photos/");
            if (pathParts.length > 1) {
              await supabase.storage.from("profile-photos").remove([pathParts[1]]);
            }
          } catch (storageErr) {
            console.error("Storage removal error:", storageErr);
          }
        }

        await supabase
          .from("friendships")
          .delete()
          .or(`sender_username.eq.${uName},receiver_username.eq.${uName}`);

        const { data: userPosts } = await supabase.from("posts").select("id").eq("username", uName);
        if (userPosts && userPosts.length > 0) {
          const pIds = userPosts.map((p) => p.id);
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
    return date
      .toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
  };

  if (loading) {
    return <div className="py-20 text-center text-xs font-semibold text-gray-500">Loading User Profile...</div>;
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-3 max-w-md mx-auto my-12">
        <h2 className="text-base font-bold text-gray-900">User Not Found</h2>
        <p className="text-xs text-gray-500">The requested profile @{targetUsername} does not exist.</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
        >
          ← Return to Dashboard
        </button>
      </div>
    );
  }

  const renderActionButton = () => {
    if (isSelf) return null;
    return isAcceptedFriend ? (
      <button
        disabled={actionLoading}
        onClick={confirmRemoveMember}
        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
      >
        {actionLoading ? "Processing..." : "Remove Friend"}
      </button>
    ) : isSender ? (
      <button
        disabled={actionLoading}
        onClick={confirmCancelRequest}
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
          onClick={confirmRejectRequest}
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
          <button
            onClick={() => router.push("/")}
            className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
          >
            ← Return to Dashboard
          </button>

          {/* Desktop Right Corner Action Button */}
          <div className="hidden sm:block">{renderActionButton()}</div>
        </div>

        {/* Mobile Action Button (Directly above profile picture) */}
        <div className="block sm:hidden flex justify-center pb-1 pt-1">{renderActionButton()}</div>

        {/* Profile Details: Responsive side-by-side on desktop, stacked on mobile */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-2">
          <div className="relative group w-28 h-36 rounded-lg bg-gray-100 border border-gray-300 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="Profile Identity" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400">No Image</span>
            )}

            {isSelf && (
              <label
                className={`absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white text-[10px] font-bold cursor-pointer p-1 text-center ${
                  uploadingAvatar ? "opacity-100" : ""
                }`}
              >
                <span>{uploadingAvatar ? "Updating..." : "📷 Change Photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </label>
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
              <p>
                {getCity(profile.address)}, {getCountry(profile.address)}
              </p>
              <p>{profile.religion || "N/A"}</p>
              <p>{profile.employment_status || "N/A"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">@{profile?.username}&apos;s Gallery</h2>

          {isSelf && (
            <label
              className={`px-4 py-1.5 rounded-lg text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow-sm transition cursor-pointer flex items-center gap-2 ${
                uploadingImage ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <span>{uploadingImage ? "Uploading..." : "+ Upload Image"}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Gallery Grid */}
        <div>
          {galleryImages.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400 font-medium italic border border-dashed border-gray-200 rounded-lg">
              No photos uploaded to this profile gallery yet (Max 50 images per person, compressed automatically).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {galleryImages.map((img) => (
                <div key={img.id} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200 flex flex-col">
                  <div
                    onClick={() => setSelectedGalleryImage(img)}
                    className="relative group bg-black aspect-square flex items-center justify-center cursor-pointer overflow-hidden"
                    title="Click to view full screen"
                  >
                    <img
                      src={img.image_url}
                      alt="Gallery upload"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-bold text-xs">
                      🔍 Click to Expand
                    </div>

                    {/* OVERLAY AT THE VERY BOTTOM OF THE IMAGE ONLY ON OWN PROFILE */}
                    {isSelf && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2.5 flex items-center justify-between text-[11px] text-white">
                        <span className="font-mono opacity-90 truncate max-w-[120px]">By @{img.username}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteImage(img);
                          }}
                          className="bg-rose-600/90 hover:bg-rose-700 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow transition cursor-pointer shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* GALLERY CARD FOOTER */}
                  <div className="p-3 space-y-2.5">
                    {!isSelf && (
                      <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                        <span>By @{img.username}</span>
                        {(isAdmin || img.username.toLowerCase() === currentUsername.toLowerCase()) && (
                          <button
                            onClick={() => confirmDeleteImage(img)}
                            className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}

                    {/* Gallery Reaction Bar */}
                    <div className="bg-white rounded-full px-3 py-1.5 flex items-center justify-between shadow-2xs border border-gray-200">
                      <div className="flex items-center gap-3">
                        {REACTION_CONFIG.map((rc) => {
                          const count = img.likes.filter((l) => l.reaction_type === rc.type).length;
                          const isActive = img.userReaction === rc.type;
                          return (
                            <button
                              key={rc.type}
                              onClick={() => handleSelectGalleryReaction(img.id, rc.type, img.userReaction)}
                              className={`flex items-center gap-1 transition cursor-pointer hover:scale-110 ${
                                isActive
                                  ? "opacity-100 scale-105 font-bold text-rose-600"
                                  : "opacity-40 grayscale hover:grayscale-0 hover:opacity-90 text-gray-700"
                              }`}
                              title={rc.label}
                            >
                              <span className="text-base">{rc.emoji}</span>
                              <span className="font-mono text-xs">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                      {img.userReaction && <span className="text-[10px] text-gray-400">Reacted</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LIGHTBOX MODAL FOR FULL SCREEN GALLERY VIEW */}
      {selectedGalleryImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-2 sm:p-6">
          <button
            onClick={() => setSelectedGalleryImage(null)}
            className="absolute top-4 right-4 bg-white/15 hover:bg-white/25 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black transition cursor-pointer z-[210] shadow-xl"
            title="Close"
          >
            ✕
          </button>

          <div className="relative max-w-full max-h-full flex flex-col items-center justify-center">
            <img
              src={selectedGalleryImage.image_url}
              alt="Full size gallery view"
              className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-3 text-white text-xs font-mono tracking-wide opacity-80">
              Uploaded by @{selectedGalleryImage.username}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL FOR FULL SCREEN POST IMAGE VIEW */}
      {selectedPostImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-2 sm:p-6">
          <button
            onClick={() => setSelectedPostImage(null)}
            className="absolute top-4 right-4 bg-white/15 hover:bg-white/25 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black transition cursor-pointer z-[210] shadow-xl"
            title="Close"
          >
            ✕
          </button>

          <div className="relative max-w-full max-h-full flex flex-col items-center justify-center">
            <img
              src={selectedPostImage}
              alt="Full size thought attachment view"
              className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        <h2 className="text-sm font-bold text-gray-900">@{profile.username}&apos;s thoughts</h2>

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

            {newPostImagePreview && (
              <div className="relative w-28 h-28 rounded-lg overflow-hidden border border-gray-300 bg-black">
                <img src={newPostImagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setNewPostImageFile(null);
                    setNewPostImagePreview(null);
                  }}
                  className="absolute top-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer hover:bg-rose-600"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 shadow-2xs transition cursor-pointer flex items-center gap-1.5">
                <span>📷 Attach Image (Max 10MB)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePostImageSelect}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={posting || (!newPostContent.trim() && !newPostImageFile)}
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

                    {(currentUsername.toLowerCase() === "kingdavid" ||
                      post.username.toLowerCase() === currentUsername.toLowerCase()) && (
                      <button
                        onClick={() => confirmDeletePost(post)}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded transition cursor-pointer shadow-2xs"
                        title="Delete thought"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {post.content && (
                    <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed px-1">
                      {post.content}
                    </p>
                  )}

                  {post.image_url && (
                    <div
                      onClick={() => setSelectedPostImage(post.image_url)}
                      className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 max-h-96 flex items-center justify-center cursor-pointer group relative"
                      title="Click to view full screen"
                    >
                      <img
                        src={post.image_url}
                        alt="Thought attachment"
                        className="max-h-96 w-auto object-contain"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-bold text-xs">
                        🔍 Click to Expand
                      </div>
                    </div>
                  )}

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
                              isActive
                                ? "opacity-100 scale-105 font-bold text-rose-600"
                                : "opacity-40 grayscale hover:grayscale-0 hover:opacity-90 text-gray-700"
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
                      <span className="text-gray-500 font-normal ml-3">You Reacted</span>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    {post.comments.length > 0 && (
                      <div className="space-y-2 pl-2 sm:pl-4 border-l-2 border-gray-200">
                        {visibleComments.map((comment) => (
                          <div key={comment.id} className="text-xs bg-gray-50 p-2.5 rounded-lg space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="space-y-0.5">
                                <span className="font-bold text-gray-900">@{comment.username}</span>
                                <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                                <span className="text-[9px] text-gray-400 font-mono">
                                  {formatTimestamp(comment.created_at)}
                                </span>
                              </div>

                              {(currentUsername.toLowerCase() === "kingdavid" ||
                                comment.username.toLowerCase() === currentUsername.toLowerCase()) && (
                                <button
                                  onClick={() => confirmDeleteComment(comment.id)}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded transition cursor-pointer shrink-0 ml-2"
                                  title="Delete comment"
                                >
                                  Delete
                                </button>
                              )}
                            </div>

                            {/* Comment Reaction Bar */}
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200/60">
                              <div className="bg-white rounded-full px-3 py-1 flex items-center gap-3 shadow-2xs border border-gray-200">
                                {REACTION_CONFIG.map((rc) => {
                                  const count = comment.likes.filter((l) => l.reaction_type === rc.type).length;
                                  const isActive = comment.userReaction === rc.type;
                                  return (
                                    <button
                                      key={rc.type}
                                      onClick={() =>
                                        handleSelectCommentReaction(comment.id, rc.type, comment.userReaction)
                                      }
                                      className={`flex items-center gap-1 transition cursor-pointer hover:scale-110 ${
                                        isActive
                                          ? "opacity-100 scale-105 font-bold text-rose-600"
                                          : "opacity-40 grayscale hover:grayscale-0 hover:opacity-90 text-gray-700"
                                      }`}
                                      title={rc.label}
                                    >
                                      <span className="text-sm">{rc.emoji}</span>
                                      <span className="font-mono text-[10px]">{count}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {comment.userReaction && (
                                <span className="text-gray-400 text-[10px]">You reacted</span>
                              )}
                            </div>
                          </div>
                        ))}

                        {post.comments.length > 3 && (
                          <button
                            onClick={() => toggleExpandComments(post.id)}
                            className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer pt-1 block"
                          >
                            {isExpanded
                              ? "Show fewer comments"
                              : `View more comments (${remainingCount} more)`}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Add Comment Form */}
                    <form onSubmit={(e) => handleAddComment(post.id, e)} className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={commentInputs[post.id] || ""}
                        onChange={(e) =>
                          setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                        }
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden transition-all text-left">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">
                Signup Info: {adminModalProfile.first_name} {adminModalProfile.last_name}
              </h3>
              <button
                onClick={() => setAdminModalProfile(null)}
                className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833]" />

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
                  <p>
                    <span className="font-bold text-gray-400 uppercase text-[10px]">Full Name:</span>{" "}
                    {adminModalProfile.first_name} {adminModalProfile.last_name}
                  </p>
                  <p>
                    <span className="font-bold text-gray-400 uppercase text-[10px]">Username:</span> @
                    {adminModalProfile.username}
                  </p>
                  <p>
                    <span className="font-bold text-gray-400 uppercase text-[10px]">Email:</span>{" "}
                    {adminModalProfile.email}
                  </p>
                  <p>
                    <span className="font-bold text-gray-400 uppercase text-[10px]">Mobile Phone:</span>{" "}
                    {adminModalProfile.mobile_phone || "N/A"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
                <div>
                  <span className="font-bold text-gray-400 uppercase text-[10px] block">Date of Birth:</span>{" "}
                  {adminModalProfile.dob} ({calculateAge(adminModalProfile.dob)})
                </div>
                <div>
                  <span className="font-bold text-gray-400 uppercase text-[10px] block">Gender:</span>{" "}
                  {adminModalProfile.gender || "N/A"}
                </div>
                <div>
                  <span className="font-bold text-gray-400 uppercase text-[10px] block">Religion:</span>{" "}
                  {adminModalProfile.religion || "N/A"}
                </div>
                <div>
                  <span className="font-bold text-gray-400 uppercase text-[10px] block">Employment:</span>{" "}
                  {adminModalProfile.employment_status || "N/A"}
                </div>
                <div>
                  <span className="font-bold text-gray-400 uppercase text-[10px] block">Approval Status:</span>{" "}
                  {adminModalProfile.is_approved ? "Approved" : "Pending Review"}
                </div>
              </div>

              <div className="text-xs text-gray-700 pt-2 border-t border-gray-100">
                <span className="font-bold text-gray-400 uppercase text-[10px] block">Residential Address:</span>
                <span className="font-medium text-gray-900">{adminModalProfile.address}</span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-100 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const profToDel = adminModalProfile;
                    setAdminModalProfile(null);
                    setConfirmModal({
                      isOpen: true,
                      title: "Delete User Confirmation",
                      message: `Are you sure you want to completely delete @${profToDel.username}? This will reset all profile, wall, and account data entirely while preserving transaction records.`,
                      onConfirm: async () => {
                        await executeDeleteUserFull(profToDel.user_id, profToDel.username);
                      },
                    });
                  }}
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#800000] hover:bg-[#660000] text-white shadow transition cursor-pointer"
                >
                  DELETE USER
                </button>
                <button
                  type="button"
                  onClick={() => setAdminModalProfile(null)}
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden transition-all text-left">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">Account Pending Approval</h3>
              <button
                onClick={() => setWarningModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833]" />

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-700 font-medium leading-relaxed">{warningMessage}</p>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setWarningModalOpen(false)}
                  className="w-full py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow transition cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED CONFIRMATION MODAL MATCHING SIGN OUT DESIGN */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[250]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden text-left">
            <div className="bg-[#000000] text-white p-4 flex justify-between items-center font-bold">
              <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="h-1 bg-[#e7b833]" />
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-700 font-medium leading-relaxed">{confirmModal.message}</p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                  className="w-1/2 py-2 rounded text-xs font-semibold border border-gray-300 hover:bg-gray-100 cursor-pointer text-gray-700"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = confirmModal.onConfirm;
                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                    if (action) await action();
                  }}
                  className="w-1/2 py-2 rounded text-xs font-bold bg-[#e7b833] hover:bg-[#d4a52b] text-gray-900 shadow cursor-pointer"
                >
                  Yes
                </button>
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