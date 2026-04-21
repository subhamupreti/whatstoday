import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Moon, Sun, Pencil } from "lucide-react";
import { ProfileSheet, type Profile } from "./ProfileSheet";

export function SettingsView({ user }: { user: User }) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone, designation, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setProfile((data as Profile | null) ?? { display_name: null, phone: null, designation: null, avatar_url: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("wt-theme", next ? "dark" : "light");
  };

  const initials = (profile?.display_name || user.email || "?")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="glass-bezel rounded-3xl p-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 ring-2 ring-primary/30">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt="Avatar" />
            <AvatarFallback className="bg-secondary font-bold">{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-lg">
              {profile?.display_name || "Add your name"}
            </p>
            {profile?.designation && (
              <p className="text-xs text-primary font-bold uppercase tracking-widest truncate">
                {profile.designation}
              </p>
            )}
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {profile?.phone && (
              <p className="text-xs text-muted-foreground truncate">{profile.phone}</p>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={() => setEditOpen(true)} aria-label="Edit profile">
            <Pencil size={16} />
          </Button>
        </div>
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

      <ProfileSheet
        user={user}
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={profile}
        onSaved={setProfile}
      />
    </div>
  );
}
