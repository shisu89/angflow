/* eslint-disable @typescript-eslint/no-explicit-any */
import { isWrappedWithClass } from './utils';

export type FilterParams = {
  panActivationKeyPressed?: boolean;
  zoomActivationKeyPressed?: boolean;
  zoomOnScroll: boolean;
  zoomOnPinch: boolean;
  panOnDrag: boolean | number[];
  panOnScroll: boolean;
  zoomOnDoubleClick: boolean;
  userSelectionActive: boolean;
  noWheelClassName: string;
  noPanClassName: string;
  lib: string;
  connectionInProgress?: boolean;
};

export function createFilter({
  panActivationKeyPressed = false,
  zoomActivationKeyPressed,
  zoomOnScroll,
  zoomOnPinch,
  panOnDrag,
  panOnScroll,
  zoomOnDoubleClick,
  userSelectionActive,
  noWheelClassName,
  noPanClassName,
  lib,
  connectionInProgress,
}: FilterParams) {
  return (event: any): boolean => {
    const zoomScroll = zoomActivationKeyPressed || zoomOnScroll;
    const pinchZoom = zoomOnPinch && event.ctrlKey;
    const isWheelEvent = event.type === 'wheel';

    const middleMousePanAllowed = panOnDrag === true || (Array.isArray(panOnDrag) && panOnDrag.includes(1));

    /*
     * Nodes, edges and selections are marked nopan, but a middle-button drag on them still
     * pans as long as panOnDrag allows button 1.
     * `!userSelectionActive` is load-bearing: this is the one branch that returns
     * true before the blanket selection check below, and since XYPanZoom.update()
     * no longer tears down mousedown.zoom during a selection (see the note there),
     * without it a middle-press mid-marquee would start a competing d3 pan.
     */
    if (
      middleMousePanAllowed &&
      event.button === 1 &&
      event.type === 'mousedown' &&
      !userSelectionActive &&
      (isWrappedWithClass(event, `${lib}-flow__node`) ||
        isWrappedWithClass(event, `${lib}-flow__edge`) ||
        // Unreachable for the user-selection rect under angflow's !userSelectionActive guard:
        // that rect only exists while a marquee runs. Kept for upstream parity. It still
        // matches the nodes-selection box, which carries both __selection and __nodesselection.
        isWrappedWithClass(event, `${lib}-flow__selection`) ||
        isWrappedWithClass(event, `${lib}-flow__nodesselection`))
    ) {
      return true;
    }

    // if all interactions are disabled, we prevent all zoom events
    if (!panOnDrag && !zoomScroll && !panOnScroll && !zoomOnDoubleClick && !zoomOnPinch) {
      return false;
    }

    // during a selection we prevent all other interactions
    if (userSelectionActive) {
      return false;
    }

    // we want to disable pinch-zooming while making a connection
    if (connectionInProgress && !isWheelEvent) {
      return false;
    }

    // if the target element is inside an element with the nowheel class, we prevent zooming
    if (isWrappedWithClass(event, noWheelClassName) && isWheelEvent) {
      return false;
    }

    // if the target element is inside an element with the nopan class, we prevent panning
    if (
      isWrappedWithClass(event, noPanClassName) &&
      (!isWheelEvent || (panOnScroll && isWheelEvent && !zoomActivationKeyPressed))
    ) {
      return false;
    }

    if (!zoomOnPinch && event.ctrlKey && isWheelEvent) {
      return false;
    }

    if (!zoomOnPinch && event.type === 'touchstart' && event.touches?.length > 1) {
      event.preventDefault(); // if you manage to start with 2 touches, we prevent native zoom
      return false;
    }

    // when there is no scroll handling enabled, we prevent all wheel events
    if (!zoomScroll && !panOnScroll && !pinchZoom && isWheelEvent) {
      return false;
    }

    // if the pane is not movable, we prevent dragging it with mousestart or touchstart
    if (!panOnDrag && (event.type === 'mousedown' || event.type === 'touchstart')) {
      return false;
    }

    // if the pane is only movable using allowed clicks
    if (Array.isArray(panOnDrag) && !panOnDrag.includes(event.button) && event.type === 'mousedown') {
      return false;
    }

    // We only allow right clicks if pan on drag is set to right click
    const buttonAllowed =
      (Array.isArray(panOnDrag) && panOnDrag.includes(event.button)) || !event.button || event.button <= 1;

    // d3-zoom rejects Ctrl-modified mouse drags by default because Ctrl+wheel is
    // commonly used for pinch zooming. Allow the drag when Control is the
    // configured pan activation key, while retaining the wheel safeguard.
    return (!event.ctrlKey || isWheelEvent || panActivationKeyPressed) && buttonAllowed;
  };
}
