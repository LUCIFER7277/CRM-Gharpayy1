/**
 * Central error reporting — console always; Sentry when VITE_SENTRY_DSN is set.
 * Install @sentry/react and set VITE_SENTRY_DSN in .env for production.
 */
type ErrorContext = Record<string, unknown>;

let sentryInitAttempted = false;

async function trySentryCapture(error: Error, context?: ErrorContext) {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn?.trim()) return;

  try {
    const Sentry = await import("@sentry/react");
    if (!sentryInitAttempted) {
      sentryInitAttempted = true;
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
      });
    }
    Sentry.captureException(error, { extra: context });
  } catch {
    // @sentry/react not installed — dev-only console is enough
  }
}

export function captureException(error: Error, context?: ErrorContext) {
  console.error("[Gharpayy]", error.message, context ?? {});
  void trySentryCapture(error, context);
}

export function captureBoundaryError(error: Error, componentStack?: string) {
  captureException(error, { source: "FeatureErrorBoundary", componentStack });
}
