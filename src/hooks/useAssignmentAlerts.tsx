import { useEffect, useRef } from "react";
import type { Assignment } from "@/types/assignment";
import { toast } from "sonner";
import { AlertTriangle, Clock } from "lucide-react";

const STORAGE_KEY = "wt-assignment-alerted";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function loadAlerted(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function save(map: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

/**
 * Fires:
 *  - "1 day before" reminder when due_date is within the next 24h.
 *  - "Overdue" alert when due_date has passed and assignment is still pending.
 * One toast per kind per assignment, persisted in localStorage.
 */
export function useAssignmentAlerts(assignments: Assignment[]) {
  const alertedRef = useRef<Record<string, string[]>>(loadAlerted());

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      let changed = false;
      const map = alertedRef.current;

      assignments.forEach((a) => {
        if (!a.due_date || a.status === "completed") return;
        const due = new Date(a.due_date).getTime();
        if (Number.isNaN(due)) return;
        const diff = due - now;
        const fired = map[a.id] ?? [];

        if (diff > 0 && diff <= ONE_DAY_MS && !fired.includes("soon")) {
          fired.push("soon");
          map[a.id] = fired;
          changed = true;
          toast.warning(`Due tomorrow: ${a.title}`, {
            description: `${a.subject} — submit before ${new Date(a.due_date).toLocaleString()}`,
            icon: <Clock size={16} />,
            duration: 8000,
          });
        }

        if (diff < 0 && !fired.includes("overdue")) {
          fired.push("overdue");
          map[a.id] = fired;
          changed = true;
          toast.error(`Overdue: ${a.title}`, {
            description: `${a.subject} — was due ${new Date(a.due_date).toLocaleString()}`,
            icon: <AlertTriangle size={16} />,
            duration: 9000,
          });
        }
      });

      if (changed) {
        alertedRef.current = map;
        save(map);
      }
    };

    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [assignments]);
}
