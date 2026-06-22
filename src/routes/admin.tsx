import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useAuthUser } from "@/lib/auth-store";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/admin")(
  {
    beforeLoad: () => {
      const role = useAuthUser.getState().user?.role;
      if (role !== "super_admin") throw redirect({ to: "/" });
    },
    component: () => (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
  }
);
