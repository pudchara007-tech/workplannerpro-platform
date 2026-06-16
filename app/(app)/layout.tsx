import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("display_name").eq("id", user.id).single();
  const displayName = profile?.display_name || user.email?.split("@")[0] || "ผู้ใช้";

  return (
    <div className="flex min-h-screen">
      <Sidebar displayName={displayName} />
      <main className="flex-1 min-w-0 p-6 md:p-8">{children}</main>
    </div>
  );
}
