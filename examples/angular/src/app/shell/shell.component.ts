import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="shell__header">
      <div class="shell__brand">@angflow/angular examples</div>
      <nav class="shell__nav">
        <a routerLink="/gallery" routerLinkActive="is-active">Gallery</a>
        <a routerLink="/showcase" routerLinkActive="is-active">Showcase</a>
        <a routerLink="/kitchen-sink" routerLinkActive="is-active">Kitchen Sink</a>
      </nav>
    </header>
    <main class="shell__main">
      <router-outlet />
    </main>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
    }
    .shell__header {
      display: flex;
      align-items: center;
      gap: 32px;
      padding: 0 20px;
      height: 52px;
      background: #0f172a;
      color: #e2e8f0;
      border-bottom: 1px solid #1e293b;
      flex-shrink: 0;
    }
    .shell__brand {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.02em;
    }
    .shell__nav {
      display: flex;
      gap: 4px;
    }
    .shell__nav a {
      padding: 6px 14px;
      border-radius: 6px;
      color: #cbd5e1;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }
    .shell__nav a:hover {
      background: #1e293b;
      color: #ffffff;
    }
    .shell__nav a.is-active {
      background: #6366f1;
      color: #ffffff;
    }
    .shell__main {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
    }
  `],
})
export class ShellComponent {}
