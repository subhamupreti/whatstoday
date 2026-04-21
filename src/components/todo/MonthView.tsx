import type { Task } from "@/types/task";
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { cn } from "@/lib/utils";

export function MonthView({
  tasks,
  currentUserId,
  onSelectDate,
  onEdit,
  onToggle,
  onDelete,
  onShare,
}: {
  tasks: Task[];
  currentUserId: string;
  onSelectDate: (d: Date) => void;
  onEdit: (t: Task) => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  onShare: (t: Task) => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const k = format(new Date(t.due_date), "yyyy-MM-dd");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return map;
  }, [tasks]);

  const dayTasks = tasksByDay.get(format(selected, "yyyy-MM-dd")) ?? [];

  return (
    <div className="space-y-6">
      <div className="glass-bezel rounded-3xl p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="size-9 rounded-lg hover:bg-secondary transition-colors flex items-center justify-center"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold">{format(cursor, "MMMM yyyy")}</h2>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="size-9 rounded-lg hover:bg-secondary transition-colors flex items-center justify-center"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const inMonth = isSameMonth(d, cursor);
            const isSel = isSameDay(d, selected);
            const isToday = isSameDay(d, new Date());
            const count = tasksByDay.get(format(d, "yyyy-MM-dd"))?.length ?? 0;

            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={cn(
                  "aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition-all",
                  inMonth ? "" : "opacity-30",
                  isSel
                    ? "bg-gradient-velocity text-primary-foreground shadow-glow"
                    : "hover:bg-secondary",
                  isToday && !isSel && "text-primary font-bold",
                )}
              >
                <span className="tabular-nums">{format(d, "d")}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "absolute bottom-1 size-1 rounded-full",
                      isSel ? "bg-primary-foreground" : "bg-primary",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{format(selected, "EEEE, MMM d")}</h3>
          <button
            onClick={() => onSelectDate(selected)}
            className="text-xs uppercase tracking-widest text-primary font-bold"
          >
            + Add
          </button>
        </div>

        {dayTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic px-4 py-6 text-center border border-dashed border-border rounded-xl">
            Nothing planned
          </p>
        ) : (
          <ul className="space-y-3">
            {dayTasks.map((t) => (
              <li key={t.id}>
                <TaskCard task={t} currentUserId={currentUserId} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onShare={onShare} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
