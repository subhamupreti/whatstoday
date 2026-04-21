import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CloudOff, Cloud, RefreshCw, Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { clearOutbox, getOutbox, isOnline, type OutboxOp } from "@/lib/offlineStore";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  onSyncNow: () => Promise<void> | void;
  syncing?: boolean;
}

const opMeta: Record<OutboxOp["kind"], { label: string; Icon: typeof Plus; tone: string }> = {
  create: { label: "Create task", Icon: Plus, tone: "text-primary" },
  update: { label: "Update task", Icon: Pencil, tone: "text-foreground" },
  toggle: { label: "Toggle status", Icon: Check, tone: "text-foreground" },
  delete: { label: "Delete task", Icon: Trash2, tone: "text-destructive" },
};

function opTitle(op: OutboxOp): string {
  if (op.kind === "create") return op.payload.title || "Untitled";
  if (op.kind === "toggle") return `→ ${op.nextStatus}`;
  return op.taskId.slice(0, 8);
}

function opTime(op: OutboxOp): string {
  // The id starts with a base36 timestamp.
  const ts = parseInt(op.id.split("-")[0], 36);
  if (!Number.isFinite(ts)) return "";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "";
  }
}

export function OfflineSyncPanel({ onSyncNow, syncing }: Props) {
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [online, setOnline] = useState(isOnline());
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(async () => {
    setOps(await getOutbox());
  }, []);

  useEffect(() => {
    refresh();
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    const t = setInterval(refresh, 4000);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
      clearInterval(t);
    };
  }, [refresh]);

  const handleSync = async () => {
    if (!online) {
      toast.warning("You're offline — can't sync right now");
      return;
    }
    await onSyncNow();
    refresh();
  };

  const handleClear = async () => {
    await clearOutbox();
    setConfirmClear(false);
    refresh();
    toast.success("Outbox cleared");
  };

  return (
    <div className="glass-bezel rounded-3xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        {online ? (
          <Cloud size={20} className="text-primary" />
        ) : (
          <CloudOff size={20} className="text-muted-foreground" />
        )}
        <div className="flex-1">
          <p className="font-semibold">Offline &amp; Sync</p>
          <p className="text-xs text-muted-foreground">
            {online ? "Connected" : "Offline"} · {ops.length} pending change{ops.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleSync}
          disabled={syncing || !online || ops.length === 0}
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirmClear(true)}
          disabled={ops.length === 0}
          aria-label="Clear outbox"
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {ops.length > 0 ? (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {ops.map((op) => {
            const meta = opMeta[op.kind];
            const Icon = meta.Icon;
            return (
              <li
                key={op.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2"
              >
                <Icon size={14} className={meta.tone} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{meta.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {opTitle(op)} · {opTime(op)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">
          <Check size={14} className="inline mr-1 text-primary" />
          All changes are synced.
        </p>
      )}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all pending changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {ops.length} queued change{ops.length === 1 ? "" : "s"} will be discarded permanently and
              never sent to the server. Your already-synced tasks won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X size={14} className="mr-1" /> Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 size={14} className="mr-1" /> Clear outbox
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
