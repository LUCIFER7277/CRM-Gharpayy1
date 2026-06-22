/**
 * Wave 2 - public surface. Single import for consumers.
 *
 * Twelve modules:
 *   1. timing            - IST quiet-hours, business windows, send-decisions
 *   2. notif-bus         - unified priority/channel notification store
 *   3. todo-engine       - buckets, smart sort, focus mode, day-planner
 *   4. distance-plus     - cost, ETA bands, PG clustering, tour route, verdicts
 *   5. supply-rank       - fit-score across distance/budget/audience + WA pitch
 *   6. sla-watcher       - background SLA scanner that pushes notifications
 *   7. keyboard          - central hotkey registry
 *   8. audit             - local command audit trail + inverse helper
 *   9. search-index      - in-memory trigram search for instant filtering
 *  10. insights          - funnel, conversion, stage-age, source ROI, heatmap
 *  11. wa-templates      - multi-lang WA templates with quiet-hours guard
 *  12. (re-exported)     - ergonomic top-level surface for app shells & UI
 */
export * from "./timing";
export * from "./notif-bus";
export * from "./todo-engine";
export * from "./distance-plus";
export * from "./supply-rank";
export * from "./sla-watcher";
export * from "./keyboard";
export * from "./audit";
export * from "./search-index";
export * from "./insights";
export * from "./wa-templates";
