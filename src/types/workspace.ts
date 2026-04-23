export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberProfile {
  user_id: string;
  display_name: string | null;
  email: string | null;
  designation: string | null;
  avatar_url: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  profile?: MemberProfile | null;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by_user_id: string;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}
