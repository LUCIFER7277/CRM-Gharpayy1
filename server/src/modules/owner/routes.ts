/**
 * Owner portal API routes — /api/v1/owner/*
 *
 * All endpoints:
 *  - Require a valid common JWT (Bearer token from /api/auth/login)
 *  - Require role === "owner"
 *  - Scope all queries to req.user!.sub (the owner's MongoDB _id) and req.user!.tenantId
 *
 * No separate owner login endpoint. Owners authenticate through the same
 * /api/auth/login used by all other roles.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth } from "../../middleware/auth.js";
import type { UserDoc } from "../../auth/auth.js";
import type { BookingEntity } from "../../../../src/contracts/entities.js";

// ── Auth guard: role must be "owner" ────────────────────────────────────────
async function requireOwner(req: FastifyRequest, reply: FastifyReply) {
  if (req.user?.role !== "owner") {
    return reply.code(403).send({ code: "FORBIDDEN", message: "Owner access only" });
  }
}

const preHandler = [requireAuth, requireOwner];

// ── Helpers ──────────────────────────────────────────────────────────────────

function ownerPropertyFilter(ownerId: string, tenantId: string) {
  return { ownerId, tenantId };
}

/** Map a raw MongoDB property doc to the shape the owner portal expects. */
function mapProperty(p: any) {
  return {
    id: p._id,
    name: p.name,
    area: p.area,
    address: p.address || p.area,
    totalRooms: p.totalBeds || 0,
    availableRooms: p.vacantBeds || 0,
    totalBeds: p.totalBeds || 0,
    vacantBeds: p.vacantBeds || 0,
    monthlyRent: p.pricePerBed || 0,
    pricePerBed: p.pricePerBed || 0,
    availability: (p.vacantBeds > 0) ? "AVAILABLE" : "FULL",
    isVerified: true,
    avgRating: p.avgRating ?? undefined,
    zoneId: p.zoneId,
    ownerId: p.ownerId,
  };
}

/**
 * Convert a canonical BookingEntity to the richer OwnerBooking shape
 * expected by the owner portal frontend.
 */
function bookingToOwnerView(b: any) {
  return {
    id: b._id,
    status: b.ownerLifecycle || "created",
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    sharedAt: b.sharedWithOwnerAt ?? undefined,
    viewedAt: b.viewedByOwnerAt ?? undefined,
    acknowledgedAt: b.acknowledgedAt ?? undefined,
    readyAt: b.readyAt ?? undefined,
    moveInApprovedAt: b.moveInApprovedAt ?? undefined,
    completedAt: b.completedAt ?? undefined,
    customer: {
      name: b.tenantName || "",
      phone: b.tenantPhone || "",
      gender: b.customerGender || "male",
      occupation: b.customerOccupation || "working",
      companyOrCollege: b.companyOrCollege || "",
      emergencyName: b.emergencyName || "",
      emergencyPhone: b.emergencyPhone || "",
    },
    inventory: {
      propertyId: b.propertyId || "",
      propertyName: b.propertyName || "",
      floor: b.floor || "",
      roomNumber: b.roomNumber || "",
      bedNumber: b.bedNumber || "A",
      sharing: b.sharing || "double",
      category: b.category || "standard",
    },
    ownerId: b.ownerId || "",
    rent: b.amount || 0,
    deposit: b.deposit || 0,
    payments: b.paymentLines && b.paymentLines.length > 0
      ? b.paymentLines
      : [
          { id: "p1", label: "Booking Amount", amount: b.amount || 0, status: "received", receivedAt: b.createdAt },
          { id: "p2", label: "Security Deposit", amount: b.deposit || 0, status: "pending" },
        ],
    moveIn: {
      date: b.moveInDate || new Date().toISOString().slice(0, 10),
      time: b.moveInTime || "11:00",
      stayMonths: b.stayMonths || 11,
      lockInMonths: b.lockInMonths || 3,
      noticeDays: b.noticeDays || 30,
    },
    specialRequests: b.specialRequests || [],
    ownerDecision: b.ownerDecision ?? undefined,
    ownerDecisionAt: b.ownerDecisionAt ?? undefined,
    ownerConditionNote: b.ownerConditionNote ?? undefined,
    ownerRejectionReason: b.ownerRejectionReason ?? undefined,
    readiness: b.readiness || {
      cleaning: "pending", furniture: "pending", internet: "pending",
      electricity: "pending", water: "pending", inspection: "pending",
    },
    history: b.history || [],
    leadId: b.leadId ?? undefined,
    tourId: b.tourId ?? undefined,
    createdBy: b.tcmId ?? undefined,
  };
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerOwnerRoutes(app: FastifyInstance) {

  // ── GET /api/v1/owner/me ─────────────────────────────────────────────────
  // Returns the owner's own profile.
  app.get("/api/v1/owner/me", { preHandler }, async (req, reply) => {
    const user = await col<UserDoc>("users").findOne({ _id: req.user!.sub });
    if (!user) return reply.code(404).send({ code: "NOT_FOUND", message: "User not found" });
    return reply.send({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone ?? "",
        role: user.role,
      },
    });
  });

  // ── GET /api/v1/owner/properties ────────────────────────────────────────
  // Returns only properties linked to this owner.
  app.get("/api/v1/owner/properties", { preHandler }, async (req, reply) => {
    const properties = await col("properties")
      .find(ownerPropertyFilter(req.user!.sub, req.user!.tenantId))
      .toArray();
    return reply.send({ success: true, data: properties.map(mapProperty) });
  });

  // ── POST /api/v1/owner/properties ───────────────────────────────────────
  // Owner adds a new property (linked to their account).
  const CreatePropertyBody = z.object({
    name: z.string().min(1).max(120),
    address: z.string().min(1).max(250),
    area: z.string().min(1).max(120),
    pincode: z.string().max(10).optional(),
    basePrice: z.number().int().min(0),
    deposit: z.number().int().min(0).optional(),
    genderCategory: z.enum(["MALE", "FEMALE", "ANY"]).optional(),
    propertyType: z.string().optional(),
    totalRooms: z.number().int().min(0).optional(),
    availableRooms: z.number().int().min(0).optional(),
    amenities: z.array(z.string()).optional(),
    nearbyMetro: z.string().optional(),
    nearbyLandmark: z.string().optional(),
    referralBonus: z.number().int().min(0).optional(),
  });

  app.post("/api/v1/owner/properties", { preHandler }, async (req, reply) => {
    const body = CreatePropertyBody.parse(req.body);
    const { ulid } = await import("../../../../src/contracts/ids.js");
    const now = new Date().toISOString();

    // Get owner's name for denormalisation
    const owner = await col<UserDoc>("users").findOne({ _id: req.user!.sub });

    const doc = {
      _id: ulid(),
      tenantId: req.user!.tenantId,
      ownerId: req.user!.sub,
      ownerName: owner?.fullName ?? null,
      name: body.name.trim(),
      area: body.area.trim(),
      address: body.address.trim(),
      zoneId: "zone-1", // default zone; can be updated by admin later
      totalBeds: body.totalRooms ?? 0,
      vacantBeds: body.availableRooms ?? 0,
      pricePerBed: body.basePrice,
      amenities: body.amenities ?? [],
      genderCategory: body.genderCategory ?? "ANY",
      propertyType: body.propertyType ?? "PG",
      nearbyMetro: body.nearbyMetro ?? null,
      nearbyLandmark: body.nearbyLandmark ?? null,
      referralBonus: body.referralBonus ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    await col("properties").insertOne(doc);
    return reply.code(201).send({ success: true, data: mapProperty(doc) });
  });

  // ── GET /api/v1/owner/stats ─────────────────────────────────────────────
  // Occupancy statistics for all owner properties.
  app.get("/api/v1/owner/stats", { preHandler }, async (req, reply) => {
    const ownerId = req.user!.sub;
    const tenantId = req.user!.tenantId;

    const properties = await col("properties")
      .find(ownerPropertyFilter(ownerId, tenantId))
      .toArray();

    if (properties.length === 0) {
      return reply.send({
        success: true,
        data: {
          overall: { totalProperties: 0, totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, blockedBeds: 0, occupancyPct: 0 },
          properties: [],
        },
      });
    }

    const propIds = properties.map((p) => p._id);

    // Fetch rooms for these properties
    const rooms = await col("rooms").find({ propertyId: { $in: propIds } }).toArray();
    const roomIds = rooms.map((r: any) => r.customId || r._id);
    const roomStatuses = roomIds.length > 0
      ? await col("room_statuses").find({ roomId: { $in: roomIds } }).toArray()
      : [];

    let overallTotal = 0, overallOccupied = 0, overallVacant = 0, overallBlocked = 0;

    const propertyStats = properties.map((prop) => {
      const propRooms = rooms.filter((r: any) => r.propertyId === prop._id);
      let total = 0, occupied = 0, vacant = 0, blocked = 0;

      propRooms.forEach((room: any) => {
        const rid = room.customId || room._id;
        const beds = room.bedsTotal || 1;
        const s = roomStatuses.find((st: any) => st.roomId === rid);
        const kind = s?.kind || "vacant";

        total += beds;
        if (s?.lockedUnsellable || kind === "blocked") blocked += beds;
        else if (kind === "vacant" || kind === "vacating") vacant += beds;
        else occupied += beds;
      });

      // Fall back to property-level bed counts when no rooms are seeded
      if (total === 0) {
        total = (prop as any).totalBeds || 0;
        vacant = (prop as any).vacantBeds || 0;
        occupied = Math.max(0, total - vacant);
      }

      overallTotal += total;
      overallOccupied += occupied;
      overallVacant += vacant;
      overallBlocked += blocked;

      return {
        propertyId: prop._id,
        propertyName: (prop as any).name,
        totalBeds: total,
        occupiedBeds: occupied,
        vacantBeds: vacant,
        blockedBeds: blocked,
        occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0,
      };
    });

    return reply.send({
      success: true,
      data: {
        overall: {
          totalProperties: properties.length,
          totalBeds: overallTotal,
          occupiedBeds: overallOccupied,
          vacantBeds: overallVacant,
          blockedBeds: overallBlocked,
          occupancyPct: overallTotal > 0 ? Math.round((overallOccupied / overallTotal) * 100) : 0,
        },
        properties: propertyStats,
      },
    });
  });

  // ── GET /api/v1/owner/rooms ─────────────────────────────────────────────
  // All rooms across owner's properties.
  app.get("/api/v1/owner/rooms", { preHandler }, async (req, reply) => {
    const ownerId = req.user!.sub;
    const tenantId = req.user!.tenantId;

    const properties = await col("properties")
      .find(ownerPropertyFilter(ownerId, tenantId))
      .toArray();

    if (properties.length === 0) {
      return reply.send({ success: true, data: { rooms: [], roomStatuses: [], roomMedia: [] } });
    }

    const propIds = properties.map((p) => p._id);
    const rooms = await col("rooms").find({ propertyId: { $in: propIds } }).toArray();
    const roomIds = rooms.map((r: any) => r.customId || r._id);
    const roomStatuses = roomIds.length > 0
      ? await col("room_statuses").find({ roomId: { $in: roomIds } }).toArray()
      : [];
    const roomMedia = roomIds.length > 0
      ? await col("room_media").find({ roomId: { $in: roomIds } }).toArray()
      : [];

    return reply.send({ success: true, data: { rooms, roomStatuses, roomMedia } });
  });

  // ── POST /api/v1/owner/rooms ─────────────────────────────────────────────
  // Add a room to one of the owner's properties.
  const AddRoomBody = z.object({
    propertyId: z.string(),
    type: z.string().min(1), // room number / label
    bedsTotal: z.number().int().min(1).default(1),
    price: z.number().int().min(0).default(0),
    actualRent: z.number().int().min(0).optional(),
    expectedRent: z.number().int().min(0).optional(),
    lowestAcceptableRent: z.number().int().min(0).optional(),
    floorPrice: z.number().int().min(0).optional(),
  });

  app.post("/api/v1/owner/rooms", { preHandler }, async (req, reply) => {
    const body = AddRoomBody.parse(req.body);
    const ownerId = req.user!.sub;
    const tenantId = req.user!.tenantId;

    // Verify property belongs to this owner
    const prop = await col("properties").findOne({
      _id: body.propertyId,
      ownerId,
      tenantId,
    });
    if (!prop) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Property not found or not owned by you" });
    }

    const { ulid } = await import("../../../../src/contracts/ids.js");
    const now = new Date().toISOString();
    const roomId = `r-${body.propertyId}-${body.type.replace(/\s+/g, "-")}-${ulid().slice(-6)}`;

    await col("rooms").insertOne({
      _id: roomId,
      customId: roomId,
      propertyId: body.propertyId,
      type: body.type,
      bedsTotal: body.bedsTotal,
      bedsOccupied: 0,
      currentPrice: body.price,
      tenantId,
    });

    await col("room_statuses").insertOne({
      roomId,
      propertyId: body.propertyId,
      ownerId,
      kind: "vacant",
      rentConfirmed: body.price,
      actualRent: body.actualRent ?? body.price,
      expectedRent: body.expectedRent ?? body.price,
      lowestAcceptableRent: body.lowestAcceptableRent ?? body.floorPrice ?? Math.round(body.price * 0.9),
      floorPrice: body.floorPrice ?? Math.round(body.price * 0.9),
      updatedAt: now,
      verifiedToday: true,
      lockedUnsellable: false,
    });

    return reply.code(201).send({ success: true, data: { roomId } });
  });

  // ── DELETE /api/v1/owner/rooms/:roomId ───────────────────────────────────
  app.delete("/api/v1/owner/rooms/:roomId", { preHandler }, async (req, reply) => {
    const { roomId } = req.params as { roomId: string };
    const ownerId = req.user!.sub;

    // Verify ownership via room_statuses
    const status = await col("room_statuses").findOne({ roomId, ownerId });
    if (!status) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Room not found or not owned by you" });
    }

    await col("rooms").deleteOne({ $or: [{ _id: roomId }, { customId: roomId }] });
    await col("room_statuses").deleteOne({ roomId });
    await col("room_media").deleteMany({ roomId });

    return reply.send({ success: true });
  });

  // ── PUT /api/v1/owner/rooms/:roomId/status ───────────────────────────────
  const UpdateStatusBody = z.object({
    kind: z.enum(["vacant", "vacating", "occupied", "blocked"]).optional(),
    actualRent: z.number().int().min(0).optional(),
    expectedRent: z.number().int().min(0).optional(),
    lowestAcceptableRent: z.number().int().min(0).optional(),
    floorPrice: z.number().int().min(0).optional(),
    vacatingDate: z.string().optional(),
    notes: z.string().max(500).optional(),
  });

  app.put("/api/v1/owner/rooms/:roomId/status", { preHandler }, async (req, reply) => {
    const { roomId } = req.params as { roomId: string };
    const ownerId = req.user!.sub;
    const body = UpdateStatusBody.parse(req.body);

    const status = await col("room_statuses").findOne({ roomId, ownerId });
    if (!status) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Room not found or not owned by you" });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.kind !== undefined) patch.kind = body.kind;
    if (body.actualRent !== undefined) patch.actualRent = body.actualRent;
    if (body.expectedRent !== undefined) patch.expectedRent = body.expectedRent;
    if (body.lowestAcceptableRent !== undefined) patch.lowestAcceptableRent = body.lowestAcceptableRent;
    if (body.floorPrice !== undefined) patch.floorPrice = body.floorPrice;
    if (body.vacatingDate !== undefined) patch.vacatingDate = body.vacatingDate;
    if (body.notes !== undefined) patch.notes = body.notes;

    await col("room_statuses").updateOne({ roomId }, { $set: patch });
    return reply.send({ success: true });
  });

  // ── POST /api/v1/owner/rooms/:roomId/verify ─────────────────────────────
  // Owner confirms room status is current (24h confirmation ritual).
  app.post("/api/v1/owner/rooms/:roomId/verify", { preHandler }, async (req, reply) => {
    const { roomId } = req.params as { roomId: string };
    const ownerId = req.user!.sub;

    const status = await col("room_statuses").findOne({ roomId, ownerId });
    if (!status) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Room not found or not owned by you" });
    }

    await col("room_statuses").updateOne(
      { roomId },
      { $set: { verifiedToday: true, lastVerifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
    );
    return reply.send({ success: true });
  });

  // ── PUT /api/v1/owner/rooms/:roomId/details ──────────────────────────────
  // Update readiness / USP fields.
  const UpdateDetailsBody = z.object({
    commercial: z.string().optional(),
    operational: z.string().optional(),
    turnaround: z.string().optional(),
    reason: z.string().optional(),
    availableFrom: z.string().optional(),
    uspSize: z.string().optional(),
    uspVentilation: z.string().optional(),
    uspWindow: z.string().optional(),
    uspSunlight: z.string().optional(),
    uspView: z.string().optional(),
    uspWashroom: z.string().optional(),
    uspNoise: z.string().optional(),
    uspPosition: z.string().optional(),
    uspFurniture: z.string().optional(),
  });

  app.put("/api/v1/owner/rooms/:roomId/details", { preHandler }, async (req, reply) => {
    const { roomId } = req.params as { roomId: string };
    const ownerId = req.user!.sub;
    const body = UpdateDetailsBody.parse(req.body);

    const status = await col("room_statuses").findOne({ roomId, ownerId });
    if (!status) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Room not found or not owned by you" });
    }

    await col("room_statuses").updateOne(
      { roomId },
      { $set: { ...body, updatedAt: new Date().toISOString() } },
    );
    return reply.send({ success: true });
  });

  // ── GET /api/v1/owner/bookings ───────────────────────────────────────────
  // All bookings for the owner's properties, scoped strictly to this owner.
  app.get("/api/v1/owner/bookings", { preHandler }, async (req, reply) => {
    const ownerId = req.user!.sub;
    const tenantId = req.user!.tenantId;
    const q = z.object({
      status: z.string().optional(),
      lifecycle: z.string().optional(),
      limit: z.coerce.number().min(1).max(200).default(100),
    }).parse(req.query);

    // Scope strictly to bookings owned by this owner
    const filter: Record<string, unknown> = { ownerId, tenantId };
    if (q.status) filter.status = q.status;
    if (q.lifecycle) filter.ownerLifecycle = q.lifecycle;

    const bookings = await col("bookings")
      .find(filter)
      .sort({ _id: -1 })
      .limit(q.limit)
      .toArray();

    // Enrich with property names for display
    const propIds = [...new Set(bookings.map((b: any) => b.propertyId).filter(Boolean))];
    const props = propIds.length > 0
      ? await col("properties").find({ _id: { $in: propIds }, tenantId }).toArray()
      : [];
    const propMap = new Map(props.map((p) => [p._id, (p as any).name]));

    const enriched = bookings.map((b: any) => ({
      ...b,
      propertyName: propMap.get(b.propertyId) || b.propertyName || "",
    }));

    return reply.send({ success: true, data: enriched.map(bookingToOwnerView) });
  });

  // ── GET /api/v1/owner/bookings/pending ───────────────────────────────────
  // Pending approvals — bookings that need owner action.
  app.get("/api/v1/owner/bookings/pending", { preHandler }, async (req, reply) => {
    const ownerId = req.user!.sub;
    const tenantId = req.user!.tenantId;

    const pending = await col("bookings")
      .find({
        ownerId,
        tenantId,
        ownerLifecycle: { $in: ["created", "shared_with_owner", "viewed_by_owner"] },
        ownerDecision: null,
      })
      .sort({ _id: -1 })
      .toArray();

    const propIds = [...new Set(pending.map((b: any) => b.propertyId).filter(Boolean))];
    const props = propIds.length > 0
      ? await col("properties").find({ _id: { $in: propIds }, tenantId }).toArray()
      : [];
    const propMap = new Map(props.map((p) => [p._id, (p as any).name]));
    const enriched = pending.map((b: any) => ({
      ...b,
      propertyName: propMap.get(b.propertyId) || "",
    }));

    return reply.send({ success: true, data: enriched.map(bookingToOwnerView) });
  });

  // ── PATCH /api/v1/owner/bookings/:bookingId/lifecycle ───────────────────
  // Owner advances the owner lifecycle (share, view, acknowledge, ready, approve move-in, complete).
  const LifecycleBody = z.object({
    action: z.enum([
      "share_with_owner",
      "mark_viewed",
      "acknowledge",
      "mark_ready",
      "approve_move_in",
      "complete",
      "reject",
    ]),
    note: z.string().max(1000).optional(),
  });

  app.patch("/api/v1/owner/bookings/:bookingId/lifecycle", { preHandler }, async (req, reply) => {
    const { bookingId } = req.params as { bookingId: string };
    const ownerId = req.user!.sub;
    const tenantId = req.user!.tenantId;
    const { action, note } = LifecycleBody.parse(req.body);
    const now = new Date().toISOString();

    const booking = await col("bookings").findOne({ _id: bookingId, ownerId, tenantId });
    if (!booking) {
      return reply.code(404).send({ code: "NOT_FOUND", message: "Booking not found or not yours" });
    }

    const lifecycleMap: Record<string, { lifecycle: string; extra?: Record<string, unknown> }> = {
      share_with_owner:  { lifecycle: "shared_with_owner",  extra: { sharedWithOwnerAt: now } },
      mark_viewed:       { lifecycle: "viewed_by_owner",    extra: { viewedByOwnerAt: now } },
      acknowledge:       { lifecycle: "acknowledged",        extra: { acknowledgedAt: now } },
      mark_ready:        { lifecycle: "room_ready",          extra: { readyAt: now } },
      approve_move_in:   { lifecycle: "move_in_approved",   extra: { moveInApprovedAt: now } },
      complete:          { lifecycle: "completed",           extra: { completedAt: now } },
      reject:            { lifecycle: "rejected",            extra: {
        ownerDecision: "reject",
        ownerDecisionAt: now,
        ownerRejectionReason: note ?? null,
      } },
    };

    const target = lifecycleMap[action];
    if (!target) {
      return reply.code(400).send({ code: "BAD_REQUEST", message: "Unknown action" });
    }

    const historyText = action === "reject"
      ? `Rejected by owner: ${note || "no reason given"}`
      : `Owner action: ${action.replace(/_/g, " ")}`;

    await col("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          ownerLifecycle: target.lifecycle,
          ...(target.extra ?? {}),
          updatedAt: now,
        },
        $push: { history: { ts: now, actor: `owner:${ownerId}`, text: historyText } as any },
      },
    );

    return reply.send({ success: true, lifecycle: target.lifecycle });
  });

  // ── PATCH /api/v1/owner/bookings/:bookingId/decision ────────────────────
  // Owner records their approval decision (approve/approve_with_conditions/reject).
  const DecisionBody = z.object({
    decision: z.enum(["approve", "approve_with_conditions", "reject"]),
    note: z.string().max(1000).optional(),
  });

  app.patch("/api/v1/owner/bookings/:bookingId/decision", { preHandler }, async (req, reply) => {
    const { bookingId } = req.params as { bookingId: string };
    const ownerId = req.user!.sub;
    const tenantId = req.user!.tenantId;
    const { decision, note } = DecisionBody.parse(req.body);
    const now = new Date().toISOString();

    const booking = await col("bookings").findOne({ _id: bookingId, ownerId, tenantId });
    if (!booking) {
      return reply.code(404).send({ code: "NOT_FOUND", message: "Booking not found or not yours" });
    }

    const nextLifecycle = decision === "reject" ? "rejected" : "acknowledged";
    const text = decision === "approve"
      ? "Approved by owner"
      : decision === "approve_with_conditions"
      ? `Approved with conditions: ${note ?? ""}`
      : `Rejected: ${note ?? "no reason"}`;

    await col("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          ownerDecision: decision,
          ownerDecisionAt: now,
          ownerLifecycle: nextLifecycle,
          acknowledgedAt: decision !== "reject" ? now : undefined,
          ownerConditionNote: decision === "approve_with_conditions" ? note ?? null : null,
          ownerRejectionReason: decision === "reject" ? note ?? null : null,
          updatedAt: now,
        },
        $push: { history: { ts: now, actor: `owner:${ownerId}`, text } as any },
      },
    );

    return reply.send({ success: true, decision, lifecycle: nextLifecycle });
  });

  // ── PATCH /api/v1/owner/bookings/:bookingId/readiness ───────────────────
  // Update individual readiness check items.
  const ReadinessBody = z.object({
    key: z.enum(["cleaning", "furniture", "internet", "electricity", "water", "inspection"]),
    status: z.enum(["pending", "ready"]),
  });

  app.patch("/api/v1/owner/bookings/:bookingId/readiness", { preHandler }, async (req, reply) => {
    const { bookingId } = req.params as { bookingId: string };
    const ownerId = req.user!.sub;
    const tenantId = req.user!.tenantId;
    const { key, status } = ReadinessBody.parse(req.body);
    const now = new Date().toISOString();

    const booking = await col("bookings").findOne({ _id: bookingId, ownerId, tenantId });
    if (!booking) {
      return reply.code(404).send({ code: "NOT_FOUND", message: "Booking not found or not yours" });
    }

    const currentReadiness = (booking as any).readiness || {};
    const updatedReadiness = { ...currentReadiness, [key]: status };
    const allReady = Object.values(updatedReadiness).length === 6 &&
      Object.values(updatedReadiness).every((v) => v === "ready");

    const patch: Record<string, unknown> = {
      readiness: updatedReadiness,
      updatedAt: now,
    };
    if (allReady && (booking as any).ownerLifecycle === "acknowledged") {
      patch.ownerLifecycle = "room_ready";
      patch.readyAt = now;
    }

    await col("bookings").updateOne(
      { _id: bookingId },
      {
        $set: patch,
        $push: { history: { ts: now, actor: `owner:${ownerId}`, text: `${key} → ${status}` } as any },
      },
    );

    return reply.send({ success: true, readiness: updatedReadiness, allReady });
  });

  // ── GET /api/v1/owner/visits ─────────────────────────────────────────────
  app.get("/api/v1/owner/visits", { preHandler }, async (req, reply) => {
    const ownerId = req.user!.sub;
    const tenantId = req.user!.tenantId;

    // Get owner property IDs
    const properties = await col("properties")
      .find(ownerPropertyFilter(ownerId, tenantId))
      .project({ _id: 1 })
      .toArray();
    const propIds = properties.map((p) => p._id);

    if (propIds.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    // Tours are visits — fetch tours for properties owned by this owner
    const visits = await col("tours")
      .find({ propertyId: { $in: propIds }, tenantId })
      .sort({ scheduledAt: -1 })
      .limit(200)
      .toArray();

    return reply.send({ success: true, data: visits });
  });

  // ── POST /api/v1/owner/actions ───────────────────────────────────────────
  // Log an owner action (room pitch, visit scheduled, etc.)
  app.post("/api/v1/owner/actions", { preHandler }, async (req, reply) => {
    const ownerId = req.user!.sub;
    const body = req.body as { roomId: string; type: string; note?: string; by?: string };
    const { ulid } = await import("../../../../src/contracts/ids.js");
    const actionId = ulid();
    const now = new Date().toISOString();

    const action = {
      _id: actionId,
      id: actionId,
      ownerId,
      roomId: body.roomId,
      type: body.type,
      note: body.note ?? null,
      by: body.by ?? "Owner",
      at: now,
      tenantId: req.user!.tenantId,
    };

    await col("room_actions").insertOne(action);
    return reply.send({ success: true, data: action });
  });

  // ── GET /api/v1/owner/actions ────────────────────────────────────────────
  app.get("/api/v1/owner/actions", { preHandler }, async (req, reply) => {
    const ownerId = req.user!.sub;
    const actions = await col("room_actions")
      .find({ ownerId })
      .sort({ at: -1 })
      .limit(500)
      .toArray();
    return reply.send({ success: true, data: actions });
  });


  // ── GET /api/v1/owner/notifications ──────────────────────────────────────
  app.get("/api/v1/owner/notifications", { preHandler }, async (req, reply) => {
    return reply.send({ success: true, data: [] });
  });

  // ── POST /api/v1/owner/notifications/mark-all-read ───────────────────────
  app.post("/api/v1/owner/notifications/mark-all-read", { preHandler }, async (req, reply) => {
    return reply.send({ success: true });
  });

  // ── POST /api/v1/owner/notifications/:id/read ────────────────────────────
  app.post("/api/v1/owner/notifications/:id/read", { preHandler }, async (req, reply) => {
    return reply.send({ success: true });
  });
}
