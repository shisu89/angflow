// Lets upstream's React generic-test configs (imported verbatim from
// examples/react/src/generic-tests) resolve `@xyflow/react` in the Angular app.
// Only re-export what those configs actually use; check:generic-tests (Task 6)
// fails if an upstream config imports a name missing here.
export { MarkerType, Position } from '@angflow/angular';
export type { Node, Edge } from '@angflow/angular';
