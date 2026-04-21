import { Calendar, CalendarDays, ListTodo, Settings as SettingsIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ViewKey = "today" | "week" | "month" | "settings";

const items: { key: ViewKey; label: string; Icon: typeof Calendar }[] = [
  { key: "today", label: "Today", Icon: ListTodo },
  { key: "week", label: "Week", Icon: CalendarDays },
  { key: "month", label: "Month", Icon: Calendar },
  { key: "settings", label: "Settings", Icon: SettingsIcon },
];

export function BottomNav({ active, onChange }: { active: ViewKey; onChange: (k: ViewKey) => void }) {
  return (
    <nav
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(420px,calc(100%-2rem))] glass-bezel rounded-2xl shadow-bezel"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
    >
      <ul className="flex items-stretch justify-between p-2">
        {items.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <li key={key} className="flex-1">
              <button
                onClick={() => onChange(key)}
                className={cn(
                  "relative w-full flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-primary/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon size={20} strokeWidth={2.2} className="relative z-10" />
                <span className="relative z-10 text-[10px] font-bold uppercase tracking-widest">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
