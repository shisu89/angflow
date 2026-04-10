import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { HandleComponent, NgFlowService, Position } from '@angflow/angular';

@Component({
  selector: 'app-showcase-form-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="form-node" [class]="runClass()" [class.selected]="selected()">
      <div class="form-node__header">
        {{ title() }}
      </div>
      <div class="form-node__body nodrag">
        @for (field of fields(); track field.name) {
          <div class="form-field">
            <label class="form-field__label">{{ field.label }}</label>
            @switch (field.type) {
              @case ('text') {
                <input
                  class="form-field__input"
                  type="text"
                  [value]="field.value ?? ''"
                  [placeholder]="field.placeholder ?? ''"
                  (input)="onFieldChange(field.name, $event)"
                />
              }
              @case ('number') {
                <input
                  class="form-field__input"
                  type="number"
                  [value]="field.value ?? ''"
                  [placeholder]="field.placeholder ?? ''"
                  [min]="field.min"
                  [max]="field.max"
                  [step]="field.step ?? 1"
                  (input)="onFieldChange(field.name, $event)"
                />
              }
              @case ('select') {
                <select
                  class="form-field__input"
                  [value]="field.value ?? ''"
                  (change)="onFieldChange(field.name, $event)"
                >
                  @for (opt of field.options || []; track opt.value) {
                    <option [value]="opt.value" [selected]="opt.value === field.value">
                      {{ opt.label }}
                    </option>
                  }
                </select>
              }
              @case ('checkbox') {
                <label class="form-field__checkbox">
                  <input
                    type="checkbox"
                    [checked]="field.value ?? false"
                    (change)="onCheckboxChange(field.name, $event)"
                  />
                  {{ field.checkboxLabel ?? '' }}
                </label>
              }
              @case ('textarea') {
                <textarea
                  class="form-field__input form-field__textarea"
                  [value]="field.value ?? ''"
                  [placeholder]="field.placeholder ?? ''"
                  rows="3"
                  (input)="onFieldChange(field.name, $event)"
                ></textarea>
              }
            }
          </div>
        }
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
  styles: [`
    :host { display: block; }
    .form-node {
      background: var(--sc-node-bg, #ffffff);
      border: 2px solid var(--sc-accent, #6366f1);
      border-radius: 12px;
      min-width: 240px;
      max-width: 300px;
      font-size: 12px;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.14);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      color: var(--sc-node-text, #0f172a);
    }
    .form-node.selected {
      box-shadow: 0 6px 22px rgba(99, 102, 241, 0.32);
    }
    .form-node.is-running {
      animation: sc-form-pulse 1s ease-in-out infinite;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.25), 0 6px 18px rgba(99, 102, 241, 0.35);
    }
    .form-node.has-run {
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.45), 0 4px 14px rgba(16, 185, 129, 0.25);
    }
    .form-node__header {
      padding: 10px 16px;
      font-weight: 700;
      font-size: 13px;
      color: #ffffff;
      background: var(--sc-accent, #6366f1);
      border-radius: 10px 10px 0 0;
      letter-spacing: 0.02em;
    }
    .form-node.has-run .form-node__header {
      background: #10b981;
    }
    .form-node__body {
      padding: 12px 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-field__label {
      font-size: 10px;
      font-weight: 700;
      color: var(--sc-node-muted, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .form-field__input {
      padding: 6px 10px;
      border: 1px solid var(--sc-border, #e2e8f0);
      border-radius: 6px;
      font-size: 12px;
      background: var(--sc-field-bg, #f8fafc);
      color: var(--sc-node-text, #0f172a);
      outline: none;
      transition: border-color 0.15s;
      font-family: inherit;
    }
    .form-field__input:focus {
      border-color: var(--sc-accent, #6366f1);
      background: var(--sc-node-bg, #ffffff);
    }
    .form-field__textarea {
      resize: vertical;
      min-height: 44px;
    }
    .form-field__checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--sc-node-text, #0f172a);
      cursor: pointer;
    }
    .form-field__checkbox input {
      accent-color: var(--sc-accent, #6366f1);
    }
    select.form-field__input {
      cursor: pointer;
    }
    @keyframes sc-form-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
  `],
})
export class ShowcaseFormNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly type = input<string>();
  readonly selected = input(false);
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();

  private flowService = inject(NgFlowService);

  readonly title = computed<string>(() => this.data()?.title ?? 'Form');
  readonly fields = computed<any[]>(() => this.data()?.fields ?? []);
  readonly runClass = computed<string>(() => {
    const state = this.data()?._runState;
    if (state === 'running') return 'is-running';
    if (state === 'done') return 'has-run';
    return '';
  });

  onFieldChange(fieldName: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateFieldValue(fieldName, value);
  }

  onCheckboxChange(fieldName: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateFieldValue(fieldName, checked);
  }

  private updateFieldValue(fieldName: string, value: any): void {
    const currentFields = this.fields();
    if (!currentFields.length) return;
    const updatedFields = currentFields.map((f: any) =>
      f.name === fieldName ? { ...f, value } : f
    );
    this.flowService.updateNodeData(this.id(), { fields: updatedFields });
  }
}
