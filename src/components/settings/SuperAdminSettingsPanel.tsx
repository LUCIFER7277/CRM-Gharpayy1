import { useEffect, useState } from "react";
import { Users, Shield, User as UserIcon, Activity as ActivityIcon } from "lucide-react";
import { UsersTab } from "./UsersTab";
import { RolesTab } from "./RolesTab";
import { ActivityTab } from "./ActivityTab";
import { ProfileTab } from "./ProfileTab";

type Tab = "users" | "roles" | "profile" | "activity";

export function SuperAdminSettingsPanel() {
  const [active, setActive] = useState<Tab>("users");

  // hydrate tab from hash so links like /settings#roles work
  useEffect(() => {
    const h = (typeof window !== "undefined" ? window.location.hash : "").replace("#", "") as Tab;
    if (["users", "roles", "profile", "activity"].includes(h)) setActive(h);
  }, []);

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "roles", label: "Roles", icon: Shield },
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "activity", label: "Activity", icon: ActivityIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-nowrap gap-1 border-b overflow-x-auto pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={
                "shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap " +
                (isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {active === "users" && <UsersTab />}
      {active === "roles" && <RolesTab />}
      {active === "profile" && <ProfileTab />}
      {active === "activity" && <ActivityTab />}
    </div>
  );
}
