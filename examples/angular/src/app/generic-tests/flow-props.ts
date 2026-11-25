export interface OutputAdapter {
  output: string; // NgFlowComponent output templateName
  adapt: (cb: (...a: any[]) => void) => (payload: any) => void;
}

/** Explicit on* → output table. Never map by name convention: argument shapes differ. */
export const OUTPUT_ADAPTERS: Record<string, OutputAdapter> = {
  onPaneClick: { output: 'paneClick', adapt: (cb) => (e) => cb(e) },
  onClickConnectStart: { output: 'clickConnectStart', adapt: (cb) => (e) => cb(e) },
  // Angular's clickConnectEnd emits only the MouseEvent; upstream passes
  // (event, connection). connection stays undefined until sub-project D.
  onClickConnectEnd: { output: 'clickConnectEnd', adapt: (cb) => (e) => cb(e, undefined) },
};

/** Keys the host owns itself (controlled state) and never forwards. */
export const HOST_OWNED = new Set(['nodes', 'edges']);

export interface PartitionedProps {
  inputs: Record<string, unknown>; // keyed by input templateName
  outputs: { output: string; handler: (payload: any) => void }[];
  className: string | undefined;
  unsupported: string[];
}

export function partitionFlowProps(
  flowProps: Record<string, unknown>,
  inputNames: ReadonlySet<string>,
): PartitionedProps {
  const result: PartitionedProps = { inputs: {}, outputs: [], className: undefined, unsupported: [] };
  for (const [key, value] of Object.entries(flowProps)) {
    if (HOST_OWNED.has(key)) continue;
    if (key === 'className' && typeof value === 'string') {
      result.className = value;
    } else if (key in OUTPUT_ADAPTERS && typeof value === 'function') {
      const a = OUTPUT_ADAPTERS[key];
      result.outputs.push({ output: a.output, handler: a.adapt(value as (...a: any[]) => void) });
    } else if (inputNames.has(key)) {
      result.inputs[key] = value;
    } else {
      result.unsupported.push(key);
    }
  }
  return result;
}
