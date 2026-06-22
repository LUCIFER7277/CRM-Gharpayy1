// Header role switcher — no login. Switch between Team, Manager, Admin, Owner.
import { useState } from "react";
import { useRole, saveRole, listOwners, type Role } from "@/property-genius/lib/roles";
import { ChevronDown, UserCog, Shield, Building, Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES: Array<{ k: Role; l: string; I: typeof Shield; desc: string }> = [
  { k: "team", l: "Gharpayy Teammate", I: Users, desc: "Sales floor — closer, leads, visits" },
  { k: "manager", l: "Manager", I: UserCog, desc: "Property ops, tenants, payments" },
  { k: "admin", l: "Gharpayy Admin", I: Shield, desc: "Full access — every module" },
  { k: "owner", l: "Property Owner", I: Building, desc: "See visits, mark rooms ready" },
];

export function RoleSwitcher() {
  const [open, setOpen] = useState(false);
  const { role, ownerCode } = useRole();
  const cur = ROLES.find((r) => r.k === role)!;
  const owners = listOwners();
  const activeOwner = owners.find((o) => o.code === ownerCode) ?? owners[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs font-medium hover:border-primary/40"
      >
        <cur.I className="h-3.5 w-3.5 text-primary" />
        <span className="hidden sm:inline">{cur.l}</span>
        <span className="sm:hidden">{cur.l.split(" ")[0]}</span>
        {role === "owner" && activeOwner && (
          <span className="font-mono text-[10px] text-muted-foreground">· {activeOwner.code.slice(-4)}</span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-card p-1.5 shadow-glow">
            <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">Switch persona</div>
            {ROLES.map((r) => (
              <button
                key={r.k}
                onClick={() => {
                  if (r.k === "owner") {
                    saveRole({ role: "owner", ownerCode: ownerCode ?? owners[0]?.code });
                  } else {
                    saveRole({ role: r.k });
                  }
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-surface-2",
                  role === r.k && "bg-primary/10",
                )}
              >
                <r.I className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{r.l}</div>
                  <div className="text-[10px] text-muted-foreground">{r.desc}</div>
                </div>
                {role === r.k && <Check className="mt-1 h-3 w-3 text-primary" />}
              </button>
            ))}

            {role === "owner" && (
              <div className="mt-1 border-t border-border pt-2">
                <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Acting as owner</div>
                <select
                  value={ownerCode ?? owners[0]?.code}
                  onChange={(e) => saveRole({ role: "owner", ownerCode: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
                >
                  {owners.map((o) => (
                    <option key={o.code} value={o.code}>{o.name} · {o.code} · {o.pgCount} PG{o.pgCount > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
