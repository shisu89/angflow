// upstream: examples/react/src/generic-tests/nodes/connection-updates.ts @ df53d20853b85a8f9d0c72ceb4bf85032e89a60d
import { ConnectionUpdatesNodeComponent } from './components/connection-updates-node.component';
export default {
  flowProps: {
    nodeTypes: { connectionUpdates: ConnectionUpdatesNodeComponent },
    nodes: [
      {
        id: 'probe',
        type: 'connectionUpdates',
        data: {},
        position: { x: 0, y: 0 },
        selectable: false,
        draggable: false,
        style: { pointerEvents: 'all' },
      },
      { id: 'a', data: {}, position: { x: 0, y: 150 } },
      { id: 'b', data: {}, position: { x: 200, y: 150 } },
      { id: 'c', data: {}, position: { x: 400, y: 150 } },
    ],
    edges: [{ id: 'ab', source: 'a', target: 'b' }],
  },
} satisfies FlowConfig;
