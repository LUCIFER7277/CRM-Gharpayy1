/**
 * AssignmentNotificationCard
 *
 * Displays a single pending assignment notification with Accept and Pass on buttons.
 * Used in the /inbox page and the notification bell dropdown.
 *
 * For "Pass on":
 *  - Lead: shows all active members (any role) except the current user
 *  - Tour: shows all active users with isTcm=true, except the current user
 */

import { useState, useEffect } from "react";
import { CheckCircle2, ArrowRightLeft, User2, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { api, type AssignmentNotificationItem } from "@/lib/api/client";
import { useAssignmentNotifications } from "@/lib/assignment-notifications-store";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface UserOption {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface AssignmentNotificationCardProps {
  notification: AssignmentNotificationItem;
  /** Current user's ID — excluded from pass-on options */
  currentUserId?: string;
  /** Compact mode for the bell dropdown */
  compact?: boolean;
  onActionComplete?: () => void;
}

export function AssignmentNotificationCard({
  notification,
  currentUserId,
  compact = false,
  onActionComplete,
}: AssignmentNotificationCardProps) {
  const { accept, passOn } = useAssignmentNotifications();
  const [accepting, setAccepting] = useState(false);
  const [passing, setPassing] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);

  // Fetch users list when pass-on popover opens
  useEffect(() => {
    if (!passOpen) return;
    setUsersLoading(true);
    api.users.listLite()
      .then((res) => {
        let options = res.items.map((u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, isTcm: u.isTcm }));
        // Exclude self
        options = options.filter((u) => u._id !== currentUserId);
        
        // Filter based on type
        if (notification.type === "lead") {
          options = options.filter((u) => u.role === "member");
        } else {
          options = options.filter((u) => u.isTcm);
        }
        
        setUsers(options);
      })
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, [passOpen, currentUserId, notification.type]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await accept(notification._id, notification.type);
      toast.success(
        notification.type === "lead"
          ? `You accepted ${notification.leadName}'s lead!`
          : `You accepted ${notification.leadName}'s tour!`,
      );
      onActionComplete?.();
    } catch (e) {
      toast.error((e as Error).message ?? "Something went wrong");
    } finally {
      setAccepting(false);
    }
  };

  const handlePassOn = async () => {
    if (!selectedUser) return;
    setPassing(true);
    try {
      await passOn(notification._id, notification.type, selectedUser._id);
      toast.success(`Passed on to ${selectedUser.name}`);
      setPassOpen(false);
      setSelectedUser(null);
      onActionComplete?.();
    } catch (e) {
      toast.error((e as Error).message ?? "Something went wrong");
    } finally {
      setPassing(false);
    }
  };

  const entityLabel = notification.type === "lead" ? "lead" : "tour";
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  if (compact) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5 border-b border-border/50">
        <div className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {notification.type === "lead" ? "Lead" : "Tour"} assigned to you
            </p>
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {notification.assignedByName} assigned {notification.leadName}'s {entityLabel} to you
            </p>
            <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">{timeAgo}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pl-4">
          <Button
            size="sm"
            variant="default"
            className="h-6 text-[10px] px-2"
            onClick={handleAccept}
            disabled={accepting || passing}
          >
            {accepting ? <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> : <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
            Accept
          </Button>
          <span className="text-[10px] text-muted-foreground">or see inbox to pass on</span>
        </div>
      </div>
    );
  }

  return (
    <li
      className={cn(
        "rounded-xl border p-4 space-y-3 bg-card",
        "border-accent/30 ring-1 ring-accent/10",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <User2 className="h-4 w-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">
              {notification.type === "lead" ? "Lead assigned" : "Tour assigned"}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] capitalize",
                notification.type === "lead"
                  ? "border-blue-500/30 text-blue-400"
                  : "border-purple-500/30 text-purple-400",
              )}
            >
              {notification.type}
            </Badge>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            <span className="text-foreground font-medium">{notification.assignedByName}</span>
            {" "}assigned{" "}
            <span className="text-foreground font-medium">{notification.leadName}</span>
            's {entityLabel} to you
          </p>
          <p className="text-[11px] text-muted-foreground/60 font-mono mt-1">{timeAgo}</p>
        </div>
      </div>

      {/* Action buttons or Accepted state */}
      <div className="flex items-center gap-2 pl-11">
        {notification.status === "accepted" ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-accent/5 px-2.5 py-1 rounded-md border border-accent/10">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Accepted
          </div>
        ) : (
          <>
            {/* Accept */}
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-success/90 hover:bg-success text-success-foreground"
              onClick={handleAccept}
              disabled={accepting || passing}
              id={`accept-assignment-${notification._id}`}
            >
              {accepting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="h-3.5 w-3.5" />}
              Accept
            </Button>

            {/* Pass on */}
            <Popover open={passOpen} onOpenChange={setPassOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  disabled={accepting || passing}
                  id={`pass-assignment-${notification._id}`}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Pass on
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-64" align="start">
                <Command>
                  <CommandInput placeholder="Search team members…" className="text-xs" />
                  <CommandList>
                    {usersLoading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!usersLoading && <CommandEmpty>No members found.</CommandEmpty>}
                    {!usersLoading && users.length > 0 && (
                      <CommandGroup heading={notification.type === "tour" ? "Active TCMs" : "Team members"}>
                        {users.map((u) => (
                          <CommandItem
                            key={u._id}
                            value={u.name}
                            onSelect={() => setSelectedUser(u)}
                            className={cn(
                              "text-xs cursor-pointer",
                              selectedUser?._id === u._id && "bg-accent/10 text-accent",
                            )}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{u.name}</span>
                              <span className="text-muted-foreground text-[10px] truncate">{u.email}</span>
                            </div>
                            {selectedUser?._id === u._id && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-accent ml-auto shrink-0" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                  {selectedUser && (
                    <div className="border-t border-border p-2">
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={handlePassOn}
                        disabled={passing}
                        id={`confirm-pass-assignment-${notification._id}`}
                      >
                        {passing
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          : <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />}
                        Pass to {selectedUser.name}
                      </Button>
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>
    </li>
  );
}
