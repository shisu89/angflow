import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAgentBridge, provideAgentChat, WindowTransport, WebSocketTransport } from '@angflow/angular';
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
        // with backoff otherwise, so `ng serve` works fine without it. Localhost
        // origins are allowlisted by the server, so no token is needed in dev.
        // When the server runs with an explicit --token, pass it here:
        //   new WebSocketTransport({ url: 'ws://localhost:8765', token: 'mysecret' })
        new WebSocketTransport({ url: 'ws://localhost:8765', onError: () => {} }),
      ],
      layout: dagreLayout,
    }),
    provideAgentChat({
      complete: async (req) => {
        let res: Response;
        try {
          res = await fetch('http://localhost:8787/api/agent', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(req),
          });
        } catch {
          throw new Error(
            'Agent proxy unreachable. Start it with: ANTHROPIC_API_KEY=... node server/agent-proxy.mjs',
          );
        }
        if (!res.ok) {
          throw new Error(`Agent proxy responded ${res.status}: ${await res.text()}`);
        }
        return res.json();
      },
    }),
  ],
};
