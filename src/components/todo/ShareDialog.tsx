import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Share2, Loader2 } from "lucide-react";
import type { Task } from "@/types/task";

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ShareDialog({ task, open, onOpenChange }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Code copied");
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
            Anyone with the code can view this task and mark it complete. They cannot edit or delete it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="font-semibold truncate">{task?.title}</p>

          {code ? (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
                Share code
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={code}
                  className="font-mono text-2xl tracking-[0.5em] text-center font-bold"
                />
                <Button onClick={copy} variant="outline" size="icon" aria-label="Copy">
                  <Copy size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this 6-digit code. Recipients enter it on the Today page.
              </p>
            </div>
          ) : (
            <Button onClick={generate} disabled={loading} className="w-full btn-velocity text-primary-foreground">
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Generate share code"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
