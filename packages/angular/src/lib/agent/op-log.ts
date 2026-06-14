/** One recorded mutating tool call. `cursor` is monotonic per flow (starts at 1). */
export interface OpLogEntry {
  cursor: number;
  flowId: string;
  method: string;
  params: Record<string, unknown>;
  source?: string;
}

export interface OpLogOptions {
  /** Max retained entries per flow (ring buffer). Default 1000. */
  maxOps?: number;
}

export interface ChangesSince {
  ops: OpLogEntry[];
  cursor: number;
  truncated: boolean;
}

/**
 * Per-flow bounded op-log. Records bridge-initiated mutating tool calls with a
 * monotonic cursor so an agent can poll `get_changes_since`. Bridge-only scope —
 * UI-driven changes and undo/redo are not recorded (mirrors AgentHistory).
 */
export class OpLog {
  private readonly logs = new Map<string, OpLogEntry[]>();
  private readonly cursors = new Map<string, number>();
  private readonly maxOps: number;

  constructor(options: OpLogOptions = {}) {
    this.maxOps = options.maxOps ?? 1000;
  }

  append(flowId: string, op: { method: string; params: Record<string, unknown>; source?: string }): OpLogEntry {
    const cursor = (this.cursors.get(flowId) ?? 0) + 1;
    this.cursors.set(flowId, cursor);
    const entry: OpLogEntry = { cursor, flowId, method: op.method, params: op.params, source: op.source };
    const log = this.logs.get(flowId) ?? [];
    log.push(entry);
    while (log.length > this.maxOps) log.shift();
    this.logs.set(flowId, log);
    return entry;
  }

  since(flowId: string, sinceCursor: number): ChangesSince {
    const log = this.logs.get(flowId) ?? [];
    const latest = this.cursors.get(flowId) ?? 0;
    if (sinceCursor <= 0) {
      return { ops: [...log], cursor: latest, truncated: false };
    }
    const oldestRetained = log.length > 0 ? log[0].cursor : latest + 1;
    // Truncated when the caller's NEXT-needed entry (sinceCursor + 1) was evicted
    // — i.e. there's a gap between what they've seen and the oldest we still hold.
    // (sinceCursor + 1 === oldestRetained means no gap: their next entry is present.)
    const truncated = oldestRetained > sinceCursor + 1;
    return { ops: log.filter((e) => e.cursor > sinceCursor), cursor: latest, truncated };
  }

  dropFlow(flowId: string): void {
    this.logs.delete(flowId);
    this.cursors.delete(flowId);
  }
}
