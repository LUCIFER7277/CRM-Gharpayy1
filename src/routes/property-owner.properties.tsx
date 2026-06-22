import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import OwnerPropertiesPage from '@/property-owner/pages/properties';

function PropertiesLayout() {
  const { location } = useRouterState();
  const isExact = location.pathname === '/property-owner/properties';
  if (isExact) return <OwnerPropertiesPage />;
  return <Outlet />;
}

export const Route = createFileRoute('/property-owner/properties')({
  component: PropertiesLayout,
});
