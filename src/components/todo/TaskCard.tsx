import type { Task } from "@/types/task";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Trash2, Pencil } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

const priorityStyles: Record<Task["priority"], { label: string; cls: string; bar: string }> = {
  high: { label: "High", cls: "bg-primary/15 text-primary border border-primary/25", bar: "bg-primary" },
  medium: { label: "Med", cls: "bg-amber-500/10 text-amber-400 border border-amber-500/20", bar: "bg-amber-400" },
  low: { label: "Low", cls: "bg-muted text-muted-foreground border border-border", bar: "bg-muted-foreground/40" },
};

interface Props {
  task: Task;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskCard({ task, onToggle, onEdit, onDelete }: Props) {
  const x = useMotionValue(0);
  const ref = useRef<HTMLDivElement>(null);
  const bgOpacity = useTransform(x, [-160, -40, 0], [1, 0.4, 0]);

  const completed = task.status === "completed";
  const time = task.due_date
    ? new Date(task.due_date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null;

  const onDragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x < -120) {
      // animate out then delete
      animate(x, -400, { duration: 0.18 });
      setTimeout(() => onDelete(task.id), 160);
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 32 });
    }
  };

  const ps = priorityStyles[task.priority];

  return (
    <div className="relative">
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 rounded-2xl bg-destructive flex items-center justify-end pr-6"
      >
        <Trash2 className="text-destructive-foreground" size={20} />
      </motion.div>

      <motion.div
        ref={ref}
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={0.15}
        style={{ x }}
        onDragEnd={onDragEnd}
        className={cn(
          "relative card-gradient rounded-2xl p-4 sm:p-5 shadow-soft touch-pan-y select-none",
          completed && "opacity-50",
        )}
      >
        <div className="flex items-start gap-4">
          {/* Priority bar */}
          <div className={cn("w-1 self-stretch rounded-full", ps.bar)} aria-hidden />

          {/* Checkbox */}
          <button
            onClick={() => onToggle(task)}
            aria-label={completed ? "Mark incomplete" : "Mark complete"}
            className={cn(
              "size-7 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
              completed
                ? "bg-gradient-velocity border-transparent shadow-glow"
                : "border-border hover:border-primary",
            )}
          >
            {completed && (
              <svg viewBox="0 0 24 24" className="size-4 text-primary-foreground" fill="none" strokeWidth="3.5" stroke="currentColor">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Body */}
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="flex-1 text-left min-w-0"
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider", ps.cls)}>
                {ps.label}
              </span>
              {time && (
                <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                  {time}
                </span>
              )}
              {task.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider"
                >
                  #{t}
                </span>
              ))}
            </div>
            <h3 className={cn("font-medium text-base sm:text-lg leading-tight truncate", completed && "line-through")}>
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
            )}
          </button>

          <button
            onClick={() => onEdit(task)}
            aria-label="Edit"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 hidden sm:block"
          >
            <Pencil size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
