import { useMemo, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";

import { ChevronLeft, MapPin, CheckCircle, Copy, Calendar, MessageCircle, Sparkles, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGetRealOwnerRooms, useUpdateRoomDetails } from "@/property-owner/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function OwnerRoomDetailPage() {
  const { id: pid, roomId } = useParams({ strict: false }) as any;
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use the real owner rooms hook (token handled internally via common JWT)
  const { data: realRoomsData, isLoading: isRoomsLoading, refetch } = useGetRealOwnerRooms();
  const updateDetailsMut = useUpdateRoomDetails();

  const room = useMemo(() => {
    if (!realRoomsData || !roomId) return null;
    const { rooms: br, roomStatuses: bs } = realRoomsData;
    const x = br.find((r: any) => (r.customId || r._id) === roomId);
    if (!x) return null;
    const s = bs.find((stat: any) => stat.roomId === roomId) || {};
    return {
      id: x.customId || x._id,
      floorNumber: x.floorNumber || 1,
      roomNumber: x.roomNumber || x.type || roomId,
      beds: x.bedsTotal || 2,
      status: s.kind || "quoted",
      actualRent: s.actualRent || x.currentPrice || 0,
      expectedRent: s.expectedRent || x.currentPrice || 0,

      // Readiness fields
      commercial: s.commercial || "quoted",
      operational: s.operational || "ready",
      turnaround: s.turnaround || "movein_today",
      reason: s.reason || "",
      availableFrom: s.availableFrom || "",

      // USP fields
      uspSize: s.uspSize || "",
      uspVentilation: s.uspVentilation || "",
      uspWindow: s.uspWindow || "",
      uspSunlight: s.uspSunlight || "",
      uspView: s.uspView || "",
      uspWashroom: s.uspWashroom || "",
      uspNoise: s.uspNoise || "",
      uspPosition: s.uspPosition || "",
      uspFurniture: s.uspFurniture || "",

      property: null, // property info not embedded in rooms list; fetched separately if needed
    };
  }, [realRoomsData, roomId]);

  const [draft, setDraft] = useState<any>({});

  useMemo(() => {
    if (room && Object.keys(draft).length === 0) {
      setDraft(room);
    }
  }, [room]);

  if (isRoomsLoading) {
    return (
      <div className="property-owner-page">
        <div className="p-6 max-w-2xl mx-auto flex justify-center items-center h-40">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="property-owner-page">
        <div className="p-6 max-w-2xl mx-auto">
          <button
            onClick={() => navigate({ to: `/property-owner/properties/${pid}/rooms` })}
            className="flex items-center gap-2 text-slate-500 text-sm mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Rooms
          </button>
          <p className="text-slate-500">
            Room not found. This may be because the backend owner API is not yet available on this server.
          </p>
        </div>
      </div>
    );
  }

  const handleUpdate = async (type: "readiness" | "usp") => {
    try {
      const payload: any = {};
      if (type === "readiness") {
        payload.commercial = draft.commercial;
        payload.operational = draft.operational;
        payload.turnaround = draft.turnaround;
        payload.reason = draft.reason;
        payload.availableFrom = draft.availableFrom;
      } else {
        payload.uspSize = draft.uspSize;
        payload.uspVentilation = draft.uspVentilation;
        payload.uspWindow = draft.uspWindow;
        payload.uspSunlight = draft.uspSunlight;
        payload.uspView = draft.uspView;
        payload.uspWashroom = draft.uspWashroom;
        payload.uspNoise = draft.uspNoise;
        payload.uspPosition = draft.uspPosition;
        payload.uspFurniture = draft.uspFurniture;
      }

      await updateDetailsMut.mutateAsync({ roomId: room.id, data: payload });
      toast({ title: "Updated successfully" });
      refetch();
    } catch (_err) {
      toast({ title: "Update failed — backend owner API not yet available on this server", variant: "destructive" });
    }
  };

  const shareRoom = () => {
    const text = `Hi! Room *${room.roomNumber}* — ${room.beds} bed, ${room.commercial || "quoted"}. Rent ₹${room.expectedRent?.toLocaleString()}/mo. Interested? Let me know!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    toast({ title: "WhatsApp opened", description: "Ready to share move-in pack." });
  };

  const copyConfirmation = () => {
    navigator.clipboard.writeText(`Room ${room.roomNumber} confirmed for booking at ₹${room.expectedRent}.`);
    toast({ title: "Copied!", description: "Confirmation text copied to clipboard." });
  };

  const mapsLink = () => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent("Bangalore")}`, "_blank");
  };

  const scheduleVisit = () => toast({ title: "Schedule Visit", description: "Visit scheduling coming soon." });
  const createBooking = () => toast({ title: "Create Booking", description: "Booking flow coming soon." });

  return (
    <div className="property-owner-page">
      <div className="min-h-screen bg-slate-50 pb-32">
        <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold tracking-widest text-orange-700/80 uppercase mb-1">
                ROOM · Floor {room.floorNumber}
              </p>
              <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">
                Room #{room.roomNumber}
              </h1>
            </div>
            <Button
              variant="outline"
              className="rounded-full bg-white font-medium"
              onClick={() => navigate({ to: "/property-owner/properties/$id/rooms", params: { id: String(pid) } })}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Inventory
            </Button>
          </div>

          {/* Badges Row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1.5 whitespace-nowrap">
              <span className="text-slate-600">Offers</span>
              <span className="text-emerald-600 font-black">1</span>
              <span className="text-slate-400 font-medium normal-case text-[10px]">15-min timers</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-full px-3 py-1.5 whitespace-nowrap">
              <span className="text-slate-600">Pending</span>
              <span className="text-amber-600 font-black">2</span>
              <span className="text-slate-400 font-medium normal-case text-[10px]">awaiting approve</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-rose-200 rounded-full px-3 py-1.5 whitespace-nowrap">
              <span className="text-slate-600">Overdue Rent</span>
              <span className="text-rose-600 font-black">1</span>
              <span className="text-slate-400 font-medium normal-case text-[10px]">auto-flagged</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-full px-3 py-1.5 whitespace-nowrap">
              <span className="text-slate-600">Collected</span>
              <span className="text-emerald-600 font-black">₹150k</span>
              <span className="text-slate-400 font-medium normal-case text-[10px]">this month</span>
            </div>
          </div>

          <div className="h-2 bg-slate-200 rounded-full w-full relative">
             <div className="absolute top-0 left-0 h-full bg-slate-400 rounded-full w-1/4"></div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-amber-300 rounded-2xl p-4 shadow-sm">
              <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1">Readiness</div>
              <div className="text-2xl font-black text-amber-600">80%</div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1">Status</div>
              <div className="text-2xl font-black text-slate-900 capitalize">{room.commercial || "Quoted"}</div>
              <div className="text-[10px] font-medium text-slate-400 mt-1">current</div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1">Sharing</div>
              <div className="text-2xl font-black text-slate-900">{room.beds}-share</div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1">Rent</div>
              <div className="text-2xl font-black text-slate-900">₹{room.expectedRent?.toLocaleString()}</div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1">Suggested</div>
              <div className="text-2xl font-black text-slate-900">₹{room.expectedRent?.toLocaleString()}</div>
              <div className="text-[10px] font-medium text-slate-400 mt-1">engine</div>
            </div>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Readiness Card */}
              <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display font-medium text-xl text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" /> Readiness
                  </h3>
                  <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-bold uppercase rounded text-[10px] px-2 py-0.5">
                    {draft.commercial?.toUpperCase() || "QUOTED"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500">Commercial</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={draft.commercial}
                      onChange={(e) => setDraft({ ...draft, commercial: e.target.value })}
                    >
                      <option value="quoted">quoted</option>
                      <option value="unquoted">unquoted</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500">Operational</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={draft.operational}
                      onChange={(e) => setDraft({ ...draft, operational: e.target.value })}
                    >
                      <option value="ready">ready</option>
                      <option value="maintenance">maintenance</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500">Turnaround</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={draft.turnaround}
                      onChange={(e) => setDraft({ ...draft, turnaround: e.target.value })}
                    >
                      <option value="movein_today">movein_today</option>
                      <option value="movein_tomorrow">movein_tomorrow</option>
                      <option value="movein_1_week">movein_1_week</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500">Reason</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={draft.reason}
                      onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                    >
                      <option value="">—</option>
                      <option value="deep_cleaning">deep_cleaning</option>
                      <option value="painting">painting</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500">Available from</label>
                    <input
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={draft.availableFrom}
                      onChange={(e) => setDraft({ ...draft, availableFrom: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-full shadow-sm"
                      onClick={() => handleUpdate("readiness")}
                      disabled={updateDetailsMut.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Update
                    </Button>
                  </div>
                </div>
              </div>

              {/* USP Card */}
              <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display font-medium text-xl text-slate-900">USP & selling points</h3>
                  <Button
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-full px-5 shadow-sm"
                    onClick={() => handleUpdate("usp")}
                    disabled={updateDetailsMut.isPending}
                  >
                    Save USP
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Size", key: "uspSize" },
                    { label: "Ventilation", key: "uspVentilation" },
                    { label: "Window", key: "uspWindow" },
                    { label: "Sunlight", key: "uspSunlight" },
                    { label: "View", key: "uspView" },
                    { label: "Washroom", key: "uspWashroom" },
                    { label: "Noise", key: "uspNoise" },
                    { label: "Position", key: "uspPosition" },
                    { label: "Furniture", key: "uspFurniture" },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-500">{field.label}</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        value={draft[field.key] || ""}
                        onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                      >
                        <option value="">—</option>
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="average">Average</option>
                        <option value="poor">Poor</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                <div className="text-[10px] font-bold tracking-widest text-amber-800 uppercase mb-2">Quick Actions</div>
                <h3 className="font-display font-medium text-xl text-slate-900 mb-5">Sell this room</h3>
                <div className="space-y-3">
                  <Button onClick={scheduleVisit} className="w-full bg-[#e87b00] hover:bg-[#d67000] text-white font-bold rounded-full shadow-sm py-5 text-sm">
                    <Calendar className="w-4 h-4 mr-2" /> Schedule a visit
                  </Button>
                  <Button onClick={createBooking} className="w-full bg-[#e87b00] hover:bg-[#d67000] text-white font-bold rounded-full shadow-sm py-5 text-sm">
                    <Sparkles className="w-4 h-4 mr-2" /> Create booking
                  </Button>
                  <Button onClick={shareRoom} variant="outline" className="w-full bg-white text-slate-600 font-medium rounded-full py-5 text-sm border-slate-200">
                    <MessageCircle className="w-4 h-4 mr-2" /> Send move-in pack
                  </Button>
                  <Button onClick={copyConfirmation} variant="outline" className="w-full bg-white text-slate-600 font-medium rounded-full py-5 text-sm border-slate-200">
                    <Copy className="w-4 h-4 mr-2" /> Copy confirmation
                  </Button>
                  <Button onClick={mapsLink} variant="outline" className="w-full bg-white text-slate-600 font-medium rounded-full py-5 text-sm border-slate-200">
                    <Navigation className="w-4 h-4 mr-2" /> Maps link
                  </Button>
                </div>
              </div>

              <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                <div className="text-[10px] font-bold tracking-widest text-amber-800 uppercase mb-3">Visits (0)</div>
                <p className="text-sm text-slate-400 font-medium">No visits yet.</p>
              </div>

              <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                <div className="text-[10px] font-bold tracking-widest text-amber-800 uppercase mb-3">Bookings (0)</div>
                <p className="text-sm text-slate-400 font-medium">No bookings yet.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
