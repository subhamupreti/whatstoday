import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Share2, Loader2, Link2, Layers } from "lucide-react";
import type { Task } from "@/types/task";

interface Props {
  tasks: Task[]; // pre-filtered to owned tasks
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onShared?: () => void;
}

export function BulkShareDialog({ tasks, open, onOpenChange, onShared }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const link = code ? `${window.location.origin}/join/${code}` : null;
  const count = tasks.length;

  const reset = () => {
    setCode(null);
    setLoading(false);
  };

  const generate = async () => {
    if (!count) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("create_task_bundle_share", {
      _task_ids: tasks.map((t) => t.id),
      _role: "completer",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCode(data as string);
    onShared?.();
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
    if (!link || !code) return;
    const text = `Join ${count} tasks on WHAT'S TODAY? Code: ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "WHAT'S TODAY?", text, url: link });
      } else {
        await navigator.clipboard.writeText(`${text}\n${link}`);
        toast.success("Share message copied");
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers size={18} /> Share {count} tasks
          </DialogTitle>
          <DialogDescription>
            Anyone with this code or link can view all selected tasks and mark them complete. They
            cannot edit or delete them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-2xl bg-secondary/40 p-3 max-h-40 overflow-y-auto space-y-1.5">
            {tasks.slice(0, 8).map((t) => (
              <p key={t.id} className="text-sm truncate">
                · {t.title}
              </p>
            ))}
            {tasks.length > 8 && (
              <p className="text-xs text-muted-foreground pt-1">
                + {tasks.length - 8} more
              </p>
            )}
          </div>

          {code && link ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
                  6-digit bundle code
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

              <Button
                onClick={nativeShare}
                className="w-full btn-velocity text-primary-foreground"
              >
                <Share2 size={16} /> Share link…
              </Button>
            </div>
          ) : (
            <Button
              onClick={generate}
              disabled={loading || !count}
              className="w-full btn-velocity text-primary-foreground"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>Generate code for {count} tasks</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
