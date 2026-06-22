import { col } from "../../db/mongo.js";
import { ulid } from "../../../../src/contracts/ids.js";
import { Todo } from "../../../../src/contracts/entities.js";
import {
  CreateTodoCmd, UpdateTodoCmd, AssignTodoCmd, AcceptTodoCmd,
  DeclineTodoCmd, CompleteTodoCmd, CancelTodoCmd, type Command,
} from "../../../../src/contracts/commands.js";
import { emit, newEventId } from "../../realtime/event-bus.js";
import type { JwtClaims } from "../../auth/auth.js";

const TODOS = "todos";

type Result = { ok: true; eventIds: string[] } | { ok: false; error: string };

export async function applyTodoCommand(cmd: Command, user: JwtClaims): Promise<Result> {
  const now = new Date().toISOString();
  const correlationId = cmd._id;
  const env = (type: Parameters<typeof emit>[0]["type"]) => ({
    _id: newEventId(), type, occurredAt: now,
    actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1 as const,
  });

  switch (cmd.type) {
    case "cmd.todo.create": {
      const p = CreateTodoCmd.parse(cmd).payload;
      const assignedTo = p.assignTo ?? null;
      const status: Todo["status"] = assignedTo && assignedTo !== user.sub ? "pending-accept" : "open";
      const todo = Todo.parse({
        _id: ulid(),
        title: p.title,
        notes: p.notes ?? "",
        entityType: p.entityType ?? "none",
        entityId: p.entityId ?? null,
        createdBy: user.sub,
        assignedTo,
        status,
        priority: p.priority ?? "med",
        dueAt: p.dueAt ?? null,
        completedAt: null,
        tenantId: user.tenantId,
        createdAt: now,
        updatedAt: now,
      });
      await col(TODOS).insertOne(todo as unknown as Record<string, unknown>);
      const e = env("evt.todo.created");
      await emit({ ...e, type: "evt.todo.created", payload: { todo } });
      const out = [e._id];
      if (assignedTo && assignedTo !== user.sub) {
        const e2 = env("evt.todo.assigned");
        await emit({ ...e2, type: "evt.todo.assigned", payload: { todoId: todo._id, assignTo: assignedTo, pending: true } });
        out.push(e2._id);
      }
      return { ok: true, eventIds: out };
    }

    case "cmd.todo.update": {
      const p = UpdateTodoCmd.parse(cmd).payload;
      const r = await col(TODOS).updateOne({ _id: p.todoId, tenantId: user.tenantId }, { $set: { ...p.patch, updatedAt: now } });
      if (r.matchedCount === 0) throw Object.assign(new Error("Todo not found"), { code: "NOT_FOUND" });
      const e = env("evt.todo.updated");
      await emit({ ...e, type: "evt.todo.updated", payload: { todoId: p.todoId, patch: { ...p.patch, updatedAt: now } as Partial<Todo> } });
      return { ok: true, eventIds: [e._id] };
    }

    case "cmd.todo.assign": {
      const p = AssignTodoCmd.parse(cmd).payload;
      const pending = p.assignTo !== user.sub;
      const r = await col(TODOS).updateOne(
        { _id: p.todoId, tenantId: user.tenantId },
        { $set: { assignedTo: p.assignTo, status: pending ? "pending-accept" : "accepted", updatedAt: now } },
      );
      if (r.matchedCount === 0) throw Object.assign(new Error("Todo not found"), { code: "NOT_FOUND" });
      const e = env("evt.todo.assigned");
      await emit({ ...e, type: "evt.todo.assigned", payload: { todoId: p.todoId, assignTo: p.assignTo, pending } });
      return { ok: true, eventIds: [e._id] };
    }

    case "cmd.todo.accept": {
      const p = AcceptTodoCmd.parse(cmd).payload;
      const r = await col(TODOS).updateOne(
        { _id: p.todoId, tenantId: user.tenantId, assignedTo: user.sub, status: "pending-accept" },
        { $set: { status: "accepted", updatedAt: now } },
      );
      if (r.matchedCount === 0) throw Object.assign(new Error("Todo not pending for you"), { code: "NOT_FOUND" });
      const e = env("evt.todo.accepted");
      await emit({ ...e, type: "evt.todo.accepted", payload: { todoId: p.todoId, by: user.sub } });
      return { ok: true, eventIds: [e._id] };
    }

    case "cmd.todo.decline": {
      const p = DeclineTodoCmd.parse(cmd).payload;
      const r = await col(TODOS).updateOne(
        { _id: p.todoId, tenantId: user.tenantId, assignedTo: user.sub },
        { $set: { status: "declined", assignedTo: null, updatedAt: now } },
      );
      if (r.matchedCount === 0) throw Object.assign(new Error("Todo not assigned to you"), { code: "NOT_FOUND" });
      const e = env("evt.todo.declined");
      await emit({ ...e, type: "evt.todo.declined", payload: { todoId: p.todoId, by: user.sub, reason: p.reason ?? null } });
      return { ok: true, eventIds: [e._id] };
    }

    case "cmd.todo.complete": {
      const p = CompleteTodoCmd.parse(cmd).payload;
      const r = await col(TODOS).updateOne(
        { _id: p.todoId, tenantId: user.tenantId },
        { $set: { status: "done", completedAt: now, updatedAt: now } },
      );
      if (r.matchedCount === 0) throw Object.assign(new Error("Todo not found"), { code: "NOT_FOUND" });
      const e = env("evt.todo.completed");
      await emit({ ...e, type: "evt.todo.completed", payload: { todoId: p.todoId, by: user.sub } });
      return { ok: true, eventIds: [e._id] };
    }

    case "cmd.todo.cancel": {
      const p = CancelTodoCmd.parse(cmd).payload;
      const r = await col(TODOS).updateOne(
        { _id: p.todoId, tenantId: user.tenantId },
        { $set: { status: "cancelled", updatedAt: now } },
      );
      if (r.matchedCount === 0) throw Object.assign(new Error("Todo not found"), { code: "NOT_FOUND" });
      const e = env("evt.todo.cancelled");
      await emit({ ...e, type: "evt.todo.cancelled", payload: { todoId: p.todoId, by: user.sub } });
      return { ok: true, eventIds: [e._id] };
    }

    default:
      throw new Error(`Unhandled todo command: ${(cmd as { type: string }).type}`);
  }
}
