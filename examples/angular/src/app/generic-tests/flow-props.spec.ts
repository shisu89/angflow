import { describe, expect, it, vi } from 'vitest';
import { partitionFlowProps } from './flow-props';

const names = new Set(['fitView', 'minZoom', 'deleteKeyCode', 'nodes', 'edges']);

describe('partitionFlowProps', () => {
  it('skips nodes and edges', () => {
    const r = partitionFlowProps({ nodes: [], edges: [] }, names);
    expect(r.inputs).toEqual({});
    expect(r.unsupported).toEqual([]);
  });

  it('routes known inputs, preserving null', () => {
    const r = partitionFlowProps({ fitView: true, minZoom: 0.5, deleteKeyCode: null }, names);
    expect(r.inputs).toEqual({ fitView: true, minZoom: 0.5, deleteKeyCode: null });
    expect('deleteKeyCode' in r.inputs).toBe(true);
  });

  it('extracts className', () => {
    expect(partitionFlowProps({ className: 'foo' }, names).className).toBe('foo');
  });

  it('maps onPaneClick to paneClick and forwards the payload', () => {
    const cb = vi.fn();
    const r = partitionFlowProps({ onPaneClick: cb }, names);
    expect(r.outputs[0].output).toBe('paneClick');
    r.outputs[0].handler('evt');
    expect(cb).toHaveBeenCalledWith('evt');
  });

  it('calls onClickConnectEnd as (event, undefined)', () => {
    const cb = vi.fn();
    const r = partitionFlowProps({ onClickConnectEnd: cb }, names);
    expect(r.outputs[0].output).toBe('clickConnectEnd');
    r.outputs[0].handler('evt');
    expect(cb).toHaveBeenCalledWith('evt', undefined);
  });

  it('reports unknown props as unsupported', () => {
    const r = partitionFlowProps({ onNodeClick: () => {}, bogusProp: 1 }, names);
    expect(r.unsupported).toEqual(['onNodeClick', 'bogusProp']);
  });
});
