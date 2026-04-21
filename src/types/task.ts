export type TaskStatus = "pending" | "completed";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  music_links: string[];
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewTask {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  tags?: string[];
  music_links?: string[];
  due_date?: string | null;
}
