import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();

function redactValue(value: unknown, key = ""): unknown {
  if (/password|secret|token|authorization|cookie|email|name|body|payload|form/i.test(key)) {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childValue, childKey),
      ]),
    );
  }
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
      .replace(/([?&](?:token|code|password|secret)=)[^&\s]+/gi, "$1[REDACTED]");
  }
  return value;
}

export function initializeSentry() {
  if (!sentryDsn) return;

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.VITE_APP_ENV || "production",
    release: import.meta.env.VITE_APP_RELEASE || "unknown",
    sendDefaultPii: false,
    tracesSampleRate: Math.max(0, Math.min(1, Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0))),
    beforeSend(event) {
      const sanitized = redactValue(event) as typeof event;
      sanitized.user = undefined;
      sanitized.request = undefined;
      return sanitized;
    },
  });
}

export function captureFrontendException(error: unknown, context: Record<string, unknown> = {}) {
  if (!sentryDsn) return;
  Sentry.captureException(error, {
    contexts: {
      application: redactValue(context) as Record<string, unknown>,
    },
  });
}
