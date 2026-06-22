import { useState } from "react";
import { useAuthUser } from "@/lib/auth-store";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api/client";
import { useGetRealOwnerProperties } from "@/property-owner/lib/api";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, LogOut, Building2, Lock, Eye, EyeOff,
  CheckCircle2, MapPin, ChevronRight, ShieldCheck, Camera
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function OwnerProfilePage() {
  const user = useAuthUser((s) => s.user);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Owner-scoped properties — from backend, filtered by ownerId
  const { data: properties = [], isLoading: propsLoading } = useGetRealOwnerProperties();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (!newPassword.trim()) { setPwError("New password is required."); return; }
    if (newPassword.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPwError("Passwords don't match."); return; }
    setPwLoading(true);
    try {
      await api.auth.update({ password: newPassword });
      setPwSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwError(err?.message || "Failed to update password.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    useAuthUser.getState().setUser(null);
    void navigate({ to: "/login", search: { redirect: "/" } });
  };

  const initials = user?.fullName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "O";

  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto pb-24">

        {/* Premium Header — matches rent-insight-app me.tsx owner section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/40"
        >
          {/* Gradient banner */}
          <div className="h-32 bg-gradient-to-br from-primary/90 via-orange-500 to-red-500 relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute top-4 right-4">
              <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-md font-bold px-3 py-1">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Verified Owner
              </Badge>
            </div>
          </div>

          {/* Profile content */}
          <div className="px-6 pb-8 sm:px-8 relative">
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-end -mt-16 sm:-mt-12 mb-6">
              {/* Avatar */}
              <div className="w-28 h-28 bg-white p-1.5 rounded-full shadow-lg relative z-10 shrink-0 group">
                <div className="w-full h-full bg-gradient-to-br from-orange-50 to-orange-100 rounded-full flex items-center justify-center text-4xl font-bold font-display text-primary shadow-inner overflow-hidden border border-slate-100 relative">
                  {(user as any)?.profileImage ? (
                    <img src={(user as any).profileImage} alt={user?.fullName || ""} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                  {/* Upload Overlay */}
                  <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity backdrop-blur-sm">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const base64 = event.target?.result as string;
                            if (base64 && user) {
                              useAuthUser.getState().setUser({ ...user, profileImage: base64 } as any);
                              toast({ title: "Profile Image Updated", description: "Looking sharp!" });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="text-center sm:text-left flex-1 pt-2 sm:pt-0">
                <h1 className="text-3xl font-black font-display text-slate-900 tracking-tight">
                  {user?.fullName || user?.username || "Owner"}
                </h1>
                <p className="text-primary font-bold text-sm tracking-wide uppercase mt-1">Property Owner</p>
              </div>
            </div>

            {/* Contact cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Address</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{user?.email || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                  <Phone className="w-4 h-4 text-slate-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Phone Number</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{user?.phone || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* My Portfolio — matches rent-insight-app me.tsx property section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              My Portfolio
            </h3>
            {properties.length > 0 && (
              <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {properties.length} {properties.length === 1 ? "Property" : "Properties"}
              </span>
            )}
          </div>

          {propsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : properties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {properties.map((p: any, i: number) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => navigate({ to: "/property-owner/properties/$id/rooms", params: { id: String(p.id) } })}
                  className="group relative bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-200 transition-all duration-300 overflow-hidden cursor-pointer"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
                  <div className="flex gap-4 items-start">
                    <div className="w-12 h-12 bg-white text-primary rounded-xl flex items-center justify-center shrink-0 border border-orange-100 shadow-sm">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <h4 className="font-bold text-slate-900 text-base truncate group-hover:text-primary transition-colors">{p.name}</h4>
                      <div className="flex items-start gap-1 mt-1.5 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                        <p className="text-xs leading-relaxed line-clamp-2 font-medium">{p.address || p.area || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.availability === "AVAILABLE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {p.availability === "AVAILABLE" ? `${p.availableRooms} available` : "Full"}
                        </span>
                        <span className="text-[10px] text-slate-400">₹{(p.monthlyRent || 0).toLocaleString()}/mo</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-orange-50 text-primary flex items-center justify-center">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-3xl shadow-sm"
            >
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="text-lg font-bold text-slate-700 mb-2">No properties yet</h4>
              <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">You haven't listed any properties in your portfolio yet.</p>
              <button
                onClick={() => navigate({ to: "/property-owner/properties/new" })}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm"
              >
                Add Property
              </button>
            </motion.div>
          )}
        </div>

        {/* Change Password */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900">Change Password</h3>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                placeholder="New password (min 8 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input type="password" placeholder="Confirm new password"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            {pwError && <p className="text-sm text-red-500 font-medium">{pwError}</p>}
            {pwSuccess && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Password updated successfully!
              </div>
            )}
            <Button type="submit" disabled={pwLoading} className="w-full">
              {pwLoading ? "Updating…" : "Update Password"}
            </Button>
          </form>
        </div>

        {/* Logout */}
        <div className="pb-4">
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-slate-200 text-slate-600 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-100 font-bold transition-all shadow-sm">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
