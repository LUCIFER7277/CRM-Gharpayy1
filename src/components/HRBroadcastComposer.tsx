import { useMemo, useState } from "react";
import { Megaphone, Send, ListTodo, CalendarDays, Mail, Bell, Users2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications, type NotifChannel, type NotifSeverity } from "@/lib/notifications";
import { PERSONAS, activePersona } from "@/lib/personas";
import { useApp } from "@/lib/store";
import type { Role } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AudienceMode = "role" | "people";
const ALL_ROLES: Role[] = ["tcm", "flow-ops", "hr", "owner", "super-admin"];

export function HRBroadcastComposer({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const role = useApp((s) => s.role);
  const currentTcmId = useApp((s) => s.currentTcmId);
  if (role !== "hr") return null;

  const senderPersona = activePersona("hr", undefined);
  const pushBroadcast = useNotifications((s) => s.pushBroadcast);

  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<AudienceMode>("role");
  const [targetRole, setTargetRole] = useState<Role>("tcm");
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState<Set<NotifChannel>>(new Set(["in-app", "todo", "email"]));
  const [severity, setSeverity] = useState<NotifSeverity>("warn");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueIn, setDueIn] = useState<string>("4");

  const peopleByRole = useMemo(() => {
    const m: Record<Role, typeof PERSONAS> = { tcm: [], "flow-ops": [], hr: [], owner: [], "super-admin": [] };
    PERSONAS.forEach((p) => m[p.role].push(p));
    return m;
  }, []);

  const recipients = useMemo(() => {
    if (mode === "role") {
      return peopleByRole[targetRole].map((p) => ({ role: p.role, id: p.id, name: p.name }));
    }
    return PERSONAS.filter((p) => targetIds.has(p.id)).map((p) => ({ role: p.role, id: p.id, name: p.name }));
  }, [mode, targetRole, targetIds, peopleByRole]);

  const toggleChannel = (c: NotifChannel) => {
    setChannels((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      // Always keep in-app on so it lands in the bell
      if (next.size === 0) next.add("in-app");
      return next;
    });
  };

  const togglePerson = (id: string) => {
    setTargetIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const send = () => {
    if (!title.trim() || !body.trim() || recipients.length === 0) {
      toast.error("Add a title, message, and at least one recipient.");
      return;
    }
    const dueAt = channels.has("calendar") || channels.has("todo")
      ? Date.now() + Number(dueIn || 0) * 3600 * 1000
      : undefined;
    const ids = pushBroadcast({
      senderId: senderPersona.id,
      senderName: senderPersona.name,
      recipients,
      channels: Array.from(channels),
      severity,
      title: title.trim(),
      body: body.trim(),
      dueAt,
      href: "/inbox",
    });
    toast.success(`Broadcast sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`, {
      description: `${ids.length} entries - ${Array.from(channels).join(" · ")}`,
    });
    // Reset form, keep audience selection.
    setTitle("");
    setBody("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between rounded-lg border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-left hover:bg-accent/10 transition"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-accent">
          <Megaphone className="h-4 w-4" />
          Broadcast to the team
        </span>
        <span className="text-[11px] text-muted-foreground">In-app · Todo · Calendar · Email</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-accent" />
        <h3 className="font-semibold text-sm">HR Broadcast</h3>
        <Badge variant="outline" className="ml-auto text-[10px] font-mono">
          from {senderPersona.name.split(" ")[0]}
        </Badge>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Recipients */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Recipients · {recipients.length} selected
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Button
            variant={mode === "role" ? "default" : "outline"}
            size="sm" className="h-7"
            onClick={() => setMode("role")}
          >
            <Users2 className="h-3 w-3 mr-1" /> Whole role
          </Button>
          <Button
            variant={mode === "people" ? "default" : "outline"}
            size="sm" className="h-7"
            onClick={() => setMode("people")}
          >
            Pick people
          </Button>
        </div>
        {mode === "role" ? (
          <Select value={targetRole} onValueChange={(v) => setTargetRole(v as Role)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {labelForRole(r)} ({peopleByRole[r].length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="grid grid-cols-2 gap-1 max-h-44 overflow-auto rounded-md border border-border p-2">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePerson(p.id)}
                className={cn(
                  "text-left text-[11px] rounded px-2 py-1 border",
                  targetIds.has(p.id)
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{labelForRole(p.role)} · {p.focus}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Channels */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Channels</div>
        <div className="flex flex-wrap gap-1.5">
          {([
            { c: "in-app", icon: Bell, label: "In-app" },
            { c: "todo", icon: ListTodo, label: "Todo" },
            { c: "calendar", icon: CalendarDays, label: "Calendar" },
            { c: "email", icon: Mail, label: "Email (queued)" },
          ] as const).map(({ c, icon: Icon, label }) => (
            <button
              key={c}
              onClick={() => toggleChannel(c)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
                channels.has(c)
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Severity + due */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Priority</div>
          <Select value={severity} onValueChange={(v) => setSeverity(v as NotifSeverity)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(channels.has("calendar") || channels.has("todo")) && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Due in (hrs)</div>
            <Input
              type="number"
              min={0}
              value={dueIn}
              onChange={(e) => setDueIn(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        )}
      </div>

      {/* Body */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Headline · e.g. New post-tour SLA: 60 minutes"
        className="text-sm"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Spell out the change, the why, and what each person should do."
        rows={3}
        className="text-sm"
      />

      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] text-muted-foreground">
          {channels.has("email") && <span className="mr-2">📧 Email queued - backend will send</span>}
          {channels.has("calendar") && <span className="mr-2">📅 Lands on /calendar</span>}
        </div>
        <Button onClick={send} size="sm" className="h-8">
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Send to {recipients.length}
        </Button>
      </div>
    </div>
  );
}

function labelForRole(r: Role): string {
  return r === "tcm" ? "TCMs" : r === "flow-ops" ? "Flow Ops" : r === "hr" ? "HR" : "Owners";
}
