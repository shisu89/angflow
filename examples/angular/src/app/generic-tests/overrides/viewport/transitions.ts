// upstream: examples/react/src/generic-tests/viewport/transitions.ts @ 1334c75e0fd69cba98dbc4596ed8b8a10fe94e70
import { ViewportTransitionsNodeComponent as ViewportTransitionsNode } from './components/viewport-transitions-node.component';

export default {
  flowProps: {
    fitView: true,
    nodeTypes: {
      ViewportTransitionsNode,
    },
    nodes: [
      {
        id: 'transitions',
        type: 'ViewportTransitionsNode',
        data: {},
        position: { x: 0, y: 0 },
      },
      {
        id: 'target',
        data: { label: 'target' },
        position: { x: 1500, y: 1000 },
      },
    ],
    edges: [],
  },
} satisfies FlowConfig;
