import { DomainEvent } from "../../../../src/contracts/events.js";
import { col } from "../../db/mongo.js";
import { Lead, Activity, Tour, Todo } from "../../../../src/contracts/entities.js";
import { calculateLeadPriority } from "./scoring-service.js";
import { dispatch } from "./command-handlers.js";

// Helper to determine if an event affects lead priority
export function shouldRecalculatePriority(evt: DomainEvent): string | null {
  switch (evt.type) {
    case "evt.lead.created":
      return evt.payload.lead._id;
    case "evt.lead.updated":
      // Only recalculate if something relevant changed, but for simplicity, do it always
      return evt.payload.leadId;
    case "evt.activity.logged":
      if (evt.payload.activity.entityType === "lead") {
        return evt.payload.activity.entityId;
      }
      break;
    case "evt.tour.scheduled":
    case "evt.tour.rescheduled":
    case "evt.tour.completed":
    case "evt.tour.cancelled":
    case "evt.tour.updated": {
      // For some tour events we only have tourId, we might need to look it up
      // Or if the payload has leadId (scheduled has it)
      if ("tour" in evt.payload && (evt.payload.tour as any).leadId) {
        return (evt.payload.tour as any).leadId;
      }
      return null; // Will need lookup
    }
    case "evt.todo.created":
    case "evt.todo.updated":
    case "evt.todo.completed":
    case "evt.todo.cancelled":
      if ("todo" in evt.payload && evt.payload.todo.entityType === "lead" && evt.payload.todo.entityId) {
        return evt.payload.todo.entityId;
      }
      break;
  }
  return null;
}

export async function processPriorityRecalculation(evt: DomainEvent) {
  let leadId = shouldRecalculatePriority(evt);

  // If we only got a tourId or activityId, look up the leadId
  if (!leadId) {
    if (evt.type.startsWith("evt.tour.") && "tourId" in evt.payload) {
      const tour = await col<Tour>("tours").findOne({ _id: evt.payload.tourId });
      if (tour) leadId = tour.leadId;
    } else if (evt.type.startsWith("evt.todo.") && "todoId" in evt.payload) {
      const todo = await col<Todo>("todos").findOne({ _id: evt.payload.todoId });
      if (todo && todo.entityType === "lead" && todo.entityId) leadId = todo.entityId;
    } else if (evt.type.startsWith("evt.activity.") && "activityId" in evt.payload) {
      const activity = await col<Activity>("activities").findOne({ _id: evt.payload.activityId });
      if (activity && activity.entityType === "lead") leadId = activity.entityId;
    }
  }

  if (!leadId) return; // Not relevant

  // Fetch all required data for the lead
  const lead = await col<Lead>("leads").findOne({ _id: leadId });
  if (!lead) return;

  const activities = await col<Activity>("activities").find({ entityType: "lead", entityId: leadId }).toArray();
  const tours = await col<Tour>("tours").find({ leadId }).toArray();
  const todos = await col<Todo>("todos").find({ entityType: "lead", entityId: leadId }).toArray();

  const priorityResult = calculateLeadPriority(lead, activities, tours, todos);

  // If nothing changed, we don't need to dispatch an update
  if (
    lead.priorityScore === priorityResult.priorityScore &&
    lead.priorityState === priorityResult.priorityState &&
    lead.nextBestAction === priorityResult.nextBestAction &&
    lead.priorityReason === priorityResult.priorityReason
  ) {
    return;
  }

  // Dispatch cmd.lead.update
  const systemUser = {
    sub: "system",
    role: "system",
    tenantId: lead.tenantId,
    scopes: ["lead.update"]
  };

  try {
    await dispatch({
      _id: `sys_recalc_${evt._id}_${Date.now()}`,
      issuedAt: new Date().toISOString(),
      type: "cmd.lead.update",
      payload: {
        leadId,
        patch: {
          priorityScore: priorityResult.priorityScore,
          priorityState: priorityResult.priorityState,
          nextBestAction: priorityResult.nextBestAction,
          priorityReason: priorityResult.priorityReason,
        }
      }
    }, systemUser as any);
  } catch (err) {
    console.error(`[priority-worker] Failed to update lead priority for ${leadId}:`, err);
  }
}
