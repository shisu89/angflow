import type { AgentToolSchema } from './types';

/**
 * Canonical list of tools the agent bridge exposes. Pass this array straight
 * to an LLM tool-use API (Anthropic `tools`, OpenAI `tools`) or use it to
 * generate an MCP server.
 *
 * Every `name` here matches a method registered in `AngflowAgentBridge`.
 */
export const AGENT_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'list_flows',
    description: 'List the ids of every flow currently registered with the bridge.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_state',
    description:
      'Return a full snapshot of a flow: { nodes, edges, viewport }. ' +
      'Use this whenever you need to see the current canvas before deciding what to change.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow id. Omit if exactly one flow is registered.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_nodes',
    description: 'Return all nodes on a flow.',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_edges',
    description: 'Return all edges on a flow.',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_node',
    description: 'Return a single node by id, or null if absent.',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' }, id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_edge',
    description: 'Return a single edge by id, or null if absent.',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' }, id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_node',
    description:
      'Append a node to the flow. The node must include id, position { x, y }, and data. ' +
      'Optional: type, width, height, draggable, selectable, hidden, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        node: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            position: {
              type: 'object',
              properties: { x: { type: 'number' }, y: { type: 'number' } },
              required: ['x', 'y'],
            },
            data: { type: 'object' },
          },
          required: ['id', 'position', 'data'],
        },
      },
      required: ['node'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_edge',
    description:
      'Append an edge to the flow. The edge must include id, source (node id), and target (node id). ' +
      'Optional: type, sourceHandle, targetHandle, label, animated, data.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        edge: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            source: { type: 'string' },
            target: { type: 'string' },
            sourceHandle: { type: ['string', 'null'] },
            targetHandle: { type: ['string', 'null'] },
            type: { type: 'string' },
            animated: { type: 'boolean' },
            label: { type: 'string' },
            data: { type: 'object' },
          },
          required: ['id', 'source', 'target'],
        },
      },
      required: ['edge'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_node',
    description:
      'Shallow-merge `patch` into the node with the given id. Use `patch.data` to update node data; ' +
      'use `patch.position` to move it. Other nodes are untouched.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        id: { type: 'string' },
        patch: { type: 'object' },
      },
      required: ['id', 'patch'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_edge',
    description: 'Shallow-merge `patch` into the edge with the given id.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        id: { type: 'string' },
        patch: { type: 'object' },
      },
      required: ['id', 'patch'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_elements',
    description:
      'Delete nodes and/or edges by id. Edges connected to deleted nodes are removed automatically. ' +
      'Returns { deletedNodes, deletedEdges }.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        nodeIds: { type: 'array', items: { type: 'string' } },
        edgeIds: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'set_nodes',
    description: 'Replace the entire nodes array. Prefer add_node / update_node / delete_elements for incremental edits.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        nodes: { type: 'array', items: { type: 'object' } },
      },
      required: ['nodes'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_edges',
    description: 'Replace the entire edges array. Prefer add_edge / update_edge / delete_elements for incremental edits.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        edges: { type: 'array', items: { type: 'object' } },
      },
      required: ['edges'],
      additionalProperties: false,
    },
  },
  {
    name: 'fit_view',
    description: 'Zoom and pan so all (or the given) nodes are visible.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        padding: { type: 'number' },
        duration: { type: 'number' },
        nodeIds: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'set_viewport',
    description: 'Set the viewport to an absolute { x, y, zoom }.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        viewport: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            zoom: { type: 'number' },
          },
          required: ['x', 'y', 'zoom'],
        },
        duration: { type: 'number' },
      },
      required: ['viewport'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_viewport',
    description: 'Return the current { x, y, zoom }.',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' } },
      additionalProperties: false,
    },
  },
];
