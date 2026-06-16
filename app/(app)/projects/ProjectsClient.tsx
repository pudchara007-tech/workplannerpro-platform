"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  buildings: string[] | null;
  floors: string[] | null;
  teams: any[] | null;
};

const ICONS = ["🏗️", "🏢", "🏠", "⚡", "🏨", "🔧", "🛠️", "📦"];
const COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#ffb020", "#ef4444", "#06b6d4"];

function csvToArr(s: string) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export default function ProjectsClient() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ name: "", description: "", icon: "🏗️", color: "#3b82f6", buildings: "A, B", floors: "1, 2, 3", teams: "ทีม A" });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("id,name,description,icon,color,buildings,floors,teams")
      .order("created_at", { ascending: false });
    setProjects((data as Project[]) || []);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function createProject() {
    if (!f.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const teams = csvToArr(f.teams).map((n, i) => ({ name: n, color: COLORS[i % COLORS.length] }));
    const { error } = await supabase.from("projects").insert({
      owner_id: user.id,
      name: f.name.trim(),
      description: f.description.trim() || null,
      icon: f.icon,
      color: f.color,
      type: "project",
      buildings: csvToArr(f.buildings),
      floors: csvToArr(f.floors),
      teams,
    });
    setSaving(false);
    if (error) { alert("สร้างไม่สำเร็จ: " + error.message); return; }
    setF({ name: "", description: "", icon: "🏗️", color: "#3b82f6", buildings: "A, B", floors: "1, 2, 3", teams: "ทีม A" });
    setShowForm(false);
    load();
  }

  // นำเข้าจากแอปเก่า (.json ที่ export มา) — สร้างโปรเจค + ย้ายงานเข้า Supabase
  async function importFromOldApp(file: File) {
    try {
      setImporting("กำลังอ่านไฟล์...");
      const payload = JSON.parse(await file.text());
      const meta = payload.projectMeta;
      const pdata = payload.projectData || {};
      if (!meta || !meta.name) throw new Error("ไฟล์ไม่ถูกต้อง (ไม่มี projectMeta)");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ยังไม่ได้ login");

      setImporting("กำลังสร้างโปรเจค...");
      const teams = (meta.teams || []).map((t: any, i: number) =>
        typeof t === "string" ? { name: t, color: COLORS[i % COLORS.length] } : t);
      const { data: proj, error: pErr } = await supabase.from("projects").insert({
        owner_id: user.id,
        name: meta.name,
        description: meta.description || null,
        icon: meta.icon || "🏗️",
        color: meta.color || "#3b82f6",
        type: meta.type || "project",
        buildings: meta.buildings || [],
        floors: meta.floors || [],
        teams,
        categories: meta.categories || [],
        settings: { inspectionPlan: meta.inspectionPlan || pdata.inspectionPlan || [], importedFrom: "legacy" },
      }).select("id").single();
      if (pErr) throw pErr;

      // รวมงาน: rawTasks (ผสม overrides) + userTasks
      const overrides = (pdata.state && pdata.state.overrides) || {};
      const userTasks = (pdata.state && pdata.state.userTasks) || [];
      const raw = pdata.rawTasks || [];
      const toRow = (t: any) => {
        const ov = overrides[t.id] || {};
        const isInsp = ov.customIsInspection !== undefined ? ov.customIsInspection
          : (t.isInspection || (t.id && String(t.id).startsWith("ib-")));
        return {
          project_id: proj!.id,
          name: ov.customName || t.name || "(ไม่มีชื่อ)",
          building: ov.customBuilding || t.building || null,
          floor: ov.customFloor || t.floor || null,
          team: ov.customTeam || t.team || null,
          category: ov.customCategory || t.category || null,
          start_date: ov.customStart || t.start || null,
          end_date: ov.customEnd || t.end || null,
          done: ov.done !== undefined ? ov.done : !!t.done,
          blocked: ov.customBlocked !== undefined ? ov.customBlocked : !!t.blocked,
          is_inspection: !!isInsp,
          inspection_result: ov.inspectionResult !== undefined ? ov.inspectionResult : (t.inspectionResult || null),
          note: ov.note !== undefined ? ov.note : (t.note || null),
          materials: ov.materials !== undefined ? ov.materials : (t.materials || null),
          person_count: ov.personCount !== undefined ? ov.personCount : null,
          // โครงสร้างงานส่งตรวจ (สำหรับ matrix)
          zone_id: t.zoneId || null,
          zone_name: t.zoneName || null,
          zone_type: t.zone || null,
          room_number: t.roomNumber || null,
          system: t.system || null,
          system_name: t.systemName || null,
          created_by: user.id,
        };
      };
      const rows = [
        ...raw.filter((t: any) => !(overrides[t.id] && overrides[t.id].deleted)).map(toRow),
        ...userTasks.filter((t: any) => !(overrides[t.id] && overrides[t.id].deleted)).map(toRow),
      ];

      // insert เป็น batch ละ 200
      let done = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error: tErr } = await supabase.from("tasks").insert(chunk);
        if (tErr) throw tErr;
        done += chunk.length;
        setImporting(`กำลังย้ายงาน ${done}/${rows.length}...`);
      }
      setImporting("");
      alert(`✅ นำเข้า "${meta.name}" สำเร็จ — ย้าย ${rows.length} งาน`);
      load();
    } catch (e: any) {
      setImporting("");
      alert("นำเข้าไม่สำเร็จ: " + (e.message || e));
    }
  }

  if (!loaded) return <div className="text-gray-500 text-sm">กำลังโหลด...</div>;

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) importFromOldApp(file); e.target.value = ""; }} />
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={!!importing}>
          <i className="ti ti-upload" /> {importing || "นำเข้าจากแอปเก่า"}
        </button>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          <i className="ti ti-plus" /> สร้างโครงการ
        </button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5 space-y-3">
          <div>
            <label className="label">ชื่อโครงการ *</label>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="เช่น KARON HOTEL" />
          </div>
          <div>
            <label className="label">คำอธิบาย</label>
            <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="เช่น แผนงานระบบไฟฟ้า" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="label">อาคาร (คั่นด้วย ,)</label><input className="input" value={f.buildings} onChange={(e) => setF({ ...f, buildings: e.target.value })} /></div>
            <div><label className="label">ชั้น (คั่นด้วย ,)</label><input className="input" value={f.floors} onChange={(e) => setF({ ...f, floors: e.target.value })} /></div>
            <div><label className="label">ทีม (คั่นด้วย ,)</label><input className="input" value={f.teams} onChange={(e) => setF({ ...f, teams: e.target.value })} /></div>
          </div>
          <div className="flex gap-4">
            <div>
              <label className="label">ไอคอน</label>
              <div className="flex gap-1.5">
                {ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => setF({ ...f, icon: ic })}
                    className={`w-9 h-9 rounded-lg border text-lg ${f.icon === ic ? "border-brand bg-brand/15" : "border-line bg-bg-3"}`}>{ic}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">สี</label>
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setF({ ...f, color: c })}
                    className={`w-9 h-9 rounded-lg border-2 ${f.color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} aria-label={c} />
                ))}
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={createProject} disabled={saving}>
            {saving ? "กำลังสร้าง..." : "สร้างโครงการ"}
          </button>
        </div>
      )}

      {projects.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}
              className="card p-5 hover:border-brand/50 transition" style={{ borderLeftColor: p.color || "#3b82f6", borderLeftWidth: 3 }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: (p.color || "#3b82f6") + "22" }}>{p.icon || "🏗️"}</span>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  {p.description && <div className="text-xs text-gray-400 truncate">{p.description}</div>}
                </div>
              </div>
              <div className="text-xs text-gray-500 flex gap-3">
                <span>🏢 {(p.buildings || []).length} อาคาร</span>
                <span>👥 {(p.teams || []).length} ทีม</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-gray-400">
          ยังไม่มีโครงการ — กด “สร้างโครงการ” เพื่อเริ่ม หรือรอ migration ย้ายข้อมูล KARON เข้ามา
        </div>
      )}
    </div>
  );
}
