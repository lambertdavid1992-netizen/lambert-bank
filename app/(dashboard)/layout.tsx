"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, usePathname } from "next/navigation";
import Navbar, { Sidebar } from "@/components/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isStreamingPage = pathname?.includes("/streaming");

  const supabase = createBrowserClient(
    "https://bucijzexpxsuxvsnwwyu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Y2lqemV4cHhzdXh2c253d3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzM2NjAsImV4cCI6MjEwNDUwOTY2MH0.Gr34yXf6UDlZq54nEKZAvaUCnfXla26LoVSH3YY5u1M"
  );

  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      if (session.user.email?.toLowerCase() === "lambertdavid1992@gmail.com") {
        setCurrentUsername("KingDavid");
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", session.user.id)
          .single();
        if (profile) setCurrentUsername(profile.username);
      }
    }
    getUser();
  }, [router, supabase]);

  if (!mounted || !currentUsername) return null;

  // If the user is on the streaming page, render children raw without the dashboard shell/sidebar/navbar
  if (isStreamingPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#222222] font-sans antialiased">
      <Navbar currentUsername={currentUsername} />
      <div className="max-w-6xl mx-auto p-3 sm:p-6 flex flex-row gap-4 items-start w-full box-border">
        <Sidebar currentUsername={currentUsername} />
        <main className="flex-1 min-w-0 space-y-4">{children}</main>
      </div>
    </div>
  );
}