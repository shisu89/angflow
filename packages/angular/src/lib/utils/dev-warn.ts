import { isDevMode } from '@angular/core';
import type { OnError } from '@angflow/system';

/**
 * Warn-once diagnostic sink, and the default value of `FlowStore.onError`.
 *
 * Replaces `@angflow/system`'s `devWarn`, which gates on
 * `process.env.NODE_ENV === 'development'`. Angular's `@angular/build:application`
 * (esbuild) never defines `process.env.NODE_ENV` for browser bundles and nothing
 * polyfills it, so `globalThis.process` is undefined at runtime and that check is
 * permanently false — system's `devWarn` has never logged for an Angular consumer
 * in either dev or prod. `isDevMode()` is the Angular-native equivalent that
 * actually works.
 *
 * The dedupe key is `id::message`, NOT `id`: two different unknown node types are
 * both `error003`, and keying on the code alone would silence every typo after the
 * first. Callers on a per-render path must still dedupe locally — this cache only
 * guarantees the console is not spammed, not that the work is skipped.
 */
const seen = new Set<string>();

export const ngDevWarn: OnError = (id: string, message: string): void => {
  const key = `${id}::${message}`;
  if (!isDevMode() || seen.has(key)) return;
  seen.add(key);
  console.warn(`[angflow]: ${message} Help: https://reactflow.dev/error#${id}`);
};

/**
 * Test-only. The dedupe cache is module-scoped so it survives a page's lifetime,
 * which also means it outlives a TestBed — call this in `beforeEach` or the
 * second test asserting the same warning will see nothing.
 */
export const resetDevWarnDedupe = (): void => {
  seen.clear();
};
