import { createFileRoute } from '@tanstack/react-router';
import OwnerAddPropertyPage from '@/property-owner/pages/add-property';

export const Route = createFileRoute('/property-owner/properties/new')({
  component: OwnerAddPropertyPage,
});
