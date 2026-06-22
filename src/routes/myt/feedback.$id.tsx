import { createFileRoute } from "@tanstack/react-router";
import CustomerFeedbackPage from "@/myt/pages/CustomerFeedbackPage";

export const Route = createFileRoute("/myt/feedback/$id")({
  head: () => ({ meta: [{ title: "Tour Feedback" }] }),
  component: CustomerFeedbackPage,
});
