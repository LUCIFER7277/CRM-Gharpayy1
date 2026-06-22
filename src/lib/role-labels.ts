import type { AnyRole, ManagedRole } from "@/lib/api/client";

/** Human-readable labels for DB roles shown in Settings and user lists. */
export const ROLE_LABELS: Record<ManagedRole, string> = {
  manager: "HR/Leadership",
  admin: "Super Admin",
  member: "Flow Ops",
  owner: "Property Owner",
  tcm: "TCM",
};

export function roleLabel(role: string | undefined | null): string {
  if (!role) return "Unknown";
  if (role === "super_admin") return "Super Admin";
  return ROLE_LABELS[role as ManagedRole] ?? role.replace(/_/g, " ");
}

export function managedRoleLabel(role: ManagedRole): string {
  return ROLE_LABELS[role];
}
