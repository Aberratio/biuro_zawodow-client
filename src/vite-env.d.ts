/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_MOUSEFLOW_PROJECT_ID?: string;
  readonly VITE_MOUSEFLOW_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
