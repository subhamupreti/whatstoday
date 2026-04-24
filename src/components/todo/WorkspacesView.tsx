import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CheckCircle2, LogOut, Mail, Plus, Shield, UserPlus, Users, X } from "lucide-react";
import type { Workspace, WorkspaceInvitation, WorkspaceMember, WorkspaceRole } from "@/types/workspace";

const PRESET_NAMES = ["Personal", "Official", "Other"] as const;
type PresetName = typeof PRESET_NAMES[number];

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function roleTone(role: WorkspaceRole) {
  if (role === "owner") return "bg-primary/15 text-primary border-primary/25";
  if (role === "admin") return "bg-accent/15 text-accent border-accent/25";
  return "bg-secondary text-muted-foreground border-border";
}

interface Props {
  currentUserId: string;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeMembers: WorkspaceMember[];
  managedInvitations: WorkspaceInvitation[];
  incomingInvitations: WorkspaceInvitation[];
  onSwitchWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<string | null>;
  onInviteMember: (workspaceId: string, email: string, role: WorkspaceRole) => Promise<boolean>;
  onAcceptInvitation: (invitationId: string) => Promise<boolean>;
  onRejectInvitation: (invitationId: string) => Promise<boolean>;
  onLeaveWorkspace: (workspaceId: string) => Promise<boolean>;
  onRemoveMember: (workspaceId: string, memberUserId: string) => Promise<boolean>;
}

export function WorkspacesView({
  currentUserId,
  workspaces,
  activeWorkspaceId,
  activeMembers,
  managedInvitations,
  incomingInvitations,
  onSwitchWorkspace,
  onCreateWorkspace,
  onInviteMember,
  onAcceptInvitation,
  onRejectInvitation,
  onLeaveWorkspace,
  onRemoveMember,
}: Props) {
  const [presetName, setPresetName] = useState<PresetName>("Personal");
  const [customName, setCustomName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  );
  const isOwner = activeWorkspace?.owner_user_id === currentUserId;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = presetName === "Other" ? customName.trim() : presetName;
    if (!name) return;
    setCreating(true);
    const created = await onCreateWorkspace(name);
    setCreating(false);
    if (created) {
      setPresetName("Personal");
      setCustomName("");
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !inviteEmail.trim()) return;
    setInviting(true);
    const ok = await onInviteMember(activeWorkspaceId, inviteEmail.trim(), inviteRole);
    setInviting(false);
    if (ok) setInviteEmail("");
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    await onRejectInvitation(id);
    setBusyId(null);
  };

  const handleAccept = async (id: string) => {
    setBusyId(id);
    await onAcceptInvitation(id);
    setBusyId(null);
  };

  const handleLeave = async () => {
    if (!activeWorkspaceId) return;
    if (!confirm(`Leave workspace "${activeWorkspace?.name}"? You won't see its tasks anymore.`)) return;
    setBusyId(activeWorkspaceId);
    await onLeaveWorkspace(activeWorkspaceId);
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      <section className="glass-bezel rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Workspaces</h2>
            <p className="text-sm text-muted-foreground">Switch context, invite teammates, and keep tasks organized.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label>Current workspace</Label>
            <Select value={activeWorkspaceId ?? undefined} onValueChange={onSwitchWorkspace}>
              <SelectTrigger className="h-11 rounded-2xl bg-card">
                <SelectValue placeholder="Choose a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-2xl border border-border px-4 py-3 bg-card/60">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">Active members</p>
            <p className="mt-1 text-2xl font-bold">{activeMembers.length}</p>
          </div>
        </div>

        {activeWorkspace && !isOwner && (
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-2xl text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLeave}
            disabled={busyId === activeWorkspaceId}
          >
            <LogOut size={16} className="mr-2" />
            {busyId === activeWorkspaceId ? "Leaving…" : `Leave "${activeWorkspace.name}"`}
          </Button>
        )}
      </section>

      <section className="glass-bezel rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus size={18} className="text-primary" />
          <h3 className="font-semibold">Create a workspace</h3>
        </div>
        <form onSubmit={create} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={presetName} onValueChange={(v) => setPresetName(v as PresetName)}>
                <SelectTrigger className="h-11 rounded-2xl bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_NAMES.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {presetName === "Other" ? (
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Custom name</Label>
                <Input
                  id="workspace-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Marketing, Design, Startup…"
                  className="h-11 rounded-2xl"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="h-11 rounded-2xl border border-border bg-card/60 px-4 flex items-center text-sm text-muted-foreground">
                  Will create "{presetName}"
                </div>
              </div>
            )}
            <Button type="submit" variant="velocity" className="h-11 rounded-2xl" disabled={creating || (presetName === "Other" && !customName.trim())}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </section>

      <section className="glass-bezel rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus size={18} className="text-primary" />
          <h3 className="font-semibold">Invite registered users</h3>
        </div>
        <form onSubmit={invite} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="h-11 rounded-2xl"
                disabled={!activeWorkspaceId}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as WorkspaceRole)}>
                <SelectTrigger className="h-11 rounded-2xl bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" variant="velocity" className="w-full rounded-2xl" disabled={inviting || !activeWorkspaceId}>
            {inviting ? "Sending invite…" : `Invite to ${activeWorkspace?.name ?? "workspace"}`}
          </Button>
        </form>

        {managedInvitations.length > 0 && (
          <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">Pending invites</p>
            <div className="space-y-2">
              {managedInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <Mail size={14} className="shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">{invitation.role}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleReject(invitation.id)}
                    disabled={busyId === invitation.id}
                  >
                    <X size={14} className="mr-1" />
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {incomingInvitations.length > 0 && (
        <section className="glass-bezel rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-primary" />
            <h3 className="font-semibold">Incoming invitations</h3>
          </div>
          <div className="space-y-3">
            {incomingInvitations.map((invitation) => (
              <div key={invitation.id} className="rounded-2xl border border-border bg-card/60 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">Join as {invitation.role}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleReject(invitation.id)}
                    disabled={busyId === invitation.id}
                  >
                    <X size={14} className="mr-1" /> Reject
                  </Button>
                  <Button
                    variant="velocity"
                    size="sm"
                    className="rounded-full"
                    onClick={() => handleAccept(invitation.id)}
                    disabled={busyId === invitation.id}
                  >
                    Join
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="glass-bezel rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h3 className="font-semibold">Members</h3>
        </div>
        <div className="space-y-3">
          {activeMembers.map((member) => (
            <div key={member.id} className="rounded-2xl border border-border bg-card/60 px-4 py-3 flex items-center gap-3">
              <Avatar className="size-11 ring-1 ring-border">
                <AvatarImage src={member.profile?.avatar_url ?? undefined} alt={member.profile?.display_name ?? member.profile?.email ?? "Member avatar"} />
                <AvatarFallback className="bg-secondary font-semibold">
                  {initials(member.profile?.display_name, member.profile?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{member.profile?.display_name || member.profile?.email || "Workspace member"}</p>
                <p className="text-xs text-muted-foreground truncate">{member.profile?.designation || member.profile?.email || "No profile details yet"}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${roleTone(member.role)}`}>
                {member.role === "owner" ? <span className="inline-flex items-center gap-1"><Shield size={10} /> Owner</span> : member.role}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
