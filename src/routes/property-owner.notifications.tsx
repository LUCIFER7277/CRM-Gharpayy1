import { createFileRoute } from '@tanstack/react-router';
import OwnerNotificationsPage from '@/property-owner/pages/notifications';
export const Route = createFileRoute('/property-owner/notifications')({ component: OwnerNotificationsPage });
