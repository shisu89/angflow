# @angflow/mcp

## Unreleased

- MCP resources: `angflow://flows/{id}/summary` and `.../state` per registered flow,
  read live, with `list_changed` notifications and throttled `resources/updated` for
  subscribers (fires on user edits too).
- Tool annotations: `readOnlyHint` / `destructiveHint` / `idempotentHint` on every tool,
  so clients can auto-approve reads and confirm destructive calls.
- `build` now *checks* the schema snapshot instead of regenerating it, so a stale
  snapshot fails CI (previously the drift test could never fail). The version stamp
  is ignored by the check.
- The session mirror no longer retains every `flow.state` payload (whole graphs).
- Clear stderr warning when a canvas frame exceeds the size cap (close 1009).
- Timeout errors say the call may still complete on the canvas.
- CLI: unknown flags print a one-line error instead of a stack; `--token=<x>` is
  detected by the `--token`/`--no-token` conflict check.
- Request frames now carry `source: 'agent:mcp'` so the canvas's `canMutate`
  guard, op-log and `flow.history` events can identify MCP-agent edits.
- A port already in use (e.g. a second MCP client session) now prints an
  actionable error instead of crashing with an unhandled rejection.
- The server shuts down when its client closes stdin, instead of lingering and
  holding the canvas port.
- README: the ephemeral-token mode does not stop local non-browser processes
  (they can send an allowlisted `Origin`); documented, with `--token` as the fix.

## 0.0.1

Initial release: MCP server exposing a live angflow canvas over the
agent-bridge WebSocket transport. For history, see
`git log --oneline -- packages/mcp`. Future releases append entries here.
