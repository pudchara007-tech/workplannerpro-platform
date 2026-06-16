"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Habit = { id: string; name: string; icon: string; sort_order: number };
type Goal = { id: string; title: string; domain: string | null; target_value: number | null; current_value: number; unit: string | null; status: string };

const ICONS = ["ti-run", "ti-book", "ti-pencil", "ti-shield-check", "ti-droplet", "ti-barbell", "ti-moon", "ti-coin"];
const DOMAINS = [
  { id: "finance", label: "💰 การเงิน" }, { id: "health", label: "🏃 สุขภาพ" },
  { id: "trading", label: "📈 เทรด" }, { id: "growth", label: "📚 พัฒนาตัวเอง" },
  { id: "work", label: "💼 การงาน" }, { id: "mind", label: "🧠 ใจ" },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PersonalCockpit() {
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, Set<string>>>({}); // habitId -> set of done dates
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newHabit, setNewHabit] = useState("");
  const [newIcon, setNewIcon] = useState(ICONS[0]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [g, setG] = useState({ title: "", domain: "health", target: "", current: "", unit: "" });

  const today = ymd(new Date());

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUid(user.id);
    const since = new Date(); since.setDate(since.getDate() - 90);
    const [{ data: hs }, { data: hl }, { data: gs }] = await Promise.all([
      supabase.from("habits").select("id,name,icon,sort_order").eq("archived", false).order("sort_order"),
      supabase.from("habit_logs").select("habit_id,log_date,done").gte("log_date", ymd(since)),
      supabase.from("goals").select("*").neq("status", "done").order("sort_order"),
    ]);
    setHabits((hs as Habit[]) || []);
    const map: Record<string, Set<string>> = {};
    ((hl as any[]) || []).forEach((r) => {
      if (!r.done) return;
      (map[r.habit_id] = map[r.habit_id] || new Set()).add(r.log_date);
    });
    setLogs(map);
    setGoals((gs as Goal[]) || []);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function streak(habitId: string) {
    const set = logs[habitId];
    if (!set) return 0;
    let n = 0;
    const d = new Date();
    while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const doneToday = (habitId: string) => logs[habitId]?.has(today) ?? false;

  async function toggleHabit(habitId: string) {
    if (!uid) return;
    const on = doneToday(habitId);
    // optimistic
    setLogs((prev) => {
      const next = { ...prev };
      const s = new Set(next[habitId] || []);
      if (on) s.delete(today); else s.add(today);
      next[habitId] = s;
      return next;
    });
    if (on) await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", today);
    else await supabase.from("habit_logs").insert({ habit_id: habitId, user_id: uid, log_date: today, done: true });
  }

  async function addHabit() {
    if (!uid || !newHabit.trim()) return;
    const { data } = await supabase.from("habits")
      .insert({ user_id: uid, name: newHabit.trim(), icon: newIcon, sort_order: habits.length })
      .select("id,name,icon,sort_order").single();
    if (data) setHabits((h) => [...h, data as Habit]);
    setNewHabit("");
  }
  async function delHabit(id: string) {
    await supabase.from("habits").delete().eq("id", id);
    setHabits((h) => h.filter((x) => x.id !== id));
  }

  async function addGoal() {
    if (!uid || !g.title.trim()) return;
    const { data } = await supabase.from("goals").insert({
      user_id: uid, title: g.title.trim(), domain: g.domain,
      target_value: g.target ? Number(g.target) : null,
      current_value: g.current ? Number(g.current) : 0,
      unit: g.unit || null, sort_order: goals.length,
    }).select("*").single();
    if (data) setGoals((x) => [...x, data as Goal]);
    setG({ title: "", domain: "health", target: "", current: "", unit: "" });
    setShowGoalForm(false);
  }
  async function bumpGoal(goal: Goal, delta: number) {
    const step = goal.target_value ? Math.max(1, Math.round(goal.target_value * 0.05)) : 1;
    const nv = Math.max(0, (goal.current_value || 0) + delta * step);
    setGoals((x) => x.map((q) => (q.id === goal.id ? { ...q, current_value: nv } : q)));
    await supabase.from("goals").update({ current_value: nv }).eq("id", goal.id);
  }
  async function delGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((x) => x.filter((q) => q.id !== id));
  }

  if (!loaded) return <div className="text-gray-500 text-sm">กำลังโหลด...</div>;

  const habitDoneCount = habits.filter((h) => doneToday(h.id)).length;

  return (
    <div className="space-y-8">
      {/* HABITS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">นิสัยวันนี้</h2>
          <span className="text-sm text-gray-400">{habitDoneCount}/{habits.length} เสร็จ</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {habits.map((h) => {
            const on = doneToday(h.id);
            return (
              <div key={h.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition ${on ? "border-green-600/50 bg-green-500/10" : "border-line bg-bg-1"}`}>
                <button onClick={() => toggleHabit(h.id)} aria-label="toggle"
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${on ? "bg-green-500/20 text-green-400" : "bg-bg-3 text-gray-400"}`}>
                  <i className={`ti ${h.icon}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${on ? "text-green-400" : "text-gray-100"}`}>{h.name}</div>
                  <div className="text-xs text-gray-500"><i className="ti ti-flame" /> {streak(h.id)} วันติด</div>
                </div>
                <button onClick={() => delHabit(h.id)} aria-label="delete" className="text-gray-600 hover:text-red-400"><i className="ti ti-trash" /></button>
              </div>
            );
          })}
          {habits.length === 0 && <div className="text-sm text-gray-500">ยังไม่มีนิสัย เพิ่มอันแรกด้านล่าง</div>}
        </div>
        <div className="flex gap-2 mt-3">
          <select className="input max-w-[64px]" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} aria-label="icon">
            {ICONS.map((ic) => <option key={ic} value={ic}>{ic.replace("ti-", "")}</option>)}
          </select>
          <input className="input flex-1" placeholder="เพิ่มนิสัยใหม่..." value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()} />
          <button className="btn btn-primary" onClick={addHabit}>เพิ่ม</button>
        </div>
      </section>

      {/* GOALS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">เป้าหมาย</h2>
          <button className="btn text-sm" onClick={() => setShowGoalForm((s) => !s)}>
            <i className="ti ti-plus" /> เพิ่มเป้า
          </button>
        </div>

        {showGoalForm && (
          <div className="card p-4 mb-4 space-y-3">
            <input className="input" placeholder="ชื่อเป้าหมาย เช่น เงินออม 50,000" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select className="input" value={g.domain} onChange={(e) => setG({ ...g, domain: e.target.value })}>
                {DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <input className="input" type="number" placeholder="ตอนนี้" value={g.current} onChange={(e) => setG({ ...g, current: e.target.value })} />
              <input className="input" type="number" placeholder="เป้า" value={g.target} onChange={(e) => setG({ ...g, target: e.target.value })} />
              <input className="input" placeholder="หน่วย" value={g.unit} onChange={(e) => setG({ ...g, unit: e.target.value })} />
            </div>
            <button className="btn btn-primary" onClick={addGoal}>บันทึกเป้า</button>
          </div>
        )}

        <div className="space-y-3">
          {goals.map((goal) => {
            const pct = goal.target_value ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0;
            return (
              <div key={goal.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-100">{goal.title}</div>
                  <button onClick={() => delGoal(goal.id)} aria-label="delete" className="text-gray-600 hover:text-red-400"><i className="ti ti-trash" /></button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-bg-3 overflow-hidden">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-24 text-right">
                    {Math.round(goal.current_value).toLocaleString()}{goal.target_value ? ` / ${Math.round(goal.target_value).toLocaleString()}` : ""} {goal.unit || ""}
                  </span>
                  <div className="flex gap-1">
                    <button className="btn px-2 py-1" onClick={() => bumpGoal(goal, -1)} aria-label="ลด"><i className="ti ti-minus" /></button>
                    <button className="btn px-2 py-1" onClick={() => bumpGoal(goal, 1)} aria-label="เพิ่ม"><i className="ti ti-plus" /></button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{pct}%</div>
              </div>
            );
          })}
          {goals.length === 0 && <div className="text-sm text-gray-500">ยังไม่มีเป้าหมาย กด “เพิ่มเป้า”</div>}
        </div>
      </section>
    </div>
  );
}
