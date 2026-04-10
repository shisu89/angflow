import type { Node, Edge } from '@angflow/angular';

/**
 * The kitchen-sink seed graph. Chosen to exercise breadth:
 *  - default input/output node types
 *  - a container (group) parent with two child nodes constrained to it
 *  - a "rich" custom node (form UI + resizer + toolbar)
 *  - one edge of each built-in type (bezier / straight / step / smoothstep / simplebezier)
 *  - at least one animated edge
 */
export function seedNodes(): Node[] {
  return [
    {
      id: 'src',
      type: 'input',
      position: { x: 40, y: 40 },
      data: { label: 'Input' },
    },
    {
      id: 'rich',
      type: 'ksRich',
      position: { x: 280, y: 40 },
      data: {
        label: 'Rich node',
        name: 'user',
        count: 3,
        // Kept in sync with settings.showNodeToolbar / showNodeResizer by the
        // reactive effect in KitchenSinkComponent.
        _showToolbar: true,
        _showResizer: true,
      },
      style: { width: '220px', height: '180px' },
    },
    {
      id: 'group',
      type: 'group',
      position: { x: 40, y: 260 },
      data: {},
      style: {
        width: '320px',
        height: '180px',
        background: 'rgba(99, 102, 241, 0.06)',
        border: '2px dashed #6366f1',
        borderRadius: '12px',
      },
    },
    {
      id: 'child-1',
      position: { x: 24, y: 60 },
      data: { label: 'Child 1' },
      parentId: 'group',
      extent: 'parent',
    },
    {
      id: 'child-2',
      position: { x: 170, y: 100 },
      data: { label: 'Child 2' },
      parentId: 'group',
      extent: 'parent',
    },
    {
      id: 'plain-a',
      position: { x: 560, y: 60 },
      data: { label: 'Default A' },
    },
    {
      id: 'plain-b',
      position: { x: 560, y: 200 },
      data: { label: 'Default B' },
    },
    {
      id: 'plain-c',
      position: { x: 780, y: 130 },
      data: { label: 'Default C' },
    },
    {
      id: 'sink',
      type: 'output',
      position: { x: 1000, y: 130 },
      data: { label: 'Output' },
    },
  ];
}

export function seedEdges(): Edge[] {
  return [
    // Bezier (default)
    { id: 'e-src-rich', source: 'src', target: 'rich', type: 'bezier', animated: true },
    // Straight
    { id: 'e-rich-plainA', source: 'rich', target: 'plain-a', type: 'straight' },
    // Step
    { id: 'e-src-group', source: 'src', target: 'child-1', type: 'step' },
    // SmoothStep
    { id: 'e-child2-plainB', source: 'child-2', target: 'plain-b', type: 'smoothstep' },
    // SimpleBezier
    { id: 'e-plainA-plainC', source: 'plain-a', target: 'plain-c', type: 'simplebezier' },
    { id: 'e-plainB-plainC', source: 'plain-b', target: 'plain-c', type: 'bezier' },
    // The edge that gets the EdgeToolbar demo
    { id: 'e-plainC-sink', source: 'plain-c', target: 'sink', type: 'smoothstep', animated: true },
  ];
}

/** ID of the edge the EdgeToolbar demo is attached to. */
export const EDGE_TOOLBAR_EDGE_ID = 'e-plainC-sink';

/** ID of the rich node that has NodeResizer + NodeToolbar. */
export const RICH_NODE_ID = 'rich';
