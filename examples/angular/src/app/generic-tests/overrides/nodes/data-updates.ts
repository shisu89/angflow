// upstream: examples/react/src/generic-tests/nodes/data-updates.ts @ e9e75cb476fe4e320a6df5ef8aa191e6f2a4b54f
import { NodesDataUpdatesNodeComponent } from './components/nodes-data-updates-node.component';
export default {
  flowProps: {
    nodeTypes: { dataUpdates: NodesDataUpdatesNodeComponent },
    nodes: [
      {
        id: 'probe',
        type: 'dataUpdates',
        data: {},
        position: { x: 0, y: 0 },
        selectable: false,
        draggable: false,
        style: { pointerEvents: 'all' },
      },
      { id: 'a', data: { value: 'initial' }, position: { x: 0, y: 150 } },
      { id: 'b', data: {}, position: { x: 200, y: 150 } },
    ],
    edges: [],
  },
} satisfies FlowConfig;
