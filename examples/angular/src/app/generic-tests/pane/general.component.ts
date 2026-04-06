import { Component } from '@angular/core';
import { FlowComponent, type FlowConfig } from '../flow.component';

const config: FlowConfig = {
  fitView: true,
  minZoom: 0.25,
  maxZoom: 4,
  nodes: [
    { id: '1', data: { label: '1' }, position: { x: 0, y: 0 }, type: 'input' },
    { id: '2', data: { label: '2' }, position: { x: -100, y: 100 } },
    { id: '3', data: { label: '3' }, position: { x: 100, y: 100 } },
  ],
  edges: [
    { id: 'first-edge', source: '1', target: '2' },
    { id: 'second-edge', source: '1', target: '3' },
  ],
};

@Component({
  standalone: true,
  imports: [FlowComponent],
  template: `<test-flow [config]="config" />`,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class PaneGeneralComponent {
  config = config;
}
