import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Users, Check, Layers } from "lucide-react";

interface SinglePreview {
  kind: "single";
  task_id: string;
  title: string;
  owner_name: string;
}
interface BundlePreview {
  kind: "bundle";
  bundle_id: string;
  owner_name: string;
  task_count: number;
  sample_titles: string[];
}
type Preview = SinglePreview | BundlePreview;

export default function JoinTask() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);

      // Try single-task share first
      const single = await supabase.rpc("preview_task_share", { _code: cleanCode });
      if (cancelled) return;
      const singleRow = Array.isArray(single.data) ? single.data[0] : single.data;
      if (!single.error && singleRow) {
        setPreview({ kind: "single", ...(singleRow as Omit<SinglePreview, "kind">) });
        setLoading(false);
        return;
      }

      // Fall back to bundle
      const bundle = await supabase.rpc("preview_task_bundle_share", { _code: cleanCode });
      if (cancelled) return;
      const bundleRow = Array.isArray(bundle.data) ? bundle.data[0] : bundle.data;
      if (!bundle.error && bundleRow) {
        setPreview({ kind: "bundle", ...(bundleRow as Omit<BundlePreview, "kind">) });
        setLoading(false);
        return;
      }

      setError(single.error?.message || bundle.error?.message || "Invalid or expired share link");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cleanCode, user, authLoading]);

  const join = async () => {
    if (!user) {
      navigate(`/auth?redirect=/join/${cleanCode}`, { replace: true });
      return;
    }
    setJoining(true);
    if (preview?.kind === "bundle") {
      const { data, error } = await supabase.rpc("join_task_bundle_by_code", { _code: cleanCode });
      setJoining(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Joined ${data ?? 0} tasks`);
      navigate("/", { replace: true });
      return;
    }
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

  const isBundle = preview?.kind === "bundle";

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
            {isBundle ? (
              <Layers className="text-primary-foreground" size={26} />
            ) : (
              <Users className="text-primary-foreground" size={26} />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isBundle ? "Shared task bundle" : "Shared task invite"}
          </h1>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : preview ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{preview.owner_name}</span>{" "}
              {isBundle ? "wants to share multiple tasks with you." : "wants to share a task with you."}
            </p>
          ) : null}
        </div>

        {preview && !error && preview.kind === "single" && (
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

        {preview && !error && preview.kind === "bundle" && (
          <div className="rounded-2xl bg-secondary/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
                Tasks
              </p>
              <span className="text-xs font-bold text-primary">
                {preview.task_count} total
              </span>
            </div>
            <ul className="space-y-1.5 max-h-44 overflow-y-auto">
              {(preview.sample_titles ?? []).map((title, i) => (
                <li key={i} className="text-sm truncate">· {title}</li>
              ))}
              {preview.task_count > (preview.sample_titles?.length ?? 0) && (
                <li className="text-xs text-muted-foreground pt-1">
                  + {preview.task_count - (preview.sample_titles?.length ?? 0)} more
                </li>
              )}
            </ul>
            <p className="text-xs text-muted-foreground text-center pt-1">
              You will be able to view all of them and mark them complete.
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
                {user
                  ? isBundle
                    ? `Yes, join ${preview?.task_count ?? ""} tasks`
                    : "Yes, join task"
                  : "Sign in to join"}
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
