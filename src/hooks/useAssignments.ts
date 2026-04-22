import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Assignment, NewAssignment } from "@/types/assignment";
import { toast } from "sonner";

// `assignments` table is not yet in the auto-generated Supabase types.
// Use a loosely-typed client wrapper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function deriveStatus(a: Assignment): Assignment["status"] {
  if (a.status === "completed" || a.submitted_at) return "completed";
  if (a.due_date && new Date(a.due_date).getTime() < Date.now()) return "overdue";
  return "pending";
}

export function useAssignments(userId: string | undefined) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await sb
      .from("assignments")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      const list = ((data ?? []) as Assignment[]).map((a) => ({ ...a, status: deriveStatus(a) }));
      setAssignments(list);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchAll();
    const ch = sb
      .channel(`assignments-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments", filter: `user_id=eq.${userId}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [userId, fetchAll]);

  const create = async (payload: NewAssignment) => {
    if (!userId) return;
    const { error } = await sb.from("assignments").insert({
      user_id: userId,
      subject: payload.subject,
      title: payload.title,
      description: payload.description ?? null,
      due_date: payload.due_date ?? null,
      progress: payload.progress ?? 0,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Assignment added");
      fetchAll();
    }
  };

  const update = async (id: string, patch: Partial<Assignment>) => {
    const { error } = await sb.from("assignments").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else fetchAll();
  };

  const remove = async (id: string) => {
    const target = assignments.find((a) => a.id === id);
    setAssignments((arr) => arr.filter((a) => a.id !== id));
    const { error } = await sb.from("assignments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      if (target) setAssignments((arr) => [...arr, target]);
    } else {
      toast.success("Assignment deleted");
    }
  };

  const toggleComplete = async (a: Assignment) => {
    const isDone = a.status === "completed";
    await update(a.id, {
      status: isDone ? "pending" : "completed",
      submitted_at: isDone ? null : new Date().toISOString(),
      progress: isDone ? a.progress : 100,
    });
  };

  return { assignments, loading, create, update, remove, toggleComplete, refetch: fetchAll };
}
