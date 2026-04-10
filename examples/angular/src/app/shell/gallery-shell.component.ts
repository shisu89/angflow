import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-gallery-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <app-sidebar />
    <div class="gallery__content">
      <router-outlet />
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
    .gallery__content {
      flex: 1;
      min-width: 0;
      min-height: 0;
      padding: 20px;
      background: #f1f5f9;
      overflow: hidden;
      display: flex;
    }
  `],
})
export class GalleryShellComponent {}
