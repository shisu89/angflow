import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAgentBridge, WindowTransport } from '@angflow/angular';
import { dagreLayout } from '@angflow/angular/layout';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideAgentBridge({
      transports: [new WindowTransport()],
      layout: dagreLayout,
    }),
  ],
};
