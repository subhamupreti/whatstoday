import { useEffect, useRef } from "react";
import type { Task } from "@/types/task";
import { toast } from "sonner";
import { AlertTriangle, BellRing } from "lucide-react";

const NST_TZ = "Asia/Kathmandu";
const ONE_HOUR_MS = 60 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;
const STORAGE_KEY = "wt-overdue-alerted";
const DUE_KEY = "wt-due-alerted";

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSet(key: string, s: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(s)));
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

function pushNotify(title: string, body: string, tag: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return; // avoid noisy duplicate when app is open
    new Notification(title, { body, tag, icon: "/icon-192.png", badge: "/icon-192.png" });
  } catch {
    /* noop */
  }
}

/**
 * Watches tasks and:
 *  - fires a browser push notification + toast when a task becomes due (within 5 min after due_date)
 *  - fires an overdue toast + push notification when a task has been overdue > 1 hour and is still pending
 * Times shown in Nepal Standard Time (Asia/Kathmandu).
 */
export function useOverdueAlerts(tasks: Task[]) {
  const overdueRef = useRef<Set<string>>(loadSet(STORAGE_KEY));
  const dueRef = useRef<Set<string>>(loadSet(DUE_KEY));

  // Request notification permission once on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      let overdueChanged = false;
      let dueChanged = false;

      tasks.forEach((t) => {
        if (t.status !== "pending" || !t.due_date) return;
        const due = new Date(t.due_date).getTime();
        if (Number.isNaN(due)) return;
        const delta = now - due;

        // DUE NOW: 0 .. 5 minutes after due time
        if (delta >= 0 && delta <= FIVE_MIN_MS && !dueRef.current.has(t.id)) {
          dueRef.current.add(t.id);
          dueChanged = true;
          toast(`Task due now: ${t.title}`, {
            description: `Due ${formatNST(new Date(t.due_date))}`,
            icon: <BellRing size={16} />,
            duration: 8000,
          });
          pushNotify("Task due now", t.title, `due-${t.id}`);
        }

        // OVERDUE: > 1 hour past due
        if (delta > ONE_HOUR_MS && !overdueRef.current.has(t.id)) {
          overdueRef.current.add(t.id);
          overdueChanged = true;
          toast.warning(`Overdue: ${t.title}`, {
            description: `Was due ${formatNST(new Date(t.due_date))} — over 1 hour ago`,
            icon: <AlertTriangle size={16} />,
            duration: 8000,
          });
          pushNotify("Task overdue", t.title, `overdue-${t.id}`);
        }
      });

      // Reset alerts for tasks that were completed or had due date pushed.
      tasks.forEach((t) => {
        const due = t.due_date ? new Date(t.due_date).getTime() : null;
        const isPending = t.status === "pending" && due !== null && !Number.isNaN(due);
        const stillOverdue = isPending && due !== null && now - due > ONE_HOUR_MS;
        const stillDue = isPending && due !== null && now - due >= 0 && now - due <= FIVE_MIN_MS;

        if (overdueRef.current.has(t.id) && !stillOverdue) {
          overdueRef.current.delete(t.id);
          overdueChanged = true;
        }
        if (dueRef.current.has(t.id) && !stillDue && !(due !== null && now < due)) {
          // keep dueRef entry as long as we've already notified; only clear when task moves into overdue or is resolved
          if (t.status !== "pending") {
            dueRef.current.delete(t.id);
            dueChanged = true;
          }
        }
      });

      if (overdueChanged) saveSet(STORAGE_KEY, overdueRef.current);
      if (dueChanged) saveSet(DUE_KEY, dueRef.current);
    };

    check();
    const id = setInterval(check, 60 * 1000); // every minute
    return () => clearInterval(id);
  }, [tasks]);
}
