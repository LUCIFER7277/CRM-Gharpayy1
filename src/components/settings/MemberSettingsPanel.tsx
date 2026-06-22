import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "./ProfileTab";
import { MemberTcmTab } from "./MemberTcmTab";

export function MemberSettingsPanel() {
  const [active, setActive] = useState("profile");

  return (
    <div className="space-y-4">
      <Tabs value={active} onValueChange={setActive} className="space-y-4">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="tcm">TCM</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-3">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="tcm" className="space-y-3">
          <MemberTcmTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
