import { createFileRoute } from '@tanstack/react-router';
import OwnerAllRoomsPage from '@/property-owner/pages/all-rooms';

export const Route = createFileRoute('/property-owner/rooms')({
  component: OwnerAllRoomsPage,
});
