import { useState } from "react";
import { Bell, Check, Mail } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { WorkspaceInvitation } from "@/types/workspace";

interface Props {
  invitations: WorkspaceInvitation[];
  onAccept: (invitationId: string) => Promise<boolean>;
}

export function NotificationBell({ invitations, onAccept }: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const count = invitations.length;

  const handleAccept = async (id: string) => {
    setBusyId(id);
    await onAccept(id);
    setBusyId(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative shrink-0 size-10 rounded-full glass-bezel flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bell size={18} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {count === 0 ? "You're all caught up" : `${count} workspace invite${count > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {count === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              <Bell size={20} className="mx-auto mb-2 opacity-50" />
              No new notifications
            </div>
          )}
          {invitations.map((inv) => (
            <div key={inv.id} className="px-4 py-3 flex items-start gap-3">
              <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Mail size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Workspace invite</p>
                <p className="text-xs text-muted-foreground truncate">
                  Join as <span className="font-semibold text-foreground">{inv.role}</span>
                </p>
                <Button
                  size="sm"
                  variant="velocity"
                  disabled={busyId === inv.id}
                  onClick={() => handleAccept(inv.id)}
                  className="mt-2 h-8 rounded-full text-xs"
                >
                  <Check size={14} className="mr-1" />
                  {busyId === inv.id ? "Joining…" : "Accept"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
