/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_STAGING_GATE_PASSWORD?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_SMARTLOOK_ENABLED?: string;
  readonly VITE_SMARTLOOK_PROJECT_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  readonly VITE_APP_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
