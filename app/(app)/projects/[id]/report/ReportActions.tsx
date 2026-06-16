"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

export default function ReportActions({ id, autoPrint, withPhotos }: { id: string; autoPrint?: boolean; withPhotos?: boolean }) {
  const fired = useRef(false);
  useEffect(() => {
    if (!autoPrint || fired.current) return;
    fired.current = true;
    const go = () => window.print();
    if (withPhotos) {
      // รอรูปโหลดก่อนพิมพ์
      const imgs = Array.from(document.images);
      let left = imgs.filter((i) => !i.complete).length;
      if (left === 0) { setTimeout(go, 400); return; }
      const done = () => { left -= 1; if (left <= 0) setTimeout(go, 300); };
      imgs.forEach((i) => { if (!i.complete) { i.addEventListener("load", done); i.addEventListener("error", done); } });
      // กันค้าง
      setTimeout(go, 8000);
    } else {
      setTimeout(go, 500);
    }
  }, [autoPrint, withPhotos]);

  return (
    <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <Link href={`/projects/${id}`} className="header-btn">← กลับโครงการ</Link>
      <button className="header-btn primary" onClick={() => window.print()} style={{ marginLeft: "auto" }}>🖨️ พิมพ์ / บันทึก PDF</button>
    </div>
  );
}
