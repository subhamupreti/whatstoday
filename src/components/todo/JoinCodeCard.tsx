import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users } from "lucide-react";

export function JoinCodeCard() {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  const join = async () => {
    const trimmed = code.replace(/\D/g, "");
    if (trimmed.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setJoining(true);
    const { error } = await supabase.rpc("join_task_by_code", { _code: trimmed });
    setJoining(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task joined — it now appears in your list");
    setCode("");
  };

  return (
    <div className="glass-bezel rounded-3xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Users size={18} />
        </div>
        <div>
          <p className="font-semibold text-sm">Got a share code?</p>
          <p className="text-xs text-muted-foreground">Join a friend's task to view & complete it.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && join()}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          className="font-mono tracking-[0.4em] text-center text-lg"
        />
        <Button onClick={join} disabled={joining} className="btn-velocity text-primary-foreground shrink-0">
          Join
        </Button>
      </div>
    </div>
  );
}
