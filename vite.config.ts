import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function getAppVersion(): string {
  let commit = 'dev';
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    // No git available (e.g. some CI checkouts) — fall back below.
  }
  return `${commit}-${Date.now()}`;
}

export default defineConfig(({ command }) => {
  const appVersion = getAppVersion();

  // Written into public/ so `vite build` copies it into dist/version.json as
  // a static asset — the running app polls this file to detect a new deploy.
  // Only on `build`: writing it during `vite dev` would dirty the tracked
  // public/ folder on every dev server start for no benefit.
  if (command === 'build') {
    fs.writeFileSync(
      path.resolve(__dirname, 'public/version.json'),
      JSON.stringify({ version: appVersion })
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
