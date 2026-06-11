/**
 * Data-driven node template types for the agent bridge.
 *
 * A `NodeTemplateSpec` is pure JSON an agent can emit over the wire; the
 * library renders it with `TemplateNodeComponent`. Interpolation is a dotted
 * `{{data.x}}` path resolver against `node.data` only — no expressions, no
 * code execution. See `utils/template-interpolation.ts`.
 */

/** Allowlisted badge palette. Raw CSS is deliberately not accepted here. */
export type NodeTemplateBadgeColor = 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose';

export interface NodeTemplateBadge {
  /** Badge text. Supports {{data.x}} interpolation. */
  text: string;
  /** Palette key; defaults to 'slate'. */
  color?: NodeTemplateBadgeColor;
  /** Dotted data path; badge renders only when truthy (e.g. 'data.env'). */
  showIf?: string;
}

export interface NodeTemplateField {
  /** Row label (literal, not interpolated). */
  label: string;
  /** Row value. Supports {{data.x}} interpolation. */
  value: string;
  /** Dotted data path; row renders only when truthy. */
  showIf?: string;
}

export interface NodeTemplateHandle {
  type: 'source' | 'target';
  /** Defaults: target → 'left', source → 'right'. */
  position?: 'top' | 'right' | 'bottom' | 'left';
  id?: string;
}

export interface NodeTemplateSpec {
  /** Card title. Supports {{data.x}} interpolation. */
  title?: string;
  /** Icon name resolved against the built-in glyph set; unknown names render nothing. */
  icon?: string;
  /** Accent color (header text / left border). Any CSS color; Angular sanitizes the style binding. */
  accent?: string;
  /** Layout density. Default 'detailed'. */
  variant?: 'compact' | 'detailed';
  badges?: NodeTemplateBadge[];
  fields?: NodeTemplateField[];
  /** Free body text (interpolated), shown under fields. */
  body?: string;
  /** Defaults to one target handle (left) and one source handle (right) when omitted. */
  handles?: NodeTemplateHandle[];
}

// ── Layout ──────────────────────────────────────────────────────────────

export interface AgentLayoutOptions {
  direction: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep?: number;
  rankSep?: number;
}

/**
 * Host-pluggable layout function for the `layout_nodes` agent tool.
 * Positions returned are top-left corners in flow coordinates.
 * See `dagreLayout` in `@angflow/angular/layout` for a turnkey adapter.
 */
export type AgentLayoutFn = (
  nodes: Array<{
    id: string;
    width: number;
    height: number;
    position: { x: number; y: number };
    /** Present when the node is grouped AND its parent is in the layout set. */
    parentId?: string;
  }>,
  edges: Array<{ source: string; target: string }>,
  opts: AgentLayoutOptions,
) => Record<string, { x: number; y: number }> | Promise<Record<string, { x: number; y: number }>>;
