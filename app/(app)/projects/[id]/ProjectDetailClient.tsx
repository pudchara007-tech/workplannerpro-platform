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
const INSP_ICON: Record<string, string> = { pending: "·", passed: "✓", failed: "✕", rework: "🔧" };
const INSP_CYCLE = ["pending", "passed", "failed", "rework"];
const SYSTEMS = [
  { id: "lighting", label: "แสงสว่าง", icon: "💡" },
  { id: "socket-comm", label: "เต้ารับ+สื่อสาร", icon: "🔌" },
  { id: "emergency", label: "โหลดเซน+ป้ายหนีไฟ", icon: "🚨" },
  { id: "fire-alarm", label: "แจ้งเหตุเพลิงไหม้", icon: "🔥" },
  { id: "grounding", label: "สายดิน", icon: "🌐" },
  { id: "other", label: "อื่นๆ", icon: "📋" },
];
const floorLabelShort = (f: string | null) => (f === "Basement" ? "B" : f || "");
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
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [ef, setEf] = useState<any>({});
  const cats: any[] = project.categories || [];
  const today = ymd(new Date());

  function openEdit(t: Task) {
    const a = t as any;
    setEditTask(t);
    setEf({ name: t.name || "", building: t.building || "", floor: t.floor || "", team: t.team || "",
      start_date: t.start_date || "", end_date: t.end_date || "", category: a.category || "",
      person_count: a.person_count ?? "", blocked: !!t.blocked, materials: a.materials || "", note: t.note || "" });
  }
  async function saveEdit() {
    if (!editTask) return;
    const patch: any = {
      name: ef.name.trim() || editTask.name, building: ef.building || null, floor: ef.floor || null, team: ef.team || null,
      start_date: ef.start_date || null, end_date: ef.end_date || null, category: ef.category || null,
      person_count: ef.person_count === "" ? null : Number(ef.person_count), blocked: !!ef.blocked,
      materials: ef.materials || null, note: ef.note || null, updated_at: new Date().toISOString(),
    };
    setTasks((p) => p.map((x) => (x.id === editTask.id ? ({ ...x, ...patch } as Task) : x)));
    const id = editTask.id;
    setEditTask(null);
    await supabase.from("tasks").update(patch).eq("id", id);
  }

  // ── inspection builder: เพิ่ม/ลบ พื้นที่ ──
  const [zoneForm, setZoneForm] = useState<any>(null);
  function openZoneForm() {
    setZoneForm({ building: buildings[0] || "", floor: floors[0] || "", zoneType: "common", zoneName: "", systems: SYSTEMS.map((s) => s.id), rooms: "" });
  }
  async function saveZone() {
    const zf = zoneForm;
    if (!zf || !zf.zoneName.trim()) { alert("กรุณาใส่ชื่อพื้นที่"); return; }
    if (zf.systems.length === 0) { alert("เลือกระบบอย่างน้อย 1"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const zid = "zone-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
    const sysList = SYSTEMS.filter((s) => zf.systems.includes(s.id));
    const rooms = zf.zoneType === "room"
      ? (zf.rooms.split(",").map((r: string) => r.trim()).filter(Boolean))
      : [null];
    if (zf.zoneType === "room" && rooms.length === 0) { alert("ใส่เลขห้อง เช่น 201,202,203"); return; }
    const rows: any[] = [];
    sysList.forEach((s) => rooms.forEach((rm: any) => rows.push({
      project_id: project.id, is_inspection: true, inspection_result: "pending",
      name: `ส่งตรวจ${s.label}${rm ? " ห้อง " + rm : ""} · ${zf.zoneName}`,
      building: zf.building, floor: zf.floor, zone_id: zid, zone_name: zf.zoneName.trim(),
      zone_type: zf.zoneType, room_number: rm, system: s.id, system_name: s.label, created_by: user?.id || null,
    })));
    const { data, error } = await supabase.from("tasks").insert(rows).select("*");
    if (error) { alert("เพิ่มไม่สำเร็จ: " + error.message); return; }
    if (data) setTasks((p) => [...p, ...(data as Task[])]);
    setZoneForm(null);
  }
  async function deleteZone(zoneId: string, label: string) {
    if (!confirm(`ลบพื้นที่ "${label}" + งานส่งตรวจทั้งหมดในนั้น?`)) return;
    setTasks((p) => p.filter((t: any) => t.zone_id !== zoneId));
    await supabase.from("tasks").delete().eq("project_id", project.id).eq("zone_id", zoneId);
  }

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
        <div className="task-body" style={{ cursor: "pointer" }} onClick={() => openEdit(t)}>
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

      {/* INSPECTION matrix */}
      {view === "inspection" && (() => {
        const insp = inspTasks.filter((t: any) => t.zone_id); // ต้อง re-import เพื่อให้มี zone_id
        const passed = inspTasks.filter((t) => (t.inspection_result || "pending") === "passed").length;
        const total = inspTasks.length;
        const pctPass = total ? Math.round((passed / total) * 100) : 0;
        const bldgs = [...new Set(insp.map((t: any) => t.building).filter(Boolean))].sort();
        // status ของ cell (zone×system)
        const cycleCell = (t: any) => {
          const cur = t.inspection_result || "pending";
          updateInsp(t, INSP_CYCLE[(INSP_CYCLE.indexOf(cur) + 1) % INSP_CYCLE.length]);
        };
        return (
          <div style={{ marginTop: 16 }}>
            <div className="kpi-row" style={{ padding: 0, marginBottom: 14 }}>
              {(["pending", "passed", "failed", "rework"] as const).map((k) => (
                <div key={k} className="kpi"><div className="kpi-label">{INSP_STATUS[k].label}</div><div className="kpi-value">{inspStat(k)}</div></div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 13 }}>ผ่าน {passed}/{total} ({pctPass}%) · กดช่องเพื่อหมุนสถานะ</span>
              <button className="header-btn primary" style={{ marginLeft: "auto" }} onClick={openZoneForm}>+ เพิ่มพื้นที่</button>
            </div>
            {insp.length === 0 ? (
              <div className="day-detail muted">ยังไม่มีข้อมูล matrix — ต้อง <strong>re-import KARON</strong> หลังรัน migration 004 (งานส่งตรวจเดิมยังไม่มี zone/system)</div>
            ) : bldgs.map((b) => {
              const bTasks = insp.filter((t: any) => t.building === b);
              // zones unique
              const zoneMap: Record<string, any> = {};
              bTasks.forEach((t: any) => { if (!zoneMap[t.zone_id]) zoneMap[t.zone_id] = { id: t.zone_id, name: t.zone_name, floor: t.floor, type: t.zone_type }; });
              const zones = Object.values(zoneMap).sort((a: any, c: any) => String(a.floor).localeCompare(String(c.floor)) || String(a.name).localeCompare(String(c.name)));
              return (
                <div key={b} style={{ marginBottom: 20 }}>
                  <div className="building-name" style={{ marginBottom: 8 }}>📋 อาคาร {b}</div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="print-room-table" style={{ minWidth: 640 }}>
                      <thead><tr>
                        <th style={{ textAlign: "left", minWidth: 130 }}>พื้นที่</th>
                        {SYSTEMS.map((s) => <th key={s.id} title={s.label}><div style={{ fontSize: 14 }}>{s.icon}</div><div style={{ fontSize: 8, fontWeight: 400 }}>{s.label}</div></th>)}
                      </tr></thead>
                      <tbody>
                        {zones.map((z: any) => (
                          <tr key={z.id}>
                            <td className="td-room">{floorLabelShort(z.floor)} · {z.name}
                              <button onClick={() => deleteZone(z.id, z.name)} title="ลบพื้นที่" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", marginLeft: 4 }}>🗑</button>
                            </td>
                            {SYSTEMS.map((s) => {
                              const cells = bTasks.filter((t: any) => t.zone_id === z.id && t.system === s.id);
                              if (cells.length === 0) return <td key={s.id} style={{ color: "var(--text-mute)" }}>—</td>;
                              if (z.type === "room" && cells.length > 1) {
                                const ps = cells.filter((c: any) => (c.inspection_result || "pending") === "passed").length;
                                const allPass = ps === cells.length;
                                return <td key={s.id} className={allPass ? "ps-passed-bg" : ""} style={{ fontSize: 11, fontWeight: 700 }}>{ps}/{cells.length}</td>;
                              }
                              const t = cells[0];
                              const st = t.inspection_result || "pending";
                              return (
                                <td key={s.id} onClick={() => cycleCell(t)} title={INSP_STATUS[st]?.label} style={{ cursor: "pointer" }}
                                  className={st === "passed" ? "ps-passed-bg" : st === "failed" ? "ps-failed-bg" : st === "rework" ? "ps-rework-bg" : ""}>
                                  <span style={{ fontWeight: 700 }}>{INSP_ICON[st]}</span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

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

      {/* เพิ่มพื้นที่ (inspection builder) modal */}
      {zoneForm && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setZoneForm(null); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">+ เพิ่มพื้นที่ส่งตรวจ</div>
              <button className="modal-close" onClick={() => setZoneForm(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div className="form-group"><label className="form-label">อาคาร</label>
                  <select className="form-input" value={zoneForm.building} onChange={(e) => setZoneForm({ ...zoneForm, building: e.target.value })}>{buildings.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
                <div className="form-group"><label className="form-label">ชั้น</label>
                  <select className="form-input" value={zoneForm.floor} onChange={(e) => setZoneForm({ ...zoneForm, floor: e.target.value })}>{floors.map((fl) => <option key={fl} value={fl}>{fl}</option>)}</select></div>
              </div>
              <div className="form-group"><label className="form-label">ชื่อพื้นที่ (เช่น ส่วนทางเดิน, ห้องพัก)</label>
                <input className="form-input" value={zoneForm.zoneName} onChange={(e) => setZoneForm({ ...zoneForm, zoneName: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">ประเภท</label>
                <select className="form-input" value={zoneForm.zoneType} onChange={(e) => setZoneForm({ ...zoneForm, zoneType: e.target.value })}>
                  <option value="common">ส่วนกลาง (1 จุดต่อระบบ)</option>
                  <option value="room">ห้องพัก (หลายห้อง)</option>
                </select></div>
              {zoneForm.zoneType === "room" && (
                <div className="form-group"><label className="form-label">เลขห้อง (คั่นด้วย , เช่น 201,202,203)</label>
                  <input className="form-input" value={zoneForm.rooms} onChange={(e) => setZoneForm({ ...zoneForm, rooms: e.target.value })} placeholder="201,202,203" /></div>
              )}
              <div className="form-group"><label className="form-label">ระบบที่ส่งตรวจ</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {SYSTEMS.map((s) => {
                    const on = zoneForm.systems.includes(s.id);
                    return <button key={s.id} type="button" onClick={() => setZoneForm({ ...zoneForm, systems: on ? zoneForm.systems.filter((x: string) => x !== s.id) : [...zoneForm.systems, s.id] })}
                      className="header-btn" style={{ borderColor: on ? "var(--accent)" : "var(--border)", color: on ? "var(--accent)" : "var(--text-2)" }}>{on ? "✓ " : ""}{s.icon} {s.label}</button>;
                  })}
                </div>
              </div>
              <button className="header-btn primary" onClick={saveZone}>เพิ่มพื้นที่</button>
            </div>
          </div>
        </div>
      )}

      {/* แก้ไขงาน modal */}
      {editTask && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setEditTask(null); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">✏️ แก้ไขงาน</div>
              <button className="modal-close" onClick={() => setEditTask(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "70vh", overflowY: "auto" }}>
              <div className="form-group"><label className="form-label">ชื่องาน</label>
                <input className="form-input" value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div className="form-group"><label className="form-label">อาคาร</label>
                  <select className="form-input" value={ef.building} onChange={(e) => setEf({ ...ef, building: e.target.value })}>{buildings.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
                <div className="form-group"><label className="form-label">ชั้น</label>
                  <select className="form-input" value={ef.floor} onChange={(e) => setEf({ ...ef, floor: e.target.value })}>{floors.map((fl) => <option key={fl} value={fl}>{fl}</option>)}</select></div>
                <div className="form-group"><label className="form-label">ทีม</label>
                  <select className="form-input" value={ef.team} onChange={(e) => setEf({ ...ef, team: e.target.value })}>{teams.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div className="form-group"><label className="form-label">เริ่ม</label>
                  <input type="date" className="form-input" value={ef.start_date} onChange={(e) => setEf({ ...ef, start_date: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">เสร็จ</label>
                  <input type="date" className="form-input" value={ef.end_date} onChange={(e) => setEf({ ...ef, end_date: e.target.value })} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {cats.length > 0 && (
                  <div className="form-group"><label className="form-label">หมวดงาน</label>
                    <select className="form-input" value={ef.category} onChange={(e) => setEf({ ...ef, category: e.target.value })}>
                      <option value="">—</option>{cats.map((c: any) => <option key={c.id || c} value={c.id || c}>{(c.icon ? c.icon + " " : "") + (c.name || c)}</option>)}
                    </select></div>
                )}
                <div className="form-group"><label className="form-label">จำนวนคน</label>
                  <input type="number" className="form-input" value={ef.person_count} onChange={(e) => setEf({ ...ef, person_count: e.target.value })} placeholder="—" /></div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-2)" }}>
                <input type="checkbox" checked={ef.blocked} onChange={(e) => setEf({ ...ef, blocked: e.target.checked })} /> 🚧 รอของ/ติดปัญหา (blocked)
              </label>
              <div className="form-group"><label className="form-label">วัสดุ / รายการของ</label>
                <textarea className="form-input" rows={2} value={ef.materials} onChange={(e) => setEf({ ...ef, materials: e.target.value })} placeholder="รายการวัสดุที่ต้องใช้/สั่ง" style={{ resize: "vertical" }} /></div>
              <div className="form-group"><label className="form-label">หมายเหตุ</label>
                <textarea className="form-input" rows={2} value={ef.note} onChange={(e) => setEf({ ...ef, note: e.target.value })} style={{ resize: "vertical" }} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button className="header-btn primary" style={{ flex: 1 }} onClick={saveEdit}>บันทึก</button>
                <button className="header-btn danger" onClick={() => { const id = editTask.id; setEditTask(null); del(id); }}>ลบ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
