import localforage from "localforage";
import type { Task, NewTask } from "@/types/task";

const tasksStore = localforage.createInstance({
  name: "todoflow",
  storeName: "tasks",
  description: "Cached task list for offline reads",
});

const outboxStore = localforage.createInstance({
  name: "todoflow",
  storeName: "outbox",
  description: "Queued task mutations to replay when back online",
});

const TASKS_KEY = "all";

export type OutboxOp =
  | { id: string; kind: "create"; tempId: string; payload: NewTask & { user_id: string } }
  | { id: string; kind: "update"; taskId: string; patch: Partial<Task> }
  | { id: string; kind: "toggle"; taskId: string; nextStatus: "pending" | "completed"; completedAt: string | null }
  | { id: string; kind: "delete"; taskId: string };

export async function loadCachedTasks(): Promise<Task[] | null> {
  try {
    const cached = await tasksStore.getItem<Task[]>(TASKS_KEY);
    return cached ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedTasks(tasks: Task[]): Promise<void> {
  try {
    await tasksStore.setItem(TASKS_KEY, tasks);
  } catch {}
}

export async function getOutbox(): Promise<OutboxOp[]> {
  const ops: OutboxOp[] = [];
  await outboxStore.iterate<OutboxOp, void>((value) => {
    ops.push(value);
  });
  ops.sort((a, b) => a.id.localeCompare(b.id));
  return ops;
}

type DistributiveOmit<T, K extends keyof T> = T extends T ? Omit<T, K> : never;
export type NewOutboxOp = DistributiveOmit<OutboxOp, "id">;

export async function enqueue(op: NewOutboxOp): Promise<OutboxOp> {
  const id = `${Date.now().toString(36).padStart(10, "0")}-${Math.random().toString(36).slice(2, 8)}`;
  const full = { ...op, id } as OutboxOp;
  await outboxStore.setItem(id, full);
  return full;
}

export async function removeFromOutbox(id: string): Promise<void> {
  await outboxStore.removeItem(id);
}

export async function clearOutbox(): Promise<void> {
  await outboxStore.clear();
}

export async function outboxSize(): Promise<number> {
  return outboxStore.length();
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
