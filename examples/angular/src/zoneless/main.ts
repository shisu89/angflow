import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { ZonelessAppComponent } from './zoneless-app';

bootstrapApplication(ZonelessAppComponent, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
  ],
}).catch((err) => console.error(err));
