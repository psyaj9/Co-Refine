import { useState, useEffect } from "react";
import { UserPlus, Trash2, Crown, User } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { fetchProjectMembers, inviteProjectMember, removeProjectMember } from "@/shared/api/client";
import { useStore } from "@/shared/store";
import type { MemberOut } from "@/shared/types";

interface MembersTabProps {
  projectId: string;
}

export default function MembersTab({ projectId }: MembersTabProps) {
  const authUser = useStore((s) => s.authUser);
  const [members, setMembers] = useState<MemberOut[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserIsOwner = members.some(
    (m) => m.user_id === authUser?.user_id && m.role === "owner"
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProjectMembers(projectId)
      .then((data) => { if (!cancelled) { setMembers(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setInviting(true);
    setError(null);
    try {
      const newMember = await inviteProjectMember(projectId, trimmed);
      setMembers((prev) => [...prev, newMember]);
      setEmail("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invite failed";
      setError(msg.includes("404") ? "No account found with that email." : msg.includes("409") ? "User is already a member." : msg);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeProjectMember(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Remove failed";
      setError(msg);
    }
  };

  if (loading) {
    return <p className="text-xs text-surface-400 py-2">Loading members…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Member list */}
      <ul className="space-y-1.5">
        {members.map((m) => (
          <li
            key={m.user_id}
            className="flex items-center gap-2 rounded-md px-3 py-2 bg-surface-50 dark:bg-surface-800 border panel-border"
          >
            {m.role === "owner" ? (
              <Crown size={13} className="text-amber-500 flex-shrink-0" aria-hidden="true" />
            ) : (
              <User size={13} className="text-surface-400 flex-shrink-0" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-surface-700 dark:text-surface-200 truncate">
                {m.display_name}
              </p>
              <p className="text-[11px] text-surface-400 dark:text-surface-500 truncate">{m.email}</p>
            </div>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded capitalize",
              m.role === "owner"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400"
            )}>
              {m.role}
            </span>
            {currentUserIsOwner && m.role !== "owner" && (
              <button
                onClick={() => handleRemove(m.user_id)}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-400 hover:text-red-500 transition-colors"
                aria-label={`Remove ${m.display_name} from project`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Invite section (owner only) */}
      {currentUserIsOwner && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-surface-600 dark:text-surface-400">
            Invite by email
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              placeholder="researcher@example.com"
              className="flex-1 text-xs px-2.5 py-1.5 rounded border panel-border bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-200 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Invite member by email"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium transition-colors",
                inviting || !email.trim()
                  ? "bg-surface-200 text-surface-400 cursor-not-allowed"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              )}
              aria-label="Send invite"
            >
              <UserPlus size={12} aria-hidden="true" />
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>
      )}

      {members.length === 0 && (
        <p className="text-xs text-surface-400 text-center py-4">No members yet.</p>
      )}
    </div>
  );
}
