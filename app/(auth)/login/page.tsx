"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm p-7">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">⚡</div>
          <h1 className="text-lg font-semibold">เข้าสู่ระบบ WorkPlannerPro</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="label">อีเมล</label>
            <input className="input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" />
          </div>
          <div>
            <label className="label">รหัสผ่าน</label>
            <input className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
        <p className="text-sm text-gray-400 text-center mt-5">
          ยังไม่มีบัญชี? <Link href="/signup" className="text-brand hover:underline">สมัครสมาชิก</Link>
        </p>
      </div>
    </div>
  );
}
