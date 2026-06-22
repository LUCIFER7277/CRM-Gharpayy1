import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import Bookings from "@/myt/pages/Bookings";

export const Route = createFileRoute("/myt/bookings")({
  head: () => ({ meta: [{ title: "Bookings - MYT" }] }),
  component: () => <AppShell><Bookings /></AppShell>,
});
