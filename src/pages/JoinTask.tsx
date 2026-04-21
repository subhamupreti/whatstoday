import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Users, Check } from "lucide-react";

interface Preview {
  task_id: string;
  title: string;
  owner_name: string;
}

export default function JoinTask() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = code.replace(/\D/g, "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("preview_task_share", { _code: cleanCode });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) setError("Invalid or expired share link");
        else setPreview(row as Preview);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cleanCode]);

  const join = async () => {
    if (!user) {
      navigate(`/auth?redirect=/join/${cleanCode}`, { replace: true });
      return;
    }
    setJoining(true);
    const { error } = await supabase.rpc("join_task_by_code", { _code: cleanCode });
    setJoining(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task joined");
    navigate("/", { replace: true });
  };

  const decline = () => navigate("/?settings=1", { replace: true });

  if (loading || authLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[360px] -z-10 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />
      <div className="w-full max-w-md glass-bezel rounded-3xl p-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="size-14 rounded-2xl bg-gradient-velocity shadow-glow flex items-center justify-center">
            <Users className="text-primary-foreground" size={26} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Shared task invite</h1>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : preview ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{preview.owner_name}</span> wants to
              share a task with you.
            </p>
          ) : null}
        </div>

        {preview && !error && (
          <div className="rounded-2xl bg-secondary/50 p-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-1">
              Task
            </p>
            <p className="font-semibold text-lg">{preview.title}</p>
            <p className="text-xs text-muted-foreground mt-2">
              You will be able to view it and mark it complete.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {error ? (
            <Button onClick={() => navigate("/")} className="w-full" variant="outline">
              Go home
            </Button>
          ) : (
            <>
              <Button
                onClick={join}
                disabled={joining}
                className="w-full btn-velocity text-primary-foreground"
                size="lg"
              >
                {joining ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                {user ? "Yes, join task" : "Sign in to join"}
              </Button>
              <Button onClick={decline} variant="outline" className="w-full" size="lg">
                No thanks
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
