import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import { onEvent } from "@/lib/api/socket";
import type { DomainEvent } from "@/contracts";
import type { Tenant as LegacyTenant, TenantStatus } from "@/lib/types";

function toLegacy(raw: any): LegacyTenant {
  return {
    id: raw._id,
    bookingId: raw.bookingId,
    leadId: raw.leadId,
    propertyId: raw.propertyId,
    tcmId: raw.tcmId,
    name: raw.name,
    phone: raw.phone,
    email: raw.email ?? undefined,
    roomNumber: raw.roomNumber ?? undefined,
    moveInDate: raw.moveInDate,
    rent: raw.rent,
    deposit: raw.deposit,
    status: (raw.status as TenantStatus) ?? "active",
    noticeGivenAt: raw.noticeGivenAt ?? null,
    exitDate: raw.exitDate ?? null,
    notes: raw.notes ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function LiveTenantsBridge() {
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await api.tenants.list({ limit: 200 });
        if (cancelled) return;
        useApp.setState({ tenants: (r.items as any[]).map(toLegacy) });
      } catch (e) {
        if (!cancelled) useApp.setState({ tenants: [] });
      }
    };

    void load();

    const off = onEvent((e: DomainEvent) => {
      const cur = useApp.getState().tenants as LegacyTenant[];
      if (e.type === "evt.tenant.created") {
        const t = toLegacy((e as any).payload.tenant);
        const dupById = cur.find((x) => x.id === t.id);
        const dupByLead = cur.find((x) => x.leadId === t.leadId && x.id !== t.id);
        if (dupById) return;
        if (dupByLead) {
          useApp.setState({ tenants: cur.map((x) => (x.id === dupByLead.id ? t : x)) });
        } else {
          useApp.setState({ tenants: [t, ...cur] });
        }
      } else if (e.type === "evt.tenant.updated") {
        useApp.setState({
          tenants: cur.map((x) =>
            x.id === (e as any).payload.tenantId
              ? { ...x, ...(e as any).payload.patch, updatedAt: new Date().toISOString() }
              : x,
          ),
        });
      } else if (e.type === "evt.tenant.status_changed") {
        const p = (e as any).payload;
        useApp.setState({
          tenants: cur.map((x) =>
            x.id === p.tenantId
              ? { ...x, status: p.to as TenantStatus, exitDate: p.exitDate, updatedAt: new Date().toISOString() }
              : x,
          ),
        });
      }
    });

    const interval = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; off(); clearInterval(interval); };
  }, []);

  return null;
}
