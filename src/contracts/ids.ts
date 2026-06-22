// ULID generation - sortable, URL-safe, 26 chars. Used as primary key for every entity + command.
// No external dep - small inline impl works in browser + Node + Worker.

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function rand(len: number): string {
  let out = "";
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < len; i++) out += ENCODING[bytes[i] % 32];
  return out;
}

function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = (now - mod) / 32;
  }
  return str;
}

export function ulid(seed = Date.now()): string {
  return encodeTime(seed, TIME_LEN) + rand(RANDOM_LEN);
}

export const isUlid = (s: string) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s);
