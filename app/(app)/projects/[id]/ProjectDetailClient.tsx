"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Task = {
  id: string; name: string; building: string | null; floor: string | null; team: string | null;
  start_date: string | null; end_date: string | null; done: boolean; blocked: boolean;
  is_inspection: boolean; inspection_result: string | null; note: string | null;
};

const INSP_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "รอตรวจ", cls: "ins-pending" },
  passed: { label: "ผ่าน", cls: "ins-passed" },
  failed: { label: "ไม่ผ่าน", cls: "ins-failed" },
  rework: { label: "แก้ไข", cls: "ins-rework" },
};
const inspMeta = (s: string | null) => INSP_STATUS[s || "pending"] || INSP_STATUS.pending;
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ProjectDetailClient({ project }: { project: any }) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"daily" | "progress" | "inspection" | "buildings" | "issues" | "all" | "activity">("daily");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selDay, setSelDay] = useState<string>(ymd(new Date()));
  const [fBuilding, setFBuilding] = useState("all");
  const [fTeam, setFTeam] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [inspBuilding, setInspBuilding] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildings: string[] = project.buildings || [];
  const floors: string[] = project.floors || [];
  const teams: string[] = (project.teams || []).map((t: any) => (typeof t === "string" ? t : t.name));
  const blank = { name: "", building: buildings[0] || "", floor: floors[0] || "", team: teams[0] || "", start_date: "", end_date: "", note: "" };
  const [nf, setNf] = useState(blank);
  const today = ymd(new Date());

  const load = useCallback(async () => {
    const { data } = await supabase.from("tasks").select("*").eq("project_id", project.id).order("start_date");
    setTasks((data as Task[]) || []);
    setLoaded(true);
  }, [supabase, project.id]);
  useEffect(() => { load(); }, [load]);

  const regular = tasks.filter((t) => !t.is_inspection);
  const inspTasks = tasks.filter((t) => t.is_inspection);
  const done = regular.filter((t) => t.done).length;
  const total = regular.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const overdue = regular.filter((t) => !t.done && t.end_date && t.end_date < today).length;
  const todayCount = regular.filter((t) => !t.done && t.start_date && t.end_date && t.start_date <= today && t.end_date >= today).length;
  const started = regular.filter((t) => !t.done && t.start_date && t.start_date <= today).length;
  const blocked = regular.filter((t) => !t.done && t.blocked).length;
  const inspSoon = inspTasks.filter((t) => { if (!t.end_date) return false; const diff = (new Date(t.end_date).getTime() - new Date(today).getTime()) / 86400000; return diff >= 0 && diff <= 7; }).length;

  const tasksOnDay = (ds: string) => regular.filter((t) => t.start_date && t.end_date && t.start_date <= ds && t.end_date >= ds);
  const inspStat = (key: string) => inspTasks.filter((t) => (t.inspection_result || "pending") === key).length;

  async function toggle(t: Task) {
    setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await supabase.from("tasks").update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null }).eq("id", t.id);
  }
  async function del(id: string) {
    if (!confirm("ลบงานนี้?")) return;
    setTasks((p) => p.filter((x) => x.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }
  async function updateInsp(t: Task, status: string) {
    setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, inspection_result: status } : x)));
    await supabase.from("tasks").update({ inspection_result: status }).eq("id", t.id);
  }
  async function addTask() {
    if (!nf.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("tasks").insert({
      project_id: project.id, name: nf.name.trim(), building: nf.building || null, floor: nf.floor || null,
      team: nf.team || null, start_date: nf.start_date || null, end_date: nf.end_date || null,
      note: nf.note.trim() || null, sort_order: tasks.length, created_by: user?.id || null,
    }).select("*").single();
    setSaving(false);
    if (error) { alert("เพิ่มไม่สำเร็จ: " + error.message); return; }
    if (data) setTasks((p) => [...p, data as Task]);
    setNf(blank); setShowForm(false);
  }

  if (!loaded) return <div className="muted">กำลังโหลด...</div>;

  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const floorLabel = (f: string | null) => (f === "Basement" ? "ชั้นใต้ดิน" : f ? "ชั้น " + f : "");

  const TaskCard = (t: Task) => {
    const cls = [t.done ? "done" : "", !t.done && t.end_date && t.end_date < today ? "urgent" : "", t.blocked ? "blocked" : ""].filter(Boolean).join(" ");
    return (
      <div key={t.id} className={`task ${cls}`}>
        <button className={`task-status ${t.done ? "done" : ""}`} onClick={() => toggle(t)} title="ติ๊กเสร็จ">{t.done ? "✓" : ""}</button>
        <div className="task-body">
          <div className="task-title-row"><span className="task-title">{t.name}</span></div>
          <div className="task-meta">
            <span className="task-loc">อาคาร {t.building} · {floorLabel(t.floor)}</span>
            {t.team && <span className="cal-tag">{t.team}</span>}
            {t.end_date && <span className={!t.done && t.end_date < today ? "task-due overdue" : "task-due"}>{!t.done && t.end_date < today ? "⚠️ เกิน " : "ถึง "}{t.end_date}</span>}
          </div>
          {t.note && <div className="task-note">📝 {t.note}</div>}
        </div>
        <button className="icon-btn" onClick={() => del(t.id)} title="ลบ">🗑</button>
      </div>
    );
  };

  return (
    <div>
      {/* KPI ROW (เหมือนแอปเก่า 6 การ์ด) */}
      <div className="kpi-row" style={{ padding: 0, marginBottom: 20 }}>
        <div className="kpi"><div className="kpi-label">PROGRESS</div><div className="kpi-value" style={{ color: pct >= 80 ? "var(--green)" : pct >= 40 ? "var(--accent)" : "var(--red)" }}>{pct}%</div><div className="kpi-foot">เสร็จ {done} / {total} งาน</div></div>
        <div className="kpi"><div className="kpi-label">งานวันนี้</div><div className="kpi-value">{todayCount}</div><div className="kpi-foot">ที่ active วันนี้</div></div>
        <div className="kpi in-progress"><div className="kpi-label">▶ กำลังทำ</div><div className="kpi-value">{started}</div><div className="kpi-foot">งานที่เริ่มแล้ว</div></div>
        <div className="kpi danger"><div className="kpi-label">เกินกำหนด</div><div className="kpi-value">{overdue}</div><div className="kpi-foot">ต้องเร่ง</div></div>
        <div className="kpi warn"><div className="kpi-label">รอของ/BLOCKED</div><div className="kpi-value">{blocked}</div><div className="kpi-foot">ติดอุปกรณ์/พื้นที่</div></div>
        <div className="kpi"><div className="kpi-label">ส่งตรวจใน 7 วัน</div><div className="kpi-value">{inspSoon}</div><div className="kpi-foot">ทั้งหมด {inspTasks.length} จุด</div></div>
      </div>

      {/* TABS */}
      <div className="tabs">
        {([["daily","📅 รายวัน"],["progress","📊 Progress"],["inspection","🔍 ส่งตรวจ"],["buildings","🏢 รายอาคาร"],["issues","📦 รายการของ"],["all","📋 งานทั้งหมด"],["activity","📜 ประวัติ"]] as const).map(([v,label]) => (
          <button key={v} className={`tab ${view === v ? "active" : ""}`} onClick={() => setView(v)}>{label}</button>
        ))}
        <button className="header-btn primary" style={{ marginLeft: "auto" }} onClick={() => setShowForm((s) => !s)}>+ เพิ่มงาน</button>
      </div>

      {showForm && (
        <div className="day-detail" style={{ margin: "14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="form-input" placeholder="ชื่องาน *" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
            <select className="form-input" value={nf.building} onChange={(e) => setNf({ ...nf, building: e.target.value })}>{buildings.map((b) => <option key={b} value={b}>{b}</option>)}</select>
            <select className="form-input" value={nf.floor} onChange={(e) => setNf({ ...nf, floor: e.target.value })}>{floors.map((fl) => <option key={fl} value={fl}>{fl}</option>)}</select>
            <select className="form-input" value={nf.team} onChange={(e) => setNf({ ...nf, team: e.target.value })}>{teams.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <input type="date" className="form-input" value={nf.start_date} onChange={(e) => setNf({ ...nf, start_date: e.target.value })} />
            <input type="date" className="form-input" value={nf.end_date} onChange={(e) => setNf({ ...nf, end_date: e.target.value })} />
          </div>
          <input className="form-input" placeholder="หมายเหตุ" value={nf.note} onChange={(e) => setNf({ ...nf, note: e.target.value })} />
          <button className="header-btn primary" onClick={addTask} disabled={saving}>{saving ? "กำลังเพิ่ม..." : "เพิ่มงาน"}</button>
        </div>
      )}

      {/* DAILY */}
      {view === "daily" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <button className="header-btn" onClick={() => setCalMonth(new Date(year, month - 1, 1))}>‹</button>
            <strong style={{ minWidth: 120, textAlign: "center" }}>{TH_MONTHS[month]} {year + 543}</strong>
            <button className="header-btn" onClick={() => setCalMonth(new Date(year, month + 1, 1))}>›</button>
            <button className="header-btn" style={{ marginLeft: "auto" }} onClick={() => { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelDay(ymd(d)); }}>วันนี้</button>
          </div>
          <div className="calendar">
            {TH_DOW.map((d) => <div key={d} className="cal-head">{d}</div>)}
            {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} className="cal-day empty" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayTasks = tasksOnDay(ds);
              const dayTeams = [...new Set(dayTasks.map((t) => t.team).filter(Boolean))].slice(0, 3) as string[];
              const cls = ["cal-day", ds === today ? "today" : "", ds < today ? "past" : "", ds === selDay ? "selected" : ""].filter(Boolean).join(" ");
              return (
                <div key={ds} className={cls} onClick={() => setSelDay(ds)}>
                  <div className="cal-date">{day}<span className="cal-day-name">{TH_DOW[new Date(ds).getDay()]}</span></div>
                  {dayTasks.length > 0 && <div className="cal-count">{dayTasks.length} งาน</div>}
                  <div className="cal-tags">{dayTeams.map((t) => <span key={t} className="cal-tag">{t}</span>)}</div>
                </div>
              );
            })}
          </div>
          <div className="day-detail" style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 10 }}>งานวันที่ {selDay} ({tasksOnDay(selDay).length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasksOnDay(selDay).length ? tasksOnDay(selDay).map(TaskCard) : <div className="muted">ไม่มีงานวันนี้</div>}
            </div>
          </div>
        </div>
      )}

      {/* INSPECTION */}
      {view === "inspection" && (
        <div style={{ marginTop: 16 }}>
          <div className="kpi-row" style={{ padding: 0, marginBottom: 14 }}>
            {(["pending", "passed", "failed", "rework"] as const).map((k) => (
              <div key={k} className="kpi"><div className="kpi-label">{INSP_STATUS[k].label}</div><div className="kpi-value">{inspStat(k)}</div></div>
            ))}
          </div>
          <select className="form-input" style={{ maxWidth: 180, marginBottom: 12 }} value={inspBuilding} onChange={(e) => setInspBuilding(e.target.value)}>
            <option value="all">อาคาร: ทั้งหมด</option>{buildings.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>รวมส่งตรวจ {inspTasks.length} จุด</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inspTasks.filter((t) => inspBuilding === "all" || t.building === inspBuilding).map((t) => {
              const stKey = INSP_STATUS[t.inspection_result || "pending"] ? (t.inspection_result || "pending") : "pending";
              const meta = inspMeta(t.inspection_result);
              return (
                <div key={t.id} className="task">
                  <div className="task-status" style={{ opacity: 0.6 }}>🔍</div>
                  <div className="task-body">
                    <div className="task-title-row"><span className="task-title">{t.name}</span></div>
                    <div className="task-meta"><span className="task-loc">อาคาร {t.building} · {floorLabel(t.floor)}</span>{t.team && <span className="cal-tag">{t.team}</span>}</div>
                  </div>
                  <select className="form-input" style={{ maxWidth: 110, padding: "4px 8px" }} value={stKey} onChange={(e) => updateInsp(t, e.target.value)}>
                    {Object.keys(INSP_STATUS).map((k) => <option key={k} value={k}>{INSP_STATUS[k].label}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* รายอาคาร (board) */}
      {view === "buildings" && (
        <div className="building-grid" style={{ marginTop: 16 }}>
          {[...new Set(regular.map((t) => t.building).filter(Boolean))].sort().map((b) => {
            const bTasks = regular.filter((t) => t.building === b);
            const fls = [...new Set(bTasks.map((t) => t.floor).filter(Boolean))].sort((a: any, c: any) => (a === "Basement" ? -1 : c === "Basement" ? 1 : parseInt(a) - parseInt(c)));
            const bRem = bTasks.filter((t) => !t.done).length;
            const bDone = bTasks.filter((t) => t.done).length;
            const bBlk = bTasks.filter((t) => t.blocked && !t.done).length;
            return (
              <div key={b} className="building-card">
                <div className="building-header">
                  <div className="building-name">อาคาร {b}</div>
                  <div className="building-stats">
                    <span>📋 {bRem}</span>
                    <span style={{ color: "var(--green)" }}>✓ {bDone}</span>
                    {bBlk > 0 && <span style={{ color: "var(--orange)" }}>🚧 {bBlk}</span>}
                  </div>
                </div>
                <div className="building-body">
                  {fls.map((f) => {
                    const fAll = bTasks.filter((t) => t.floor === f);
                    const fRem = fAll.filter((t) => !t.done);
                    return (
                      <div key={f} className="floor-section">
                        <div className="floor-title">
                          <span>{floorLabel(f)} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>· เหลือ {fRem.length}/{fAll.length}</span></span>
                        </div>
                        {fRem.length > 0 ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{fRem.map(TaskCard)}</div>
                          : <div style={{ fontSize: 11, color: "var(--green)", padding: "4px 8px" }}>✅ งานชั้นนี้เสร็จแล้ว</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* รายการของ (issues / blocked) */}
      {view === "issues" && (
        <div style={{ marginTop: 16 }}>
          {(() => {
            const blk = regular.filter((t) => t.blocked && !t.done);
            const noted = regular.filter((t) => !t.blocked && !t.done && t.note);
            return (
              <>
                <h3 style={{ margin: "0 0 10px" }}>🚧 งานติด/รอของ ({blk.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                  {blk.length ? blk.map(TaskCard) : <div className="muted">ไม่มีงานที่ติด/รอของ</div>}
                </div>
                <h3 style={{ margin: "0 0 10px" }}>📝 งานที่มีหมายเหตุ ({noted.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {noted.length ? noted.map(TaskCard) : <div className="muted">ไม่มี</div>}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Progress / S-Curve (placeholder) */}
      {view === "progress" && (
        <div className="day-detail" style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px" }}>📊 Progress / S-Curve</h3>
          <div className="muted">กำลังพัฒนา — กราฟ S-Curve / Burndown / Progress รายอาคาร (เฟสถัดไป)</div>
          <div style={{ marginTop: 12 }}>ความคืบหน้ารวม: <strong>{pct}%</strong> ({done}/{total} งาน)</div>
        </div>
      )}

      {/* ประวัติ (placeholder) */}
      {view === "activity" && (
        <div className="day-detail" style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px" }}>📜 ประวัติ</h3>
          <div className="muted">กำลังพัฒนา — log กิจกรรม + ผู้ใช้ในโครงการ (เฟสถัดไป)</div>
        </div>
      )}

      {/* ALL */}
      {view === "all" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <select className="form-input" style={{ maxWidth: 140 }} value={fBuilding} onChange={(e) => setFBuilding(e.target.value)}><option value="all">อาคาร: ทั้งหมด</option>{buildings.map((b) => <option key={b} value={b}>{b}</option>)}</select>
            <select className="form-input" style={{ maxWidth: 140 }} value={fTeam} onChange={(e) => setFTeam(e.target.value)}><option value="all">ทีม: ทั้งหมด</option>{teams.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <select className="form-input" style={{ maxWidth: 140 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">สถานะ: ทั้งหมด</option><option value="todo">รอทำ</option><option value="done">เสร็จแล้ว</option></select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {regular.filter((t) => (fBuilding === "all" || t.building === fBuilding) && (fTeam === "all" || t.team === fTeam) && (fStatus === "all" || (fStatus === "done" ? t.done : !t.done))).map(TaskCard)}
          </div>
        </div>
      )}
    </div>
  );
}
