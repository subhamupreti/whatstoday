import type { Task } from "@/types/task";

export interface SelectionProps {
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (t: Task) => void;
  onLongPress?: (t: Task) => void;
}
