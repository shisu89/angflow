import { describe, it, expect, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAgentBridge } from '../provide-agent-bridge';
import { provideAgentChat } from './provide-agent-chat';
import { AgentChatService } from './agent-chat.service';
import { AgentChatComponent } from './agent-chat.component';
import type { AgentChatResponse, CompleteFn } from './types';

function mount(complete: CompleteFn): {
  fixture: ComponentFixture<AgentChatComponent>;
  el: HTMLElement;
  chat: AgentChatService;
} {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideAgentBridge({ transports: [] }),
      provideAgentChat({ complete }),
    ],
  });
  const chat = TestBed.inject(AgentChatService);
  const fixture = TestBed.createComponent(AgentChatComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, chat };
}

const echo: CompleteFn = async () => ({
  content: [{ type: 'text', text: 'echo reply' }],
  stop_reason: 'end_turn',
});

describe('AgentChatComponent', () => {
  it('renders the default title (overridable via input)', () => {
    const { el, fixture } = mount(echo);
    expect(el.querySelector('.ng-flow__agent-chat__title')?.textContent).toContain(
      'Canvas copilot',
    );
    fixture.componentRef.setInput('title', 'My copilot');
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__agent-chat__title')?.textContent).toContain('My copilot');
  });

  it('sends input text through the service and renders both bubbles', async () => {
    const { el, fixture, chat } = mount(echo);
    const input = el.querySelector('textarea')!;
    input.value = 'hello agent';
    input.dispatchEvent(new Event('input'));
    (el.querySelector('.ng-flow__agent-chat__send') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(chat.messages()).toHaveLength(2));
    fixture.detectChanges();
    const bubbles = el.querySelectorAll('.ng-flow__agent-chat__bubble');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0].textContent).toContain('hello agent');
    expect(bubbles[1].textContent).toContain('echo reply');
    expect(input.value).toBe(''); // cleared after send
  });

  it('renders assistant <script> text inert', async () => {
    const xss: CompleteFn = async () => ({
      content: [{ type: 'text', text: '<script>alert(1)</script>' }],
      stop_reason: 'end_turn',
    });
    const { el, fixture, chat } = mount(xss);
    await chat.send('go');
    fixture.detectChanges();
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>');
  });

  it('shows tool chips with status classes', async () => {
    const withTool: CompleteFn = (() => {
      let first = true;
      return async () => {
        if (first) {
          first = false;
          return {
            content: [{ type: 'tool_use', id: 't1', name: 'get_state', input: {} }],
            stop_reason: 'tool_use',
          } as AgentChatResponse;
        }
        return { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn' };
      };
    })();
    const { el, fixture, chat } = mount(withTool);
    await chat.send('inspect');
    fixture.detectChanges();
    const chip = el.querySelector('.ng-flow__agent-chat__chip')!;
    expect(chip.textContent).toContain('get_state');
    // get_state fails (no flow registered in this minimal mount) → error chip,
    // which is exactly the behavior we want to see surfaced.
    expect(chip.classList.contains('ng-flow__agent-chat__chip--error')).toBe(true);
  });

  it('disables input and shows Stop while busy; error banner on failure', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: CompleteFn = async () => {
      await gate;
      throw new Error('proxy down');
    };
    const { el, fixture, chat } = mount(slow);
    const sending = chat.send('hi');
    fixture.detectChanges();
    expect((el.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);
    expect(el.querySelector('.ng-flow__agent-chat__stop')).not.toBeNull();
    release();
    await sending;
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__agent-chat__error')?.textContent).toContain('proxy down');
    expect((el.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(false);
  });
});
