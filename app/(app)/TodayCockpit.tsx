"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Habit = { id: string; name: string; icon: string };
type Goal = { id: string; title: string; target_value: number | null; current_value: number; unit: string | null };

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default function TodayCockpit() {
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, Set<string>>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [focus, setFocus] = useState("");
  const [focusSaved, setFocusSaved] = useState(true);
  const [checkin, setCheckin] = useState({ sleep: 7, mood: 3, energy: 3 });
  const [loaded, setLoaded] = useState(false);

  const today = ymd(new Date());
  const now = new Date();
  const dateLabel = `${THAI_DAYS[now.getDay()]} ${now.getDate()} ${THAI_MONTHS[now.getMonth()]}`;

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUid(user.id);
    const since = new Date(); since.setDate(since.getDate() - 90);
    const [{ data: hs }, { data: hl }, { data: gs }, { data: ll }] = await Promise.all([
      supabase.from("habits").select("id,name,icon").eq("archived", false).order("sort_order"),
      supabase.from("habit_logs").select("habit_id,log_date,done").gte("log_date", ymd(since)),
      supabase.from("goals").select("id,title,target_value,current_value,unit").neq("status", "done").order("sort_order").limit(3),
      supabase.from("life_log").select("metric,value,note").eq("log_date", today),
    ]);
    setHabits((hs as Habit[]) || []);
    const map: Record<string, Set<string>> = {};
    ((hl as any[]) || []).forEach((r) => { if (r.done) (map[r.habit_id] = map[r.habit_id] || new Set()).add(r.log_date); });
    setLogs(map);
    setGoals((gs as Goal[]) || []);
    const ci = { sleep: 7, mood: 3, energy: 3 };
    ((ll as any[]) || []).forEach((r) => {
      if (r.metric === "sleep") ci.sleep = Number(r.value);
      if (r.metric === "mood") ci.mood = Number(r.value);
      if (r.metric === "energy") ci.energy = Number(r.value);
      if (r.metric === "_focus") setFocus(r.note || "");
    });
    setCheckin(ci);
    setLoaded(true);
  }, [supabase, today]);

  useEffect(() => { load(); }, [load]);

  function streak(id: string) {
    const set = logs[id]; if (!set) return 0;
    let n = 0; const d = new Date();
    while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const doneToday = (id: string) => logs[id]?.has(today) ?? false;

  async function toggleHabit(id: string) {
    if (!uid) return;
    const on = doneToday(id);
    setLogs((prev) => { const next = { ...prev }; const s = new Set(next[id] || []); on ? s.delete(today) : s.add(today); next[id] = s; return next; });
    if (on) await supabase.from("habit_logs").delete().eq("habit_id", id).eq("log_date", today);
    else await supabase.from("habit_logs").insert({ habit_id: id, user_id: uid, log_date: today, done: true });
  }

  async function saveCheckin(next: typeof checkin) {
    if (!uid) return;
    const rows = [
      { user_id: uid, log_date: today, domain: "health", metric: "sleep", value: next.sleep, unit: "ชม." },
      { user_id: uid, log_date: today, domain: "mind", metric: "mood", value: next.mood, unit: "/5" },
      { user_id: uid, log_date: today, domain: "mind", metric: "energy", value: next.energy, unit: "/5" },
    ];
    for (const r of rows) await supabase.from("life_log").upsert(r, { onConflict: "user_id,log_date,metric" });
  }
  function setCI(k: keyof typeof checkin, v: number) {
    const next = { ...checkin, [k]: v }; setCheckin(next);
  }

  async function saveFocus() {
    if (!uid) return;
    await supabase.from("life_log").upsert(
      { user_id: uid, log_date: today, domain: "mind", metric: "_focus", note: focus },
      { onConflict: "user_id,log_date,metric" }
    );
    setFocusSaved(true);
  }

  const score = useMemo(() => {
    const hp = habits.length ? (habits.filter((h) => doneToday(h.id)).length / habits.length) * 40 : 0;
    const sp = Math.min(checkin.sleep / 8, 1) * 20;
    const mp = (checkin.mood / 5) * 20;
    const ep = (checkin.energy / 5) * 20;
    return Math.round(hp + sp + mp + ep);
  }, [habits, logs, checkin, today]);

  if (!loaded) return <div className="text-gray-500 text-sm">กำลังโหลด...</div>;

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">วันนี้ · {dateLabel}</div>
          <div className="text-sm text-gray-400">ภาพรวมของวัน รวมทุกอย่างในที่เดียว</div>
        </div>
        <div className="text-center bg-bg-2 rounded-xl px-4 py-2.5 min-w-[96px]">
          <div className="text-xs text-gray-400">คะแนนวันนี้</div>
          <div className="text-3xl font-medium font-mono">{score}</div>
        </div>
      </div>

      {/* FOCUS */}
      <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: "rgba(59,130,246,0.12)" }}>
        <i className="ti ti-target-arrow text-xl text-brand" />
        <div className="flex-1">
          <div className="text-xs text-brand mb-1">โฟกัสเดียวของวันนี้</div>
          <input className="input" placeholder="วันนี้จะโฟกัสอะไร?" value={focus}
            onChange={(e) => { setFocus(e.target.value); setFocusSaved(false); }}
            onBlur={saveFocus} onKeyDown={(e) => e.key === "Enter" && saveFocus()} />
        </div>
        {!focusSaved && <span className="text-xs text-gray-500">กด Enter เพื่อบันทึก</span>}
      </div>

      {/* HABITS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">นิสัยวันนี้</h2>
          <Link href="/personal" className="text-sm text-brand hover:underline">จัดการ →</Link>
        </div>
        {habits.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {habits.map((h) => {
              const on = doneToday(h.id);
              return (
                <button key={h.id} onClick={() => toggleHabit(h.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition ${on ? "border-green-600/50 bg-green-500/10" : "border-line bg-bg-1 hover:bg-bg-3"}`}>
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${on ? "bg-green-500/20 text-green-400" : "bg-bg-3 text-gray-400"}`}><i className={`ti ${h.icon}`} /></span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium truncate ${on ? "text-green-400" : "text-gray-100"}`}>{h.name}</span>
                    <span className="text-xs text-gray-500"><i className="ti ti-flame" /> {streak(h.id)} วันติด</span>
                  </span>
                  {on && <i className="ti ti-circle-check text-green-400" />}
                </button>
              );
            })}
          </div>
        ) : <div className="text-sm text-gray-500">ยังไม่มีนิสัย — <Link href="/personal" className="text-brand hover:underline">เพิ่มที่โมดูลส่วนตัว</Link></div>}
      </section>

      {/* CHECK-IN */}
      <section>
        <h2 className="font-medium mb-3">เช็คอินสั้น ๆ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([["sleep", "นอน (ชม.)", 0, 12, 0.5], ["mood", "อารมณ์", 1, 5, 1], ["energy", "พลังงาน", 1, 5, 1]] as const).map(([key, label, min, max, step]) => (
            <div key={key}>
              <div className="flex justify-between text-sm text-gray-400"><span>{label}</span><span className="font-medium text-gray-100">{checkin[key]}</span></div>
              <input type="range" min={min} max={max} step={step} value={checkin[key]} className="w-full"
                onChange={(e) => setCI(key, Number(e.target.value))} onMouseUp={() => saveCheckin(checkin)} onTouchEnd={() => saveCheckin(checkin)} />
            </div>
          ))}
        </div>
      </section>

      {/* GOALS mini */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">เป้าหมาย</h2>
          <Link href="/personal" className="text-sm text-brand hover:underline">ดูทั้งหมด →</Link>
        </div>
        {goals.length ? (
          <div className="space-y-3">
            {goals.map((g) => {
              const pct = g.target_value ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-sm mb-1.5"><span className="text-gray-100">{g.title}</span><span className="text-gray-400 font-medium">{pct}%</span></div>
                  <div className="h-2 rounded-full bg-bg-2 overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        ) : <div className="text-sm text-gray-500">ยังไม่มีเป้าหมาย — <Link href="/personal" className="text-brand hover:underline">เพิ่มที่โมดูลส่วนตัว</Link></div>}
      </section>
    </div>
  );
}
