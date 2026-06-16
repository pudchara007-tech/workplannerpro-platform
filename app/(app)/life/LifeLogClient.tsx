"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LIFE_DOMAINS, LIFE_METRICS, todayStr } from "@/lib/lifeMetrics";

type Row = { log_date: string; metric: string; value: number | null; note: string | null };

export default function LifeLogClient() {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<Row[]>([]);          // ข้อมูล 30 วันล่าสุด (สำหรับ trend/summary)
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [trendMetric, setTrendMetric] = useState("mood");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // โหลดข้อมูล 30 วันล่าสุด
  async function load() {
    const since = new Date(date);
    since.setDate(since.getDate() - 30);
    const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
    const { data } = await supabase
      .from("life_log")
      .select("log_date, metric, value, note")
      .gte("log_date", sinceStr)
      .lte("log_date", date)
      .order("log_date", { ascending: true });
    const list = (data || []) as Row[];
    setRows(list);
    // เติมค่าของวันที่เลือกลงฟอร์ม
    const v: Record<string, string> = {};
    list.filter((r) => r.log_date === date).forEach((r) => {
      if (r.metric === "_note") setNote(r.note || "");
      else if (r.value !== null) v[r.metric] = String(r.value);
    });
    setValues(v);
    setNote(list.find((r) => r.log_date === date && r.metric === "_note")?.note || "");
    setLoaded(true);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // ลบของวันนี้ก่อน แล้ว insert ใหม่ (upsert ทั้งวัน)
    await supabase.from("life_log").delete().eq("user_id", user.id).eq("log_date", date);
    const inserts: any[] = [];
    Object.entries(values).forEach(([metric, val]) => {
      if (val === "" || isNaN(Number(val))) return;
      const def = LIFE_METRICS.find((m) => m.key === metric);
      if (!def) return;
      inserts.push({ user_id: user.id, log_date: date, domain: def.domain, metric, value: Number(val), unit: def.unit });
    });
    if (note.trim()) inserts.push({ user_id: user.id, log_date: date, domain: "mind", metric: "_note", value: null, note: note.trim() });
    if (inserts.length) await supabase.from("life_log").insert(inserts);
    setSaving(false);
    load();
  }

  function setVal(k: string, v: string) { setValues((p) => ({ ...p, [k]: v })); }

  // ---- trend 14 วัน ----
  const trend = useMemo(() => {
    const def = LIFE_METRICS.find((m) => m.key === trendMetric);
    const end = new Date(date);
    const days: { label: string; value: number | null }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(end); d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const r = rows.find((x) => x.log_date === ds && x.metric === trendMetric);
      days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: r ? r.value : null });
    }
    const vals = days.filter((d) => d.value !== null).map((d) => d.value as number);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const max = Math.max(...vals, def?.type === "scale" ? 5 : 0);
    return { days, avg, max, unit: def?.unit || "", hasData: vals.length > 0 };
  }, [rows, trendMetric, date]);

  // ---- สรุปสัปดาห์ ----
  const week = useMemo(() => {
    const ref = new Date(date);
    const start = new Date(ref); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const inWk = rows.filter((r) => r.log_date >= fmt(start) && r.log_date <= fmt(end) && r.metric !== "_note");
    return LIFE_DOMAINS.map((dom) => {
      const metrics = LIFE_METRICS.filter((m) => m.domain === dom.id).map((m) => {
        const vs = inWk.filter((r) => r.metric === m.key).map((r) => r.value as number);
        if (!vs.length) return null;
        let v = m.agg === "sum" ? vs.reduce((a, b) => a + b, 0) : m.agg === "avg" ? vs.reduce((a, b) => a + b, 0) / vs.length : vs[vs.length - 1];
        return { label: m.label, unit: m.unit, disp: m.agg === "avg" ? v.toFixed(1) : (Number.isInteger(v) ? String(v) : v.toFixed(1)) };
      }).filter(Boolean) as { label: string; unit: string; disp: string }[];
      return { dom, metrics };
    }).filter((d) => d.metrics.length > 0);
  }, [rows, date]);

  if (!loaded) return <div className="text-gray-500 text-sm">กำลังโหลด...</div>;

  return (
    <div className="space-y-8">
      {/* ฟอร์มจดรายวัน */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" className="input max-w-[170px]" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "💾 บันทึกวันนี้"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {LIFE_DOMAINS.map((dom) => (
          <div key={dom.id} className="card p-4">
            <div className="font-medium mb-3">{dom.icon} {dom.name}</div>
            {LIFE_METRICS.filter((m) => m.domain === dom.id).map((m) => (
              <div key={m.key} className="mb-3">
                <label className="label">{m.label} {m.unit && <span className="text-gray-600">{m.unit}</span>}</label>
                {m.type === "scale" ? (
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button"
                        onClick={() => setVal(m.key, values[m.key] === String(n) ? "" : String(n))}
                        className={`flex-1 py-1.5 rounded-md text-sm border transition
                          ${values[m.key] === String(n) ? "bg-brand text-white border-brand font-bold" : "bg-bg-3 border-line text-gray-400 hover:border-brand"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input type="number" step="any" className="input"
                    value={values[m.key] || ""} onChange={(e) => setVal(m.key, e.target.value)} placeholder="—" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div>
        <label className="label">📝 โน้ตประจำวัน</label>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เกิดอะไรขึ้นวันนี้..." />
      </div>

      {/* Trend */}
      <div>
        <div className="font-medium mb-3">📈 ดูแนวโน้ม 14 วัน</div>
        <select className="input max-w-[240px] mb-3" value={trendMetric} onChange={(e) => setTrendMetric(e.target.value)}>
          {LIFE_METRICS.map((m) => {
            const dom = LIFE_DOMAINS.find((d) => d.id === m.domain);
            return <option key={m.key} value={m.key}>{dom?.icon} {m.label} ({m.unit})</option>;
          })}
        </select>
        {trend.hasData ? (
          <div className="card p-4">
            <div className="text-sm text-gray-400 mb-3">เฉลี่ย: <strong className="text-gray-100">{trend.avg?.toFixed(1)} {trend.unit}</strong></div>
            <div className="flex items-end gap-1.5 h-28">
              {trend.days.map((d, i) => {
                const h = d.value === null ? 0 : Math.max(4, Math.round((d.value / (trend.max || 1)) * 90));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.label}: ${d.value ?? "ไม่มีข้อมูล"}`}>
                    <div className={`w-2/3 max-w-[20px] rounded-t ${d.value === null ? "bg-bg-3" : "bg-brand"}`} style={{ height: `${h}px` }} />
                    <span className="text-[8px] text-gray-600 mt-1">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <div className="card p-5 text-sm text-gray-500">ยังไม่มีข้อมูล — เริ่มจดเพื่อดูแนวโน้ม</div>}
      </div>

      {/* สรุปสัปดาห์ */}
      <div>
        <div className="font-medium mb-3">🗓️ สรุปสัปดาห์นี้</div>
        {week.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {week.map(({ dom, metrics }) => (
              <div key={dom.id} className="card p-4">
                <div className="font-medium mb-2">{dom.icon} {dom.name}</div>
                {metrics.map((m) => (
                  <div key={m.label} className="flex justify-between text-sm text-gray-400 py-0.5">
                    <span>{m.label}</span><strong className="text-gray-100">{m.disp} {m.unit}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : <div className="card p-5 text-sm text-gray-500">สัปดาห์นี้ยังไม่มีข้อมูล</div>}
      </div>
    </div>
  );
}
