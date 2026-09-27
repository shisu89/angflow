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
  host: {
    '[class.dark]': "colorMode() === 'dark'",
    '[class.system]': "colorMode() === 'system'",
  },
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

      <div
        class="ng-flow__agent-chat__messages"
        #scroller
        role="log"
        aria-live="polite"
        [attr.aria-busy]="chat.busy()"
      >
        @for (m of chat.messages(); track m.id) {
          <div
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
                    [attr.aria-label]="a.name + ': ' + a.status"
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
          <div class="ng-flow__agent-chat__busy" aria-label="Working">…</div>
        }
      </div>

      @if (chat.error(); as err) {
        <div class="ng-flow__agent-chat__error" role="alert">{{ err }}</div>
      }

      <div class="ng-flow__agent-chat__composer">
        <textarea
          rows="2"
          [placeholder]="placeholder()"
          [attr.aria-label]="placeholder()"
          [disabled]="chat.busy()"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          (keydown.enter)="onEnter($event)"
        ></textarea>
        <button
          type="button"
          class="ng-flow__agent-chat__send"
          [disabled]="chat.busy() || draft().trim().length === 0"
          (click)="submit()"
          aria-label="Send"
        >▶</button>
      </div>
    </div>
  `,
  styles: [
    `
      /* Dark palette: inside a dark flow/page (.dark ancestor), via
         [colorMode]="'dark'", or 'system' + OS dark preference. Override any
         --ngf-chat-* variable to theme it further. */
      :host(.dark), :host-context(.dark) {
        --ngf-chat-bg: #1e1e1e;
        --ngf-chat-fg: #f1f5f9;
        --ngf-chat-border: #3c3c3c;
        --ngf-chat-assistant-bg: #2b2b2b;
        --ngf-chat-input-bg: #141414;
        --ngf-chat-chip-bg: #3e3e3e;
        --ngf-chat-chip-fg: #e2e8f0;
        --ngf-chat-ok-bg: #064e3b;
        --ngf-chat-ok-fg: #a7f3d0;
        --ngf-chat-err-bg: #4c0519;
        --ngf-chat-err-fg: #fecdd3;
        --ngf-chat-muted: #94a3b8;
        --ngf-chat-danger-bg: #450a0a;
        --ngf-chat-danger-fg: #fecaca;
        --ngf-chat-danger-border: #7f1d1d;
        --ngf-chat-accent: #6366f1;
      }
      @media (prefers-color-scheme: dark) {
        :host(.system) {
          --ngf-chat-bg: #1e1e1e;
          --ngf-chat-fg: #f1f5f9;
          --ngf-chat-border: #3c3c3c;
          --ngf-chat-assistant-bg: #2b2b2b;
          --ngf-chat-input-bg: #141414;
          --ngf-chat-chip-bg: #3e3e3e;
          --ngf-chat-chip-fg: #e2e8f0;
          --ngf-chat-ok-bg: #064e3b;
          --ngf-chat-ok-fg: #a7f3d0;
          --ngf-chat-err-bg: #4c0519;
          --ngf-chat-err-fg: #fecdd3;
          --ngf-chat-muted: #94a3b8;
          --ngf-chat-danger-bg: #450a0a;
          --ngf-chat-danger-fg: #fecaca;
          --ngf-chat-danger-border: #7f1d1d;
          --ngf-chat-accent: #6366f1;
        }
      }
      .ng-flow__agent-chat {
        display: flex;
        flex-direction: column;
        width: var(--ngf-chat-width, 320px);
        height: var(--ngf-chat-height, 420px);
        background: var(--ngf-chat-bg, #ffffff);
        border: 1px solid var(--ngf-chat-border, #d4d4d8);
        border-radius: 8px;
        font-size: 13px;
        color: var(--ngf-chat-fg, #1e293b);
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
        border: 1px solid var(--ngf-chat-danger-border, #fca5a5);
        background: var(--ngf-chat-danger-bg, #fef2f2);
        color: var(--ngf-chat-danger-fg, #b91c1c);
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
        background: var(--ngf-chat-chip-bg, #e2e8f0);
        color: var(--ngf-chat-chip-fg, #334155);
      }
      .ng-flow__agent-chat__chip--ok { background: var(--ngf-chat-ok-bg, #d1fae5); color: var(--ngf-chat-ok-fg, #047857); }
      .ng-flow__agent-chat__chip--error { background: var(--ngf-chat-err-bg, #ffe4e6); color: var(--ngf-chat-err-fg, #be123c); }
      .ng-flow__agent-chat__busy { color: var(--ngf-chat-muted, #64748b); }
      .ng-flow__agent-chat__error {
        padding: 6px 10px;
        background: var(--ngf-chat-danger-bg, #fef2f2);
        color: var(--ngf-chat-danger-fg, #b91c1c);
        font-size: 12px;
        border-top: 1px solid var(--ngf-chat-danger-border, #fecaca);
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
        border: 1px solid var(--ngf-chat-border, #d4d4d8);
        border-radius: 6px;
        padding: 6px 8px;
        font: inherit;
        color: inherit;
        background: var(--ngf-chat-input-bg, #ffffff);
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
  /**
   * 'light' (default) also turns dark automatically inside a `.dark` ancestor
   * (e.g. `<ng-flow colorMode="dark">`); 'dark' forces it; 'system' follows the
   * OS preference.
   */
  readonly colorMode = input<'light' | 'dark' | 'system'>('light');

  readonly draft = signal('');

  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');

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
    void this.chat.send(text);
  }
}
