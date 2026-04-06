import { Component } from '@angular/core';
import { Position, type Node } from '@angflow/angular';
import { FlowComponent, type FlowConfig } from '../flow.component';
import { ToolbarNodeComponent } from './components/toolbar-node.component';

const positions = ['top', 'right', 'bottom', 'left'];
const alignments = ['start', 'center', 'end'];

const nodes: Node[] = [
  {
    id: 'default-node',
    type: 'ToolbarNode',
    data: { label: 'toolbar top', toolbarPosition: Position.Top },
    position: { x: 0, y: -200 },
    className: 'xy-flow__node-default',
  },
];

positions.forEach((position, posIndex) => {
  alignments.forEach((align, alignIndex) => {
    nodes.push({
      id: `node-${align}-${position}`,
      type: 'ToolbarNode',
      data: {
        label: `toolbar ${position} ${align}`,
        toolbarPosition: position as Position,
        toolbarAlign: align,
        toolbarVisible: true,
      },
      className: 'xy-flow__node-default',
      position: { x: posIndex * 300, y: alignIndex * 100 },
    });
  });
});

const config: FlowConfig = {
  fitView: true,
  nodeTypes: {
    ToolbarNode: ToolbarNodeComponent,
  },
  nodes,
  edges: [
    { id: 'first-edge', source: 'default-node', target: 'node-start-top' },
  ],
};

@Component({
  standalone: true,
  imports: [FlowComponent],
  template: `<test-flow [config]="config" />`,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class NodeToolbarGeneralComponent {
  config = config;
}
