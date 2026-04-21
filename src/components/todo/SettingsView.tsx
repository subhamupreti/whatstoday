import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Moon, Sun, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function SettingsView({ user }: { user: User }) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("wt-theme", next ? "dark" : "light");
  };

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      toast.error("Enter a valid code");
      return;
    }
    setJoining(true);
    const { error } = await supabase.rpc("join_task_by_code", { _code: trimmed });
    setJoining(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task joined");
    setCode("");
  };

  return (
    <div className="space-y-6">
      <div className="glass-bezel rounded-3xl p-5">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-1">Account</p>
        <p className="font-semibold truncate">{user.email}</p>
      </div>

      <div className="glass-bezel rounded-3xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDark ? <Moon size={20} /> : <Sun size={20} />}
          <div>
            <p className="font-semibold">Appearance</p>
            <p className="text-xs text-muted-foreground">{isDark ? "Dark mode" : "Light mode"}</p>
          </div>
        </div>
        <Button variant="outline" onClick={toggleTheme}>
          Switch to {isDark ? "Light" : "Dark"}
        </Button>
      </div>

      <div className="glass-bezel rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Users size={20} />
          <div>
            <p className="font-semibold">Join a shared task</p>
            <p className="text-xs text-muted-foreground">Enter a code to view & complete a task.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="ABCD2345"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            className="font-mono tracking-[0.3em] uppercase"
          />
          <Button onClick={join} disabled={joining} className="btn-velocity text-primary-foreground">
            Join
          </Button>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={async () => {
          await supabase.auth.signOut();
        }}
      >
        <LogOut size={16} /> Sign out
      </Button>

      <p className="text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground pt-4">
        Build By SU1000&amp;SK900
      </p>
    </div>
  );
}
