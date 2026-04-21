import type { Task, NewTask, TaskPriority } from "@/types/task";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { RichTextEditor } from "./RichTextEditor";
import { MusicLinksEditor } from "./MusicLinks";

const priorities: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskSheet({
  open,
  onOpenChange,
  task,
  defaultDate,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  defaultDate: Date | null;
  onSubmit: (payload: NewTask, id?: string) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [tags, setTags] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [musicLinks, setMusicLinks] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(task.priority);
      setTags(task.tags.join(", "));
      setDueAt(toLocalInputValue(task.due_date));
      setMusicLinks(task.music_links ?? []);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setTags("");
      setMusicLinks([]);
      const base = defaultDate ?? new Date();
      base.setHours(9, 0, 0, 0);
      setDueAt(toLocalInputValue(base.toISOString()));
    }
  }, [open, task, defaultDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload: NewTask = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      tags: tags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean),
      due_date: dueAt ? new Date(dueAt).toISOString() : null,
      music_links: musicLinks,
    };
    onSubmit(payload, task?.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border max-h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="text-2xl">{task ? "Edit task" : "New task"}</SheetTitle>
          {dueAt && (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {format(new Date(dueAt), "EEEE · MMM d · h:mm a")}
            </p>
          )}
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Add details, paste or drop images…"
            />
            <p className="text-[10px] text-muted-foreground">
              Tip: paste or drop an image to embed it. Max 1.5MB.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="grid grid-cols-3 gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "py-2.5 rounded-xl text-sm font-semibold border transition-all",
                    priority === p.value
                      ? "bg-gradient-velocity text-primary-foreground border-transparent shadow-glow"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Music links</Label>
            <MusicLinksEditor value={musicLinks} onChange={setMusicLinks} />
            <p className="text-[10px] text-muted-foreground">
              YouTube, Spotify, SoundCloud, Apple Music — playable inline.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="due">Due</Label>
              <Input
                id="due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="work, focus, errand"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="velocity" className="flex-1">
              {task ? "Save changes" : "Add task"}
            </Button>
            {task && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
