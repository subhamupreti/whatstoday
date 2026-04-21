import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { TodoApp } from "@/components/todo/TodoApp";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background">
        <div className="size-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </main>
    );
  }

  return <TodoApp user={user} />;
}
