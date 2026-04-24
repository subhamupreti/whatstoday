import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MemberProfile, Workspace, WorkspaceInvitation, WorkspaceMember, WorkspaceRole } from "@/types/workspace";

const ACTIVE_WORKSPACE_KEY = "todoflow-active-workspace";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function normalizeWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: String(row.id),
    owner_user_id: String(row.owner_user_id),
    name: String(row.name),
    slug: row.slug ? String(row.slug) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeMember(row: Record<string, unknown>): WorkspaceMember {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    user_id: String(row.user_id),
    role: row.role as WorkspaceRole,
    invited_by_user_id: row.invited_by_user_id ? String(row.invited_by_user_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeInvitation(row: Record<string, unknown>): WorkspaceInvitation {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    email: String(row.email),
    role: row.role as WorkspaceRole,
    invited_by_user_id: String(row.invited_by_user_id),
    accepted_by_user_id: row.accepted_by_user_id ? String(row.accepted_by_user_id) : null,
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeProfile(row: Record<string, unknown>): MemberProfile {
  return {
    user_id: String(row.user_id),
    display_name: row.display_name ? String(row.display_name) : null,
    email: row.email ? String(row.email) : null,
    designation: row.designation ? String(row.designation) : null,
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
  };
}

export function useWorkspaces(userId: string | undefined) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data: workspaceRows, error: workspaceError } = await sb
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: true });

    if (workspaceError) {
      toast.error(workspaceError.message);
      setLoading(false);
      return;
    }

    const workspaceList = ((workspaceRows ?? []) as Record<string, unknown>[]).map(normalizeWorkspace);
    setWorkspaces(workspaceList);

    const stored = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    const nextActive = workspaceList.find((w) => w.id === activeWorkspaceId)
      ? activeWorkspaceId
      : workspaceList.find((w) => w.id === stored)?.id ?? workspaceList[0]?.id ?? null;

    if (nextActive !== activeWorkspaceId) setActiveWorkspaceId(nextActive);
    if (nextActive) localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextActive);

    const workspaceIds = workspaceList.map((w) => w.id);
    if (!workspaceIds.length) {
      setMembers([]);
      setInvitations([]);
      setLoading(false);
      return;
    }

    const [{ data: memberRows, error: memberError }, { data: invitationRows, error: invitationError }] =
      await Promise.all([
        sb.from("workspace_members").select("*").in("workspace_id", workspaceIds).order("created_at", { ascending: true }),
        sb.from("workspace_invitations").select("*").is("accepted_at", null).order("created_at", { ascending: false }),
      ]);

    if (memberError) toast.error(memberError.message);
    if (invitationError) toast.error(invitationError.message);

    const memberList = ((memberRows ?? []) as Record<string, unknown>[]).map(normalizeMember);
    const invitationList = ((invitationRows ?? []) as Record<string, unknown>[]).map(normalizeInvitation);

    const memberIds = [...new Set(memberList.map((member) => member.user_id))];
    let profileMap = new Map<string, MemberProfile>();

    if (memberIds.length) {
      const { data: profileRows, error: profileError } = await sb
        .from("profiles")
        .select("user_id, display_name, email, designation, avatar_url")
        .in("user_id", memberIds);

      if (profileError) {
        toast.error(profileError.message);
      } else {
        profileMap = new Map(
          ((profileRows ?? []) as Record<string, unknown>[])
            .map(normalizeProfile)
            .map((profile) => [profile.user_id, profile]),
        );
      }
    }

    setMembers(memberList.map((member) => ({ ...member, profile: profileMap.get(member.user_id) ?? null })));
    setInvitations(invitationList);
    setLoading(false);
  }, [activeWorkspaceId, userId]);

  useEffect(() => {
    if (!userId) return;
    fetchAll();

    const workspaceChannel = sb
      .channel(`workspaces-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspaces" }, () => fetchAll())
      .subscribe();

    const memberChannel = sb
      .channel(`workspace-members-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members" }, () => fetchAll())
      .subscribe();

    const invitationChannel = sb
      .channel(`workspace-invitations-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_invitations" }, () => fetchAll())
      .subscribe();

    return () => {
      sb.removeChannel(workspaceChannel);
      sb.removeChannel(memberChannel);
      sb.removeChannel(invitationChannel);
    };
  }, [fetchAll, userId]);

  useEffect(() => {
    if (activeWorkspaceId) localStorage.setItem(ACTIVE_WORKSPACE_KEY, activeWorkspaceId);
  }, [activeWorkspaceId]);

  const membersByWorkspace = useMemo(() => {
    return members.reduce<Record<string, WorkspaceMember[]>>((acc, member) => {
      acc[member.workspace_id] ??= [];
      acc[member.workspace_id].push(member);
      return acc;
    }, {});
  }, [members]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  const activeMembers = useMemo(
    () => (activeWorkspaceId ? membersByWorkspace[activeWorkspaceId] ?? [] : []),
    [activeWorkspaceId, membersByWorkspace],
  );

  const managedInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.workspace_id === activeWorkspaceId),
    [invitations, activeWorkspaceId],
  );

  const incomingInvitations = useMemo(() => {
    const myWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    return invitations.filter((invitation) => !myWorkspaceIds.has(invitation.workspace_id));
  }, [invitations, workspaces]);

  const createWorkspace = async (name: string) => {
    const { data, error } = await sb.rpc("create_workspace", { _name: name });
    if (error) {
      toast.error(error.message);
      return null;
    }
    toast.success("Workspace created");
    await fetchAll();
    if (data) setActiveWorkspaceId(String(data));
    return data ? String(data) : null;
  };

  const inviteMember = async (workspaceId: string, email: string, role: WorkspaceRole) => {
    const { error } = await sb.rpc("create_workspace_invitation", {
      _workspace_id: workspaceId,
      _email: email,
      _role: role,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Invitation sent");
    await fetchAll();
    return true;
  };

  const acceptInvitation = async (invitationId: string) => {
    const { data, error } = await sb.rpc("accept_workspace_invitation", { _invitation_id: invitationId });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Workspace joined");
    await fetchAll();
    if (data) setActiveWorkspaceId(String(data));
    return true;
  };

  const rejectInvitation = async (invitationId: string) => {
    const { error } = await sb.from("workspace_invitations").delete().eq("id", invitationId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Invitation removed");
    await fetchAll();
    return true;
  };

  const leaveWorkspace = async (workspaceId: string) => {
    if (!userId) return false;
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (ws && ws.owner_user_id === userId) {
      toast.error("Owners can't leave their own workspace");
      return false;
    }
    const { error } = await sb
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Left workspace");
    if (activeWorkspaceId === workspaceId) {
      const next = workspaces.find((w) => w.id !== workspaceId)?.id ?? null;
      setActiveWorkspaceId(next);
    }
    await fetchAll();
    return true;
  };

  const removeMember = async (workspaceId: string, memberUserId: string) => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (ws && ws.owner_user_id === memberUserId) {
      toast.error("The workspace owner can't be removed");
      return false;
    }
    const { error } = await sb
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", memberUserId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Member removed");
    await fetchAll();
    return true;
  };

  return {
    workspaces,
    members,
    membersByWorkspace,
    activeMembers,
    invitations,
    managedInvitations,
    incomingInvitations,
    activeWorkspaceId,
    activeWorkspace,
    loading,
    setActiveWorkspaceId,
    createWorkspace,
    inviteMember,
    acceptInvitation,
    rejectInvitation,
    leaveWorkspace,
    refetch: fetchAll,
  };
}
