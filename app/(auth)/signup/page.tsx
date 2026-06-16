"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMsg(""); setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.session) { router.push("/"); router.refresh(); }
    else setMsg("สมัครสำเร็จ! เช็คอีเมลเพื่อยืนยัน แล้วกลับมา login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm p-7">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">⚡</div>
          <h1 className="text-lg font-semibold">สมัครสมาชิก</h1>
        </div>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="label">ชื่อ</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="ชื่อของคุณ" />
          </div>
          <div>
            <label className="label">อีเมล</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" />
          </div>
          <div>
            <label className="label">รหัสผ่าน</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="อย่างน้อย 6 ตัว" />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          {msg && <div className="text-sm text-green-400">{msg}</div>}
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>
        </form>
        <p className="text-sm text-gray-400 text-center mt-5">
          มีบัญชีแล้ว? <Link href="/login" className="text-brand hover:underline">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}
