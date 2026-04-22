import type { Task } from "@/types/task";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { RichTextRenderer } from "./RichTextRenderer";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Pencil, Share2, Trash2, Check, X, Users, Calendar, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

const priorityStyles: Record<Task["priority"], { label: string; cls: string }> = {
  high: { label: "High priority", cls: "text-primary" },
  medium: { label: "Medium priority", cls: "text-amber-400" },
  low: { label: "Low priority", cls: "text-muted-foreground" },
};

interface Props {
  task: Task | null;
  currentUserId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onShare?: (t: Task) => void;
}

export function TaskDetailSheet({
  task,
  currentUserId,
  open,
  onOpenChange,
  onToggle,
  onEdit,
  onDelete,
  onShare,
}: Props) {
  if (!task) return null;
  const isOwner = task.user_id === currentUserId;
  const completed = task.status === "completed";
  const ps = priorityStyles[task.priority];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-dvh max-h-dvh w-full p-0 border-0 rounded-none bg-background flex flex-col"
      >
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="size-10 rounded-full bg-secondary/60 flex items-center justify-center hover:bg-secondary"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            {isOwner && onShare && (
              <button
                onClick={() => onShare(task)}
                aria-label="Share"
                className="size-10 rounded-full bg-secondary/60 flex items-center justify-center hover:bg-secondary"
              >
                <Share2 size={18} />
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => onEdit(task)}
                aria-label="Edit"
                className="size-10 rounded-full bg-secondary/60 flex items-center justify-center hover:bg-secondary"
              >
                <Pencil size={18} />
              </button>
            )}
            <button
              onClick={() => {
                onDelete(task.id);
                onOpenChange(false);
              }}
              aria-label="Delete"
              className="size-10 rounded-full bg-secondary/60 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-32">
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

          </div>
        </div>

        {/* Bottom action */}
        <div className="absolute bottom-0 inset-x-0 px-5 pb-6 pt-4 bg-gradient-to-t from-background via-background to-transparent">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={() => onToggle(task)}
              variant={completed ? "outline" : "velocity"}
              className="w-full"
              size="lg"
            >
              <Check size={18} className="mr-2" />
              {completed ? "Mark as pending" : "Mark complete"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
