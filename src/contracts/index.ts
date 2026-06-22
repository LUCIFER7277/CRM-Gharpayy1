// Shared contracts - single source of truth for events, commands, and entity shapes.
// Both frontend (this repo) and /server (your VPS Node API) import from here.
//
// Rule: NEVER mutate state outside a command. NEVER emit an event that isn't in the registry.

export * from "./ids.js";
export * from "./roles.js";
export * from "./entities.js";
export * from "./events.js";
export * from "./commands.js";
export * from "./errors.js";
