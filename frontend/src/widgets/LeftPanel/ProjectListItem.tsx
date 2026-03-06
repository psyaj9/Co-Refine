import { FolderOpen, Trash2 } from "lucide-react";

interface ProjectListItemProps {
  id: string;
  name: string;
  documentCount: number;
  codeCount: number;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export default function ProjectListItem({
  id,
  name,
  documentCount,
  codeCount,
  onSelect,
  onDelete,
}: ProjectListItemProps) {
  return (
    <li
      role="option"
      aria-selected={false}
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(id);
        }
      }}
      className="group flex items-center gap-2 cursor-pointer rounded px-2 py-2 text-sm panel-hover transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
    >
      <FolderOpen size={14} className="text-surface-400 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-surface-700 dark:text-surface-200">{name}</p>
        <p className="text-2xs text-surface-400">
          {documentCount} doc{documentCount !== 1 ? "s" : ""} &middot;{" "}
          {codeCount} code{codeCount !== 1 ? "s" : ""}
        </p>
      </div>
      <button
        onClick={(e) => onDelete(e, id)}
        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 text-surface-400 hover:text-red-500 transition-opacity"
        title="Delete project"
        aria-label={`Delete ${name}`}
      >
        <Trash2 size={12} aria-hidden="true" />
      </button>
    </li>
  );
}
