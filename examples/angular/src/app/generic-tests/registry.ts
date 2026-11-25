// Keys mirror upstream routes: /tests/generic/<key>.
// The DATA_ONLY imports point at the verbatim React reference copy.
// check:generic-tests (Task 6) keeps this map in sync with upstream.
import edgesGeneral from '../../../../react/src/generic-tests/edges/general';
import edgesReconnect from '../../../../react/src/generic-tests/edges/reconnect';
import paneActivationKeys from '../../../../react/src/generic-tests/pane/activation-keys';
import paneClickConnect from '../../../../react/src/generic-tests/pane/click-connect';
import paneClickConnectSelection from '../../../../react/src/generic-tests/pane/click-connect-selection';
import paneGeneral from '../../../../react/src/generic-tests/pane/general';
import paneNonDefaults from '../../../../react/src/generic-tests/pane/non-defaults';
import nodesConnectionUpdates from './overrides/nodes/connection-updates';
import nodesDataUpdates from './overrides/nodes/data-updates';
import nodesGeneral from './overrides/nodes/general';
import nodesIntersectionOrigin from './overrides/nodes/intersection-origin';

export const DATA_ONLY: Record<string, FlowConfig> = {
  'edges/general': edgesGeneral,
  'edges/reconnect': edgesReconnect,
  'pane/activation-keys': paneActivationKeys,
  'pane/click-connect': paneClickConnect,
  'pane/click-connect-selection': paneClickConnectSelection,
  'pane/general': paneGeneral,
  'pane/non-defaults': paneNonDefaults,
};

export const OVERRIDES: Record<string, FlowConfig> = {
  // Task 5 adds node-toolbar/general and viewport/transitions.
  'nodes/connection-updates': nodesConnectionUpdates,
  'nodes/data-updates': nodesDataUpdates,
  'nodes/general': nodesGeneral,
  'nodes/intersection-origin': nodesIntersectionOrigin,
};

export const REGISTRY: Record<string, FlowConfig> = { ...DATA_ONLY, ...OVERRIDES };
