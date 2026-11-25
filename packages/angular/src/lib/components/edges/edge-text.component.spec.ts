/**
 * EdgeTextComponent: upstream `EdgeText` measurement and layout. jsdom has no
 * `getBBox`, so it is stubbed on `SVGElement.prototype` for these tests.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { EdgeTextComponent } from './edge-text.component';
import { toStyleString } from '../../utils/style';
import type { CSSProperties } from '../../types/general';

@Component({
  standalone: true,
  imports: [EdgeTextComponent],
  template: `
    <svg>
      <g
        ngFlowEdgeText
        [x]="x()"
        [y]="y()"
        [label]="label()"
        [labelStyle]="labelStyle()"
        [labelBgPadding]="[6, 3]"
      >
        <svg:circle class="projected" r="2" />
      </g>
    </svg>
  `,
})
class HostComponent {
  readonly x = signal(100);
  readonly y = signal(50);
  readonly label = signal('hello');
  readonly labelStyle = signal<CSSProperties | undefined>(undefined);
}

describe('EdgeTextComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let wrapper: SVGGElement;
  let bboxCalls = 0;
  let bboxSize = { width: 40, height: 10 };
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  const hadGetBBox = 'getBBox' in proto;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    bboxCalls = 0;
    bboxSize = { width: 40, height: 10 };
    proto.getBBox = function () {
      bboxCalls++;
      return { x: 0, y: -8, ...bboxSize } as DOMRect;
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await settle();
    wrapper = (fixture.nativeElement as HTMLElement).querySelector('g.xy-flow__edge-textwrapper') as SVGGElement;
  });

  afterEach(() => {
    if (!hadGetBBox) delete proto.getBBox;
  });

  it('sizes the background rect from the measured text plus padding', () => {
    const rect = wrapper.querySelector('rect.xy-flow__edge-textbg')!;
    expect(rect.getAttribute('width')).toBe('52'); // 40 + 2 * 6
    expect(rect.getAttribute('height')).toBe('16'); // 10 + 2 * 3
    expect(wrapper.querySelector('text')!.getAttribute('y')).toBe('5');
  });

  it('centres the label on (x, y)', () => {
    expect(wrapper.getAttribute('transform')).toBe('translate(80 45)');
  });

  it('is hidden until measured, then visible', async () => {
    expect(wrapper.getAttribute('visibility')).toBe('visible');

    bboxSize = { width: 0, height: 0 };
    host.label.set('');
    await settle();
    expect(wrapper.getAttribute('visibility')).toBe('hidden');

    bboxSize = { width: 30, height: 10 };
    host.label.set('again');
    await settle();
    expect(wrapper.getAttribute('visibility')).toBe('visible');
  });

  it('re-measures when the label changes, not when x/y move', async () => {
    const calls = bboxCalls;
    host.x.set(300);
    host.y.set(200);
    await settle();
    expect(bboxCalls).toBe(calls);
    expect(wrapper.getAttribute('transform')).toBe('translate(280 195)');

    bboxSize = { width: 80, height: 10 };
    host.label.set('a longer label');
    await settle();
    expect(bboxCalls).toBeGreaterThan(calls);
    expect(wrapper.querySelector('rect')!.getAttribute('width')).toBe('92');
    expect(wrapper.getAttribute('transform')).toBe('translate(260 195)');
  });

  it('renders projected content after the text, like upstream children', () => {
    const circle = wrapper.querySelector('circle.projected');
    expect(circle).not.toBeNull();
    expect(circle!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(wrapper.lastElementChild).toBe(circle);
  });

  it('adds px to numeric labelStyle values', async () => {
    host.labelStyle.set({ fontSize: 12, fill: 'red', fontWeight: 700 });
    await settle();
    expect(wrapper.querySelector('text')!.getAttribute('style')).toBe('font-size: 12px; fill: red; font-weight: 700');
  });
});

describe('toStyleString', () => {
  it('kebab-cases keys and adds px to numbers except React unitless properties', () => {
    expect(
      toStyleString({ fontSize: 12, opacity: 0.5, strokeWidth: 2, zIndex: 3, lineHeight: 1.2, padding: 0, margin: '1em' }),
    ).toBe('font-size: 12px; opacity: 0.5; stroke-width: 2; z-index: 3; line-height: 1.2; padding: 0; margin: 1em');
  });

  it('passes custom properties through and skips unset values', () => {
    expect(toStyleString({ '--gap': 4, fill: undefined, stroke: null })).toBe('--gap: 4');
    expect(toStyleString({ fill: undefined })).toBeNull();
    expect(toStyleString(undefined)).toBeNull();
  });
});
