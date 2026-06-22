import { useState } from "react";
import { useAddRealOwnerProperty, useCreateProperty } from "@/property-owner/lib/api";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Building2, ChevronLeft, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AMENITY_OPTIONS = ["WiFi", "AC", "Food", "Security", "Parking", "Laundry", "TV", "Gym", "Power Backup", "Water 24/7", "CCTV", "Housekeeping"];
const BANGALORE_AREAS = ["Koramangala", "HSR Layout", "Indiranagar", "Marathahalli", "Electronic City", "Whitefield", "BTM Layout", "Bellandur", "Hebbal", "Yelahanka", "JP Nagar", "Banashankari", "Rajajinagar", "Malleshwaram"];

export default function OwnerAddPropertyPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "ANY">("ANY");
  const [totalRooms, setTotalRooms] = useState("");
  const [availableRooms, setAvailableRooms] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [metro, setMetro] = useState("");
  const [landmark, setLandmark] = useState("");
  const [referralBonus, setReferralBonus] = useState("");

  const createPropertyMock = useCreateProperty();
  const addRealPropertyMut = useAddRealOwnerProperty();

  const toggleAmenity = (a: string) => {
    setSelectedAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const handleSubmit = async () => {
    if (!name || !address || !area || !rent) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }

    try {
      await addRealPropertyMut.mutateAsync({
        name,
        description,
        address,
        area,
        pincode,
        basePrice: Number(rent),
        deposit: Number(deposit || 0),
        genderCategory: gender,
        propertyType: "PG",
        totalRooms: Number(totalRooms || 1),
        availableRooms: Number(availableRooms || totalRooms || 1),
        amenities: selectedAmenities,
        nearbyMetro: metro || undefined,
        nearbyLandmark: landmark || undefined,
        referralBonus: Number(referralBonus || 0),
      });
      toast({ title: "PG listed! 🎉", description: "Your property is now visible to the network" });
      navigate({ to: "/property-owner/properties" });
    } catch (err: any) {
      toast({ title: "Failed to create property", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <button onClick={() => navigate({ to: "/property-owner/properties" })} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium">
          <ChevronLeft className="w-4 h-4" /> Back to Properties
        </button>

        <div>
          <h1 className="text-2xl font-black font-display text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> List Your PG
          </h1>
          <p className="text-slate-500 text-sm mt-1">Add your property to get leads from across the network</p>
        </div>

        <div className="space-y-5">
          {/* Basic Info */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-slate-900">Basic Information</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">PG Name *</label>
                <Input placeholder="e.g. Sunrise PG Koramangala" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                <Textarea placeholder="Describe your PG, amenities, rules..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Full Address *</label>
                <Input placeholder="House no, street, landmark..." value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Area *</label>
                  <select value={area} onChange={e => setArea(e.target.value)}
                    className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Select area</option>
                    {BANGALORE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Pincode</label>
                  <Input placeholder="560001" value={pincode} onChange={e => setPincode(e.target.value)} maxLength={6} />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-slate-900">Pricing & Rooms</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Monthly Rent (₹) *</label>
                <Input type="number" placeholder="8000" value={rent} onChange={e => setRent(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Security Deposit (₹)</label>
                <Input type="number" placeholder="16000" value={deposit} onChange={e => setDeposit(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Total Rooms</label>
                <Input type="number" placeholder="10" value={totalRooms} onChange={e => setTotalRooms(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Available Rooms</label>
                <Input type="number" placeholder="3" value={availableRooms} onChange={e => setAvailableRooms(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Gender</label>
              <div className="flex gap-2">
                {(["MALE", "FEMALE", "ANY"] as const).map(g => (
                  <button key={g} onClick={() => setGender(g)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${gender === g ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200"}`}>
                    {g === "MALE" ? "👨 Boys" : g === "FEMALE" ? "👩 Girls" : "🤝 Co-ed"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <h2 className="font-bold text-slate-900 mb-4">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map(a => (
                <button key={a} onClick={() => toggleAmenity(a)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${selectedAmenities.includes(a) ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200"}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Location Details */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-slate-900">Nearby Landmarks</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nearest Metro Station</label>
                <Input placeholder="e.g. Marathahalli Metro" value={metro} onChange={e => setMetro(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Landmark / Nearby Area</label>
                <Input placeholder="e.g. Near Forum Mall" value={landmark} onChange={e => setLandmark(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Referral Bonus */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
            <h2 className="font-bold text-orange-900 mb-2">Extra Referral Bonus (Optional)</h2>
            <p className="text-orange-700 text-sm mb-3">Offer extra cash on top of the standard ₹500 to attract more referrers to your PG.</p>
            <div className="flex items-center gap-3">
              <span className="text-slate-600 font-medium">₹</span>
              <Input type="number" placeholder="0" value={referralBonus} onChange={e => setReferralBonus(e.target.value)}
                className="max-w-32" />
              <span className="text-sm text-slate-500">extra bonus per booking</span>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={addRealPropertyMut.isPending || createPropertyMock.isPending} className="w-full h-12 text-base font-bold">
            {addRealPropertyMut.isPending || createPropertyMock.isPending ? "Listing..." : "List My PG 🏠"}
          </Button>
        </div>
      </div>
    </div>
  );
}
