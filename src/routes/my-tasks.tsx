import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTodo, Plus, Check, X, Clock } from "lucide-react";
import { useTodos } from "@/hooks/useTodos";
import { tokenStore } from "@/lib/api/client";
import type { Todo } from "@/contracts";

export const Route = createFileRoute("/my-tasks")({
  head: () => ({ meta: [{ title: "My Tasks - Gharpayy" }] }),
  component: () => <AppShell><MyTasksPage /></AppShell>,
});

function MyTasksPage() {
  const { todos, loading, error, create, accept, decline, complete, cancel } = useTodos({ scope: "mine" });
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  if (!tokenStore.get()) {
    return (
      <Card className="m-6 p-6">
        <h2 className="text-lg font-semibold mb-2">Sign in required</h2>
        <Link to="/login" search={{ redirect: "/" }} className="text-primary underline">Go to login →</Link>
      </Card>
    );
  }

  const buckets = useMemo(() => groupTodos(todos), [todos]);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ListTodo /> My Tasks <Badge variant="secondary">Realtime</Badge></h1>
        <p className="text-sm text-muted-foreground">Everything assigned to you, plus standalone todos you created.</p>
      </header>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">Quick add</h3>
        <div className="flex gap-2">
          <Input placeholder="What needs to happen?" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) addTodo(); }} />
          <Button disabled={!title.trim() || creating} onClick={addTodo}><Plus className="h-3 w-3 mr-1" />Add</Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </Card>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="pending">Pending acceptance ({buckets.pending.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({buckets.active.length})</TabsTrigger>
          <TabsTrigger value="done">Done ({buckets.done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending"><Group todos={buckets.pending} loading={loading} empty="Nothing waiting on your acceptance." actions="pending" {...{ accept, decline, complete, cancel }} /></TabsContent>
        <TabsContent value="active"><Group todos={buckets.active} loading={loading} empty="No active tasks. Inbox zero!" actions="active" {...{ accept, decline, complete, cancel }} /></TabsContent>
        <TabsContent value="done"><Group todos={buckets.done} loading={loading} empty="No completed tasks yet." actions="done" {...{ accept, decline, complete, cancel }} /></TabsContent>
      </Tabs>
    </div>
  );

  async function addTodo() {
    setCreating(true);
    const r = await create({ title: title.trim() });
    setCreating(false);
    if (r.ok) setTitle("");
  }
}

function groupTodos(todos: Todo[]) {
  return {
    pending: todos.filter((t) => t.status === "pending-accept"),
    active:  todos.filter((t) => ["open", "accepted", "in-progress"].includes(t.status)),
    done:    todos.filter((t) => ["done", "cancelled", "declined"].includes(t.status)),
  };
}

interface GroupProps {
  todos: Todo[];
  loading: boolean;
  empty: string;
  actions: "pending" | "active" | "done";
  accept: (id: string) => Promise<unknown>;
  decline: (id: string) => Promise<unknown>;
  complete: (id: string) => Promise<unknown>;
  cancel: (id: string) => Promise<unknown>;
}
function Group({ todos, loading, empty, actions, accept, decline, complete, cancel }: GroupProps) {
  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading…</p>;
  if (todos.length === 0) return <p className="text-sm text-muted-foreground py-4">{empty}</p>;
  return (
    <Card className="divide-y">
      {todos.map((t) => (
        <div key={t._id} className="p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={t.priority === "urgent" ? "destructive" : t.priority === "high" ? "default" : "outline"}>{t.priority}</Badge>
              <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>{t.title}</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
              {t.entityType !== "none" && <Badge variant="outline" className="text-[10px]">{t.entityType}</Badge>}
              {t.dueAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(t.dueAt).toLocaleString()}</span>}
              <span>{t.status}</span>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {actions === "pending" && <>
              <Button size="sm" onClick={() => accept(t._id)}><Check className="h-3 w-3 mr-1" />Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => decline(t._id)}><X className="h-3 w-3 mr-1" />Decline</Button>
            </>}
            {actions === "active" && <>
              <Button size="sm" variant="outline" onClick={() => complete(t._id)}>Done</Button>
              <Button size="sm" variant="ghost" onClick={() => cancel(t._id)}>×</Button>
            </>}
          </div>
        </div>
      ))}
    </Card>
  );
}
