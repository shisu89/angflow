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

export const DATA_ONLY: Record<string, FlowConfig> = {
  'edges/general': edgesGeneral,
  'edges/reconnect': edgesReconnect,
  'pane/activation-keys': paneActivationKeys,
  'pane/click-connect': paneClickConnect,
  'pane/click-connect-selection': paneClickConnectSelection,
  'pane/general': paneGeneral,
  'pane/non-defaults': paneNonDefaults,
};

export const OVERRIDES: Record<string, FlowConfig> = {}; // filled in Tasks 4–5

export const REGISTRY: Record<string, FlowConfig> = { ...DATA_ONLY, ...OVERRIDES };
