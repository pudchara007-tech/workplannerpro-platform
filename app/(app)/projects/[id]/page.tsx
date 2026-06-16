import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProjectDetailClient from "./ProjectDetailClient";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) notFound();

  return (
    <div className="w-full">
      <Link href="/projects" className="text-sm text-gray-400 hover:text-brand">← โครงการทั้งหมด</Link>
      <div className="flex items-center gap-3 mt-2 mb-6">
        <span className="w-11 h-11 rounded-lg flex items-center justify-center text-2xl" style={{ background: (project.color || "#3b82f6") + "22" }}>{project.icon || "🏗️"}</span>
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {project.description && <p className="text-gray-400 text-sm">{project.description}</p>}
        </div>
      </div>
      <ProjectDetailClient project={project} />
    </div>
  );
}
