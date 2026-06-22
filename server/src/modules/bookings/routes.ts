import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { BookingEntity } from "../../../../src/contracts/entities.js";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { emit, newEventId } from "../../realtime/event-bus.js";

const ListQuery = z.object({
  status: z.string().optional(),
  propertyId: z.string().optional(),
  ownerId: z.string().optional(),
  lifecycle: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export function registerBookingsRoutes(app: FastifyInstance) {

  // ── GET /api/bookings ────────────────────────────────────────────────────
  app.get("/api/bookings", { preHandler: [requireAuth, requireScope("booking.read")] }, async (req, reply) => {
    const q = ListQuery.parse(req.query);
    const filter: Record<string, unknown> = { tenantId: req.user!.tenantId };
    if (q.status) filter.status = q.status;
    if (q.propertyId) filter.propertyId = q.propertyId;
    if (q.ownerId) filter.ownerId = q.ownerId;
    if (q.lifecycle) filter.ownerLifecycle = q.lifecycle;
    if (q.cursor) filter._id = { $lt: q.cursor };

    const items = await col<BookingEntity>("bookings")
      .find(filter)
      .sort({ _id: -1 })
      .limit(q.limit)
      .toArray();
    return reply.send({ items, nextCursor: items.length === q.limit ? items[items.length - 1]._id : null });
  });

  // ── GET /api/bookings/:id ────────────────────────────────────────────────
  app.get("/api/bookings/:id", { preHandler: [requireAuth, requireScope("booking.read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const booking = await col<BookingEntity>("bookings").findOne({ _id: id, tenantId: req.user!.tenantId });
    if (!booking) return reply.code(404).send({ code: "NOT_FOUND", message: "Booking not found" });
    return reply.send(booking);
  });

  // ── POST /api/bookings/:id/share-with-owner ──────────────────────────────
  // Sales / admin marks a booking as shared with the owner, advancing the
  // owner lifecycle so the owner can see it in their portal.
  app.post(
    "/api/bookings/:id/share-with-owner",
    { preHandler: [requireAuth, requireScope("booking.update")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const now = new Date().toISOString();

      const booking = await col("bookings").findOne({ _id: id, tenantId: req.user!.tenantId });
      if (!booking) return reply.code(404).send({ code: "NOT_FOUND", message: "Booking not found" });

      // Only advance if still at "created"
      const currentLifecycle = (booking as any).ownerLifecycle || "created";
      if (currentLifecycle !== "created") {
        return reply.send({ ok: true, alreadyShared: true, ownerLifecycle: currentLifecycle });
      }

      await col("bookings").updateOne(
        { _id: id },
        {
          $set: {
            ownerLifecycle: "shared_with_owner",
            sharedWithOwnerAt: now,
            updatedAt: now,
          },
          $push: {
            history: {
              ts: now,
              actor: req.user!.sub,
              text: "Shared with property owner",
            } as any,
          },
        },
      );

      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.booking.shared_with_owner",
        occurredAt: now,
        actor: req.user!.sub,
        tenantId: req.user!.tenantId,
        correlationId: evtId,
        causationId: null,
        version: 1,
        payload: { bookingId: id, ownerId: (booking as any).ownerId },
      });

      return reply.send({ ok: true, ownerLifecycle: "shared_with_owner" });
    },
  );
}
