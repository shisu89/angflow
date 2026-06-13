/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Snapshot of AGENT_TOOL_SCHEMAS from @angflow/angular@0.3.6.
 * Regenerate with `npm run generate:schemas` (runs automatically in
 * `npm run build`). The drift test in test/schema-snapshot.spec.ts compares
 * this file against the workspace source.
 */
export interface AgentToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export const GENERATED_FROM_ANGULAR_VERSION = "0.3.6";

export const AGENT_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    "name": "list_flows",
    "description": "List the ids of every flow currently registered with the bridge.",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  {
    "name": "get_state",
    "description": "Return a full snapshot of a flow: { nodes, edges, viewport }. Use this whenever you need to see the current canvas before deciding what to change.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string",
          "description": "Flow id. Omit if exactly one flow is registered."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "get_nodes",
    "description": "Return all nodes on a flow.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "get_edges",
    "description": "Return all edges on a flow.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "get_node",
    "description": "Return a single node by id, or null if absent.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_edge",
    "description": "Return a single edge by id, or null if absent.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "add_node",
    "description": "Append a node to the flow. The node must include id, position { x, y }, and data. Optional: type, width, height, draggable, selectable, hidden, etc.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "node": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "type": {
              "type": "string"
            },
            "position": {
              "type": "object",
              "properties": {
                "x": {
                  "type": "number"
                },
                "y": {
                  "type": "number"
                }
              },
              "required": [
                "x",
                "y"
              ]
            },
            "data": {
              "type": "object"
            }
          },
          "required": [
            "id",
            "position",
            "data"
          ]
        }
      },
      "required": [
        "node"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "add_edge",
    "description": "Append an edge to the flow. The edge must include id, source (node id), and target (node id). Optional: type, sourceHandle, targetHandle, label, animated, data.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "edge": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "source": {
              "type": "string"
            },
            "target": {
              "type": "string"
            },
            "sourceHandle": {
              "type": [
                "string",
                "null"
              ]
            },
            "targetHandle": {
              "type": [
                "string",
                "null"
              ]
            },
            "type": {
              "type": "string"
            },
            "animated": {
              "type": "boolean"
            },
            "label": {
              "type": "string"
            },
            "data": {
              "type": "object"
            }
          },
          "required": [
            "id",
            "source",
            "target"
          ]
        }
      },
      "required": [
        "edge"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_node",
    "description": "Shallow-merge `patch` into the node with the given id. Use `patch.data` to update node data; use `patch.position` to move it. Other nodes are untouched.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "patch": {
          "type": "object"
        }
      },
      "required": [
        "id",
        "patch"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_edge",
    "description": "Shallow-merge `patch` into the edge with the given id.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "patch": {
          "type": "object"
        }
      },
      "required": [
        "id",
        "patch"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "delete_elements",
    "description": "Delete nodes and/or edges by id. Edges connected to deleted nodes are removed automatically. Returns { deletedNodes, deletedEdges }.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "nodeIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "edgeIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "set_nodes",
    "description": "Replace the entire nodes array. Prefer add_node / update_node / delete_elements for incremental edits.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "nodes": {
          "type": "array",
          "items": {
            "type": "object"
          }
        }
      },
      "required": [
        "nodes"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "set_edges",
    "description": "Replace the entire edges array. Prefer add_edge / update_edge / delete_elements for incremental edits.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "edges": {
          "type": "array",
          "items": {
            "type": "object"
          }
        }
      },
      "required": [
        "edges"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "fit_view",
    "description": "Zoom and pan so all (or the given) nodes are visible.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "padding": {
          "type": "number"
        },
        "duration": {
          "type": "number"
        },
        "nodeIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "minZoom": {
          "type": "number",
          "description": "Per-call min-zoom floor for this fit (overrides host minZoom). Returns { zoom, clamped } where clamped means the board could not be fully framed."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "set_viewport",
    "description": "Set the viewport to an absolute { x, y, zoom }.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "viewport": {
          "type": "object",
          "properties": {
            "x": {
              "type": "number"
            },
            "y": {
              "type": "number"
            },
            "zoom": {
              "type": "number"
            }
          },
          "required": [
            "x",
            "y",
            "zoom"
          ]
        },
        "duration": {
          "type": "number"
        }
      },
      "required": [
        "viewport"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_viewport",
    "description": "Return the current { x, y, zoom }.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "get_internal_node",
    "description": "Return computed internal data for a node: positionAbsolute (after parent transforms), measured size, and per-handle bounds. Returns null if the node does not exist. Slim, serializable view of the InternalNode.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_nodes_bounds",
    "description": "Return the axis-aligned bounding rect that contains the given nodes (or every node when nodeIds is omitted).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "nodeIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "get_intersecting_nodes",
    "description": "Return nodes whose bounding box intersects the given node's bounding box. When partially is false, only fully-contained nodes are returned.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "partially": {
          "type": "boolean"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "is_node_in_area",
    "description": "Whether the given node's bounding box intersects the rect. When partially is false, only full containment counts.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "area": {
          "type": "object",
          "properties": {
            "x": {
              "type": "number"
            },
            "y": {
              "type": "number"
            },
            "width": {
              "type": "number"
            },
            "height": {
              "type": "number"
            }
          },
          "required": [
            "x",
            "y",
            "width",
            "height"
          ]
        },
        "partially": {
          "type": "boolean"
        }
      },
      "required": [
        "id",
        "area"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_outgoers",
    "description": "Return nodes that have an incoming edge from the given node id.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_incomers",
    "description": "Return nodes that have an outgoing edge into the given node id.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_connected_edges",
    "description": "Return all edges that are incident to any of the given node ids (either end).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "nodeIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "nodeIds"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_node_connections",
    "description": "Return all HandleConnection objects for every handle on the given node.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "nodeId": {
          "type": "string"
        }
      },
      "required": [
        "nodeId"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_handle_connections",
    "description": "Return HandleConnections for a specific handle. Pass handleId to scope to a named handle, or omit to get every connection of that type on the node.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "nodeId": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "source",
            "target"
          ]
        },
        "handleId": {
          "type": "string"
        }
      },
      "required": [
        "nodeId",
        "type"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "get_handle_data",
    "description": "Look up user-attached data on a handle (registered via <ng-flow-handle [data]=\"...\">). Returns null if no data is attached.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "nodeId": {
          "type": "string"
        },
        "handleId": {
          "type": [
            "string",
            "null"
          ]
        },
        "type": {
          "type": "string",
          "enum": [
            "source",
            "target"
          ]
        }
      },
      "required": [
        "nodeId",
        "handleId",
        "type"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "screen_to_flow_position",
    "description": "Convert a viewport/client coordinate (e.g., MouseEvent.clientX/clientY) into a position in flow coordinates. Honors snapToGrid unless overridden.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "position": {
          "type": "object",
          "properties": {
            "x": {
              "type": "number"
            },
            "y": {
              "type": "number"
            }
          },
          "required": [
            "x",
            "y"
          ]
        },
        "snapToGrid": {
          "type": "boolean"
        }
      },
      "required": [
        "position"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "flow_to_screen_position",
    "description": "Inverse of screen_to_flow_position: convert a flow-space point to viewport/client coordinates.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "position": {
          "type": "object",
          "properties": {
            "x": {
              "type": "number"
            },
            "y": {
              "type": "number"
            }
          },
          "required": [
            "x",
            "y"
          ]
        }
      },
      "required": [
        "position"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "zoom_in",
    "description": "Zoom the viewport in by one step. Optionally animate over duration ms.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "duration": {
          "type": "number"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "zoom_out",
    "description": "Zoom the viewport out by one step. Optionally animate over duration ms.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "duration": {
          "type": "number"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "zoom_to",
    "description": "Set the viewport zoom to an absolute level (clamped to minZoom/maxZoom).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "level": {
          "type": "number"
        },
        "duration": {
          "type": "number"
        }
      },
      "required": [
        "level"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "set_center",
    "description": "Center the viewport on a flow-space coordinate. Optional zoom and animation duration.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        },
        "zoom": {
          "type": "number"
        },
        "duration": {
          "type": "number"
        }
      },
      "required": [
        "x",
        "y"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "fit_bounds",
    "description": "Fit the viewport to a specific Rect in flow coordinates.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "bounds": {
          "type": "object",
          "properties": {
            "x": {
              "type": "number"
            },
            "y": {
              "type": "number"
            },
            "width": {
              "type": "number"
            },
            "height": {
              "type": "number"
            }
          },
          "required": [
            "x",
            "y",
            "width",
            "height"
          ]
        },
        "padding": {
          "type": "number"
        },
        "duration": {
          "type": "number"
        },
        "minZoom": {
          "type": "number",
          "description": "Per-call min-zoom floor for this fit (overrides host minZoom). Returns { zoom, clamped }."
        }
      },
      "required": [
        "bounds"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "add_nodes",
    "description": "Append multiple nodes in a single call. Each node must include id, position, and data.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "nodes": {
          "type": "array",
          "items": {
            "type": "object"
          }
        }
      },
      "required": [
        "nodes"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "add_edges",
    "description": "Append multiple edges in a single call. Each edge must include id, source, and target.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "edges": {
          "type": "array",
          "items": {
            "type": "object"
          }
        }
      },
      "required": [
        "edges"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_node_data",
    "description": "Merge dataPatch into the named node's data object. Leaves other node fields untouched.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "dataPatch": {
          "type": "object"
        }
      },
      "required": [
        "id",
        "dataPatch"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "update_edge_data",
    "description": "Merge dataPatch into the named edge's data object.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "dataPatch": {
          "type": "object"
        }
      },
      "required": [
        "id",
        "dataPatch"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "select_nodes",
    "description": "Select the given node ids. additive=false (default) replaces the current selection; additive=true adds to it.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "nodeIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "additive": {
          "type": "boolean"
        }
      },
      "required": [
        "nodeIds"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "select_edges",
    "description": "Select the given edge ids. additive=false (default) replaces the current selection; additive=true adds to it.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "edgeIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "additive": {
          "type": "boolean"
        }
      },
      "required": [
        "edgeIds"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "deselect_all",
    "description": "Clear node and edge selection.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "apply_changes",
    "description": "Atomically apply a batch of mutating ops in a single reactivity cycle. On any error the entire batch is rolled back (snapshot of nodes/edges restored), and a JSON-RPC error returns with data.failedIndex pointing at the bad op. Use this to build/edit graphs in one round trip. Allowed ops: add_node, add_nodes, add_edge, add_edges, update_node, update_node_data, update_edge, update_edge_data, delete_elements, select_nodes, select_edges, deselect_all. Op shape mirrors the corresponding individual tool params, with an extra `op` field.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "ops": {
          "type": "array",
          "items": {
            "type": "object"
          }
        }
      },
      "required": [
        "ops"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "undo",
    "description": "Undo the last mutating tool call (or `steps` of them). Restores the snapshot taken before the mutation. No-op when there is nothing to undo. Returns { undone, canUndo, canRedo }.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "steps": {
          "type": "number"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "redo",
    "description": "Inverse of undo. Returns { redone, canUndo, canRedo }.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "steps": {
          "type": "number"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "history_status",
    "description": "Return { canUndo, canRedo, pastDepth, futureDepth } for the flow.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "clear_history",
    "description": "Drop both undo and redo stacks for the flow.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "list_node_types",
    "description": "List every node type name renderable on a flow, tagged with its source: \"builtin\" (shipped with the library), \"host\" (registered by the application — its expected data shape is app-specific), or \"template\" (a data-driven template created via register_node_template — introspect its spec with list_node_templates).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "list_edge_types",
    "description": "List every edge type name renderable on a flow, tagged \"builtin\" (shipped with the library) or \"host\" (registered by the application). Use before creating or updating edges to discover valid type values.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "register_node_template",
    "description": "Register (or overwrite) a data-driven node template under `name`. Nodes with `type === name` render as a card built from the spec. Strings support {{data.x}} interpolation against each node's `data` (dotted paths only — no expressions). Fails with -32602 if `name` is already a builtin or host-registered component type. Not undoable via the undo tool (templates are rendering config, not graph state).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "name": {
          "type": "string",
          "description": "Type name nodes will reference via node.type."
        },
        "spec": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "title": {
              "type": "string",
              "description": "Card title; supports {{data.x}}."
            },
            "icon": {
              "type": "string",
              "description": "Built-in icon name: database, server, queue, cloud, user, document, bolt, settings."
            },
            "accent": {
              "type": "string",
              "description": "CSS color for header/border accent."
            },
            "variant": {
              "type": "string",
              "enum": [
                "compact",
                "detailed"
              ]
            },
            "badges": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "text": {
                    "type": "string"
                  },
                  "color": {
                    "type": "string",
                    "enum": [
                      "slate",
                      "indigo",
                      "emerald",
                      "amber",
                      "rose"
                    ]
                  },
                  "showIf": {
                    "type": "string",
                    "description": "Dotted data path, e.g. \"data.env\"."
                  }
                },
                "required": [
                  "text"
                ]
              }
            },
            "fields": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "label": {
                    "type": "string"
                  },
                  "value": {
                    "type": "string",
                    "description": "Supports {{data.x}}."
                  },
                  "showIf": {
                    "type": "string"
                  }
                },
                "required": [
                  "label",
                  "value"
                ]
              }
            },
            "body": {
              "type": "string",
              "description": "Free body text; supports {{data.x}}."
            },
            "handles": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "type": {
                    "type": "string",
                    "enum": [
                      "source",
                      "target"
                    ]
                  },
                  "position": {
                    "type": "string",
                    "enum": [
                      "top",
                      "right",
                      "bottom",
                      "left"
                    ]
                  },
                  "id": {
                    "type": "string"
                  }
                },
                "required": [
                  "type"
                ]
              }
            }
          }
        }
      },
      "required": [
        "name",
        "spec"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "unregister_node_template",
    "description": "Remove a data-driven node template. Existing nodes of that type fall back to the default node renderer.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "name": {
          "type": "string"
        }
      },
      "required": [
        "name"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "list_node_templates",
    "description": "List every registered data-driven node template with its full spec.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "layout_nodes",
    "description": "Auto-layout nodes using the host-configured layout engine (typically dagre). Computes tidy positions for the whole graph (or the nodeIds subset and the edges among them), applies them in one undoable step, and fits the viewport unless fitView is false. Returns the applied positions plus a fit result ({ zoom, clamped } or null). Prefer this over computing coordinates manually whenever you add more than a couple of nodes. Group (parentId) nodes are laid out as compound clusters; results are applied in absolute coordinates, so grouped children stay inside their group.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "flowId": {
          "type": "string"
        },
        "direction": {
          "type": "string",
          "enum": [
            "TB",
            "LR",
            "BT",
            "RL"
          ],
          "description": "Rank direction: top-bottom (default), left-right, bottom-top, right-left."
        },
        "nodeIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Subset to lay out; omit to lay out all nodes."
        },
        "nodeSep": {
          "type": "number",
          "description": "Separation between nodes in the same rank (px)."
        },
        "rankSep": {
          "type": "number",
          "description": "Separation between ranks (px)."
        },
        "fitView": {
          "type": "boolean",
          "description": "Fit the viewport afterwards. Default true."
        },
        "minZoom": {
          "type": "number",
          "description": "Per-call min-zoom floor used for the post-layout fit. The result includes fit: { zoom, clamped } | null (null when fitView is false)."
        }
      },
      "additionalProperties": false
    }
  }
];
