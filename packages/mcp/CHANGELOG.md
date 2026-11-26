# @angflow/mcp

## 0.1.0 *(unreleased)*

### Breaking changes

- `get_handle_connections` removed; use `get_node_connections { nodeId, type?, handleId? }`.
- `fit_view` / `fit_bounds` `padding`: a number is pixels, strings `'10%'` / `'20px'` are accepted, default `'5%'`; other values are `-32602`.

Tool snapshot regenerated from @angflow/angular 0.4.0 (`fit_view` / `fit_bounds` /
`set_viewport` / `delete_elements` / `apply_changes` descriptions).


## 0.0.1

Initial release: MCP server exposing a live angflow canvas over the
agent-bridge WebSocket transport. For history, see
`git log --oneline -- packages/mcp`. Future releases append entries here.
