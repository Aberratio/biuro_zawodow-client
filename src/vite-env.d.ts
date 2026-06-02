/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_SMARTLOOK_ENABLED?: string;
  readonly VITE_SMARTLOOK_PROJECT_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
