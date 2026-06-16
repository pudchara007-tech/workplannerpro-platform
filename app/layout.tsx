import type { Metadata } from "next";
import "./globals.css";
import "./legacy.css";

export const metadata: Metadata = {
  title: "WorkPlannerPro",
  description: "Platform บริหารงาน โครงการ ส่วนตัว เทรด และชีวิต",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="dark">
      <body>{children}</body>
    </html>
  );
}
