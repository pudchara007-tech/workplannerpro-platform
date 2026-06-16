import LifeLogClient from "./LifeLogClient";

export default function LifePage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-1">📊 Life Log</h1>
      <p className="text-gray-400 mb-6">บันทึกชีวิต 7 หมวด — จดทุกวัน เพื่อดูแนวโน้มและวิเคราะห์</p>
      <LifeLogClient />
    </div>
  );
}
