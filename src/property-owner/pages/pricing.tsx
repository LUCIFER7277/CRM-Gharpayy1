
import { IndianRupee } from "lucide-react";

export default function OwnerPricingPage() {
  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-black font-display text-slate-900 flex items-center gap-2">
          <IndianRupee className="w-6 h-6 text-primary" /> Pricing
        </h1>
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
          <IndianRupee className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800">Dynamic Pricing</h2>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            This section will allow you to adjust room pricing based on occupancy, demand, and seasons.
          </p>
        </div>
      </div>
    </div>
  );
}
