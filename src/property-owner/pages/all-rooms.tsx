
import { BedDouble, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export default function OwnerAllRoomsPage() {
  const navigate = useNavigate();

  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-black font-display text-slate-900 flex items-center gap-2">
          <BedDouble className="w-6 h-6 text-primary" /> Update Rooms
        </h1>
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
          <BedDouble className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800">Room Management</h2>
          <p className="text-slate-500 mt-2 max-w-md mx-auto mb-6">
            To update rooms, please select a specific property from your properties list first.
          </p>
          <button onClick={() => navigate({ to: "/property-owner/properties" })}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors mx-auto">
            Go to Properties <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
