import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Task, NewTask } from "@/types/task";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { TodayView } from "./TodayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { SettingsView } from "./SettingsView";
import { BottomNav, type ViewKey } from "./BottomNav";
import { TaskSheet } from "./TaskSheet";
import { ShareDialog } from "./ShareDialog";
import { BulkShareDialog } from "./BulkShareDialog";
import { SelectionToolbar } from "./SelectionToolbar";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { useOverdueAlerts } from "@/hooks/useOverdueAlerts";
import { Plus, WifiOff, RefreshCw, CheckSquare } from "lucide-react";
import {
  enqueue,
  getOutbox,
  isOnline,
  loadCachedTasks,
  outboxSize,
  removeFromOutbox,
  saveCachedTasks,
  type OutboxOp,
} from "@/lib/offlineStore";

export function TodoApp({ user }: { user: User }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<ViewKey>("today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [shareTask, setShareTask] = useState<Task | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  useOverdueAlerts(tasks);

  const enterSelect = useCallback((seedTask?: Task) => {
    setSelectMode(true);
    if (seedTask && seedTask.user_id === user.id) {
      setSelectedIds(new Set([seedTask.id]));
    }
  }, [user.id]);

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback(
    (t: Task) => {
      if (t.user_id !== user.id) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(t.id)) next.delete(t.id);
        else next.add(t.id);
        return next;
      });
    },
    [user.id],
  );

  const selectedTasks = useMemo(
    () => tasks.filter((t) => selectedIds.has(t.id) && t.user_id === user.id),
    [tasks, selectedIds, user.id],
  );

  const refreshPending = useCallback(async () => {
    setPendingCount(await outboxSize());
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!isOnline()) {
      const cached = await loadCachedTasks();
      if (cached) setTasks(cached);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      // Network/permission failure — fall back to cache silently.
      const cached = await loadCachedTasks();
      if (cached) setTasks(cached);
      else toast.error(error.message);
    } else {
      const list = (data ?? []) as Task[];
      setTasks(list);
      saveCachedTasks(list);
    }
    setLoading(false);
  }, []);

  // Replay one queued op against Supabase. Returns true on success.
  const runOp = useCallback(
    async (op: OutboxOp): Promise<boolean> => {
      if (op.kind === "create") {
        const { error } = await supabase.from("tasks").insert({
          user_id: op.payload.user_id,
          title: op.payload.title,
          description: op.payload.description ?? null,
          priority: op.payload.priority ?? "medium",
          tags: op.payload.tags ?? [],
          music_links: op.payload.music_links ?? [],
          due_date: op.payload.due_date ?? null,
        });
        return !error;
      }
      if (op.kind === "update") {
        const { error } = await supabase.from("tasks").update(op.patch).eq("id", op.taskId);
        return !error;
      }
      if (op.kind === "toggle") {
        const { error } = await supabase
          .from("tasks")
          .update({ status: op.nextStatus, completed_at: op.completedAt })
          .eq("id", op.taskId);
        return !error;
      }
      if (op.kind === "delete") {
        const { error } = await supabase.from("tasks").delete().eq("id", op.taskId);
        return !error;
      }
      return false;
    },
    [],
  );

  const flushOutbox = useCallback(async () => {
    if (!isOnline()) return;
    const ops = await getOutbox();
    if (!ops.length) return;
    let synced = 0;
    for (const op of ops) {
      const ok = await runOp(op);
      if (ok) {
        await removeFromOutbox(op.id);
        synced++;
      } else {
        // Stop on first failure so order is preserved; will retry next flush.
        break;
      }
    }
    await refreshPending();
    if (synced > 0) {
      toast.success(`Synced ${synced} offline change${synced > 1 ? "s" : ""}`);
      fetchTasks();
    }
  }, [runOp, refreshPending, fetchTasks]);

  useEffect(() => {
    fetchTasks();
    refreshPending();
    flushOutbox();

    // Realtime: listen to ALL task changes (RLS filters server-side to owned + shared).
    const tasksCh = supabase
      .channel(`tasks-realtime-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchTasks())
      .subscribe();
    const sharesCh = supabase
      .channel(`task-shares-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_shares" },
        () => fetchTasks(),
      )
      .subscribe();

    const onFocus = () => {
      flushOutbox();
      fetchTasks();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        flushOutbox();
        fetchTasks();
      }
    };
    const onOnline = () => {
      setOnline(true);
      toast.success("Back online — syncing");
      flushOutbox();
      fetchTasks();
    };
    const onOffline = () => {
      setOnline(false);
      toast.warning("You're offline — changes will sync later");
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      supabase.removeChannel(tasksCh);
      supabase.removeChannel(sharesCh);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [user.id, fetchTasks, flushOutbox, refreshPending]);

  const upsertTask = async (payload: NewTask, id?: string): Promise<void> => {
    const nowIso = new Date().toISOString();

    if (id) {
      const patch = {
        title: payload.title,
        description: payload.description ?? null,
        priority: payload.priority ?? "medium",
        tags: payload.tags ?? [],
        music_links: payload.music_links ?? [],
        due_date: payload.due_date ?? null,
      };
      // Optimistic local update
      setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...patch, updated_at: nowIso } : x)));

      if (isOnline()) {
        const { error } = await supabase.from("tasks").update(patch).eq("id", id);
        if (error) {
          await enqueue({ kind: "update", taskId: id, patch });
          await refreshPending();
          toast.message("Saved offline — will sync");
        } else {
          toast.success("Task updated");
        }
      } else {
        await enqueue({ kind: "update", taskId: id, patch });
        await refreshPending();
        toast.message("Saved offline — will sync");
      }
    } else {
      const tempId = `local-${nowIso}-${Math.random().toString(36).slice(2, 6)}`;
      const optimistic: Task = {
        id: tempId,
        user_id: user.id,
        title: payload.title,
        description: payload.description ?? null,
        status: "pending",
        priority: payload.priority ?? "medium",
        tags: payload.tags ?? [],
        music_links: payload.music_links ?? [],
        due_date: payload.due_date ?? null,
        completed_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setTasks((t) => [optimistic, ...t]);

      const insertPayload = { ...payload, user_id: user.id };
      if (isOnline()) {
        const { error } = await supabase.from("tasks").insert({
          user_id: user.id,
          title: payload.title,
          description: payload.description ?? null,
          priority: payload.priority ?? "medium",
          tags: payload.tags ?? [],
          music_links: payload.music_links ?? [],
          due_date: payload.due_date ?? null,
        });
        if (error) {
          await enqueue({ kind: "create", tempId, payload: insertPayload });
          await refreshPending();
          toast.message("Saved offline — will sync");
        } else {
          toast.success("Task added");
        }
      } else {
        await enqueue({ kind: "create", tempId, payload: insertPayload });
        await refreshPending();
        toast.message("Saved offline — will sync");
      }
    }

    setSheetOpen(false);
    setEditing(null);
    setDefaultDate(null);
    if (isOnline()) fetchTasks();
    else saveCachedTasks(tasks);
  };

  const toggleStatus = async (task: Task) => {
    const next = task.status === "pending" ? "completed" : "pending";
    const completedAt = next === "completed" ? new Date().toISOString() : null;
    setTasks((t) =>
      t.map((x) => (x.id === task.id ? { ...x, status: next, completed_at: completedAt } : x)),
    );

    if (task.id.startsWith("local-")) {
      // Local-only task that hasn't synced yet — keep change in cache only.
      return;
    }

    if (isOnline()) {
      const { error } = await supabase
        .from("tasks")
        .update({ status: next, completed_at: completedAt })
        .eq("id", task.id);
      if (error) {
        await enqueue({ kind: "toggle", taskId: task.id, nextStatus: next, completedAt });
        await refreshPending();
      }
    } else {
      await enqueue({ kind: "toggle", taskId: task.id, nextStatus: next, completedAt });
      await refreshPending();
    }
  };

  const deleteTask = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;

    // Optimistic remove
    setTasks((t) => t.filter((x) => x.id !== id));

    let undone = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const performDelete = async () => {
      if (undone) return;
      if (id.startsWith("local-")) return; // Never reached server
      if (isOnline()) {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) {
          await enqueue({ kind: "delete", taskId: id });
          await refreshPending();
        }
      } else {
        await enqueue({ kind: "delete", taskId: id });
        await refreshPending();
      }
    };

    const toastId = toast("Task deleted", {
      description: target.title,
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          if (timer) clearTimeout(timer);
          setTasks((t) => (t.some((x) => x.id === id) ? t : [...t, target]));
          toast.dismiss(toastId);
          toast.success("Restored");
        },
      },
    });

    timer = setTimeout(performDelete, 5000);
  };

  const openNew = (date?: Date) => {
    setEditing(null);
    setDefaultDate(date ?? null);
    setSheetOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setSheetOpen(true);
  };

  const openDetail = (task: Task) => navigate(`/task/${task.id}`);
  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [detailTaskId, tasks],
  );

  // Honour ?edit=ID (from the dedicated /task/:id page) and ?settings=1.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId) {
      const t = tasks.find((x) => x.id === editId);
      if (t) {
        openEdit(t);
        const next = new URLSearchParams(searchParams);
        next.delete("edit");
        setSearchParams(next, { replace: true });
      }
    }
    if (searchParams.get("settings") === "1") {
      setView("settings");
      const next = new URLSearchParams(searchParams);
      next.delete("settings");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tasks]);

  const heading = useMemo(() => {
    return { today: "Today", week: "This Week", month: "This Month", settings: "Settings" }[view];
  }, [view]);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Ambient gradient */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 h-[360px] -z-10 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />

      <main className="flex-1 mx-auto w-full max-w-2xl px-5 pt-10 pb-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
              {view === "today" ? "WHAT'S TODAY?" : heading}
            </h1>
            {(!online || pendingCount > 0) && (
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider">
                {!online ? (
                  <>
                    <WifiOff size={12} className="text-muted-foreground" />
                    <span className="text-muted-foreground">Offline</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} className="text-primary animate-spin" />
                    <span className="text-primary">Syncing</span>
                  </>
                )}
                {pendingCount > 0 && (
                  <span className="text-muted-foreground normal-case tracking-normal">
                    · {pendingCount} pending
                  </span>
                )}
              </div>
            )}
            {!(!online || pendingCount > 0) && <div className="mb-8" />}

            {loading ? (
              <SkeletonList />
            ) : view === "today" ? (
              <TodayView tasks={tasks} currentUserId={user.id} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteTask} onAdd={() => openNew()} onShare={setShareTask} onOpen={openDetail} />
            ) : view === "week" ? (
              <WeekView tasks={tasks} currentUserId={user.id} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteTask} onAddForDate={openNew} onShare={setShareTask} onOpen={openDetail} />
            ) : view === "month" ? (
              <MonthView tasks={tasks} currentUserId={user.id} onSelectDate={openNew} onEdit={openEdit} onToggle={toggleStatus} onDelete={deleteTask} onShare={setShareTask} onOpen={openDetail} />
            ) : (
              <SettingsView user={user} onSyncNow={flushOutbox} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FAB */}
      {view !== "settings" && (
        <button
          aria-label="Add task"
          onClick={() => openNew()}
          className="fixed right-6 bottom-28 z-30 size-14 rounded-2xl btn-velocity flex items-center justify-center text-primary-foreground active:scale-95 transition-transform"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      <BottomNav active={view} onChange={setView} />

      <TaskSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) {
            setEditing(null);
            setDefaultDate(null);
          }
        }}
        task={editing}
        defaultDate={defaultDate}
        onSubmit={upsertTask}
      />

      <ShareDialog task={shareTask} open={!!shareTask} onOpenChange={(o) => !o && setShareTask(null)} />

      <TaskDetailSheet
        task={detailTask}
        currentUserId={user.id}
        open={!!detailTask}
        onOpenChange={(o) => !o && setDetailTaskId(null)}
        onToggle={toggleStatus}
        onEdit={(t) => {
          setDetailTaskId(null);
          openEdit(t);
        }}
        onDelete={deleteTask}
        onShare={setShareTask}
      />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl card-gradient animate-pulse" />
      ))}
    </div>
  );
}
