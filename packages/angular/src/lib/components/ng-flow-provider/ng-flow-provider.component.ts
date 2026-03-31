import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';

@Component({
  selector: 'ng-flow-provider',
  standalone: true,
  providers: [FlowStore, NgFlowService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
})
export class NgFlowProviderComponent {}
