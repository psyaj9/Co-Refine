import { useState } from "react";
import { useStore } from "@/shared/store";

export function useProjectActions() {
  const createProject = useStore((s) => s.createProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const setActiveProject = useStore((s) => s.setActiveProject);

  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const project = await createProject(newProjectName.trim());
    setNewProjectName("");
    setShowNewProject(false);
    setActiveProject(project.id);
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this project and ALL its documents, codes, and analyses?")) return;
    await deleteProject(id);
  };

  return {
    newProjectName,
    setNewProjectName,
    showNewProject,
    setShowNewProject,
    handleCreateProject,
    handleDeleteProject,
  };
}
