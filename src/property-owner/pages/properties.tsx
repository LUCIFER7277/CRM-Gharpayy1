import { useNavigate } from "@tanstack/react-router";
import { useAuthUser } from "@/lib/auth-store";
import { useGetRealOwnerProperties, useUpdatePropertyAvailability } from "@/property-owner/lib/api";

import { motion } from "framer-motion";
import { Plus, Building2, MapPin, ToggleLeft, ToggleRight, Star, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function OwnerPropertiesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAuthUser((s) => s.user);

  const { data: properties, isLoading, refetch } = useGetRealOwnerProperties();
  const toggleAvailability = useUpdatePropertyAvailability();

  const handleToggle = async (propertyId: number | string, current: string) => {
    const newAvail = current === "AVAILABLE" ? "FULL" : "AVAILABLE";
    try {
      await toggleAvailability.mutateAsync({ propertyId, data: { availability: newAvail as any } });
      toast({
        title: `Marked as ${newAvail}`,
        description: newAvail === "FULL" ? "Leads will now be routed to nearby PGs" : "You're open for new tenants",
      });
      refetch();
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black font-display text-slate-900">
              {user ? `${user.fullName}'s PGs` : "My Properties"}
            </h1>
            <div className="text-slate-500 text-sm flex items-center gap-2 flex-wrap">
              <span>{(properties || []).length} PGs listed</span>
              {user && (
                <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                  <UserCheck className="w-3 h-3 mr-1" /> Logged in as {user.email}
                </Badge>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate({ to: "/property-owner/properties/new" })}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add PG
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : !properties || properties.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">No properties listed</h2>
            <p className="text-slate-500 mb-6">Add your PG to get leads from the Gharpayy network</p>
            <button
              onClick={() => navigate({ to: "/property-owner/properties/new" })}
              className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
            >
              + List your PG
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {properties.map((p: any, i: number) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 text-lg">{p.name}</h3>
                      {p.isVerified && (
                        <Badge variant="outline" className="text-green-600 border-green-200 text-[10px]">✓ Verified</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 text-sm">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{p.address}</span>
                    </div>
                  </div>
                  {p.avgRating && (
                    <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-100 rounded-lg px-2 py-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-bold">{p.avgRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-xs text-slate-500 font-medium">Rent</p>
                    <p className="font-black text-slate-800">₹{p.monthlyRent.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-xs text-slate-500 font-medium">Total Rooms</p>
                    <p className="font-black text-slate-800">{p.totalRooms}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-xs text-slate-500 font-medium">Available</p>
                    <p className={`font-black ${p.availableRooms > 0 ? "text-green-600" : "text-red-500"}`}>
                      {p.availableRooms}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${p.availability === "AVAILABLE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {p.availability}
                    </span>
                    {p.availability === "FULL" && (
                      <span className="text-xs text-slate-400">Leads routed to nearby PGs</span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate({ to: `/property-owner/properties/${p.id}/rooms` })}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-bold hover:bg-primary/20 transition-colors"
                  >
                    Manage rooms →
                  </button>
                  <button
                    onClick={() => handleToggle(p.id, p.availability)}
                    className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    {p.availability === "AVAILABLE"
                      ? <><ToggleRight className="w-4 h-4 text-green-500" /> Mark Full</>
                      : <><ToggleLeft className="w-4 h-4 text-red-500" /> Mark Available</>}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
