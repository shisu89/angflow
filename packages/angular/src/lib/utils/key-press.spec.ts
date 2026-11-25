import { describe, it, expect } from 'vitest';
import { KeyPressTracker, hasKeyCombination } from './key-press';

const ev = (type: 'keydown' | 'keyup', init: KeyboardEventInit) => new KeyboardEvent(type, init);

describe('KeyPressTracker', () => {
  it("'Meta+Backspace' matches Meta then Backspace, not Backspace alone", () => {
    const t = new KeyPressTracker('Meta+Backspace');
    expect(t.down(ev('keydown', { key: 'Backspace', code: 'Backspace' }))).toBe(false);
    t.reset();
    expect(t.down(ev('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true }))).toBe(false);
    expect(t.down(ev('keydown', { key: 'Backspace', code: 'Backspace', metaKey: true }))).toBe(true);
    expect(t.pressed).toBe(true);
  });

  it('matches either alternative of an array', () => {
    const t = new KeyPressTracker(['Backspace', 'Delete']);
    expect(t.down(ev('keydown', { key: 'Delete', code: 'Delete' }))).toBe(true);
    t.up(ev('keyup', { key: 'Delete', code: 'Delete' }));
    expect(t.pressed).toBe(false);
    expect(t.down(ev('keydown', { key: 'Backspace', code: 'Backspace' }))).toBe(true);
  });

  it("'Shift' does not match while another key is also held", () => {
    const t = new KeyPressTracker('Shift');
    t.down(ev('keydown', { key: 'a', code: 'KeyA' }));
    expect(t.down(ev('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true }))).toBe(false);
    expect(t.pressed).toBe(false);
  });

  it('a Meta keyup clears the held set', () => {
    const t = new KeyPressTracker('Meta+s');
    t.down(ev('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true }));
    t.down(ev('keydown', { key: 's', code: 'KeyS', metaKey: true }));
    expect(t.pressed).toBe(true);
    expect(t.up(ev('keyup', { key: 'Meta', code: 'MetaLeft' }))).toBe(true);
    expect(t.pressed).toBe(false);
    // set was cleared: 's' alone must not complete the combo
    expect(t.down(ev('keydown', { key: 's', code: 'KeyS' }))).toBe(false);
  });

  it("'+' matches the plus key", () => {
    const t = new KeyPressTracker('+');
    const t2 = new KeyPressTracker('+');
    expect(t2.down(ev('keydown', { key: '+', code: 'Equal' }))).toBe(true);
  });

  it("'Meta++' is the combination Meta and plus", () => {
    const t = new KeyPressTracker('Meta++');
    t.down(ev('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true }));
    expect(t.down(ev('keydown', { key: '+', code: 'Equal', metaKey: true }))).toBe(true);
  });

  it('matches code-based specs through event.code', () => {
    const t = new KeyPressTracker('KeyA');
    expect(t.down(ev('keydown', { key: 'å', code: 'KeyA' }))).toBe(true);
  });

  it('a null keyCode never matches', () => {
    const t = new KeyPressTracker(null);
    expect(t.down(ev('keydown', { key: 'a', code: 'KeyA' }))).toBe(false);
  });

  it('hasKeyCombination detects combos only', () => {
    expect(hasKeyCombination('Shift')).toBe(false);
    expect(hasKeyCombination('+')).toBe(false);
    expect(hasKeyCombination(['Backspace', 'Meta+Backspace'])).toBe(true);
    expect(hasKeyCombination(null)).toBe(false);
  });
});
