export type AssignmentStatus = "pending" | "completed" | "overdue";

export interface Assignment {
  id: string;
  user_id: string;
  subject: string;
  title: string;
  description: string | null;
  due_date: string | null;
  submitted_at: string | null;
  progress: number;
  status: AssignmentStatus;
  created_at: string;
  updated_at: string;
}

export interface NewAssignment {
  subject: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  progress?: number;
}
