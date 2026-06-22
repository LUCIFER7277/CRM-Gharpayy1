import { z } from "zod";
import { Lead, LeadStage, Intent, Todo, TodoEntityType, TodoPriority, Activity, ActivityKind, ActivityEntityType, ActivityDirection, ActivityOutcome, TourStatus, TourOutcome, BookingStatus, TenantStatus } from "./entities.js";

// Command registry - every state-changing intent. Validated client + server.
export const CommandType = z.enum([
  "cmd.lead.create",
  "cmd.lead.update",
  "cmd.lead.assign",
  "cmd.lead.change_stage",
  "cmd.lead.delete",
  "cmd.lead.accept_assignment",
  "cmd.lead.pass_assignment",
  // Tours
  "cmd.tour.schedule",
  "cmd.tour.reschedule",
  "cmd.tour.cancel",
  "cmd.tour.complete",
  "cmd.tour.update",
  "cmd.tour.update_post_tour",
  "cmd.tour.accept_assignment",
  "cmd.tour.pass_assignment",
  // Todos
  "cmd.todo.create",
  "cmd.todo.update",
  "cmd.todo.assign",
  "cmd.todo.accept",
  "cmd.todo.decline",
  "cmd.todo.complete",
  "cmd.todo.cancel",
  // Activities
  "cmd.activity.log",
  "cmd.activity.update",
  "cmd.activity.delete",
  // Bookings
  "cmd.booking.create",
  "cmd.booking.update",
  "cmd.booking.cancel",
  "cmd.booking.approve",
  "cmd.booking.mark_paid",
  // Tenants
  "cmd.tenant.create",
  "cmd.tenant.update",
  "cmd.tenant.update_status",
]);
export type CommandType = z.infer<typeof CommandType>;

const Base = z.object({
  _id: z.string(),                       // command ULID - used as Idempotency-Key
  issuedAt: z.string(),
  actor: z.string().optional(),          // server fills from JWT
  tenantId: z.string().optional(),       // server fills from JWT
});

// ---------- Leads ----------
export const CreateLeadCmd = Base.extend({
  type: z.literal("cmd.lead.create"),
  payload: Lead.pick({
    name: true,
    phone: true,
    source: true,
    budget: true,
    budgetText: true,
    moveInDate: true,
    preferredArea: true,
    zoneId: true,
  }).extend({
    intent: Intent.optional(),
    tags: z.array(z.string()).max(10).optional(),
    propertySelection: z.object({
      type: z.enum(["hub", "other"]),
      propertyId: z.string().optional(),
      propertyName: z.string().optional()
    }).optional(),
    // Extended Quick-Add fields - all optional, server fills defaults.
    email: z.string().max(160).optional(),
    areas: z.array(z.string().max(80)).max(20).optional(),
    fullAddress: z.string().max(1000).optional(),
    type: z.string().max(60).optional(),
    room: z.string().max(60).optional(),
    need: z.string().max(60).optional(),
    inBLR: z.boolean().nullable().optional(),
    quality: z.enum(["hot", "good", "bad"]).nullable().optional(),
    specialReqs: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
    zoneCategory: z.string().max(80).optional(),
    assigneeId: z.string().nullable().optional(),
    stageLabel: z.string().max(120).optional(),
    rawSource: z.string().max(5000).optional(),
    parsedByAI: z.boolean().optional(),
    aiConfidence: z.number().int().min(0).max(100).optional(),
    missingFields: z.array(z.string()).optional(),
  }),
});

export const UpdateLeadCmd = Base.extend({
  type: z.literal("cmd.lead.update"),
  payload: z.object({
    leadId: z.string(),
    patch: Lead.partial().omit({ _id: true, tenantId: true, createdBy: true, createdAt: true }),
  }),
});

export const AssignLeadCmd = Base.extend({
  type: z.literal("cmd.lead.assign"),
  payload: z.object({ leadId: z.string(), tcmId: z.string() }),
});

export const ChangeStageCmd = Base.extend({
  type: z.literal("cmd.lead.change_stage"),
  payload: z.object({ leadId: z.string(), to: LeadStage }),
});

export const DeleteLeadCmd = Base.extend({
  type: z.literal("cmd.lead.delete"),
  payload: z.object({ leadId: z.string() }),
});

export const AcceptLeadAssignmentCmd = Base.extend({
  type: z.literal("cmd.lead.accept_assignment"),
  payload: z.object({ notificationId: z.string() }),
});

export const PassLeadAssignmentCmd = Base.extend({
  type: z.literal("cmd.lead.pass_assignment"),
  payload: z.object({ notificationId: z.string(), newAssigneeId: z.string() }),
});

// ---------- Tours ----------
export const ScheduleTourCmd = Base.extend({
  type: z.literal("cmd.tour.schedule"),
  payload: z.object({
    leadId: z.string(),
    propertyId: z.string().nullable().optional(),
    tcmId: z.string(),
    scheduledAt: z.string(),
    bookingSource: z.string().optional(),
    tourType: z.enum(["physical", "virtual", "pre-book-pitch"]).optional(),
  }),
});

export const RescheduleTourCmd = Base.extend({
  type: z.literal("cmd.tour.reschedule"),
  payload: z.object({ tourId: z.string(), scheduledAt: z.string() }),
});

export const CancelTourCmd = Base.extend({
  type: z.literal("cmd.tour.cancel"),
  payload: z.object({ tourId: z.string() }),
});

export const CompleteTourCmd = Base.extend({
  type: z.literal("cmd.tour.complete"),
  payload: z.object({ tourId: z.string() }),
});

export const UpdateTourCmd = Base.extend({
  type: z.literal("cmd.tour.update"),
  payload: z.object({
    tourId: z.string(),
    patch: z.object({
      propertyId: z.string().nullable().optional(),
      customPropertyName: z.string().optional(),
      status: TourStatus.optional(),
      showUp: z.boolean().nullable().optional(),
    }),
  }),
});

export const UpdatePostTourCmd = Base.extend({
  type: z.literal("cmd.tour.update_post_tour"),
  payload: z.object({
    tourId: z.string(),
    patch: z.object({
      outcome: TourOutcome.optional(),
      confidence: z.number().int().min(0).max(100).optional(),
      objection: z.string().nullable().optional(),
      objectionNote: z.string().optional(),
      expectedDecisionAt: z.string().nullable().optional(),
      nextFollowUpAt: z.string().nullable().optional(),
      filledAt: z.string().nullable().optional(),
    }),
  }),
});

export const AcceptTourAssignmentCmd = Base.extend({
  type: z.literal("cmd.tour.accept_assignment"),
  payload: z.object({ notificationId: z.string() }),
});

export const PassTourAssignmentCmd = Base.extend({
  type: z.literal("cmd.tour.pass_assignment"),
  payload: z.object({ notificationId: z.string(), newAssigneeId: z.string() }),
});

// ---------- Todos ----------
export const CreateTodoCmd = Base.extend({
  type: z.literal("cmd.todo.create"),
  payload: Todo.pick({
    title: true,
    notes: true,
    entityType: true,
    entityId: true,
    priority: true,
    dueAt: true,
  }).partial({ notes: true, priority: true, dueAt: true, entityType: true, entityId: true }).extend({
    assignTo: z.string().nullable().optional(), // null/undefined = self
  }),
});

export const UpdateTodoCmd = Base.extend({
  type: z.literal("cmd.todo.update"),
  payload: z.object({
    todoId: z.string(),
    patch: z.object({
      title: z.string().min(1).max(200).optional(),
      notes: z.string().max(2000).optional(),
      priority: TodoPriority.optional(),
      dueAt: z.string().nullable().optional(),
      entityType: TodoEntityType.optional(),
      entityId: z.string().nullable().optional(),
    }),
  }),
});

export const AssignTodoCmd = Base.extend({
  type: z.literal("cmd.todo.assign"),
  payload: z.object({ todoId: z.string(), assignTo: z.string() }),
});

export const AcceptTodoCmd = Base.extend({
  type: z.literal("cmd.todo.accept"),
  payload: z.object({ todoId: z.string() }),
});

export const DeclineTodoCmd = Base.extend({
  type: z.literal("cmd.todo.decline"),
  payload: z.object({ todoId: z.string(), reason: z.string().max(500).optional() }),
});

export const CompleteTodoCmd = Base.extend({
  type: z.literal("cmd.todo.complete"),
  payload: z.object({ todoId: z.string() }),
});

export const CancelTodoCmd = Base.extend({
  type: z.literal("cmd.todo.cancel"),
  payload: z.object({ todoId: z.string() }),
});

// ---------- Activities ----------
export const LogActivityCmd = Base.extend({
  type: z.literal("cmd.activity.log"),
  payload: Activity.pick({
    entityType: true, entityId: true, kind: true, subject: true,
  }).extend({
    body: z.string().max(5000).optional(),
    direction: ActivityDirection.optional(),
    outcome: ActivityOutcome.nullable().optional(),
    durationSec: z.number().int().min(0).optional(),
    occurredAt: z.string().optional(),
    scheduledFor: z.string().nullable().optional(),
    relatedTodoId: z.string().nullable().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const UpdateActivityCmd = Base.extend({
  type: z.literal("cmd.activity.update"),
  payload: z.object({
    activityId: z.string(),
    patch: z.object({
      subject: z.string().min(1).max(200).optional(),
      body: z.string().max(5000).optional(),
      outcome: ActivityOutcome.nullable().optional(),
      durationSec: z.number().int().min(0).optional(),
      scheduledFor: z.string().nullable().optional(),
    }),
  }),
});

export const DeleteActivityCmd = Base.extend({
  type: z.literal("cmd.activity.delete"),
  payload: z.object({ activityId: z.string() }),
});

// ---------- Bookings ----------
export const CreateBookingCmd = Base.extend({
  type: z.literal("cmd.booking.create"),
  payload: z.object({
    leadId: z.string(),
    tourId: z.string(),
    propertyId: z.string(),
    tcmId: z.string(),
    amount: z.number().int().min(0),
    tenantName: z.string().min(1).max(120),
    tenantPhone: z.string().min(7).max(20),
    deposit: z.number().int().min(0),
    moveInDate: z.string(),
    notes: z.string().max(2000).optional(),
  }),
});

export const UpdateBookingCmd = Base.extend({
  type: z.literal("cmd.booking.update"),
  payload: z.object({
    bookingId: z.string(),
    patch: z.object({
      amount: z.number().int().min(0).optional(),
      tenantName: z.string().min(1).max(120).optional(),
      tenantPhone: z.string().min(7).max(20).optional(),
      deposit: z.number().int().min(0).optional(),
      moveInDate: z.string().optional(),
      notes: z.string().max(2000).optional(),
    }),
  }),
});

export const CancelBookingCmd = Base.extend({
  type: z.literal("cmd.booking.cancel"),
  payload: z.object({ bookingId: z.string() }),
});

export const ApproveBookingCmd = Base.extend({
  type: z.literal("cmd.booking.approve"),
  payload: z.object({ bookingId: z.string() }),
});

export const MarkBookingPaidCmd = Base.extend({
  type: z.literal("cmd.booking.mark_paid"),
  payload: z.object({ bookingId: z.string(), paidRef: z.string() }),
});

// ---------- Tenants ----------
export const CreateTenantCmd = Base.extend({
  type: z.literal("cmd.tenant.create"),
  payload: z.object({
    bookingId: z.string(),
    leadId: z.string(),
    propertyId: z.string(),
    tcmId: z.string(),
    name: z.string().min(1).max(120),
    phone: z.string().min(7).max(20),
    email: z.string().max(160).optional(),
    roomNumber: z.string().max(60).optional(),
    moveInDate: z.string(),
    rent: z.number().int().min(0),
    deposit: z.number().int().min(0),
    notes: z.string().max(2000).optional(),
  }),
});

export const UpdateTenantCmd = Base.extend({
  type: z.literal("cmd.tenant.update"),
  payload: z.object({
    tenantId: z.string(),
    patch: z.object({
      name: z.string().min(1).max(120).optional(),
      phone: z.string().min(7).max(20).optional(),
      email: z.string().max(160).optional(),
      roomNumber: z.string().max(60).optional(),
      rent: z.number().int().min(0).optional(),
      deposit: z.number().int().min(0).optional(),
      notes: z.string().max(2000).optional(),
    }),
  }),
});

export const UpdateTenantStatusCmd = Base.extend({
  type: z.literal("cmd.tenant.update_status"),
  payload: z.object({
    tenantId: z.string(),
    status: TenantStatus,
    exitDate: z.string().nullable().optional(),
  }),
});

export const Command = z.discriminatedUnion("type", [
  CreateLeadCmd,
  UpdateLeadCmd,
  AssignLeadCmd,
  ChangeStageCmd,
  DeleteLeadCmd,
  AcceptLeadAssignmentCmd,
  PassLeadAssignmentCmd,
  CreateTodoCmd,
  UpdateTodoCmd,
  AssignTodoCmd,
  AcceptTodoCmd,
  DeclineTodoCmd,
  CompleteTodoCmd,
  CancelTodoCmd,
  ScheduleTourCmd,
  RescheduleTourCmd,
  CancelTourCmd,
  CompleteTourCmd,
  UpdateTourCmd,
  UpdatePostTourCmd,
  AcceptTourAssignmentCmd,
  PassTourAssignmentCmd,
  LogActivityCmd,
  UpdateActivityCmd,
  DeleteActivityCmd,
  CreateBookingCmd,
  UpdateBookingCmd,
  CancelBookingCmd,
  ApproveBookingCmd,
  MarkBookingPaidCmd,
  CreateTenantCmd,
  UpdateTenantCmd,
  UpdateTenantStatusCmd,
]);
export type Command = z.infer<typeof Command>;
