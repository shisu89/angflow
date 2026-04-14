/**
 * AfHandleGroup / AfHandleRow layout helpers.
 *
 * jsdom does not compute CSS layout, so we cannot assert on actual
 * y-coordinates of stacked rows. Instead we verify structural and
 * attribute/class behaviour: position class toggles, label projection,
 * gap inline-style pass-through.
 *
 * Angular's JIT compiler (used in Vitest) does not populate ɵcmp.inputs
 * from signal-based input() declarations. We drive inputs via the internal
 * ɵSIGNAL node, matching the pattern used in handle.component.spec.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { AfHandleGroupComponent } from './handle-group.component';
import { AfHandleRowComponent } from './handle-row.component';

function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

describe('AfHandleGroupComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AfHandleGroupComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('applies the left modifier class when position is "left"', () => {
    const fixture = TestBed.createComponent(AfHandleGroupComponent);
    setSignalInput(fixture.componentInstance, 'position', 'left');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.classList.contains('af-handle-group')).toBe(true);
    expect(host.classList.contains('af-handle-group--left')).toBe(true);
    expect(host.classList.contains('af-handle-group--right')).toBe(false);
  });

  it('applies the right modifier class when position is "right"', () => {
    const fixture = TestBed.createComponent(AfHandleGroupComponent);
    setSignalInput(fixture.componentInstance, 'position', 'right');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.classList.contains('af-handle-group--right')).toBe(true);
    expect(host.classList.contains('af-handle-group--left')).toBe(false);
  });

  it('defaults to left position when no input provided', () => {
    const fixture = TestBed.createComponent(AfHandleGroupComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.classList.contains('af-handle-group--left')).toBe(true);
  });

  it('reflects the gap input as an inline style', () => {
    const fixture = TestBed.createComponent(AfHandleGroupComponent);
    setSignalInput(fixture.componentInstance, 'gap', 16);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.style.gap).toBe('16px');
  });
});

describe('AfHandleRowComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AfHandleRowComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('renders the label text when label input is provided', () => {
    const fixture = TestBed.createComponent(AfHandleRowComponent);
    setSignalInput(fixture.componentInstance, 'label', 'input A');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('input A');
    expect(host.querySelector('.af-handle-row__label')?.textContent).toBe('input A');
  });

  it('does not render the label element when label is empty', () => {
    const fixture = TestBed.createComponent(AfHandleRowComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.af-handle-row__label')).toBeNull();
  });
});
