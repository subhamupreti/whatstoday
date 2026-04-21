import { useEffect, useState, useMemo, useCallback } from "react";
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
import { Plus } from "lucide-react";

export function TodoApp({ user }: { user: User }) {
  const [view, setView] = useState<ViewKey>("today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [shareTask, setShareTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setTasks((data ?? []) as Task[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    // Realtime: listen to ALL task changes (RLS filters server-side to owned + shared).
    // We don't filter by user_id here so that shared tasks owned by others also stream in.
    const tasksCh = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => fetchTasks(),
      )
      .subscribe();
    const sharesCh = supabase
      .channel("task-shares-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_shares" },
        () => fetchTasks(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(tasksCh);
      supabase.removeChannel(sharesCh);
    };
  }, [user.id, fetchTasks]);

  const upsertTask = async (payload: NewTask, id?: string): Promise<void> => {
    if (id) {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: payload.title,
          description: payload.description ?? null,
          priority: payload.priority ?? "medium",
          tags: payload.tags ?? [],
          due_date: payload.due_date ?? null,
        })
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Task updated");
    } else {
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: payload.title,
        description: payload.description ?? null,
        priority: payload.priority ?? "medium",
        tags: payload.tags ?? [],
        due_date: payload.due_date ?? null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Task added");
    }
    setSheetOpen(false);
    setEditing(null);
    setDefaultDate(null);
  };

  const toggleStatus = async (task: Task) => {
    const next = task.status === "pending" ? "completed" : "pending";
    // optimistic
    setTasks((t) =>
      t.map((x) =>
        x.id === task.id
          ? { ...x, status: next, completed_at: next === "completed" ? new Date().toISOString() : null }
          : x,
      ),
    );
    const { error } = await supabase
      .from("tasks")
      .update({
        status: next,
        completed_at: next === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      fetchTasks();
    }
  };

  const deleteTask = async (id: string) => {
    setTasks((t) => t.filter((x) => x.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      fetchTasks();
    } else {
      toast.success("Task deleted");
    }
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
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-8">
              {view === "today" ? "WHAT'S TODAY?" : heading}
            </h1>

            {loading ? (
              <SkeletonList />
            ) : view === "today" ? (
              <TodayView tasks={tasks} currentUserId={user.id} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteTask} onAdd={() => openNew()} onShare={setShareTask} />
            ) : view === "week" ? (
              <WeekView tasks={tasks} currentUserId={user.id} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteTask} onAddForDate={openNew} onShare={setShareTask} />
            ) : view === "month" ? (
              <MonthView tasks={tasks} currentUserId={user.id} onSelectDate={openNew} onEdit={openEdit} onToggle={toggleStatus} onDelete={deleteTask} onShare={setShareTask} />
            ) : (
              <SettingsView user={user} />
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
