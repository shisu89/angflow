import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAgentBridge, WindowTransport, WebSocketTransport } from '@angflow/angular';
import { dagreLayout } from '@angflow/angular/layout';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideAgentBridge({
      transports: [
        new WindowTransport(),
        // Dials the @angflow/mcp server when one is running; silently retries
        // with backoff otherwise, so `ng serve` works fine without it.
        new WebSocketTransport({ url: 'ws://localhost:8765', onError: () => {} }),
      ],
      layout: dagreLayout,
    }),
  ],
};
