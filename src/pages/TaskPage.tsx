import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Task } from "@/types/task";
import { Button } from "@/components/ui/button";
import { RichTextRenderer } from "@/components/todo/RichTextRenderer";
import { MusicLinksList } from "@/components/todo/MusicLinks";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Check, Flag, Loader2, Pencil, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const priorityStyles: Record<Task["priority"], { label: string; cls: string }> = {
  high: { label: "High priority", cls: "text-primary" },
  medium: { label: "Medium priority", cls: "text-amber-400" },
  low: { label: "Low priority", cls: "text-muted-foreground" },
};

export default function TaskPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
    if (error) {
      setError(error.message);
    } else if (!data) {
      setError("Task not found or you don't have access.");
    } else {
      setTask(data as Task);
      setError(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=/task/${id}`, { replace: true });
      return;
    }
    fetchTask();
    const ch = supabase
      .channel(`task-page-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `id=eq.${id}` },
        () => fetchTask(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [authLoading, user, id, fetchTask, navigate]);

  const toggle = async () => {
    if (!task) return;
    const next = task.status === "pending" ? "completed" : "pending";
    setTask({ ...task, status: next, completed_at: next === "completed" ? new Date().toISOString() : null });
    const { error } = await supabase
      .from("tasks")
      .update({
        status: next,
        completed_at: next === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      fetchTask();
    }
  };

  const remove = async () => {
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task deleted");
    navigate("/", { replace: true });
  };

  if (loading || authLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </main>
    );
  }

  if (error || !task) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Task unavailable."}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft size={16} className="mr-2" /> Back home
        </Button>
      </main>
    );
  }

  const isOwner = task.user_id === user?.id;
  const completed = task.status === "completed";
  const ps = priorityStyles[task.priority];

  return (
    <main className="min-h-dvh bg-background text-foreground flex flex-col">
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 h-[360px] -z-10 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />

      <header className="flex items-center justify-between px-5 pt-5 pb-3 max-w-2xl w-full mx-auto">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="size-10 rounded-full bg-secondary/60 flex items-center justify-center hover:bg-secondary"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => navigate(`/?edit=${task.id}`)}
              aria-label="Edit"
              className="size-10 rounded-full bg-secondary/60 flex items-center justify-center hover:bg-secondary"
            >
              <Pencil size={18} />
            </button>
          )}
          <button
            onClick={remove}
            aria-label="Delete"
            className="size-10 rounded-full bg-secondary/60 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      <section className="flex-1 px-5 pb-32">
        <div className="max-w-2xl mx-auto pt-2">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider", ps.cls)}>
              <Flag size={12} /> {ps.label}
            </span>
            {!isOwner && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-accent/15 text-accent border border-accent/25">
                <Users size={10} /> Shared
              </span>
            )}
            {completed && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-primary/15 text-primary border border-primary/25">
                <Check size={10} /> Done
              </span>
            )}
          </div>

          <h1 className={cn("text-3xl sm:text-4xl font-bold tracking-tight leading-tight", completed && "line-through opacity-60")}>
            {task.title}
          </h1>

          {task.due_date && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar size={14} />
              {format(new Date(task.due_date), "EEEE · MMM d, yyyy · h:mm a")}
            </p>
          )}

          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {task.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase tracking-wider"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-3">
              Notes
            </p>
            {task.description ? (
              <RichTextRenderer html={task.description} />
            ) : (
              <p className="text-sm text-muted-foreground italic">No notes yet.</p>
            )}
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-3">
              Music
            </p>
            {task.music_links && task.music_links.length > 0 ? (
              <MusicLinksList links={task.music_links} />
            ) : (
              <p className="text-sm text-muted-foreground italic">No music links added.</p>
            )}
          </div>
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 px-5 pb-6 pt-4 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={toggle}
            variant={completed ? "outline" : "velocity"}
            className="w-full"
            size="lg"
          >
            <Check size={18} className="mr-2" />
            {completed ? "Mark as pending" : "Mark complete"}
          </Button>
        </div>
      </div>
    </main>
  );
}
