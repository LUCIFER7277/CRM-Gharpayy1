import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CHIP_LABELS,
  type QueueChipFilter,
  type ViewMode,
} from "@/lib/crm10x/impact-queue-prefs";
import {
  Beaker,
  Flame,
  MoreHorizontal,
  Pin,
  SlidersHorizontal,
  Clock,
  PhoneOff,
  AlertTriangle,
  Target,
  Home,
} from "lucide-react";
import { ImpactFocusInventoryPanel } from "@/components/impact/ImpactFocusInventoryPanel";
import { useCRM10x } from "@/lib/crm10x/store";

export type QueueFilters = {
  chip: QueueChipFilter;
  area: string;
  type: string;
  room: string;
  need: string;
  actionRequired: string[];
  qualification: string[];
  moveIn: string[];
  propertyStatus: string[];
  objections: string[];
  assignment: string[];
};

const HEAT_OPTIONS: Array<{ key: QueueChipFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "hot", label: "Hot" },
  { key: "warm", label: "Warm" },
  { key: "cold", label: "Cold" },
  { key: "overdue", label: "Overdue only" },
];

function filtersActive(filters: QueueFilters): boolean {
  return (
    filters.chip !== "all" ||
    filters.area !== "all" ||
    filters.type !== "all" ||
    filters.room !== "all" ||
    filters.need !== "all" ||
    filters.actionRequired.length > 0 ||
    filters.qualification.length > 0 ||
    filters.moveIn.length > 0 ||
    filters.propertyStatus.length > 0 ||
    filters.objections.length > 0 ||
    filters.assignment.length > 0
  );
}

export function ImpactFiltersPopover({
  filters,
  uniqueAreas,
  onApply,
  onOpenMessageLab,
}: {
  filters: QueueFilters;
  uniqueAreas: string[];
  onApply: (next: QueueFilters) => void;
  onOpenMessageLab: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QueueFilters>(filters);
  const allObjections = useCRM10x((s) => s.objections);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const apply = () => {
    onApply(draft);
    setOpen(false);
  };

  const reset = () => {
    const cleared: QueueFilters = {
      chip: "all",
      area: "all",
      type: "all",
      room: "all",
      need: "all",
      actionRequired: [],
      qualification: [],
      moveIn: [],
      propertyStatus: [],
      objections: [],
      assignment: [],
    };
    setDraft(cleared);
    onApply(cleared);
    setOpen(false);
  };

  const toggleArrayItem = (key: keyof QueueFilters, item: string) => {
    setDraft((prev) => {
      const arr = prev[key] as string[];
      if (arr.includes(item)) {
        return { ...prev, [key]: arr.filter((x) => x !== item) };
      } else {
        return { ...prev, [key]: [...arr, item] };
      }
    });
  };

  const setArray = (key: keyof QueueFilters, arr: string[]) => {
    setDraft((prev) => ({ ...prev, [key]: arr }));
  };

  // Quick Filters logic
  const isQuickHot = draft.chip === "hot";
  const isQuickNoAction = draft.actionRequired.includes("no-next-action");
  const isQuickNeverCalled = draft.actionRequired.includes("never-called");
  const isQuickNoActivity24 = draft.actionRequired.includes("no-activity-24h");
  const isQuickMoveIn7 = draft.moveIn.includes("movein-0-7");
  const isQuickNoProperty = draft.propertyStatus.includes("property-not-selected");

  const quickFilterClass = (active: boolean) => 
    cn(
      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors shadow-sm", 
      active ? "border-orange-500 bg-orange-500 text-white" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
    );

  // Compute objection counts
  const objectionCounts = {
    "food-not-available": 0,
    "price-too-high": 0,
    "location-not-suitable": 0,
    "room-too-small": 0,
    "needs-family-approval": 0,
    "other": 0
  };
  for (const obj of allObjections) {
    if (obj.code in objectionCounts) {
       objectionCounts[obj.code as keyof typeof objectionCounts]++;
    } else {
       objectionCounts.other++;
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 shrink-0 rounded-md border px-2.5 text-[11px] font-medium flex items-center gap-1.5 transition-colors",
              filtersActive(filters)
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/5",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,50rem)] p-0 flex flex-col max-h-[85vh]">
          
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT PANEL */}
            <div className="w-1/3 min-w-[14rem] border-r border-border bg-muted/10 p-5 overflow-y-auto space-y-6">
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Heat
                </p>
                <div className="flex flex-wrap gap-2">
                  {HEAT_OPTIONS.map((item) => {
                    const active = draft.chip === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setDraft((prev) => ({ ...prev, chip: item.key }))}
                        className={cn("rounded-full border px-3 py-1 text-[11px] font-medium transition-colors flex items-center gap-1", active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background text-muted-foreground border-border hover:bg-muted")}
                      >
                        {item.key === "hot" && <Flame className={cn("h-3 w-3", active ? "text-primary-foreground" : "text-danger")} />}
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</p>
                  <Select value={draft.area} onValueChange={(area) => setDraft((prev) => ({ ...prev, area }))}>
                    <SelectTrigger className="h-8 text-[11px] bg-background"><SelectValue placeholder="All areas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[11px]">All areas</SelectItem>
                      {uniqueAreas.map((area) => (
                        <SelectItem key={area} value={area} className="text-[11px]">{area}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Room</p>
                  <Select value={draft.room} onValueChange={(room) => setDraft((prev) => ({ ...prev, room }))}>
                    <SelectTrigger className="h-8 text-[11px] bg-background"><SelectValue placeholder="All rooms" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[11px]">All rooms</SelectItem>
                      <SelectItem value="Private" className="text-[11px]">Private</SelectItem>
                      <SelectItem value="Shared" className="text-[11px]">Shared</SelectItem>
                      <SelectItem value="Both" className="text-[11px]">Both</SelectItem>
                      <SelectItem value="Studio" className="text-[11px]">Studio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</p>
                  <Select value={draft.type} onValueChange={(type) => setDraft((prev) => ({ ...prev, type }))}>
                    <SelectTrigger className="h-8 text-[11px] bg-background"><SelectValue placeholder="All types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[11px]">All types</SelectItem>
                      <SelectItem value="Student" className="text-[11px]">Student</SelectItem>
                      <SelectItem value="Working" className="text-[11px]">Working</SelectItem>
                      <SelectItem value="Intern" className="text-[11px]">Intern</SelectItem>
                      <SelectItem value="Family" className="text-[11px]">Family</SelectItem>
                      <SelectItem value="Other" className="text-[11px]">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Needs</p>
                  <Select value={draft.need} onValueChange={(need) => setDraft((prev) => ({ ...prev, need }))}>
                    <SelectTrigger className="h-8 text-[11px] bg-background"><SelectValue placeholder="All needs" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[11px]">All needs</SelectItem>
                      <SelectItem value="Boys" className="text-[11px]">Boys</SelectItem>
                      <SelectItem value="Girls" className="text-[11px]">Girls</SelectItem>
                      <SelectItem value="Coed" className="text-[11px]">Coed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="w-2/3 p-5 overflow-y-auto space-y-7">
              
              {/* Quick Filters */}
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Quick Filters (Most Used)</p>
                <div className="flex flex-wrap gap-2.5 mt-2">
                  <button 
                    onClick={() => setDraft(prev => ({ ...prev, chip: isQuickHot ? "all" : "hot" }))}
                    className={quickFilterClass(isQuickHot)}
                  >
                    <Flame className="h-3.5 w-3.5" /> Hot
                  </button>
                  <button 
                    onClick={() => toggleArrayItem("actionRequired", "no-next-action")}
                    className={quickFilterClass(isQuickNoAction)}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> No Next Action
                  </button>
                  <button 
                    onClick={() => toggleArrayItem("actionRequired", "never-called")}
                    className={quickFilterClass(isQuickNeverCalled)}
                  >
                    <PhoneOff className="h-3.5 w-3.5" /> Never Called
                  </button>
                  <button 
                    onClick={() => toggleArrayItem("actionRequired", "no-activity-24h")}
                    className={quickFilterClass(isQuickNoActivity24)}
                  >
                    <Clock className="h-3.5 w-3.5" /> No Activity 24h+
                  </button>
                  <button 
                    onClick={() => toggleArrayItem("moveIn", "movein-0-7")}
                    className={quickFilterClass(isQuickMoveIn7)}
                  >
                    <Target className="h-3.5 w-3.5" /> Move-in &lt; 7 Days
                  </button>
                  <button 
                    onClick={() => toggleArrayItem("propertyStatus", "property-not-selected")}
                    className={quickFilterClass(isQuickNoProperty)}
                  >
                    <Home className="h-3.5 w-3.5" /> Property Not Selected
                  </button>
                </div>
              </div>

              {/* Grid sections */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Funnel Health</p>
                  <div className="space-y-2">
                    {[
                      { k: "profile-complete", l: "Deep Profile Complete" },
                      { k: "profile-incomplete", l: "Deep Profile Incomplete" },
                      { k: "budget-verified", l: "Budget Verified" },
                      { k: "budget-unverified", l: "Budget Unverified" }
                    ].map(opt => (
                      <label key={opt.k} className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                        <Checkbox checked={draft.qualification.includes(opt.k)} onCheckedChange={() => toggleArrayItem("qualification", opt.k)} />
                        {opt.l}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Lead Activity</p>
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.actionRequired.includes("no-activity-48h")} onCheckedChange={() => toggleArrayItem("actionRequired", "no-activity-48h")} />
                      🚨 No Activity 48h+
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.actionRequired.includes("no-activity-24h")} onCheckedChange={() => toggleArrayItem("actionRequired", "no-activity-24h")} />
                      ⚠ No Activity 24h+
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.actionRequired.includes("never-called")} onCheckedChange={() => toggleArrayItem("actionRequired", "never-called")} />
                      📞 Never Called
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.chip === "tour-today"} onCheckedChange={(c) => setDraft(p => ({ ...p, chip: c ? "tour-today" : "all" }))} />
                      📅 Tour Today
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.chip === "quote-pending"} onCheckedChange={(c) => setDraft(p => ({ ...p, chip: c ? "quote-pending" : "all" }))} />
                      💰 Quote Pending
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.assignment.includes("assigned-to-me")} onCheckedChange={() => toggleArrayItem("assignment", "assigned-to-me")} />
                      👤 Assigned To Me
                    </label>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Conversion Risk</p>
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.qualification.includes("budget-unverified")} onCheckedChange={() => toggleArrayItem("qualification", "budget-unverified")} />
                      Budget Not Verified
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.propertyStatus.includes("property-not-selected")} onCheckedChange={() => toggleArrayItem("propertyStatus", "property-not-selected")} />
                      Property Not Selected
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.qualification.includes("profile-incomplete")} onCheckedChange={() => toggleArrayItem("qualification", "profile-incomplete")} />
                      Deep Profile Incomplete
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.actionRequired.includes("no-activity-24h")} onCheckedChange={() => toggleArrayItem("actionRequired", "no-activity-24h")} />
                      No Activity 24h+
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium leading-tight">
                      <Checkbox checked={draft.actionRequired.includes("never-called")} onCheckedChange={() => toggleArrayItem("actionRequired", "never-called")} />
                      Never Called
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Move-In Urgency</p>
                <div className="flex gap-1 bg-muted/50 p-1 rounded-md border border-border w-max">
                  {[
                    { k: "movein-0-7", l: "0-7 Days" },
                    { k: "movein-8-15", l: "8-15 Days" },
                    { k: "movein-16-30", l: "16-30 Days" }
                  ].map(opt => {
                    const active = draft.moveIn.includes(opt.k);
                    return (
                      <button 
                        key={opt.k}
                        onClick={() => setArray("moveIn", active ? [] : [opt.k])}
                        className={cn("px-4 py-1.5 rounded-sm text-[11px] font-semibold transition-all", active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/50 hover:text-foreground")}
                      >
                        {opt.l}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Property Status</p>
                <div className="flex flex-wrap gap-4">
                  {[
                    { k: "property-selected", l: "Property Selected" },
                    { k: "property-not-selected", l: "Property Not Selected" },
                    { k: "other-property", l: "Other Property" }
                  ].map(opt => (
                    <label key={opt.k} className="flex cursor-pointer items-center gap-2 text-[11px] font-medium">
                      <div className={cn("h-4 w-4 rounded-full border border-primary flex items-center justify-center p-[3px] transition-colors", draft.propertyStatus.includes(opt.k) ? "bg-primary text-primary-foreground" : "bg-transparent")} onClick={() => setArray("propertyStatus", draft.propertyStatus.includes(opt.k) ? [] : [opt.k])}>
                        {draft.propertyStatus.includes(opt.k) && <div className="h-full w-full rounded-full bg-primary-foreground" />}
                      </div>
                      {opt.l}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Objections</p>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { k: "food-not-available", l: "Food" },
                    { k: "price-too-high", l: "Budget" },
                    { k: "location-not-suitable", l: "Distance" },
                    { k: "room-too-small", l: "Room" },
                    { k: "needs-family-approval", l: "Parent" },
                    { k: "other", l: "Other" }
                  ].map(opt => {
                    const active = draft.objections.includes(opt.k);
                    const count = objectionCounts[opt.k as keyof typeof objectionCounts] || 0;
                    return (
                      <button 
                        key={opt.k}
                        onClick={() => toggleArrayItem("objections", opt.k)}
                        className={cn("rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors flex items-center gap-1.5", active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background text-muted-foreground hover:bg-muted")}
                      >
                        {opt.l} <span className={cn("text-[10px]", active ? "text-primary-foreground/80" : "text-muted-foreground/70")}>({count})</span>
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3 bg-muted/20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-8 rounded-md border border-border bg-background px-3 text-[11px] font-semibold flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  Tools
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Queue extras
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="text-xs"
                  onSelect={(event) => {
                    event.preventDefault();
                    setOpen(false);
                    onOpenMessageLab();
                  }}
                >
                  <Beaker className="mr-1 h-3 w-3 text-accent" />
                  Message lab
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 px-4 text-xs font-semibold" onClick={reset}>
                Reset All
              </Button>
              <Button size="sm" className="h-8 px-6 text-xs font-semibold" onClick={apply}>
                Apply Filters
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ImpactFocusPopover({
  tcmFilter,
  tcmOptions,
  onFilterArea,
}: {
  tcmFilter: string;
  tcmOptions: Array<{ id: string; fullName?: string; name?: string; zone?: string; zones?: string[] }>;
  onFilterArea?: (area: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 shrink-0 rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 flex items-center gap-1.5 transition-colors"
        >
          <Pin className="h-3.5 w-3.5 text-accent" />
          <span className="hidden sm:inline">Today&apos;s focus</span>
          <span className="sm:hidden">Focus</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-3">
        <ImpactFocusInventoryPanel
          tcmFilter={tcmFilter}
          tcmOptions={tcmOptions}
          onPropertyTap={(area) => {
            onFilterArea?.(area);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ImpactQueueMetaBar({
  leadCount,
  view,
}: {
  leadCount: number;
  view: ViewMode;
}) {
  return (
    <div className="flex items-center gap-2 border-t border-border/70 bg-background px-3 py-1 text-[10px] text-muted-foreground">
      <span>
        {leadCount} lead{leadCount !== 1 ? "s" : ""} in queue
      </span>
    </div>
  );
}
