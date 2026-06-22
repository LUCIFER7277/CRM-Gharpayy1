import { createFileRoute } from '@tanstack/react-router';
import OwnerProfilePage from '@/property-owner/pages/profile';
export const Route = createFileRoute('/property-owner/profile')({ component: OwnerProfilePage });
