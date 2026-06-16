"use client";
import { useEffect, useRef } from "react";

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const WEATHER: Record<string, string> = { sunny: "☀️", cloudy: "⛅", rain: "🌧️", storm: "⛈️", hot: "🥵" };
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

export type PrintOpts = { weekly: boolean; withPhotos: boolean; from?: string; to?: string };

export default function ReportPrint({ project, tasks, opts, onDone }: { project: any; tasks: any[]; opts: PrintOpts; onDone: () => void }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const finish = () => { window.print(); setTimeout(onDone, 300); };
    const after = () => {
      if (opts.withPhotos) {
        const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("#mysthron-report img"));
        let left = imgs.filter((i) => !i.complete).length;
        if (left === 0) { setTimeout(finish, 300); return; }
        const done = () => { left -= 1; if (left <= 0) setTimeout(finish, 200); };
        imgs.forEach((i) => { if (!i.complete) { i.addEventListener("load", done); i.addEventListener("error", done); } });
        setTimeout(finish, 8000);
      } else setTimeout(finish, 250);
    };
    const t = setTimeout(after, 50);
    return () => clearTimeout(t);
  }, [opts, onDone]);

  const { weekly, withPhotos } = opts;
  const regular = tasks.filter((t) => !t.is_inspection);
  const insp = tasks.filter((t) => t.is_inspection);
  const today = new Date().toISOString().slice(0, 10);
  const done = regular.filter((t) => t.done).length;
  const total = regular.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const inProgress = regular.filter((t) => !t.done && t.start_date && t.start_date <= today).length;
  const overdue = regular.filter((t) => !t.done && t.end_date && t.end_date < today).length;
  const blocked = regular.filter((t) => !t.done && t.blocked).length;

  const buildings: string[] = Array.isArray(project.buildings)
    ? project.buildings.map((b: any) => (typeof b === "string" ? b : b.name || b.building)).filter(Boolean)
    : ([...new Set(regular.map((t) => t.building).filter(Boolean))] as string[]);
  const teams: string[] = Array.isArray(project.teams)
    ? project.teams.map((t: any) => (typeof t === "string" ? t : t.name)).filter(Boolean)
    : ([...new Set(regular.map((t) => t.team).filter(Boolean))] as string[]);

  const inspTotal = insp.length;
  const inspPassed = insp.filter((t) => (t.inspection_result || "pending") === "passed").length;
  const now = new Date();
  const dateStr = `${fmt(today)} เวลา ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} น.`;

  const weatherLog: Record<string, string> = project.settings?.weatherLog || {};
  const weekDays: string[] = [];
  if (opts.from && opts.to) { const c = new Date(opts.from), e = new Date(opts.to); while (c <= e) { weekDays.push(c.toISOString().slice(0, 10)); c.setDate(c.getDate() + 1); } }
  const tasksOnDay = (ds: string) => regular.filter((t) => t.start_date && t.end_date && t.start_date <= ds && t.end_date >= ds);
  const photoTasks = regular.filter((t) => Array.isArray(t.photos) && t.photos.length > 0);

  const statusBadge = (t: any) => {
    if (t.done) return { t: "✅ เสร็จแล้ว", bg: "#dcfce7", c: "#15803d" };
    if (t.blocked) return { t: "🚧 รอของ", bg: "#fef3c7", c: "#b45309" };
    if (t.end_date && t.end_date < today) return { t: "🔴 เกินกำหนด", bg: "#fee2e2", c: "#b91c1c" };
    if (t.start_date && t.start_date <= today) return { t: "▶ กำลังทำ", bg: "#dbeafe", c: "#1d4ed8" };
    return { t: "⏳ รอทำ", bg: "#f1f5f9", c: "#475569" };
  };
  const kpis = [
    { label: "PROGRESS", val: pct + "%", c: "#16a34a" },
    { label: "งานทั้งหมด", val: total, c: "#334155" },
    { label: "เสร็จแล้ว", val: done, c: "#16a34a" },
    { label: "กำลังทำ", val: inProgress, c: "#2563eb" },
    { label: "เกินกำหนด", val: overdue, c: "#dc2626" },
    { label: "รอของ", val: blocked, c: "#d97706" },
  ];

  return (
    <>
      <style>{`
        #mysthron-report { position: fixed; left: -10000px; top: 0; width: 960px; background: #fff; color: #111; padding: 20px; font-size: 13px; }
        #mysthron-report .rp-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 12px 0 20px; }
        #mysthron-report .rp-kpi { border: 1px solid #ccc; border-radius: 8px; padding: 10px; }
        #mysthron-report .rp-kpi .l { font-size: 11px; color: #666; }
        #mysthron-report .rp-kpi .v { font-size: 22px; font-weight: 700; }
        #mysthron-report .rp-table { width: 100%; border-collapse: collapse; margin: 6px 0 18px; font-size: 12.5px; }
        #mysthron-report .rp-table th, #mysthron-report .rp-table td { border: 1px solid #999; padding: 6px 9px; text-align: left; vertical-align: middle; }
        #mysthron-report .rp-table th { background: #eee; }
        #mysthron-report .rp-sec { font-size: 16px; font-weight: 700; margin: 16px 0 6px; }
        @media print {
          body * { visibility: hidden !important; }
          #mysthron-report, #mysthron-report * { visibility: visible !important; }
          #mysthron-report { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 0 !important; }
          #mysthron-report .rp-table tr { break-inside: avoid; }
          @page { margin: 12mm; }
        }
      `}</style>
      <div id="mysthron-report">
        <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: "3px solid #f59e0b", paddingBottom: 12, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{project.name}</h1>
            {project.description && <div style={{ fontSize: 14 }}>{project.description}</div>}
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{weekly ? "📅 รายงานประจำสัปดาห์" : "📄 รายงานความคืบหน้าโครงการ"} · ออกรายงาน: {dateStr}</div>
          </div>
          {project.logo && <img src={project.logo} alt="logo" style={{ height: 56, objectFit: "contain" }} />}
        </div>

        <div className="rp-kpis">
          {kpis.map((k) => <div key={k.label} className="rp-kpi"><div className="l">{k.label}</div><div className="v" style={{ color: k.c }}>{k.val}</div></div>)}
        </div>

        <div className="rp-sec">🏢 สรุปรายอาคาร</div>
        <table className="rp-table">
          <thead><tr><th>อาคาร</th><th style={{ width: 70 }}>ทั้งหมด</th><th style={{ width: 60 }}>เสร็จ</th><th style={{ width: 220 }}>ความคืบหน้า</th></tr></thead>
          <tbody>
            {buildings.map((b) => { const bt = regular.filter((t) => t.building === b); const bd = bt.filter((t) => t.done).length; const bp = bt.length ? Math.round((bd / bt.length) * 100) : 0; return <tr key={b}><td>อาคาร {b}</td><td>{bt.length}</td><td>{bd}</td><td><Bar pct={bp} /></td></tr>; })}
          </tbody>
        </table>

        {teams.length > 0 && (<>
          <div className="rp-sec">👷 สรุปรายทีม</div>
          <table className="rp-table">
            <thead><tr><th>ทีม</th><th style={{ width: 70 }}>ทั้งหมด</th><th style={{ width: 60 }}>เสร็จ</th><th style={{ width: 220 }}>ความคืบหน้า</th></tr></thead>
            <tbody>
              {teams.map((tm) => { const tt = regular.filter((t) => t.team === tm); const td = tt.filter((t) => t.done).length; const tp = tt.length ? Math.round((td / tt.length) * 100) : 0; return <tr key={tm}><td>{tm}</td><td>{tt.length}</td><td>{td}</td><td><Bar pct={tp} /></td></tr>; })}
            </tbody>
          </table>
        </>)}

        {inspTotal > 0 && (<>
          <div className="rp-sec">🔍 งานส่งตรวจ</div>
          <table className="rp-table"><tbody>
            <tr><th style={{ width: 200 }}>จุดตรวจทั้งหมด</th><td>{inspTotal} จุด</td></tr>
            <tr><th>ผ่านแล้ว</th><td>{inspPassed} จุด ({inspTotal ? Math.round((inspPassed / inspTotal) * 100) : 0}%)</td></tr>
          </tbody></table>
        </>)}

        {weekly && (<>
          <div className="rp-sec">📅 สรุปรายวัน</div>
          <table className="rp-table">
            <thead><tr><th style={{ width: 130 }}>วันที่</th><th style={{ width: 60 }}>อากาศ</th><th style={{ width: 60 }}>งาน</th><th>รายการ</th></tr></thead>
            <tbody>
              {weekDays.map((ds) => { const dt = tasksOnDay(ds); const d = new Date(ds); const w = weatherLog[ds] ? WEATHER[weatherLog[ds]] : "-"; return (
                <tr key={ds}><td>{TH_DOW[d.getDay()]} {fmtShort(ds)}{ds === today ? " (วันนี้)" : ""}</td><td style={{ textAlign: "center", fontSize: 16 }}>{w}</td><td>{dt.length}</td><td style={{ fontSize: 11.5 }}>{dt.length ? dt.map((t) => t.name).join(", ") : "—"}</td></tr>
              ); })}
            </tbody>
          </table>
        </>)}

        <div className="rp-sec">📋 รายการงานทั้งหมด ({regular.length})</div>
        <table className="rp-table">
          <thead><tr><th style={{ width: 28 }}>#</th><th>งาน</th><th style={{ width: 60 }}>อาคาร</th><th style={{ width: 60 }}>ชั้น</th><th style={{ width: 80 }}>ทีม</th><th style={{ width: 105 }}>กำหนด</th><th style={{ width: 95 }}>สถานะ</th></tr></thead>
          <tbody>
            {regular.map((t, i) => { const s = statusBadge(t); return (
              <tr key={t.id}>
                <td>{i + 1}</td>
                <td>{t.name}{t.note ? <div style={{ fontSize: 11, color: "#666" }}>📝 {t.note}</div> : null}</td>
                <td>{t.building || "-"}</td>
                <td>{t.floor === "Basement" ? "ใต้ดิน" : t.floor || "-"}</td>
                <td>{t.team || "-"}</td>
                <td>{fmtShort(t.start_date)} - {fmtShort(t.end_date)}</td>
                <td><span style={{ background: s.bg, color: s.c, padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{s.t}</span></td>
              </tr>
            ); })}
          </tbody>
        </table>

        {withPhotos && photoTasks.length > 0 && (<>
          <div className="rp-sec" style={{ pageBreakBefore: "always" }}>📷 รูปประกอบงาน ({photoTasks.length} งาน)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {photoTasks.map((t) => (
              <div key={t.id} style={{ border: "1px solid #ccc", borderRadius: 8, overflow: "hidden", breakInside: "avoid" }}>
                <img src={t.photos[t.photos.length - 1]} alt="" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "6px 10px", fontSize: 12 }}><strong>{t.name}</strong><div style={{ color: "#666" }}>อาคาร {t.building || "-"} · {t.floor === "Basement" ? "ใต้ดิน" : "ชั้น " + (t.floor || "-")}{t.team ? " · " + t.team : ""}</div></div>
              </div>
            ))}
          </div>
        </>)}

        <div style={{ marginTop: 36, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ textAlign: "center", fontSize: 13, borderTop: "1px solid #444", width: 220, paddingTop: 6 }}>ผู้จัดทำรายงาน</div>
        </div>
      </div>
    </>
  );
}
