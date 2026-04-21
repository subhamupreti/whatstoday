import type { Task } from "@/types/task";
import { TaskCard } from "./TaskCard";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { Plus } from "lucide-react";
import { useMemo } from "react";

export function WeekView({
  tasks,
  currentUserId,
  onToggle,
  onEdit,
  onDelete,
  onAddForDate,
  onShare,
  onOpen,
}: {
  tasks: Task[];
  currentUserId: string;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onAddForDate: (d: Date) => void;
  onShare: (t: Task) => void;
  onOpen: (t: Task) => void;
}) {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(start, i)), [start]);

  return (
    <div className="space-y-8">
      {days.map((day) => {
        const dayTasks = tasks
          .filter((t) => t.due_date && isSameDay(new Date(t.due_date), day))
          .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
        const isToday = isSameDay(day, new Date());

        return (
          <section key={day.toISOString()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-baseline gap-3">
                <h2 className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}>
                  {format(day, "EEEE")}
                </h2>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {format(day, "MMM d")}
                </span>
              </div>
              <button
                onClick={() => onAddForDate(day)}
                aria-label={`Add task on ${format(day, "MMM d")}`}
                className="size-7 rounded-full glass-bezel flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>

            {dayTasks.length === 0 ? (
              <button
                onClick={() => onAddForDate(day)}
                className="w-full text-left text-sm text-muted-foreground italic px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:text-foreground transition-colors"
              >
                No tasks · tap to add
              </button>
            ) : (
              <ul className="space-y-3">
                {dayTasks.map((t) => (
                  <li key={t.id}>
                    <TaskCard
                      task={t}
                      currentUserId={currentUserId}
                      onToggle={onToggle}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onShare={onShare}
                      onOpen={onOpen}
                      selectable={selectable}
                      selected={selectedIds?.has(t.id)}
                      onToggleSelect={onToggleSelect}
                      onLongPress={onLongPress}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
