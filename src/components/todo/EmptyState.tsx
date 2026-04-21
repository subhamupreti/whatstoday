import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="text-center py-16 px-6 glass-bezel rounded-3xl">
      <div className="mx-auto size-14 rounded-2xl bg-gradient-velocity shadow-glow flex items-center justify-center mb-5">
        <Sparkles className="text-primary-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">{subtitle}</p>}
      {actionLabel && onAction && (
        <Button variant="velocity" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
