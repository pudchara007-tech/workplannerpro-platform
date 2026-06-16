import ProjectsClient from "./ProjectsClient";

export default function ProjectsPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-1">🏗️ โครงการ</h1>
      <p className="text-gray-400 mb-6">งานก่อสร้าง ส่งตรวจ ทีม — เลือกโครงการเพื่อจัดการงาน</p>
      <ProjectsClient />
    </div>
  );
}
