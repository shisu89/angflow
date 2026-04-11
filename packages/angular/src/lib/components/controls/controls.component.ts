import { Component, ChangeDetectionStrategy, input, output, inject, computed } from '@angular/core';
import type { PanelPosition, FitViewOptionsBase } from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';
import { PanelComponent } from '../panel/panel.component';

@Component({
  selector: 'ng-flow-controls',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-panel [position]="position()">
      <div
        class="ng-flow__controls xy-flow__controls"
        [class.horizontal]="orientation() === 'horizontal'"
        [attr.aria-label]="ariaLabel()"
      >
        @if (showZoom()) {
          <button
            type="button"
            class="ng-flow__controls-button xy-flow__controls-button"
            title="zoom in"
            aria-label="zoom in"
            [disabled]="maxZoomReached()"
            (click)="onZoomIn()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z"/></svg>
          </button>
          <button
            type="button"
            class="ng-flow__controls-button xy-flow__controls-button"
            title="zoom out"
            aria-label="zoom out"
            [disabled]="minZoomReached()"
            (click)="onZoomOut()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M0 13.867h32v4.266H0z"/></svg>
          </button>
        }
        @if (showFitView()) {
          <button
            type="button"
            class="ng-flow__controls-button xy-flow__controls-button"
            title="fit view"
            aria-label="fit view"
            (click)="onFitView()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94a.919.919 0 01-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z"/></svg>
          </button>
        }
        @if (showInteractive()) {
          <button
            type="button"
            class="ng-flow__controls-button xy-flow__controls-button"
            title="toggle interactivity"
            aria-label="toggle interactivity"
            [attr.aria-pressed]="isLocked()"
            (click)="onToggleLock()"
          >
            @if (isLocked()) {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32" aria-hidden="true"><path d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z"/></svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32" aria-hidden="true"><path d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z"/></svg>
            }
          </button>
        }
        <ng-content />
      </div>
    </ng-flow-panel>
  `,
})
export class ControlsComponent {
  private store = inject(FlowStore);
  private ngFlowService = inject(NgFlowService);

  readonly position = input<PanelPosition>('bottom-left');
  readonly showZoom = input(true);
  readonly showFitView = input(true);
  readonly showInteractive = input(true);
  readonly fitViewOptions = input<FitViewOptionsBase<any>>();
  readonly orientation = input<'horizontal' | 'vertical'>('vertical');
  readonly ariaLabel = input<string>('Angular Flow controls');

  // Callback outputs
  readonly zoomInClick = output<void>();
  readonly zoomOutClick = output<void>();
  readonly fitViewClick = output<void>();
  readonly interactiveChange = output<boolean>();

  // Derive interactive/locked state directly from the store so external
  // mutations of nodesDraggable/nodesConnectable/elementsSelectable stay
  // in sync with the lock icon. Mirrors React Flow's Controls selector.
  readonly isInteractive = computed(
    () =>
      this.store.nodesDraggable() ||
      this.store.nodesConnectable() ||
      this.store.elementsSelectable()
  );
  readonly isLocked = computed(() => !this.isInteractive());

  // Disable zoom buttons at min/max extent, matching React Flow's behaviour.
  readonly maxZoomReached = computed(() => this.store.transform()[2] >= this.store.maxZoom());
  readonly minZoomReached = computed(() => this.store.transform()[2] <= this.store.minZoom());

  onZoomIn() {
    this.ngFlowService.zoomIn();
    this.zoomInClick.emit();
  }

  onZoomOut() {
    this.ngFlowService.zoomOut();
    this.zoomOutClick.emit();
  }

  onFitView() {
    this.ngFlowService.fitView(this.fitViewOptions());
    this.fitViewClick.emit();
  }

  onToggleLock() {
    const nextInteractive = !this.isInteractive();
    this.store.nodesDraggable.set(nextInteractive);
    this.store.nodesConnectable.set(nextInteractive);
    this.store.elementsSelectable.set(nextInteractive);
    this.interactiveChange.emit(nextInteractive);
  }
}
