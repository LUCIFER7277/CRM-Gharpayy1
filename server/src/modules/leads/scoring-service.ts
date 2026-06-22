import { Lead, Activity, Tour, Todo } from "../../../../src/contracts/entities.js";

export interface PriorityResult {
  priorityScore: number;
  priorityState: "HOT" | "WARM" | "COLD" | "OVERDUE";
  nextBestAction: string;
  priorityReason: string;
}

export function calculateLeadPriority(
  lead: Lead,
  activities: Activity[],
  tours: Tour[],
  todos: Todo[]
): PriorityResult {
  const now = new Date();
  const nowMs = now.getTime();

  let score = 0;
  let reasonParts: string[] = [];
  let nextBestAction = "Follow up";

  // 1. Urgency (0-25)
  let moveInUrgency = 0;
  if (lead.moveInDate) {
    const moveIn = new Date(lead.moveInDate).getTime();
    const daysToMoveIn = (moveIn - nowMs) / (1000 * 60 * 60 * 24);
    
    if (daysToMoveIn <= 3 && daysToMoveIn >= -5) {
      moveInUrgency = 25;
      reasonParts.push("Move-in <= 3 days");
    } else if (daysToMoveIn <= 7 && daysToMoveIn >= -5) {
      moveInUrgency = 20;
      reasonParts.push("Move-in <= 7 days");
    } else if (daysToMoveIn <= 15 && daysToMoveIn >= -5) {
      moveInUrgency = 10;
      reasonParts.push("Move-in <= 15 days");
    }
  }
  score += moveInUrgency;

  // 2. Engagement (0-25)
  let engagementScore = 0;
  const calls = activities
    .filter(a => a.kind === "call")
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  if (calls.length > 0) {
    const answeredCalls = calls.filter(c => c.outcome === "connected");
    const unansweredCalls = calls.filter(c => c.outcome === "no_answer" || c.outcome === "voicemail" || c.outcome === "busy");

    if (answeredCalls.length >= 2) {
      engagementScore = 25;
      reasonParts.push("Answered 2+ calls");
    } else if (calls[0].outcome === "connected") {
      engagementScore = 15;
      reasonParts.push("Answered last call");
    } else if (unansweredCalls.length >= 3) {
      engagementScore = -15;
      reasonParts.push("No answer 3+ times");
    }
  }
  score += engagementScore;

  // 3. Tour Signals (0-30)
  let tourScore = 0;
  const sortedTours = [...tours].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  if (sortedTours.length > 0) {
    // Check highest signal from any tour
    let highestTourSignal = 0;
    for (const t of sortedTours) {
      if (t.postTour?.outcome === "thinking" || t.postTour?.outcome === "draft") {
        highestTourSignal = Math.max(highestTourSignal, 30); // "Liked property" equivalent
      } else if (t.postTour?.outcome === "rejected" || t.postTour?.outcome === "not-interested") {
        highestTourSignal = Math.min(highestTourSignal, -20);
      } else if (t.status === "completed") {
        highestTourSignal = Math.max(highestTourSignal, 20);
      } else if (t.status === "scheduled") {
        highestTourSignal = Math.max(highestTourSignal, 10);
      }
    }
    tourScore = highestTourSignal;
    
    if (tourScore === 30) reasonParts.push("Tour liked property");
    else if (tourScore === 20) reasonParts.push("Tour completed");
    else if (tourScore === 10) reasonParts.push("Tour scheduled");
    else if (tourScore === -20) reasonParts.push("Tour rejected");
  }
  score += tourScore;

  // 4. Freshness (-20 to +20)
  let freshnessScore = 0;
  if (activities.length > 0) {
    const latestActivity = activities.reduce((latest, current) => {
      return new Date(current.occurredAt) > new Date(latest.occurredAt) ? current : latest;
    });
    
    const daysSinceLastActivity = (nowMs - new Date(latestActivity.occurredAt).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastActivity <= 1) {
      freshnessScore = 20;
      reasonParts.push("Activity within 24h");
    } else if (daysSinceLastActivity <= 3) {
      freshnessScore = 10;
      reasonParts.push("Activity within 3 days");
    } else if (daysSinceLastActivity <= 7) {
      freshnessScore = 5;
    } else if (daysSinceLastActivity >= 30) {
      freshnessScore = -20;
      reasonParts.push("No activity 30+ days");
    } else if (daysSinceLastActivity >= 15) {
      freshnessScore = -10;
      reasonParts.push("No activity 15+ days");
    }
  } else {
    // No activities yet, check lead creation time
    const daysSinceCreation = (nowMs - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation <= 1) {
      freshnessScore = 20;
      reasonParts.push("New lead");
    } else if (daysSinceCreation >= 30) {
      freshnessScore = -20;
    } else if (daysSinceCreation >= 15) {
      freshnessScore = -10;
    }
  }
  score += freshnessScore;

  // 5. Objections (-20)
  let objectionScore = 0;
  for (const t of sortedTours) {
    if (t.postTour?.outcome === "not-interested") {
      objectionScore = Math.min(objectionScore, -20);
      reasonParts.push("Not interested");
      break;
    }
    if (t.postTour?.objection) {
      const objLower = t.postTour.objection.toLowerCase();
      if (objLower.includes("price") || objLower.includes("budget")) {
        objectionScore = Math.min(objectionScore, -10);
        reasonParts.push("Price objection");
      } else if (objLower.includes("location") || objLower.includes("distance")) {
        objectionScore = Math.min(objectionScore, -10);
        reasonParts.push("Location objection");
      }
    }
  }
  score += objectionScore;

  // Clamp Score
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  // Calculate OVERDUE state
  let isOverdue = false;
  
  if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() < nowMs) {
    isOverdue = true;
    reasonParts.push("Follow-up overdue");
    nextBestAction = "Follow up on scheduled task";
  } else {
    const openTodos = todos.filter(t => t.status === "open" || t.status === "in-progress" || t.status === "accepted");
    const overdueTodo = openTodos.find(t => t.dueAt && new Date(t.dueAt).getTime() < nowMs);
    if (overdueTodo) {
      isOverdue = true;
      reasonParts.push("Task overdue");
      nextBestAction = `Complete task: ${overdueTodo.title}`;
    }
  }

  let priorityState: "HOT" | "WARM" | "COLD" | "OVERDUE" = "COLD";
  
  if (isOverdue) {
    priorityState = "OVERDUE";
  } else if (score >= 80) {
    priorityState = "HOT";
  } else if (score >= 50) {
    priorityState = "WARM";
  }

  // Next Best Action logic if not overdue
  if (!isOverdue) {
    if (lead.stage === "new") {
      nextBestAction = "Call lead";
    } else if (lead.stage === "contacted" && tourScore < 10) {
      nextBestAction = "Schedule Tour";
    } else if (tourScore === 10) {
      nextBestAction = "Confirm Tour";
    } else if (tourScore === 20 || tourScore === 30) {
      if (objectionScore < 0) {
        nextBestAction = "Address objection";
      } else {
        nextBestAction = "Send Quote";
      }
    } else if (lead.stage === "quote-sent") {
      nextBestAction = "Follow up on quote";
    } else if (engagementScore === -15) {
      nextBestAction = "Send WhatsApp message";
    }
  }

  return {
    priorityScore: score,
    priorityState,
    nextBestAction,
    priorityReason: reasonParts.slice(0, 3).join(", ") // limit to top 3 reasons
  };
}
