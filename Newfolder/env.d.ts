/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

interface ImportMetaEnv {
  readonly SHOPIFY_APP_URL: string;
  readonly SHOPIFY_API_KEY: string;
  readonly SHOPIFY_API_SECRET: string;
  readonly SCOPES: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly APP_BACKEND_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
