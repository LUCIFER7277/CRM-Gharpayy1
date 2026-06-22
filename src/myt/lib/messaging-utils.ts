/**
 * Build a wa.me link with pre-filled message text.
 */
export function whatsappLink(phone: string, body: string): string {
  const clean = phone.replace(/[^\d+]/g, "");
  const num = clean.startsWith("+") ? clean.slice(1) : clean;
  return `https://wa.me/${num}?text=${encodeURIComponent(body)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function genOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function fmtWhen(dateISO: string, time: string): string {
  try {
    const d = new Date(`${dateISO}T${time || "10:00"}`);
    return d.toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return `${dateISO} ${time}`;
  }
}

export function mapsLink(area: string, propertyName: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${propertyName} ${area}`)}`;
}
