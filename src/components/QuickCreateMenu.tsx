// Global "+ New" menu - accessible from the AppShell header on EVERY route.
// Keyboard: ⌘N / Ctrl+N opens it; Enter on focused item triggers.
// Opens contextual dialogs for: Lead (paste parser), Todo (quick-add), Activity (composer for last opened lead),
// Tour (navigates to MYT schedule). Designed for one-handed productivity.
import { useEffect, useState } from "react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target, ListTodo, Activity as ActivityIcon, CalendarPlus, FileText, MessageSquare, Zap } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { LeadPasteParser } from "@/components/leads/LeadPasteParser";
import { QuickAddLeadPanel } from "@/components/leads/QuickAddLeadPanel";
import { useTodos } from "@/hooks/useTodos";
import { toast } from "sonner";

type DialogKey = null | "lead" | "quicklead" | "todo" | "note";

export function QuickCreateMenu() {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKey>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const navigate = useNavigate();

  // Global ⌘N / Ctrl+N - open menu (or skip if a Lovable input is focused with modifier)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && !e.shiftKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="h-8 gap-1.5 px-2.5">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs font-medium">New</span>
            <kbd className="hidden md:inline-flex items-center rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1 text-[9px] font-mono">⌘N</kbd>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Create</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setDialog("lead")}>
            <Target className="h-4 w-4 mr-2 text-primary" /> Lead from paste
            <DropdownMenuShortcut>L</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setOpen(false); setQuickAddOpen(true); }}>
            <Zap className="h-4 w-4 mr-2 text-accent" /> Quick Add Lead
            <DropdownMenuShortcut>Q</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("todo")}>
            <ListTodo className="h-4 w-4 mr-2" /> Personal todo
            <DropdownMenuShortcut>T</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("note")}>
            <FileText className="h-4 w-4 mr-2" /> Quick note
            <DropdownMenuShortcut>N</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Schedule</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => { setOpen(false); navigate({ to: "/myt/schedule" }); }}>
            <CalendarPlus className="h-4 w-4 mr-2" /> Tour
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setOpen(false); navigate({ to: "/follow-ups" }); }}>
            <ActivityIcon className="h-4 w-4 mr-2" /> Follow-up
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setOpen(false); navigate({ to: "/sequences" }); }}>
            <MessageSquare className="h-4 w-4 mr-2" /> Outreach blast
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Lead from paste - paste box first, then full Quick Add field set for review */}
      <Dialog open={dialog === "lead"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="w-[96vw] max-w-[1180px] max-h-[calc(100dvh-16px)] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle>Paste a lead - auto-extract every field</DialogTitle>
            <DialogDescription>Paste lead details and review extracted fields before saving.</DialogDescription>
          </DialogHeader>
          {dialog === "lead" ? <LeadPasteParser onDone={() => setDialog(null)} /> : null}
        </DialogContent>
      </Dialog>

      {/* Quick todo */}
      <Dialog open={dialog === "todo"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick todo</DialogTitle>
            <DialogDescription>Create a personal task quickly from anywhere in the app.</DialogDescription>
          </DialogHeader>
          {dialog === "todo" ? <QuickTodoForm onDone={() => setDialog(null)} /> : null}
        </DialogContent>
      </Dialog>

      {/* Quick note */}
      <Dialog open={dialog === "note"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick note → todo</DialogTitle>
            <DialogDescription>Capture context now and convert it into a trackable todo.</DialogDescription>
          </DialogHeader>
          {dialog === "note" ? (
            <QuickTodoForm onDone={() => setDialog(null)} placeholder="What just happened? (becomes a personal task)" />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Quick Add Lead panel */}
      {quickAddOpen ? <QuickAddLeadPanel open={quickAddOpen} onClose={() => setQuickAddOpen(false)} /> : null}
    </>
  );
}

function QuickTodoForm({ onDone, placeholder = "What needs doing?" }: { onDone: () => void; placeholder?: string }) {
  const { create } = useTodos({ scope: "mine" });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "med" | "high" | "urgent">("med");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        const r = await create({ title: title.trim(), priority });
        setBusy(false);
        if (r.ok) { toast.success("Todo added"); setTitle(""); onDone(); }
        else toast.error(r.error || "Failed to add");
      }}
      className="space-y-3"
    >
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} />
      <div className="flex items-center gap-2">
        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="med">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!title.trim() || busy} className="ml-auto">
          {busy ? "Adding…" : "Add (⏎)"}
        </Button>
      </div>
    </form>
  );
}
