import { createFileRoute } from '@tanstack/react-router';
import OwnerVisitsPage from '@/property-owner/pages/visits';
export const Route = createFileRoute('/property-owner/visits')({ component: OwnerVisitsPage });
