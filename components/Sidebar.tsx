"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);          // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop rail

  useEffect(() => { try { if (localStorage.getItem("mysthron-rail") === "1") setCollapsed(true); } catch {} }, []);
  function toggleRail() {
    setCollapsed((c) => { const n = !c; try { localStorage.setItem("mysthron-rail", n ? "1" : "0"); } catch {} return n; });
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const hideOnRail = collapsed ? "md:hidden" : "";

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

      <aside className={`fixed md:sticky top-0 z-50 md:z-auto w-64 ${collapsed ? "md:w-[70px]" : "md:w-56"} shrink-0 bg-bg-1 border-r border-line flex flex-col h-screen transition-all duration-200 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className={`px-3 py-4 flex items-center gap-2 border-b border-line ${collapsed ? "md:justify-center" : ""}`}>
          <button className="hidden md:block text-xl text-gray-400 hover:text-gray-100 shrink-0" onClick={toggleRail} aria-label="ย่อ/ขยายเมนู" title="ย่อ/ขยายเมนู">☰</button>
          <img src="/logo.svg" alt="Mysthron" className={`w-7 h-7 shrink-0 ${collapsed ? "md:hidden" : ""}`} />
          <span className={`font-semibold flex-1 ${hideOnRail}`}>Mysthron</span>
          <button className="md:hidden text-xl text-gray-400" onClick={() => setOpen(false)} aria-label="ปิด">✕</button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {MODULES.map((m) => {
            const active = m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
            return (
              <Link key={m.href} href={m.href} onClick={() => setOpen(false)} title={m.label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${collapsed ? "md:justify-center md:px-0" : ""}
                  ${active ? "bg-brand/15 text-brand font-medium" : "text-gray-300 hover:bg-bg-3"}`}>
                <span className="text-base shrink-0">{m.icon}</span>
                <span className={hideOnRail}>{m.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-line">
          <div className={`px-3 py-2 text-sm text-gray-400 truncate ${hideOnRail}`}>👤 {displayName}</div>
          <button onClick={logout} className="btn w-full text-sm" title="ออกจากระบบ">
            <span className={hideOnRail}>ออกจากระบบ</span>
            <span className={collapsed ? "hidden md:inline" : "hidden"}>⏻</span>
          </button>
        </div>
      </aside>
    </>
  );
}
