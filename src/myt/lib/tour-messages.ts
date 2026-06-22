import type { Tour } from "./types";

export async function sendTourMessage(opts: { tour: Tour; kind: string; channels: string[] }) {
  return { error: null as null | Error };
}
export async function logTourEvent(tourId: string, kind: string, _notes?: string) {
  return { error: null as null | Error };
}
