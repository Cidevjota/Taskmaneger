/// <reference types="vite/client" />

// Injected by vite.config.ts at build time — commit hash + build timestamp,
// used by src/lib/versionCheck.ts to detect when a new deploy has shipped.
declare const __APP_VERSION__: string;
