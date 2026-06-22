import { useEffect } from "react";
import { toast } from "sonner";
import { shouldPromptMorningDigest, markDigestSentToday } from "@/lib/crm10x/impact-queue-prefs";

export function useImpactMorningDigest(onOpenDigest: () => void) {
  useEffect(() => {
    const check = () => {
      if (!shouldPromptMorningDigest()) return;
      toast.info("Morning digest ready", {
        description: "9:00 AM IST — review today's top leads.",
        action: {
          label: "Open digest",
          onClick: () => {
            markDigestSentToday();
            onOpenDigest();
          },
        },
        duration: 20_000,
      });
    };

    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [onOpenDigest]);
}
