import { createFileRoute } from '@tanstack/react-router';
import OwnerInventoryPage from '@/property-owner/pages/inventory';

export const Route = createFileRoute('/property-owner/inventory')({
  component: OwnerInventoryPage,
});
