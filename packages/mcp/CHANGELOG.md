# @angflow/mcp

## Unreleased

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
