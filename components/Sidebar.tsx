"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MODULES = [
  { href: "/", icon: "🏠", label: "ภาพรวม" },
  { href: "/projects", icon: "🏗️", label: "โครงการ" },
  { href: "/personal", icon: "☀️", label: "ส่วนตัว" },
  { href: "/trading", icon: "📈", label: "เทรด" },
  { href: "/life", icon: "📊", label: "Life Log" },
];

export default function Sidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-56 shrink-0 bg-bg-1 border-r border-line flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 flex items-center gap-2 border-b border-line">
        <span className="text-xl">⚡</span>
        <span className="font-semibold">WorkPlannerPro</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {MODULES.map((m) => {
          const active = m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
          return (
            <Link key={m.href} href={m.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition
                ${active ? "bg-brand/15 text-brand font-medium" : "text-gray-300 hover:bg-bg-3"}`}>
              <span className="text-base">{m.icon}</span>{m.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-line">
        <div className="px-3 py-2 text-sm text-gray-400 truncate">👤 {displayName}</div>
        <button onClick={logout} className="btn w-full text-sm">ออกจากระบบ</button>
      </div>
    </aside>
  );
}
