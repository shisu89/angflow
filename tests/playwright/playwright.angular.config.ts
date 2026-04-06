import { defineConfig } from '@playwright/test';
import { sharedConfigWithPort } from './playwright.shared.config';
import path from 'path';

const config = sharedConfigWithPort({ port: 4201, framework: 'ng' });

// Override webServer cwd — pnpm --filter needs to run from the monorepo root
config.webServer = {
  ...config.webServer,
  command: 'pnpm --filter=angular-examples run dev --port 4201',
  cwd: path.resolve(__dirname, '../..'),
};

export default defineConfig(config);
