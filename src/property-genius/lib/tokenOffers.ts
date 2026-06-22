// Token Offer flow — 15-min scarcity quotes with public tenant link + UPI QR.
// Separate from existing BookOS bookings: a token offer is pre-booking only.
// When 'paid', it can be promoted to a BookOS booking by the admin.
import { useEffect, useState } from "react";

export type OfferStatus = "pending" | "approved" | "paid" | "expired" | "cancelled";

export interface TokenOffer {
  id: string;
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  pgId?: string | null;
  roomNumber?: string | null;
  moveInDate?: string | null;
  actualRent: number;
  discountedRent: number;
  deposit: number;
  maintenanceFee: number;
  maintenanceType: "One-Time" | "Monthly";
  tokenAmount: number;
  stayDurationMonths: number;
  noticePeriodMonths: number;
  upiId?: string | null;
  adminPhone?: string | null;
  notes?: string | null;
  status: OfferStatus;
  offerExpiresAt?: string | null;
  paidRef?: string | null;
  createdAt: string;
  updatedAt: string;
}

const K = "gh_token_offers_v1";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const load = (): TokenOffer[] => {
  try { return JSON.parse(localStorage.getItem(K) || "[]"); } catch { return []; }
};
const save = (d: TokenOffer[]) => localStorage.setItem(K, JSON.stringify(d));

const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
export const subscribeOffers = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const OffersDB = {
  all(): TokenOffer[] {
    return load().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },
  get(id: string) { return load().find((o) => o.id === id); },
  create(data: Omit<TokenOffer, "id" | "status" | "createdAt" | "updatedAt" | "offerExpiresAt">): TokenOffer {
    const all = load();
    const o: TokenOffer = {
      ...data, id: uid(), status: "pending", offerExpiresAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    all.push(o); save(all); notify(); return o;
  },
  update(id: string, patch: Partial<TokenOffer>) {
    const all = load(); const i = all.findIndex((o) => o.id === id);
    if (i === -1) return null;
    all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
    save(all); notify(); return all[i];
  },
  approve(id: string, windowMins = 15) {
    return this.update(id, { status: "approved", offerExpiresAt: new Date(Date.now() + windowMins * 60000).toISOString() });
  },
  markPaid(id: string, ref?: string) { return this.update(id, { status: "paid", paidRef: ref || null }); },
  cancel(id: string) { return this.update(id, { status: "cancelled" }); },
  reactivate(id: string, m = 15) { return this.approve(id, m); },
  del(id: string) { save(load().filter((o) => o.id !== id)); notify(); },
  syncExpiry() {
    const all = load(); const now = Date.now(); let dirty = false;
    all.forEach((o) => {
      if (o.status === "approved" && o.offerExpiresAt && +new Date(o.offerExpiresAt) <= now) {
        o.status = "expired"; o.updatedAt = new Date().toISOString(); dirty = true;
      }
    });
    if (dirty) { save(all); notify(); }
  },
  stats() {
    const all = load();
    return {
      total: all.length,
      pending: all.filter((o) => o.status === "pending").length,
      approved: all.filter((o) => o.status === "approved").length,
      paid: all.filter((o) => o.status === "paid").length,
      expired: all.filter((o) => o.status === "expired").length,
      tokenRevenue: all.filter((o) => o.status === "paid").reduce((s, o) => s + o.tokenAmount, 0),
    };
  },
};

export function useOffers<T>(getter: () => T): T {
  const [v, setV] = useState(getter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => subscribeOffers(() => setV(getter())), []);
  return v;
}

export const fmtINR = (n: number) => "₹" + new Intl.NumberFormat("en-IN").format(n || 0);
export const waLink = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
export const buildUpiUrl = (upiId: string, name: string, amount: number, note: string) =>
  `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
export const qrUrl = (data: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=080808&margin=12`;
export const copyText = (t: string) => { try { navigator.clipboard.writeText(t); } catch { /* */ } };
export const timeAgo = (iso: string) => {
  const d = Date.now() - +new Date(iso);
  if (d < 60000) return "just now";
  if (d < 3600000) return Math.floor(d / 60000) + "m ago";
  if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
  return Math.floor(d / 86400000) + "d ago";
};
