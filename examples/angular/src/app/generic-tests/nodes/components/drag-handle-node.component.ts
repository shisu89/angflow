import { Component } from '@angular/core';

@Component({
  selector: 'drag-handle-node',
  standalone: true,
  template: `
    <div class="container" style="width: 100px; height: 50px; background: red; display: flex; align-items: center; justify-content: center;">
      <div class="drag-handle custom-drag-handle" style="display: inline-block; width: 25px; height: 25px; background-color: green;"></div>
    </div>
  `,
})
export class DragHandleNodeComponent {}
