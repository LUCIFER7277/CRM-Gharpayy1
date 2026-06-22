import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard, Target, CalendarPlus, ClipboardList, Boxes, Activity, Sun, Phone, MessageSquare, Trophy, Sparkles, IndianRupee, MapPin, Zap, Plus, ListTodo,
} from "lucide-react";

/** ⌘K - instant jump to any lead, route, or quick action. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { leads, selectLead, logCall, sendMessage } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string) => { setOpen(false); navigate({ to: path }); };
  const openLead = (id: string) => { setOpen(false); selectLead(id); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to lead, page, or action…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Create new">
          <CommandItem value="new lead paste" onSelect={() => { setOpen(false); window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true })); }}>
            <Plus className="mr-2 h-4 w-4 text-primary" /> Lead from paste <span className="ml-auto text-[10px] text-muted-foreground">⌘N</span>
          </CommandItem>
          <CommandItem value="new todo task" onSelect={() => { setOpen(false); navigate({ to: "/my-tasks" }); }}>
            <ListTodo className="mr-2 h-4 w-4" /> Personal todo
          </CommandItem>
          <CommandItem value="schedule tour" onSelect={() => go("/myt/schedule")}>
            <CalendarPlus className="mr-2 h-4 w-4" /> Schedule tour
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/today")}><Sun className="mr-2 h-4 w-4" /> Today (Do next)</CommandItem>
          <CommandItem onSelect={() => go("/leads")}><Target className="mr-2 h-4 w-4" /> Leads</CommandItem>
          <CommandItem onSelect={() => go("/tours")}><CalendarPlus className="mr-2 h-4 w-4" /> Tours</CommandItem>
          <CommandItem onSelect={() => go("/follow-ups")}><ClipboardList className="mr-2 h-4 w-4" /> Follow-ups</CommandItem>
          <CommandItem onSelect={() => go("/handoffs")}><MessageSquare className="mr-2 h-4 w-4" /> Handoffs</CommandItem>
          <CommandItem onSelect={() => go("/sequences")}><Zap className="mr-2 h-4 w-4" /> Sequences</CommandItem>
          <CommandItem onSelect={() => go("/revival")}><Sparkles className="mr-2 h-4 w-4" /> Revival queue</CommandItem>
          <CommandItem onSelect={() => go("/heatmap")}><MapPin className="mr-2 h-4 w-4" /> Demand heatmap</CommandItem>
          <CommandItem onSelect={() => go("/revenue")}><IndianRupee className="mr-2 h-4 w-4" /> Revenue</CommandItem>
          <CommandItem onSelect={() => go("/leaderboard")}><Trophy className="mr-2 h-4 w-4" /> Leaderboard</CommandItem>
          <CommandItem onSelect={() => go("/inventory")}><Boxes className="mr-2 h-4 w-4" /> Inventory</CommandItem>
          <CommandItem onSelect={() => go("/activity")}><Activity className="mr-2 h-4 w-4" /> Activity</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Leads">
          {leads.slice(0, 30).map((l) => (
            <CommandItem key={l.id} value={`${l.name} ${l.phone} ${l.preferredArea}`} onSelect={() => openLead(l.id)}>
              <Target className="mr-2 h-4 w-4" />
              <span className="font-medium">{l.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{l.phone} · {l.preferredArea}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Quick actions on selected lead">
          {leads.slice(0, 5).map((l) => (
            <CommandItem key={`call-${l.id}`} value={`call ${l.name}`} onSelect={() => { logCall(l.id); setOpen(false); }}>
              <Phone className="mr-2 h-4 w-4" /> Log call · {l.name}
            </CommandItem>
          ))}
          {leads.slice(0, 5).map((l) => (
            <CommandItem key={`wa-${l.id}`} value={`whatsapp ${l.name}`} onSelect={() => { sendMessage(l.id, "WhatsApp template sent"); setOpen(false); }}>
              <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp · {l.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
