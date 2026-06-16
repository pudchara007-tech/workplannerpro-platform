"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-bg-1 border-b border-line">
        <button onClick={() => setOpen(true)} aria-label="เมนู" className="text-2xl leading-none">☰</button>
        <img src="/logo.svg" alt="Mysthron" className="w-7 h-7" />
        <span className="font-semibold">Mysthron</span>
      </div>

      {/* Mobile overlay */}
      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />}

      {/* Sidebar (off-canvas on mobile, static on desktop) */}
      <aside className={`fixed md:sticky top-0 z-50 md:z-auto w-64 md:w-56 shrink-0 bg-bg-1 border-r border-line flex flex-col h-screen transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="px-4 py-4 flex items-center gap-2 border-b border-line">
          <img src="/logo.svg" alt="Mysthron" className="w-8 h-8" />
          <span className="font-semibold flex-1">Mysthron</span>
          <button className="md:hidden text-xl text-gray-400" onClick={() => setOpen(false)} aria-label="ปิด">✕</button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {MODULES.map((m) => {
            const active = m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
            return (
              <Link key={m.href} href={m.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
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
    </>
  );
}
