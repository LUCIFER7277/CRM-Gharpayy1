import { col } from "../../db/mongo.js";
import { ulid } from "../../../../src/contracts/ids.js";
import {
  CreateTenantCmd,
  UpdateTenantCmd,
  UpdateTenantStatusCmd,
  type Command,
} from "../../../../src/contracts/commands.js";
import { TenantEntity } from "../../../../src/contracts/entities.js";
import { emit, newEventId } from "../../realtime/event-bus.js";
import type { JwtClaims } from "../../auth/auth.js";

const TENANTS = "tenants";

export async function applyTenantCommand(cmd: Command, user: JwtClaims) {
  const now = new Date().toISOString();
  const correlationId = cmd._id;

  switch (cmd.type) {
    case "cmd.tenant.create": {
      const p = CreateTenantCmd.parse(cmd).payload;

      const tenant = TenantEntity.parse({
        _id: ulid(),
        bookingId: p.bookingId,
        leadId: p.leadId,
        propertyId: p.propertyId,
        tcmId: p.tcmId,
        name: p.name,
        phone: p.phone,
        email: p.email ?? "",
        roomNumber: p.roomNumber ?? "",
        moveInDate: p.moveInDate,
        rent: p.rent,
        deposit: p.deposit,
        status: "active",
        notes: p.notes ?? "",
        tenantId: user.tenantId,
        createdAt: now,
        updatedAt: now,
      });

      await col(TENANTS).insertOne({ ...tenant, __v: 1 });

      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.tenant.created",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { tenant },
      });

      return { ok: true, eventIds: [evtId], data: { tenant } };
    }

    case "cmd.tenant.update": {
      const p = UpdateTenantCmd.parse(cmd).payload;
      const patch = { ...p.patch, updatedAt: now };
      const r = await col(TENANTS).updateOne(
        { _id: p.tenantId, tenantId: user.tenantId },
        { $set: patch, $inc: { __v: 1 } },
      );
      if (r.matchedCount === 0) {
        return { ok: false, error: "NOT_FOUND: Tenant not found" };
      }
      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.tenant.updated",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { tenantId: p.tenantId, patch },
      });
      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.tenant.update_status": {
      const p = UpdateTenantStatusCmd.parse(cmd).payload;
      const before = await col<{ status: string }>(TENANTS).findOneAndUpdate(
        { _id: p.tenantId, tenantId: user.tenantId },
        { $set: { status: p.status, exitDate: p.exitDate ?? null, updatedAt: now }, $inc: { __v: 1 } },
        { returnDocument: "before" },
      );
      if (!before) {
        return { ok: false, error: "NOT_FOUND: Tenant not found" };
      }
      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.tenant.status_changed",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { tenantId: p.tenantId, from: before.status, to: p.status, exitDate: p.exitDate ?? null },
      });
      return { ok: true, eventIds: [evtId] };
    }
  }
  throw Object.assign(new Error(`Unknown command type: ${(cmd as { type: string }).type}`), { code: "BAD_COMMAND" });
}
