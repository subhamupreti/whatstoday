import type { Task } from "@/types/task";
import { TaskCard } from "./TaskCard";
import { ProgressRing } from "./ProgressRing";
import { EmptyState } from "./EmptyState";
import { JoinCodeCard } from "./JoinCodeCard";
import { isSameDay } from "date-fns";
import { useMemo } from "react";

const priorityRank = { high: 0, medium: 1, low: 2 } as const;

export function TodayView({
  tasks,
  currentUserId,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  onShare,
}: {
  tasks: Task[];
  currentUserId: string;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onShare: (t: Task) => void;
}) {
  const today = new Date();
  const todays = useMemo(() => {
    return tasks
      .filter((t) => {
        if (!t.due_date) return false;
        return isSameDay(new Date(t.due_date), today);
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        const pr = priorityRank[a.priority] - priorityRank[b.priority];
        if (pr !== 0) return pr;
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const completed = todays.filter((t) => t.status === "completed").length;
  const pct = todays.length === 0 ? 0 : Math.round((completed / todays.length) * 100);

  const undated = useMemo(
    () => tasks.filter((t) => !t.due_date && t.status === "pending").slice(0, 5),
    [tasks],
  );

  return (
    <div className="space-y-8">
      <div className="glass-bezel rounded-3xl p-5 flex items-center gap-5">
        <ProgressRing value={pct} />
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">Throttle</p>
          <p className="text-3xl font-bold tabular-nums">
            {pct}<span className="text-base text-primary">%</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completed} of {todays.length} completed
          </p>
        </div>
      </div>

      <JoinCodeCard />

      {todays.length === 0 ? (
        <EmptyState
          title="Nothing scheduled today"
          subtitle="Tap + to add your first task for today."
          onAction={onAdd}
          actionLabel="Add task"
        />
      ) : (
        <ul className="space-y-3">
          {todays.map((t) => (
            <li key={t.id}>
              <TaskCard task={t} currentUserId={currentUserId} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onShare={onShare} />
            </li>
          ))}
        </ul>
      )}

      {undated.length > 0 && (
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-3">
            Inbox · No Date
          </h2>
          <ul className="space-y-3">
            {undated.map((t) => (
              <li key={t.id}>
                <TaskCard task={t} currentUserId={currentUserId} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onShare={onShare} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground pt-4">
        Build By SU1000&amp;SK900
      </p>
    </div>
  );
}
