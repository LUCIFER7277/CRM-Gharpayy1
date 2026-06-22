// Fetches the full user list from the backend and returns a Map<userId, {name, email, role}>
// Used to resolve assignedTcmId → real person name in lead tables.
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

export interface UserLite {
  _id: string;
  name: string;
  email: string;
  role: string;
}

let cache: Map<string, UserLite> | null = null;
let pending: Promise<Map<string, UserLite>> | null = null;

async function fetchUserMap(): Promise<Map<string, UserLite>> {
  if (cache) return cache;
  if (pending) return pending;
  pending = api.users
    .listLite()
    .then((r) => {
      const map = new Map<string, UserLite>();
      for (const u of r.items) map.set(u._id, u as UserLite);
      cache = map;
      pending = null;
      return map;
    })
    .catch(() => {
      pending = null;
      return new Map<string, UserLite>();
    });
  return pending;
}

export function useUserMap(): Map<string, UserLite> {
  const [userMap, setUserMap] = useState<Map<string, UserLite>>(cache ?? new Map());

  useEffect(() => {
    if (cache) { setUserMap(cache); return; }
    fetchUserMap().then(setUserMap);
  }, []);

  return userMap;
}
