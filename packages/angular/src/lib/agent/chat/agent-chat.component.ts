import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AgentChatService } from './agent-chat.service';

/**
 * Drop-in chat panel for the canvas copilot. Renders purely from
 * AgentChatService signals (zoneless-clean). All message text goes through
 * Angular text bindings — never innerHTML. Theme via --ngf-chat-* CSS vars.
 */
@Component({
  selector: 'ng-flow-agent-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ng-flow__agent-chat">
      <div class="ng-flow__agent-chat__header">
        <span class="ng-flow__agent-chat__title">{{ title() }}</span>
        @if (chat.busy()) {
          <button
            type="button"
            class="ng-flow__agent-chat__stop"
            (click)="chat.stop()"
          >Stop</button>
        }
      </div>

      <div class="ng-flow__agent-chat__messages" #scroller>
        @for (m of chat.messages(); track m.id) {
          <div
            class="ng-flow__agent-chat__bubble"
            [class]="'ng-flow__agent-chat__bubble ng-flow__agent-chat__bubble--' + m.role"
          >
            @if (m.text) {
              <div class="ng-flow__agent-chat__text">{{ m.text }}</div>
            }
            @if (m.activity.length > 0) {
              <div class="ng-flow__agent-chat__chips">
                @for (a of m.activity; track $index) {
                  <span
                    [class]="'ng-flow__agent-chat__chip ng-flow__agent-chat__chip--' + a.status"
                    [title]="a.summary"
                  >
                    {{ a.status === 'running' ? '⏳' : a.status === 'ok' ? '✓' : '✗' }}
                    {{ a.name }}
                  </span>
                }
              </div>
            }
          </div>
        }
        @if (chat.busy()) {
          <div class="ng-flow__agent-chat__busy">…</div>
        }
      </div>

      @if (chat.error(); as err) {
        <div class="ng-flow__agent-chat__error">{{ err }}</div>
      }

      <div class="ng-flow__agent-chat__composer">
        <textarea
          #composer
          rows="2"
          [placeholder]="placeholder()"
          [disabled]="chat.busy()"
          (input)="draft.set($any($event.target).value)"
          (keydown.enter)="onEnter($event)"
        ></textarea>
        <button
          type="button"
          class="ng-flow__agent-chat__send"
          [disabled]="chat.busy()"
          (click)="submit()"
        >▶</button>
      </div>
    </div>
  `,
  styles: [
    `
      .ng-flow__agent-chat {
        display: flex;
        flex-direction: column;
        width: var(--ngf-chat-width, 320px);
        height: var(--ngf-chat-height, 420px);
        background: var(--ngf-chat-bg, #ffffff);
        border: 1px solid var(--ngf-chat-border, #d4d4d8);
        border-radius: 8px;
        font-size: 13px;
        color: #1e293b;
        overflow: hidden;
      }
      .ng-flow__agent-chat__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-bottom: 1px solid var(--ngf-chat-border, #e4e4e7);
        font-weight: 600;
      }
      .ng-flow__agent-chat__stop {
        font-size: 11px;
        padding: 2px 8px;
        border: 1px solid #fca5a5;
        background: #fef2f2;
        color: #b91c1c;
        border-radius: 4px;
        cursor: pointer;
      }
      .ng-flow__agent-chat__messages {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ng-flow__agent-chat__bubble {
        max-width: 85%;
        padding: 6px 10px;
        border-radius: 10px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .ng-flow__agent-chat__bubble--user {
        align-self: flex-end;
        background: var(--ngf-chat-accent, #4f46e5);
        color: #ffffff;
      }
      .ng-flow__agent-chat__bubble--assistant {
        align-self: flex-start;
        background: var(--ngf-chat-assistant-bg, #f1f5f9);
      }
      .ng-flow__agent-chat__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }
      .ng-flow__agent-chat__chip {
        font-size: 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        padding: 1px 6px;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
      }
      .ng-flow__agent-chat__chip--ok { background: #d1fae5; color: #047857; }
      .ng-flow__agent-chat__chip--error { background: #ffe4e6; color: #be123c; }
      .ng-flow__agent-chat__busy { color: #94a3b8; }
      .ng-flow__agent-chat__error {
        padding: 6px 10px;
        background: #fef2f2;
        color: #b91c1c;
        font-size: 12px;
        border-top: 1px solid #fecaca;
      }
      .ng-flow__agent-chat__composer {
        display: flex;
        gap: 6px;
        padding: 8px;
        border-top: 1px solid var(--ngf-chat-border, #e4e4e7);
      }
      .ng-flow__agent-chat__composer textarea {
        flex: 1;
        resize: none;
        border: 1px solid #d4d4d8;
        border-radius: 6px;
        padding: 6px 8px;
        font: inherit;
      }
      .ng-flow__agent-chat__send {
        align-self: flex-end;
        border: none;
        border-radius: 6px;
        background: var(--ngf-chat-accent, #4f46e5);
        color: #ffffff;
        padding: 6px 10px;
        cursor: pointer;
      }
      .ng-flow__agent-chat__send:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ],
})
export class AgentChatComponent {
  readonly chat = inject(AgentChatService);

  readonly title = input('Canvas copilot');
  readonly placeholder = input('Ask the copilot to edit the canvas…');

  readonly draft = signal('');

  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('composer');

  constructor() {
    // Auto-scroll on new messages. setTimeout schedules after render —
    // framework-agnostic timer use, not a CD workaround (zoneless rule 3).
    effect(() => {
      this.chat.messages();
      this.chat.busy();
      const el = this.scroller()?.nativeElement;
      if (!el) return;
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 0);
    });
  }

  onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return; // shift+enter = newline
    event.preventDefault();
    this.submit();
  }

  submit(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.draft.set('');
    // Clear the DOM value immediately so the test (and the user) sees an empty
    // textarea without waiting for the next CD cycle.
    const ta = this.textarea()?.nativeElement;
    if (ta) ta.value = '';
    void this.chat.send(text);
  }
}
