"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  dob: string;
  address: string;
  email: string;
  mobile_phone: string | null;
  gender: string | null;
  religion: string | null;
  employment_status: string | null;
  photo_url: string | null;
  is_approved: boolean;
}

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", session.user.id)
      .single();

    if (!profile || profile.username.toLowerCase() !== "kingdavid") {
      setError("Access Denied. Authorized KingDavid administrative clearance required.");
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);
    await fetchPendingApplications();
    setLoading(false);
  };

  const fetchPendingApplications = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_approved", false)
      .order("first_name", { ascending: true });

    if (error) {
      setError("Failed to load pending applications: " + error.message);
    } else {
      setPendingUsers(data || []);
    }
  };

  const handleApprove = async (userId: string) => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: true, session_start_timestamp: nowIso })
      .eq("user_id", userId);

    if (error) {
      alert("Error approving account: " + error.message);
    } else {
      setPendingUsers(pendingUsers.filter(u => u.user_id !== userId));
      alert("Account successfully approved and session timer initialized!");
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm("Are you sure you want to reject and delete this application?")) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", userId);

    if (error) {
      alert("Error rejecting account: " + error.message);
    } else {
      setPendingUsers(pendingUsers.filter(u => u.user_id !== userId));
      alert("Application rejected and removed.");
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
        Verifying Administrative Clearance...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto text-center space-y-4 my-12">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto font-bold text-lg">!</div>
        <h1 className="text-lg font-black text-gray-900 uppercase">Unauthorized Access</h1>
        <p className="text-xs text-gray-500">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Applications Queue */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">
            Pending Applications ({pendingUsers.length})
          </h2>
          <button
            onClick={fetchPendingApplications}
            className="text-xs text-blue-600 font-bold hover:underline cursor-pointer uppercase tracking-wider"
          >
            🔄 Refresh Queue
          </button>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No pending applications in queue</p>
            <p className="text-[11px] text-gray-500">All new member applications have been processed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingUsers.map((user) => (
              <div key={user.id} className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50/50 hover:shadow-md transition">
                
                <div className="flex items-center gap-4 border-b border-gray-200/60 pb-4">
                  <div className="w-16 h-20 rounded-lg bg-gray-200 border border-gray-300 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
                    {user.photo_url ? (
                      <img src={user.photo_url} alt="Profile Identity" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-gray-400">No Img</span>
                    )}
                  </div>
                  <div className="flex-1 flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase">
                        {user.first_name} {user.last_name}
                      </h3>
                      <p className="text-xs font-mono text-blue-600 font-bold">@{user.username}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-full tracking-wider">
                      Pending Review
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-2 text-xs text-gray-700">
                  <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Email:</span> {user.email}</div>
                  <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Mobile:</span> {user.mobile_phone || "N/A"}</div>
                  <div><span className="font-bold text-gray-400 uppercase text-[10px] block">DOB:</span> {user.dob}</div>
                  <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Gender:</span> {user.gender || "N/A"}</div>
                  <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Religion:</span> {user.religion || "N/A"}</div>
                  <div><span className="font-bold text-gray-400 uppercase text-[10px] block">Employment:</span> {user.employment_status || "N/A"}</div>
                </div>

                <div className="text-xs text-gray-700 pt-1 border-t border-gray-200/60">
                  <span className="font-bold text-gray-400 uppercase text-[10px] block">Residential Address:</span>
                  <span className="font-medium text-gray-900">{user.address}</span>
                </div>

                <div className="flex gap-3 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => handleApprove(user.user_id)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow transition cursor-pointer"
                  >
                    ✓ Approve Account
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(user.user_id)}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider shadow transition cursor-pointer"
                  >
                    ✕ Reject & Delete
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}