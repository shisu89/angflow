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

import { toOpenAiRequest, fromOpenAiResponse } from './agent-proxy-openai.mjs';

test('toOpenAiRequest: system, text, assistant tool_use, tool_result mapping', () => {
  const body = {
    system: 'be brief',
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'add a node' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'adding' },
          { type: 'tool_use', id: 'tu_1', name: 'add_node', input: { node: { id: 'n1' } } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tu_1', content: '{"id":"n1"}' },
          { type: 'tool_result', tool_use_id: 'tu_2', content: 'boom', is_error: true },
        ],
      },
    ],
    tools: [{ name: 'add_node', description: 'adds', input_schema: { type: 'object', properties: {} } }],
    max_tokens: 1024,
  };
  const req = toOpenAiRequest(body, 'gpt-5.2', 'https://api.openai.com/v1');

  assert.equal(req.model, 'gpt-5.2');
  assert.equal(req.max_completion_tokens, 1024); // openai.com → new param name
  assert.equal(req.messages[0].role, 'system');
  assert.equal(req.messages[0].content, 'be brief');
  assert.equal(req.messages[1].role, 'user');
  assert.equal(req.messages[1].content, 'add a node');
  assert.equal(req.messages[2].role, 'assistant');
  assert.equal(req.messages[2].content, 'adding');
  assert.deepEqual(req.messages[2].tool_calls, [
    { id: 'tu_1', type: 'function', function: { name: 'add_node', arguments: '{"node":{"id":"n1"}}' } },
  ]);
  assert.deepEqual(req.messages[3], { role: 'tool', tool_call_id: 'tu_1', content: '{"id":"n1"}' });
  assert.deepEqual(req.messages[4], { role: 'tool', tool_call_id: 'tu_2', content: '[tool error] boom' });
  assert.deepEqual(req.tools[0], {
    type: 'function',
    function: { name: 'add_node', description: 'adds', parameters: { type: 'object', properties: {} } },
  });
});

test('toOpenAiRequest: non-openai.com base URL uses legacy max_tokens (Ollama/gateways)', () => {
  const body = { system: 's', messages: [], tools: [], max_tokens: 512 };
  const req = toOpenAiRequest(body, 'qwen3', 'http://localhost:11434/v1');
  assert.equal(req.max_tokens, 512);
  assert.equal(req.max_completion_tokens, undefined);
});

test('fromOpenAiResponse: text + tool_calls + finish_reason map', () => {
  const out = fromOpenAiResponse({
    choices: [{
      message: {
        content: 'on it',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_state', arguments: '{}' } }],
      },
      finish_reason: 'tool_calls',
    }],
  });
  assert.deepEqual(out.content[0], { type: 'text', text: 'on it' });
  assert.deepEqual(out.content[1], { type: 'tool_use', id: 'call_1', name: 'get_state', input: {} });
  assert.equal(out.stop_reason, 'tool_use');
});

test('fromOpenAiResponse: defensive parse of malformed arguments JSON', () => {
  const out = fromOpenAiResponse({
    choices: [{
      message: { content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'x', arguments: '{oops' } }] },
      finish_reason: 'tool_calls',
    }],
  });
  assert.deepEqual(out.content[0].input, {});
});

test('fromOpenAiResponse: stop and length map; unknown passes through', () => {
  const mk = (finish_reason) =>
    fromOpenAiResponse({ choices: [{ message: { content: 'x' }, finish_reason }] }).stop_reason;
  assert.equal(mk('stop'), 'end_turn');
  assert.equal(mk('length'), 'max_tokens');
  assert.equal(mk('content_filter'), 'content_filter');
});

import { cleanSchema, createGeminiTranslator } from './agent-proxy-gemini.mjs';

test('cleanSchema strips additionalProperties and $schema at every depth', () => {
  const cleaned = cleanSchema({
    type: 'object',
    additionalProperties: false,
    $schema: 'x',
    properties: {
      node: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      list: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  });
  assert.equal(JSON.stringify(cleaned).includes('additionalProperties'), false);
  assert.equal(JSON.stringify(cleaned).includes('$schema'), false);
  // Everything else preserved.
  assert.deepEqual(cleaned.properties.node.required, ['id']);
  assert.equal(cleaned.properties.list.items.type, 'object');
});

test('gemini round trip: ids synthesized on response, mapped back on next request', () => {
  const tr = createGeminiTranslator();

  // Model replies with two function calls (no ids — Gemini has none).
  const out = tr.fromGeminiResponse({
    candidates: [{
      content: {
        parts: [
          { text: 'working' },
          { functionCall: { name: 'add_node', args: { node: { id: 'n1' } } } },
          { functionCall: { name: 'layout_nodes', args: {} } },
        ],
      },
      finishReason: 'STOP',
    }],
  });
  assert.deepEqual(out.content[0], { type: 'text', text: 'working' });
  assert.equal(out.content[1].type, 'tool_use');
  assert.equal(out.content[1].name, 'add_node');
  assert.match(out.content[1].id, /^gemini-call-\d+$/);
  assert.notEqual(out.content[1].id, out.content[2].id);
  assert.equal(out.stop_reason, 'tool_use'); // functionCall parts present → tool_use

  // The harness sends back tool_results with those synthesized ids; the next
  // request must translate them to functionResponse parts matched by name.
  const req = tr.toGeminiRequest({
    system: 'be brief',
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'go' }] },
      { role: 'assistant', content: out.content },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: out.content[1].id, content: '{"id":"n1"}' },
          { type: 'tool_result', tool_use_id: out.content[2].id, content: 'fail', is_error: true },
        ],
      },
    ],
    tools: [{ name: 'add_node', description: 'adds', input_schema: { type: 'object', properties: {}, additionalProperties: false } }],
    max_tokens: 777,
  }, 'gemini-3.5-flash');

  assert.equal(req.systemInstruction.parts[0].text, 'be brief');
  assert.equal(req.generationConfig.maxOutputTokens, 777);
  assert.equal(req.contents[0].role, 'user');
  assert.equal(req.contents[1].role, 'model');
  assert.deepEqual(req.contents[1].parts[1], { functionCall: { name: 'add_node', args: { node: { id: 'n1' } } } });
  const responses = req.contents[2].parts;
  assert.deepEqual(responses[0], { functionResponse: { name: 'add_node', response: { result: '{"id":"n1"}' } } });
  assert.deepEqual(responses[1], { functionResponse: { name: 'layout_nodes', response: { result: '[tool error] fail' } } });
  // Schema cleaning applied to tools.
  assert.equal(JSON.stringify(req.tools).includes('additionalProperties'), false);
});

test('gemini stop_reason: MAX_TOKENS maps; plain text is end_turn', () => {
  const tr = createGeminiTranslator();
  const maxed = tr.fromGeminiResponse({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }] });
  assert.equal(maxed.stop_reason, 'max_tokens');
  const plain = tr.fromGeminiResponse({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }] });
  assert.equal(plain.stop_reason, 'end_turn');
});
