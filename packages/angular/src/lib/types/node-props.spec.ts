import { describe, it, expect } from 'vitest';
import type { Node, NodeProps } from '../public-api';

type A = Node<{ a: string }, 'a'>;
type B = Node<{ b: number }, 'b'>;

function read(props: NodeProps<A | B>): string | number {
  return props.type === 'a' ? props.data.a : props.data.b; // only compiles if NodeProps distributes over the union
}

describe('NodeProps (#6131)', () => {
  it('narrows data by type', () => {
    expect(read({ type: 'a', data: { a: 'x' } } as NodeProps<A | B>)).toBe('x');
  });
});
