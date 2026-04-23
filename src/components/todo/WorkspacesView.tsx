import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CheckCircle2, Mail, Plus, Shield, UserPlus, Users } from "lucide-react";
import type { Workspace, WorkspaceInvitation, WorkspaceMember, WorkspaceRole } from "@/types/workspace";

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
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeMembers: WorkspaceMember[];
  managedInvitations: WorkspaceInvitation[];
  incomingInvitations: WorkspaceInvitation[];
  onSwitchWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<string | null>;
  onInviteMember: (workspaceId: string, email: string, role: WorkspaceRole) => Promise<boolean>;
  onAcceptInvitation: (invitationId: string) => Promise<boolean>;
}

export function WorkspacesView({
  workspaces,
  activeWorkspaceId,
  activeMembers,
  managedInvitations,
  incomingInvitations,
  onSwitchWorkspace,
  onCreateWorkspace,
  onInviteMember,
  onAcceptInvitation,
}: Props) {
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    setCreating(true);
    const created = await onCreateWorkspace(workspaceName.trim());
    setCreating(false);
    if (created) setWorkspaceName("");
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !inviteEmail.trim()) return;
    setInviting(true);
    const ok = await onInviteMember(activeWorkspaceId, inviteEmail.trim(), inviteRole);
    setInviting(false);
    if (ok) setInviteEmail("");
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
      </section>

      <section className="glass-bezel rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus size={18} className="text-primary" />
          <h3 className="font-semibold">Create a workspace</h3>
        </div>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Marketing, Design, Startup"
              className="h-11 rounded-2xl"
            />
          </div>
          <Button type="submit" variant="velocity" className="h-11 rounded-2xl" disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
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
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">{invitation.role}</p>
                  </div>
                  <Mail size={16} className="shrink-0 text-muted-foreground" />
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
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">Join as {invitation.role}</p>
                </div>
                <Button variant="velocity" className="rounded-2xl" onClick={() => onAcceptInvitation(invitation.id)}>
                  Join
                </Button>
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
