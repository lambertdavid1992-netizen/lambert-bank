"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function UserProfilePage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [profile, setProfile] = useState<any>(null);
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfileData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setSessionEmail(session.user.email || "");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (data) {
        setProfile(data);
      } else {
        if (session.user.email?.toLowerCase() === "lambertdavid1992@gmail.com") {
          const { data: adminData } = await supabase
            .from("profiles")
            .select("*")
            .eq("username", "KingDavid")
            .single();
          if (adminData) {
            setProfile(adminData);
          }
        }
      }
      setLoading(false);
    }

    loadProfileData();
  }, [router, supabase]);

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

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-semibold text-gray-500">
        Loading User Profile...
      </div>
    );
  }

  const isApproved = Boolean(profile?.is_approved);

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
              <p className="text-[11px] text-amber-700">Your profile is currently under review by KingDavid. You are hidden from the public Members directory until approved.</p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Information Content Container */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 uppercase">User Signup Information</h2>
            <p className="text-xs text-gray-500">Details provided during account registration.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-gray-100 pb-6">
          <div className="w-28 h-36 rounded-lg bg-gray-100 border border-gray-300 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="Profile Identity" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400">No Image</span>
            )}
          </div>

          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-black uppercase tracking-wide text-gray-900">
              {profile?.first_name || "Account"} {profile?.last_name || ""}
            </h3>
            <p className="text-xs font-mono text-blue-600 font-bold">Payment ID: @{profile?.username}</p>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase mt-2 ${
              isApproved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}>
              {isApproved ? "Verified Active Member" : "Pending Approval"}
            </span>
          </div>
        </div>

        {/* Signup Info Data Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-gray-50 p-5 rounded-xl border border-gray-200">
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Legal First Name:</span>
            <span className="font-semibold text-gray-900">{profile?.first_name || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Legal Last Name:</span>
            <span className="font-semibold text-gray-900">{profile?.last_name || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Username (Payment ID):</span>
            <span className="font-semibold text-gray-900">{profile?.username || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Date of Birth:</span>
            <span className="font-semibold text-gray-900">{profile?.dob || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Gender:</span>
            <span className="font-semibold text-gray-900">{profile?.gender || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Religion:</span>
            <span className="font-semibold text-gray-900">{profile?.religion || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Employment Status:</span>
            <span className="font-semibold text-gray-900">{profile?.employment_status || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Mobile Phone:</span>
            <span className="font-semibold text-gray-900">{profile?.mobile_phone || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Country:</span>
            <span className="font-semibold text-gray-900">{getCountry(profile?.address)}</span>
          </div>
          <div>
            <span className="font-bold text-gray-400 uppercase text-[10px] block">City:</span>
            <span className="font-semibold text-gray-900">{getCity(profile?.address)}</span>
          </div>
          <div className="col-span-1 sm:col-span-2 pt-2 border-t border-gray-200">
            <span className="font-bold text-gray-400 uppercase text-[10px] block">Email Address:</span>
            <span className="font-semibold text-gray-900">{profile?.email || sessionEmail}</span>
          </div>
        </div>
      </div>
    </div>
  );
}