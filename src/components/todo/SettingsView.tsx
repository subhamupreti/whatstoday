import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Moon, Sun } from "lucide-react";
import { useState } from "react";

export function SettingsView({ user }: { user: User }) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("wt-theme", next ? "dark" : "light");
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
          Switch
        </Button>
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
