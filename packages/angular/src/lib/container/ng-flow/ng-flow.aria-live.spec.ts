import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NgFlowComponent } from './ng-flow.component';
import { FlowStore } from '../../services/flow-store.service';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('NgFlowComponent aria-live region', () => {
  let fixture: ComponentFixture<NgFlowComponent>;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NgFlowComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(NgFlowComponent);
  });

  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
  });

  it('has id ng-flow__aria-live-<rfId>', () => {
    fixture.detectChanges();
    const rfId = fixture.debugElement.injector.get(FlowStore).rfId();
    const el = fixture.nativeElement.querySelector('[aria-live]');
    expect(el?.id).toBe(`ng-flow__aria-live-${rfId}`);
  });

  it('is not rendered with disableKeyboardA11y', () => {
    fixture.componentRef.setInput('disableKeyboardA11y', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-live]')).toBeNull();
  });
});
