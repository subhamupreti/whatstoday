import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Layers, X, CheckSquare } from "lucide-react";

interface Props {
  count: number;
  ownedCount: number;
  onCancel: () => void;
  onShare: () => void;
  onSelectAllVisible?: () => void;
}

export function SelectionToolbar({
  count,
  ownedCount,
  onCancel,
  onShare,
  onSelectAllVisible,
}: Props) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 w-[calc(100%-2rem)] max-w-md"
        >
          <div className="glass-bezel rounded-2xl p-2.5 flex items-center gap-2 shadow-soft">
            <button
              onClick={onCancel}
              aria-label="Cancel selection"
              className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <X size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">
                {count} selected
                {ownedCount !== count && (
                  <span className="text-xs text-muted-foreground font-normal">
                    {" "}
                    · {ownedCount} shareable
                  </span>
                )}
              </p>
              {onSelectAllVisible && (
                <button
                  onClick={onSelectAllVisible}
                  className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline"
                >
                  <CheckSquare size={11} /> Select all visible
                </button>
              )}
            </div>
            <Button
              onClick={onShare}
              disabled={ownedCount === 0}
              className="btn-velocity text-primary-foreground"
              size="sm"
            >
              <Layers size={15} /> Share {ownedCount > 0 ? ownedCount : ""}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
