import { z } from "zod";

// Top-level roles - match the legacy CRM exactly. The "View as" persona
// switcher in the sidebar (flow-ops / tcm / hr / property-owner) is a
// display lens on top of these real DB roles, not a separate enum.
export const TopRole = z.enum(["super_admin", "manager", "admin", "member", "owner", "tcm"]);
export type TopRole = z.infer<typeof TopRole>;

// Status mirrors the legacy User.status enum.
export const UserStatus = z.enum(["active", "inactive", "invited", "deleted"]);
export type UserStatus = z.infer<typeof UserStatus>;

// Optional sub-role kept for forward-compat / dashboards. Not enforced.
export const SubRole = z.enum([
  "flow-ops",
  "tcm",
  "hr",
  "manager",
  "property-owner",
  "agent",
]);
export type SubRole = z.infer<typeof SubRole>;

// RBAC scopes - checked server-side, used to hide UI client-side.
export const Scope = z.enum([
  "lead.read",
  "lead.create",
  "lead.update",
  "lead.assign",
  "lead.claim",
  "tour.read",
  "tour.schedule",
  "tour.complete",
  "inventory.read",
  "inventory.block",
  "automation.admin",
  "user.admin",
  "user.read",
  "todo.read",
  "todo.create",
  "todo.update",
  "todo.assign",
  "activity.read",
  "activity.log",
  "activity.delete",
  "booking.read",
  "booking.create",
  "booking.update",
  "tenant.read",
  "tenant.create",
  "tenant.update",
]);
export type Scope = z.infer<typeof Scope>;

// Default scope grants per top-role. Server is authoritative.
export const DEFAULT_SCOPES: Record<TopRole, Scope[]> = {
  super_admin: Scope.options, // full power, including user.admin
  manager: [
    "lead.read", "lead.create", "lead.update", "lead.assign",
    "tour.read", "tour.schedule", "tour.complete",
    "inventory.read", "inventory.block",
    "user.read",
    "todo.read", "todo.create", "todo.update", "todo.assign",
    "activity.read", "activity.log",
    "booking.read", "booking.create", "booking.update",
    "tenant.read", "tenant.create", "tenant.update",
  ],
  admin: [
    "lead.read", "lead.create", "lead.update", "lead.assign",
    "tour.read", "tour.schedule", "tour.complete",
    "inventory.read",
    "user.read",
    "todo.read", "todo.create", "todo.update", "todo.assign",
    "activity.read", "activity.log",
    "booking.read", "booking.create", "booking.update",
    "tenant.read", "tenant.create", "tenant.update",
  ],
  member: [
    "lead.read", "lead.create", "lead.update", "lead.claim",
    "tour.read", "tour.schedule", "tour.complete",
    "inventory.read",
    "user.read",
    "todo.read", "todo.create", "todo.update",
    "activity.read", "activity.log",
    "booking.read", "booking.create",
    "tenant.read",
  ],
  tcm: [
    "lead.read", "lead.create", "lead.update", "lead.claim",
    "tour.read", "tour.schedule", "tour.complete",
    "inventory.read",
    "user.read",
    "todo.read", "todo.create", "todo.update",
    "activity.read", "activity.log",
    "booking.read",
    "tenant.read",
  ],
  owner: [
    "tour.read",
    "inventory.read", "inventory.block",
    "todo.read",
    "activity.read",
  ],
};
