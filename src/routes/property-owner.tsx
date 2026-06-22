import { createFileRoute, Outlet } from '@tanstack/react-router';
import { PropertyOwnerShell } from '@/property-owner/components/PropertyOwnerShell';

export const Route = createFileRoute('/property-owner')({
  component: () => (
    <PropertyOwnerShell>
      <Outlet />
    </PropertyOwnerShell>
  ),
});
