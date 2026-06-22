import { Building2 } from 'lucide-react';

export default function OwnersCompare() {
  return (
    <div className="p-8 text-center">
      <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-slate-700 mb-2">Owner Portal Moved</h2>
      <p className="text-slate-500 max-w-md mx-auto">
        The owner comparison dashboard has been replaced by the new Owner Portal at /property-owner.
        Owners can log in there to manage properties, view bookings, and approve requests.
      </p>
    </div>
  );
}
