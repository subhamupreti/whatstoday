import { useEffect, useRef } from "react";
import type { Task } from "@/types/task";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const NST_TZ = "Asia/Kathmandu";
const ONE_HOUR_MS = 60 * 60 * 1000;
const STORAGE_KEY = "wt-overdue-alerted";

function loadAlerted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveAlerted(s: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(s)));
  } catch {
    /* noop */
  }
}

function formatNST(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: NST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    hour12: false,
  }).format(date) + " NST";
}

/**
 * Watches tasks and fires a single toast per task when it has been
 * overdue (past due_date) by more than 1 hour and is still pending.
 * Times shown in Nepal Standard Time (Asia/Kathmandu).
 */
export function useOverdueAlerts(tasks: Task[]) {
  const alertedRef = useRef<Set<string>>(loadAlerted());

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      let changed = false;

      tasks.forEach((t) => {
        if (t.status !== "pending" || !t.due_date) return;
        const due = new Date(t.due_date).getTime();
        if (Number.isNaN(due)) return;
        const overdueBy = now - due;
        if (overdueBy <= ONE_HOUR_MS) return;
        if (alertedRef.current.has(t.id)) return;

        alertedRef.current.add(t.id);
        changed = true;

        toast.warning(`Overdue: ${t.title}`, {
          description: `Was due ${formatNST(new Date(t.due_date))} — over 1 hour ago`,
          icon: <AlertTriangle size={16} />,
          duration: 8000,
        });
      });

      // Reset alerts for tasks that were completed or had due date pushed.
      tasks.forEach((t) => {
        if (!alertedRef.current.has(t.id)) return;
        const stillOverdue =
          t.status === "pending" &&
          t.due_date &&
          now - new Date(t.due_date).getTime() > ONE_HOUR_MS;
        if (!stillOverdue) {
          alertedRef.current.delete(t.id);
          changed = true;
        }
      });

      if (changed) saveAlerted(alertedRef.current);
    };

    check();
    const id = setInterval(check, 60 * 1000); // every minute
    return () => clearInterval(id);
  }, [tasks]);
}
