import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RichTextEditor } from "./RichTextEditor";
import type { Assignment, NewAssignment } from "@/types/assignment";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignment: Assignment | null;
  onSubmit: (payload: NewAssignment, id?: string) => void | Promise<void>;
}

export function AssignmentSheet({ open, onOpenChange, assignment, onSubmit }: Props) {
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (assignment) {
      setSubject(assignment.subject);
      setTitle(assignment.title);
      setDescription(assignment.description ?? "");
      setDueAt(toLocalInputValue(assignment.due_date));
      setProgress(assignment.progress);
    } else {
      setSubject("");
      setTitle("");
      setDescription("");
      const base = new Date();
      base.setDate(base.getDate() + 7);
      base.setHours(23, 59, 0, 0);
      setDueAt(toLocalInputValue(base.toISOString()));
      setProgress(0);
    }
  }, [open, assignment]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !title.trim()) return;
    onSubmit(
      {
        subject: subject.trim(),
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueAt ? new Date(dueAt).toISOString() : null,
        progress,
      },
      assignment?.id,
    );
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-border max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="text-2xl">
            {assignment ? "Edit assignment" : "New assignment"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={submit} className="space-y-4 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Math, Physics, English…"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">Submission date</Label>
              <Input
                id="due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chapter 3 problem set"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Details</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Instructions, references, images…"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Progress</Label>
              <span className="text-sm font-bold tabular-nums">{progress}%</span>
            </div>
            <Slider
              value={[progress]}
              onValueChange={(v) => setProgress(v[0] ?? 0)}
              min={0}
              max={100}
              step={5}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="velocity" className="flex-1">
              {assignment ? "Save changes" : "Add assignment"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
