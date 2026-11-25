import { isInputDOMNode, type KeyCode } from '@angflow/system';

type Keys = string[];
type KeyOrCode = 'key' | 'code';

/**
 * Upstream `useKeyPress` semantics for one `KeyCode` input, without the React state.
 *
 * - A string is one key or a `+`-joined combination (`'Meta+Backspace'`, `'Meta++'`);
 *   an array is a list of alternatives.
 * - A spec entry matching `event.code` is compared by code, otherwise by `event.key`.
 * - On keydown, only definitions with exactly as many keys as are held can match.
 * - A Meta keyup clears the held set (macOS sends no keyup for other keys while Meta is held).
 */
export class KeyPressTracker {
  private readonly keyCodes: Keys[];
  private readonly keysToWatch: Keys;
  private readonly pressedKeys = new Set<string>();
  private _pressed = false;

  constructor(keyCode: KeyCode | null, private readonly actInsideInputWithModifier = true) {
    [this.keyCodes, this.keysToWatch] = getKeyCodes(keyCode);
  }

  get pressed(): boolean {
    return this._pressed;
  }

  /** Returns true when this keydown completes one of the combinations. */
  down(event: KeyboardEvent): boolean {
    if (this.keyCodes.length === 0) return false;
    const modifierPressed = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    const preventAction =
      (!modifierPressed || (modifierPressed && !this.actInsideInputWithModifier)) && isInputDOMNode(event);
    if (preventAction) return false;

    this.pressedKeys.add(event[getKeyOrCode(event.code, this.keysToWatch)]);

    if (isMatchingKey(this.keyCodes, this.pressedKeys, false)) {
      this._pressed = true;
      return true;
    }
    return false;
  }

  /** Returns true when the combination was held and this keyup releases it. */
  up(event: KeyboardEvent): boolean {
    if (this.keyCodes.length === 0) return false;
    let released = false;

    if (isMatchingKey(this.keyCodes, this.pressedKeys, true)) {
      released = this._pressed;
      this._pressed = false;
      this.pressedKeys.clear();
    } else {
      this.pressedKeys.delete(event[getKeyOrCode(event.code, this.keysToWatch)]);
    }

    // macOS: no keyup is delivered for other keys while Cmd is held.
    if (event.key === 'Meta') this.pressedKeys.clear();

    return released;
  }

  reset(): void {
    this.pressedKeys.clear();
    this._pressed = false;
  }
}

/** Whether any alternative in `keyCode` is a `+` combination (e.g. `'Meta+Backspace'`). */
export function hasKeyCombination(keyCode: KeyCode | null): boolean {
  return getKeyCodes(keyCode)[0].some((keys) => keys.length > 1);
}

function getKeyCodes(keyCode: KeyCode | null): [Keys[], Keys] {
  if (keyCode === null) return [[], []];
  const keyCodeArr = Array.isArray(keyCode) ? keyCode : [keyCode];
  const keys = keyCodeArr
    .filter((kc) => typeof kc === 'string')
    // '+' -> '\n', then '\n\n' -> '\n+' so 'key++' works; split on '\n'
    // a lone '+' is the plus key itself (upstream would yield ['', ''] and never match)
    .map((kc) => (kc === '+' ? ['+'] : kc.replace(/\+/g, '\n').replace('\n\n', '\n+').split('\n')));
  const keysFlat = keys.reduce((res: Keys, item) => res.concat(...item), []);
  return [keys, keysFlat];
}

function isMatchingKey(keyCodes: Keys[], pressedKeys: Set<string>, isUp: boolean): boolean {
  return keyCodes
    .filter((keys) => isUp || keys.length === pressedKeys.size)
    .some((keys) => keys.every((k) => pressedKeys.has(k)));
}

function getKeyOrCode(eventCode: string, keysToWatch: Keys): KeyOrCode {
  return keysToWatch.includes(eventCode) ? 'code' : 'key';
}
