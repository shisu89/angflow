import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="cs">
      <h1 class="cs__title">Under construction</h1>
      <p class="cs__body">
        This section is not yet implemented. It will land in a later OpenSpec change.
      </p>
      <a class="cs__link" routerLink="/gallery">Back to the gallery</a>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      background: #f1f5f9;
    }
    .cs {
      text-align: center;
      max-width: 420px;
      padding: 40px;
    }
    .cs__title {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
    }
    .cs__body {
      margin: 0 0 20px;
      font-size: 14px;
      color: #64748b;
      line-height: 1.55;
    }
    .cs__link {
      display: inline-block;
      padding: 8px 16px;
      background: #6366f1;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.15s;
    }
    .cs__link:hover {
      background: #4f46e5;
    }
  `],
})
export class ComingSoonComponent {}
