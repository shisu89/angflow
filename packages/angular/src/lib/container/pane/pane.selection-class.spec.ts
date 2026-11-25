import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { PaneComponent } from './pane.component';
import { FlowStore } from '../../services/flow-store.service';

describe('PaneComponent selection class (upstream isSelecting)', () => {
  function setup(inputs: { selectionOnDrag?: boolean; panOnDrag?: boolean | number[] } = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PaneComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    const fixture = TestBed.createComponent(PaneComponent);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    const store = TestBed.inject(FlowStore);
    fixture.detectChanges();
    const has = () => (fixture.nativeElement as HTMLElement).classList.contains('selection');
    return { fixture, store, has };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('is absent by default', () => {
    expect(setup().has()).toBe(false);
  });

  it('is present while the selection key is active', async () => {
    const { fixture, store, has } = setup();
    store.selectionKeyActive.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(has()).toBe(true);
  });

  it('is present while a marquee runs', async () => {
    const { fixture, store, has } = setup();
    store.userSelectionActive.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(has()).toBe(true);
  });

  it('is present with selectionOnDrag and panOnDrag [1, 2]', () => {
    expect(setup({ selectionOnDrag: true, panOnDrag: [1, 2] }).has()).toBe(true);
  });

  it('is absent with selectionOnDrag and panOnDrag true', () => {
    expect(setup({ selectionOnDrag: true, panOnDrag: true }).has()).toBe(false);
  });

  it('is absent with selectionOnDrag and panOnDrag [0, 1]', () => {
    expect(setup({ selectionOnDrag: true, panOnDrag: [0, 1] }).has()).toBe(false);
  });
});
