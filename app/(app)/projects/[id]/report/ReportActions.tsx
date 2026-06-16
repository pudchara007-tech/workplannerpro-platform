"use client";
import Link from "next/link";

export default function ReportActions({ id }: { id: string }) {
  return (
    <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <Link href={`/projects/${id}`} className="header-btn">← กลับโครงการ</Link>
      <button className="header-btn primary" onClick={() => window.print()} style={{ marginLeft: "auto" }}>🖨️ พิมพ์ / บันทึก PDF</button>
    </div>
  );
}
