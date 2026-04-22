import type { Assignment } from "@/types/assignment";
import { Progress } from "@/components/ui/progress";
import { Pencil, Trash2, Check, AlertTriangle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { format, isPast, formatDistanceToNowStrict } from "date-fns";

interface Props {
  assignment: Assignment;
  onToggle: (a: Assignment) => void;
  onEdit: (a: Assignment) => void;
  onDelete: (id: string) => void;
}

const statusStyles: Record<Assignment["status"], string> = {
  pending: "bg-secondary/60 text-muted-foreground border-border",
  completed: "bg-primary/15 text-primary border-primary/25",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
};

export function AssignmentCard({ assignment: a, onToggle, onEdit, onDelete }: Props) {
  const due = a.due_date ? new Date(a.due_date) : null;
  const overdue = a.status !== "completed" && due && isPast(due);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "relative rounded-2xl card-gradient border border-border p-5 group",
        a.status === "completed" && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold mb-1">
            {a.subject}
          </p>
          <h3
            className={cn(
              "text-lg font-semibold tracking-tight leading-snug truncate",
              a.status === "completed" && "line-through text-muted-foreground",
            )}
          >
            {a.title}
          </h3>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
            statusStyles[a.status],
          )}
        >
          {a.status === "completed" ? (
            <span className="inline-flex items-center gap-1">
              <Check size={10} /> Done
            </span>
          ) : a.status === "overdue" ? (
            <span className="inline-flex items-center gap-1">
              <AlertTriangle size={10} /> Overdue
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Clock size={10} /> Pending
            </span>
          )}
        </span>
      </div>

      {due && (
        <p
          className={cn(
            "text-xs text-muted-foreground mb-3",
            overdue && "text-destructive font-semibold",
          )}
        >
          {overdue ? "Was due " : "Due "}
          {format(due, "EEE, MMM d · h:mm a")}
          <span className="opacity-60"> · {formatDistanceToNowStrict(due, { addSuffix: true })}</span>
        </p>
      )}

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Progress</span>
          <span className="font-bold text-foreground">{a.progress}%</span>
        </div>
        <Progress value={a.progress} className="h-2" />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(a)}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold uppercase tracking-wider transition-colors",
            a.status === "completed"
              ? "bg-secondary text-muted-foreground hover:text-foreground"
              : "btn-velocity text-primary-foreground",
          )}
        >
          <Check size={13} />
          {a.status === "completed" ? "Reopen" : "Mark complete"}
        </button>
        <button
          onClick={() => onEdit(a)}
          className="size-9 rounded-xl border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"
          aria-label="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDelete(a.id)}
          className="size-9 rounded-xl border border-border text-muted-foreground hover:text-destructive inline-flex items-center justify-center"
          aria-label="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.article>
  );
}
