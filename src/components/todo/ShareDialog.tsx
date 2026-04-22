import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Share2, Loader2, Link2 } from "lucide-react";
import type { Task } from "@/types/task";

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ShareDialog({ task, open, onOpenChange }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const link = code ? `${window.location.origin}/join/${code}` : null;

  const generate = async () => {
    if (!task) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("create_task_share", {
      _task_id: task.id,
      _role: "completer",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCode(data as string);
  };

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };

  const nativeShare = async () => {
    if (!link || !task) return;
    const text = `Join my task "${task.title}" on What's Today? Code: ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "What's Today?", text, url: link });
      } else {
        await navigator.clipboard.writeText(`${text}\n${link}`);
        toast.success("Share message copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setCode(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 size={18} /> Share task
          </DialogTitle>
          <DialogDescription>
            Anyone with the code or link can view this task and mark it complete. They cannot edit
            or delete it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="font-semibold truncate">{task?.title}</p>

          {code && link ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
                  6-digit code
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={code}
                    inputMode="numeric"
                    className="font-mono text-3xl tracking-[0.4em] text-center font-bold tabular-nums"
                  />
                  <Button onClick={copyCode} variant="outline" size="icon" aria-label="Copy code">
                    <Copy size={16} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
                  Share link
                </label>
                <div className="flex gap-2">
                  <Input readOnly value={link} className="text-xs" />
                  <Button onClick={copyLink} variant="outline" size="icon" aria-label="Copy link">
                    <Link2 size={16} />
                  </Button>
                </div>
              </div>

              <Button onClick={nativeShare} className="w-full btn-velocity text-primary-foreground">
                <Share2 size={16} /> Share link…
              </Button>
            </div>
          ) : (
            <Button onClick={generate} disabled={loading} className="w-full btn-velocity text-primary-foreground">
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Generate share code & link"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
