"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

interface Artwork {
  id: string;
  title: string;
  artist: string;
  price_cents: number;
  watermarked_image_url: string;
  unmarked_image_url: string;
  description: string;
  is_sold: boolean;
  owner_username: string | null;
  created_at: string;
}

export default function GalleryPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"market" | "collection">("market");
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [inspectArt, setInspectArt] = useState<Artwork | null>(null);

  const [title, setTitle] = useState<string>("");
  const [artist, setArtist] = useState<string>("");
  const [priceDollar, setPriceDollar] = useState<string>("150.00");
  const [watermarkedFile, setWatermarkedFile] = useState<File | null>(null);
  const [unmarkedFile, setUnmarkedFile] = useState<File | null>(null);
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const fetchArtworks = useCallback(async () => {
    const { data, error } = await supabase
      .from("artworks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setArtworks(data);
    }
  }, [supabase]);

  useEffect(() => {
    async function initGallery() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const email = session.user.email || "";
      if (email.toLowerCase() === "lambertdavid1992@gmail.com") {
        setCurrentUsername("KingDavid");
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", session.user.id)
          .single();

        if (profile) {
          setCurrentUsername(profile.username);
        }
      }

      await fetchArtworks();
      setLoading(false);
    }

    initGallery();
  }, [router, supabase, fetchArtworks]);

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const uploadFileToStorage = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("artworks")
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from("artworks").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleUploadArtwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUsername !== "KingDavid") {
      return alert("Unauthorized: Only KingDavid (Administrator) can upload new artworks.");
    }

    if (!watermarkedFile || !unmarkedFile) {
      return alert("Please select both watermarked and unmarked image files.");
    }

    const parsedPrice = parseFloat(priceDollar);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return alert("Please enter a valid price.");
    }

    const priceCents = Math.round(parsedPrice * 100);

    try {
      setSubmitting(true);
      setUploadProgress("Uploading watermarked image...");
      const watermarkedUrl = await uploadFileToStorage(watermarkedFile, "watermarked");

      setUploadProgress("Uploading unmarked image...");
      const unmarkedUrl = await uploadFileToStorage(unmarkedFile, "unmarked");

      setUploadProgress("Saving artwork record...");
      const { error } = await supabase.from("artworks").insert({
        title: title.trim(),
        artist: artist.trim(),
        price_cents: priceCents,
        watermarked_image_url: watermarkedUrl,
        unmarked_image_url: unmarkedUrl,
        description: description.trim(),
        is_sold: false,
        owner_username: null,
      });

      if (error) throw error;

      alert("Artwork securely uploaded and listed in Gallery!");
      setTitle("");
      setArtist("");
      setPriceDollar("150.00");
      setWatermarkedFile(null);
      setUnmarkedFile(null);
      setDescription("");
      setShowUploadModal(false);
      await fetchArtworks();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  };

  const handleAcquireAsset = async (art: Artwork) => {
    if (confirm(`Acquire "${art.title}" for ${formatCurrency(art.price_cents)}? This will remove it from the Public Gallery and credit the unmarked asset exclusively to your collection.`)) {
      const { error } = await supabase
        .from("artworks")
        .update({ is_sold: true, owner_username: currentUsername })
        .eq("id", art.id);

      if (error) {
        alert("Acquisition failed: " + error.message);
      } else {
        alert(`Successfully acquired! "${art.title}" has been moved to your personal collection.`);
        setInspectArt(null);
        await fetchArtworks();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <p className="text-sm font-semibold text-gray-500">Loading Gallery...</p>
      </div>
    );
  }

  const publicArtworks = artworks.filter(a => !a.is_sold);
  const myCollection = artworks.filter(a => a.is_sold && a.owner_username?.toLowerCase() === currentUsername.toLowerCase());

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#222222] font-sans antialiased">
      <Navbar currentUsername={currentUsername} />

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight">Gallery & Collections</h1>
            <p className="text-xs text-gray-500 mt-0.5">Explore public watermarked artworks for acquisition or view your private unmarked collections.</p>
          </div>

          {currentUsername === "KingDavid" && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow transition cursor-pointer flex items-center gap-2"
            >
              <span>➕ Upload Artwork</span>
            </button>
          )}
        </div>

        <div className="flex gap-2 border-b border-gray-200 pb-3">
          <button
            onClick={() => setActiveTab("market")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "market"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            Public Gallery Marketplace ({publicArtworks.length})
          </button>
          <button
            onClick={() => setActiveTab("collection")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "collection"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            My Collection ({myCollection.length})
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {activeTab === "market" && publicArtworks.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-400 text-xs">
              No artworks currently available in the public gallery.
            </div>
          )}

          {activeTab === "collection" && myCollection.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-400 text-xs">
              Your collection is empty. Acquire artworks from the Public Gallery to populate your portfolio.
            </div>
          )}

          {activeTab === "market" && publicArtworks.map((art) => (
            <div
              key={art.id}
              onClick={() => setInspectArt(art)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between group hover:shadow-md transition cursor-pointer"
            >
              <div>
                <div className="h-48 overflow-hidden bg-gray-100 relative">
                  <img
                    src={art.watermarked_image_url}
                    alt={art.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none">
                    <span className="text-white/40 font-black text-2xl tracking-widest uppercase rotate-[-20deg] select-none border-4 border-white/30 px-4 py-1">
                      WATERMARKED
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-xs font-mono font-bold text-emerald-700 shadow-xs">
                    {formatCurrency(art.price_cents)}
                  </div>
                </div>

                <div className="p-4 space-y-1">
                  <h3 className="text-sm font-bold text-gray-900">{art.title}</h3>
                  <p className="text-xs text-blue-600 font-semibold">Artist: {art.artist}</p>
                  <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">{art.description}</p>
                </div>
              </div>

              <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400">
                <span>Status: Available</span>
                <span className="text-blue-600 font-bold hover:underline">View & Acquire ↗</span>
              </div>
            </div>
          ))}

          {activeTab === "collection" && myCollection.map((art) => (
            <div
              key={art.id}
              onClick={() => setInspectArt(art)}
              className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden flex flex-col justify-between group hover:shadow-md transition cursor-pointer"
            >
              <div>
                <div className="h-48 overflow-hidden bg-gray-100 relative">
                  <img
                    src={art.unmarked_image_url}
                    alt={art.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white px-2.5 py-1 rounded-md text-[10px] font-bold shadow-xs uppercase tracking-wider">
                    Unmarked / Exclusive
                  </div>
                </div>

                <div className="p-4 space-y-1">
                  <h3 className="text-sm font-bold text-gray-900">{art.title}</h3>
                  <p className="text-xs text-emerald-700 font-semibold">Artist: {art.artist}</p>
                  <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">{art.description}</p>
                </div>
              </div>

              <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex justify-between items-center text-[10px] text-emerald-600 font-semibold">
                <span>Owned by @{currentUsername}</span>
                <span>Inspect Asset ↗</span>
              </div>
            </div>
          ))}
        </div>

        {inspectArt && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{inspectArt.title}</h3>
                  <p className="text-xs text-blue-600 font-semibold">Artist: {inspectArt.artist}</p>
                </div>
                <button
                  onClick={() => setInspectArt(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="h-64 rounded-lg overflow-hidden bg-gray-100 relative">
                <img
                  src={
                    inspectArt.is_sold && inspectArt.owner_username?.toLowerCase() === currentUsername.toLowerCase()
                      ? inspectArt.unmarked_image_url
                      : inspectArt.watermarked_image_url
                  }
                  alt={inspectArt.title}
                  className="w-full h-full object-cover"
                />
                {!inspectArt.is_sold && (
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none">
                    <span className="text-white/40 font-black text-3xl tracking-widest uppercase rotate-[-20deg] select-none border-4 border-white/30 px-6 py-2">
                      WATERMARKED
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3.5 space-y-2 text-xs">
                <div className="flex justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Acquisition Price</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">{formatCurrency(inspectArt.price_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Asset Status</span>
                  <span className="font-semibold text-gray-800">
                    {inspectArt.is_sold ? `Owned by @${inspectArt.owner_username}` : "Available in Public Gallery"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5 font-semibold">Description:</span>
                  <p className="text-gray-700">{inspectArt.description || "No description provided."}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInspectArt(null)}
                  className="w-1/2 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer"
                >
                  Close
                </button>
                {!inspectArt.is_sold ? (
                  <button
                    type="button"
                    onClick={() => handleAcquireAsset(inspectArt)}
                    className="w-1/2 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition cursor-pointer"
                  >
                    Acquire Asset ({formatCurrency(inspectArt.price_cents)})
                  </button>
                ) : (
                  <div className="w-1/2 py-2.5 rounded-lg text-sm font-bold bg-gray-100 text-gray-500 text-center flex items-center justify-center">
                    Already Acquired
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-900">👑 Upload Artwork for Sale</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUploadArtwork} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Artwork Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Neon Cyberpunk City"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Artist Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KingDavid Studio"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Sale Price ($ AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 font-semibold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1.00"
                      required
                      value={priceDollar}
                      onChange={(e) => setPriceDollar(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded text-sm text-black font-mono focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Watermarked Image File (Public View)</label>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setWatermarkedFile(e.target.files?.[0] || null)}
                    className="w-full border border-gray-300 rounded p-1.5 text-xs text-black bg-white focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Unmarked Image File (Exclusive Collection View)</label>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setUnmarkedFile(e.target.files?.[0] || null)}
                    className="w-full border border-gray-300 rounded p-1.5 text-xs text-black bg-white focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Artwork background or generation details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:border-blue-600 resize-none"
                  />
                </div>

                {uploadProgress && (
                  <p className="text-blue-600 font-semibold animate-pulse">{uploadProgress}</p>
                )}

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="w-1/2 py-2.5 rounded font-semibold border border-gray-300 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-1/2 py-2.5 rounded font-bold bg-blue-600 hover:bg-blue-700 text-white shadow transition cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Uploading..." : "Publish to Gallery"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}