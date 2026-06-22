import { createFileRoute } from '@tanstack/react-router';
import OwnerRoomDetailPage from '@/property-owner/pages/room-detail';

export const Route = createFileRoute('/property-owner/properties/$id/rooms/$roomId')({
  component: OwnerRoomDetailPage,
});
