import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportActions from "./ReportActions";

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const fmt = (d: string | null) => { if (!d) return "-"; const x = new Date(d); return `${x.getDate()} ${TH_MONTHS[x.getMonth()]} ${x.getFullYear() + 543}`; };
const fmtShort = (d: string | null) => { if (!d) return "-"; const x = new Date(d); return `${x.getDate()}/${x.getMonth() + 1}/${String(x.getFullYear() + 543).slice(-2)}`; };

function Bar({ pct }: { pct: number }) {
  const c = pct >= 80 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden", minWidth: 80 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c }} />
      </div>
      <span style={{ fontSize: 12, minWidth: 34, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

const WEATHER: Record<string, string> = { sunny: "☀️", cloudy: "⛅", rain: "🌧️", storm: "⛈️", hot: "🥵" };
const TH_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export default async function ReportPage({ params, searchParams }: { params: { id: string }; searchParams: { type?: string } }) {
  const weekly = searchParams?.type === "weekly";
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) notFound();
  const { data: tasksData } = await supabase.from("tasks").select("*").eq("project_id", params.id).order("building");
  const tasks = tasksData || [];

  const regular = tasks.filter((t: any) => !t.is_inspection);
  const insp = tasks.filter((t: any) => t.is_inspection);
  const today = new Date().toISOString().slice(0, 10);
  const done = regular.filter((t: any) => t.done).length;
  const total = regular.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const inProgress = regular.filter((t: any) => !t.done && t.start_date && t.start_date <= today).length;
  const overdue = regular.filter((t: any) => !t.done && t.end_date && t.end_date < today).length;
  const blocked = regular.filter((t: any) => !t.done && t.blocked).length;

  const buildings: string[] = Array.isArray(project.buildings)
    ? project.buildings.map((b: any) => (typeof b === "string" ? b : b.name || b.building)).filter(Boolean)
    : ([...new Set(regular.map((t: any) => t.building).filter(Boolean))] as string[]);
  const teams: string[] = Array.isArray(project.teams)
    ? project.teams.map((t: any) => (typeof t === "string" ? t : t.name)).filter(Boolean)
    : ([...new Set(regular.map((t: any) => t.team).filter(Boolean))] as string[]);

  const inspTotal = insp.length;
  const inspPassed = insp.filter((t: any) => (t.inspection_result || "pending") === "passed").length;

  const now = new Date();
  const dateStr = `${fmt(today)} เวลา ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} น.`;

  // weekly: 7-day window + weather
  const weatherLog: Record<string, string> = project.settings?.weatherLog || {};
  const weekDays: string[] = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); weekDays.push(d.toISOString().slice(0, 10)); }
  const tasksOnDay = (ds: string) => regular.filter((t: any) => t.start_date && t.end_date && t.start_date <= ds && t.end_date >= ds);

  const statusBadge = (t: any) => {
    if (t.done) return { t: "✅ เสร็จแล้ว", bg: "#dcfce7", c: "#15803d" };
    if (t.blocked) return { t: "🚧 รอของ", bg: "#fef3c7", c: "#b45309" };
    if (t.end_date && t.end_date < today) return { t: "🔴 เกินกำหนด", bg: "#fee2e2", c: "#b91c1c" };
    if (t.start_date && t.start_date <= today) return { t: "▶ กำลังทำ", bg: "#dbeafe", c: "#1d4ed8" };
    return { t: "⏳ รอทำ", bg: "#f1f5f9", c: "#475569" };
  };
  const kpis = [
    { label: "PROGRESS", val: pct + "%", c: "#22c55e" },
    { label: "งานทั้งหมด", val: total, c: "#334155" },
    { label: "เสร็จแล้ว", val: done, c: "#22c55e" },
    { label: "กำลังทำ", val: inProgress, c: "#3b82f6" },
    { label: "เกินกำหนด", val: overdue, c: "#ef4444" },
    { label: "รอของ", val: blocked, c: "#f59e0b" },
  ];

  return (
    <div className="report-root">
      <style>{`
        @media print { aside, .no-print { display: none !important; } @page { margin: 12mm; } }
        .report-root { max-width: 960px; margin: 0 auto; color: var(--text-1); }
        .rp-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 12px 0 20px; }
        .rp-kpi { border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
        .rp-kpi .l { font-size: 11px; color: var(--text-3); }
        .rp-kpi .v { font-size: 22px; font-weight: 700; }
        .rp-table { width: 100%; border-collapse: collapse; margin: 6px 0 18px; font-size: 12.5px; }
        .rp-table th, .rp-table td { border: 1px solid var(--border); padding: 6px 9px; text-align: left; vertical-align: middle; }
        .rp-table th { background: var(--bg-3); }
        .rp-sec { font-size: 16px; font-weight: 700; margin: 16px 0 6px; }
        @media print {
          .report-root { color: #111 !important; }
          .rp-table th, .rp-table td { border-color: #999 !important; }
          .rp-table th { background: #eee !important; }
          .rp-kpi { border-color: #999 !important; }
          .rp-table tr { break-inside: avoid; }
        }
      `}</style>
      <ReportActions id={params.id} />

      <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: "3px solid var(--accent)", paddingBottom: 12, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{project.name}</h1>
          {project.description && <div style={{ fontSize: 14 }}>{project.description}</div>}
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{weekly ? "📅 รายงานประจำสัปดาห์" : "📄 รายงานความคืบหน้าโครงการ"} · ออกรายงาน: {dateStr}</div>
        </div>
        {project.logo && <img src={project.logo} alt="logo" style={{ height: 56, objectFit: "contain" }} />}
      </div>

      <div className="rp-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="rp-kpi"><div className="l">{k.label}</div><div className="v" style={{ color: k.c }}>{k.val}</div></div>
        ))}
      </div>

      <div className="rp-sec">🏢 สรุปรายอาคาร</div>
      <table className="rp-table">
        <thead><tr><th>อาคาร</th><th style={{ width: 70 }}>ทั้งหมด</th><th style={{ width: 60 }}>เสร็จ</th><th style={{ width: 220 }}>ความคืบหน้า</th></tr></thead>
        <tbody>
          {buildings.map((b) => {
            const bt = regular.filter((t: any) => t.building === b);
            const bd = bt.filter((t: any) => t.done).length;
            const bp = bt.length ? Math.round((bd / bt.length) * 100) : 0;
            return <tr key={b}><td>อาคาร {b}</td><td>{bt.length}</td><td>{bd}</td><td><Bar pct={bp} /></td></tr>;
          })}
        </tbody>
      </table>

      {teams.length > 0 && (
        <>
          <div className="rp-sec">👷 สรุปรายทีม</div>
          <table className="rp-table">
            <thead><tr><th>ทีม</th><th style={{ width: 70 }}>ทั้งหมด</th><th style={{ width: 60 }}>เสร็จ</th><th style={{ width: 220 }}>ความคืบหน้า</th></tr></thead>
            <tbody>
              {teams.map((tm) => {
                const tt = regular.filter((t: any) => t.team === tm);
                const td = tt.filter((t: any) => t.done).length;
                const tp = tt.length ? Math.round((td / tt.length) * 100) : 0;
                return <tr key={tm}><td>{tm}</td><td>{tt.length}</td><td>{td}</td><td><Bar pct={tp} /></td></tr>;
              })}
            </tbody>
          </table>
        </>
      )}

      {inspTotal > 0 && (
        <>
          <div className="rp-sec">🔍 งานส่งตรวจ</div>
          <table className="rp-table">
            <tbody>
              <tr><th style={{ width: 200 }}>จุดตรวจทั้งหมด</th><td>{inspTotal} จุด</td></tr>
              <tr><th>ผ่านแล้ว</th><td>{inspPassed} จุด ({inspTotal ? Math.round((inspPassed / inspTotal) * 100) : 0}%)</td></tr>
            </tbody>
          </table>
        </>
      )}

      {weekly && (
        <>
          <div className="rp-sec">📅 สรุปรายวัน (7 วันล่าสุด)</div>
          <table className="rp-table">
            <thead><tr><th style={{ width: 120 }}>วันที่</th><th style={{ width: 60 }}>อากาศ</th><th style={{ width: 70 }}>งาน</th><th>รายการ</th></tr></thead>
            <tbody>
              {weekDays.map((ds) => {
                const dt = tasksOnDay(ds);
                const d = new Date(ds);
                const w = weatherLog[ds] ? WEATHER[weatherLog[ds]] : "-";
                return (
                  <tr key={ds}>
                    <td>{TH_DOW[d.getDay()]} {fmtShort(ds)}{ds === today ? " (วันนี้)" : ""}</td>
                    <td style={{ textAlign: "center", fontSize: 16 }}>{w}</td>
                    <td>{dt.length}</td>
                    <td style={{ fontSize: 11.5 }}>{dt.length ? dt.map((t: any) => t.name).join(", ") : <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <div className="rp-sec">📋 รายการงานทั้งหมด ({regular.length})</div>
      <table className="rp-table">
        <thead><tr><th style={{ width: 28 }}>#</th><th>งาน</th><th style={{ width: 70 }}>อาคาร</th><th style={{ width: 70 }}>ชั้น</th><th style={{ width: 90 }}>ทีม</th><th style={{ width: 110 }}>กำหนด</th><th style={{ width: 100 }}>สถานะ</th></tr></thead>
        <tbody>
          {regular.map((t: any, i: number) => {
            const s = statusBadge(t);
            return (
              <tr key={t.id}>
                <td>{i + 1}</td>
                <td>{t.name}{t.note ? <div style={{ fontSize: 11, color: "var(--text-3)" }}>📝 {t.note}</div> : null}</td>
                <td>{t.building || "-"}</td>
                <td>{t.floor === "Basement" ? "ใต้ดิน" : t.floor || "-"}</td>
                <td>{t.team || "-"}</td>
                <td>{fmtShort(t.start_date)} - {fmtShort(t.end_date)}</td>
                <td><span style={{ background: s.bg, color: s.c, padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{s.t}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 36, display: "flex", justifyContent: "flex-end" }}>
        <div style={{ textAlign: "center", fontSize: 13, borderTop: "1px solid var(--text-2)", width: 220, paddingTop: 6 }}>ผู้จัดทำรายงาน</div>
      </div>
    </div>
  );
}
