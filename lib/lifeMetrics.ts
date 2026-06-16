// นิยามหมวด + เมตริก Life Log (ตรงกับ schema กลาง)
export type LifeDomain = {
  id: string;
  icon: string;
  name: string;
};

export type LifeMetric = {
  key: string;
  domain: string;
  label: string;
  unit: string;
  type: "num" | "scale";
  agg: "sum" | "avg" | "last";
};

export const LIFE_DOMAINS: LifeDomain[] = [
  { id: "finance", icon: "💰", name: "การเงิน" },
  { id: "work", icon: "💼", name: "การงาน" },
  { id: "trading", icon: "📈", name: "เทรด" },
  { id: "health", icon: "🏃", name: "สุขภาพกาย" },
  { id: "mind", icon: "🧠", name: "สุขภาพใจ" },
  { id: "growth", icon: "📚", name: "พัฒนาตัวเอง" },
  { id: "time", icon: "⏱️", name: "เวลา/ผลิตภาพ" },
];

export const LIFE_METRICS: LifeMetric[] = [
  { key: "income", domain: "finance", label: "รายรับ", unit: "บาท", type: "num", agg: "sum" },
  { key: "expense", domain: "finance", label: "รายจ่าย", unit: "บาท", type: "num", agg: "sum" },
  { key: "work_hours", domain: "work", label: "ชม.ทำงาน", unit: "ชม.", type: "num", agg: "sum" },
  { key: "tasks_done", domain: "work", label: "งานเสร็จ", unit: "งาน", type: "num", agg: "sum" },
  { key: "pnl", domain: "trading", label: "กำไร/ขาดทุน", unit: "บาท", type: "num", agg: "sum" },
  { key: "trades", domain: "trading", label: "จำนวนไม้", unit: "ไม้", type: "num", agg: "sum" },
  { key: "sleep", domain: "health", label: "นอน", unit: "ชม.", type: "num", agg: "avg" },
  { key: "weight", domain: "health", label: "น้ำหนัก", unit: "kg", type: "num", agg: "last" },
  { key: "exercise", domain: "health", label: "ออกกำลัง", unit: "นาที", type: "num", agg: "sum" },
  { key: "water", domain: "health", label: "น้ำดื่ม", unit: "แก้ว", type: "num", agg: "sum" },
  { key: "mood", domain: "mind", label: "อารมณ์", unit: "/5", type: "scale", agg: "avg" },
  { key: "energy", domain: "mind", label: "พลังงาน", unit: "/5", type: "scale", agg: "avg" },
  { key: "stress", domain: "mind", label: "ความเครียด", unit: "/5", type: "scale", agg: "avg" },
  { key: "focus", domain: "mind", label: "โฟกัส", unit: "/5", type: "scale", agg: "avg" },
  { key: "learn", domain: "growth", label: "เรียนรู้", unit: "นาที", type: "num", agg: "sum" },
  { key: "deep_work", domain: "time", label: "Deep work", unit: "ชม.", type: "num", agg: "sum" },
];

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
