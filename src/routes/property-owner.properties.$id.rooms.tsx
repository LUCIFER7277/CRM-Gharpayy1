import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import OwnerPropertyRoomsPage from '@/property-owner/pages/rooms';

function RoomsLayout() {
  const { location } = useRouterState();
  // Render rooms list when at exact /property-owner/properties/$id/rooms
  // Render child route ($roomId) via Outlet when deeper
  const segments = location.pathname.replace(/\/$/, '').split('/');
  const isRoomsList = segments.length === 5;  // ['', 'property-owner', 'properties', 'xxx', 'rooms']
  if (isRoomsList) return <OwnerPropertyRoomsPage />;
  return <Outlet />;
}

export const Route = createFileRoute('/property-owner/properties/$id/rooms')({
  component: RoomsLayout,
});
