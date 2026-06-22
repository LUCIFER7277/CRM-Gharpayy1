import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatINR } from "@/lib/utils";

export type QuotationStatus = "sent" | "paid" | "not-paid" | "expired" | "cancelled";

export interface Quotation {
  id: string;
  leadId: string;
  tcmId?: string;
  propertyId?: string;
  propertyName: string;
  roomType: string;
  roomNumber?: string;
  actualRent: number;
  discountedPrice: number;
  deposit: number;
  prebook: number;
  maintenance: number;
  maintenanceType: "One-Time" | "Monthly";
  lockIn: string;
  notice: string;
  validityMinutes: number;
  validUntilISO: string;
  message: string;
  status: QuotationStatus;
  sentAt: string;
  paidAt?: string;
  paymentNote?: string;
}

export function formatValidity(untilISO: string): string {
  const d = new Date(untilISO);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hr12 = h % 12 || 12;
  return `${hr12}:${m} ${ampm}`;
}

export interface QuotationDraft {
  propertyName: string;
  roomType: string;
  roomNumber?: string;
  actualRent: number;
  discountedPrice: number;
  deposit: number;
  prebook: number;
  maintenance: number;
  maintenanceType: "One-Time" | "Monthly";
  lockIn: string;
  notice: string;
  validUntilISO: string;
}

export function renderQuotationMessage(d: QuotationDraft): string {
  const validity = formatValidity(d.validUntilISO);
  const roomLine = d.roomNumber ? ` | Room ${d.roomNumber}` : "";
  return [
    `🙌🏻⚡️ *Stay Reserved  ( Limited Good Rooms)*`,
    `📍 *${d.propertyName}*`,
    ` \`Room Type: ${d.roomType}\`${roomLine}`,
    ``,
    `Actual Rent: ~${formatINR(d.actualRent)}~`,
    ` \`Discounted Price: ${formatINR(d.discountedPrice)}\`  🔑 valid till ${validity}`,
    ``,
    ` \`Deposit: ${formatINR(d.deposit)}\``,
    ` _Maintenance: ${formatINR(d.maintenance)} (${d.maintenanceType}) | Lock-in: ${d.lockIn} | Notice: ${d.notice}_`,
    ``,
    `Prebook NOW : ${formatINR(d.prebook)} only`,
    `_Balance payable at check-in_`,
    `> Note: After ${validity}, price resets to ACTUAL RENT and the same room won't be available.`,
    ``,
    `🤙🏻 https://gharpayy.com/payment.html`,
  ].join("\n");
}

// === REACT QUERY MIGRATION (Mock Backend Store) ===
let mockQuotations: Quotation[] = [];
const uid = () => `qt-${Math.random().toString(36).slice(2, 9)}`;

function normalizeQuotation(raw: Record<string, unknown>): Quotation {
  const id = String(raw.id ?? raw._id ?? "");
  return {
    id,
    leadId: String(raw.leadId ?? ""),
    tcmId: raw.tcmId ? String(raw.tcmId) : undefined,
    propertyId: raw.propertyId ? String(raw.propertyId) : undefined,
    propertyName: String(raw.propertyName ?? ""),
    roomType: String(raw.roomType ?? ""),
    roomNumber: raw.roomNumber ? String(raw.roomNumber) : undefined,
    actualRent: Number(raw.actualRent ?? 0),
    discountedPrice: Number(raw.discountedPrice ?? 0),
    deposit: Number(raw.deposit ?? 0),
    prebook: Number(raw.prebook ?? 0),
    maintenance: Number(raw.maintenance ?? 0),
    maintenanceType: (raw.maintenanceType as Quotation["maintenanceType"]) ?? "One-Time",
    lockIn: String(raw.lockIn ?? ""),
    notice: String(raw.notice ?? ""),
    validityMinutes: Number(raw.validityMinutes ?? 20),
    validUntilISO: String(raw.validUntilISO ?? new Date().toISOString()),
    message: String(raw.message ?? ""),
    status: (raw.status as QuotationStatus) ?? "sent",
    sentAt: String(raw.sentAt ?? new Date().toISOString()),
    paidAt: raw.paidAt ? String(raw.paidAt) : undefined,
    paymentNote: raw.paymentNote ? String(raw.paymentNote) : undefined,
  };
}

function normalizeList(raw: unknown): Quotation[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item) => normalizeQuotation(item as Record<string, unknown>)).filter((q) => q.id);
}

export function useQuotationsQuery(leadId?: string) {
  return useQuery({
    queryKey: ["quotations", leadId ?? "all"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<unknown>(`/quotations`, leadId ? { params: { leadId } } : undefined);
        return normalizeList(res);
      } catch {
        const local = leadId ? mockQuotations.filter((q) => q.leadId === leadId) : mockQuotations;
        return local;
      }
    },
  });
}

export function getAll(): Quotation[] {
  return mockQuotations;
}

export function getByLead(leadId: string): Quotation[] {
  return mockQuotations.filter((q) => q.leadId === leadId);
}

export function useAddQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (q: Omit<Quotation, "id" | "status" | "sentAt">) => {
      try {
        const res = await apiClient.post<Record<string, unknown>>(`/quotations`, q);
        return normalizeQuotation(res);
      } catch {
        const rec: Quotation = {
          ...q,
          id: uid(),
          status: "sent",
          sentAt: new Date().toISOString(),
        };
        mockQuotations = [rec, ...mockQuotations];
        return rec;
      }
    },
    onSuccess: (data) => {
      if (data) queryClient.invalidateQueries({ queryKey: ["quotations", data.leadId] });
    },
  });
}

export function useSetQuotationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, leadId, status, note }: { id: string; leadId: string; status: QuotationStatus; note?: string }) => {
      try {
        return await apiClient.put<Quotation>(`/quotations/${id}/status`, { status, note });
      } catch (e) {
        mockQuotations = mockQuotations.map((q) =>
          q.id === id
            ? {
                ...q,
                status,
                paidAt: status === "paid" ? new Date().toISOString() : q.paidAt,
                paymentNote: note ?? q.paymentNote,
              }
            : q
        );
        return mockQuotations.find(q => q.id === id);
      }
    },
    onSuccess: (data, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ["quotations", leadId] });
    },
  });
}

// Re-export for any older components that imported it directly from here
export { formatINR };
