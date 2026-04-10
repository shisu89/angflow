import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface GalleryEntry {
  slug: string;
  title: string;
}

interface GalleryGroup {
  label: string;
  entries: GalleryEntry[];
}

export const GALLERY_GROUPS: GalleryGroup[] = [
  {
    label: 'Basics',
    entries: [
      { slug: 'overview', title: 'Overview' },
      { slug: 'save-restore', title: 'Save & Restore' },
    ],
  },
  {
    label: 'Customization',
    entries: [
      { slug: 'custom-node', title: 'Custom Node' },
      { slug: 'custom-edge', title: 'Custom Edge' },
      { slug: 'edge-types', title: 'Edge Types' },
      { slug: 'floating-edges', title: 'Floating Edges' },
    ],
  },
  {
    label: 'Interaction',
    entries: [
      { slug: 'connection-validation', title: 'Connection Validation' },
      { slug: 'drag-from-sidebar', title: 'Drag from Sidebar' },
    ],
  },
  {
    label: 'Layout',
    entries: [
      { slug: 'sub-flows', title: 'Sub-flows' },
      { slug: 'node-resizer', title: 'Node Resizer' },
    ],
  },
  {
    label: 'Plugins',
    entries: [
      { slug: 'minimap-custom', title: 'MiniMap (custom)' },
      { slug: 'backgrounds-variants', title: 'Backgrounds' },
      { slug: 'node-toolbar', title: 'Node Toolbar' },
      { slug: 'edge-toolbar', title: 'Edge Toolbar' },
    ],
  },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar">
      @for (group of groups; track group.label) {
        <div class="sidebar__group">
          <div class="sidebar__group-label">{{ group.label }}</div>
          @for (entry of group.entries; track entry.slug) {
            <a
              class="sidebar__entry"
              [routerLink]="['/gallery', entry.slug]"
              routerLinkActive="is-active"
            >
              {{ entry.title }}
            </a>
          }
        </div>
      }
    </nav>
  `,
  styles: [`
    .sidebar {
      width: 220px;
      flex-shrink: 0;
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
      padding: 16px 8px;
      overflow-y: auto;
    }
    .sidebar__group {
      margin-bottom: 18px;
    }
    .sidebar__group-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      padding: 0 12px 6px;
    }
    .sidebar__entry {
      display: block;
      padding: 6px 12px;
      margin: 1px 0;
      border-radius: 5px;
      color: #334155;
      text-decoration: none;
      font-size: 13px;
      transition: background 0.1s, color 0.1s;
    }
    .sidebar__entry:hover {
      background: #f1f5f9;
    }
    .sidebar__entry.is-active {
      background: #eef2ff;
      color: #4338ca;
      font-weight: 600;
    }
  `],
})
export class SidebarComponent {
  readonly groups = GALLERY_GROUPS;
}
