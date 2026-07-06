import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { NgFlowComponent } from './ng-flow.component';

function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[
    ɵSIGNAL as unknown as symbol
  ];
  node.applyValueToInputSignal(node, value);
}

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('NgFlowComponent autoPanOnNodeFocus input', () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to true and reaches the store signal', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.store.autoPanOnNodeFocus()).toBe(true);
  });

  it('round-trips false into the store signal', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    setSignalInput(inst, 'autoPanOnNodeFocus', false);
    fixture.detectChanges();
    expect(inst.store.autoPanOnNodeFocus()).toBe(false);
  });

  // Focusing a node outside the viewport (Tab nav / programmatic focus) makes the
  // browser scroll the wrapper to reveal it, dragging Panels/Controls off-screen.
  // onWrapperScroll undoes that scroll so only the CSS-transform pan moves things.
  it('resets wrapper scroll back to the origin on scroll', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    const scrollTo = vi.fn();
    const target = { scrollTo } as unknown as HTMLElement;
    inst.onWrapperScroll({ target } as unknown as Event);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });
});
