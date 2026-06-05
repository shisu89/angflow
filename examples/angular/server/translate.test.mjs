import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModel } from './agent-proxy.mjs';

test('resolveModel: header ignored when allowlist unset', () => {
  assert.equal(resolveModel('gpt-5.2', undefined, 'default-model'), 'default-model');
  assert.equal(resolveModel('gpt-5.2', '', 'default-model'), 'default-model');
});

test('resolveModel: allowlisted header honored', () => {
  assert.equal(resolveModel('claude-opus-4-8', 'claude-sonnet-4-6, claude-opus-4-8', 'claude-sonnet-4-6'), 'claude-opus-4-8');
});

test('resolveModel: non-allowlisted header falls back to default', () => {
  assert.equal(resolveModel('expensive-model', 'claude-sonnet-4-6', 'claude-sonnet-4-6'), 'claude-sonnet-4-6');
});

test('resolveModel: missing header uses default', () => {
  assert.equal(resolveModel(undefined, 'claude-sonnet-4-6', 'claude-sonnet-4-6'), 'claude-sonnet-4-6');
});
