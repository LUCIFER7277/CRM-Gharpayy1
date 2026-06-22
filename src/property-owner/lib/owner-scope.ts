import { useMemo } from "react";
import { useAuthUser } from "@/lib/auth-store";
import { useOwnerBookings } from "@/lib/owner-bookings/store";

export function useOwnerScope() {
  const user = useAuthUser((s) => s.user);
  const { bookings } = useOwnerBookings();

  const isOwnerAuthenticated = !!user && user.role === "owner";

  /**
   * All bookings from the local store (shared with CRM/flow-ops).
   * WARNING: this contains ALL bookings, not scoped to this owner.
   * Pages MUST filter by owner's property IDs before using this data.
   * See bookings.tsx and approvals.tsx for the correct filtering pattern.
   */
  const ownerBookings = useMemo(() => {
    if (!isOwnerAuthenticated) return [];
    return bookings;
  }, [bookings, isOwnerAuthenticated]);

  return {
    user,
    isOwnerAuthenticated,
    ownerId: user?.id ?? null,
    ownerName: user?.fullName ?? user?.username ?? null,
    ownerEmail: user?.email ?? null,
    ownerBookings,
  };
}
