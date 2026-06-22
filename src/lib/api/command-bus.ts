// Command bus - dispatch a typed command, optimistic application happens in the calling store.
// Server validates and returns the produced events. Realtime delivers them to ALL connected clients.
import { api } from "./client";
import { Command, ulid, type Command as Cmd } from "@/contracts";

export type DispatchResult =
  | { ok: true; eventIds: string[] }
  | { ok: false; error: string };

export async function dispatch(input: Omit<Cmd, "_id" | "issuedAt"> & Partial<Pick<Cmd, "_id" | "issuedAt">>): Promise<DispatchResult> {
  const cmd = {
    _id: input._id ?? ulid(),
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    ...input,
  } as Cmd;
  const parsed = Command.safeParse(cmd);
  if (!parsed.success) {
    return { ok: false, error: `Client validation failed: ${parsed.error.message}` };
  }
  try {
    return await api.command<DispatchResult>(parsed.data as unknown as { _id: string; type: string; payload: Record<string, unknown> } & Record<string, unknown>);
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.message };
  }
}
