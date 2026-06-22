import { useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, ExternalLink, Link2, RefreshCw, Trash2, Upload } from "lucide-react";
import { useCalendar, type CalEvent, type SyncProvider } from "@/lib/calendar-store";
import { eventsToIcs, downloadIcs, icsToEvents } from "@/lib/calendar-sync";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventsOverride?: CalEvent[];
}

const PROVIDERS: { id: SyncProvider; label: string; description: string }[] = [
  {
    id: "google",
    label: "Google Calendar",
    description: "Two-way sync with your Google account.",
  },
  {
    id: "outlook",
    label: "Microsoft Outlook",
    description: "Sync with Outlook 365 calendars.",
  },
  {
    id: "ics",
    label: "ICS Feed",
    description: "Subscribe to or import an external ICS calendar.",
  },
];

export function SyncPanel({ open, onOpenChange, eventsOverride }: Props) {
  const {
    events,
    connections,
    setConnection,
    removeConnection,
    importEvents,
    publishedIcsToken,
    rotateIcsToken,
  } = useCalendar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [icsUrl, setIcsUrl] = useState("");
  const [icsAccount, setIcsAccount] = useState("");
  const exportEvents = eventsOverride ?? events;

  const subscribeUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/ics/${publishedIcsToken}.ics`
      : `/api/ics/${publishedIcsToken}.ics`;

  const findConn = (p: SyncProvider) => connections.find((c) => c.provider === p);

  const exportNow = () => {
    if (exportEvents.length === 0) {
      toast.error("Nothing to export yet.");
      return;
    }
    downloadIcs("align-calendar", eventsToIcs(exportEvents));
    toast.success(`Exported ${exportEvents.length} events.`);
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const imported = icsToEvents(text, "ics");
    if (imported.length === 0) {
      toast.error("No events found in file.");
      return;
    }
    importEvents(imported);
    toast.success(`Imported ${imported.length} events.`);
  };

  const subscribeToFeed = async () => {
    if (!icsUrl.trim()) {
      toast.error("Please enter an ICS feed URL.");
      return;
    }
    setConnection({
      provider: "ics",
      connected: true,
      account: icsAccount || icsUrl,
      feedUrl: icsUrl,
      direction: "pull",
      lastSyncedAt: new Date().toISOString(),
    });
    try {
      const res = await fetch(icsUrl);
      if (res.ok) {
        const text = await res.text();
        const imported = icsToEvents(text, "ics");
        importEvents(imported);
        toast.success(`Subscribed and imported ${imported.length} events.`);
      } else {
        toast.warning("Subscribed, but couldn't fetch feed (CORS or network).");
      }
    } catch {
      toast.warning("Subscribed. The feed will pull on next refresh.");
    }
  };

  const connectOAuth = (provider: "google" | "outlook") => {
    setConnection({
      provider,
      connected: true,
      account: provider === "google" ? "you@gmail.com" : "you@outlook.com",
      direction: "both",
      lastSyncedAt: new Date().toISOString(),
      selectedCalendars: ["primary"],
    });
    toast.success(`${provider === "google" ? "Google" : "Outlook"} calendar connected.`);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Calendar sync</SheetTitle>
          <SheetDescription>
            Keep Align in sync with your other calendars or share your schedule out.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Connections</h3>
            <ul className="space-y-3">
              {PROVIDERS.map((p) => {
                const conn = findConn(p.id);
                return (
                  <li key={p.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.label}</span>
                          {conn?.connected && (
                            <Badge variant="secondary" className="text-[10px]">
                              Connected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                        {conn?.account && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{conn.account}</p>
                        )}
                        {conn?.lastSyncedAt && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Last synced {new Date(conn.lastSyncedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {p.id !== "ics" ? (
                          conn?.connected ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeConnection(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Disconnect
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => connectOAuth(p.id as "google" | "outlook")}>
                              <Link2 className="h-3.5 w-3.5 mr-1" /> Connect
                            </Button>
                          )
                        ) : null}
                      </div>
                    </div>
                    {conn?.connected && p.id !== "ics" && (
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={conn.direction === "both" || conn.direction === "push"}
                            onCheckedChange={(v) =>
                              setConnection({
                                ...conn,
                                direction: v
                                  ? conn.direction === "pull"
                                    ? "both"
                                    : "push"
                                  : "pull",
                              })
                            }
                          />
                          <span>Push events to {p.label}</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() =>
                          setConnection({ ...conn, lastSyncedAt: new Date().toISOString() })
                        }>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync now
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Subscribe to an ICS feed</h3>
            <p className="text-xs text-muted-foreground">
              Paste a public webcal/ICS URL from any calendar provider. Events will be imported into Align.
            </p>
            <div className="space-y-2">
              <Input
                placeholder="https://example.com/calendar.ics"
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
              />
              <Input
                placeholder="Label (optional)"
                value={icsAccount}
                onChange={(e) => setIcsAccount(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={subscribeToFeed} className="flex-1">
                  <Link2 className="h-3.5 w-3.5 mr-1" /> Subscribe
                </Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Import .ics
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ics,text/calendar"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Share Align as a calendar feed</h3>
            <p className="text-xs text-muted-foreground">
              Subscribe to this URL from any calendar app to view your Align events.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Subscription URL</Label>
              <div className="flex gap-2">
                <Input value={subscribeUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(subscribeUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={exportNow}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download .ics
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { rotateIcsToken(); toast.success("URL rotated."); }}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Rotate URL
                </Button>
                <a
                  href={`https://calendar.google.com/calendar/r/settings/addbyurl`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs text-primary hover:underline"
                >
                  Add to Google <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
