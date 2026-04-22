import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useAssignments } from "@/hooks/useAssignments";
import { useAssignmentAlerts } from "@/hooks/useAssignmentAlerts";
import type { Assignment, NewAssignment } from "@/types/assignment";
import { AssignmentCard } from "./AssignmentCard";
import { AssignmentSheet } from "./AssignmentSheet";
import { Plus, BookOpen } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";

export function AssignmentsView({ user }: { user: User }) {
  const { assignments, loading, create, update, remove, toggleComplete } = useAssignments(user.id);
  useAssignmentAlerts(assignments);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);

  const stats = useMemo(() => {
    const total = assignments.length;
    const done = assignments.filter((a) => a.status === "completed").length;
    const overdue = assignments.filter((a) => a.status === "overdue").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, overdue, pct };
  }, [assignments]);

  const grouped = useMemo(() => {
    return {
      overdue: assignments.filter((a) => a.status === "overdue"),
      pending: assignments.filter((a) => a.status === "pending"),
      completed: assignments.filter((a) => a.status === "completed"),
    };
  }, [assignments]);

  const handleSubmit = async (payload: NewAssignment, id?: string) => {
    if (id) {
      await update(id, {
        subject: payload.subject,
        title: payload.title,
        description: payload.description ?? null,
        due_date: payload.due_date ?? null,
        progress: payload.progress ?? 0,
      });
    } else {
      await create(payload);
    }
    setEditing(null);
  };

  return (
    <div>
      {/* Stats card */}
      <div className="rounded-2xl card-gradient border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold">
              Overall progress
            </p>
            <p className="text-2xl font-bold mt-0.5">
              {stats.done}
              <span className="text-muted-foreground text-base font-medium"> / {stats.total} done</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums">{stats.pct}%</p>
            {stats.overdue > 0 && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-destructive mt-0.5">
                {stats.overdue} overdue
              </p>
            )}
          </div>
        </div>
        <Progress value={stats.pct} className="h-2" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl card-gradient animate-pulse" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary inline-flex items-center justify-center mb-3">
            <BookOpen size={22} />
          </div>
          <h3 className="text-lg font-semibold mb-1">No assignments yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Track homework, projects, and submissions in one place.
          </p>
          <button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="btn-velocity text-primary-foreground rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wider"
          >
            Add your first
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {(["overdue", "pending", "completed"] as const).map((key) => {
            const list = grouped[key];
            if (!list.length) return null;
            return (
              <section key={key}>
                <h2 className="text-[11px] uppercase tracking-[0.25em] font-bold text-muted-foreground mb-3">
                  {key} · {list.length}
                </h2>
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {list.map((a) => (
                      <AssignmentCard
                        key={a.id}
                        assignment={a}
                        onToggle={toggleComplete}
                        onEdit={(x) => {
                          setEditing(x);
                          setOpen(true);
                        }}
                        onDelete={remove}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        aria-label="Add assignment"
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
        className="fixed right-6 bottom-28 z-30 size-14 rounded-2xl btn-velocity flex items-center justify-center text-primary-foreground active:scale-95 transition-transform"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <AssignmentSheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        assignment={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
