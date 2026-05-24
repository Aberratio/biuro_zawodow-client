/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_MOUSEFLOW_PROJECT_ID?: string;
  readonly VITE_MOUSEFLOW_ENABLED?: string;
  readonly VITE_LEGAL_ADMIN_NAME?: string;
  readonly VITE_LEGAL_ADMIN_ADDRESS?: string;
  readonly VITE_LEGAL_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
