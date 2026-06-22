interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_AUTH_TOKEN_KEY?: string;
  readonly VITE_IMPACT_QUEUE_ENABLED?: string;
  readonly VITE_IMPACT_QUEUE_POLL_MS?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css?url" {
  const url: string;
  export default url;
}
