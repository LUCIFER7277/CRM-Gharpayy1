import { createFileRoute } from '@tanstack/react-router';
import OwnerDashboardPage from '@/property-owner/pages/dashboard';

export const Route = createFileRoute('/property-owner/dashboard')({
  component: OwnerDashboardPage,
});
